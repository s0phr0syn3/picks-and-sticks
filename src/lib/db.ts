import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import { teams, weekSchedules } from '$lib/models';

const sqlite = new Database('./src/lib/database.db')

export const db = drizzle(sqlite);

async function syncDatabase() {
  await db.select().from(teams).limit(1)
  await db.select().from(weekSchedules).limit(1)
}

syncDatabase().catch((error) => {
  console.error('Error syncing database:', error)
});