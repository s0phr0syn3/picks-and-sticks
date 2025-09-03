import crypto from 'crypto';

/**
 * General utility functions
 */

export function convertDate(dateString: string, year: number): string {
	const date = new Date(`${dateString}, ${year.toString()}`);
	return date.toISOString().split('T')[0];
}

export function generateHash(input: string): string {
	return crypto.createHash('sha256').update(input).digest('hex');
}

export function randomSort<T>(arr: Array<T>): Array<T> {
	// Create a copy of the array to avoid mutating the original array
	for (let i = arr.length - 1; i > 0; i--) {
		// Generate a random index j such that 0 ≤ j ≤ i
		const j = Math.floor(Math.random() * (i + 1));

		// Swap array[i] with array[j]
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

interface Week {
	weekNum: number;
	startDate: Date;
	endDate: Date;
}

// Generate NFL weeks dynamically based on season year
function getNFLWeeks(year: number): Week[] {
	// NFL season typically starts first Thursday after Labor Day (first Monday in September)
	// For now, we'll use approximate dates that work for most seasons
	// In production, this should be fetched from an API or configured per season
	
	const seasonStart = new Date(year, 8, 5); // September 5th as approximate start
	const weeks: Week[] = [];
	
	for (let i = 0; i < 18; i++) {
		const weekStart = new Date(seasonStart);
		weekStart.setDate(seasonStart.getDate() + (i * 7));
		
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 6);
		
		weeks.push({
			weekNum: i + 1,
			startDate: weekStart,
			endDate: weekEnd
		});
	}
	
	return weeks;
}

export function getWeekFromDate(input: string): number {
	const inputDate = new Date(input);
	const year = inputDate.getFullYear();
	
	// Use environment variable if available, otherwise use the year from the input date
	const seasonYear = parseInt(process.env.SEASON_YEAR || String(year));
	
	// For 2024, use the hardcoded dates for accuracy
	// For other years, use the dynamic calculation
	if (seasonYear === 2024) {
		const weeks2024: Week[] = [
			{ weekNum: 1, startDate: new Date('2024-09-05'), endDate: new Date('2024-09-10') },
			{ weekNum: 2, startDate: new Date('2024-09-11'), endDate: new Date('2024-09-17') },
			{ weekNum: 3, startDate: new Date('2024-09-18'), endDate: new Date('2024-09-24') },
			{ weekNum: 4, startDate: new Date('2024-09-25'), endDate: new Date('2024-10-01') },
			{ weekNum: 5, startDate: new Date('2024-10-02'), endDate: new Date('2024-10-08') },
			{ weekNum: 6, startDate: new Date('2024-10-09'), endDate: new Date('2024-10-15') },
			{ weekNum: 7, startDate: new Date('2024-10-16'), endDate: new Date('2024-10-22') },
			{ weekNum: 8, startDate: new Date('2024-10-23'), endDate: new Date('2024-10-29') },
			{ weekNum: 9, startDate: new Date('2024-10-30'), endDate: new Date('2024-11-05') },
			{ weekNum: 10, startDate: new Date('2024-11-06'), endDate: new Date('2024-11-12') },
			{ weekNum: 11, startDate: new Date('2024-11-13'), endDate: new Date('2024-11-19') },
			{ weekNum: 12, startDate: new Date('2024-11-20'), endDate: new Date('2024-11-26') },
			{ weekNum: 13, startDate: new Date('2024-11-27'), endDate: new Date('2024-12-03') },
			{ weekNum: 14, startDate: new Date('2024-12-04'), endDate: new Date('2024-12-10') },
			{ weekNum: 15, startDate: new Date('2024-12-11'), endDate: new Date('2024-12-17') },
			{ weekNum: 16, startDate: new Date('2024-12-18'), endDate: new Date('2024-12-24') },
			{ weekNum: 17, startDate: new Date('2024-12-25'), endDate: new Date('2024-12-31') },
			{ weekNum: 18, startDate: new Date('2025-01-01'), endDate: new Date('2025-01-07') }
		];
		const week = weeks2024.find((w) => inputDate >= w.startDate && inputDate <= w.endDate);
		return week ? week.weekNum : 0;
	}
	
	// 2025 NFL season starts September 5th - weeks run Thursday-Wednesday
	if (seasonYear === 2025) {
		const weeks2025: Week[] = [
			{ weekNum: 1, startDate: new Date('2025-09-04'), endDate: new Date('2025-09-10') },
			{ weekNum: 2, startDate: new Date('2025-09-11'), endDate: new Date('2025-09-17') },
			{ weekNum: 3, startDate: new Date('2025-09-18'), endDate: new Date('2025-09-24') },
			{ weekNum: 4, startDate: new Date('2025-09-25'), endDate: new Date('2025-10-01') },
			{ weekNum: 5, startDate: new Date('2025-10-02'), endDate: new Date('2025-10-08') },
			{ weekNum: 6, startDate: new Date('2025-10-09'), endDate: new Date('2025-10-15') },
			{ weekNum: 7, startDate: new Date('2025-10-16'), endDate: new Date('2025-10-22') },
			{ weekNum: 8, startDate: new Date('2025-10-23'), endDate: new Date('2025-10-29') },
			{ weekNum: 9, startDate: new Date('2025-10-30'), endDate: new Date('2025-11-05') },
			{ weekNum: 10, startDate: new Date('2025-11-06'), endDate: new Date('2025-11-12') },
			{ weekNum: 11, startDate: new Date('2025-11-13'), endDate: new Date('2025-11-19') },
			{ weekNum: 12, startDate: new Date('2025-11-20'), endDate: new Date('2025-11-26') },
			{ weekNum: 13, startDate: new Date('2025-11-27'), endDate: new Date('2025-12-03') },
			{ weekNum: 14, startDate: new Date('2025-12-04'), endDate: new Date('2025-12-10') },
			{ weekNum: 15, startDate: new Date('2025-12-11'), endDate: new Date('2025-12-17') },
			{ weekNum: 16, startDate: new Date('2025-12-18'), endDate: new Date('2025-12-24') },
			{ weekNum: 17, startDate: new Date('2025-12-25'), endDate: new Date('2025-12-31') },
			{ weekNum: 18, startDate: new Date('2026-01-01'), endDate: new Date('2026-01-07') }
		];
		const week = weeks2025.find((w) => inputDate >= w.startDate && inputDate <= w.endDate);
		return week ? week.weekNum : 0;
	}
	
	// For other years, use dynamic calculation
	const weeks = getNFLWeeks(seasonYear);
	const week = weeks.find((w) => inputDate >= w.startDate && inputDate <= w.endDate);
	return week ? week.weekNum : 0;
}

/**
 * API responses
 */

export function successResponse(
	data: unknown,
	message: string = 'Request successful',
	status: number = 200
) {
	return new Response(
		JSON.stringify({
			message,
			data
		}),
		{
			status,
			headers: { 'Content-Type': 'application/json' }
		}
	);
}

export function failureResponse(
	error: unknown,
	message: string = 'Request failed',
	status: number = 500
) {
	const errorMessage = error instanceof Error ? error.message : String(error);
	return new Response(
		JSON.stringify({
			error: message,
			details: errorMessage
		}),
		{
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		}
	);
}
