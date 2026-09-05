'use client'

import { useState } from 'react'
import { DEMO_TEAMS, DEMO_PLAYERS, OverlayKey } from '@/types/broadcast'

interface Props {
  onActivate: (key: OverlayKey) => void
}

export default function PlayerGraphicSection({ onActivate }: Props) {
  const [selectedTeam, setSelectedTeam] = useState(DEMO_TEAMS[0])
  const [selectedPlayer, setSelectedPlayer] = useState(DEMO_PLAYERS[DEMO_TEAMS[0]][0])

  const handleTeamChange = (team: string) => {
    setSelectedTeam(team)
    setSelectedPlayer(DEMO_PLAYERS[team][0])
  }

  const handleShow = () => {
    onActivate('playerGraphic')
  }

  return (
    <section className="panel-card">
      <div className="panel-card-header">
        <span className="panel-card-icon">👤</span>
        <h2 className="panel-card-title">Player Graphic</h2>
      </div>

      <div className="selector-stack">
        <div className="match-field">
          <label className="field-label" htmlFor="pg-team">Team</label>
          <select
            id="pg-team"
            className="field-select"
            value={selectedTeam}
            onChange={(e) => handleTeamChange(e.target.value)}
          >
            {DEMO_TEAMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="match-field">
          <label className="field-label" htmlFor="pg-player">Player</label>
          <select
            id="pg-player"
            className="field-select"
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
          >
            {(DEMO_PLAYERS[selectedTeam] ?? []).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="preview-strip">
          <div className="preview-avatar">{selectedPlayer.charAt(0).toUpperCase()}</div>
          <div className="preview-info">
            <span className="preview-player">{selectedPlayer}</span>
            <span className="preview-team">{selectedTeam}</span>
          </div>
        </div>

        <button id="btn-show-player-graphic" className="action-btn action-btn--primary" onClick={handleShow}>
          <span>Show Player Graphic</span>
          <span className="btn-arrow">→</span>
        </button>
      </div>
    </section>
  )
}
