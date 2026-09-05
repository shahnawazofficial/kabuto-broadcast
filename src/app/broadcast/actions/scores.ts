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
  try {
    const supabase = await createClient()

    // 1. Fetch all teams
    const { data: teams, error: teamsErr } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true })

    if (teamsErr) {
      return { success: false, error: teamsErr.message }
    }

    // 2. Fetch live scores for this match
    const { data: scores, error: scoresErr } = await supabase
      .from('live_scores')
      .select('*')
      .eq('match_id', matchId)

    if (scoresErr) {
      return { success: false, error: scoresErr.message }
    }

    return {
      success: true,
      data: {
        teams: teams ?? [],
        scores: scores ?? [],
      },
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch scores.'
    return { success: false, error: msg }
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

  try {
    const supabase = await createClient()

    const upsertRows = scores.map((s) => ({
      match_id: matchId,
      team_id: s.teamId,
      kills: Math.max(0, s.kills),
      points: Math.max(0, s.totalPoints),
      position: s.placement,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('live_scores')
      .upsert(upsertRows, { onConflict: 'match_id,team_id' })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/broadcast')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to save scores.'
    return { success: false, error: msg }
  }
}

// ─── Reset scores for a match ────────────────────────────────────────────────

export async function resetScores(matchId: string): Promise<ActionResult> {
  if (!matchId) {
    return { success: false, error: 'Match ID is required.' }
  }

  try {
    const supabase = await createClient()

    // Delete all existing scores for this match
    const { error } = await supabase
      .from('live_scores')
      .delete()
      .eq('match_id', matchId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/broadcast')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reset scores.'
    return { success: false, error: msg }
  }
}
