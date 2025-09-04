import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Define admin usernames (you can change this to your username)
const ADMIN_USERS = ['ea']; // Add your admin usernames here

export const load: LayoutServerLoad = async ({ locals }) => {
	const session = await locals.getSession();
	
	if (!session || !ADMIN_USERS.includes(session.user.username)) {
		throw redirect(302, '/');
	}
	
	return {
		user: session.user
	};
};