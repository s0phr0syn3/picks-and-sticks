# Draft: preference autopick + SSE presence — design

> **Superseded in part.** This spec predates the season model, the
> round-differentiated fallback, forfeited sticks, and the single-list
> (top for picks, bottom for sticks) rule. Where the two disagree, the plan wins:
> `docs/plans/2026-09-07-seasons-autopick-sse.md`. Kept for the reasoning behind
> SSE-as-presence and the Cloudflare/nginx analysis, which still hold.

**Date:** 2026-09-06
**Goal:** Let people rank teams ahead of a draft. If they aren't present when their
turn comes, the system picks for them from that list. No manual intervention.

## Decisions locked

- **Preferences are a fallback for everyone**, not an absent/present flag. Anyone may
  submit a ranked list; it fires only if their turn goes unattended.
- **Presence comes from the SSE connection**, not a separate mechanism. An open
  `EventSource` to the draft stream *is* the presence signal.
- **Trigger:** absent -> resolve immediately. Present -> grace period, then resolve.
- **No admin "resolve now" button.** Automation is the point.

## Behavior matrix

| User state | Behavior |
|---|---|
| No open stream | Autopick fires immediately from their list |
| Stream open | Normal turn, they pick manually |
| Stream open, idle past grace | Autopick fires (stepped away) |
| No preferences submitted | Falls through to existing weighted-random selection |

## Schema

New table:

```sql
draft_preferences (
  id          integer primary key,
  week        integer not null,
  user_id     text    not null references users(id),
  team_id     integer not null references teams(team_id),
  rank        integer not null,        -- 1 = most wanted
  created_at  integer not null,
  updated_at  integer not null,
  unique (week, user_id, team_id)
)
```

Deliberately **no** `unique(week, user_id, rank)` — it makes reordering require
temp-value gymnastics. The drag-and-drop UI saves the whole list at once, so
save = `DELETE` all rows for `(week, user_id)` then bulk `INSERT`, inside one
better-sqlite3 transaction. Ordering integrity comes from rewriting the set,
not from a constraint.

Add to `picks`:

```sql
turn_started_at integer   -- unix seconds; set when this pick becomes the active turn
```

`assignedById` and `reasoning` already exist and are reused as-is.

## Module extraction

`src/lib/server/queries.ts` is 1156 lines. Adding autopick to it makes a file that
is already hard to hold in your head worse. Extract to `src/lib/server/draft/`:

- `order.ts`     — pick order determination (moved from queries.ts ~line 938)
- `selection.ts` — weighted random selection (moved, ~lines 749-900)
- `preferences.ts` — read/write ranked lists
- `autopick.ts`  — resolution algorithm below
- `presence.ts`  — SSE client registry
- `bus.ts`       — broadcast helper

Move first, verify tests still pass, then add. Do not do both in one commit.

## Presence + SSE

`src/lib/server/draft/presence.ts` holds an in-process registry. This is sound
because adapter-node + PM2 is a single long-lived process; it would not be on a
serverless adapter.

```ts
type Client = { userId: string; week: number; controller: ReadableStreamDefaultController }
const clients = new Set<Client>()

export function addClient(c: Client): void
export function removeClient(c: Client): void
export function isPresent(week: number, userId: string): boolean   // >= 1 open stream
export function broadcast(week: number, event: string, data: unknown): void
```

Count connections, do not store a boolean — two tabs open, one closed, still present.

Endpoint: `src/routes/api/draft/[week]/stream/+server.ts`

```ts
return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',   // no-transform stops Cloudflare compressing
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'                    // nginx honors per-response; ignored if absent
  }
})
```

On `start`: register the client, immediately enqueue an `event: snapshot` with full
draft state so the client needs no separate fetch. On `cancel`: deregister, then call
`resolveTurnIfDue(week)` — a disconnect may mean the person on the clock just left.

**One global heartbeat interval**, not one per connection: every 20s write `: ping\n\n`
to every client. Required — Cloudflare drops idle connections near 100s, and a dead
peer that never fires `cancel` would otherwise read as present forever and block
their own autopick.

## Autopick resolution

```ts
resolveTurnIfDue(week: number): number   // returns count of picks made
```

Loop, bounded by remaining pick count:

1. Find first pick with `teamId === null` in order. None -> draft complete, return.
2. Identify the user on the clock.
3. If `isPresent(week, userId)` **and** `now - turn_started_at < GRACE` -> stop.
4. Otherwise resolve:
   - Load their preferences for the week ordered by rank.
   - Take the first team still available.
   - Found -> assign it; `reasoning = "Auto-pick: rank N preference"`.
   - List empty or exhausted -> fall back to existing weighted-random selection;
     `reasoning` should say so.
5. Set the next pending pick's `turn_started_at = now`.
6. `broadcast(week, 'pick', ...)`.
7. Continue the loop — consecutive absent users must all resolve in one pass, not
   one per cron tick.

**Call sites:** after any manual pick; when the draft starts; on every cron tick;
on SSE disconnect.

## Cron backstop

Reuse the existing `node-cron` pattern from `live-score-scheduler.ts`. Every 10s,
call `resolveTurnIfDue` for any week with an unlocked, incomplete draft.

This is what makes the design restart-safe. The presence map is in memory and dies
with the process, but `turn_started_at` is in SQLite — so after a restart the sweep
still resolves overdue turns, and clients reconnect on their own via EventSource.
A draft can never permanently stall.

## UI

- **Preferences page** (`/draft/[week]/preferences`): drag-to-rank available teams
  using `svelte-dnd-action`, already a dependency. Save writes the whole ordered list.
- **Draft page**: replace `pollDraftUpdates` and its `JSON.stringify` deep-compare with
  an `EventSource` subscription. Keep the existing new-pick highlight and notification
  logic — it is driven by diffing state, and events give it better input than polling did.
- Show who is connected. Presence is now known server-side, so surfacing it is nearly free
  and makes the autopick behavior legible rather than mysterious.

## Build order

Each step ships value and none is discarded if the next never happens.

1. **Preferences table + UI.** Standalone. No dependency on anything below.
2. **Autopick + cron backstop, presence-blind** (everyone treated as absent after grace).
   Works with the existing 2s polling. **If Thursday arrives here, the feature works.**
3. **SSE stream + presence registry.** Changes exactly one predicate in step 2:
   `now - turn_started_at < GRACE` becomes `isPresent(...) && now - turn_started_at < GRACE`.
4. **Draft page: polling -> EventSource.** Delete the 2s poll and the deep-compare.

## Testing

- Preference save/reorder round-trip; the delete+insert transaction.
- Autopick picks rank 1 when available; rank 2 when rank 1 is taken.
- Exhausted list falls back to weighted-random.
- Empty list falls back to weighted-random.
- **Consecutive absent users all resolve in a single `resolveTurnIfDue` pass.**
- Present user inside grace is not auto-picked.
- Present user past grace is auto-picked.
- Restart safety: clear the presence map mid-draft, confirm the cron sweep still resolves.

## Risks

- **Cloudflare buffering** is the most likely failure and it fails *invisibly* — the
  connection opens and no events arrive. Test against production, not just `npm run dev`;
  local dev has neither proxy in the path.
- **Presence != attention.** A tab open on a closed laptop reads as present until the
  heartbeat reaps it. The grace period is the backstop; the heartbeat interval sets how
  fast a dead peer is noticed.
- **Deadline.** Steps 1-2 are the feature. Steps 3-4 are the upgrade. Shipping 1-2 by
  Thursday and 3-4 during a bye week is a real option and costs nothing in rework.
