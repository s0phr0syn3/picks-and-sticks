import type { RequestHandler } from './$types';
import { LiveScoringService } from '$lib/server/live-scoring';
import { json } from '@sveltejs/kit';

// Manual trigger endpoint for testing/admin use
export const POST: RequestHandler = async ({ request, url }) => {
	try {
		let week = 1;
		
		// Try to get week from body or query params
		try {
			const body = await request.json();
			week = body.week || parseInt(url.searchParams.get('week') || '1');
		} catch {
			week = parseInt(url.searchParams.get('week') || '1');
		}
		
		const apiKey = process.env.API_KEY;
		if (!apiKey) {
			return json({ error: 'API key not configured' }, { status: 500 });
		}

		const liveScoringService = new LiveScoringService(apiKey);
		await liveScoringService.updateLiveScores(week);
		
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
	// For now, just return a simple status
	return json({
		success: true,
		status: {
			message: 'Live scoring service available',
			timestamp: new Date().toISOString()
		}
	});
};