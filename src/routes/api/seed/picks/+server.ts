import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { picks, teams, users, schedules } from '$lib/server/models';
import { randomSort } from '$lib/utils';

export const GET: RequestHandler = async () => {
	try {
		const userIds = db.select({ id: users.id }).from(users).orderBy(users.id).all();
		const teamIds = db.select({ id: teams.teamId }).from(teams).orderBy(teams.teamId).all();
		const weeks = db
			.select({ week: schedules.week })
			.from(schedules)
			.groupBy(schedules.week)
			.orderBy(schedules.week)
			.all();

		const pickRecords: {
			week: number;
			round: number;
			userId: number;
			teamId: number;
			orderInRound: number;
			assignedById?: number;
		}[] = [];
		const rounds = 4;

		for (const week of weeks.map((x) => x.week)) {
			const shuffledUserIds = randomSort(userIds);
			const shuffledTeamIds = teamIds.map((team) => team.id).sort(() => Math.random() - 0.5);

			for (let round = 1; round <= rounds; round++) {
				const roundUserIds =
					round % 2 === 1
						? shuffledUserIds.map((user) => user.id)
						: [...shuffledUserIds.map((user) => user.id).reverse()];

				let orderInRound = 1;

				for (let i = 0; i < roundUserIds.length; i++) {
					const userId = roundUserIds[i];
					const teamId = shuffledTeamIds.pop();
					let assignedById = null;
					if (round > 2) {
						assignedById = i > 0 ? roundUserIds[i - 1] : roundUserIds[roundUserIds.length - 1];
					}

					if (teamId !== undefined) {
						pickRecords.push({
							week,
							round,
							userId,
							teamId,
							orderInRound,
							...(assignedById && { assignedById })
						});
						orderInRound++;
					}
				}
			}
		}

		for (const record of pickRecords) {
			await db.insert(picks).values(record).onConflictDoNothing();
		}

		return new Response(
			JSON.stringify({
				message: `Seeded picks table with the following info:`,
				data: {
					picks: pickRecords
				}
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);
	} catch (error) {
		console.error(`Failed to populate picks table: `, error);
		return new Response(
			JSON.stringify({
				error: `Failed to populate picks table.`,
				details: error instanceof Error ? error.message : String(error)
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};
