import { sqliteTable, integer, text, real, primaryKey, unique } from 'drizzle-orm/sqlite-core';

export const teams = sqliteTable('teams', {
	id: integer('id').primaryKey(),
	teamId: integer('team_id').notNull().unique(),
	name: text('name').notNull(),
	shortName: text('short_name').notNull(),
	badgeUrl: text('logo_url')
});

export const schedules = sqliteTable('schedules', {
	id: integer('id').primaryKey(),
	eventId: integer('game_id').notNull().unique(),
	week: integer('week_id').notNull(),
	gameDate: text('game_date').notNull(),
	homeTeamId: integer('home_team_id')
		.notNull()
		.references(() => teams.teamId),
	awayTeamId: integer('away_team_id')
		.notNull()
		.references(() => teams.teamId),
	homeScore: integer('home_score'),
	awayScore: integer('away_score'),
	spread: real('spread'),
	overUnder: real('over_under')
});

export const users = sqliteTable('users', {
	id: text('id').primaryKey(), // UUID
	username: text('username').notNull().unique(),
	firstName: text('first_name').notNull(),
	lastName: text('last_name').notNull(),
	passwordHash: text('password_hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(), // UUID
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const picks = sqliteTable('picks', {
	id: integer('id').primaryKey(),
	week: integer('week').notNull(),
	round: integer('round').notNull(),
	userId: text('user_id')
		.references(() => users.id)
		.notNull(),
	teamId: integer('team_id').references(() => teams.teamId),
	orderInRound: integer('order_in_round').notNull(),
	assignedById: text('assigned_by_id').references(() => users.id)
});

export const weeks = sqliteTable('weeks', {
	id: integer('id').primaryKey(),
	weekNumber: integer('week_number').notNull().unique(),
	punishment: text('punishment'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const liveScores = sqliteTable('live_scores', {
	id: integer('id').primaryKey(),
	eventId: integer('event_id').notNull().unique(),
	homeScore: integer('home_score').notNull().default(0),
	awayScore: integer('away_score').notNull().default(0),
	quarter: text('quarter'), // '1', '2', '3', '4', 'OT', 'Final'
	timeRemaining: text('time_remaining'), // '14:32', '00:00', etc.
	lastUpdated: integer('last_updated', { mode: 'timestamp' }).notNull(),
	isLive: integer('is_live', { mode: 'boolean' }).notNull().default(false),
	isComplete: integer('is_complete', { mode: 'boolean' }).notNull().default(false)
});

export const userWeeklyScores = sqliteTable('user_weekly_scores', {
	id: integer('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id),
	week: integer('week').notNull(),
	currentPoints: integer('current_points').notNull().default(0),
	projectedPoints: integer('projected_points').notNull().default(0),
	completedGames: integer('completed_games').notNull().default(0),
	totalGames: integer('total_games').notNull().default(0),
	lastUpdated: integer('last_updated', { mode: 'timestamp' }).notNull()
}, (table) => ({
	userWeekUnique: unique().on(table.userId, table.week)
}));
