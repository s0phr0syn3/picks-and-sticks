# Seasons + Autopick + SSE — Implementation Plan

**Goal:** Make the app season-aware, let absent drafters be picked for from a ranked
list, and replace 2-second polling with SSE that doubles as presence detection.

**Architecture:** A `seasons` table becomes the source of truth for week numbering,
replacing a hardcoded date. Draft logic moves out of `queries.ts` into
`src/lib/server/draft/`. Autopick resolves unattended turns from stored preferences,
driven by a cron sweep over a `turn_started_at` timestamp. An SSE endpoint provides
both live updates and the presence signal that decides whether to wait at all.

**Tech Stack:** SvelteKit (adapter-node), Drizzle ORM, better-sqlite3, node-cron,
svelte-dnd-action. PM2 behind nginx behind Cloudflare.

**Spec:** `docs/specs/2026-09-06-draft-autopick-and-sse-design.md`

## Global Constraints

- **Deadline: NFL week 1, Thursday 2026-09-10.** Phase 1 is blocking; 2 and 3 are not.
- 2026 season start date: **2026-09-10** (Thursday after Labor Day, 2026-09-07).
- Production DB: `/var/www/picks-and-sticks/src/lib/server/production.db`, 176 KB,
  5 users, 320 picks, 80 weekly scores, weeks 1-13/15/16 present.
- **Back up production.db before any migration.** It is the only copy of the 2025 season.
- Migrations follow the existing pattern in `scripts/migrate-*.ts`: read `NODE_ENV`,
  resolve a path from `DB_PATHS`, open with better-sqlite3, run, log.
- Deploy is `scripts/deploy.sh` — `git pull`, `npm install`, migrations, build,
  `pm2 restart`. New migration scripts must be added to that script explicitly.
- Node now binds `127.0.0.1:3000` (changed 2026-09-07). Do not revert to `0.0.0.0`.

---

# Phase 1 — Season model (BLOCKING, do first)

Without this the app computes week 18 and every pick files under the wrong week.

### Task 1: Back up production and add the `seasons` table

**Files:**
- Create: `scripts/migrate-add-seasons.ts`
- Modify: `src/lib/server/models.ts`

**Produces:** `seasons` table; `seasons` Drizzle model exported.

- [ ] **Step 1: Back up production before touching anything**

```bash
ssh root@5.78.74.168 'cp /var/www/picks-and-sticks/src/lib/server/production.db \
  /root/production.db.bak-$(date +%Y%m%d)'
```

- [ ] **Step 2: Add the Drizzle model** to `src/lib/server/models.ts`

```ts
export const seasons = sqliteTable('seasons', {
	id: integer('id').primaryKey(),
	year: integer('year').notNull().unique(),
	startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
	endDate: integer('end_date', { mode: 'timestamp' }),
	status: text('status').notNull(), // 'upcoming' | 'active' | 'archived'
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});
```

- [ ] **Step 3: Write the migration** — `scripts/migrate-add-seasons.ts`

Complete file. Follows the same shape as `scripts/migrate-add-reasoning.ts`:
imports, `DB_PATHS`/`ENV` resolution, try/catch/finally with `sqlite.close()`.

```ts
#!/usr/bin/env node

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { config } from 'dotenv';
import * as path from 'path';

config();

const DB_PATHS = {
	production: process.env.DB_PATH_PROD || './src/lib/server/production.db',
	development: process.env.DB_PATH_DEV || './src/lib/server/development.db',
	test: process.env.DB_PATH_TEST || './src/lib/server/test.db'
};

const ENV = (process.env.NODE_ENV || 'development') as keyof typeof DB_PATHS;

async function migrateSeasons() {
	console.log(`🚀 Running seasons migration for ${ENV} database...`);

	const dbPath = DB_PATHS[ENV];
	console.log(`📁 Database location: ${path.resolve(dbPath)}`);

	const sqlite = new Database(dbPath);
	drizzle(sqlite); // not used here; kept for parity with the other scripts

	try {
		sqlite.exec(`
			CREATE TABLE IF NOT EXISTS seasons (
				id         INTEGER PRIMARY KEY,
				year       INTEGER NOT NULL UNIQUE,
				start_date INTEGER NOT NULL,
				end_date   INTEGER,
				status     TEXT    NOT NULL CHECK (status IN ('upcoming','active','archived')),
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);
		`);
		console.log('✅ seasons table ready');

		const now = Math.floor(Date.now() / 1000);
		const insert = sqlite.prepare(`
			INSERT OR IGNORE INTO seasons (year, start_date, end_date, status, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`);

		// Month is 0-indexed: 8 = September.
		// Drizzle's integer({ mode: 'timestamp' }) stores unix SECONDS, not ms.
		insert.run(2025, Math.floor(Date.UTC(2025, 8, 4) / 1000),
		                 Math.floor(Date.UTC(2026, 0, 5) / 1000), 'archived', now, now);
		insert.run(2026, Math.floor(Date.UTC(2026, 8, 10) / 1000),
		                 null, 'upcoming', now, now);

		const rows = sqlite.prepare('SELECT year, status FROM seasons ORDER BY year').all();
		console.log('\n📊 Seasons:');
		rows.forEach((r: any) => console.log(`   - ${r.year}: ${r.status}`));

		console.log(`\n✨ Seasons migration complete for ${ENV} environment!`);
	} catch (error) {
		console.error('❌ Migration failed:', error);
		process.exit(1);
	} finally {
		sqlite.close();
	}
}

migrateSeasons().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
```

`INSERT OR IGNORE` plus `CREATE TABLE IF NOT EXISTS` makes this safe to re-run,
which matters because `scripts/deploy.sh` runs every migration on every deploy.

- [ ] **Step 4: Verify** — `sqlite3 src/lib/server/development.db "SELECT * FROM seasons;"`
      Expect two rows: 2025 archived, 2026 upcoming.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-add-seasons.ts src/lib/server/models.ts
git commit -m "feat: add seasons table"
```

---

### Task 2: Add `season_id` to the three season-scoped tables

`weeks` and `user_weekly_scores` have unique constraints that must become composite.
SQLite cannot alter a constraint in place, so all three tables get rebuilt. Doing
them in one script and one transaction keeps the database consistent if it fails.

**Files:**
- Create: `scripts/migrate-add-season-scoping.ts`
- Modify: `src/lib/server/models.ts`

**Consumes:** `seasons` table from Task 1.
**Produces:** `weeks.season_id`, `picks.season_id`, `user_weekly_scores.season_id`;
composite uniques `(season_id, week_number)` and `(season_id, user_id, week)`.

- [ ] **Step 1: Write the migration**

**`PRAGMA foreign_keys` cannot be changed inside a transaction** — it silently
no-ops. It must be set before `BEGIN` and restored after `COMMIT`.

```ts
const sqlite = new Database(dbPath);
sqlite.pragma('foreign_keys = OFF');

const migrate = sqlite.transaction(() => {
  const s2025 = sqlite.prepare('SELECT id FROM seasons WHERE year = 2025').get() as { id: number };

  // --- weeks: unique(week_number) -> unique(season_id, week_number)
  sqlite.exec(`
    CREATE TABLE weeks_new (
      id              INTEGER PRIMARY KEY,
      season_id       INTEGER NOT NULL REFERENCES seasons(id),
      week_number     INTEGER NOT NULL,
      punishment      TEXT,
      is_draft_locked INTEGER NOT NULL DEFAULT 0,
      is_simulated    INTEGER NOT NULL DEFAULT 0,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,
      UNIQUE (season_id, week_number)
    );
    INSERT INTO weeks_new
      SELECT id, ${s2025.id}, week_number, punishment, is_draft_locked,
             is_simulated, created_at, updated_at FROM weeks;
    DROP TABLE weeks;
    ALTER TABLE weeks_new RENAME TO weeks;
  `);

  // --- picks: no constraint change, but add the column
  sqlite.exec(`
    CREATE TABLE picks_new (
      id              INTEGER PRIMARY KEY,
      season_id       INTEGER NOT NULL REFERENCES seasons(id),
      week            INTEGER NOT NULL,
      round           INTEGER NOT NULL,
      user_id         TEXT    NOT NULL REFERENCES users(id),
      team_id         INTEGER REFERENCES teams(team_id),
      order_in_round  INTEGER NOT NULL,
      assigned_by_id  TEXT REFERENCES users(id),
      reasoning       TEXT,
      turn_started_at INTEGER
    );
    INSERT INTO picks_new (id, season_id, week, round, user_id, team_id,
                           order_in_round, assigned_by_id, reasoning, turn_started_at)
      SELECT id, ${s2025.id}, week, round, user_id, team_id,
             order_in_round, assigned_by_id, reasoning, NULL FROM picks;
    DROP TABLE picks;
    ALTER TABLE picks_new RENAME TO picks;
  `);

  // --- user_weekly_scores: unique(user_id, week) -> unique(season_id, user_id, week)
  sqlite.exec(`
    CREATE TABLE user_weekly_scores_new (
      id               INTEGER PRIMARY KEY,
      season_id        INTEGER NOT NULL REFERENCES seasons(id),
      user_id          TEXT    NOT NULL REFERENCES users(id),
      week             INTEGER NOT NULL,
      current_points   INTEGER NOT NULL DEFAULT 0,
      projected_points INTEGER NOT NULL DEFAULT 0,
      completed_games  INTEGER NOT NULL DEFAULT 0,
      total_games      INTEGER NOT NULL DEFAULT 0,
      last_updated     INTEGER NOT NULL,
      UNIQUE (season_id, user_id, week)
    );
    INSERT INTO user_weekly_scores_new
      SELECT id, ${s2025.id}, user_id, week, current_points, projected_points,
             completed_games, total_games, last_updated FROM user_weekly_scores;
    DROP TABLE user_weekly_scores;
    ALTER TABLE user_weekly_scores_new RENAME TO user_weekly_scores;
  `);
});

migrate();
sqlite.pragma('foreign_keys = ON');
console.log(sqlite.pragma('foreign_key_check'));  // expect []
```

`turn_started_at` is added here rather than in a later migration so the production
DB is only rebuilt once. Phase 2 uses it; Phase 1 leaves it NULL.

- [ ] **Step 2: Update the Drizzle models** to match — add `seasonId` to `picks`,
      `weeks`, `userWeeklyScores`; add `turnStartedAt` to `picks`; change the unique
      helpers to `unique().on(table.seasonId, table.userId, table.week)` and
      `unique().on(table.seasonId, table.weekNumber)`.

- [ ] **Step 3: Verify row counts survived**

```bash
sqlite3 src/lib/server/development.db \
  "SELECT (SELECT COUNT(*) FROM weeks), (SELECT COUNT(*) FROM picks), \
          (SELECT COUNT(*) FROM user_weekly_scores);"
```
Expect the same counts as before: production is 15 / 320 / 80.

- [ ] **Step 4: Verify no orphaned foreign keys** — `PRAGMA foreign_key_check;` returns empty.

- [ ] **Step 5: Commit**

---

### Task 3: Derive the current week from data

**Files:**
- Create: `src/lib/server/season.ts`
- Modify: `src/lib/server/live-score-scheduler.ts:197-210`

**Consumes:** `seasons` table.
**Produces:** `getActiveSeason()`, `getCurrentWeek()`.

- [ ] **Step 1: Write the failing test** — `src/lib/server/season.test.ts`

```ts
test('week 1 on opening Thursday', () => {
  expect(weekFor(SEASON_START, SEASON_START)).toBe(1);
});
test('week 1 on the Friday after kickoff', () => {
  expect(weekFor(SEASON_START, SEASON_START + 86400)).toBe(1);
});
test('week 2 seven days after kickoff', () => {
  expect(weekFor(SEASON_START, SEASON_START + 7 * 86400)).toBe(2);
});
test('clamps at 18', () => {
  expect(weekFor(SEASON_START, SEASON_START + 400 * 86400)).toBe(18);
});
test('clamps at 1 before the season starts', () => {
  expect(weekFor(SEASON_START, SEASON_START - 5 * 86400)).toBe(1);
});
```

That last case is the bug that bit you: 368 days elapsed produced 18, and nothing
clamped or noticed the season had ended.

- [ ] **Step 2: Implement** — `src/lib/server/season.ts`

```ts
export function weekFor(seasonStart: number, now: number): number {
	const days = Math.floor((now - seasonStart) / 86400);
	return Math.min(18, Math.max(1, Math.floor(days / 7) + 1));
}

export function getActiveSeason() {
	return db.select().from(seasons).where(eq(seasons.status, 'active')).get() ?? null;
}

export function getCurrentWeek(): { seasonId: number; week: number } | null {
	const s = getActiveSeason();
	if (!s) return null;
	return { seasonId: s.id, week: weekFor(s.startDate.getTime() / 1000, Date.now() / 1000) };
}
```

- [ ] **Step 3: Replace the hardcoded date.** In `live-score-scheduler.ts`, delete
      `const seasonStart = new Date('2025-09-04')` and the surrounding arithmetic;
      call `getCurrentWeek()`. If it returns `null` (no active season), the scheduler
      should log and idle rather than defaulting to week 1 — a scheduler polling
      week 1 of a season that hasn't started is how you get bogus live scores.

- [ ] **Step 4: Run tests, commit.**

---

### Task 4: Season lifecycle transitions

**Files:**
- Modify: `src/lib/server/season.ts`
- Modify: `src/lib/server/live-score-scheduler.ts` (add to existing cron)

**Produces:** `advanceSeasonLifecycle()`.

- [ ] **Step 1: Write the failing tests**

```ts
test('upcoming becomes active on start date', ...);
test('active becomes archived once end_date passes', ...);
test('never two active seasons at once', ...);
test('archived season is never reactivated', ...);
```

- [ ] **Step 2: Implement**

```ts
export function advanceSeasonLifecycle(now = Date.now() / 1000): void {
	// upcoming -> active
	db.update(seasons).set({ status: 'active', updatedAt: new Date() })
		.where(and(eq(seasons.status, 'upcoming'), lte(seasons.startDate, new Date(now * 1000)))).run();
	// active -> archived
	db.update(seasons).set({ status: 'archived', updatedAt: new Date() })
		.where(and(eq(seasons.status, 'active'), isNotNull(seasons.endDate),
		           lte(seasons.endDate, new Date(now * 1000)))).run();
}
```

- [ ] **Step 3: Call it from the existing cron** in `live-score-scheduler.ts`, once
      an hour. It is idempotent, so frequency only affects how promptly a season flips.

- [ ] **Step 4: Archived seasons are read-only.** In the scoreboard and results
      routes, when the requested season's status is `archived`, render results and
      hide draft/pick controls. Enforce it server-side in the pick actions too —
      a hidden button is not access control.

- [ ] **Step 5: Commit.**

---

### Task 5: Seed the 2026 season and deploy Phase 1

- [ ] **Step 1:** Add both migration scripts to `scripts/deploy.sh` alongside the
      existing `migrate-add-*.ts` invocations.
- [ ] **Step 2:** Seed 2026 schedules from ESPN — the existing
      `/api/seed/schedules-espn` endpoint, scoped to the new season.
- [ ] **Step 3:** Create week rows for 2026 weeks 1-18 under the new `season_id`.
- [ ] **Step 4:** Deploy. Verify `getCurrentWeek()` returns week 1, not 18.
- [ ] **Step 5:** Verify the 2025 scoreboard still renders, read-only.

**Phase 1 is the ship-critical boundary. Everything below is upside.**

---

# Phase 2 — Preferences + autopick

### Task 6: `draft_preferences` table

**Files:**
- Create: `scripts/migrate-add-draft-preferences.ts`
- Modify: `src/lib/server/models.ts`

```sql
CREATE TABLE draft_preferences (
  id         INTEGER PRIMARY KEY,
  season_id  INTEGER NOT NULL REFERENCES seasons(id),
  week       INTEGER NOT NULL,
  user_id    TEXT    NOT NULL REFERENCES users(id),
  team_id    INTEGER NOT NULL REFERENCES teams(team_id),
  rank       INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (season_id, week, user_id, team_id)
);
CREATE INDEX idx_draft_prefs_lookup ON draft_preferences (season_id, week, user_id, rank);
```

No unique on `rank` — it would force temp-value gymnastics on reorder. Saving
replaces the whole list in one transaction, so ordering integrity comes from
rewriting the set.

### Task 7: Extract draft logic out of `queries.ts`

`queries.ts` is 1156 lines. **Move first, verify tests pass, commit. Then add.**
Doing the move and the feature in one commit makes the diff unreviewable.

- `src/lib/server/draft/order.ts` — pick order (from `queries.ts` ~line 938)
- `src/lib/server/draft/selection.ts` — weighted random (~lines 749-900)
- `src/lib/server/draft/preferences.ts` — list CRUD
- `src/lib/server/draft/autopick.ts` — resolution
- `src/lib/server/draft/presence.ts` — Phase 3
- `src/lib/server/draft/bus.ts` — Phase 3

### Task 7b: Auto-create and auto-start each week's draft

**Why this exists:** 2025 lost weeks 14, 17 and 18 — and those weeks have no row in
`weeks` at all, because week rows are created lazily when someone visits the draft
page. Nobody opened it. Autopick alone would not have saved those weeks: with no
draft started there are no pick rows, no `turn_started_at`, and nothing for the
sweep to resolve. **This task is the one that actually fixes the missing-weeks
problem.** Task 9 only helps once a draft exists.

**Files:**
- Modify: `src/lib/server/draft/autopick.ts` (or a new `src/lib/server/draft/schedule.ts`)
- Modify: the cron registered in `live-score-scheduler.ts`

**Consumes:** `getActiveSeason()`, `getCurrentWeek()` (Task 3); `startDraftForWeek`
(existing logic in `src/routes/api/picks/[week]/start-draft/+server.ts`, which should
be extracted to a lib function so both the route and the cron can call it).

**Produces:** `ensureWeekReady(seasonId: number, week: number): void`

- [ ] **Step 1: Extract the start-draft logic out of the route.** It currently lives
      in the `POST` handler and inserts `picks` rows. Move it to
      `src/lib/server/draft/start.ts` as `startDraftForWeek(seasonId, week)`; the
      route becomes a thin caller. Cron and HTTP must share one implementation.

- [ ] **Step 2: Write the failing tests**

```ts
test('creates the week row if absent');
test('is idempotent — running twice does not duplicate weeks or picks');
test('does not start a draft for an archived season');
test('does not start a draft before the season start date');
test('sets turn_started_at on the first pending pick');
test('does not re-start a draft that is already complete');
```

Idempotency is the critical one: this runs every cron tick.

- [ ] **Step 3: Implement**

```ts
export function ensureWeekReady(seasonId: number, week: number): void {
	const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
	if (!season || season.status !== 'active') return;

	let row = db.select().from(weeks)
		.where(and(eq(weeks.seasonId, seasonId), eq(weeks.weekNumber, week))).get();
	if (!row) {
		db.insert(weeks).values({
			seasonId, weekNumber: week, isDraftLocked: false, isSimulated: false,
			createdAt: new Date(), updatedAt: new Date()
		}).run();
	}

	const existing = db.select().from(picks)
		.where(and(eq(picks.seasonId, seasonId), eq(picks.week, week))).all();
	if (existing.length === 0) {
		startDraftForWeek(seasonId, week);   // sets turn_started_at on pick 1
	}
}
```

- [ ] **Step 4: Register on the cron.** Once an hour is enough — the draft opening a
      few minutes late is irrelevant, and hourly keeps the idempotency cheap.
      Order matters: `advanceSeasonLifecycle()` -> `ensureWeekReady()` ->
      `resolveTurnIfDue()`. A season must be active before its week is created, and
      a week must exist before its turns can resolve.

- [ ] **Step 5: Decide the opening day.** Creating the draft on Tuesday gives people
      until Thursday kickoff to pick manually before autopick starts consuming
      preference lists. Make it a constant, not a literal buried in the cron.

- [ ] **Step 6: Commit.**

**With Tasks 7b, 9 and 10 together, a week where nobody shows up still produces a
complete set of picks and a scoreboard.** That is the actual requirement.

---

### Task 8: Preferences UI

- `src/routes/draft/[week]/preferences/+page.svelte` — drag-to-rank with
  `svelte-dnd-action`, already a dependency.
- Save writes the whole ordered list: `DELETE` then bulk `INSERT` in one
  better-sqlite3 transaction.

### Task 9: Autopick resolution

**Produces:** `resolveTurnIfDue(seasonId: number, week: number): number` — returns
the number of picks made.

#### The resolution table

Rounds 1-2 are **picks** (for yourself, want HIGH points). Rounds 3-4 are **sticks**
(chosen for a victim by `assignedById`, want them to score LOW). The pairings are
predetermined in the pick order, so a forfeit never reshuffles the draft — the slot
stays in place and only its owner and objective change.

| Round | Has a preference list | No list |
|---|---|---|
| **1** (pick) | top available preference | **random available team** — no criteria |
| **2** (pick) | top available preference | **worst** available (lowest expected points) |
| **3-4** (stick) | **bottom** available preference — your least-wanted team, handed to the victim | **FORFEITED** — see below |

Round 1 is deliberately unpunished. An absent player might get lucky or unlucky; the
bite starts at round 2.

**One list serves both directions.** Picks read from the top, sticks read from the
bottom. A separate "who to dump" list is unnecessary — your least-wanted available
team is exactly what you would stick someone with. This is also what makes submitting
a list worth doing: **submit and you keep your sticks; skip and you forfeit them.**

#### Forfeited sticks

When a stick slot resolves for a user with no list, the sticker loses the slot and
it becomes a self-pick for the victim, **resolved in the victim's favour**:

- Victim present -> they choose any available team, live.
- Victim absent, has a list -> their top available preference.
- Victim absent, no list -> **best** available team (highest expected points).

That last case matters. The punishment belongs to the forfeiter, so it must not
depend on whether the victim happened to show up. Without it, two mutually-absent
players produce the same outcome as a normal stick and the forfeiter goes unpunished.

Mechanically this is `assignedById = userId` (already the shape of a self-pick) plus
flipping `maximizePoints` from `false` to `true`. **No schema change.**

Forfeiture is evaluated **per slot**, when the slot comes up — not decided once at
draft start. That handles someone who shows for rounds 1-2 and then wanders off.

#### Week 1 has no expected points

`getExpectedTeamPoints(week)` averages scores from weeks **before** the target week.
In week 1 of a new season there is no history: every team returns 0, `pointsRange`
is 0, and "worst available" is undefined — the existing code gives everything
`pointsScore = 0.5`, so the punitive fallback silently stops being punitive on the
exact week you are shipping.

**Fix:** when the active season has no completed weeks, fall back to the previous
season's team averages. That is what the archived 2025 data is for.

```ts
export function getExpectedTeamPoints(seasonId: number, week: number): Record<number, number> {
	const current = averagesFor(seasonId, week);          // existing logic, season-scoped
	if (Object.keys(current).length > 0) return current;
	const prior = db.select().from(seasons)
		.where(and(eq(seasons.status, 'archived'), lt(seasons.year, currentYear)))
		.orderBy(desc(seasons.year)).get();
	return prior ? averagesFor(prior.id, 99) : {};        // 99 = all weeks
}
```

If there is no prior season either, every team ties at 0 — fall back to random for
all rounds rather than picking by team id, which would hand out Arizona every time.

**This is a signature change with an existing caller.** `getExpectedTeamPoints` is
currently `(week: number)` at `src/lib/server/queries.ts:820` and is called at
`queries.ts:919`. Both must move to `(seasonId, week)` in the same commit, or the
simulation path silently averages across seasons.

- [ ] **Step 1: Write the failing tests**

```ts
// preference list present
test('round 1 with a list picks rank 1 when available');
test('round 1 with a list picks rank 2 when rank 1 is taken');
test('round 3 stick with a list gives the victim the LOWEST-ranked available team');

// no list
test('round 1 with no list picks a random available team');
test('round 2 with no list picks the lowest expected-points team');
test('round 3 with no list FORFEITS: assignedById becomes the victim');
test('forfeited stick, victim absent with a list -> victim gets their top preference');
test('forfeited stick, victim absent with no list -> victim gets the BEST available');
test('forfeited stick, victim present -> slot waits for them to choose');

// ordering and edges
test('resolves consecutive absent users in a SINGLE pass');
test('two non-submitters each take the worst AVAILABLE at their own turn, not the same team');
test('ties in expected points break on team id, reproducibly');
test('week 1 with no season history falls back to prior season averages');
test('no prior season either -> random for all rounds, never throws');
test('does not pick for a present user inside the grace period');
test('does pick for a present user past the grace period');
test('sets turn_started_at on the next pending pick');
```

- [ ] **Step 2: Inject the RNG so round 1 is testable**

```ts
export function resolveTurnIfDue(
	seasonId: number, week: number, rng: () => number = Math.random
): number
```

A bare `Math.random()` makes the round-1 test unwritable. Pass a seeded stub in tests.

- [ ] **Step 3: Implement as a bounded loop**, not a single resolution. Consecutive
      absent users must all resolve in one pass — one-per-cron-tick would make a
      fully-absent draft crawl. Bound by remaining pick count.

- [ ] **Step 4: Write `reasoning` on every automated pick.** The column exists and
      nothing uses it well yet:
      - `Auto-pick: rank 3 preference`
      - `Auto-pick: no list, random (round 1)`
      - `Auto-pick: no list, lowest expected points (11.4 avg)`
      - `Forfeited stick by {name} — self-pick, best available (24.1 avg)`

      A punishment whose derivation is visible reads as a rule. One that just appears
      reads as a bug, and this league settles things by making someone eat a cherry.

- [ ] **Step 5: Commit.**

#### UI consequence for Task 14

A forfeited stick gives the victim a turn **outside their normal rotation**, at the
forfeiter's slot position. The draft page needs a distinct state for it —
"Bonus pick: {name} forfeited their stick" — or it looks like a scheduling bug.

#### Open question, not blocking

Stick pairings are predetermined, so a chronically absent player hands their fixed
victims a systematic edge all season. Fine at 5 players; rotating pairings weekly
would spread it if it ever grates.

### Task 10: Cron backstop

Reuse the `node-cron` pattern from `live-score-scheduler.ts`. Every 10s, call
`resolveTurnIfDue` for the active season's current week if its draft is unlocked
and incomplete. **This is what makes the design restart-safe** — the presence map
is in memory, but `turn_started_at` is in SQLite.

Phase 2 is complete and shippable here, with presence-blind grace-only behavior.


# Phase 3 — SSE + presence

### Task 11: Presence registry

`src/lib/server/draft/presence.ts`. Sound because adapter-node + PM2 is a single
long-lived process; would not be on a serverless adapter.

```ts
type Client = { userId: string; week: number; seasonId: number;
                controller: ReadableStreamDefaultController };
const clients = new Set<Client>();
export function addClient(c: Client): void;
export function removeClient(c: Client): void;
export function isPresent(seasonId: number, week: number, userId: string): boolean;
export function broadcast(seasonId: number, week: number, event: string, data: unknown): void;
```

Count connections, never store a boolean — two tabs open, one closed, still present.

### Task 12: SSE endpoint

`src/routes/api/draft/[week]/stream/+server.ts`

```ts
return new Response(stream, {
	headers: {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache, no-transform',
		'Connection': 'keep-alive',
		'X-Accel-Buffering': 'no'
	}
});
```

- `no-transform` stops Cloudflare compressing the stream.
- `X-Accel-Buffering: no` disables nginx buffering per-response — **no nginx config
  change needed**, and harmlessly ignored if nginx is absent.
- On `start`: register, then immediately enqueue `event: snapshot` with full draft
  state so the client needs no separate fetch.
- On `cancel`: deregister, then call `resolveTurnIfDue` — a disconnect may mean the
  person on the clock just left.
- **One global 20s heartbeat** writing `: ping\n\n` to all clients. Not optional:
  Cloudflare drops idle connections near 100s, and a dead peer that never fires
  `cancel` would read as present forever and block its own autopick.

### Task 13: Make autopick presence-aware

The only change to Task 9's logic is one predicate:

```diff
- if (now - turnStartedAt < GRACE) return;
+ if (isPresent(seasonId, week, userId) && now - turnStartedAt < GRACE) return;
```

That is the entire difference between Phase 2 and Phase 3 behavior.

### Task 14: Draft page — polling to EventSource

`src/routes/draft/[week]/+page.svelte`. Delete `pollDraftUpdates`, the
`JSON.stringify` deep-compare, and the 2s interval. Subscribe with `EventSource`.
Keep the new-pick highlight and notification logic — it diffs state, and events
give it better input than polling did.

Also update `LiveLeaderboard.svelte` (30s interval) to the same stream.

---

## Verification before Thursday

- [ ] `getCurrentWeek()` returns 1, not 18
- [ ] 2025 scoreboard renders read-only; no draft controls
- [ ] A 2026 week 1 draft can be created (the old `unique(week_number)` would have blocked this)
- [ ] `PRAGMA foreign_key_check` empty on production after migration
- [ ] Production row counts unchanged: 15 weeks / 320 picks / 80 scores
- [ ] **Test SSE against carsoncrew.io, not localhost.** Local dev has neither
      Cloudflare nor nginx in the path. Buffering failures are silent — the
      connection opens and no events arrive.

Behavioural checks for the autopick rules:

- [ ] `ensureWeekReady` is idempotent — run it twice, no duplicate weeks or picks
- [ ] A week nobody opens still gets created and drafted (the 2025 weeks 14/17/18 failure)
- [ ] Round 1, no list -> random; run it repeatedly and confirm the team varies
- [ ] Round 2, no list -> lowest expected points
- [ ] Round 3, no list -> forfeited; `assignedById` equals `userId` on that row
- [ ] Forfeited stick with an absent, listless victim -> victim gets the BEST available
- [ ] Two non-submitters take different teams, each the worst available at their own turn
- [ ] Week 1 falls back to 2025 averages rather than tying every team at 0
- [ ] Every automated pick has a non-null `reasoning`

## Risks

- **The migration is the only irreversible step**, though the 2025 data is
  explicitly expendable per the maintainer, so this is low-stakes. Back up anyway:
  `cp production.db production.db.bak` is one command.
- **`production.db` lives inside the repo tree** at `src/lib/server/production.db`,
  and deploy runs `git pull`. Confirm it is gitignored before deploying a migration.
- **Weeks 14, 17, 18 are missing from 2025** because no draft was ever started
  those weeks — the week rows do not exist. Archive the gap as-is; it is the honest
  record, and Task 7b is what prevents a repeat.
- **Cloudflare buffering fails silently.** Test on production early.
