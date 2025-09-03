import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const week = parseInt(params.week, 10) || 1;

	const response = await fetch(`/api/draft/${week}/select-team`);

	if (!response.ok) {
		throw new Error(`Failed to fetch draft data for week ${week}. Status: ${response.status}`);
	}

	const data = await response.json();

	return {
		draftState: data.draftState,
		availableTeams: data.availableTeams,
		week
	};
};
