<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	
	export let data;
	export let form;
	
	let selectedWeek = data.selectedWeek;
	let isClearing = false;
	
	function changeWeek() {
		window.location.href = `/admin/assign-teams?week=${selectedWeek}`;
	}
	
	// Group picks by round for better display
	$: picksByRound = data.picks.reduce((acc, pick) => {
		if (!acc[pick.round]) acc[pick.round] = [];
		acc[pick.round].push(pick);
		return acc;
	}, {} as Record<number, typeof data.picks>);
	
	// Check if a team is already picked
	function isTeamPicked(teamId: number, currentPickId: string) {
		return data.picks.some(p => p.teamId === teamId && p.pickId !== currentPickId);
	}
	
	// Format game date/time
	function formatGameTime(dateStr: string) {
		const date = new Date(dateStr);
		const options: Intl.DateTimeFormatOptions = {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
			timeZone: 'America/Los_Angeles'
		};
		return date.toLocaleString('en-US', options) + ' PT';
	}
	
	// Check if game has started
	function hasGameStarted(dateStr: string) {
		return new Date(dateStr) < new Date();
	}
</script>

<svelte:head>
	<title>Assign Teams - Admin | Picks and Sticks</title>
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
	<!-- Header -->
	<div class="bg-white shadow-md">
		<div class="container mx-auto px-6 py-6">
			<div class="flex items-center justify-between">
				<h1 class="text-3xl font-bold text-gray-800">
					🏈 Assign Teams to Picks
				</h1>
				
				<!-- Week Selector -->
				<div class="flex items-center space-x-3">
					<label for="week" class="text-sm font-medium text-gray-700">Week:</label>
					<select 
						id="week"
						bind:value={selectedWeek}
						on:change={changeWeek}
						class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						{#each data.weeks as week}
							<option value={week}>Week {week}</option>
						{/each}
					</select>
				</div>
			</div>
			
			<!-- Warning Badge -->
			<div class="mt-3 inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
				⚠️ Admin Mode: Can assign teams even after games have started
			</div>
		</div>
	</div>

	<div class="container mx-auto px-6 py-8">
		{#if form?.error}
			<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
				{form.error}
			</div>
		{/if}
		
		{#if form?.success}
			<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
				{form.message}
			</div>
		{/if}

		<!-- Clear All Button -->
		<div class="mb-6 flex justify-end">
			<form 
				method="POST" 
				action="?/clearAllAssignments"
				use:enhance={() => {
					if (!confirm(`Clear all team assignments for Week ${selectedWeek}?`)) {
						return ({ cancel }) => cancel();
					}
					isClearing = true;
					return async ({ result, update }) => {
						isClearing = false;
						await update();
						if (result.type === 'success') {
							await invalidateAll();
						}
					};
				}}
			>
				<input type="hidden" name="week" value={selectedWeek} />
				<button 
					type="submit"
					disabled={isClearing}
					class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
				>
					{isClearing ? 'Clearing...' : 'Clear All Assignments'}
				</button>
			</form>
		</div>

		<!-- Picks by Round -->
		{#each Object.entries(picksByRound) as [round, roundPicks]}
			<div class="mb-8">
				<h2 class="text-xl font-bold text-gray-800 mb-4">Round {round}</h2>
				
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{#each roundPicks as pick}
						<div class="bg-white rounded-lg shadow-md p-4">
							<div class="mb-3">
								<div class="font-semibold text-gray-800">
									Pick #{(parseInt(round) - 1) * 5 + pick.orderInRound}
								</div>
								<div class="text-sm text-gray-600">
									{pick.userFullName}
								</div>
							</div>
							
							<form 
								method="POST" 
								action="?/assignTeam"
								use:enhance={() => {
									return async ({ result, update }) => {
										await update();
										if (result.type === 'success') {
											await invalidateAll();
										}
									};
								}}
							>
								<input type="hidden" name="pickId" value={pick.pickId} />
								<input type="hidden" name="week" value={selectedWeek} />
								
								<select 
									name="teamId"
									on:change={(e) => e.currentTarget.form?.requestSubmit()}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
								>
									<option value="">-- Select Team --</option>
									{#each data.availableTeams as team}
										{@const isPicked = isTeamPicked(team.teamId, pick.pickId)}
										{@const isSelected = pick.teamId === team.teamId}
										{@const gameStarted = hasGameStarted(team.gameDate)}
										<option 
											value={team.teamId}
											selected={isSelected}
											disabled={isPicked && !isSelected}
											class:text-red-600={gameStarted}
										>
											{team.teamName} 
											{team.isHome ? 'vs' : '@'} 
											{team.opponentName}
											{isPicked && !isSelected ? ' (Taken)' : ''}
											{gameStarted ? ' 🔴' : ''}
										</option>
									{/each}
								</select>
							</form>
							
							{#if pick.teamName}
								<div class="mt-2 text-sm">
									<span class="font-medium text-green-600">Current:</span> {pick.teamName}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/each}

		<!-- Available Teams Reference -->
		<div class="mt-8 bg-white rounded-lg shadow-md p-6">
			<h3 class="text-lg font-bold text-gray-800 mb-4">Week {selectedWeek} Games</h3>
			
			<div class="grid gap-2 text-sm">
				{#each data.availableTeams.filter((t, i, arr) => i % 2 === 0) as team}
					{@const gameStarted = hasGameStarted(team.gameDate)}
					{@const homeTeam = team.isHome ? team : data.availableTeams.find(t => t.eventId === team.eventId && t.isHome)}
					{@const awayTeam = !team.isHome ? team : data.availableTeams.find(t => t.eventId === team.eventId && !t.isHome)}
					{#if homeTeam && awayTeam}
						<div class="flex items-center justify-between py-2 px-3 rounded {gameStarted ? 'bg-red-50' : 'hover:bg-gray-50'}">
							<div class="flex items-center space-x-2">
								<span class="{data.pickedTeamIds.includes(awayTeam.teamId) ? 'font-semibold text-blue-600' : ''}">
									{awayTeam.teamName}
								</span>
								<span class="text-gray-500">@</span>
								<span class="{data.pickedTeamIds.includes(homeTeam.teamId) ? 'font-semibold text-blue-600' : ''}">
									{homeTeam.teamName}
								</span>
							</div>
							<div class="text-xs text-gray-500">
								{formatGameTime(team.gameDate)}
								{gameStarted ? ' (Started)' : ''}
							</div>
						</div>
					{/if}
				{/each}
			</div>
			
			<div class="mt-4 text-xs text-gray-500">
				<div>🔴 = Game has started</div>
				<div>Blue text = Team already picked</div>
			</div>
		</div>
		
		<!-- Navigation -->
		<div class="mt-8 flex justify-center space-x-4">
			<a href="/admin" class="btn btn-outline">Back to Admin</a>
			<a href="/picks/{selectedWeek}" class="btn btn-primary">View Picks</a>
		</div>
	</div>
</main>

<style>
	.btn {
		@apply px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2;
	}
	
	.btn-primary {
		@apply bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500;
	}
	
	.btn-outline {
		@apply border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-blue-500;
	}
</style>