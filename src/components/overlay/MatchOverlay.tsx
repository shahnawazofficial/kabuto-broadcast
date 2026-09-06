'use client'

import { useState, useEffect, useCallback } from 'react'
import type { MatchRow } from '@/types/database'
import { getLiveMatchOverlayData } from '@/app/broadcast/actions/broadcast'
import { subscribeToRealtimeTables } from '@/lib/supabase/realtime'

const DEFAULT_MATCH: MatchRow = {
  id: 'match-1',
  round: 1,
  group_number: 1,
  map: 'Erangel',
  match_number: 1,
  status: 'live',
  created_at: '',
  updated_at: '',
}

export default function MatchOverlay() {
  const [showMatch, setShowMatch] = useState<boolean>(false)
  const [match, setMatch] = useState<MatchRow>(DEFAULT_MATCH)

  const fetchOverlayData = useCallback(async () => {
    try {
      const res = await getLiveMatchOverlayData()
      if (res.success && res.data) {
        setShowMatch(res.data.showMatch)
        if (res.data.match) setMatch(res.data.match)
      }
    } catch {
      // Quiet fail to keep stream uninterrupted
    }
  }, [])

  // Supabase Realtime subscription — updates immediately when match or broadcast_state changes
  useEffect(() => {
    fetchOverlayData()

    const unsubscribe = subscribeToRealtimeTables({
      channelName: 'obs-overlay-match-realtime',
      tables: ['broadcast_state', 'matches'],
      onChange: () => {
        fetchOverlayData()
      },
    })

    return () => {
      unsubscribe()
    }
  }, [fetchOverlayData])

  // Map icon helper
  const getMapIcon = (mapName: string) => {
    const m = mapName.toLowerCase()
    if (m.includes('erangel')) return '🌲'
    if (m.includes('miramar')) return '🏜️'
    if (m.includes('sanhok')) return '🌴'
    if (m.includes('vikendi')) return '❄️'
    return '🗺️'
  }

  // If hidden, render transparent canvas
  if (!showMatch) {
    return <div className="obs-canvas obs-canvas--empty" />
  }

  return (
    <div className="obs-canvas">
      {/* ─── Match Intro Esports Centerpiece Card ──────────────────── */}
      <div className="obs-match-graphic-card">
        {/* Top Warning Accent Bar */}
        <div className="obs-match-laser" />

        {/* Header Ribbon: Tournament Branding */}
        <div className="obs-match-header">
          <div className="obs-match-header-brand">
            <span className="obs-match-crest-icon">🛡️</span>
            <span className="obs-match-brand-name">KABUTO ESPORTS</span>
          </div>
          <div className="obs-match-header-divider" />
          <span className="obs-match-tournament-name">SUMMER DOMINATION — SEASON 1</span>
        </div>

        {/* Main Section Title */}
        <div className="obs-match-sub-bar">
          <span className="obs-match-status-badge">OFFICIAL MATCH BRIEFING</span>
        </div>

        {/* 4 Centerpiece Match Modular Cards */}
        <div className="obs-match-grid">
          {/* Round Card */}
          <div className="obs-match-box">
            <span className="obs-match-box-label">ROUND</span>
            <span className="obs-match-box-value">ROUND {match.round}</span>
          </div>

          {/* Group Card */}
          <div className="obs-match-box">
            <span className="obs-match-box-label">GROUP</span>
            <span className="obs-match-box-value">GROUP {match.group_number}</span>
          </div>

          {/* Map Card */}
          <div className="obs-match-box obs-match-box--highlight">
            <span className="obs-match-box-label">MAP</span>
            <div className="obs-match-map-row">
              <span className="obs-match-map-icon">{getMapIcon(match.map)}</span>
              <span className="obs-match-box-value">{match.map?.toUpperCase() || 'ERANGEL'}</span>
            </div>
          </div>

          {/* Match Card */}
          <div className="obs-match-box obs-match-box--primary">
            <span className="obs-match-box-label">MATCH</span>
            <span className="obs-match-box-value">MATCH {match.match_number}</span>
          </div>
        </div>

        {/* Bottom Status Ribbon */}
        <div className="obs-match-footer">
          <div className="obs-match-footer-item">
            <span className="obs-match-dot" />
            <span>BGMI ESPORTS TOURNAMENT BROADCAST</span>
          </div>
          <div className="obs-match-footer-item font-mono text-xs opacity-75">
            <span>LIVE SERVER // 60 FPS</span>
          </div>
        </div>
      </div>
    </div>
  )
}
