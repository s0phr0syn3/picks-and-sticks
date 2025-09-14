import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const week = params.week || 1;

	const response = await fetch(`/api/picks/${week}`);

	if (!response.ok) {
		throw new Error(`Failed to fetch picks for week ${week}. Status: ${response.status}`);
	}

	const data = await response.json();

	return { 
		picks: data.data?.picks || [], 
		draftState: data.data?.draftState || [],
		totalPoints: data.data?.totalPoints || [], 
		week: parseInt(week, 10),
		hasTeamSelections: data.data?.hasTeamSelections || false
	};
};
