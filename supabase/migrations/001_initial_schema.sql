-- ============================================================
-- GRVD DAW — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Profiles ─────────────────────────────────────────────────
-- Extends auth.users with display info
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text,
  avatar     text not null default '🧢',
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, avatar)
  values (new.id, split_part(new.email, '@', 1), '🧢');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Songs ─────────────────────────────────────────────────────
create table if not exists public.songs (
  id               text primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null,
  bpm              integer not null,
  bars             integer not null,
  key_root         text not null,
  template_id      text not null,
  layers           jsonb not null default '[]',
  tags             text[] not null default '{}',
  collaborators    text[] not null default '{}',
  created_at       bigint not null,         -- epoch ms, matches JS Date.now()
  vocal_blob_url   text,
  pitch_score      float
);

-- ── Tamagotchi state ─────────────────────────────────────────
create table if not exists public.tamagotchi_state (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  needs            jsonb not null default '{"social":70,"creativity":70,"energy":80}',
  mood             text not null default 'chill',
  streak_days      integer not null default 1,
  songs_finished   integer not null default 0,
  songs_abandoned  integer not null default 0,
  last_seen_at     bigint not null default extract(epoch from now()) * 1000,
  updated_at       timestamptz not null default now()
);

-- ── User stats / gamification ────────────────────────────────
create table if not exists public.user_stats (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  total_xp               integer not null default 0,
  unlocked_achievements  text[] not null default '{}',
  longest_streak         integer not null default 0,
  longest_session_ms     bigint not null default 0,
  total_songs_abandoned  integer not null default 0,
  vocal_count            integer not null default 0,
  updated_at             timestamptz not null default now()
);

-- ── Coop sessions ────────────────────────────────────────────
-- Each row is a live co-production room.
-- state stores the shared DAW JSON (layers, template, etc.)
create table if not exists public.coop_sessions (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references auth.users (id) on delete cascade,
  guest_id     uuid references auth.users (id) on delete set null,
  join_code    text not null unique,   -- 6-char uppercase code
  status       text not null default 'waiting',  -- waiting | active | done
  state        jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Row-level security ───────────────────────────────────────

alter table public.profiles          enable row level security;
alter table public.songs             enable row level security;
alter table public.tamagotchi_state  enable row level security;
alter table public.user_stats        enable row level security;
alter table public.coop_sessions     enable row level security;

-- Profiles: users see/edit only their own
create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- Songs: users own their songs; others can read for Listening Booth
create policy "songs: own all"    on public.songs for all    using (auth.uid() = user_id);
create policy "songs: public read" on public.songs for select using (true);

-- Tamagotchi: private to owner
create policy "tam: own all" on public.tamagotchi_state for all using (auth.uid() = user_id);

-- Stats: private to owner
create policy "stats: own all" on public.user_stats for all using (auth.uid() = user_id);

-- Coop sessions: host or guest can read/update; anyone can read to join
create policy "coop: public read"   on public.coop_sessions for select using (true);
create policy "coop: host insert"   on public.coop_sessions for insert with check (auth.uid() = host_id);
create policy "coop: host or guest update" on public.coop_sessions for update
  using (auth.uid() = host_id or auth.uid() = guest_id);

-- ── Realtime ─────────────────────────────────────────────────
-- Enable realtime for coop_sessions so clients get live updates
alter publication supabase_realtime add table public.coop_sessions;
