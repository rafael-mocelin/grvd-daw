# GRVD — Sound Economy plan (Phase 5.B + Phase 7 unified)

Living doc. Pair with `MULTIPLAYER_PLAN.md` (the social layer this rides on
top of) and `UE5_PORT_GUIDE.md` (what survives the port).

Last updated: 2026-04-27

> **One phase, not two.** The original plan split inventory (5.B) from
> Producer V2 (Phase 7), which would've shipped 5.B as scaffolding nobody
> can see and Phase 7 as a feature that doesn't have anything to feed it.
> Folding them together gives us a single coherent slice where every step
> ships visible value AND moves the structural work forward.

---

## 0. What problem are we solving?

Right now every signed-up player has identical creative material — the same
hardcoded set of sounds, the same hardcoded templates. Coop sessions, the
edit-lock idea, the producer role, the trading mechanic — none of these
pay off until **inventories can diverge**.

Building inventory tables in isolation creates dead scaffolding. Building
producer publishing without inventory creates orphaned content. The plan
below builds the two together so each unblocks the other.

---

## 1. Core decisions (locked)

These bind the rest of the plan. Reverse them later only if a playtest
demands it.

1. **Sounds are individual items.** Each row in `sound_catalog` is one
   thing — a kick, a hat, a sample, a pad, a vocal chop. Players own
   sounds individually. Packs (a producer publishing 6 kicks at once) are
   syntactic sugar at the publishing-layer; the table stores rows, not
   bundles.

2. **Starter inventory ≠ full catalog.** Every signup gets a curated
   "starter" set (today's hardcoded DAW sounds, marked `category='starter'`).
   Starters are everyone's. Anything beyond starter is acquired through the
   economy. This creates the divergence that makes everything downstream
   meaningful.

3. **Acquisition is one-tap free at first.** Producer publishes a sound →
   other players see it in a "discover sounds" feed → tap to claim → it
   lands in their `user_sounds`. No payment, no resource cost in v1. We
   add scarcity (energy cost to claim, daily cap, gated unlocks) later if
   the loop needs the friction.

4. **Producers earn XP when their sounds are claimed.** Same shape as the
   tastemaker early-ear bonus: when your sound crosses a popularity
   threshold (claim count), retroactive XP for you. Plus a small per-claim
   XP drip so producing isn't all-or-nothing.

5. **Templates are a separate publishing surface.** A template is a recipe
   (BPM, key, layer kinds in order). Producers publish templates that
   reference sounds in `sound_catalog`. Artists who use a template earn
   the producer XP credit when they ship the resulting song.

6. **Server is truth for ownership.** Same rule as elsewhere — RPCs gate
   acquisition, RLS gates reads. No client can spoof "I own this sound."
   Important when monetization eventually arrives.

7. **Coop session material is a transient union.** When two friends jam,
   the session sees the union of their inventories. Their actual
   `user_sounds` rows don't change. Materials don't transfer permanently
   from a session — they're temporarily borrowed.

8. **Edit-lock is real.** A song authored by a group can only be edited
   when (a) all original collaborators are in a coop session together,
   AND (b) the union of their current inventories includes every sound
   used in the song. If anyone has traded away a key sound, the song is
   read-only until they get it back.

---

## 2. Data model

### `sound_catalog` — every sound in the game

| column        | type        | notes                                                  |
|---------------|-------------|--------------------------------------------------------|
| id            | text PK     | stable string id (e.g. `kick-trap-120`)                |
| kind          | text        | 'kick', 'hat', '808', 'sample', 'vocal', 'fx', etc.    |
| variant       | text        | display variant name within the kind                   |
| display_name  | text        | what the player sees                                   |
| audio_url     | text        | path to the audio file (Supabase Storage)              |
| bpm           | int null    | suggested BPM                                          |
| key_root      | text null   | suggested key                                          |
| category      | text        | 'starter' / 'producer_published' / 'system_unlock' / etc. |
| producer_id   | uuid null   | when category='producer_published', the originator     |
| created_at    | timestamptz |                                                        |

Public read. Inserts only via RPC (producer publish flow). The current
hardcoded sounds in `data/sounds.ts` get backfilled as `category='starter'`
rows; every existing user gets all starter ids granted in `user_sounds`.

### `user_sounds` — who owns what

| column      | type        | notes                                            |
|-------------|-------------|--------------------------------------------------|
| user_id     | uuid        | owner                                            |
| sound_id    | text        | references `sound_catalog.id`                    |
| acquired_at | timestamptz |                                                  |
| source      | text        | 'starter', 'claimed_from_producer', 'unlock', etc. |
| primary key | (user_id, sound_id)                                            |

Own-only read + insert via RLS. No client UPDATE / DELETE — once you own a
sound, you keep it. (Trading later goes through an RPC that bypasses this.)

### `template_publications` — already exists, reframed

Currently exists but unused for producer flow. Add columns:

| new column              | type        | notes                                          |
|-------------------------|-------------|------------------------------------------------|
| sound_ids               | text[]      | sound_catalog ids referenced by this template  |
| usage_count             | int         | how many songs have been published from it    |
| score                   | numeric     | derived rank (driven by usage + downstream)   |

Producer publishes a template → it appears in the template picker for any
artist who owns all the referenced sounds. Artists missing a sound can't
use the template until they claim the missing piece.

### `song_publications.layer_sources` — already exists, just snapshot

Currently `layers` is a jsonb array of `Layer`. Each layer has a
`soundId`. Add a `source_owner_id` field per layer at publish time, so
the published song knows which collaborator's inventory each sound came
from. Used for edit-lock checks.

### `sound_acquisitions` — append-only audit log

| column        | type        | notes                                    |
|---------------|-------------|------------------------------------------|
| id            | bigserial   |                                          |
| user_id       | uuid        |                                          |
| sound_id      | text        |                                          |
| source        | text        | 'producer_publish', 'starter_grant', etc.|
| created_at    | timestamptz |                                          |

Useful for analytics (who claims what, popularity curves, trending
producer sounds). Equivalent to `player_events` in spirit.

---

## 3. How inventories diverge

The most important section. Without this, the rest is theater.

**Day 1 sources of divergence (must ship in the first slice):**

- **Producer publishes a sound.** Anyone can become a producer (no role
  flag — emergent like the other roles). They use a "publish a sound"
  flow that uploads an audio file + metadata + drops a row in
  `sound_catalog` with `category='producer_published'` and
  `producer_id=them`. Other players see new sounds in a "discover" feed.

- **Players claim sounds.** One tap. Adds row to `user_sounds`. Producer
  earns small XP. Idempotent — claiming twice is a no-op.

That single loop creates real inventory divergence. Everything else
(trading, unlocks, daily rewards) is layered on later.

**Phase 2 sources (next slice if the loop is healthy):**

- **Trades between friends** — A offers a sound, B accepts, sound is
  duplicated to B's inventory (no removal from A — sound rights, not
  physical objects).
- **Level-gated unlocks** — pre-curated bonus packs released at L5 / L10 /
  L20. Server-grants on level-up.
- **Crib-visit bonuses** — visiting a friend's crib has a small chance to
  reveal one of their sounds as claimable to you.

**Phase 3 (monetization, far away):**

- Sound packs purchasable for real money. Cosmetic-only — these pack
  contents are not better than free pack contents, just different
  flavors. No pay-to-win.

---

## 4. Producer publishing flow

The visible producer feature, end-to-end:

1. Player records / uploads a short audio clip.
2. They tag it (kind, variant, display name, suggested BPM/key).
3. They tap "publish sound." Costs energy (similar to publish-song),
   level-capped per day. Server-side RPC inserts into `sound_catalog`
   with `producer_id=them` and uploads the audio to Storage.
4. The new sound appears in everyone's "discover sounds" feed. Order
   driven by recency + claim count (trending sounds rise).
5. Other players claim with one tap. Server inserts into their
   `user_sounds`, increments a claim counter, awards small XP to the
   producer.
6. Once a producer's sound crosses a popularity threshold (e.g. 10
   claims, configurable), retroactive bonus XP fires — same shape as
   the tastemaker early-ear bonus.

Templates are the same flow with different content: "publish a template"
references sound_catalog ids and produces a `template_publications` row
that artists can pick.

The producer leaderboard (currently a placeholder tab on the Leaderboard
screen) becomes real: ranks by sum of (claims this week × small_weight) +
(template usage this week × bigger_weight) + (downstream song success
on those templates × biggest_weight). Same multi-tier scoring as the
existing weekly views.

---

## 5. Coop interactions

**Session material union.** When a coop session starts, the server
computes the union of all participants' `user_sounds` and snapshots it
into `coop_sessions.available_sound_ids`. The DAW sound picker during
that session shows this union — including sounds the current player
doesn't personally own. After the session ends, no transfer happens;
each participant's `user_sounds` is unchanged.

**Layer source attribution.** When a coop song picks a sound, the
client tags the layer with `source_owner_id` (whichever participant
owned it pre-session). Snapshot at publish time.

**Edit-lock check.** When a player opens a song to edit:

1. Load the song's `layers` and `collaborator_ids`.
2. For each unique `source_owner_id` referenced in layers, fetch that
   user's current `user_sounds`.
3. Check that every `(layer.soundId, source_owner_id)` pair is still
   present in that owner's inventory.
4. If anything's missing OR not all collaborators are currently in a
   coop session together, surface a lock screen:
   *"To edit this song, get the group back together. Missing materials:
   [sound list with owner names]."*

**Per-seat audio mute.** During a coop session, the DAW renders multiple
recipe windows (one per participant working on their own song-pack within
a shared canvas, eventually). Each seat has its own local mute toggle
that silences the OTHER seat's playback locally, without affecting what
the other seat hears. Pure client-side state, no DB writes.

This solves the "three simultaneous beats playing at once" cacophony
the user described in the original multiplayer vision.

---

## 5.5. UI surfaces — where inventory shows up

This phase doesn't ship a visual redesign (still designer work per
`GAME_FEEL_MANIFESTO.md`), but it locks the **structural placement** of
the new screens and a **shared iconographic vocabulary** so the
designer arrives to a consistent surface.

### New screens / zones

- **Studio** — a new Home tile (4th, alongside Listen / Cook / Visit
  — replaces the placeholder Visit until cribs ship). Owns the full
  inventory grid: sounds you own, by category, with the producer
  publish action at the top. Persistent home of your collection.

- **Discover** — a tab inside Studio (not a separate Home tile, to
  keep Home's CTA count low). Producer-published sounds appear here;
  one-tap claim. Distinct from the Listening Booth: booth = drops
  (full songs you rate), Studio Discover tab = sounds (atoms you
  claim). Mirrors the "MINE / SEARCH" pattern Friends already uses.

- **Producer publish** — lives inside Studio. "Publish a sound" button
  at the top of your sound grid. Same visual shape as the
  publish-song flow in the DAW Done screen + Logbook.

### Existing screens that change

- **DAW sound picker (Stack stage)** — today shows the full hardcoded
  catalog. After step 4 it filters to `user_sounds` for the current
  player. In coop, it filters to `coop_sessions.available_sound_ids`
  (the union snapshot). No screen rewrite needed — same picker, new
  data source.

- **Profile** — TastemakerProfile gets a `🎵 sounds owned` stat card
  alongside the existing ones. Tapping the card opens Studio.

- **Logbook** — songs that use sounds the current player no longer
  owns get the edit-lock treatment when opened. New "GROUP" badge
  already shipped in Phase 5.A; lock screen is new.

- **Coop room** — when a session goes active, surface a small "shared
  pool" indicator showing combined sound count: `your 47 + partner 12 = 59 sounds available`.

### Iconographic vocabulary — lock these now

Stable across DAW picker, Studio grid, Discover feed, and song layer
summaries. Designer can replace with bespoke illustrations later, but
the slot/meaning stays the same:

| Concept        | Icon  | Notes                                          |
|----------------|-------|------------------------------------------------|
| Song           | 💿    | replaces the ad-hoc ▶ today; consistent everywhere |
| Sound: drums   | 🥁    | full drum loops (today's REAL_SOUNDS class)    |
| Sound: kick    | 🥾    | one-shot kick                                  |
| Sound: snare   | 👏    | snare / clap                                   |
| Sound: hat     | 🎩    | hi-hat — pun reads                             |
| Sound: 808     | 🔊    | bass speaker                                   |
| Sound: sample  | 💿    | vinyl, same as songs (samples live in songs)   |
| Sound: melody  | 🎶    | melodic loop / lead                            |
| Sound: vocal   | 🎤    | microphone                                     |
| Sound: fx      | ✨    | sparkle (reserved for future fx kind)          |
| Sound: pad     | 🎹    | reserved for when melodic pads ship            |
| Producer tag   | 🎛️    | shown on sounds with `producer_id != null`    |
| Starter tag    | 🌱    | shown on `category='starter'` sounds           |
| Trending       | 🔥    | shown on sounds crossing claim threshold this week |

**Note on individual-sound `glyph`:** every existing SoundOption already
has its own `glyph` (e.g. kick "boom" = 💥, kick "doof" = 🪩). The
table above is the **kind-level icon** used for category headers and
filter chips. Individual sounds keep their own glyphs in the Studio grid.

### Game-feel treatments worth shipping during 5.B

These are cheap and don't need design review — animations and visual
polish that align with the manifesto's "chunky, alive, interactive"
direction:

- **Sound tiles**: card with icon + name, scale-down-on-press + spring
  back, subtle float on hover.
- **New-claim sounds**: pulsing glow border until first interaction.
- **Counter pops**: number-pop animation on energy / XP / sounds-owned
  changes. Reuse the existing `XPFlash` portal pattern.
- **Claim button**: gradient + soft drop shadow + "+1" particle on
  tap. Satisfying micro-feedback.
- **Sound preview**: tap a tile → short bounce + audio plays. Tap
  again to stop.

What's deliberately deferred:

- Full visual identity (palette, typography, illustration style) —
  designer work after features stabilize.
- Replacing the infinite canvas in the Stack stage — Phase 7+.
- Animated character / companion art — separate from sound economy.

---

## 6. UE5 port path

Carries forward unchanged:

- **`sound_catalog`** → server is the truth of every sound that exists.
  Unreal client lists from this table (or a cached snapshot synced on
  game start).
- **`user_sounds`** → loaded into a `UInventoryComponent` on the player
  pawn at login. Maps cleanly to `TArray<FSoundOwnership>`.
- **Acquisition RPCs** → identical HTTPS calls regardless of client.
- **Coop material union** → computed server-side at session start;
  Unreal clients query the union and populate the coop scene's sound
  picker.
- **Layer `source_owner_id`** → just another field in the JSON song
  state, deserialized into a USTRUCT.
- **Edit-lock** → same logic on Unreal side, served by the same RLS-
  protected reads.

Sound files themselves: served from Supabase Storage today, will likely
be migrated to a CDN or game-package as the catalog grows. Cache
aggressively on both clients.

---

## 7. Phased build order

The right order ships visible value at every step.

### Step 1 — sound_catalog + user_sounds + starter backfill

Schema, RLS, data migration that backfills every existing sound as
starter and grants every existing user the full starter set.

**Visible effect:** none (everyone has the same as before). Sets
foundation.

### Step 2 — producer publish-sound flow

Server RPC `publish_sound`, client UI to record/upload + tag + publish,
"discover sounds" feed reading `sound_catalog where category =
'producer_published' order by created_at desc`.

**Visible effect:** producers can now create new sounds that didn't
exist in the game before. Everyone sees them in a new feed.

### Step 3 — claim flow + per-claim XP + trending counts

Server RPC `claim_sound` (one-tap, idempotent, awards small XP to
producer). Discover feed shows claim counts. Producer earns XP per
claim.

**Visible effect:** **inventories now diverge.** Some players have
claimed-only sounds, others don't. The economy starts moving.

### Step 4 — DAW sound picker reads user_sounds

Update the existing sound picker (in the stack stage) to filter to
sounds the current player owns. Today it shows all hardcoded sounds
because everyone has everything; once the picker reads `user_sounds`,
players who've claimed extra producer sounds see them appear as picker
options.

**Visible effect:** claimed sounds show up in the DAW. Acquisition
finally pays off creatively.

### Step 5 — coop material union

When a coop session starts, snapshot the union into
`coop_sessions.available_sound_ids`. Coop DAW picker reads from that
union instead of just the local player's inventory.

**Visible effect:** "I get to use my friend's exclusive kicks during
this jam, but only during this jam." First time the multiplayer DAW
feels meaningfully different from solo.

### Step 6 — layer source_owner_id + edit-lock

Tag layers with origin owner at publish time. Implement the lock
check on edit entry. Lock screen UI.

**Visible effect:** group songs are now properly bound to their
groups. If you trade away a sound that was used in a group song,
opening that song shows the lock.

### Step 7 — per-seat audio mute in coop

Local mute toggles per seat. Silences other seats' playback for me
without affecting them.

**Visible effect:** matters once 3+ player coop ships. Mostly
quality-of-life until then.

### Step 8 — template publishing + producer leaderboard

Producers can publish templates (recipes referencing sound_catalog
sounds). Templates appear in the picker for artists who own the
referenced sounds. Producer leaderboard tab fills with real data.

**Visible effect:** producers become a third visible role in the
weekly rankings; artists pick from a wider, growing template library.

### Step 9 — bonus economy: early-claim rewards

When a producer's sound crosses a popularity threshold (claim count),
retroactive bonus XP for early claimers + a bigger bonus for the
producer. Same trigger pattern as tastemaker early-ear bonus.

**Visible effect:** scouting taste rewards: claiming an obscure
sound that later trends pays off.

---

## 8. Open questions / decisions to make as we build

- **How do producers actually create sounds?** Record a vocal clip in
  the existing vocal recorder? Upload an MP3 from disk? Both? For day
  one, recording-only is simplest (we already have that path).
- **What audio quality / length limits?** Cap clip length at 8s for
  one-shots (kicks, hats), longer for samples. Need defined formats.
- **Does the producer keep ownership when others claim?** Yes — claim
  duplicates the right, doesn't transfer. The producer keeps it in
  their `user_sounds` permanently.
- **Can a producer un-publish?** Probably not for v1 (would orphan
  every song that uses it). Add `retired_at` later if needed; lock
  retired sounds out of new acquisitions but leave existing
  ownerships intact.
- **What stops spam producing?** Energy cost + daily cap on
  publish_sound RPC. Same shape as publish_song.
- **Sound moderation?** Eventually needs a flag/report flow. Slice 12
  or so.
- **Trade UX**: deferred; design when we have real users complaining
  about inventory divergence being too sticky.
- **How does the seed-ghost player interact?** Today the 5 seed songs
  are owned by `seed-ghost`. Their layers would need `source_owner_id`
  pointing at the ghost. Probably backfill the ghost with the full
  starter set so its songs always pass edit-lock from the ghost's
  side.

---

## 9. What this means in practice

The first step (sound_catalog + user_sounds + starter backfill) is the
single biggest invisible piece of work, but once it ships the next
seven steps each ship something meaningful. By step 5 we've got a
coop scene where my friend's sounds are temporarily mine. By step 8
producers are a real third role on the leaderboard.

If at any point the loop feels weak — nobody's publishing sounds, or
publishing is happening but no one's claiming — we tune the energy
cost / XP rewards / publish caps in `game_config` (the admin panel
already supports live edits) without touching code.

---

## 10. Change log

- **2026-04-23**: initial draft. Folds Phase 5.B and Phase 7 into one
  unified plan. Locks the producer-publishes-claimable-sounds loop as
  the divergence driver.
- **2026-04-27**: shipped step 4 (producer publish-sound flow).
  `publish_sound` RPC + `producer-sounds` storage bucket + `sound_acquisitions`
  audit table + Studio MINE publisher CTA + Studio DISCOVER feed reading
  newest producer-published sounds. Claim button is a "claim · soon" stub
  until step 5 lands the claim RPC + per-claim XP.
- **2026-04-27**: shipped step 5 (claim flow + per-claim producer XP +
  trending counts). `claim_sound` RPC (idempotent, producer self-claim
  is a no-op success, double-claim is a no-op success), `sound_claim_counts`
  view, producer XP cap (3 XP per claim, 60 XP/day per producer), 🔥 trending
  badge when a sound has ≥5 claims this week. Inventories now diverge in
  earnest — claimers see new tiles in MINE the next time it loads.
- **2026-04-27**: shipped step 6 (DAW picker reads inventory). New dynamic
  sound registry in `data/sounds.ts` so producer drops resolve through the
  same `getSound(id)` path as starter sounds. Store gains an `ownedSoundIds`
  set + `loadInventory` action that runs on user change and re-runs after
  publish/claim. StackingView's `suggestions` filters to owned ids and
  backfills the kind section with the rest of the user's inventory; guests
  fall back to the full static catalog. The audio engine needed no change —
  registered producer drops carry `fileUrl + nativeBpm`, which the existing
  `buildVoice → makeFileLoop` branch already handles. Acquisition finally
  pays off creatively: claimed sounds appear in the DAW the next time the
  picker mounts.
- **2026-04-27**: shipped step 7 (coop session material union). New
  `coop_sessions.available_sound_ids text[]` column populated server-side
  on session activation (accept_coop_invite + join_coop_by_code) via a
  SECURITY DEFINER `_coop_compute_union()` helper that bypasses
  user_sounds RLS to compute the cross-user merge. Client subscribes via
  the existing realtime row; the App-level coop callback registers any
  partner-only producer drops with the audio engine on each row update.
  StackingView swaps its picker filter from `ownedSoundIds` to the union
  during active sessions, with a small `🤝 shared pool · your N + partner
  M = total` pill in the kind heading so the borrow is visible. Snapshot
  only — mid-session publishing doesn't update the union (acceptable for
  v1, easy to add a refresh RPC later).
- **2026-04-27**: shipped step 8 (layer source attribution + edit-lock).
  Layer type gains `sourceOwnerId?: string`; pickLayer + swapLayer tag
  it with the current userId so songs.layers carries per-layer
  attribution from this point on. New `check_song_edit_lock(p_song_id,
  p_coop_session_id)` SECURITY DEFINER RPC validates: caller is the
  artist or a known collaborator; if a group song, every collaborator
  is present in the same active coop session; every layer's
  `(soundId, sourceOwnerId)` pair is still in that owner's user_sounds.
  Returns can_edit + structured reason + missing_collaborators[] +
  missing_sounds[]. Logbook surfaces a 🔒 group-song chip on rows with
  >1 collaborator; tapping opens a status modal that calls the RPC and
  shows either ready-to-edit or a lock screen with what's missing.
  Forward-looking — the actual "open a published song to edit" flow
  is deferred, but the lock check is enforceable end-to-end the day it
  ships. Pre-step-8 songs and pre-publish drafts gracefully fall through
  the relaxed checks (no sourceOwnerId → no per-layer ownership
  requirement; no publication → modal shows "publish first" hint).
