#!/usr/bin/env node

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { config } from 'dotenv';
import * as path from 'path';

config();

const DB_PATHS = {
	production: process.env.DB_PATH_PROD || './src/lib/server/production.db',
	development: process.env.DB_PATH_DEV || './src/lib/server/development.db',
	test: process.env.DB_PATH_TEST || './src/lib/server/test.db',
};

const ENV = (process.env.NODE_ENV || 'development') as keyof typeof DB_PATHS;

async function migrateSeasons() {
	console.log(`Running seasons migration for ${ENV} database...`);

	const dbPath = DB_PATHS[ENV];
	console.log(`Database location: ${path.resolve(dbPath)}`);

	const sqlite = new Database(dbPath);

	try {
		sqlite.exec(`
			CREATE TABLE IF NOT EXISTS seasons (
				id INTEGER PRIMARY KEY,
				year INTEGER NOT NULL UNIQUE,
				start_date INTEGER NOT NULL,
				end_date INTEGER,
				status TEXT NOT NULL CHECK (status IN ('upcoming', 'active', 'archived')),
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				CHECK (end_date IS NULL OR end_date > start_date)
			)
		`);
		console.log(`seasons table ready`);

		const now = Math.floor(Date.now() / 1000);
		const insert = sqlite.prepare(`
			INSERT OR IGNORE INTO seasons (year, start_date, end_date, status, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`);

		// 2025-09-04 and 2026-09-10 as unix seconds, UTC
		insert.run(2025,
			Math.floor(Date.UTC(2025, 8, 4) / 1000),
			Math.floor(Date.UTC(2026, 0, 5) / 1000),
			'archived',
			now,
			now
		);
		insert.run(
			2026,
			Math.floor(Date.UTC(2026, 8, 10) / 1000),
			null,
			'upcoming',
			now,
			now
		);

		const rows = sqlite.prepare('SELECT year, status FROM seasons ORDER BY year').all();
		console.log('\n Seasons:');
		rows.forEach((r: any) => console.log(`   - ${r.year}: ${r.status}`))

		console.log(`\n Seasons migration complete for ${ENV} environment!`);
	} catch (error) {
		console.error('Migration failed:', error);
		process.exit(1);
	} finally {
		sqlite.close();
	}
}

migrateSeasons().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});