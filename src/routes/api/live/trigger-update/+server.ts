import type { RequestHandler } from './$types';
import { getLiveScoreScheduler } from '$lib/server/live-score-scheduler';
import { json } from '@sveltejs/kit';

// Manual trigger endpoint for testing/admin use
export const POST: RequestHandler = async ({ request, url }) => {
	try {
		const body = await request.json();
		const week = body.week || parseInt(url.searchParams.get('week') || '1');
		
		const scheduler = getLiveScoreScheduler();
		if (!scheduler) {
			return json({ error: 'Live scoring not initialized' }, { status: 500 });
		}

		await scheduler.triggerUpdate(week);
		
		return json({
			success: true,
			message: `Live scores updated for week ${week}`,
			timestamp: new Date().toISOString()
		});
		
	} catch (error) {
		console.error('Error triggering update:', error);
		return json({ error: 'Failed to trigger update' }, { status: 500 });
	}
};

export const GET: RequestHandler = async () => {
	const scheduler = getLiveScoreScheduler();
	if (!scheduler) {
		return json({ error: 'Live scoring not initialized' }, { status: 500 });
	}

	return json({
		success: true,
		status: scheduler.getStatus()
	});
};