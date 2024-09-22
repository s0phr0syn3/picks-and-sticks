import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { users } from '$lib/server/models'
import { successResponse, failureResponse } from '$lib/utils'

export const GET: RequestHandler = async () => {
  try {
    const userList = [
      {
        userName: 'ea',
        firstName: 'Echo',
        lastName: 'Alpha',
      },
      {
        userName: 'rc',
        firstName: 'Romeo',
        lastName: 'Charlie',
      },
      {
        userName: 'ch',
        firstName: 'Charlie',
        lastName: 'Hotel',
      },
      {
        userName: 'jp',
        firstName: 'Juliet',
        lastName: 'Papa',
      },
      {
        userName: 'nr',
        firstName: 'November',
        lastName: 'Romeo',
      },
    ]

    for (const record of userList) {
      await db.insert(users).values(record).onConflictDoNothing()
    }

    return successResponse({
      data: userList,
    })
  } catch (error: any) {
    return failureResponse(error)
  }
}