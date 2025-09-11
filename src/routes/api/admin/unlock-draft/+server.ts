import type { RequestHandler } from './$types';
import { unlockDraft } from '$lib/server/queries';
import { successResponse, failureResponse } from '$lib/utils';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { week } = await request.json();

		if (!week || isNaN(parseInt(week, 10))) {
			return failureResponse('Invalid week parameter', 'Week must be a valid number');
		}

		const weekNumber = parseInt(week, 10);
		await unlockDraft(weekNumber);

		return successResponse(
			{ week: weekNumber },
			`Draft unlocked for week ${weekNumber}`
		);
	} catch (error) {
		console.error('Error unlocking draft:', error);
		return failureResponse(error, 'Failed to unlock draft');
	}
};