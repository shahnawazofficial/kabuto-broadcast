/**
 * TypeScript types for the Kabuto Broadcast Supabase schema.
 *
 * These mirror the SQL schema in /supabase/schema.sql.
 * Structured to satisfy @supabase/supabase-js generic constraints.
 * Note: Must use `type` instead of `interface` so TypeScript treats
 * them as having implicit index signatures compatible with Record<string, unknown>.
 */

// ─── Primitive types ──────────────────────────────────────────────────────────

export type MatchStatus = 'pending' | 'live' | 'completed'

// ─── Row types (what Supabase returns on SELECT) ─────────────────────────────

export type TeamRow = {
  id: string
  name: string
  tag: string
  logo_url: string | null
  round?: number
  group_number?: number
  created_at: string
  updated_at: string
}


export type PlayerRow = {
  id: string
  team_id: string
  name: string
  ign: string
  photo_url: string | null
  created_at: string
  updated_at: string
}

export type MatchRow = {
  id: string
  round: number
  group_number: number
  map: string
  match_number: number
  status: MatchStatus
  created_at: string
  updated_at: string
}

export type LiveScoreRow = {
  id: string
  match_id: string
  team_id: string
  kills: number
  points: number
  position: number | null
  updated_at: string
}

export type BroadcastStateRow = {
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

// ─── Insert types (for INSERT operations) ────────────────────────────────────

export type TeamInsert = {
  id?: string
  name: string
  tag: string
  logo_url?: string | null
  round?: number
  group_number?: number
  created_at?: string
  updated_at?: string
}


export type PlayerInsert = {
  id?: string
  team_id: string
  name: string
  ign: string
  photo_url?: string | null
  created_at?: string
  updated_at?: string
}

export type MatchInsert = {
  id?: string
  round: number
  group_number: number
  map: string
  match_number: number
  status?: MatchStatus
  created_at?: string
  updated_at?: string
}

export type LiveScoreInsert = {
  id?: string
  match_id: string
  team_id: string
  kills?: number
  points?: number
  position?: number | null
  updated_at?: string
}

export type BroadcastStateInsert = {
  id?: string
  current_match_id?: string | null
  selected_player_id?: string | null
  selected_team_id?: string | null
  show_points?: boolean
  show_player?: boolean
  show_elimination?: boolean
  show_match?: boolean
  elimination_team_id?: string | null
  elimination_kills?: number
  updated_at?: string
}

// ─── Update types (for UPDATE operations) ────────────────────────────────────

export type TeamUpdate = Partial<TeamInsert>
export type PlayerUpdate = Partial<PlayerInsert>
export type MatchUpdate = Partial<MatchInsert>
export type LiveScoreUpdate = Partial<LiveScoreInsert>
export type BroadcastStateUpdate = Partial<BroadcastStateInsert>

// ─── Relationships ──────────────────────────────────────────────────────────

export type GenericRelationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne?: boolean
  referencedRelation: string
  referencedColumns: string[]
}

// ─── Database type — satisfies @supabase/supabase-js GenericSchema ────────────

export type Database = {
  public: {
    Tables: {
      teams: {
        Row: TeamRow
        Insert: TeamInsert
        Update: TeamUpdate
        Relationships: []
      }
      players: {
        Row: PlayerRow
        Insert: PlayerInsert
        Update: PlayerUpdate
        Relationships: [
          {
            foreignKeyName: 'players_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          }
        ]
      }
      matches: {
        Row: MatchRow
        Insert: MatchInsert
        Update: MatchUpdate
        Relationships: []
      }
      live_scores: {
        Row: LiveScoreRow
        Insert: LiveScoreInsert
        Update: LiveScoreUpdate
        Relationships: [
          {
            foreignKeyName: 'live_scores_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'live_scores_team_id_fkey'
            columns: ['team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          }
        ]
      }
      broadcast_state: {
        Row: BroadcastStateRow
        Insert: BroadcastStateInsert
        Update: BroadcastStateUpdate
        Relationships: [
          {
            foreignKeyName: 'broadcast_state_current_match_id_fkey'
            columns: ['current_match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'broadcast_state_selected_player_id_fkey'
            columns: ['selected_player_id']
            isOneToOne: false
            referencedRelation: 'players'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'broadcast_state_selected_team_id_fkey'
            columns: ['selected_team_id']
            isOneToOne: false
            referencedRelation: 'teams'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      match_status: MatchStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
