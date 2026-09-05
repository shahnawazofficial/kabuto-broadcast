'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { PlayerRow, TeamRow } from '@/types/database'
import { getLivePlayerOverlayData } from '@/app/broadcast/actions/broadcast'

export default function PlayerOverlay() {
  const [showPlayer, setShowPlayer] = useState<boolean>(false)
  const [player, setPlayer] = useState<PlayerRow | null>(null)
  const [team, setTeam] = useState<TeamRow | null>(null)

  // Fetch live state from broadcast_state via server action
  const fetchOverlayData = useCallback(async () => {
    try {
      const res = await getLivePlayerOverlayData()
      if (res.success && res.data) {
        setShowPlayer(res.data.showPlayer)
        if (res.data.player) setPlayer(res.data.player)
        if (res.data.team) setTeam(res.data.team)
      }
    } catch {
      // Quiet fail on polling error to keep OBS stream smooth
    }
  }, [])

  // Poll every 1.5s for live operator changes
  useEffect(() => {
    fetchOverlayData()
    const interval = setInterval(fetchOverlayData, 1500)
    return () => clearInterval(interval)
  }, [fetchOverlayData])

  // If not visible, return completely transparent canvas
  if (!showPlayer || !player) {
    return (
      <div className="obs-canvas obs-canvas--empty">
        {/* Completely transparent — nothing rendered */}
      </div>
    )
  }

  return (
    <div className="obs-canvas">
      {/* ─── Featured Player Lower-Third Esports Card ───────────────── */}
      <div className="obs-player-card">
        {/* Left: Player Photo / Avatar */}
        <div className="obs-player-photo-box">
          {player.photo_url ? (
            <Image
              src={player.photo_url}
              alt={player.name}
              width={160}
              height={160}
              className="obs-player-photo-img"
              unoptimized
            />
          ) : (
            <div className="obs-player-photo-placeholder">
              <span className="obs-photo-letter">
                {player.ign ? player.ign.charAt(0).toUpperCase() : 'P'}
              </span>
            </div>
          )}
          <div className="obs-player-photo-glow" />
        </div>

        {/* Right: Player Details & Branding */}
        <div className="obs-player-details">
          {/* Top Brand Banner */}
          <div className="obs-player-top-strip">
            <div className="obs-player-brand">
              <span className="obs-brand-icon">🛡️</span>
              <span className="obs-brand-text">KABUTO ESPORTS</span>
            </div>
            <div className="obs-player-event-tag">SUMMER DOMINATION — S1</div>
          </div>

          {/* Main IGN and Real Name */}
          <div className="obs-player-name-block">
            <div className="obs-ign-row">
              <h1 className="obs-player-ign">{player.ign}</h1>
              {team?.tag && (
                <span className="obs-player-team-tag-pill">{team.tag}</span>
              )}
            </div>
            <div className="obs-player-realname">{player.name}</div>
          </div>

          {/* Bottom: Team affiliation */}
          <div className="obs-player-team-strip">
            {team?.logo_url ? (
              <Image
                src={team.logo_url}
                alt={team.name}
                width={26}
                height={26}
                className="obs-player-team-logo"
                unoptimized
              />
            ) : (
              <div className="obs-player-team-fallback-logo">
                {team?.tag ? team.tag.slice(0, 3) : 'KAB'}
              </div>
            )}
            <span className="obs-player-team-name">{team?.name ?? 'Independent'}</span>
            <span className="obs-player-role-badge">FEATURED PLAYER</span>
          </div>
        </div>

        {/* Decorative corner accents */}
        <div className="obs-corner-accent obs-corner-accent--tl" />
        <div className="obs-corner-accent obs-corner-accent--br" />
      </div>
    </div>
  )
}
