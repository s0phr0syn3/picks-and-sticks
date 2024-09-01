import type { RequestHandler } from './$types'
import { randomizeFirstWeekOrder } from '$lib/picks'

export const GET: RequestHandler = async () => {
  try {
    console.log(`Randomizing pick order for first week...`)
    const firstWeekOrder = await randomizeFirstWeekOrder()

    return new Response(JSON.stringify({
      message: `First week order randomized successfully.`,
      data: {
        order: firstWeekOrder,
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' }})
  } catch (error: any) {
    console.error('Failed to randomize pick order: ', error)
    return new Response(JSON.stringify({
      error: 'Failed to randomize pick order.',
      details: error.message || error.toString()
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}