import type { RequestHandler } from './$types';
import { getLiveScoreScheduler } from '$lib/server/live-score-scheduler';

export const POST: RequestHandler = async ({ params }) => {
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

		console.log(`🔧 Manual trigger requested for week ${week}`);
		
		// Trigger manual update
		await scheduler.triggerUpdate(week);

		return new Response(JSON.stringify({ 
			success: true,
			message: `Manual live score update triggered for week ${week}`,
			timestamp: new Date().toISOString()
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error triggering live score update:', error);
		return new Response(JSON.stringify({ 
			error: `Failed to trigger live score update: ${error instanceof Error ? error.message : String(error)}` 
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};