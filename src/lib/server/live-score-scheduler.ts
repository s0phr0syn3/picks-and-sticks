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
		
		// Update every 30 seconds when there are active games or during game periods
		cron.schedule('*/30 * * * * *', async () => {
			// Always check for active games during potential game periods
			const now = new Date();
			const timeSinceLastCheck = now.getTime() - this.lastActiveCheck.getTime();
			
			// Check more frequently during game periods (every 30 seconds) or every 5 minutes otherwise
			if (this.isGamePeriod() || this.hasActiveGames || timeSinceLastCheck > 5 * 60 * 1000) {
				await this.checkForActiveGames();
			}
			
			// Update scores if we have active games OR if it's a game period (to catch games starting)
			if (this.hasActiveGames || this.isGamePeriod()) {
				console.log('⚡ Updating live scores (active games or game period)...');
				await this.liveScoringService.updateLiveScores(this.currentWeek);
			}
		});

		// More aggressive checking during extended game periods
		cron.schedule('*/2 * * * *', async () => {
			// Force check every 2 minutes during extended game periods
			if (this.isExtendedGamePeriod()) {
				console.log('🏈 Extended game period - forcing active game check...');
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
	 * Check if we're in a typical NFL game period
	 */
	private isGamePeriod(): boolean {
		const now = new Date();
		const hour = now.getHours();
		const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
		
		// NFL games typically occur:
		// Thursday: 5:00 PM - 12:00 AM Pacific (TNF)
		// Sunday: 10:00 AM - 12:00 AM Pacific (early, late, SNF)
		// Monday: 5:00 PM - 12:00 AM Pacific (MNF)
		// Occasionally Saturday late in season
		
		// Thursday games
		if (day === 4 && hour >= 17 && hour <= 23) return true;
		
		// Sunday games (all day coverage)
		if (day === 0 && hour >= 10 && hour <= 23) return true;
		
		// Monday games
		if (day === 1 && hour >= 17 && hour <= 23) return true;
		
		// Saturday games (late season)
		if (day === 6 && hour >= 13 && hour <= 23) return true;
		
		return false;
	}

	/**
	 * Check if we're in an extended game period (for more aggressive checking)
	 */
	private isExtendedGamePeriod(): boolean {
		const now = new Date();
		const hour = now.getHours();
		const day = now.getDay();
		
		// Extended periods include pre-game and post-game windows
		// Thursday: 4:00 PM - 1:00 AM Pacific
		if (day === 4 && hour >= 16 && hour <= 23) return true;
		if (day === 5 && hour >= 0 && hour <= 1) return true; // Friday early morning
		
		// Sunday: 9:00 AM - 1:00 AM Pacific  
		if (day === 0 && hour >= 9 && hour <= 23) return true;
		if (day === 1 && hour >= 0 && hour <= 1) return true; // Monday early morning
		
		// Monday: 4:00 PM - 1:00 AM Pacific
		if (day === 1 && hour >= 16 && hour <= 23) return true;
		if (day === 2 && hour >= 0 && hour <= 1) return true; // Tuesday early morning
		
		// Saturday: 12:00 PM - 1:00 AM Pacific
		if (day === 6 && hour >= 12 && hour <= 23) return true;
		if (day === 0 && hour >= 0 && hour <= 1) return true; // Sunday early morning
		
		return false;
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

			// Check for games starting soon or in progress (within next 4 hours to catch all scenarios)
			const now = new Date();
			const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
			const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
			
			const relevantGames = await db
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

			const hasRelevantGames = relevantGames.some(game => {
				const gameTime = new Date(game.gameDate);
				// Check if game is starting soon or could still be in progress
				return gameTime >= oneHourAgo && gameTime <= fourHoursFromNow;
			});

			const previousStatus = this.hasActiveGames;
			// Be more aggressive - consider active if we have live games, relevant upcoming games, or during game periods
			this.hasActiveGames = activeGames.length > 0 || hasRelevantGames || this.isGamePeriod();
			
			if (this.hasActiveGames && !previousStatus) {
				console.log(`🏈 Active games detected! Live: ${activeGames.length}, Relevant upcoming: ${hasRelevantGames}, Game period: ${this.isGamePeriod()}`);
			} else if (!this.hasActiveGames && previousStatus) {
				console.log('😴 No active games. Reducing update frequency...');
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