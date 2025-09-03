<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	
	let username = '';
	let password = '';
	let loading = false;
	
	const callbackUrl = $page.url.searchParams.get('callbackUrl') || '/';
</script>

<svelte:head>
	<title>Sign In | Picks and Sticks</title>
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
	<div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
		<div class="text-center mb-8">
			<div class="text-6xl mb-4">🏈</div>
			<h1 class="text-3xl font-bold text-gray-800 mb-2">
				Welcome Back!
			</h1>
			<p class="text-gray-600">
				Sign in to continue to Picks and Sticks
			</p>
		</div>

		{#if $page.form?.error}
			<div class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
				{$page.form.error}
			</div>
		{/if}

		<form 
			method="POST" 
			action="?/signin&callbackUrl={encodeURIComponent(callbackUrl)}"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
		>
			<div class="space-y-6">
				<div>
					<label for="username" class="block text-sm font-medium text-gray-700 mb-2">
						Username
					</label>
					<input
						type="text"
						id="username"
						name="username"
						bind:value={username}
						required
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
						placeholder="Enter your username"
						disabled={loading}
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-gray-700 mb-2">
						Password
					</label>
					<input
						type="password"
						id="password"
						name="password"
						bind:value={password}
						required
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
						placeholder="Enter your password"
						disabled={loading}
					/>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? 'Signing In...' : 'Sign In'}
				</button>
			</div>
		</form>

		<div class="mt-6 text-center">
			<p class="text-sm text-gray-600">
				Don't have an account? 
				<a href="/auth/register?callbackUrl={encodeURIComponent(callbackUrl)}" class="text-blue-600 hover:text-blue-700 font-medium">
					Register here
				</a>
			</p>
		</div>

		<div class="mt-6 text-center text-sm text-gray-500">
			<p>
				Join the fun and make your NFL picks!
				<br>
				Good luck! 🍀
			</p>
		</div>
	</div>
</main>