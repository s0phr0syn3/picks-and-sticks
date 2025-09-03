#!/usr/bin/env node

import { createUser } from '../src/lib/server/auth';

async function createTestUsers() {
	console.log('🚀 Creating test users...');
	
	try {
		// Create the same test users from your current seed data
		const testUsers = [
			{ username: 'echo', firstName: 'Echo', lastName: 'Alpha', password: 'password123' },
			{ username: 'romeo', firstName: 'Romeo', lastName: 'Charlie', password: 'password123' },
			{ username: 'charlie', firstName: 'Charlie', lastName: 'Hotel', password: 'password123' },
			{ username: 'juliet', firstName: 'Juliet', lastName: 'Papa', password: 'password123' },
			{ username: 'november', firstName: 'November', lastName: 'Romeo', password: 'password123' }
		];
		
		for (const userData of testUsers) {
			try {
				const user = await createUser(userData.username, userData.firstName, userData.lastName, userData.password);
				console.log(`✅ Created user: ${user.username} (${user.firstName} ${user.lastName})`);
			} catch (error: any) {
				if (error.message?.includes('UNIQUE constraint failed')) {
					console.log(`⚠️ User ${userData.username} already exists, skipping...`);
				} else {
					console.error(`❌ Error creating user ${userData.username}:`, error);
				}
			}
		}
		
		console.log('\n🎉 Test users created successfully!');
		console.log('📝 You can now sign in with:');
		console.log('   Username: echo, Password: password123');
		console.log('   Username: romeo, Password: password123');
		console.log('   Username: charlie, Password: password123');
		console.log('   Username: juliet, Password: password123');
		console.log('   Username: november, Password: password123');
		
	} catch (error) {
		console.error('💥 Error creating test users:', error);
	}
}

createTestUsers();