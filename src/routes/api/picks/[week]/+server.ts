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
        totalPoints: totalPoints,
        week,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json'} }
    )
  }

  // no picks exist for week
  const pickOrder = getPickOrderForWeek(week)
  const fullPickOrder = [...pickOrder, ...pickOrder.reverse(), ...pickOrder, ...pickOrder.reverse()]

  const response = fullPickOrder.map((user, index) => ({
    userId: user.userId,
    fullName: user.fullName,
    teamId: null,
    team: null,
    round: index < 5 ? 1 : 2,
    overallPickOrder: index + 1,
    week: week,
    points: null,
  }))

  return new Response(
    JSON.stringify({
      picks: response,
      totalPoints: totalPoints,
      week,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}