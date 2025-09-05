import { db } from './db';
import { schedules, picks, users, liveScores, userWeeklyScores } from './models';
import { eq, and, sql } from 'drizzle-orm';

interface LiveGameData {
	idEvent: string;
	intHomeScore: string;
	intAwayScore: string;
	strStatus: string; // 'Not Started', 'In Play', 'Match Finished'
	strProgress?: string; // '1st Quarter', '2nd Quarter', etc.
	strTime?: string; // '14:32' time remaining
}

export class LiveScoringService {
	private apiKey: string;
	
	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	/**
	 * Fetch live scores for all games in a week
	 */
	async updateLiveScores(week: number): Promise<void> {
		try {
			// Get all games for the week
			const weekGames = await db
				.select({
					eventId: schedules.eventId,
					homeTeamId: schedules.homeTeamId,
					awayTeamId: schedules.awayTeamId
				})
				.from(schedules)
				.where(eq(schedules.week, week));

			console.log(`Updating live scores for ${weekGames.length} games in week ${week}`);

			// Fetch live data for each game
			for (const game of weekGames) {
				await this.updateGameScore(game.eventId);
				// Small delay to avoid rate limiting
				await new Promise(resolve => setTimeout(resolve, 100));
			}

			// Recalculate user scores for the week
			await this.updateUserWeeklyScores(week);
			
		} catch (error) {
			console.error('Error updating live scores:', error);
		}
	}

	/**
	 * Update score for a specific game
	 */
	private async updateGameScore(eventId: number): Promise<void> {
		try {
			// Fetch live game data from TheSportsDB
			const response = await fetch(
				`https://www.thesportsdb.com/api/v2/json/${this.apiKey}/live/event/${eventId}`
			);
			
			if (!response.ok) return;
			
			const data = await response.json();
			const gameData = data.events?.[0] as LiveGameData;
			
			if (!gameData) return;

			const isLive = gameData.strStatus === 'In Play';
			const isComplete = gameData.strStatus === 'Match Finished';
			const homeScore = parseInt(gameData.intHomeScore || '0');
			const awayScore = parseInt(gameData.intAwayScore || '0');

			// Update or insert live score
			await db
				.insert(liveScores)
				.values({
					eventId,
					homeScore,
					awayScore,
					quarter: gameData.strProgress || null,
					timeRemaining: gameData.strTime || null,
					lastUpdated: new Date(),
					isLive,
					isComplete
				})
				.onConflictDoUpdate({
					target: liveScores.eventId,
					set: {
						homeScore,
						awayScore,
						quarter: gameData.strProgress || null,
						timeRemaining: gameData.strTime || null,
						lastUpdated: new Date(),
						isLive,
						isComplete
					}
				});

			console.log(`Updated game ${eventId}: ${homeScore}-${awayScore} (${gameData.strStatus})`);
			
		} catch (error) {
			console.error(`Error updating game ${eventId}:`, error);
		}
	}

	/**
	 * Recalculate all user scores for a week
	 */
	private async updateUserWeeklyScores(week: number): Promise<void> {
		try {
			// Get all users with picks for this week
			const userPicks = await db
				.select({
					userId: picks.userId,
					teamId: picks.teamId,
					fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
				})
				.from(picks)
				.innerJoin(users, eq(picks.userId, users.id))
				.where(eq(picks.week, week))
				.groupBy(picks.userId);

			for (const user of userPicks) {
				await this.calculateUserWeeklyScore(user.userId, week);
			}
			
		} catch (error) {
			console.error('Error updating user weekly scores:', error);
		}
	}

	/**
	 * Calculate current score for a user in a specific week
	 */
	private async calculateUserWeeklyScore(userId: string, week: number): Promise<void> {
		try {
			// Get user's picks with current scores
			const userPicksWithScores = await db
				.select({
					teamId: picks.teamId,
					homeTeamId: schedules.homeTeamId,
					awayTeamId: schedules.awayTeamId,
					homeScore: liveScores.homeScore,
					awayScore: liveScores.awayScore,
					isComplete: liveScores.isComplete
				})
				.from(picks)
				.innerJoin(schedules, eq(picks.week, schedules.week))
				.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
				.where(and(
					eq(picks.userId, userId),
					eq(picks.week, week),
					eq(picks.teamId, schedules.homeTeamId) // User picked home team
				))
				.union(
					db.select({
						teamId: picks.teamId,
						homeTeamId: schedules.homeTeamId,
						awayTeamId: schedules.awayTeamId,
						homeScore: liveScores.homeScore,
						awayScore: liveScores.awayScore,
						isComplete: liveScores.isComplete
					})
					.from(picks)
					.innerJoin(schedules, eq(picks.week, schedules.week))
					.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
					.where(and(
						eq(picks.userId, userId),
						eq(picks.week, week),
						eq(picks.teamId, schedules.awayTeamId) // User picked away team
					))
				);

			let currentPoints = 0;
			let completedGames = 0;
			const totalGames = userPicksWithScores.length;

			// Calculate points from completed/live games
			for (const pick of userPicksWithScores) {
				if (pick.homeScore !== null && pick.awayScore !== null) {
					if (pick.isComplete) completedGames++;
					
					// Award points based on team performance
					if (pick.teamId === pick.homeTeamId) {
						currentPoints += pick.homeScore || 0;
					} else {
						currentPoints += pick.awayScore || 0;
					}
				}
			}

			// Update user's weekly score
			await db
				.insert(userWeeklyScores)
				.values({
					userId,
					week,
					currentPoints,
					projectedPoints: currentPoints, // Could add projection logic later
					completedGames,
					totalGames,
					lastUpdated: new Date()
				})
				.onConflictDoUpdate({
					target: [userWeeklyScores.userId, userWeeklyScores.week],
					set: {
						currentPoints,
						projectedPoints: currentPoints,
						completedGames,
						totalGames,
						lastUpdated: new Date()
					}
				});
				
		} catch (error) {
			console.error(`Error calculating score for user ${userId}:`, error);
		}
	}

	/**
	 * Get live leaderboard for a week
	 */
	async getLiveLeaderboard(week: number) {
		return await db
			.select({
				userId: userWeeklyScores.userId,
				fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
				currentPoints: userWeeklyScores.currentPoints,
				completedGames: userWeeklyScores.completedGames,
				totalGames: userWeeklyScores.totalGames,
				lastUpdated: userWeeklyScores.lastUpdated
			})
			.from(userWeeklyScores)
			.innerJoin(users, eq(userWeeklyScores.userId, users.id))
			.where(eq(userWeeklyScores.week, week))
			.orderBy(sql`current_points DESC`);
	}

	/**
	 * Get live games status for a week
	 */
	async getLiveGamesStatus(week: number) {
		return await db
			.select({
				eventId: liveScores.eventId,
				homeTeamId: schedules.homeTeamId,
				awayTeamId: schedules.awayTeamId,
				homeScore: liveScores.homeScore,
				awayScore: liveScores.awayScore,
				quarter: liveScores.quarter,
				timeRemaining: liveScores.timeRemaining,
				isLive: liveScores.isLive,
				isComplete: liveScores.isComplete,
				lastUpdated: liveScores.lastUpdated
			})
			.from(liveScores)
			.innerJoin(schedules, eq(liveScores.eventId, schedules.eventId))
			.where(eq(schedules.week, week))
			.orderBy(liveScores.lastUpdated);
	}
}