'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import Image from 'next/image'
import type { TeamRow, PlayerRow } from '@/types/database'
import {
  getBroadcastState,
  setPlayerGraphicState,
  getTeamsAndPlayers,
} from '@/app/broadcast/actions/broadcast'
import { notifyRealtimeChange } from '@/lib/supabase/realtime'
import { OverlayKey } from '@/types/broadcast'

// Fallback demo teams and players if database is empty
const DEMO_TEAMS: TeamRow[] = [
  { id: 'demo-t1', name: 'Soul Esports',     tag: 'SOUL',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-t2', name: 'Team XSpark',      tag: 'TX',    logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-t3', name: 'GodLike Esports',  tag: 'GODL',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'demo-t4', name: 'Global Esports',   tag: 'GE',    logo_url: null, created_at: '', updated_at: '' },
]

const DEMO_PLAYERS: Record<string, PlayerRow[]> = {
  'demo-t1': [
    { id: 'demo-p1', team_id: 'demo-t1', name: 'Tanmay Singh',      ign: 'Neyoo',     photo_url: null, created_at: '', updated_at: '' },
    { id: 'demo-p2', team_id: 'demo-t1', name: 'Abhishek Choudhary', ign: 'Viper',    photo_url: null, created_at: '', updated_at: '' },
    { id: 'demo-p3', team_id: 'demo-t1', name: 'Harpreet Jangra',   ign: 'ClutchGod', photo_url: null, created_at: '', updated_at: '' },
  ],
  'demo-t2': [
    { id: 'demo-p4', team_id: 'demo-t2', name: 'Zbigniew Guzman',   ign: 'Zgod',      photo_url: null, created_at: '', updated_at: '' },
    { id: 'demo-p5', team_id: 'demo-t2', name: 'Axom Singh',         ign: 'Axom',      photo_url: null, created_at: '', updated_at: '' },
  ],
  'demo-t3': [
    { id: 'demo-p6', team_id: 'demo-t3', name: 'Jonathan Amaral',   ign: 'Jonathan',  photo_url: null, created_at: '', updated_at: '' },
    { id: 'demo-p7', team_id: 'demo-t3', name: 'Suraj Majumdar',    ign: 'Neyoo',     photo_url: null, created_at: '', updated_at: '' },
  ],
  'demo-t4': [
    { id: 'demo-p8', team_id: 'demo-t4', name: 'Abhijeet Andhale',  ign: 'Destro',    photo_url: null, created_at: '', updated_at: '' },
    { id: 'demo-p9', team_id: 'demo-t4', name: 'Mayank Jain',       ign: 'Insane',    photo_url: null, created_at: '', updated_at: '' },
  ],
}

interface Props {
  onActivate?: (key: OverlayKey) => void
}

export default function PlayerGraphicSection({ onActivate }: Props) {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [allPlayers, setAllPlayers] = useState<PlayerRow[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [isGraphicActive, setIsGraphicActive] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  // 1. Fetch initial teams, players, and broadcast_state
  const loadData = useCallback(async () => {
    setLoading(true)

    // Fetch teams and players via server action
    const tpRes = await getTeamsAndPlayers()
    const activeTeams = tpRes.data?.teams ?? DEMO_TEAMS
    const activePlayers = tpRes.data?.players ?? Object.values(DEMO_PLAYERS).flat()

    setTeams(activeTeams)
    setAllPlayers(activePlayers)

    // Fetch broadcast state
    const stateRes = await getBroadcastState()
    if (stateRes.success && stateRes.data) {
      const state = stateRes.data
      setIsGraphicActive(state.show_player)

      // Selected team
      let teamId = state.selected_team_id
      if (!teamId || !activeTeams.some((t) => t.id === teamId)) {
        teamId = activeTeams[0].id
      }
      setSelectedTeamId(teamId)

      // Selected player
      let playerId = state.selected_player_id
      const teamPlayers = activePlayers.filter((p) => p.team_id === teamId)
      if (!playerId || !teamPlayers.some((p) => p.id === playerId)) {
        playerId = teamPlayers[0]?.id ?? activePlayers[0]?.id ?? ''
      }
      setSelectedPlayerId(playerId)
    } else {
      const firstTeamId = activeTeams[0].id
      setSelectedTeamId(firstTeamId)
      const firstPlayer = activePlayers.find((p) => p.team_id === firstTeamId) ?? activePlayers[0]
      setSelectedPlayerId(firstPlayer?.id ?? '')
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Current team & player objects
  const currentTeam = teams.find((t) => t.id === selectedTeamId) ?? teams[0] ?? null
  const availablePlayers = allPlayers.filter((p) => p.team_id === selectedTeamId)
  const currentPlayer = allPlayers.find((p) => p.id === selectedPlayerId) ?? availablePlayers[0] ?? null

  // Handle team change
  const handleTeamChange = (newTeamId: string) => {
    setSelectedTeamId(newTeamId)
    const newTeamPlayers = allPlayers.filter((p) => p.team_id === newTeamId)
    const newPlayerId = newTeamPlayers.length > 0 ? newTeamPlayers[0].id : ''
    setSelectedPlayerId(newPlayerId)

    if (isGraphicActive && newPlayerId) {
      setPlayerGraphicState(newTeamId, newPlayerId, true).catch(() => {})
      notifyRealtimeChange('broadcast_state', 'UPDATE', {
        show_player: true,
        selected_player_id: newPlayerId,
        selected_team_id: newTeamId,
      })
    }
  }

  // Handle player change
  const handlePlayerChange = (newPlayerId: string) => {
    setSelectedPlayerId(newPlayerId)
    if (isGraphicActive && newPlayerId) {
      setPlayerGraphicState(selectedTeamId, newPlayerId, true).catch(() => {})
      notifyRealtimeChange('broadcast_state', 'UPDATE', {
        show_player: true,
        selected_player_id: newPlayerId,
        selected_team_id: selectedTeamId,
      })
    }
  }

  // Handle Show
  const handleShow = () => {
    if (!selectedPlayerId) return
    setFeedback(null)
    startTransition(async () => {
      const res = await setPlayerGraphicState(selectedTeamId, selectedPlayerId, true)
      if (res.success) {
        setIsGraphicActive(true)
        notifyRealtimeChange('broadcast_state', 'UPDATE', {
          show_player: true,
          selected_player_id: selectedPlayerId,
          selected_team_id: selectedTeamId,
        })
        setFeedback('Player graphic is now LIVE on /overlay/player')
        onActivate?.('playerGraphic')
      } else {
        setFeedback(res.error ?? 'Failed to show player graphic.')
      }
    })
  }

  // Handle Hide
  const handleHide = () => {
    setFeedback(null)
    startTransition(async () => {
      const res = await setPlayerGraphicState(selectedTeamId, selectedPlayerId, false)
      if (res.success) {
        setIsGraphicActive(false)
        notifyRealtimeChange('broadcast_state', 'UPDATE', { show_player: false })
        setFeedback('Player graphic is HIDDEN from overlay')
      } else {
        setFeedback(res.error ?? 'Failed to hide player graphic.')
      }
    })
  }

  return (
    <section className="panel-card" id="player-graphic-section">
      <div className="panel-card-header">
        <span className="panel-card-icon">👤</span>
        <div className="panel-card-title-wrap">
          <h2 className="panel-card-title">Player Graphic</h2>
          <span className="panel-card-subtitle">Broadcast player overlay control</span>
        </div>
        <div className={`status-pill ${isGraphicActive ? 'status-pill--active' : 'status-pill--inactive'}`}>
          <span className="status-dot" />
          <span>{isGraphicActive ? 'LIVE ON STREAM' : 'HIDDEN'}</span>
        </div>
      </div>

      <div className="selector-stack">
        {/* Team selector */}
        <div className="match-field">
          <label className="field-label" htmlFor="pg-team">Select Team</label>
          <select
            id="pg-team"
            className="field-select"
            value={selectedTeamId}
            onChange={(e) => handleTeamChange(e.target.value)}
            disabled={loading || isPending}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.tag})
              </option>
            ))}
          </select>
        </div>

        {/* Player selector */}
        <div className="match-field">
          <label className="field-label" htmlFor="pg-player">Select Player</label>
          <select
            id="pg-player"
            className="field-select"
            value={selectedPlayerId}
            onChange={(e) => handlePlayerChange(e.target.value)}
            disabled={loading || isPending || availablePlayers.length === 0}
          >
            {availablePlayers.length === 0 ? (
              <option value="">No players in this team</option>
            ) : (
              availablePlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.ign} ({p.name})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Live Preview Strip */}
        <div className="preview-strip">
          {currentPlayer?.photo_url ? (
            <Image
              src={currentPlayer.photo_url}
              alt={currentPlayer.name}
              width={44}
              height={44}
              className="preview-avatar-img"
              unoptimized
            />
          ) : (
            <div className="preview-avatar">
              {currentPlayer?.ign ? currentPlayer.ign.charAt(0).toUpperCase() : '?'}
            </div>
          )}

          <div className="preview-info">
            <div className="preview-player-ign-row">
              <span className="preview-player">{currentPlayer?.ign ?? 'Select Player'}</span>
              {currentTeam?.tag && (
                <span className="team-tag-pill">{currentTeam.tag}</span>
              )}
            </div>
            <span className="preview-team">
              {currentPlayer?.name ? `${currentPlayer.name} · ` : ''}{currentTeam?.name ?? '—'}
            </span>
          </div>

          {currentTeam?.logo_url && (
            <Image
              src={currentTeam.logo_url}
              alt={currentTeam.name}
              width={28}
              height={28}
              className="preview-team-logo"
              unoptimized
            />
          )}
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className={`points-alert points-alert--${isGraphicActive ? 'success' : 'error'}`}>
            <span>{isGraphicActive ? '✓' : 'ℹ'}</span>
            <span>{feedback}</span>
          </div>
        )}

        {/* Show / Hide Action Buttons */}
        <div className="player-graphic-actions">
          <button
            id="btn-show-player-graphic"
            type="button"
            className={`btn ${isGraphicActive ? 'btn--primary' : 'btn--accent-glow'}`}
            onClick={handleShow}
            disabled={loading || isPending || !selectedPlayerId}
          >
            {isPending && isGraphicActive ? (
              <>
                <span className="spinner spinner--sm" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <span>▶</span>
                <span>Show Player Graphic</span>
              </>
            )}
          </button>

          <button
            id="btn-hide-player-graphic"
            type="button"
            className="btn btn--ghost"
            onClick={handleHide}
            disabled={loading || isPending || !isGraphicActive}
          >
            {isPending && !isGraphicActive ? (
              <>
                <span className="spinner spinner--sm" />
                <span>Hiding...</span>
              </>
            ) : (
              <>
                <span>⏹</span>
                <span>Hide Graphic</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
