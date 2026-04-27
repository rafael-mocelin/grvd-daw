/**
 * notifications.ts — Phase 6 toast feed.
 *
 * Server-side triggers (notify_on_endorsement, notify_on_friend_request,
 * notify_on_friend_accept, notify_on_coop_invite, notify_on_player_event)
 * write to the notifications table. Clients SELECT through RLS (own only),
 * UPDATE seen_at to dismiss, DELETE to clear.
 *
 * Six notification kinds today:
 *   endorsement_received     — your song got pushed
 *   friend_request_received  — someone wants to be friends
 *   friend_request_accepted  — someone accepted your request
 *   coop_invite_received     — someone invited you to coop
 *   early_ear_bonus_awarded  — your early-ear rating just paid off
 *   artist_boost_received    — your song got pushed and you got energy back
 *
 * Realtime: notifications is in supabase_realtime publication so clients
 * subscribe to inserts and pop a toast within ~100ms of the trigger
 * firing. The hook also fetches unseen on mount so anything that
 * happened while the user was offline still surfaces.
 */

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type NotificationKind =
  | "endorsement_received"
  | "friend_request_received"
  | "friend_request_accepted"
  | "coop_invite_received"
  | "early_ear_bonus_awarded"
  | "early_claim_bonus_awarded"
  | "artist_boost_received";

/** Discriminated union — payload shape varies by kind. */
export type NotificationPayload =
  | {
      kind: "endorsement_received";
      song_id:      string;
      song_title:   string;
      fan_id:       string;
      fan_username: string;
      fan_avatar:   string;
    }
  | {
      kind: "friend_request_received";
      requester_id:       string;
      requester_username: string;
      requester_avatar:   string;
    }
  | {
      kind: "friend_request_accepted";
      accepter_id:       string;
      accepter_username: string;
      accepter_avatar:   string;
    }
  | {
      kind: "coop_invite_received";
      session_id:    string;
      host_id:       string;
      host_username: string;
      host_avatar:   string;
      join_code:     string;
    }
  | {
      kind: "early_ear_bonus_awarded";
      song_id:      string | null;
      song_title:   string;
      energy_delta: number;
      xp_delta:     number;
    }
  | {
      kind: "artist_boost_received";
      song_id:      string | null;
      song_title:   string;
      energy_delta: number;
      xp_delta:     number;
    }
  | {
      // Phase 5.B step 11 — fired on every beneficiary when a producer
      // sound crosses the early-claim threshold. role differentiates
      // producer milestone vs early claimer for the toast copy.
      kind: "early_claim_bonus_awarded";
      role:         "producer" | "claimer";
      sound_id:     string;
      bonus_xp:     number;
      total_claims: number;
    };

export interface Notification {
  id:        number;
  userId:    string;
  kind:      NotificationKind;
  payload:   NotificationPayload;
  seenAt:    string | null;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Row → client mapping                                                        */
/* -------------------------------------------------------------------------- */

function rowToNotification(row: {
  id:         number;
  user_id:    string;
  kind:       string;
  payload:    Record<string, unknown> | unknown;
  seen_at:    string | null;
  created_at: string;
}): Notification {
  // Tag the payload with its kind so consumers can switch cleanly.
  const payload = {
    kind: row.kind,
    ...(row.payload as Record<string, unknown>),
  } as NotificationPayload;
  return {
    id:        row.id,
    userId:    row.user_id,
    kind:      row.kind as NotificationKind,
    payload,
    seenAt:    row.seen_at,
    createdAt: row.created_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Fetch + write helpers                                                       */
/* -------------------------------------------------------------------------- */

/** All my unseen notifications, newest first. */
export async function fetchUnseenNotifications(
  userId: string,
  limit = 50,
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, user_id, kind, payload, seen_at, created_at")
    .eq("user_id", userId)
    .is("seen_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[notifications] fetchUnseen:", error.message);
    return [];
  }
  return (data ?? []).map(rowToNotification);
}

/** Mark one or more as seen. */
export async function markNotificationsSeen(ids: number[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { error } = await supabase
    .from("notifications")
    .update({ seen_at: new Date().toISOString() })
    .in("id", ids);
  if (error) {
    console.error("[notifications] markSeen:", error.message);
    return false;
  }
  return true;
}

/** Dismiss = delete (so it doesn't clutter the user's history). */
export async function deleteNotification(id: number): Promise<boolean> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[notifications] delete:", error.message);
    return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* React hook — initial fetch + Realtime subscribe                             */
/* -------------------------------------------------------------------------- */

/**
 * Returns the current unseen notification queue and live-subscribes to new
 * inserts via Supabase Realtime. Notifications come in within ~100ms of
 * the server trigger firing.
 *
 * The component using this is responsible for marking them seen as it
 * displays them (so the queue drains as toasts pop) — that's done via
 * markNotificationsSeen elsewhere.
 */
export function useUnseenNotifications(userId: string | null): Notification[] {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    if (!userId) { setItems([]); return; }

    let cancelled = false;
    (async () => {
      const rows = await fetchUnseenNotifications(userId);
      if (!cancelled) setItems(rows);
    })();

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (event) => {
          // The new row is in event.new — append to the queue.
          if (cancelled) return;
          const row = event.new as Parameters<typeof rowToNotification>[0];
          const n = rowToNotification(row);
          setItems((prev) => {
            // Dedup just in case Realtime delivers the same insert twice.
            if (prev.some((x) => x.id === n.id)) return prev;
            return [n, ...prev];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event:  "DELETE",
          schema: "public",
          table:  "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (event) => {
          if (cancelled) return;
          const oldId = (event.old as { id?: number } | null)?.id;
          if (oldId == null) return;
          setItems((prev) => prev.filter((n) => n.id !== oldId));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return items;
}
