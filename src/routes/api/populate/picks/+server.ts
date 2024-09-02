import type { RequestHandler } from './$types'
import { db } from '$lib/db'
import { picks, teams, users, weekSchedules } from '$lib/models'

export const GET: RequestHandler = async () => {
  try {
    const userIds = db.select({id: users.id}).from(users).orderBy(users.id).all().map(x => x.id)
    const teamIds = db.select({id: teams.id}).from(teams).orderBy(teams.id).all().map(x => x.id)
    const weeks = db.select({week: weekSchedules.week}).from(weekSchedules).groupBy(weekSchedules.week).orderBy(weekSchedules.week).all().map(x => x.week)
    const rounds = 4

    const pickRecords: { week: number; round: number; userId: number; teamId: number; points: number; }[] = []

    for (const week of weeks) {
      for (let round = 1; round <= rounds; round++) {
        const shuffledTeamIds = teamIds.sort(() => Math.random() - 0.5)

        userIds.forEach((user, index) => {
          const team = shuffledTeamIds[index]
          pickRecords.push({
            week: week,
            round: round,
            userId: user,
            teamId: team,
            points: Math.floor(Math.random() * 51),
          })
        })
      }
    }

    for (const record of pickRecords) {
      await db.insert(picks).values(record).onConflictDoNothing()
    }

    return new Response(JSON.stringify({
      message: `Seeded picks table with the following info:`,
      data: {
        users: userIds,
        teams: teamIds,
        weeks: weeks,
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' }})
  } catch (error: any) {
    console.error(`Failed to populate picks table: `, error)
    return new Response(JSON.stringify({
      error: `Failed to populate picks table.`,
      details: error.message || error.toString()
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}