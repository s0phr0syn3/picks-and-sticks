import type { Handle } from '@sveltejs/kit';
import { getSessionFromCookie } from '$lib/server/auth';
import { initializeLiveScoring } from '$lib/server/live-score-scheduler';

// Initialize live scoring on server start
const API_KEY = process.env.API_KEY;
if (API_KEY) {
	console.log('🚀 Initializing live scoring system...');
	initializeLiveScoring(API_KEY);
} else {
	console.warn('⚠️  API_KEY not found - live scoring disabled');
}

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