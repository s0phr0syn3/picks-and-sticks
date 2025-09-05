import { eq, and, sql, inArray, aliasedTable, notInArray, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { picks, schedules, teams, users, liveScores } from '$lib/server/models';
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
	
	// Get all games for the week with their start times and live status
	const weekGames = db
		.select({
			homeTeamId: schedules.homeTeamId,
			awayTeamId: schedules.awayTeamId,
			eventId: schedules.eventId,
			gameDate: schedules.gameDate,
			isLive: liveScores.isLive,
			isComplete: liveScores.isComplete
		})
		.from(schedules)
		.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
		.where(eq(schedules.week, week))
		.all();

	const currentTime = new Date();
	const unavailableTeamIds = new Set<number>();

	// Filter out teams whose games have started or are live/complete
	for (const game of weekGames) {
		const gameStartTime = new Date(game.gameDate);
		const gameHasStarted = currentTime >= gameStartTime;
		const gameIsLiveOrComplete = game.isLive || game.isComplete;
		
		if (gameHasStarted || gameIsLiveOrComplete) {
			unavailableTeamIds.add(game.homeTeamId);
			unavailableTeamIds.add(game.awayTeamId);
			console.log(`Game ${game.eventId} has started or is live/complete - teams ${game.homeTeamId} and ${game.awayTeamId} unavailable`);
		}
	}

	const allTeamIds: Array<number> = weekGames.reduce((ids: Array<number>, game) => {
		ids.push(game.homeTeamId, game.awayTeamId);
		return ids;
	}, []);

	// Remove teams that are already selected OR games have started
	const finalUnavailableTeams = [...selectedTeams, ...unavailableTeamIds];

	if (allTeamIds.length === 0) {
		console.log(`No teams available for week ${week}`);
		return [];
	}

	const availableTeams = db
		.select({
			id: teams.teamId,
			teamId: teams.teamId,
			name: teams.name
		})
		.from(teams)
		.where(and(
			inArray(teams.teamId, allTeamIds), 
			notInArray(teams.teamId, finalUnavailableTeams)
		))
		.orderBy(teams.name)
		.all();

	console.log(`Week ${week}: ${availableTeams.length} teams available for draft, ${unavailableTeamIds.size} teams unavailable due to started games`);
	
	return availableTeams;
};

export const getAllTeamsForWeek = (week: number, selectedTeams: Set<number>) => {
	console.log(`Getting all teams for week ${week} with status`);
	
	// Get all teams first
	const allTeams = db
		.select({
			id: teams.teamId,
			teamId: teams.teamId,
			name: teams.name
		})
		.from(teams)
		.orderBy(teams.name)
		.all();
	
	// Get all games for the week with their start times and live status
	const weekGames = db
		.select({
			homeTeamId: schedules.homeTeamId,
			awayTeamId: schedules.awayTeamId,
			eventId: schedules.eventId,
			gameDate: schedules.gameDate,
			isLive: liveScores.isLive,
			isComplete: liveScores.isComplete
		})
		.from(schedules)
		.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
		.where(eq(schedules.week, week))
		.all();

	const currentTime = new Date();
	const gameStatusMap = new Map<number, {
		gameHasStarted: boolean;
		isLive: boolean;
		isComplete: boolean;
		gameDate: string;
		hasGame: boolean;
	}>();

	// Build status map for teams with games
	const teamsWithGames = new Set<number>();
	for (const game of weekGames) {
		const gameStartTime = new Date(game.gameDate);
		const gameHasStarted = currentTime >= gameStartTime;
		const gameIsLiveOrComplete = game.isLive || game.isComplete;
		
		const status = {
			gameHasStarted,
			isLive: !!game.isLive,
			isComplete: !!game.isComplete,
			gameDate: game.gameDate,
			hasGame: true
		};
		
		gameStatusMap.set(game.homeTeamId, status);
		gameStatusMap.set(game.awayTeamId, status);
		teamsWithGames.add(game.homeTeamId);
		teamsWithGames.add(game.awayTeamId);
	}

	const availableTeams = [];
	const unavailableTeams = [];

	for (const team of allTeams) {
		const isSelected = selectedTeams.has(team.teamId);
		const gameStatus = gameStatusMap.get(team.teamId);
		const hasGame = teamsWithGames.has(team.teamId);
		
		// Team is on bye week if they don't have a game scheduled
		if (!hasGame) {
			unavailableTeams.push({
				...team,
				isSelected: false,
				gameHasStarted: false,
				isLive: false,
				isComplete: false,
				gameDate: null,
				reason: 'Bye week',
				isBye: true
			});
			continue;
		}
		
		const gameHasStarted = gameStatus?.gameHasStarted || false;
		const isLive = gameStatus?.isLive || false;
		const isComplete = gameStatus?.isComplete || false;
		
		const teamWithStatus = {
			...team,
			isSelected,
			gameHasStarted,
			isLive,
			isComplete,
			gameDate: gameStatus?.gameDate || null,
			isBye: false
		};

		if (isSelected) {
			unavailableTeams.push({ ...teamWithStatus, reason: 'Already selected' });
		} else if (gameHasStarted || isLive || isComplete) {
			const reason = isComplete ? 'Game finished' : isLive ? 'Game in progress' : 'Game started';
			unavailableTeams.push({ ...teamWithStatus, reason });
		} else {
			availableTeams.push(teamWithStatus);
		}
	}
	
	const byeTeams = unavailableTeams.filter(t => t.isBye).length;
	console.log(`Week ${week}: ${availableTeams.length} available, ${unavailableTeams.length} unavailable teams (${byeTeams} bye weeks)`);
	
	return { availableTeams, unavailableTeams };
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
			orderInRound: picks.orderInRound,
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
