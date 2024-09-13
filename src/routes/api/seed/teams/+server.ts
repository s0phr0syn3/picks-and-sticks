import type { RequestHandler } from './$types'
import { test as db } from '$lib/server/db'
import { teams } from '$lib/server/models'
import { fetchNFLTeams } from '$lib/api'
import { successResponse, failureResponse } from '$lib/utils'

export const GET: RequestHandler = async () => {
  try {
    const teamList = await fetchNFLTeams()

    const insertData = teamList.map(team => ({
      teamId: parseInt(team.idTeam, 10),
      name: team.strTeam,
      shortName: team.strTeamShort,
      badgeUrl: team.strBadge,
    }))

    for (const team of insertData) {
      await db.insert(teams).values(team).onConflictDoNothing()
    }

    return successResponse({
      data: insertData
    }, 'Teams retrieved and saved successfully.')
  } catch (error: any) {
    return failureResponse(error, 'Failed to retrieve or save teams.')
  }
}