'use client'

import { useState, useCallback } from 'react'
import { MatchInfo, OverlayKey, OverlayState } from '@/types/broadcast'
import BroadcastHeader from '@/components/broadcast/BroadcastHeader'
import CurrentMatchSection from '@/components/broadcast/CurrentMatchSection'
import BroadcastControlsSection from '@/components/broadcast/BroadcastControlsSection'
import PlayerGraphicSection from '@/components/broadcast/PlayerGraphicSection'
import TeamEliminationSection from '@/components/broadcast/TeamEliminationSection'
import OverlayStatusSection from '@/components/broadcast/OverlayStatusSection'

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

export default function BroadcastDashboard() {
  const [matchInfo, setMatchInfo] = useState<MatchInfo>(DEFAULT_MATCH)
  const [overlays, setOverlays] = useState<OverlayState>(DEFAULT_OVERLAYS)

  const toggleOverlay = useCallback((key: OverlayKey) => {
    setOverlays((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const activateOverlay = useCallback((key: OverlayKey) => {
    setOverlays((prev) => ({ ...prev, [key]: true }))
  }, [])

  return (
    <div className="dashboard-root">
      <BroadcastHeader />

      <main className="dashboard-main">
        {/* Top row: Current Match + Overlay Status */}
        <div className="dashboard-row dashboard-row--top">
          <CurrentMatchSection info={matchInfo} onChange={setMatchInfo} />
          <OverlayStatusSection overlays={overlays} />
        </div>

        {/* Middle row: Broadcast Controls (full width) */}
        <div className="dashboard-row">
          <BroadcastControlsSection overlays={overlays} onToggle={toggleOverlay} />
        </div>

        {/* Bottom row: Player Graphic + Team Elimination */}
        <div className="dashboard-row dashboard-row--bottom">
          <PlayerGraphicSection onActivate={activateOverlay} />
          <TeamEliminationSection onActivate={activateOverlay} />
        </div>
      </main>

      <footer className="dashboard-footer">
        <span>Kabuto Esports Broadcast System</span>
        <span className="footer-sep">·</span>
        <span>v0.1.0</span>
      </footer>
    </div>
  )
}
