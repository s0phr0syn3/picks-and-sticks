import { eq, and, sql, inArray, aliasedTable, notInArray, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { picks, schedules, teams, users, liveScores, weeks } from '$lib/server/models';
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
	// Get scores from live_scores table joined with schedules for team mapping
	const homeScores = db
		.select({
			week: schedules.week,
			teamId: schedules.homeTeamId,
			points: sql<number>`COALESCE(${liveScores.homeScore}, ${schedules.homeScore}, 0)`
		})
		.from(schedules)
		.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
		.where(eq(schedules.week, week))
		.all();

	const awayScores = db
		.select({
			week: schedules.week,
			teamId: schedules.awayTeamId,
			points: sql<number>`COALESCE(${liveScores.awayScore}, ${schedules.awayScore}, 0)`
		})
		.from(schedules)
		.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
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

export const checkAndUpdateDraftLock = async (week: number) => {
	// Get all selected teams for this week
	const selectedTeams = db
		.select({
			teamId: picks.teamId
		})
		.from(picks)
		.where(and(eq(picks.week, week), sql`${picks.teamId} IS NOT NULL`))
		.all()
		.map(pick => pick.teamId!)
		.filter(teamId => teamId !== null);

	if (selectedTeams.length === 0) {
		console.log(`No teams selected for week ${week} yet, draft remains unlocked`);
		return false;
	}

	// Check if any selected team's game has started
	const currentTime = new Date();
	const gamesStarted = db
		.select({
			eventId: schedules.eventId,
			gameDate: schedules.gameDate,
			homeTeamId: schedules.homeTeamId,
			awayTeamId: schedules.awayTeamId,
			isLive: liveScores.isLive,
			isComplete: liveScores.isComplete
		})
		.from(schedules)
		.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
		.where(and(
			eq(schedules.week, week),
			or(
				inArray(schedules.homeTeamId, selectedTeams),
				inArray(schedules.awayTeamId, selectedTeams)
			)
		))
		.all();

	const shouldLock = gamesStarted.some(game => {
		const gameStartTime = new Date(game.gameDate);
		const gameHasStarted = currentTime >= gameStartTime;
		const gameIsLiveOrComplete = game.isLive || game.isComplete;
		return gameHasStarted || gameIsLiveOrComplete;
	});

	if (shouldLock) {
		// Lock the draft by updating/inserting week record
		await db
			.insert(weeks)
			.values({
				weekNumber: week,
				isDraftLocked: true,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.onConflictDoUpdate({
				target: weeks.weekNumber,
				set: {
					isDraftLocked: true,
					updatedAt: new Date()
				}
			});

		console.log(`🔒 Draft locked for week ${week} - selected team games have started`);
		return true;
	}

	return false;
};

export const isDraftLocked = (week: number) => {
	const weekData = db
		.select({
			isDraftLocked: weeks.isDraftLocked
		})
		.from(weeks)
		.where(eq(weeks.weekNumber, week))
		.get();

	return weekData?.isDraftLocked || false;
};

export const unlockDraft = async (week: number) => {
	// Admin function to unlock draft
	await db
		.insert(weeks)
		.values({
			weekNumber: week,
			isDraftLocked: false,
			createdAt: new Date(),
			updatedAt: new Date()
		})
		.onConflictDoUpdate({
			target: weeks.weekNumber,
			set: {
				isDraftLocked: false,
				updatedAt: new Date()
			}
		});

	console.log(`🔓 Draft unlocked for week ${week} by admin`);
};

export const isWeekComplete = (week: number) => {
	// A week is complete when all games for that week are finished
	const weekGames = db
		.select({
			eventId: schedules.eventId,
			isComplete: liveScores.isComplete
		})
		.from(schedules)
		.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
		.where(eq(schedules.week, week))
		.all();

	if (weekGames.length === 0) {
		console.log(`No games found for week ${week}`);
		return false;
	}

	// Week is complete when ALL games are marked as complete
	const allGamesComplete = weekGames.every(game => game.isComplete === true);
	
	console.log(`Week ${week}: ${weekGames.length} games, all complete: ${allGamesComplete}`);
	return allGamesComplete;
};

export const getCurrentWeek = () => {
	// Get the current week based on which week has games scheduled for this time period
	// Logic: find the earliest week that has games not yet completed
	const currentDate = new Date();
	
	for (let week = 1; week <= 18; week++) {
		const weekGames = db
			.select({
				eventId: schedules.eventId,
				gameDate: schedules.gameDate,
				isComplete: liveScores.isComplete
			})
			.from(schedules)
			.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
			.where(eq(schedules.week, week))
			.all();

		if (weekGames.length === 0) continue;

		// If this week has any incomplete games, it's the current week
		const hasIncompleteGames = weekGames.some(game => !game.isComplete);
		if (hasIncompleteGames) {
			console.log(`Current week determined to be: ${week}`);
			return week;
		}

		// If this week has games but they're all complete, 
		// check if the latest game was recent (within last 3 days)
		const latestGameDate = new Date(Math.max(...weekGames.map(g => new Date(g.gameDate).getTime())));
		const daysSinceLatestGame = (currentDate.getTime() - latestGameDate.getTime()) / (1000 * 60 * 60 * 24);
		
		if (daysSinceLatestGame <= 3) {
			console.log(`Current week determined to be: ${week} (recent completion)`);
			return week;
		}
	}

	// Fallback: return week 1 if no current week found
	console.log(`No current week found, defaulting to week 1`);
	return 1;
};
