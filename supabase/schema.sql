-- ═══════════════════════════════════════════════════════════════════════════
-- Kabuto Broadcast — Initial Database Schema
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this SQL in the Supabase SQL Editor to set up the database.
-- Go to: https://app.supabase.com → your project → SQL Editor → New query
-- Paste the entire file and click Run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensions ─────────────────────────────────────────────────────────────

-- Enable UUID generation (pgcrypto is available by default in Supabase)
create extension if not exists "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type match_status as enum ('pending', 'live', 'completed');

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- teams
-- Stores esports team information
create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  tag         text not null,            -- Short abbreviation e.g. "SOUL"
  logo_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- players
-- Stores individual player profiles, each belonging to a team
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  name        text not null,            -- Real name
  ign         text not null,            -- In-game name
  photo_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- matches
-- Stores each match in a tournament
create table if not exists matches (
  id            uuid primary key default gen_random_uuid(),
  round         integer not null,
  group_number  integer not null,
  map           text not null,
  match_number  integer not null,
  status        match_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- live_scores
-- Stores per-team scores for each match
create table if not exists live_scores (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches(id) on delete cascade,
  team_id     uuid not null references teams(id) on delete cascade,
  kills       integer not null default 0,
  points      integer not null default 0,
  position    integer,                  -- Finishing position (nullable until match ends)
  updated_at  timestamptz not null default now(),
  unique(match_id, team_id)
);

-- broadcast_state
-- Single-row table that holds the current live broadcast state.
-- Only one row should exist (id = 'singleton').
create table if not exists broadcast_state (
  id                  uuid primary key default gen_random_uuid(),
  current_match_id    uuid references matches(id) on delete set null,
  selected_player_id  uuid references players(id) on delete set null,
  selected_team_id    uuid references teams(id) on delete set null,
  show_points         boolean not null default false,
  show_player         boolean not null default false,
  show_elimination    boolean not null default false,
  show_match          boolean not null default false,
  elimination_team_id uuid references teams(id) on delete set null,
  elimination_kills   integer not null default 0,
  updated_at          timestamptz not null default now()
);

-- ─── updated_at auto-refresh trigger ────────────────────────────────────────

-- Generic trigger function — reused across all tables
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger teams_updated_at
  before update on teams
  for each row execute function set_updated_at();

create or replace trigger players_updated_at
  before update on players
  for each row execute function set_updated_at();

create or replace trigger matches_updated_at
  before update on matches
  for each row execute function set_updated_at();

create or replace trigger live_scores_updated_at
  before update on live_scores
  for each row execute function set_updated_at();

create or replace trigger broadcast_state_updated_at
  before update on broadcast_state
  for each row execute function set_updated_at();

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists players_team_id_idx        on players(team_id);
create index if not exists live_scores_match_id_idx   on live_scores(match_id);
create index if not exists live_scores_team_id_idx    on live_scores(team_id);
create index if not exists matches_status_idx         on matches(status);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- All tables are readable by anonymous users (for overlays/broadcast reads).
-- Writes require service role or authenticated user (manage via Supabase dashboard).

alter table teams           enable row level security;
alter table players         enable row level security;
alter table matches         enable row level security;
alter table live_scores     enable row level security;
alter table broadcast_state enable row level security;

-- Anonymous read policies (overlays can read all data without login)
create policy "Public read: teams"
  on teams for select using (true);

create policy "Public read: players"
  on players for select using (true);

create policy "Public read: matches"
  on matches for select using (true);

create policy "Public read: live_scores"
  on live_scores for select using (true);

create policy "Public read: broadcast_state"
  on broadcast_state for select using (true);

-- Write policies: allow anon to write too (during development / single-operator setup)
-- Tighten these to `auth.role() = 'authenticated'` when you add auth in a later step.
create policy "Anon write: teams"
  on teams for all using (true) with check (true);

create policy "Anon write: players"
  on players for all using (true) with check (true);

create policy "Anon write: matches"
  on matches for all using (true) with check (true);

create policy "Anon write: live_scores"
  on live_scores for all using (true) with check (true);

create policy "Anon write: broadcast_state"
  on broadcast_state for all using (true) with check (true);

-- ─── Seed: initial broadcast_state singleton row ─────────────────────────────
-- Ensures there is always exactly one broadcast state row to upsert against.
insert into broadcast_state (
  show_points, show_player, show_elimination, show_match, elimination_kills
) values (
  true, false, false, false, 0
)
on conflict do nothing;

-- ─── Supabase Realtime Configuration ──────────────────────────────────────────
-- Enable PostgreSQL logical replication for the tables that power live broadcast graphics.
-- Required for Supabase Realtime 'postgres_changes' subscriptions in overlays.
alter publication supabase_realtime add table broadcast_state;
alter publication supabase_realtime add table live_scores;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table players;

