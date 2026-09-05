'use client'

import { OverlayKey, OverlayState } from '@/types/broadcast'

interface ControlItem {
  key: OverlayKey
  label: string
  description: string
  icon: string
}

const CONTROLS: ControlItem[] = [
  { key: 'pointsTable',       label: 'Show Points Table',       description: 'Display team standings overlay',    icon: '📊' },
  { key: 'playerGraphic',     label: 'Show Player Graphic',     description: 'Display selected player card',      icon: '👤' },
  { key: 'eliminationGraphic',label: 'Show Elimination Graphic',description: 'Display team elimination banner',   icon: '💥' },
  { key: 'matchGraphic',      label: 'Show Match Graphic',      description: 'Display match start/info graphic',  icon: '🎮' },
]

interface Props {
  overlays: OverlayState
  onToggle: (key: OverlayKey) => void
}

export default function BroadcastControlsSection({ overlays, onToggle }: Props) {
  return (
    <section className="panel-card">
      <div className="panel-card-header">
        <span className="panel-card-icon">🎬</span>
        <h2 className="panel-card-title">Broadcast Controls</h2>
      </div>

      <div className="controls-grid">
        {CONTROLS.map(({ key, label, description, icon }) => {
          const isOn = overlays[key]
          return (
            <button
              key={key}
              id={`btn-${key}`}
              className={`control-btn ${isOn ? 'control-btn--on' : 'control-btn--off'}`}
              onClick={() => onToggle(key)}
              aria-pressed={isOn}
            >
              <div className="control-btn-top">
                <span className="control-icon">{icon}</span>
                <span className={`control-pill ${isOn ? 'pill--on' : 'pill--off'}`}>
                  {isOn ? 'ON' : 'OFF'}
                </span>
              </div>
              <span className="control-label">{label}</span>
              <span className="control-desc">{description}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
