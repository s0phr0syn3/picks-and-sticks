import type { RequestHandler } from './$types';
import { getLiveScoreScheduler } from '$lib/server/live-score-scheduler';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
	const week = parseInt(params.week);
	
	if (!week || week < 1 || week > 18) {
		return json({ error: 'Invalid week number' }, { status: 400 });
	}

	try {
		const scheduler = getLiveScoreScheduler();
		if (!scheduler) {
			return json({ error: 'Live scoring not initialized' }, { status: 500 });
		}

		// Get live leaderboard
		const leaderboard = await scheduler.liveScoringService.getLiveLeaderboard(week);
		
		// Get game statuses
		const games = await scheduler.liveScoringService.getLiveGamesStatus(week);
		
		return json({
			success: true,
			data: {
				week,
				leaderboard,
				games,
				lastUpdated: new Date().toISOString()
			}
		});
		
	} catch (error) {
		console.error('Error fetching live scores:', error);
		return json({ error: 'Failed to fetch live scores' }, { status: 500 });
	}
};