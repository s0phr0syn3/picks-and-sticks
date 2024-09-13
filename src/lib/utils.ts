import crypto from 'crypto'

/**
 * General utility functions
 */

export function convertDate(dateString: string, year: number): string {
  const date = new Date(`${dateString}, ${year.toString()}`)
  return date.toISOString().split('T')[0]
}

export function generateHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function randomSort(arr: Array<any>): Array<any> {
  // Create a copy of the array to avoid mutating the original array
  for (let i = arr.length - 1; i > 0; i--) {
    // Generate a random index j such that 0 ≤ j ≤ i
    const j = Math.floor(Math.random() * (i + 1));

    // Swap array[i] with array[j]
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

interface Week {
  weekNum: number
  startDate: Date
  endDate: Date
}

export function getWeekFromDate(input: string): number {
  const inputDate = new Date(input)

  const weeks: Week[] = [
    {
      weekNum: 1,
      startDate: new Date('2024-09-05'),
      endDate: new Date('2024-09-10'),
    },
    {
      weekNum: 2,
      startDate: new Date('2024-09-11'),
      endDate: new Date('2024-09-17'),
    },
    {
      weekNum: 3,
      startDate: new Date('2024-09-18'),
      endDate: new Date('2024-09-24'),
    },
    {
      weekNum: 4,
      startDate: new Date('2024-09-25'),
      endDate: new Date('2024-10-01'),
    },
    {
      weekNum: 5,
      startDate: new Date('2024-10-02'),
      endDate: new Date('2024-10-08'),
    },
    {
      weekNum: 6,
      startDate: new Date('2024-10-09'),
      endDate: new Date('2024-10-15'),
    },
    {
      weekNum: 7,
      startDate: new Date('2024-10-16'),
      endDate: new Date('2024-10-22'),
    },
    {
      weekNum: 8,
      startDate: new Date('2024-10-23'),
      endDate: new Date('2024-10-29'),
    },
    {
      weekNum: 9,
      startDate: new Date('2024-10-30'),
      endDate: new Date('2024-11-05'),
    },
    {
      weekNum: 10,
      startDate: new Date('2024-11-06'),
      endDate: new Date('2024-11-12'),
    },
    {
      weekNum: 11,
      startDate: new Date('2024-11-13'),
      endDate: new Date('2024-11-19'),
    },
    {
      weekNum: 12,
      startDate: new Date('2024-11-20'),
      endDate: new Date('2024-11-26'),
    },
    {
      weekNum: 13,
      startDate: new Date('2024-11-27'),
      endDate: new Date('2024-12-03'),
    },
    {
      weekNum: 14,
      startDate: new Date('2024-12-04'),
      endDate: new Date('2024-12-10'),
    },
    {
      weekNum: 15,
      startDate: new Date('2024-12-11'),
      endDate: new Date('2024-12-17'),
    },
    {
      weekNum: 16,
      startDate: new Date('2024-12-18'),
      endDate: new Date('2024-12-24'),
    },
    {
      weekNum: 17,
      startDate: new Date('2024-12-25'),
      endDate: new Date('2024-12-31'),
    },
    {
      weekNum: 18,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-01-07'),
    },
  ]
  const week = weeks.find(w => inputDate >= w.startDate && inputDate <= w.endDate)

  return week ? week.weekNum : 0
}

/**
 * API responses
 */

export function successResponse(data: any, message: string = "Request successful", status: number = 200) {
  return new Response(JSON.stringify({
    message,
    data
  }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export function failureResponse(error: any, message: string = 'Request failed', status: number = 500) {
  return new Response(JSON.stringify({
    error: message,
    details: error.message || error.toString()
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  })
}
