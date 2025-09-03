import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { verifyUser, createSession } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.getSession();
	
	// If already authenticated, redirect
	if (session) {
		const callbackUrl = url.searchParams.get('callbackUrl') || '/';
		throw redirect(302, callbackUrl);
	}
	
	return {};
};

export const actions: Actions = {
	signin: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const username = data.get('username') as string;
		const password = data.get('password') as string;
		const callbackUrl = url.searchParams.get('callbackUrl') || '/';
		
		if (!username || !password) {
			return fail(400, { error: 'Username and password are required' });
		}
		
		try {
			// Verify user credentials
			const user = await verifyUser(username, password);
			if (!user) {
				return fail(401, { error: 'Invalid username or password' });
			}
			
			// Create session
			const session = await createSession(user.id);
			
			// Set session cookie
			cookies.set('session', session.id, {
				path: '/',
				httpOnly: true,
				secure: false, // Set to true in production with HTTPS
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 30 // 30 days
			});
			
		} catch (error) {
			console.error('Sign in error:', error);
			return fail(500, { error: 'An error occurred during sign in' });
		}
		
		// Redirect to callback URL
		throw redirect(302, callbackUrl);
	}
};