import type { RequestHandler } from './$types'
import { getPickOrderForWeek, getPicksForWeek, getTotalPointsForWeekByUser } from '$lib/server/queries'

export const GET: RequestHandler = async ({ params }) => {
  const week = parseInt(params.week, 10)

  if (isNaN(week)) {
    return new Response(JSON.stringify({ error: `Invalid week: ${week.toString()}` }), { status: 400 })
  }

  const picksForWeek = getPicksForWeek(week)
  const totalPoints = getTotalPointsForWeekByUser(week)

  if (picksForWeek.length > 0) {
    return new Response(
      JSON.stringify({
        picks: picksForWeek,
        totalPoints,
        week,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json'} }
    )
  }

  const pickOrder = getPickOrderForWeek(week)

  return new Response(
    JSON.stringify({
      draftState: pickOrder,
      totalPoints: totalPoints,
      week,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}