'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { MatchRow } from '@/types/database'
import { getLiveOverlayData, OverlayScoreEntry } from '@/app/broadcast/actions/scores'

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

const DEFAULT_SCORES: OverlayScoreEntry[] = [
  { teamId: 't1', teamName: 'Soul Esports',     teamTag: 'SOUL',  logoUrl: null, kills: 12, placement: 1, totalPoints: 22, rank: 1 },
  { teamId: 't2', teamName: 'Team XSpark',      teamTag: 'TX',    logoUrl: null, kills: 9,  placement: 2, totalPoints: 15, rank: 2 },
  { teamId: 't3', teamName: 'GodLike Esports',  teamTag: 'GODL',  logoUrl: null, kills: 8,  placement: 3, totalPoints: 13, rank: 3 },
  { teamId: 't4', teamName: 'Global Esports',   teamTag: 'GE',    logoUrl: null, kills: 6,  placement: 4, totalPoints: 10, rank: 4 },
  { teamId: 't5', teamName: 'OR Esports',       teamTag: 'OR',    logoUrl: null, kills: 5,  placement: 5, totalPoints: 8,  rank: 5 },
  { teamId: 't6', teamName: 'Skylightz Gaming', teamTag: 'SKYLZ', logoUrl: null, kills: 4,  placement: 6, totalPoints: 6,  rank: 6 },
  { teamId: 't7', teamName: '7Sea Esports',     teamTag: '7SEA',  logoUrl: null, kills: 3,  placement: 7, totalPoints: 4,  rank: 7 },
  { teamId: 't8', teamName: 'Enigma Gaming',    teamTag: 'EG',    logoUrl: null, kills: 2,  placement: 8, totalPoints: 3,  rank: 8 },
]

interface Props {
  initialMatchId?: string
}

export default function PointsOverlay({ initialMatchId }: Props) {
  const [match, setMatch] = useState<MatchRow>(DEFAULT_MATCH)
  const [scores, setScores] = useState<OverlayScoreEntry[]>(DEFAULT_SCORES)

  // Fetch live overlay data from Supabase
  const fetchData = useCallback(async () => {
    try {
      const res = await getLiveOverlayData(initialMatchId)
      if (res.data) {
        if (res.data.match) {
          setMatch(res.data.match)
        }
        if (res.data.scores && res.data.scores.length > 0) {
          setScores(res.data.scores)
        }
      }
    } catch {
      // Quiet fail on polling error to keep OBS stream running smoothly
    }
  }, [initialMatchId])

  // Initial fetch + interval polling (every 2.5s)
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 2500)
    return () => clearInterval(interval)
  }, [fetchData])

  const isDualColumn = scores.length > 10
  const leftScores = isDualColumn ? scores.slice(0, Math.ceil(scores.length / 2)) : scores
  const rightScores = isDualColumn ? scores.slice(Math.ceil(scores.length / 2)) : []

  return (
    <div className="obs-canvas">
      <div className="obs-points-card">
        {/* ─── Top Brand & Tournament Bar ─────────────────────────────── */}
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

        {/* ─── Main Section Title Bar ─────────────────────────────────── */}
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

        {/* ─── Points Table Grid ──────────────────────────────────────── */}
        <div className={`obs-tables-container ${isDualColumn ? 'obs-tables-container--dual' : ''}`}>
          {/* Table (Left column or Full width) */}
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
                  <TableRowItem key={row.teamId} row={row} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Table (Right column for > 10 teams) */}
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
                    <TableRowItem key={row.teamId} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── Bottom Footer Accent Strip ─────────────────────────────── */}
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

function TableRowItem({ row }: { row: OverlayScoreEntry }) {
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
      {/* RANK */}
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

      {/* TEAM */}
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

      {/* KILLS */}
      <td className="obs-td-kills">
        <span className="obs-num-val obs-num-val--kills">{row.kills}</span>
      </td>

      {/* PLACEMENT */}
      <td className="obs-td-place">
        <span className="obs-num-val obs-num-val--place">
          {row.placement ? `#${row.placement}` : '—'}
        </span>
      </td>

      {/* TOTAL */}
      <td className="obs-td-total">
        <div className={`obs-total-badge ${isRank1 ? 'obs-total-badge--gold' : ''}`}>
          <span className="obs-total-val">{row.totalPoints}</span>
          <span className="obs-total-label">PTS</span>
        </div>
      </td>
    </tr>
  )
}
