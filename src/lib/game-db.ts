/**
 * game-db.ts — Tastemaker/Fan tier queries.
 *
 * Kept separate from db.ts (which handles the Artist-side song inventory and
 * tamagotchi state) so the publish-tier economy has its own surface. All
 * functions are fire-and-forget safe: they log errors and return a sensible
 * empty fallback rather than throwing.
 */

import { supabase } from "./supabase";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface PublishedSong {
  songId: string;
  title: string;
  artistId: string;
  artistName: string;
  /**
   * Emoji "profile picture" for the artist, snapshotted at publish time
   * into song_publications.artist_avatar. Self-contained rows keep Unreal
   * happy (no runtime join) and let each drop carry its own identity.
   */
  artistAvatar: string;
  audioUrl: string | null;
  waveformUrl: string | null;
  bpm: number | null;
  keyRoot: string | null;
  durationSec: number | null;
  publishedAt: string;
  ratingCount: number;
  avgStars: number;
  endorsementCount: number;
}

export interface LiveEnergyState {
  liveEnergy: number;
  baseEnergy: number;
  energyUpdatedAt: string; // ISO
  level: number;
  totalXp: number;
}

export interface SpendEnergyResult {
  success: boolean;
  newEnergy: number;
  newXp: number;
  message: string;
}

export interface CappedXpResult {
  xpAwarded: number;
  newXp: number;
  dailyXpEarned: number;
}

/* -------------------------------------------------------------------------- */
/* Live energy + XP (RPC wrappers)                                             */
/* -------------------------------------------------------------------------- */

export async function fetchLiveEnergy(): Promise<LiveEnergyState | null> {
  const { data, error } = await supabase.rpc("get_live_energy", {});
  if (error) {
    console.error("[game-db] fetchLiveEnergy:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    liveEnergy:       row.live_energy,
    baseEnergy:       row.base_energy,
    energyUpdatedAt:  row.energy_updated_at,
    level:            row.level,
    totalXp:          row.total_xp,
  };
}

export async function spendEnergyRpc(
  cost: number,
  eventType: string,
  targetId: string | null = null,
  xp: number = 0,
): Promise<SpendEnergyResult | null> {
  const { data, error } = await supabase.rpc("spend_energy", {
    p_cost:       cost,
    p_event_type: eventType,
    p_target_id:  targetId ?? undefined,
    p_xp:         xp,
  });
  if (error) {
    console.error("[game-db] spendEnergyRpc:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    success:    row.success,
    newEnergy:  row.new_energy,
    newXp:      row.new_xp,
    message:    row.message,
  };
}

/* -------------------------------------------------------------------------- */
/* Published catalog                                                           */
/* -------------------------------------------------------------------------- */

export async function fetchPublishedCatalog(
  limit = 50,
): Promise<PublishedSong[]> {
  const { data, error } = await supabase
    .from("song_publication_stats")
    .select(
      "song_id,title,artist_id,artist_name,artist_avatar,audio_url,waveform_url,bpm,key_root,duration_sec,published_at,rating_count,avg_stars,endorsement_count"
    )
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[game-db] fetchPublishedCatalog:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    songId:          row.song_id ?? "",
    title:           row.title ?? "Untitled",
    artistId:        row.artist_id ?? "",
    artistName:      row.artist_name ?? "unknown",
    artistAvatar:    row.artist_avatar ?? "🎧",
    audioUrl:        row.audio_url,
    waveformUrl:     row.waveform_url,
    bpm:             row.bpm,
    keyRoot:         row.key_root,
    durationSec:     row.duration_sec,
    publishedAt:     row.published_at ?? new Date().toISOString(),
    ratingCount:     row.rating_count ?? 0,
    avgStars:        row.avg_stars ?? 0,
    endorsementCount: row.endorsement_count ?? 0,
  }));
}

/* -------------------------------------------------------------------------- */
/* Ratings                                                                     */
/* -------------------------------------------------------------------------- */

/** Fetch every rating the current user has made. Small per-user set; safe to pull all. */
export async function fetchUserRatings(
  userId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("song_ratings")
    .select("song_id, stars")
    .eq("user_id", userId);
  if (error) {
    console.error("[game-db] fetchUserRatings:", error.message);
    return {};
  }
  const map: Record<string, number> = {};
  for (const r of data ?? []) {
    if (r.song_id) map[r.song_id] = r.stars;
  }
  return map;
}

/**
 * Rate a song and receive capped XP in one call. Server-side upserts the
 * rating (replaces prior stars) and awards up to the daily XP cap for 'rate'.
 */
export async function rateSongRpc(
  songId: string,
  stars: number,
): Promise<CappedXpResult | null> {
  const { data, error } = await supabase.rpc("rate_song", {
    p_song_id: songId,
    p_stars:   stars,
  });
  if (error) {
    console.error("[game-db] rateSongRpc:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    xpAwarded:       row.xp_awarded,
    newXp:           row.new_xp,
    dailyXpEarned:   row.daily_xp_earned,
  };
}

/* -------------------------------------------------------------------------- */
/* Endorsements                                                                */
/* -------------------------------------------------------------------------- */

/** Fetch every endorsement by the current user. */
export async function fetchUserEndorsements(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("song_endorsements")
    .select("song_id")
    .eq("user_id", userId);
  if (error) {
    console.error("[game-db] fetchUserEndorsements:", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.song_id).filter(Boolean) as string[];
}

/**
 * Endorse a song. Spends energy via RPC and inserts the endorsement row.
 * Returns the new energy state or null on failure.
 */
export async function endorseSongRpc(
  songId: string,
  cost: number,
  xp: number,
): Promise<SpendEnergyResult | null> {
  // Spend first: if user can't afford, we never write the endorsement row.
  const spend = await spendEnergyRpc(cost, "endorse", songId, xp);
  if (!spend || !spend.success) return spend;

  // Insert the endorsement (RLS enforces user_id = auth.uid()).
  const { error } = await supabase
    .from("song_endorsements")
    .insert({ song_id: songId });

  if (error) {
    // Note: energy was already spent. The daily cap + future-idempotent unique
    // constraint (user_id, song_id) means retries are safe, but we log for
    // visibility. We don't attempt to refund here — that'd need a compensating
    // RPC; acceptable cost given endorsements are rare and explicit.
    console.error("[game-db] endorseSongRpc insert:", error.message);
  }
  return spend;
}
