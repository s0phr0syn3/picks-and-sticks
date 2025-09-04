import type { Actions, PageServerLoad } from './$types';
import { redirect, fail } from '@sveltejs/kit';
import { createUser, createSession } from '$lib/server/auth';

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
	register: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const username = data.get('username') as string;
		const firstName = data.get('firstName') as string;
		const lastName = data.get('lastName') as string;
		const password = data.get('password') as string;
		const confirmPassword = data.get('confirmPassword') as string;
		const callbackUrl = url.searchParams.get('callbackUrl') || '/';
		
		// Validation
		if (!username || !firstName || !lastName || !password) {
			return fail(400, { error: 'All fields are required' });
		}
		
		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match' });
		}
		
		if (password.length < 6) {
			return fail(400, { error: 'Password must be at least 6 characters' });
		}
		
		if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
			return fail(400, { error: 'Username can only contain letters, numbers, hyphens, and underscores' });
		}
		
		try {
			// Create user
			const user = await createUser(username, firstName, lastName, password);
			console.log('User created successfully:', user);
			
			// Create session
			const session = await createSession(user.id);
			console.log('Session created successfully:', session.id);
			
			// Set session cookie
			cookies.set('session', session.id, {
				path: '/',
				httpOnly: true,
				secure: false, // Set to true in production with HTTPS
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 30 // 30 days
			});
			console.log('Cookie set successfully');
			
			// Redirect to callback URL
			throw redirect(302, callbackUrl);
		} catch (error: any) {
			console.error('Registration error:', error);
			
			// Check if it's a redirect (which is expected)
			if (error.status === 302) {
				throw error; // Re-throw redirect errors
			}
			
			// Handle specific database errors
			if (error.message?.includes('UNIQUE constraint failed: users.username')) {
				return fail(409, { error: 'Username is already taken' });
			}
			
			return fail(500, { error: 'An error occurred during registration' });
		}
	}
};