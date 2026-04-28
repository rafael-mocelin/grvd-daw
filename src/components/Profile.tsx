/**
 * Profile — the Phase 3 identity screen, UI-v1 game-feel rebuild.
 *
 * One stage, two modes. Dispatches on `profileUserId` from the store:
 *   null OR equal to current user → TastemakerProfile (your listener stats)
 *   any other uuid                → ArtistProfile (their drops + stats)
 *
 * Self profile centers the live CharacterFace at hero scale (manifesto
 * rule #2: avatar-forward). Other-user profile shows a fat gradient avatar
 * disc with their selected emoji. Stats live in chunky candy tiles. Fan
 * toggle is a ChunkyButton. Drop rows pick up the per-vibe gradient
 * language used elsewhere.
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
import { CharacterFace } from "../ui/CharacterFace";
import { ChunkyButton, ChunkyPill, ChunkyBadge } from "../ui/Chunky";

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
        <EmptyState>sign in to see your profile.</EmptyState>
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
  const totalXP = useStore((s) => s.totalXP);
  const level   = useStore((s) => s.level);

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
      {/* Hero: live character face — the user IS the pet. */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="relative">
          <CharacterFace size={180} />
          {/* Level badge orbiting the face */}
          <div className="absolute -bottom-1 -right-1">
            <ChunkyBadge variant="gold" size="md" icon="⭐">
              L{level}
            </ChunkyBadge>
          </div>
        </div>

        <div className="text-center">
          <div className="font-display text-3xl text-white leading-none drop-shadow">
            {profile?.username ?? "you"}
          </div>
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/45 mt-1">
            🎧 tastemaker · {profile ? "your listener stats" : "loading…"}
          </div>
        </div>

        <ChunkyBadge variant="gold" size="md" icon="✨">
          {totalXP.toLocaleString()} XP
        </ChunkyBadge>
      </div>

      <StatGrid>
        <StatTile label="ratings"     value={(stats?.ratingsGiven ?? 0).toString()}      tint="cyan" />
        <StatTile label="pushes"      value={(stats?.endorsementsGiven ?? 0).toString()} tint="magenta" />
        <StatTile label="early-ear"   value={(stats?.earlyEarHits ?? 0).toString()}      tint="gold" />
        <StatTile label="following"   value={(stats?.fansFollowing ?? 0).toString()}     tint="purple" />
      </StatGrid>

      <Hint>
        early-ear hits = drops you rated 4★+ or pushed before they crossed
        the popularity threshold.
      </Hint>
    </Wrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* ArtistProfile — someone else's artist page                                   */
/* -------------------------------------------------------------------------- */

function ArtistProfile({ artistId, onBack }: { artistId: string; onBack: () => void }) {
  const userId  = useStore((s) => s.userId);
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
      {/* Hero: gradient avatar disc with their emoji. */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <ArtistAvatarDisc emoji={profile?.avatar ?? "🎧"} size={180} />

        <div className="text-center">
          <div className="font-display text-3xl text-white leading-none drop-shadow">
            {profile?.username ?? "…"}
          </div>
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/45 mt-1">
            🎤 artist · {profile ? "their drops + signal" : "loading…"}
          </div>
        </div>

        <ChunkyButton
          variant={isFan ? "ghost" : "magenta"}
          size="md"
          icon={isFan ? "✓" : "+"}
          onClick={toggleFan}
          disabled={fanBusy}
        >
          {fanBusy ? "…" : isFan ? "fan" : "become a fan"}
        </ChunkyButton>
      </div>

      <StatGrid>
        <StatTile label="drops"   value={(stats?.totalDrops ?? 0).toString()}   tint="purple" />
        <StatTile label="fans"    value={(stats?.totalFans ?? 0).toString()}    tint="magenta" />
        <StatTile label="ratings" value={(stats?.totalRatings ?? 0).toString()} tint="cyan" />
        <StatTile
          label="avg ★"
          value={stats?.totalRatings ? stats.avgStars.toFixed(1) : "–"}
          tint="gold"
        />
        <StatTile label="pushes 🔥" value={(stats?.totalEndorsements ?? 0).toString()} tint="orange" />
      </StatGrid>

      {/* Drops list */}
      <div className="mt-4">
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/45 mb-2">
          drops
        </div>
        {drops === null && <EmptyState>loading catalog…</EmptyState>}
        {drops && drops.length === 0 && <EmptyState>no drops yet.</EmptyState>}
        {drops && drops.length > 0 && (
          <div className="flex flex-col gap-2">
            {drops.map((d) => <DropRow key={d.songId} song={d} />)}
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
    <div className="flex flex-col gap-4 pt-3 pb-20">
      <div className="flex justify-start">
        <ChunkyPill variant="ghost" size="sm" onClick={onBack} icon="←">
          back
        </ChunkyPill>
      </div>
      {children}
    </div>
  );
}

/** The big static gradient avatar disc used for other-user profiles. */
function ArtistAvatarDisc({ emoji, size }: { emoji: string; size: number }) {
  return (
    <div
      className={[
        "relative shrink-0 select-none rounded-full",
        "bg-gradient-to-br from-grvd-magenta to-grvd-orange",
        "shadow-chunky animate-puck-bob",
        "flex items-center justify-center",
      ].join(" ")}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="leading-none"
        style={{
          fontSize: size * 0.55,
          filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
        }}
      >
        {emoji}
      </span>
      {/* Glossy highlight */}
      <div
        aria-hidden
        className="absolute inset-x-3 top-3 h-[40%] rounded-full bg-white/15 blur-md pointer-events-none"
      />
    </div>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 mt-2">
      {children}
    </div>
  );
}

const TINT_BG: Record<string, string> = {
  purple:  "bg-grvd-purple/15 border-grvd-purple/30",
  magenta: "bg-grvd-magenta/15 border-grvd-magenta/30",
  cyan:    "bg-grvd-cyan/15 border-grvd-cyan/30",
  gold:    "bg-grvd-gold/15 border-grvd-gold/30",
  orange:  "bg-grvd-orange/15 border-grvd-orange/30",
};

const TINT_VALUE: Record<string, string> = {
  purple:  "text-grvd-purple",
  magenta: "text-grvd-magenta",
  cyan:    "text-grvd-cyan",
  gold:    "text-grvd-gold",
  orange:  "text-grvd-orange",
};

function StatTile({
  label, value, tint = "purple",
}: {
  label: string;
  value: string;
  tint?: "purple" | "magenta" | "cyan" | "gold" | "orange";
}) {
  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3",
        "shadow-chunky-press",
        TINT_BG[tint],
      ].join(" ")}
    >
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-white/55">
        {label}
      </div>
      <div
        className={[
          "font-display text-2xl leading-none mt-1.5 tabular-nums",
          TINT_VALUE[tint],
        ].join(" ")}
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
      className={[
        "flex items-center gap-3 px-3 py-2.5",
        "rounded-2xl border border-white/8 bg-white/[0.03]",
        "shadow-chunky-press",
      ].join(" ")}
    >
      <span className="text-2xl shrink-0 leading-none">{song.artistAvatar}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-display text-base text-white truncate">
            {song.title}
          </div>
          {isGroup && (
            <ChunkyBadge variant="gold" size="sm">GROUP</ChunkyBadge>
          )}
        </div>
        <div className="font-mono text-[10px] text-white/45 mt-0.5 truncate">
          {isGroup
            ? `with ${song.collaboratorNames.join(" × ")}`
            : `${song.bpm ? `${song.bpm} BPM` : ""}${song.bpm && song.keyRoot ? " · " : ""}${song.keyRoot ?? ""}`}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="font-mono text-[10px] text-white/65 tabular-nums">
          ★ {song.ratingCount > 0 ? song.avgStars.toFixed(1) : "–"}
          <span className="opacity-50"> ({song.ratingCount})</span>
        </span>
        <span className="font-mono text-[10px] text-grvd-magenta tabular-nums">
          🔥 {song.endorsementCount}
        </span>
      </div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        "rounded-xl border-l-2 border-grvd-gold/50",
        "bg-grvd-gold/5 px-3 py-2",
        "font-mono text-[10px] leading-relaxed text-white/55",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        "rounded-2xl border border-dashed border-white/12",
        "px-4 py-6 text-center",
        "font-mono text-[11px] text-white/45",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
