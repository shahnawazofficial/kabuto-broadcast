'use client'

import { useState, useEffect, useCallback, useMemo, useTransition } from 'react'
import Image from 'next/image'
import type { MatchRow, TeamRow, LiveScoreRow } from '@/types/database'
import {
  getMatches,
  getMatchScores,
  getOrCreateMatch,
  createNextMatchForGroup,
  saveScores,
  resetScores,
  setTeamAliveStatus,
  toggleOverlayStatusBars,
  ScorePayload,
} from '@/app/broadcast/actions/scores'
import { setCurrentBroadcastMatch } from '@/app/broadcast/actions/broadcast'
import { notifyRealtimeChange } from '@/lib/supabase/realtime'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ─── Standard BGMI 10-Point System ───────────────────────────────────────────

const BGMI_PLACEMENT_POINTS: Record<number, number> = {
  1: 10,
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 2,
  7: 1,
  8: 1,
  9: 0,
  10: 0,
  11: 0,
  12: 0,
  13: 0,
  14: 0,
  15: 0,
  16: 0,
}

// Allowed maps — Miramar, Erangel, Rondo only
const ALLOWED_MAPS = ['Miramar', 'Erangel', 'Rondo'] as const

// Fallback demo matches if database has no matches yet
const DEMO_MATCHES: MatchRow[] = [
  { id: 'match-1',  round: 1, group_number: 1, map: 'Erangel', match_number: 1,  status: 'live',    created_at: '', updated_at: '' },
  { id: 'match-2',  round: 1, group_number: 2, map: 'Miramar', match_number: 2,  status: 'pending', created_at: '', updated_at: '' },
  { id: 'match-3',  round: 1, group_number: 3, map: 'Rondo',   match_number: 3,  status: 'pending', created_at: '', updated_at: '' },
  { id: 'match-4',  round: 1, group_number: 4, map: 'Erangel', match_number: 4,  status: 'pending', created_at: '', updated_at: '' },
  { id: 'match-5',  round: 1, group_number: 5, map: 'Miramar', match_number: 5,  status: 'pending', created_at: '', updated_at: '' },
  { id: 'match-6',  round: 1, group_number: 6, map: 'Rondo',   match_number: 6,  status: 'pending', created_at: '', updated_at: '' },
  { id: 'match-7',  round: 1, group_number: 7, map: 'Erangel', match_number: 7,  status: 'pending', created_at: '', updated_at: '' },
  { id: 'match-8',  round: 1, group_number: 8, map: 'Miramar', match_number: 8,  status: 'pending', created_at: '', updated_at: '' },
  { id: 'match-9',  round: 2, group_number: 1, map: 'Miramar', match_number: 9,  status: 'pending', created_at: '', updated_at: '' },
  { id: 'match-10', round: 2, group_number: 2, map: 'Rondo',   match_number: 10, status: 'pending', created_at: '', updated_at: '' },
  { id: 'match-11', round: 2, group_number: 3, map: 'Erangel', match_number: 11, status: 'pending', created_at: '', updated_at: '' },
  { id: 'match-12', round: 2, group_number: 4, map: 'Miramar', match_number: 12, status: 'pending', created_at: '', updated_at: '' },
]

export interface TeamScoreItem {
  teamId: string
  teamName: string
  teamTag: string
  logoUrl: string | null
  kills: number
  placement: number | null
  placementPoints: number
  killPoints: number
  totalPoints: number
  alive: number
  knocked: number
}

interface Props {
  className?: string
}

export default function LivePointsTableSection({ className = '' }: Props) {
  // Matches state
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [selectedMatchId, setSelectedMatchId] = useState<string>('')
  const [matchesLoading, setMatchesLoading] = useState(true)

  // Scores and teams state
  const [scoresData, setScoresData] = useState<Record<string, TeamScoreItem>>({})
  const [scoresLoading, setScoresLoading] = useState(false)
  const [isSaving, startSaveTransition] = useTransition()
  const [isResetting, startResetTransition] = useTransition()

  // Feedback & HUD display toggles
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [autoSort, setAutoSort] = useState(true)
  const [showStatusOnHud, setShowStatusOnHud] = useState(true)

  // pendingGroup: set when operator switches to a group that has no DB match yet.
  // Stores { round, group } so the UI can show the correct empty state and "Start Match" button
  // without silently creating a DB record.
  const [pendingGroup, setPendingGroup] = useState<{ round: number; group: number } | null>(null)

  // ─── 1. Load matches on mount ──────────────────────────────────────────────
  const loadMatches = useCallback(async () => {
    setMatchesLoading(true)
    const result = await getMatches()
    if (result.success && result.data && result.data.length > 0) {
      setMatches(result.data)
      setSelectedMatchId((prev) => {
        // If previous match is still in the list, keep it; otherwise default to live match or first
        if (prev && result.data!.some((m) => m.id === prev)) return prev
        const liveMatch = result.data!.find((m) => m.status === 'live')
        return liveMatch ? liveMatch.id : result.data![0].id
      })
    } else {
      // Use demo matches if offline or empty
      setMatches(DEMO_MATCHES)
      setSelectedMatchId(DEMO_MATCHES[0].id)
    }
    setMatchesLoading(false)
  }, [])

  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  // Current selected match object
  const currentMatch = useMemo(() => {
    return matches.find((m) => m.id === selectedMatchId) ?? matches[0] ?? null
  }, [matches, selectedMatchId])

  // ─── 2. Load teams & scores whenever selectedMatchId changes ───────────────
  const loadScoresForMatch = useCallback(async (matchId: string) => {
    if (!matchId) return
    setScoresLoading(true)
    setStatusMessage(null)

    const result = await getMatchScores(matchId)
    let teams: TeamRow[] = []
    let scores: LiveScoreRow[] = []
    let teamStatus: Record<string, { alive: number; knocked: number }> = {}

    if (result.success && result.data) {
      teams = result.data.teams
      scores = result.data.scores
      teamStatus = result.data.teamStatus || {}
    }

    // Map scores by team_id
    const scoreMap = new Map<string, LiveScoreRow>()
    scores.forEach((s) => scoreMap.set(s.team_id, s))

    const newRows: Record<string, TeamScoreItem> = {}
    teams.forEach((team) => {
      const existing = scoreMap.get(team.id)
      const kills = existing ? existing.kills : 0
      const placement = existing?.position ?? null
      const totalPoints = existing ? existing.points : 0
      const killPoints = kills * 1
      const placementPoints = Math.max(0, totalPoints - killPoints)

      // Initial squad health: check saved status or default based on placement
      const savedStatus = teamStatus[team.id]
      let alive = 4
      let knocked = 0

      if (savedStatus) {
        alive = savedStatus.alive
        knocked = savedStatus.knocked
      } else if (placement !== null && placement > 1) {
        alive = 0
        knocked = 0
      }

      newRows[team.id] = {
        teamId: team.id,
        teamName: team.name,
        teamTag: team.tag,
        logoUrl: team.logo_url,
        kills,
        placement,
        placementPoints,
        killPoints,
        totalPoints: placementPoints + killPoints,
        alive,
        knocked,
      }
    })

    setScoresData(newRows)
    setScoresLoading(false)
  }, [])

  useEffect(() => {
    if (selectedMatchId) {
      loadScoresForMatch(selectedMatchId)
    }
  }, [selectedMatchId, loadScoresForMatch])

  // ─── 3. Handle manual input changes ────────────────────────────────────────
  const handleScoreChange = (
    teamId: string,
    field: 'kills' | 'placement' | 'placementPoints',
    rawVal: string
  ) => {
    setScoresData((prev) => {
      const current = prev[teamId]
      if (!current) return prev

      const updated = { ...current }

      if (field === 'kills') {
        const val = rawVal === '' ? 0 : Math.max(0, parseInt(rawVal, 10) || 0)
        updated.kills = val
        updated.killPoints = val * 1
        updated.totalPoints = updated.placementPoints + updated.killPoints
      } else if (field === 'placement') {
        const val = rawVal === '' ? null : Math.max(1, parseInt(rawVal, 10) || 1)
        updated.placement = val
        // Auto-assign BGMI placement points if valid placement
        if (val !== null && val in BGMI_PLACEMENT_POINTS) {
          updated.placementPoints = BGMI_PLACEMENT_POINTS[val]
        }
        // If team finished > 1, auto-eliminate squad (alive = 0)
        if (val !== null && val > 1) {
          updated.alive = 0
          updated.knocked = 0
          if (selectedMatchId) {
            setTeamAliveStatus(selectedMatchId, teamId, 0, 0).catch(() => {})
            notifyRealtimeChange('live_scores', 'UPDATE', { matchId: selectedMatchId })
          }
        } else if (val === null && updated.alive === 0) {
          // If placement cleared and previously eliminated, restore to 4 alive
          updated.alive = 4
          updated.knocked = 0
          if (selectedMatchId) {
            setTeamAliveStatus(selectedMatchId, teamId, 4, 0).catch(() => {})
            notifyRealtimeChange('live_scores', 'UPDATE', { matchId: selectedMatchId })
          }
        }
        updated.totalPoints = updated.placementPoints + updated.killPoints
      } else if (field === 'placementPoints') {
        const val = rawVal === '' ? 0 : Math.max(0, parseInt(rawVal, 10) || 0)
        updated.placementPoints = val
        updated.totalPoints = updated.placementPoints + updated.killPoints
      }

      return { ...prev, [teamId]: updated }
    })
  }

  // Handle Alive / Knocked direct updates
  const handleStatusChange = (
    teamId: string,
    field: 'alive' | 'knocked',
    value: number
  ) => {
    setScoresData((prev) => {
      const current = prev[teamId]
      if (!current) return prev

      let newAlive = field === 'alive' ? Math.max(0, Math.min(4, value)) : current.alive
      let newKnocked = field === 'knocked' ? Math.max(0, Math.min(3, value)) : current.knocked

      if (newAlive === 0) {
        newKnocked = 0
      }
      if (newKnocked > newAlive) {
        newKnocked = newAlive
      }

      // Realtime sync to OBS
      if (selectedMatchId) {
        setTeamAliveStatus(selectedMatchId, teamId, newAlive, newKnocked).catch(() => {})
        notifyRealtimeChange('live_scores', 'UPDATE', { matchId: selectedMatchId, teamId })
      }

      return {
        ...prev,
        [teamId]: {
          ...current,
          alive: newAlive,
          knocked: newKnocked,
        },
      }
    })
  }

  // Toggle HUD status visibility
  const handleToggleHudStatus = async () => {
    const next = !showStatusOnHud
    setShowStatusOnHud(next)
    await toggleOverlayStatusBars(next)
    notifyRealtimeChange('broadcast_state', 'UPDATE', { show_status_bars: next })
  }

  // ─── 4. Sorted list of teams ───────────────────────────────────────────────
  // Sort rules:
  // 1. Total Points (descending)
  // 2. Kills (descending)
  // 3. Team Name (ascending as tie-breaker)
  const sortedScores = useMemo(() => {
    const list = Object.values(scoresData)
    if (!autoSort) return list

    return [...list].sort((a, b) => {
      // 1. Total Points descending
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      // 2. Placement Points descending (higher placement pts = better finish = ranks higher)
      if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints
      // 3. Kill Points descending
      if (b.kills !== a.kills) return b.kills - a.kills
      // 4. Alphabetical
      return a.teamName.localeCompare(b.teamName)
    })
  }, [scoresData, autoSort])

  // ─── 5. Match attribute selectors ──────────────────────────────────────────
  const uniqueRounds = useMemo(() => {
    const set = new Set<number>()
    matches.forEach((m) => { if (m.round) set.add(m.round) })
    if (set.size === 0) [1, 2, 3, 4, 5].forEach((r) => set.add(r))
    return Array.from(set).sort((a, b) => a - b)
  }, [matches])

  const uniqueGroups = useMemo(() => {
    const set = new Set<number>()
    matches.forEach((m) => { if (m.group_number) set.add(m.group_number) })
    if (set.size === 0) [1, 2, 3, 4, 5, 6, 7, 8].forEach((g) => set.add(g))
    return Array.from(set).sort((a, b) => a - b)
  }, [matches])

  // Maps are fixed — only Miramar, Erangel, Rondo
  const uniqueMaps = ALLOWED_MAPS

  // All matches for the current group and round, sorted by match_number (ascending = chronological)
  const currentGroupMatches = useMemo(() => {
    const grp = currentMatch?.group_number ?? 1
    const rnd = currentMatch?.round ?? 1
    return matches
      .filter((m) => m.group_number === grp && m.round === rnd)
      .sort((a, b) => a.match_number - b.match_number)
  }, [matches, currentMatch])

  // Per-group index of the current match (1-based). Used everywhere instead of global match_number.
  const currentGroupMatchIndex = useMemo(() => {
    if (!currentMatch) return 1
    const idx = currentGroupMatches.findIndex((m) => m.id === currentMatch.id)
    return idx >= 0 ? idx + 1 : 1
  }, [currentMatch, currentGroupMatches])

  const [isCreatingNextMatch, setIsCreatingNextMatch] = useState(false)

  const handleCreateNextMatch = async () => {
    if (!currentMatch) return
    setIsCreatingNextMatch(true)
    const grp = currentMatch.group_number ?? 1
    const rnd = currentMatch.round ?? 1
    try {
      const res = await createNextMatchForGroup(rnd, grp)
      if (res.success && res.data) {
        const newMatch = res.data
        setMatches((prev) =>
          prev.some((m) => m.id === newMatch.id)
            ? prev
            : [...prev, newMatch].sort((a, b) => a.match_number - b.match_number)
        )
        handleMatchChange(newMatch.id)
        setStatusMessage({
          type: 'success',
          text: `Created fresh Match for Group ${grp} (${newMatch.map})!`,
        })
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to create next match.',
        })
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error creating next match.' })
    } finally {
      setIsCreatingNextMatch(false)
    }
  }

  // Handle changing round/group/map/match dropdowns
  const handleSelectAttribute = async (
    attribute: 'round' | 'group' | 'map' | 'match',
    value: string | number
  ) => {
    if (!currentMatch) return

    // ── Per-group match selector: navigate within the current group ──
    if (attribute === 'match') {
      // value is the match ID from the per-group list
      const targetMatch = matches.find((m) => m.id === value)
      if (targetMatch) handleMatchChange(targetMatch.id)
      return
    }

    const currentRound = currentMatch.round ?? 1
    const currentGroup = currentMatch.group_number ?? 1

    const targetRound = attribute === 'round' ? Number(value) : currentRound
    const targetGroup = attribute === 'group' ? Number(value) : currentGroup

    if (attribute === 'map') {
      // Changing map within the same group: find an existing match with that map, or create one.
      const targetMap = String(value)
      const matchWithMap = matches.find(
        (m) => m.round === currentRound && m.group_number === currentGroup && m.map === targetMap
      )
      if (matchWithMap) {
        handleMatchChange(matchWithMap.id)
        return
      }
      // Create a new match for this group+round with the chosen map
      try {
        const res = await getOrCreateMatch(currentRound, currentGroup, targetMap)
        if (res.success && res.data) {
          const newMatch = res.data
          setMatches((prev) =>
            prev.some((m) => m.id === newMatch.id)
              ? prev
              : [...prev, newMatch].sort((a, b) => a.match_number - b.match_number)
          )
          handleMatchChange(newMatch.id)
        }
      } catch { /* quiet fail */ }
      return
    }

    // ── Switching round or group ──
    // ONLY navigate to an existing match. Never auto-create here.
    // If no match exists for the target group, we switch context (group) but stay
    // in a "no match" state — the operator must explicitly press "Start Match".
    const existingForGroup = matches
      .filter((m) => m.round === targetRound && m.group_number === targetGroup)
      .sort((a, b) => a.match_number - b.match_number)

    if (existingForGroup.length > 0) {
      handleMatchChange(existingForGroup[0].id)
    } else {
      // No match in DB for this group yet — store pending context so the UI shows
      // the correct group and a "Start Match" button without touching the DB.
      setPendingGroup({ round: targetRound, group: targetGroup })
    }
  }

  // ── Explicit "Start Match" for a group that has no DB record yet ─────────────
  const handleCreateMatchForGroup = async () => {
    if (!pendingGroup) return
    const { round, group } = pendingGroup
    const defaultMap = ALLOWED_MAPS[(group - 1) % ALLOWED_MAPS.length]
    try {
      const res = await getOrCreateMatch(round, group, defaultMap)
      if (res.success && res.data) {
        const newMatch = res.data
        setMatches((prev) =>
          prev.some((m) => m.id === newMatch.id)
            ? prev
            : [...prev, newMatch].sort((a, b) => a.match_number - b.match_number)
        )
        setPendingGroup(null)
        handleMatchChange(newMatch.id)
      }
    } catch { /* quiet fail */ }
  }

  // ─── 6. Save Scores ────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!selectedMatchId) return
    setStatusMessage(null)

    startSaveTransition(async () => {
      const payload: ScorePayload[] = Object.values(scoresData).map((row) => ({
        teamId: row.teamId,
        kills: row.kills,
        placement: row.placement,
        placementPoints: row.placementPoints,
        totalPoints: row.totalPoints,
        alive: row.alive,
        knocked: row.knocked,
      }))

      const res = await saveScores(selectedMatchId, payload)
      if (res.success) {
        notifyRealtimeChange('live_scores', 'UPDATE', { matchId: selectedMatchId })
        setStatusMessage({ type: 'success', text: 'Scores and squad health saved successfully to Supabase!' })
      } else {
        setStatusMessage({ type: 'error', text: res.error ?? 'Failed to save scores.' })
      }
    })
  }

  // ─── 7. Reset Scores ───────────────────────────────────────────────────────
  const handleConfirmReset = () => {
    if (!selectedMatchId) return
    setShowResetConfirm(false)
    setStatusMessage(null)

    startResetTransition(async () => {
      const res = await resetScores(selectedMatchId)
      if (res.success) {
        // Zero out local state
        setScoresData((prev) => {
          const reset: Record<string, TeamScoreItem> = {}
          Object.values(prev).forEach((row) => {
            reset[row.teamId] = {
              ...row,
              kills: 0,
              placement: null,
              placementPoints: 0,
              killPoints: 0,
              totalPoints: 0,
              alive: 4,
              knocked: 0,
            }
          })
          return reset
        })
        notifyRealtimeChange('live_scores', 'DELETE', { matchId: selectedMatchId })
        setStatusMessage({ type: 'success', text: 'Scores and squad status have been reset for this match.' })
      } else {
        setStatusMessage({ type: 'error', text: res.error ?? 'Failed to reset scores.' })
      }
    })
  }

  // ─── 8. Handle match quick change ──────────────────────────────────────────
  const handleMatchChange = (matchId: string) => {
    setSelectedMatchId(matchId)
    setCurrentBroadcastMatch(matchId).catch(() => {})
    notifyRealtimeChange('matches', 'UPDATE', { matchId })
    notifyRealtimeChange('broadcast_state', 'UPDATE', { current_match_id: matchId })
  }

  // ─── 9. Export points table as CSV ─────────────────────────────────────────
  const handleExportCsv = () => {
    const headers = ['Rank', 'Team Name', 'Tag', 'Kills', 'Placement', 'Placement Pts', 'Kill Pts', 'Total Pts']
    const rows = sortedScores.map((row, idx) => [
      idx + 1,
      `"${row.teamName.replace(/"/g, '""')}"`,
      `"${row.teamTag.replace(/"/g, '""')}"`,
      row.kills,
      row.placement ?? '',
      row.placementPoints,
      row.killPoints,
      row.totalPoints,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const matchLabel = currentMatch
      ? `Match${currentMatch.match_number}_G${currentMatch.group_number}_${currentMatch.map}`
      : 'PointsTable'
    link.href = url
    link.download = `${matchLabel}_Points.csv`
    link.click()
    URL.revokeObjectURL(url)
    setStatusMessage({ type: 'success', text: 'Points table exported as CSV!' })
  }

  // Lobby statistics
  const totalKills = useMemo(() => {
    return Object.values(scoresData).reduce((sum, item) => sum + item.kills, 0)
  }, [scoresData])

  const topTeam = sortedScores[0] ?? null
  const isMatchLive = currentMatch?.status === 'live'

  return (
    <section className={`panel-card live-points-panel ${className}`} id="live-points-table-section">
      {/* ── Header ── */}
      <div className="panel-card-header live-points-header">
        <div className="live-points-title-group">
          <span className="panel-card-icon">🏆</span>
          <div>
            <h2 className="panel-card-title">LIVE POINTS TABLE</h2>
            <p className="panel-card-subtitle">
              BGMI tournament live match scoring & leaderboard engine
            </p>
          </div>
        </div>

        <div className="live-points-header-controls">
          {/* LIVE indicator */}
          <div
            className={`live-indicator-badge ${isMatchLive ? 'live-indicator-badge--active' : ''}`}
            title={isMatchLive ? 'Scoring is currently LIVE' : 'Match is pending/completed'}
          >
            <span className="live-pulse-dot" />
            <span className="live-text">{isMatchLive ? 'LIVE' : currentMatch?.status.toUpperCase() ?? 'MATCH'}</span>
          </div>

          {/* Action buttons */}
          <div className="live-header-actions">
            <button
              id="btn-save-scores"
              className="btn btn--primary"
              onClick={handleSave}
              disabled={isSaving || scoresLoading || matchesLoading}
            >
              {isSaving ? (
                <>
                  <span className="spinner spinner--sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Save Scores</span>
                </>
              )}
            </button>

            <button
              id="btn-export-csv"
              className="btn btn--ghost"
              onClick={handleExportCsv}
              disabled={scoresLoading || sortedScores.length === 0}
              title="Download points table as CSV"
            >
              <span>📥</span>
              <span>Export CSV</span>
            </button>

            <button
              id="btn-reset-scores"
              className="btn btn--danger-ghost"
              onClick={() => setShowResetConfirm(true)}
              disabled={isResetting || scoresLoading || matchesLoading}
            >
              {isResetting ? (
                <>
                  <span className="spinner spinner--sm" />
                  <span>Resetting...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Reset Scores</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Status alert banner ── */}
      {statusMessage && (
        <div
          className={`points-alert points-alert--${statusMessage.type}`}
          role="alert"
        >
          <span>{statusMessage.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{statusMessage.text}</span>
          <button
            className="points-alert-close"
            onClick={() => setStatusMessage(null)}
            aria-label="Dismiss alert"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Operator Match Selectors Bar ── */}
      <div className="points-match-selector-bar">
        <div className="points-selector-group">
          <label htmlFor="select-scoring-match" className="points-selector-label">
            MATCH QUICK SELECT
          </label>
          <select
            id="select-scoring-match"
            className="select points-select points-select--featured"
            value={selectedMatchId}
            onChange={(e) => {
              setPendingGroup(null)
              handleMatchChange(e.target.value)
            }}
            disabled={matchesLoading}
          >
            {matches.map((m, globalIdx) => {
              // Compute per-group label: how many matches exist for this group before this one
              const groupMatches = matches
                .filter((x) => x.group_number === m.group_number)
                .sort((a, b) => a.match_number - b.match_number)
              const groupIdx = groupMatches.findIndex((x) => x.id === m.id) + 1
              return (
                <option key={m.id} value={m.id}>
                  G{m.group_number} Match {groupIdx} · {m.map} · R{m.round} ({m.status.toUpperCase()})
                </option>
              )
            })}
          </select>
        </div>

        {/* Round selector */}
        <div className="points-selector-group">
          <label htmlFor="select-scoring-round" className="points-selector-label">
            ROUND
          </label>
          <select
            id="select-scoring-round"
            className="select points-select"
            value={currentMatch?.round ?? 1}
            onChange={(e) => handleSelectAttribute('round', e.target.value)}
            disabled={matchesLoading}
          >
            {uniqueRounds.map((r) => (
              <option key={r} value={r}>
                Round {r}
              </option>
            ))}
          </select>
        </div>

        {/* Group selector — value tracks pendingGroup when no DB match selected yet */}
        <div className="points-selector-group">
          <label htmlFor="select-scoring-group" className="points-selector-label">
            GROUP
          </label>
          <select
            id="select-scoring-group"
            className="select points-select"
            value={pendingGroup ? pendingGroup.group : (currentMatch?.group_number ?? 1)}
            onChange={(e) => {
              setPendingGroup(null)
              handleSelectAttribute('group', e.target.value)
            }}
            disabled={matchesLoading}
          >
            {uniqueGroups.map((g) => (
              <option key={g} value={g}>
                Group {g}
              </option>
            ))}
          </select>
        </div>

        {/* Map selector — only Miramar, Erangel, Rondo */}
        <div className="points-selector-group">
          <label htmlFor="select-scoring-map" className="points-selector-label">
            MAP
          </label>
          <select
            id="select-scoring-map"
            className="select points-select"
            value={currentMatch?.map ?? 'Miramar'}
            onChange={(e) => handleSelectAttribute('map', e.target.value)}
            disabled={matchesLoading}
          >
            {uniqueMaps.map((map) => (
              <option key={map} value={map}>
                {map}
              </option>
            ))}
          </select>
        </div>

        {/* Match selector — per-group only (Match 1, 2, 3 of this group) */}
        <div className="points-selector-group">
          <label htmlFor="select-scoring-match-number" className="points-selector-label">
            MATCH (THIS GROUP)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              id="select-scoring-match-number"
              className="select points-select"
              value={selectedMatchId}
              onChange={(e) => handleSelectAttribute('match', e.target.value)}
              disabled={matchesLoading}
            >
              {currentGroupMatches.map((m, idx) => (
                <option key={m.id} value={m.id}>
                  Match {idx + 1} · {m.map} ({m.status.toUpperCase()})
                </option>
              ))}
            </select>
            <button
              type="button"
              id="btn-add-next-match-for-group"
              className="btn btn--secondary btn--sm"
              onClick={handleCreateNextMatch}
              disabled={isCreatingNextMatch || matchesLoading}
              title={`Start Match ${currentGroupMatches.length + 1} for Group ${currentMatch?.group_number ?? 1}`}
              style={{ padding: '6px 10px', whiteSpace: 'nowrap', fontWeight: 700 }}
            >
              {isCreatingNextMatch ? '...' : '+ Match'}
            </button>
          </div>
        </div>

        {/* Auto-sort toggle */}
        <div className="points-selector-group points-selector-group--toggle">
          <label className="points-selector-label">AUTO-SORT</label>
          <button
            type="button"
            className={`btn btn--sm ${autoSort ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setAutoSort((prev) => !prev)}
            title="Automatically sort teams by Total Points then Kills"
          >
            {autoSort ? '⚡ Sorted' : '⏸ Manual'}
          </button>
        </div>

        {/* HUD Status column toggle */}
        <div className="points-selector-group points-selector-group--toggle">
          <label className="points-selector-label">HUD SQUAD BARS</label>
          <button
            type="button"
            className={`btn btn--sm ${showStatusOnHud ? 'btn--primary' : 'btn--ghost'}`}
            onClick={handleToggleHudStatus}
            title="Toggle whether the squad status bars (Alive / Knocked / Eliminated) are displayed on the OBS HUD overlay"
          >
            {showStatusOnHud ? '🟢 HUD Status: ON' : '⚪ HUD Status: OFF'}
          </button>
        </div>
      </div>

      {/* ── Quick Group Switcher Bar ── */}
      <div className="points-group-quick-pills">
        <span className="points-group-pills-label">SWITCH GROUP:</span>
        <div className="points-group-pills-list">
          {uniqueGroups.map((g) => {
            const isCurrentGroup = pendingGroup
              ? pendingGroup.group === g
              : currentMatch?.group_number === g
            return (
              <button
                key={g}
                type="button"
                className={`points-group-pill ${isCurrentGroup ? 'points-group-pill--active' : ''}`}
                onClick={() => {
                  setPendingGroup(null)  // clear any pending state first
                  handleSelectAttribute('group', g)
                }}
              >
                Group {g}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Summary statistics strip ── */}
      <div className="points-summary-strip">
        <div className="summary-stat-item">
          <span className="summary-stat-label">TEAMS</span>
          <span className="summary-stat-value">{sortedScores.length}</span>
        </div>
        <div className="summary-stat-item">
          <span className="summary-stat-label">TOTAL LOBBY KILLS</span>
          <span className="summary-stat-value summary-stat-value--cyan">{totalKills}</span>
        </div>
        <div className="summary-stat-item">
          <span className="summary-stat-label">LEADER</span>
          <span className="summary-stat-value summary-stat-value--gold">
            {topTeam ? `${topTeam.teamName} (${topTeam.totalPoints} pts)` : '—'}
          </span>
        </div>
        <div className="summary-stat-item">
          <span className="summary-stat-label">SCORING RULE</span>
          <span className="summary-stat-value">Total = Placement Pts + Kills</span>
        </div>
      </div>

      {/* ── Scoring Table ── */}
      <div className="points-table-wrapper">
        {scoresLoading ? (
          <div className="points-loading-container">
            <div className="spinner spinner--lg" />
            <p>Loading match scores from Supabase...</p>
          </div>

        ) : pendingGroup ? (
          /* Group has NO existing match yet — operator must explicitly start one */
          <div className="empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>🎯</div>
            <p className="empty-state-text" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--clr-text)' }}>
              Group {pendingGroup.group} · Round {pendingGroup.round}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--clr-text-3)', maxWidth: '420px', margin: '6px auto 16px' }}>
              No match exists for this group yet. Click <strong>Start Fresh Match</strong> to create Match 1 for Group {pendingGroup.group}.
            </p>
            <button
              id="btn-start-match-for-group"
              className="btn btn--primary"
              onClick={handleCreateMatchForGroup}
            >
              <span>▶️</span>
              <span>Start Fresh Match · Group {pendingGroup.group}</span>
            </button>
          </div>

        ) : sortedScores.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>🛡️</div>
            <p className="empty-state-text" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--clr-text)' }}>
              {/* Use per-group index, not global match_number */}
              No teams assigned to Match {currentGroupMatchIndex} of Group {currentMatch?.group_number ?? 1} (Round {currentMatch?.round ?? 1} · {currentMatch?.map ?? 'Erangel'})
            </p>
            <p style={{ fontSize: '13px', color: 'var(--clr-text-3)', maxWidth: '460px', margin: '6px auto 0' }}>
              Import teams in the <strong>Teams</strong> tab selecting <strong>Round {currentMatch?.round ?? 1}</strong> and <strong>Group {currentMatch?.group_number ?? 1}</strong> to score this match live.
            </p>
          </div>
        ) : (
          <table className="points-table" aria-label="Live Points Table">
            <thead>
              <tr>
                <th className="th-rank">RANK</th>
                <th className="th-team">TEAM</th>
                <th className="th-status" style={{ minWidth: '180px', textAlign: 'center' }}>SQUAD STATUS (ALIVE / KNOCKED)</th>
                <th className="th-num">KILLS</th>
                <th className="th-num">PLACEMENT</th>
                <th className="th-num">PLACEMENT PTS</th>
                <th className="th-num">KILL PTS</th>
                <th className="th-total">TOTAL POINTS</th>
              </tr>
            </thead>
            <tbody>
              {sortedScores.map((row, index) => {
                const rank = index + 1
                const isTop1 = rank === 1
                const isTop2 = rank === 2
                const isTop3 = rank === 3

                return (
                  <tr
                    key={row.teamId}
                    className={`points-row ${isTop1 ? 'points-row--rank1' : isTop2 ? 'points-row--rank2' : isTop3 ? 'points-row--rank3' : ''}`}
                  >
                    {/* Rank */}
                    <td className="td-rank">
                      <div className={`rank-badge rank-badge--${rank <= 3 ? rank : 'normal'}`}>
                        {isTop1 ? '🥇 1' : isTop2 ? '🥈 2' : isTop3 ? '🥉 3' : `#${rank}`}
                      </div>
                    </td>

                    {/* Team info */}
                    <td className="td-team">
                      <div className="team-cell">
                        {row.logoUrl ? (
                          <Image
                            src={row.logoUrl}
                            alt={row.teamName}
                            width={28}
                            height={28}
                            className="team-logo-sm"
                            unoptimized
                          />
                        ) : (
                          <div className="team-logo-fallback">
                            {row.teamTag.slice(0, 3)}
                          </div>
                        )}
                        <div className="team-name-col">
                          <span className="team-fullname">{row.teamName}</span>
                          <span className="team-tag-pill">{row.teamTag}</span>
                        </div>
                      </div>
                    </td>

                    {/* Squad Status (Alive / Knocked / Eliminated) */}
                    <td className="td-status" style={{ padding: '6px 8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        {/* 4 Status Bars visual */}
                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '14px' }}>
                          {[0, 1, 2, 3].map((barIdx) => {
                            const isAlive = barIdx < row.alive
                            const isKnocked = !isAlive && barIdx < row.alive + row.knocked
                            const bg = isAlive ? '#10b981' : isKnocked ? '#f59e0b' : '#334155'
                            return (
                              <span
                                key={barIdx}
                                style={{
                                  width: '9px',
                                  height: '14px',
                                  borderRadius: '2px',
                                  background: bg,
                                  display: 'inline-block',
                                  transition: 'background 0.15s ease',
                                }}
                              />
                            )
                          })}
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              marginLeft: '6px',
                              minWidth: '48px',
                              color: row.alive === 0 ? '#ef4444' : '#10b981',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {row.alive === 0 ? 'ELIM' : `${row.alive} ALIVE`}
                          </span>
                          {row.knocked > 0 && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#f59e0b',
                                background: 'rgba(245, 158, 11, 0.18)',
                                padding: '1px 5px',
                                borderRadius: '3px',
                              }}
                            >
                              {row.knocked} KNOCK
                            </span>
                          )}
                        </div>

                        {/* Quick Action Buttons */}
                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                          {[4, 3, 2, 1, 0].map((num) => (
                            <button
                              key={num}
                              type="button"
                              className={`btn btn--xs ${
                                row.alive === num
                                  ? num === 0
                                    ? 'btn--danger'
                                    : 'btn--primary'
                                  : 'btn--ghost'
                              }`}
                              style={{
                                padding: '1px 5px',
                                fontSize: '10px',
                                minWidth: '22px',
                                height: '20px',
                                fontWeight: row.alive === num ? 700 : 500,
                              }}
                              onClick={() => handleStatusChange(row.teamId, 'alive', num)}
                              title={num === 0 ? 'Eliminate squad (0 players)' : `Set ${num} players alive`}
                            >
                              {num === 0 ? '☠️' : num}
                            </button>
                          ))}

                          {/* Knocked toggle button */}
                          <button
                            type="button"
                            className={`btn btn--xs ${row.knocked > 0 ? 'btn--secondary' : 'btn--ghost'}`}
                            style={{
                              padding: '1px 5px',
                              fontSize: '10px',
                              height: '20px',
                              color: row.knocked > 0 ? '#f59e0b' : 'inherit',
                            }}
                            onClick={() => {
                              const nextKnock = (row.knocked + 1) % (Math.min(row.alive, 3) + 1)
                              handleStatusChange(row.teamId, 'knocked', nextKnock)
                            }}
                            title="Toggle knocked count for this squad"
                          >
                            ⚠️ {row.knocked}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Kills input */}
                    <td className="td-num">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        className="points-input points-input--kills"
                        value={row.kills}
                        onChange={(e) => handleScoreChange(row.teamId, 'kills', e.target.value)}
                        aria-label={`Kills for ${row.teamName}`}
                      />
                    </td>

                    {/* Placement input */}
                    <td className="td-num">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        placeholder="—"
                        className="points-input points-input--placement"
                        value={row.placement ?? ''}
                        onChange={(e) => handleScoreChange(row.teamId, 'placement', e.target.value)}
                        aria-label={`Placement for ${row.teamName}`}
                      />
                    </td>

                    {/* Placement Points input */}
                    <td className="td-num">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        className="points-input points-input--pts"
                        value={row.placementPoints}
                        onChange={(e) => handleScoreChange(row.teamId, 'placementPoints', e.target.value)}
                        aria-label={`Placement points for ${row.teamName}`}
                      />
                    </td>

                    {/* Kill Points (calculated: 1 pt per kill) */}
                    <td className="td-num">
                      <span className="kill-points-display" title={`${row.kills} Kills × 1 pt`}>
                        {row.killPoints}
                      </span>
                    </td>

                    {/* Total Points (auto-calculated) */}
                    <td className="td-total">
                      <div className={`total-points-badge ${isTop1 ? 'total-points-badge--gold' : ''}`}>
                        <span className="total-points-val">{row.totalPoints}</span>
                        <span className="total-points-sub">PTS</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Reset confirmation dialog ── */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Reset Match Scores?"
        message={`Are you sure you want to reset all scores for Match ${currentMatch?.match_number ?? ''} (${currentMatch?.map ?? ''})? This will wipe kills and placement for all teams in this match.`}
        confirmLabel="Reset All Scores"
        isPending={isResetting}
        onConfirm={handleConfirmReset}
        onClose={() => setShowResetConfirm(false)}
      />
    </section>
  )
}
