/**
 * Coop — Phase 4.1 session room, UI v1 game-feel rebuild.
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
import { ChunkyButton, ChunkyPill } from "../ui/Chunky";

export function Coop() {
  const userId              = useStore((s) => s.userId);
  const setStage            = useStore((s) => s.setStage);
  const activeCoopSessionId = useStore((s) => s.activeCoopSessionId);
  const setActiveCoopSession = useStore((s) => s.setActiveCoopSession);
  const sayLine             = useStore((s) => s.sayLine);

  const session = useStore((s) => s.activeCoopRow);
  const invites = useIncomingCoopInvites(userId);

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
        <div className={emptyStateCx}>loading session…</div>
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
    <div className="flex flex-col gap-4">
      <Section title="start a session" accent="text-grvd-cyan">
        <p className="font-mono text-[11px] text-white/65 leading-relaxed">
          open a room and share the code with a friend, or invite someone from
          your{" "}
          <button
            onClick={() => setStage("friends")}
            className="text-grvd-cyan underline underline-offset-2"
          >
            friends list
          </button>.
        </p>
        <ChunkyButton
          variant="cyan"
          size="md"
          icon="🎛️"
          onClick={onCreate}
          disabled={creating}
        >
          {creating ? "opening…" : "create a room"}
        </ChunkyButton>
      </Section>

      <Section title="or join by code" accent="text-grvd-purple">
        <div className="flex gap-2">
          <input
            type="text"
            value={joiningCode}
            onChange={(e) => setJoiningCode(e.target.value.toUpperCase())}
            placeholder="paste 6-char code"
            maxLength={6}
            className="flex-1 px-3 py-2.5 rounded-2xl bg-grvd-base/60 border-2 border-grvd-purple/30 text-white font-mono text-base tracking-[0.25em] uppercase outline-none focus:border-grvd-purple/70 focus:bg-grvd-base/80 transition-colors shadow-chunky-press"
          />
          <ChunkyButton
            variant="purple"
            size="md"
            onClick={onJoin}
            disabled={joining || joiningCode.trim().length === 0}
          >
            {joining ? "…" : "join"}
          </ChunkyButton>
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
    <Section title={`invites · ${invites.length}`} accent="text-grvd-gold">
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
    <div className={rowCx}>
      <span className={avatarCx}>{hostProfile?.avatar ?? "👤"}</span>
      <div className="flex-1 min-w-0">
        <div className="font-display text-base text-white truncate">
          {hostProfile?.username ?? "…"}
        </div>
        <div className="font-mono text-[10px] text-white/55">
          wants to cook with you
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <ChunkyPill variant="claim" size="sm" onClick={onAccept}>join</ChunkyPill>
        <ChunkyPill variant="ghost" size="sm" onClick={onDecline}>decline</ChunkyPill>
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

  // Status colors mapped to GRVD palette tokens.
  const statusMeta = (() => {
    switch (session.status) {
      case "pending":
        return {
          label: "waiting for your friend",
          gradient: "from-grvd-gold/20 to-black/40",
          border:   "border-grvd-gold/45",
          glow:     "shadow-glow-gold",
          accent:   "text-grvd-gold",
        };
      case "active":
        return {
          label: "live · both here",
          gradient: "from-grvd-lime/20 to-black/40",
          border:   "border-grvd-lime/45",
          glow:     "shadow-[0_0_24px_rgba(74,222,128,0.25)]",
          accent:   "text-grvd-lime",
        };
      default:
        return {
          label: "session ended",
          gradient: "from-white/10 to-black/40",
          border:   "border-white/15",
          glow:     "",
          accent:   "text-white/55",
        };
    }
  })();

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(session.joinCode);
      useStore.getState().sayLine(`code ${session.joinCode} copied`, 2000);
    } catch { /* clipboard API may be blocked; swallow */ }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Status + code header */}
      <div
        className={[
          "rounded-3xl p-4",
          "bg-gradient-to-br", statusMeta.gradient,
          "border-2", statusMeta.border,
          statusMeta.glow,
          "shadow-chunky-press",
        ].join(" ")}
      >
        <div className={`font-mono text-[9px] font-bold tracking-[0.22em] uppercase ${statusMeta.accent}`}>
          🎛️ coop room
        </div>
        <div className="font-display text-2xl text-white leading-tight mt-1">
          {statusMeta.label}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-white/55">
            code
          </span>
          <button
            onClick={copyCode}
            title="copy code to clipboard"
            className="font-mono text-xl font-black tracking-[0.3em] text-white bg-black/40 border border-white/12 rounded-xl px-3 py-1 shadow-chunky-press active:scale-95 transition-transform"
          >
            {session.joinCode}
          </button>
        </div>
      </div>

      {/* Seats */}
      <Section title="seats" accent="text-grvd-cyan">
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
          <div className={emptyStateCx}>
            share the code above or invite a friend from the friends list.
          </div>
        )}
      </Section>

      {/* Hero start CTA when both seats are filled */}
      {session.status === "active" && session.guestId && (
        <ChunkyButton
          variant="hero"
          size="lg"
          icon="🎛️"
          onClick={() => useStore.getState().setStage("template")}
          className="w-full"
        >
          start cooking together
        </ChunkyButton>
      )}

      {session.status === "active" && !session.guestId && (
        <div className="rounded-2xl border border-dashed border-white/12 px-4 py-6 text-center font-mono text-[11px] text-white/45 leading-relaxed">
          waiting for your friend to join · share the code above
        </div>
      )}

      <ChunkyPill variant="magenta" size="md" onClick={onLeave} className="self-end">
        leave room
      </ChunkyPill>
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
    <div className={rowCx}>
      <span
        className={avatarCx}
        style={{
          opacity: present ? 1 : 0.45,
          filter:  present ? "none" : "grayscale(0.6)",
        }}
      >
        {profile?.avatar ?? "👤"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-display text-base text-white truncate">
          {profile?.username ?? "…"}
        </div>
        <div className="font-mono text-[10px] text-white/55">
          {label}
        </div>
      </div>
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          background: present ? "#4ade80" : "rgba(255,255,255,0.2)",
          boxShadow:  present ? "0 0 6px #4ade80" : "none",
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
    <div className="pt-3 pb-20 flex flex-col gap-4">
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="font-mono text-[9px] font-bold tracking-[0.22em] uppercase text-grvd-cyan">
            🎛️ coop
          </div>
          <div className="font-display text-3xl text-white leading-tight mt-1">
            cook together
          </div>
        </div>
        <ChunkyPill variant="ghost" size="sm" icon="←" onClick={onBack}>
          back
        </ChunkyPill>
      </div>
      {children}
    </div>
  );
}

function Section({
  title, accent, children,
}: {
  title: string;
  /** Tailwind text-* class for the section eyebrow. */
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`font-mono text-[9px] font-bold tracking-[0.22em] uppercase ${accent}`}>
        {title}
      </div>
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}

const rowCx = [
  "flex items-center gap-3 px-3 py-2.5",
  "rounded-2xl border border-white/8 bg-white/3",
  "shadow-chunky-press",
].join(" ");

const avatarCx = [
  "w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0",
  "bg-grvd-purple/15 border-2 border-grvd-purple/30",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
].join(" ");

const emptyStateCx = [
  "rounded-2xl border border-dashed border-white/12",
  "px-4 py-4 text-center",
  "font-mono text-[11px] text-white/45",
].join(" ");
