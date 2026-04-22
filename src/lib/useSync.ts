/**
 * useSync — loads the user's data from Supabase on login and
 * syncs mutations back whenever key store state changes.
 *
 * Call this once at the root of the authenticated app.
 */

import { useEffect, useRef } from "react";
import { useAuth } from "./auth";
import { useStore } from "../store/useStore";
import {
  fetchSongs,
  fetchTamagotchi,
  fetchStats,
  upsertTamagotchi,
  upsertStats,
} from "./db";

export function useSync() {
  const { user } = useAuth();
  const loadUserData           = useStore((s) => s.loadUserData);
  const loadPlayerEnergy       = useStore((s) => s.loadPlayerEnergy);
  const loadUserTastemakerData = useStore((s) => s.loadUserTastemakerData);

  const tamagotchi          = useStore((s) => s.tamagotchi);
  const totalXP             = useStore((s) => s.totalXP);
  const unlockedAchievements = useStore((s) => s.unlockedAchievements);
  const longestStreak       = useStore((s) => s.longestStreak);
  const longestSessionMs    = useStore((s) => s.longestSessionMs);
  const totalSongsAbandoned = useStore((s) => s.totalSongsAbandoned);
  const vocalCount          = useStore((s) => s.vocalCount);

  const prevUserId = useRef<string | null>(null);

  // ── Load on login ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (prevUserId.current === user.id) return;
    prevUserId.current = user.id;

    (async () => {
      const [songs, tam, stats] = await Promise.all([
        fetchSongs(user.id),
        fetchTamagotchi(user.id),
        fetchStats(user.id),
        // Tastemaker-tier user-specific loads — catalog is loaded per-screen
        // in the components that need it (Home / ListeningBooth) so guests
        // can see drops too.
        loadPlayerEnergy(),
        loadUserTastemakerData(),
      ]);
      loadUserData({ songs, tamagotchi: tam ?? undefined, stats: stats ?? undefined });
    })();
  }, [user, loadUserData, loadPlayerEnergy, loadUserTastemakerData]);

  // ── Sync tamagotchi whenever it changes ──────────────────────
  useEffect(() => {
    if (!user) return;
    upsertTamagotchi(tamagotchi, user.id);
  }, [user, tamagotchi]);

  // ── Sync stats whenever they change ──────────────────────────
  useEffect(() => {
    if (!user) return;
    upsertStats({
      totalXP,
      unlockedAchievements,
      longestStreak,
      longestSessionMs,
      totalSongsAbandoned,
      vocalCount,
    }, user.id);
  }, [user, totalXP, unlockedAchievements, longestStreak, longestSessionMs, totalSongsAbandoned, vocalCount]);
}
