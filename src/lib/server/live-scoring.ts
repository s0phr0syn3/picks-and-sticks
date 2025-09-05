import { db } from './db';
import { schedules, picks, users, liveScores, userWeeklyScores, teams } from './models';
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
			console.log(`\n📊 LIVE SCORING UPDATE - Week ${week} - ${new Date().toISOString()}`);
			console.log('='.repeat(60));
			
			// Get all games for the week with team names
			const weekGames = await db
				.select({
					eventId: schedules.eventId,
					homeTeamId: schedules.homeTeamId,
					awayTeamId: schedules.awayTeamId,
					homeTeamName: sql<string>`(SELECT name FROM teams WHERE team_id = ${schedules.homeTeamId})`,
					awayTeamName: sql<string>`(SELECT name FROM teams WHERE team_id = ${schedules.awayTeamId})`,
					gameDate: schedules.gameDate
				})
				.from(schedules)
				.where(eq(schedules.week, week));

			console.log(`📅 Found ${weekGames.length} games to check for week ${week}`);

			// Fetch all live scores for NFL at once
			await this.updateAllNFLScores(weekGames);

			// Also fetch historical scores for completed games
			await this.updateHistoricalScores(weekGames);

			// Recalculate user scores for the week
			await this.updateUserWeeklyScores(week);
			
			console.log('='.repeat(60));
			console.log(`✨ Live scoring update complete for week ${week}\n`);
			
		} catch (error) {
			console.error('❌ Error updating live scores:', error);
		}
	}

	/**
	 * Update all NFL live scores using the league livescore endpoint
	 */
	private async updateAllNFLScores(weekGames: any[]): Promise<void> {
		try {
			const apiUrl = `https://www.thesportsdb.com/api/v2/json/livescore/4391`;
			console.log(`🔍 Fetching all NFL live scores from: ${apiUrl}`);
			
			// Fetch all live NFL scores
			const response = await fetch(apiUrl, {
				headers: {
					'X-API-KEY': this.apiKey
				}
			});
			
			if (!response.ok) {
				console.log(`⚠️  API response not ok: ${response.status} ${response.statusText}`);
				return;
			}
			
			const data = await response.json();
			console.log(`📡 NFL Live Scores Response:`, JSON.stringify(data, null, 2));
			
			const liveEvents = data.livescore || [];
			console.log(`🏈 Found ${liveEvents.length} live NFL events`);

			// Create a map of our week games by event ID for quick lookup
			const weekGameMap = new Map();
			weekGames.forEach(game => {
				weekGameMap.set(game.eventId, game);
			});

			// Process each live event
			for (const event of liveEvents) {
				const eventId = parseInt(event.idEvent);
				const weekGame = weekGameMap.get(eventId);
				
				if (!weekGame) {
					// This live game is not part of our week's schedule, skip it
					continue;
				}
				
				console.log(`🎮 Processing Event ${eventId}: ${event.strProgress || 'Not Started'}, Home: ${event.intHomeScore}, Away: ${event.intAwayScore}`);

				const isLive = event.strProgress && event.strProgress !== 'Not Started' && event.strProgress !== 'Match Finished';
				const isComplete = event.strProgress === 'Match Finished' || event.strProgress === 'FT';
				const homeScore = parseInt(event.intHomeScore || '0');
				const awayScore = parseInt(event.intAwayScore || '0');

				// Update or insert live score
				await db
					.insert(liveScores)
					.values({
						eventId,
						homeScore,
						awayScore,
						quarter: event.strProgress || null,
						timeRemaining: event.strEventTime || null,
						lastUpdated: new Date(),
						isLive,
						isComplete
					})
					.onConflictDoUpdate({
						target: liveScores.eventId,
						set: {
							homeScore,
							awayScore,
							quarter: event.strProgress || null,
							timeRemaining: event.strEventTime || null,
							lastUpdated: new Date(),
							isLive,
							isComplete
						}
					});

				// Format team matchup for logging
				const matchup = weekGame.homeTeamName && weekGame.awayTeamName ? 
					`${weekGame.awayTeamName} @ ${weekGame.homeTeamName}` : `Game ${eventId}`;
				const statusIcon = isLive ? '🔴' : isComplete ? '✅' : '⏸️';
				const timeInfo = event.strProgress ? ` | ${event.strProgress}` : '';
				const eventTimeInfo = event.strEventTime ? ` | ${event.strEventTime}` : '';
				
				console.log(`  ${statusIcon} ${matchup}: ${awayScore}-${homeScore}${timeInfo}${eventTimeInfo}`);
			}

			// For games not in the live feed, ensure they're recorded as not started
			for (const game of weekGames) {
				const hasLiveData = liveEvents.some((event: any) => parseInt(event.idEvent) === game.eventId);
				if (!hasLiveData) {
					// Game not in live feed, ensure it exists with default values
					await db
						.insert(liveScores)
						.values({
							eventId: game.eventId,
							homeScore: 0,
							awayScore: 0,
							quarter: null,
							timeRemaining: null,
							lastUpdated: new Date(),
							isLive: false,
							isComplete: false
						})
						.onConflictDoUpdate({
							target: liveScores.eventId,
							set: {
								lastUpdated: new Date()
							}
						});

					const matchup = game.homeTeamName && game.awayTeamName ? 
						`${game.awayTeamName} @ ${game.homeTeamName}` : `Game ${game.eventId}`;
					console.log(`  ⏸️ ${matchup}: 0-0 | Not Started`);
				}
			}
			
		} catch (error) {
			console.error('Error updating NFL live scores:', error);
		}
	}

	/**
	 * Fetch historical scores for completed games using the events endpoint
	 */
	private async updateHistoricalScores(weekGames: any[]): Promise<void> {
		try {
			console.log(`📜 Fetching historical scores for completed games...`);
			
			// Check each game individually for final scores
			for (const game of weekGames) {
				try {
					// Check if game should be complete based on date (e.g., game was yesterday or earlier)
					const gameDate = new Date(game.gameDate);
					const now = new Date();
					const hoursSinceGame = (now.getTime() - gameDate.getTime()) / (1000 * 60 * 60);
					
					// Only check for final scores if the game started at least 4 hours ago
					if (hoursSinceGame < 4) {
						continue;
					}

					// Check if game already has scores in our system that should be marked final
					const existingScore = await db
						.select({
							homeScore: liveScores.homeScore,
							awayScore: liveScores.awayScore,
							isComplete: liveScores.isComplete
						})
						.from(liveScores)
						.where(eq(liveScores.eventId, game.eventId))
						.limit(1);
					
					// If we already have scores and the game should be finished, mark it as final
					const hasExistingScore = existingScore.length > 0 && 
						(existingScore[0].homeScore > 0 || existingScore[0].awayScore > 0);
					
					let homeScore = 0;
					let awayScore = 0;
					
					if (hasExistingScore) {
						// Use existing scores and mark as final
						homeScore = existingScore[0].homeScore;
						awayScore = existingScore[0].awayScore;
					} else {
						// Try fetching from API (using V2 endpoint)
						try {
							const eventUrl = `https://www.thesportsdb.com/api/v2/json/lookupevent/${game.eventId}`;
							const response = await fetch(eventUrl, {
								headers: {
									'X-API-KEY': this.apiKey
								}
							});
							
							if (response.ok) {
								const data = await response.json();
								const event = data.events?.[0];
								
								if (event) {
									homeScore = parseInt(event.intHomeScore || '0');
									awayScore = parseInt(event.intAwayScore || '0');
								}
							}
						} catch (apiError) {
							console.log(`⚠️  API fetch failed for event ${game.eventId}, using existing scores`);
						}
						
						// If API didn't work but we have existing scores, use them
						if ((homeScore === 0 && awayScore === 0) && hasExistingScore) {
							homeScore = existingScore[0].homeScore;
							awayScore = existingScore[0].awayScore;
						}
					}
					
					const hasScore = homeScore > 0 || awayScore > 0;
					
					if (hasScore) {
						// Update the score as final
						await db
							.insert(liveScores)
							.values({
								eventId: game.eventId,
								homeScore,
								awayScore,
								quarter: 'Final',
								timeRemaining: null,
								lastUpdated: new Date(),
								isLive: false,
								isComplete: true
							})
							.onConflictDoUpdate({
								target: liveScores.eventId,
								set: {
									homeScore,
									awayScore,
									quarter: 'Final',
									timeRemaining: null,
									lastUpdated: new Date(),
									isLive: false,
									isComplete: true
								}
							});
						
						const matchup = game.homeTeamName && game.awayTeamName ? 
							`${game.awayTeamName} @ ${game.homeTeamName}` : `Game ${game.eventId}`;
						console.log(`  📝 Historical: ${matchup}: ${awayScore}-${homeScore} | Final`);
						
						// Also update the schedules table with final scores
						await db
							.update(schedules)
							.set({
								homeScore,
								awayScore
							})
							.where(eq(schedules.eventId, game.eventId));
					}
				} catch (eventError) {
					console.log(`⚠️  Error fetching historical score for event ${game.eventId}:`, eventError);
				}
			}
			
		} catch (error) {
			console.error('Error updating historical scores:', error);
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

			// Update user's weekly score (check if exists first, then insert or update)
			const existingScore = await db
				.select()
				.from(userWeeklyScores)
				.where(and(
					eq(userWeeklyScores.userId, userId),
					eq(userWeeklyScores.week, week)
				))
				.limit(1);

			if (existingScore.length > 0) {
				// Update existing record
				await db
					.update(userWeeklyScores)
					.set({
						currentPoints,
						projectedPoints: currentPoints,
						completedGames,
						totalGames,
						lastUpdated: new Date()
					})
					.where(and(
						eq(userWeeklyScores.userId, userId),
						eq(userWeeklyScores.week, week)
					));
			} else {
				// Insert new record
				await db
					.insert(userWeeklyScores)
					.values({
						userId,
						week,
						currentPoints,
						projectedPoints: currentPoints,
						completedGames,
						totalGames,
						lastUpdated: new Date()
					});
			}
				
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
				homeTeamName: sql<string>`(SELECT name FROM teams WHERE team_id = ${schedules.homeTeamId})`,
				awayTeamName: sql<string>`(SELECT name FROM teams WHERE team_id = ${schedules.awayTeamId})`,
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