import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { picks, teams, users, schedules } from '$lib/server/models';
import { randomSort } from '$lib/utils';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Optional: specify a single week to create picks for
		const weekParam = url.searchParams.get('week');
		const targetWeek = weekParam ? parseInt(weekParam, 10) : null;
		
		if (targetWeek && (targetWeek < 1 || targetWeek > 18)) {
			return new Response(
				JSON.stringify({
					error: `Invalid week number: ${targetWeek}. Must be between 1 and 18.`
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const userIds = db.select({ id: users.id }).from(users).orderBy(users.id).all();
		
		// If week specified, only create picks for that week
		// Otherwise, get all weeks from schedules
		const weeks = targetWeek 
			? [{ week: targetWeek }]
			: db.select({ week: schedules.week })
				.from(schedules)
				.groupBy(schedules.week)
				.orderBy(schedules.week)
				.all();

		const pickRecords: {
			week: number;
			round: number;
			userId: string;
			teamId: number | null;
			orderInRound: number;
			assignedById?: string | null;
		}[] = [];
		const rounds = 4;

		// Create empty pick slots for specified week(s)
		// Teams will be assigned during the actual draft
		for (const week of weeks.map((x) => x.week)) {
			// Check if picks already exist for this week
			const existingPicks = db
				.select({ id: picks.id })
				.from(picks)
				.where(eq(picks.week, week))
				.limit(1)
				.all();
			
			if (existingPicks.length > 0) {
				console.log(`Picks already exist for week ${week}, skipping...`);
				continue;
			}

			const shuffledUserIds = randomSort(userIds);

			for (let round = 1; round <= rounds; round++) {
				const roundUserIds =
					round % 2 === 1
						? shuffledUserIds.map((user) => user.id)
						: [...shuffledUserIds.map((user) => user.id).reverse()];

				let orderInRound = 1;

				for (let i = 0; i < roundUserIds.length; i++) {
					const userId = roundUserIds[i];
					let assignedById = null;
					
					// Rounds 3 and 4 are assigned by other users
					if (round > 2) {
						assignedById = i > 0 ? roundUserIds[i - 1] : roundUserIds[roundUserIds.length - 1];
					}

					pickRecords.push({
						week,
						round,
						userId,
						teamId: null, // No team pre-assigned - will be filled during draft
						orderInRound,
						...(assignedById && { assignedById })
					});
					orderInRound++;
				}
			}
		}

		// Insert empty pick slots
		for (const record of pickRecords) {
			await db.insert(picks).values(record).onConflictDoNothing();
		}

		const message = targetWeek 
			? `Created empty pick slots for week ${targetWeek}`
			: `Created empty pick slots for ${weeks.length} week(s)`;

		return new Response(
			JSON.stringify({
				message,
				data: {
					totalSlots: pickRecords.length,
					weeks: targetWeek ? [targetWeek] : weeks.map(w => w.week),
					users: userIds.length,
					rounds: rounds
				}
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		console.error(`Failed to create pick slots: `, error);
		return new Response(
			JSON.stringify({
				error: `Failed to create pick slots.`,
				details: error instanceof Error ? error.message : String(error)
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
