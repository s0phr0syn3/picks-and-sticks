<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	
	export let data
	$: session = data.session
	
	// Redirect to sign in if not authenticated (except for auth pages)
	onMount(() => {
		if (!session && !$page.url.pathname.startsWith('/auth')) {
			goto(`/auth/signin?callbackUrl=${encodeURIComponent($page.url.pathname)}`);
		}
	})
	
	async function signOut(event) {
		event.preventDefault();
		try {
			await fetch('/auth/signout', { method: 'POST' });
			// Force a full page reload to clear session state
			window.location.href = '/auth/signin';
		} catch (error) {
			console.error('Sign out error:', error);
			// Fallback to GET request if POST fails
			window.location.href = '/auth/signout';
		}
	}
</script>

{#if session}
	<!-- Authenticated Layout -->
	<div class="min-h-screen bg-gray-50">
		<!-- Navigation Header -->
		<nav class="bg-white shadow-sm border-b">
			<div class="container mx-auto px-6 py-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-4">
						<a href="/" class="flex items-center space-x-2">
							<span class="text-2xl">🏈</span>
							<span class="text-xl font-bold text-gray-800">Picks and Sticks</span>
						</a>
						<nav class="hidden md:flex space-x-6 ml-8">
							<a href="/picks/1" class="text-gray-600 hover:text-gray-800 transition-colors">Picks</a>
							<a href="/draft/1" class="text-gray-600 hover:text-gray-800 transition-colors">Draft</a>
							{#if session.user.username === 'ea'}
								<a href="/admin" class="text-gray-600 hover:text-gray-800 transition-colors">Admin</a>
							{/if}
						</nav>
					</div>
					
					<div class="flex items-center space-x-4">
						<div class="flex items-center space-x-3">
							<span class="text-gray-700 font-medium">Welcome, {session.user.name}!</span>
							<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">@{session.user.username}</span>
						</div>
						<a href="/profile" class="text-gray-500 hover:text-gray-700 transition-colors">
							Profile
						</a>
						<a 
							href="/auth/signout"
							class="text-gray-500 hover:text-gray-700 transition-colors"
							on:click={signOut}
						>
							Sign Out
						</a>
					</div>
				</div>
			</div>
		</nav>

		<slot />
	</div>
{:else}
	<!-- Unauthenticated Layout (for auth pages) -->
	<slot />
{/if}
