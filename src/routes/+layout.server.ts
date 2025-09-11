import type { LayoutServerLoad } from './$types';
import { getCurrentWeek } from '$lib/server/queries';

export const load: LayoutServerLoad = async (event) => {
	return {
		session: await event.locals.getSession(),
		currentWeek: getCurrentWeek()
	};
};