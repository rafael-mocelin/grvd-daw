import type { Template } from "./types";

/**
 * Hook-first templates — each is a short (4-bar) loop based on common
 * structures in modern rap/trap/pop-rap hits. The "recipe" defines the
 * order the DAW asks the player to fill in. Every entry in "suggested"
 * is guaranteed to sound good together.
 */
export const TEMPLATES: Template[] = [
  {
    id: "tpl-grvd-real",
    name: "GRVD Test",
    subtitle: "Real samples — your actual sounds",
    bpm: 150,
    bars: 4,
    keyRoot: "D#",
    tags: ["trap", "rap"],
    recipe: ["drums", "hat", "808", "sample", "vocal"],
    hookLine: "I put that on everything, I been working",
    verse: [
      "I put that on everything, I been working every night",
      "Stack the sounds, lock the 808, everything just right",
      "No days off in the booth, grinding for the light",
      "GRVD life we building, gonna take it to new heights",
      "Drums hit hard, melody smooth, recipe on lock",
      "Every layer that I add make the whole thing rock",
      "From the basement to the penthouse, never gonna stop",
      "GRVD certified, yeah we certified at the top",
    ],
    suggested: {
      drums:  ["r-drums-150", "r-drums-160", "r-drums-165-Fm"],
      hat:    ["r-hat-150", "r-hat-160", "r-hat-128"],
      "808":  ["r-808-150-Dsm", "r-808-144-Em", "r-808-144-Fm"],
      sample: ["r-melodic-Gm", "r-bells-Fm", "r-vinyl-Em", "r-sample-Bm"],
    },
  },
  {
    id: "tpl-trap-hook",
    name: "Trap Hook",
    subtitle: "Central Cee / Ice Spice energy",
    bpm: 142,
    bars: 4,
    keyRoot: "A",
    tags: ["trap", "pop-rap"],
    recipe: ["kick", "hat", "808", "sample", "melody", "vocal"],
    hookLine: "I been ridin' round, I been gettin' it",
    suggested: {
      kick: ["k-trap", "k-halftime"],
      hat: ["r-hat-160", "r-hat-150"],
      "808": ["b-move", "b-root"],
      sample: ["r-bells-Fm", "r-sample-Bm"],
      melody: ["m-bell", "m-flute"],
    },
  },
  {
    id: "tpl-boom-bap",
    name: "Boom-Bap Hook",
    subtitle: "Classic head-nod, chopped soul",
    bpm: 90,
    bars: 4,
    keyRoot: "D",
    tags: ["boom-bap", "rap"],
    recipe: ["kick", "snare", "hat", "sample", "vocal"],
    hookLine: "Every day I'm on my grind, watch me work",
    suggested: {
      kick: ["k-boom"],
      snare: ["s-clap", "s-rim"],
      hat: ["r-hat-150"],
      sample: ["r-vinyl-Em"],
    },
  },
  {
    id: "tpl-drill",
    name: "Drill Hook",
    subtitle: "Half-time, dark, menacing",
    bpm: 148,
    bars: 4,
    keyRoot: "F",
    tags: ["drill"],
    recipe: ["kick", "snare", "hat", "808", "sample", "vocal"],
    hookLine: "In the city with my team, we don't play",
    suggested: {
      kick: ["k-halftime", "k-trap"],
      snare: ["s-halftime"],
      hat: ["r-hat-160"],
      "808": ["b-long", "b-move"],
      sample: ["r-sample-Bm"],
    },
  },
  {
    id: "tpl-pop-rap",
    name: "Pop-Rap Hook",
    subtitle: "Bright, bouncy, TikTok-ready",
    bpm: 110,
    bars: 4,
    keyRoot: "C",
    tags: ["pop-rap"],
    recipe: ["kick", "snare", "hat", "sample", "melody", "vocal"],
    hookLine: "Light it up, light it up, baby feel the beat",
    suggested: {
      kick: ["k-bounce", "k-trap"],
      snare: ["s-clap"],
      hat: ["r-hat-128", "r-hat-150"],
      sample: ["r-bells-Fm", "r-melodic-Gm"],
      melody: ["m-bell", "m-pluck"],
    },
  },
  {
    id: "tpl-punchline",
    name: "Punchline",
    subtitle: "Hook + 1 vocal — under a minute",
    bpm: 100,
    bars: 2,
    keyRoot: "E",
    tags: ["rap"],
    recipe: ["kick", "hat", "sample", "vocal"],
    hookLine: "They sleepin', they sleepin', wake up, wake up",
    suggested: {
      kick: ["k-boom", "k-trap"],
      hat: ["r-hat-150", "r-hat-160"],
      sample: ["r-vinyl-Em", "r-sample-Bm"],
    },
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
