# GRVD — Game-feel manifesto (structural only)

Half a page. Locks ONLY the structural decisions that are expensive to
reverse later. Does NOT prescribe colors, typography, illustration style,
or animation library — that's real design work for a real designer, once
features are done.

Last updated: 2026-04-23

---

## Reference

**Brawl Stars.** Cartoonish realism. Avatar-forward. Chunky UI with bounce
on press. Icons lead, words trail. Currency + progress always on-screen.
Not a workflow app — not Miro, not Figma, not a DAW-as-pro-tool.

---

## Structural commitments (hard to reverse)

1. **Infinite canvas is out.** The DAW's pan-around canvas (StackingView,
   VocalRecorder, NameAndSave inside CanvasBoard) gets replaced with a
   series of focused screens you step through. Drag, swipe, scroll —
   never zoom-and-pan-around.

2. **Avatar-forward.** Your character (emoji today, real rig later) is the
   visual center of Home and Profile. Other screens orbit it.

3. **Icons over text.** Any nav element where a symbol reads clearly uses a
   symbol. Words are for things that must be read: song titles, artist
   names, companion dialogue.

4. **Currency + progress always on-screen.** Energy + XP + level never drop
   out of frame. The persistent top strip stays; may grow.

5. **One-viewport screens where possible.** Each screen fits without
   scrolling the page. When content exceeds the viewport, scroll happens
   inside a panel — not a long-scroll page. Brawl Stars does this
   religiously.

6. **One primary action per screen.** The hero CTA is huge, obvious, and
   visually different from every secondary button. No three-button
   ambiguity.

---

## What is deliberately NOT decided here

Colors. Typography. Character design. World / zone / room metaphor.
Illustration style. Animation library. Sound palette. Button shapes beyond
"chunky with press-bounce." All real design work — handled by a game-UI
designer (human) at the end, once every feature screen exists to redesign.

---

## Consequence for building from here forward

Every new screen must respect rules 1–6. Visual polish waits. The current
Home / Booth / Profile / Friends / Leaderboard screens all still need an
eventual redesign pass, but their structure already matches these rules
so they'll survive it without restructuring.

**The canvas stages (stack / vocal / name / arrange / mixer) are the
exception.** They violate rule #1 directly and need real structural rework
to become a step-through flow. That's a separate phase, AFTER multiplayer
(Phase 4) and inventory (Phase 5) are in.
