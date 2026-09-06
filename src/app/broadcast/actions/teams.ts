'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TeamRow } from '@/types/database'
import { getOrCreateMatch } from '@/app/broadcast/actions/scores'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean
  error?: string
}

declare global {
  var __kabutoTeamGroup: Map<string, { round: number; groupNumber: number }> | undefined
}

function getTeamGroupMap() {
  if (!globalThis.__kabutoTeamGroup) {
    globalThis.__kabutoTeamGroup = new Map<string, { round: number; groupNumber: number }>()
  }
  return globalThis.__kabutoTeamGroup
}

import { fetchTeamsWithRoundGroup } from '@/app/broadcast/actions/teams-query'

// ─── Fetch Teams with Round & Group ───────────────────────────────────────────

export async function getTeamsWithRoundGroup(): Promise<{ success: boolean; data: TeamRow[]; error?: string }> {
  try {
    const data = await fetchTeamsWithRoundGroup()
    return { success: true, data }
  } catch (err: unknown) {
    return { success: false, data: [], error: err instanceof Error ? err.message : 'Failed to fetch teams.' }
  }
}

// ─── Bulk Assign Teams to Round & Group ───────────────────────────────────────

export async function assignTeamsToGroup(
  teamIds: string[],
  round: number,
  groupNumber: number
): Promise<ActionResult> {
  try {
    if (!teamIds || teamIds.length === 0) return { success: false, error: 'No teams selected.' }
    const supabase = await createClient()

    // 1. Find or create Match for this round & group
    let matchId: string | null = null
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('id, match_number')
      .eq('round', round)
      .eq('group_number', groupNumber)
      .order('match_number', { ascending: true })
      .limit(1)

    if (existingMatches && existingMatches.length > 0) {
      matchId = existingMatches[0].id
    } else {
      const matchRes = await getOrCreateMatch(round, groupNumber, 'Miramar')
      if (matchRes.success && matchRes.data) {
        matchId = matchRes.data.id
      }
    }

    // 2. Remove unplayed/0-point score links for these teams from other groups so they cleanly migrate
    await supabase
      .from('live_scores')
      .delete()
      .in('team_id', teamIds)
      .eq('kills', 0)
      .eq('points', 0)

    // 3. Link each team to this group match
    if (matchId) {
      const now = new Date().toISOString()
      const scoreRows = teamIds.map((tid) => ({
        match_id: matchId!,
        team_id: tid,
        kills: 0,
        points: 0,
        position: null,
        updated_at: now,
      }))
      await supabase.from('live_scores').upsert(scoreRows, { onConflict: 'match_id,team_id' })
    }

    const inMem = getTeamGroupMap()
    teamIds.forEach((id) => inMem.set(id, { round, groupNumber }))

    revalidatePath('/broadcast')
    revalidatePath('/overlay/points')
    return { success: true }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to assign teams.' }
  }
}

// ─── Create Team with Round & Group Assignment ────────────────────────────────

export async function createTeam(formData: FormData): Promise<ActionResult> {
  const name = (formData.get('name') as string)?.trim()
  const tag  = (formData.get('tag')  as string)?.trim()
  const logo_url = (formData.get('logo_url') as string)?.trim() || null
  const round = parseInt((formData.get('round') as string) || '1', 10) || 1
  const groupNumber = parseInt((formData.get('group_number') as string) || '1', 10) || 1

  if (!name) return { success: false, error: 'Team name is required.' }
  if (!tag)  return { success: false, error: 'Team tag is required.' }

  const supabase = await createClient()
  const { data: inserted, error } = await supabase
    .from('teams')
    .insert({ name, tag, logo_url })
    .select()

  if (error) return { success: false, error: error.message }

  const team = inserted?.[0]
  if (team) {
    const map = getTeamGroupMap()
    map.set(team.id, { round, groupNumber })
    map.set(team.name.toLowerCase().trim(), { round, groupNumber })

    // Ensure at least one match exists for this round and group
    await getOrCreateMatch(round, groupNumber, 'Erangel')

    // Link team to matches for this round and group in live_scores
    const { data: matches } = await supabase
      .from('matches')
      .select('id')
      .eq('round', round)
      .eq('group_number', groupNumber)

    if (matches && matches.length > 0) {
      const scoreRows = matches.map((m) => ({
        match_id: m.id,
        team_id: team.id,
        kills: 0,
        points: 0,
      }))
      await supabase.from('live_scores').upsert(scoreRows, { onConflict: 'match_id,team_id' })
    }
  }

  revalidatePath('/broadcast')
  revalidatePath('/overlay/points')
  return { success: true }
}

// ─── Update Team with Round & Group Assignment ────────────────────────────────

export async function updateTeam(formData: FormData): Promise<ActionResult> {
  const id   = (formData.get('id')   as string)?.trim()
  const name = (formData.get('name') as string)?.trim()
  const tag  = (formData.get('tag')  as string)?.trim()
  const logo_url = (formData.get('logo_url') as string)?.trim() || null
  const round = parseInt((formData.get('round') as string) || '1', 10) || 1
  const groupNumber = parseInt((formData.get('group_number') as string) || '1', 10) || 1

  if (!id)   return { success: false, error: 'Team ID is missing.' }
  if (!name) return { success: false, error: 'Team name is required.' }
  if (!tag)  return { success: false, error: 'Team tag is required.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('teams')
    .update({ name, tag, logo_url })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  const map = getTeamGroupMap()
  map.set(id, { round, groupNumber })
  map.set(name.toLowerCase().trim(), { round, groupNumber })

  // Ensure match exists for new (round, groupNumber)
  await getOrCreateMatch(round, groupNumber, 'Erangel')

  // Remove zero-point unplayed scores from old matches so team moves cleanly
  await supabase
    .from('live_scores')
    .delete()
    .eq('team_id', id)
    .eq('kills', 0)
    .eq('points', 0)

  // Link to matches for this new round and group
  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .eq('round', round)
    .eq('group_number', groupNumber)

  if (matches && matches.length > 0) {
    const scoreRows = matches.map((m) => ({
      match_id: m.id,
      team_id: id,
      kills: 0,
      points: 0,
    }))
    await supabase.from('live_scores').upsert(scoreRows, { onConflict: 'match_id,team_id' })
  }

  revalidatePath('/broadcast')
  revalidatePath('/overlay/points')
  return { success: true }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteTeam(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'Team ID is missing.' }

  const supabase = await createClient()
  // Clean up references
  await supabase.from('live_scores').delete().eq('team_id', id)
  await supabase.from('players').delete().eq('team_id', id)
  const { error } = await supabase.from('teams').delete().eq('id', id)

  if (error) return { success: false, error: error.message }

  const map = getTeamGroupMap()
  map.delete(id)

  revalidatePath('/broadcast')
  revalidatePath('/overlay/points')
  return { success: true }
}

export async function deleteTeamsBatch(ids: string[]): Promise<ActionResult> {
  if (!ids || ids.length === 0) return { success: false, error: 'No teams selected for deletion.' }

  const supabase = await createClient()

  // Clean up references before deleting teams
  await supabase.from('live_scores').delete().in('team_id', ids)
  await supabase.from('players').delete().in('team_id', ids)

  const { error } = await supabase.from('teams').delete().in('id', ids)
  if (error) return { success: false, error: error.message }

  const map = getTeamGroupMap()
  ids.forEach((id) => map.delete(id))

  revalidatePath('/broadcast')
  revalidatePath('/overlay/points')
  return { success: true }
}

// ─── Batch Import (Excel / CSV) with Round & Group ────────────────────────────

export interface BatchImportResult {
  success: boolean
  imported: number
  skipped: number
  error?: string
}

export async function importTeamsBatch(
  teams: { name: string; tag: string }[],
  round: number = 1,
  groupNumber: number = 1
): Promise<BatchImportResult> {
  if (!teams || teams.length === 0) {
    return { success: false, imported: 0, skipped: 0, error: 'No teams to import.' }
  }

  const supabase = await createClient()

  // Fetch existing teams to avoid duplicates
  const { data: existing, error: fetchErr } = await supabase.from('teams').select('id, name')
  if (fetchErr) {
    return { success: false, imported: 0, skipped: 0, error: fetchErr.message }
  }

  const existingMap = new Map<string, string>()
  ;(existing ?? []).forEach((t) => existingMap.set(t.name.toLowerCase().trim(), t.id))

  const seenInBatch = new Set<string>()
  const toInsert: { name: string; tag: string }[] = []
  const allImportedTeamNames: string[] = []
  let skipped = 0

  for (const t of teams) {
    const trimmedName = t.name.trim()
    const trimmedTag = (t.tag || trimmedName.slice(0, 4)).trim().toUpperCase()
    const lower = trimmedName.toLowerCase()

    if (!trimmedName) continue

    if (existingMap.has(lower) || seenInBatch.has(lower)) {
      skipped++
      allImportedTeamNames.push(trimmedName)
      continue
    }

    seenInBatch.add(lower)
    toInsert.push({ name: trimmedName, tag: trimmedTag })
    allImportedTeamNames.push(trimmedName)
  }

  const groupMap = getTeamGroupMap()

  if (toInsert.length > 0) {
    const { data: insertedTeams, error: insertErr } = await supabase
      .from('teams')
      .insert(toInsert)
      .select()

    if (insertErr) {
      return { success: false, imported: 0, skipped: 0, error: insertErr.message }
    }

    ;(insertedTeams ?? []).forEach((t) => {
      existingMap.set(t.name.toLowerCase().trim(), t.id)
    })
  }

  // Ensure match exists for this round and group
  await getOrCreateMatch(round, groupNumber, 'Erangel')

  // Find matches belonging to this round and group
  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .eq('round', round)
    .eq('group_number', groupNumber)

  // Associate every team in this import with round & group in live_scores
  const targetTeamIds = allImportedTeamNames
    .map((name) => existingMap.get(name.toLowerCase().trim()))
    .filter((id): id is string => Boolean(id))

  // Clean unplayed 0-score entries from previous groups if re-imported
  if (targetTeamIds.length > 0) {
    await supabase
      .from('live_scores')
      .delete()
      .in('team_id', targetTeamIds)
      .eq('kills', 0)
      .eq('points', 0)
  }

  const scoreRowsToLink: { match_id: string; team_id: string; kills: number; points: number }[] = []

  for (const teamId of targetTeamIds) {
    groupMap.set(teamId, { round, groupNumber })

    if (matches && matches.length > 0) {
      for (const m of matches) {
        scoreRowsToLink.push({
          match_id: m.id,
          team_id: teamId,
          kills: 0,
          points: 0,
        })
      }
    }
  }

  if (scoreRowsToLink.length > 0) {
    await supabase.from('live_scores').upsert(scoreRowsToLink, { onConflict: 'match_id,team_id' })
  }

  revalidatePath('/broadcast')
  revalidatePath('/overlay/points')

  return {
    success: true,
    imported: toInsert.length,
    skipped,
  }
}
