'use client'

import { useState, useEffect, useCallback, useMemo, useTransition } from 'react'
import Image from 'next/image'
import type { MatchRow, TeamRow, LiveScoreRow } from '@/types/database'
import {
  getMatches,
  getMatchScores,
  saveScores,
  resetScores,
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

// Fallback demo teams if database has no teams yet
const DEMO_TEAMS: TeamRow[] = [
  { id: 'demo-1', name: 'Soul Esports',     tag: 'SOUL',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-2', name: 'Team XSpark',      tag: 'TX',    logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-3', name: 'Global Esports',   tag: 'GE',    logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-4', name: 'GodLike Esports',  tag: 'GODL',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-5', name: 'OR Esports',       tag: 'OR',    logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-6', name: 'Skylightz Gaming', tag: 'SKYLZ', logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-7', name: '7Sea Esports',     tag: '7SEA',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-8', name: 'Enigma Gaming',    tag: 'EG',    logo_url: null, created_at: '', updated_at: '' },
]

// Fallback demo matches if database has no matches yet
const DEMO_MATCHES: MatchRow[] = [
  { id: 'match-1', round: 1, group_number: 1, map: 'Erangel', match_number: 1, status: 'live',      created_at: '', updated_at: '' },
  { id: 'match-2', round: 1, group_number: 1, map: 'Miramar', match_number: 2, status: 'pending',   created_at: '', updated_at: '' },
  { id: 'match-3', round: 1, group_number: 1, map: 'Sanhok',  match_number: 3, status: 'pending',   created_at: '', updated_at: '' },
  { id: 'match-4', round: 2, group_number: 1, map: 'Erangel', match_number: 4, status: 'pending',   created_at: '', updated_at: '' },
  { id: 'match-5', round: 2, group_number: 2, map: 'Miramar', match_number: 5, status: 'pending',   created_at: '', updated_at: '' },
  { id: 'match-6', round: 3, group_number: 1, map: 'Erangel', match_number: 6, status: 'completed', created_at: '', updated_at: '' },
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

  // Feedback states
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [autoSort, setAutoSort] = useState(true)

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

    if (result.success && result.data) {
      teams = result.data.teams.length > 0 ? result.data.teams : DEMO_TEAMS
      scores = result.data.scores
    } else {
      teams = DEMO_TEAMS
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
      // Calculate placement points as total - killPoints (or default to 0)
      const killPoints = kills * 1
      const placementPoints = Math.max(0, totalPoints - killPoints)

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
        updated.totalPoints = updated.placementPoints + updated.killPoints
      } else if (field === 'placementPoints') {
        const val = rawVal === '' ? 0 : Math.max(0, parseInt(rawVal, 10) || 0)
        updated.placementPoints = val
        updated.totalPoints = updated.placementPoints + updated.killPoints
      }

      return { ...prev, [teamId]: updated }
    })
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
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
      }
      if (b.kills !== a.kills) {
        return b.kills - a.kills
      }
      return a.teamName.localeCompare(b.teamName)
    })
  }, [scoresData, autoSort])

  // ─── 5. Match attribute selectors ──────────────────────────────────────────
  const uniqueRounds = useMemo(() => {
    const set = new Set(matches.map((m) => m.round))
    return Array.from(set).sort((a, b) => a - b)
  }, [matches])

  const uniqueGroups = useMemo(() => {
    const set = new Set(matches.map((m) => m.group_number))
    return Array.from(set).sort((a, b) => a - b)
  }, [matches])

  const uniqueMaps = useMemo(() => {
    const set = new Set(matches.map((m) => m.map))
    return Array.from(set).sort()
  }, [matches])

  // Handle changing round/group/map/match dropdowns
  const handleSelectAttribute = (
    attribute: 'round' | 'group' | 'map' | 'match',
    value: string | number
  ) => {
    if (!currentMatch) return

    let targetMatch: MatchRow | undefined

    if (attribute === 'match') {
      targetMatch = matches.find((m) => m.id === value || m.match_number === Number(value))
    } else if (attribute === 'round') {
      targetMatch = matches.find((m) => m.round === Number(value))
    } else if (attribute === 'group') {
      targetMatch = matches.find((m) => m.group_number === Number(value))
    } else if (attribute === 'map') {
      targetMatch = matches.find((m) => m.map === String(value))
    }

    if (targetMatch) {
      setSelectedMatchId(targetMatch.id)
    }
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
      }))

      const res = await saveScores(selectedMatchId, payload)
      if (res.success) {
        notifyRealtimeChange('live_scores', 'UPDATE', { matchId: selectedMatchId })
        setStatusMessage({ type: 'success', text: 'Scores saved successfully to Supabase!' })
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
            }
          })
          return reset
        })
        notifyRealtimeChange('live_scores', 'DELETE', { matchId: selectedMatchId })
        setStatusMessage({ type: 'success', text: 'Scores have been reset for this match.' })
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
            onChange={(e) => handleMatchChange(e.target.value)}
            disabled={matchesLoading}
          >
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                Match {m.match_number}: Round {m.round} · Group {m.group_number} · {m.map} ({m.status.toUpperCase()})
              </option>
            ))}
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

        {/* Group selector */}
        <div className="points-selector-group">
          <label htmlFor="select-scoring-group" className="points-selector-label">
            GROUP
          </label>
          <select
            id="select-scoring-group"
            className="select points-select"
            value={currentMatch?.group_number ?? 1}
            onChange={(e) => handleSelectAttribute('group', e.target.value)}
            disabled={matchesLoading}
          >
            {uniqueGroups.map((g) => (
              <option key={g} value={g}>
                Group {g}
              </option>
            ))}
          </select>
        </div>

        {/* Map selector */}
        <div className="points-selector-group">
          <label htmlFor="select-scoring-map" className="points-selector-label">
            MAP
          </label>
          <select
            id="select-scoring-map"
            className="select points-select"
            value={currentMatch?.map ?? 'Erangel'}
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

        {/* Match number selector */}
        <div className="points-selector-group">
          <label htmlFor="select-scoring-match-number" className="points-selector-label">
            MATCH
          </label>
          <select
            id="select-scoring-match-number"
            className="select points-select"
            value={currentMatch?.match_number ?? 1}
            onChange={(e) => handleSelectAttribute('match', e.target.value)}
            disabled={matchesLoading}
          >
            {matches.map((m) => (
              <option key={m.id} value={m.match_number}>
                Match {m.match_number}
              </option>
            ))}
          </select>
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
        ) : sortedScores.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">No teams found in database.</p>
          </div>
        ) : (
          <table className="points-table" aria-label="Live Points Table">
            <thead>
              <tr>
                <th className="th-rank">RANK</th>
                <th className="th-team">TEAM</th>
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
