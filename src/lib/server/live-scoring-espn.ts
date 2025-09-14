import { db } from './db';
import { schedules, picks, users, liveScores, userWeeklyScores, teams } from './models';
import { eq, and, or, sql, inArray } from 'drizzle-orm';
import { getTotalPointsForWeekByUser, getPicksForWeek, getPicksWithGameInfo } from './queries';

interface ESPNEvent {
	id: string;
	name: string;
	date: string;
	status: {
		clock: number;
		displayClock: string;
		period: number;
		type: {
			id: string;
			name: string;
			state: string;
			completed: boolean;
			description: string;
			detail: string;
			shortDetail: string;
		};
	};
	competitions: Array<{
		id: string;
		competitors: Array<{
			id: string;
			homeAway: string;
			team: {
				id: string;
				displayName: string;
				abbreviation: string;
			};
			score: string;
		}>;
		status: {
			clock: number;
			displayClock: string;
			period: number;
			type: {
				id: string;
				name: string;
				state: string;
				completed: boolean;
				description: string;
			};
		};
	}>;
}

export class ESPNLiveScoringService {
	private teamNameMap: Map<string, number> = new Map();
	
	constructor() {
		// Initialize team name mappings (ESPN name -> our team_id)
		this.initializeTeamMappings();
	}

	private initializeTeamMappings() {
		// Map ESPN team names to our new standardized team IDs
		// AFC East
		this.teamNameMap.set('Buffalo Bills', 1);
		this.teamNameMap.set('Miami Dolphins', 2);
		this.teamNameMap.set('New England Patriots', 3);
		this.teamNameMap.set('New York Jets', 4);
		// AFC North
		this.teamNameMap.set('Baltimore Ravens', 5);
		this.teamNameMap.set('Cincinnati Bengals', 6);
		this.teamNameMap.set('Cleveland Browns', 7);
		this.teamNameMap.set('Pittsburgh Steelers', 8);
		// AFC South
		this.teamNameMap.set('Houston Texans', 9);
		this.teamNameMap.set('Indianapolis Colts', 10);
		this.teamNameMap.set('Jacksonville Jaguars', 11);
		this.teamNameMap.set('Tennessee Titans', 12);
		// AFC West
		this.teamNameMap.set('Denver Broncos', 13);
		this.teamNameMap.set('Kansas City Chiefs', 14);
		this.teamNameMap.set('Los Angeles Chargers', 15);
		this.teamNameMap.set('Las Vegas Raiders', 16);
		// NFC East
		this.teamNameMap.set('Dallas Cowboys', 17);
		this.teamNameMap.set('New York Giants', 18);
		this.teamNameMap.set('Philadelphia Eagles', 19);
		this.teamNameMap.set('Washington Commanders', 20);
		// NFC North
		this.teamNameMap.set('Chicago Bears', 21);
		this.teamNameMap.set('Detroit Lions', 22);
		this.teamNameMap.set('Green Bay Packers', 23);
		this.teamNameMap.set('Minnesota Vikings', 24);
		// NFC South
		this.teamNameMap.set('Atlanta Falcons', 25);
		this.teamNameMap.set('Carolina Panthers', 26);
		this.teamNameMap.set('New Orleans Saints', 27);
		this.teamNameMap.set('Tampa Bay Buccaneers', 28);
		// NFC West
		this.teamNameMap.set('Arizona Cardinals', 29);
		this.teamNameMap.set('Los Angeles Rams', 30);
		this.teamNameMap.set('San Francisco 49ers', 31);
		this.teamNameMap.set('Seattle Seahawks', 32);
	}

	/**
	 * Fetch live scores for all games in a week
	 */
	async updateLiveScores(week: number): Promise<void> {
		try {
			console.log(`\n📊 ESPN LIVE SCORING UPDATE - Week ${week} - ${new Date().toISOString()}`);
			console.log('='.repeat(60));
			
			// Get all games for the week
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

			// Fetch ESPN scores
			await this.updateESPNScores(weekGames, week);

			// Recalculate user scores for the week
			await this.updateUserWeeklyScores(week);
			
			console.log('='.repeat(60));
			console.log(`✨ Live scoring update complete for week ${week}\n`);
			
		} catch (error) {
			console.error('❌ Error updating live scores:', error);
		}
	}

	/**
	 * Fetch and update scores from ESPN API
	 */
	private async updateESPNScores(weekGames: any[], week: number): Promise<void> {
		try {
			// ESPN API endpoint - includes week parameter for better filtering
			const apiUrl = `https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}`;
			console.log(`🔍 Fetching ESPN NFL scores from: ${apiUrl}`);
			
			const response = await fetch(apiUrl);
			
			if (!response.ok) {
				console.log(`⚠️  ESPN API response not ok: ${response.status} ${response.statusText}`);
				return;
			}
			
			const data = await response.json();
			const events: ESPNEvent[] = data.events || [];
			console.log(`🏈 Found ${events.length} games from ESPN for week ${week}`);

			// Process each ESPN event
			for (const event of events) {
				const competition = event.competitions[0];
				if (!competition) continue;

				// Find home and away teams
				const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
				const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');
				
				if (!homeCompetitor || !awayCompetitor) continue;

				const homeTeamName = homeCompetitor.team.displayName;
				const awayTeamName = awayCompetitor.team.displayName;
				
				// Map ESPN team names to our team IDs
				const homeTeamId = this.teamNameMap.get(homeTeamName);
				const awayTeamId = this.teamNameMap.get(awayTeamName);
				
				if (!homeTeamId || !awayTeamId) {
					console.log(`⚠️  Could not map teams: ${awayTeamName} @ ${homeTeamName}`);
					continue;
				}

				// Find the matching game in our database
				const matchingGame = weekGames.find(game => 
					game.homeTeamId === homeTeamId && game.awayTeamId === awayTeamId
				);
				
				if (!matchingGame) {
					console.log(`⚠️  No matching game found for: ${awayTeamName} @ ${homeTeamName}`);
					continue;
				}

				// Parse game status
				const status = competition.status || event.status;
				const homeScore = parseInt(homeCompetitor.score || '0');
				const awayScore = parseInt(awayCompetitor.score || '0');
				
				// Determine game state
				const isComplete = status.type.completed === true;
				const isLive = status.type.state === 'in';
				const isPre = status.type.state === 'pre';
				
				// Format quarter/period display
				let quarter = null;
				let timeRemaining = null;
				
				if (isComplete) {
					quarter = 'Final';
				} else if (isLive) {
					// Convert period to quarter display
					const periodMap: { [key: number]: string } = {
						1: '1st Quarter',
						2: '2nd Quarter',
						3: '3rd Quarter',
						4: '4th Quarter',
						5: 'Overtime'
					};
					quarter = periodMap[status.period] || `Period ${status.period}`;
					timeRemaining = status.displayClock || null;
				} else if (isPre) {
					quarter = null;
					timeRemaining = null;
				}

				// Update or insert live score
				await db
					.insert(liveScores)
					.values({
						eventId: matchingGame.eventId,
						homeScore,
						awayScore,
						quarter,
						timeRemaining,
						lastUpdated: new Date(),
						isLive,
						isComplete
					})
					.onConflictDoUpdate({
						target: liveScores.eventId,
						set: {
							homeScore,
							awayScore,
							quarter,
							timeRemaining,
							lastUpdated: new Date(),
							isLive,
							isComplete
						}
					});

				// Log the update
				const statusIcon = isLive ? '🔴' : isComplete ? '✅' : '⏸️';
				const scoreDisplay = `${awayScore}-${homeScore}`;
				const timeDisplay = isLive && timeRemaining ? ` | ${quarter} ${timeRemaining}` : 
								   isComplete ? ' | Final' : '';
				
				console.log(`  ${statusIcon} ${awayTeamName} @ ${homeTeamName}: ${scoreDisplay}${timeDisplay}`);
			}

			// Mark games not in ESPN data as not started
			for (const game of weekGames) {
				const hasESPNData = events.some((event: ESPNEvent) => {
					const competition = event.competitions[0];
					if (!competition) return false;
					
					const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
					const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');
					
					if (!homeCompetitor || !awayCompetitor) return false;
					
					const homeTeamId = this.teamNameMap.get(homeCompetitor.team.displayName);
					const awayTeamId = this.teamNameMap.get(awayCompetitor.team.displayName);
					
					return game.homeTeamId === homeTeamId && game.awayTeamId === awayTeamId;
				});

				if (!hasESPNData) {
					// Game not in ESPN feed, ensure it exists with default values
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
			console.error('Error fetching ESPN scores:', error);
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
		// Get total points from the queries instead of userWeeklyScores table
		const userPoints = getTotalPointsForWeekByUser(week);
		
		// Get basic picks and enhance them with opponent information
		let picksWithInfo = getPicksForWeek(week);
		
		// Enhance picks with opponent team information
		picksWithInfo = picksWithInfo.map(pick => {
			if (!pick.teamId) {
				return {
					...pick,
					homeTeamName: null,
					awayTeamName: null,
					gameDate: null
				};
			}
			
			try {
				// Find the schedule for this team
				const schedule = db
					.select({
						homeTeamId: schedules.homeTeamId,
						awayTeamId: schedules.awayTeamId,
						gameDate: schedules.gameDate
					})
					.from(schedules)
					.where(
						and(
							eq(schedules.week, week),
							or(
								eq(schedules.homeTeamId, pick.teamId),
								eq(schedules.awayTeamId, pick.teamId)
							)
						)
					)
					.get();
				
				if (!schedule) {
					return {
						...pick,
						homeTeamName: null,
						awayTeamName: null,
						gameDate: null
					};
				}
				
				// Get team names
				const homeTeam = db.select({ name: teams.name }).from(teams).where(eq(teams.teamId, schedule.homeTeamId)).get();
				const awayTeam = db.select({ name: teams.name }).from(teams).where(eq(teams.teamId, schedule.awayTeamId)).get();
				
				return {
					...pick,
					homeTeamName: homeTeam?.name || null,
					awayTeamName: awayTeam?.name || null,
					gameDate: schedule.gameDate
				};
			} catch (error) {
				console.error(`Error enhancing pick ${pick.id}:`, error.message);
				return {
					...pick,
					homeTeamName: null,
					awayTeamName: null,
					gameDate: null
				};
			}
		});
		
		// Group picks by user
		const userPicksMap: Record<string, any[]> = {};
		const userGameCounts: Record<string, { completedGames: number; totalGames: number }> = {};
		
		picksWithInfo.forEach(pick => {
			const userId = pick.userId;
			if (!userPicksMap[userId]) {
				userPicksMap[userId] = [];
				userGameCounts[userId] = { completedGames: 0, totalGames: 0 };
			}
			
			userPicksMap[userId].push(pick);
			userGameCounts[userId].totalGames++;
			
			// A game is completed if the pick has been scored (points exist and game is complete)
			if (pick.points !== null && pick.points !== undefined && pick.points !== 0) {
				userGameCounts[userId].completedGames++;
			}
		});
		
		// Combine the data into the expected format
		return userPoints.map(user => ({
			userId: user.userId,
			fullName: user.fullName,
			currentPoints: user.totalPoints,
			completedGames: userGameCounts[user.userId]?.completedGames || 0,
			totalGames: userGameCounts[user.userId]?.totalGames || 4, // Each user should have 4 picks
			picks: userPicksMap[user.userId] || [],
			lastUpdated: new Date().toISOString()
		})).sort((a, b) => b.currentPoints - a.currentPoints);
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