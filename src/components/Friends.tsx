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

/* -------------------------------------------------------------------------- */
/* Root                                                                        */
/* -------------------------------------------------------------------------- */

export function Friends() {
  const userId      = useStore((s) => s.userId);
  const setStage    = useStore((s) => s.setStage);
  const openProfile = useStore((s) => s.openProfile);
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

  /* ── Helpers ────────────────────────────────────────────── */
  const knownIds = useMemo(() => new Set((rows ?? []).map((r) => r.friendUserId)), [rows]);

  return (
    <Wrapper onBack={() => setStage("home")}>
      <Header />

      {/* Incoming pending */}
      {incoming.length > 0 && (
        <Section title={`incoming · ${incoming.length}`} accent="#facc15">
          {incoming.map((r) => {
            const p = profiles[r.friendUserId];
            return (
              <FriendRowView
                key={r.friendUserId}
                profile={p ?? anonFallback(r.friendUserId)}
                onOpen={() => openProfile(r.friendUserId)}
                action={
                  <div style={{ display: "flex", gap: 4 }}>
                    <InlineBtn
                      label="accept"
                      accent="#4ade80"
                      disabled={busy === r.friendUserId}
                      onClick={() => onRespond(r.friendUserId, true, p?.username ?? "them")}
                    />
                    <InlineBtn
                      label="skip"
                      accent="rgba(255,255,255,0.35)"
                      disabled={busy === r.friendUserId}
                      onClick={() => onRespond(r.friendUserId, false, p?.username ?? "them")}
                    />
                  </div>
                }
              />
            );
          })}
        </Section>
      )}

      {/* Accepted */}
      <Section title={`friends · ${accepted.length}`} accent="#22d3ee">
        {accepted.length === 0 ? (
          <div style={emptyState}>no friends yet — search below or visit an artist's profile to follow them.</div>
        ) : (
          accepted.map((r) => {
            const p = profiles[r.friendUserId];
            return (
              <FriendRowView
                key={r.friendUserId}
                profile={p ?? anonFallback(r.friendUserId)}
                onOpen={() => openProfile(r.friendUserId)}
                action={
                  <InlineBtn
                    label="remove"
                    accent="rgba(255,77,109,0.6)"
                    disabled={busy === r.friendUserId}
                    onClick={() => onRemove(r.friendUserId, p?.username ?? "them")}
                  />
                }
              />
            );
          })
        )}
      </Section>

      {/* Outgoing pending */}
      {outgoing.length > 0 && (
        <Section title={`awaiting · ${outgoing.length}`} accent="rgba(255,255,255,0.5)">
          {outgoing.map((r) => {
            const p = profiles[r.friendUserId];
            return (
              <FriendRowView
                key={r.friendUserId}
                profile={p ?? anonFallback(r.friendUserId)}
                onOpen={() => openProfile(r.friendUserId)}
                action={
                  <InlineBtn
                    label="cancel"
                    accent="rgba(255,255,255,0.35)"
                    disabled={busy === r.friendUserId}
                    onClick={() => onRemove(r.friendUserId, p?.username ?? "them")}
                  />
                }
              />
            );
          })}
        </Section>
      )}

      {/* Search */}
      <Section title="find someone" accent="#a78bfa">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="username prefix…"
          style={{
            width: "100%",
            padding: "10px 12px",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(167,139,250,0.3)",
            borderRadius: 10,
            color: "#fff",
            fontFamily: "monospace",
            fontSize: 12,
            outline: "none",
          }}
        />
        {searchResults !== null && searchResults.length === 0 && (
          <div style={{ ...emptyState, marginTop: 8 }}>no matches.</div>
        )}
        {searchResults !== null && searchResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {searchResults.map((p) => {
              const already = knownIds.has(p.id);
              return (
                <FriendRowView
                  key={p.id}
                  profile={p}
                  onOpen={() => openProfile(p.id)}
                  action={
                    already ? (
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 10,
                          color: "rgba(255,255,255,0.4)",
                          padding: "4px 8px",
                        }}
                      >
                        already in your list
                      </span>
                    ) : (
                      <InlineBtn
                        label="add"
                        accent="#22d3ee"
                        disabled={busy === p.id}
                        onClick={() => onSend(p.id, p.username)}
                      />
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
            🤝 friends
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
            your people
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

function Header() {
  return null;
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

function FriendRowView({
  profile, onOpen, action,
}: {
  profile: PublicProfile;
  onOpen: () => void;
  action: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
      }}
    >
      <button
        onClick={onOpen}
        title={`open ${profile.username}'s profile`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flex: 1,
          minWidth: 0,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
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
          }}
        >
          {profile.avatar}
        </span>
        <span
          style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
            minWidth: 0,
          }}
        >
          {profile.username}
        </span>
      </button>
      <div style={{ flexShrink: 0 }}>{action}</div>
    </div>
  );
}

function InlineBtn({
  label, accent, disabled, onClick,
}: {
  label: string;
  accent: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
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
        cursor: disabled ? "wait" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {label}
    </button>
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

const emptyState: React.CSSProperties = {
  padding: "16px 14px",
  textAlign: "center",
  fontFamily: "monospace",
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  border: "1px dashed rgba(255,255,255,0.1)",
  borderRadius: 10,
};
