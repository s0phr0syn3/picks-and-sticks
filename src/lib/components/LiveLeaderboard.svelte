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
		picks: PickDetail[];
		lastUpdated: string;
	}

	interface PickDetail {
		id: number;
		userId: string;
		fullName: string;
		teamId: number;
		team: string;
		round: number;
		orderInRound: number;
		overallPickOrder: number;
		points: number;
		gameDate?: string;
		isLive?: boolean;
		isComplete?: boolean;
		homeTeamName?: string;
		awayTeamName?: string;
		homeTeamId?: number;
		awayTeamId?: number;
		quarter?: string;
		timeRemaining?: string;
		reasoning?: string | null;
	}

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

	let leaderboard: LeaderboardEntry[] = [];
	let games: GameStatus[] = [];
	let lastUpdated: string = '';
	let loading = false;
	let error: string | null = null;
	let updateInterval: number;
	let expandedUsers: Set<string> = new Set();

	function toggleUserExpanded(userId: string) {
		if (expandedUsers.has(userId)) {
			expandedUsers.delete(userId);
		} else {
			expandedUsers.add(userId);
		}
		expandedUsers = expandedUsers; // Trigger reactivity
	}

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
		const date = new Date(isoString);
		// Show date and time in a concise format
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
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
	
	function getOpponentText(pick: PickDetail): string {
		if (!pick.homeTeamName || !pick.awayTeamName || !pick.team) {
			return '';
		}
		
		// Check if the selected team is home or away
		if (pick.team === pick.homeTeamName) {
			// Selected team is home, show "vs opponent"
			return `vs ${pick.awayTeamName}`;
		} else if (pick.team === pick.awayTeamName) {
			// Selected team is away, show "@ opponent"
			return `@ ${pick.homeTeamName}`;
		}
		
		return '';
	}
	
	function getGameStatusForPick(pick: PickDetail): string {
		if (pick.isComplete) {
			return 'Final';
		}
		
		if (pick.isLive && pick.quarter && pick.timeRemaining) {
			return `${pick.quarter} - ${pick.timeRemaining}`;
		} else if (pick.isLive) {
			return 'Live';
		}
		
		// Show game date/time for upcoming games
		if (pick.gameDate) {
			const gameTime = new Date(pick.gameDate);
			const now = new Date();

			// Always show day of week and time to distinguish games across different days
			const day = gameTime.toLocaleDateString('en-US', { weekday: 'short' });
			const time = gameTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

			// If game is today, emphasize it
			if (gameTime.toDateString() === now.toDateString()) {
				return `Today ${time}`;
			}

			// If game is tomorrow
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			if (gameTime.toDateString() === tomorrow.toDateString()) {
				return `Tomorrow ${time}`;
			}

			// For all other games within the current season, show day and time
			const diffDays = Math.ceil((gameTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
			if (diffDays <= 14 && diffDays >= -1) {
				return `${day} ${time}`;
			}

			// For games further out, show full date
			return gameTime.toLocaleDateString('en-US', {
				weekday: 'short',
				month: 'short',
				day: 'numeric',
				hour: 'numeric',
				minute: '2-digit'
			});
		}
		
		return 'TBD';
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
					<div class="rounded-lg border {index === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}">
						<!-- Player Header (Clickable) -->
						<button 
							class="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 transition-colors rounded-lg"
							on:click={() => toggleUserExpanded(player.userId)}
						>
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
							<div class="flex items-center space-x-3">
								<div class="text-right">
									<div class="text-2xl font-bold {index === 0 ? 'text-yellow-700' : 'text-gray-900'}">
										{player.currentPoints}
									</div>
									<div class="text-sm text-gray-500">pts</div>
								</div>
								<div class="text-gray-400 transition-transform {expandedUsers.has(player.userId) ? 'rotate-90' : ''}">
									▶
								</div>
							</div>
						</button>

						<!-- Expandable Picks Section -->
						{#if expandedUsers.has(player.userId)}
							<div class="border-t border-gray-200 p-4 bg-white">
								<h4 class="font-semibold text-gray-800 mb-3">Picks</h4>
								<div class="space-y-2">
									{#each [...player.picks].sort((a, b) => {
									// First priority: Live games
									if (a.isLive && !b.isLive) return -1;
									if (!a.isLive && b.isLive) return 1;

									// Second priority: Completed games with points (highest first)
									if (a.points !== null && a.points !== undefined && b.points !== null && b.points !== undefined) {
										return b.points - a.points;
									}
									if (a.points !== null && a.points !== undefined) return -1;
									if (b.points !== null && b.points !== undefined) return 1;

									// Third priority: Sort by game date/time (earliest first)
									if (a.gameDate && b.gameDate) {
										return new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime();
									}

									// Fallback to round order
									return a.round - b.round;
								}) as pick}
									<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
										<div class="flex items-center space-x-3 flex-1 min-w-0">
											<div class="text-sm text-gray-500 flex-shrink-0">{pick.round}</div>
											<div class="flex-1 min-w-0">
												<div class="font-medium text-gray-900">{pick.team || 'TBD'}</div>
												<div class="text-xs text-gray-500">
													{getOpponentText(pick) || `Pick #${pick.overallPickOrder}`}
												</div>
												{#if pick.reasoning}
													<div class="text-xs text-gray-600 italic mt-1">
														{pick.reasoning}
													</div>
												{/if}
											</div>
										</div>
										<div class="text-right flex-shrink-0 ml-4">
											{#if pick.points !== null && pick.points !== undefined}
												<div class="font-bold {pick.points > 0 ? 'text-green-600' : 'text-gray-600'}">
													{pick.points} pts
												</div>
											{/if}
											<div class="text-sm {pick.isComplete ? 'text-gray-500' : pick.isLive ? 'text-red-600' : 'text-gray-500'}">
												{#if pick.isComplete}
													Final
												{:else}
													{getGameStatusForPick(pick)}
												{/if}
											</div>
											{#if pick.isLive}
												<div class="text-xs text-red-500 animate-pulse">● Live</div>
											{/if}
										</div>
									</div>
								{/each}
								</div>
							</div>
						{/if}
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
								<span class="font-medium">{game.awayTeamName} @ {game.homeTeamName}</span>
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
