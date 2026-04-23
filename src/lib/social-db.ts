/**
 * social-db.ts — Phase 3 client wrappers for profile reads + the friend
 * relationships graph.
 *
 * Kept separate from game-db.ts (economy/RPCs) so the social layer has
 * its own surface. All functions are fire-and-forget safe: they log
 * errors and return a typed fallback rather than throwing.
 *
 * Architecture contract (MULTIPLAYER_PLAN.md § 3):
 *   - Friend graph is mutual-consent. A sends → B accepts → bidirectional.
 *   - Server is truth for every write. Client proposes via RPC; server
 *     validates auth.uid() and enforces the canonical (lower-UUID-first)
 *     ordering internally, so callers don't have to know about it.
 *   - Reads use the `my_friends` view which flattens the pair ordering
 *     and returns the OTHER user's id relative to the caller.
 */

import { supabase } from "./supabase";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface PublicProfile {
  id:        string;
  username:  string;       // falls back to 'anon' when null/empty on the row
  avatar:    string;       // falls back to '👤' when null/empty
  createdAt: string;
}

export type FriendStatus = "pending" | "accepted" | "blocked";

export interface FriendRow {
  friendUserId: string;
  status:       FriendStatus;
  /** uid of whoever initiated; useful to tell incoming vs outgoing pending. */
  requestedBy:  string;
  requestedAt:  string;
  acceptedAt:   string | null;
}

/** What a send/respond RPC returns. */
export interface FriendActionResult {
  success: boolean;
  message: string;
  status:  FriendStatus | null;
}

/* -------------------------------------------------------------------------- */
/* Profile reads                                                               */
/*                                                                             */
/* Profiles are now public-read (RLS: `profiles: public read`). These helpers */
/* exist mostly to normalize the shape + fall back cleanly when a row is       */
/* missing (shouldn't happen in practice; defensive).                          */
/* -------------------------------------------------------------------------- */

function rowToProfile(row: {
  id: string | null;
  username: string | null;
  avatar: string | null;
  created_at: string | null;
}): PublicProfile {
  return {
    id:        row.id ?? "",
    username:  row.username && row.username.length > 0 ? row.username : "anon",
    avatar:    row.avatar   && row.avatar.length   > 0 ? row.avatar   : "👤",
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export async function fetchProfileById(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("[social-db] fetchProfileById:", error.message);
    return null;
  }
  return data ? rowToProfile(data) : null;
}

/** Prefix search on usernames (case-insensitive). Excludes the caller. */
export async function searchProfilesByUsername(
  prefix: string,
  excludeUserId: string | null = null,
  limit = 20,
): Promise<PublicProfile[]> {
  const trimmed = prefix.trim();
  if (trimmed.length === 0) return [];

  let q = supabase
    .from("profiles")
    .select("id, username, avatar, created_at")
    .ilike("username", `${trimmed}%`)
    .not("username", "is", null)
    .order("username", { ascending: true })
    .limit(limit);
  if (excludeUserId) q = q.neq("id", excludeUserId);

  const { data, error } = await q;
  if (error) {
    console.error("[social-db] searchProfilesByUsername:", error.message);
    return [];
  }
  return (data ?? []).map(rowToProfile);
}

/* -------------------------------------------------------------------------- */
/* Friend graph reads                                                          */
/* -------------------------------------------------------------------------- */

/** Every relationship row I'm part of (accepted + pending). */
export async function fetchMyFriends(): Promise<FriendRow[]> {
  const { data, error } = await supabase
    .from("my_friends")
    .select("friend_user_id, status, requested_by, requested_at, accepted_at");
  if (error) {
    console.error("[social-db] fetchMyFriends:", error.message);
    return [];
  }
  return (data ?? [])
    .filter((r) => r.friend_user_id && r.status)
    .map((r) => ({
      friendUserId: r.friend_user_id as string,
      status:       r.status as FriendStatus,
      requestedBy:  r.requested_by ?? "",
      requestedAt:  r.requested_at ?? new Date().toISOString(),
      acceptedAt:   r.accepted_at,
    }));
}

/* -------------------------------------------------------------------------- */
/* Friend graph writes (RPCs)                                                  */
/* -------------------------------------------------------------------------- */

function unpackFriendAction(row: {
  success: boolean;
  message: string;
  status: string | null;
}): FriendActionResult {
  return {
    success: row.success,
    message: row.message,
    status:  (row.status as FriendStatus | null) ?? null,
  };
}

export async function sendFriendRequest(
  otherUserId: string,
): Promise<FriendActionResult | null> {
  const { data, error } = await supabase.rpc("send_friend_request", {
    p_other_user_id: otherUserId,
  });
  if (error) {
    console.error("[social-db] sendFriendRequest:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? unpackFriendAction(row) : null;
}

export async function respondFriendRequest(
  otherUserId: string,
  accept: boolean,
): Promise<FriendActionResult | null> {
  const { data, error } = await supabase.rpc("respond_friend_request", {
    p_other_user_id: otherUserId,
    p_accept:        accept,
  });
  if (error) {
    console.error("[social-db] respondFriendRequest:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? unpackFriendAction(row) : null;
}

export async function removeFriend(
  otherUserId: string,
): Promise<{ success: boolean; message: string } | null> {
  const { data, error } = await supabase.rpc("remove_friend", {
    p_other_user_id: otherUserId,
  });
  if (error) {
    console.error("[social-db] removeFriend:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { success: row.success, message: row.message } : null;
}

/* -------------------------------------------------------------------------- */
/* Fan relationships (one-way follow)                                          */
/*                                                                             */
/* A fan row means "fan_id follows artist_id." Asymmetric and doesn't need    */
/* consent — you can fan anyone whose drops you've heard. No energy cost.     */
/* -------------------------------------------------------------------------- */

/** Return true if I am a fan of this artist. */
export async function isFanOf(artistId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("fan_relationships")
    .select("artist_id")
    .eq("artist_id", artistId)
    .maybeSingle();
  if (error) {
    console.error("[social-db] isFanOf:", error.message);
    return false;
  }
  return !!data;
}

/** Total fan count for an artist (public read). */
export async function fetchArtistFanCount(artistId: string): Promise<number> {
  const { count, error } = await supabase
    .from("fan_relationships")
    .select("*", { count: "exact", head: true })
    .eq("artist_id", artistId);
  if (error) {
    console.error("[social-db] fetchArtistFanCount:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Idempotent become-fan. RLS policy requires fan_id = auth.uid() on the
 * inserted row, so we look up the session's uid before inserting. This
 * matches the "source of truth is the session, not the store" pattern we
 * use for storage uploads — avoids the client passing a stale cached id.
 */
export async function becomeFan(artistId: string): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;
  if (!uid) {
    console.warn("[social-db] becomeFan: no session");
    return false;
  }
  const { error } = await supabase
    .from("fan_relationships")
    .insert({ artist_id: artistId, fan_id: uid });
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("[social-db] becomeFan:", error.message);
    return false;
  }
  return true;
}

/** Remove a fan relationship (unfan). */
export async function unfan(artistId: string): Promise<boolean> {
  const { error } = await supabase
    .from("fan_relationships")
    .delete()
    .eq("artist_id", artistId);
  if (error) {
    console.error("[social-db] unfan:", error.message);
    return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* Profile stat aggregations                                                   */
/*                                                                             */
/* Cheap client-side COUNTs so we don't need another round of DB migrations   */
/* for views/RPCs. When the numbers get expensive we'll roll up into a view.  */
/* -------------------------------------------------------------------------- */

export interface TastemakerStats {
  ratingsGiven:     number;
  endorsementsGiven: number;
  earlyEarHits:     number;
  fansFollowing:    number;
}

export async function fetchTastemakerStats(userId: string): Promise<TastemakerStats> {
  // Run the four counts in parallel.
  const [ratings, endorsements, bonuses, following] = await Promise.all([
    supabase.from("song_ratings").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("song_endorsements").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("player_events").select("*", { count: "exact", head: true })
      .eq("user_id", userId).eq("event_type", "early_ear_bonus"),
    supabase.from("fan_relationships").select("*", { count: "exact", head: true }).eq("fan_id", userId),
  ]);
  return {
    ratingsGiven:      ratings.count      ?? 0,
    endorsementsGiven: endorsements.count ?? 0,
    earlyEarHits:      bonuses.count      ?? 0,
    fansFollowing:     following.count    ?? 0,
  };
}

export interface ArtistStats {
  totalDrops:        number;
  totalRatings:      number;
  avgStars:          number;  // weighted across all their drops
  totalEndorsements: number;
  totalFans:         number;
}

/**
 * Roll up an artist's public stats. Uses song_publication_stats for
 * per-song aggregates then folds them client-side (their catalog is
 * always small enough — tens of drops, not thousands).
 */
export async function fetchArtistStats(artistId: string): Promise<ArtistStats> {
  const [drops, fans] = await Promise.all([
    supabase
      .from("song_publication_stats")
      .select("song_id, rating_count, avg_stars, endorsement_count")
      .eq("artist_id", artistId),
    fetchArtistFanCount(artistId),
  ]);

  const rows = drops.data ?? [];
  let totalRatings = 0;
  let totalEndorsements = 0;
  let starSum = 0;
  for (const r of rows) {
    const rc = r.rating_count ?? 0;
    totalRatings      += rc;
    totalEndorsements += r.endorsement_count ?? 0;
    starSum           += (r.avg_stars ?? 0) * rc;   // weight avg by count
  }
  return {
    totalDrops:        rows.length,
    totalRatings,
    avgStars:          totalRatings > 0 ? starSum / totalRatings : 0,
    totalEndorsements,
    totalFans:         fans,
  };
}
