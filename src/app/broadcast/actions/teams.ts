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

// ─── Fetch Teams with Round & Group ───────────────────────────────────────────

export async function getTeamsWithRoundGroup(): Promise<{ success: boolean; data: TeamRow[]; error?: string }> {
  try {
    const supabase = await createClient()

    // 1. Fetch all teams
    const { data: teams, error } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true })

    if (error) return { success: false, data: [], error: error.message }

    // 2. Fetch persistent team-to-group mappings from live_scores joined with matches
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

    // 3. Decorate each team with its true persistent group & round
    const decorated = (teams ?? []).map((t) => {
      const dbMeta = teamGroupDb.get(t.id)
      const inMem = inMemoryMap.get(t.id) || inMemoryMap.get(t.name.toLowerCase().trim())
      return {
        ...t,
        round: dbMeta?.round ?? inMem?.round ?? t.round ?? 1,
        group_number: dbMeta?.group_number ?? inMem?.groupNumber ?? t.group_number ?? 1,
      }
    })

    return { success: true, data: decorated }
  } catch (err: unknown) {
    return { success: false, data: [], error: err instanceof Error ? err.message : 'Failed to fetch teams.' }
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
