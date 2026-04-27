# GRVD — Design brief: the Home page, six prototypes

Hand this to the designer. It explains what the product is and what the
Home page has to accomplish. It does NOT prescribe visual direction —
colors, typography, vibe, references are all yours to choose. Make the
six prototypes meaningfully different from each other.

---

## What GRVD is

GRVD is a music-making app with a tamagotchi companion baked into it.
Part DAW (a thing you make songs with), part toy (a pet that responds
to how you treat it), part social platform (you publish what you make,
and other people rate it and push the ones they believe in). It will
eventually live inside an Unreal Engine game as an in-world object, so
it's designed to feel like a self-contained device you pick up and use,
not a web page.

Every player is simultaneously three roles, which emerge from how they
spend their time rather than from any signup flag:

- **Artist** — makes songs and publishes them.
- **Tastemaker / Fan** — listens to other people's drops, rates them,
  pushes the ones they believe in. Their taste has weight in the
  app's economy.
- **Producer** (future) — builds sound kits that artists then use to
  make their own songs.

The one economic rule worth knowing: creation and consumption are free
(jamming, listening, rating, drafting). Publishing is the scarce
action — publishing a song, publishing a kit, pushing someone else's
song — and it spends energy. Every player has an energy bar that
regenerates in real time. Energy is never a blocker to anything you
do alone; it only gates actions that put something out into the world.

---

## What the Home page is for

The first thing a player sees when they open the app, and where they
return between activities. Its job is to answer the question "what
are we doing today?" by surfacing the three paths the app offers:

1. **Listen** — dive into other people's music and react to it.
2. **Create** — open the DAW and make something.
3. **Visit** — drop by another player's space (future, placeholder
   today — this path exists but doesn't go anywhere yet).

Each path should feel like a live invitation, not a menu item. The
player is choosing a mood for the session more than a destination.

---

## What must be on the page

- A clear way into each of the three paths above.
- A visible companion greeting — the tamagotchi says something short
  that changes with its mood. (The greeting copy is editable; the
  fact that the companion acknowledges the player is what matters.)
- Access to the player's saved songs and to a coop session.
- The player's care-stats for the companion (three simple meters:
  social, creativity, wellbeing of the pet — distinct from the
  publishing-tier energy below).

A persistent strip above the Home content shows the player's
publishing energy (a 0–100 bar) and their current level + XP. That
strip is part of the device chrome, present on every page of the
app. You don't need to design it; design around the fact that it's
there.

---

## Constraints that matter

- The Home page lives inside the screen area of a handheld-style
  device, not edge-to-edge on a browser window. Think: the content
  area of a game cartridge device, with chrome around it.
- It must work for a signed-in player AND a guest with no data.
- Touch-first. Tap targets generous.
- Respect that there is a top strip showing the player's energy and
  XP. Don't cover it, don't recreate it.

Everything else — layout, typography, color, illustration, motion,
referents — is open. Don't anchor to any particular aesthetic unless
you want to. The six prototypes should make different product bets,
not different color choices. If four of them look like the same page
with different palettes, we've failed.

---

## Deliverables

Six distinct Home page mockups. Static frames. Sized around
520×800px to match the device's screen area.

Label each prototype with a short name and one sentence explaining
the product bet it's making and who it's for. Examples of the KIND
of bet we mean (not the bets themselves — invent your own):

- "This one bets the companion is the star; paths are secondary."
- "This one bets Home is a news feed; paths are navigation."
- "This one bets Home is a pause state; paths are whispered, not
  shouted."

If two prototypes end up making similar bets, drop one and try
again. Real divergence is the whole point.

---

## Out of scope

- The device shell itself (eye row, button row, side bezels).
  Assume it exists; design the screen content.
- Other pages in the app (Listening Booth, DAW, etc.).
- Signed-out onboarding / signup flow. Guest state = same Home.
- The Unreal Engine port. Web-first prototypes for now.
