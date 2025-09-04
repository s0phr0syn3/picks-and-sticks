#!/usr/bin/env node

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { teams, schedules, users, picks, sessions, weeks } from '../src/lib/server/models';

// Load environment variables
config();

const DB_PATHS = {
	production: process.env.DB_PATH_PROD || './src/lib/server/production.db',
	development: process.env.DB_PATH_DEV || './src/lib/server/development.db',
	test: process.env.DB_PATH_TEST || './src/lib/server/test.db'
};

const ENV = (process.env.NODE_ENV || 'development') as keyof typeof DB_PATHS;

async function initDatabase() {
	console.log(`🚀 Initializing ${ENV} database...`);
	
	const dbPath = DB_PATHS[ENV];
	const dbDir = path.dirname(dbPath);
	
	// Ensure database directory exists
	if (!fs.existsSync(dbDir)) {
		fs.mkdirSync(dbDir, { recursive: true });
		console.log(`✅ Created database directory: ${dbDir}`);
	}
	
	// Create database connection
	const sqlite = new Database(dbPath);
	const db = drizzle(sqlite);
	
	try {
		// Create tables using Drizzle schema
		console.log('📋 Creating database tables...');
		
		// Create teams table
		await db.run(sql`
			CREATE TABLE IF NOT EXISTS teams (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				team_id INTEGER NOT NULL UNIQUE,
				name TEXT NOT NULL,
				short_name TEXT NOT NULL,
				logo_url TEXT
			)
		`);
		console.log('✅ Created teams table');
		
		// Create schedules table
		await db.run(sql`
			CREATE TABLE IF NOT EXISTS schedules (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				game_id INTEGER NOT NULL UNIQUE,
				week_id INTEGER NOT NULL,
				game_date TEXT NOT NULL,
				home_team_id INTEGER NOT NULL REFERENCES teams(team_id),
				away_team_id INTEGER NOT NULL REFERENCES teams(team_id),
				home_score INTEGER,
				away_score INTEGER,
				spread REAL,
				over_under REAL
			)
		`);
		console.log('✅ Created schedules table');
		
		// Create users table (Local authentication)
		await db.run(sql`
			CREATE TABLE IF NOT EXISTS users (
				id TEXT PRIMARY KEY,
				username TEXT NOT NULL UNIQUE,
				first_name TEXT NOT NULL,
				last_name TEXT NOT NULL,
				password_hash TEXT NOT NULL,
				created_at INTEGER NOT NULL
			)
		`);
		console.log('✅ Created users table');

		// Create sessions table
		await db.run(sql`
			CREATE TABLE IF NOT EXISTS sessions (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				expires_at INTEGER NOT NULL,
				created_at INTEGER NOT NULL
			)
		`);
		console.log('✅ Created sessions table');
		
		// Create picks table
		await db.run(sql`
			CREATE TABLE IF NOT EXISTS picks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				week INTEGER NOT NULL,
				round INTEGER NOT NULL,
				user_id TEXT NOT NULL REFERENCES users(id),
				team_id INTEGER REFERENCES teams(team_id),
				order_in_round INTEGER NOT NULL,
				assigned_by_id TEXT REFERENCES users(id)
			)
		`);
		console.log('✅ Created picks table');

		// Create weeks table
		await db.run(sql`
			CREATE TABLE IF NOT EXISTS weeks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				week_number INTEGER NOT NULL UNIQUE,
				punishment TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);
		console.log('✅ Created weeks table');
		
		// Create indexes for better performance
		console.log('📈 Creating indexes...');
		
		await db.run(sql`CREATE INDEX IF NOT EXISTS idx_schedules_week ON schedules(week_id)`);
		await db.run(sql`CREATE INDEX IF NOT EXISTS idx_picks_week ON picks(week)`);
		await db.run(sql`CREATE INDEX IF NOT EXISTS idx_picks_user ON picks(user_id)`);
		await db.run(sql`CREATE INDEX IF NOT EXISTS idx_picks_team ON picks(team_id)`);
		
		console.log('✅ Created indexes');
		
		// Verify tables exist
		const tables = await db.all<{ name: string }>(
			sql`SELECT name FROM sqlite_master WHERE type='table'`
		);
		
		console.log('\n📊 Database tables created:');
		tables.forEach(table => {
			console.log(`   - ${table.name}`);
		});
		
		console.log(`\n✨ Database initialization complete for ${ENV} environment!`);
		console.log(`📁 Database location: ${path.resolve(dbPath)}`);
		
	} catch (error) {
		console.error('❌ Database initialization failed:', error);
		process.exit(1);
	} finally {
		sqlite.close();
	}
}

// Run initialization
initDatabase().catch(error => {
	console.error('Fatal error:', error);
	process.exit(1);
});