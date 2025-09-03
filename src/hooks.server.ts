import type { Handle } from '@sveltejs/kit';
import { getSessionFromCookie } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	// Add session to locals
	const session = await getSessionFromCookie(event);
	
	event.locals.getSession = async () => {
		return session ? {
			user: {
				id: session.user!.id,
				name: `${session.user!.firstName} ${session.user!.lastName}`,
				username: session.user!.username
			}
		} : null;
	};

	return resolve(event);
};