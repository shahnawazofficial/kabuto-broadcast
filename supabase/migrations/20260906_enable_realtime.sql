-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Enable Supabase Realtime for Live Broadcast Graphics
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor or via Supabase CLI migration:
-- supabase migration up
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable publication of postgres changes for live overlay synchronization
alter publication supabase_realtime add table broadcast_state;
alter publication supabase_realtime add table live_scores;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table players;
