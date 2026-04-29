/**
 * Home — BURST hero stage view.
 *
 * Faithful port of the home design from the Claude Design handoff,
 * wired to live store state. Layout below the HUD:
 *
 *   ┌─────────────────────────────┐
 *   │   ┌──────────────────────┐  │
 *   │   │   stage panel         │  │
 *   │   │  [BOOTH]    [FRIENDS] │  │
 *   │   │                       │  │
 *   │   │       MASCOT 🎧       │  │
 *   │   │       "let's cook 🤝" │  │
 *   │   │                       │  │
 *   │   │  [STUDIO]   [CHARTS]  │  │
 *   │   └──────────────────────┘  │
 *   │                              │
 *   │  ┌──────────────────────┐   │
 *   │  │   COOK A TRACK       │   │
 *   │  └──────────────────────┘   │
 *   │                              │
 *   │      [crib]  [logbook]       │
 *   └─────────────────────────────┘
 */

import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { StudioScene } from "../ui/StudioScene";
import { Mascot }      from "../ui/burst/Mascot";
import { SpeechBubble } from "../ui/burst/SpeechBubble";
import { NavButton }    from "../ui/burst/NavButton";
import { CookCTA }      from "../ui/burst/CookCTA";
import { GhostPill }    from "../ui/burst/GhostPill";
import { Icon }         from "../ui/burst/Icon";
import { C, chrome }    from "../ui/burst/tokens";
import { CharacterFace } from "../ui/CharacterFace";
import { NeedsMeters }   from "./NeedsMeters";
import type { Mood } from "../data/types";

const TALK_LINES: Record<Mood, string> = {
  asleep: "zzz...",
  sleepy: "ok... what we doing today",
  chill:  "pick a vibe. the booth's open too.",
  happy:  "let's cook 🤝",
  hyped:  "LET'S GOOOO 🔥",
  sad:    "put on something. it helps.",
  lonely: "wanna see what someone's been working on?",
};

export function Home() {
  const tamagotchi    = useStore((s) => s.tamagotchi);
  const moodOverride  = useStore((s) => s.moodOverride);
  const setStage      = useStore((s) => s.setStage);
  const toggleLogbook = useStore((s) => s.toggleLogbook);
  const sayLine       = useStore((s) => s.sayLine);
  const dawTalk       = useStore((s) => s.dawTalk);
  const inventory     = useStore((s) => s.inventory);
  const hasTracks     = inventory.length > 0;

  const mood: Mood = moodOverride ?? tamagotchi.mood;

  useEffect(() => {
    sayLine(TALK_LINES[mood], 6000);
    return () => sayLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  return (
    <div
      style={{
        paddingTop: 6,
        paddingBottom: 18,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxWidth: 400,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* ── Stage panel ──
       * Chunky chrome frame with the StudioScene backdrop inside, the
       * mascot center stage, and four corner nav buttons sitting on
       * the chrome rim. */}
      <div
        style={{
          position: "relative",
          height: 480,
          borderRadius: 24,
          ...chrome(`linear-gradient(180deg, ${C.navyLight}, ${C.navyDeep})`),
          padding: 6,
        }}
      >
        <StudioScene>
          <Mascot />
          {dawTalk && <SpeechBubble text={dawTalk} />}
        </StudioScene>

        {/* Mascot — left side of the panel top, positioned independently
         *  from the needs bars so each can be tweaked on its own without
         *  dragging the other along. */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 12,
            zIndex: 8,
          }}
        >
          <CharacterFace size={64} />
        </div>

        {/* Needs bars — pinned high inside the chrome border, room left
         *  for the mascot on the left. Independent from the mascot's
         *  top offset so moving one doesn't move the other. */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 86,
            right: 12,
            zIndex: 8,
          }}
        >
          <NeedsMeters tam={tamagotchi} compact />
        </div>

        {/* Nav buttons — BOOTH stacks on top of STUDIO (left column),
         *  FRIENDS stacks on top of CHARTS (right column). STUDIO and
         *  CHARTS stay pinned to the bottom corners; BOOTH and FRIENDS
         *  sit just above them with a 12px gap. */}
        <NavButton
          style={{ left: 12, bottom: 100 }}
          gradFrom={C.pink}
          gradTo={C.coral}
          halo={`${C.pink}88`}
          icon={<Icon.Headphones size={26} />}
          label="BOOTH"
          onPress={() => setStage("booth")}
        />
        <NavButton
          style={{ right: 12, bottom: 100 }}
          gradFrom="#ff7a8e"
          gradTo={C.coralDeep}
          halo={`${C.coral}88`}
          icon={<Icon.Handshake size={26} />}
          label="FRIENDS"
          onPress={() => setStage("friends")}
        />
        <NavButton
          pos="bl"
          gradFrom={C.green}
          gradTo="#16a34a"
          halo={`${C.green}88`}
          icon={<Icon.Sliders size={24} />}
          label="STUDIO"
          onPress={() => setStage("studio")}
        />
        <NavButton
          pos="br"
          gradFrom={C.goldLight}
          gradTo="#a07a0c"
          halo={`${C.gold}99`}
          icon={<Icon.Trophy size={24} />}
          label="CHARTS"
          onPress={() => setStage("leaderboard")}
        />
      </div>

      {/* ── Hero CTA ── */}
      <div>
        <CookCTA onPress={() => setStage("template")} />
      </div>

      {/* ── Tertiary row ──
       * The "crib" pill was removed: tapping the LevelBadge in the HUD
       * already opens the same pet/crib menu, so the pill was redundant.
       * "logbook" was renamed to "musics" to match player vocabulary. */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <GhostPill onClick={toggleLogbook}>
          📓 YOUR SONGS{hasTracks && ` · ${inventory.length}`}
        </GhostPill>
      </div>
    </div>
  );
}
