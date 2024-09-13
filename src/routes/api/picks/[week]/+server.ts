import type { RequestHandler } from './$types'
import { sql, eq, aliasedTable } from 'drizzle-orm'
import { prod as db } from '$lib/server/db'
import { picks, teams, users } from '$lib/server/models'
import { getPickPointsForWeek } from '$lib/server/queries'

export const GET: RequestHandler = async ({ params }) => {
  const week = parseInt(params.week, 10)
  if(isNaN(week)) {
    return new Response(JSON.stringify({ error: 'Invalid week number' }), { status: 400 })
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
      const pointsData = pickPoints.find(p => p.teamId === pick.teamId && p.userId === pick.userId)
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