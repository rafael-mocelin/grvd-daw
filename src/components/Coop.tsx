/**
 * Coop — Phase 4.1 session room.
 *
 * Three modes, dispatched on store.activeCoopSessionId + auth state:
 *
 *  1. NO SESSION     → two-option landing:
 *                        • create a session + share a code / invite a friend
 *                        • paste a code to join an existing one
 *  2. IN A SESSION   → room view showing participants, join code,
 *                      pending/active status, leave button. Live-updated
 *                      via Supabase Realtime through useCoopSession.
 *  3. LOADING        → while the session id is set but the row hasn't
 *                      come back yet.
 *
 * Incoming invites surface as an accept/decline row at the top whether or
 * not you're already in a session.
 *
 * Phase 4.2 will expand this screen to host the shared DAW state. Right
 * now we're shipping the social plumbing only — "being in a session" is
 * a place you can be, not yet a place you can co-create.
 */

import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import {
  createCoopSession,
  acceptCoopInvite,
  declineCoopInvite,
  joinCoopByCode,
  leaveCoopSession,
  useIncomingCoopInvites,
  type CoopSession,
} from "../lib/coop-db";
import { fetchProfileById, type PublicProfile } from "../lib/social-db";
import { useCoopPresence } from "../lib/coop-presence";

export function Coop() {
  const userId              = useStore((s) => s.userId);
  const setStage            = useStore((s) => s.setStage);
  const activeCoopSessionId = useStore((s) => s.activeCoopSessionId);
  const setActiveCoopSession = useStore((s) => s.setActiveCoopSession);
  const sayLine             = useStore((s) => s.sayLine);

  // Single subscription lives at AppCore (see useCoopSession call there);
  // we read the cached row from the store. Avoids opening a duplicate
  // Realtime channel just because this screen is mounted.
  const session = useStore((s) => s.activeCoopRow);
  const invites = useIncomingCoopInvites(userId);

  // If the active session transitions to "abandoned" (partner leaves), bail.
  useEffect(() => {
    if (session?.status === "abandoned") {
      sayLine("session ended", 2200);
      setActiveCoopSession(null);
    }
  }, [session?.status, sayLine, setActiveCoopSession]);

  return (
    <Wrapper onBack={() => setStage("home")}>
      {invites.length > 0 && (
        <IncomingInvites
          invites={invites}
          onJoined={(sid) => setActiveCoopSession(sid)}
        />
      )}

      {activeCoopSessionId && !session && (
        <div style={emptyState}>loading session…</div>
      )}

      {activeCoopSessionId && session && (
        <SessionRoom
          session={session}
          onLeave={async () => {
            const r = await leaveCoopSession(session.id);
            if (r?.success) {
              sayLine("left the room", 2000);
              setActiveCoopSession(null);
            } else {
              sayLine(r?.message ?? "couldn't leave", 2200);
            }
          }}
        />
      )}

      {!activeCoopSessionId && <CoopLanding />}
    </Wrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* Landing — not yet in a session                                              */
/* -------------------------------------------------------------------------- */

function CoopLanding() {
  const sayLine              = useStore((s) => s.sayLine);
  const setActiveCoopSession = useStore((s) => s.setActiveCoopSession);
  const setStage             = useStore((s) => s.setStage);

  const [creating, setCreating]       = useState(false);
  const [joiningCode, setJoiningCode] = useState("");
  const [joining, setJoining]         = useState(false);

  async function onCreate() {
    setCreating(true);
    const r = await createCoopSession(null);
    setCreating(false);
    if (!r) { sayLine("couldn't create the session", 2400); return; }
    setActiveCoopSession(r.id);
    sayLine(`room open · code ${r.joinCode}`, 3000);
  }

  async function onJoin() {
    const code = joiningCode.trim();
    if (code.length === 0) return;
    setJoining(true);
    const r = await joinCoopByCode(code);
    setJoining(false);
    if (!r || !r.success) { sayLine(r?.message ?? "couldn't join", 2400); return; }
    if (r.sessionId) setActiveCoopSession(r.sessionId);
    sayLine("joined the room", 2200);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Section title="start a session" accent="#22d3ee">
        <p style={bodyText}>
          open a room and share the code with a friend, or invite someone from
          your <button onClick={() => setStage("friends")} style={inlineLinkBtn}>friends list</button>.
        </p>
        <button
          onClick={onCreate}
          disabled={creating}
          style={{
            ...primaryCtaBtn,
            background: creating
              ? "rgba(34,211,238,0.2)"
              : "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
          }}
        >
          {creating ? "opening…" : "🎛️ create a room"}
        </button>
      </Section>

      <Section title="or join by code" accent="#a78bfa">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={joiningCode}
            onChange={(e) => setJoiningCode(e.target.value.toUpperCase())}
            placeholder="paste 6-char code"
            maxLength={6}
            style={codeInput}
          />
          <button
            onClick={onJoin}
            disabled={joining || joiningCode.trim().length === 0}
            style={{
              ...secondaryCtaBtn,
              opacity: joining || joiningCode.trim().length === 0 ? 0.5 : 1,
            }}
          >
            {joining ? "joining…" : "join"}
          </button>
        </div>
      </Section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Incoming invites                                                            */
/* -------------------------------------------------------------------------- */

function IncomingInvites({
  invites, onJoined,
}: {
  invites: CoopSession[];
  onJoined: (sessionId: string | null) => void;
}) {
  const sayLine = useStore((s) => s.sayLine);

  return (
    <Section title={`invites · ${invites.length}`} accent="#facc15">
      {invites.map((inv) => (
        <InviteRow
          key={inv.id}
          session={inv}
          onAccept={async () => {
            const r = await acceptCoopInvite(inv.id);
            if (r?.success) {
              sayLine("joined the room", 2000);
              onJoined(inv.id);
            } else {
              sayLine(r?.message ?? "couldn't accept", 2400);
            }
          }}
          onDecline={async () => {
            const r = await declineCoopInvite(inv.id);
            if (r?.success) sayLine("declined", 1800);
          }}
        />
      ))}
    </Section>
  );
}

function InviteRow({
  session, onAccept, onDecline,
}: {
  session: CoopSession;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [hostProfile, setHostProfile] = useState<PublicProfile | null>(null);
  useEffect(() => {
    fetchProfileById(session.hostId).then(setHostProfile);
  }, [session.hostId]);

  return (
    <div style={rowStyle}>
      <span style={avatarSlot}>{hostProfile?.avatar ?? "👤"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowTitle}>{hostProfile?.username ?? "…"}</div>
        <div style={rowSub}>wants to cook with you</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <InlineBtn label="join"    accent="#4ade80" onClick={onAccept} />
        <InlineBtn label="decline" accent="rgba(255,255,255,0.35)" onClick={onDecline} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Session room — you're in a session                                          */
/* -------------------------------------------------------------------------- */

function SessionRoom({
  session, onLeave,
}: {
  session: CoopSession;
  onLeave: () => void;
}) {
  const userId = useStore((s) => s.userId);

  // Presence channel — tells us who's ACTUALLY live in the room right now
  // (vs what the DB status says). The two diverge when someone closes
  // their tab without calling leave_coop_session.
  const presence = useCoopPresence(session.id, userId);

  const [hostProfile, setHostProfile]         = useState<PublicProfile | null>(null);
  const [guestProfile, setGuestProfile]       = useState<PublicProfile | null>(null);
  const [invitedProfile, setInvitedProfile]   = useState<PublicProfile | null>(null);

  useEffect(() => {
    fetchProfileById(session.hostId).then(setHostProfile);
    if (session.guestId) fetchProfileById(session.guestId).then(setGuestProfile);
    else setGuestProfile(null);
    if (session.invitedUserId && session.invitedUserId !== session.guestId) {
      fetchProfileById(session.invitedUserId).then(setInvitedProfile);
    } else {
      setInvitedProfile(null);
    }
  }, [session.hostId, session.guestId, session.invitedUserId]);

  const iAmHost = userId === session.hostId;
  const statusLabel =
    session.status === "pending" ? "waiting for your friend" :
    session.status === "active"  ? "live · both here" :
                                   "session ended";
  const statusAccent =
    session.status === "pending" ? "#facc15" :
    session.status === "active"  ? "#4ade80" :
                                   "rgba(255,255,255,0.35)";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(session.joinCode);
      useStore.getState().sayLine(`code ${session.joinCode} copied`, 2000);
    } catch { /* clipboard API may be blocked; swallow */ }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Status + code header */}
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: `linear-gradient(135deg, ${statusAccent}22 0%, rgba(0,0,0,0.45) 100%)`,
          border: `1px solid ${statusAccent}55`,
          boxShadow: `0 0 16px ${statusAccent}22`,
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: statusAccent,
          }}
        >
          🎛️ coop room
        </div>
        <div
          style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: 20,
            fontWeight: 800,
            color: "#fff",
            marginTop: 2,
          }}
        >
          {statusLabel}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            code
          </span>
          <button
            onClick={copyCode}
            title="copy code to clipboard"
            style={{
              fontFamily: "monospace",
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: "0.3em",
              color: "#fff",
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "4px 12px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {session.joinCode}
          </button>
        </div>
      </div>

      {/* Seats — presence dots reflect ACTUAL channel liveness, not just
       * the DB status. Your own seat is always "present" (the tab running
       * this code); peers are "present" only if their presence entry is
       * in the channel. */}
      <Section title="seats" accent="#22d3ee">
        <SeatRow
          label={iAmHost ? "you (host)" : "host"}
          profile={hostProfile}
          present={iAmHost ? true : session.hostId in presence}
        />
        {session.guestId && (
          <SeatRow
            label={!iAmHost ? "you" : "guest"}
            profile={guestProfile}
            present={!iAmHost ? true : session.guestId in presence}
          />
        )}
        {!session.guestId && invitedProfile && (
          <SeatRow
            label="invited"
            profile={invitedProfile}
            present={false}
          />
        )}
        {!session.guestId && !invitedProfile && (
          <div style={{ ...emptyState, padding: 12 }}>
            share the code above or invite a friend from the friends list.
          </div>
        )}
      </Section>

      {/* Phase 4.2 hero action — start the shared DAW once both seats are in.
       * Tapping sets stage='template' on the shared state, which propagates
       * via Realtime so both clients navigate to the picker together. */}
      {session.status === "active" && session.guestId && (
        <button
          onClick={() => useStore.getState().setStage("template")}
          style={{
            ...primaryCtaBtn,
            background: "linear-gradient(135deg, #ff4d6d 0%, #facc15 100%)",
            border: "1px solid rgba(255,77,109,0.7)",
            boxShadow: "0 0 18px rgba(255,77,109,0.35)",
          }}
        >
          🎛️ start cooking together
        </button>
      )}

      {session.status === "active" && !session.guestId && (
        <div style={placeholder}>
          waiting for your friend to join · share the code above
        </div>
      )}

      <button onClick={onLeave} style={dangerBtn}>
        leave room
      </button>
    </div>
  );
}

function SeatRow({
  label, profile, present,
}: {
  label: string;
  profile: PublicProfile | null;
  present: boolean;
}) {
  return (
    <div style={rowStyle}>
      <span style={{
        ...avatarSlot,
        opacity: present ? 1 : 0.45,
        filter: present ? "none" : "grayscale(0.6)",
      }}>
        {profile?.avatar ?? "👤"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowTitle}>{profile?.username ?? "…"}</div>
        <div style={rowSub}>{label}</div>
      </div>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: present ? "#4ade80" : "rgba(255,255,255,0.2)",
          boxShadow: present ? "0 0 6px #4ade80" : "none",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout primitives                                                           */
/* -------------------------------------------------------------------------- */

function Wrapper({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div
      style={{
        padding: "34px 14px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: 520,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#22d3ee",
            }}
          >
            🎛️ coop
          </div>
          <div
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 800,
              color: "#fff",
              marginTop: 2,
            }}
          >
            cook together
          </div>
        </div>
        <button
          onClick={onBack}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.7)",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "6px 10px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          ← back
        </button>
      </div>
      {children}
    </div>
  );
}

function Section({
  title, accent, children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: accent,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function InlineBtn({ label, accent, onClick }: { label: string; accent: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 10px",
        background: `${accent}22`,
        border: `1px solid ${accent}66`,
        color: accent,
        fontFamily: "monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 10,
};

const avatarSlot: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 17,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  flexShrink: 0,
};

const rowTitle: React.CSSProperties = {
  fontFamily: "'Space Grotesk', system-ui, sans-serif",
  fontSize: 13,
  fontWeight: 700,
  color: "#fff",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rowSub: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 10,
  color: "rgba(255,255,255,0.5)",
};

const bodyText: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 11,
  color: "rgba(255,255,255,0.6)",
  lineHeight: 1.5,
  margin: 0,
};

const primaryCtaBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(34,211,238,0.6)",
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
  boxShadow: "0 0 12px rgba(34,211,238,0.25)",
};

const secondaryCtaBtn: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(167,139,250,0.2)",
  border: "1px solid rgba(167,139,250,0.5)",
  color: "#a78bfa",
  fontFamily: "monospace",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderRadius: 10,
  cursor: "pointer",
};

const codeInput: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  background: "rgba(0,0,0,0.4)",
  border: "1px solid rgba(167,139,250,0.3)",
  borderRadius: 10,
  color: "#fff",
  fontFamily: "monospace",
  fontSize: 14,
  letterSpacing: "0.25em",
  textTransform: "uppercase",
  outline: "none",
};

const inlineLinkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#22d3ee",
  cursor: "pointer",
  textDecoration: "underline",
  fontFamily: "monospace",
  fontSize: 11,
};

const dangerBtn: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(255,77,109,0.15)",
  border: "1px solid rgba(255,77,109,0.5)",
  color: "#ff4d6d",
  fontFamily: "monospace",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderRadius: 10,
  cursor: "pointer",
  marginTop: 6,
};

const placeholder: React.CSSProperties = {
  padding: "28px 16px",
  textAlign: "center",
  fontFamily: "monospace",
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  lineHeight: 1.5,
  border: "1px dashed rgba(255,255,255,0.1)",
  borderRadius: 12,
};

const emptyState: React.CSSProperties = {
  padding: "16px 14px",
  textAlign: "center",
  fontFamily: "monospace",
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  border: "1px dashed rgba(255,255,255,0.1)",
  borderRadius: 10,
};
