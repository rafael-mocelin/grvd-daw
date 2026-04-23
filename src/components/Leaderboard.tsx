/**
 * Leaderboard — Slice 2 "who's winning this week" screen.
 *
 * Three tabs (+ one placeholder for Producers V2) backed by the three
 * weekly_* views on Supabase. The views are public-read (anon allowed)
 * so guests can see signal without logging in.
 *
 * Score shape (computed on the DB side, client just ranks by it):
 *   songs:        avg_stars * rating_count + endorsement_count * 5
 *   artists:      sum of song_score across artist's songs
 *   tastemakers:  ratings_given + endorsements_given * 3
 *
 * Endorsements weight heavier than ratings because they cost energy.
 *
 * Client-side this component is fire-and-forget: each tab fetches on
 * first view, caches locally for the session, and re-fetches on manual
 * refresh. Empty states are explicit — no signal = no noise.
 *
 * Reuses the same narrow reading column pattern as Home / Booth /
 * TemplatePicker (maxWidth 520, top-padding 34 to clear the
 * persistent ScreenTopBar).
 */

import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import {
  fetchTopSongsThisWeek,
  fetchTopArtistsThisWeek,
  fetchTopTastemakersThisWeek,
  type LeaderboardSong,
  type LeaderboardArtist,
  type LeaderboardTastemaker,
} from "../lib/game-db";

type TabId = "songs" | "artists" | "tastemakers" | "producers";

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: "songs",       label: "songs",       icon: "🎵" },
  { id: "artists",     label: "artists",     icon: "🎤" },
  { id: "tastemakers", label: "tastemakers", icon: "🎧" },
  { id: "producers",   label: "producers",   icon: "🎛️" },
];

/* -------------------------------------------------------------------------- */
/* Root                                                                        */
/* -------------------------------------------------------------------------- */

export function Leaderboard() {
  const setStage = useStore((s) => s.setStage);
  const sayLine  = useStore((s) => s.sayLine);

  const [active, setActive]               = useState<TabId>("songs");
  const [songs, setSongs]                 = useState<LeaderboardSong[] | null>(null);
  const [artists, setArtists]             = useState<LeaderboardArtist[] | null>(null);
  const [tastemakers, setTastemakers]     = useState<LeaderboardTastemaker[] | null>(null);
  const [loading, setLoading]             = useState(false);

  useEffect(() => {
    sayLine("this week's signal", 2400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy-load per tab. Only fetch when the tab is first opened; keep the
  // result cached for the session (swap tabs without refetching).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (active === "songs" && songs === null) {
        setLoading(true);
        const rows = await fetchTopSongsThisWeek();
        if (!cancelled) { setSongs(rows); setLoading(false); }
      } else if (active === "artists" && artists === null) {
        setLoading(true);
        const rows = await fetchTopArtistsThisWeek();
        if (!cancelled) { setArtists(rows); setLoading(false); }
      } else if (active === "tastemakers" && tastemakers === null) {
        setLoading(true);
        const rows = await fetchTopTastemakersThisWeek();
        if (!cancelled) { setTastemakers(rows); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [active, songs, artists, tastemakers]);

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
      <Header onBack={() => setStage("home")} />

      <TabBar
        active={active}
        onChange={setActive}
      />

      {loading && <div style={emptyState}>counting the signal…</div>}

      {!loading && active === "songs" && (
        <SongsList rows={songs ?? []} onPlay={() => setStage("booth")} />
      )}
      {!loading && active === "artists" && (
        <ArtistsList rows={artists ?? []} />
      )}
      {!loading && active === "tastemakers" && (
        <TastemakersList rows={tastemakers ?? []} />
      )}
      {!loading && active === "producers" && (
        <ProducersComingSoon />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
      <div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#facc15",
          }}
        >
          🏆 leaderboard
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
          this week's signal
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            marginTop: 2,
          }}
        >
          last 7 days · refreshes on open
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
          flexShrink: 0,
        }}
      >
        ← back
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              padding: "7px 4px",
              borderRadius: 7,
              border: "none",
              background: isActive
                ? "linear-gradient(135deg, rgba(250,204,21,0.22) 0%, rgba(255,77,109,0.18) 100%)"
                : "transparent",
              boxShadow: isActive ? "0 0 10px rgba(250,204,21,0.18)" : "none",
              color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
              fontFamily: "monospace",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            <span style={{ fontSize: 12 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Songs tab                                                                   */
/* -------------------------------------------------------------------------- */

function SongsList({ rows, onPlay }: { rows: LeaderboardSong[]; onPlay: () => void }) {
  const openProfile = useStore((s) => s.openProfile);
  if (rows.length === 0) {
    return <div style={emptyState}>no drops charted this week yet — rate a few in the booth and they'll show up here.</div>;
  }
  return (
    <div style={listContainer}>
      {rows.map((row, i) => (
        <Row
          key={row.songId}
          rank={i + 1}
          avatar={row.artistAvatar}
          title={row.title}
          sub={`${row.artistName}${row.bpm ? ` · ${row.bpm} BPM` : ""}${row.keyRoot ? ` · ${row.keyRoot}` : ""}`}
          primary={`★ ${row.avgStarsThisWeek > 0 ? row.avgStarsThisWeek.toFixed(1) : "–"}`}
          secondary={`${row.ratingsThisWeek} rating${row.ratingsThisWeek === 1 ? "" : "s"} · 🔥 ${row.endorsementsThisWeek}`}
          score={row.score}
          accent="#22d3ee"
          onClick={() => row.artistId && openProfile(row.artistId)}
        />
      ))}
      <div
        onClick={onPlay}
        style={{
          textAlign: "center",
          fontFamily: "monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          padding: "10px 0 0",
          cursor: "pointer",
          letterSpacing: "0.1em",
        }}
      >
        → back to the booth to add your signal
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Artists tab                                                                 */
/* -------------------------------------------------------------------------- */

function ArtistsList({ rows }: { rows: LeaderboardArtist[] }) {
  const openProfile = useStore((s) => s.openProfile);
  if (rows.length === 0) {
    return <div style={emptyState}>no artists have caught signal this week yet.</div>;
  }
  return (
    <div style={listContainer}>
      {rows.map((row, i) => (
        <Row
          key={row.artistId}
          rank={i + 1}
          avatar={row.artistAvatar}
          title={row.artistName}
          sub={`${row.songsActive} active track${row.songsActive === 1 ? "" : "s"}`}
          primary={`${row.ratingsThisWeek}★`}
          secondary={`🔥 ${row.endorsementsThisWeek}`}
          score={row.score}
          accent="#ff4d6d"
          onClick={() => row.artistId && openProfile(row.artistId)}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tastemakers tab                                                             */
/* -------------------------------------------------------------------------- */

function TastemakersList({ rows }: { rows: LeaderboardTastemaker[] }) {
  const openProfile = useStore((s) => s.openProfile);
  if (rows.length === 0) {
    return <div style={emptyState}>no tastemakers yet — be the first to rate this week's drops.</div>;
  }
  return (
    <div style={listContainer}>
      {rows.map((row, i) => (
        <Row
          key={row.userId}
          rank={i + 1}
          avatar={row.avatar}
          title={row.username}
          sub={`${row.ratingsGiven} rating${row.ratingsGiven === 1 ? "" : "s"} · ${row.endorsementsGiven} push${row.endorsementsGiven === 1 ? "" : "es"}`}
          primary={`${row.score} pts`}
          secondary=""
          score={row.score}
          accent="#a78bfa"
          onClick={() => row.userId && openProfile(row.userId)}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Producers placeholder                                                       */
/* -------------------------------------------------------------------------- */

function ProducersComingSoon() {
  return (
    <div
      style={{
        ...emptyState,
        lineHeight: 1.5,
      }}
    >
      producers will show up here when the template-publishing flow ships.
      <br />
      <span style={{ opacity: 0.6, fontSize: 9 }}>slice 3</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared row                                                                  */
/* -------------------------------------------------------------------------- */

function Row({
  rank, avatar, title, sub, primary, secondary, score, accent, onClick,
}: {
  rank: number;
  avatar: string;
  title: string;
  sub: string;
  primary: string;
  secondary: string;
  score: number;
  accent: string;
  /** If provided, row is clickable and acts like a link to that user's profile. */
  onClick?: () => void;
}) {
  const isPodium = rank <= 3;
  const rankGlow =
    rank === 1 ? "#facc15" :
    rank === 2 ? "#d1d5db" :
    rank === 3 ? "#f59e0b" :
    "rgba(255,255,255,0.35)";

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        cursor: onClick ? "pointer" : "default",
        background: isPodium
          ? `linear-gradient(135deg, ${accent}10 0%, rgba(0,0,0,0.35) 100%)`
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${isPodium ? accent + "33" : "rgba(255,255,255,0.05)"}`,
        boxShadow: isPodium ? `0 0 10px ${accent}22` : "none",
      }}
    >
      <div
        style={{
          width: 24,
          fontFamily: "monospace",
          fontSize: 14,
          fontWeight: 900,
          color: rankGlow,
          textAlign: "center",
          textShadow: isPodium ? `0 0 6px ${rankGlow}88` : "none",
          flexShrink: 0,
        }}
      >
        {rank}
      </div>
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          background: `linear-gradient(135deg, ${accent}33 0%, ${accent}11 100%)`,
          border: `1px solid ${accent}33`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {avatar}
      </div>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
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
          {title}
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.5)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sub}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 800,
            color: accent,
            letterSpacing: "0.03em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {primary}
        </div>
        {secondary && (
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              color: "rgba(255,255,255,0.4)",
              marginTop: 2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {secondary}
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          color: "rgba(255,255,255,0.25)",
          width: 42,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          flexShrink: 0,
        }}
        title="score"
      >
        {Math.round(score)}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                      */
/* -------------------------------------------------------------------------- */

const listContainer: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const emptyState: React.CSSProperties = {
  padding: "40px 20px",
  textAlign: "center",
  fontFamily: "monospace",
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  border: "1px dashed rgba(255,255,255,0.1)",
  borderRadius: 12,
};
