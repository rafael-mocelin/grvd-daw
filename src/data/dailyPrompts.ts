/**
 * Daily Drop — prompt definitions.
 *
 * In v1 these are hardcoded; in production they come from a server-side
 * scheduled-publish endpoint so every player sees the same prompt at
 * the same UTC midnight.
 *
 * Each prompt is a constraint package: BPM, key, palette, vibe brief,
 * time budget, vocal budget. The constraint IS the game.
 */

export interface DailyPrompt {
  /** YYYY-MM-DD — used as the localStorage discriminator and the day-key
   *  in the (eventual) server table. */
  date:        string;
  /** Headline shown in the prompt card and on the submission. */
  vibe:        string;
  /** Short flavor copy under the headline. */
  flavor:      string;
  bpm:         number;
  /** Musical key, e.g. "Fm" / "Em" / "C#m". String for v1; structured
   *  later if we wire harmonic-coherence scoring. */
  key:         string;
  /** Sound ids the player can pick from. Drawn from REAL_SOUNDS. */
  palette:     string[];
  /** How many of the palette must end up in the track. */
  paletteCap:  number;
  /** Time limit for the whole session, in seconds. */
  timeLimitSec: number;
  /** Vocal recording budget — seconds. 0 = no-vocals day. */
  vocalBudgetSec: number;
  /** Optional twist label shown as a bonus pill. */
  modifier?:   string;
}

/**
 * Today's prompt. In v1 we serve this client-side; in production the
 * server determines today's prompt by date and the same is fed to every
 * player.
 *
 * The hardcoded date here is intentionally fixed so the prototype's
 * streak / submission machinery has a stable key to deduplicate against.
 */
export const TODAY_PROMPT: DailyPrompt = {
  date:           "2026-05-04",
  vibe:           "After-hours subway",
  flavor:         "F minor, 145 BPM. Late-night on the train, eyes half-shut, head nodding.",
  bpm:            145,
  key:            "Fm",
  palette: [
    // 8 hand-curated sounds drawn from REAL_SOUNDS. Mix of kinds so a
    // good track can be assembled from this palette.
    "r-drums-150",     // vanessa drums
    "r-drums-165-Fm",  // told u so drums
    "r-hat-150",       // organic hat
    "r-hat-128",       // segway hat
    "r-808-144-Fm",    // werk (Fm 808)
    "r-808-150-Dsm",   // jump (D#m 808)
    "r-bells-Fm",      // paradise bells
    "r-melodic-Gm",    // melodic dreamy
  ],
  paletteCap:     4,
  timeLimitSec:   600,   // 10 minutes
  vocalBudgetSec: 0,     // no vocals in v0 prototype — keeps scope tight
  modifier:       undefined,
};

/**
 * Helper used by the streak machinery — formats a Date as YYYY-MM-DD
 * in UTC (matches how prompts are keyed).
 */
export function utcDateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
