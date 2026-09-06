/**
 * Shared teams query helper used by scores.ts.
 * Kept in a separate file to break the circular dependency:
 *   scores.ts -> teams.ts -> scores.ts (getOrCreateMatch)
 *
 * This file has NO 'use server' directive -- it is a plain async utility.
 */

import { createClient } from '@/lib/supabase/server'
import type { TeamRow } from '@/types/database'

declare global {
  var __kabutoTeamGroup: Map<string, { round: number; groupNumber: number }> | undefined
}

function getTeamGroupMap() {
  if (!globalThis.__kabutoTeamGroup) {
    globalThis.__kabutoTeamGroup = new Map<string, { round: number; groupNumber: number }>()
  }
  return globalThis.__kabutoTeamGroup
}

/**
 * Fetches all teams from Supabase and decorates each with its
 * persistent round + group_number by joining live_scores with matches.
 */
export async function fetchTeamsWithRoundGroup(): Promise<TeamRow[]> {
  try {
    const supabase = await createClient()

    const { data: teams, error } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true })

    if (error || !teams) return []

    const { data: scoreLinks } = await supabase
      .from('live_scores')
      .select('team_id, updated_at, matches(id, round, group_number)')
      .order('updated_at', { ascending: false })

    const teamGroupDb = new Map<string, { round: number; group_number: number }>()
    scoreLinks?.forEach((s) => {
      if (!teamGroupDb.has(s.team_id)) {
        const m = s.matches as unknown as { round: number; group_number: number } | null
        if (m && typeof m.group_number === 'number') {
          teamGroupDb.set(s.team_id, {
            round: typeof m.round === 'number' ? m.round : 1,
            group_number: m.group_number,
          })
        }
      }
    })

    const inMemoryMap = getTeamGroupMap()

    const decorated: TeamRow[] = teams.map((t) => {
      const raw = t as unknown as Record<string, unknown>
      const dbMeta = teamGroupDb.get(t.id)
      const rawName = typeof raw['name'] === 'string' ? raw['name'] : ''
      const inMem = inMemoryMap.get(t.id) || inMemoryMap.get(rawName.toLowerCase().trim())
      const rawRound = typeof raw['round'] === 'number' ? raw['round'] : undefined
      const rawGroup = typeof raw['group_number'] === 'number' ? raw['group_number'] : undefined
      return {
        ...t,
        round: dbMeta?.round ?? inMem?.round ?? rawRound ?? 1,
        group_number: dbMeta?.group_number ?? inMem?.groupNumber ?? rawGroup ?? 1,
      } as TeamRow
    })

    return decorated
  } catch {
    return []
  }
}
