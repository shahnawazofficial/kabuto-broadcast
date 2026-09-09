'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { MatchRow } from '@/types/database'
import { getLiveOverlayData, OverlayScoreEntry } from '@/app/broadcast/actions/scores'
import { subscribeToRealtimeTables } from '@/lib/supabase/realtime'

// Default fallback data for immediate render & offline resilience
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

interface Props {
  initialMatchId?: string
  initialLayout?: 'hud' | 'full'
}

export default function PointsOverlay({ initialMatchId, initialLayout = 'hud' }: Props) {
  const [match, setMatch] = useState<MatchRow>(DEFAULT_MATCH)
  const [scores, setScores] = useState<OverlayScoreEntry[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [showPoints, setShowPoints] = useState<boolean>(true)
  const [showStatusBars, setShowStatusBars] = useState<boolean>(true)
  const [layout] = useState<'hud' | 'full'>(initialLayout)

  // Fetch live overlay data from Supabase / server actions
  const fetchData = useCallback(async () => {
    try {
      const res = await getLiveOverlayData(initialMatchId)
      if (res.data) {
        if (res.data.match) {
          setMatch(res.data.match)
        }
        if (res.data.scores !== undefined) {
          setScores(res.data.scores)
        }
        if (res.data.selectedTeamId !== undefined) {
          setSelectedTeamId(res.data.selectedTeamId)
        }
        if (res.data.showPoints !== undefined) {
          setShowPoints(res.data.showPoints)
        }
        if (res.data.showStatusBars !== undefined) {
          setShowStatusBars(res.data.showStatusBars)
        }
      }
    } catch {
      // Quiet fail to maintain broadcast uptime
    }
  }, [initialMatchId])

  // Realtime subscription — updates on score changes, match changes, or team highlights
  useEffect(() => {
    fetchData()

    const unsubscribe = subscribeToRealtimeTables({
      channelName: 'obs-overlay-points-realtime',
      tables: ['live_scores', 'matches', 'broadcast_state', 'teams'],
      onChange: () => {
        fetchData()
      },
    })

    return () => {
      unsubscribe()
    }
  }, [fetchData])

  // If hidden via broadcast control panel, render completely transparent canvas
  if (!showPoints) {
    return <div className="obs-canvas obs-canvas--empty" />
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LAYOUT 1: BGMI PRO SERIES IN-GAME RIGHT-SIDE HUD (DEFAULT)
  // ══════════════════════════════════════════════════════════════════════════
  if (layout === 'hud') {
    // Show top 16 teams (standard BGMI tournament lobby)
    const hudScores = scores.slice(0, 16)

    return (
      <div className="obs-hud-canvas">
        <aside className={`bgmi-hud-panel ${!showStatusBars ? 'bgmi-hud-panel--no-status' : ''}`} aria-label="Live In-Game Tournament Leaderboard">
          {/* Header */}
          <div className="bgmi-hud-header">
            <span className="bgmi-hud-col-rank">#</span>
            <span className="bgmi-hud-col-teams">TEAMS</span>
            {showStatusBars && <span className="bgmi-hud-col-status">STATUS</span>}
            <span className="bgmi-hud-col-fin">FIN</span>
            <span className="bgmi-hud-col-pts">PTS</span>
          </div>

          {/* Team Rows */}
          <div className="bgmi-hud-body">
            {hudScores.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8' }}>
                <span style={{ display: 'block', color: '#f59e0b', fontWeight: 800, fontSize: '12px', letterSpacing: '1px' }}>
                  MATCH {match.match_number}
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                  Round {match.round} · Group {match.group_number}
                </span>
                <span style={{ display: 'block', fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
                  Awaiting Match Lobby...
                </span>
              </div>
            ) : (
              hudScores.map((row) => {
                const isHighlighted = selectedTeamId === row.teamId
                const isEliminated = (row.aliveCount ?? 0) === 0 && row.placement !== null

                return (
                <div
                  key={row.teamId}
                  className={`bgmi-hud-row ${
                    isHighlighted ? 'bgmi-hud-row--highlight' : ''
                  } ${isEliminated ? 'bgmi-hud-row--elim' : ''}`}
                >
                  {/* Rank */}
                  <span className="bgmi-hud-rank">{row.rank}</span>

                  {/* Team Logo + Tag */}
                  <div className="bgmi-hud-team">
                    {row.logoUrl ? (
                      <Image
                        src={row.logoUrl}
                        alt={row.teamName}
                        width={17}
                        height={17}
                        className="bgmi-hud-logo"
                        unoptimized
                      />
                    ) : (
                      <span className="bgmi-hud-tag-fallback">
                        {row.teamTag ? row.teamTag.slice(0, 3) : 'KAB'}
                      </span>
                    )}
                    <span className="bgmi-hud-tag" title={row.teamName}>
                      {row.teamTag || row.teamName}
                    </span>
                  </div>

                  {/* 4 Status Bars (Alive / Knocked / Eliminated) */}
                  {showStatusBars && (
                    <div className="bgmi-hud-status" title={`${row.aliveCount ?? 4} alive`}>
                      {[0, 1, 2, 3].map((barIdx) => {
                        const alive = row.aliveCount ?? 4
                        const knocked = row.knockedCount ?? 0

                        let statusClass = 'bgmi-hud-bar--elim'
                        if (barIdx < alive) {
                          statusClass = 'bgmi-hud-bar--alive'
                        } else if (barIdx < alive + knocked) {
                          statusClass = 'bgmi-hud-bar--knocked'
                        }

                        return (
                          <span
                            key={barIdx}
                            className={`bgmi-hud-bar ${statusClass}`}
                          />
                        )
                      })}
                    </div>
                  )}

                  {/* Finish Points (Kills) */}
                  <span className="bgmi-hud-fin">{row.kills}</span>

                  {/* Total Points */}
                  <span className="bgmi-hud-pts">{row.totalPoints}</span>
                </div>
              )
            }))}
          </div>

          {/* Footer Legend */}
          {showStatusBars && (
            <div className="bgmi-hud-footer">
              <div className="bgmi-hud-legend-item">
                <span className="bgmi-hud-legend-sq bgmi-hud-legend-sq--alive" />
                <span>ALIVE</span>
              </div>
              <div className="bgmi-hud-legend-item">
                <span className="bgmi-hud-legend-sq bgmi-hud-legend-sq--knocked" />
                <span>KNOCKED</span>
              </div>
              <div className="bgmi-hud-legend-item">
                <span className="bgmi-hud-legend-sq bgmi-hud-legend-sq--elim" />
                <span>ELIMINATED</span>
              </div>
            </div>
          )}
        </aside>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LAYOUT 2: FULL-SCREEN POST-MATCH LEADERBOARD CARD (?layout=full)
  // ══════════════════════════════════════════════════════════════════════════
  const isDualColumn = scores.length > 10
  const leftScores = isDualColumn ? scores.slice(0, Math.ceil(scores.length / 2)) : scores
  const rightScores = isDualColumn ? scores.slice(Math.ceil(scores.length / 2)) : []

  return (
    <div className="obs-canvas">
      <div className="obs-points-card">
        {/* Top Brand Bar */}
        <div className="obs-header-top">
          <div className="obs-brand-group">
            <div className="obs-kabuto-crest">
              <span className="obs-crest-icon">🛡️</span>
              <span className="obs-brand-name">KABUTO ESPORTS</span>
            </div>
            <div className="obs-brand-divider" />
            <span className="obs-tournament-title">SUMMER DOMINATION — SEASON 1</span>
          </div>

          <div className="obs-match-meta-pills">
            <span className="obs-pill obs-pill--round">ROUND {match.round}</span>
            <span className="obs-pill obs-pill--group">GROUP {match.group_number}</span>
            <span className="obs-pill obs-pill--map">{match.map?.toUpperCase() || 'ERANGEL'}</span>
            <span className="obs-pill obs-pill--match">MATCH {match.match_number}</span>
          </div>
        </div>

        {/* Title Bar */}
        <div className="obs-header-main">
          <div className="obs-title-left">
            <div className="obs-accent-bar" />
            <h1 className="obs-title-text">LIVE POINTS TABLE</h1>
          </div>

          <div className="obs-live-indicator">
            <span className="obs-pulse-dot" />
            <span className="obs-live-label">LIVE</span>
          </div>
        </div>

        {/* Dual / Single Column Table */}
        {scores.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛡️</div>
            <h2 style={{ fontSize: '20px', color: '#f8fafc', fontWeight: 700 }}>
              ROUND {match.round} · GROUP {match.group_number} LOBBY
            </h2>
            <p style={{ color: '#64748b', marginTop: '8px', fontSize: '14px' }}>
              Waiting for match scores to be recorded in Broadcast Control
            </p>
          </div>
        ) : (
        <div className={`obs-tables-container ${isDualColumn ? 'obs-tables-container--dual' : ''}`}>
          <div className="obs-table-column">
            <table className="obs-table">
              <thead>
                <tr>
                  <th className="obs-th-rank">RANK</th>
                  <th className="obs-th-team">TEAM</th>
                  <th className="obs-th-kills">KILLS</th>
                  <th className="obs-th-place">PLACEMENT</th>
                  <th className="obs-th-total">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {leftScores.map((row) => (
                  <FullscreenTableRowItem key={row.teamId} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          {isDualColumn && (
            <div className="obs-table-column">
              <table className="obs-table">
                <thead>
                  <tr>
                    <th className="obs-th-rank">RANK</th>
                    <th className="obs-th-team">TEAM</th>
                    <th className="obs-th-kills">KILLS</th>
                    <th className="obs-th-place">PLACEMENT</th>
                    <th className="obs-th-total">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {rightScores.map((row) => (
                    <FullscreenTableRowItem key={row.teamId} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Footer */}
        <div className="obs-card-footer">
          <div className="obs-footer-left">
            <span className="obs-footer-accent-line" />
            <span className="obs-footer-text">OFFICIAL BROADCAST SCORING · BGMI TOURNAMENT ENGINE</span>
          </div>
          <div className="obs-footer-right">
            <span className="obs-footer-calc">TOTAL = PLACEMENT PTS + KILL PTS</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function FullscreenTableRowItem({ row }: { row: OverlayScoreEntry }) {
  const isRank1 = row.rank === 1
  const isRank2 = row.rank === 2
  const isRank3 = row.rank === 3

  return (
    <tr
      className={`obs-row ${
        isRank1
          ? 'obs-row--rank1'
          : isRank2
          ? 'obs-row--rank2'
          : isRank3
          ? 'obs-row--rank3'
          : ''
      }`}
    >
      <td className="obs-td-rank">
        <div
          className={`obs-rank-pill ${
            isRank1
              ? 'obs-rank-pill--gold'
              : isRank2
              ? 'obs-rank-pill--silver'
              : isRank3
              ? 'obs-rank-pill--bronze'
              : ''
          }`}
        >
          {isRank1 ? '🥇 1' : isRank2 ? '🥈 2' : isRank3 ? '🥉 3' : `#${row.rank}`}
        </div>
      </td>

      <td className="obs-td-team">
        <div className="obs-team-content">
          {row.logoUrl ? (
            <Image
              src={row.logoUrl}
              alt={row.teamName}
              width={32}
              height={32}
              className="obs-team-logo"
              unoptimized
            />
          ) : (
            <div className="obs-team-tag-badge">
              {row.teamTag ? row.teamTag.slice(0, 3) : 'KAB'}
            </div>
          )}
          <span className="obs-team-name">{row.teamName}</span>
          <span className="obs-team-tag-pill">{row.teamTag}</span>
        </div>
      </td>

      <td className="obs-td-kills">
        <span className="obs-num-val obs-num-val--kills">{row.kills}</span>
      </td>

      <td className="obs-td-place">
        <span className="obs-num-val obs-num-val--place">
          {row.placement ? `#${row.placement}` : '—'}
        </span>
      </td>

      <td className="obs-td-total">
        <div className={`obs-total-badge ${isRank1 ? 'obs-total-badge--gold' : ''}`}>
          <span className="obs-total-val">{row.totalPoints}</span>
          <span className="obs-total-label">PTS</span>
        </div>
      </td>
    </tr>
  )
}
