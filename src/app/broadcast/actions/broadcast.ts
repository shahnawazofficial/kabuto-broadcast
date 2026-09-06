'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { BroadcastStateRow, PlayerRow, TeamRow, MatchRow } from '@/types/database'

export interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

export interface PlayerOverlayData {
  showPlayer: boolean
  player: PlayerRow | null
  team: TeamRow | null
}

export interface EliminationOverlayData {
  showElimination: boolean
  team: TeamRow | null
  kills: number
  eliminatedAt: number
}

const FALLBACK_TEAMS_DATA: TeamRow[] = [
  { id: 'team-godl',  name: 'GodLike Esports',  tag: 'GODL',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'team-soul',  name: 'Soul Esports',     tag: 'SOUL',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'team-tx',    name: 'Team XSpark',      tag: 'TX',    logo_url: null, created_at: '', updated_at: '' },
  { id: 'team-ge',    name: 'Global Esports',   tag: 'GE',    logo_url: null, created_at: '', updated_at: '' },
]

const FALLBACK_PLAYERS_DATA: PlayerRow[] = [
  { id: 'p-jonathan', team_id: 'team-godl', name: 'Jonathan Amaral',   ign: 'Jonathan',  photo_url: null, created_at: '', updated_at: '' },
  { id: 'p-neyo',     team_id: 'team-godl', name: 'Suraj Majumdar',    ign: 'Neyo',      photo_url: null, created_at: '', updated_at: '' },
  { id: 'p-neyoo',    team_id: 'team-soul', name: 'Tanmay Singh',      ign: 'Neyoo',     photo_url: null, created_at: '', updated_at: '' },
  { id: 'p-viper',    team_id: 'team-soul', name: 'Abhishek Choudhary', ign: 'Viper',    photo_url: null, created_at: '', updated_at: '' },
  { id: 'p-clutch',   team_id: 'team-soul', name: 'Harpreet Jangra',   ign: 'ClutchGod', photo_url: null, created_at: '', updated_at: '' },
  { id: 'p-zgod',     team_id: 'team-tx',   name: 'Zbigniew Guzman',   ign: 'Zgod',      photo_url: null, created_at: '', updated_at: '' },
  { id: 'p-axom',     team_id: 'team-tx',   name: 'Axom Singh',        ign: 'Axom',      photo_url: null, created_at: '', updated_at: '' },
  { id: 'p-destro',   team_id: 'team-ge',   name: 'Abhijeet Andhale',  ign: 'Destro',    photo_url: null, created_at: '', updated_at: '' },
  { id: 'p-insane',   team_id: 'team-ge',   name: 'Mayank Jain',       ign: 'Insane',    photo_url: null, created_at: '', updated_at: '' },
]

// ─── Local state cache (ensures instant real-time sync across routes) ────────

declare global {
  var __kabutoBroadcastState: {
    selected_team_id: string | null
    selected_player_id: string | null
    show_player: boolean
    show_elimination: boolean
    elimination_team_id: string | null
    elimination_kills: number
    eliminated_at: number | null
    show_points: boolean
    show_match: boolean
    current_match_id: string | null
  } | undefined
}

function getLocalBroadcastState() {
  if (!globalThis.__kabutoBroadcastState) {
    globalThis.__kabutoBroadcastState = {
      selected_team_id: 'team-godl',
      selected_player_id: 'p-jonathan',
      show_player: false,
      show_elimination: false,
      elimination_team_id: 'team-godl',
      elimination_kills: 0,
      eliminated_at: null,
      show_points: true,
      show_match: false,
      current_match_id: 'match-1',
    }
  }
  return globalThis.__kabutoBroadcastState
}

// ─── Fetch or create broadcast_state ────────────────────────────────────────

export async function getBroadcastState(): Promise<ActionResult<BroadcastStateRow>> {
  const local = getLocalBroadcastState()

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('broadcast_state')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (!error && data) {
      local.selected_team_id = data.selected_team_id
      local.selected_player_id = data.selected_player_id
      local.show_player = data.show_player
      local.show_elimination = data.show_elimination
      local.elimination_team_id = data.elimination_team_id
      local.elimination_kills = data.elimination_kills
      if (typeof data.show_points === 'boolean') local.show_points = data.show_points
      if (typeof data.show_match === 'boolean') local.show_match = data.show_match
      if (data.current_match_id) local.current_match_id = data.current_match_id
      return { success: true, data }
    }

    // If empty in Supabase, insert singleton
    const { data: inserted } = await supabase
      .from('broadcast_state')
      .insert({
        show_points: local.show_points,
        show_player: local.show_player,
        selected_team_id: local.selected_team_id,
        selected_player_id: local.selected_player_id,
        show_elimination: local.show_elimination,
        show_match: local.show_match,
        elimination_team_id: local.elimination_team_id,
        elimination_kills: local.elimination_kills,
        current_match_id: local.current_match_id,
      })
      .select()
      .maybeSingle()

    if (inserted) {
      return { success: true, data: inserted }
    }
  } catch {
    // Supabase unavailable / local development fallback
  }

  // Fallback return using in-memory state
  return {
    success: true,
    data: {
      id: 'local-singleton',
      current_match_id: local.current_match_id,
      selected_player_id: local.selected_player_id,
      selected_team_id: local.selected_team_id,
      show_points: local.show_points,
      show_player: local.show_player,
      show_elimination: local.show_elimination,
      show_match: local.show_match,
      elimination_team_id: local.elimination_team_id,
      elimination_kills: local.elimination_kills,
      updated_at: new Date().toISOString(),
    },
  }
}

// ─── Update Player Graphic State ─────────────────────────────────────────────

export async function setPlayerGraphicState(
  teamId: string | null,
  playerId: string | null,
  showPlayer: boolean
): Promise<ActionResult> {
  const local = getLocalBroadcastState()
  local.selected_team_id = teamId
  local.selected_player_id = playerId
  local.show_player = showPlayer

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('broadcast_state')
      .select('id')
      .limit(1)
      .maybeSingle()

    const updatePayload = {
      selected_team_id: teamId,
      selected_player_id: playerId,
      show_player: showPlayer,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      await supabase
        .from('broadcast_state')
        .update(updatePayload)
        .eq('id', existing.id)
    } else {
      await supabase
        .from('broadcast_state')
        .insert({
          ...updatePayload,
          show_points: false,
          show_elimination: false,
          show_match: false,
          elimination_kills: 0,
        })
    }
  } catch {
    // Supabase optional in local dev
  }

  revalidatePath('/broadcast')
  revalidatePath('/overlay/player')
  return { success: true }
}

// ─── Fetch Teams and Players ─────────────────────────────────────────────────

export interface TeamsAndPlayersData {
  teams: TeamRow[]
  players: PlayerRow[]
}

export async function getTeamsAndPlayers(): Promise<ActionResult<TeamsAndPlayersData>> {
  try {
    const supabase = await createClient()

    const { data: teamsData } = await supabase
      .from('teams')
      .select('*')
      .order('name', { ascending: true })

    const { data: playersData } = await supabase
      .from('players')
      .select('*')
      .order('name', { ascending: true })

    const teams = (teamsData && teamsData.length > 0) ? teamsData : FALLBACK_TEAMS_DATA
    const players = (playersData && playersData.length > 0) ? playersData : FALLBACK_PLAYERS_DATA

    return {
      success: true,
      data: { teams, players },
    }
  } catch {
    return {
      success: true,
      data: { teams: FALLBACK_TEAMS_DATA, players: FALLBACK_PLAYERS_DATA },
    }
  }
}

// ─── Get Live Player Data for /overlay/player ────────────────────────────────

export async function getLivePlayerOverlayData(): Promise<ActionResult<PlayerOverlayData>> {
  const local = getLocalBroadcastState()
  let showPlayer = local.show_player
  let selectedPlayerId = local.selected_player_id
  let selectedTeamId = local.selected_team_id

  let dbPlayer: PlayerRow | null = null
  let dbTeam: TeamRow | null = null

  try {
    const supabase = await createClient()

    const { data: state } = await supabase
      .from('broadcast_state')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (state) {
      showPlayer = state.show_player
      selectedPlayerId = state.selected_player_id
      selectedTeamId = state.selected_team_id

      if (selectedPlayerId) {
        const { data: p } = await supabase
          .from('players')
          .select('*')
          .eq('id', selectedPlayerId)
          .maybeSingle()
        dbPlayer = p
      }

      if (selectedTeamId) {
        const { data: t } = await supabase
          .from('teams')
          .select('*')
          .eq('id', selectedTeamId)
          .maybeSingle()
        dbTeam = t
      }
    }
  } catch {
    // Supabase offline/local dev
  }

  // If hidden, return showPlayer = false
  if (!showPlayer) {
    return {
      success: true,
      data: {
        showPlayer: false,
        player: null,
        team: null,
      },
    }
  }

  // Resolve player & team (either from DB or fallback list)
  const resolvedPlayer =
    dbPlayer ??
    FALLBACK_PLAYERS_DATA.find((p) => p.id === selectedPlayerId) ??
    FALLBACK_PLAYERS_DATA[0]

  const resolvedTeam =
    dbTeam ??
    FALLBACK_TEAMS_DATA.find((t) => t.id === (selectedTeamId ?? resolvedPlayer.team_id)) ??
    FALLBACK_TEAMS_DATA[0]

  return {
    success: true,
    data: {
      showPlayer: true,
      player: resolvedPlayer,
      team: resolvedTeam,
    },
  }
}

// ─── Elimination Graphic Server Actions ──────────────────────────────────────

export async function triggerTeamEliminated(
  teamId: string,
  kills: number
): Promise<ActionResult> {
  const local = getLocalBroadcastState()
  local.show_elimination = true
  local.elimination_team_id = teamId
  local.elimination_kills = kills
  local.eliminated_at = Date.now()

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('broadcast_state')
      .select('id')
      .limit(1)
      .maybeSingle()

    const updatePayload = {
      show_elimination: true,
      elimination_team_id: teamId,
      elimination_kills: kills,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      await supabase
        .from('broadcast_state')
        .update(updatePayload)
        .eq('id', existing.id)
    } else {
      await supabase
        .from('broadcast_state')
        .insert({
          ...updatePayload,
          show_points: false,
          show_player: false,
          show_match: false,
          selected_team_id: teamId,
          selected_player_id: null,
        })
    }
  } catch {
    // Supabase optional in local dev
  }

  revalidatePath('/broadcast')
  revalidatePath('/overlay/elimination')
  return { success: true }
}

export async function hideTeamEliminated(): Promise<ActionResult> {
  const local = getLocalBroadcastState()
  local.show_elimination = false
  local.eliminated_at = null

  try {
    const supabase = await createClient()

    const { data: existing } = await supabase
      .from('broadcast_state')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('broadcast_state')
        .update({
          show_elimination: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    }
  } catch {
    // Supabase optional in local dev
  }

  revalidatePath('/broadcast')
  revalidatePath('/overlay/elimination')
  return { success: true }
}

export async function getLiveEliminationOverlayData(): Promise<ActionResult<EliminationOverlayData>> {
  const local = getLocalBroadcastState()
  let showElimination = local.show_elimination
  let eliminationTeamId = local.elimination_team_id
  let eliminationKills = local.elimination_kills
  let eliminatedAt = local.eliminated_at || 0

  let dbTeam: TeamRow | null = null

  try {
    const supabase = await createClient()

    const { data: state } = await supabase
      .from('broadcast_state')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (state) {
      showElimination = state.show_elimination
      eliminationTeamId = state.elimination_team_id
      eliminationKills = state.elimination_kills ?? 0
      if (state.updated_at) {
        eliminatedAt = new Date(state.updated_at).getTime()
      }

      if (eliminationTeamId) {
        const { data: t } = await supabase
          .from('teams')
          .select('*')
          .eq('id', eliminationTeamId)
          .maybeSingle()
        dbTeam = t
      }
    }
  } catch {
    // Supabase offline fallback
  }

  if (!showElimination || !eliminationTeamId) {
    return {
      success: true,
      data: {
        showElimination: false,
        team: null,
        kills: 0,
        eliminatedAt: 0,
      },
    }
  }

  const resolvedTeam =
    dbTeam ??
    FALLBACK_TEAMS_DATA.find((t) => t.id === eliminationTeamId) ??
    FALLBACK_TEAMS_DATA[0]

  return {
    success: true,
    data: {
      showElimination: true,
      team: resolvedTeam,
      kills: eliminationKills,
      eliminatedAt: eliminatedAt || Date.now(),
    },
  }
}

// ─── Match and Overlay Toggle Server Actions ────────────────────────────────

export async function setCurrentBroadcastMatch(matchId: string): Promise<ActionResult> {
  const local = getLocalBroadcastState()
  local.current_match_id = matchId

  try {
    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('broadcast_state')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('broadcast_state')
        .update({
          current_match_id: matchId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    }
  } catch {
    // Supabase optional in local dev
  }

  revalidatePath('/broadcast')
  revalidatePath('/overlay/points')
  return { success: true }
}

export async function toggleBroadcastOverlay(
  key: 'pointsTable' | 'playerGraphic' | 'eliminationGraphic' | 'matchGraphic',
  enabled: boolean
): Promise<ActionResult> {
  const local = getLocalBroadcastState()

  const fieldMap: Record<string, keyof typeof local> = {
    pointsTable: 'show_points',
    playerGraphic: 'show_player',
    eliminationGraphic: 'show_elimination',
  }

  const field = fieldMap[key]
  if (field && typeof local[field] === 'boolean') {
    ;(local as Record<string, unknown>)[field] = enabled
  }

  try {
    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('broadcast_state')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (existing) {
      const updatePayload: Partial<BroadcastStateRow> = {
        updated_at: new Date().toISOString(),
      }
      if (key === 'pointsTable') updatePayload.show_points = enabled
      if (key === 'playerGraphic') updatePayload.show_player = enabled
      if (key === 'eliminationGraphic') updatePayload.show_elimination = enabled
      if (key === 'matchGraphic') updatePayload.show_match = enabled

      await supabase
        .from('broadcast_state')
        .update(updatePayload)
        .eq('id', existing.id)
    }
  } catch {
    // Supabase optional in local dev
  }

  revalidatePath('/broadcast')
  revalidatePath('/overlay/points')
  revalidatePath('/overlay/player')
  revalidatePath('/overlay/elimination')
  revalidatePath('/overlay/match')
  return { success: true }
}

// ─── Match Graphic Server Actions ───────────────────────────────────────────

export interface MatchOverlayData {
  showMatch: boolean
  match: MatchRow
}

const FALLBACK_MATCH_DATA: MatchRow = {
  id: 'match-1',
  round: 1,
  group_number: 1,
  map: 'Erangel',
  match_number: 1,
  status: 'live',
  created_at: '',
  updated_at: '',
}

export async function setMatchGraphicState(showMatch: boolean): Promise<ActionResult> {
  const local = getLocalBroadcastState()
  local.show_match = showMatch

  try {
    const supabase = await createClient()
    const { data: existing } = await supabase
      .from('broadcast_state')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('broadcast_state')
        .update({
          show_match: showMatch,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    }
  } catch {
    // Supabase optional in local dev
  }

  revalidatePath('/broadcast')
  revalidatePath('/overlay/match')
  return { success: true }
}

export async function getLiveMatchOverlayData(): Promise<ActionResult<MatchOverlayData>> {
  const local = getLocalBroadcastState()
  let showMatch = local.show_match
  let currentMatchId = local.current_match_id

  let dbMatch: MatchRow | null = null

  try {
    const supabase = await createClient()
    const { data: state } = await supabase
      .from('broadcast_state')
      .select('show_match, current_match_id')
      .limit(1)
      .maybeSingle()

    if (state) {
      showMatch = state.show_match
      if (state.current_match_id) currentMatchId = state.current_match_id
    }

    if (currentMatchId) {
      const { data: m } = await supabase
        .from('matches')
        .select('*')
        .eq('id', currentMatchId)
        .maybeSingle()
      dbMatch = m
    }

    if (!dbMatch) {
      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .order('match_number', { ascending: true })
      if (matches && matches.length > 0) {
        dbMatch = matches.find((m) => m.status === 'live') ?? matches[0]
      }
    }
  } catch {
    // Supabase optional in local dev
  }

  const resolvedMatch = dbMatch ?? FALLBACK_MATCH_DATA

  return {
    success: true,
    data: {
      showMatch,
      match: resolvedMatch,
    },
  }
}



