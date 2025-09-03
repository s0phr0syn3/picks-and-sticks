<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	
	let username = '';
	let firstName = '';
	let lastName = '';
	let password = '';
	let confirmPassword = '';
	let loading = false;
	
	const callbackUrl = $page.url.searchParams.get('callbackUrl') || '/';
	
	$: passwordsMatch = password === confirmPassword;
</script>

<svelte:head>
	<title>Register | Picks and Sticks</title>
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
	<div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
		<div class="text-center mb-8">
			<div class="text-6xl mb-4">🏈</div>
			<h1 class="text-3xl font-bold text-gray-800 mb-2">
				Join the Game!
			</h1>
			<p class="text-gray-600">
				Create your account for Picks and Sticks
			</p>
		</div>

		{#if $page.form?.error}
			<div class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
				{$page.form.error}
			</div>
		{/if}

		<form 
			method="POST" 
			action="?/register&callbackUrl={encodeURIComponent(callbackUrl)}"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
		>
			<div class="space-y-4">
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
						placeholder="Choose a username"
						disabled={loading}
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="firstName" class="block text-sm font-medium text-gray-700 mb-2">
							First Name
						</label>
						<input
							type="text"
							id="firstName"
							name="firstName"
							bind:value={firstName}
							required
							class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
							placeholder="First name"
							disabled={loading}
						/>
					</div>

					<div>
						<label for="lastName" class="block text-sm font-medium text-gray-700 mb-2">
							Last Name
						</label>
						<input
							type="text"
							id="lastName"
							name="lastName"
							bind:value={lastName}
							required
							class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
							placeholder="Last name"
							disabled={loading}
						/>
					</div>
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
						minlength="6"
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
						placeholder="Choose a password (min. 6 characters)"
						disabled={loading}
					/>
				</div>

				<div>
					<label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-2">
						Confirm Password
					</label>
					<input
						type="password"
						id="confirmPassword"
						name="confirmPassword"
						bind:value={confirmPassword}
						required
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 {confirmPassword && !passwordsMatch ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}"
						placeholder="Confirm your password"
						disabled={loading}
					/>
					{#if confirmPassword && !passwordsMatch}
						<p class="text-red-600 text-sm mt-1">Passwords do not match</p>
					{/if}
				</div>

				<button
					type="submit"
					disabled={loading || !passwordsMatch || !username || !firstName || !lastName || !password}
					class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{loading ? 'Creating Account...' : 'Create Account'}
				</button>
			</div>
		</form>

		<div class="mt-6 text-center">
			<p class="text-sm text-gray-600">
				Already have an account? 
				<a href="/auth/signin?callbackUrl={encodeURIComponent(callbackUrl)}" class="text-blue-600 hover:text-blue-700 font-medium">
					Sign in here
				</a>
			</p>
		</div>
	</div>
</main>