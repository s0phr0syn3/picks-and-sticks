import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { teams, schedules, users, picks } from '$lib/server/models';

const sqlite = new Database('./src/lib/server/database.db')

export const db = drizzle(sqlite);

async function syncDatabase() {
  await db.select().from(teams).limit(1)
  await db.select().from(schedules).limit(1)
  await db.select().from(users).limit(1)
  await db.select().from(picks).limit(1)
}

syncDatabase().catch((error) => {
  console.error('Error syncing database:', error)
});