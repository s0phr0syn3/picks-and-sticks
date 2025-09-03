import { config } from 'dotenv';

config();

const BASE_URL = process.env.BASE_URL;
const API_KEY = process.env.API_KEY;

interface NFLTeam {
	idTeam: string;
	strTeam: string;
	strTeamShort: string;
	strBadge: string;
}

interface NFLTeamsResponse {
	list: NFLTeam[];
}

interface NFLEvent {
	idEvent: string;
	strEvent: string;
	strHomeTeam: string;
	strAwayTeam: string;
	intHomeScore: string;
	intAwayScore: string;
	dateEvent: string;
	idHomeTeam: string;
	idAwayTeam: string;
}

interface NFLEventsResponse {
	filter: NFLEvent[];
}

export async function fetchNFLTeams(): Promise<NFLTeam[]> {
	const response = await fetch(`${BASE_URL}/list/teams/4391`, {
		method: 'GET',
		headers: {
			'X-API-KEY': API_KEY!
		}
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch teams: ${response.statusText}`);
	}
	const data: NFLTeamsResponse = await response.json();
	return data.list;
}

export async function fetchNFLSchedule(year: number): Promise<NFLEvent[]> {
	const response = await fetch(`${BASE_URL}/filter/events/4391/${year}`, {
		method: 'GET',
		headers: {
			'X-API-KEY': API_KEY!
		}
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch schedules: ${response.statusText}`);
	}
	const data: NFLEventsResponse = await response.json();
	return data.filter;
}
