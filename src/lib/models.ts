import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'

export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey(),
  teamId: text('team_id').notNull().unique(),
  name: text('name').notNull(),
})

export const weekSchedules = sqliteTable('week_schedules', {
  id: integer('id').primaryKey(),
  gameId: text('game_id').notNull().unique(),
  week: integer('week_id').notNull(),
  gameDate: text('game_date').notNull(),
  gameTime: text('game_time').notNull(),
  homeTeamId: integer('home_team_id').notNull().references(() => teams.id),
  awayTeamId: integer('away_team_id').notNull().references(() => teams.id),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  spread: real('spread'),
  overUnder: real('over_under'),
})

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  userName: text('username').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
})

export const picks = sqliteTable('picks', {
  id: integer('id').primaryKey(),
  week: integer('week').notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  teamId: integer('team_id').references(() => teams.id).notNull(),
  assignedById: integer('assigned_by_id').references(() => users.id),
  points: integer('points').default(0)
})