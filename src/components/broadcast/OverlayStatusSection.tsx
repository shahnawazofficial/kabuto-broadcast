'use client'

import { OverlayState, OVERLAY_STATUS_ITEMS } from '@/types/broadcast'

interface Props {
  overlays: OverlayState
}

export default function OverlayStatusSection({ overlays }: Props) {
  return (
    <section className="panel-card">
      <div className="panel-card-header">
        <span className="panel-card-icon">📡</span>
        <h2 className="panel-card-title">Overlay Status</h2>
      </div>

      <div className="status-grid">
        {OVERLAY_STATUS_ITEMS.map(({ key, label }) => {
          const isOn = overlays[key]
          return (
            <div key={key} className={`status-item ${isOn ? 'status-item--on' : 'status-item--off'}`}>
              <div className="status-dot-wrap">
                <span className={`status-dot ${isOn ? 'dot--on' : 'dot--off'}`} />
              </div>
              <div className="status-text">
                <span className="status-label">{label}</span>
                <span className={`status-value ${isOn ? 'value--on' : 'value--off'}`}>
                  {isOn ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
