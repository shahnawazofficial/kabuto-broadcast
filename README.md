# Kabuto Esports — Broadcast Graphics System

Professional BGMI (Battlegrounds Mobile India) esports broadcast graphics and live production control suite for **Kabuto Esports**.

Designed for tournament directors, broadcast operators, and production casters to deliver sleek, TV-grade tournament graphics with zero-delay updates over WebSocket real-time synchronization.

---

## Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Custom Esports Glassmorphic Design System
- **Database & Realtime**: [Supabase](https://supabase.com/) (PostgreSQL + Realtime WebSocket subscriptions)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Streaming Target**: [OBS Studio](https://obsproject.com/) / vMix via 1920×1080 Transparent Browser Sources

---

## Features

- 🎮 **Dedicated Broadcast Control Panel (`/broadcast`)**: Ergonomically structured operator dashboard with immediate visual feedback, state indicators, and dedicated management cards for live scoring, team/player profiles, player spotlights, team eliminations, and match briefing graphics.
- 📊 **Dynamic Points Table (`/overlay/points`)**: Broadcast-ready 16-team leaderboard featuring live rank calculations, kill/placement breakdown, team crests, and dynamic top-3 champion emphasis with 100% canvas transparency.
- 👤 **Player Spotlight Graphic (`/overlay/player`)**: Esports lower-third overlay featuring high-contrast IGN focus, player photo integration, team logos, and dual-tone gradient styling.
- 💀 **Team Elimination Alert (`/overlay/elimination`)**: High-impact elimination banner with sharp geometric accents, kill counters, and an automatic ~4-second broadcast exit transition (vanishes in 3–5 seconds).
- ⚔️ **Match Briefing Graphic (`/overlay/match`)**: Tournament matchup overview presenting Round, Group, Map (Erangel / Miramar / Sanhok / Vikendi), and Match number with smooth entrance animations.
- ⚡ **Zero-Refresh Realtime Sync**: Overlays synchronize instantly via Supabase Realtime WebSocket events and local fallback channels without reloading OBS Browser Sources.

---

## Getting Started

### Prerequisites

- Node.js 18+ or 20+
- npm 9+
- A [Supabase](https://supabase.com/) project (free tier supported)

### 1. Clone & Install

```bash
git clone https://github.com/shahnawazofficial/kabuto-broadcast.git
cd kabuto-broadcast
npm install
```

### 2. Environment Variables Setup

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Populate `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ **Security Notice**: Never commit `.env.local` or any service role keys to version control.

### 3. Database Schema & Realtime Setup

1. Open your Supabase project dashboard and navigate to **SQL Editor** → **New query**.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) to initialize tables (`teams`, `players`, `matches`, `live_scores`, `broadcast_state`), indexes, and RLS policies.
3. Run [`supabase/migrations/20260906_enable_realtime.sql`](./supabase/migrations/20260906_enable_realtime.sql) to add tables to `supabase_realtime` publication.

---

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start local development server with Turbopack |
| `npm run build` | Create optimized production bundle and verify types |
| `npm run start` | Run production server on port 3000 |
| `npm run lint` | Run ESLint checks |

---

## Broadcast URLs

| Purpose | URL | Notes |
|---|---|---|
| **Operator Control Panel** | `http://localhost:3000/broadcast` | Protected tournament operator dashboard |
| **Points Table Overlay** | `http://localhost:3000/overlay/points` | Fullscreen 1920×1080 live leaderboard |
| **Player Graphic Overlay** | `http://localhost:3000/overlay/player` | Lower-third player spotlight |
| **Team Elimination Overlay**| `http://localhost:3000/overlay/elimination` | Auto-timed 4-second elimination notification |
| **Match Graphic Overlay** | `http://localhost:3000/overlay/match` | Pre-match briefing graphic |

---

## OBS Studio Setup Guide

All overlay routes are specifically engineered to run as **OBS Browser Sources** on a standard 1080p canvas.

### Adding an Overlay to OBS:

1. In OBS Studio, navigate to your desired **Scene**.
2. Under **Sources**, click `+` and choose **Browser**.
3. Name the source (e.g., `Kabuto - Points Table` or `Kabuto - Match Briefing`).
4. Enter the source URL (e.g., `http://localhost:3000/overlay/match` or your production domain).
5. Apply the recommended settings below:

### Recommended OBS Browser Source Settings:

| Setting | Value |
|---|---|
| **Width** | `1920` |
| **Height** | `1080` |
| **FPS** | `60` |
| **Custom CSS** | Leave empty or use `body { background-color: rgba(0, 0, 0, 0); margin: 0px auto; overflow: hidden; }` |
| **Shutdown source when not visible** | Checked (recommended for resource conservation) |
| **Refresh browser when scene becomes active**| Unchecked (real-time WebSocket maintains live state) |

### Canvas & Transparency Guarantee

All overlay templates enforce:
- Zero scrollbars (`overflow: hidden !important`)
- Zero margin/padding clipping
- Guaranteed alpha channel transparency (`background: transparent !important`)
- Safe responsive typography preventing line-wrapping on long player or team aliases.

---

## Project Structure

```
kabuto-broadcast/
├── src/
│   ├── app/
│   │   ├── broadcast/          # Control panel page and server actions
│   │   ├── overlay/
│   │   │   ├── points/         # /overlay/points — Live points table
│   │   │   ├── player/         # /overlay/player — Player spotlight lower-third
│   │   │   ├── elimination/    # /overlay/elimination — Team eliminated graphic
│   │   │   └── match/          # /overlay/match — Pre-match briefing graphic
│   │   ├── globals.css         # Glassmorphism, animations, OBS transparency CSS
│   │   └── layout.tsx          # Root HTML shell & fonts
│   ├── components/
│   │   ├── broadcast/          # Control panel modules (Match, Points, Player, Elimination)
│   │   ├── overlay/            # Broadcast overlay renderers with safe image handling
│   │   ├── players/            # Player profile management modal/forms
│   │   └── teams/              # Team management modal/forms
│   ├── lib/
│   │   └── supabase/           # Browser & server Supabase clients + Realtime manager
│   └── types/
│       ├── broadcast.ts        # UI contracts, control states, fallback structures
│       └── database.ts         # Supabase PostgreSQL schema type definitions
└── supabase/
    ├── schema.sql              # Core database schema
    └── migrations/             # Realtime publication migrations
```

---

## License

Private tournament tooling developed for **Kabuto Esports**. All rights reserved.
