import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { teams } from '$lib/server/models';
import { successResponse, failureResponse } from '$lib/utils';
import { sql } from 'drizzle-orm';

// ESPN team IDs and data - these are consistent across ESPN's API
const ESPN_TEAMS = [
	// AFC East
	{ espnId: 'BUF', teamId: 1, name: 'Buffalo Bills', shortName: 'BUF', conference: 'AFC', division: 'East' },
	{ espnId: 'MIA', teamId: 2, name: 'Miami Dolphins', shortName: 'MIA', conference: 'AFC', division: 'East' },
	{ espnId: 'NE', teamId: 3, name: 'New England Patriots', shortName: 'NE', conference: 'AFC', division: 'East' },
	{ espnId: 'NYJ', teamId: 4, name: 'New York Jets', shortName: 'NYJ', conference: 'AFC', division: 'East' },
	
	// AFC North
	{ espnId: 'BAL', teamId: 5, name: 'Baltimore Ravens', shortName: 'BAL', conference: 'AFC', division: 'North' },
	{ espnId: 'CIN', teamId: 6, name: 'Cincinnati Bengals', shortName: 'CIN', conference: 'AFC', division: 'North' },
	{ espnId: 'CLE', teamId: 7, name: 'Cleveland Browns', shortName: 'CLE', conference: 'AFC', division: 'North' },
	{ espnId: 'PIT', teamId: 8, name: 'Pittsburgh Steelers', shortName: 'PIT', conference: 'AFC', division: 'North' },
	
	// AFC South
	{ espnId: 'HOU', teamId: 9, name: 'Houston Texans', shortName: 'HOU', conference: 'AFC', division: 'South' },
	{ espnId: 'IND', teamId: 10, name: 'Indianapolis Colts', shortName: 'IND', conference: 'AFC', division: 'South' },
	{ espnId: 'JAX', teamId: 11, name: 'Jacksonville Jaguars', shortName: 'JAX', conference: 'AFC', division: 'South' },
	{ espnId: 'TEN', teamId: 12, name: 'Tennessee Titans', shortName: 'TEN', conference: 'AFC', division: 'South' },
	
	// AFC West
	{ espnId: 'DEN', teamId: 13, name: 'Denver Broncos', shortName: 'DEN', conference: 'AFC', division: 'West' },
	{ espnId: 'KC', teamId: 14, name: 'Kansas City Chiefs', shortName: 'KC', conference: 'AFC', division: 'West' },
	{ espnId: 'LAC', teamId: 15, name: 'Los Angeles Chargers', shortName: 'LAC', conference: 'AFC', division: 'West' },
	{ espnId: 'LV', teamId: 16, name: 'Las Vegas Raiders', shortName: 'LV', conference: 'AFC', division: 'West' },
	
	// NFC East
	{ espnId: 'DAL', teamId: 17, name: 'Dallas Cowboys', shortName: 'DAL', conference: 'NFC', division: 'East' },
	{ espnId: 'NYG', teamId: 18, name: 'New York Giants', shortName: 'NYG', conference: 'NFC', division: 'East' },
	{ espnId: 'PHI', teamId: 19, name: 'Philadelphia Eagles', shortName: 'PHI', conference: 'NFC', division: 'East' },
	{ espnId: 'WSH', teamId: 20, name: 'Washington Commanders', shortName: 'WSH', conference: 'NFC', division: 'East' },
	
	// NFC North
	{ espnId: 'CHI', teamId: 21, name: 'Chicago Bears', shortName: 'CHI', conference: 'NFC', division: 'North' },
	{ espnId: 'DET', teamId: 22, name: 'Detroit Lions', shortName: 'DET', conference: 'NFC', division: 'North' },
	{ espnId: 'GB', teamId: 23, name: 'Green Bay Packers', shortName: 'GB', conference: 'NFC', division: 'North' },
	{ espnId: 'MIN', teamId: 24, name: 'Minnesota Vikings', shortName: 'MIN', conference: 'NFC', division: 'North' },
	
	// NFC South
	{ espnId: 'ATL', teamId: 25, name: 'Atlanta Falcons', shortName: 'ATL', conference: 'NFC', division: 'South' },
	{ espnId: 'CAR', teamId: 26, name: 'Carolina Panthers', shortName: 'CAR', conference: 'NFC', division: 'South' },
	{ espnId: 'NO', teamId: 27, name: 'New Orleans Saints', shortName: 'NO', conference: 'NFC', division: 'South' },
	{ espnId: 'TB', teamId: 28, name: 'Tampa Bay Buccaneers', shortName: 'TB', conference: 'NFC', division: 'South' },
	
	// NFC West
	{ espnId: 'ARI', teamId: 29, name: 'Arizona Cardinals', shortName: 'ARI', conference: 'NFC', division: 'West' },
	{ espnId: 'LAR', teamId: 30, name: 'Los Angeles Rams', shortName: 'LAR', conference: 'NFC', division: 'West' },
	{ espnId: 'SF', teamId: 31, name: 'San Francisco 49ers', shortName: 'SF', conference: 'NFC', division: 'West' },
	{ espnId: 'SEA', teamId: 32, name: 'Seattle Seahawks', shortName: 'SEA', conference: 'NFC', division: 'West' }
];

export const GET: RequestHandler = async ({ url }) => {
	const clearExisting = url.searchParams.get('clear') === 'true';
	
	try {
		// Optionally clear existing teams
		if (clearExisting) {
			await db.run(sql`DELETE FROM teams`);
			console.log('Cleared existing teams');
		}
		
		// Insert or update all teams
		for (const team of ESPN_TEAMS) {
			await db
				.insert(teams)
				.values({
					id: team.teamId,
					teamId: team.teamId,
					name: team.name,
					shortName: team.shortName,
					badgeUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${team.espnId}.png`
				})
				.onConflictDoUpdate({
					target: teams.teamId,
					set: {
						name: team.name,
						shortName: team.shortName,
						badgeUrl: `https://a.espncdn.com/i/teamlogos/nfl/500/${team.espnId}.png`
					}
				});
		}
		
		return successResponse(ESPN_TEAMS, `Successfully seeded ${ESPN_TEAMS.length} NFL teams from ESPN data.`);
	} catch (error) {
		console.error('Error seeding teams:', error);
		return failureResponse(error, 'Failed to seed teams.');
	}
};