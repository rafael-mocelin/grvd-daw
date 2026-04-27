/**
 * NotificationToasts — Phase 6 stacked toast overlay.
 *
 * Mounted at AppCore. Subscribes to the current user's unseen
 * notifications via Realtime and pops them as cards in the top-right.
 *
 * Card behavior:
 *   - Auto-dismiss after AUTO_MS (passive notifications) — server trigger
 *     marks the row read on dismiss.
 *   - Click anywhere on the card to dismiss.
 *   - Interactive cards (friend_request_received, coop_invite_received)
 *     stay open until the user hits accept/decline; those buttons fire
 *     the same RPCs as the Friends / Coop screens.
 *
 * Visual is intentionally plain — chunkier game-feel polish is Phase 6+
 * design work. For now: dark card, accent color stripe, avatar + line +
 * optional buttons.
 */

import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import {
  useUnseenNotifications,
  markNotificationsSeen,
  deleteNotification,
  type Notification,
} from "../lib/notifications";
import {
  acceptCoopInvite,
  declineCoopInvite,
} from "../lib/coop-db";
import {
  respondFriendRequest,
} from "../lib/social-db";

/** How long passive toasts stay on screen before auto-dismiss. */
const AUTO_MS = 6000;

export function NotificationToasts() {
  const userId = useStore((s) => s.userId);
  const items  = useUnseenNotifications(userId);

  // Track local "dismissed" set so a card can fade out instantly on
  // click before the DB update propagates back via Realtime.
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  function dismissOne(id: number) {
    setDismissed((s) => new Set(s).add(id));
    // Mark seen + delete (delete keeps the table tidy and prevents
    // the client refetching the same toast on next mount).
    void deleteNotification(id);
  }

  const visible = items.filter((n) => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  return (
    <div
      style={{
        position:      "fixed",
        top:           14,
        right:         14,
        display:       "flex",
        flexDirection: "column",
        gap:           8,
        zIndex:        9700,
        pointerEvents: "auto",
        // Cap visible stack height; older toasts scroll off
        maxHeight:     "calc(100vh - 28px)",
        overflow:      "hidden",
      }}
    >
      {visible.slice(0, 5).map((n) => (
        <ToastCard key={n.id} n={n} onDismiss={() => dismissOne(n.id)} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

function ToastCard({ n, onDismiss }: { n: Notification; onDismiss: () => void }) {
  const sayLine = useStore((s) => s.sayLine);
  const setActiveCoopSession = useStore((s) => s.setActiveCoopSession);
  const setStage = useStore((s) => s.setStage);
  const openProfile = useStore((s) => s.openProfile);

  const interactive =
    n.kind === "friend_request_received" || n.kind === "coop_invite_received";

  // Mark seen on mount so it doesn't refetch; deletion happens on dismiss.
  useEffect(() => {
    void markNotificationsSeen([n.id]);
  }, [n.id]);

  // Auto-dismiss for non-interactive toasts after AUTO_MS.
  useEffect(() => {
    if (interactive) return;
    const t = window.setTimeout(onDismiss, AUTO_MS);
    return () => window.clearTimeout(t);
  }, [interactive, onDismiss]);

  // ── Per-kind content + accent color ──
  let avatar = "👤";
  let title  = "";
  let body   = "";
  let accent = "#22d3ee";
  let onPrimary: (() => void) | null = null;
  let primaryLabel = "";
  let onSecondary: (() => void) | null = null;
  let secondaryLabel = "";
  // Tap-the-card-itself shortcut for non-action notifications:
  let bodyOnTap: (() => void) | null = null;

  switch (n.payload.kind) {
    case "endorsement_received": {
      const p = n.payload;
      avatar = p.fan_avatar;
      title  = `${p.fan_username} pushed your drop`;
      body   = `${p.song_title}`;
      accent = "#ff4d6d";
      bodyOnTap = () => openProfile(p.fan_id);
      break;
    }
    case "friend_request_received": {
      const p = n.payload;
      avatar = p.requester_avatar;
      title  = `${p.requester_username} wants to be friends`;
      body   = "";
      accent = "#facc15";
      onPrimary = async () => {
        const r = await respondFriendRequest(p.requester_id, true);
        sayLine(r?.success ? `added ${p.requester_username}` : (r?.message ?? "couldn't accept"), 2200);
        onDismiss();
      };
      primaryLabel = "accept";
      onSecondary = async () => {
        await respondFriendRequest(p.requester_id, false);
        sayLine("declined", 1800);
        onDismiss();
      };
      secondaryLabel = "decline";
      break;
    }
    case "friend_request_accepted": {
      const p = n.payload;
      avatar = p.accepter_avatar;
      title  = `${p.accepter_username} accepted your request`;
      body   = "you're friends now";
      accent = "#4ade80";
      bodyOnTap = () => openProfile(p.accepter_id);
      break;
    }
    case "coop_invite_received": {
      const p = n.payload;
      avatar = p.host_avatar;
      title  = `${p.host_username} invited you to cook`;
      body   = `code · ${p.join_code}`;
      accent = "#22d3ee";
      onPrimary = async () => {
        const r = await acceptCoopInvite(p.session_id);
        if (r?.success) {
          setActiveCoopSession(p.session_id);
          setStage("coop");
          sayLine("joined the room", 2000);
        } else {
          sayLine(r?.message ?? "couldn't accept", 2400);
        }
        onDismiss();
      };
      primaryLabel = "join";
      onSecondary = async () => {
        await declineCoopInvite(p.session_id);
        sayLine("declined", 1800);
        onDismiss();
      };
      secondaryLabel = "decline";
      break;
    }
    case "early_ear_bonus_awarded": {
      const p = n.payload;
      avatar = "★";
      title  = "early-ear hit!";
      body   = `+${p.xp_delta} XP from ${p.song_title}`;
      accent = "#facc15";
      break;
    }
    case "artist_boost_received": {
      const p = n.payload;
      avatar = "🔥";
      title  = `${p.song_title} got pushed`;
      body   = `+${p.energy_delta}⚡ for you`;
      accent = "#ff4d6d";
      break;
    }
    case "early_claim_bonus_awarded": {
      const p = n.payload;
      avatar = "💿";
      title  = p.role === "producer" ? "your drop hit a milestone!" : "early ear paid off!";
      body   = p.role === "producer"
        ? `+${p.bonus_xp} XP · ${p.total_claims} claims and counting`
        : `+${p.bonus_xp} XP · you were one of the first to claim`;
      accent = "#a78bfa";
      break;
    }
  }

  return (
    <div
      style={{
        width:         300,
        minHeight:     56,
        background:    "linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(20,20,28,0.95) 100%)",
        border:        `1px solid ${accent}55`,
        borderLeft:    `3px solid ${accent}`,
        borderRadius:  10,
        boxShadow:     `0 8px 22px rgba(0,0,0,0.5), 0 0 14px ${accent}22`,
        padding:       "10px 12px",
        display:       "flex",
        gap:           10,
        alignItems:    "center",
        cursor:        interactive ? "default" : "pointer",
        animation:     "toast-slide-in 240ms cubic-bezier(.22,.94,.46,1)",
      }}
      onClick={() => {
        if (interactive) return;
        if (bodyOnTap) bodyOnTap();
        onDismiss();
      }}
    >
      <style>{`
        @keyframes toast-slide-in {
          from { transform: translateX(28px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
      <span
        style={{
          width:          36,
          height:         36,
          borderRadius:   18,
          background:     `${accent}22`,
          border:         `1px solid ${accent}55`,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontSize:       18,
          flexShrink:     0,
        }}
      >
        {avatar}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily:   "'Space Grotesk', system-ui, sans-serif",
            fontSize:     12,
            fontWeight:   700,
            color:        "#fff",
            whiteSpace:   "nowrap",
            overflow:     "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        {body && (
          <div
            style={{
              fontFamily:   "monospace",
              fontSize:     10,
              color:        "rgba(255,255,255,0.55)",
              marginTop:    2,
              whiteSpace:   "nowrap",
              overflow:     "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {body}
          </div>
        )}
        {interactive && (onPrimary || onSecondary) && (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            {onPrimary && (
              <button
                onClick={(e) => { e.stopPropagation(); onPrimary?.(); }}
                style={{
                  padding:        "4px 8px",
                  background:     accent,
                  border:         "none",
                  color:          "rgba(0,0,0,0.85)",
                  fontFamily:     "monospace",
                  fontSize:       10,
                  fontWeight:     800,
                  letterSpacing:  "0.08em",
                  textTransform:  "uppercase",
                  borderRadius:   5,
                  cursor:         "pointer",
                }}
              >
                {primaryLabel}
              </button>
            )}
            {onSecondary && (
              <button
                onClick={(e) => { e.stopPropagation(); onSecondary?.(); }}
                style={{
                  padding:        "4px 8px",
                  background:     "rgba(255,255,255,0.06)",
                  border:         "1px solid rgba(255,255,255,0.18)",
                  color:          "rgba(255,255,255,0.7)",
                  fontFamily:     "monospace",
                  fontSize:       10,
                  fontWeight:     700,
                  letterSpacing:  "0.06em",
                  textTransform:  "uppercase",
                  borderRadius:   5,
                  cursor:         "pointer",
                }}
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
