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
			week: picks.week,
			reasoning: picks.reasoning
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

	const userPoints: Record<string, { fullName: string; totalPoints: number }> = {};

	picksForWeek.forEach((pick) => {
		const userIdKey = String(pick.userId);
		
		if (userPoints[userIdKey]) {
			userPoints[userIdKey].totalPoints += pick.points;
		} else {
			userPoints[userIdKey] = {
				fullName: pick.fullName,
				totalPoints: pick.points || 0
			};
		}
	});

	const sortedPoints = Object.entries(userPoints)
		.map(([userId, { fullName, totalPoints }]) => ({
			userId: userId,
			fullName,
			totalPoints
		}))
		.sort((a, b) => a.totalPoints - b.totalPoints);

	return sortedPoints;
};

export const getWeekWinner = (week: number): { userId: string; fullName: string; totalPoints: number } | null => {
	const userPoints = getTotalPointsForWeekByUser(week);
	if (userPoints.length === 0) {
		return null;
	}
	// Return the user with the highest points (last in the sorted array since it's sorted lowest to highest)
	return userPoints[userPoints.length - 1];
};

export const getPickOrderForWeek = (week: number) => {
	// Week 1 has no prior week so randomize the pick order
	if (week === 1) {
		console.log(`Randomizing pick order for week ${week}`);
		const randomOrder = getRandomUserOrder();
		return buildFullPickOrder(randomOrder);
	}

	// Only use the immediately previous week, and only if it's complete
	const priorWeek = week - 1;
	
	// Check if the prior week is complete (all games finished)
	if (!isWeekComplete(priorWeek)) {
		console.log(`Week ${priorWeek} is not complete yet. Cannot set draft order for week ${week}.`);
		throw new Error(`Draft order for week ${week} cannot be set until week ${priorWeek} is complete.`);
	}
	
	const userPoints = getTotalPointsForWeekByUser(priorWeek);
	console.log(`Week ${week}: Getting user points for prior week ${priorWeek}:`, userPoints);

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

		console.log(`Week ${week}: User database lookup:`, userOrder);

		const sortedUserPoints = userPoints.sort((a, b) => a.totalPoints - b.totalPoints);
		console.log(`Week ${week}: Sorted user points (lowest first):`, sortedUserPoints);

		const orderedUsers = sortedUserPoints
			.map((point) => userOrder.find((user) => user.userId === point.userId))
			.filter((user): user is { userId: number; fullName: string } => user !== undefined);

		console.log(`Week ${week}: Final ordered users:`, orderedUsers);
		return buildFullPickOrder(orderedUsers);
	}

	// If no points found in the prior week, use a random order (shouldn't happen if week is complete)
	console.log(`No points found for completed week ${priorWeek}, using random order for week ${week}`);
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
	// Logic: Stay on a week until Wednesday morning after all its games are complete
	const currentDate = new Date();
	const currentDay = currentDate.getDay(); // 0=Sunday, 1=Monday, ... 3=Wednesday
	const currentHour = currentDate.getHours();
	
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

		// If this week has any incomplete games, it's definitely the current week
		const hasIncompleteGames = weekGames.some(game => !game.isComplete);
		if (hasIncompleteGames) {
			console.log(`Current week determined to be: ${week} (incomplete games)`);
			return week;
		}

		// If this week has games but they're all complete, check if we should advance
		// Only advance to next week on Wednesday morning (after 6 AM) or later in the week
		const latestGameDate = new Date(Math.max(...weekGames.map(g => new Date(g.gameDate).getTime())));
		const daysSinceLatestGame = (currentDate.getTime() - latestGameDate.getTime()) / (1000 * 60 * 60 * 24);
		
		// If games finished recently, check if it's Wednesday morning or later
		if (daysSinceLatestGame >= 0) {
			// Find the next Wednesday at 6 AM after the latest game
			const nextWednesday = new Date(latestGameDate);
			const daysUntilWednesday = (3 - nextWednesday.getDay() + 7) % 7; // Days until next Wednesday
			if (daysUntilWednesday === 0 && nextWednesday.getDay() === 3) {
				// Latest game was on Wednesday, advance to next Wednesday
				nextWednesday.setDate(nextWednesday.getDate() + 7);
			} else {
				nextWednesday.setDate(nextWednesday.getDate() + daysUntilWednesday);
			}
			nextWednesday.setHours(6, 0, 0, 0); // 6 AM Wednesday
			
			// If we haven't reached the transition point, stay on this week
			if (currentDate < nextWednesday) {
				console.log(`Current week determined to be: ${week} (waiting for Wednesday transition)`);
				return week;
			}
		}
	}

	// Fallback: return week 1 if no current week found
	console.log(`No current week found, defaulting to week 1`);
	return 1;
};

export const getPicksWithGameInfo = (week: number) => {
	// Get picks with team information and game details
	// Use a simpler approach without the complex joins for now
	const picksResult = db
		.select({
			id: picks.id,
			userId: picks.userId,
			fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
			teamId: picks.teamId,
			team: teams.name,
			round: picks.round,
			orderInRound: picks.orderInRound,
			overallPickOrder: picks.overallPickOrder,
			points: picks.points
		})
		.from(picks)
		.innerJoin(users, eq(picks.userId, users.id))
		.leftJoin(teams, eq(picks.teamId, teams.teamId))
		.where(eq(picks.week, week))
		.all();

	// Get game info separately for each pick
	const picksWithGameInfo = picksResult.map(pick => {
		// Defensive check for pick object
		if (!pick || typeof pick !== 'object') {
			console.error('Invalid pick object:', pick);
			return null;
		}

		// Create base pick object with safe defaults
		const basePick = {
			id: pick.id || 0,
			userId: pick.userId || '',
			fullName: pick.fullName || '',
			teamId: pick.teamId || null,
			team: pick.team || '',
			assignedById: pick.assignedById || null,
			assignedByFullName: pick.assignedByFullName || null,
			round: pick.round || 0,
			orderInRound: pick.orderInRound || 0,
			overallPickOrder: pick.overallPickOrder || 0,
			week: pick.week || 0,
			points: pick.points || 0
		};

		if (!basePick.teamId) {
			return {
				...basePick,
				gameDate: null,
				isLive: false,
				isComplete: false,
				homeScore: null,
				awayScore: null,
				homeTeamName: null,
				awayTeamName: null
			};
		}

		const gameInfo = db
			.select({
				gameDate: schedules.gameDate,
				eventId: schedules.eventId,
				isLive: liveScores.isLive,
				isComplete: liveScores.isComplete,
				homeScore: liveScores.homeScore,
				awayScore: liveScores.awayScore,
				homeTeamId: schedules.homeTeamId,
				awayTeamId: schedules.awayTeamId
			})
			.from(schedules)
			.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
			.where(and(
				eq(schedules.week, week),
				or(
					eq(schedules.homeTeamId, basePick.teamId),
					eq(schedules.awayTeamId, basePick.teamId)
				)
			))
			.get();

		if (!gameInfo) {
			return {
				...basePick,
				gameDate: null,
				isLive: false,
				isComplete: false,
				homeScore: null,
				awayScore: null,
				homeTeamName: null,
				awayTeamName: null
			};
		}

		// Get team names for the game
		let homeTeam = null;
		let awayTeam = null;
		
		if (gameInfo.homeTeamId) {
			homeTeam = db.select({ name: teams.name }).from(teams).where(eq(teams.teamId, gameInfo.homeTeamId)).get();
		}
		if (gameInfo.awayTeamId) {
			awayTeam = db.select({ name: teams.name }).from(teams).where(eq(teams.teamId, gameInfo.awayTeamId)).get();
		}

		return {
			...basePick,
			gameDate: gameInfo.gameDate,
			eventId: gameInfo.eventId,
			isLive: gameInfo.isLive || false,
			isComplete: gameInfo.isComplete || false,
			homeScore: gameInfo.homeScore,
			awayScore: gameInfo.awayScore,
			homeTeamId: gameInfo.homeTeamId,
			awayTeamId: gameInfo.awayTeamId,
			homeTeamName: homeTeam?.name || null,
			awayTeamName: awayTeam?.name || null
		};
	}).filter(pick => pick !== null);

	return picksWithGameInfo;
};

// ===== SIMULATION FUNCTIONS =====

/**
 * Get pick history for all users up to a given week
 * Returns a map of userId -> teamId -> count
 */
export const getUserPickHistory = (upToWeek: number) => {
	const historicalPicks = db
		.select({
			userId: picks.userId,
			teamId: picks.teamId
		})
		.from(picks)
		.where(and(
			sql`${picks.week} < ${upToWeek}`,
			sql`${picks.teamId} IS NOT NULL`
		))
		.all();

	const history: Record<string, Record<number, number>> = {};

	for (const pick of historicalPicks) {
		if (!pick.teamId) continue;

		const userIdKey = String(pick.userId);
		if (!history[userIdKey]) {
			history[userIdKey] = {};
		}
		if (!history[userIdKey][pick.teamId]) {
			history[userIdKey][pick.teamId] = 0;
		}
		history[userIdKey][pick.teamId]++;
	}

	console.log(`Pick history loaded for weeks 1-${upToWeek - 1}`);
	return history;
};

/**
 * Calculate weighted team selection based on pick history and expected points
 * Teams picked more frequently get higher weights (showing user affinity)
 *
 * @param userId - The user making the selection
 * @param availableTeamIds - Available teams to choose from
 * @param pickHistory - Historical pick data for affinity
 * @param teamPoints - Expected points for each team this week
 * @param maximizePoints - If true, favor high-scoring teams (picks). If false, favor low-scoring teams (sticks)
 */
export const calculateTeamWeights = (
	userId: string,
	availableTeamIds: number[],
	pickHistory: Record<string, Record<number, number>>,
	teamPoints: Record<number, number>,
	maximizePoints: boolean = true
) => {
	const userHistory = pickHistory[userId] || {};

	// Find min and max points for normalization
	const allPoints = availableTeamIds.map(id => teamPoints[id] || 0);
	const minPoints = Math.min(...allPoints, 0);
	const maxPoints = Math.max(...allPoints, 0);
	const pointsRange = maxPoints - minPoints;

	// Find max pick count for normalization
	const allPickCounts = availableTeamIds.map(id => userHistory[id] || 0);
	const maxPickCount = Math.max(...allPickCounts, 0);

	const weights = availableTeamIds.map(teamId => {
		const pickCount = userHistory[teamId] || 0;
		const points = teamPoints[teamId] || 0;

		// Normalize points component (0-1 scale)
		let pointsScore: number;
		if (pointsRange > 0) {
			const normalizedPoints = (points - minPoints) / pointsRange;
			// For picks: higher points = higher score
			// For sticks: lower points = higher score (invert)
			pointsScore = maximizePoints ? normalizedPoints : (1 - normalizedPoints);
		} else {
			// All teams have same points
			pointsScore = 0.5;
		}

		// Normalize affinity component (0-1 scale)
		// Add small baseline so teams never picked before still have some chance
		let affinityScore: number;
		if (maxPickCount > 0) {
			affinityScore = pickCount / maxPickCount;
		} else {
			// No one has picked any of these teams before
			affinityScore = 0;
		}

		// Combined weight: 75% points, 25% affinity
		// Add small baseline (0.1) to ensure all teams have non-zero weight
		const weight = 0.1 + (0.75 * pointsScore) + (0.25 * affinityScore);

		return { teamId, weight, pickCount, points };
	});

	// Sort by weight descending
	weights.sort((a, b) => b.weight - a.weight);

	return weights;
};

/**
 * Calculate expected points for each team based on historical averages from prior weeks
 * This is used for simulation to avoid using current week's actual scores
 */
export const getExpectedTeamPoints = (week: number): Record<number, number> => {
	// Get historical scores from all weeks BEFORE the target week
	const historicalHomeScores = db
		.select({
			teamId: schedules.homeTeamId,
			points: sql<number>`COALESCE(${liveScores.homeScore}, ${schedules.homeScore}, 0)`
		})
		.from(schedules)
		.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
		.where(sql`${schedules.week} < ${week}`)
		.all();

	const historicalAwayScores = db
		.select({
			teamId: schedules.awayTeamId,
			points: sql<number>`COALESCE(${liveScores.awayScore}, ${schedules.awayScore}, 0)`
		})
		.from(schedules)
		.leftJoin(liveScores, eq(schedules.eventId, liveScores.eventId))
		.where(sql`${schedules.week} < ${week}`)
		.all();

	const allHistoricalScores = [...historicalHomeScores, ...historicalAwayScores];

	// Calculate average points per team
	const teamTotals: Record<number, { total: number; count: number }> = {};

	for (const score of allHistoricalScores) {
		if (!teamTotals[score.teamId]) {
			teamTotals[score.teamId] = { total: 0, count: 0 };
		}
		teamTotals[score.teamId].total += score.points;
		teamTotals[score.teamId].count += 1;
	}

	// Calculate averages and round to nearest integer
	const expectedPoints: Record<number, number> = {};
	for (const [teamId, { total, count }] of Object.entries(teamTotals)) {
		expectedPoints[Number(teamId)] = count > 0 ? Math.round(total / count) : 0;
	}

	console.log(`Calculated expected points for week ${week} based on ${allHistoricalScores.length} historical games`);

	return expectedPoints;
};

/**
 * Select a team for a user using weighted random selection
 * Higher weights = higher probability of selection
 */
export const selectWeightedTeam = (
	weights: Array<{ teamId: number; weight: number; pickCount: number; points: number }>
): number => {
	if (weights.length === 0) {
		throw new Error('No teams available for selection');
	}

	const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
	let random = Math.random() * totalWeight;

	for (const { teamId, weight } of weights) {
		random -= weight;
		if (random <= 0) {
			return teamId;
		}
	}

	// Fallback to first team (should never happen)
	return weights[0].teamId;
};

/**
 * Simulate picks for a week where no picks were made
 * Returns simulated pick data structure matching the real picks format
 */
export const simulateWeekPicks = (week: number) => {
	console.log(`Starting simulation for week ${week}`);

	// Check if picks with actual team selections already exist for this week
	// Draft order entries (picks with NULL team_id) are allowed
	const existingPicks = db
		.select({ id: picks.id })
		.from(picks)
		.where(and(
			eq(picks.week, week),
			sql`${picks.teamId} IS NOT NULL`
		))
		.limit(1)
		.get();

	if (existingPicks) {
		throw new Error(`Cannot simulate week ${week}: picks already exist for this week`);
	}

	// Get pick history up to this week
	const pickHistory = getUserPickHistory(week);

	// Get expected points based on historical averages from prior weeks
	// DO NOT use actual scores from the current week
	const teamPoints = getExpectedTeamPoints(week);

	// Get all teams playing this week
	const weekGames = db
		.select({
			homeTeamId: schedules.homeTeamId,
			awayTeamId: schedules.awayTeamId
		})
		.from(schedules)
		.where(eq(schedules.week, week))
		.all();

	const allTeamIds = new Set<number>();
	for (const game of weekGames) {
		allTeamIds.add(game.homeTeamId);
		allTeamIds.add(game.awayTeamId);
	}

	// Get pick order for this week
	let pickOrder: Array<{ userId: number; fullName: string; round: number; assignedById: number | null; orderInRound: number }>;
	try {
		pickOrder = getPickOrderForWeek(week);
	} catch (error) {
		console.error(`Could not get pick order for week ${week}:`, error);
		throw new Error(`Cannot simulate week ${week}: unable to determine pick order. Previous week may not be complete.`);
	}

	// Build a map of userId to fullName for quick lookups
	const userIdToName = new Map<number, string>();
	for (const pick of pickOrder) {
		userIdToName.set(pick.userId, pick.fullName);
	}

	const selectedTeamIds = new Set<number>();
	const simulatedPicks: Array<{
		userId: number;
		fullName: string;
		teamId: number;
		teamName: string;
		round: number;
		orderInRound: number;
		assignedById: number | null;
		assignedByFullName: string | null;
		points: number;
		reasoning: string;
		pickCount: number;
	}> = [];

	// Simulate each pick
	for (const pickSlot of pickOrder) {
		const availableTeamIds = Array.from(allTeamIds).filter(id => !selectedTeamIds.has(id));

		if (availableTeamIds.length === 0) {
			console.error(`No teams available for pick ${pickSlot.orderInRound} in round ${pickSlot.round}`);
			break;
		}

		// Determine if this is a pick (rounds 1-2) or stick (rounds 3-4)
		const isPick = pickSlot.round <= 2;
		const isStick = pickSlot.round >= 3;

		// For picks (rounds 1-2): user selects for themselves, wants HIGH points
		// For sticks (rounds 3-4): assignedBy selects for victim, wants LOW points
		const selectingUserId = isStick && pickSlot.assignedById
			? String(pickSlot.assignedById)
			: String(pickSlot.userId);

		// Calculate weights
		const weights = calculateTeamWeights(
			selectingUserId,
			availableTeamIds,
			pickHistory,
			teamPoints,
			isPick // maximize points for picks, minimize for sticks
		);

		// Select a team
		const selectedTeamId = selectWeightedTeam(weights);
		selectedTeamIds.add(selectedTeamId);

		// Get team name
		const teamInfo = db
			.select({ name: teams.name })
			.from(teams)
			.where(eq(teams.teamId, selectedTeamId))
			.get();

		// Generate reasoning for this pick
		const selectedWeight = weights.find(w => w.teamId === selectedTeamId);
		const points = selectedWeight?.points || 0;

		// For reasoning about pick history, use the victim's history (the person getting the team)
		const victimHistory = pickHistory[String(pickSlot.userId)] || {};
		const pickCount = victimHistory[selectedTeamId] || 0;

		// Determine reasoning based on pick history and score
		// Note: points here are expected points based on historical averages
		let reasoning = '';
		if (isStick) {
			// For sticks: emphasize LOW points are the goal
			if (pickCount === 0) {
				reasoning = `Never picked before • ~${points} avg pts (low)`;
			} else {
				const timesText = pickCount === 1 ? 'once' : `${pickCount} times`;
				reasoning = `Picked ${timesText} previously • ~${points} avg pts (low)`;
			}
		} else {
			// For picks: emphasize HIGH points are the goal
			if (pickCount === 0) {
				reasoning = `Never picked before • ~${points} avg pts`;
			} else {
				const timesText = pickCount === 1 ? 'once' : `${pickCount} times`;
				reasoning = `Picked ${timesText} previously • ~${points} avg pts`;
			}
		}

		// Add context about why this was a good choice
		const topWeights = weights.slice(0, 3);
		const rank = topWeights.findIndex(w => w.teamId === selectedTeamId);
		if (rank === 0) {
			reasoning += isStick ? ' • Worst team available' : ' • Best weighted option';
		} else if (rank >= 0) {
			const suffix = rank === 0 ? 'st' : rank === 1 ? 'nd' : 'rd';
			reasoning += isStick
				? ` • ${rank + 1}${suffix} worst option`
				: ` • ${rank + 1}${suffix} best option`;
		}

		simulatedPicks.push({
			userId: pickSlot.userId,
			fullName: pickSlot.fullName,
			teamId: selectedTeamId,
			teamName: teamInfo?.name || 'Unknown',
			round: pickSlot.round,
			orderInRound: pickSlot.orderInRound,
			assignedById: pickSlot.assignedById,
			assignedByFullName: pickSlot.assignedById ? userIdToName.get(pickSlot.assignedById) || null : null,
			points: teamPoints[selectedTeamId] || 0,
			reasoning: reasoning,
			pickCount: pickCount
		});
	}

	console.log(`Simulation complete: ${simulatedPicks.length} picks generated`);

	// Save simulated picks to database
	console.log(`Saving ${simulatedPicks.length} simulated picks to database...`);

	// First, delete any existing draft order entries for this week
	db.delete(picks).where(eq(picks.week, week)).run();

	// Insert the simulated picks
	const picksToInsert = simulatedPicks.map(pick => ({
		week: week,
		round: pick.round,
		userId: String(pick.userId),
		teamId: pick.teamId,
		orderInRound: pick.orderInRound,
		assignedById: pick.assignedById ? String(pick.assignedById) : null,
		reasoning: pick.reasoning
	}));

	db.insert(picks).values(picksToInsert).run();

	// Mark the week as simulated
	const now = new Date();
	db.insert(weeks)
		.values({
			weekNumber: week,
			isSimulated: true,
			isDraftLocked: true,
			createdAt: now,
			updatedAt: now
		})
		.onConflictDoUpdate({
			target: weeks.weekNumber,
			set: {
				isSimulated: true,
				isDraftLocked: true,
				updatedAt: now
			}
		})
		.run();

	console.log(`✅ Week ${week} simulated and saved to database`);

	return simulatedPicks;
};

/**
 * Calculate results from simulated picks
 * Returns user totals and winner
 */
export const getSimulatedResults = (
	simulatedPicks: Array<{
		userId: number;
		fullName: string;
		teamId: number;
		teamName: string;
		round: number;
		orderInRound: number;
		assignedById: number | null;
		points: number;
		reasoning: string;
		pickCount: number;
	}>
) => {
	const userTotals: Record<string, { fullName: string; totalPoints: number; picks: typeof simulatedPicks }> = {};

	for (const pick of simulatedPicks) {
		const userIdKey = String(pick.userId);
		if (!userTotals[userIdKey]) {
			userTotals[userIdKey] = {
				fullName: pick.fullName,
				totalPoints: 0,
				picks: []
			};
		}
		userTotals[userIdKey].totalPoints += pick.points;
		userTotals[userIdKey].picks.push(pick);
	}

	const sortedUsers = Object.entries(userTotals)
		.map(([userId, data]) => ({
			userId,
			fullName: data.fullName,
			totalPoints: data.totalPoints,
			picks: data.picks
		}))
		.sort((a, b) => b.totalPoints - a.totalPoints);

	const winner = sortedUsers.length > 0 ? sortedUsers[0] : null;

	return {
		users: sortedUsers,
		winner
	};
};
