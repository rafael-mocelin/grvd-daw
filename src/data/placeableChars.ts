/**
 * placeableChars — flat list of "characters" the player can drag from
 * the popup palette into the room.
 *
 * In the v1 art system a character is a (characterKind × soundId) pair:
 *   drum-guy + r-drums-150 → "vanessa" skin
 *   beat-guy + r-808-144-Em → "hound" skin
 *   …etc
 *
 * The original sidebar palette dragged sounds onto fixed character
 * slots. The new free-place model flips that: the player drags
 * (character × sound) tiles onto the room floor, and the character
 * shows up wherever they land. Each entry below is one such tile.
 *
 * The icon shown in the popup is the "right" frame from the skin pair
 * (it tends to read better as a still pose than the "left"). We use
 * the catalog sound's display name as the tile label since v1 doesn't
 * have a separate creative-name layer.
 */

import { CHARACTER_SKINS, type CharacterKind } from "./characterSkins";
import { REAL_SOUNDS } from "./sounds";

export interface PlaceableChar {
  /** Stable id; doubles as the dataTransfer payload during drag.
   *  Equal to soundId so the audio engine wiring is unchanged. */
  id:            string;
  /** REAL_SOUNDS id this character plays. */
  soundId:       string;
  /** Which character kind's art set this entry uses. */
  characterKind: CharacterKind;
  /** Display name shown in the popup tile. Sourced from REAL_SOUNDS. */
  name:          string;
  /** Optional second-line vibe blurb. */
  blurb:         string;
  /** Path to the icon image (still pose) used in the tile. */
  iconSrc:       string;
}

const REAL_BY_ID = new Map(REAL_SOUNDS.map((s) => [s.id, s]));

/** Build the roster from CHARACTER_SKINS. Each (kind, soundId) pair
 *  becomes one tile. Order: drum-guy → beat-guy → guitar-guy, then by
 *  the order their sounds appear in the skin map. */
export const PLACEABLE_CHARS: PlaceableChar[] = (() => {
  const out: PlaceableChar[] = [];
  const kinds: CharacterKind[] = ["drum-guy", "beat-guy", "guitar-guy"];
  for (const kind of kinds) {
    const skinMap = CHARACTER_SKINS[kind];
    for (const soundId of Object.keys(skinMap)) {
      const sound = REAL_BY_ID.get(soundId);
      if (!sound) continue;          // defensive — should never happen
      const skin = skinMap[soundId];
      out.push({
        id:            soundId,
        soundId,
        characterKind: kind,
        name:          sound.name.toUpperCase(),
        blurb:         sound.vibe,
        iconSrc:       skin.right,    // right pose reads as the still
      });
    }
  }
  return out;
})();

/** Lookup helpers. */
export function getPlaceable(id: string): PlaceableChar | undefined {
  return PLACEABLE_CHARS.find((c) => c.id === id);
}
