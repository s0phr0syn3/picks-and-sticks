<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';
	
	export let data: PageData;
	export let form: ActionData;
	
	let selectedWeek = data.selectedWeek;
	let draftOrder = [...data.draftOrder];
	let isReordering = false;
	let draggedIndex: number | null = null;
	
	// Update local state when data changes (after redirects), but not during reordering
	$: {
		selectedWeek = data.selectedWeek;
		if (!isReordering) {
			draftOrder = [...data.draftOrder];
		}
	}
	
	// Check for success messages in URL
	let successMessage = '';
	$: {
		const urlParams = new URLSearchParams($page.url.search);
		if (urlParams.get('generated') === 'true') {
			successMessage = `Draft order generated for Week ${selectedWeek}`;
		} else if (urlParams.get('reordered') === 'true') {
			successMessage = `Draft order updated for Week ${selectedWeek}`;
		} else {
			successMessage = '';
		}
	}
	
	function changeWeek(week: number) {
		goto(`/admin/draft-order?week=${week}`);
	}
	
	function startReordering() {
		isReordering = true;
	}
	
	function cancelReordering() {
		isReordering = false;
		draftOrder = [...data.draftOrder];
	}
	
	function moveUp(index: number) {
		if (index > 0) {
			const newOrder = [...draftOrder];
			[newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
			draftOrder = newOrder;
		}
	}
	
	function moveDown(index: number) {
		if (index < draftOrder.length - 1) {
			const newOrder = [...draftOrder];
			[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
			draftOrder = newOrder;
		}
	}
	
	function handleDragStart(event: DragEvent, index: number) {
		draggedIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/html', '');
		}
	}
	
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}
	
	function handleDrop(event: DragEvent, dropIndex: number) {
		event.preventDefault();
		if (draggedIndex !== null && draggedIndex !== dropIndex) {
			const newOrder = [...draftOrder];
			const draggedItem = newOrder[draggedIndex];
			newOrder.splice(draggedIndex, 1);
			newOrder.splice(dropIndex, 0, draggedItem);
			draftOrder = newOrder;
		}
		draggedIndex = null;
	}
	
	function saveNewOrder() {
		const form = document.getElementById('reorderForm') as HTMLFormElement;
		const newOrderInput = document.getElementById('newOrderInput') as HTMLInputElement;
		newOrderInput.value = JSON.stringify(draftOrder);
		form.submit();
	}
	
</script>

<svelte:head>
	<title>Draft Order Management | Admin | Picks and Sticks</title>
</svelte:head>

<main class="container mx-auto px-6 py-8 max-w-6xl">
	<div class="bg-white rounded-xl shadow-lg p-6">
		<div class="flex items-center justify-between mb-8">
			<h1 class="text-3xl font-bold text-gray-800">Draft Order Management</h1>
			<a href="/admin" class="text-blue-600 hover:text-blue-700">← Back to Admin</a>
		</div>
		
		<!-- Week Selector -->
		<div class="mb-6">
			<label class="block text-sm font-medium text-gray-700 mb-2">Select Week:</label>
			<div class="flex flex-wrap gap-2">
				{#each data.weeks as week}
					<button
						class="px-3 py-2 rounded-md text-sm font-medium transition-colors {selectedWeek === week ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
						on:click={() => changeWeek(week)}
					>
						Week {week}
					</button>
				{/each}
			</div>
		</div>
		
		{#if form?.error}
			<div class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
				{form.error}
			</div>
		{/if}
		
		{#if form?.success}
			<div class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
				{form.message}
			</div>
		{/if}
		
		{#if successMessage}
			<div class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
				{successMessage}
			</div>
		{/if}
		
		<!-- Draft Status and Actions -->
		<div class="mb-6 p-4 bg-gray-50 rounded-lg">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="text-lg font-semibold text-gray-800">Week {selectedWeek} Draft Order</h3>
					<p class="text-sm text-gray-600">
						{#if data.weekExists}
							✅ Draft order exists for this week
						{:else}
							⚠️ No draft order set - showing system-generated preview
						{/if}
					</p>
				</div>
				<div class="flex space-x-3">
					{#if !isReordering}
						<form method="POST" action="?/generateDraftOrder" use:enhance class="inline">
							<input type="hidden" name="week" value={selectedWeek} />
							<button
								type="submit"
								class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
								on:click={(e) => {
									if (!confirm(`Generate/regenerate draft order for Week ${selectedWeek}? This will ${data.weekExists ? 'replace the existing order and reset all picks' : 'create the draft order'}.`)) {
										e.preventDefault();
									}
								}}
							>
								{data.weekExists ? 'Regenerate' : 'Generate'} Order
							</button>
						</form>
						{#if data.weekExists}
							<button
								on:click={startReordering}
								class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
							>
								Manual Reorder
							</button>
						{/if}
					{:else}
						<button
							on:click={saveNewOrder}
							class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
						>
							Save New Order
						</button>
						<button
							on:click={cancelReordering}
							class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
						>
							Cancel
						</button>
					{/if}
				</div>
			</div>
		</div>
		
		<!-- Hidden form for reordering -->
		<form id="reorderForm" method="POST" action="?/reorderPicks" style="display: none;" use:enhance>
			<input type="hidden" name="week" value={selectedWeek} />
			<input id="newOrderInput" type="hidden" name="newOrder" value="" />
		</form>
		
		{#if isReordering}
			<div class="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
				<p class="text-blue-800 text-sm">
					<strong>Reordering Mode:</strong> Drag and drop picks to reorder, or use the arrow buttons. 
					The overall pick number will update automatically based on position.
				</p>
			</div>
		{/if}
		
		<!-- Draft Order Table -->
		<div class="overflow-x-auto">
			<table class="w-full table-auto">
				<thead>
					<tr class="bg-gray-100 text-left">
						<th class="px-4 py-3 font-semibold">Overall Pick</th>
						<th class="px-4 py-3 font-semibold">Round</th>
						<th class="px-4 py-3 font-semibold">Pick in Round</th>
						<th class="px-4 py-3 font-semibold">Player</th>
						<th class="px-4 py-3 font-semibold">Stuck By</th>
						{#if isReordering}
							<th class="px-4 py-3 font-semibold">Actions</th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each draftOrder as pick, index}
						<tr
							class="border-b hover:bg-gray-50 {isReordering ? 'cursor-move' : ''}"
							draggable={isReordering}
							on:dragstart={(e) => handleDragStart(e, index)}
							on:dragover={handleDragOver}
							on:drop={(e) => handleDrop(e, index)}
						>
							<td class="px-4 py-3 font-bold text-lg">#{index + 1}</td>
							<td class="px-4 py-3">
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
									{Math.floor(index / 5) + 1}
								</span>
							</td>
							<td class="px-4 py-3">{(index % 5) + 1}</td>
							<td class="px-4 py-3">
								<div class="font-medium text-gray-900">{pick.fullName}</div>
							</td>
							<td class="px-4 py-3 text-sm text-gray-600">
								{pick.assignedByFullName || '—'}
							</td>
							{#if isReordering}
								<td class="px-4 py-3">
									<div class="flex space-x-1">
										<button
											on:click={() => moveUp(index)}
											disabled={index === 0}
											class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											↑
										</button>
										<button
											on:click={() => moveDown(index)}
											disabled={index === draftOrder.length - 1}
											class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											↓
										</button>
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		
		<div class="mt-6 text-gray-600">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
				<div>
					<h4 class="font-semibold text-gray-800 mb-2">Draft Rules:</h4>
					<ul class="space-y-1">
						<li>• Round 1: Lowest to highest points (from previous week)</li>
						<li>• Round 2: Highest to lowest points (snake draft)</li>
						<li>• Round 3 & 4: Players pick for each other</li>
					</ul>
				</div>
				<div>
					<h4 class="font-semibold text-gray-800 mb-2">Actions:</h4>
					<ul class="space-y-1">
						<li>• <strong>Generate Order:</strong> Creates/recreates order based on system rules</li>
						<li>• <strong>Manual Reorder:</strong> Drag and drop or use arrows to customize order</li>
						<li>• Week 1 uses random order since no previous scores exist</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</main>