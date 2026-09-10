'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { TeamRow } from '@/types/database'
import {
  getLiveEliminationOverlayData,
  hideTeamEliminated,
} from '@/app/broadcast/actions/broadcast'
import { notifyRealtimeChange, subscribeToRealtimeTables } from '@/lib/supabase/realtime'

type AnimationPhase = 'entering' | 'visible' | 'exiting' | 'hidden'

const PREVIEW_TEAM: TeamRow = {
  id: 'team-preview',
  name: 'GodLike Esports',
  tag: 'GODL',
  logo_url: null,
  created_at: '',
  updated_at: '',
}

export default function EliminationOverlay() {
  const searchParams = useSearchParams()
  const isPreview = searchParams.get('preview') === 'true' || searchParams.get('test') === 'true'

  const [team, setTeam] = useState<TeamRow | null>(isPreview ? PREVIEW_TEAM : null)
  const [kills, setKills] = useState<number>(isPreview ? 7 : 0)
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>(isPreview ? 'visible' : 'hidden')
  const [isObs, setIsObs] = useState<boolean>(false)

  const animationPhaseRef = useRef<AnimationPhase>(animationPhase)
  animationPhaseRef.current = animationPhase

  const isPreviewRef = useRef<boolean>(isPreview)
  isPreviewRef.current = isPreview

  const lastEventIdRef = useRef<string>('')
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const enterTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Clear all pending transition timers
  const clearAllTimers = () => {
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }

  // Detect OBS Browser Source environment
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as unknown as { obsstudio?: unknown }).obsstudio) {
      setIsObs(true)
    }
  }, [])

  // Trigger test animation locally for testing / staging
  const triggerLocalTest = useCallback(() => {
    clearAllTimers()
    if (!team) setTeam(PREVIEW_TEAM)
    setKills((prev) => (prev > 0 ? prev : 7))
    setAnimationPhase('entering')

    enterTimerRef.current = setTimeout(() => {
      setAnimationPhase('visible')
    }, 450)

    // Vanish start: 3.5s
    exitTimerRef.current = setTimeout(() => {
      setAnimationPhase('exiting')
    }, 3500)

    // Fully vanished: 4.0s
    hideTimerRef.current = setTimeout(() => {
      setAnimationPhase(isPreviewRef.current ? 'visible' : 'hidden')
      lastEventIdRef.current = ''
    }, 4000)
  }, [team])

  // Fetch live elimination state from broadcast_state via server action
  const fetchOverlayData = useCallback(async () => {
    try {
      const res = await getLiveEliminationOverlayData()
      if (!res.success || !res.data) return

      const { showElimination, team: newTeam, kills: newKills, eliminatedAt } = res.data

      // Check if this event was already triggered and expired (older than 4.5s)
      const elapsed = eliminatedAt ? Date.now() - eliminatedAt : 0
      if (eliminatedAt && elapsed > 4500) {
        if (animationPhaseRef.current !== 'hidden' && !isPreviewRef.current) {
          clearAllTimers()
          setAnimationPhase('hidden')
          lastEventIdRef.current = ''
        }
        return
      }

      // If server says hidden or team is missing
      if (!showElimination || !newTeam) {
        if (animationPhaseRef.current !== 'hidden' && !isPreviewRef.current) {
          clearAllTimers()
          setAnimationPhase('exiting')
          exitTimerRef.current = setTimeout(() => {
            setAnimationPhase('hidden')
            lastEventIdRef.current = ''
          }, 550)
        }
        return
      }

      // Active elimination event from broadcast!
      const eventId = `${newTeam.id}-${eliminatedAt || 0}-${newKills}`
      if (eventId !== lastEventIdRef.current || animationPhaseRef.current === 'hidden') {
        lastEventIdRef.current = eventId
        setTeam(newTeam)
        setKills(newKills)
        clearAllTimers()

        // 1. Enter phase (slam / crimson entrance)
        setAnimationPhase('entering')

        // 2. Visible phase
        enterTimerRef.current = setTimeout(() => {
          setAnimationPhase('visible')
        }, 450)

        // 3. Exit phase after 3.5s of showing up
        exitTimerRef.current = setTimeout(() => {
          setAnimationPhase('exiting')
        }, 3500)

        // 4. Fully vanished at 4.0s (within 3-5 seconds)
        hideTimerRef.current = setTimeout(() => {
          setAnimationPhase(isPreviewRef.current ? 'visible' : 'hidden')
          lastEventIdRef.current = ''
          hideTeamEliminated().catch(() => {})
          notifyRealtimeChange('broadcast_state', 'UPDATE', { show_elimination: false })
        }, 4000)
      } else {
        // Just keep values synced if already visible
        setTeam(newTeam)
        setKills(newKills)
      }
    } catch {
      // Quiet fail to keep stream uninterrupted
    }
  }, [])

  // Supabase Realtime subscription — triggers immediately on broadcast_state change
  useEffect(() => {
    fetchOverlayData()

    const unsubscribe = subscribeToRealtimeTables({
      channelName: 'obs-overlay-elimination-realtime',
      tables: ['broadcast_state', 'teams'],
      onChange: () => {
        fetchOverlayData()
      },
    })

    return () => {
      unsubscribe()
      clearAllTimers()
    }
  }, [fetchOverlayData])

  // When in hidden phase and not in preview mode:
  if (animationPhase === 'hidden' && !isPreview) {
    return (
      <div className="obs-canvas obs-canvas--empty">
        {/* Helper pill visible in normal browser, hidden in OBS or clean mode */}
        {!isObs && (
          <div className="obs-standby-pill" id="obs-standby-pill">
            <span className="obs-standby-dot animate-pulse" />
            <span className="obs-standby-title">ELIMINATION OVERLAY READY</span>
            <span className="obs-standby-sub">(OBS: 1920x1080 Transparent)</span>
            <button
              type="button"
              className="obs-standby-btn"
              onClick={triggerLocalTest}
            >
              ⚡ Test Knockout
            </button>
            <Link href="/broadcast" className="obs-standby-link">
              Broadcast Control ↗
            </Link>
          </div>
        )}
      </div>
    )
  }

  const currentTeam = team || PREVIEW_TEAM

  return (
    <div className="obs-canvas">
      {/* Top Preview Bar for positioning/calibration in OBS or Browser */}
      {isPreview && (
        <div className="obs-preview-bar">
          <div className="flex items-center gap-2">
            <span className="obs-preview-badge">TEST PREVIEW</span>
            <span className="text-xs text-white/80 font-mono">1920 × 1080 CANVAS</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="obs-standby-btn"
              onClick={triggerLocalTest}
            >
              ⚡ Replay Animation
            </button>
            <Link href="/overlay/elimination" className="obs-standby-link">
              Switch to Live Standby
            </Link>
            <Link href="/broadcast" className="obs-standby-link">
              Broadcast Control ↗
            </Link>
          </div>
        </div>
      )}

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
          {isPreview && (
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400/90 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
              Preview Mode
            </span>
          )}
        </div>

        {/* Main Content: Team Crest, Names, and Kills Counter */}
        <div className="obs-elim-body">
          {/* Team Crest / Logo Box */}
          <div className="obs-elim-logo-box">
            {currentTeam.logo_url ? (
              <Image
                src={currentTeam.logo_url}
                alt={currentTeam.name}
                width={80}
                height={80}
                className="obs-elim-logo-img"
                unoptimized
              />
            ) : (
              <div className="obs-elim-logo-fallback">
                <span>{currentTeam.tag || currentTeam.name.substring(0, 3)}</span>
              </div>
            )}
          </div>

          {/* Team Info */}
          <div className="obs-elim-team-details">
            <div className="obs-elim-tag-row">
              <span className="obs-elim-team-tag">[{currentTeam.tag}]</span>
            </div>
            <h2 className="obs-elim-team-name">{currentTeam.name}</h2>
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
