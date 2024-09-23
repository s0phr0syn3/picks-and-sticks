import { eq, and, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { picks, schedules, teams } from '$lib/server/models';

export const getTeamScores = async (week: number) => {
  const homeScores = await db
    .select({
      week: schedules.week,
      teamId: schedules.homeTeamId,
      points: schedules.homeScore,
    })
    .from(schedules)
    .where(eq(schedules.week, week))
  const awayScores = await db
    .select({
      week: schedules.week,
      teamId: schedules.awayTeamId,
      points: schedules.awayScore,
    })
    .from(schedules)
    .where(eq(schedules.week, week))

  return [...homeScores, ...awayScores]
}

export const getPickPointsForWeek = async (week: number) => {
  const teamScores = await getTeamScores(week)

  const picksForWeek = await db
    .select({
      userId: picks.userId,
      teamId: picks.teamId,
    })
    .from(picks)
    .where(eq(picks.week, week))

  return picksForWeek.map(pick => {
    const teamScore = teamScores.find(score => score.teamId === pick.teamId)
    return {
      ...pick,
      points: teamScore ? teamScore.points : 0,
    }
  })
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

  const teamIds: Array<number> = weekTeams.reduce((ids, game) => {
    ids.push(game.homeTeamId, game.awayTeamId)
    return ids
  }, [])

  const availableTeamDetails = db
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