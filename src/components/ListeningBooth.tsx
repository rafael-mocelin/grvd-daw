import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { TamagotchiFace } from "./TamagotchiFace";
import { playSong, stopSong } from "../audio/engine";
import type { ArtistCard } from "../data/types";

/**
 * Phase 4 — Listening Booth.
 * A physical location in the world where artist cards live asynchronously.
 * Any card you drop here "stays" for 24 hours. Other players browse.
 *
 * In this prototype we seed a handful of NPC cards so the booth never
 * feels empty and so the player can experience what it's like to be a
 * Tastemaker (without us building a real server).
 */

const NPC_CARDS: ArtistCard[] = [
  {
    id: "npc-1",
    name: "Jinx",
    avatar: "🦊",
    songId: "npc-song-1",
    status: "looking for a vocalist for this beat",
    tags: ["trap", "pop-rap"],
    createdAt: Date.now() - 1000 * 60 * 20,
  },
  {
    id: "npc-2",
    name: "Lo-Tide",
    avatar: "🌊",
    songId: "npc-song-2",
    status: "chopped this sample yesterday. feedback?",
    tags: ["boom-bap", "rap"],
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
  },
  {
    id: "npc-3",
    name: "MADD",
    avatar: "🖤",
    songId: "npc-song-3",
    status: "drill season. trying to link.",
    tags: ["drill"],
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
  },
  {
    id: "npc-4",
    name: "Sunflower",
    avatar: "🌻",
    songId: "npc-song-4",
    status: "pop hooks, bright energy.",
    tags: ["pop-rap"],
    createdAt: Date.now() - 1000 * 60 * 45,
  },
];

export function ListeningBooth() {
  const { booth, inventory, setStage, tamagotchi, setCoopPeer } = useStore();
  const allCards = [...booth, ...NPC_CARDS];
  const [index, setIndex] = useState(0);
  const [listenMs, setListenMs] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [matched, setMatched] = useState<ArtistCard | null>(null);

  const card = allCards[index];

  useEffect(() => {
    setListenMs(0);
    setRevealed(false);
    if (!card) {
      stopSong();
      return;
    }
    // play the card's song: if it's a player card, find it in inventory;
    // otherwise seed an NPC song.
    const playerSong = inventory.find((s) => s.id === card.songId);
    const song = playerSong ?? seedNpcSong(card);
    playSong(song, null).catch(() => {
      /* ignore autoplay errors */
    });
    const t = window.setInterval(() => {
      setListenMs((ms) => ms + 250);
    }, 250);
    return () => {
      stopSong();
      window.clearInterval(t);
    };
  }, [card, inventory]);

  useEffect(() => {
    // Per the spec: info appears after 5 seconds of listening
    if (listenMs >= 5000) setRevealed(true);
  }, [listenMs]);

  if (!card) {
    return (
      <div className="p-8 text-center">
        <div className="text-muted">Booth is empty — drop a card first.</div>
        <button className="btn-ghost mt-4" onClick={() => setStage("crib")}>
          ← back to crib
        </button>
      </div>
    );
  }

  function next() {
    setIndex((i) => Math.min(allCards.length - 1, i + 1));
  }
  function like() {
    // 60% chance of match with NPC; 100% if it's a player card
    const isNpc = !!NPC_CARDS.find((n) => n.id === card!.id);
    const matchProb = isNpc ? 0.6 : 1;
    if (Math.random() < matchProb) {
      setMatched(card);
    } else {
      next();
    }
  }

  function sendToCoop() {
    if (!matched) return;
    setCoopPeer(matched.name, matched.avatar);
    setMatched(null);
    setStage("coop");
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <TamagotchiFace mood={tamagotchi.mood} size={60} compact />
        <div>
          <div className="chip bg-gold/10 border border-gold/30 text-gold">
            🎧 Listening Booth
          </div>
          <h2 className="font-display text-2xl font-bold">
            first impression: the music
          </h2>
          <p className="text-muted text-xs font-mono">
            card info unlocks after 5 seconds. listen before you judge.
          </p>
        </div>
        <button
          className="btn-ghost text-xs ml-auto"
          onClick={() => setStage("crib")}
        >
          ← back
        </button>
      </div>

      {/* card */}
      <div className="card p-6 flex flex-col items-center gap-4">
        {/* progress bar */}
        <div className="w-full h-2 bg-raised rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent2"
            style={{ width: `${Math.min(100, (listenMs / 5000) * 100)}%` }}
          />
        </div>
        <div className="text-[10px] font-mono uppercase text-white/50">
          {revealed ? "revealed" : `listening… ${Math.floor(listenMs / 1000)}s / 5s`}
        </div>

        {revealed ? (
          <>
            <div className="text-6xl">{card.avatar}</div>
            <div className="text-2xl font-display font-bold">{card.name}</div>
            <div className="flex flex-wrap gap-1 justify-center">
              {card.tags.map((t) => (
                <span
                  key={t}
                  className="chip bg-raised border border-line text-white/70"
                >
                  #{t}
                </span>
              ))}
            </div>
            <div className="italic text-center text-white/80">
              "{card.status}"
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 opacity-70">
            <div className="text-6xl blur-md select-none">{card.avatar}</div>
            <div className="text-sm font-mono text-white/50">
              anonymous · let the beat speak first
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-2">
          <button className="btn-ghost" onClick={next}>
            ← skip
          </button>
          <button className="btn-primary" onClick={like} disabled={!revealed}>
            ♥ like
          </button>
        </div>
      </div>

      {/* match modal */}
      {matched && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
          <div className="card p-6 max-w-sm text-center flex flex-col items-center gap-4">
            <div className="text-5xl">✨</div>
            <h3 className="font-display text-2xl font-bold">match!</h3>
            <p className="text-sm text-white/70">
              {matched.name} liked you back. wanna cook together?
            </p>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setMatched(null)}>
                later
              </button>
              <button className="btn-primary" onClick={sendToCoop}>
                start collab →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Synthesize a stand-in song for NPC cards so they actually play something. */
function seedNpcSong(card: ArtistCard) {
  return {
    id: card.songId,
    name: `${card.name} — demo`,
    bpm: card.tags.includes("boom-bap") ? 90 : card.tags.includes("drill") ? 148 : 120,
    bars: 4,
    keyRoot: "A",
    templateId: "seed",
    tags: card.tags,
    collaborators: [card.name],
    createdAt: card.createdAt,
    layers: [
      { id: "k", kind: "kick" as const, variant: card.tags.includes("boom-bap") ? "boom" : "trap", soundId: "seed-k" },
      { id: "h", kind: "hat" as const, variant: "eighths", soundId: "seed-h" },
      { id: "s", kind: "sample" as const, variant: card.tags.includes("drill") ? "dark-keys" : "soul-chop", soundId: "seed-s" },
    ],
  };
}
