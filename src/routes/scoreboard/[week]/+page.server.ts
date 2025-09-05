import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const week = parseInt(params.week, 10) || 1;

	return {
		week
	};
};