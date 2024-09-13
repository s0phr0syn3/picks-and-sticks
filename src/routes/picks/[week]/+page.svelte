<script lang="ts">
  export let data: { picks: any[], week: number }

  let picks: any[] = data.picks
  let week: number = data.week

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

<main>
  <h1 class="text-4xl font-bold text-center">Picks for Week {week}</h1>

  <div class="mx-auto">
    <button class="btn btn-primary text-lg" on:click={() => changeWeek(-1)} disabled={week <= 1}>Previous Week</button>
    <button class="btn btn-secondary text-lg float-right" on:click={() => changeWeek(1)} disabled={week >= 18}>Next Week</button>

    <table class="table table-zebra">
      <thead>
      <tr class="text-xl text-center font-bold">
        <th class="w-1/5">Round</th>
        <th class="w-1/5">User</th>
        <th class="w-1/5">Team</th>
        <th class="w-1/5">Assigned By</th>
        <th class="w-1/5">Points</th>
      </tr>
      </thead>
      <tbody>
      {#if picks.length > 0}
        {#each picks as pick}
          <tr class="text-md text-center">
            <td>{pick.roundNum}</td>
            <td>{pick.fullName}</td>
            <td>{pick.teamName}</td>
            <td>{pick.assignedBy ? pick.assignedBy : ''}</td>
            <td class="font-extrabold">{pick.points ? pick.points : ''}</td>
          </tr>
        {/each}
      {:else}
        <tr>
          <td class="text-center" colspan="5">No picks available for this week.</td>
        </tr>
      {/if}
      </tbody>
    </table>
  </div>
</main>

<style>
</style>