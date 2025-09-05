import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { picks, schedules, liveScores } from '$lib/server/models';
import { eq, and, or } from 'drizzle-orm';
import { getAvailableTeams, getPicksForWeek, getAllTeamsForWeek } from '$lib/server/queries';

interface Pick {
	teamId: number | null;
}

export const GET: RequestHandler = async ({ params }) => {
	const week = parseInt(params.week, 10);

	if (isNaN(week)) {
		return new Response(JSON.stringify({ error: `Invalid week: ${week}` }), { status: 400 });
	}

	try {
		const draftState: Pick[] = getPicksForWeek(week);
		const selectedTeams = new Set(
			draftState
				.filter((pick): pick is Pick & { teamId: number } => pick.teamId !== null)
				.map((pick) => pick.teamId)
		);

		const { availableTeams, unavailableTeams } = getAllTeamsForWeek(week, selectedTeams);

		return new Response(
			JSON.stringify({
				draftState,
				availableTeams,
				unavailableTeams,
				week
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		return new Response(
			JSON.stringify({ error: `Failed to retrieve draft data: ${error instanceof Error ? error.message : String(error)}` }),
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	const week = parseInt(params.week, 10);
	const { pickId, teamId } = await request.json();

	console.log(`week: ${week}`);
	console.log(`pickId: ${pickId}`);
	console.log(`teamId: ${teamId}`);

	if (!week || !pickId || !teamId) {
		return new Response(JSON.stringify({ error: `Invalid data` }), { status: 400 });
	}

	try {
		// Check if the team's game has already started
		const teamGame = await db
			.select({
				eventId: schedules.eventId,
				gameDate: schedules.gameDate,
				homeTeamId: schedules.homeTeamId,
				awayTeamId: schedules.awayTeamId,
				isLive: liveScores.isLive,
				isComplete: liveScores.isComplete
			})
			.from(schedules)
			.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
			.where(and(
				eq(schedules.week, week),
				or(
					eq(schedules.homeTeamId, teamId),
					eq(schedules.awayTeamId, teamId)
				)
			))
			.get();

		if (teamGame) {
			const gameStartTime = new Date(teamGame.gameDate);
			const currentTime = new Date();
			const gameHasStarted = currentTime >= gameStartTime;
			const gameIsLiveOrComplete = teamGame.isLive || teamGame.isComplete;

			if (gameHasStarted || gameIsLiveOrComplete) {
				console.log(`Draft blocked: Team ${teamId} game has started or is live/complete`);
				return new Response(
					JSON.stringify({ 
						error: `Cannot draft this team - their game has already started or is in progress` 
					}), 
					{ status: 400 }
				);
			}
		}

		await db
			.update(picks)
			.set({
				teamId: teamId
			})
			.where(eq(picks.id, pickId))
			.execute();

		const draftState: Pick[] = getPicksForWeek(week);

		const selectedTeams = new Set(
			draftState
				.filter((pick): pick is Pick & { teamId: number } => pick.teamId !== null)
				.map((pick) => pick.teamId)
		);

		const { availableTeams, unavailableTeams } = getAllTeamsForWeek(week, selectedTeams);

		return new Response(
			JSON.stringify({
				draftState: draftState,
				availableTeams: availableTeams,
				unavailableTeams: unavailableTeams,
				week: week
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		return new Response(JSON.stringify({ error: `Failed to select team: ${error instanceof Error ? error.message : String(error)}` }), { status: 500 });
	}
};
