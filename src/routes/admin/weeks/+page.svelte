<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	
	export let data: PageData;
	export let form: ActionData;
	
	let editingWeek: number | null = null;
	let punishmentText = '';
	
	function startEditPunishment(week: any) {
		editingWeek = week.weekNumber;
		punishmentText = week.punishment;
	}
	
	function cancelEdit() {
		editingWeek = null;
		punishmentText = '';
	}
	
	$: if (form?.success) {
		cancelEdit();
	}
</script>

<svelte:head>
	<title>Week Management | Admin | Picks and Sticks</title>
</svelte:head>

<main class="container mx-auto px-6 py-8 max-w-6xl">
	<div class="bg-white rounded-xl shadow-lg p-6">
		<div class="flex items-center justify-between mb-8">
			<h1 class="text-3xl font-bold text-gray-800">Week Management</h1>
			<a href="/admin" class="text-blue-600 hover:text-blue-700">← Back to Admin</a>
		</div>
		
		{#if form?.error}
			<div class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
				{form.error}
			</div>
		{/if}
		
		{#if form?.success && form?.resetWeek}
			<div class="mb-4 p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-lg">
				{form.message}
			</div>
		{:else if form?.success}
			<div class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
				Punishment updated successfully!
			</div>
		{/if}
		
		<div class="overflow-x-auto">
			<table class="w-full table-auto">
				<thead>
					<tr class="bg-gray-100 text-left">
						<th class="px-4 py-3 font-semibold">Week</th>
						<th class="px-4 py-3 font-semibold">Punishment (for following week)</th>
						<th class="px-4 py-3 font-semibold">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.weeks as week}
						<tr class="border-b hover:bg-gray-50">
							<td class="px-4 py-3 font-bold">Week {week.weekNumber}</td>
							{#if editingWeek === week.weekNumber}
								<td class="px-4 py-3">
									<textarea
										bind:value={punishmentText}
										class="w-full px-2 py-1 border rounded resize-none"
										rows="3"
										placeholder="Enter punishment for week {week.weekNumber + 1} draft..."
									></textarea>
								</td>
								<td class="px-4 py-3">
									<form method="POST" action="?/updatePunishment" use:enhance class="inline">
										<input type="hidden" name="weekNumber" value={week.weekNumber} />
										<input type="hidden" name="punishment" value={punishmentText} />
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
								<td class="px-4 py-3">
									{#if week.punishment}
										<div class="whitespace-pre-wrap text-sm">{week.punishment}</div>
									{:else}
										<span class="text-gray-400 italic">No punishment set</span>
									{/if}
								</td>
								<td class="px-4 py-3">
									<button
										on:click={() => startEditPunishment(week)}
										class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 mr-2 mb-1"
									>
										{week.punishment ? 'Edit' : 'Add'} Punishment
									</button>
									<form method="POST" action="?/resetWeekPicks" use:enhance class="inline"
										on:submit|preventDefault={(e) => {
											if (confirm(`Reset ALL picks for Week ${week.weekNumber}? This cannot be undone.`)) {
												e.currentTarget.submit();
											}
										}}
									>
										<input type="hidden" name="weekNumber" value={week.weekNumber} />
										<button
											type="submit"
											class="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 mb-1"
										>
											Reset Picks
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
			<p class="text-sm">
				<strong>Note:</strong> Punishment text entered for a week will be displayed during the following week's draft.
				For example, punishment text for Week 1 will be shown during Week 2's draft.
			</p>
		</div>
	</div>
</main>