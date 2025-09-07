import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { successResponse, failureResponse } from '$lib/utils';
import { sql } from 'drizzle-orm';

export const POST: RequestHandler = async ({ url, fetch }) => {
	const preserveUsers = url.searchParams.get('preserve_users') === 'true';
	const preservePicks = url.searchParams.get('preserve_picks') === 'true';
	
	try {
		const steps: string[] = [];
		
		// Step 1: Clear old data (in correct order to avoid foreign key constraints)
		if (!preservePicks) {
			await db.run(sql`DELETE FROM picks`);
			steps.push('Cleared picks table');
		}
		
		await db.run(sql`DELETE FROM live_scores`);
		steps.push('Cleared live_scores table');
		
		await db.run(sql`DELETE FROM user_weekly_scores`);
		steps.push('Cleared user_weekly_scores table');
		
		await db.run(sql`DELETE FROM schedules`);
		steps.push('Cleared schedules table');
		
		await db.run(sql`DELETE FROM teams`);
		steps.push('Cleared teams table');
		
		if (!preserveUsers) {
			await db.run(sql`DELETE FROM sessions`);
			await db.run(sql`DELETE FROM users`);
			steps.push('Cleared users and sessions tables');
		}
		
		// Step 2: Seed teams from ESPN
		const teamsResponse = await fetch('/api/seed/teams-espn');
		const teamsResult = await teamsResponse.json();
		if (!teamsResponse.ok) {
			throw new Error(`Failed to seed teams: ${teamsResult.error || 'Unknown error'}`);
		}
		steps.push(`Seeded ${teamsResult.data.length} teams from ESPN`);
		
		// Step 3: Seed schedules from ESPN
		const schedulesResponse = await fetch('/api/seed/schedules-espn');
		const schedulesResult = await schedulesResponse.json();
		if (!schedulesResponse.ok) {
			throw new Error(`Failed to seed schedules: ${schedulesResult.error || 'Unknown error'}`);
		}
		steps.push(`Seeded ${schedulesResult.data.successCount} games from ESPN`);
		
		// Step 4: Picks cleared - draft will create picks on-demand for each week
		if (!preservePicks) {
			steps.push('Picks cleared - ready for fresh drafts');
		}
		
		return successResponse({
			success: true,
			steps,
			timestamp: new Date().toISOString()
		}, 'Database reset and reseeded successfully with ESPN data!');
		
	} catch (error) {
		console.error('Error resetting database:', error);
		return failureResponse(error, 'Failed to reset and reseed database');
	}
};