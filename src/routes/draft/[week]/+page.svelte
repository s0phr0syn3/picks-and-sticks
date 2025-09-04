<script lang="ts">
	import { enhance } from '$app/forms';
	import type { DraftPageData, DraftPick, AvailableTeam } from '$lib/types';
	import type { ActionData } from './$types';

	export let data: DraftPageData;
	export let form: ActionData;

	let draftState: DraftPick[] = data.draftState;
	let availableTeams: AvailableTeam[] = data.availableTeams;
	let week: number = data.week;
	let currentPick = draftState.find((pick) => !pick.teamId);
	let selectedTeam: AvailableTeam | null = null;
	
	// Check if this is a future week with no meaningful draft data
	let isDraftReady = draftState && draftState.length > 0;

	console.log('Current pick:', currentPick);
	console.log('Available Teams:', availableTeams);

	function goToPicks(week: number) {
		window.location.href = `/picks/${week}`;
	}
	
	function changeWeek(direction: number) {
		const newWeek = week + direction;
		if (newWeek >= 1 && newWeek <= 18) {
			window.location.href = `/draft/${newWeek}`;
		}
	}

	function selectTeam(team: AvailableTeam) {
		selectedTeam = team;
	}

	function confirmPick() {
		if (selectedTeam && currentPick) {
			pickTeam(currentPick.id, selectedTeam.teamId);
		}
	}

	async function pickTeam(pickId: number, teamId: number) {
		if (!currentPick) return;

		try {
			const res = await fetch(`/api/draft/${week}/select-team`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pickId, teamId })
			});

			if (res.ok) {
				if (!currentPick) {
					window.location.href = `/picks/${week}`;
				} else {
					window.location.reload();
				}
			} else {
				console.error(`Failed to select team: ${await res.text()}`);
			}
		} catch (error) {
			console.error(`Error selecting team: ${error}`);
		}
	}
</script>

<svelte:head>
	<title>Draft Week {week} | Picks and Sticks</title>
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
	<!-- Header -->
	<div class="bg-white shadow-md">
		<div class="container mx-auto px-6 py-6">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<h1 class="text-4xl font-bold text-gray-800">
						🏈 Week {week} Draft
					</h1>
					<span class="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
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
					<a href="/picks/{week}" class="btn btn-primary">View Picks</a>
				</div>
			</div>
		</div>
	</div>

	<div class="container mx-auto px-6 py-8">
		<!-- Previous Week Punishment -->
		{#if data.previousWeekPunishment}
			<div class="bg-gradient-to-r from-red-500 to-pink-600 text-white p-6 rounded-xl shadow-lg mb-8">
				<div class="text-center">
					<div class="text-sm uppercase tracking-wide opacity-90 mb-2">Punishment from Week {week - 1}</div>
					<div class="text-lg whitespace-pre-wrap">{data.previousWeekPunishment}</div>
					<p class="text-sm opacity-90 mt-2">Awarded to whoever had the lowest points last week</p>
				</div>
			</div>
		{/if}

		<!-- Current Pick Banner -->
		{#if !isDraftReady}
			<!-- Future week with no draft order determined yet -->
			<div class="bg-gradient-to-r from-gray-500 to-gray-600 text-white p-6 rounded-xl shadow-lg mb-8 text-center">
				<h2 class="text-2xl font-bold">📅 Week {week} Draft</h2>
				<p class="mt-2 opacity-90">Draft order will be determined after Week {week - 1} completes</p>
				<p class="text-sm opacity-75 mt-1">Check back when the previous week's results are final</p>
			</div>
		{:else if currentPick}
			<!-- Active draft with current pick -->
			<div class="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-xl shadow-lg mb-8">
				<div class="text-center">
					<div class="text-sm uppercase tracking-wide opacity-90 mb-2">On the Clock</div>
					{#if currentPick?.assignedById}
						<h2 class="text-2xl font-bold">
							{currentPick?.assignedByFullName} sticking {currentPick?.fullName}
						</h2>
						<p class="text-sm opacity-90 mt-1">Round {currentPick.round} • Pick {currentPick.orderInRound}</p>
					{:else}
						<h2 class="text-2xl font-bold">{currentPick?.fullName}</h2>
						<p class="text-sm opacity-90 mt-1">Round {currentPick.round} • Pick {currentPick.orderInRound}</p>
					{/if}
				</div>
			</div>
		{:else}
			<!-- Draft completed -->
			<div class="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-xl shadow-lg mb-8 text-center">
				<h2 class="text-2xl font-bold">🎉 Draft Complete!</h2>
				<p class="mt-2 opacity-90">All picks have been made for Week {week}</p>
				<button class="btn btn-primary mt-4" on:click={() => goToPicks(week)}>
					View Final Results →
				</button>
			</div>
		{/if}

		<!-- Form Messages -->
		{#if form?.error}
			<div class="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
				{form.error}
			</div>
		{/if}

		{#if form?.success}
			<div class="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
				{form.message}
			</div>
		{/if}

		<!-- Punishment Management -->
		<div class="bg-white rounded-xl shadow-lg p-6 mb-8">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-xl font-semibold text-gray-800">⚡ Week {week} Punishment</h3>
				<span class="text-sm text-gray-600">For Week {week + 1} Draft</span>
			</div>
			
			<div class="text-sm text-gray-600 mb-4">
				<p><strong>Note:</strong> This punishment will be shown during Week {week + 1}'s draft and awarded to whoever has the lowest points from Week {week}.</p>
			</div>

			{#if data.currentWeekPunishment}
				<div class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
					<div class="text-sm font-medium text-yellow-800 mb-1">Current Punishment:</div>
					<div class="text-yellow-900 whitespace-pre-wrap">{data.currentWeekPunishment}</div>
				</div>
			{/if}

			<form method="POST" action="?/updatePunishment" use:enhance class="space-y-4">
				<div>
					<label for="punishment" class="block text-sm font-medium text-gray-700 mb-2">
						{data.currentWeekPunishment ? 'Update' : 'Set'} Punishment:
					</label>
					<textarea
						id="punishment"
						name="punishment"
						rows="3"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
						placeholder="Enter the punishment for the player with the lowest points this week..."
						value={data.currentWeekPunishment}
					></textarea>
				</div>
				<div class="flex items-center space-x-3">
					<button
						type="submit"
						class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						{data.currentWeekPunishment ? 'Update' : 'Set'} Punishment
					</button>
					{#if data.currentWeekPunishment}
						<form method="POST" action="?/updatePunishment" use:enhance class="inline">
							<input type="hidden" name="punishment" value="" />
							<button
								type="submit"
								class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
								on:click={(e) => {
									if (!confirm('Clear the punishment for this week?')) {
										e.preventDefault();
									}
								}}
							>
								Clear Punishment
							</button>
						</form>
					{/if}
				</div>
			</form>
		</div>

		{#if isDraftReady}
		<div class="grid lg:grid-cols-3 gap-8">
			<!-- Draft Board -->
			<div class="lg:col-span-2">
				<div class="bg-white rounded-xl shadow-lg p-6">
					<h3 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
						📋 Draft Board
					</h3>
					
					<div class="overflow-x-auto">
						<table class="min-w-full">
							<thead>
								<tr class="border-b-2 border-gray-200">
									<th class="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase">Round</th>
									<th class="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase">Pick</th>
									<th class="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase">Player</th>
									<th class="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase">Team</th>
									<th class="py-3 px-4 text-left text-sm font-semibold text-gray-600 uppercase">Stuck By</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200">
								{#each draftState as pick, index}
									<tr class="hover:bg-gray-50 transition-colors {pick.teamId === null && pick.id === currentPick?.id ? 'bg-green-50 border-l-4 border-green-500' : ''}">
										<td class="py-3 px-4">
											<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
												{pick.round}
											</span>
										</td>
										<td class="py-3 px-4 text-sm text-gray-600">{pick.overallPickOrder}</td>
										<td class="py-3 px-4">
											<div class="font-medium text-gray-900">{pick.fullName}</div>
										</td>
										<td class="py-3 px-4">
											{#if pick.team}
												<div class="flex items-center space-x-2">
													<span class="text-sm font-medium text-gray-900">{pick.team}</span>
												</div>
											{:else}
												<span class="text-sm text-gray-400 italic">Selecting...</span>
											{/if}
										</td>
										<td class="py-3 px-4 text-sm text-gray-600">
											{pick.assignedByFullName || '—'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<!-- Team Selection -->
			<div class="lg:col-span-1">
				<div class="bg-white rounded-xl shadow-lg p-6">
					<h3 class="text-xl font-semibold text-gray-800 mb-4 flex items-center">
						🏟️ Available Teams
						<span class="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
							{availableTeams.length}
						</span>
					</h3>

					{#if currentPick}
						<!-- Selected Team Display -->
						{#if selectedTeam}
							<div class="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
								<div class="text-center">
									<div class="text-sm text-green-600 font-medium mb-1">Selected Team</div>
									<div class="font-bold text-green-800">{selectedTeam.name}</div>
									<button 
										class="btn btn-success btn-sm mt-3 w-full"
										on:click={confirmPick}
									>
										✓ Confirm Pick
									</button>
								</div>
							</div>
						{/if}

						<!-- Team Grid -->
						<div class="max-h-96 overflow-y-auto space-y-2">
							{#each availableTeams as team}
								<button
									class="w-full text-left p-3 rounded-lg border-2 transition-all duration-200 hover:shadow-md {selectedTeam?.teamId === team.teamId ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-200 hover:border-gray-300'}"
									on:click={() => selectTeam(team)}
								>
									<div class="font-medium text-gray-900">{team.name}</div>
								</button>
							{/each}
						</div>
					{:else}
						<div class="text-center text-gray-500 py-8">
							<div class="text-4xl mb-2">🎯</div>
							<p>Draft is complete!</p>
						</div>
					{/if}
				</div>

				<!-- Draft Progress -->
				<div class="bg-white rounded-xl shadow-lg p-6 mt-6">
					<h4 class="font-semibold text-gray-800 mb-3">Draft Progress</h4>
					{#if draftState.length > 0}
						{@const totalPicks = draftState.length}
						{@const completedPicks = draftState.filter(pick => pick.teamId !== null).length}
						{@const progress = (completedPicks / totalPicks) * 100}
						
						<div class="flex items-center justify-between text-sm text-gray-600 mb-2">
							<span>{completedPicks} of {totalPicks} picks made</span>
							<span>{Math.round(progress)}%</span>
						</div>
						<div class="w-full bg-gray-200 rounded-full h-2">
							<div 
								class="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-500"
								style="width: {progress}%"
							></div>
						</div>
					{/if}
				</div>
			</div>
		</div>
		{/if}
	</div>
</main>

<style>
	.btn {
		@apply px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2;
	}
	
	.btn-primary {
		@apply bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500;
	}
	
	.btn-success {
		@apply bg-green-600 text-white hover:bg-green-700 focus:ring-green-500;
	}
	
	.btn-ghost {
		@apply text-gray-600 hover:text-gray-800 hover:bg-gray-100;
	}
</style>