<script lang="ts">
  export let data: { picks: any[], totalPoints: any[], insult: string, week: number }

  let picks: any[] = data.picks
  let totalPoints: any[] = data.totalPoints
  let week: number = data.week
  let insult: string = data.insult

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
</script>

<main class="min-h-screen bg-gray-100 py-10">
  <div class="container mx-auto px-4">
    <h1 class="text-4xl font-bold text-center text-[#007030] mb-8">Picks for Week {week}</h1>

    <div class="flex justify-between mb-6">
      <button class="btn btn-primary text-lg" on:click={() => changeWeek(-1)} disabled={week <= 1}>Previous Week</button>
      <button class="btn btn-secondary text-lg float-right" on:click={() => changeWeek(1)} disabled={week >= 18}>Next Week</button>
    </div>

    <div class="overflow-x-auto bg-white shadow-lg rounded-lg">
      <table class="min-w-full table-auto border-collapse">
        <thead class="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
        <tr>
          <th class="py-3 px-6 text-left">Round</th>
          <th class="py-3 px-6 text-left">Who</th>
          <th class="py-3 px-6 text-left">Team</th>
          <th class="py-3 px-6 text-left">Assigned By</th>
          <th class="py-3 px-6 text-left">Points</th>
        </tr>
        </thead>
        <tbody class="text-gray-700 text-sm">
        {#if picks.length > 0 && picks[0].teamId}
          {#each picks as pick}
            <tr class="border-b hover:bg-gray-100">
              <td class="py-3 px-6">{pick.round}</td>
              <td class="py-3 px-6">{pick.fullName}</td>
              <td class="py-3 px-6">{pick.team}</td>
              <td class="py-3 px-6">{pick.assignedByFullName ? pick.assignedByFullName : ''}</td>
              <td class="py-3 px-6 font-bold">{pick.points ? pick.points : ''}</td>
            </tr>
          {/each}
        {:else}
          <tr>
            <td class="text-center py-6" colspan="5">No picks this week. <br /><br />{data.insult}</td>
          </tr>
        {/if}
        </tbody>
      </table>
    </div>

    {#if picks.length > 0 && picks[0].teamId}
    <div class="mt-8 overflow-x-auto bg-white shadow-lg rounded-lg">
      <table class="min-w-full table-auto border-collapse">
        <thead class="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
          <tr>
            <th class="py-3 px-6 text-left">Who</th>
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
    {/if}
  </div>
</main>
