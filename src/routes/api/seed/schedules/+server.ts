import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { schedules } from '$lib/server/models';
import { successResponse, failureResponse } from '$lib/utils';

// Team name to ID mapping (matches your existing database)
const TEAM_NAME_TO_ID: { [key: string]: number } = {
	'Dallas Cowboys': 134934,
	'Philadelphia Eagles': 134936,
	'New York Giants': 134935,
	'Washington Commanders': 134937,
	'Kansas City Chiefs': 134931,
	'Las Vegas Raiders': 134932,
	'Los Angeles Chargers': 135908,
	'Denver Broncos': 134930,
	'Buffalo Bills': 134919,
	'Miami Dolphins': 134920,
	'New York Jets': 134921,
	'New England Patriots': 134922,
	'Pittsburgh Steelers': 134925,
	'Baltimore Ravens': 134923,
	'Cleveland Browns': 134924,
	'Cincinnati Bengals': 134918,
	'Tennessee Titans': 134929,
	'Indianapolis Colts': 134926,
	'Houston Texans': 134927,
	'Jacksonville Jaguars': 134928,
	'Green Bay Packers': 134940,
	'Chicago Bears': 134938,
	'Minnesota Vikings': 134941,
	'Detroit Lions': 134939,
	'Tampa Bay Buccaneers': 134949,
	'Carolina Panthers': 134946,
	'Atlanta Falcons': 134945,
	'New Orleans Saints': 134948,
	'San Francisco 49ers': 134951,
	'Seattle Seahawks': 134952,
	'Los Angeles Rams': 135907,
	'Arizona Cardinals': 134942
};

export const GET: RequestHandler = async () => {
	try {
		// Use current year as default, or allow override via environment variable
		const currentYear = new Date().getFullYear();
		const year = parseInt(process.env.SEASON_YEAR || currentYear.toString());
		
		console.log(`Fetching NFL schedule for ${year} season...`);
		
		const allGames: any[] = [];
		
		// Fetch schedule for all 18 weeks of regular season
		for (let week = 1; week <= 18; week++) {
			const apiUrl = `https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${week}&seasontype=2&year=${year}`;
			const response = await fetch(apiUrl);
			
			if (!response.ok) {
				console.error(`Failed to fetch week ${week}: ${response.statusText}`);
				continue;
			}
			
			const data = await response.json();
			
			for (const event of data.events) {
				const homeTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
				const awayTeam = event.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
				
				const homeTeamName = homeTeam.team.displayName;
				const awayTeamName = awayTeam.team.displayName;
				
				const homeTeamId = TEAM_NAME_TO_ID[homeTeamName];
				const awayTeamId = TEAM_NAME_TO_ID[awayTeamName];
				
				if (!homeTeamId || !awayTeamId) {
					console.warn(`Could not map team names: ${homeTeamName}, ${awayTeamName}`);
					continue;
				}
				
				allGames.push({
					eventId: parseInt(event.id),
					week: week,
					gameDate: event.date,
					homeTeamId: homeTeamId,
					awayTeamId: awayTeamId,
					homeScore: parseInt(homeTeam.score || '0'),
					awayScore: parseInt(awayTeam.score || '0')
				});
			}
		}

		// Insert or update all games
		for (const game of allGames) {
			await db
				.insert(schedules)
				.values(game)
				.onConflictDoUpdate({
					target: schedules.eventId,
					set: { 
						gameDate: game.gameDate,
						homeScore: game.homeScore, 
						awayScore: game.awayScore 
					}
				});
		}

		return successResponse(allGames, `Successfully updated ${allGames.length} games for ${year} season from ESPN API.`);
	} catch (error) {
		console.error('Error fetching ESPN schedule:', error);
		return failureResponse(error, 'Failed to retrieve or save schedules from ESPN.');
	}
};
