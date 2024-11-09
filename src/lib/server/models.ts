import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'

export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey(),
  teamId: integer('team_id').notNull().unique(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  badgeUrl: text('logo_url'),
})

export const schedules = sqliteTable('schedules', {
  id: integer('id').primaryKey(),
  eventId: integer('game_id').notNull().unique(),
  week: integer('week_id').notNull(),
  gameDate: text('game_date').notNull(),
  homeTeamId: integer('home_team_id').notNull().references(() => teams.teamId),
  awayTeamId: integer('away_team_id').notNull().references(() => teams.teamId),
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
  round: integer('round').notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  teamId: integer('team_id').references(() => teams.teamId),
  orderInRound: integer('order_in_round').notNull(),
  assignedById: integer('assigned_by_id').references(() => users.id),
})