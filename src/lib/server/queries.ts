import { eq, and, sql, inArray, aliasedTable, notInArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { picks, schedules, teams, users } from '$lib/server/models';
import { randomSort } from '$lib/utils';

const getRandomUserOrder = () => {
	const allUsers = db
		.select({
			userId: users.id,
			fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName} as fullName`
		})
		.from(users)
		.all();

	console.log(`Random user order generated: ${JSON.stringify(allUsers)}`);
	return randomSort(allUsers);
};

export const getAvailableTeams = (week: number, selectedTeams: Set<number>) => {
	console.log(`Getting teams for week ${week}`);
	const weekTeams = db
		.select({
			homeTeamId: schedules.homeTeamId,
			awayTeamId: schedules.awayTeamId
		})
		.from(schedules)
		.where(eq(schedules.week, week))
		.all();

	const teamIds: Array<number> = weekTeams.reduce((ids: Array<number>, game) => {
		ids.push(game.homeTeamId, game.awayTeamId);
		return ids;
	}, []);

	if (teamIds.length === 0) {
		console.log(`No teams available for week ${week}`);
		return [];
	}

	return db
		.select({
			id: teams.teamId,
			teamId: teams.teamId,
			name: teams.name
		})
		.from(teams)
		.where(and(inArray(teams.teamId, teamIds), notInArray(teams.teamId, [...selectedTeams])))
		.orderBy(teams.name)
		.all();
};

export const getTeamScores = (week: number) => {
	const homeScores = db
		.select({
			week: schedules.week,
			teamId: schedules.homeTeamId,
			points: schedules.homeScore
		})
		.from(schedules)
		.where(eq(schedules.week, week))
		.all();

	const awayScores = db
		.select({
			week: schedules.week,
			teamId: schedules.awayTeamId,
			points: schedules.awayScore
		})
		.from(schedules)
		.where(eq(schedules.week, week))
		.all();

	const allScores = [...homeScores, ...awayScores];

	if (allScores.length === 0) {
		console.log(`No scores available for week ${week}`);
	}

	return allScores;
};

export const getPicksForWeek = (week: number) => {
	const teamScores = getTeamScores(week);

	const assignedBy = aliasedTable(users, 'assignedBy');
	const picksForWeek = db
		.select({
			id: picks.id,
			userId: picks.userId,
			fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName} AS fullName`,
			teamId: picks.teamId,
			team: teams.name,
			assignedById: assignedBy.id,
			assignedByFullName: sql<string>`${assignedBy.firstName} || ' ' || ${assignedBy.lastName} AS fullName`,
			round: picks.round,
			overallPickOrder: sql`(5 * ${picks.round}) + ${picks.orderInRound} - 5`,
			week: picks.week
		})
		.from(picks)
		.leftJoin(users, eq(picks.userId, users.id))
		.leftJoin(teams, eq(picks.teamId, teams.teamId))
		.leftJoin(assignedBy, eq(picks.assignedById, assignedBy.id))
		.where(eq(picks.week, week))
		.all();

	if (picksForWeek.length === 0) {
		console.log(`No picks found for week ${week}`);
	}

	return picksForWeek.map((pick) => {
		const teamScore = teamScores.find((score) => score.teamId === pick.teamId);
		return {
			...pick,
			points: teamScore && teamScore.points !== null ? teamScore.points : 0
		};
	});
};

export const getTotalPointsForWeekByUser = (week: number) => {
	const picksForWeek = getPicksForWeek(week);

	const userPoints: Record<number, { fullName: string; totalPoints: number }> = {};

	picksForWeek.forEach((pick) => {
		if (userPoints[pick.userId]) {
			userPoints[pick.userId].totalPoints += pick.points;
		} else {
			userPoints[pick.userId] = {
				fullName: pick.fullName,
				totalPoints: pick.points || 0
			};
		}
	});

	const sortedPoints = Object.entries(userPoints)
		.map(([userId, { fullName, totalPoints }]) => ({
			userId: parseInt(userId, 10),
			fullName,
			totalPoints
		}))
		.sort((a, b) => b.totalPoints - a.totalPoints);

	if (sortedPoints.length === 0) {
		console.log(`No user points for week ${week}`);
	}

	return sortedPoints;
};

export const getPickOrderForWeek = (week: number) => {
	// Week 1 has no prior week so randomize the pick order
	if (week === 1) {
		console.log(`Randomizing pick order for week ${week}`);
		const randomOrder = getRandomUserOrder();
		return buildFullPickOrder(randomOrder);
	}

	let priorWeek = week - 1;

	while (priorWeek > 0) {
		const userPoints = getTotalPointsForWeekByUser(priorWeek);

		if (userPoints.length > 0) {
			const userIds = userPoints.map((user) => user.userId);
			const userOrder = db
				.select({
					userId: users.id,
					fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName} AS fullName`
				})
				.from(users)
				.where(inArray(users.id, userIds))
				.all();

			const orderedUsers = userPoints
				.sort((a, b) => a.totalPoints - b.totalPoints)
				.map((point) => userOrder.find((user) => user.userId === point.userId))
				.filter((user): user is { userId: number; fullName: string } => user !== undefined);

			return buildFullPickOrder(orderedUsers);
		}

		// If no results in the prior week, look back to the week before that and try again
		console.log(`No points found for week ${priorWeek}, checking previous week.`);
		priorWeek--;
	}

	// No results found in any prior week, use a random order
	console.log(`No prior weeks with picks found, randomizing order for week ${week}`);
	const randomOrder = getRandomUserOrder();
	return buildFullPickOrder(randomOrder);
};

export const buildFullPickOrder = (pickOrder: Array<{ userId: number; fullName: string }>) => {
	const round1 = [...pickOrder];
	const round2 = [...pickOrder].reverse();
	const round3 = [...pickOrder].map((picker, index, arr) => ({
		picker,
		assignedTo: arr[(index + 1) % arr.length]
	}));
	const round4 = [...pickOrder].reverse().map((picker, index, arr) => ({
		picker,
		assignedTo: arr[(index + 1) % arr.length]
	}));

	return [
		...round1.map((user, index) => ({
			userId: user.userId,
			fullName: user.fullName,
			round: 1,
			assignedById: null,
			orderInRound: index + 1
		})),
		...round2.map((user, index) => ({
			userId: user.userId,
			fullName: user.fullName,
			round: 2,
			assignedById: null,
			orderInRound: index + 1
		})),
		...round3.map((pick, index) => ({
			userId: pick.assignedTo.userId,
			fullName: pick.assignedTo.fullName,
			round: 3,
			assignedById: pick.picker.userId,
			orderInRound: index + 1
		})),
		...round4.map((pick, index) => ({
			userId: pick.assignedTo.userId,
			fullName: pick.assignedTo.fullName,
			round: 4,
			assignedById: pick.picker.userId,
			orderInRound: index + 1
		}))
	];
};
