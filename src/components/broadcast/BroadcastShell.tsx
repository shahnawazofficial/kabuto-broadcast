'use client'

import { useState } from 'react'
import BroadcastHeader from '@/components/broadcast/BroadcastHeader'
import BroadcastDashboard from '@/components/broadcast/BroadcastDashboard'
import LivePointsTableSection from '@/components/broadcast/LivePointsTableSection'
import TeamsPanel from '@/components/teams/TeamsPanel'
import PlayersPanel from '@/components/players/PlayersPanel'

type Tab = 'dashboard' | 'points' | 'teams' | 'players'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard',    icon: '🎬' },
  { id: 'points',    label: 'Points Table', icon: '🏆' },
  { id: 'teams',     label: 'Teams',        icon: '🛡️' },
  { id: 'players',   label: 'Players',      icon: '👤' },
]

export default function BroadcastShell() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  return (
    <div className="dashboard-root">
      <BroadcastHeader />

      {/* Tab navigation */}
      <nav className="tab-nav" aria-label="Broadcast sections">
        <div className="tab-nav-inner">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Tab panels */}
      <main className="dashboard-main">
        {activeTab === 'dashboard' && <BroadcastDashboard embedded />}
        {activeTab === 'points'    && <LivePointsTableSection />}
        {activeTab === 'teams'     && <TeamsPanel />}
        {activeTab === 'players'   && <PlayersPanel />}
      </main>

      <footer className="dashboard-footer">
        <span>Kabuto Esports Broadcast System</span>
        <span className="footer-sep">·</span>
        <span>v0.2.0</span>
      </footer>
    </div>
  )
}
