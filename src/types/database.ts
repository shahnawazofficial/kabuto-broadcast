/**
 * Auto-generated-style TypeScript types for the Kabuto Broadcast Supabase schema.
 *
 * These mirror the SQL schema in /supabase/schema.sql.
 * When you update the schema, update these types to match.
 * In future you can replace this with `supabase gen types typescript`.
 */

// ─── Row types (what Supabase returns on SELECT) ────────────────────────────

export interface TeamRow {
  id: string
  name: string
  tag: string
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface PlayerRow {
  id: string
  team_id: string
  name: string
  ign: string
  photo_url: string | null
  created_at: string
  updated_at: string
}

export type MatchStatus = 'pending' | 'live' | 'completed'

export interface MatchRow {
  id: string
  round: number
  group_number: number
  map: string
  match_number: number
  status: MatchStatus
  created_at: string
  updated_at: string
}

export interface LiveScoreRow {
  id: string
  match_id: string
  team_id: string
  kills: number
  points: number
  position: number | null
  updated_at: string
}

export interface BroadcastStateRow {
  id: string
  current_match_id: string | null
  selected_player_id: string | null
  selected_team_id: string | null
  show_points: boolean
  show_player: boolean
  show_elimination: boolean
  show_match: boolean
  elimination_team_id: string | null
  elimination_kills: number
  updated_at: string
}

// ─── Insert types (for creating new rows) ────────────────────────────────────

export type TeamInsert = Omit<TeamRow, 'id' | 'created_at' | 'updated_at'>
export type PlayerInsert = Omit<PlayerRow, 'id' | 'created_at' | 'updated_at'>
export type MatchInsert = Omit<MatchRow, 'id' | 'created_at' | 'updated_at'>
export type LiveScoreInsert = Omit<LiveScoreRow, 'id' | 'updated_at'>
export type BroadcastStateInsert = Omit<BroadcastStateRow, 'id' | 'updated_at'>

// ─── Update types (partial updates) ──────────────────────────────────────────

export type TeamUpdate = Partial<TeamInsert>
export type PlayerUpdate = Partial<PlayerInsert>
export type MatchUpdate = Partial<MatchInsert>
export type LiveScoreUpdate = Partial<LiveScoreInsert>
export type BroadcastStateUpdate = Partial<BroadcastStateInsert>

// ─── Database type (required by Supabase client generics) ────────────────────

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: TeamRow
        Insert: TeamInsert & { id?: string; created_at?: string; updated_at?: string }
        Update: TeamUpdate
      }
      players: {
        Row: PlayerRow
        Insert: PlayerInsert & { id?: string; created_at?: string; updated_at?: string }
        Update: PlayerUpdate
      }
      matches: {
        Row: MatchRow
        Insert: MatchInsert & { id?: string; created_at?: string; updated_at?: string }
        Update: MatchUpdate
      }
      live_scores: {
        Row: LiveScoreRow
        Insert: LiveScoreInsert & { id?: string; updated_at?: string }
        Update: LiveScoreUpdate
      }
      broadcast_state: {
        Row: BroadcastStateRow
        Insert: BroadcastStateInsert & { id?: string; updated_at?: string }
        Update: BroadcastStateUpdate
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      match_status: MatchStatus
    }
  }
}
