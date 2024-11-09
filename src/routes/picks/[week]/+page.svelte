<script lang="ts">
	export let data: {
		picks: any[],
		totalPoints: any[],
		week: number
	}

	let week: number = data.week
	let picks: any[] = data.picks
	let totalPoints: any[] = data.totalPoints

  if (!Array.isArray(picks)) {
    picks = []
  }

  function changeWeek(direction: number) {
    const currentWeek: number = Number(week)
    const newWeek: number = currentWeek + direction
    if (newWeek < 1) {
      return
    }
    window.location.href = `/picks/${newWeek}`
  }

	async function startDraft() {
		console.log(`Week is: ${week}`)
		try {
			console.log(`Fetching data from /api/picks/${week}/start-draft`)
			const res = await fetch(`/api/picks/${week}/start-draft`, {
				method: "POST",
			})

			if (res.ok) {
				window.location.href = `/draft/${week}`
			} else {
				console.error(res)
				alert('Failed to start the draft.')
			}
		} catch (error) {
			console.error('Error starting the draft: ', error)
			alert('An error occurred while trying to start the draft.')
		}
	}
</script>

<main class="min-h-screen bg-gray-100 py-10">
  <div class="container mx-auto px-4">
    <h1 class="text-4xl font-bold text-center text-[#007030] mb-8">Picks for Week {week}</h1>

    <div class="flex justify-between mb-6">
      <button class="btn btn-primary text-lg" on:click={() => changeWeek(-1)} disabled={week <= 1}>Previous Week</button>
      <button class="btn btn-secondary text-lg float-right" on:click={() => changeWeek(1)} disabled={week >= 18}>Next Week</button>
    </div>
			<!-- No picks / start draft -->
			<div class="text-center py-6">
				{#if picks.length > 0 && picks.some(pick => pick.teamId === null)}
					<!-- Render draft interface since there are incomplete picks -->
					<h2 class="text-2xl font-bold">Draft is in progress for Week {week}</h2>
					<!-- Add logic here for draft interface, including drag-and-drop functionality -->
				{:else if picks.length > 0 && picks[0].teamId}
					<!-- Render the picks table -->
					<div class="flex space-x-8">
						<!-- Picks Table -->
						<div class="w-2/3 overflow-x-auto bg-white shadow-lg rounded-lg">
							<table class="min-w-full table-auto border-collapse">
								<thead class="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
								<tr>
									<th class="py-3 px-6 text-left">Round</th>
									<th class="py-3 px-6 text-left">Player</th>
									<th class="py-3 px-6 text-left">Team</th>
									<th class="py-3 px-6 text-left">Stuck By</th>
									<th class="py-3 px-6 text-left">Points</th>
								</tr>
								</thead>
								<tbody class="text-gray-700 text-sm">
								{#each picks as pick}
									<tr class="border-b hover:bg-gray-100">
										<td class="py-3 px-6">{pick.round}</td>
										<td class="py-3 px-6">{pick.fullName}</td>
										<td class="py-3 px-6">{pick.team}</td>
										<td class="py-3 px-6">{pick.assignedByFullName ? pick.assignedByFullName : ''}</td>
										<td class="py-3 px-6 font-bold">{pick.points ? pick.points : ''}</td>
									</tr>
								{/each}
								</tbody>
							</table>
						</div>

						<!-- Total Points -->
						<div class="w-1/3 overflow-x-auto bg-white shadow-lg, rounded-lg">
							<table class="min-w-full table-auto border-collapse">
								<thead class="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
								<tr>
									<th class="py-3 px-6 text-left">Player</th>
									<th class="py-3 px-6 text-left">Total Points</th>
								</tr>
								</thead>
								<tbody class="text-gray-700 text-sm">
								{#each totalPoints as total}
									<tr class="border-b hover:bg-gray-100">
										<td class="py-3 px-6">{total.fullName}</td>
										<td class="py-3 px-6 font-bold">{total.totalPoints ? total.totalPoints : 0}</td>
									</tr>
								{/each}
								</tbody>
							</table>
						</div>
					</div>
				{:else}
					<h2 class="text-2xl font-bold">No picks for Week {week} yet</h2>
					<button class="btn btn-primary" on:click={startDraft}>Start Draft for Week {week}</button>
				{/if}
			</div>
  </div>
</main>
