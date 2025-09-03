<script lang="ts">
	import { goto } from '$app/navigation'
	import { onMount } from 'svelte'
	
	onMount(() => {
		goto('/picks/1')
	})
</script>

<svelte:head>
	<title>Picks and Sticks | NFL Pick Em Game</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
	<div class="text-center">
		<div class="text-8xl mb-6">🏈</div>
		<h1 class="text-4xl font-bold text-gray-800 mb-4">
			Picks and Sticks
		</h1>
		<p class="text-gray-600 text-lg">
			Loading your NFL picks game...
		</p>
	</div>
</div>
