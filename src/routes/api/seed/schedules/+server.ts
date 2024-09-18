import type { RequestHandler } from './$types'
import { prod as db } from '$lib/server/db'
import { schedules } from '$lib/server/models';
import { fetchNFLSchedule } from '$lib/api'
import { getWeekFromDate, successResponse, failureResponse } from '$lib/utils'

export const GET: RequestHandler = async () => {
  const year: number = 2024
  try {
    const scheduleList = await fetchNFLSchedule(year)

    const insertData = scheduleList.map(game => ({
      eventId: parseInt(game.idEvent, 10),
      week: getWeekFromDate(game.dateEvent),
      gameDate: game.dateEvent,
      homeTeamId: parseInt(game.idHomeTeam, 10),
      awayTeamId: parseInt(game.idAwayTeam, 10),
      homeScore: parseInt(game.intHomeScore, 10),
      awayScore: parseInt(game.intAwayScore, 10),
    }))

    for (const game of insertData) {
      await db.insert(schedules).values(game).onConflictDoUpdate({target: schedules.eventId, set: {homeScore: game.homeScore, awayScore: game.awayScore}})
    }

    return successResponse({
      data: insertData
    }, 'Schedules retrieved and saved successfully.')
  } catch (error: any) {
    return failureResponse(error, 'Failed to retrieve or save schedules.')
  }
}