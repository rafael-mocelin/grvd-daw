/**
 * coop-db.ts — Phase 4 coop session client wrappers + Realtime hooks.
 *
 * Architecture reference: MULTIPLAYER_PLAN.md § 5 (Coop v2) and
 * UE5_PORT_GUIDE.md (§ "Phase 4 realtime — what Unreal needs to do").
 * Server is truth for every lifecycle action — clients call RPCs that
 * enforce auth.uid() and transition status atomically.
 *
 * What's here:
 *   - RPC wrappers: create, accept, decline, join-by-code, leave.
 *   - Fetch helpers: one session by id, my pending invites,
 *     my active session (if any).
 *   - React hooks:
 *       useIncomingCoopInvites — Realtime + initial load, returns
 *         pending sessions where I'm the invited user.
 *       useCoopSession(id)     — fetches + subscribes to a single
 *         session row so UI stays in sync with server truth.
 */

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Database } from "./supabase.types";

type CoopSessionRow = Database["public"]["Tables"]["coop_sessions"]["Row"];

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type CoopStatus = "pending" | "active" | "abandoned";

export interface CoopSession {
  id:             string;
  hostId:         string;
  guestId:        string | null;
  invitedUserId:  string | null;
  joinCode:       string;
  status:         CoopStatus;
  state:          Record<string, unknown>;
  invitedAt:      string;
  acceptedAt:     string | null;
  createdAt:      string;
  updatedAt:      string;
}

export interface CreateCoopResult {
  id:       string;
  joinCode: string;
  status:   CoopStatus;
}

export interface CoopActionResult {
  success: boolean;
  message: string;
  status?: CoopStatus | null;
}

export interface JoinByCodeResult extends CoopActionResult {
  sessionId: string | null;
}

/* -------------------------------------------------------------------------- */
/* Row → client shape                                                          */
/* -------------------------------------------------------------------------- */

function rowToSession(row: CoopSessionRow): CoopSession {
  return {
    id:            row.id,
    hostId:        row.host_id,
    guestId:       row.guest_id,
    invitedUserId: row.invited_user_id,
    joinCode:      row.join_code,
    status:        row.status as CoopStatus,
    state:         (row.state as Record<string, unknown>) ?? {},
    invitedAt:     row.invited_at,
    acceptedAt:    row.accepted_at,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

/* -------------------------------------------------------------------------- */
/* RPC wrappers                                                                */
/* -------------------------------------------------------------------------- */

export async function createCoopSession(
  inviteUserId: string | null = null,
): Promise<CreateCoopResult | null> {
  const { data, error } = await supabase.rpc("create_coop_session", {
    p_invite_user_id: inviteUserId ?? undefined,
  });
  if (error) {
    console.error("[coop-db] createCoopSession:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id:       row.id,
    joinCode: row.join_code,
    status:   row.status as CoopStatus,
  };
}

export async function acceptCoopInvite(sessionId: string): Promise<CoopActionResult | null> {
  const { data, error } = await supabase.rpc("accept_coop_invite", {
    p_session_id: sessionId,
  });
  if (error) { console.error("[coop-db] acceptCoopInvite:", error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { success: row.success, message: row.message, status: row.status as CoopStatus | null } : null;
}

export async function declineCoopInvite(sessionId: string): Promise<CoopActionResult | null> {
  const { data, error } = await supabase.rpc("decline_coop_invite", {
    p_session_id: sessionId,
  });
  if (error) { console.error("[coop-db] declineCoopInvite:", error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { success: row.success, message: row.message } : null;
}

export async function joinCoopByCode(code: string): Promise<JoinByCodeResult | null> {
  const { data, error } = await supabase.rpc("join_coop_by_code", { p_code: code });
  if (error) { console.error("[coop-db] joinCoopByCode:", error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  return row
    ? {
        success:   row.success,
        message:   row.message,
        sessionId: row.session_id,
        status:    row.status as CoopStatus | null,
      }
    : null;
}

export async function leaveCoopSession(sessionId: string): Promise<CoopActionResult | null> {
  const { data, error } = await supabase.rpc("leave_coop_session", {
    p_session_id: sessionId,
  });
  if (error) { console.error("[coop-db] leaveCoopSession:", error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { success: row.success, message: row.message } : null;
}

/**
 * Phase 4.2 — shallow-merge a patch into the session's shared state.
 *
 * The patch is whatever subset of the shared state you're changing
 * (template, layers, stage, songName, etc.). Server merges via jsonb
 * `||` so only the keys you pass are touched.
 *
 * Fire-and-forget from the caller's perspective — we send the write,
 * the Realtime fanout will echo it back to every participant (including
 * you, idempotently). Callers don't need to await.
 */
export async function patchCoopState(
  sessionId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase.rpc("patch_coop_session_state", {
    p_session_id: sessionId,
    p_patch:      patch as never,
  });
  if (error) {
    console.error("[coop-db] patchCoopState:", error.message);
    return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* Fetch helpers (plain SELECTs through the participant-read RLS policy)       */
/* -------------------------------------------------------------------------- */

/**
 * Pending sessions where I'm the invited user. One-shot fetch — combine
 * with the Realtime hook below for live updates.
 */
export async function fetchIncomingCoopInvites(userId: string): Promise<CoopSession[]> {
  const { data, error } = await supabase
    .from("coop_sessions")
    .select("*")
    .eq("invited_user_id", userId)
    .eq("status", "pending")
    .order("invited_at", { ascending: false });
  if (error) {
    console.error("[coop-db] fetchIncomingCoopInvites:", error.message);
    return [];
  }
  return (data ?? []).map(rowToSession);
}

/** Your currently-active session if any (you're host OR guest, status=active). */
export async function fetchMyActiveCoopSession(userId: string): Promise<CoopSession | null> {
  const { data, error } = await supabase
    .from("coop_sessions")
    .select("*")
    .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[coop-db] fetchMyActiveCoopSession:", error.message);
    return null;
  }
  return data ? rowToSession(data) : null;
}

export async function fetchCoopSession(sessionId: string): Promise<CoopSession | null> {
  const { data, error } = await supabase
    .from("coop_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    console.error("[coop-db] fetchCoopSession:", error.message);
    return null;
  }
  return data ? rowToSession(data) : null;
}

/* -------------------------------------------------------------------------- */
/* React hooks — Realtime subscriptions                                        */
/* -------------------------------------------------------------------------- */

/**
 * Watch for incoming coop invites in real time.
 *
 * Subscribes to Postgres changes on the coop_sessions table filtered to rows
 * where invited_user_id == current user. Initial load is a one-shot fetch;
 * subsequent updates come from Realtime INSERT/UPDATE events.
 *
 * We fetch on every change event rather than patching the in-memory list —
 * coop invites are low-volume, and a refetch is simpler than reconciling
 * inserts/updates/deletes with partial row shapes from Realtime.
 */
export function useIncomingCoopInvites(userId: string | null): CoopSession[] {
  const [invites, setInvites] = useState<CoopSession[]>([]);

  useEffect(() => {
    if (!userId) { setInvites([]); return; }

    let cancelled = false;
    (async () => {
      const rows = await fetchIncomingCoopInvites(userId);
      if (!cancelled) setInvites(rows);
    })();

    const channel = supabase
      .channel(`coop-invites-${userId}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "coop_sessions",
          filter: `invited_user_id=eq.${userId}`,
        },
        async () => {
          // Refetch on any change to keep the view honest.
          const rows = await fetchIncomingCoopInvites(userId);
          if (!cancelled) setInvites(rows);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return invites;
}

/**
 * Watch a single coop session's row for changes.
 *
 * On mount: one-shot fetch + subscribe to that row's Postgres changes.
 * Any UPDATE from the server (status change, state patch, participants
 * join/leave) replaces the in-memory row. Returns null while loading, or
 * after the session is deleted/abandoned and the client unmounts.
 *
 * `onRowChange` (optional) fires synchronously whenever we get a fresh
 * row — useful for piping the shared DAW state into the Zustand store
 * from a single place (see useCoopSync in App.tsx).
 */
export function useCoopSession(
  sessionId: string | null,
  onRowChange?: (row: CoopSession | null) => void,
): CoopSession | null {
  const [session, setSession] = useState<CoopSession | null>(null);

  useEffect(() => {
    if (!sessionId) { setSession(null); return; }

    let cancelled = false;
    (async () => {
      const row = await fetchCoopSession(sessionId);
      if (!cancelled) {
        setSession(row);
        onRowChange?.(row);
      }
    })();

    const channel = supabase
      .channel(`coop-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "coop_sessions",
          filter: `id=eq.${sessionId}`,
        },
        async () => {
          // Refetch the full row on any change. Cheap for a single-row lookup
          // and avoids having to reconcile partial UPDATE payloads.
          const row = await fetchCoopSession(sessionId);
          if (!cancelled) {
            setSession(row);
            onRowChange?.(row);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return session;
}
