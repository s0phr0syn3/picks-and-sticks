import { db } from "$lib/db"
import { users } from "$lib/models"

export async function randomizeFirstWeekOrder() {
  const allUsers = await db.select({firstName: users.firstName, lastName: users.lastName}).from(users)

  if (allUsers.length === 0) {
    console.log(`allUsers length is 0, returning empty array`)
    return []
  }

  const shuffledUsers = allUsers.sort(() => Math.random() - 0.5);

  return shuffledUsers.map(user => `${user.firstName} ${user.lastName}`)
}