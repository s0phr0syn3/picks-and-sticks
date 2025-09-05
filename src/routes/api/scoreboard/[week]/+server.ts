import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { schedules, liveScores, teams } from '$lib/server/models';
import { eq, sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const week = parseInt(params.week, 10);

	if (isNaN(week) || week < 1 || week > 18) {
		return new Response(JSON.stringify({ error: `Invalid week: ${week}` }), { 
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		// Get all games for the week with team names and live scores
		const games = await db
			.select({
				eventId: schedules.eventId,
				homeTeamId: schedules.homeTeamId,
				awayTeamId: schedules.awayTeamId,
				homeTeamName: sql<string>`(SELECT name FROM teams WHERE team_id = ${schedules.homeTeamId})`,
				awayTeamName: sql<string>`(SELECT name FROM teams WHERE team_id = ${schedules.awayTeamId})`,
				gameDate: schedules.gameDate,
				// Live scores (if available)
				homeScore: sql<number>`COALESCE(${liveScores.homeScore}, 0)`,
				awayScore: sql<number>`COALESCE(${liveScores.awayScore}, 0)`,
				quarter: liveScores.quarter,
				timeRemaining: liveScores.timeRemaining,
				isLive: sql<boolean>`COALESCE(${liveScores.isLive}, 0)`,
				isComplete: sql<boolean>`COALESCE(${liveScores.isComplete}, 0)`,
				lastUpdated: liveScores.lastUpdated
			})
			.from(schedules)
			.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
			.where(eq(schedules.week, week))
			.orderBy(schedules.gameDate);

		// Format the games data
		const formattedGames = games.map(game => ({
			eventId: game.eventId,
			homeTeamId: game.homeTeamId,
			awayTeamId: game.awayTeamId,
			homeTeamName: game.homeTeamName,
			awayTeamName: game.awayTeamName,
			homeScore: game.homeScore,
			awayScore: game.awayScore,
			quarter: game.quarter,
			timeRemaining: game.timeRemaining,
			isLive: !!game.isLive,
			isComplete: !!game.isComplete,
			lastUpdated: game.lastUpdated ? new Date(game.lastUpdated).toISOString() : null,
			gameDate: game.gameDate
		}));

		return new Response(JSON.stringify({ 
			week,
			games: formattedGames,
			lastUpdated: new Date().toISOString()
		}), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error fetching scoreboard:', error);
		return new Response(JSON.stringify({ 
			error: `Failed to fetch scoreboard: ${error instanceof Error ? error.message : String(error)}` 
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};