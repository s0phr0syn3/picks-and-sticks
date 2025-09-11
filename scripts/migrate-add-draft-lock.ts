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

async function migrateDraftLock() {
	console.log(`🚀 Running draft lock migration for ${ENV} database...`);
	
	const dbPath = DB_PATHS[ENV];
	console.log(`📁 Database location: ${path.resolve(dbPath)}`);
	
	// Create database connection
	const sqlite = new Database(dbPath);
	const db = drizzle(sqlite);
	
	try {
		// Check if is_draft_locked column already exists
		console.log('🔍 Checking if is_draft_locked column exists...');
		
		const columns = await db.all<{ name: string }>(
			sql`PRAGMA table_info(weeks)`
		);
		
		const hasDraftLockColumn = columns.some(col => col.name === 'is_draft_locked');
		
		if (hasDraftLockColumn) {
			console.log('✅ is_draft_locked column already exists. No migration needed.');
			return;
		}
		
		console.log('➕ Adding is_draft_locked column to weeks table...');
		
		// Add the is_draft_locked column
		await db.run(sql`
			ALTER TABLE weeks ADD COLUMN is_draft_locked INTEGER NOT NULL DEFAULT 0
		`);
		
		console.log('✅ Successfully added is_draft_locked column');
		
		// Verify the column was added
		const updatedColumns = await db.all<{ name: string }>(
			sql`PRAGMA table_info(weeks)`
		);
		
		console.log('\n📊 Updated weeks table schema:');
		updatedColumns.forEach(col => {
			console.log(`   - ${col.name}`);
		});
		
		console.log(`\n✨ Draft lock migration complete for ${ENV} environment!`);
		
	} catch (error) {
		console.error('❌ Migration failed:', error);
		process.exit(1);
	} finally {
		sqlite.close();
	}
}

// Run migration
migrateDraftLock().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});