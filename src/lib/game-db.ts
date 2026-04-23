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
  excludeArtistId: string | null = null,
): Promise<PublishedSong[]> {
  // Build the query — if we know the current user, filter their own drops
  // out of the booth feed. An artist shouldn't be able to rate or push their
  // own songs. (Server-side filter is a soft guard; the authoritative rules
  // live in the endorse_song RPC, which also skips the artist energy credit
  // when the endorser IS the artist.)
  let q = supabase
    .from("song_publication_stats")
    .select(
      "song_id,title,artist_id,artist_name,artist_avatar,audio_url,waveform_url,bpm,key_root,duration_sec,published_at,rating_count,avg_stars,endorsement_count"
    )
    .order("published_at", { ascending: false })
    .limit(limit);
  if (excludeArtistId) {
    q = q.neq("artist_id", excludeArtistId);
  }
  const { data, error } = await q;

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
/* Publishing (Phase 2.5)                                                      */
/*                                                                             */
/* Two-step client flow:                                                       */
/*   1. Upload the rendered WAV to the `song-audio` Supabase Storage bucket.  */
/*      Path convention: `{user_id}/{song_id}.wav`. Storage RLS enforces       */
/*      that users can only write to their own folder.                         */
/*   2. Call the publish_song RPC with (songId, audioUrl). The RPC is          */
/*      atomic: checks cap + energy, snapshots the artist's profile fields,   */
/*      inserts the song_publications row, logs the audit event.               */
/*                                                                             */
/* If step 1 succeeds but step 2 fails (cap reached, out of energy), we leave */
/* the audio file in storage. Cost is trivial; the file gets reused on retry. */
/* -------------------------------------------------------------------------- */

export interface PublishSongResult {
  success:           boolean;
  message:           string;
  publicationId:     string | null;
  newEnergy:         number;
  newXp:             number;
  newLevel:          number;
  publicationsToday: number;
  dailyCap:          number;
}

export interface UploadSongAudioResult {
  publicUrl: string | null;
  /** Non-null iff upload failed — a human-readable reason to surface in the UI. */
  error:     string | null;
}

/**
 * Upload a rendered WAV blob to Supabase Storage and return its public URL.
 *
 * Important: the path's first folder MUST equal the session's auth.uid()
 * or the storage RLS policy ("song-audio: upload own folder") will reject
 * the write. We don't trust the store's userId here — it's a React-state
 * mirror of the session that can drift by a render if auth state races.
 * Instead we pull the id directly from Supabase auth at call time. If the
 * session is missing / expired, we fail cleanly with a descriptive error
 * rather than firing an upload that's guaranteed to 403.
 *
 * The `userId` parameter is kept for API compatibility and as a mismatch
 * guard — if it disagrees with the session's uid, we log a warning and
 * use the session's uid (the one auth.uid() will actually see).
 */
export async function uploadSongAudio(
  userId: string,
  songId: string,
  wav: Blob,
): Promise<UploadSongAudioResult> {
  // Source of truth: the session. auth.uid() server-side = this id.
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) {
    return { publicUrl: null, error: `session lookup failed: ${sessionErr.message}` };
  }
  const sessionUid = sessionData?.session?.user?.id ?? null;
  if (!sessionUid) {
    return { publicUrl: null, error: "no active session — sign in and retry" };
  }
  if (sessionUid !== userId) {
    // Non-fatal, but tells us when store state has drifted from auth.
    console.warn(
      `[game-db] uploadSongAudio: store userId (${userId}) != session uid (${sessionUid}); using session uid`,
    );
  }

  const path = `${sessionUid}/${songId}.wav`;
  console.info(
    `[game-db] uploadSongAudio: path=${path}, size=${(wav.size / 1024 / 1024).toFixed(2)}MB, type=${wav.type}`,
  );

  const { error } = await supabase.storage
    .from("song-audio")
    .upload(path, wav, {
      contentType: "audio/wav",
      upsert:      true,
    });

  if (error) {
    console.error("[game-db] uploadSongAudio:", error);
    return { publicUrl: null, error: error.message ?? "unknown upload error" };
  }
  const { data } = supabase.storage.from("song-audio").getPublicUrl(path);
  if (!data?.publicUrl) {
    return { publicUrl: null, error: "no public URL returned" };
  }
  return { publicUrl: data.publicUrl, error: null };
}

/** Call the publish_song RPC after the audio is uploaded. */
export async function publishSongRpc(
  songId: string,
  audioUrl: string,
): Promise<PublishSongResult | null> {
  const { data, error } = await supabase.rpc("publish_song", {
    p_song_id:   songId,
    p_audio_url: audioUrl,
  });
  if (error) {
    console.error("[game-db] publishSongRpc:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    success:           row.success,
    message:           row.message,
    publicationId:     row.publication_id,
    newEnergy:         row.new_energy,
    newXp:             row.new_xp,
    newLevel:          row.new_level,
    publicationsToday: row.publications_today,
    dailyCap:          row.daily_cap,
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
 * Endorse-song response. In addition to the energy/xp/level fields, returns
 * the daily cap state so the client can surface "2/3 pushes today" to the
 * player and disable the button once they're at their cap.
 */
export interface EndorseSongResult {
  success:           boolean;
  message:           string;
  newEnergy:         number;
  newXp:             number;
  newLevel:          number;
  endorsementsToday: number;
  dailyCap:          number;
}

/**
 * Endorse a song via the atomic `endorse_song` RPC (Slice 2).
 *
 * Replaces the old two-call sequence (spend_energy + insert) with a single
 * server-side function that atomically:
 *   • checks the user's level-scaled daily endorse cap,
 *   • checks energy affordability (cost hard-coded on server at 15),
 *   • deducts energy + awards XP (+10) + recomputes level,
 *   • inserts the song_endorsements row,
 *   • appends a player_events audit row.
 *
 * Energy cost and XP gain are authoritative on the server — the client
 * passes nothing but the song id. That matches the UE5 principle of
 * "client sends intent, server is truth" (see docs/UE5_PORT_GUIDE.md).
 */
export async function endorseSongRpc(
  songId: string,
): Promise<EndorseSongResult | null> {
  const { data, error } = await supabase.rpc("endorse_song", {
    p_song_id: songId,
  });
  if (error) {
    console.error("[game-db] endorseSongRpc:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    success:           row.success,
    message:           row.message,
    newEnergy:         row.new_energy,
    newXp:             row.new_xp,
    newLevel:          row.new_level,
    endorsementsToday: row.endorsements_today,
    dailyCap:          row.daily_cap,
  };
}

/* -------------------------------------------------------------------------- */
/* Game config (Slice 2)                                                       */
/*                                                                             */
/* Key-value Postgres table seeded with tunable constants (early-ear          */
/* threshold, artist boost amounts, etc.). Public-read so the booth + admin   */
/* panel both see it; writes go through admin_set_game_config RPC which       */
/* checks app_metadata.role = 'admin' before committing.                       */
/* -------------------------------------------------------------------------- */

export interface EarlyEarThreshold {
  min_ratings:      number;
  min_avg_stars:    number;
  min_endorsements: number;
  bonus_xp:         number;
}

export interface ArtistBoostConfig {
  energy_per_endorsement: number;
  daily_cap_energy:       number;
}

export async function fetchGameConfig<T = unknown>(
  key: string,
): Promise<T | null> {
  const { data, error } = await supabase
    .from("game_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.error(`[game-db] fetchGameConfig(${key}):`, error.message);
    return null;
  }
  return (data?.value as T | undefined) ?? null;
}

/**
 * Admin-only write path. Returns the updated row or null on failure.
 * Non-admins hit a 'Only admins can update game_config' server exception
 * (guarded in the admin_set_game_config RPC).
 */
export async function adminSetGameConfig(
  key: string,
  value: unknown,
): Promise<{ key: string; value: unknown; updatedAt: string } | null> {
  const { data, error } = await supabase.rpc("admin_set_game_config", {
    p_key:   key,
    p_value: value as never,
  });
  if (error) {
    console.error("[game-db] adminSetGameConfig:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { key: row.key, value: row.value, updatedAt: row.updated_at };
}

/* -------------------------------------------------------------------------- */
/* Leaderboards (Slice 2)                                                      */
/*                                                                             */
/* Three read-only views on Supabase aggregate the last 7 days of ratings +   */
/* endorsements into song / artist / tastemaker rankings. The views are       */
/* security_invoker and grant-selected to both authenticated + anon, so the   */
/* leaderboard works for guests too.                                           */
/*                                                                             */
/* Score formulas (on the DB side):                                            */
/*   song_score       = avg_stars * rating_count + endorsement_count * 5      */
/*   artist_score     = sum of that artist's song_scores                       */
/*   tastemaker_score = ratings_given + endorsements_given * 3                 */
/* -------------------------------------------------------------------------- */

export interface LeaderboardSong {
  songId: string;
  title: string;
  artistId: string;
  artistName: string;
  artistAvatar: string;
  audioUrl: string | null;
  bpm: number | null;
  keyRoot: string | null;
  durationSec: number | null;
  ratingsThisWeek: number;
  avgStarsThisWeek: number;
  endorsementsThisWeek: number;
  score: number;
}

export interface LeaderboardArtist {
  artistId: string;
  artistName: string;
  artistAvatar: string;
  songsActive: number;
  ratingsThisWeek: number;
  endorsementsThisWeek: number;
  score: number;
}

export interface LeaderboardTastemaker {
  userId: string;
  username: string;
  avatar: string;
  ratingsGiven: number;
  endorsementsGiven: number;
  score: number;
}

export async function fetchTopSongsThisWeek(
  limit = 10,
): Promise<LeaderboardSong[]> {
  const { data, error } = await supabase
    .from("weekly_song_score")
    .select(
      "song_id,title,artist_id,artist_name,artist_avatar,audio_url,bpm,key_root,duration_sec,ratings_this_week,avg_stars_this_week,endorsements_this_week,score"
    )
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("[game-db] fetchTopSongsThisWeek:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    songId:               row.song_id ?? "",
    title:                row.title ?? "Untitled",
    artistId:             row.artist_id ?? "",
    artistName:           row.artist_name ?? "unknown",
    artistAvatar:         row.artist_avatar ?? "🎧",
    audioUrl:             row.audio_url,
    bpm:                  row.bpm,
    keyRoot:              row.key_root,
    durationSec:          row.duration_sec,
    ratingsThisWeek:      row.ratings_this_week ?? 0,
    avgStarsThisWeek:     row.avg_stars_this_week ?? 0,
    endorsementsThisWeek: row.endorsements_this_week ?? 0,
    score:                row.score ?? 0,
  }));
}

export async function fetchTopArtistsThisWeek(
  limit = 10,
): Promise<LeaderboardArtist[]> {
  const { data, error } = await supabase
    .from("weekly_artist_score")
    .select(
      "artist_id,artist_name,artist_avatar,songs_active,ratings_this_week,endorsements_this_week,score"
    )
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("[game-db] fetchTopArtistsThisWeek:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    artistId:             row.artist_id ?? "",
    artistName:           row.artist_name ?? "unknown",
    artistAvatar:         row.artist_avatar ?? "🎧",
    songsActive:          row.songs_active ?? 0,
    ratingsThisWeek:      row.ratings_this_week ?? 0,
    endorsementsThisWeek: row.endorsements_this_week ?? 0,
    score:                row.score ?? 0,
  }));
}

export async function fetchTopTastemakersThisWeek(
  limit = 10,
): Promise<LeaderboardTastemaker[]> {
  const { data, error } = await supabase
    .from("weekly_tastemaker_score")
    .select(
      "user_id,username,avatar,ratings_given,endorsements_given,score"
    )
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("[game-db] fetchTopTastemakersThisWeek:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    userId:            row.user_id ?? "",
    username:          row.username ?? "anon",
    avatar:            row.avatar ?? "👤",
    ratingsGiven:      row.ratings_given ?? 0,
    endorsementsGiven: row.endorsements_given ?? 0,
    score:             row.score ?? 0,
  }));
}
