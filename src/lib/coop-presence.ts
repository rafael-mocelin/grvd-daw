/**
 * coop-presence.ts — Phase 4.3 cursor presence via Supabase Presence.
 *
 * Presence is a separate channel from the Postgres-changes channel used
 * for shared state (Phase 4.2). It carries transient payloads that never
 * hit the database — perfect for per-frame cursor positions.
 *
 * Payload schema (kept flat so a UE5 client can deserialize straight into
 * a USTRUCT later):
 *
 *   {
 *     userId:   string
 *     color:    string   // stable hue derived from userId hash
 *     cursor:   { xRel: number; yRel: number } | null
 *     ts:       number   // last-sent timestamp (for stale-detect)
 *   }
 *
 * Coordinates are viewport-relative (0..1) so cursors land in roughly the
 * same visual spot regardless of resolution differences between clients.
 * Good enough for desktop-to-desktop MVP; we'll revisit when we have real
 * multi-device testing.
 */

import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface CoopCursor {
  xRel: number;
  yRel: number;
}

export interface CoopPresencePayload {
  userId: string;
  color:  string;
  cursor: CoopCursor | null;
  ts:     number;
}

/**
 * Map of userId → latest presence payload. Excludes the current user (own
 * cursor is tracked locally by the OS). Only includes online seats.
 */
export type PresenceMap = Record<string, CoopPresencePayload>;

/* -------------------------------------------------------------------------- */
/* Color derivation (stable per-user hue)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Deterministic hue for a user id. Two users always get different colors
 * (as long as their hashes differ), and the same user always gets the same
 * color across sessions — matches the convention used elsewhere for artist
 * identity in the booth.
 */
export function coopSeatColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue}, 75%, 60%)`;
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Throttle interval for broadcasting cursor position. 50 ms = 20 fps,
 * smooth enough visually without flooding Realtime. Each broadcast is
 * a single JSON payload, so total bandwidth is tiny.
 */
const CURSOR_THROTTLE_MS = 50;

/**
 * Subscribe to a coop session's presence channel. Tracks your own cursor
 * (from window `mousemove`) and streams it to other seats; returns the
 * map of their latest payloads.
 *
 * When `sessionId` or `userId` is null we skip the whole setup — no
 * channel is opened and the map stays empty. Unmount + session-change
 * both tear down cleanly.
 */
export function useCoopPresence(
  sessionId: string | null,
  userId:    string | null,
): PresenceMap {
  const [peers, setPeers] = useState<PresenceMap>({});
  // Latest known cursor position for OUR seat; written by the mousemove
  // handler every frame, read by the throttled broadcaster.
  const ownCursorRef   = useRef<CoopCursor | null>(null);
  const lastSentAtRef  = useRef<number>(0);
  const lastSentRef    = useRef<string>("");   // JSON of last payload, for dedup

  useEffect(() => {
    if (!sessionId || !userId) { setPeers({}); return; }

    const myColor = coopSeatColor(userId);
    const channel = supabase.channel(`coop-presence-${sessionId}`, {
      config: { presence: { key: userId } },
    });

    // Pull the full presence state and narrow to a map keyed by userId.
    // Presence state is { [key]: [payload, payload, ...] } — same user can
    // have multiple tabs open, all broadcasting. We pick the most recent.
    function recomputePeers() {
      const state = channel.presenceState<CoopPresencePayload>();
      const next: PresenceMap = {};
      for (const [key, entries] of Object.entries(state)) {
        if (key === userId) continue; // drop self — OS cursor handles it
        // Pick the entry with the highest ts (most recent tab).
        const best = entries.reduce<CoopPresencePayload | null>((acc, e) => {
          const ep = e as unknown as CoopPresencePayload;
          if (!acc || ep.ts > acc.ts) return ep;
          return acc;
        }, null);
        if (best) next[key] = best;
      }
      setPeers(next);
    }

    channel
      .on("presence", { event: "sync" },  recomputePeers)
      .on("presence", { event: "join" },  recomputePeers)
      .on("presence", { event: "leave" }, recomputePeers)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Seed our entry so other seats see us "online" even before we move.
          await channel.track({
            userId,
            color:  myColor,
            cursor: null,
            ts:     Date.now(),
          } satisfies CoopPresencePayload);
        }
      });

    // ── Own-cursor tracking ──
    function onMove(ev: MouseEvent) {
      const xRel = Math.min(1, Math.max(0, ev.clientX / window.innerWidth));
      const yRel = Math.min(1, Math.max(0, ev.clientY / window.innerHeight));
      ownCursorRef.current = { xRel, yRel };
    }

    function onLeaveWindow() {
      ownCursorRef.current = null;
    }

    window.addEventListener("mousemove",  onMove);
    window.addEventListener("mouseleave", onLeaveWindow);

    // Throttled broadcaster — polls the ref every THROTTLE_MS and only
    // sends if the payload has meaningfully changed.
    const tickId = window.setInterval(() => {
      const now = Date.now();
      if (now - lastSentAtRef.current < CURSOR_THROTTLE_MS) return;

      const payload: CoopPresencePayload = {
        userId,
        color:  myColor,
        cursor: ownCursorRef.current,
        ts:     now,
      };
      // Dedup: skip if the cursor hasn't moved since last send. Keeps a
      // heartbeat at 2 Hz so other clients still see us as alive.
      const key = JSON.stringify(payload.cursor);
      if (key === lastSentRef.current && now - lastSentAtRef.current < 500) {
        return;
      }
      lastSentRef.current  = key;
      lastSentAtRef.current = now;
      channel.track(payload);
    }, CURSOR_THROTTLE_MS);

    return () => {
      window.clearInterval(tickId);
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mouseleave", onLeaveWindow);
      supabase.removeChannel(channel);
    };
  }, [sessionId, userId]);

  return peers;
}
