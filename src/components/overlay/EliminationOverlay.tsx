'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import type { TeamRow } from '@/types/database'
import {
  getLiveEliminationOverlayData,
  hideTeamEliminated,
} from '@/app/broadcast/actions/broadcast'

type AnimationPhase = 'entering' | 'visible' | 'exiting' | 'hidden'

export default function EliminationOverlay() {
  const [team, setTeam] = useState<TeamRow | null>(null)
  const [kills, setKills] = useState<number>(0)
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('hidden')

  const lastEliminatedAtRef = useRef<number>(0)
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const enterTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Clear all pending transition timers
  const clearAllTimers = () => {
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }

  // Fetch live elimination state from broadcast_state via server action
  const fetchOverlayData = useCallback(async () => {
    try {
      const res = await getLiveEliminationOverlayData()
      if (!res.success || !res.data) return

      const { showElimination, team: newTeam, kills: newKills, eliminatedAt } = res.data

      // If server says hidden or team is missing
      if (!showElimination || !newTeam) {
        if (animationPhase !== 'hidden') {
          clearAllTimers()
          setAnimationPhase('hidden')
        }
        return
      }

      // If this is a new elimination event (or initial load within 5s window)
      if (eliminatedAt && eliminatedAt !== lastEliminatedAtRef.current) {
        const now = Date.now()
        const elapsed = now - eliminatedAt

        // If the event is older than 5 seconds, auto-expire without showing
        if (elapsed >= 5000) {
          lastEliminatedAtRef.current = eliminatedAt
          clearAllTimers()
          setAnimationPhase('hidden')
          hideTeamEliminated().catch(() => {})
          return
        }

        // Fresh elimination trigger within the 5s window!
        lastEliminatedAtRef.current = eliminatedAt
        setTeam(newTeam)
        setKills(newKills)
        clearAllTimers()

        // 1. Enter phase (slam / crimson bloom entrance)
        setAnimationPhase('entering')

        const remainingTotal = 5000 - elapsed
        const entranceDuration = Math.min(450, remainingTotal)

        // 2. Visible phase
        enterTimerRef.current = setTimeout(() => {
          setAnimationPhase('visible')
        }, entranceDuration)

        // 3. Exit phase (starts ~600ms before total 5s completes)
        const exitDelay = Math.max(0, remainingTotal - 600)
        exitTimerRef.current = setTimeout(() => {
          setAnimationPhase('exiting')
        }, exitDelay)

        // 4. Hidden phase at exactly remainingTotal (complete transparency)
        hideTimerRef.current = setTimeout(() => {
          setAnimationPhase('hidden')
          hideTeamEliminated().catch(() => {})
        }, remainingTotal)
      }
    } catch {
      // Quiet fail to keep stream uninterrupted
    }
  }, [animationPhase])

  // Polling every 1000ms for rapid response to operator triggers
  useEffect(() => {
    fetchOverlayData()
    const interval = setInterval(fetchOverlayData, 1000)
    return () => {
      clearInterval(interval)
      clearAllTimers()
    }
  }, [fetchOverlayData])

  // If hidden, render completely transparent canvas (nothing visible in OBS)
  if (animationPhase === 'hidden' || !team) {
    return <div className="obs-canvas obs-canvas--empty" />
  }

  return (
    <div className="obs-canvas">
      {/* ─── Team Eliminated Floating Esports Banner ─────────────────── */}
      <div className={`obs-elimination-card obs-elimination-card--${animationPhase}`}>
        {/* Top Warning Beam Accent */}
        <div className="obs-elim-laser" />

        {/* Header Ribbon: TEAM ELIMINATED */}
        <div className="obs-elim-header">
          <div className="obs-elim-header-badge">
            <span className="obs-elim-skull">☠</span>
            <span className="obs-elim-title">TEAM ELIMINATED</span>
          </div>
        </div>

        {/* Main Content: Team Crest, Names, and Kills Counter */}
        <div className="obs-elim-body">
          {/* Team Crest / Logo Box */}
          <div className="obs-elim-logo-box">
            {team.logo_url ? (
              <Image
                src={team.logo_url}
                alt={team.name}
                width={80}
                height={80}
                className="obs-elim-logo-img"
                unoptimized
              />
            ) : (
              <div className="obs-elim-logo-fallback">
                <span>{team.tag || team.name.substring(0, 3)}</span>
              </div>
            )}
          </div>

          {/* Team Info */}
          <div className="obs-elim-team-details">
            <div className="obs-elim-tag-row">
              <span className="obs-elim-team-tag">[{team.tag}]</span>
            </div>
            <h2 className="obs-elim-team-name">{team.name}</h2>
          </div>

          {/* Kills Module */}
          <div className="obs-elim-kills-box">
            <span className="obs-elim-kills-label">KILLS</span>
            <span className="obs-elim-kills-value">{kills}</span>
          </div>
        </div>

        {/* Bottom Tournament & Sponsor Branding Strip */}
        <div className="obs-elim-footer">
          <div className="obs-elim-footer-inner">
            <span className="obs-elim-brand">KABUTO ESPORTS</span>
            <span className="obs-elim-divider">/ /</span>
            <span className="obs-elim-subbrand">SUMMER DOMINATION — SEASON 1</span>
          </div>
        </div>
      </div>
    </div>
  )
}
