#!/usr/bin/env node

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables
config();

const DB_PATHS = {
	production: process.env.DB_PATH_PROD || './src/lib/server/production.db',
	development: process.env.DB_PATH_DEV || './src/lib/server/development.db',
	test: process.env.DB_PATH_TEST || './src/lib/server/test.db'
};

const ENV = (process.env.NODE_ENV || 'development') as keyof typeof DB_PATHS;

async function migrateReasoning() {
	console.log(`🚀 Running reasoning column migration for ${ENV} database...`);

	const dbPath = DB_PATHS[ENV];
	console.log(`📁 Database location: ${path.resolve(dbPath)}`);

	// Create database connection
	const sqlite = new Database(dbPath);
	const db = drizzle(sqlite);

	try {
		// Check if reasoning column already exists
		console.log('🔍 Checking if reasoning column exists...');

		const columns = await db.all<{ name: string }>(
			sql`PRAGMA table_info(picks)`
		);

		const hasReasoningColumn = columns.some(col => col.name === 'reasoning');

		if (hasReasoningColumn) {
			console.log('✅ reasoning column already exists. No migration needed.');
			return;
		}

		console.log('➕ Adding reasoning column to picks table...');

		// Add the reasoning column (TEXT, nullable)
		await db.run(sql`
			ALTER TABLE picks ADD COLUMN reasoning TEXT
		`);

		console.log('✅ Successfully added reasoning column');

		// Verify the column was added
		const updatedColumns = await db.all<{ name: string }>(
			sql`PRAGMA table_info(picks)`
		);

		console.log('\n📊 Updated picks table schema:');
		updatedColumns.forEach(col => {
			console.log(`   - ${col.name}`);
		});

		console.log(`\n✨ Reasoning column migration complete for ${ENV} environment!`);

	} catch (error) {
		console.error('❌ Migration failed:', error);
		process.exit(1);
	} finally {
		sqlite.close();
	}
}

// Run migration
migrateReasoning().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});
