import type { RequestHandler } from './$types'
import { sql, eq, aliasedTable, and, or, isNull } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { picks, schedules, teams, users } from '$lib/server/models'
import { getPickPointsForWeek, getAvailableTeams } from '$lib/server/queries'

const draftState: Record<number, { picks: any[], selectedTeams: Set<number> }> = {}

export const GET: RequestHandler = async ({ params }) => {
  const week = parseInt(params.week, 10)

  if (isNaN(week)) {
    return new Response(JSON.stringify({ error: `Invalid week: ${week.toString()}` }), { status: 400 })
  }

  if (!draftState[week]) {
    draftState[week] = { picks: [], selectedTeams: new Set() }
  }

  const availableTeams = await getAvailableTeams(week, draftState[week].selectedTeams)

  const gameUsers = await db.select().from(users).orderBy(users.id)

  return new Response(
    JSON.stringify({
      teams: availableTeams,
      users: gameUsers,
      draftPicks: draftState[week].picks,
      week,
    }),
    { status: 200 }
  )
}