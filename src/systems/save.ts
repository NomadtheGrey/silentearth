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
 * - placed fires (id + type + position + lit flag + lighting),
 *   placed houses
 *   (type + position + stored contents), placed looms (position)
 * - ground piles (multi-kind stacks + position, see
 *   ./piles.ts): the harvest-overflow remainder. Piles are
 *   OPTIONAL on read (an old save without them loads with
 *   piles: []) and always written by serializeSave — so the
 *   version STAYS 1 on purpose: bumping to 2 would make
 *   Adam's existing v1 save unreadable (fresh start,
 *   progress lost) for an additive field, and old code
 *   already ignores unknown fields. A v2 is a migration
 *   decision for later, not this landing. Old single-kind
 *   pile documents migrate on read (grouped by rounded
 *   coords into one stacks pile per spot, kinds in saved
 *   order, nothing dropped — see deserializeSave).
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
 * - placed torches (position, id optional — no game import):
 *   same additive-field rule (old saves load torches: [])
 *   and the same leniency as traps on read (entries pass
 *   through, the placed-torch restore validates + drops
 *   bad records, so a bad torch record can never corrupt
 *   the whole document). Placed torches are ALWAYS lit
 *   (she places light, not sticks; no-burnout pin
 *   extended), so no lit flag is stored. `id` is optional
 *   because Background's placed-torch entity owns the id
 *   scheme (spot-keyed vs sequential is their call) — the
 *   save carries position always and the id when the
 *   entity provides one. Order preserved; duplicate
 *   positions allowed (two torches at one spot are two
 *   entries).
 * - partial true names (name-sight look counts, key +
 *   looks): same additive-field rule (old saves load
 *   nameSight: []) and the same leniency as torches on
 *   read (bad entries dropped, the document survives).
 *   Trap-save pattern: format now, App wiring later —
 *   serialize writes the snapshot as-is, restore()
 *   validates again. Version stays 1.
 * - placed altars (position, id optional — no game
 *   import): same additive-field rule (old saves load
 *   altars: []) and the same leniency as torches on read
 *   (entries pass through, the placed-altar restore
 *   validates + drops bad records, so a bad altar record
 *   can never corrupt the whole document). Placed altars
 *   carry no ritual state — the altar is the SITE;
 *   rituals come later, so no ritual field is stored.
 *   `id` is optional because Background's placed-altar
 *   entity owns the id scheme (torch precedent) — the
 *   save carries position always and the id when the
 *   entity provides one. Order preserved; duplicate
 *   positions allowed (two altars at one spot are two
 *   entries).
 * - placed desks (position, id optional — no game
 *   import): same additive-field rule (old saves load
 *   desks: []) and the same leniency as altars on read
 *   (entries pass through, the placed-desk restore
 *   validates + drops bad records). A placed desk
 *   carries ONE state field: grimoire (boolean,
 *   optional) — whether THE grimoire rests on it (the
 *   seat, accepted 2026-11-01; one book ever, so a
 *   boolean suffices). The book's workings still come
 *   later — the seat stores presence, nothing more.
 *   Multiple desks are legitimate (a second camp
 *   wants a second desk).
 * - placed tents (position, id optional — no game
 *   import): same additive-field rule (old saves load
 *   tents: []) and the same leniency as altars on read
 *   (entries pass through, the placed-tent restore
 *   validates + drops bad records, so a bad tent record
 *   can never corrupt the whole document). Placed tents
 *   carry no shelter state — the tent is the SITE; the
 *   shelter effect rides Background's tent-aware
 *   shelterQuery branch when it lands, so no shelter
 *   field is stored. `id` is optional because
 *   Background's placed-tent entity owns the id scheme
 *   (torch precedent). Order preserved; duplicate
 *   positions allowed (two tents at one spot are two
 *   entries); multiples allowed by design.
 * - ritual stagings + awakenings (tier-1 Waking state):
 *   same additive-field rule (old saves load stagings:
 *   [] + awakenings: []) and the name-sight leniency on
 *   read (bad entries dropped, the document survives).
 *   Trap-save pattern: format now, App wiring later —
 *   serialize writes the snapshots as-is, restore()
 *   validates again. Version stays 1.
 * - charm-list migration (2026-10-28, deserialize
 *   only): a save holding the grant's shrew item +
 *   its awakening drops the item (record kept) — see
 *   the migration block in deserializeSave.
 * - world state (Background's persistence seams, a39f47f):
 *   fires[].lighting (LightingProcess shape; lit needs no
 *   field — fires[].lit already exists), harvestState
 *   (HarvestStateSnapshot shape), sky { cycleT,
 *   daysElapsed? } (dawn count for the moon-phase cycle —
 *   absent on old saves, which load as current, i.e. 0),
 *   facing { yaw, pitch }. Same additive-field rule: old
 *   saves load defaults (empty harvest snapshot, dawn sky,
 *   default look), never break. Invalid entries pass
 *   through — the engine restores validate and drop
 *   (replace, not merge; null snapshots ignored there).
 *   APP WIRING (live): saveNow passes the pile
 *   singleton's snapshot stacks as draft.piles, and boot
 *   restore re-places each saved kind through
 *   pileState.drop() (merge-safe by coords), the same
 *   shape as fires/houses/looms.
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
// Single source for the name-sight record (name-sight.ts
// owns it; save.ts imports it — no second mirror to drift,
// the placed-torch id nuance taught us that lesson).
import type { SavedNameLook } from './name-sight';
// Single source for the ritual records (rituals.ts /
// charms.ts own them; save.ts imports them — no second
// mirror to drift, the placed-torch id lesson).
import type { SavedRitualStaging } from './rituals';
import type { SavedCompanion } from './companions';
import type { SavedMarkProgress } from './fragments';
import type { SavedDiscovery } from './discovery';
import { FIRST_CHARM_ITEM, FIRST_CHARM_KIND } from './charms';
import type { SavedAwakening } from './charms';
import type { SavedQuestFlags } from './quests';
import { questById } from './quests';

/** Storage key. The version rides inside the document too. */
export const SAVE_KEY = 'silentearth-save-v1';

/** The only save version this code reads or writes. */
export const SAVE_VERSION = 1;

/** 'behind' added 2026-10-26 (UI's third perspective): before this, a save made in behind view reloaded as fresh, because deserialize rejected the mode. */
export type SaveCameraMode = 'first' | 'third' | 'behind';

/**
 * A fire's lighting in progress, as saved. Structural mirror of
 * the game layer's LightingProcess (fireState.ts) by literal —
 * systems does not import game modules. Null = no lighting in
 * progress. The engine's validLighting() validates on restore
 * (null in, null out; bad shapes become null). Lit itself needs
 * NO field: SavedFire.lit already exists.
 */
export type SavedLightingProcess =
  | { method: 'flint'; clicks: number }
  | { method: 'friction'; phase: 'waiting' | 'ready'; waitUntil: number };

export interface SavedFire {
  /**
   * Engine fire id (`fire:<type>:<n>`, fireState.placeFire's
   * shape). REQUIRED: fireState.restore() drops id-less
   * entries, so a lighting record without an id would strand
   * with nothing to attach to. Entries that arrive without one
   * (old saves, id-less drafts) get a deterministic id in
   * order — see deterministicFireId below — never a drop.
   */
  id: string;
  type: string;
  x: number;
  z: number;
  /** Recorded; restore brings fires back unlit (see header). */
  lit: boolean;
  /** Lighting in progress; null when the fire is not lighting. */
  lighting: SavedLightingProcess | null;
}

/**
 * Deterministic id for an id-less fire entry: the engine's own
 * `fire:<type>:<n>` shape, n = position in the fires list + 1.
 * Shared by serializeSave (id-less drafts) and deserializeSave
 * (old saves) so both paths assign the same ids. Unique within
 * a document by construction (n counts all fires, not per
 * type), and restore()'s suffix recompute continues the
 * counter past the restored set, so later placeFire ids cannot
 * collide with assigned ones.
 */
function deterministicFireId(type: string, index: number): string {
  return `fire:${type}:${index + 1}`;
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
 * One kind inside a saved pile (structural mirror of
 * piles.ts PileStack). Item ids are NORMALIZED.
 */
export interface SavedPileStack {
  item: string;
  quantity: number;
}

/**
 * A saved multi-kind pile: stacks + position. No id is
 * stored — the runtime pile id is derived from the coords
 * (pile:<x.toFixed(2)>,<z.toFixed(2)>) when boot restore
 * re-places each kind through pileState.drop().
 */
export interface SavedPile {
  stacks: SavedPileStack[];
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
  /**
   * Caught kind on the trap (trap-catch.ts), absent =
   * empty trap. Baited flag likewise. Both optional:
   * old saves carry neither. trapState.restore()
   * validates (Background owns the fields); this
   * layer only carries them through.
   */
  catch?: string;
  baited?: boolean;
}

/**
 * An upgraded stump, as saved. Additions ride as plain
 * strings (the trap pattern: this layer carries, the
 * engine validates) — stumpState.restore() drops
 * non-member additions, so a bad record can never
 * corrupt the document.
 */
export interface SavedStump {
  siteId: string;
  x: number;
  z: number;
  additions: string[];
}

/**
 * A placed torch, as saved. Placed torches are ALWAYS lit
 * (she places light, not sticks; no-burnout pin extended),
 * so no lit flag is stored — a saved torch is a lit torch.
 * `id` is optional: Background's placed-torch entity owns
 * the id scheme (spot-keyed vs sequential is their call);
 * the save carries position always and the id when the
 * entity provides one. Order preserved; duplicate
 * positions allowed (two torches at one spot are two
 * entries, not one merged record).
 */
export interface SavedTorch {
  x: number;
  z: number;
  id?: string;
}

/**
 * A placed altar, as saved. No ritual state is stored —
 * the altar is the SITE; rituals come later. `id` is
 * optional: Background's placed-altar entity owns the id
 * scheme (torch precedent); the save carries position
 * always and the id when the entity provides one. Order
 * preserved; duplicate positions allowed (two altars at
 * one spot are two entries, not one merged record).
 */
export interface SavedAltar {
  x: number;
  z: number;
  id?: string;
}

/**
 * A placed writing desk, as saved. No grimoire state
 * is stored — the desk is the SITE; the grimoire's
 * workings come later. `id` is optional: Background's
 * placed-desk entity owns the id scheme (altar
 * precedent); the save carries position always and
 * the id when the entity provides one. Order
 * preserved; duplicate positions allowed.
 */
export interface SavedDesk {
  x: number;
  z: number;
  id?: string;
  /** True when THE grimoire rests on this desk (the seat). */
  grimoire?: boolean;
}

/**
 * A placed cauldron, as saved. KEYED TO ITS HEARTH:
 * `hearthId` (Background's fire-entity id, verbatim)
 * is the binding, and the position is carried always
 * beside it — the desks shape plus the binding
 * (coordinated with Background's cauldronState
 * restore, 2026-10-30: position is the restore's
 * fallback surface when an id cannot rebind). `id` is
 * the placed-cauldron entity's own id, optional:
 * present when the entity provides one; the restore
 * mints when absent. No vessel state is stored — the
 * cauldron is the SITE for the 'cauldron' station's
 * workings, which carry their own state elsewhere.
 * One cauldron per hearth.
 */
export interface SavedCauldron {
  hearthId: string;
  x: number;
  z: number;
  id?: string;
}

/**
 * The boot-at-the-mouth fact: the cave visit a save
 * was written in, as handed over by Background's
 * dimensionState.snapshot() (the shell passes its
 * key + mouthId at save time). Boot always starts on
 * the surface — the shell reads this record to place
 * her at the mouth she entered by rather than at
 * spawn (the boot wiring is the shell's).
 * `mouthId` is the surface mouth's id (null only if
 * the source had none). The snapshot's `layer` is
 * DELIBERATELY not persisted: boot places her at the
 * mouth, never mid-cave, so the layer a save was
 * written at has no boot consumer (Background's
 * session-state note). Absent / null = a surface
 * save; boot proceeds as it always has.
 */
export interface SavedDimensionVisit {
  key: string;
  mouthId: string | null;
}

/**
 * A placed tent, as saved. No shelter state is stored —
 * the tent is the SITE; the shelter effect rides
 * Background's tent-aware shelterQuery branch when it
 * lands. `id` is optional: Background's placed-tent
 * entity owns the id scheme (torch precedent); the save
 * carries position always and the id when the entity
 * provides one. Order preserved; duplicate positions
 * allowed (two tents at one spot are two entries, not
 * one merged record). Multiples allowed by design.
 */
export interface SavedTent {
  x: number;
  z: number;
  id?: string;
}

/**
 * World harvest state, as saved. Structural mirror of the game
 * layer's HarvestStateSnapshot (harvestState.ts) by literal —
 * systems does not import game modules. The engine's restore()
 * validates per field (Array.isArray guards, bad entries
 * dropped) and replaces rather than merges; a null snapshot is
 * ignored there, so deserializeSave always returns a snapshot
 * shape here (empty when the save predates it), never null.
 */
export interface SavedHarvestState {
  shrunk: Array<{ id: string; harvestedAt: number; cx: number; cz: number }>;
  removed: string[];
  progress: Array<{ id: string; progress: number }>;
  spawnedLogs: Array<{
    id: string;
    x: number;
    z: number;
    cx: number;
    cz: number;
  }>;
  pendingSpawns: Array<{
    dueAt: number;
    nearX: number;
    nearZ: number;
    seed: number;
  }>;
  spawnCounter: number;
  felled: Array<{
    id: string;
    x: number;
    z: number;
    cx: number;
    cz: number;
  }>;
  saplings: Array<{
    id: string;
    x: number;
    z: number;
    cx: number;
    cz: number;
    plantedAt: number;
  }>;
  saplingCounter: number;
  clearedSpots: Array<{ x: number; z: number }>;
}

/**
 * Fresh empty harvest snapshot: the default for saves predating
 * it. A function (not a shared const) so no caller can mutate a
 * shared array through a returned document.
 */
export function emptySavedHarvestState(): SavedHarvestState {
  return {
    shrunk: [],
    removed: [],
    progress: [],
    spawnedLogs: [],
    pendingSpawns: [],
    spawnCounter: 0,
    felled: [],
    saplings: [],
    saplingCounter: 0,
    clearedSpots: [],
  };
}

/**
 * Sky state, as saved. Structural mirror of the game layer's
 * SkySnapshot (sky.ts) by literal: cycle position t in [0,1)
 * + dawn count daysElapsed (month is an input, not state).
 * 0 = dawn (sky.ts). daysElapsed is OPTIONAL, mirroring
 * SkySnapshot: absent on old saves (Background's restore
 * treats absence via its dawn rule — boot from a fresh rig
 * never jumps backward, so old saves still load at 0, as
 * before). Present + finite on new saves, it wins
 * absolutely in restore — a refresh no longer rewinds the
 * moon phase toward the seed base.
 */
export interface SavedSky {
  cycleT: number;
  daysElapsed?: number;
}

/** Dawn default: the sky default for saves predating it. */
export const DAWN_SAVED_SKY: SavedSky = { cycleT: 0 };

/**
 * Facing, as saved. Structural mirror of the game layer's
 * FacingSnapshot (player.ts) by literal. yaw 0 faces -z;
 * pitch clamps to ±1.45 on restore.
 */
export interface SavedFacing {
  yaw: number;
  pitch: number;
}

/** Default look: the facing default for saves predating it. */
export const DEFAULT_SAVED_FACING: SavedFacing = { yaw: 0, pitch: 0 };

export interface SaveData {
  version: typeof SAVE_VERSION;
  savedAt: number;
  seed: string;
  /** World name (first-run flow + cloud envelope name);
   * absent for old saves and unnamed worlds. */
  worldName?: string;
  cameraMode: SaveCameraMode;
  position: { x: number; z: number };
  inventory: Record<string, number>;
  hunger: number;
  /** The books' link (journal <-> grimoire, enchanted at
   * altar-grade ground); false for old saves. */
  journalLinked: boolean;
  worn: string[];
  fires: SavedFire[];
  houses: SavedHouse[];
  looms: SavedLoom[];
  /** Ground piles (multi-kind stacks); [] for old saves. */
  piles: SavedPile[];
  /** Placed traps (craft-placed); [] for old saves. */
  traps: SavedTrap[];
  /** Upgraded stumps (workbench additions); [] for old saves. */
  stumps: SavedStump[];
  /** Placed torches (always lit); [] for old saves. */
  torches: SavedTorch[];
  /** Placed altars (sites, no ritual state); [] for old saves. */
  altars: SavedAltar[];
  /** Placed desks (sites; grimoire = the seated book); [] for old saves. */
  desks: SavedDesk[];
  /** Placed cauldrons (keyed to their hearths); [] for old saves. */
  cauldrons: SavedCauldron[];
  /** The cave visit this save was written in (boot-at-the-mouth
   * fact); null for surface saves and old saves. */
  dimensionVisit: SavedDimensionVisit | null;
  /** Acquisition order for the Recent sort (held kinds,
   * most recently gained first); [] for old saves. */
  acquisitionOrder: string[];
  /** Companion records (touched individuals only);
   * [] for old saves. */
  companions: SavedCompanion[];
  /** Fragment progress by mark (begun marks only);
   * [] for old saves. */
  fragments: SavedMarkProgress[];
  /** Discovery facts (the Grove's finding day);
   * undiscovered for old saves. */
  discovery: SavedDiscovery;
  /** Placed tents (portable shelters); [] for old saves. */
  tents: SavedTent[];
  /** Partial-true-name look counts; [] for old saves. */
  nameSight: SavedNameLook[];
  /** Ritual stagings (site + kind + steps); [] for old saves. */
  stagings: SavedRitualStaging[];
  /** Charm awakenings (kind + tier); [] for old saves. */
  awakenings: SavedAwakening[];
  /** Quest event flags; absent for old saves (all false). */
  quests?: SavedQuestFlags;
  /** World harvest state; empty snapshot for old saves. */
  harvestState: SavedHarvestState;
  /** Sky cycle position; dawn ({ cycleT: 0 }) for old saves. */
  sky: SavedSky;
  /** Facing (yaw/pitch); default look for old saves. */
  facing: SavedFacing;
}

/** Draft input to serializeSave — the shell's live values. */
export interface SaveDraft {
  seed: string;
  /** World name from the shell (first-run naming + tab
   * rename); omitted when unnamed. App shell holds
   * worldName state and includes it here on saveNow. */
  worldName?: string;
  cameraMode: SaveCameraMode;
  position: { x: number; z: number };
  inventory: ReadonlyArray<{ item: string; quantity: number }>;
  hunger: number;
  /** The books' link, from the shell's link state. OPTIONAL
   * so existing saveNow call sites keep compiling unchanged
   * until the wiring lands (trap-save pattern). */
  journalLinked?: boolean;
  worn: readonly string[];
  fires: ReadonlyArray<{
    /** Engine fire id when the caller has one; id-less entries get a deterministic id. */
    id?: string;
    type: string;
    x: number;
    z: number;
    lit: boolean;
    lighting?: SavedLightingProcess | null;
  }>;
  houses: ReadonlyArray<{
    type: string;
    x: number;
    z: number;
    contents: ReadonlyArray<{ item: string; quantity: number }>;
  }>;
  looms: ReadonlyArray<{ x: number; z: number }>;
  /**
   * World-state fields (Background's persistence seams,
   * a39f47f). ALL OPTIONAL so existing saveNow call sites
   * keep compiling unchanged until the App wiring lands
   * (UI's parallel brief): serialize writes defaults for
   * missing fields, deserialize defaults them on read.
   */
  harvestState?: SavedHarvestState;
  sky?: SavedSky;
  facing?: SavedFacing;
  /**
   * Ground piles from the pile source (Background's
   * singleton snapshot): stacks + position per pile.
   * OPTIONAL so existing saveNow call sites keep
   * compiling unchanged until that wiring exists.
   */
  piles?: ReadonlyArray<{
    stacks: ReadonlyArray<{ item: string; quantity: number }>;
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
    catch?: string;
    baited?: boolean;
  }>;
  /**
   * Upgraded stumps from stumpState.snapshot()
   * (stumpy shell, 2026-10-28). OPTIONAL, same
   * trap-save pattern: the App wiring passes it.
   */
  stumps?: ReadonlyArray<{
    siteId: string;
    x: number;
    z: number;
    additions: ReadonlyArray<string>;
  }>;
  /**
   * Placed torches from the placed-torch source
   * (Background's entity snapshot, once it lands).
   * OPTIONAL so existing saveNow call sites keep
   * compiling unchanged until the App wiring lands
   * (trap-save pattern: format now, wiring later).
   */
  torches?: ReadonlyArray<{
    x: number;
    z: number;
    id?: string;
  }>;
  /**
   * Placed altars from the placed-altar source
   * (Background's entity snapshot, once it lands).
   * OPTIONAL so existing saveNow call sites keep
   * compiling unchanged until the App wiring lands
   * (trap-save pattern: format now, wiring later).
   */
  altars?: ReadonlyArray<{
    x: number;
    z: number;
    id?: string;
  }>;
  /**
   * Placed desks from the placed-desk source
   * (Background's entity snapshot, once it lands).
   * OPTIONAL, same trap-save pattern as altars.
   */
  desks?: ReadonlyArray<{
    x: number;
    z: number;
    id?: string;
    grimoire?: boolean;
  }>;
  /**
   * Placed cauldrons from the placed-cauldron source
   * (Background's entity snapshot, once it lands).
   * OPTIONAL, same trap-save pattern as desks.
   */
  cauldrons?: ReadonlyArray<{
    hearthId: string;
    x: number;
    z: number;
    id?: string;
  }>;
  /**
   * The cave visit, from dimensionState.snapshot() at
   * save time (the shell passes key + mouthId; the
   * snapshot's layer is not persisted — see
   * SavedDimensionVisit). OPTIONAL, same trap-save
   * pattern as cauldrons; null/absent = surface.
   */
  dimensionVisit?: {
    key: string;
    mouthId: string | null;
  } | null;
  /**
   * Acquisition order, from PersonalInventory
   * .acquisitionOrder() at save time (the Recent
   * sort's memory). OPTIONAL, same trap-save pattern
   * as cauldrons; absent = [] (the panel falls back
   * to stack order until gains rebuild it).
   */
  acquisitionOrder?: readonly string[];
  /**
   * Companion records, from CompanionState.snapshot()
   * at save time. OPTIONAL, same trap-save pattern;
   * absent = [] (no individual has been touched).
   */
  companions?: readonly SavedCompanion[];
  /**
   * Fragment progress, from FragmentState.snapshot()
   * at save time. OPTIONAL, same pattern; absent = []
   * (no mark has been begun).
   */
  fragments?: readonly SavedMarkProgress[];
  /**
   * Discovery facts, from DiscoveryState.snapshot()
   * at save time. OPTIONAL, same pattern; absent =
   * nothing discovered.
   */
  discovery?: SavedDiscovery;
  /**
   * Placed tents from the placed-tent source
   * (Background's entity snapshot, once it lands).
   * OPTIONAL so existing saveNow call sites keep
   * compiling unchanged until the App wiring lands
   * (trap-save pattern: format now, wiring later).
   */
  tents?: ReadonlyArray<{
    x: number;
    z: number;
    id?: string;
  }>;
  /**
   * Partial-true-name looks from NameSight.snapshot().
   * OPTIONAL so existing saveNow call sites keep
   * compiling unchanged until the App wiring lands
   * (trap-save pattern: format now, wiring later).
   */
  nameSight?: ReadonlyArray<{
    key: string;
    looks: number;
  }>;
  /**
   * Ritual stagings from StagingBook.snapshot() +
   * awakenings from CharmState.snapshot(). OPTIONAL so
   * existing saveNow call sites keep compiling unchanged
   * until the App wiring lands (trap-save pattern:
   * format now, wiring later).
   */
  stagings?: ReadonlyArray<{
    siteKey: string;
    boneKind: string;
    bonePlaced: boolean;
    offeringGiven: boolean;
    nameSpoken: boolean;
    extrasDone: string[];
    completed: boolean;
  }>;
  awakenings?: ReadonlyArray<{
    kind: string;
    tier: number;
  }>;
  /**
   * Quest event flags from the shell's QuestFlags.
   * OPTIONAL so existing saveNow call sites keep
   * compiling unchanged until the App wiring lands
   * (trap-save pattern: format now, wiring later).
   */
  quests?: SavedQuestFlags;
}

/**
 * Fire/house types this version can restore. Mirrors of the game
 * layer's unions (fire.ts FireType, shelter.ts HouseType) by
 * literal — systems does not import game modules. An entry with
 * any other type makes the whole document corrupt (see header:
 * partial restores risk contents landing on the wrong house).
 * Retired types are the one exception — see RETIRED_FIRE_TYPES.
 */
const SAVE_FIRE_TYPES: ReadonlySet<string> = new Set([
  'campfire',
  'hearth',
  'kiln',
]);

/**
 * Fire types that once existed and were removed by design. A
 * saved fire of a retired type is DROPPED on load — the
 * smallest migration: only that fire is lost, the rest of the
 * document restores normally, and the next save writes without
 * it. Retired is not unknown: any other type outside
 * SAVE_FIRE_TYPES still makes the whole document corrupt.
 * - 'bloomery' — removed 2026-10-30 (Adam's no-iron ruling:
 *   witches don't touch iron, the iron path is closed).
 */
const RETIRED_FIRE_TYPES: ReadonlySet<string> = new Set([
  'bloomery',
]);

/**
 * Item ids that once existed and were removed by design. A
 * saved stack of a retired id is DROPPED on load — parseStacks
 * (pack + house stores) skips it, and the piles restore drops
 * retired kinds (a spot left with no kinds vanishes rather
 * than restoring as an empty pile). Item ids have no refusal
 * doctrine (any string loads), so this is not save safety: a
 * surviving stack would render as a phantom — its registry
 * rows are erased, so it would show its raw id as its name
 * and weigh the 1 lb default. Only that stack is lost.
 * - 'bloomery' — the item retired 2026-10-30 with its fire
 *   type (Adam's no-iron ruling); see RETIRED_FIRE_TYPES.
 * - 'wattle-and-daub-hut' — retired 2026-11-01 on Adam's
 *   word (audit F7): the wattle-and-daub STAGE merged into
 *   the Woven Cottage in October (one ladder stage, one
 *   recipe outputting woven-cottage), but the item record
 *   lingered, produced nowhere and reachable only from
 *   legacy saves. Adam held it as already retired; this
 *   entry finishes the decision. Its registry rows stay
 *   (the shelter tables key the shared woven rung by it);
 *   only a saved stack drops here.
 */
const RETIRED_ITEM_IDS: ReadonlySet<string> = new Set([
  'bloomery',
  'wattle-and-daub-hut',
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
    ...(draft.worldName !== undefined ? { worldName: draft.worldName } : {}),
    cameraMode: draft.cameraMode,
    position: { x: draft.position.x, z: draft.position.z },
    inventory: normalizeStacks(draft.inventory),
    hunger: draft.hunger,
    journalLinked: draft.journalLinked === true,
    worn: draft.worn.map(normalizeItemId),
    fires: draft.fires.map((fire, index) => ({
      // Id-less drafts get a deterministic id (same rule as
      // deserializeSave for old saves) — a serialized document
      // never carries an id-less fire.
      id:
        typeof fire.id === 'string' && fire.id !== ''
          ? fire.id
          : deterministicFireId(fire.type, index),
      type: fire.type,
      x: fire.x,
      z: fire.z,
      lit: fire.lit,
      // Lighting in progress, as-is (null when not lighting).
      // The engine's validLighting() validates on restore.
      lighting: fire.lighting ?? null,
    })),
    // World state: written AS-IS (fresh objects, same content —
    // no filtering, no normalization). Missing draft fields
    // serialize to the deserialize defaults, so the document
    // always carries the full shape.
    harvestState:
      draft.harvestState !== undefined
        ? {
            shrunk: draft.harvestState.shrunk.map((e) => ({ ...e })),
            removed: [...draft.harvestState.removed],
            progress: draft.harvestState.progress.map((e) => ({ ...e })),
            spawnedLogs: draft.harvestState.spawnedLogs.map((e) => ({
              ...e,
            })),
            pendingSpawns: draft.harvestState.pendingSpawns.map((e) => ({
              ...e,
            })),
            spawnCounter: draft.harvestState.spawnCounter,
            felled: draft.harvestState.felled.map((e) => ({ ...e })),
            saplings: draft.harvestState.saplings.map((e) => ({ ...e })),
            saplingCounter: draft.harvestState.saplingCounter,
            clearedSpots: draft.harvestState.clearedSpots.map((e) => ({
              ...e,
            })),
          }
        : emptySavedHarvestState(),
    // Sky: built EXPLICITLY, not spread — the old spread
    // hid the daysElapsed field (it rode along invisibly
    // while deserialize stripped it, so the moon phase
    // rewound on every refresh). daysElapsed rides only
    // when the draft carries it; old drafts (cycleT only)
    // serialize cycleT only, as before.
    sky:
      draft.sky !== undefined
        ? {
            cycleT: draft.sky.cycleT,
            ...(draft.sky.daysElapsed !== undefined
              ? { daysElapsed: draft.sky.daysElapsed }
              : {}),
          }
        : { ...DAWN_SAVED_SKY },
    facing:
      draft.facing !== undefined
        ? { ...draft.facing }
        : { ...DEFAULT_SAVED_FACING },
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
      // Catch + baited pass through when present
      // (absent = empty / unbaited); restore validates.
      ...(trap.catch !== undefined ? { catch: trap.catch } : {}),
      ...(trap.baited !== undefined ? { baited: trap.baited } : {}),
    })),
    // Stumps: written AS-IS (site ids + coords +
    // additions verbatim, additions copied — never
    // aliased). Invalid entries are restore()'s
    // problem, not serialize's: stumpState.restore()
    // validates (non-empty site id + finite coords +
    // member additions) and drops them.
    stumps: (draft.stumps ?? []).map((stump) => ({
      siteId: stump.siteId,
      x: stump.x,
      z: stump.z,
      additions: [...stump.additions],
    })),
    // Torches: written AS-IS (positions verbatim, id when
    // the entity provides one — no filtering, no
    // normalization). Invalid entries are restore()'s
    // problem, not serialize's: the placed-torch restore
    // validates (finite coords) and drops them. Placed
    // torches are always lit, so no lit flag is written.
    torches: (draft.torches ?? []).map((torch) => ({
      x: torch.x,
      z: torch.z,
      ...(torch.id !== undefined ? { id: torch.id } : {}),
    })),
    // Altars: written AS-IS (positions verbatim, id when
    // the entity provides one — no filtering, no
    // normalization). Invalid entries are restore()'s
    // problem, not serialize's: the placed-altar restore
    // validates (finite coords) and drops them. No ritual
    // state is written — the altar is the SITE.
    altars: (draft.altars ?? []).map((altar) => ({
      x: altar.x,
      z: altar.z,
      ...(altar.id !== undefined ? { id: altar.id } : {}),
    })),
    // Desks: written AS-IS, same as altars (positions
    // verbatim, id when the entity provides one — no
    // filtering, no normalization). Invalid entries
    // are restore()'s problem, not serialize's. The
    // seated-grimoire flag writes only when true.
    desks: (draft.desks ?? []).map((desk) => ({
      x: desk.x,
      z: desk.z,
      ...(desk.id !== undefined ? { id: desk.id } : {}),
      ...(desk.grimoire === true ? { grimoire: true } : {}),
    })),
    // Cauldrons: written AS-IS, same as desks (hearth
    // id + positions verbatim, entity id when provided
    // — no filtering, no normalization). No vessel
    // state is written — the cauldron is the SITE.
    cauldrons: (draft.cauldrons ?? []).map((cauldron) => ({
      hearthId: cauldron.hearthId,
      x: cauldron.x,
      z: cauldron.z,
      ...(cauldron.id !== undefined ? { id: cauldron.id } : {}),
    })),
    // The visit fact: written AS-IS (dimension key +
    // entry mouth verbatim). Absent/null in the draft
    // writes null — a surface save.
    dimensionVisit: draft.dimensionVisit
      ? {
          key: draft.dimensionVisit.key,
          mouthId: draft.dimensionVisit.mouthId,
        }
      : null,
    // Acquisition order: written AS-IS (held kinds,
    // newest first — the inventory's own list).
    acquisitionOrder: [...(draft.acquisitionOrder ?? [])],
    // Companions: written AS-IS (the state's own
    // records, copied). Invalid entries are
    // deserialize's problem, not serialize's.
    companions: (draft.companions ?? []).map((record) => ({
      ...record,
    })),
    // Fragments: written AS-IS (copies deep-copied with
    // their marks). Invalid entries are deserialize's
    // problem, not serialize's.
    fragments: (draft.fragments ?? []).map((progress) => ({
      ...progress,
      copies: progress.copies.map((copy) => ({ ...copy })),
    })),
    // Discovery: written AS-IS (the day or null).
    discovery: {
      groveDiscoveredDay: draft.discovery?.groveDiscoveredDay ?? null,
    },
    // Tents: written AS-IS (positions verbatim, id when
    // the entity provides one — no filtering, no
    // normalization). Invalid entries are restore()'s
    // problem, not serialize's: the placed-tent restore
    // validates (finite coords) and drops them. No shelter
    // state is written — the tent is the SITE.
    tents: (draft.tents ?? []).map((tent) => ({
      x: tent.x,
      z: tent.z,
      ...(tent.id !== undefined ? { id: tent.id } : {}),
    })),
    // Name-sight: written AS-IS (key + looks verbatim, no
    // filtering, no normalization — keys are caller-defined
    // thing keys, not inventory ids). Invalid entries are
    // restore()'s problem, not serialize's: NameSight.
    // restore() validates (non-empty key + positive-int
    // looks) and drops them.
    nameSight: (draft.nameSight ?? []).map((entry) => ({
      key: entry.key,
      looks: entry.looks,
    })),
    // Ritual stagings + awakenings: written AS-IS (records
    // verbatim, no filtering, no normalization — site keys
    // and bone kinds are caller-defined, not inventory
    // ids). Invalid entries are restore()'s problem, not
    // serialize's: StagingBook / CharmState restore()
    // validate and drop them.
    stagings: (draft.stagings ?? []).map((entry) => ({
      siteKey: entry.siteKey,
      boneKind: entry.boneKind,
      bonePlaced: entry.bonePlaced,
      offeringGiven: entry.offeringGiven,
      nameSpoken: entry.nameSpoken,
      extrasDone: [...entry.extrasDone],
      completed: entry.completed,
    })),
    awakenings: (draft.awakenings ?? []).map((entry) => ({
      kind: entry.kind,
      tier: entry.tier,
    })),
    // Quest flags: written as-is (fresh copy) when the
    // shell supplies them; omitted when absent (old
    // saves / pre-wiring — absent reads as all false).
    ...(draft.quests ? { quests: { ...draft.quests } } : {}),
    // Piles: multi-kind stacks, normalized ids, invalid
    // entries dropped (same filtering rule as
    // normalizeStacks — a stack with a bad item or
    // quantity is dropped, and a pile left with no valid
    // stacks is dropped with it). Order preserved —
    // positions matter, so piles are never merged here
    // (one snapshot pile per spot already; parse groups
    // on read for old documents).
    piles: (draft.piles ?? [])
      .map((pile) => {
        if (
          !Array.isArray(pile.stacks) ||
          !Number.isFinite(pile.x) ||
          !Number.isFinite(pile.z)
        ) {
          return null;
        }
        const stacks = pile.stacks
          .filter(
            (stack) =>
              typeof stack.item === 'string' &&
              stack.item.length > 0 &&
              Number.isInteger(stack.quantity) &&
              stack.quantity > 0,
          )
          .map((stack) => ({
            item: normalizeItemId(stack.item),
            quantity: stack.quantity,
          }));
        if (stacks.length === 0) return null;
        return { stacks, x: pile.x, z: pile.z };
      })
      .filter((pile): pile is SavedPile => pile !== null),
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
    const id = normalizeItemId(item);
    // Retired item ids drop on load (see RETIRED_ITEM_IDS) —
    // only that stack is lost; the rest restore normally.
    if (RETIRED_ITEM_IDS.has(id)) continue;
    if (!Number.isInteger(quantity) || (quantity as number) <= 0) return null;
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
    // The books' link is optional on read: an old v1 save
    // without it loads unlinked; only a literal true links.
    const journalLinked = value.journalLinked === true;
    if (!Array.isArray(value.fires)) return null;
    const fires: SavedFire[] = [];
    for (const entry of value.fires) {
      if (!isRecord(entry)) return null;
      // Retired fire types drop on load (see
      // RETIRED_FIRE_TYPES) — only that fire is lost.
      if (
        typeof entry.type === 'string' &&
        RETIRED_FIRE_TYPES.has(entry.type)
      ) {
        continue;
      }
      if (
        typeof entry.type !== 'string' ||
        !SAVE_FIRE_TYPES.has(entry.type)
      ) {
        return null;
      }
      if (!isFiniteNumber(entry.x) || !isFiniteNumber(entry.z)) return null;
      // Lighting passes through as-is when it is a record (the
      // engine's validLighting() validates shape on restore and
      // turns bad shapes into null); anything else becomes null.
      // A bad lighting value never corrupts the fire entry.
      // Id: carried when present and non-empty; otherwise a
      // deterministic id in order (same rule as serializeSave
      // for id-less drafts). Id-less entries are NEVER passed
      // through: fireState.restore() drops them, which would
      // strand the lighting and lose the fire on old saves.
      fires.push({
        id:
          typeof entry.id === 'string' && entry.id !== ''
            ? entry.id
            : deterministicFireId(entry.type, fires.length),
        type: entry.type,
        x: entry.x,
        z: entry.z,
        lit: entry.lit === true,
        lighting: isRecord(entry.lighting)
          ? (entry.lighting as unknown as SavedLightingProcess)
          : null,
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
    // piles onto wrong positions). MIGRATION (multi-kind,
    // 2026-10-27): entries may be the OLD single-kind shape
    // { item, quantity, x, z } or the NEW stacks shape
    // { stacks: [{ item, quantity }], x, z } (extra id /
    // legacy fields ignored — ids are never trusted, the
    // runtime id derives from coords). Entries are GROUPED
    // by rounded coords into one stacks pile per spot,
    // kinds in saved order (a duplicate kind at one spot
    // sums, first-seen order kept) — the same rule as
    // pileState.restore() for old-shape inputs — so no
    // pile is ever dropped in migration. The grouped
    // pile's position is its first entry's coords (the
    // runtime pile keeps its first drop's coords too).
    const pilesBySpot = new Map<string, SavedPile>();
    if (value.piles !== undefined) {
      if (!Array.isArray(value.piles)) return null;
      for (const entry of value.piles) {
        if (!isRecord(entry)) return null;
        if (!isFiniteNumber(entry.x) || !isFiniteNumber(entry.z)) {
          return null;
        }
        // Kinds for this entry: stacks shape wins when
        // present; otherwise the old single-kind shape.
        // A stacks value that is present but malformed
        // (not an array, empty, or holding a bad stack)
        // is corrupt — no fallback to the legacy fields.
        let kinds: { item: string; quantity: number }[];
        if (entry.stacks !== undefined) {
          if (!Array.isArray(entry.stacks) || entry.stacks.length === 0) {
            return null;
          }
          kinds = [];
          for (const stack of entry.stacks) {
            if (!isRecord(stack)) return null;
            if (typeof stack.item !== 'string' || stack.item.length === 0) {
              return null;
            }
            if (
              !Number.isInteger(stack.quantity) ||
              (stack.quantity as number) <= 0
            ) {
              return null;
            }
            kinds.push({
              item: stack.item,
              quantity: stack.quantity as number,
            });
          }
        } else {
          if (typeof entry.item !== 'string' || entry.item.length === 0) {
            return null;
          }
          if (
            !Number.isInteger(entry.quantity) ||
            (entry.quantity as number) <= 0
          ) {
            return null;
          }
          kinds = [
            { item: entry.item, quantity: entry.quantity as number },
          ];
        }
        const key = `${entry.x.toFixed(2)},${entry.z.toFixed(2)}`;
        let pile = pilesBySpot.get(key);
        for (const kind of kinds) {
          const id = normalizeItemId(kind.item);
          // Retired kinds drop on load (see
          // RETIRED_ITEM_IDS). The pile is created lazily,
          // on its first surviving kind, so a spot whose
          // kinds all retired vanishes instead of restoring
          // as an empty pile; a surviving pile's position is
          // its first surviving entry's coords.
          if (RETIRED_ITEM_IDS.has(id)) continue;
          if (!pile) {
            pile = { stacks: [], x: entry.x, z: entry.z };
            pilesBySpot.set(key, pile);
          }
          const existing = pile.stacks.find((s) => s.item === id);
          if (existing) {
            existing.quantity += kind.quantity;
          } else {
            pile.stacks.push({ item: id, quantity: kind.quantity });
          }
        }
      }
    }
    const piles: SavedPile[] = [...pilesBySpot.values()];
    // World state: optional on read, same additive-field rule
    // as piles/traps — an old v1 save without these fields
    // loads defaults, never breaks. Invalid entries pass
    // through: the engine restores validate and drop
    // (fireState.validLighting, harvestState per-field guards
    // with replace-not-merge, sky/facing finite checks that
    // ignore bad snapshots), so a bad world-state record can
    // never corrupt the whole document. A missing or
    // non-record field loads its default.
    const harvestState: SavedHarvestState = isRecord(value.harvestState)
      ? (value.harvestState as unknown as SavedHarvestState)
      : emptySavedHarvestState();
    // Sky: daysElapsed passes through ONLY when a finite
    // number — absent or non-finite loads as absent (the
    // old-save shape), and Background's restore handles
    // absence via its dawn rule. Restore normalizes
    // (floor, max 0); parse does not duplicate that.
    const sky: SavedSky = isRecord(value.sky)
      ? {
          cycleT: value.sky.cycleT as number,
          ...(isFiniteNumber(value.sky.daysElapsed)
            ? { daysElapsed: value.sky.daysElapsed }
            : {}),
        }
      : { ...DAWN_SAVED_SKY };
    const facing: SavedFacing = isRecord(value.facing)
      ? {
          yaw: value.facing.yaw as number,
          pitch: value.facing.pitch as number,
        }
      : { ...DEFAULT_SAVED_FACING };
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
          // Catch + baited pass through only when
          // well-typed (string / boolean); otherwise
          // dropped (empty / unbaited). restore()
          // validates the rest.
          ...(typeof entry.catch === 'string'
            ? { catch: entry.catch as string }
            : {}),
          ...(typeof entry.baited === 'boolean'
            ? { baited: entry.baited as boolean }
            : {}),
        });
      }
    }
    // Stumps are optional on read, same leniency as
    // traps: an old save without them loads with
    // stumps: []. Entries pass through UNVALIDATED —
    // stumpState.restore() validates (non-empty site
    // id + finite coords + member additions) and drops
    // bad records, so a bad stump entry can never
    // corrupt the whole document. A non-array stumps
    // field loads as [] — the section drops, the
    // document survives. Additions pass through as
    // their string members only (non-strings dropped);
    // restore() drops non-member strings.
    const stumps: SavedStump[] = [];
    if (value.stumps !== undefined && Array.isArray(value.stumps)) {
      for (const entry of value.stumps) {
        if (!isRecord(entry)) continue;
        stumps.push({
          siteId: entry.siteId as string,
          x: entry.x as number,
          z: entry.z as number,
          additions: Array.isArray(entry.additions)
            ? entry.additions.filter(
                (addition): addition is string =>
                  typeof addition === 'string',
              )
            : [],
        });
      }
    }
    // Torches are optional on read, same leniency as
    // traps: an old v1 save without them loads with
    // torches: []. Entries pass through UNVALIDATED —
    // the placed-torch restore validates (finite coords)
    // and drops bad records, so a bad torch entry can
    // never corrupt the whole document. A non-array
    // torches field loads as [] — the section drops,
    // the document survives. `id` passes through only
    // when present as a string (the field is optional:
    // Background's entity owns the id scheme).
    const torches: SavedTorch[] = [];
    if (value.torches !== undefined && Array.isArray(value.torches)) {
      for (const entry of value.torches) {
        if (!isRecord(entry)) continue;
        torches.push({
          x: entry.x as number,
          z: entry.z as number,
          ...(typeof entry.id === 'string'
            ? { id: entry.id as string }
            : {}),
        });
      }
    }
    // Altars are optional on read, same leniency as
    // torches: an old v1 save without them loads with
    // altars: []. Entries pass through UNVALIDATED —
    // the placed-altar restore validates (finite coords)
    // and drops bad records, so a bad altar entry can
    // never corrupt the whole document. A non-array
    // altars field loads as [] — the section drops,
    // the document survives. `id` passes through only
    // when present as a string (the field is optional:
    // Background's entity owns the id scheme).
    const altars: SavedAltar[] = [];
    if (value.altars !== undefined && Array.isArray(value.altars)) {
      for (const entry of value.altars) {
        if (!isRecord(entry)) continue;
        altars.push({
          x: entry.x as number,
          z: entry.z as number,
          ...(typeof entry.id === 'string'
            ? { id: entry.id as string }
            : {}),
        });
      }
    }
    // Desks are optional on read, same leniency as
    // altars: an old v1 save without them loads with
    // desks: []. Entries pass through UNVALIDATED —
    // the placed-desk restore validates (finite
    // coords) and drops bad records, so a bad desk
    // entry can never corrupt the whole document. A
    // non-array desks field loads as [].
    const desks: SavedDesk[] = [];
    if (value.desks !== undefined && Array.isArray(value.desks)) {
      for (const entry of value.desks) {
        if (!isRecord(entry)) continue;
        desks.push({
          x: entry.x as number,
          z: entry.z as number,
          ...(typeof entry.id === 'string'
            ? { id: entry.id as string }
            : {}),
          ...(entry.grimoire === true ? { grimoire: true } : {}),
        });
      }
    }
    // Cauldrons are optional on read, same leniency as
    // desks: an old v1 save without them loads with
    // cauldrons: []. Entries pass through UNVALIDATED —
    // the placed-cauldron restore binds by hearth id
    // (position its fallback) and drops what it cannot
    // bind, so a bad cauldron
    // entry can never corrupt the whole document. A
    // non-array cauldrons field loads as [].
    const cauldrons: SavedCauldron[] = [];
    if (value.cauldrons !== undefined && Array.isArray(value.cauldrons)) {
      for (const entry of value.cauldrons) {
        if (!isRecord(entry)) continue;
        cauldrons.push({
          hearthId: entry.hearthId as string,
          x: entry.x as number,
          z: entry.z as number,
          ...(typeof entry.id === 'string'
            ? { id: entry.id as string }
            : {}),
        });
      }
    }
    // The visit fact is optional on read: an old v1
    // save without it loads with dimensionVisit: null.
    // A record passes with its key verbatim and its
    // mouth kept when a string (else null) — the boot
    // consumer resolves the mouth and drops what it
    // cannot use, so a bad visit record can never
    // corrupt the whole document. A non-record field
    // loads as null.
    const dimensionVisit: SavedDimensionVisit | null = isRecord(
      value.dimensionVisit,
    )
      ? {
          key: value.dimensionVisit.key as string,
          mouthId:
            typeof value.dimensionVisit.mouthId === 'string'
              ? value.dimensionVisit.mouthId
              : null,
        }
      : null;
    // Acquisition order is optional on read: an old
    // v1 save without it loads with acquisitionOrder:
    // []. String entries are kept in order, deduped;
    // anything else drops. The restore seed intersects
    // with held stacks at read (PersonalInventory), so
    // a stale id in the list is harmless.
    const acquisitionOrder: string[] = [];
    if (Array.isArray(value.acquisitionOrder)) {
      for (const entry of value.acquisitionOrder) {
        if (
          typeof entry === 'string' &&
          !acquisitionOrder.includes(entry)
        ) {
          acquisitionOrder.push(entry);
        }
      }
    }
    // Companions are optional on read: an old v1 save
    // without them loads with companions: []. Entries
    // are validated field by field (the enums drive
    // behavior, so they coerce to their safe values —
    // an unknown bond reads 'none', an unknown stance
    // reads null); a record needs a creature id and a
    // kind to exist at all. The cat's stance is forced
    // null on read, as everywhere (it takes no orders).
    const companions: SavedCompanion[] = [];
    if (Array.isArray(value.companions)) {
      for (const entry of value.companions) {
        if (!isRecord(entry)) continue;
        if (
          typeof entry.creatureId !== 'string' ||
          entry.creatureId.length === 0 ||
          typeof entry.kind !== 'string' ||
          companions.some((c) => c.creatureId === entry.creatureId)
        ) {
          continue;
        }
        companions.push({
          creatureId: entry.creatureId,
          kind: entry.kind,
          trust:
            typeof entry.trust === 'number' && Number.isFinite(entry.trust)
              ? Math.max(0, Math.floor(entry.trust))
              : 0,
          bond:
            entry.bond === 'companion' || entry.bond === 'familiar'
              ? entry.bond
              : 'none',
          origin: entry.origin === 'found' ? 'found' : 'wild',
          stance:
            entry.kind !== 'cat' &&
            (entry.stance === 'stay' ||
              entry.stance === 'follow' ||
              entry.stance === 'come')
              ? entry.stance
              : null,
          lastFedDay:
            typeof entry.lastFedDay === 'number' &&
            Number.isFinite(entry.lastFedDay)
              ? Math.floor(entry.lastFedDay)
              : null,
        });
      }
    }
    // Fragments are optional on read: an old v1 save
    // without them loads with fragments: []. Entries
    // are validated field by field: a progress needs a
    // mark; a copy needs a fragment id (copies dedupe
    // by id across ALL marks — a noted fragment is
    // noted once); completeness clamps into [0, 1];
    // a missing seeking day repairs from the first
    // copy's day, since the pursuit began when it
    // landed.
    const fragments: SavedMarkProgress[] = [];
    if (Array.isArray(value.fragments)) {
      const seenFragmentIds = new Set<string>();
      for (const entry of value.fragments) {
        if (!isRecord(entry)) continue;
        if (
          typeof entry.mark !== 'string' ||
          entry.mark.length === 0 ||
          fragments.some((p) => p.mark === entry.mark)
        ) {
          continue;
        }
        const copies: SavedMarkProgress['copies'] = [];
        if (Array.isArray(entry.copies)) {
          for (const copy of entry.copies) {
            if (!isRecord(copy)) continue;
            if (
              typeof copy.fragmentId !== 'string' ||
              copy.fragmentId.length === 0 ||
              seenFragmentIds.has(copy.fragmentId)
            ) {
              continue;
            }
            seenFragmentIds.add(copy.fragmentId);
            copies.push({
              fragmentId: copy.fragmentId,
              completeness:
                typeof copy.completeness === 'number' &&
                Number.isFinite(copy.completeness)
                  ? Math.min(1, Math.max(0, copy.completeness))
                  : 0,
              day:
                typeof copy.day === 'number' && Number.isFinite(copy.day)
                  ? Math.floor(copy.day)
                  : 0,
            });
          }
        }
        fragments.push({
          mark: entry.mark,
          copies,
          seekingSinceDay:
            typeof entry.seekingSinceDay === 'number' &&
            Number.isFinite(entry.seekingSinceDay)
              ? Math.floor(entry.seekingSinceDay)
              : copies.length > 0
                ? copies[0].day
                : null,
          completedDay:
            typeof entry.completedDay === 'number' &&
            Number.isFinite(entry.completedDay)
              ? Math.floor(entry.completedDay)
              : null,
        });
      }
    }
    // Discovery is optional on read: an old v1 save
    // without it loads undiscovered. The record is a
    // single day — a finite number floors, anything
    // else reads null (not found).
    const discovery: SavedDiscovery = {
      groveDiscoveredDay:
        isRecord(value.discovery) &&
        typeof value.discovery.groveDiscoveredDay === 'number' &&
        Number.isFinite(value.discovery.groveDiscoveredDay)
          ? Math.floor(value.discovery.groveDiscoveredDay)
          : null,
    };
    // Tents are optional on read, same leniency as
    // altars: an old v1 save without them loads with
    // tents: []. Entries pass through UNVALIDATED —
    // the placed-tent restore validates (finite coords)
    // and drops bad records, so a bad tent entry can
    // never corrupt the whole document. A non-array
    // tents field loads as [] — the section drops,
    // the document survives. `id` passes through only
    // when present as a string (the field is optional:
    // Background's entity owns the id scheme).
    const tents: SavedTent[] = [];
    if (value.tents !== undefined && Array.isArray(value.tents)) {
      for (const entry of value.tents) {
        if (!isRecord(entry)) continue;
        tents.push({
          x: entry.x as number,
          z: entry.z as number,
          ...(typeof entry.id === 'string'
            ? { id: entry.id as string }
            : {}),
        });
      }
    }
    // Name-sight is optional on read, same additive-field
    // rule: an old v1 save without it loads with
    // nameSight: []. A non-array field loads as [] — the
    // section drops, the document survives. Bad entries
    // (non-record, empty key, non-positive-int looks)
    // drop here AND again in NameSight.restore(), so a bad
    // look record can never corrupt the whole document.
    const nameSight: SavedNameLook[] = [];
    if (value.nameSight !== undefined && Array.isArray(value.nameSight)) {
      for (const entry of value.nameSight) {
        if (!isRecord(entry)) continue;
        if (typeof entry.key !== 'string' || entry.key === '') continue;
        if (!Number.isInteger(entry.looks) || (entry.looks as number) <= 0) {
          continue;
        }
        nameSight.push({ key: entry.key, looks: entry.looks as number });
      }
    }
    // Ritual stagings + awakenings are optional on read,
    // same additive-field rule: old v1 saves without them
    // load with stagings: [] + awakenings: []. Non-array
    // fields load as [] — the sections drop, the document
    // survives. Bad entries drop here AND again in
    // StagingBook / CharmState restore(), so a bad ritual
    // record can never corrupt the whole document.
    const stagings: SavedRitualStaging[] = [];
    if (value.stagings !== undefined && Array.isArray(value.stagings)) {
      for (const entry of value.stagings) {
        if (!isRecord(entry)) continue;
        if (typeof entry.siteKey !== 'string' || entry.siteKey === '') continue;
        if (typeof entry.boneKind !== 'string' || entry.boneKind === '') continue;
        if (
          typeof entry.bonePlaced !== 'boolean' ||
          typeof entry.offeringGiven !== 'boolean' ||
          typeof entry.nameSpoken !== 'boolean' ||
          typeof entry.completed !== 'boolean'
        ) {
          continue;
        }
        if (
          !Array.isArray(entry.extrasDone) ||
          (entry.extrasDone as unknown[]).some((e) => typeof e !== 'string')
        ) {
          continue;
        }
        stagings.push({
          siteKey: entry.siteKey,
          boneKind: entry.boneKind,
          bonePlaced: entry.bonePlaced as boolean,
          offeringGiven: entry.offeringGiven as boolean,
          nameSpoken: entry.nameSpoken as boolean,
          extrasDone: [...(entry.extrasDone as string[])],
          completed: entry.completed as boolean,
        });
      }
    }
    const awakenings: SavedAwakening[] = [];
    if (value.awakenings !== undefined && Array.isArray(value.awakenings)) {
      for (const entry of value.awakenings) {
        if (!isRecord(entry)) continue;
        if (typeof entry.kind !== 'string' || entry.kind === '') continue;
        if (!Number.isInteger(entry.tier) || (entry.tier as number) <= 0) {
          continue;
        }
        awakenings.push({ kind: entry.kind, tier: entry.tier as number });
      }
    }
    // Quest flags are optional on read, same
    // additive-field rule: old v1 saves without them
    // load with quests absent (all false).
    // Field-level leniency: boolean fields kept,
    // anything else dropped; a record with no valid
    // field loads as absent (all false).
    let quests: SavedQuestFlags | undefined;
    if (value.quests !== undefined && isRecord(value.quests)) {
      const record = value.quests as Record<string, unknown>;
      const parsed: SavedQuestFlags = {};
      const questFields = [
        'ateWhileHungry',
        'slept',
        'ritualCompleted',
        'craftedAtStump',
      ] as const;
      for (const field of questFields) {
        if (typeof record[field] === 'boolean') {
          parsed[field] = record[field] as boolean;
        }
      }
      // The active mark (2026-11-01): a string naming a
      // KNOWN quest id rides; anything else (unknown or
      // stale id, wrong type) drops — it reads as no
      // mark, never as a corrupt save.
      if (typeof record.active === 'string' && questById(record.active)) {
        parsed.active = record.active;
      }
      // The latch (2026-11-01): the completed set rides
      // with the mark's exact posture — known ids only,
      // deduplicated; an all-unknown list reads as no
      // latch, never as a corrupt save.
      if (Array.isArray(record.completed)) {
        const known = [
          ...new Set(
            record.completed.filter(
              (entry): entry is string =>
                typeof entry === 'string' && questById(entry) !== undefined,
            ),
          ),
        ];
        if (known.length > 0) parsed.completed = known;
      }
      if (Object.keys(parsed).length > 0) quests = parsed;
    }
    // CHARM-LIST MIGRATION (2026-10-28, shrew-only):
    // an existing save holding the grant's shrew item
    // + its awakening moves the charm to the list: drop
    // the item, keep the record (0.5 lb frees). Safe
    // because the grant is the shrew's sole source
    // (world excludes shrew) — no found bone is ever
    // removed. Item-only saves keep the item (they
    // self-heal: next boot's grant awakens, the
    // following save migrates). Idempotent: re-save
    // writes the cleaned inventory.
    if (
      awakenings.some((entry) => entry.kind === FIRST_CHARM_KIND) &&
      inventory[FIRST_CHARM_ITEM] !== undefined
    ) {
      delete inventory[FIRST_CHARM_ITEM];
    }
    // World name: optional string, additive (old saves load
    // without it). Non-string values drop — the name is a
    // display label, never load-bearing, so a bad value
    // drops the field, never the document.
    const worldName =
      typeof value.worldName === 'string' ? value.worldName : undefined;
    return {
      version: SAVE_VERSION,
      savedAt: value.savedAt,
      seed: value.seed,
      ...(worldName !== undefined ? { worldName } : {}),
      cameraMode: value.cameraMode,
      position: { x: value.position.x, z: value.position.z },
      inventory,
      hunger: Math.min(100, Math.max(0, value.hunger)),
      journalLinked,
      worn,
      fires,
      houses,
      looms,
      piles,
      traps,
      stumps,
      torches,
      altars,
      desks,
      cauldrons,
      dimensionVisit,
      acquisitionOrder,
      companions,
      fragments,
      discovery,
      tents,
      nameSight,
      stagings,
      awakenings,
      ...(quests !== undefined ? { quests } : {}),
      harvestState,
      sky,
      facing,
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
