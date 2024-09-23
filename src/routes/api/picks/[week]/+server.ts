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

  const existingPicks = await db.select().from(picks).where(eq(picks.week, week))

  if (existingPicks.length > 0) {
    return new Response(JSON.stringify({ picks: existingPicks }), { status: 200 })
  }

  try {
    const assignedBy = aliasedTable(users, 'assignedBy')
    const pickData = await db
      .select({
        week: picks.week,
        roundNum: picks.round,
        fullName: sql`${users.firstName} || ' ' || ${users.lastName} as fullName`,
        teamName: teams.name,
        assignedBy: sql`${assignedBy.firstName} || ' ' || ${assignedBy.lastName} as assignedBy`,
        userId: picks.userId,
        teamId: picks.teamId,
      })
      .from(picks)
      .leftJoin(users, eq(users.id, picks.userId))
      .leftJoin(teams, eq(teams.teamId, picks.teamId))
      .leftJoin(assignedBy, eq(assignedBy.id, picks.assignedById))
      .where(eq(picks.week, week))
      .orderBy(picks.round)

    const pickPoints = await getPickPointsForWeek(week)

    const result = pickData.map(pick => {
      const pointsData = pickPoints.find((p: { teamId: number; userId: number }) => p.teamId === pick.teamId && p.userId === pick.userId)
      return {
        ...pick,
        points: pointsData ? pointsData.points : 0,
      }
    })

    return new Response(JSON.stringify({ data: result }), { status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Failed to retrieve picks' }), { status: 500 })
  }
}