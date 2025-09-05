import { json } from '@sveltejs/kit';
import { LiveScoringService } from '$lib/server/live-scoring';
import { API_KEY } from '$env/static/private';

function getCurrentNFLWeek(): number {
	const now = new Date();
	// Set season start to September 4th so that Sept 5th games are in Week 1
	const seasonStart = new Date('2025-09-04'); // 2025 NFL season start
	const diffTime = now.getTime() - seasonStart.getTime();
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
	const week = Math.max(1, Math.min(18, Math.floor(diffDays / 7) + 1));
	return week;
}

export async function POST() {
	try {
		console.log('🔥 Manual live score update triggered');
		
		if (!API_KEY) {
			throw new Error('API_KEY not configured');
		}
		
		// Create service instance
		const liveScoringService = new LiveScoringService(API_KEY);
		
		// Get current NFL week
		const currentWeek = getCurrentNFLWeek();
		
		// Force update regardless of game day/time
		await liveScoringService.updateLiveScores(currentWeek);
		
		return json({
			success: true,
			message: `Live scores updated for week ${currentWeek}`,
			week: currentWeek
		});
	} catch (error) {
		console.error('Manual live score update failed:', error);
		return json(
			{ success: false, error: 'Failed to update live scores' },
			{ status: 500 }
		);
	}
}