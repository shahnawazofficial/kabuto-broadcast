'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import type { MatchRow } from '@/types/database'
import {
  getBroadcastState,
  setMatchGraphicState,
  getLiveMatchOverlayData,
} from '@/app/broadcast/actions/broadcast'
import { notifyRealtimeChange } from '@/lib/supabase/realtime'
import { OverlayKey } from '@/types/broadcast'

interface Props {
  onActivate?: (key: OverlayKey) => void
}

export default function MatchGraphicSection({ onActivate }: Props) {
  const [showMatch, setShowMatch] = useState<boolean>(false)
  const [currentMatch, setCurrentMatch] = useState<MatchRow | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  // Fetch initial match state
  const loadState = useCallback(async () => {
    try {
      const stateRes = await getBroadcastState()
      if (stateRes.success && stateRes.data) {
        setShowMatch(stateRes.data.show_match)
      }

      const matchRes = await getLiveMatchOverlayData()
      if (matchRes.success && matchRes.data?.match) {
        setCurrentMatch(matchRes.data.match)
      }
    } catch {
      // Fallback
    }
  }, [])

  useEffect(() => {
    loadState()
  }, [loadState])

  const handleShow = () => {
    setFeedback(null)
    startTransition(async () => {
      const res = await setMatchGraphicState(true)
      if (res.success) {
        setShowMatch(true)
        notifyRealtimeChange('broadcast_state', 'UPDATE', { show_match: true })
        if (onActivate) onActivate('matchGraphic')
        setFeedback('Match Graphic is now LIVE on /overlay/match')
        setTimeout(() => setFeedback(null), 3500)
      } else {
        setFeedback(res.error ?? 'Failed to show match graphic')
      }
    })
  }

  const handleHide = () => {
    setFeedback(null)
    startTransition(async () => {
      const res = await setMatchGraphicState(false)
      if (res.success) {
        setShowMatch(false)
        notifyRealtimeChange('broadcast_state', 'UPDATE', { show_match: false })
        setFeedback('Match Graphic is now HIDDEN')
        setTimeout(() => setFeedback(null), 3000)
      } else {
        setFeedback(res.error ?? 'Failed to hide match graphic')
      }
    })
  }

  return (
    <section className="panel-card" id="match-graphic-section">
      <div className="panel-card-header">
        <div className="flex items-center gap-2">
          <span className="panel-card-icon">🎮</span>
          <div className="panel-card-title-wrap">
            <h2 className="panel-card-title">Match Graphic</h2>
            <span className="panel-card-subtitle">Match briefing & intro overlay control</span>
          </div>
        </div>
        <div className={`status-pill ${showMatch ? 'status-pill--active' : 'status-pill--inactive'}`}>
          <span className="status-dot" />
          <span>{showMatch ? 'LIVE ON STREAM' : 'HIDDEN'}</span>
        </div>
      </div>

      <div className="selector-stack">
        {/* Match Preview Card */}
        {currentMatch ? (
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                Active Match
              </span>
              <span className="text-white font-black text-sm tracking-wide">
                Round {currentMatch.round} · Group {currentMatch.group_number} · Match {currentMatch.match_number}
              </span>
            </div>
            <span className="px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs rounded uppercase">
              {currentMatch.map}
            </span>
          </div>
        ) : (
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs text-muted-foreground">
            Loading match info...
          </div>
        )}

        {/* Feedback alert */}
        {feedback && (
          <div className="text-xs py-1.5 px-3 rounded bg-white/5 border border-white/10 text-amber-300 text-center font-medium">
            {feedback}
          </div>
        )}

        {/* Control Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            id="btn-show-match-graphic"
            type="button"
            className="action-btn action-btn--primary py-2.5 font-bold tracking-wider"
            onClick={handleShow}
            disabled={isPending || showMatch}
          >
            SHOW
          </button>
          <button
            id="btn-hide-match-graphic"
            type="button"
            className="action-btn action-btn--secondary py-2.5 font-bold tracking-wider"
            onClick={handleHide}
            disabled={isPending || !showMatch}
          >
            HIDE
          </button>
        </div>
      </div>
    </section>
  )
}
