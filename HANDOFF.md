# GRVD DAW — Full Project Handoff

## What This Is

**GRVD** is a tamagotchi-style mobile-first DAW (Digital Audio Workstation) built as a web app. The concept: making a beat should feel like a 60-second creative game, not a professional tool. The user picks a template (e.g. "Trap Hook at 142 BPM"), stacks sounds layer by layer through a guided "recipe", optionally records a vocal hook with karaoke-style prompts, names the song, and saves it to an inventory.

The companion character is a **tamagotchi** that reacts to how much the user creates — neglect it and its mood drops, make songs and it gets hyped. There are **XP points**, **achievements**, and a **Listening Booth** where songs get "reviewed."

The target audience is beginner music creators / young people who want to feel like a rapper/producer without needing any music knowledge.

---

## File Locations

### Local (dev machine)
```
/mnt/grvd/daw-v2/          ← root of the project (workspace folder)
  src/
    App.tsx                 ← root component + stage router
    main.tsx                ← Vite entry point
    audio/
      engine.ts             ← ALL audio logic (Tone.js, recording, autotune)
    components/
      ArrangeView.tsx       ← song arrangement grid with moving playhead
      CanvasBoard.tsx       ← zoomable infinite canvas (Miro-style)
      CanvasWindow.tsx      ← draggable floating window on the canvas
      MixerView.tsx         ← channel strips (faders, FX buttons, pan)
      VocalRecorder.tsx     ← karaoke recorder + lyrics editor + pitch scoring
      StackingView.tsx      ← sound-picking step (the "recipe" cards)
      TemplatePicker.tsx    ← BPM/genre template selection
      DeviceShell.tsx       ← phone-shaped outer shell UI
      Crib.tsx              ← home screen with tamagotchi
      Done.tsx              ← song finished screen
      NameAndSave.tsx       ← naming + export step
      ListeningBooth.tsx    ← inventory playback screen
      AuthScreen.tsx        ← Supabase login/signup
      Coop.tsx              ← real-time co-production (Supabase Realtime)
      TamagotchiFace.tsx    ← animated character face
      NeedsMeters.tsx       ← social/creativity/energy bars
      AchievementToast.tsx  ← XP unlock popups
      XPFlash.tsx           ← floating XP number animations
      Logbook.tsx           ← session history
      StatsPanel.tsx        ← lifetime stats overlay
    data/
      types.ts              ← ALL TypeScript interfaces (Layer, Song, Template…)
      sounds.ts             ← sound library (synth + file-backed)
      templates.ts          ← beat templates (BPM, key, recipe, suggested sounds)
      achievements.ts       ← achievement definitions + XP values
    store/
      useStore.ts           ← Zustand v5 global state store
    lib/
      supabase.ts           ← Supabase client init
      auth.tsx              ← auth context + hooks
      db.ts                 ← Supabase DB helpers (upsertSong, loadUserData…)
      useSync.ts            ← real-time sync hook
    shell/
      skins.ts              ← UI skin/theme definitions
  public/
    sounds/
      drums/                ← real drum loop WAV files (BPM-tagged)
      808/                  ← real 808 bass WAV files
      hihat/                ← real hi-hat WAV files
      samples/              ← melodic loop WAV files
```

### Online
- **GitHub repo**: `https://github.com/rafael-mocelin/grvd-daw`
- **Live deployment**: `https://grvd-daw.vercel.app` (auto-deploys from main branch on Vercel)
- **Supabase project**: used for auth + song persistence + real-time co-op (credentials in `src/lib/supabase.ts`)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript + Vite (port **5174** locally) |
| Audio engine | **Tone.js v15** — scheduling, synths, effects, transport |
| State | **Zustand v5** — `useStore` is the single source of truth |
| Backend / Auth | **Supabase** — auth, PostgreSQL, Realtime channels |
| Styling | Pure inline styles (no CSS framework) |
| Deployment | **Vercel** (auto-deploy from GitHub main) |

---

## How to Run Locally

```bash
cd /mnt/grvd/daw-v2
npm install          # first time only
npm run dev          # starts Vite dev server
# open http://localhost:5174
```

TypeScript check (no build needed, just type-safety):
```bash
npx tsc --noEmit
```

Deploy: just push to GitHub main — Vercel picks it up automatically.

---

## Architecture: How the App Works

### Stage Machine
The app is a linear state machine with these stages (defined in `useStore.ts`):
```
crib → template → stack → vocal → name → done → booth
                                              ↓
                                           coop (multiplayer)
```
`App.tsx` switches on `stage` from the store and renders the correct screen.

### Audio Engine (`src/audio/engine.ts`)
This is the most critical file. Everything audio-related lives here.

**Key concepts:**
- `playSong(song, vocalBuffer)` — starts the Tone.js transport, builds all instruments, schedules patterns
- `stopSong()` — tears down all nodes, clears all maps
- `buildVoice(layer, vocalBuffer, bpm)` — dispatches to the right voice builder per `LayerKind`
- `layerVolumes: Map<string, Tone.Gain>` — per-layer gain nodes (fader control)
- `layerGainValues: Map<string, number>` — remembered gain for mute/unmute restore
- `updateMuteState(layerId, muted)` — used by ArrangeView's RAF loop for per-section muting
- `setLayerVolume(layerId, linear)` — called by MixerView fader drag
- `vocalPitchShift: Tone.PitchShift | null` — global ref to live autotune node
- `setVocalAutotuneEnabled(enabled)` — toggles autotune wet/dry (called by Mixer AT button)
- `setVocalPitchCorrection(semitones)` — pre-calculates pitch snap after recording
- `calculatePitchCorrection(pitches, keyRoot)` — finds median pitch → nearest minor scale note → semitone offset
- `recordVocal(maxSeconds, onLevel?)` — mic → WebAudio graph → MediaStreamDestination → MediaRecorder. Uses `Tone.getContext().rawContext` for decoding to avoid sample-rate conflicts. `onLevel` callback drives the live VU meter.
- `estimatePitchContour(buffer)` — autocorrelation pitch detection, returns MIDI note array

**Real audio files** (in `public/sounds/`):
- Drums, 808s, hi-hats, and samples have real WAV files with `nativeBpm` metadata
- Engine uses `playbackRate = templateBpm / nativeBpm` to time-stretch them to the session BPM
- Synth fallbacks exist for all kinds if CDN samples fail

**Sample CDNs used:**
- Drums: `https://tonejs.github.io/audio/drum-samples/CR78/`
- Piano/melody: `https://tonejs.github.io/audio/salamander/` (Salamander Grand)

### State Store (`src/store/useStore.ts`)
Key state fields:
- `stage` — current screen
- `layers: Layer[]` — the stacked sounds (including vocal after recording)
- `activeTemplate: Template | null` — chosen BPM/key/recipe
- `vocalBuffer: AudioBuffer | null` — decoded audio buffer from recording
- `vocalBlobUrl: string | null` — blob URL for saving/playback
- `arrangeMutes: Record<string, boolean>` — per-section mute state, keyed `"kind:sectionId"`, saved in Song
- `totalXP`, `unlockedAchievements` — gamification
- `inventory: Song[]` — finished songs
- `tamagotchi: Tamagotchi` — companion character state

Key actions:
- `pickLayer(kind, variant, soundId)` — adds/replaces a layer, advances recipe index
- `setVocal(buffer, blobUrl, score)` — stores vocal AND adds a `vocal` Layer to `layers[]` so it appears in ArrangeView
- `setArrangeMutes(m)` — saves arrange mute state to store (persisted in Song)
- `finalizeSong()` — builds a `Song` from current state including `arrangeMutes`, saves to Supabase if logged in

### ArrangeView (`src/components/ArrangeView.tsx`)
- Shows all layers as colored track rows
- Sections: INTRO(4 bars), VERSE(8 bars), HOOK(4 bars, unlocked), CHORUS(4 bars, unlocked), BRIDGE(4 bars), OUTRO(4 bars)
- HOOK + CHORUS are unlocked from the start (= the playable 8-bar loop for beginners)
- Others unlock via XP thresholds (INTRO: 600XP, VERSE: 800XP, BRIDGE: 1200XP, OUTRO: 2000XP)
- Click a section block to mute/unmute that layer in that section
- RAF loop reads transport position → calls `updateMuteState` each frame for per-section muting
- Play/stop button calls real `playSong`/`stopSong` from engine
- Playhead is draggable (pointer capture), uses `LABEL_W = 80px` offset correction

### VocalRecorder (`src/components/VocalRecorder.tsx`)
- Recording = exactly 4 bars = one HOOK block (`BARS_PER_LINE=2 × 2 lines`)
- At 140 BPM: ~6.9s. At 90 BPM: ~10.7s
- **Editable lyrics**: user can tap "✏️ edit lyrics" to replace default lines with custom ones
- Syllable-level karaoke highlighting (vowel-cluster regex splitter)
- Live VU meter during recording confirms mic is capturing
- After recording: calculates pitch correction → `setVocalPitchCorrection()` → autotune ON by default

### MixerView (`src/components/MixerView.tsx`)
- Vertical fader drag → `setLayerVolume(id, linear)` → real gain change
- **AT button on vocal strip is wired**: toggles `setVocalAutotuneEnabled()` on the live `Tone.PitchShift` node
- Other FX buttons (REV, DLY, DIST, LP) are currently UI-only placeholders — not yet wired to real effects

### CanvasBoard (`src/components/CanvasBoard.tsx`)
- Infinite zoomable canvas (Miro-style)
- Zoom anchors to mouse cursor position (flushSync + scroll correction math)
- CanvasWindow components are draggable floating panels

---

## Data Types (`src/data/types.ts`)

```typescript
type LayerKind = "drums" | "kick" | "snare" | "hat" | "808" | "sample" | "melody" | "vocal"

interface Layer {
  id: string           // unique, regenerated on swap — use kind for stable identity
  kind: LayerKind
  variant: string      // e.g. "boom", "trap", "hook"
  soundId: string      // reference to SoundOption.id
}

interface Song {
  id, name, bpm, bars, keyRoot, templateId
  layers: Layer[]
  tags, collaborators, createdAt
  vocalBlobUrl?: string      // ephemeral blob: URL (only valid in current browser session)
  pitchScore?: number        // 0-100 from karaoke pitch detection
  arrangeMutes?: Record<string, boolean>  // "kind:sectionId" → muted
}

interface Template {
  id, name, subtitle, bpm, bars, keyRoot, tags
  recipe: LayerKind[]        // the ordered guided steps
  hookLine: string           // one-liner for karaoke display
  verse?: string[]           // full verse lines for recording
  suggested: Partial<Record<LayerKind, string[]>>  // curated sound IDs
}
```

---

## Known Quirks / Important Notes

### Audio
- **Two AudioContexts = static**: never create `new AudioContext()` while Tone.js is running. Always use `Tone.getContext().rawContext` for any Web Audio operations.
- **MediaRecorder + createMediaStreamSource conflict**: mic stream must be routed through `createMediaStreamSource → MediaStreamDestination → MediaRecorder` (not directly). This was a Chrome bug that caused silent recordings.
- **Mute state keyed by `layer.kind`** (not `layer.id`): `layer.id` is regenerated every time `pickLayer` is called to swap a sound. `kind` is stable and is the correct key for mute state.
- **Autotune**: `Tone.PitchShift` with `windowSize: 0.08` (80ms) is in the vocal chain by default with `wet=1`. The AT button in Mixer toggles `wet` 0↔1 on the live node without stopping playback.

### XP / Unlocks
- Sections unlock via XP thresholds — be careful not to lower thresholds or sections will unlock during normal sound browsing
- Current thresholds: INTRO=600, VERSE=800, BRIDGE=1200, OUTRO=2000
- HOOK and CHORUS are always unlocked (beginners' 8-bar loop)

### Supabase / Auth
- Auth is handled by a separate account that set up the Supabase project
- `src/lib/supabase.ts` has the project URL + anon key
- Songs are persisted via `upsertSong()` in `src/lib/db.ts` when a user is logged in
- Real-time co-production uses Supabase Realtime channels in `Coop.tsx`

### `vocalBlobUrl` is ephemeral
- `blob:` URLs are only valid in the current browser session
- When a song is loaded from Supabase on a new session, `vocalBlobUrl` will be invalid
- For persistent vocal storage, the blob needs to be uploaded to Supabase Storage (not yet implemented)

### Vocal in ArrangeView
- After recording, `setVocal()` automatically adds a `vocal` Layer to `layers[]`
- The vocal layer uses `soundId: "vocal-recorded"` which doesn't exist in the sounds DB — this is intentional, the engine uses `vocalBuffer` directly and ignores the soundId
- Vocal loops every 4 bars (calculated from actual buffer duration, not song.bars)

---

## What's Placeholder / Not Yet Wired

| Feature | Status |
|---------|--------|
| REV, DLY, DIST, LP buttons in Mixer | UI only — no real audio effect connected |
| Supabase Storage for vocal audio | Not implemented — blob URLs are ephemeral |
| `renderSongToWav()` in engine | Implemented but no UI button to trigger it |
| Template `verse` override of 2-line default | Templates still have 8-line verses — VocalRecorder only uses first N lines based on timing |
| ListeningBooth mute playback | Doesn't read `arrangeMutes` from saved song |

---

## Porting to Unreal Engine

This is technically feasible but non-trivial. Key considerations:

### What maps to Unreal
| Web concept | Unreal equivalent |
|---|---|
| React component tree | UMG (Unreal Motion Graphics) Widget Blueprint tree |
| Zustand store | Game Instance subsystem or a custom UObject with UPROPERTY |
| Tone.js audio engine | MetaSounds (UE5) or the Audio Mixer API |
| Canvas/zoom UI | UMG Canvas Panel + RenderTransform scaling |
| RAF playhead loop | Tick function on an Actor or Widget |
| Supabase REST/Realtime | HTTP plugin + WebSockets plugin |

### The audio challenge
Tone.js does a lot of heavy lifting — pattern scheduling, granular pitch shifting, synthesis. In Unreal:
- **MetaSounds** (UE5.1+) can handle real-time synthesis and effects including pitch shifting
- Pattern scheduling would need a custom Blueprint or C++ tick-based sequencer
- The 808 synthesis (MonoSynth + filter envelope) maps to MetaSounds oscillator + filter nodes
- `Tone.PitchShift` (phase vocoder) has no direct MetaSounds equivalent — would need a custom DSP plugin or use a third-party plugin like **Resonance Audio** or **AudioGameKit**

### The UI challenge
- The tamagotchi/canvas/window layout is very web-native
- In UMG, the draggable CanvasWindow panels would use `UDragDropOperation`
- The infinite canvas zoom would use Widget `RenderTransform.Scale` + scroll offset math (same math as the current `flushSync` approach)
- Font rendering and `monospace` styling needs to be replaced with a custom font asset

### Recommended porting approach
1. **Keep the backend**: Supabase works fine from Unreal via the HTTP plugin — no change needed
2. **Port state logic first**: rewrite `useStore.ts` as a Game Instance subsystem with the same fields and actions
3. **Port audio second**: start with MetaSounds for drums/808/melody, use `USoundWaveProcedural` for the vocal player
4. **Port UI last**: UMG can replicate the aesthetic if you import the right fonts and handle the dark glass-morphism style via custom materials
5. **Skip Tone.PitchShift for now**: implement a simpler pitch correction using `USoundWave` playback rate manipulation as a first pass

### What to keep as web
The Listening Booth, co-op screen, and auth screens are much easier to keep as web views embedded in Unreal via a `WebBrowser` widget, while the core DAW loop (stacking, arrange, mixer) is ported natively. This hybrid approach is realistic for a 3-6 month project.

---

## Development Workflow

1. All local edits are in `/mnt/grvd/daw-v2/src/`
2. Vite hot-reloads on save — no manual refresh needed
3. Run `npx tsc --noEmit` before any commit to catch type errors
4. Push to GitHub main → Vercel auto-deploys to `https://grvd-daw.vercel.app`
5. No test suite currently exists — manual testing in browser

## Quick Orientation Test
Load the app → pick "Trap Hook" template → add a kick + hat → go to Arrange → press Play. You should hear the beat. If silent, check browser console for `[playSong]` or Tone.js errors.
