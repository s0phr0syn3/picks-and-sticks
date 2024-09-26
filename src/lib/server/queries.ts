import { eq, and, sql, inArray, aliasedTable } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { picks, schedules, teams, users } from '$lib/server/models'
import { randomSort } from '$lib/utils'

const getRandomUserOrder = () => {
  const allUsers = db.select({
    userId: users.id,
    fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName} as fullName`,
  }).from(users).all()
  return randomSort(allUsers)
}

export const getAvailableTeams = (week: number, selectedTeams: Set<number>) => {
  const weekTeams = db
    .select({
      homeTeamId: schedules.homeTeamId,
      awayTeamId: schedules.awayTeamId,
    })
    .from(schedules)
    .where(eq(schedules.week, week))
    .all()

  const teamIds: Array<number> = weekTeams.reduce((ids: Array<number>, game) => {
    ids.push(game.homeTeamId, game.awayTeamId)
    return ids
  }, [])

  return db
    .select({
      id: teams.teamId,
      name: teams.name,
    })
    .from(teams)
    .where(
      and(
        sql`${teams.teamId} IN (${teamIds.join(',')})`,
        sql`${teams.teamId} NOT IN (${[...selectedTeams].join(',')})`
      )
    )
    .all()
}

export const getTeamScores = (week: number) => {
  const homeScores = db
    .select({
      week: schedules.week,
      teamId: schedules.homeTeamId,
      points: schedules.homeScore,
    })
    .from(schedules)
    .where(eq(schedules.week, week))
    .all()
  const awayScores = db
    .select({
      week: schedules.week,
      teamId: schedules.awayTeamId,
      points: schedules.awayScore,
    })
    .from(schedules)
    .where(eq(schedules.week, week))
    .all()

  return [...homeScores, ...awayScores]
}

export const getPicksForWeek = (week: number) => {
  const teamScores = getTeamScores(week)

  const assignedBy = aliasedTable(users, 'assignedBy')
  const picksForWeek = db
    .select({
      userId: picks.userId,
      fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName} AS fullName`,
      teamId: picks.teamId,
      team: teams.name,
      assignedById: assignedBy.id,
      assignedByFullName: sql<string>`${assignedBy.firstName} || ' ' || ${assignedBy.lastName} AS fullName`,
      round: picks.round,
      overallPickOrder: sql`(5 * ${picks.round}) + ${picks.orderInRound} - 5`,
      week: picks.week,
    })
    .from(picks)
    .leftJoin(users, eq(picks.userId, users.id))
    .leftJoin(teams, eq(picks.teamId, teams.teamId))
    .leftJoin(assignedBy, eq(picks.assignedById, assignedBy.id))
    .where(eq(picks.week, week))
    .all()

  return picksForWeek.map(pick => {
    const teamScore = teamScores.find(score => score.teamId === pick.teamId)
    return {
      ...pick,
      points: teamScore && teamScore.points !== null ? teamScore.points : 0,
    }
  })
}

export const getTotalPointsForWeekByUser = (week: number) => {
  const picksForWeek = getPicksForWeek(week)

  const userPoints: Record<number, { fullName: string, totalPoints: number }> = {}

  picksForWeek.forEach(pick => {
    if (userPoints[pick.userId]) {
      userPoints[pick.userId].totalPoints += pick.points
    } else {
      userPoints[pick.userId] = {
        fullName: pick.fullName,
        totalPoints: pick.points
      }
    }
  })

  return Object.entries(userPoints).map(([userId, { fullName, totalPoints }]) => ({
    userId: parseInt(userId, 10),
    fullName,
    totalPoints,
  })).sort((a, b) => b.totalPoints - a.totalPoints)
}

export const getPickOrderForWeek = (week: number) => {
  // Week 1 has no prior week so randomize the pick order
  if (week === 1) {
    return getRandomUserOrder()
  }

  let priorWeek = week - 1

  while (priorWeek > 0) {
    const userPoints = getTotalPointsForWeekByUser(priorWeek)

    if (userPoints.length > 0) {
      const userIds = userPoints.map(user => user.userId)
      const userOrder = db
        .select({
          userId: users.id,
          fullName: sql<string>`${users.firstName} || ' ' || ${users.lastName} AS fullName`
        })
        .from(users)
        .where(inArray(users.id, userIds))
        .all()

      return userPoints
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .map(point => userOrder.find(user => user.userId === point.userId))
    }

    // If no results in the prior week, look back to the week before that and try again
    priorWeek--
  }

  // No results found in any prior week, use a random order
  return getRandomUserOrder()
}