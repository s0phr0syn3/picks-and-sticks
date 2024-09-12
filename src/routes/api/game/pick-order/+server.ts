import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { schedules } from '$lib/server/models'
import { determinePickOrder } from '$lib/server/picks'

export const GET: RequestHandler = async () => {
  try {
    console.log(`Determining pick orders for all weeks...`)
    const weeks = db.select({week: schedules.week}).from(schedules).groupBy(schedules.week).orderBy(schedules.week).all().map(x => x.week)
    const weekOrders = []
    for (const week of weeks) {
      const order = await determinePickOrder(week)
      for (let round = 1; round <= 4; round++) {
        if (round % 2) {
          weekOrders.push({
            week: week,
            round: round,
            order: [...order]
          })
        } else {
          weekOrders.push({
            week: week,
            round: round,
            order: [...order].reverse()
          })
        }
      }
    }
    console.log(`Week orders generated successfully.`)
    return new Response(JSON.stringify({
      message: `Week orders generated successfully.`,
      data: weekOrders
    }), { status: 200, headers: { 'Content-Type': 'application/json' }})
  } catch (error: any) {
    console.error(`Failed to generate order for all weeks: `, error)
    return new Response(JSON.stringify({
      error: `Failed to generate order for all weeks.`,
      details: error.message || error.toString()
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}