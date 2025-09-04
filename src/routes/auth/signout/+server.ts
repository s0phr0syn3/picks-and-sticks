import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies, url }) => {
	const sessionId = cookies.get('session');
	
	if (sessionId) {
		// Delete session from database
		await deleteSession(sessionId);
		
		// Clear session cookie
		cookies.delete('session', { path: '/' });
	}
	
	// Check if this is a form submission (has a redirect expectation)
	const contentType = url.searchParams.get('redirect');
	if (contentType === 'true') {
		throw redirect(302, '/auth/signin');
	}
	
	return json({ success: true });
};

export const GET: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('session');
	
	if (sessionId) {
		// Delete session from database
		await deleteSession(sessionId);
		
		// Clear session cookie
		cookies.delete('session', { path: '/' });
	}
	
	// Always redirect for GET requests
	throw redirect(302, '/auth/signin');
};