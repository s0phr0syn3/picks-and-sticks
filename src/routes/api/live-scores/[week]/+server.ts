import type { RequestHandler } from './$types';
import { getLiveScoreScheduler } from '$lib/server/live-score-scheduler';
import { ESPNLiveScoringService } from '$lib/server/live-scoring-espn';

export const GET: RequestHandler = async ({ params }) => {
	const week = parseInt(params.week, 10);

	if (isNaN(week) || week < 1 || week > 18) {
		return new Response(JSON.stringify({ error: `Invalid week: ${week}` }), { 
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		// Get the scheduler instance
		const scheduler = getLiveScoreScheduler();
		
		if (!scheduler) {
			return new Response(JSON.stringify({ error: 'Live scoring not initialized' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Create a new service instance to fetch live scores
		const service = new ESPNLiveScoringService();
		const liveGamesStatus = await service.getLiveGamesStatus(week);
		const liveLeaderboard = await service.getLiveLeaderboard(week);

		return new Response(JSON.stringify({ 
			week,
			games: liveGamesStatus,
			leaderboard: liveLeaderboard,
			schedulerStatus: scheduler.getStatus(),
			lastUpdated: new Date().toISOString()
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error fetching live scores:', error);
		return new Response(JSON.stringify({ 
			error: `Failed to fetch live scores: ${error instanceof Error ? error.message : String(error)}` 
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};