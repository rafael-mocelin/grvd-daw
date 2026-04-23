# GRVD — Multiplayer / Social Plan

Living doc. Reference + amend as we build. Pair with `TASTEMAKER_PLAN.md`
(what each player does alone) and `UE5_PORT_GUIDE.md` (what survives the
port).

Last updated: 2026-04-23

> **Built for the UE5 port.** Every decision in this doc is made with the
> Unreal Engine client in mind. If a decision feels right for the web app
> but would require rework in Unreal, it's the wrong decision.

---

## 0. What "multiplayer" means here

The app is already multi-user — anyone with an account shares one Supabase
backend and can see each other's public data (drops, ratings, endorsements,
leaderboards). That's "multi-user." **Multiplayer** adds three layers on top:

1. **A social graph** — a player can be your friend (mutual-consent) or
   your fan (one-way follow), distinct from "some anonymous rater." The
   graph powers discovery, notifications, and invitations.
2. **Coop sessions** — two or more friends creating a song together in
   real time, sharing tools and cursors, attributed together on the
   finished drop.
3. **Invitation surface** — how you discover each other, how you ask
   someone to coop, how you accept, how you decline.

The Unreal Engine port inherits all of this unchanged. Friends become an
in-world panel. Coop invitations become in-world notifications. Coop
sessions become Unreal networking rooms backed by the same Supabase
channels. The web app is just the first client.

---

## 1. Core decisions (locked)

These bind the rest of the plan. Changing them later is expensive.

1. **Friends-first, codes-as-fallback.** The primary social model is a
   persistent friends graph. Join-codes survive as an ad-hoc option (meet
   a stranger in a coffee shop, create a song together) but they are not
   the default surface for coop.

2. **Supabase Realtime + Supabase Presence.** No custom WebSocket
   backend. Postgres CDC via Realtime for shared state (song layers,
   recipes, arrangement). Presence for transient stuff (cursors, "who is
   in this session right now"). Both work from browser and Unreal
   without rewriting.

3. **Server is truth.** Same rule as the rest of the app. Every
   gameplay-authoritative action (friend, accept, publish, join coop,
   commit a layer to the shared song) goes through a Supabase RPC or
   RLS-gated mutation. Clients propose; the server commits.

4. **Last-writer-wins for concurrent edits.** No CRDT for v1. If two
   participants add a kick drum at the same time, the later write wins
   and the earlier edit is blown away. Acceptable because (a) DAW
   interactions are coarse-grained enough that real conflicts are rare,
   (b) implementing a CRDT is weeks of work we're not ready to sink. We
   revisit if playtests reveal the problem.

5. **Inventory is real.** Players own sounds. Publishing a song doesn't
   "copy" sounds into the song — it references them. In a coop session
   the inventory is temporarily unioned; after the session, everyone
   keeps only what they owned. Songs published from coop sessions are
   edit-locked to groups that can reassemble the original inventory.

6. **Group attribution is first-class.** A song is authored by a SET of
   players (n >= 1), not a single artist. The UI and data model handle
   groups natively, not as a special case of solo.

---

## 2. Prerequisites (must ship before any of this works)

### 2a. Publish-song flow

Without this, the booth is empty of real content and the whole social
loop has nothing to rest on.

**Client:**
- "Publish" button on the DAW "done" screen, next to "save to logbook."
- "Publish" button next to each unpublished song in the Logbook.
- `EnergyCostBadge` on both buttons showing the cost.

**Server — new RPC `publish_song(p_song_id uuid)`:**
- Checks the player is the song's owner.
- Checks the level-scaled daily publish cap (1/day at L1, 2/day at
  L6–15, 3/day at L16–30, higher later — tunable via `game_config`).
- Checks energy (cost = 40; tunable via `game_config`).
- Atomically: deducts energy, awards XP (25), inserts
  `song_publications` row with snapshot of title/artist_name/avatar/
  bpm/key/duration, logs `player_events`.
- Returns new energy/XP/level + daily cap state.

**Storage:**
- The rendered WAV (from `renderSongToWav`) uploads to Supabase Storage
  bucket `song-audio` before the RPC fires. The RPC gets the audio URL
  as a param and stores it on `song_publications.audio_url`.

**Config keys to add to `game_config`:**
- `publish_song`: `{ energy_cost: 40, xp: 25, daily_cap_l1_5: 1, daily_cap_l6_15: 2, daily_cap_l16_30: 3, daily_cap_l31_plus: 5 }`.

### 2b. Close Slice 2's polish items

- **EndorseSheet modal** — "spend 15 ⚡ to push this?" confirmation ritual
  on push tap. Makes the spend feel deliberate.
- **Artist "your song was pushed" notification** — pull-on-login, shows
  a toast per endorsement received since last check.

Both land before the multiplayer work starts so the single-player loop
is complete.

---

## 3. Friends and fans

Two kinds of relationships:

- **Fan** (already in the schema as `fan_relationships`): one-way. A is
  a fan of B. No consent from B required.
- **Friend**: mutual. A sends a friend request, B accepts, now bidirectional.

New table `friend_relationships`:

| column           | type         | notes                                           |
|------------------|--------------|-------------------------------------------------|
| user_a_id        | uuid         | always the lower UUID of the pair (canonical)   |
| user_b_id        | uuid         | always the higher UUID of the pair (canonical)  |
| status           | text         | 'pending', 'accepted', 'blocked'                |
| requested_by     | uuid         | whoever initiated                               |
| requested_at     | timestamptz  |                                                 |
| accepted_at      | timestamptz  | null until accepted                             |
| primary key      | (user_a_id, user_b_id)                                         |

**Why the canonical-lower-higher ordering:** a single row per pair instead
of two mirrored rows. Lookups with a CASE expression or helper function.

**RLS policies:**
- Read: a user can read rows where they are user_a OR user_b.
- Insert: requested_by must equal auth.uid(), status must be 'pending'.
- Update: accepting/blocking handled by a dedicated RPC.

**RPCs:**
- `send_friend_request(p_other_user_id uuid)` — dedupes, handles the
  canonical ordering, writes the row.
- `respond_friend_request(p_other_user_id uuid, p_accept boolean)` —
  accepts or rejects. Only the NON-requester can accept.
- `remove_friend(p_other_user_id uuid)` — tombstones or deletes.

**Discovery UX:**
- Username search (requires usernames to be unique — currently they're
  not; a migration will enforce it).
- Later: QR code share, "people you've coop'd with before" shortlist,
  "friends of friends" suggestions.

---

## 4. Profiles

### 4a. TastemakerProfile (your own)

Your stats as a listener:
- Total ratings given, total pushes given.
- Early-ear hits (songs you rated 4★+ or endorsed before they tripped
  the bonus threshold).
- Current level + XP bar.
- Recent activity: last 10 songs you rated/pushed.
- Fan count (how many artists you follow).
- Friend count.

### 4b. ArtistProfile (anyone else's)

Their stats as an artist:
- Avatar, username.
- Published drops list.
- Total fans, total endorsements received, avg rating across their drops.
- "Become a fan" button at the top.
- "Send friend request" button if not already friends / pending.

Both screens reuse the narrow reading column pattern
(maxWidth 520, top-padding 34 to clear the ScreenTopBar).

---

## 5. Coop v2 — real collaborative creation

This replaces the current placeholder Coop screen.

### 5a. Session lifecycle

1. **Initiation.** From the Friends list or the current Coop screen, a
   player taps "invite to coop" on a friend. Writes a
   `coop_sessions` row with status='pending', host_id=initiator,
   guest_id=invited friend.
2. **Notification.** The invited friend sees a toast / notification on
   their next sync (pull) or immediately if they have Presence on.
3. **Accept.** Invited friend calls `accept_coop_invite(session_id)`,
   status flips to 'active'.
4. **Room.** Both clients subscribe to a Supabase Realtime channel
   keyed to the session id. They also join Presence on the same
   channel.
5. **Create.** Both work inside a shared DAW view. Song state is
   written to `coop_sessions.state` (jsonb), fanned out via Realtime.
6. **Publish or abandon.** When the group publishes, all participants
   become co-authors. When someone leaves, the session goes to
   status='abandoned' (or completes cleanly).

### 5b. Shared state model

`coop_sessions.state` is a JSONB mirror of the DAW's song-in-progress:

```json
{
  "template_id": "...",
  "layers": [ ... ],
  "recipe_index": 2,
  "song_name": "",
  "active_seats": [
    { "user_id": "...", "cursor": null, "seat_color": "#22d3ee" },
    { "user_id": "...", "cursor": null, "seat_color": "#ff4d6d" }
  ]
}
```

**Writes:** each participant mutates via an RPC `coop_mutate(session_id,
patch jsonb)` that checks membership and applies the patch server-side.
Last-writer-wins; the patch is the delta, not the whole state.

**Reads:** Supabase Realtime subscribes to row changes on
`coop_sessions` for the session id. Every participant sees every write
within ~100ms.

### 5c. Cursors and presence

Each participant broadcasts their cursor position through Supabase
Presence (transient, does not hit the DB). Cursors render with the
seat's color. Presence also tracks "who is currently in the room" — a
participant who closes their tab drops out within the Presence
heartbeat window.

### 5d. Audio in coop

User-described behavior (copied from the ask):

> When in multiplayer mode, you should be able to toggle the sound on
> and off for each of those song packs of recipe, arrange, mixer
> individually.

Implementation: each recipe / arrange / mixer instance in the session
has a local mute toggle per seat. Stored in client state only — other
participants can have it playing while you don't. Doesn't affect the
rendered song on publish; everyone mutes individually, everyone
listens to the final render together.

### 5e. Leaving and rejoining

- Leaving: participant drops from Presence, `active_seats` removes
  them, session continues for remaining participants.
- Rejoining: if session is still 'active' and you were a participant,
  you can resume. If session is 'abandoned', you cannot.

### 5f. Join-codes (the fallback)

Still supported for ad-hoc sessions. The existing
`coop_sessions.join_code` column stays. Flow:

- Host creates session, copies the code, shares it.
- Guest pastes code, joins. Same Realtime channel subscription path.
- Same flow from there on.

Friend-invitation is the primary path; codes are for when you want to
jam with someone not on your friend list.

---

## 6. Inventory + material ownership

This is the most involved piece of the plan. It's also what makes the
game "a game" instead of a DAW-with-sharing — owning sounds and
swapping them with friends is a core loop.

### 6a. Data model

New table `user_sounds` (or `user_inventory`):

| column      | type        | notes                                     |
|-------------|-------------|-------------------------------------------|
| user_id     | uuid        | owner                                     |
| sound_id    | text        | catalog id (e.g. 'kick_808_deep')         |
| acquired_at | timestamptz |                                           |
| source      | text        | 'starter', 'drop', 'trade', 'unlock'       |

And a catalog table `sound_catalog` of all available sounds with
metadata. The current DAW's hardcoded sound list migrates into this
table.

### 6b. Coop session material union

When a coop session starts, the server computes the union of all
participants' `user_sounds` and stores that list in
`coop_sessions.available_sounds`. The session's DAW view shows every
sound in the union — you can use your friends' sounds, they can use
yours — but nothing transfers permanently.

When the session ends, each participant's `user_sounds` is unchanged.

### 6c. Song attribution

`song_publications` gets a `collaborators uuid[]` column (the existing
`songs.collaborators` pattern, extended to publications). When a coop
session publishes, all seat participants go in as collaborators.

`song_publications.layers` (existing, JSON) gets a per-layer
`source_owner_id` tagging which participant's inventory the sound came
from. Used for edit-lock verification (below).

### 6d. Edit-locking

When a player opens a published song in the DAW to edit it:

1. Check `collaborators` — if the player isn't in it, show a read-only
   view (they can listen but not edit).
2. Check `source_owner_id` on each layer. For each unique owner, check
   that owner's current `user_sounds` — does it still contain the
   required sound id?
3. If any required sound is missing (that owner traded it away, or was
   never a real co-author), show an explicit lock screen:
   *"To edit this song, re-form the group and make sure everyone still
   has the original sounds. Missing: [sound list, owner list]."*
4. If all check out, and all original collaborators are currently in
   the same coop session, unlock for editing.

This is what the user described: edit rights require re-forming the
group AND the original material being present in the group.

### 6e. Logbook display

Group-authored songs show a "GROUP" or "DUO" tag. Tapping "edit" with
an unsatisfied lock surfaces the lock screen from 6d. Publishable from
the Logbook just like solo songs (any collaborator can publish; takes
the initiator's publish-cap + energy slot).

---

## 7. Notifications

Pull-on-login, not realtime push (for v1). Layered on top of the
existing `player_events` table + new server view.

**Event types that generate a user-visible notification:**
- `endorsement_received` — your song was pushed.
- `friend_request_received`.
- `friend_request_accepted`.
- `coop_invite_received`.
- `early_ear_bonus_awarded` — your early-ear rating just paid off.
- `artist_boost_received` — you got energy back from an endorsement.

**Data model:** reuse `player_events` where possible. For events that
need a "seen" state, add a `notifications` table:

| column     | type        |
|------------|-------------|
| id         | bigserial   |
| user_id    | uuid        |
| kind       | text        |
| payload    | jsonb       |
| seen_at    | timestamptz null — null = unread       |
| created_at | timestamptz |

**Client:** on login + on stage transitions, query unseen notifications,
render as toasts (existing XPFlash/AchievementToast infrastructure is
close to what we need; we can extend it).

---

## 8. Phases — build order

### Phase 2.5 — close Slice 2 (1 session)
- [ ] EndorseSheet modal (push confirmation ritual).
- [ ] Publish-song flow (DAW button + Logbook button + RPC + storage).
- [ ] Commit and push.

### Phase 3 — friends + profiles (1–2 sessions)
- [ ] Username uniqueness migration.
- [ ] `friend_relationships` table + RLS + RPCs.
- [ ] Friends screen (list, search, pending requests, block).
- [ ] TastemakerProfile screen.
- [ ] ArtistProfile screen.
- [ ] Friend-request notifications.

### Phase 4 — coop v2 realtime core (2–3 sessions, highest risk)
- [ ] `coop_sessions` schema extension (active_seats jsonb, state jsonb).
- [ ] Supabase Realtime channel subscription infrastructure.
- [ ] Supabase Presence for cursors.
- [ ] Shared DAW view (sync layers, recipe, arrangement).
- [ ] Invite-to-coop flow from the Friends list.
- [ ] Accept / decline / leave.
- [ ] Skip for now: material-merging, edit-locking, per-seat mute.

### Phase 5 — inventory + attribution + edit-locking (1–2 sessions)
- [ ] `sound_catalog` + `user_sounds` migration, backfill current DAW
      sounds as "starter" inventory for all existing users.
- [ ] Coop session material union.
- [ ] `collaborators` + `source_owner_id` on publications.
- [ ] Group tags in Logbook.
- [ ] Edit-lock enforcement screen.
- [ ] Per-seat audio mute in coop.

### Phase 6 — notifications + pull-on-login (1 session)
- [ ] `notifications` table.
- [ ] Client fetcher + toast renderer.
- [ ] Artist "your song was pushed" toasts.
- [ ] Friend request / accept / coop invite toasts.

### Phase 7 — Unreal port layer (separate project)
- [ ] Map the friend list panel to Unreal's social widget.
- [ ] Port coop session subscription to Unreal's Supabase client.
- [ ] In-world toast notifications.
- [ ] Realtime presence across the shared world.

---

## 9. Open questions / decisions to make later

- **Username uniqueness** — currently profiles.username is nullable and
  non-unique. Making it unique is a migration + a backfill UX (what if
  two users already share a username?).
- **Friend request expiry** — do pending requests expire after N days?
- **Privacy on profiles** — can non-friends see my ArtistProfile? (Yes,
  published songs are public; metadata like friend count could be gated.)
- **Mute/block mechanics** — the `blocked` status in
  `friend_relationships` exists, but the UX of "I blocked this user"
  (hide their rows on leaderboards? stop them from pushing my songs?)
  needs design.
- **Group-song royalty/attribution share** — if we ever monetize plays,
  how is value split across collaborators? (Not urgent.)
- **Abandoning a coop session mid-write** — what happens to partial
  layers? Probably: session goes to 'abandoned', state preserved for
  X days so participants can rejoin, then garbage-collected.
- **How much does a friend affect your feed / leaderboard?** — right
  now leaderboards are global. Could be "friends-only" toggle, "mutuals
  first" ranking, etc.
- **Voice / text chat in coop** — out of scope here. Likely in-world
  only in Unreal (proximity voice).
- **Seed-ghost songs in leaderboards** — currently the 5 dev seed songs
  all aggregate under one ghost artist. Harmless for dev, but once real
  artists publish we might want to exclude the ghost from public
  leaderboards.

---

## 10. What this means for the UE5 port

Everything in this plan maps to Unreal's standard patterns:

- **Friends graph** → Unreal friend list UI + OnlineSubsystem. Same
  backing store (Supabase). Same RPCs.
- **Coop sessions** → Unreal networking session. The Supabase
  `coop_sessions.state` is the source-of-truth; clients subscribe via
  the same Realtime channel, rendered by the in-world multiplayer
  scene.
- **Cursors/Presence** → Unreal's RepMovement on a "ghost pointer"
  actor per seat. Same data (x, y, timestamp) flowing through the same
  Supabase Presence channel.
- **Inventory** → UDataAsset + player-owned `UInventoryComponent`.
  Backed by the same Supabase `user_sounds` rows.
- **Edit-lock** → a gate check on the song-editor entry point, same
  logic as the web client.
- **Notifications** → in-world toasts, same pull-on-login query.

The web client and the Unreal client stay in sync because they talk to
the same backend and enforce the same server-side rules. That's the
point.

---

## 11. Change log

- **2026-04-23**: initial draft. Locks the friends-first decision,
  Supabase Realtime as the coop backbone, inventory-as-real-ownership
  model, phased build order starting with publish-song.
