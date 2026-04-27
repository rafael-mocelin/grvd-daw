# GRVD — Design brief: the Home page, six prototypes (opinionated)

Hand this doc to Claude Design (or any designer) and ask for 6 distinct
homepage prototypes. It is deliberately opinionated about the product
and the vibe, and deliberately loose about the visual direction so the
prototypes actually diverge from each other.

---

## What GRVD is, in one paragraph

GRVD is a tamagotchi-shaped music-making device that lives on your
screen. It is half DAW (digital audio workstation — a thing you make
songs with), half toy companion, and half social platform. You open it
and there is a physical-looking plastic shell with eyes that track your
cursor, a mouth that talks to you, and a screen in the middle where the
actual app lives. The whole product is built to feel like an object
you would pick up off a shelf at a 7-11 in Shibuya — vibrant, warm,
tactile, toy-like, Funko-Pop-adjacent, streetwear-adjacent, but never
cute-for-cute's-sake. It will eventually ship inside an Unreal Engine
game as an in-world object.

The user is simultaneously three roles, which emerge from how they
spend their time rather than from a signup flag:

- **Artist** — makes songs in the DAW and publishes them.
- **Tastemaker / Fan** — listens to other people's drops, rates them,
  pushes the ones they believe in. Their taste has weight in the app
  economy.
- **Producer** (future) — builds sound kits (templates) that artists
  then use to cook their own songs on.

Publishing is the scarce action. Creation and consumption are free.
Every player has an energy bar (100 units, regenerates 1/5min), and
spending energy is how you publish, push, or visit. Energy is never
a blocker to listening, rating, or making drafts.

---

## What the Home page is

The Home page is what the player sees when they first open the app
and whenever they press the back/home button. It is the three-path
chooser — the daily "what are we doing today?" moment.

Today it has three large CTAs:

1. **Listen to fresh drops** — takes you to the Listening Booth, where
   published songs play anonymously and you rate them. Cyan/electric
   palette.
2. **Cook something up** — takes you into the DAW. This is where
   songs get made. Hot pink/magenta palette.
3. **Visit a crib** — a future multiplayer scene visit. Placeholder
   today, greyed-out. Purple palette.

Secondary elements below the CTAs:
- Three horizontal needs meters (Social, Creativity, Energy) — the
  tamagotchi's care stats, not the publishing-tier energy.
- Two small ghost buttons: Coop and Logbook (the player's own song
  archive).
- A greeting line from the companion ("what are we doing today?" or
  mood-keyed variants like "LISTEN. COOK. VISIT. LET'S DO ALL OF IT").

At the top of the screen, a persistent thin strip ALWAYS shows:
- An energy meter (100 units, with a cool teal-to-blue gradient)
- An XP bar with the current level

These are part of the device chrome and should stay consistent across
every prototype. Design around them.

---

## Constraints you must respect

- **Lives inside a device shell.** The Home page is NOT a fullscreen
  web page. It renders inside the plastic device's screen area, which
  is roughly 4:3 with rounded corners — think a retro handheld. The
  prototypes should feel at home inside a physical-looking enclosure.
- **Viewport at 100% UI zoom is narrow** (maxWidth ~520px, centered).
  The prototypes should respect this reading column; they should not
  rely on horizontal width.
- **Always-present top strip** with energy + XP meters. Do not cover
  or redesign this strip — design around it.
- **Companion dialogue appears at the top of the shell**, outside the
  screen area, as a ticker-style marquee. You do not have to design
  this, but you should know it exists.
- **No localStorage, cookies, or accounts-in-design.** The home page
  is the same whether the user is signed in or a guest. Role isn't
  displayed; it's implied.
- **It must work on a touch device too.** Tap targets >= 44px.

---

## Voice and tone

- Lowercase, punchy, streetwear-adjacent copy. "cook something up",
  "fresh drops", "listen · create · visit".
- Never corporate. Never cute-baby-gaming. Think more Tyler, the
  Creator's artwork than Duolingo.
- Playful with typography. Mixing a bold display face with a retro
  monospace. Data labels in SCREAMING UPPERCASE MONO with wide
  tracking. Headlines in a condensed geometric sans.
- Colors vibrant but never neon-cheap. Cyan, hot pink, yellow, purple,
  teal — the palette is a warm Funko Pop toy, not a RGB gaming PC.
- Dark background always. Light UI on dark shell.

---

## What to design

**Six distinct homepage prototypes, each exploring a different center
of gravity.** The point is that they should NOT all look like the
same page with different colors — they should make meaningfully
different product bets about what the Home page is FOR.

Suggested axes to pull on (pick any six, combine if you want):

- **"Three big buttons"** — lean hard into the three-CTA trichotomy.
  Each CTA enormous, tactile, commits all-the-way to its role color.
- **"Companion-forward"** — the tamagotchi mascot dominates; CTAs
  live as small secondary actions around it. The companion's mood is
  the page.
- **"Magazine / editorial"** — feels like flipping open a streetwear
  zine. Typography-driven, big words, drop-cap headlines, artist of
  the week hero image.
- **"Arcade cabinet"** — scorebox aesthetics, CRT scanlines, neon
  signage, high-scores panel. Leans into the device-is-a-toy read.
- **"Social feed"** — shows live activity: who just pushed your
  song, who just published, what's trending. Feels like a mini
  social app. CTAs become navigation tabs instead of the page.
- **"Minimal / poetic"** — mostly blank, one line of copy, three
  tiny options at the bottom. Treats the home as a pause moment,
  not a launchpad. Generous negative space.
- **"Card pile"** — homepage is a shuffle of cards (today's drop,
  your last draft, your fan count, a recommended artist). Player
  flicks through. CTAs implicit from which card they pick.
- **"Toy device detail"** — leans hard into the physical shell
  language. Brushed plastic, seams, screws, sticker-pack aesthetic.
  CTAs as physical buttons rather than digital panels.

Or invent your own angles. The six should genuinely feel different
enough that a critique would spark a real product conversation.

---

## Ingredients you can use

Drop any of these into the layouts:

- Three emoji-or-icon affordances for the CTAs: 🎧 (listen), 🎛️ (cook),
  🏠 (visit).
- A persistent energy number like `87/100` and a level like `L1`.
- A mood-keyed companion line (examples: "three ways in — let's go",
  "pick a vibe. listen, cook, or drop by someone's crib.", "LISTEN.
  COOK. VISIT. LET'S DO ALL OF IT.")
- Three thin meters for the tamagotchi's needs (Social, Creativity,
  Energy) — secondary data, not the publishing-tier energy above.
- A tiny XP number like `0 XP` or `127 XP ↑` with a progress bar to
  the next level.
- Chips / tags for artist genre (trap, drill, boom-bap, pop-rap).
- The current artist roster for the booth (placeholders):
  echo saint 🦊, wire candle 🌊, rafi 🖤, glassfish 🌻, lucid pond 🌙.

---

## Deliverables

Six separate home page mockups. Single-frame each. Dark theme.
Sized to approximately 520px wide by 800px tall. Label each one with
its center of gravity (e.g. "Prototype 3 — Magazine / Editorial").

Add a one-sentence rationale under each: what product bet this
layout is making and who it's for.

Do not output code. Static visual mockups only.

---

## Out of scope

- The device shell itself (top eye row, bottom button row, side
  bezels). Assume it exists and design the screen content only.
- Other pages (Booth, Template Picker, etc.). Home only.
- Signed-out state. Assume the player has a tamagotchi companion
  and some amount of XP / inventory.
- The Unreal Engine port. Web-first prototypes for now.
