// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces

interface User {
	id: string;
	name: string;
	username: string;
}

interface Session {
	user: User;
}

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			getSession(): Promise<Session | null>
		}
		interface PageData {
			session: Session | null
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
