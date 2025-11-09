import type { RequestHandler } from './$types';
import { simulateWeekPicks, getSimulatedResults } from '$lib/server/queries';
import { successResponse, failureResponse } from '$lib/utils';

export const POST: RequestHandler = async ({ params }) => {
	const week = parseInt(params.week, 10);

	if (isNaN(week) || week < 1 || week > 18) {
		return failureResponse(`Invalid week: ${week.toString()}`, 'Invalid week parameter');
	}

	try {
		console.log(`API: Running simulation for week ${week}`);

		// Run the simulation
		const simulatedPicks = simulateWeekPicks(week);

		// Calculate results
		const results = getSimulatedResults(simulatedPicks);

		return successResponse({
			week,
			simulatedPicks,
			users: results.users,
			winner: results.winner
		}, `Simulation complete for week ${week}: ${simulatedPicks.length} picks generated`);
	} catch (error) {
		console.error('Error running simulation:', error);

		// Provide more specific error messages
		if (error instanceof Error) {
			if (error.message.includes('picks already exist')) {
				return failureResponse(
					error,
					`Cannot simulate week ${week}: Picks already exist for this week. Simulation is only available for weeks without picks.`
				);
			}
			if (error.message.includes('unable to determine pick order')) {
				return failureResponse(
					error,
					`Cannot simulate week ${week}: Unable to determine pick order. The previous week may not be complete yet.`
				);
			}
		}

		return failureResponse(error, 'Failed to run simulation');
	}
};
