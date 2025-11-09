// Type definitions for the Picks and Sticks application

// Database model types
export interface Team {
	id: number;
	teamId: number;
	name: string;
	shortName: string;
	badgeUrl: string | null;
}

export interface Schedule {
	id: number;
	eventId: number;
	week: number;
	gameDate: string;
	homeTeamId: number;
	awayTeamId: number;
	homeScore: number | null;
	awayScore: number | null;
	spread: number | null;
	overUnder: number | null;
}

export interface User {
	id: number;
	userName: string;
	firstName: string;
	lastName: string;
	fullName?: string;
}

export interface Pick {
	id: number;
	week: number;
	round: number;
	userId: number;
	teamId: number | null;
	orderInRound: number;
	assignedById: number | null;
}

// Extended types with relationships
export interface PickWithDetails extends Pick {
	fullName: string;
	team: string | null;
	assignedByFullName: string | null;
	overallPickOrder: number;
	points?: number;
	reasoning?: string | null;
}

export interface UserWithPoints {
	userId: number;
	fullName: string;
	totalPoints: number;
}

export interface TeamScore {
	week: number;
	teamId: number;
	points: number | null;
}

export interface DraftPick {
	id: number;
	userId: number;
	fullName: string;
	round: number;
	assignedById: number | null;
	assignedByFullName?: string | null;
	orderInRound: number;
	overallPickOrder: number;
	teamId: number | null;
	teamName?: string | null;
	team?: string | null; // For compatibility with existing code
}

export interface AvailableTeam {
	id: number;
	teamId: number;
	name: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	message?: string;
	error?: string;
}

export interface PickOrderEntry {
	userId: number;
	fullName: string;
	round: number;
	assignedById: number | null;
	orderInRound: number;
}

// Component prop types
export interface DraftPageData {
	draftState: DraftPick[];
	availableTeams: AvailableTeam[];
	week: number;
}

export interface PicksPageData {
	picks: PickWithDetails[];
	totalPoints: UserWithPoints[];
	week: number;
}

// Drag and drop event types (from svelte-dnd-action)
export interface DndEvent<T = unknown> {
	items: T[];
	info: {
		id: string;
		source: string;
		trigger: string;
	};
}

export type DragDropConsiderEvent = CustomEvent<DndEvent<AvailableTeam>>;
export type DragDropFinalizeEvent = CustomEvent<DndEvent<AvailableTeam>>;