/**
 * Profile — the Phase 3 identity screen.
 *
 * One stage, two modes. Dispatches on `profileUserId` from the store:
 *   null OR equal to current user → TastemakerProfile (your listener stats)
 *   any other uuid                → ArtistProfile (their drops + stats)
 *
 * Own TastemakerProfile is accessed via the Home "👤 profile" footer link.
 * ArtistProfile is reached by tapping an artist's name in the booth
 * (post-reveal) or from a Leaderboard row.
 */

import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import {
  fetchProfileById,
  fetchTastemakerStats,
  fetchArtistStats,
  fetchArtistFanCount,
  isFanOf,
  becomeFan,
  unfan,
  type PublicProfile,
  type TastemakerStats,
  type ArtistStats,
} from "../lib/social-db";
import {
  fetchPublishedCatalog,
  type PublishedSong,
} from "../lib/game-db";

/* -------------------------------------------------------------------------- */
/* Root dispatcher                                                             */
/* -------------------------------------------------------------------------- */

export function Profile() {
  const profileUserId = useStore((s) => s.profileUserId);
  const userId        = useStore((s) => s.userId);
  const setStage      = useStore((s) => s.setStage);

  const targetId = profileUserId ?? userId;
  const isSelf   = targetId === userId;

  // No target and no session → bounce to home.
  if (!targetId) {
    return (
      <Wrapper onBack={() => setStage("home")}>
        <div style={emptyState}>sign in to see your profile.</div>
      </Wrapper>
    );
  }

  return isSelf
    ? <TastemakerProfile userId={targetId} onBack={() => setStage("home")} />
    : <ArtistProfile    artistId={targetId} onBack={() => setStage("home")} />;
}

/* -------------------------------------------------------------------------- */
/* TastemakerProfile — your own listener view                                   */
/* -------------------------------------------------------------------------- */

function TastemakerProfile({ userId, onBack }: { userId: string; onBack: () => void }) {
  const totalXP    = useStore((s) => s.totalXP);
  const level      = useStore((s) => s.level);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats]     = useState<TastemakerStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, s] = await Promise.all([
        fetchProfileById(userId),
        fetchTastemakerStats(userId),
      ]);
      if (!cancelled) { setProfile(p); setStats(s); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <Wrapper onBack={onBack}>
      <Header
        kicker="🎧 tastemaker"
        title={profile?.username ?? "you"}
        subtitle={profile ? "your listener stats" : "loading…"}
      />
      <AvatarPanel emoji={profile?.avatar ?? "👤"} accent="#22d3ee" />
      <div style={cardGrid}>
        <StatCard label="level"         value={`L${level}`} />
        <StatCard label="total xp"      value={totalXP.toString()} />
        <StatCard label="ratings given" value={(stats?.ratingsGiven ?? 0).toString()} />
        <StatCard label="pushes given"  value={(stats?.endorsementsGiven ?? 0).toString()} />
        <StatCard label="early-ear hits" value={(stats?.earlyEarHits ?? 0).toString()} accent="#facc15" />
        <StatCard label="following"     value={(stats?.fansFollowing ?? 0).toString()} />
      </div>
      <Hint>
        early-ear hits = drops you rated 4★+ or pushed before they crossed the popularity threshold.
      </Hint>
    </Wrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* ArtistProfile — someone else's artist page                                   */
/* -------------------------------------------------------------------------- */

function ArtistProfile({ artistId, onBack }: { artistId: string; onBack: () => void }) {
  const userId = useStore((s) => s.userId);
  const sayLine = useStore((s) => s.sayLine);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats]     = useState<ArtistStats | null>(null);
  const [drops, setDrops]     = useState<PublishedSong[] | null>(null);
  const [isFan, setIsFan]     = useState<boolean>(false);
  const [fanBusy, setFanBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, s, d, f] = await Promise.all([
        fetchProfileById(artistId),
        fetchArtistStats(artistId),
        // Reuse the booth catalog query — include the artist's drops even if
        // filtering themselves out of the main booth feed.
        fetchPublishedCatalog(50, null),
        userId ? isFanOf(artistId) : Promise.resolve(false),
      ]);
      if (cancelled) return;
      setProfile(p);
      setStats(s);
      setDrops((d ?? []).filter((row) => row.artistId === artistId));
      setIsFan(f);
    })();
    return () => { cancelled = true; };
  }, [artistId, userId]);

  async function toggleFan() {
    if (!userId) {
      sayLine("sign in to follow artists", 2200);
      return;
    }
    setFanBusy(true);
    if (isFan) {
      const ok = await unfan(artistId);
      if (ok) {
        setIsFan(false);
        setStats((s) => s ? { ...s, totalFans: Math.max(0, s.totalFans - 1) } : s);
        sayLine("unfollowed", 1600);
      }
    } else {
      const ok = await becomeFan(artistId);
      if (ok) {
        setIsFan(true);
        setStats((s) => s ? { ...s, totalFans: s.totalFans + 1 } : s);
        sayLine(`now a fan of ${profile?.username ?? "this artist"}`, 2000);
      }
    }
    // Server-authoritative fan count in case we drifted.
    fetchArtistFanCount(artistId).then((n) => {
      setStats((s) => s ? { ...s, totalFans: n } : s);
    });
    setFanBusy(false);
  }

  return (
    <Wrapper onBack={onBack}>
      <Header
        kicker="🎤 artist"
        title={profile?.username ?? "…"}
        subtitle={profile ? "their drops + signal this week" : "loading…"}
      />
      <AvatarPanel emoji={profile?.avatar ?? "🎧"} accent="#ff4d6d" />

      {/* Fan toggle */}
      <button
        onClick={toggleFan}
        disabled={fanBusy}
        style={{
          background: isFan
            ? "rgba(255,77,109,0.2)"
            : "linear-gradient(135deg, #ff4d6d 0%, #facc15 100%)",
          border: `1px solid ${isFan ? "rgba(255,77,109,0.5)" : "rgba(255,77,109,0.6)"}`,
          color: isFan ? "#ff4d6d" : "#fff",
          fontFamily: "monospace",
          fontSize: 11,
          fontWeight: 800,
          padding: "10px 14px",
          borderRadius: 10,
          cursor: fanBusy ? "wait" : "pointer",
          boxShadow: isFan ? "none" : "0 0 12px rgba(255,77,109,0.3)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {fanBusy ? "…" : isFan ? "✓ fan" : "become a fan"}
      </button>

      <div style={cardGrid}>
        <StatCard label="drops"        value={(stats?.totalDrops ?? 0).toString()} />
        <StatCard label="fans"         value={(stats?.totalFans ?? 0).toString()} />
        <StatCard label="ratings"      value={(stats?.totalRatings ?? 0).toString()} />
        <StatCard
          label="avg ★"
          value={stats?.totalRatings ? stats.avgStars.toFixed(1) : "–"}
        />
        <StatCard label="pushes 🔥"     value={(stats?.totalEndorsements ?? 0).toString()} accent="#facc15" />
      </div>

      {/* Drops list */}
      <div style={{ marginTop: 6 }}>
        <div style={sectionTitle}>drops</div>
        {drops === null && <div style={emptyState}>loading catalog…</div>}
        {drops && drops.length === 0 && <div style={emptyState}>no drops yet.</div>}
        {drops && drops.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {drops.map((d) => (
              <DropRow key={d.songId} song={d} />
            ))}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* Subcomponents                                                               */
/* -------------------------------------------------------------------------- */

function Wrapper({
  children, onBack,
}: {
  children: React.ReactNode;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        padding: "34px 14px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 520,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
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

function Header({
  kicker, title, subtitle,
}: {
  kicker: string; title: string; subtitle: string;
}) {
  return (
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
        {kicker}
      </div>
      <div
        style={{
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: 22,
          fontWeight: 800,
          color: "#fff",
          marginTop: 2,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.45)",
          marginTop: 2,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function AvatarPanel({ emoji, accent }: { emoji: string; accent: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: 108,
          height: 108,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}55 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 56,
          lineHeight: 1,
          boxShadow: `0 10px 30px ${accent}55, inset 0 2px 0 rgba(255,255,255,0.2)`,
          userSelect: "none",
        }}
      >
        <span style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}>
          {emoji}
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label, value, accent = "#fff",
}: {
  label: string; value: string; accent?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 18,
          fontWeight: 800,
          color: accent,
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DropRow({ song }: { song: PublishedSong }) {
  const isGroup = song.collaboratorNames.length > 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{song.artistAvatar}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            color: "#fff",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {song.title}
          {isGroup && (
            <span
              style={{
                marginLeft: 6,
                fontFamily: "monospace",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.12em",
                color: "#facc15",
                padding: "1px 5px",
                borderRadius: 4,
                border: "1px solid rgba(250,204,21,0.4)",
                verticalAlign: "middle",
              }}
            >
              GROUP
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          {isGroup
            ? `with ${song.collaboratorNames.join(" × ")}`
            : `${song.bpm ? `${song.bpm} BPM` : ""}${song.bpm && song.keyRoot ? " · " : ""}${song.keyRoot ?? ""}`}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums" }}>
          ★ {song.ratingCount > 0 ? song.avgStars.toFixed(1) : "–"} <span style={{ opacity: 0.55 }}>({song.ratingCount})</span>
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums" }}>
          🔥 {song.endorsementCount}
        </span>
      </div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: 10,
        color: "rgba(255,255,255,0.4)",
        lineHeight: 1.5,
        padding: "8px 10px",
        borderLeft: "2px solid rgba(250,204,21,0.4)",
        borderRadius: 4,
        background: "rgba(250,204,21,0.05)",
      }}
    >
      {children}
    </div>
  );
}

const cardGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 8,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 9,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.5)",
  marginBottom: 6,
  marginTop: 8,
};

const emptyState: React.CSSProperties = {
  padding: "20px 16px",
  textAlign: "center",
  fontFamily: "monospace",
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  border: "1px dashed rgba(255,255,255,0.1)",
  borderRadius: 10,
};
