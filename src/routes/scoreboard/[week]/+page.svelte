<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	export let data: { week: number };
	
	interface GameStatus {
		eventId: number;
		homeTeamId: number;
		awayTeamId: number;
		homeTeamName: string;
		awayTeamName: string;
		homeScore: number;
		awayScore: number;
		quarter: string | null;
		timeRemaining: string | null;
		isLive: boolean;
		isComplete: boolean;
		lastUpdated: string;
	}

	let games: GameStatus[] = [];
	let loading = true;
	let error = '';
	let week = data.week;
	let updateInterval: NodeJS.Timeout;

	async function fetchScoreboard() {
		try {
			const response = await fetch(`/api/scoreboard/${week}`);
			if (response.ok) {
				const data = await response.json();
				games = data.games || [];
				error = '';
			} else {
				error = 'Failed to fetch scoreboard data';
			}
		} catch (err) {
			error = 'Error loading scoreboard';
			console.error('Scoreboard error:', err);
		} finally {
			loading = false;
		}
	}

	function changeWeek(direction: number) {
		const newWeek = week + direction;
		if (newWeek >= 1 && newWeek <= 18) {
			window.location.href = `/scoreboard/${newWeek}`;
		}
	}

	function getGameStatus(game: GameStatus) {
		if (game.isComplete) {
			return { status: 'Final', class: 'text-gray-600' };
		} else if (game.isLive) {
			const quarter = game.quarter || '';
			const time = game.timeRemaining || '';
			return { 
				status: time ? `${quarter} ${time}` : quarter,
				class: 'text-red-600 font-bold animate-pulse'
			};
		} else {
			return { status: 'Not Started', class: 'text-gray-500' };
		}
	}

	onMount(() => {
		fetchScoreboard();
		
		// Auto-refresh every 30 seconds during game days
		updateInterval = setInterval(fetchScoreboard, 30000);
	});

	onDestroy(() => {
		if (updateInterval) {
			clearInterval(updateInterval);
		}
	});
</script>

<svelte:head>
	<title>Live Scoreboard - Week {week} | Picks and Sticks</title>
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
	<!-- Header -->
	<div class="bg-white shadow-md">
		<div class="container mx-auto px-6 py-6">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<h1 class="text-4xl font-bold text-gray-800">
						📊 Week {week} Scoreboard
					</h1>
					<span class="text-sm bg-red-100 text-red-800 px-3 py-1 rounded-full font-medium animate-pulse">
						Live Updates
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
				</div>
			</div>
		</div>
	</div>

	<div class="container mx-auto px-6 py-8">
		{#if loading}
			<div class="text-center py-12">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
				<p class="text-gray-600">Loading scoreboard...</p>
			</div>
		{:else if error}
			<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
				{error}
			</div>
		{:else}
			<!-- Games Grid -->
			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each games as game}
					{@const gameStatus = getGameStatus(game)}
					<div class="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
						<!-- Game Status -->
						<div class="text-center mb-4">
							<span class="text-sm {gameStatus.class}">
								{gameStatus.status}
							</span>
						</div>

						<!-- Teams and Scores -->
						<div class="space-y-4">
							<!-- Away Team -->
							<div class="flex justify-between items-center">
								<div class="flex-1">
									<div class="font-semibold text-gray-800">
										{game.awayTeamName}
									</div>
									<div class="text-xs text-gray-500">Away</div>
								</div>
								<div class="text-2xl font-bold text-gray-800 min-w-[3rem] text-right">
									{game.awayScore}
								</div>
							</div>

							<!-- VS Divider -->
							<div class="text-center text-gray-400 text-sm font-medium">
								VS
							</div>

							<!-- Home Team -->
							<div class="flex justify-between items-center">
								<div class="flex-1">
									<div class="font-semibold text-gray-800">
										{game.homeTeamName}
									</div>
									<div class="text-xs text-gray-500">Home</div>
								</div>
								<div class="text-2xl font-bold text-gray-800 min-w-[3rem] text-right">
									{game.homeScore}
								</div>
							</div>
						</div>

						<!-- Last Updated -->
						{#if game.lastUpdated}
							<div class="mt-4 pt-3 border-t text-xs text-gray-400 text-center">
								Updated: {new Date(game.lastUpdated).toLocaleTimeString()}
							</div>
						{/if}
					</div>
				{/each}
			</div>

			{#if games.length === 0}
				<div class="text-center py-12">
					<div class="text-6xl mb-4">🏈</div>
					<h3 class="text-xl font-semibold text-gray-700 mb-2">No Games This Week</h3>
					<p class="text-gray-500">Check back when games are scheduled for Week {week}</p>
				</div>
			{/if}
		{/if}

		<!-- Quick Navigation -->
		<div class="mt-8 text-center">
			<div class="inline-flex space-x-2">
				<a href="/picks/{week}" class="btn btn-primary">View Picks</a>
				<a href="/draft/{week}" class="btn btn-outline">Draft</a>
			</div>
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
	
	.btn-ghost {
		@apply text-gray-600 hover:text-gray-800 hover:bg-gray-100;
	}
</style>