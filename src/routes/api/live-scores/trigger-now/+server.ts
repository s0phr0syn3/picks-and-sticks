import { json } from '@sveltejs/kit';
import { LiveScoringService } from '$lib/server/live-scoring';
import { API_KEY } from '$env/static/private';

export async function POST() {
	try {
		console.log('🔥 Manual live score update triggered');
		
		if (!API_KEY) {
			throw new Error('API_KEY not configured');
		}
		
		// Create service instance
		const liveScoringService = new LiveScoringService(API_KEY);
		
		// Get current NFL week
		const currentWeek = liveScoringService.getCurrentNFLWeek();
		
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