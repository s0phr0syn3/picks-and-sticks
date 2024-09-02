import { db } from "$lib/db"
import { picks, users } from '$lib/models'
import { sql, sum, desc } from 'drizzle-orm'

export async function randomizeFirstWeekOrder() {
  const allUsers = db.select({firstName: users.firstName, lastName: users.lastName}).from(users).all()

  if (allUsers.length === 0) {
    console.log(`allUsers length is 0, returning empty array`)
    return []
  }

  const shuffledUsers = allUsers.sort(() => Math.random() - 0.5);

  return shuffledUsers.map(user => `${user.firstName} ${user.lastName}`)
}

export async function determinePickOrder(week: number) {
  const previousWeek = week - 1

  if (previousWeek === 0) {
    return randomizeFirstWeekOrder()
  } else {
    const userPoints = db.select({
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        totalPoints: sql`coalesce(sum(picks.points), 0)`,
      })
      .from(users)
      .leftJoin(picks, sql`${users.id} = ${picks.userId}`)
      .where(sql`${picks.week} = ${previousWeek}`)
      .groupBy(picks.userId)
      .orderBy(desc(sum(picks.points)))
      .all()
    return userPoints.map(user => `${user.firstName} ${user.lastName} (${user.totalPoints} ${user.totalPoints === 1 ? 'point' : 'points'})`)
  }
}