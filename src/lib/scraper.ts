import axios from 'axios'
import * as cheerio from 'cheerio'
import crypto from 'crypto'
import { db } from '$lib/db'
import { teams, weekSchedules } from '$lib/models'
import { sql } from 'drizzle-orm';

function generateHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function convertDate(dateString: string, year: number): string {
  const date = new Date(`${dateString}, ${year.toString()}`)
  return date.toISOString().split('T')[0]
}

export async function scrapeTeams() {
  const url = 'https://www.pro-football-reference.com/teams'
  const response = await axios.get(url)
  const html = response.data
  const $ = cheerio.load(html)

  const teamData: {
    name: string
    teamId: string
  }[] = []

  $('#teams_active tbody tr').each((i, elem) => {
    const name = $(elem).find('th[data-stat="team_name"] a').text().trim()
    const teamId = generateHash(name)

    if (name && teamId) {
      teamData.push({
        name: name,
        teamId: teamId
      })
    }
  })

  for (const team of teamData) {
    await db.insert(teams).values(team).onConflictDoNothing()
  }

  console.log(`Inserted ${teamData.length} teams into the database.`)
}

export async function scrapeSchedules(year: number) {
  const url = `https://www.pro-football-reference.com/years/${year.toString()}/games.htm`
  console.log(`Accessing ${url}...`)
  const response = await axios.get(url)
  console.log(`Got response: ${response.statusText}`)

  const html = response.data
  const $ = cheerio.load(html)

  const scheduleData: {
    gameId: string
    week: number
    gameDate: string
    gameTime: string
    homeTeamId: number
    awayTeamId: number
    homeScore: number
    awayScore: number
  }[] = []

  const promises = $('table#games tbody tr:not(.thead)').map(async (i, elem) => {
    const week = $(elem).find('th[data-stat="week_num"]').text().trim()
    const gameDateRaw = $(elem).find('td[data-stat="boxscore_word"]').text().trim()
    const gameDate = convertDate(gameDateRaw, year)
    const gameTime = $(elem).find('td[data-stat="gametime"]').text().trim()
    const homeTeam = $(elem).find('td[data-stat="home_team"] a').text().trim()
    const awayTeam = $(elem).find('td[data-stat="visitor_team"] a').text().trim()
    const gameId = generateHash(`${week}-${homeTeam}-${awayTeam}`)
    const homeScore = $(elem).find('td[data-stat="pts_win"] a').text().trim()
    const awayScore = $(elem).find('td[data-stat="pts_lose"] a').text().trim()

    const homeTeamId = await db.select({id: teams.id}).from(teams).where(sql`${teams.name} = ${homeTeam}`).limit(1).then(res => res[0]?.id)
    const awayTeamId = await db.select({id: teams.id}).from(teams).where(sql`${teams.name} = ${awayTeam}`).limit(1).then(res => res[0]?.id)

    if (parseInt(week, 10) && gameDate && homeTeamId && awayTeamId) {
      console.log(`Pushing game ID ${gameId}: Week ${week} on ${gameDate}, ${awayTeam} @ ${homeTeam}`)
      await db.insert(weekSchedules).values({
        gameId,
        week: parseInt(week, 10),
        gameDate,
        gameTime,
        homeTeamId,
        awayTeamId,
        homeScore: parseInt(homeScore, 10),
        awayScore: parseInt(awayScore, 10),
      }).onConflictDoUpdate({
        target: weekSchedules.gameId,
        set: {
          gameDate: gameDate,
          gameTime: gameTime,
          homeScore: parseInt(homeScore, 10),
          awayScore: parseInt(awayScore, 10),
        }
      })
    }
  }).get()

  await Promise.all(promises)

  console.log(`Inserted schedules into the database for the year ${year}.`)
}