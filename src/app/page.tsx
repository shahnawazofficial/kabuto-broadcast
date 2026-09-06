'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface OverlayItem {
  id: string
  title: string
  path: string
  description: string
  badge: string
  badgeColor: string
  features: string[]
}

const OVERLAYS: OverlayItem[] = [
  {
    id: 'points',
    title: 'Live Standings & Points Table',
    path: '/overlay/points',
    description: 'Realtime leaderboard showing total points, match placements, and team rankings with live updates.',
    badge: 'LEADERBOARD',
    badgeColor: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    features: ['Auto-sorted by points & kills', 'Team crests & tags', 'Realtime logical replication'],
  },
  {
    id: 'match',
    title: 'Match Results & MVP Stats',
    path: '/overlay/match',
    description: 'Post-match and in-game statistics showing map name, round, group, and match kill leaders.',
    badge: 'MATCH STATS',
    badgeColor: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    features: ['Map & round indicators', 'Match kill leaderboards', 'Dynamic team ranking list'],
  },
  {
    id: 'player',
    title: 'Featured Player Spotlight',
    path: '/overlay/player',
    description: 'Lower-third graphic presenting player photo, IGN, real name, team tag, and match statistics.',
    badge: 'SPOTLIGHT',
    badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    features: ['High-res player photo frame', 'Accent glow & team badge', 'One-click toggle from panel'],
  },
  {
    id: 'elimination',
    title: 'Team Elimination Alert',
    path: '/overlay/elimination',
    description: 'High-impact animated broadcast graphic triggering instantly when a team is knocked out.',
    badge: 'ELIMINATION',
    badgeColor: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    features: ['Dramatic skull alert header', 'Total team kills display', 'Smooth OBS fade animations'],
  },
]

export default function Home() {
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const [copiedSchema, setCopiedSchema] = useState(false)
  const [origin, setOrigin] = useState('http://localhost:3000')
  const [schemaText, setSchemaText] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedPath(id)
      setTimeout(() => setCopiedPath(null), 2500)
    } catch {
      // Fallback
    }
  }

  const handleCopySchema = async () => {
    try {
      if (!schemaText) {
        const res = await fetch('/api/schema-sql')
        if (res.ok) {
          const data = await res.text()
          setSchemaText(data)
          await navigator.clipboard.writeText(data)
        }
      } else {
        await navigator.clipboard.writeText(schemaText)
      }
      setCopiedSchema(true)
      setTimeout(() => setCopiedSchema(false), 3000)
    } catch {
      setCopiedSchema(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Top Glass Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#080c14]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-black text-xl shadow-[0_0_18px_rgba(245,158,11,0.35)]">
              K
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-wider text-base uppercase text-white font-['Rajdhani',sans-serif]">
                  Kabuto Esports
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Broadcast Suite v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 tracking-wide">OBS Graphics Engine & Production Director</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <span>Supabase: <strong className="text-white font-mono font-medium">slgyvivvdagayvwrmztl</strong></span>
            </div>

            <Link
              href="/broadcast"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:brightness-110 shadow-[0_0_18px_rgba(245,158,11,0.25)] transition-all active:scale-95"
            >
              <span>Operator Panel</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 flex flex-col gap-12">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/60 via-[#0d1423]/70 to-[#080c14] p-8 md:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl flex flex-col gap-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-bold tracking-widest uppercase w-max">
              ⚡ 1080p 60FPS OBS Studio Overlays
            </div>

            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight font-['Rajdhani',sans-serif]">
              TOURNAMENT GRAPHICS &amp; REALTIME BROADCAST ENGINE
            </h1>

            <p className="text-slate-300 text-base md:text-lg leading-relaxed">
              Professional live esports overlays built for OBS Studio and vMix. Control live leaderboards, player spotlights, match schedules, and elimination cards with instant zero-delay Supabase logical replication.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                href="/broadcast"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black shadow-[0_0_24px_rgba(245,158,11,0.35)] hover:shadow-[0_0_32px_rgba(245,158,11,0.5)] hover:scale-[1.02] active:scale-98 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>Launch Operator Console</span>
              </Link>

              <a
                href="#overlays"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all"
              >
                <span>Browse OBS Browser Sources</span>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        {/* Database Setup Callout */}
        <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0 text-xl font-mono">
              ⚡
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <h3 className="text-white font-bold text-base">Supabase Database Setup</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  API Connected
                </span>
              </div>
              <p className="text-slate-300 text-xs max-w-2xl leading-relaxed">
                Your project credentials (<code className="text-amber-300 font-mono">slgyvivvdagayvwrmztl</code>) are active. To populate your tournament tables (<code className="text-slate-200">teams, players, matches, live_scores, broadcast_state</code>), run the SQL schema in your Supabase SQL Editor.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 w-full md:w-auto">
            <a
              href="https://supabase.com/dashboard/project/slgyvivvdagayvwrmztl/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500 text-black hover:bg-amber-400 transition-colors shadow-[0_0_12px_rgba(245,158,11,0.25)]"
            >
              <span>Open SQL Editor</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            <button
              onClick={handleCopySchema}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <span>{copiedSchema ? '✓ Schema Copied' : 'Copy schema.sql'}</span>
            </button>
          </div>
        </section>

        {/* OBS Browser Source Cards */}
        <section id="overlays" className="flex flex-col gap-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white uppercase tracking-wider font-['Rajdhani',sans-serif]">
                Production Browser Sources
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Add these as transparent Browser Sources in OBS Studio at <strong className="text-slate-200">1920 × 1080</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-md border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>Obs Settings: Width <strong>1920</strong> | Height <strong>1080</strong> | FPS <strong>60</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {OVERLAYS.map((overlay) => {
              const fullUrl = `${origin}${overlay.path}`
              const isCopied = copiedPath === overlay.id

              return (
                <div
                  key={overlay.id}
                  className="rounded-xl border border-slate-800 bg-[#0d1423]/90 p-6 flex flex-col justify-between gap-5 hover:border-slate-700 hover:shadow-xl transition-all relative group"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-[10px] font-extrabold tracking-widest px-2.5 py-1 rounded border uppercase ${overlay.badgeColor}`}>
                        {overlay.badge}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">1920 × 1080</span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                        {overlay.title}
                      </h3>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        {overlay.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {overlay.features.map((feat, idx) => (
                        <span key={idx} className="text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          ✓ {feat}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px] font-mono bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-800/80 overflow-hidden">
                      <span className="text-slate-400 truncate mr-2">{fullUrl}</span>
                      <button
                        onClick={() => copyToClipboard(fullUrl, overlay.id)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors flex-shrink-0 ${
                          isCopied
                            ? 'bg-emerald-500 text-black font-extrabold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {isCopied ? 'Copied URL!' : 'Copy URL'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={overlay.path}
                        target="_blank"
                        className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                      >
                        <span>Open Preview in New Tab</span>
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Workflow Diagram & Instructions */}
        <section className="rounded-2xl border border-slate-800 bg-[#0d1423]/60 p-8 flex flex-col gap-6">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider font-['Rajdhani',sans-serif]">
            Broadcast Workflow Architecture
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2 p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-sm mb-1">
                1
              </div>
              <h4 className="text-sm font-bold text-white">OBS Browser Sources</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Add each overlay URL in OBS as a Browser Source (1920x1080). Overlays feature transparent backgrounds and automatically listen to live broadcast changes.
              </p>
            </div>

            <div className="flex flex-col gap-2 p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-sm mb-1">
                2
              </div>
              <h4 className="text-sm font-bold text-white">Operator Control Panel</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                The director controls toggles, selects active matches, highlights MVP players, and submits elimination alerts in <Link href="/broadcast" className="text-amber-400 underline">/broadcast</Link>.
              </p>
            </div>

            <div className="flex flex-col gap-2 p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm mb-1">
                3
              </div>
              <h4 className="text-sm font-bold text-white">Instant Supabase Realtime</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                PostgreSQL logical replication notifies overlays in milliseconds. No manual OBS refresh or hotkey switching required.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-slate-400 font-semibold">Kabuto Esports Production Suite</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <Link href="/broadcast" className="hover:text-amber-400 transition-colors">Broadcast Control</Link>
          <span>•</span>
          <a href="https://supabase.com/dashboard/project/slgyvivvdagayvwrmztl" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">Supabase Project</a>
        </div>
      </footer>
    </div>
  )
}
