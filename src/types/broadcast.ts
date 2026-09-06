// ─── Broadcast shared types ────────────────────────────────────────────────

export type Round = 'Round 1' | 'Round 2' | 'Round 3' | 'Round 4' | 'Round 5'
export type Group =
  | 'Group 1'
  | 'Group 2'
  | 'Group 3'
  | 'Group 4'
  | 'Group 5'
  | 'Group 6'
  | 'Group 7'
  | 'Group 8'
export type BGMap = 'Erangel' | 'Miramar' | 'Sanhok' | 'Vikendi'
export type Match = 'Match 1' | 'Match 2' | 'Match 3' | 'Match 4' | 'Match 5' | 'Match 6'

export interface MatchInfo {
  round: Round
  group: Group
  map: BGMap
  match: Match
}

export type OverlayKey =
  | 'pointsTable'
  | 'playerGraphic'
  | 'eliminationGraphic'
  | 'matchGraphic'

export type OverlayState = Record<OverlayKey, boolean>

export interface OverlayStatusItem {
  key: OverlayKey
  label: string
}

// ─── Demo data ─────────────────────────────────────────────────────────────

export const DEMO_TEAMS = [
  'Team Mayhem',
  'Soul Esports',
  'Skylightz Gaming',
  'OR Esports',
  'Global Esports',
  'Team XSpark',
  'Enigma Gaming',
  '7Sea Esports',
]

export const DEMO_PLAYERS: Record<string, string[]> = {
  'Team Mayhem': ['Pahadi', 'PVS Abhirup', 'Gambit', 'RIP'],
  'Soul Esports': ['Neyoo', 'Viper', 'ClutchGod', 'Omega'],
  'Skylightz Gaming': ['Mavi', 'Rony', 'Ghost', 'Hyder'],
  'OR Esports': ['Owais', 'Zgod', 'Gill', 'Jonathan'],
  'Global Esports': ['Destro', 'Insane', 'Shawn', 'Alpha'],
  'Team XSpark': ['Zgod', 'Axom', 'Rexy', 'Karna'],
  'Enigma Gaming': ['Pukar', 'Shreeman', 'Kmax', 'Excali'],
  '7Sea Esports': ['Mortal', 'Scout', 'Thug', 'Goldy'],
}

export const OVERLAY_STATUS_ITEMS: OverlayStatusItem[] = [
  { key: 'pointsTable', label: 'Points Table' },
  { key: 'playerGraphic', label: 'Player Graphic' },
  { key: 'eliminationGraphic', label: 'Elimination' },
  { key: 'matchGraphic', label: 'Match Graphic' },
]

export const ROUNDS: Round[] = ['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 5']
export const GROUPS: Group[] = [
  'Group 1',
  'Group 2',
  'Group 3',
  'Group 4',
  'Group 5',
  'Group 6',
  'Group 7',
  'Group 8',
]
export const MAPS: BGMap[] = ['Erangel', 'Miramar', 'Sanhok', 'Vikendi']
export const MATCHES: Match[] = ['Match 1', 'Match 2', 'Match 3', 'Match 4', 'Match 5', 'Match 6']
