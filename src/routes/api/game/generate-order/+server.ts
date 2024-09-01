import type { RequestHandler } from './$types'
import { determinePickOrder } from '$lib/picks'
import { db } from '$lib/db';
import { weekSchedules } from '$lib/models';

export const GET: RequestHandler = async () => {
  try {
    console.log(`Determining pick orders for all weeks...`)
    const weeks = db.select({week: weekSchedules.week}).from(weekSchedules).groupBy(weekSchedules.week).orderBy(weekSchedules.week).all().map(x => x.week)
    const weekOrders = []
    for (const week of weeks) {
      weekOrders.push({
        week: week,
        order: await determinePickOrder(week)
      })
    }

    return new Response(JSON.stringify({
      message: `Order generated for all weeks.`,
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