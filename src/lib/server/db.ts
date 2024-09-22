import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { teams, schedules, users, picks } from '$lib/server/models'

const prodDb = new Database('./src/lib/server/production.db')
const testDb = new Database('./src/lib/server/test.db')

const prod = drizzle(prodDb)
const test = drizzle(testDb)

export const db = prod

async function syncDatabases() {
  // prod
  await prod.select().from(teams).limit(1)
  await prod.select().from(schedules).limit(1)
  await prod.select().from(users).limit(1)
  await prod.select().from(picks).limit(1)
  // test
  await test.select().from(teams).limit(1)
  await test.select().from(schedules).limit(1)
  await test.select().from(users).limit(1)
  await test.select().from(picks).limit(1)
}

syncDatabases().catch((error) => {
  console.error('Error syncing databases:', error)
});