/**
 * Friends — Phase 3C friends list, search, and pending-request UX.
 *
 * Three sections:
 *   1. Accepted friends — your mutual-consent connections.
 *   2. Pending requests — split into INCOMING (someone asked you) and
 *      OUTGOING (you asked someone, waiting for reply). Each row has
 *      the action buttons appropriate to the direction.
 *   3. Search — type a username prefix to find new friends to add.
 *
 * Design decisions worth noting:
 *   - We treat friends as a superset of the current user's "social layer"
 *     signal. The `my_friends` view returns every row I'm part of, so we
 *     partition client-side by status + who initiated.
 *   - Every row links to the other user's ArtistProfile so friends double
 *     as a quick jump-to-someone's-drops list.
 *   - Username search uses ILIKE prefix (case-insensitive); excludes the
 *     caller so you don't accidentally try to friend yourself.
 *   - Notifications for incoming requests are out of scope here and
 *     tracked under Phase 6 in MULTIPLAYER_PLAN.md; for now you just see
 *     them when you open this screen.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import {
  fetchMyFriends,
  fetchProfileById,
  searchProfilesByUsername,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  type FriendRow,
  type PublicProfile,
} from "../lib/social-db";
import { createCoopSession } from "../lib/coop-db";
import { ChunkyButton, ChunkyPill } from "../ui/Chunky";

/* -------------------------------------------------------------------------- */
/* Root                                                                        */
/* -------------------------------------------------------------------------- */

export function Friends() {
  const userId      = useStore((s) => s.userId);
  const setStage             = useStore((s) => s.setStage);
  const openProfile          = useStore((s) => s.openProfile);
  const setActiveCoopSession = useStore((s) => s.setActiveCoopSession);
  const sayLine     = useStore((s) => s.sayLine);

  const [rows, setRows] = useState<FriendRow[] | null>(null);
  // Cache of profile lookups keyed by uid so we don't refetch.
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PublicProfile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // uid whose button is in-flight

  /* ── Load friend rows on mount ─────────────────────────── */
  const reload = useCallback(async () => {
    const list = await fetchMyFriends();
    setRows(list);
    // Prefetch profiles for every counterpart so the list renders
    // usernames/avatars immediately without per-row waterfalls.
    const missing = list.map((r) => r.friendUserId).filter((id) => !profiles[id]);
    if (missing.length > 0) {
      const fetched = await Promise.all(missing.map((id) => fetchProfileById(id)));
      setProfiles((p) => {
        const next = { ...p };
        fetched.forEach((prof, i) => {
          if (prof) next[missing[i]] = prof;
        });
        return next;
      });
    }
  }, [profiles]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Search: debounce on typing ─────────────────────────── */
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length === 0) { setSearchResults(null); return; }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const results = await searchProfilesByUsername(trimmed, userId);
      if (!cancelled) setSearchResults(results);
    }, 220);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [search, userId]);

  /* ── Partition rows by status + direction ───────────────── */
  const { accepted, incoming, outgoing } = useMemo(() => {
    const a: FriendRow[] = [];
    const i: FriendRow[] = [];
    const o: FriendRow[] = [];
    for (const r of rows ?? []) {
      if (r.status === "accepted") a.push(r);
      else if (r.status === "pending") {
        if (r.requestedBy === userId) o.push(r);
        else i.push(r);
      }
    }
    return { accepted: a, incoming: i, outgoing: o };
  }, [rows, userId]);

  /* ── Action handlers ────────────────────────────────────── */
  async function onSend(otherId: string, otherName: string) {
    setBusy(otherId);
    const r = await sendFriendRequest(otherId);
    if (r?.success) {
      sayLine(
        r.status === "accepted"
          ? `you and ${otherName} are friends now`
          : `request sent to ${otherName}`,
        2400,
      );
      await reload();
    } else {
      sayLine(r?.message ?? "couldn't send", 2400);
    }
    setBusy(null);
  }

  async function onRespond(otherId: string, accept: boolean, otherName: string) {
    setBusy(otherId);
    const r = await respondFriendRequest(otherId, accept);
    if (r?.success) {
      sayLine(
        accept ? `added ${otherName}` : `declined ${otherName}`,
        2200,
      );
      await reload();
    } else {
      sayLine(r?.message ?? "couldn't respond", 2400);
    }
    setBusy(null);
  }

  async function onRemove(otherId: string, otherName: string) {
    setBusy(otherId);
    const r = await removeFriend(otherId);
    if (r?.success) {
      sayLine(`removed ${otherName}`, 2200);
      await reload();
    } else {
      sayLine(r?.message ?? "couldn't remove", 2400);
    }
    setBusy(null);
  }

  async function onInviteToCoop(otherId: string, otherName: string) {
    setBusy(otherId);
    const r = await createCoopSession(otherId);
    setBusy(null);
    if (!r) { sayLine("couldn't open the room", 2400); return; }
    setActiveCoopSession(r.id);
    sayLine(`invited ${otherName} to cook`, 2400);
    setStage("coop");
  }

  /* ── Helpers ────────────────────────────────────────────── */
  const knownIds = useMemo(() => new Set((rows ?? []).map((r) => r.friendUserId)), [rows]);

  return (
    <Wrapper onBack={() => setStage("home")}>
      <Header />

      {/* Incoming pending */}
      {incoming.length > 0 && (
        <Section title={`incoming · ${incoming.length}`} accent="text-grvd-gold">
          {incoming.map((r) => {
            const p = profiles[r.friendUserId];
            return (
              <FriendRowView
                key={r.friendUserId}
                profile={p ?? anonFallback(r.friendUserId)}
                onOpen={() => openProfile(r.friendUserId)}
                action={
                  <div className="flex gap-1.5">
                    <ChunkyPill
                      variant="claim"
                      size="sm"
                      onClick={() => onRespond(r.friendUserId, true, p?.username ?? "them")}
                      disabled={busy === r.friendUserId}
                    >
                      accept
                    </ChunkyPill>
                    <ChunkyPill
                      variant="ghost"
                      size="sm"
                      onClick={() => onRespond(r.friendUserId, false, p?.username ?? "them")}
                      disabled={busy === r.friendUserId}
                    >
                      skip
                    </ChunkyPill>
                  </div>
                }
              />
            );
          })}
        </Section>
      )}

      {/* Accepted */}
      <Section title={`friends · ${accepted.length}`} accent="text-grvd-cyan">
        {accepted.length === 0 ? (
          <div className={emptyStateCx}>
            no friends yet — search below or visit an artist's profile to follow them.
          </div>
        ) : (
          accepted.map((r) => {
            const p = profiles[r.friendUserId];
            return (
              <FriendRowView
                key={r.friendUserId}
                profile={p ?? anonFallback(r.friendUserId)}
                onOpen={() => openProfile(r.friendUserId)}
                action={
                  <div className="flex gap-1.5">
                    <ChunkyPill
                      variant="cyan"
                      size="sm"
                      icon="🎛️"
                      onClick={() => onInviteToCoop(r.friendUserId, p?.username ?? "them")}
                      disabled={busy === r.friendUserId}
                    >
                      coop
                    </ChunkyPill>
                    <ChunkyPill
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(r.friendUserId, p?.username ?? "them")}
                      disabled={busy === r.friendUserId}
                    >
                      remove
                    </ChunkyPill>
                  </div>
                }
              />
            );
          })
        )}
      </Section>

      {/* Outgoing pending */}
      {outgoing.length > 0 && (
        <Section title={`awaiting · ${outgoing.length}`} accent="text-white/55">
          {outgoing.map((r) => {
            const p = profiles[r.friendUserId];
            return (
              <FriendRowView
                key={r.friendUserId}
                profile={p ?? anonFallback(r.friendUserId)}
                onOpen={() => openProfile(r.friendUserId)}
                action={
                  <ChunkyPill
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(r.friendUserId, p?.username ?? "them")}
                    disabled={busy === r.friendUserId}
                  >
                    cancel
                  </ChunkyPill>
                }
              />
            );
          })}
        </Section>
      )}

      {/* Search */}
      <Section title="find someone" accent="text-grvd-purple">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="username prefix…"
          className="w-full px-4 py-2.5 rounded-2xl bg-grvd-base/60 border-2 border-grvd-purple/30 text-white font-mono text-sm outline-none focus:border-grvd-purple/70 focus:bg-grvd-base/80 transition-colors shadow-chunky-press"
        />
        {searchResults !== null && searchResults.length === 0 && (
          <div className={`${emptyStateCx} mt-2`}>no matches.</div>
        )}
        {searchResults !== null && searchResults.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {searchResults.map((p) => {
              const already = knownIds.has(p.id);
              return (
                <FriendRowView
                  key={p.id}
                  profile={p}
                  onOpen={() => openProfile(p.id)}
                  action={
                    already ? (
                      <span className="font-mono text-[10px] text-white/40 px-2 py-1">
                        already in your list
                      </span>
                    ) : (
                      <ChunkyButton
                        variant="cyan"
                        size="sm"
                        icon="+"
                        onClick={() => onSend(p.id, p.username)}
                        disabled={busy === p.id}
                      >
                        add
                      </ChunkyButton>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </Section>
    </Wrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* Subcomponents                                                               */
/* -------------------------------------------------------------------------- */

function Wrapper({
  children, onBack,
}: {
  children: React.ReactNode; onBack: () => void;
}) {
  return (
    <div className="pt-3 pb-20 flex flex-col gap-4">
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="font-mono text-[9px] font-bold tracking-[0.22em] uppercase text-grvd-cyan">
            🤝 friends
          </div>
          <div className="font-display text-3xl text-white leading-tight mt-1">
            your people
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

function Header() {
  return null;
}

function Section({
  title, accent, children,
}: {
  title: string;
  /** Tailwind text-* accent class for the section eyebrow. */
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

function FriendRowView({
  profile, onOpen, action,
}: {
  profile: PublicProfile;
  onOpen: () => void;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/3 border border-white/8 shadow-chunky-press hover:border-grvd-purple/30 transition-colors">
      <button
        onClick={onOpen}
        title={`open ${profile.username}'s profile`}
        className="flex items-center gap-3 flex-1 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer"
      >
        <span className="w-10 h-10 rounded-full bg-grvd-purple/15 border-2 border-grvd-purple/30 flex items-center justify-center text-xl shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
          {profile.avatar}
        </span>
        <span className="font-display text-base text-white truncate flex-1 min-w-0">
          {profile.username}
        </span>
      </button>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function anonFallback(id: string): PublicProfile {
  return {
    id,
    username: id.slice(0, 6),
    avatar:   "👤",
    createdAt: new Date().toISOString(),
  };
}

const emptyStateCx = [
  "rounded-2xl border border-dashed border-white/12",
  "px-4 py-4 text-center",
  "font-mono text-[11px] text-white/45",
].join(" ");
