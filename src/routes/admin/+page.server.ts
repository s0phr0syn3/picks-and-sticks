import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/models';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { hashPassword } from '$lib/server/auth';
import { v4 as uuidv4 } from 'uuid';

export const load: PageServerLoad = async () => {
	// Get all users from database
	const allUsers = await db
		.select({
			id: users.id,
			username: users.username,
			firstName: users.firstName,
			lastName: users.lastName,
			createdAt: users.createdAt
		})
		.from(users)
		.orderBy(users.createdAt);
	
	return {
		users: allUsers
	};
};

export const actions: Actions = {
	updateUser: async ({ request }) => {
		const data = await request.formData();
		const userId = data.get('userId') as string;
		const username = data.get('username') as string;
		const firstName = data.get('firstName') as string;
		const lastName = data.get('lastName') as string;
		
		if (!userId || !username || !firstName || !lastName) {
			return fail(400, { error: 'All fields are required' });
		}
		
		try {
			await db
				.update(users)
				.set({
					username,
					firstName,
					lastName
				})
				.where(eq(users.id, userId));
			
			return { success: true };
		} catch (error: any) {
			console.error('Error updating user:', error);
			if (error.message?.includes('UNIQUE constraint failed: users.username')) {
				return fail(409, { error: 'Username is already taken' });
			}
			return fail(500, { error: 'Failed to update user' });
		}
	},
	
	deleteUser: async ({ request }) => {
		const data = await request.formData();
		const userId = data.get('userId') as string;
		
		if (!userId) {
			return fail(400, { error: 'User ID is required' });
		}
		
		try {
			await db.delete(users).where(eq(users.id, userId));
			return { success: true };
		} catch (error) {
			console.error('Error deleting user:', error);
			return fail(500, { error: 'Failed to delete user' });
		}
	},
	
	resetPassword: async ({ request }) => {
		const data = await request.formData();
		const userId = data.get('userId') as string;
		
		if (!userId) {
			return fail(400, { error: 'User ID is required' });
		}
		
		try {
			// Generate a random password
			const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
			const passwordHash = await hashPassword(newPassword);
			
			await db
				.update(users)
				.set({ passwordHash })
				.where(eq(users.id, userId));
			
			return { 
				success: true, 
				passwordReset: true,
				newPassword: newPassword,
				userId: userId
			};
		} catch (error) {
			console.error('Error resetting password:', error);
			return fail(500, { error: 'Failed to reset password' });
		}
	},
	
	createUser: async ({ request }) => {
		const data = await request.formData();
		const username = data.get('username') as string;
		const firstName = data.get('firstName') as string;
		const lastName = data.get('lastName') as string;
		const password = data.get('password') as string;
		
		if (!username || !firstName || !lastName || !password) {
			return fail(400, { error: 'All fields are required' });
		}
		
		try {
			const passwordHash = await hashPassword(password);
			const userId = uuidv4();
			
			await db.insert(users).values({
				id: userId,
				username,
				firstName,
				lastName,
				passwordHash,
				createdAt: new Date()
			});
			
			return { 
				success: true, 
				userCreated: true,
				message: `User ${firstName} ${lastName} created successfully`
			};
		} catch (error: any) {
			console.error('Error creating user:', error);
			if (error.message?.includes('UNIQUE constraint failed: users.username')) {
				return fail(409, { error: 'Username is already taken' });
			}
			return fail(500, { error: 'Failed to create user' });
		}
	}
};