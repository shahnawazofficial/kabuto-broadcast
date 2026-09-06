'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { MatchRow, TeamRow, LiveScoreRow, MatchStatus } from '@/types/database'

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
}

// ─── Default matches to seed if matches table is empty ───────────────────────

const DEFAULT_SEED_MATCHES = [
  { round: 1, group_number: 1, map: 'Erangel', match_number: 1, status: 'live' as MatchStatus },
  { round: 1, group_number: 1, map: 'Miramar', match_number: 2, status: 'pending' as MatchStatus },
  { round: 1, group_number: 1, map: 'Sanhok',  match_number: 3, status: 'pending' as MatchStatus },
  { round: 2, group_number: 1, map: 'Erangel', match_number: 4, status: 'pending' as MatchStatus },
  { round: 2, group_number: 2, map: 'Miramar', match_number: 5, status: 'pending' as MatchStatus },
  { round: 3, group_number: 1, map: 'Erangel', match_number: 6, status: 'pending' as MatchStatus },
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

// ─── Fetch teams and their scores for a match ────────────────────────────────

export interface MatchTeamsScoresData {
  teams: TeamRow[]
  scores: LiveScoreRow[]
}

export async function getMatchScores(matchId: string): Promise<ActionResult<MatchTeamsScoresData>> {
  const cache = getLocalScoresCache()
  const cachedScores = cache.get(matchId) || []

  try {
    const supabase = await createClient()

    // 1. Fetch all teams
    const { data: teams } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true })

    // 2. Fetch live scores for this match
    const { data: scores } = await supabase
      .from('live_scores')
      .select('*')
      .eq('match_id', matchId)

    const finalScores = (scores && scores.length > 0) ? scores : cachedScores

    return {
      success: true,
      data: {
        teams: (teams && teams.length > 0) ? teams : DEMO_OVERLAY_TEAMS,
        scores: finalScores,
      },
    }
  } catch {
    return {
      success: true,
      data: {
        teams: DEMO_OVERLAY_TEAMS,
        scores: cachedScores,
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
}

export interface OverlayData {
  match: MatchRow
  scores: OverlayScoreEntry[]
}

const DEMO_OVERLAY_TEAMS: TeamRow[] = [
  { id: 'demo-1', name: 'Soul Esports',     tag: 'SOUL',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-2', name: 'Team XSpark',      tag: 'TX',    logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-3', name: 'GodLike Esports',  tag: 'GODL',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-4', name: 'Global Esports',   tag: 'GE',    logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-5', name: 'OR Esports',       tag: 'OR',    logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-6', name: 'Skylightz Gaming', tag: 'SKYLZ', logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-7', name: '7Sea Esports',     tag: '7SEA',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-8', name: 'Enigma Gaming',    tag: 'EG',    logo_url: null, created_at: '', updated_at: '' },
]

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

    // 2. Fetch teams
    const { data: dbTeams } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true })

    const teams = (dbTeams && dbTeams.length > 0) ? dbTeams : DEMO_OVERLAY_TEAMS

    // 3. Fetch scores for this match
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

    // 4. Combine and sort
    const entries: OverlayScoreEntry[] = teams.map((team) => {
      const score = scoresMap.get(team.id)
      const kills = score ? score.kills : 0
      const placement = score?.position ?? null
      const totalPoints = score ? score.points : 0

      return {
        teamId: team.id,
        teamName: team.name,
        teamTag: team.tag,
        logoUrl: team.logo_url,
        kills,
        placement,
        totalPoints,
        rank: 0, // assigned after sorting
      }
    })

    // Sort: Total Points (descending), then Kills (descending), then Team Name
    entries.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
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
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch overlay data.'
    return {
      success: false,
      error: msg,
      data: {
        match: DEMO_OVERLAY_MATCH,
        scores: DEMO_OVERLAY_TEAMS.map((t, idx) => ({
          teamId: t.id,
          teamName: t.name,
          teamTag: t.tag,
          logoUrl: t.logo_url,
          kills: 0,
          placement: null,
          totalPoints: 0,
          rank: idx + 1,
        })),
      },
    }
  }
}
