/**
 * db.ts — thin wrappers around Supabase for the DAW's persisted data.
 * All functions are fire-and-forget safe (they log errors but don't throw).
 */

import { supabase } from "./supabase";
import type { Song, Tamagotchi } from "../data/types";

/* -------------------------------------------------------------------------- */
/* Songs                                                                       */
/* -------------------------------------------------------------------------- */

export async function upsertSong(song: Song, userId: string): Promise<void> {
  const { error } = await supabase.from("songs").upsert({
    id:             song.id,
    user_id:        userId,
    name:           song.name,
    bpm:            song.bpm,
    bars:           song.bars,
    key_root:       song.keyRoot,
    template_id:    song.templateId,
    layers:         song.layers,
    tags:           song.tags,
    collaborators:  song.collaborators,
    created_at:     song.createdAt,
    vocal_blob_url: song.vocalBlobUrl ?? null,
    pitch_score:    song.pitchScore ?? null,
  });
  if (error) console.error("[db] upsertSong:", error.message);
}

export async function fetchSongs(userId: string): Promise<Song[]> {
  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) { console.error("[db] fetchSongs:", error.message); return []; }

  return (data ?? []).map((row) => ({
    id:           row.id,
    name:         row.name,
    bpm:          row.bpm,
    bars:         row.bars,
    keyRoot:      row.key_root,
    templateId:   row.template_id,
    layers:       row.layers,
    tags:         row.tags,
    collaborators: row.collaborators,
    createdAt:    row.created_at,
    vocalBlobUrl: row.vocal_blob_url ?? undefined,
    pitchScore:   row.pitch_score ?? undefined,
    // Populated server-side by the publish_song RPC; presence marks the
    // song as "already shipped" so the UI can disable the publish button.
    publishedPublicationId: row.published_publication_id ?? undefined,
  }));
}

export async function deleteSong(songId: string): Promise<void> {
  const { error } = await supabase.from("songs").delete().eq("id", songId);
  if (error) console.error("[db] deleteSong:", error.message);
}

/**
 * Wipes every song row for this user. Admin reset only.
 */
export async function deleteAllSongs(userId: string): Promise<void> {
  const { error } = await supabase.from("songs").delete().eq("user_id", userId);
  if (error) console.error("[db] deleteAllSongs:", error.message);
}

/* -------------------------------------------------------------------------- */
/* Tamagotchi state                                                            */
/* -------------------------------------------------------------------------- */

export async function upsertTamagotchi(
  tam: Tamagotchi,
  userId: string
): Promise<void> {
  const { error } = await supabase.from("tamagotchi_state").upsert({
    user_id:         userId,
    needs:           tam.needs,
    mood:            tam.mood,
    streak_days:     tam.streakDays,
    songs_finished:  tam.songsFinished,
    songs_abandoned: tam.songsAbandoned,
    last_seen_at:    tam.lastSeenAt,
    updated_at:      new Date().toISOString(),
  });
  if (error) console.error("[db] upsertTamagotchi:", error.message);
}

export async function fetchTamagotchi(userId: string): Promise<Tamagotchi | null> {
  const { data, error } = await supabase
    .from("tamagotchi_state")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    name:           "GRVD",
    mood:           data.mood,
    needs:          data.needs,
    lastSeenAt:     data.last_seen_at,
    streakDays:     data.streak_days,
    songsFinished:  data.songs_finished,
    songsAbandoned: data.songs_abandoned,
  };
}

/* -------------------------------------------------------------------------- */
/* User stats / gamification                                                   */
/* -------------------------------------------------------------------------- */

interface UserStats {
  totalXP: number;
  unlockedAchievements: string[];
  longestStreak: number;
  longestSessionMs: number;
  totalSongsAbandoned: number;
  vocalCount: number;
}

export async function upsertStats(stats: UserStats, userId: string): Promise<void> {
  const { error } = await supabase.from("user_stats").upsert({
    user_id:               userId,
    total_xp:              stats.totalXP,
    unlocked_achievements: stats.unlockedAchievements,
    longest_streak:        stats.longestStreak,
    longest_session_ms:    stats.longestSessionMs,
    total_songs_abandoned: stats.totalSongsAbandoned,
    vocal_count:           stats.vocalCount,
    updated_at:            new Date().toISOString(),
  });
  if (error) console.error("[db] upsertStats:", error.message);
}

export async function fetchStats(userId: string): Promise<UserStats | null> {
  const { data, error } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    totalXP:              data.total_xp,
    unlockedAchievements: data.unlocked_achievements,
    longestStreak:        data.longest_streak,
    longestSessionMs:     data.longest_session_ms,
    totalSongsAbandoned:  data.total_songs_abandoned,
    vocalCount:           data.vocal_count,
  };
}
