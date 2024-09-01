import type { RequestHandler } from './$types'
import { scrapeTeams } from '$lib/scraper'

export const GET: RequestHandler = async () => {
  try {
    await scrapeTeams()
    return new Response(JSON.stringify({ message: 'Teams scraped and inserted successfully.' }), { status: 200 })
  } catch (error) {
    console.error('Failed to scrape teams: ', error)
    return new Response(JSON.stringify({ error: 'Failed to scrape teams.' }), { status: 500 })
  }
}