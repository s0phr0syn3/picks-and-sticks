import type { RequestHandler } from './$types';
import {
	getPickOrderForWeek,
	getPicksForWeek,
	getTotalPointsForWeekByUser
} from '$lib/server/queries';
import { successResponse, failureResponse } from '$lib/utils';

export const GET: RequestHandler = async ({ params }) => {
	const week = parseInt(params.week, 10);

	if (isNaN(week)) {
		return failureResponse(`Invalid week: ${week.toString()}`, 'Invalid week parameter');
	}

	try {
		const picksForWeek = getPicksForWeek(week);
		const totalPoints = getTotalPointsForWeekByUser(week);

		// Check if we have actual team selections (not just draft state)
		const picksWithTeams = picksForWeek.filter(pick => pick.teamId !== null);

		if (picksWithTeams.length > 0) {
			return successResponse({
				picks: picksForWeek, // Return all picks but indicate we have team selections
				totalPoints,
				week,
				hasTeamSelections: true
			}, `Retrieved ${picksForWeek.length} picks for week ${week}`);
		}

		// If we have picks but no team selections, it's a draft in progress
		if (picksForWeek.length > 0) {
			return successResponse({
				draftState: picksForWeek,
				totalPoints,
				week,
				hasTeamSelections: false
			}, `Retrieved draft state for week ${week}`);
		}

		const pickOrder = getPickOrderForWeek(week);

		return successResponse({
			draftState: pickOrder,
			totalPoints: totalPoints,
			week
		}, `Retrieved draft order for week ${week}`);
	} catch (error) {
		console.error('Error fetching picks data:', error);
		return failureResponse(error, 'Failed to fetch picks data');
	}
};
