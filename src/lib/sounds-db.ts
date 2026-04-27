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
/* Discover feed                                                                */
/* -------------------------------------------------------------------------- */

/** A producer-published sound row joined with its producer's profile snippet. */
export interface DiscoverSound extends CatalogSound {
  producerName:   string | null;
  producerAvatar: string | null;
  ownedByMe:      boolean;
}

/**
 * Producer-published sounds, newest first, with the producer's username +
 * avatar joined in. Optionally annotates `ownedByMe` so the Discover grid can
 * dim sounds the player has already claimed (or self-published). Pass userId
 * to populate that flag; guests/no-userId leaves every row's `ownedByMe=false`.
 */
export async function fetchDiscoverSounds(opts?: {
  userId?: string | null;
  limit?:  number;
}): Promise<DiscoverSound[]> {
  const limit = opts?.limit ?? 60;

  // sound_catalog.producer_id → auth.users(id). The FK doesn't go to
  // public.profiles, so PostgREST can't auto-embed the producer profile —
  // do it with a follow-up read keyed by producer_id.
  const { data: catRows, error: catErr } = await supabase
    .from("sound_catalog")
    .select("id, kind, variant, display_name, glyph, audio_url, bpm, key_root, category, producer_id, created_at")
    .eq("category", "producer_published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (catErr) {
    console.error("[sounds-db] fetchDiscoverSounds:", catErr.message);
    return [];
  }

  const rows = (catRows ?? []) as Parameters<typeof rowToCatalogSound>[0][];

  // Producer profile lookup (deduped).
  const producerIds = Array.from(
    new Set(rows.map((r) => r.producer_id).filter((v): v is string => !!v)),
  );
  const profileById = new Map<string, { username: string | null; avatar: string | null }>();
  if (producerIds.length > 0) {
    const { data: profRows, error: profErr } = await supabase
      .from("profiles")
      .select("id, username, avatar")
      .in("id", producerIds);
    if (profErr) {
      console.warn("[sounds-db] fetchDiscoverSounds profile lookup:", profErr.message);
    } else {
      for (const p of profRows ?? []) {
        profileById.set(p.id as string, {
          username: (p.username as string | null) ?? null,
          avatar:   (p.avatar   as string | null) ?? null,
        });
      }
    }
  }

  // Which of these does the current user already own?
  let ownedSet = new Set<string>();
  if (opts?.userId && rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const { data: ownedRows, error: ownErr } = await supabase
      .from("user_sounds")
      .select("sound_id")
      .eq("user_id", opts.userId)
      .in("sound_id", ids);
    if (ownErr) {
      console.warn("[sounds-db] fetchDiscoverSounds owned lookup:", ownErr.message);
    } else {
      ownedSet = new Set((ownedRows ?? []).map((r) => r.sound_id as string));
    }
  }

  return rows.map((row) => {
    const prof = row.producer_id ? profileById.get(row.producer_id) : undefined;
    return {
      ...rowToCatalogSound(row),
      producerName:   prof?.username ?? null,
      producerAvatar: prof?.avatar   ?? null,
      ownedByMe:      ownedSet.has(row.id),
    } satisfies DiscoverSound;
  });
}

/* -------------------------------------------------------------------------- */
/* Producer publish flow                                                        */
/* -------------------------------------------------------------------------- */

export interface PublishSoundResult {
  success:           boolean;
  message:           string;
  soundId:           string | null;
  newEnergy:         number;
  newXp:             number;
  newLevel:          number;
  publicationsToday: number;
  dailyCap:          number;
}

/**
 * Upload a recorded clip to the producer-sounds bucket. Returns the public
 * URL on success. Path convention: `{auth.uid()}/{slug}.{ext}`. Storage RLS
 * enforces that the first folder MUST equal auth.uid().
 *
 * The blob.type drives the file extension we tag the upload with so playback
 * works across MediaRecorder formats (audio/webm, audio/mp4, audio/wav).
 */
export async function uploadProducerSound(
  blob: Blob,
): Promise<{ publicUrl: string | null; error: string | null }> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) {
    return { publicUrl: null, error: `session lookup failed: ${sessionErr.message}` };
  }
  const sessionUid = sessionData?.session?.user?.id ?? null;
  if (!sessionUid) {
    return { publicUrl: null, error: "no active session — sign in and retry" };
  }

  const ext = blob.type.includes("mp4")   ? "m4a"
            : blob.type.includes("webm")  ? "webm"
            : blob.type.includes("ogg")   ? "ogg"
            : blob.type.includes("wav")   ? "wav"
            :                                "bin";

  // crypto.randomUUID is Node>=19 / all evergreen browsers + iOS 14+.
  const slug = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const path = `${sessionUid}/${slug}.${ext}`;

  const { error } = await supabase.storage
    .from("producer-sounds")
    .upload(path, blob, {
      contentType: blob.type || "application/octet-stream",
      upsert:      false,
    });

  if (error) {
    console.error("[sounds-db] uploadProducerSound:", error);
    return { publicUrl: null, error: error.message ?? "upload failed" };
  }

  const { data } = supabase.storage.from("producer-sounds").getPublicUrl(path);
  if (!data?.publicUrl) {
    return { publicUrl: null, error: "no public URL returned" };
  }
  return { publicUrl: data.publicUrl, error: null };
}

/**
 * Call the publish_sound RPC after the audio is uploaded. Server validates
 * inputs, charges energy, awards XP, inserts the sound_catalog row, and
 * grants the producer ownership.
 */
export async function publishSoundRpc(args: {
  kind:        LayerKind;
  variant?:    string | null;
  displayName: string;
  glyph:       string;
  audioUrl:    string;
  bpm?:        number | null;
  keyRoot?:    string | null;
}): Promise<PublishSoundResult | null> {
  const { data, error } = await supabase.rpc("publish_sound", {
    p_kind:         args.kind,
    p_variant:      args.variant     ?? null,
    p_display_name: args.displayName,
    p_glyph:        args.glyph,
    p_audio_url:    args.audioUrl,
    p_bpm:          args.bpm         ?? null,
    p_key_root:     args.keyRoot     ?? null,
  });
  if (error) {
    console.error("[sounds-db] publishSoundRpc:", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    success:           !!row.success,
    message:           row.message ?? "",
    soundId:           row.sound_id ?? null,
    newEnergy:         row.new_energy ?? 0,
    newXp:             row.new_xp ?? 0,
    newLevel:          row.new_level ?? 1,
    publicationsToday: row.publications_today ?? 0,
    dailyCap:          row.daily_cap ?? 0,
  };
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
