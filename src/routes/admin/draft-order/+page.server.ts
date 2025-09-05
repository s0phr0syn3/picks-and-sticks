import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { picks, users } from '$lib/server/models';
import { eq, and, sql, aliasedTable } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { getPickOrderForWeek, buildFullPickOrder } from '$lib/server/queries';

export const load: PageServerLoad = async ({ url }) => {
	const weekParam = url.searchParams.get('week');
	const week = weekParam ? parseInt(weekParam, 10) : 1;
	
	// Get all weeks (1-18 for regular season)
	const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
	
	// Get draft order for the selected week
	let draftOrder = [];
	let weekExists = false;
	
	// Check if picks exist for this week
	const assignedByUsers = aliasedTable(users, 'assignedBy');
	const existingPicks = await db
		.select({
			id: picks.id,
			userId: picks.userId,
			fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName} AS fullName`,
			round: picks.round,
			orderInRound: picks.orderInRound,
			assignedById: picks.assignedById,
			assignedByFullName: sql<string>`${assignedByUsers.firstName} || ' ' || ${assignedByUsers.lastName} AS assignedByFullName`
		})
		.from(picks)
		.leftJoin(users, eq(picks.userId, users.id))
		.leftJoin(assignedByUsers, eq(picks.assignedById, assignedByUsers.id))
		.where(eq(picks.week, week))
		.orderBy(picks.round, picks.orderInRound)
		.all();
	
	if (existingPicks.length > 0) {
		weekExists = true;
		draftOrder = existingPicks.map(pick => ({
			id: pick.id,
			userId: pick.userId,
			fullName: pick.fullName,
			round: pick.round,
			orderInRound: pick.orderInRound,
			assignedById: pick.assignedById,
			assignedByFullName: pick.assignedByFullName,
			overallPickOrder: (pick.round - 1) * 5 + pick.orderInRound
		}));
	} else {
		// Generate default order based on system rules
		const defaultOrder = getPickOrderForWeek(week);
		draftOrder = await Promise.all(defaultOrder.map(async (pick, index) => {
			let assignedByFullName = null;
			if (pick.assignedById) {
				const assignedBy = await db
					.select({ 
						fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName}` 
					})
					.from(users)
					.where(eq(users.id, pick.assignedById))
					.get();
				assignedByFullName = assignedBy?.fullName || null;
			}
			
			return {
				id: null,
				userId: pick.userId,
				fullName: pick.fullName,
				round: pick.round,
				orderInRound: pick.orderInRound,
				assignedById: pick.assignedById,
				assignedByFullName,
				overallPickOrder: (pick.round - 1) * 5 + pick.orderInRound
			};
		}));
	}
	
	// Get all users for the reorder interface
	const allUsers = await db
		.select({
			id: users.id,
			fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName} AS fullName`
		})
		.from(users)
		.orderBy(users.firstName)
		.all();
	
	return {
		weeks,
		selectedWeek: week,
		draftOrder,
		weekExists,
		users: allUsers
	};
};

export const actions: Actions = {
	generateDraftOrder: async ({ request }) => {
		const data = await request.formData();
		const week = parseInt(data.get('week') as string);
		
		if (!week || week < 1 || week > 18) {
			return fail(400, { error: 'Invalid week number' });
		}
		
		try {
			// Delete existing picks for this week
			await db.delete(picks).where(eq(picks.week, week));
			
			// Generate new draft order
			const draftOrder = getPickOrderForWeek(week);
			
			// Insert new picks
			for (const pick of draftOrder) {
				await db.insert(picks).values({
					week,
					round: pick.round,
					userId: pick.userId,
					orderInRound: pick.orderInRound,
					assignedById: pick.assignedById,
					teamId: null
				});
			}
		} catch (error) {
			console.error('Error generating draft order:', error);
			return fail(500, { error: 'Failed to generate draft order' });
		}
		
		redirect(302, `/admin/draft-order?week=${week}&generated=true`);
	},
	
	reorderPicks: async ({ request }) => {
		const data = await request.formData();
		const week = parseInt(data.get('week') as string);
		const newOrderJson = data.get('newOrder') as string;
		
		if (!week || week < 1 || week > 18 || !newOrderJson) {
			return fail(400, { error: 'Invalid data provided' });
		}
		
		try {
			const newOrder = JSON.parse(newOrderJson);
			
			// Validate the new order
			if (!Array.isArray(newOrder) || newOrder.length !== 20) {
				return fail(400, { error: 'Invalid order - must have exactly 20 picks' });
			}
			
			// Delete existing picks for this week
			await db.delete(picks).where(eq(picks.week, week));
			
			// Insert picks in new order
			for (let i = 0; i < newOrder.length; i++) {
				const pick = newOrder[i];
				const round = Math.floor(i / 5) + 1;
				const orderInRound = (i % 5) + 1;
				
				await db.insert(picks).values({
					week,
					round,
					userId: pick.userId,
					orderInRound,
					assignedById: pick.assignedById || null,
					teamId: null
				});
			}
		} catch (error) {
			console.error('Error reordering picks:', error);
			return fail(500, { error: 'Failed to update draft order' });
		}
		
		redirect(302, `/admin/draft-order?week=${week}&reordered=true`);
	},

	setPlayerOrder: async ({ request }) => {
		const data = await request.formData();
		const week = parseInt(data.get('week') as string);
		const playerOrderJson = data.get('playerOrder') as string;
		
		if (!week || week < 1 || week > 18 || !playerOrderJson) {
			return fail(400, { error: 'Invalid data provided' });
		}
		
		try {
			const playerOrder = JSON.parse(playerOrderJson);
			
			// Validate the player order
			if (!Array.isArray(playerOrder) || playerOrder.length !== 5) {
				return fail(400, { error: 'Invalid player order - must have exactly 5 players' });
			}
			
			// Verify all users exist and have unique IDs
			const userIds = playerOrder.map(p => p.id || p.userId);
			if (new Set(userIds).size !== 5) {
				return fail(400, { error: 'All players must be unique' });
			}
			
			// Map to expected format for buildFullPickOrder
			const formattedPlayerOrder = playerOrder.map(p => ({
				userId: p.id || p.userId,
				fullName: p.fullName
			}));
			
			// Generate full draft order using the snake pattern
			const fullDraftOrder = buildFullPickOrder(formattedPlayerOrder);
			
			// Delete existing picks for this week
			await db.delete(picks).where(eq(picks.week, week));
			
			// Insert new picks using the proper snake order and stuck-by assignments
			for (const pick of fullDraftOrder) {
				await db.insert(picks).values({
					week,
					round: pick.round,
					userId: pick.userId,
					orderInRound: pick.orderInRound,
					assignedById: pick.assignedById,
					teamId: null
				});
			}
		} catch (error) {
			console.error('Error setting player order:', error);
			return fail(500, { error: 'Failed to set player order' });
		}
		
		redirect(302, `/admin/draft-order?week=${week}&playerorder=true`);
	}
};