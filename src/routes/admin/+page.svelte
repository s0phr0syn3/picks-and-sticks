<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	
	export let data: PageData;
	export let form: ActionData;
	
	let editingUserId: string | null = null;
	let editForm = {
		username: '',
		firstName: '',
		lastName: ''
	};
	
	function startEdit(user: any) {
		editingUserId = user.id;
		editForm.username = user.username;
		editForm.firstName = user.firstName;
		editForm.lastName = user.lastName;
	}
	
	function cancelEdit() {
		editingUserId = null;
		editForm = {
			username: '',
			firstName: '',
			lastName: ''
		};
	}
	
	$: if (form?.success) {
		cancelEdit();
	}
	
	// Live scores management
	let liveScoreLoading = false;
	let liveScoreMessage = '';
	
	async function triggerLiveScoreUpdate() {
		liveScoreLoading = true;
		liveScoreMessage = '';
		
		try {
			const response = await fetch('/api/live-scores/trigger-now', {
				method: 'POST'
			});
			
			const result = await response.json();
			
			if (result.success) {
				liveScoreMessage = `✅ ${result.message}`;
			} else {
				liveScoreMessage = `❌ ${result.error}`;
			}
		} catch (error) {
			liveScoreMessage = '❌ Failed to trigger live score update';
		} finally {
			liveScoreLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Admin - User Management | Picks and Sticks</title>
</svelte:head>

<main class="container mx-auto px-6 py-8 max-w-6xl">
	<div class="bg-white rounded-xl shadow-lg p-6">
		<div class="flex items-center justify-between mb-8">
			<h1 class="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
		</div>
		
		<!-- Quick Links -->
		<div class="mb-8">
			<h2 class="text-xl font-semibold text-gray-700 mb-4">Management</h2>
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
				<a href="/admin/weeks" class="block p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
					<h3 class="font-semibold text-blue-800">Week Management</h3>
					<p class="text-sm text-blue-600">Manage punishments and reset week picks</p>
				</a>
				<a href="/admin/draft-order" class="block p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
					<h3 class="font-semibold text-green-800">Draft Order Management</h3>
					<p class="text-sm text-green-600">Set and customize draft order for each week</p>
				</a>
				<div class="block p-4 bg-gray-50 rounded-lg">
					<h3 class="font-semibold text-gray-800">User Management</h3>
					<p class="text-sm text-gray-600">Edit users and reset passwords (below)</p>
				</div>
				<div class="block p-4 bg-orange-50 rounded-lg">
					<h3 class="font-semibold text-orange-800 mb-2">Live Scores</h3>
					<button 
						class="btn btn-sm btn-orange w-full {liveScoreLoading ? 'loading' : ''}" 
						on:click={triggerLiveScoreUpdate}
						disabled={liveScoreLoading}
					>
						{liveScoreLoading ? 'Updating...' : '🔄 Update Now'}
					</button>
					{#if liveScoreMessage}
						<p class="text-xs mt-2 {liveScoreMessage.startsWith('✅') ? 'text-green-600' : 'text-red-600'}">{liveScoreMessage}</p>
					{/if}
				</div>
			</div>
		</div>
		
		<h2 class="text-2xl font-bold text-gray-800 mb-6">User Management</h2>
		
		{#if form?.error}
			<div class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
				{form.error}
			</div>
		{/if}
		
		{#if form?.success && form?.passwordReset}
			<div class="mb-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
				<p class="font-semibold">Password reset successfully!</p>
				<p class="mt-2">New password: <code class="bg-white px-2 py-1 rounded font-mono text-sm">{form.newPassword}</code></p>
				<p class="text-sm mt-1">Please share this password securely with the user.</p>
			</div>
		{:else if form?.success}
			<div class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
				User updated successfully!
			</div>
		{/if}
		
		<div class="overflow-x-auto">
			<table class="w-full table-auto">
				<thead>
					<tr class="bg-gray-100 text-left">
						<th class="px-4 py-3 font-semibold">Username</th>
						<th class="px-4 py-3 font-semibold">First Name</th>
						<th class="px-4 py-3 font-semibold">Last Name</th>
						<th class="px-4 py-3 font-semibold">Created</th>
						<th class="px-4 py-3 font-semibold">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as user}
						<tr class="border-b hover:bg-gray-50">
							{#if editingUserId === user.id}
								<td class="px-4 py-3">
									<input
										type="text"
										bind:value={editForm.username}
										class="w-full px-2 py-1 border rounded font-mono text-sm"
									/>
								</td>
								<td class="px-4 py-3">
									<input
										type="text"
										bind:value={editForm.firstName}
										class="w-full px-2 py-1 border rounded"
									/>
								</td>
								<td class="px-4 py-3">
									<input
										type="text"
										bind:value={editForm.lastName}
										class="w-full px-2 py-1 border rounded"
									/>
								</td>
								<td class="px-4 py-3 text-gray-600">
									{new Date(user.createdAt).toLocaleDateString()}
								</td>
								<td class="px-4 py-3">
									<form method="POST" action="?/updateUser" use:enhance class="inline">
										<input type="hidden" name="userId" value={user.id} />
										<input type="hidden" name="username" value={editForm.username} />
										<input type="hidden" name="firstName" value={editForm.firstName} />
										<input type="hidden" name="lastName" value={editForm.lastName} />
										<button
											type="submit"
											class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 mr-2"
										>
											Save
										</button>
									</form>
									<button
										on:click={cancelEdit}
										class="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
									>
										Cancel
									</button>
								</td>
							{:else}
								<td class="px-4 py-3 font-mono text-sm">{user.username}</td>
								<td class="px-4 py-3">{user.firstName}</td>
								<td class="px-4 py-3">{user.lastName}</td>
								<td class="px-4 py-3 text-gray-600">
									{new Date(user.createdAt).toLocaleDateString()}
								</td>
								<td class="px-4 py-3">
									<button
										on:click={() => startEdit(user)}
										class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 mr-2 mb-1"
									>
										Edit
									</button>
									<form method="POST" action="?/resetPassword" use:enhance class="inline mr-2"
										on:submit|preventDefault={(e) => {
											if (confirm(`Reset password for ${user.username}?`)) {
												e.currentTarget.submit();
											}
										}}
									>
										<input type="hidden" name="userId" value={user.id} />
										<button
											type="submit"
											class="bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700 mb-1"
										>
											Reset Password
										</button>
									</form>
									<form method="POST" action="?/deleteUser" use:enhance class="inline"
										on:submit|preventDefault={(e) => {
											if (confirm(`Delete user ${user.username}?`)) {
												e.currentTarget.submit();
											}
										}}
									>
										<input type="hidden" name="userId" value={user.id} />
										<button
											type="submit"
											class="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 mb-1"
										>
											Delete
										</button>
									</form>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		
		<div class="mt-6 text-gray-600">
			<p>Total users: {data.users.length}</p>
		</div>
	</div>
</main>

<style>
	.btn {
		@apply px-3 py-2 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2;
	}
	
	.btn-sm {
		@apply px-2 py-1 text-sm;
	}
	
	.btn-orange {
		@apply bg-orange-600 text-white hover:bg-orange-700 focus:ring-orange-500;
	}
	
	.btn:disabled {
		@apply opacity-50 cursor-not-allowed;
	}
</style>