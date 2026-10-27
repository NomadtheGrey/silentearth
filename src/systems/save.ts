/**
 * Silent Earth — versioned localStorage save (player-systems lane).
 *
 * Adam's order (2026-10-26, "for now"): a save that survives a
 * page refresh while he playtests. Explicitly NOT in this landing:
 * NO three-words passphrase, NO cloud save UI — Adam said "later
 * we'll have the three words like in BioForge." That is a future
 * direction, recorded here, not built here.
 *
 * SHAPE: one JSON document under SAVE_KEY, versioned. The shell
 * (App.tsx) owns when to save/load; this module owns only the
 * shape, the validation, and the storage access — no React, no
 * game imports, nothing that can crash a boot.
 *
 * WHAT IS SAVED (the brief's minimum, all of it):
 * - seed, player position, camera mode
 * - personal inventory stacks — NORMALIZED ids only (see
 *   inventory.ts): serializeSave normalizes every stack key and
 *   merges duplicates, so an UPPER id can never be persisted,
 *   even if a caller hands serialize raw stacks.
 * - hunger meter value, wardrobe worn list
 * - placed fires (type + position + lit flag), placed houses
 *   (type + position + stored contents), placed looms (position)
 * - ground piles (item + quantity + position, see ./piles.ts):
 *   the harvest-overflow remainder. Piles are OPTIONAL on read
 *   (an old save without them loads with piles: []) and always
 *   written by serializeSave — so the version STAYS 1 on
 *   purpose: bumping to 2 would make Adam's existing v1 save
 *   unreadable (fresh start, progress lost) for an additive
 *   field, and old code already ignores unknown fields. A v2
 *   is a migration decision for later, not this landing.
 * - placed traps (id + type + position, structural shape of
 *   the game layer's PlacedTrap — no game import): same
 *   additive-field rule as piles (old saves load traps: []),
 *   but DELIBERATELY more lenient on read than piles (see
 *   deserializeSave): invalid trap entries pass through and
 *   trapState.restore() validates + drops them, so a bad trap
 *   record can never corrupt the whole document. Serialize
 *   writes traps as-is (ids saved verbatim — restore()
 *   recomputes its id counter from the max id suffix, so
 *   later placeTrap ids cannot collide).
 *   APP WIRING FOLLOWS THE PILE ENTITY (Background): saveNow
 *   passes the pile singleton's snapshot as draft.piles, and
 *   boot restore re-places each saved pile through the
 *   entity spawner, the same shape as fires/houses/looms.
 *   Until that wiring lands, piles are session-only — stated,
 *   not silent.
 *
 * WHAT IS RECORDED BUT NOT RESTORED (stated, not silent):
 * - A fire's LIT state is saved (lit: true/false) but restore
 *   brings fires back UNLIT: marking an engine fire lit has no
 *   public API in the game layer, and this landing does not
 *   touch src/game/*. She re-lights restored fires. A future
 *   lit-restore landing needs no format change — the flag is
 *   already in the snapshot.
 * - House restore matches saved houses to restored houses BY
 *   ORDER (placeHouse regenerates ids, so saved ids cannot be
 *   reused); contents ride with their house's position in that
 *   order. A save whose house list cannot be restored whole is
 *   treated as corrupt (see below), so order can never silently
 *   shift contents onto the wrong house.
 * - World runtime state outside the list above (harvested
 *   scatter depletion/regrow, in-progress lighting waits,
 *   multi-step harvest progress) is NOT saved: on refresh the
 *   world regenerates from the seed, so harvested scatter
 *   comes back. That is playtest-visible and intended for this
 *   landing, not a hidden gap.
 *
 * CORRUPTION RULE: deserializeSave returns null — never throws —
 * for any structural problem (not an object, wrong version,
 * missing/wrong-typed field, unknown fire/house type, bad
 * inventory/contents shape). The shell treats null as "fresh
 * start", never as a crash. A merely out-of-range hunger value
 * is clamped, not rejected: a meter number cannot break a boot.
 * Unknown extra fields are ignored (forward-compatible within
 * the version). Storage access itself is guarded: no
 * localStorage (or a throwing one) behaves like "no save".
 */

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

import { normalizeItemId } from './inventory';
import type { GroundPile } from './piles';

/** Storage key. The version rides inside the document too. */
export const SAVE_KEY = 'silentearth-save-v1';

/** The only save version this code reads or writes. */
export const SAVE_VERSION = 1;

/** 'behind' added 2026-10-26 (UI's third perspective): before this, a save made in behind view reloaded as fresh, because deserialize rejected the mode. */
export type SaveCameraMode = 'first' | 'third' | 'behind';

export interface SavedFire {
  type: string;
  x: number;
  z: number;
  /** Recorded; restore brings fires back unlit (see header). */
  lit: boolean;
}

export interface SavedHouse {
  type: string;
  x: number;
  z: number;
  contents: Record<string, number>;
}

export interface SavedLoom {
  x: number;
  z: number;
}

/**
 * A placed trap, as saved. Structural mirror of the game
 * layer's PlacedTrap (src/game/traps.ts) by literal — systems
 * does not import game modules. `type` is the trap recipe id
 * (== its output item for all five traps); `id` is saved
 * verbatim (trap:<type>:<n>) so restore() can recompute its
 * counter from the max suffix.
 */
export interface SavedTrap {
  id: string;
  type: string;
  x: number;
  z: number;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  savedAt: number;
  seed: string;
  cameraMode: SaveCameraMode;
  position: { x: number; z: number };
  inventory: Record<string, number>;
  hunger: number;
  worn: string[];
  fires: SavedFire[];
  houses: SavedHouse[];
  looms: SavedLoom[];
  /** Ground piles (harvest overflow); [] for old saves. */
  piles: GroundPile[];
  /** Placed traps (craft-placed); [] for old saves. */
  traps: SavedTrap[];
}

/** Draft input to serializeSave — the shell's live values. */
export interface SaveDraft {
  seed: string;
  cameraMode: SaveCameraMode;
  position: { x: number; z: number };
  inventory: ReadonlyArray<{ item: string; quantity: number }>;
  hunger: number;
  worn: readonly string[];
  fires: ReadonlyArray<{ type: string; x: number; z: number; lit: boolean }>;
  houses: ReadonlyArray<{
    type: string;
    x: number;
    z: number;
    contents: ReadonlyArray<{ item: string; quantity: number }>;
  }>;
  looms: ReadonlyArray<{ x: number; z: number }>;
  /**
   * Ground piles from the pile source (Background's singleton,
   * once it lands). OPTIONAL so existing saveNow call sites
   * keep compiling unchanged until that wiring exists.
   */
  piles?: ReadonlyArray<{
    item: string;
    quantity: number;
    x: number;
    z: number;
  }>;
  /**
   * Placed traps from trapState.snapshot(). OPTIONAL so
   * existing saveNow call sites keep compiling unchanged
   * until the App wiring lands (UI's parallel brief).
   */
  traps?: ReadonlyArray<{
    id: string;
    type: string;
    x: number;
    z: number;
  }>;
}

/**
 * Fire/house types this version can restore. Mirrors of the game
 * layer's unions (fire.ts FireType, shelter.ts HouseType) by
 * literal — systems does not import game modules. An entry with
 * any other type makes the whole document corrupt (see header:
 * partial restores risk contents landing on the wrong house).
 */
const SAVE_FIRE_TYPES: ReadonlySet<string> = new Set([
  'campfire',
  'hearth',
  'kiln',
  'bloomery',
]);

const SAVE_HOUSE_TYPES: ReadonlySet<string> = new Set([
  'leanTo',
  'thatchHut',
  'wovenCottage',
  'smallWoodenHut',
]);

// ---------------------------------------------------------------------------
// Serialize (shell values -> document; never persists UPPER ids)
// ---------------------------------------------------------------------------

function normalizeStacks(
  stacks: ReadonlyArray<{ item: string; quantity: number }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const stack of stacks) {
    if (!Number.isInteger(stack.quantity) || stack.quantity <= 0) continue;
    const id = normalizeItemId(stack.item);
    out[id] = (out[id] ?? 0) + stack.quantity;
  }
  return out;
}

/** Build a versioned document from live values. */
export function serializeSave(draft: SaveDraft): SaveData {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    seed: draft.seed,
    cameraMode: draft.cameraMode,
    position: { x: draft.position.x, z: draft.position.z },
    inventory: normalizeStacks(draft.inventory),
    hunger: draft.hunger,
    worn: draft.worn.map(normalizeItemId),
    fires: draft.fires.map((fire) => ({
      type: fire.type,
      x: fire.x,
      z: fire.z,
      lit: fire.lit,
    })),
    houses: draft.houses.map((house) => ({
      type: house.type,
      x: house.x,
      z: house.z,
      contents: normalizeStacks(house.contents),
    })),
    looms: draft.looms.map((loom) => ({ x: loom.x, z: loom.z })),
    // Traps: written AS-IS (ids + types verbatim, no filtering,
    // no normalization — trap ids/types are not inventory ids).
    // Invalid entries are restore()'s problem, not serialize's:
    // trapState.restore() validates (isTrapType + finite coords
    // + non-empty id) and drops them, and recomputes its id
    // counter from the max id suffix.
    traps: (draft.traps ?? []).map((trap) => ({
      id: trap.id,
      type: trap.type,
      x: trap.x,
      z: trap.z,
    })),
    // Piles: normalized ids, invalid entries dropped (same
    // filtering rule as normalizeStacks). Order preserved —
    // positions matter, so piles are never merged here.
    piles: (draft.piles ?? [])
      .filter(
        (pile) =>
          typeof pile.item === 'string' &&
          pile.item.length > 0 &&
          Number.isInteger(pile.quantity) &&
          pile.quantity > 0 &&
          Number.isFinite(pile.x) &&
          Number.isFinite(pile.z),
      )
      .map((pile) => ({
        item: normalizeItemId(pile.item),
        quantity: pile.quantity,
        x: pile.x,
        z: pile.z,
      })),
  };
}

// ---------------------------------------------------------------------------
// Deserialize (unknown JSON -> document or null; never throws)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPosition(value: unknown): value is { x: number; z: number } {
  return (
    isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.z)
  );
}

function parseStacks(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  for (const [item, quantity] of Object.entries(value)) {
    if (!Number.isInteger(quantity) || (quantity as number) <= 0) return null;
    const id = normalizeItemId(item);
    out[id] = (out[id] ?? 0) + (quantity as number);
  }
  return out;
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === 'string')) return null;
  return (value as string[]).map(normalizeItemId);
}

/** Validate an unknown value as a v1 save, or return null. */
export function deserializeSave(value: unknown): SaveData | null {
  try {
    if (!isRecord(value)) return null;
    if (value.version !== SAVE_VERSION) return null;
    if (!isFiniteNumber(value.savedAt)) return null;
    if (typeof value.seed !== 'string' || value.seed.length === 0) return null;
    if (
      value.cameraMode !== 'first' &&
      value.cameraMode !== 'third' &&
      value.cameraMode !== 'behind'
    ) {
      return null;
    }
    if (!isPosition(value.position)) return null;
    const inventory = parseStacks(value.inventory);
    if (inventory === null) return null;
    if (!isFiniteNumber(value.hunger)) return null;
    const worn = parseStringArray(value.worn);
    if (worn === null) return null;
    if (!Array.isArray(value.fires)) return null;
    const fires: SavedFire[] = [];
    for (const entry of value.fires) {
      if (!isRecord(entry)) return null;
      if (
        typeof entry.type !== 'string' ||
        !SAVE_FIRE_TYPES.has(entry.type)
      ) {
        return null;
      }
      if (!isFiniteNumber(entry.x) || !isFiniteNumber(entry.z)) return null;
      fires.push({
        type: entry.type,
        x: entry.x,
        z: entry.z,
        lit: entry.lit === true,
      });
    }
    if (!Array.isArray(value.houses)) return null;
    const houses: SavedHouse[] = [];
    for (const entry of value.houses) {
      if (!isRecord(entry)) return null;
      if (
        typeof entry.type !== 'string' ||
        !SAVE_HOUSE_TYPES.has(entry.type)
      ) {
        return null;
      }
      if (!isFiniteNumber(entry.x) || !isFiniteNumber(entry.z)) return null;
      const contents = parseStacks(entry.contents);
      if (contents === null) return null;
      houses.push({
        type: entry.type,
        x: entry.x,
        z: entry.z,
        contents,
      });
    }
    if (!Array.isArray(value.looms)) return null;
    const looms: SavedLoom[] = [];
    for (const entry of value.looms) {
      if (!isPosition(entry)) return null;
      looms.push({ x: entry.x, z: entry.z });
    }
    // Piles are optional on read: an old v1 save without them
    // loads with piles: []. When present, a malformed entry
    // makes the whole document corrupt (same strictness as
    // fires/houses — a half-valid pile list must not restore
    // piles onto wrong positions).
    const piles: GroundPile[] = [];
    if (value.piles !== undefined) {
      if (!Array.isArray(value.piles)) return null;
      for (const entry of value.piles) {
        if (!isRecord(entry)) return null;
        if (typeof entry.item !== 'string' || entry.item.length === 0) {
          return null;
        }
        if (
          !Number.isInteger(entry.quantity) ||
          (entry.quantity as number) <= 0
        ) {
          return null;
        }
        if (!isFiniteNumber(entry.x) || !isFiniteNumber(entry.z)) {
          return null;
        }
        piles.push({
          item: normalizeItemId(entry.item),
          quantity: entry.quantity as number,
          x: entry.x,
          z: entry.z,
        });
      }
    }
    // Traps are optional on read: an old v1 save without them
    // loads with traps: []. DELIBERATE deviation from the piles
    // strictness above: when present, entries pass through
    // UNVALIDATED — trapState.restore() validates (isTrapType
    // + finite coords + non-empty id) and drops bad records,
    // so a bad trap entry can never corrupt the whole document
    // the way a bad pile entry does. A non-array traps field
    // (not an entry problem) loads as [] — the section drops,
    // the document survives.
    const traps: SavedTrap[] = [];
    if (value.traps !== undefined && Array.isArray(value.traps)) {
      for (const entry of value.traps) {
        if (!isRecord(entry)) continue;
        traps.push({
          id: entry.id as string,
          type: entry.type as string,
          x: entry.x as number,
          z: entry.z as number,
        });
      }
    }
    return {
      version: SAVE_VERSION,
      savedAt: value.savedAt,
      seed: value.seed,
      cameraMode: value.cameraMode,
      position: { x: value.position.x, z: value.position.z },
      inventory,
      hunger: Math.min(100, Math.max(0, value.hunger)),
      worn,
      fires,
      houses,
      looms,
      piles,
      traps,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Storage access (guarded; never throws)
// ---------------------------------------------------------------------------

/** Write a save document. Failures are swallowed: saving must never break play. */
export function saveGame(data: SaveData): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage full, blocked, or unavailable — play continues unsaved.
  }
}

/**
 * Read the saved game, or null when there is none, it is corrupt,
 * or storage is unavailable. Null always means "fresh start".
 */
export function loadSave(): SaveData | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) return null;
    return deserializeSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Remove the saved game (fresh start on next boot). */
export function clearSave(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do — the save is already effectively gone.
  }
}
