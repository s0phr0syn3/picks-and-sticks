import { LiveScoringService } from './live-scoring';
import cron from 'node-cron';

export class LiveScoreScheduler {
	private liveScoringService: LiveScoringService;
	private currentWeek: number = 1;
	private isGameDay: boolean = false;
	
	constructor(apiKey: string) {
		this.liveScoringService = new LiveScoringService(apiKey);
		this.currentWeek = this.getCurrentNFLWeek();
		this.checkIfGameDay();
	}

	/**
	 * Start the live scoring scheduler
	 */
	start(): void {
		console.log('🔄 Starting live score scheduler...');
		
		// Update every 2 minutes during game days (Thursdays, Sundays, Mondays)
		cron.schedule('*/2 * * * *', async () => {
			if (this.isGameDay) {
				console.log('⚡ Updating live scores...');
				await this.liveScoringService.updateLiveScores(this.currentWeek);
			}
		});

		// Check if today is a game day (runs every hour)
		cron.schedule('0 * * * *', () => {
			this.checkIfGameDay();
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
	 * Check if today is an NFL game day
	 */
	private checkIfGameDay(): void {
		const now = new Date();
		const hour = now.getHours();
		
		// Check every day from 9 AM to 2 AM next day (covers all possible game times)
		// This accounts for games on any day of the week
		const isGameHours = hour >= 9 || hour <= 2;
		
		// Always consider it a potential game day during active hours
		// API limit: 100/min, we'll use ~1-2 per minute during active hours
		this.isGameDay = isGameHours;
		
		console.log(`🗓️  Game day check: Hour=${hour}, IsGameHours=${isGameHours}, IsGameDay=${this.isGameDay}`);
		
		if (this.isGameDay && !this.wasGameDay) {
			console.log('🏈 Active hours! Starting live score monitoring...');
		} else if (!this.isGameDay && this.wasGameDay) {
			console.log('😴 Off hours. Reducing update frequency...');
		}
		
		this.wasGameDay = this.isGameDay;
	}
	
	private wasGameDay: boolean = false;

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
			isGameDay: this.isGameDay,
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