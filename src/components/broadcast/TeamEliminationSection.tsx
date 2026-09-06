'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import Image from 'next/image'
import type { TeamRow } from '@/types/database'
import {
  getBroadcastState,
  triggerTeamEliminated,
  hideTeamEliminated,
  getTeamsAndPlayers,
} from '@/app/broadcast/actions/broadcast'
import { notifyRealtimeChange } from '@/lib/supabase/realtime'
import { OverlayKey } from '@/types/broadcast'

const FALLBACK_TEAMS: TeamRow[] = [
  { id: 'team-godl',  name: 'GodLike Esports',  tag: 'GODL',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'team-soul',  name: 'Soul Esports',     tag: 'SOUL',  logo_url: null, created_at: '', updated_at: '' },
  { id: 'team-tx',    name: 'Team XSpark',      tag: 'TX',    logo_url: null, created_at: '', updated_at: '' },
  { id: 'team-ge',    name: 'Global Esports',   tag: 'GE',    logo_url: null, created_at: '', updated_at: '' },
]

interface Props {
  onActivate?: (key: OverlayKey) => void
}

export default function TeamEliminationSection({ onActivate }: Props) {
  const [teams, setTeams] = useState<TeamRow[]>(FALLBACK_TEAMS)
  const [selectedTeamId, setSelectedTeamId] = useState<string>(FALLBACK_TEAMS[0].id)
  const [kills, setKills] = useState<number>(0)
  const [isActive, setIsActive] = useState<boolean>(false)
  const [countdown, setCountdown] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 1. Fetch teams & broadcast state
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const teamsRes = await getTeamsAndPlayers()
      if (teamsRes.success && teamsRes.data?.teams && teamsRes.data.teams.length > 0) {
        setTeams(teamsRes.data.teams)
        if (!selectedTeamId || !teamsRes.data.teams.some((t) => t.id === selectedTeamId)) {
          setSelectedTeamId(teamsRes.data.teams[0].id)
        }
      }

      const stateRes = await getBroadcastState()
      if (stateRes.success && stateRes.data) {
        if (stateRes.data.elimination_team_id) {
          setSelectedTeamId(stateRes.data.elimination_team_id)
        }
        if (typeof stateRes.data.elimination_kills === 'number') {
          setKills(stateRes.data.elimination_kills)
        }
        if (stateRes.data.show_elimination) {
          setIsActive(true)
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false)
    }
  }, [selectedTeamId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Clear countdown timer on unmount
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
    }
  }, [])

  // Start 5s countdown timer in operator UI
  const startLocalCountdown = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
    }
    setCountdown(5)
    setIsActive(true)

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current)
          setIsActive(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Handle "TEAM ELIMINATED" trigger
  const handleTriggerElimination = () => {
    if (!selectedTeamId) return

    startTransition(async () => {
      setFeedback(null)
      const res = await triggerTeamEliminated(selectedTeamId, kills)
      if (res.success) {
        startLocalCountdown()
        notifyRealtimeChange('broadcast_state', 'UPDATE', {
          show_elimination: true,
          elimination_team_id: selectedTeamId,
          elimination_kills: kills,
        })
        if (onActivate) onActivate('eliminationGraphic')
        setFeedback('Team Eliminated broadcasted! (Auto-hides after 5s)')
        setTimeout(() => setFeedback(null), 4000)
      } else {
        setFeedback(res.error || 'Failed to trigger elimination')
      }
    })
  }

  // Handle "Hide Elimination" manual override
  const handleHideElimination = () => {
    startTransition(async () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
      setIsActive(false)
      setCountdown(0)
      await hideTeamEliminated()
      notifyRealtimeChange('broadcast_state', 'UPDATE', { show_elimination: false })
      setFeedback('Elimination graphic hidden.')
      setTimeout(() => setFeedback(null), 3000)
    })
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0]

  return (
    <section className="panel-card elimination-panel-card">
      <div className="panel-card-header">
        <div className="flex items-center gap-2">
          <span className="panel-card-icon">💥</span>
          <h2 className="panel-card-title">Team Elimination</h2>
        </div>
        <div className="flex items-center gap-2">
          {isActive ? (
            <span className="live-status-pill live-status-pill--live animate-pulse">
              <span className="live-dot" />
              LIVE ({countdown > 0 ? `${countdown}s` : 'ACTIVE'})
            </span>
          ) : (
            <span className="live-status-pill live-status-pill--hidden">
              <span className="hidden-dot" />
              STANDBY
            </span>
          )}
        </div>
      </div>

      <div className="selector-stack">
        {/* Team Selector */}
        <div className="match-field">
          <label className="field-label" htmlFor="elim-team">
            Eliminated Team {loading && <span className="text-xs text-muted-foreground">(loading...)</span>}
          </label>
          <select
            id="elim-team"
            className="field-select"
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            disabled={isPending}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.tag})
              </option>
            ))}
          </select>
        </div>

        {/* Kills Input with Quick Stepper */}
        <div className="match-field">
          <label className="field-label" htmlFor="elim-kills">
            Team Kills
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 font-bold"
              onClick={() => setKills((prev) => Math.max(0, prev - 1))}
              disabled={kills <= 0 || isPending}
            >
              -
            </button>
            <input
              id="elim-kills"
              type="number"
              min={0}
              max={40}
              className="field-input text-center font-mono text-lg font-bold"
              value={kills}
              onChange={(e) => setKills(Math.max(0, Math.min(40, Number(e.target.value) || 0)))}
              disabled={isPending}
            />
            <button
              type="button"
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white rounded border border-white/10 font-bold"
              onClick={() => setKills((prev) => Math.min(40, prev + 1))}
              disabled={kills >= 40 || isPending}
            >
              +
            </button>
          </div>
        </div>

        {/* Dynamic Elimination Preview */}
        {selectedTeam && (
          <div className="elim-preview border border-red-500/30 bg-red-950/20 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-red-900/40 border border-red-500/40 flex items-center justify-center font-black text-red-400 text-sm overflow-hidden shrink-0">
                {selectedTeam.logo_url ? (
                  <Image
                    src={selectedTeam.logo_url}
                    alt={selectedTeam.name}
                    width={44}
                    height={44}
                    className="w-full h-full object-contain"
                    unoptimized
                  />
                ) : (
                  <span>{selectedTeam.tag || selectedTeam.name.substring(0, 3)}</span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm tracking-wide leading-tight">
                  {selectedTeam.name}
                </span>
                <span className="text-red-400 text-xs font-semibold tracking-wider uppercase">
                  [{selectedTeam.tag}] · ELIMINATED
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end pr-1">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Kills</span>
              <span className="text-amber-400 font-mono font-black text-lg leading-none">
                {kills}
              </span>
            </div>
          </div>
        )}

        {/* Feedback Message */}
        {feedback && (
          <div className="text-xs py-1.5 px-3 rounded bg-white/5 border border-white/10 text-red-300 animate-fade-in text-center font-medium">
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            id="btn-show-elimination"
            type="button"
            className="action-btn action-btn--danger w-full py-3 text-base tracking-wider font-extrabold shadow-lg shadow-red-950/40 flex items-center justify-center gap-2"
            onClick={handleTriggerElimination}
            disabled={isPending || !selectedTeamId}
          >
            <span className="text-lg">☠️</span>
            <span>{isPending ? 'BROADCASTING...' : 'TEAM ELIMINATED'}</span>
            <span className="text-xs font-normal opacity-75">(5s Auto)</span>
          </button>

          {isActive && (
            <button
              id="btn-hide-elimination"
              type="button"
              className="action-btn action-btn--secondary w-full py-2 text-xs font-semibold text-gray-300 hover:text-white"
              onClick={handleHideElimination}
              disabled={isPending}
            >
              Hide Elimination Now
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
