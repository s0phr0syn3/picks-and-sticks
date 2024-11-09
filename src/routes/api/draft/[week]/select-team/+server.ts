import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { picks } from '$lib/server/models'
import { eq } from 'drizzle-orm'
import { getAvailableTeams, getPicksForWeek } from '$lib/server/queries'

interface Pick {
  teamId: number | null
}

export const GET: RequestHandler = async ({ params }) => {
  const week = parseInt(params.week, 10)

  if (isNaN(week)) {
    return new Response(JSON.stringify({ error: `Invalid week: ${week}` }), { status: 400 })
  }

  try {
    const draftState: Pick[] = getPicksForWeek(week)
    const selectedTeams = new Set(draftState
      .filter((pick): pick is Pick & { teamId: number } => pick.teamId !== null)
      .map(pick => pick.teamId)
    )

    const availableTeams = getAvailableTeams(week, selectedTeams)

    return new Response(
      JSON.stringify({
        draftState,
        availableTeams,
        week
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Failed to retrieve draft data: ${error.message}` }), { status: 500 })
  }
}

export const POST: RequestHandler = async ({ params, request }) => {
  const week = parseInt(params.week, 10)
  const { pickId, teamId } = await request.json()

  console.log(`week: ${week}`)
  console.log(`pickId: ${pickId}`)
  console.log(`teamId: ${teamId}`)

  if (!week || !pickId || !teamId) {
    return new Response(JSON.stringify({ error: `Invalid data` }), { status: 400 })
  }

  try {
    await db
      .update(picks)
      .set({
        teamId: teamId
      })
      .where(eq(picks.id, pickId))
      .execute()

    const draftState: Pick[] = getPicksForWeek(week)

    const selectedTeams = new Set(draftState
      .filter((pick): pick is Pick & { teamId: number } => pick.teamId !== null)
      .map(pick => pick.teamId)
    )

    const availableTeams = getAvailableTeams(week, selectedTeams)

    return new Response(
      JSON.stringify({
        draftState: draftState,
        availableTeams: availableTeams,
        week: week,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } },)
  } catch (error) {
    return new Response(JSON.stringify({ error: `Failed to select team` }), { status: 500 })
  }
}