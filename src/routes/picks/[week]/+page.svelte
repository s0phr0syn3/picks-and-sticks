<script lang="ts">
	import type { PicksPageData, PickWithDetails, UserWithPoints } from '$lib/types';
	import LiveLeaderboard from '$lib/components/LiveLeaderboard.svelte';
	
	export let data: PicksPageData;
	
	// Show live scores during game days
	const showLiveScores = true; // You can make this conditional based on day/time

	let week: number = data.week;
	let picks: PickWithDetails[] = data.picks;
	let totalPoints: UserWithPoints[] = data.totalPoints;

	if (!Array.isArray(picks)) {
		picks = [];
	}

	function changeWeek(direction: number) {
		const currentWeek: number = Number(week);
		const newWeek: number = currentWeek + direction;
		if (newWeek < 1) {
			return;
		}
		window.location.href = `/picks/${newWeek}`;
	}

	async function startDraft() {
		console.log(`Week is: ${week}`);
		try {
			console.log(`Fetching data from /api/picks/${week}/start-draft`);
			const res = await fetch(`/api/picks/${week}/start-draft`, {
				method: 'POST'
			});

			if (res.ok) {
				window.location.href = `/draft/${week}`;
			} else {
				console.error(res);
				alert('Failed to start the draft.');
			}
		} catch (error) {
			console.error('Error starting the draft: ', error);
			alert('An error occurred while trying to start the draft.');
		}
	}

	// Group picks by round for better display
	$: roundGroups = picks.reduce((groups, pick) => {
		const round = pick.round;
		if (!groups[round]) {
			groups[round] = [];
		}
		groups[round].push(pick);
		return groups;
	}, {} as Record<number, PickWithDetails[]>);

	// Sort each round by order
	$: Object.keys(roundGroups).forEach(round => {
		roundGroups[parseInt(round)].sort((a, b) => a.overallPickOrder - b.overallPickOrder);
	});
</script>

<svelte:head>
	<title>Week {week} Picks | Picks and Sticks</title>
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<!-- Header -->
	<div class="bg-white shadow-md">
		<div class="container mx-auto px-6 py-6">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<h1 class="text-4xl font-bold text-gray-800">
						🏈 Week {week} Picks
					</h1>
					<span class="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
						2025 Season
					</span>
				</div>
				
				<!-- Week Navigation -->
				<div class="flex items-center space-x-3">
					<button 
						class="btn btn-ghost {week <= 1 ? 'opacity-50 cursor-not-allowed' : ''}"
						on:click={() => changeWeek(-1)} 
						disabled={week <= 1}
					>
						← Previous
					</button>
					<div class="text-sm text-gray-600 px-3">
						Week {week} of 18
					</div>
					<button 
						class="btn btn-ghost {week >= 18 ? 'opacity-50 cursor-not-allowed' : ''}"
						on:click={() => changeWeek(1)}
						disabled={week >= 18}
					>
						Next →
					</button>
					<div class="border-l border-gray-300 mx-2 h-6"></div>
					<a href="/draft/{week}" class="btn btn-primary">View Draft</a>
				</div>
			</div>
		</div>
	</div>

	<div class="container mx-auto px-6 py-8">
		<!-- Live Scores (if game day) -->
		{#if showLiveScores}
			<div class="mb-8">
				<LiveLeaderboard {week} />
			</div>
		{/if}
		
		<!-- Status Banner -->
		{#if picks.length > 0 && picks.some((pick) => pick.teamId === null)}
			<!-- Draft in Progress -->
			<div class="bg-gradient-to-r from-orange-400 to-red-500 text-white p-6 rounded-xl shadow-lg mb-8">
				<div class="text-center">
					<div class="text-lg font-semibold mb-2">⚡ Draft in Progress</div>
					<p class="opacity-90 mb-4">The draft for Week {week} is currently underway</p>
					<a href="/draft/{week}" class="btn btn-white">
						Continue Draft →
					</a>
				</div>
			</div>
		{:else if picks.length > 0 && picks[0].teamId}
			<!-- Draft Complete -->
			<div class="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-xl shadow-lg mb-8">
				<div class="text-center">
					<div class="text-lg font-semibold mb-2">✅ Draft Complete</div>
					<p class="opacity-90">All picks have been made for Week {week}</p>
				</div>
			</div>
		{:else}
			<!-- Ready to Draft -->
			<div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-xl shadow-lg mb-8">
				<div class="text-center">
					<div class="text-lg font-semibold mb-2">🚀 Ready to Draft</div>
					<p class="opacity-90 mb-4">Start the draft for Week {week}</p>
					<button class="btn btn-white" on:click={startDraft}>
						Start Draft
					</button>
				</div>
			</div>
		{/if}

		<div class="grid lg:grid-cols-3 gap-8">
			<!-- Draft Results -->
			<div class="lg:col-span-2">
				{#if picks.length > 0}
					<div class="space-y-6">
						{#each Object.entries(roundGroups) as [round, roundPicks]}
							<div class="bg-white rounded-xl shadow-lg overflow-hidden">
								<div class="bg-gray-50 px-6 py-4 border-b">
									<h3 class="text-lg font-semibold text-gray-800 flex items-center">
										<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-bold mr-3">
											{round}
										</span>
										Round {round}
										{#if parseInt(round) >= 3}
											<span class="ml-2 text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
												Sticking Round
							</span>
						{/if}
					</h3>
				</div>
				
				<div class="overflow-x-auto">
					<table class="min-w-full">
						<thead class="bg-gray-50">
							<tr>
								<th class="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Pick</th>
								<th class="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Player</th>
								<th class="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Team</th>
								{#if parseInt(round) >= 3}
									<th class="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Stuck By</th>
								{/if}
								<th class="py-3 px-6 text-left text-xs font-semibold text-gray-600 uppercase">Points</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each roundPicks as pick}
								<tr class="hover:bg-gray-50 transition-colors">
									<td class="py-4 px-6">
										<div class="text-sm font-medium text-gray-900">#{pick.overallPickOrder}</div>
									</td>
									<td class="py-4 px-6">
										<div class="font-medium text-gray-900">{pick.fullName}</div>
									</td>
									<td class="py-4 px-6">
										{#if pick.team}
											<div class="flex items-center space-x-2">
												<span class="font-medium text-gray-900">{pick.team}</span>
											</div>
										{:else}
											<span class="text-gray-400 italic">TBD</span>
										{/if}
									</td>
									{#if parseInt(round) >= 3}
										<td class="py-4 px-6 text-sm text-gray-600">
											{pick.assignedByFullName || '—'}
										</td>
									{/if}
									<td class="py-4 px-6">
										{#if pick.points !== undefined}
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {pick.points > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
												{pick.points || 0}
											</span>
										{:else}
											<span class="text-gray-400">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="bg-white rounded-xl shadow-lg p-12 text-center">
		<div class="text-6xl mb-4">🏟️</div>
		<h3 class="text-xl font-semibold text-gray-800 mb-2">No Picks Yet</h3>
		<p class="text-gray-600 mb-6">Start the draft to begin making picks for Week {week}</p>
		<button class="btn btn-primary" on:click={startDraft}>
			Start Draft
		</button>
	</div>
{/if}
			</div>

			<!-- Leaderboard Sidebar -->
			<div class="lg:col-span-1">
				<div class="bg-white rounded-xl shadow-lg p-6">
					<h3 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
						🏆 Week {week} Scores
					</h3>
					
					{#if totalPoints && totalPoints.length > 0}
						<div class="space-y-3">
							{#each totalPoints as user, index}
								<div class="flex items-center justify-between p-3 rounded-lg {index === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}">
									<div class="flex items-center space-x-3">
										<div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-700">
											{index + 1}
										</div>
										<div>
											<div class="font-medium text-gray-900">{user.fullName}</div>
										</div>
									</div>
									<div class="text-right">
										<div class="font-bold text-lg {index === 0 ? 'text-yellow-700' : 'text-gray-900'}">
											{user.totalPoints}
										</div>
										<div class="text-xs text-gray-500">pts</div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="text-center text-gray-500 py-8">
							<div class="text-3xl mb-2">📊</div>
							<p class="text-sm">Scores will appear after games are played</p>
						</div>
					{/if}
				</div>

				<!-- Quick Stats -->
				<div class="bg-white rounded-xl shadow-lg p-6 mt-6">
					<h4 class="font-semibold text-gray-800 mb-4">Quick Stats</h4>
					<div class="space-y-3">
						<div class="flex justify-between">
							<span class="text-gray-600">Total Picks</span>
							<span class="font-medium">{picks.length}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">Completed</span>
							<span class="font-medium">{picks.filter(p => p.teamId !== null).length}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">Players</span>
							<span class="font-medium">{totalPoints?.length || 0}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</main>

<style>
	.btn {
		@apply px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2;
	}
	
	.btn-primary {
		@apply bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-md hover:shadow-lg;
	}
	
	.btn-white {
		@apply bg-white text-gray-800 hover:bg-gray-50 focus:ring-gray-500 shadow-md hover:shadow-lg;
	}
	
	.btn-ghost {
		@apply text-gray-600 hover:text-gray-800 hover:bg-gray-100;
	}
</style>