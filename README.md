# GRVD DAW — v2 Prototype

A gamified, tamagotchi-style music creation tool for the GRVD game.
Built to prove the four-phase vision from `../DAW_BUILD_INSTRUCTIONS.md`.

## What this is

A web prototype of the **Artist DAW** — the hook-first, under-60-second
music creation tool that lives inside the GRVD Unreal Engine 5.3.2 game as
an in-world companion item. No shipped audio samples — every sound is
synthesized at runtime with Tone.js, so the whole app is self-contained.

## What maps to which phase

| Phase from the build instructions | Implemented here |
|---|---|
| **Phase 1 — The 60s Loop** | `TemplatePicker` → `StackingView` → `NameAndSave` → `Done`. Five templates, 22 curated sounds, WAV export via `OfflineAudioContext`. |
| **Phase 2 — Tamagotchi Soul** | `TamagotchiFace` (SVG, 7 moods), `NeedsMeters` (social / creativity / energy), daily decay in `store.applyDailyDecay()`, reactions on finish/abandon. |
| **Phase 3 — Vocals & Hooks** | `VocalRecorder` with `getUserMedia`, karaoke-style lyric prompt, autocorrelation pitch estimator, pitch-snap minigame, score 0–100. |
| **Phase 4 — Social Hooks** | `ListeningBooth` (async cards, 5-second "listen before you see" gate, match flow) + `Coop` (local peer sim, collaborators attached to saved songs). |

## File map

```
src/
├── App.tsx                 # routes between stages
├── main.tsx
├── index.css               # tailwind + custom keyframes (bob, wiggle, pulsebeat, scan)
├── audio/
│   └── engine.ts           # Tone.js engine, pattern scheduling, WAV export, pitch estimator, MediaRecorder
├── data/
│   ├── types.ts            # Song / Layer / Template / Tamagotchi / ArtistCard
│   ├── sounds.ts           # 22 curated sound options, playfully named ("boom", "tss", "woooom")
│   └── templates.ts        # 5 hook-first templates (trap, boom-bap, drill, pop-rap, punchline)
├── store/
│   └── useStore.ts         # Zustand store: stage machine + tamagotchi state + inventory + booth
└── components/
    ├── TamagotchiFace.tsx  # the soul — SVG face w/ mood-based animation
    ├── NeedsMeters.tsx
    ├── Crib.tsx            # idle state — pull the DAW out, check on companion
    ├── TemplatePicker.tsx  # Phase 1.1
    ├── StackingView.tsx    # Phase 1.2 — THE core recipe mechanic
    ├── VocalRecorder.tsx   # Phase 3
    ├── NameAndSave.tsx     # Phase 1.3 + WAV export
    ├── Done.tsx            # celebration + auto-play of the finished song
    ├── Logbook.tsx         # inventory viewer, replay past songs
    ├── ListeningBooth.tsx  # Phase 4.1
    └── Coop.tsx            # Phase 4.2
```

## How to run

This folder symlinks its `node_modules` to the parent `../node_modules`
because the sandbox has no npm registry access. On a normal dev machine:

```
cd daw-v2
rm node_modules   # if symlinked
npm install
npm run dev       # http://localhost:5173
```

### Known local-env note

`npx vite build` fails in this sandbox with
`Cannot find module '@rollup/rollup-linux-arm64-gnu'` because the shared
`node_modules` was installed for a different architecture. This is an
environment issue, not a code issue. `npx tsc -b` compiles cleanly, which
confirms the code is type-correct. On a fresh dev machine with a local
`npm install`, `npm run build` will work.

## What this demonstrates

1. **Under 60 seconds to a finished hook.** Template → 4–6 taps → name → save.
2. **Bad outcome is impossible.** Every template's "suggested" pool is pre-curated; stacking never produces a dissonant mix.
3. **The DAW is alive.** Face reacts to mood. Mood derives from needs. Needs decay over time. Finishing a song visibly changes the companion's state.
4. **Sound named as it sounds.** `boom`, `tss`, `woooom`, `skrrr` — not filenames.
5. **Hook-first, not song-first.** Templates are 2–4 bars. WAV exports are hook-length, TikTok-shaped.
6. **Silent data trail.** Every pick/swap is already tracked in the store (ready to wire up to a real tastemaker model later).
7. **Collab as first-class.** Saving while linked to a coop peer attaches their name to the song's metadata.

## What this deliberately does NOT do

Per `../DAW_BUILD_INSTRUCTIONS.md` §14 and the Phase sequencing:

- No Producer DAW (sound design, pack curation, selling). Deferred by design.
- No real network multiplayer. Coop is simulated locally.
- No Unreal integration yet. This is the pre-port web prototype.
- No 3-minute song composition. Hook-first is the whole point.
- No manual sound tagging. Tags live on the data, not on player inputs.
- No rating prompts. Behavior signals only.

## Porting to UE5.3.2

This prototype is structured to port cleanly:

- `src/data/types.ts` → mirror as C++ structs / UE data assets.
- `src/store/useStore.ts` → mirror as a `UGrvdDawSubsystem` with replicated
  properties for the tamagotchi state and inventory.
- `src/audio/engine.ts` → rewrite as a C++ plugin using MetaSounds for
  synthesis, `USoundWave` for the vocal capture, `UGameplayStatics` for
  scheduling. Keep the JSON song schema identical.
- Every React component → UMG widget (`UUserWidget`), triggered by the
  in-world DAW item's interaction.
- WAV export → engine-side bake to a `USoundWave` asset attached to the
  CD inventory item.

## Open items (feeding back to the instructions doc)

- Actual sample licensing / original seed pack is still the biggest open
  question before we can replace the synthesized sounds.
- Producer DAW path — still need a team decision on progression vs.
  separate mode.
- Tamagotchi personality bandwidth — is the companion generic, or does it
  diverge per player?
