import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/models';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { hashPassword } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.getSession();
	
	if (!session) {
		throw redirect(302, '/auth/signin');
	}
	
	return {
		user: session.user
	};
};

export const actions: Actions = {
	changePassword: async ({ request, locals }) => {
		const session = await locals.getSession();
		
		if (!session) {
			throw redirect(302, '/auth/signin');
		}
		
		const data = await request.formData();
		const currentPassword = data.get('currentPassword') as string;
		const newPassword = data.get('newPassword') as string;
		const confirmPassword = data.get('confirmPassword') as string;
		
		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { error: 'All fields are required' });
		}
		
		if (newPassword !== confirmPassword) {
			return fail(400, { error: 'New passwords do not match' });
		}
		
		if (newPassword.length < 6) {
			return fail(400, { error: 'New password must be at least 6 characters' });
		}
		
		try {
			// Verify current password by getting user from database
			const [user] = await db
				.select()
				.from(users)
				.where(eq(users.id, session.user.id));
			
			if (!user) {
				return fail(404, { error: 'User not found' });
			}
			
			// Verify current password
			const bcrypt = await import('bcryptjs');
			const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
			
			if (!validPassword) {
				return fail(401, { error: 'Current password is incorrect' });
			}
			
			// Hash new password and update
			const newPasswordHash = await hashPassword(newPassword);
			await db
				.update(users)
				.set({ passwordHash: newPasswordHash })
				.where(eq(users.id, session.user.id));
			
			return { success: true };
		} catch (error) {
			console.error('Error changing password:', error);
			return fail(500, { error: 'Failed to change password' });
		}
	}
};