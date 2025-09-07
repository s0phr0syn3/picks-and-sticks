import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { picks, users, teams, schedules } from '$lib/server/models';
import { eq, and, sql } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
	const weekParam = url.searchParams.get('week');
	const week = weekParam ? parseInt(weekParam, 10) : 1;
	
	// Get all weeks (1-18 for regular season)
	const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
	
	// Get all picks for the week with user and team information
	const weekPicks = await db
		.select({
			pickId: picks.id,
			userId: picks.userId,
			userFullName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
			round: picks.round,
			orderInRound: picks.orderInRound,
			teamId: picks.teamId,
			teamName: sql<string>`(SELECT name FROM teams WHERE team_id = ${picks.teamId})`,
		})
		.from(picks)
		.leftJoin(users, eq(picks.userId, users.id))
		.where(eq(picks.week, week))
		.orderBy(picks.round, picks.orderInRound)
		.all();
	
	// Get all teams for this week's games
	const weekTeams = await db
		.select({
			teamId: teams.teamId,
			teamName: teams.name,
			isHome: sql<number>`1`,
			opponentId: schedules.awayTeamId,
			opponentName: sql<string>`(SELECT name FROM teams WHERE team_id = ${schedules.awayTeamId})`,
			gameDate: schedules.gameDate,
			eventId: schedules.eventId
		})
		.from(schedules)
		.innerJoin(teams, eq(schedules.homeTeamId, teams.teamId))
		.where(eq(schedules.week, week))
		.union(
			db.select({
				teamId: teams.teamId,
				teamName: teams.name,
				isHome: sql<number>`0`,
				opponentId: schedules.homeTeamId,
				opponentName: sql<string>`(SELECT name FROM teams WHERE team_id = ${schedules.homeTeamId})`,
				gameDate: schedules.gameDate,
				eventId: schedules.eventId
			})
			.from(schedules)
			.innerJoin(teams, eq(schedules.awayTeamId, teams.teamId))
			.where(eq(schedules.week, week))
		)
		.all();
	
	// Sort teams by game date and name
	weekTeams.sort((a, b) => {
		const dateA = new Date(a.gameDate).getTime();
		const dateB = new Date(b.gameDate).getTime();
		if (dateA !== dateB) return dateA - dateB;
		return a.teamName.localeCompare(b.teamName);
	});
	
	// Get already picked teams for the week
	const pickedTeamIds = await db
		.select({ teamId: picks.teamId })
		.from(picks)
		.where(and(
			eq(picks.week, week),
			sql`${picks.teamId} IS NOT NULL`
		))
		.all();
	
	const pickedTeamIdsSet = new Set(pickedTeamIds.map(p => p.teamId));
	
	return {
		weeks,
		selectedWeek: week,
		picks: weekPicks,
		availableTeams: weekTeams,
		pickedTeamIds: Array.from(pickedTeamIdsSet)
	};
};

export const actions: Actions = {
	assignTeam: async ({ request }) => {
		const data = await request.formData();
		const pickId = data.get('pickId') as string;
		const teamId = data.get('teamId') as string;
		const week = parseInt(data.get('week') as string);
		
		if (!pickId || !week) {
			return fail(400, { error: 'Invalid data provided' });
		}
		
		try {
			// Update the pick with the selected team (or null to clear)
			await db
				.update(picks)
				.set({ 
					teamId: teamId ? parseInt(teamId) : null 
				})
				.where(eq(picks.id, pickId));
			
			return { success: true, message: 'Team assignment updated' };
		} catch (error) {
			console.error('Error assigning team:', error);
			return fail(500, { error: 'Failed to assign team' });
		}
	},
	
	clearAllAssignments: async ({ request }) => {
		const data = await request.formData();
		const week = parseInt(data.get('week') as string);
		
		if (!week || week < 1 || week > 18) {
			return fail(400, { error: 'Invalid week number' });
		}
		
		try {
			// Clear all team assignments for the week
			await db
				.update(picks)
				.set({ teamId: null })
				.where(eq(picks.week, week));
			
			return { success: true, message: `Cleared all team assignments for week ${week}` };
		} catch (error) {
			console.error('Error clearing assignments:', error);
			return fail(500, { error: 'Failed to clear assignments' });
		}
	}
};