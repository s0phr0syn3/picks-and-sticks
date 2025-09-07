import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { schedules } from '$lib/server/models';
import { successResponse, failureResponse } from '$lib/utils';
import { sql } from 'drizzle-orm';

// Map ESPN team abbreviations to our team IDs
const TEAM_ABBR_TO_ID: { [key: string]: number } = {
	'BUF': 1, 'MIA': 2, 'NE': 3, 'NYJ': 4,
	'BAL': 5, 'CIN': 6, 'CLE': 7, 'PIT': 8,
	'HOU': 9, 'IND': 10, 'JAX': 11, 'TEN': 12,
	'DEN': 13, 'KC': 14, 'LAC': 15, 'LV': 16,
	'DAL': 17, 'NYG': 18, 'PHI': 19, 'WSH': 20,
	'CHI': 21, 'DET': 22, 'GB': 23, 'MIN': 24,
	'ATL': 25, 'CAR': 26, 'NO': 27, 'TB': 28,
	'ARI': 29, 'LAR': 30, 'SF': 31, 'SEA': 32
};

// Map full team names to IDs as fallback
const TEAM_NAME_TO_ID: { [key: string]: number } = {
	'Buffalo Bills': 1, 'Miami Dolphins': 2, 'New England Patriots': 3, 'New York Jets': 4,
	'Baltimore Ravens': 5, 'Cincinnati Bengals': 6, 'Cleveland Browns': 7, 'Pittsburgh Steelers': 8,
	'Houston Texans': 9, 'Indianapolis Colts': 10, 'Jacksonville Jaguars': 11, 'Tennessee Titans': 12,
	'Denver Broncos': 13, 'Kansas City Chiefs': 14, 'Los Angeles Chargers': 15, 'Las Vegas Raiders': 16,
	'Dallas Cowboys': 17, 'New York Giants': 18, 'Philadelphia Eagles': 19, 'Washington Commanders': 20,
	'Chicago Bears': 21, 'Detroit Lions': 22, 'Green Bay Packers': 23, 'Minnesota Vikings': 24,
	'Atlanta Falcons': 25, 'Carolina Panthers': 26, 'New Orleans Saints': 27, 'Tampa Bay Buccaneers': 28,
	'Arizona Cardinals': 29, 'Los Angeles Rams': 30, 'San Francisco 49ers': 31, 'Seattle Seahawks': 32
};

export const GET: RequestHandler = async ({ url }) => {
	const clearExisting = url.searchParams.get('clear') === 'true';
	
	try {
		// Use current year as default, or allow override via environment variable
		const currentYear = new Date().getFullYear();
		const year = parseInt(process.env.SEASON_YEAR || currentYear.toString());
		
		console.log(`Fetching NFL schedule for ${year} season from ESPN...`);
		
		// Optionally clear existing schedules
		if (clearExisting) {
			await db.run(sql`DELETE FROM schedules`);
			console.log('Cleared existing schedules');
		}
		
		const allGames: any[] = [];
		let totalGamesProcessed = 0;
		
		// Fetch schedule for all 18 weeks of regular season
		for (let week = 1; week <= 18; week++) {
			console.log(`Fetching week ${week}...`);
			const apiUrl = `https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${year}`;
			
			try {
				const response = await fetch(apiUrl);
				
				if (!response.ok) {
					console.error(`Failed to fetch week ${week}: ${response.status} ${response.statusText}`);
					continue;
				}
				
				const data = await response.json();
				
				if (!data.events || data.events.length === 0) {
					console.log(`No games found for week ${week}`);
					continue;
				}
				
				for (const event of data.events) {
					const competition = event.competitions[0];
					const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
					const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
					
					if (!homeTeam || !awayTeam) {
						console.warn(`Missing team data for event ${event.id}`);
						continue;
					}
					
					// Try to get team ID by abbreviation first, then by full name
					let homeTeamId = TEAM_ABBR_TO_ID[homeTeam.team.abbreviation];
					let awayTeamId = TEAM_ABBR_TO_ID[awayTeam.team.abbreviation];
					
					if (!homeTeamId) {
						homeTeamId = TEAM_NAME_TO_ID[homeTeam.team.displayName];
					}
					if (!awayTeamId) {
						awayTeamId = TEAM_NAME_TO_ID[awayTeam.team.displayName];
					}
					
					if (!homeTeamId || !awayTeamId) {
						console.warn(`Could not map teams: ${homeTeam.team.displayName} (${homeTeam.team.abbreviation}) vs ${awayTeam.team.displayName} (${awayTeam.team.abbreviation})`);
						continue;
					}
					
					const gameData = {
						eventId: parseInt(event.id),
						week: week,
						gameDate: event.date,
						homeTeamId: homeTeamId,
						awayTeamId: awayTeamId,
						homeScore: parseInt(homeTeam.score || '0'),
						awayScore: parseInt(awayTeam.score || '0'),
						spread: competition.odds?.[0]?.details ? parseFloat(competition.odds[0].details.split(' ')[1]) : null,
						overUnder: competition.odds?.[0]?.overUnder || null
					};
					
					allGames.push(gameData);
					totalGamesProcessed++;
				}
				
				console.log(`Processed ${data.events.length} games for week ${week}`);
			} catch (weekError) {
				console.error(`Error processing week ${week}:`, weekError);
				continue;
			}
		}
		
		console.log(`Total games to insert/update: ${allGames.length}`);
		
		// Insert or update all games
		let successCount = 0;
		let errorCount = 0;
		
		for (const game of allGames) {
			try {
				await db
					.insert(schedules)
					.values(game)
					.onConflictDoUpdate({
						target: schedules.eventId,
						set: { 
							week: game.week,
							gameDate: game.gameDate,
							homeTeamId: game.homeTeamId,
							awayTeamId: game.awayTeamId,
							homeScore: game.homeScore, 
							awayScore: game.awayScore,
							spread: game.spread,
							overUnder: game.overUnder
						}
					});
				successCount++;
			} catch (gameError) {
				console.error(`Error inserting game ${game.eventId}:`, gameError);
				errorCount++;
			}
		}
		
		const message = `Successfully updated ${successCount} games for ${year} season from ESPN API.${errorCount > 0 ? ` (${errorCount} errors)` : ''}`;
		console.log(message);
		
		return successResponse({
			year,
			totalGames: allGames.length,
			successCount,
			errorCount,
			games: allGames
		}, message);
	} catch (error) {
		console.error('Error fetching ESPN schedule:', error);
		return failureResponse(error, 'Failed to retrieve or save schedules from ESPN.');
	}
};