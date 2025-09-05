<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	export let week: number;
	
	interface LeaderboardEntry {
		userId: string;
		fullName: string;
		currentPoints: number;
		completedGames: number;
		totalGames: number;
		lastUpdated: string;
	}

	interface GameStatus {
		eventId: number;
		homeTeamId: number;
		awayTeamId: number;
		homeScore: number;
		awayScore: number;
		quarter: string | null;
		timeRemaining: string | null;
		isLive: boolean;
		isComplete: boolean;
		lastUpdated: string;
	}

	let leaderboard: LeaderboardEntry[] = [];
	let games: GameStatus[] = [];
	let lastUpdated: string = '';
	let loading = false;
	let error: string | null = null;
	let updateInterval: number;

	onMount(() => {
		if (browser) {
			fetchLiveData();
			// Update every 30 seconds
			updateInterval = setInterval(fetchLiveData, 30000);
		}
	});

	onDestroy(() => {
		if (updateInterval) {
			clearInterval(updateInterval);
		}
	});

	async function fetchLiveData() {
		try {
			loading = true;
			error = null;
			
			const response = await fetch(`/api/live/scores/${week}`);
			const data = await response.json();
			
			if (data.success) {
				leaderboard = data.data.leaderboard;
				games = data.data.games;
				lastUpdated = data.data.lastUpdated;
			} else {
				error = data.error || 'Failed to fetch live data';
			}
		} catch (err) {
			error = 'Network error fetching live data';
			console.error('Live data fetch error:', err);
		} finally {
			loading = false;
		}
	}

	function formatTime(isoString: string): string {
		return new Date(isoString).toLocaleTimeString();
	}

	function getGameStatusText(game: GameStatus): string {
		if (game.isComplete) return 'Final';
		if (game.isLive) {
			if (game.quarter && game.timeRemaining) {
				return `${game.quarter} - ${game.timeRemaining}`;
			}
			return 'Live';
		}
		return 'Not Started';
	}

	$: liveGamesCount = games.filter(g => g.isLive).length;
	$: completedGamesCount = games.filter(g => g.isComplete).length;
</script>

<div class="bg-white rounded-xl shadow-lg p-6">
	<!-- Header -->
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-2xl font-bold text-gray-800 flex items-center">
			<span class="animate-pulse text-red-500 mr-2">🔴</span>
			Live Week {week} Scores
		</h2>
		<div class="text-sm text-gray-500">
			{#if lastUpdated}
				Updated: {formatTime(lastUpdated)}
			{/if}
			{#if loading}
				<span class="ml-2 inline-flex items-center">
					<div class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-1"></div>
					Updating...
				</span>
			{/if}
		</div>
	</div>

	<!-- Game Status Summary -->
	<div class="grid grid-cols-3 gap-4 mb-6">
		<div class="bg-green-50 p-3 rounded-lg text-center">
			<div class="text-2xl font-bold text-green-600">{completedGamesCount}</div>
			<div class="text-sm text-green-700">Completed</div>
		</div>
		<div class="bg-red-50 p-3 rounded-lg text-center">
			<div class="text-2xl font-bold text-red-600">{liveGamesCount}</div>
			<div class="text-sm text-red-700">Live Now</div>
		</div>
		<div class="bg-blue-50 p-3 rounded-lg text-center">
			<div class="text-2xl font-bold text-blue-600">{games.length - completedGamesCount - liveGamesCount}</div>
			<div class="text-sm text-blue-700">Upcoming</div>
		</div>
	</div>

	{#if error}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
			{error}
		</div>
	{/if}

	<!-- Leaderboard -->
	<div class="space-y-4">
		<h3 class="text-lg font-semibold text-gray-800">Current Standings</h3>
		
		{#if leaderboard.length === 0 && !loading}
			<div class="text-center py-8 text-gray-500">
				<div class="text-4xl mb-2">📊</div>
				<p>No live scores available yet</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each leaderboard as player, index}
					<div class="flex items-center justify-between p-4 rounded-lg border {index === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}">
						<div class="flex items-center space-x-3">
							<div class="w-8 h-8 rounded-full {index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-gray-300'} flex items-center justify-center text-white font-bold text-sm">
								{index + 1}
							</div>
							<div>
								<div class="font-medium text-gray-900">{player.fullName}</div>
								<div class="text-sm text-gray-500">
									{player.completedGames}/{player.totalGames} games complete
								</div>
							</div>
						</div>
						<div class="text-right">
							<div class="text-2xl font-bold {index === 0 ? 'text-yellow-700' : 'text-gray-900'}">
								{player.currentPoints}
							</div>
							<div class="text-sm text-gray-500">pts</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Live Games (if any) -->
	{#if liveGamesCount > 0}
		<div class="mt-8">
			<h3 class="text-lg font-semibold text-gray-800 mb-4">Live Games</h3>
			<div class="grid gap-3">
				{#each games.filter(g => g.isLive) as game}
					<div class="bg-red-50 border border-red-200 rounded-lg p-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center space-x-2">
								<span class="animate-pulse text-red-500">●</span>
								<span class="font-medium">Team {game.homeTeamId} vs Team {game.awayTeamId}</span>
							</div>
							<div class="text-right">
								<div class="font-bold">{game.homeScore} - {game.awayScore}</div>
								<div class="text-sm text-red-600">{getGameStatusText(game)}</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Manual Refresh Button -->
	<div class="mt-6 text-center">
		<button 
			on:click={fetchLiveData}
			disabled={loading}
			class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
		>
			{loading ? 'Updating...' : 'Refresh Now'}
		</button>
	</div>
</div>

<style>
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}
	
	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>