import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { weeks } from '$lib/server/models';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { getWeekWinner } from '$lib/server/queries';

export const load: PageServerLoad = async ({ params, fetch, locals }) => {
	const week = parseInt(params.week, 10) || 1;
	const currentUserId = locals.user?.id;

	const response = await fetch(`/api/draft/${week}/select-team`);

	if (!response.ok) {
		throw new Error(`Failed to fetch draft data for week ${week}. Status: ${response.status}`);
	}

	const data = await response.json();

	// Get previous week's punishment (if any)
	let previousWeekPunishment = null;
	if (week > 1) {
		const [prevWeek] = await db
			.select()
			.from(weeks)
			.where(eq(weeks.weekNumber, week - 1));
		
		if (prevWeek?.punishment) {
			previousWeekPunishment = prevWeek.punishment;
		}
	}

	// Get current week's punishment (if any)
	let currentWeekPunishment = '';
	const [currentWeek] = await db
		.select()
		.from(weeks)
		.where(eq(weeks.weekNumber, week));
	
	if (currentWeek?.punishment) {
		currentWeekPunishment = currentWeek.punishment;
	}

	// Check if current user is the winner of the previous week (can set punishment)
	let canSetPunishment = false;
	let previousWeekWinner = null;
	if (week > 1 && currentUserId) {
		previousWeekWinner = getWeekWinner(week - 1);
		canSetPunishment = previousWeekWinner?.userId === currentUserId;
	}

	return {
		draftState: data.draftState,
		availableTeams: data.availableTeams,
		unavailableTeams: data.unavailableTeams || [],
		week,
		previousWeekPunishment,
		currentWeekPunishment,
		canSetPunishment,
		previousWeekWinner: previousWeekWinner?.fullName || null,
		currentUserId
	};
};

export const actions: Actions = {
	updatePunishment: async ({ params, request, locals }) => {
		const week = parseInt(params.week, 10);
		const data = await request.formData();
		const punishment = data.get('punishment') as string;
		const currentUserId = locals.user?.id;
		
		if (!week || week < 1 || week > 18) {
			return fail(400, { error: 'Invalid week number' });
		}

		// Check if user is allowed to set punishment (must be previous week's winner)
		if (week > 1 && currentUserId) {
			const previousWeekWinner = getWeekWinner(week - 1);
			if (previousWeekWinner?.userId !== currentUserId) {
				return fail(403, { error: 'Only the winner of the previous week can set the punishment' });
			}
		}
		
		try {
			// Check if week exists
			const [existingWeek] = await db
				.select()
				.from(weeks)
				.where(eq(weeks.weekNumber, week));
			
			if (existingWeek) {
				// Update existing week
				await db
					.update(weeks)
					.set({
						punishment,
						updatedAt: new Date()
					})
					.where(eq(weeks.weekNumber, week));
			} else {
				// Create new week
				await db.insert(weeks).values({
					weekNumber: week,
					punishment,
					createdAt: new Date(),
					updatedAt: new Date()
				});
			}
			
			return { success: true, message: 'Punishment updated successfully!' };
		} catch (error) {
			console.error('Error updating punishment:', error);
			return fail(500, { error: 'Failed to update punishment' });
		}
	}
};
