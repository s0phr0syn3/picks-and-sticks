import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

// Determine database path based on environment
const DB_PATHS = {
	production: process.env.DB_PATH_PROD || './src/lib/server/production.db',
	development: process.env.DB_PATH_DEV || './src/lib/server/development.db',
	test: process.env.DB_PATH_TEST || './src/lib/server/test.db'
};

const NODE_ENV = (process.env.NODE_ENV || 'development') as keyof typeof DB_PATHS;
const dbPath = DB_PATHS[NODE_ENV];

// Check if database file exists
if (!fs.existsSync(dbPath)) {
	console.error(`❌ Database file not found at: ${dbPath}`);
	console.error(`   Please run 'npm run db:init' to initialize the database.`);
	console.error(`   Current environment: ${NODE_ENV}`);
}

// Create database connection
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite);

// Log database connection info
console.log(`📊 Connected to ${NODE_ENV} database at: ${path.resolve(dbPath)}`);

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('\n🔒 Closing database connection...');
	sqlite.close();
	process.exit(0);
});

process.on('SIGTERM', () => {
	sqlite.close();
	process.exit(0);
});
