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
  fetchTopProducersThisWeek,
  type LeaderboardSong,
  type LeaderboardArtist,
  type LeaderboardTastemaker,
  type LeaderboardProducer,
} from "../lib/game-db";
import { ChunkyPill } from "../ui/Chunky";

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
  const [producers, setProducers]         = useState<LeaderboardProducer[] | null>(null);
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
      } else if (active === "producers" && producers === null) {
        setLoading(true);
        const rows = await fetchTopProducersThisWeek();
        if (!cancelled) { setProducers(rows); setLoading(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [active, songs, artists, tastemakers, producers]);

  return (
    <div className="pt-3 pb-8 flex flex-col gap-4">
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
        <ProducersList rows={producers ?? []} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

function Header({ onBack }: { onBack: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between px-1">
        <ChunkyPill onClick={onBack} icon="←" size="sm">
          back
        </ChunkyPill>
        <span className="font-display text-grvd-gold text-[11px] tracking-widest uppercase">
          🏆 LEADERBOARD
        </span>
        <span className="w-12" />
      </div>
      <div className="text-center px-2">
        <h2 className="font-display text-3xl text-white tracking-wide">
          THIS WEEK
        </h2>
        <div className="mt-1 font-sans text-grvd-gold/70 text-[11px] tracking-widest uppercase">
          last 7 days · refreshes on open
        </div>
      </div>
    </>
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
    <div className="flex gap-1.5 px-1">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={[
              "flex-1 px-2 py-2 rounded-2xl",
              "font-display tracking-widest text-[11px]",
              "shadow-chunky-press transition-all duration-150",
              "active:translate-y-[1px] flex items-center justify-center gap-1",
              isActive
                ? "bg-gradient-to-r from-grvd-gold to-grvd-orange text-grvd-base shadow-glow-gold"
                : "bg-grvd-panel text-white/55 border border-grvd-line",
            ].join(" ")}
          >
            <span className="text-sm">{t.icon}</span>
            <span>{t.label.toUpperCase()}</span>
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
      {rows.map((row, i) => {
        const byLine = row.collaboratorNames.length > 0
          ? `${row.artistName} × ${row.collaboratorNames.join(" × ")}`
          : row.artistName;
        return (
          <Row
            key={row.songId}
            rank={i + 1}
            avatar={row.artistAvatar}
            title={row.title}
            sub={`${byLine}${row.bpm ? ` · ${row.bpm} BPM` : ""}${row.keyRoot ? ` · ${row.keyRoot}` : ""}`}
            primary={`★ ${row.avgStarsThisWeek > 0 ? row.avgStarsThisWeek.toFixed(1) : "–"}`}
            secondary={`${row.ratingsThisWeek} rating${row.ratingsThisWeek === 1 ? "" : "s"} · 🔥 ${row.endorsementsThisWeek}`}
            score={row.score}
            accent="#22d3ee"
            onClick={() => row.artistId && openProfile(row.artistId)}
          />
        );
      })}
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
/* Producers tab                                                                */
/* -------------------------------------------------------------------------- */

function ProducersList({ rows }: { rows: LeaderboardProducer[] }) {
  const openProfile = useStore((s) => s.openProfile);
  if (rows.length === 0) {
    return (
      <div style={{ ...emptyState, lineHeight: 1.5 }}>
        no producer signal yet — publish a sound or template to register.
        <br />
        <span style={{ opacity: 0.55, fontSize: 9 }}>1 pt per claim · 8 pts per template usage</span>
      </div>
    );
  }
  return (
    <div style={listContainer}>
      {rows.map((row, i) => (
        <Row
          key={row.producerId}
          rank={i + 1}
          avatar={row.producerAvatar}
          title={row.producerName}
          sub={`${row.claimsThisWeek} claim${row.claimsThisWeek === 1 ? "" : "s"} · ${row.templateUsagesThisWeek} template use${row.templateUsagesThisWeek === 1 ? "" : "s"}`}
          primary={`${row.score} pts`}
          secondary=""
          score={row.score}
          accent="#a78bfa"
          onClick={() => row.producerId && openProfile(row.producerId)}
        />
      ))}
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

  // Podium colors — gold / silver / bronze. Below podium, the row inherits
  // its accent from the tab.
  const rankBg =
    rank === 1 ? "from-grvd-gold to-grvd-orange" :
    rank === 2 ? "from-white/40 to-white/10" :
    rank === 3 ? "from-grvd-orange to-grvd-magenta" :
    "from-grvd-purple/40 to-grvd-purple/15";

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={[
        "flex items-center gap-3 px-3 py-2.5 rounded-2xl",
        "shadow-chunky-press",
        "transition-all duration-150",
        onClick ? "active:translate-y-[1px] active:shadow-chunky-press cursor-pointer" : "cursor-default",
        isPodium ? "border-2" : "border",
      ].join(" ")}
      style={{
        background: isPodium
          ? `linear-gradient(135deg, ${accent}26 0%, rgba(0,0,0,0.30) 100%)`
          : "rgba(255,255,255,0.04)",
        borderColor: isPodium ? accent + "66" : "rgba(255,255,255,0.06)",
        boxShadow: isPodium ? `0 0 16px ${accent}33, 0 4px 0 0 rgba(0,0,0,0.30)` : undefined,
      }}
    >
      {/* Rank pip — gold/silver/bronze gradient circle for podium */}
      <div
        className={[
          "w-9 h-9 rounded-full grid place-items-center shrink-0",
          "bg-gradient-to-br",
          rankBg,
          "shadow-chunky-press",
          "font-display text-base text-grvd-base",
        ].join(" ")}
      >
        {rank}
      </div>

      {/* Avatar puck */}
      <div
        className="w-10 h-10 rounded-full grid place-items-center text-xl shrink-0 shadow-chunky-press"
        style={{
          background: `linear-gradient(135deg, ${accent}55 0%, ${accent}22 100%)`,
          border: `1px solid ${accent}66`,
        }}
      >
        {avatar}
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <div className="font-display text-white text-sm tracking-wide truncate">
          {title}
        </div>
        <div className="font-sans text-white/55 text-[11px] truncate">
          {sub}
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0">
        <div
          className="font-display text-sm tabular-nums"
          style={{ color: accent }}
        >
          {primary}
        </div>
        {secondary && (
          <div className="font-sans text-[10px] text-white/45 tabular-nums mt-0.5">
            {secondary}
          </div>
        )}
      </div>
      <div
        className="font-display text-grvd-gold/80 text-base tabular-nums w-12 text-right shrink-0"
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
  fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
  fontSize: 13,
  color: "rgba(167,139,250,0.75)",
  border: "1px dashed rgba(167,139,250,0.25)",
  borderRadius: 16,
  background: "rgba(21,16,42,0.5)",
};
