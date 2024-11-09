<script lang="ts">
	import { dndzone } from 'svelte-dnd-action'

	export let data: {
		draftState: any[],
		availableTeams: any[],
		week: number,
	}

	let draftState: any[] = data.draftState
	let availableTeams: any[] = data.availableTeams
	let week: number = data.week
	let currentPick = draftState.find(pick => !pick.teamId)
	let consideredTeam: any = null

	console.log('Current pick:', currentPick)
	console.log('Available Teams:', availableTeams)

	function goToPicks(week: number) {
		window.location.href = `/picks/${week}`
	}

	function handleConsider(event: any) {
		const { items, info } = event.detail
		consideredTeam = items.find((item: any) => item.teamId === info.id)

		if (consideredTeam) {
			console.log(`${currentPick?.fullName} is considering picking ${consideredTeam?.name}`)
		} else {
			console.error(`Considered team is undefined`)
		}
	}

	function handleFinalize(event: any) {
		const { info } = event.detail

		if (consideredTeam) {
			console.log(`Finalizing the pick: ${consideredTeam?.name} for ${currentPick?.fullName}`)
			pickTeam(currentPick.id, consideredTeam.teamId);
			availableTeams = availableTeams.filter((team: any) => team.teamId !== consideredTeam.teamId)
		} else {
			console.error(`Error finalizing the pick`)
		}
	}

  async function pickTeam(pickId: number, teamId: number) {
		if (!currentPick) return

		try {
			const res = await fetch(`/api/draft/${week}/select-team`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pickId, teamId })
			})

			if (res.ok) {
				if (!currentPick) {
					window.location.href = `/picks/${week}`
				} else {
					window.location.reload()
				}
			} else {
				console.error(`Failed to select team: ${await res.text()}`)
			}
		} catch (error) {
			console.error(`Error selecting team: ${error}`)
		}
	}
</script>

<main class="min-h-screen bg-gray-100 py-10">
	<div class="container mx-auto px-4">
		<h1 class="text-4xl font-bold text-center text-[#007030] mb-8">Draft for Week {week}</h1>

		<div class="flex justify-between gap-10">
			<div class="w-2/3">
				<h2 class="text-2xl font-bold text-[#007030] mb-4">Current Picks</h2>
				{#if currentPick?.assignedById}
					<h3 class="text-xl font-bold text-[#007030] mb-4">On the clock: {currentPick?.assignedByFullName}, sticking {currentPick?.fullName}</h3>
				{:else}
					<h3 class="text-xl font-bold text-[#007030] mb-4">On the clock: {currentPick?.fullName || 'Nobody'}</h3>
					{#if !currentPick}
						<button class="btn btn-primary text-lg" on:click={() => goToPicks(week)}>Go to picks!</button>
					{/if}
				{/if}

				<!-- Drop Zone for Current Pick -->
				<div class="mb-6">
					{#if currentPick}
						<div class="bg-gray-200 p-6 rounded-lg text-center shadow-lg border-4 border-dashed border-gray-400 dropzone"
								 role="application"
								 aria-label="Drop zone for selecting a team"
								 on:dragover={(event) => event.preventDefault()}>
							<h3 class="text-xl">Drag team here</h3>
						</div>
					{/if}
				</div>

				<table class="min-w-full table-auto border-collapse bg-white shadow-lg rounded-lg">
					<thead class="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
					<tr>
						<th class="py-3 px-6 text-left">Round</th>
						<th class="py-3 px-6 text-left">Player</th>
						<th class="py-3 px-6 text-left">Team</th>
						<th class="py-3 px-6 text-left">Stuck By</th>
					</tr>
					</thead>
					<tbody class="text-gray-700 text-sm">
					{#each draftState as pick}
						<tr class="border-b hover:bg-gray-100">
							<td class="py-3 px-6">{pick.round}</td>
							<td class="py-3 px-6">{pick.fullName}</td>
							<td class="py-3 px-6">{pick.team ? pick.team : 'TBD'}</td>
							<td class="py-3 px-6">{pick.assignedByFullName ? pick.assignedByFullName : ''}</td>
						</tr>
					{/each}
					</tbody>
				</table>
			</div>

			<!-- Available Teams List -->
			<div class="w-1/3">
				<h2 class="text-2xl font-bold text-[#007030] mb-4">Available Teams</h2>
				<section class="grid grid-cols-2 gap-4"
								 use:dndzone={{ items: availableTeams }}
								 on:consider={handleConsider}
								 on:finalize={handleFinalize}
				>
					{#each availableTeams as team (team.teamId)}
						<div class="bg-white p-4 shadow rounded cursor-pointer hover:bg-gray-200">{team.name}</div>
					{/each}
						<div class="bg-white p-4 shadow rounded cursor-pointer hover:bg-gray-200 hidden"></div>
				</section>
			</div>
		</div>
	</div>
</main>

<style>
	.dropzone {
		background-color: #FEE11A; /* Secondary Color */
		border: 2px dashed #007030; /* Primary Color */
		padding: 20px;
		text-align: center;
		transition: background-color 0.2s ease-in-out;
	}

	.dropzone:hover {
		background-color: #FFF599;
	}
</style>
