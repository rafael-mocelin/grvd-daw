# GRVD — UE5 Port Guide

Living doc. Everything in this file is here so that when we port the Tamagotchi DAW into Unreal Engine 5.3, we don't have to re-learn the architecture from the running code.

Written for the future-you who opens Unreal, stares at a blank C++ project, and wonders "what from the web prototype do I actually need to carry over?"

Last updated: 2026-04-23

---

## The one rule that makes porting easy

**Game rules live on the server. The client is dumb and disposable.**

Everything that affects the economy — earning XP, spending energy, publishing a song, endorsing another player's song, leveling up — happens on Supabase via server-side functions (RPCs) that the client *calls*. The client never computes authoritative state. The client just renders whatever the server says is true.

If we stick to this rule, the React web app and the Unreal client are interchangeable: they both talk to the same Supabase backend using the same URLs and the same rules. Porting means replacing the UI, not reinventing the game.

---

## What lives where

Think of the stack as three layers.

**Layer 1 — Supabase (the source of truth).** Postgres tables for all persistent state. Row-Level Security policies that lock each player to their own rows. RPCs that enforce every game rule atomically. This is what we carry forward unchanged.

**Layer 2 — the wire (HTTPS + JWT).** The client authenticates as a user (email/OAuth/etc.), gets a JSON Web Token, and uses that token on every request. Supabase knows *who is calling* from the token — not from anything the client sends in the payload. This works identically from a browser, a mobile app, or Unreal.

**Layer 3 — the client (the disposable layer).** Today: React + TypeScript + Zustand + HTML5 audio. Tomorrow: Unreal C++ + Slate/UMG + Audio Mixer. Both render the same Supabase data.

When porting, we are 100% replacing Layer 3. Layers 1 and 2 stay.

---

## The Supabase schema (what to keep in your head)

Every table the game depends on:

**Player state (one row per user):**
- `profiles` — basic identity (id, username, avatar).
- `user_stats` — XP, level, energy, energy_updated_at, longest streak, etc.
- `tamagotchi_state` — companion mood, needs, streak, songs_finished, songs_abandoned.

**Artist economy:**
- `songs` — DAW drafts the player is working on. Private by default, owner-only writes.
- `song_publications` — songs the artist has formally dropped. Public read. Each row is self-contained (artist_name, artist_avatar, audio_url, bpm, key_root, duration_sec snapshotted at publish time) so Unreal can display a drop without joining anything.

**Tastemaker/Fan economy:**
- `song_ratings` — 1–5 stars per (user, song). Upserts replace prior ratings.
- `song_endorsements` — a "push." Costs energy. One per (user, song).
- `fan_relationships` — a follow graph (fan_id → artist_id).

**Producer economy (V2):**
- `template_publications` — reusable sound/arrangement kits producers publish.

**Social:**
- `crib_visits` — when a player visits another player's profile scene.
- `coop_sessions` — state for a real-time coop recording session.

**Audit:**
- `player_events` — append-only log of every energy/XP change. Written only by RPCs. Players can read their own events for history/analytics.

**Aggregate view:**
- `song_publication_stats` — view that joins publications with their rating and endorsement counts. Clients query this instead of computing aggregates.

Every table has RLS enabled. Reads that need to be public (catalog, rating aggregates, endorsement counts) are explicitly allowed. Everything else is locked to `auth.uid() = owner_id`.

---

## The RPCs (the game rules, as code)

Four functions on Supabase enforce every gameplay-authoritative action. All are `SECURITY DEFINER` (run with admin privileges) and all identify the caller via `auth.uid()` — they cannot be spoofed by a client sending a fake user_id.

**`get_live_energy()` → { live_energy, base_energy, energy_updated_at, level, total_xp }**
Call on login and whenever you need a fresh reading. Server computes current energy from stored base + elapsed regen. The client mirrors this locally for smooth animation, but the server is truth.

**`spend_energy(p_cost, p_event_type, p_target_id, p_xp)` → { success, new_energy, new_xp, message }**
Generic "spend N energy to do action X, optionally earn Y XP." Atomic: checks affordability, deducts, appends a `player_events` row, returns the new totals. If the user can't afford, returns success=false and writes nothing.

**`rate_song(p_song_id, p_stars)` → { xp_awarded, new_xp, daily_xp_earned }**
Upserts a star rating. Free (no energy cost). Awards XP up to the daily cap for 'rate' — if the cap is exhausted, xp_awarded is 0 but the rating still persists. The cap prevents farming without blocking signal.

**`earn_xp_capped(p_daily_xp_cap, p_event_type, p_xp, p_target_id)` → { xp_awarded, new_xp, daily_xp_earned }**
Generic "award up to N XP for event type X today." Used internally by other RPCs and callable for lightweight events (listens, auditions) that should be capped.

Any new game mechanic should follow the same pattern: a server RPC that enforces the rule atomically and writes `player_events` for auditability. Never trust the client for anything that affects progression.

---

## Reading the economy constants

Today, the TypeScript client hardcodes `ENERGY_COSTS = { endorse: 15, publishSong: 40, ... }` and `XP_DAILY_CAPS = { rate: 40, listen: 30 }` for UI previews (disabling buttons, showing cost labels). **The server also knows these values** — they're hardcoded inside the RPCs. The client values are presentation-layer mirrors, not rules.

When porting to Unreal, do NOT re-implement these tables in C++. Instead, ship a `GameEconomyConfig` row in a `game_config` table that the client loads on boot. Both the web client and Unreal read the same config. Server RPCs continue to enforce the canonical values. This is the one change worth making before the port lands — it stops drift between client and server.

---

## What the web client does that Unreal needs to replicate

Not line-by-line — *structurally*. These are the behaviors any client must implement regardless of engine.

**On login:**
1. Authenticate → receive JWT.
2. Fetch `profiles`, `tamagotchi_state`, `user_stats` (including energy) for the current user.
3. Fetch user-specific Tastemaker data: their ratings, their endorsements.
4. Fetch `song_publication_stats` (the public catalog) for Home / Booth.

**Every tick (animation frame or timer):**
- Compute live energy client-side from `base_energy + floor((now - energy_updated_at) / regen_interval)` for smooth visualization. Never let this diverge from the server truth — re-fetch on any mutation.

**On player action:**
- For a free action (rate, audition, save draft): call the relevant RPC, apply optimistic UI, reconcile with the server response.
- For an energy-gated action (publish, endorse, visit): client-side affordability check first (fail fast UX), then RPC, then optimistic update, then rollback on server failure.

**Never do this client-side only:**
- Grant XP.
- Subtract energy.
- Mark a song "published."
- Change level.
- Write to `player_events`.

If you catch yourself computing one of these on the client and persisting it locally, you're breaking the invariant — stop and write a server RPC instead.

---

## Reusable vs throwaway in today's codebase

When you open the Unreal project and look back at `daw-v2/`, here's what maps across:

**Throwaway (replace in Unreal):**
- Every React component (`DeviceShell`, `Home`, `ListeningBooth`, `EnergyMeter`, etc.). UI is UMG/Slate in Unreal.
- `src/audio/engine.ts` — Web Audio specific. Unreal has its own audio mixer.
- HTML5 `<audio>` tags and autoplay logic — replace with `UMediaPlayer` or a streaming sound wave.
- Zustand store. Replace with `UGameInstanceSubsystem` or similar.

**Conceptually reusable (port the idea, not the code):**
- The Tamagotchi mood derivation (`computeMood`) — port to C++ as a pure function on the server or as a `UBlueprintFunctionLibrary`.
- Companion dialogue tables (`talkLines`, `tastemakerRatingLine`) — port to a `UDataTable` keyed by mood + event.
- The optimistic-update + rollback pattern — in Unreal this becomes replicated actor state + server RPC correction, but the mental model is the same.

**Reusable as-is:**
- The Supabase schema + migrations.
- The four RPCs.
- The type contracts (`PublishedSong`, `LiveEnergyState`, etc.) — regenerate C++ USTRUCTs from the same Postgres schema.

---

## Authentication flow (the same on both clients)

1. Client hits Supabase Auth (email+password, OAuth, passwordless — user's choice).
2. Supabase returns a JWT.
3. Client stores the token (browser cookie / Unreal `USaveGame` + OS keychain).
4. Every subsequent request includes `Authorization: Bearer <jwt>`.
5. Supabase validates the JWT and sets `auth.uid()` for the request's transaction.
6. RLS policies and RPCs use `auth.uid()` to identify the caller.

In Unreal we'll wrap this in a `USupabaseSubsystem` that owns the JWT, refreshes it, and exposes "call RPC" and "select from table" functions to the rest of the game. The REST API is documented; the HTTP calls are trivial.

---

## Phase 4 realtime — what Unreal needs to do

**Session lifecycle.** `coop_sessions` table with `pending`, `active`,
`abandoned` status. RPCs (`create_coop_session`, `accept_coop_invite`,
`join_coop_by_code`, `leave_coop_session`) are the only write path. All
enforce `auth.uid()` server-side. Unreal calls these over HTTPS
identically to the web client.

**Shared state.** `coop_sessions.state` is a `jsonb` blob containing the
DAW song-in-progress. Unreal deserializes into a
`USTRUCT(BlueprintType) FCoopSessionState` with `FJsonObjectConverter::
JsonObjectStringToUStruct`. Mutations are PATCH-writes (delta, not
whole state) to keep bandwidth small.

**Realtime fanout.** Supabase uses the Phoenix WebSocket protocol for
Realtime. In Unreal this is a `UWebSocketsSubsystem` connection to
`wss://<project>.supabase.co/realtime/v1/websocket` with the JWT and
the Postgres-changes channel topic. A thin wrapper parses the incoming
JSON and applies row deltas to the local `FCoopSessionState`. The
reference protocol doc lives on Supabase's site.

**Presence.** Supabase Presence is a separate channel on the same
WebSocket. Each client broadcasts a transient payload (cursor x, y,
seat color, ping). In Unreal this is a replicated `AGhostPointer`
actor per seat, driven by the Presence payload — no server round-trip
on every frame.

**Conflict resolution.** Last-writer-wins for v1. When both clients
write `state.song_name` simultaneously, the later write wins; the
earlier writer's copy updates from the Realtime fanout. Acceptable
because DAW interactions are coarse. If playtests reveal pain, we
add a field-level vector clock or CRDT. Don't pre-optimize.

**Anything else tied to multiplayer?** Not yet. Coop doesn't touch
inventory, edit-locking, or per-seat audio mute — those are Phase 5
and add their own Supabase tables + RPCs. When they land they follow
the exact same pattern: server is truth, client is view.

---

## What this means in practice

You don't have to decide "how does the economy work" when you port. That's already decided and enforced on the server. You just have to decide "how does this look and feel in Unreal."

If you ever find yourself thinking "I need to add an XP calculation to the Unreal C++ code," stop. The answer is either a new Supabase RPC or an existing one you haven't called yet. Client-side XP math is a bug.

That's the whole point of this setup. Keep it, and the port is a UI project. Break it, and it becomes a two-client-drift nightmare.
