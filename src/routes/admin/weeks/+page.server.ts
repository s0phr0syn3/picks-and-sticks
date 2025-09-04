import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { weeks, picks } from '$lib/server/models';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	// Get all weeks (1-18 for regular season)
	const allWeeks = [];
	
	for (let weekNumber = 1; weekNumber <= 18; weekNumber++) {
		const [existingWeek] = await db
			.select()
			.from(weeks)
			.where(eq(weeks.weekNumber, weekNumber));
		
		allWeeks.push({
			weekNumber,
			punishment: existingWeek?.punishment || '',
			id: existingWeek?.id || null
		});
	}
	
	return {
		weeks: allWeeks
	};
};

export const actions: Actions = {
	updatePunishment: async ({ request }) => {
		const data = await request.formData();
		const weekNumber = parseInt(data.get('weekNumber') as string);
		const punishment = data.get('punishment') as string;
		
		if (!weekNumber || weekNumber < 1 || weekNumber > 18) {
			return fail(400, { error: 'Invalid week number' });
		}
		
		try {
			// Check if week exists
			const [existingWeek] = await db
				.select()
				.from(weeks)
				.where(eq(weeks.weekNumber, weekNumber));
			
			if (existingWeek) {
				// Update existing week
				await db
					.update(weeks)
					.set({
						punishment,
						updatedAt: new Date()
					})
					.where(eq(weeks.weekNumber, weekNumber));
			} else {
				// Create new week
				await db.insert(weeks).values({
					weekNumber,
					punishment,
					createdAt: new Date(),
					updatedAt: new Date()
				});
			}
			
			return { success: true };
		} catch (error) {
			console.error('Error updating punishment:', error);
			return fail(500, { error: 'Failed to update punishment' });
		}
	},
	
	resetWeekPicks: async ({ request }) => {
		const data = await request.formData();
		const weekNumber = parseInt(data.get('weekNumber') as string);
		
		if (!weekNumber || weekNumber < 1 || weekNumber > 18) {
			return fail(400, { error: 'Invalid week number' });
		}
		
		try {
			// Delete all picks for this week
			await db
				.delete(picks)
				.where(eq(picks.week, weekNumber));
			
			return { 
				success: true, 
				resetWeek: weekNumber,
				message: `All picks for week ${weekNumber} have been reset`
			};
		} catch (error) {
			console.error('Error resetting week picks:', error);
			return fail(500, { error: 'Failed to reset week picks' });
		}
	}
};