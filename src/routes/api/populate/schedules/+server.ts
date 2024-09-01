import type { RequestHandler } from './$types'
import { scrapeSchedules } from '$lib/scraper'

export const GET: RequestHandler = async () => {
  const year: number = 2024
  try {
    console.log(`Scraping schedules for ${year}...`)
    await scrapeSchedules(year)
    return new Response(JSON.stringify({ message: 'Schedules scraped and inserted successfully.' }), { status: 200 })
  } catch (error) {
    console.error('Failed to scrape schedules: ', error)
    return new Response(JSON.stringify({ error: 'Failed to scrape schedules.' }), { status: 500 })
  }
}