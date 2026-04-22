# GRVD — Tastemaker / Fan Expansion Plan

Living doc. Reference and amend as we build.

Last updated: 2026-04-22

---

## 0. North-star premise

GRVD is one device, one companion, three roles. Roles emerge from what you spend your energy on, not from a signup flag. The Tastemaker is the first non-Artist role we flesh out. The Producer comes later and must be forward-compatible with every system we build now.

---

## 1. Core design rules (locked)

These are the invariants every feature must respect.

1. **Creation and consumption are free.** Jamming in the DAW, auditioning sounds, listening to songs, scrolling the player, rating a song — all zero energy. You cannot run out of the ability to *make* or *consume*.

2. **Publishing is gated by energy.** The scarce resource is discoverability. Publishing a song, publishing a template, endorsing/pushing another player's work — these consume energy and have level-scaled caps.

3. **XP is capped per action type, not per action.** You can rate 500 songs in a day to feed the signal, but you only earn XP on the first N. Prevents farming without blocking signal.

4. **Energy regenerates in real time.** No daily rollover. Timezone-neutral. Full bar in roughly 8 hours of wall time. Capped at a ceiling so you can't stockpile indefinitely.

5. **No pay-to-win.** Monetization can sell cosmetics, crib furniture, skin variations, extra companion moods, custom sample packs — never energy, never publish slots, never XP multipliers.

6. **Every role can earn roughly equal XP per unit energy spent.** An artist publishing a song, a fan endorsing a song, and a producer publishing a template should be directionally the same in XP. This is what makes specialization emergent rather than forced.

7. **At energy zero, the app never locks.** You can still rate, still draft songs, still audition sounds, still visit cribs. Only publish-tier actions are blocked until you regen.

---

## 2. The three roles and their action surfaces

| Role | Free actions (0 energy) | Publish-tier actions (energy + caps) |
|---|---|---|
| **Artist** | Recording, arranging, mixing, saving drafts, previewing | Publish song (makes it discoverable, eligible for ranks) |
| **Fan / Tastemaker** | Listening, rating 1–5 stars, building private playlists | Endorse / push a song, pin a song to your public profile |
| **Producer** (V2) | Auditioning sounds, organizing sounds into private templates | Publish template (makes it usable by artists in the creation flow) |

Cross-role actions: visiting a crib, inviting to your crib, becoming a fan of an artist.

---

## 3. Energy economy — directional v0 numbers

Bar size: **100**. Regen: **1 unit every 5 minutes** (= 12/hour, full refill in ~8h 20m). These numbers are tunable; the ratios are what matter.

| Action | Energy cost | XP (rough) | Cap |
|---|---|---|---|
| Listen to a song | 0 | +1 | 30/day XP-earning (unlimited beyond) |
| Rate a song (1–5★) | 0 | +2 | 20/day XP-earning (unlimited beyond) |
| Audition a sound (producer) | 0 | +1 | 40/day XP-earning |
| Record / edit in DAW | 0 | 0 | — |
| Arrange a private template (producer) | 0 | +2 | — |
| Visit a crib | 3 | +3 | energy-gated |
| Invite someone to your crib | 5 | +5 | energy-gated |
| **Endorse / push a song** | 15 | +10 (+bonus if it trends) | energy-gated (~3–5/day) |
| **Publish song** (Artist) | 40 | +25 (+performance bonuses) | 1/day at L1, scales with level |
| **Publish template** (Producer) | 40 | +25 (+performance bonuses) | 1/day at L1, scales with level |

**Level-scaled publish caps** (directional):

| Level | Publish song/day | Publish template/day | Endorse/day cap |
|---|---|---|---|
| 1–5 | 1 | 1 | 3 |
| 6–15 | 2 | 2 | 5 |
| 16–30 | 3 | 3 | 7 |

Ship flat (1 / 1 / ~3) first. Add the curve once we have data on the economy.

**Bonus XP hooks** (make taste and craft feel rewarded):

- **Early-ear bonus:** if you rate 4★+ or endorse a song *before* it crosses a popularity threshold, you earn retroactive bonus XP when it does. This is the core tastemaker identity loop.
- **Trending endorsement bonus:** if a song you endorsed lands in the top-N this week, you earn bonus XP.
- **Hit bonus (Artist):** if a song you published crosses rating/play thresholds, bonus XP tiers unlock.
- **Template usage (Producer, V2):** XP for every artist who publishes a song built on your template.

---

## 4. Data model — Supabase additions

New tables (SQL sketched; exact migration later):

```sql
-- Per-player energy + level state (lives on profiles or as its own row)
alter table profiles
  add column current_energy int not null default 100,
  add column energy_updated_at timestamptz not null default now(),
  add column level int not null default 1,
  add column total_xp int not null default 0;

-- Published songs (distinct from drafts in the DAW)
create table song_publications (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid references auth.users not null,
  title text not null,
  audio_url text not null,
  waveform_url text,
  duration_sec int,
  published_at timestamptz not null default now(),
  retired_at timestamptz
);

-- Ratings (one per user per song)
create table song_ratings (
  user_id uuid references auth.users not null,
  song_id uuid references song_publications not null,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

-- Endorsements (scarce, energy-gated)
create table song_endorsements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  song_id uuid references song_publications not null,
  created_at timestamptz not null default now(),
  unique (user_id, song_id)
);

-- Fan relationships (someone becomes a fan via endorsement or visit)
create table fan_relationships (
  fan_id uuid references auth.users not null,
  artist_id uuid references auth.users not null,
  became_fan_at timestamptz not null default now(),
  primary key (fan_id, artist_id)
);

-- Energy + XP event log (auditable, drives animations + notifications)
create table player_events (
  id bigserial primary key,
  user_id uuid references auth.users not null,
  event_type text not null, -- 'rate' | 'listen' | 'endorse' | 'publish' | 'visit' | 'bonus_early_ear' | ...
  energy_delta int not null default 0,
  xp_delta int not null default 0,
  target_id uuid, -- song_id, user_id, template_id, etc.
  created_at timestamptz not null default now()
);

-- Crib visits (placeholder log until Unreal port)
create table crib_visits (
  id bigserial primary key,
  visitor_id uuid references auth.users not null,
  host_id uuid references auth.users not null,
  visited_at timestamptz not null default now()
);

-- Templates (Producer V2; stubbed now so schema is forward-compatible)
create table template_publications (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid references auth.users not null,
  name text not null,
  sounds jsonb not null, -- array of sound refs
  published_at timestamptz not null default now()
);
```

RLS posture: everyone can read published content; users can only write their own ratings/endorsements/events; energy and level mutations go through a server-side RPC so they can't be tampered with client-side.

**Energy computation pattern:**

```ts
// read: current_energy_now = min(CAP, current_energy + floor((now - energy_updated_at) / regen_interval))
// spend: atomic RPC that reads live energy, checks cost, writes new value + emits player_event
```

---

## 5. Screen list + stage-machine integration

The existing stage machine (Template → Record → Review → Export → Done) stays for the Artist creation flow. We add a new top-level "mode" that brackets the whole app: `HomeMode` vs `CreateMode`. Home is the new landing.

**New / evolved screens:**

1. **Home** — neutral landing. Three primary CTAs: "Listen to fresh drops" (Tastemaker entry), "Start a new track" (Artist entry, current flow), and "Visit the crib scene" (placeholder button to a Coming Soon overlay). Energy meter and XP bar are persistent at the top.

2. **ListeningBooth** (evolve existing) — serves a queue of freshly-published drops. Each drop shows waveform, artist name, play/pause, rating stars, endorse button. Infinite scroll. No external share.

3. **RateDrop** (inline or screen) — the focused rating moment. 5-star input, satisfying tap feedback, companion reaction based on how your rating compares to consensus so far.

4. **EndorseSheet** — modal that appears on endorse tap. Confirms energy cost, shows remaining endorse-cap, confirms action. Scarcity ritual.

5. **Leaderboards** — tabs for Top Songs This Week, Top Artists, Top Tastemakers (by early-ear bonus), and a placeholder Top Producers tab for V2.

6. **TastemakerProfile** — your stats as a listener/endorser. Your total pushes, your early-ear hits, your fan count (how many artists you've become a fan of).

7. **ArtistProfile** — viewable from any song. Published songs, fan count, level.

8. **CribDoor** (placeholder) — "This is where [artist name]'s crib will live. Multiplayer coming soon." Logs a `crib_visits` row.

**Persistent UI components:**

- **EnergyMeter** — always visible at the top of the shell screen. Regen animation, tooltip shows time-to-full.
- **XPBar** — next to energy meter, level + progress.
- **CompanionTicker (mouth)** — already exists; expand dialogue vocabulary for Tastemaker moods.

Stage machine stays for Artist; Tastemaker flow is more free-form (Home → ListeningBooth → RateDrop/Endorse → back). We can model Tastemaker as a shallow state: `home | listening | viewing_profile | viewing_leaderboard | visiting_crib`.

---

## 6. Tastemaker companion-mood expansion

The companion already has mood variants driven by `dawTalk`. New triggers:

- **Fresh ears** (entering ListeningBooth): "let's see who's cooking"
- **Early 5★** (you rated a song 5★ that's still fresh): "ooh, backing this one"
- **Endorsement success** (a song you endorsed trended): "called it"
- **Endorsement miss** (endorsed song flopped): "…we'll get the next one"
- **Low energy** (<10): "need a beat — let's just vibe-listen"
- **Full energy after drought**: "fully charged, what's the move"
- **First fan** (someone becomes fan of an artist you endorsed): "your taste is rubbing off"

Energy state influences companion eye animation already. Add a subtle "dim" state when energy is below 10.

---

## 7. Producer-forward-compatible hooks (V2 prep)

Things we build now so the Producer can slot in without refactor:

- `template_publications` table already in schema.
- `player_events` table has generic `event_type` — no enum, no migration needed to add `'publish_template'`.
- Leaderboards tabbed structure includes a Producers tab from day one (empty state).
- Home screen has space for a third CTA row (can be unlocked when first template mechanic ships).
- Sound-pool schema planned but not built; will mirror the `song_publications` pattern.

Explicit non-goals for this expansion: no sound pool, no template builder UI, no sample-pack store. Those are Producer V2.

---

## 8. MVP build order — Tastemaker Slice 1

Each line is roughly one commit or a tight cluster of commits. Stop after Slice 1 and playtest before committing to Slice 2.

### Slice 1: Energy + Rating loop (ship-worthy increment)

1. **Supabase migration**: `profiles` energy/level columns + `player_events` + `song_publications` + `song_ratings`. RLS policies. RPC for energy-spend.
2. **Energy store** (Zustand): computes live energy on read, handles optimistic spend + rollback on RPC failure.
3. **EnergyMeter + XPBar** persistent components on the shell.
4. **Seed data**: 5 fake published songs (can use existing exported tracks + fake artist names) inserted into `song_publications`.
5. **Home screen** scaffold with three CTAs (Create / Listen / Crib-placeholder).
6. **ListeningBooth** fetches from `song_publications`, plays audio, shows waveform.
7. **Rating UI** — 5-star tap inside the ListeningBooth, writes to `song_ratings`, emits XP event (capped at 20/day XP-earning, uncapped for writes).
8. **Companion dialogue** — rate/listen moods wired in.

Ship. Play. Tune numbers. Then Slice 2.

### Slice 2: Endorsement + Leaderboards

9. Endorse button + `song_endorsements` table + `EndorseSheet` modal.
10. Level-scaled endorse cap enforcement server-side.
11. Leaderboards screen with placeholder-data tabs (real data for songs and tastemakers, fake names for artists/producers).
12. Early-ear bonus calculation (cron edge function or on-read aggregation).
13. Artist-side notification: "Hefe endorsed your song — you gained X energy." Capped at N boosts/day so it can't be farmed.

### Slice 3: Fan relationships + profiles

14. `fan_relationships` table, fan-count aggregation on artist profiles.
15. TastemakerProfile screen.
16. ArtistProfile screen.
17. CribDoor placeholder (logs `crib_visits`, shows Coming Soon overlay).

### Slice 4 (deferred): Producer V2

18. Sound pool schema + seed.
19. Template builder.
20. Publish template flow.
21. Producer leaderboard becomes real.

---

## 9. Open questions / future decisions

- **What exactly is a "Drop" vs a full song?** Right now every published thing is equivalent. Might want "drops" as short snippets vs "releases" as full tracks.
- **WAV export deprecation** — user wants this removed eventually in favor of in-game discoverability. When? Probably once we have a meaningful fan-listening audience.
- **Crib customization schema** — Habbo-style grid + furniture catalog. Design TBD with the Unreal port.
- **Proximity voice chat** — tied to Unreal port, not this plan.
- **Moderation / abuse surface** — endorsement gaming rings, rating bots, inappropriate published content. Need a flag/report table before real users join.
- **Copyright on published songs** — right now anything exported from the DAW is the artist's, but once templates exist, attribution chains get complex. Will revisit at Producer V2.
- **Mobile/touch UX for rating** — current shell is desktop-first. Tap-rating on mobile will need its own pass.

---

## 10. Change log

- **2026-04-22**: initial draft. Locks core design rules, energy economy v0, data model, screen list, and MVP build order through Slice 3.
