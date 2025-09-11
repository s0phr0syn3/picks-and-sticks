import type { RequestHandler } from './$types';
import { getCurrentWeek } from '$lib/server/queries';
import { successResponse, failureResponse } from '$lib/utils';

export const GET: RequestHandler = async () => {
	try {
		const currentWeek = getCurrentWeek();
		
		return successResponse(
			{ currentWeek },
			`Current week is ${currentWeek}`
		);
	} catch (error) {
		console.error('Error getting current week:', error);
		return failureResponse(error, 'Failed to get current week');
	}
};