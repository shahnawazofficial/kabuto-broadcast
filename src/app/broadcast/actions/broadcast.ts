'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { BroadcastStateRow, PlayerRow, TeamRow } from '@/types/database'

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
  // eslint-disable-next-line no-var
  var __kabutoBroadcastState: {
    selected_team_id: string | null
    selected_player_id: string | null
    show_player: boolean
  } | undefined
}

function getLocalBroadcastState() {
  if (!globalThis.__kabutoBroadcastState) {
    globalThis.__kabutoBroadcastState = {
      selected_team_id: 'team-godl',
      selected_player_id: 'p-jonathan',
      show_player: false,
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
      return { success: true, data }
    }

    // If empty in Supabase, insert singleton
    const { data: inserted } = await supabase
      .from('broadcast_state')
      .insert({
        show_points: false,
        show_player: local.show_player,
        selected_team_id: local.selected_team_id,
        selected_player_id: local.selected_player_id,
        show_elimination: false,
        show_match: false,
        elimination_kills: 0,
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
      current_match_id: null,
      selected_player_id: local.selected_player_id,
      selected_team_id: local.selected_team_id,
      show_points: false,
      show_player: local.show_player,
      show_elimination: false,
      show_match: false,
      elimination_team_id: null,
      elimination_kills: 0,
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
