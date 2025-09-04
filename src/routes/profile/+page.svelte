<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	
	export let data: PageData;
	export let form: ActionData;
	
	let currentPassword = '';
	let newPassword = '';
	let confirmPassword = '';
	let loading = false;
	
	$: passwordsMatch = newPassword === confirmPassword;
	$: formValid = currentPassword.length > 0 && newPassword.length >= 6 && passwordsMatch;
	
	// Clear form on successful password change
	$: if (form?.success) {
		currentPassword = '';
		newPassword = '';
		confirmPassword = '';
	}
</script>

<svelte:head>
	<title>Profile | Picks and Sticks</title>
</svelte:head>

<main class="container mx-auto px-6 py-8 max-w-2xl">
	<div class="bg-white rounded-xl shadow-lg p-6">
		<h1 class="text-3xl font-bold text-gray-800 mb-8">Profile</h1>
		
		<!-- User Info -->
		<div class="mb-8">
			<h2 class="text-xl font-semibold text-gray-700 mb-4">Account Information</h2>
			<div class="bg-gray-50 p-4 rounded-lg">
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700">Name</label>
						<p class="text-gray-900">{data.user.name}</p>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700">Username</label>
						<p class="text-gray-900 font-mono">@{data.user.username}</p>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Change Password Form -->
		<div>
			<h2 class="text-xl font-semibold text-gray-700 mb-4">Change Password</h2>
			
			{#if form?.error}
				<div class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
					{form.error}
				</div>
			{/if}
			
			{#if form?.success}
				<div class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
					Password changed successfully!
				</div>
			{/if}
			
			<form
				method="POST"
				action="?/changePassword"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						await update();
						loading = false;
					};
				}}
			>
				<div class="space-y-4">
					<div>
						<label for="currentPassword" class="block text-sm font-medium text-gray-700 mb-2">
							Current Password
						</label>
						<input
							type="password"
							id="currentPassword"
							name="currentPassword"
							bind:value={currentPassword}
							required
							class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
							placeholder="Enter your current password"
							disabled={loading}
						/>
					</div>
					
					<div>
						<label for="newPassword" class="block text-sm font-medium text-gray-700 mb-2">
							New Password
						</label>
						<input
							type="password"
							id="newPassword"
							name="newPassword"
							bind:value={newPassword}
							required
							minlength="6"
							class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
							placeholder="Enter new password (min. 6 characters)"
							disabled={loading}
						/>
					</div>
					
					<div>
						<label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-2">
							Confirm New Password
						</label>
						<input
							type="password"
							id="confirmPassword"
							name="confirmPassword"
							bind:value={confirmPassword}
							required
							class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 {confirmPassword && !passwordsMatch ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}"
							placeholder="Confirm your new password"
							disabled={loading}
						/>
						{#if confirmPassword && !passwordsMatch}
							<p class="text-red-600 text-sm mt-1">Passwords do not match</p>
						{/if}
					</div>
					
					<button
						type="submit"
						disabled={loading || !formValid}
						class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading ? 'Changing Password...' : 'Change Password'}
					</button>
				</div>
			</form>
		</div>
	</div>
</main>