import type { RequestHandler } from './$types'
import { determinePickOrder } from '$lib/picks'

export const GET: RequestHandler = async ({ params }) => {
  const { week } = params

  try {
    console.log(`Determining pick order for week ${week}...`)
    const order = await determinePickOrder(parseInt(week, 10))

    return new Response(JSON.stringify({
      message: `Order generated for week ${week}.`,
      data: {
        week: week,
        order: order,
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' }})
  } catch (error: any) {
    console.error(`Failed to generate order for week ${week}: `, error)
    return new Response(JSON.stringify({
      error: `Failed to generate order for week ${week}.`,
      details: error.message || error.toString()
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}