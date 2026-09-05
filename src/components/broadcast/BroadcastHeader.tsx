// Header is purely presentational — no interactivity needed, no 'use client'

export default function BroadcastHeader() {
  return (
    <header className="broadcast-header">
      <div className="header-inner">
        <div className="header-logo">
          <div className="logo-mark">K</div>
          <div className="header-titles">
            <h1 className="header-brand">KABUTO ESPORTS</h1>
            <p className="header-sub">BROADCAST CONTROL</p>
          </div>
        </div>
        <div className="header-badge">
          <span className="live-dot" />
          LIVE OPS
        </div>
      </div>
    </header>
  )
}
