'use client'

import { useState } from 'react'
import { DEMO_TEAMS, OverlayKey } from '@/types/broadcast'

interface Props {
  onActivate: (key: OverlayKey) => void
}

export default function TeamEliminationSection({ onActivate }: Props) {
  const [selectedTeam, setSelectedTeam] = useState(DEMO_TEAMS[0])
  const [kills, setKills] = useState<number>(0)

  const handleShow = () => {
    onActivate('eliminationGraphic')
  }

  return (
    <section className="panel-card">
      <div className="panel-card-header">
        <span className="panel-card-icon">💥</span>
        <h2 className="panel-card-title">Team Elimination</h2>
      </div>

      <div className="selector-stack">
        <div className="match-field">
          <label className="field-label" htmlFor="elim-team">Eliminated Team</label>
          <select
            id="elim-team"
            className="field-select"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            {DEMO_TEAMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="match-field">
          <label className="field-label" htmlFor="elim-kills">Kills</label>
          <input
            id="elim-kills"
            type="number"
            min={0}
            max={25}
            className="field-input"
            value={kills}
            onChange={(e) => setKills(Math.max(0, Math.min(25, Number(e.target.value))))}
          />
        </div>

        <div className="elim-preview">
          <div className="elim-skull">☠️</div>
          <div className="elim-info">
            <span className="elim-team">{selectedTeam}</span>
            <span className="elim-detail">Eliminated · {kills} kill{kills !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <button id="btn-show-elimination" className="action-btn action-btn--danger" onClick={handleShow}>
          <span>Show Elimination</span>
          <span className="btn-arrow">→</span>
        </button>
      </div>
    </section>
  )
}
