import { json } from '@sveltejs/kit';
import { liveScoringService } from '$lib/server/live-scoring';

export async function POST() {
	try {
		console.log('🔥 Manual live score update triggered');
		
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