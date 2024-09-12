import { sql } from 'drizzle-orm'
import { db } from "$lib/server/db"
import { picks, users, schedules } from '$lib/server/models'
import { randomSort } from '$lib/server/utils'

export async function randomizeFirstWeekOrder(): Promise<number[]> {
  // get all users from the db
  const allUsers = db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName
    })
    .from(users)
    .all()

  // if there are no users, return an empty array because there's nothing to randomize
  if (allUsers.length === 0) { return [] }

  const shuffledUsers = randomSort(allUsers)

  return shuffledUsers.map(user => user.id)
}

export async function determinePickOrder(week: number): Promise<number[]> {
  const previousWeek = week - 1

  if (previousWeek === 0) {
    return randomizeFirstWeekOrder()
  } else {
    const userPoints = db.select({
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        totalPoints: sql`coalesce(0, 0)`,
      })
      .from(users)
      .innerJoin(picks, sql`${users.id} = ${picks.userId} and ${picks.week} = ${previousWeek}`)
      .innerJoin(schedules, sql`${schedules.week} = ${picks.week} and ${picks.teamId} in (${schedules.homeTeamId}, ${schedules.awayTeamId})}`)
      .groupBy(picks.userId)
      .orderBy(sql`coalesce(0, 0)`)
      .all()
    return userPoints.map(user => user.userId)
  }
}