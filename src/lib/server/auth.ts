import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { users, sessions } from './models';
import { eq, and, gt } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';

export interface User {
	id: string;
	username: string;
	firstName: string;
	lastName: string;
	createdAt: Date;
}

export interface Session {
	id: string;
	userId: string;
	expiresAt: Date;
	user?: User;
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
	return await bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return await bcrypt.compare(password, hash);
}

// User management
export async function createUser(
	username: string, 
	firstName: string, 
	lastName: string, 
	password: string
): Promise<User> {
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
	
	const [user] = await db
		.select({
			id: users.id,
			username: users.username,
			firstName: users.firstName,
			lastName: users.lastName,
			createdAt: users.createdAt
		})
		.from(users)
		.where(eq(users.id, userId));
		
	return user as User;
}

export async function verifyUser(username: string, password: string): Promise<User | null> {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.username, username));
		
	if (!user) return null;
	
	const valid = await verifyPassword(password, user.passwordHash);
	if (!valid) return null;
	
	return {
		id: user.id,
		username: user.username,
		firstName: user.firstName,
		lastName: user.lastName,
		createdAt: user.createdAt
	};
}

// Session management
export async function createSession(userId: string): Promise<Session> {
	const sessionId = uuidv4();
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
	
	await db.insert(sessions).values({
		id: sessionId,
		userId,
		expiresAt,
		createdAt: new Date()
	});
	
	return {
		id: sessionId,
		userId,
		expiresAt
	};
}

export async function getSession(sessionId: string): Promise<Session | null> {
	const [session] = await db
		.select({
			id: sessions.id,
			userId: sessions.userId,
			expiresAt: sessions.expiresAt,
			user: {
				id: users.id,
				username: users.username,
				firstName: users.firstName,
				lastName: users.lastName,
				createdAt: users.createdAt
			}
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(
			and(
				eq(sessions.id, sessionId),
				gt(sessions.expiresAt, new Date())
			)
		);
		
	if (!session) return null;
	
	return {
		id: session.id,
		userId: session.userId,
		expiresAt: session.expiresAt,
		user: session.user as User
	};
}

export async function deleteSession(sessionId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function getSessionFromCookie(event: RequestEvent): Promise<Session | null> {
	const sessionId = event.cookies.get('session');
	if (!sessionId) return null;
	
	const session = await getSession(sessionId);
	if (!session) {
		// Clean up invalid session cookie
		event.cookies.delete('session', { path: '/' });
		return null;
	}
	
	return session;
}