import { ESPNLiveScoringService } from './live-scoring-espn';
import { db } from './db';
import { liveScores, schedules } from './models';
import { eq, and, or } from 'drizzle-orm';
import cron from 'node-cron';

export class LiveScoreScheduler {
	private liveScoringService: ESPNLiveScoringService;
	private currentWeek: number = 1;
	private hasActiveGames: boolean = false;
	private lastActiveCheck: Date = new Date();
	
	constructor(apiKey?: string) {
		// ESPN API doesn't require API key
		this.liveScoringService = new ESPNLiveScoringService();
		this.currentWeek = this.getCurrentNFLWeek();
		this.checkForActiveGames();
	}

	/**
	 * Start the live scoring scheduler
	 */
	start(): void {
		console.log('🔄 Starting live score scheduler...');
		
		// Update every 30 seconds when there are active games
		cron.schedule('*/30 * * * * *', async () => {
			// Check for active games every 5 minutes or if we already know there are active games
			const now = new Date();
			const timeSinceLastCheck = now.getTime() - this.lastActiveCheck.getTime();
			
			if (this.hasActiveGames || timeSinceLastCheck > 5 * 60 * 1000) {
				await this.checkForActiveGames();
			}
			
			if (this.hasActiveGames) {
				console.log('⚡ Active games detected - updating live scores...');
				await this.liveScoringService.updateLiveScores(this.currentWeek);
			}
		});

		// Force check for active games every 5 minutes during potential game hours
		cron.schedule('*/5 * * * *', async () => {
			const now = new Date();
			const hour = now.getHours();
			const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
			
			// NFL games typically occur:
			// Thursday: 5:20 PM - 11:30 PM Pacific
			// Sunday: 10:00 AM - 11:30 PM Pacific  
			// Monday: 5:20 PM - 11:30 PM Pacific
			// Occasionally Saturday late in season
			
			let shouldCheck = false;
			
			// Always check between 10 AM and midnight Pacific on any day
			// This covers all possible game times including late games
			if (hour >= 10 && hour <= 23) {
				shouldCheck = true;
			}
			// Also check early morning (midnight to 2 AM) for late-running games
			else if (hour >= 0 && hour <= 2) {
				shouldCheck = true;
			}
			
			if (shouldCheck) {
				await this.checkForActiveGames();
			}
		});

		// Update current NFL week (runs daily at midnight)
		cron.schedule('0 0 * * *', () => {
			this.currentWeek = this.getCurrentNFLWeek();
			console.log(`📅 Current NFL week updated to: ${this.currentWeek}`);
		});

		console.log(`✅ Live score scheduler started for week ${this.currentWeek}`);
	}

	/**
	 * Manual trigger for testing
	 */
	async triggerUpdate(week?: number): Promise<void> {
		const targetWeek = week || this.currentWeek;
		console.log(`🔧 Manual trigger: Updating scores for week ${targetWeek}`);
		await this.liveScoringService.updateLiveScores(targetWeek);
	}

	/**
	 * Check if there are any active games (live or about to start)
	 */
	private async checkForActiveGames(): Promise<void> {
		try {
			this.lastActiveCheck = new Date();
			
			// Check for live games in the database
			const activeGames = await db
				.select({
					eventId: liveScores.eventId,
					isLive: liveScores.isLive,
					isComplete: liveScores.isComplete
				})
				.from(liveScores)
				.innerJoin(schedules, eq(liveScores.eventId, schedules.eventId))
				.where(and(
					eq(schedules.week, this.currentWeek),
					eq(liveScores.isLive, true)
				))
				.all();

			// Also check for games starting soon (within next 30 minutes)
			const now = new Date();
			const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
			
			const upcomingGames = await db
				.select({
					eventId: schedules.eventId,
					gameDate: schedules.gameDate
				})
				.from(schedules)
				.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
				.where(and(
					eq(schedules.week, this.currentWeek),
					or(
						eq(liveScores.isComplete, false),
						eq(liveScores.isComplete, null)
					)
				))
				.all();

			const hasUpcomingGames = upcomingGames.some(game => {
				const gameTime = new Date(game.gameDate);
				return gameTime >= now && gameTime <= thirtyMinutesFromNow;
			});

			const previousStatus = this.hasActiveGames;
			this.hasActiveGames = activeGames.length > 0 || hasUpcomingGames;
			
			if (this.hasActiveGames && !previousStatus) {
				console.log(`🏈 Active games detected! Found ${activeGames.length} live games, upcoming: ${hasUpcomingGames}`);
			} else if (!this.hasActiveGames && previousStatus) {
				console.log('😴 No active games. Pausing frequent updates...');
			}
			
		} catch (error) {
			console.error('Error checking for active games:', error);
			// On error, assume there might be active games to avoid missing updates
			this.hasActiveGames = true;
		}
	}

	/**
	 * Get current NFL week (simplified - you might want more sophisticated logic)
	 */
	private getCurrentNFLWeek(): number {
		// This is a simplified version - you'd want to calculate based on NFL season start
		const now = new Date();
		// Set season start to September 4th so that Sept 5th games are in Week 1
		const seasonStart = new Date('2025-09-04'); // 2025 NFL season start
		const diffTime = now.getTime() - seasonStart.getTime();
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
		const week = Math.max(1, Math.min(18, Math.floor(diffDays / 7) + 1));
		console.log(`📅 NFL Week calculation: Today=${now.toISOString().slice(0, 10)}, SeasonStart=2025-09-04, DiffDays=${diffDays}, Week=${week}`);
		return week;
	}

	/**
	 * Get current status
	 */
	getStatus() {
		return {
			currentWeek: this.currentWeek,
			hasActiveGames: this.hasActiveGames,
			lastActiveCheck: this.lastActiveCheck.toISOString(),
			lastUpdate: new Date().toISOString()
		};
	}
}

// Global scheduler instance
let scheduler: LiveScoreScheduler | null = null;

export function initializeLiveScoring(apiKey: string): LiveScoreScheduler {
	if (!scheduler) {
		scheduler = new LiveScoreScheduler(apiKey);
		scheduler.start();
	}
	return scheduler;
}

export function getLiveScoreScheduler(): LiveScoreScheduler | null {
	return scheduler;
}