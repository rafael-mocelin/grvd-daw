/**
 * sounds-db.ts — Phase 5.B sound catalog + per-user inventory wrappers.
 *
 * Two reads:
 *   fetchSoundCatalog()        — all sounds in the game (public read).
 *   fetchMyInventory(userId)   — sounds I own, joined to catalog rows.
 *
 * The shape on the wire intentionally mirrors data/sounds.ts SoundOption
 * so the DAW picker can switch from the static SOUNDS array to a live
 * inventory query in step 4 without rewriting the picker.
 *
 * Architecture reference: SOUND_ECONOMY_PLAN.md.
 */

import { supabase } from "./supabase";
import type { LayerKind } from "../data/types";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Catalog row shape — close to data/sounds.ts SoundOption but with a few
 * server-only fields (category, producerId). The DAW picker only cares
 * about the visual fields (kind, glyph, displayName, variant) plus
 * audioUrl when present.
 */
export interface CatalogSound {
  id:           string;
  kind:         LayerKind;
  variant:      string | null;
  displayName:  string;
  glyph:        string;
  audioUrl:     string | null;
  bpm:          number | null;
  keyRoot:      string | null;
  category:     "starter" | "producer_published" | string;
  producerId:   string | null;
  createdAt:    string;
}

/** A row in user_sounds joined with its catalog row. */
export interface InventorySound extends CatalogSound {
  acquiredAt: string;
  source:     string;
}

/* -------------------------------------------------------------------------- */
/* Row → client mapping                                                        */
/* -------------------------------------------------------------------------- */

function rowToCatalogSound(row: {
  id:           string;
  kind:         string;
  variant:      string | null;
  display_name: string;
  glyph:        string;
  audio_url:    string | null;
  bpm:          number | null;
  key_root:     string | null;
  category:     string;
  producer_id:  string | null;
  created_at:   string;
}): CatalogSound {
  return {
    id:          row.id,
    kind:        row.kind as LayerKind,
    variant:     row.variant,
    displayName: row.display_name,
    glyph:       row.glyph,
    audioUrl:    row.audio_url,
    bpm:         row.bpm,
    keyRoot:     row.key_root,
    category:    row.category,
    producerId:  row.producer_id,
    createdAt:   row.created_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                        */
/* -------------------------------------------------------------------------- */

/** Every sound in the game. Public read; works for guests too. */
export async function fetchSoundCatalog(opts?: {
  kind?:     LayerKind;
  category?: string;
  limit?:    number;
}): Promise<CatalogSound[]> {
  let q = supabase
    .from("sound_catalog")
    .select("id, kind, variant, display_name, glyph, audio_url, bpm, key_root, category, producer_id, created_at")
    .order("created_at", { ascending: false });
  if (opts?.kind)     q = q.eq("kind", opts.kind);
  if (opts?.category) q = q.eq("category", opts.category);
  if (opts?.limit)    q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) {
    console.error("[sounds-db] fetchSoundCatalog:", error.message);
    return [];
  }
  return (data ?? []).map(rowToCatalogSound);
}

/** All sounds I own, joined with their catalog rows. */
export async function fetchMyInventory(userId: string): Promise<InventorySound[]> {
  const { data, error } = await supabase
    .from("user_sounds")
    .select(`
      acquired_at,
      source,
      sound_catalog (
        id, kind, variant, display_name, glyph, audio_url, bpm, key_root,
        category, producer_id, created_at
      )
    `)
    .eq("user_id", userId)
    .order("acquired_at", { ascending: false });

  if (error) {
    console.error("[sounds-db] fetchMyInventory:", error.message);
    return [];
  }

  // Supabase returns the embedded relation as an object (single ref via FK)
  // or sometimes typed as an array depending on the join shape; flatten it.
  type Row = {
    acquired_at: string;
    source:      string;
    sound_catalog:
      | Parameters<typeof rowToCatalogSound>[0]
      | Parameters<typeof rowToCatalogSound>[0][]
      | null;
  };

  return ((data ?? []) as Row[])
    .map((row) => {
      const cat = Array.isArray(row.sound_catalog) ? row.sound_catalog[0] : row.sound_catalog;
      if (!cat) return null;
      return {
        ...rowToCatalogSound(cat),
        acquiredAt: row.acquired_at,
        source:     row.source,
      } satisfies InventorySound;
    })
    .filter((row): row is InventorySound => row !== null);
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

/** Group an inventory list by `kind` for category-headered grids. */
export function groupByKind<T extends { kind: LayerKind }>(
  items: T[],
): Record<LayerKind, T[]> {
  const out = {} as Record<LayerKind, T[]>;
  for (const it of items) {
    (out[it.kind] ??= []).push(it);
  }
  return out;
}

/**
 * Kind → category icon. Matches SOUND_ECONOMY_PLAN.md § 5.5 vocabulary,
 * adjusted to the actual LayerKind enum (drums, kick, snare, hat, 808,
 * sample, melody, vocal). When the designer ships bespoke illustrations
 * later, replace these strings — the consumer code stays the same.
 */
export const KIND_ICON: Record<LayerKind, string> = {
  drums:  "🥁",
  kick:   "🥾",
  snare:  "👏",
  hat:    "🎩",
  "808":  "🔊",
  sample: "💿",
  melody: "🎶",
  vocal:  "🎤",
};
