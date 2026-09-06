'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { MatchRow, TeamRow, LiveScoreRow, MatchStatus } from '@/types/database'
import { fetchTeamsWithRoundGroup } from '@/app/broadcast/actions/teams-query'

export interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export interface ScorePayload {
  teamId: string
  kills: number
  placement: number | null
  placementPoints: number
  totalPoints: number
  alive?: number
  knocked?: number
}

// ─── Default matches to seed if matches table is empty ───────────────────────

const DEFAULT_SEED_MATCHES = [
  // Round 1 (Groups 1 to 8) — Maps: Miramar, Erangel, Rondo only
  { round: 1, group_number: 1, map: 'Erangel', match_number: 1, status: 'live'    as MatchStatus },
  { round: 1, group_number: 2, map: 'Miramar', match_number: 2, status: 'pending' as MatchStatus },
  { round: 1, group_number: 3, map: 'Rondo',   match_number: 3, status: 'pending' as MatchStatus },
  { round: 1, group_number: 4, map: 'Erangel', match_number: 4, status: 'pending' as MatchStatus },
  { round: 1, group_number: 5, map: 'Miramar', match_number: 5, status: 'pending' as MatchStatus },
  { round: 1, group_number: 6, map: 'Rondo',   match_number: 6, status: 'pending' as MatchStatus },
  { round: 1, group_number: 7, map: 'Erangel', match_number: 7, status: 'pending' as MatchStatus },
  { round: 1, group_number: 8, map: 'Miramar', match_number: 8, status: 'pending' as MatchStatus },
  // Round 2
  { round: 2, group_number: 1, map: 'Miramar', match_number: 9,  status: 'pending' as MatchStatus },
  { round: 2, group_number: 2, map: 'Rondo',   match_number: 10, status: 'pending' as MatchStatus },
  { round: 2, group_number: 3, map: 'Erangel', match_number: 11, status: 'pending' as MatchStatus },
  { round: 2, group_number: 4, map: 'Miramar', match_number: 12, status: 'pending' as MatchStatus },
  // Round 3
  { round: 3, group_number: 1, map: 'Rondo',   match_number: 13, status: 'pending' as MatchStatus },
  { round: 3, group_number: 2, map: 'Erangel', match_number: 14, status: 'pending' as MatchStatus },
  { round: 3, group_number: 3, map: 'Miramar', match_number: 15, status: 'pending' as MatchStatus },
  { round: 3, group_number: 4, map: 'Rondo',   match_number: 16, status: 'pending' as MatchStatus },
]

declare global {
  var __kabutoScores: Map<string, LiveScoreRow[]> | undefined
}

function getLocalScoresCache() {
  if (!globalThis.__kabutoScores) {
    globalThis.__kabutoScores = new Map<string, LiveScoreRow[]>()
  }
  return globalThis.__kabutoScores
}


// ─── Fetch or seed matches ───────────────────────────────────────────────────

export async function getMatches(): Promise<ActionResult<MatchRow[]>> {
  try {
    const supabase = await createClient()
    const { data: existingMatches, error: fetchErr } = await supabase
      .from('matches')
      .select('*')
      .order('match_number', { ascending: true })

    if (fetchErr) {
      return { success: false, error: fetchErr.message }
    }

    if (existingMatches && existingMatches.length > 0) {
      // Ensure other tournament groups (Group 3, Group 4, etc.) are available in matches table
      const existingGroups = new Set(existingMatches.map((m) => m.group_number))
      const missingDefaults = DEFAULT_SEED_MATCHES.filter((m) => !existingGroups.has(m.group_number))

      if (missingDefaults.length > 0) {
        const maxMatchNumber = Math.max(...existingMatches.map((m) => m.match_number || 0), 0)
        const toInsert = missingDefaults.map((m, idx) => ({
          ...m,
          match_number: maxMatchNumber + idx + 1,
        }))

        const { data: newlyInserted } = await supabase
          .from('matches')
          .insert(toInsert)
          .select()

        if (newlyInserted && newlyInserted.length > 0) {
          const combined = [...existingMatches, ...newlyInserted].sort(
            (a, b) => a.match_number - b.match_number
          )
          return { success: true, data: combined }
        }
      }

      return { success: true, data: existingMatches }
    }

    // If empty, auto-seed default matches
    const { data: seeded, error: seedErr } = await supabase
      .from('matches')
      .insert(DEFAULT_SEED_MATCHES)
      .select()

    if (seedErr) {
      return { success: false, error: seedErr.message }
    }

    return { success: true, data: seeded ?? [] }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch matches.'
    return { success: false, error: msg }
  }
}

// ─── Get or create match on demand for any Round & Group ────────────────────

export async function getOrCreateMatch(
  round: number,
  groupNumber: number,
  map: string = 'Erangel'
): Promise<ActionResult<MatchRow>> {
  try {
    const supabase = await createClient()

    // 1. Check if match already exists for this round and group
    const { data: existing } = await supabase
      .from('matches')
      .select('*')
      .eq('round', round)
      .eq('group_number', groupNumber)
      .order('match_number', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return { success: true, data: existing }
    }

    // 2. Compute next match_number
    const { data: allMatches } = await supabase
      .from('matches')
      .select('match_number')
      .order('match_number', { ascending: false })
      .limit(1)

    const nextMatchNum = (allMatches && allMatches[0]?.match_number ? allMatches[0].match_number : 0) + 1

    const newMatch = {
      round,
      group_number: groupNumber,
      map,
      match_number: nextMatchNum,
      status: 'pending' as MatchStatus,
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('matches')
      .insert(newMatch)
      .select()
      .single()

    if (insertErr || !inserted) {
      const fallback: MatchRow = {
        id: `match-r${round}-g${groupNumber}`,
        round,
        group_number: groupNumber,
        map,
        match_number: nextMatchNum,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      return { success: true, data: fallback }
    }

    revalidatePath('/broadcast')
    revalidatePath('/overlay/points')
    return { success: true, data: inserted }
  } catch {
    const fallback: MatchRow = {
      id: `match-r${round}-g${groupNumber}`,
      round,
      group_number: groupNumber,
      map,
      match_number: round * 10 + groupNumber,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    return { success: true, data: fallback }
  }
}

// ─── Fetch teams and their scores for a match ────────────────────────────────

export interface MatchTeamsScoresData {
  teams: TeamRow[]
  scores: LiveScoreRow[]
  teamStatus?: Record<string, { alive: number; knocked: number }>
}

export async function getMatchScores(matchId: string): Promise<ActionResult<MatchTeamsScoresData>> {
  const cache = getLocalScoresCache()
  const cachedScores = cache.get(matchId) || []

  try {
    const supabase = await createClient()

    // 1. Fetch match to know its round & group
    const { data: match } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle()

    // 2. Fetch live scores for this match
    const { data: scores } = await supabase
      .from('live_scores')
      .select('*')
      .eq('match_id', matchId)

    const finalScores = (scores && scores.length > 0) ? scores : cachedScores
    const scoredTeamIds = new Set(finalScores.map((s) => s.team_id))

    // 3. Fetch all teams
    const { data: allTeams } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true })

    const teamList = allTeams ?? []

    // 4. Filter teams that belong to this match
    // A team belongs to this match if:
    // - It has a score entry in this match, OR
    // - Its round & group_number match this match's round & group_number
    let matchTeams: TeamRow[] = []

    if (match) {
      const decoratedTeams: TeamRow[] = await fetchTeamsWithRoundGroup()

      matchTeams = decoratedTeams.filter((t: TeamRow) => {
        if (scoredTeamIds.has(t.id)) return true
        const raw = t as unknown as Record<string, unknown>
        const tRound = typeof raw['round'] === 'number' ? raw['round'] : 1
        const tGroup = typeof raw['group_number'] === 'number' ? raw['group_number'] : 1
        return tRound === match.round && tGroup === match.group_number
      })

      // If no teams specifically matched this round/group yet, but teams exist in DB and no groups were ever set,
      // only include scored teams (never show demo teams)
      if (matchTeams.length === 0 && scoredTeamIds.size > 0) {
        matchTeams = decoratedTeams.filter((t: TeamRow) => scoredTeamIds.has(t.id))
      }
    } else {
      matchTeams = teamList.filter((t: TeamRow) => scoredTeamIds.has(t.id))
    }

    // 5. Build squad status map (alive / knocked)
    const teamStatus: Record<string, { alive: number; knocked: number }> = {}
    for (const t of matchTeams) {
      const cached = globalThis.__kabutoTeamAlive?.get(`${matchId}_${t.id}`)
      if (cached) {
        teamStatus[t.id] = cached
      } else {
        const score = finalScores.find((s) => s.team_id === t.id)
        if (score && score.position !== null && score.position > 1) {
          teamStatus[t.id] = { alive: 0, knocked: 0 }
        } else {
          teamStatus[t.id] = { alive: 4, knocked: 0 }
        }
      }
    }

    return {
      success: true,
      data: {
        teams: matchTeams,
        scores: finalScores,
        teamStatus,
      },
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch match scores.',
      data: {
        teams: [],
        scores: [],
      },
    }
  }
}


// ─── Save scores to live_scores ──────────────────────────────────────────────

export async function saveScores(
  matchId: string,
  scores: ScorePayload[]
): Promise<ActionResult> {
  if (!matchId) {
    return { success: false, error: 'Match ID is required.' }
  }

  const upsertRows: LiveScoreRow[] = scores.map((s) => ({
    id: `score-${matchId}-${s.teamId}`,
    match_id: matchId,
    team_id: s.teamId,
    kills: Math.max(0, s.kills),
    points: Math.max(0, s.totalPoints),
    position: s.placement,
    updated_at: new Date().toISOString(),
  }))

  // Update in-memory cache for instant fallback
  const cache = getLocalScoresCache()
  cache.set(matchId, upsertRows)

  // Update in-memory squad alive status
  if (!globalThis.__kabutoTeamAlive) {
    globalThis.__kabutoTeamAlive = new Map()
  }
  for (const s of scores) {
    if (s.alive !== undefined) {
      globalThis.__kabutoTeamAlive.set(`${matchId}_${s.teamId}`, {
        alive: Math.max(0, Math.min(4, s.alive)),
        knocked: Math.max(0, Math.min(3, s.knocked ?? 0)),
      })
    }
  }

  try {
    const supabase = await createClient()

    const dbRows = upsertRows.map((row) => ({
      match_id: row.match_id,
      team_id: row.team_id,
      kills: row.kills,
      points: row.points,
      position: row.position,
    }))
    await supabase
      .from('live_scores')
      .upsert(dbRows, { onConflict: 'match_id,team_id' })
  } catch {
    // Supabase optional in local dev
  }

  revalidatePath('/broadcast')
  revalidatePath('/overlay/points')
  return { success: true }
}

// ─── Reset scores for a match ────────────────────────────────────────────────

export async function resetScores(matchId: string): Promise<ActionResult> {
  if (!matchId) {
    return { success: false, error: 'Match ID is required.' }
  }

  // Clear from local cache
  const cache = getLocalScoresCache()
  cache.delete(matchId)

  try {
    const supabase = await createClient()
    await supabase
      .from('live_scores')
      .delete()
      .eq('match_id', matchId)
  } catch {
    // Supabase optional in local dev
  }

  revalidatePath('/broadcast')
  revalidatePath('/overlay/points')
  return { success: true }
}

// ─── Fetch live data for the OBS overlay ─────────────────────────────────────

export interface OverlayScoreEntry {
  teamId: string
  teamName: string
  teamTag: string
  logoUrl: string | null
  kills: number
  placement: number | null
  totalPoints: number
  rank: number
  aliveCount: number
  knockedCount: number
}

export interface OverlayData {
  match: MatchRow
  scores: OverlayScoreEntry[]
  selectedTeamId: string | null
  showPoints: boolean
  showStatusBars: boolean
}

declare global {
  var __kabutoTeamAlive: Map<string, { alive: number; knocked: number }> | undefined
  var __kabutoShowStatusBars: boolean | undefined
}

export async function setTeamAliveStatus(
  matchId: string,
  teamId: string,
  alive: number,
  knocked: number = 0
): Promise<ActionResult> {
  if (!globalThis.__kabutoTeamAlive) {
    globalThis.__kabutoTeamAlive = new Map()
  }
  globalThis.__kabutoTeamAlive.set(`${matchId}_${teamId}`, {
    alive: Math.max(0, Math.min(4, alive)),
    knocked: Math.max(0, Math.min(3, knocked)),
  })
  revalidatePath('/overlay/points')
  revalidatePath('/broadcast')
  return { success: true }
}

export async function toggleOverlayStatusBars(show: boolean): Promise<ActionResult> {
  globalThis.__kabutoShowStatusBars = show
  revalidatePath('/overlay/points')
  revalidatePath('/broadcast')
  return { success: true }
}




const DEMO_OVERLAY_MATCH: MatchRow = {
  id: 'demo-match-1',
  round: 1,
  group_number: 1,
  map: 'Erangel',
  match_number: 1,
  status: 'live',
  created_at: '',
  updated_at: '',
}

export async function getLiveOverlayData(requestedMatchId?: string): Promise<ActionResult<OverlayData>> {
  try {
    const supabase = await createClient()

    // 1. Determine target match
    let targetMatch: MatchRow | null = null

    if (requestedMatchId) {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('id', requestedMatchId)
        .maybeSingle()
      targetMatch = data
    }

    if (!targetMatch) {
      // Check broadcast_state singleton
      const { data: bState } = await supabase
        .from('broadcast_state')
        .select('current_match_id')
        .maybeSingle()

      if (bState?.current_match_id) {
        const { data } = await supabase
          .from('matches')
          .select('*')
          .eq('id', bState.current_match_id)
          .maybeSingle()
        targetMatch = data
      }
    }

    if (!targetMatch) {
      // Find match with status = 'live' or first match
      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .order('match_number', { ascending: true })

      if (matches && matches.length > 0) {
        targetMatch = matches.find((m) => m.status === 'live') ?? matches[0]
      }
    }

    // Fallback: match from local cache or seed matches
    if (!targetMatch) {
      const activeMatchId = requestedMatchId || (globalThis as unknown as { __kabutoBroadcastState?: { current_match_id?: string } }).__kabutoBroadcastState?.current_match_id
      if (activeMatchId) {
        const matchIdx = DEFAULT_SEED_MATCHES.findIndex((_, idx) => `match-${idx + 1}` === activeMatchId)
        if (matchIdx >= 0) {
          const m = DEFAULT_SEED_MATCHES[matchIdx]
          targetMatch = {
            id: activeMatchId,
            round: m.round,
            group_number: m.group_number,
            map: m.map,
            match_number: m.match_number,
            status: m.status,
            created_at: '',
            updated_at: '',
          }
        }
      }
    }

    // If still no match in DB, fallback to demo match
    const match = targetMatch ?? DEMO_OVERLAY_MATCH

    // 2. Fetch scores for this match
    const { data: dbScores } = await supabase
      .from('live_scores')
      .select('*')
      .eq('match_id', match.id)

    const scoresMap = new Map<string, LiveScoreRow>()
    const cachedScores = getLocalScoresCache().get(match.id) || []
    cachedScores.forEach((s) => scoresMap.set(s.team_id, s))

    if (dbScores && dbScores.length > 0) {
      dbScores.forEach((s) => scoresMap.set(s.team_id, s))
    }

    // 3. Fetch teams decorated with round/group (via shared helper — no circular dep)
    const allTeams: TeamRow[] = await fetchTeamsWithRoundGroup()

    // Filter to teams for this match
    const matchTeams: TeamRow[] = allTeams.filter((t: TeamRow) => {
      if (scoresMap.has(t.id)) return true
      const raw = t as unknown as Record<string, unknown>
      const tRound = typeof raw['round'] === 'number' ? raw['round'] : 1
      const tGroup = typeof raw['group_number'] === 'number' ? raw['group_number'] : 1
      return tRound === match.round && tGroup === match.group_number
    })

    const teams: TeamRow[] = matchTeams.length > 0
      ? matchTeams
      : (scoresMap.size > 0 ? allTeams.filter((t: TeamRow) => scoresMap.has(t.id)) : [])

    // Fetch broadcast_state
    const { data: bState } = await supabase
      .from('broadcast_state')
      .select('selected_team_id, show_points')
      .limit(1)
      .maybeSingle()

    const selectedTeamId = bState?.selected_team_id ?? (globalThis as unknown as { __kabutoBroadcastState?: { selected_team_id?: string | null } }).__kabutoBroadcastState?.selected_team_id ?? null
    const showPoints = bState?.show_points ?? (globalThis as unknown as { __kabutoBroadcastState?: { show_points?: boolean } }).__kabutoBroadcastState?.show_points ?? true

    // 4. Combine and sort
    const entries: OverlayScoreEntry[] = teams.map((team) => {
      const score = scoresMap.get(team.id)
      const kills = score ? score.kills : 0
      const placement = score?.position ?? null
      const totalPoints = score ? score.points : 0

      // Alive status calculation
      const aliveOverride = globalThis.__kabutoTeamAlive?.get(`${match.id}_${team.id}`)
      let aliveCount = 4
      let knockedCount = 0

      if (aliveOverride) {
        aliveCount = aliveOverride.alive
        knockedCount = aliveOverride.knocked
      } else if (placement !== null) {
        // Team has finished/eliminated
        aliveCount = 0
        knockedCount = 0
      }

      return {
        teamId: team.id,
        teamName: team.name,
        teamTag: team.tag,
        logoUrl: team.logo_url,
        kills,
        placement,
        totalPoints,
        rank: 0, // assigned after sorting
        aliveCount,
        knockedCount,
      }
    })

    // Sort: Total Points → Placement Points (higher = better placement) → Kills → Name
    entries.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
      }
      // Same total points: team with more placement points ranks higher
      const aPlacePts = Math.max(0, a.totalPoints - a.kills)
      const bPlacePts = Math.max(0, b.totalPoints - b.kills)
      if (bPlacePts !== aPlacePts) {
        return bPlacePts - aPlacePts
      }
      if (b.kills !== a.kills) {
        return b.kills - a.kills
      }
      return a.teamName.localeCompare(b.teamName)
    })

    // Assign 1-indexed ranks
    entries.forEach((e, idx) => {
      e.rank = idx + 1
    })

    return {
      success: true,
      data: {
        match,
        scores: entries,
        selectedTeamId,
        showPoints,
        showStatusBars: globalThis.__kabutoShowStatusBars ?? true,
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch overlay data.'
    return {
      success: false,
      error: msg,
      data: {
        match: DEMO_OVERLAY_MATCH,
        scores: [],
        selectedTeamId: null,
        showPoints: true,
        showStatusBars: true,
      },
    }
  }
}
