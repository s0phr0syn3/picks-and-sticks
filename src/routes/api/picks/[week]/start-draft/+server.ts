import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { picks } from '$lib/server/models';
import { getPickOrderForWeek } from '$lib/server/queries';

export const POST: RequestHandler = async ({ params }) => {
	const week = parseInt(params.week, 10);

	if (isNaN(week) || week <= 0 || week > 18) {
		return new Response(JSON.stringify({ error: `Invalid week: ${week}` }), { status: 400 });
	}
	console.log(`Week is: ${week}`);
	try {
		const existingPicks = db
			.select({
				userId: picks.userId,
				teamId: picks.teamId,
				round: picks.round
			})
			.from(picks)
			.where(eq(picks.week, week))
			.all();

		console.log(`existingPicks.length is: ${existingPicks.length}`);

		const draftIncomplete = existingPicks.some((pick) => pick.teamId === null);

		console.log(`Draft incomplete?: ${draftIncomplete}`);

		if (existingPicks.length > 0 && !draftIncomplete) {
			return new Response(JSON.stringify({ error: `Draft already completed for week ${week}` }), {
				status: 400
			});
		}

		const pickOrder = getPickOrderForWeek(week);
		console.log(pickOrder);

		for (const pick of pickOrder) {
			await db.insert(picks).values({
				week,
				round: pick.round,
				userId: pick.userId,
				teamId: null,
				orderInRound: pick.orderInRound,
				assignedById: pick.assignedById
			});
		}

		return new Response(
			JSON.stringify({
				message: `Draft started for week ${week}`
			}),
			{ status: 200 }
		);
	} catch (error) {
		console.error('Error starting the draft:', error);
		return new Response(JSON.stringify({ error: 'Failed to start the draft' }), { status: 500 });
	}
};
