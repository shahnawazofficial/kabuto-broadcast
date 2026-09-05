# Kabuto Broadcast

Professional BGMI esports broadcast control system for **Kabuto Esports**.

Built with [Next.js 16](https://nextjs.org/) · [TypeScript](https://www.typescriptlang.org/) · [Tailwind CSS v4](https://tailwindcss.com/) · [Supabase](https://supabase.com/)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- A [Supabase](https://supabase.com/) account (free tier is fine)

---

## 1. Clone & Install

```bash
git clone https://github.com/shahnawazofficial/kabuto-broadcast.git
cd kabuto-broadcast
npm install
```

---

## 2. Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com/) and sign in.
2. Click **New project** and fill in the details.
3. Wait for the project to finish provisioning (~1–2 minutes).

---

## 3. Set Up Environment Variables

Copy the example file and fill in your real credentials:

```bash
cp .env.example .env.local
```

Then open `.env.local` and replace the placeholder values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Where to find these values:**

1. Open your Supabase project dashboard.
2. Go to **Project Settings** → **API**.
3. Copy the **Project URL** → paste as `NEXT_PUBLIC_SUPABASE_URL`.
4. Copy the **anon / public** key → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

> ⚠️ **Never commit `.env.local` to version control.** It is already gitignored.

---

## 4. Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor** → **New query**.
2. Open the file [`supabase/schema.sql`](./supabase/schema.sql) from this repository.
3. Copy the entire file contents and paste them into the SQL Editor.
4. Click **Run**.

This creates all tables, foreign keys, indexes, RLS policies, `updated_at` triggers, and seeds the initial `broadcast_state` row.

### Tables Created

| Table | Description |
|---|---|
| `teams` | Esports team profiles |
| `players` | Player profiles linked to teams |
| `matches` | Tournament matches (round/group/map) |
| `live_scores` | Per-team kills/points per match |
| `broadcast_state` | Single-row live broadcast control state |

### Re-running the Schema

The SQL uses `create table if not exists` and `on conflict do nothing`, so it is safe to re-run without duplicating data. If you need a clean slate, drop all tables first via the Supabase dashboard → **Table Editor** → **Delete table**.

---

## 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000/broadcast](http://localhost:3000/broadcast) in your browser.

---

## Project Structure

```
src/
├── app/
│   ├── broadcast/         # /broadcast route — Broadcast Control Panel
│   ├── globals.css        # Global design system (dark esports theme)
│   └── layout.tsx         # Root layout
├── components/
│   └── broadcast/         # All broadcast dashboard components
├── lib/
│   └── supabase/
│       ├── client.ts      # Browser Supabase client (Client Components)
│       └── server.ts      # Server Supabase client (Server Components / Route Handlers)
└── types/
    ├── broadcast.ts       # Local broadcast UI types & demo data
    └── database.ts        # TypeScript types matching the Supabase schema

supabase/
└── schema.sql             # Full database schema — run once in Supabase SQL Editor
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## License

Private — Kabuto Esports internal tooling.
