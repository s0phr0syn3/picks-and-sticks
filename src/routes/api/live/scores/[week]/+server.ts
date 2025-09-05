import type { RequestHandler } from './$types';
import { LiveScoringService } from '$lib/server/live-scoring';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
	const week = parseInt(params.week);
	
	if (!week || week < 1 || week > 18) {
		return json({ error: 'Invalid week number' }, { status: 400 });
	}

	try {
		// Create a new instance for this request
		const apiKey = process.env.API_KEY;
		if (!apiKey) {
			return json({ error: 'API key not configured' }, { status: 500 });
		}

		const liveScoringService = new LiveScoringService(apiKey);
		
		// Get live leaderboard
		const leaderboard = await liveScoringService.getLiveLeaderboard(week);
		
		// Get game statuses
		const games = await liveScoringService.getLiveGamesStatus(week);
		
		return json({
			success: true,
			data: {
				week,
				leaderboard: leaderboard || [],
				games: games || [],
				lastUpdated: new Date().toISOString()
			}
		});
		
	} catch (error) {
		console.error('Error fetching live scores:', error);
		return json({ error: 'Failed to fetch live scores' }, { status: 500 });
	}
};