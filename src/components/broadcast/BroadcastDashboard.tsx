'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { MatchInfo, OverlayKey, OverlayState } from '@/types/broadcast'
import CurrentMatchSection from '@/components/broadcast/CurrentMatchSection'
import BroadcastControlsSection from '@/components/broadcast/BroadcastControlsSection'
import PlayerGraphicSection from '@/components/broadcast/PlayerGraphicSection'
import TeamEliminationSection from '@/components/broadcast/TeamEliminationSection'
import OverlayStatusSection from '@/components/broadcast/OverlayStatusSection'
import LivePointsTableSection from '@/components/broadcast/LivePointsTableSection'
import MatchGraphicSection from '@/components/broadcast/MatchGraphicSection'

import { getBroadcastState, toggleBroadcastOverlay, hideTeamEliminated } from '@/app/broadcast/actions/broadcast'
import { notifyRealtimeChange, subscribeToRealtimeTables } from '@/lib/supabase/realtime'

const DEFAULT_MATCH: MatchInfo = {
  round: 'Round 1',
  group: 'Group 1',
  map: 'Erangel',
  match: 'Match 1',
}

const DEFAULT_OVERLAYS: OverlayState = {
  pointsTable: false,
  playerGraphic: false,
  eliminationGraphic: false,
  matchGraphic: false,
}

interface Props {
  /** When embedded inside BroadcastShell, skip the outer wrapper (shell owns it) */
  embedded?: boolean
}

export default function BroadcastDashboard({ embedded = false }: Props) {
  const [matchInfo, setMatchInfo] = useState<MatchInfo>(DEFAULT_MATCH)
  const [overlays, setOverlays] = useState<OverlayState>(DEFAULT_OVERLAYS)
  const elimTimerRef = useRef<NodeJS.Timeout | null>(null)

  const scheduleEliminationReset = useCallback(() => {
    if (elimTimerRef.current) clearTimeout(elimTimerRef.current)
    elimTimerRef.current = setTimeout(() => {
      setOverlays((prev) => ({ ...prev, eliminationGraphic: false }))
      hideTeamEliminated().catch(() => {})
      notifyRealtimeChange('broadcast_state', 'UPDATE', {
        show_elimination: false,
        key: 'eliminationGraphic',
        enabled: false,
      })
    }, 4000)
  }, [])

  const syncBroadcastState = useCallback(async () => {
    try {
      const res = await getBroadcastState()
      if (res.success && res.data) {
        const isElimActive = !!res.data.show_elimination
        setOverlays({
          pointsTable: !!res.data.show_points,
          playerGraphic: !!res.data.show_player,
          eliminationGraphic: isElimActive,
          matchGraphic: !!res.data.show_match,
        })
        if (isElimActive) {
          scheduleEliminationReset()
        }
      }
    } catch {}
  }, [scheduleEliminationReset])

  useEffect(() => {
    syncBroadcastState()
    const unsubscribe = subscribeToRealtimeTables({
      channelName: 'dashboard-overlays-sync',
      tables: ['broadcast_state'],
      onChange: () => syncBroadcastState(),
    })
    return () => {
      unsubscribe()
      if (elimTimerRef.current) clearTimeout(elimTimerRef.current)
    }
  }, [syncBroadcastState])

  const toggleOverlay = useCallback((key: OverlayKey) => {
    setOverlays((prev) => {
      const nextVal = !prev[key]
      toggleBroadcastOverlay(key, nextVal).catch(() => {})
      notifyRealtimeChange('broadcast_state', 'UPDATE', { key, enabled: nextVal })
      if (key === 'eliminationGraphic') {
        if (nextVal) {
          scheduleEliminationReset()
        } else if (elimTimerRef.current) {
          clearTimeout(elimTimerRef.current)
        }
      }
      return { ...prev, [key]: nextVal }
    })
  }, [scheduleEliminationReset])

  const activateOverlay = useCallback((key: OverlayKey) => {
    setOverlays((prev) => {
      toggleBroadcastOverlay(key, true).catch(() => {})
      notifyRealtimeChange('broadcast_state', 'UPDATE', { key, enabled: true })
      if (key === 'eliminationGraphic') {
        scheduleEliminationReset()
      }
      return { ...prev, [key]: true }
    })
  }, [scheduleEliminationReset])

  const handleMatchChange = useCallback((info: MatchInfo) => {
    setMatchInfo(info)
    notifyRealtimeChange('matches', 'UPDATE', info)
  }, [])

  const inner = (
    <>
      {/* Top row: Current Match + Overlay Status */}
      <div className="dashboard-row dashboard-row--top">
        <CurrentMatchSection info={matchInfo} onChange={handleMatchChange} />
        <OverlayStatusSection overlays={overlays} />
      </div>

      {/* Middle row: Broadcast Controls (full width) */}
      <div className="dashboard-row">
        <BroadcastControlsSection overlays={overlays} onToggle={toggleOverlay} />
      </div>

      {/* Live Points Table Section (full width) */}
      <div className="dashboard-row">
        <LivePointsTableSection />
      </div>

      {/* Bottom row: Player Graphic + Team Elimination + Match Graphic */}
      <div className="dashboard-row dashboard-row--bottom">
        <PlayerGraphicSection onActivate={activateOverlay} />
        <TeamEliminationSection onActivate={activateOverlay} />
        <MatchGraphicSection onActivate={activateOverlay} />
      </div>
    </>
  )

  // When embedded in the shell, render just the content grid rows
  if (embedded) return <>{inner}</>

  // Standalone mode (legacy — direct access without shell)
  return (
    <div className="dashboard-root">
      <main className="dashboard-main">{inner}</main>
    </div>
  )
}
