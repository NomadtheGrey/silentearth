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
 * - placed sleeping bags (position, id optional — no
 *   game import): same additive-field rule (old saves
 *   load bags: []) and the tents leniency on read
 *   (entries pass through; the placed-bag restore
 *   validates + drops bad records). Placed bags carry
 *   no shelter state — the bag's thatch-tier shelter
 *   contribution is composed at sleep by the shell
 *   (Adam's pin, 2026-11-02), never stored. Order
 *   preserved; duplicate positions allowed; multiples
 *   allowed by design (the tent pattern whole).
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
import type { KnowledgeSnapshot } from './knowledge-register';
import type { ColdWetSnapshot } from './cold-wet';
import {
  INJURY_STAGES,
  type InjurySnapshot,
  type InjuryStage,
} from './injury';
import type { ScentSnapshot } from './scent';
// Single source for the ritual records (rituals.ts /
// charms.ts own them; save.ts imports them — no second
// mirror to drift, the placed-torch id lesson).
import type { SavedRitualStaging } from './rituals';
import type { SavedCompanion } from './companions';
import type { SavedMarkProgress } from './fragments';
import type { SavedDiscovery } from './discovery';
import type { SavedAwakening } from './charms';
import type { SavedQuestFlags } from './quests';
import { questById, isBoneQuestKind } from './quests';

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
  | { method: 'friction'; phase: 'waiting' | 'ready'; waitUntil: number }
  | { method: 'candle'; phase: 'waiting'; waitUntil: number };

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
  /** Placement facing (2026-11-02, the yaw path);
   *  absent on pre-yaw saves, reads as 0. */
  rotY?: number;
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
  /** Placement facing (2026-11-02, houses take yaw —
   *  the door faces the placer). Absent reads as 0. */
  rotY?: number;
  contents: Record<string, number>;
}

export interface SavedLoom {
  x: number;
  z: number;
  /** Placement facing (2026-11-02, the yaw path). */
  rotY?: number;
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
  /**
   * The catch stamp (trapState's caughtAtHour, the
   * absolute game hour the catch was made; the
   * trap-steal seat, 2026-11-06). Absent = unstamped
   * (an old save's standing catch reads freshly
   * caught). Carried through verbatim when present;
   * trapState.restore() owns its validation.
   */
  caughtAtHour?: number;
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
 * A placed altar, as saved. The altar is the SITE;
 * its consecration additions ride when present (altar
 * parity, 2026-11-01 — the base carries the road's
 * progress, as a stump does). `id` is
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
  /**
   * Consecration additions (altar parity, Adam
   * 2026-11-01): the placed altar is a BASE like the
   * stump and carries the same ordered additions
   * (stumpy-altar's record). Absent = unconsecrated
   * (every pre-parity altar); sparse like `id`.
   */
  additions?: string[];
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
  /** Placement facing (2026-11-02, the yaw path). */
  rotY?: number;
  id?: string;
  /** True when THE grimoire rests on this desk (the seat). */
  grimoire?: boolean;
}

/**
 * A placed CRAFTED WORKSTATION, as saved (the fix,
 * 2026-11-05 — the bench's placement half; the stump's
 * workstation is an ADDITION on a stump and saves with
 * the stumps, never here). No station state is stored
 * — the bench is the SITE; 'workstation' presence
 * derives from the placed record. `id` is optional:
 * Background's placed-workstation entity owns the id
 * scheme (desk precedent); the save carries position
 * always and the id when the entity provides one.
 * Order preserved; duplicate positions allowed.
 */
export interface SavedCraftedWorkstation {
  x: number;
  z: number;
  /** Placement facing (the yaw path, as desks). */
  rotY?: number;
  id?: string;
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
 * A jar-made ground patch (Background's jarPatchState
 * snapshot shape, seated 2026-11-01): the pour's work
 * in the world — mud where water was dumped on dry
 * ground, water where it was dumped on mud (Adam's
 * water cycle). The patch is placed STATE, not an
 * item; lifetime is the state's own ruling.
 */
export interface SavedPatch {
  id: string;
  kind: 'mud' | 'water';
  x: number;
  z: number;
}

/**
 * One painted glow-moss patch, as saved (Background's
 * mossPaintState register record — the MossPaintPatch
 * seam facts, via DEV 2026-11-03): a CAVE-LOCAL mark
 * carried WHOLE — { id, x, y, z, surface, nx, nz }:
 * the 3D centre ON the surface (y = 0 for floors, the
 * aim height for walls), whether it paints a wall or
 * the floor, and the wall's axis normal. A mark stored
 * without its height, surface, and normal cannot
 * re-render — it has nowhere to stand. The id is
 * POSITION-KEYED by the register
 * ('moss-paint:<dimensionKey>:<x>,<y>,<z>', 2-dp) and
 * stable across save/load with no counter, so the
 * seat round-trips by construction. The jar patches'
 * SavedPatch is the precedent; the whole-mark payload
 * and the dimension grouping are the differences.
 */
export interface SavedMossPaintPatch {
  id: string;
  x: number;
  y: number;
  z: number;
  surface: 'wall' | 'floor';
  nx: number;
  nz: number;
}

/** One dimension's painted patches, as saved. */
export interface SavedMossPaintDimension {
  dimensionKey: string;
  patches: SavedMossPaintPatch[];
}

/**
 * One named place, as saved (the game/namedPlaces
 * register's own shape, HOSTED: Systems seats the
 * record, the register owns its meaning — the moss
 * paint arrangement): her name VERBATIM, the spot she
 * stood at (y null where height is not relevant), the
 * dimension it stands in ('surface', 'cave:<id>',
 * opaque), and the world-day she named it. The id is
 * position-keyed by the register and stable across
 * save/load.
 */
export interface SavedNamedPlace {
  id: string;
  name: string;
  x: number;
  y: number | null;
  z: number;
  dimensionKey: string;
  day: number;
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
 * A placed sleeping bag, as saved. Structural twin of
 * SavedTent (the bag body is Background's setBags seam,
 * BagPosition in game/shelter.ts): the save carries
 * position always and the id when the entity provides
 * one. Order preserved; duplicate positions allowed;
 * multiples allowed by design.
 */
export interface SavedBag {
  x: number;
  z: number;
  id?: string;
}

/**
 * One laid hedge, as saved (the Hedge build,
 * 2026-11-05). Mirrors hedge.ts's HedgeRecord
 * field-for-field (snapshot = stored = restore, zero
 * conversion — the named-place discipline). `homeId`
 * is the placed shelter's id, opaque + verbatim;
 * laidDay/rootedDay are world days (rootedDay =
 * laidDay + ROOT_DAYS; the effects wake at rooting).
 */
export interface SavedHedge {
  homeId: string;
  x: number;
  z: number;
  laidDay: number;
  rootedDay: number;
}

/**
 * One laid HearthHome seal, as saved (the hearthhome
 * landing, 2026-11-05). Mirrors hearthhome.ts's
 * SealRecord field-for-field (snapshot = stored =
 * restore, zero conversion). `placeId` is the bounded
 * place's id, opaque + verbatim; radiusM is the
 * footprint's radius (a fact of the place); laidDay
 * is a world day.
 */
export interface SavedSeal {
  placeId: string;
  x: number;
  z: number;
  radiusM: number;
  laidDay: number;
}

/**
 * One found place in the gazetteer (the gazetteer
 * landing, 2026-11-07). Mirrors gazetteer.ts's
 * GazetteerRecord field-for-field (snapshot = stored
 * = restore, zero conversion).
 */
export interface SavedGazetteerEntry {
  placeKey: string;
  family: string;
  name: string;
  x: number;
  z: number;
  dimensionKey: string;
  dayFound: number;
  carrierSeen: boolean;
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
  /**
   * Bush scatter ids that have GIVEN their cuttings
   * (the Hedge build, 2026-11-05): a bush gives its
   * cuttings ONCE, on its first harvest, and never
   * again — this set is the one-off fact, riding the
   * harvest state it belongs to. OPTIONAL on the save
   * side until Background's HarvestStateSnapshot
   * carries the field (the seat-first staging the
   * desk's grimoire flag used): absent reads as []
   * everywhere — the empty state provides it, the
   * copy helper fills it, and the engine's restore
   * treats absence as none-given.
   */
  cuttingsGiven?: string[];
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
    cuttingsGiven: [],
  };
}

/**
 * One dimension's world state, as saved (the lootable-
 * buckets build, 2026-11-03 — the 2026-10-31 design):
 * the piles and harvest state that belong to ONE
 * dimension, in that dimension's own coordinates. The
 * SURFACE is not a bucket — it keeps the document's
 * top-level piles + harvestState byte-for-byte, and
 * "no bucket" IS the surface. A bucket exists only
 * for a dimension she has changed state in.
 */
export interface SavedDimensionWorldState {
  piles: SavedPile[];
  harvest: SavedHarvestState;
}

/** A fresh, empty bucket (fresh arrays per call). */
export function emptyDimensionWorldState(): SavedDimensionWorldState {
  return { piles: [], harvest: emptySavedHarvestState() };
}

/** A deep copy of a saved harvest state (serialize). */
function copySavedHarvestState(h: SavedHarvestState): SavedHarvestState {
  return {
    shrunk: h.shrunk.map((e) => ({ ...e })),
    removed: [...h.removed],
    progress: h.progress.map((e) => ({ ...e })),
    spawnedLogs: h.spawnedLogs.map((e) => ({ ...e })),
    pendingSpawns: h.pendingSpawns.map((e) => ({ ...e })),
    spawnCounter: h.spawnCounter,
    felled: h.felled.map((e) => ({ ...e })),
    saplings: h.saplings.map((e) => ({ ...e })),
    saplingCounter: h.saplingCounter,
    clearedSpots: h.clearedSpots.map((e) => ({ ...e })),
    cuttingsGiven: [...(h.cuttingsGiven ?? [])],
  };
}

/**
 * A saved harvest state read from a document field:
 * a record passes through VERBATIM (the engine's
 * per-field guards validate at restore, the surface
 * rule since the world-state format landed); anything
 * else loads the empty state.
 */
function readSavedHarvestState(raw: unknown): SavedHarvestState {
  return isRecord(raw)
    ? (raw as unknown as SavedHarvestState)
    : emptySavedHarvestState();
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

/**
 * The hosted spell record's saved shape — a verbatim
 * mirror of game/weatherSpells.ts's WeatherSpellRecord.
 * If that record's shape ever changes, this mirror and
 * the lenient reader below change in the same landing.
 */
export interface SavedWeather {
  kind: 'dry' | 'wet' | 'inclement';
  startDay: number;
  lengthDays: number;
  index: number;
}

/**
 * The last completed sleep's seat, as saved (the
 * crawl-back's encampment record — crawl-back.ts's
 * resolveEncampment reads it). Position only: what
 * kind of site it was is the sleep machinery's
 * business, not the seat's.
 */
export interface SavedSleepSite {
  x: number;
  z: number;
}

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
  /** Placed crafted workstations (sites); [] for old saves. */
  craftedWorkstations: SavedCraftedWorkstation[];
  /** Placed cauldrons (keyed to their hearths); [] for old saves. */
  cauldrons: SavedCauldron[];
  /** Jar-made ground patches (mud/water); [] for old saves. */
  patches: SavedPatch[];
  /** Painted glow-moss patches, keyed by dimension
   * (Background's mossPaintState register, HOSTED:
   * Systems seats the record, the register owns its
   * meaning); [] for old saves. */
  mossPaint: SavedMossPaintDimension[];
  /** Places she has named (the game/namedPlaces
   * register, HOSTED); [] for old saves. */
  namedPlaces: SavedNamedPlace[];
  /** Laid hedges, one per ringed home; [] for old saves. */
  hedges: SavedHedge[];
  /** Laid HearthHome seals, one per sealed place; [] for old saves. */
  hearthhome: SavedSeal[];
  /** Found places (the gazetteer); [] for old saves. */
  gazetteer: SavedGazetteerEntry[];
  /** The cave visit this save was written in (boot-at-the-mouth
   * fact); null for surface saves and old saves. */
  dimensionVisit: SavedDimensionVisit | null;
  /** Acquisition order for the Recent sort (held kinds,
   * most recently gained first); [] for old saves. */
  acquisitionOrder: string[];
  /** Companion records (touched individuals only);
   * [] for old saves. */
  companions: SavedCompanion[];
  /** Kinds whose true names she knows by rite (the
   * familiar road, 2026-11-02); [] for old saves. */
  familiarNames: string[];
  /** Fragment progress by mark (begun marks only);
   * [] for old saves. */
  fragments: SavedMarkProgress[];
  /** Discovery facts (the Grove's finding day);
   * undiscovered for old saves. */
  discovery: SavedDiscovery;
  /** Placed tents (portable shelters); [] for old saves. */
  tents: SavedTent[];
  /** Placed sleeping bags (portable sleep sites);
   * [] for old saves. */
  bags: SavedBag[];
  /** Partial-true-name look counts; [] for old saves. */
  nameSight: SavedNameLook[];
  /** Known-facts register (met items + known recipe
   * uses); empty for old saves. */
  knowledge: KnowledgeSnapshot;
  /** Her cold / wet gauges; 0/0 for old saves. */
  coldWet: ColdWetSnapshot;
  /** The sky's spell record (Background's W1 machine),
   * HOSTED VERBATIM: Systems seats the field, the
   * machine owns its meaning (weatherSpells.ts's
   * WeatherSpellRecord, mirrored here so this file
   * imports nothing from game/). Null for old saves
   * and fresh worlds until the machine seats one. */
  weather: SavedWeather | null;
  /** Her injury stage (injury.ts); sound for old saves. */
  injury: InjurySnapshot;
  /** Her applied scent (scent.ts); unscented for old
   * saves. */
  scent: ScentSnapshot;
  /** The last place she COMPLETED a sleep (the
   * crawl-back's encampment seat); null for old saves
   * and until she first sleeps. */
  lastSleepSite: SavedSleepSite | null;
  /** Ferals that have given their warning (creature
   * ids — the encounter ledger's seat); [] for old
   * saves. */
  feralWarned: string[];
  /** Ritual stagings (site + kind + steps); [] for old saves. */
  stagings: SavedRitualStaging[];
  /** Charm awakenings (kind + tier + toggle; an absent toggle reads
   * on); [] for old saves. */
  awakenings: SavedAwakening[];
  /** Bone kinds acquired for one-of-every-bone (the
   * latch's own record — kinds, validated + deduped);
   * [] for old saves. */
  boneAcquisitions: string[];
  /** Quest event flags; absent for old saves (all false). */
  quests?: SavedQuestFlags;
  /** World harvest state; empty snapshot for old saves. */
  harvestState: SavedHarvestState;
  /** Per-dimension world state (lootable buckets);
   * {} for old saves. The surface is NOT a bucket —
   * it is the top-level piles + harvestState above. */
  dimensionStates: Record<string, SavedDimensionWorldState>;
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
    /** Placement facing (2026-11-02, the yaw path). */
    rotY?: number;
    lit: boolean;
    lighting?: SavedLightingProcess | null;
  }>;
  houses: ReadonlyArray<{
    type: string;
    x: number;
    z: number;
    rotY?: number;
    contents: ReadonlyArray<{ item: string; quantity: number }>;
  }>;
  looms: ReadonlyArray<{ x: number; z: number; rotY?: number }>;
  /**
   * World-state fields (Background's persistence seams,
   * a39f47f). ALL OPTIONAL so existing saveNow call sites
   * keep compiling unchanged until the App wiring lands
   * (UI's parallel brief): serialize writes defaults for
   * missing fields, deserialize defaults them on read.
   */
  harvestState?: SavedHarvestState;
  /**
   * Per-dimension buckets from the live stores
   * (dimension key -> that dimension's piles +
   * harvest snapshots). OPTIONAL, the trap pattern:
   * existing saveNow call sites compile unchanged.
   */
  dimensionStates?: Record<string, SavedDimensionWorldState>;
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
    caughtAtHour?: number;
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
    additions?: ReadonlyArray<string>;
  }>;
  /**
   * Placed desks from the placed-desk source
   * (Background's entity snapshot, once it lands).
   * OPTIONAL, same trap-save pattern as altars.
   */
  desks?: ReadonlyArray<{
    x: number;
    z: number;
    rotY?: number;
    id?: string;
    grimoire?: boolean;
  }>;
  /**
   * Placed crafted workstations from the placed-bench
   * source (Background's entity snapshot). OPTIONAL,
   * same trap-save pattern as desks.
   */
  craftedWorkstations?: ReadonlyArray<{
    x: number;
    z: number;
    rotY?: number;
    id?: string;
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
   * Jar-made ground patches from the patch-state
   * source (Background's jarPatchState snapshot).
   * OPTIONAL, same trap-save pattern as cauldrons.
   */
  patches?: ReadonlyArray<{
    id: string;
    kind: 'mud' | 'water';
    x: number;
    z: number;
  }>;
  /**
   * Painted glow-moss patches from the mossPaintState
   * register's snapshot ({ dimensionKey, patches }[]
   * — the register's own shape). OPTIONAL, same
   * trap-save pattern.
   */
  mossPaint?: ReadonlyArray<{
    dimensionKey: string;
    patches: ReadonlyArray<{
      id: string;
      x: number;
      y: number;
      z: number;
      surface: 'wall' | 'floor';
      nx: number;
      nz: number;
    }>;
  }>;
  /**
   * Named places from the namedPlaces register's
   * snapshot (the register's own shape). OPTIONAL,
   * same trap-save pattern.
   */
  namedPlaces?: ReadonlyArray<{
    id: string;
    name: string;
    x: number;
    y: number | null;
    z: number;
    dimensionKey: string;
    day: number;
  }>;
  /**
   * Laid hedges from the hedge state's snapshot.
   * OPTIONAL, same trap-save pattern as namedPlaces.
   */
  hedges?: ReadonlyArray<{
    homeId: string;
    x: number;
    z: number;
    laidDay: number;
    rootedDay: number;
  }>;
  /**
   * Laid HearthHome seals from the seal state's
   * snapshot. OPTIONAL, same trap-save pattern as
   * hedges.
   */
  hearthhome?: ReadonlyArray<{
    placeId: string;
    x: number;
    z: number;
    radiusM: number;
    laidDay: number;
  }>;
  /** Found places from the gazetteer state's snapshot. OPTIONAL, trap pattern. */
  gazetteer?: ReadonlyArray<{
    placeKey: string;
    family: string;
    name: string;
    x: number;
    z: number;
    dimensionKey: string;
    dayFound: number;
    carrierSeen: boolean;
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
   * Kinds whose true names she knows by rite, from
   * FamiliarState.knownKinds() at save time. OPTIONAL,
   * same pattern; absent = [] (no name has been taught).
   */
  familiarNames?: readonly string[];
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
   * Placed sleeping bags from the shell's placed-bag
   * state (Background's setBags seam). OPTIONAL, same
   * pattern as tents: format now, wiring later.
   */
  bags?: ReadonlyArray<{
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
   * Known-facts register from knowledgeSnapshot().
   * OPTIONAL so existing saveNow call sites keep
   * compiling unchanged until the App wiring lands
   * (same pattern as nameSight above).
   */
  knowledge?: {
    metItems?: ReadonlyArray<string>;
    knownUseRecipes?: ReadonlyArray<string>;
    usedItems?: ReadonlyArray<string>;
  };
  /**
   * Her cold / wet gauges from ColdWetState.snapshot().
   * OPTIONAL, same wiring-later pattern.
   */
  coldWet?: {
    cold?: number;
    wet?: number;
  };
  /**
   * The spell record from weatherStateSnapshot(),
   * hosted verbatim. OPTIONAL, same wiring-later
   * pattern; null/absent writes a null field.
   */
  weather?: {
    kind: 'dry' | 'wet' | 'inclement';
    startDay: number;
    lengthDays: number;
    index: number;
  } | null;
  /**
   * Her injury snapshot from InjuryState.snapshot().
   * OPTIONAL, same wiring-later pattern.
   */
  injury?: {
    stage?: string;
  };
  /**
   * Her scent snapshot from ScentState.snapshot().
   * OPTIONAL, same wiring-later pattern.
   */
  scent?: {
    kind?: string | null;
    category?: string | null;
    secondsLeft?: number;
  };
  /**
   * The last completed sleep's seat (the shell writes
   * it at sleep completion). OPTIONAL; null/absent
   * writes a null field.
   */
  lastSleepSite?: {
    x: number;
    z: number;
  } | null;
  /**
   * The encounter ledger from FeralEncounterState.
   * snapshot(). OPTIONAL, same wiring-later pattern.
   */
  feralWarned?: ReadonlyArray<string>;
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
    enabled?: boolean;
  }>;
  /**
   * Bone-acquisition latch from boneAcquisitionsFor()
   * (quests.ts) — the shell folds the union in at save
   * time. OPTIONAL, same wiring-later pattern.
   */
  boneAcquisitions?: ReadonlyArray<string>;
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
 * - 'clay-pot' — retired 2026-11-01 on Adam's word
 *   ('If they do the same thing, we'll get rid of one'):
 *   the pot and the jar overlapped as vessels; the jar
 *   stands (it carries Adam's water rulings), took the
 *   pot-trap job, and the pot item retires. Its registry
 *   rows stay; only a saved stack drops here.
 * - 'salt-crystal' — retired 2026-11-02 on Adam's word
 *   ('let's do away with salt plains those are nowhere
 *   near here'): the item retires with its biome (the
 *   salt flats leave the country in Background's biome
 *   landing). It never had a use ('No known use yet'
 *   stood in its description to the end), so the loss
 *   is nil. Its registry rows stay, per the pattern;
 *   only a saved stack drops here.
 */
const RETIRED_ITEM_IDS: ReadonlySet<string> = new Set([
  'bloomery',
  'wattle-and-daub-hut',
  // The clay pot (Adam, 2026-11-01): one vessel stands —
  // the jar took its trap job and its water cycle.
  'clay-pot',
  // Salt (Adam, 2026-11-02): the flats are nowhere near
  // here — the item retires with its biome.
  'salt-crystal',
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
      ...(typeof fire.rotY === 'number' && Number.isFinite(fire.rotY) ? { rotY: fire.rotY } : {}),
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
        ? copySavedHarvestState(draft.harvestState)
        : emptySavedHarvestState(),
    // Dimension buckets: written AS-IS (each bucket's
    // piles + harvest deep-copied, keys verbatim).
    // Buckets ride only for dimensions the caller
    // seats — an untouched dimension writes nothing.
    dimensionStates: Object.fromEntries(
      Object.entries(draft.dimensionStates ?? {}).map(([key, bucket]) => [
        key,
        {
          piles: bucket.piles.map((pile) => ({
            stacks: pile.stacks.map((s) => ({ ...s })),
            x: pile.x,
            z: pile.z,
          })),
          harvest: copySavedHarvestState(bucket.harvest),
        },
      ]),
    ),
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
      ...(typeof house.rotY === 'number' && Number.isFinite(house.rotY) ? { rotY: house.rotY } : {}),
      contents: normalizeStacks(house.contents),
    })),
    looms: draft.looms.map((loom) => ({
      x: loom.x,
      z: loom.z,
      ...(typeof loom.rotY === 'number' && Number.isFinite(loom.rotY) ? { rotY: loom.rotY } : {}),
    })),
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
      ...(trap.caughtAtHour !== undefined
        ? { caughtAtHour: trap.caughtAtHour }
        : {}),
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
      ...(altar.additions !== undefined
        ? { additions: [...altar.additions] }
        : {}),
    })),
    // Desks: written AS-IS, same as altars (positions
    // verbatim, id when the entity provides one — no
    // filtering, no normalization). Invalid entries
    // are restore()'s problem, not serialize's. The
    // seated-grimoire flag writes only when true.
    desks: (draft.desks ?? []).map((desk) => ({
      x: desk.x,
      z: desk.z,
      ...(typeof desk.rotY === 'number' && Number.isFinite(desk.rotY) ? { rotY: desk.rotY } : {}),
      ...(desk.id !== undefined ? { id: desk.id } : {}),
      ...(desk.grimoire === true ? { grimoire: true } : {}),
    })),
    // Crafted workstations: written AS-IS, same as
    // desks (positions verbatim, facing/id when the
    // entity provides them — no filtering, no
    // normalization). No station state is written —
    // the bench is the SITE.
    craftedWorkstations: (draft.craftedWorkstations ?? []).map((bench) => ({
      x: bench.x,
      z: bench.z,
      ...(typeof bench.rotY === 'number' && Number.isFinite(bench.rotY) ? { rotY: bench.rotY } : {}),
      ...(bench.id !== undefined ? { id: bench.id } : {}),
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
    // Patches: written AS-IS, same as cauldrons (id +
    // kind + position verbatim — no filtering, no
    // normalization). The patch is placed state; its
    // lifetime ruling lives with the state, not here.
    patches: (draft.patches ?? []).map((patch) => ({
      id: patch.id,
      kind: patch.kind,
      x: patch.x,
      z: patch.z,
    })),
    // Moss paint: the register's snapshot written
    // AS-IS (dimension groups + patches verbatim,
    // deep-copied, every patch WHOLE — draft, stored
    // field, and restore all carry the snapshot's own
    // shape; DEV's final settle 2026-11-03). The
    // keyed-record variant stood for one commit
    // (6365cc9, the countermand followed literally
    // mid-crossing) and does not stand. Validation is
    // restore()'s problem, not the writer's.
    mossPaint: (draft.mossPaint ?? []).map((group) => ({
      dimensionKey: group.dimensionKey,
      patches: group.patches.map((patch) => ({
        id: patch.id,
        x: patch.x,
        y: patch.y,
        z: patch.z,
        surface: patch.surface,
        nx: patch.nx,
        nz: patch.nz,
      })),
    })),
    // Named places: the register's snapshot written
    // AS-IS (verbatim names, spots, dimensions, days —
    // deep-copied). Validation is restore()'s problem,
    // not the writer's (the moss paint discipline).
    namedPlaces: (draft.namedPlaces ?? []).map((place) => ({
      id: place.id,
      name: place.name,
      x: place.x,
      y: place.y,
      z: place.z,
      dimensionKey: place.dimensionKey,
      day: place.day,
    })),
    // Hedges: the state's snapshot written AS-IS
    // (home ids verbatim, centres, days). Validation
    // is restore's problem, not the writer's.
    hedges: (draft.hedges ?? []).map((hedge) => ({
      homeId: hedge.homeId,
      x: hedge.x,
      z: hedge.z,
      laidDay: hedge.laidDay,
      rootedDay: hedge.rootedDay,
    })),
    // Seals: the state's snapshot written AS-IS (place
    // ids verbatim, centres, radii, days).
    hearthhome: (draft.hearthhome ?? []).map((seal) => ({
      placeId: seal.placeId,
      x: seal.x,
      z: seal.z,
      radiusM: seal.radiusM,
      laidDay: seal.laidDay,
    })),
    // The gazetteer: the state's snapshot written
    // AS-IS (keys, families, names verbatim).
    gazetteer: (draft.gazetteer ?? []).map((entry) => ({
      placeKey: entry.placeKey,
      family: entry.family,
      name: entry.name,
      x: entry.x,
      z: entry.z,
      dimensionKey: entry.dimensionKey,
      dayFound: entry.dayFound,
      carrierSeen: entry.carrierSeen,
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
    // Familiar names: written AS-IS (the kinds she has
    // been taught, in the order learned).
    familiarNames: [...(draft.familiarNames ?? [])],
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
    // Sleeping bags: the tents pattern whole — written
    // AS-IS (position + the id when present); no shelter
    // state is written, the bag's contribution is
    // composed at sleep, never stored.
    bags: (draft.bags ?? []).map((bag) => ({
      x: bag.x,
      z: bag.z,
      ...(bag.id !== undefined ? { id: bag.id } : {}),
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
    // Known-facts register: written AS-IS (id strings
    // verbatim). Invalid entries are restoreKnowledge()'s
    // problem, not serialize's.
    knowledge: {
      metItems: [...(draft.knowledge?.metItems ?? [])],
      knownUseRecipes: [...(draft.knowledge?.knownUseRecipes ?? [])],
      usedItems: [...(draft.knowledge?.usedItems ?? [])],
    },
    // Cold / wet gauges: finite-guarded here (a NaN
    // would poison the JSON document); range is the
    // state's own clamp, applied at construction.
    coldWet: {
      cold:
        typeof draft.coldWet?.cold === 'number' &&
        Number.isFinite(draft.coldWet.cold)
          ? draft.coldWet.cold
          : 0,
      wet:
        typeof draft.coldWet?.wet === 'number' &&
        Number.isFinite(draft.coldWet.wet)
          ? draft.coldWet.wet
          : 0,
    },
    // The spell record: written AS-IS when the draft
    // carries a well-shaped one (kind + finite numbers);
    // anything else writes null rather than poison the
    // document — the machine re-seats a fresh spell for
    // a null record at world install.
    weather:
      draft.weather !== null &&
      draft.weather !== undefined &&
      (draft.weather.kind === 'dry' ||
        draft.weather.kind === 'wet' ||
        draft.weather.kind === 'inclement') &&
      Number.isFinite(draft.weather.startDay) &&
      Number.isFinite(draft.weather.lengthDays) &&
      Number.isFinite(draft.weather.index)
        ? {
            kind: draft.weather.kind,
            startDay: draft.weather.startDay,
            lengthDays: draft.weather.lengthDays,
            index: draft.weather.index,
          }
        : null,
    // Injury: the stage written when it names a real
    // stage; anything else writes 'sound' rather than
    // poison the document.
    injury: {
      stage:
        draft.injury?.stage !== undefined &&
        (INJURY_STAGES as readonly string[]).includes(draft.injury.stage)
          ? (draft.injury.stage as InjuryStage)
          : 'sound',
    },
    // Scent: a record naming a real kind with a
    // finite clock rides (category kept for the
    // attractor, dropped otherwise); anything else
    // writes the unscented record.
    scent:
      (draft.scent?.kind === 'repellent' ||
        draft.scent?.kind === 'attractor') &&
      typeof draft.scent?.secondsLeft === 'number' &&
      Number.isFinite(draft.scent.secondsLeft) &&
      draft.scent.secondsLeft > 0
        ? {
            kind: draft.scent.kind,
            category:
              draft.scent.kind === 'attractor' &&
              typeof draft.scent.category === 'string'
                ? draft.scent.category
                : null,
            secondsLeft: draft.scent.secondsLeft,
          }
        : { kind: null, category: null, secondsLeft: 0 },
    // Last sleep site: finite coords ride as-is;
    // anything else writes null (no completed sleep
    // on record — the encampment chain falls back).
    lastSleepSite:
      draft.lastSleepSite !== null &&
      draft.lastSleepSite !== undefined &&
      Number.isFinite(draft.lastSleepSite.x) &&
      Number.isFinite(draft.lastSleepSite.z)
        ? { x: draft.lastSleepSite.x, z: draft.lastSleepSite.z }
        : null,
    // The encounter ledger: written AS-IS (creature
    // ids are caller-defined); restore validates.
    feralWarned: [...(draft.feralWarned ?? [])],
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
      ...(entry.enabled === undefined
        ? {}
        : { enabled: entry.enabled }),
    })),
    // Bone acquisitions: written AS-IS (the helper's
    // union is already kinds-only + deduped); kind
    // validation + dedupe repeat on read, so a stale
    // or hand-edited record self-cleans at load.
    boneAcquisitions: [...(draft.boneAcquisitions ?? [])],
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

/**
 * Saved piles, parsed from a document field.
 */
function parseSavedPiles(raw: unknown): SavedPile[] | null {
    // The piles read (the ONE parser, factored
    // 2026-11-03 for the buckets build): an absent
    // field loads []; a present-but-malformed list
    // returns null — the SURFACE caller treats null
    // as whole-document corruption (its standing
    // strictness, same as fires/houses), a BUCKET
    // caller drops that bucket. MIGRATION (multi-kind,
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
    if (raw !== undefined) {
      if (!Array.isArray(raw)) return null;
      for (const entry of raw) {
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
    return [...pilesBySpot.values()];
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
        ...(typeof (entry as { rotY?: unknown }).rotY === 'number' && Number.isFinite((entry as { rotY: number }).rotY)
          ? { rotY: (entry as { rotY: number }).rotY }
          : {}),
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
        ...(typeof (entry as { rotY?: unknown }).rotY === 'number' && Number.isFinite((entry as { rotY: number }).rotY)
          ? { rotY: (entry as { rotY: number }).rotY }
          : {}),
        contents,
      });
    }
    if (!Array.isArray(value.looms)) return null;
    const looms: SavedLoom[] = [];
    for (const entry of value.looms) {
      if (!isPosition(entry)) return null;
      looms.push({
        x: entry.x,
        z: entry.z,
        ...(typeof (entry as unknown as { rotY?: unknown }).rotY === 'number' &&
        Number.isFinite((entry as unknown as { rotY: number }).rotY)
          ? { rotY: (entry as unknown as { rotY: number }).rotY }
          : {}),
      });
    }
    // Piles: the surface read of the ONE parser
    // (parseSavedPiles), under the surface's standing
    // strictness — an old save without the field loads
    // [], and a malformed list makes the whole
    // document corrupt. The same parser reads each
    // dimension bucket below, where a null drops the
    // BUCKET instead of the document.
    const piles = parseSavedPiles(value.piles);
    if (piles === null) return null;
    // World state: optional on read, same additive-field rule
    // as piles/traps — an old v1 save without these fields
    // loads defaults, never breaks. Invalid entries pass
    // through: the engine restores validate and drop
    // (fireState.validLighting, harvestState per-field guards
    // with replace-not-merge, sky/facing finite checks that
    // ignore bad snapshots), so a bad world-state record can
    // never corrupt the whole document. A missing or
    // non-record field loads its default.
    const harvestState: SavedHarvestState = readSavedHarvestState(
      value.harvestState,
    );
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
          // The stamp passes only as a finite number;
          // a bad stamp is dropped, never the catch
          // (the toggle leniency). restore() decides
          // what a stamp without a catch means (it
          // drops it — a stamp never stands alone).
          ...(typeof entry.caughtAtHour === 'number' &&
          Number.isFinite(entry.caughtAtHour)
            ? { caughtAtHour: entry.caughtAtHour as number }
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
          ...(Array.isArray(entry.additions)
            ? {
                additions: entry.additions.filter(
                  (addition): addition is string =>
                    typeof addition === 'string',
                ),
              }
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
          ...(typeof entry.rotY === 'number' && Number.isFinite(entry.rotY)
            ? { rotY: entry.rotY as number }
            : {}),
          ...(typeof entry.id === 'string'
            ? { id: entry.id as string }
            : {}),
          ...(entry.grimoire === true ? { grimoire: true } : {}),
        });
      }
    }
    // Crafted workstations are optional on read, same
    // leniency as desks: an old v1 save without them
    // loads with craftedWorkstations: []. Entries pass
    // through UNVALIDATED — the placed-bench restore
    // validates (finite coords) and drops what it
    // cannot use, so a bad entry can never corrupt the
    // whole document. A non-array field loads as [].
    const craftedWorkstations: SavedCraftedWorkstation[] = [];
    if (value.craftedWorkstations !== undefined && Array.isArray(value.craftedWorkstations)) {
      for (const entry of value.craftedWorkstations) {
        if (!isRecord(entry)) continue;
        craftedWorkstations.push({
          x: entry.x as number,
          z: entry.z as number,
          ...(typeof entry.rotY === 'number' && Number.isFinite(entry.rotY)
            ? { rotY: entry.rotY as number }
            : {}),
          ...(typeof entry.id === 'string'
            ? { id: entry.id as string }
            : {}),
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
    // Patches are optional on read, same leniency as
    // cauldrons: an old v1 save without them loads
    // with patches: []. Entries pass through — the
    // patch-state restore validates and drops bad
    // records — except the KIND, which is this
    // document's own vocabulary: an entry whose kind
    // is neither 'mud' nor 'water' is not a patch and
    // drops here, whole-record. A non-array patches
    // field loads as [].
    const patches: SavedPatch[] = [];
    if (value.patches !== undefined && Array.isArray(value.patches)) {
      for (const entry of value.patches) {
        if (!isRecord(entry)) continue;
        if (entry.kind !== 'mud' && entry.kind !== 'water') continue;
        patches.push({
          id: entry.id as string,
          kind: entry.kind,
          x: entry.x as number,
          z: entry.z as number,
        });
      }
    }
    // Moss paint is optional on read, same additive
    // rule: an old v1 save without it loads with [].
    // The field is a HOSTED snapshot: groups pass by
    // their dimension key verbatim; within a group, a
    // patch rides WHOLE — string id, finite centre
    // (x, y, z), a surface this document knows ('wall'
    // / 'floor' — the SavedPatch kind rule), finite
    // normals — a bad patch drops alone, a group left
    // empty is not kept. A non-array field loads [] —
    // including a keyed-record field written by the
    // one-commit variant (6365cc9): it drops whole
    // rather than be misread.
    const mossPaint: SavedMossPaintDimension[] = [];
    if (value.mossPaint !== undefined && Array.isArray(value.mossPaint)) {
      for (const group of value.mossPaint) {
        if (!isRecord(group)) continue;
        if (typeof group.dimensionKey !== 'string' || group.dimensionKey === '') continue;
        if (!Array.isArray(group.patches)) continue;
        const patches: SavedMossPaintPatch[] = [];
        for (const entry of group.patches) {
          if (!isRecord(entry)) continue;
          if (typeof entry.id !== 'string' || entry.id === '') continue;
          if (entry.surface !== 'wall' && entry.surface !== 'floor') continue;
          if (
            !Number.isFinite(entry.x) || !Number.isFinite(entry.y) ||
            !Number.isFinite(entry.z) || !Number.isFinite(entry.nx) ||
            !Number.isFinite(entry.nz)
          ) continue;
          patches.push({
            id: entry.id,
            x: entry.x as number,
            y: entry.y as number,
            z: entry.z as number,
            surface: entry.surface,
            nx: entry.nx as number,
            nz: entry.nz as number,
          });
        }
        if (patches.length > 0) {
          mossPaint.push({ dimensionKey: group.dimensionKey, patches });
        }
      }
    }
    // Named places are optional on read: an old v1
    // save without the field loads namedPlaces: [].
    // Per-entry leniency (the SavedPatch idiom): a
    // place rides WHOLE — non-empty string id, string
    // name (verbatim, even odd — the register guards
    // blanks at the act), finite x/z, non-empty
    // dimension key, finite day; a bad y (the optional
    // axis) reads as null rather than dropping the
    // place. A bad entry drops alone; a non-array
    // field loads [].
    const namedPlaces: SavedNamedPlace[] = [];
    if (value.namedPlaces !== undefined && Array.isArray(value.namedPlaces)) {
      for (const entry of value.namedPlaces) {
        if (!isRecord(entry)) continue;
        if (typeof entry.id !== 'string' || entry.id === '') continue;
        if (typeof entry.name !== 'string') continue;
        if (!Number.isFinite(entry.x) || !Number.isFinite(entry.z)) continue;
        if (typeof entry.dimensionKey !== 'string' || entry.dimensionKey === '') continue;
        if (!Number.isFinite(entry.day)) continue;
        namedPlaces.push({
          id: entry.id,
          name: entry.name,
          x: entry.x as number,
          y: Number.isFinite(entry.y) ? (entry.y as number) : null,
          z: entry.z as number,
          dimensionKey: entry.dimensionKey,
          day: entry.day as number,
        });
      }
    }
    // Hedges are optional on read, same leniency as
    // named places: an old v1 save without the field
    // loads hedges: []. Per-entry: a hedge rides WHOLE
    // — non-empty string home id, finite centre, finite
    // days — a bad entry drops alone; a non-array
    // field loads [].
    const hedges: SavedHedge[] = [];
    if (value.hedges !== undefined && Array.isArray(value.hedges)) {
      for (const entry of value.hedges) {
        if (!isRecord(entry)) continue;
        if (typeof entry.homeId !== 'string' || entry.homeId === '') continue;
        if (!Number.isFinite(entry.x) || !Number.isFinite(entry.z)) continue;
        if (!Number.isFinite(entry.laidDay) || !Number.isFinite(entry.rootedDay)) continue;
        hedges.push({
          homeId: entry.homeId,
          x: entry.x as number,
          z: entry.z as number,
          laidDay: entry.laidDay as number,
          rootedDay: entry.rootedDay as number,
        });
      }
    }
    // Seals are optional on read, same leniency as
    // hedges: an old v1 save without the field loads
    // hearthhome: []. Per-entry: a seal rides WHOLE —
    // non-empty string place id, finite centre, a
    // positive finite radius, a finite day — a bad
    // entry drops alone; a non-array field loads [].
    const hearthhome: SavedSeal[] = [];
    if (value.hearthhome !== undefined && Array.isArray(value.hearthhome)) {
      for (const entry of value.hearthhome) {
        if (!isRecord(entry)) continue;
        if (typeof entry.placeId !== 'string' || entry.placeId === '') continue;
        if (!Number.isFinite(entry.x) || !Number.isFinite(entry.z)) continue;
        if (!Number.isFinite(entry.radiusM) || (entry.radiusM as number) <= 0) continue;
        if (!Number.isFinite(entry.laidDay)) continue;
        hearthhome.push({
          placeId: entry.placeId,
          x: entry.x as number,
          z: entry.z as number,
          radiusM: entry.radiusM as number,
          laidDay: entry.laidDay as number,
        });
      }
    }
    // The gazetteer is optional on read, same leniency
    // as seals: an old v1 save without it loads
    // gazetteer: []. Per-entry: an entry rides WHOLE —
    // non-empty key/family/name/dimension, finite
    // position and day — a bad entry drops alone;
    // carrierSeen rides only as a true boolean (a bad
    // flag reads unseen, never costing the finding).
    const gazetteer: SavedGazetteerEntry[] = [];
    if (value.gazetteer !== undefined && Array.isArray(value.gazetteer)) {
      for (const entry of value.gazetteer) {
        if (!isRecord(entry)) continue;
        if (typeof entry.placeKey !== 'string' || entry.placeKey === '') continue;
        if (typeof entry.family !== 'string' || entry.family === '') continue;
        if (typeof entry.name !== 'string' || entry.name === '') continue;
        if (!Number.isFinite(entry.x) || !Number.isFinite(entry.z)) continue;
        if (typeof entry.dimensionKey !== 'string' || entry.dimensionKey === '') continue;
        if (!Number.isFinite(entry.dayFound)) continue;
        gazetteer.push({
          placeKey: entry.placeKey,
          family: entry.family,
          name: entry.name,
          x: entry.x as number,
          z: entry.z as number,
          dimensionKey: entry.dimensionKey,
          dayFound: entry.dayFound as number,
          carrierSeen: entry.carrierSeen === true,
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
          origin:
            entry.origin === 'found'
              ? 'found'
              : entry.origin === 'rite'
                ? 'rite'
                : 'wild',
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
    // Familiar names are optional on read: an old save
    // without them loads with familiarNames: []. Entries
    // are kind strings; anything else drops, duplicates
    // dedupe (she learns a kind's name once).
    const familiarNames: string[] = [];
    if (Array.isArray(value.familiarNames)) {
      for (const entry of value.familiarNames) {
        if (
          typeof entry === 'string' &&
          entry.length > 0 &&
          !familiarNames.includes(entry)
        ) {
          familiarNames.push(entry);
        }
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
    // Sleeping bags are optional on read, the tents
    // leniency whole: an old v1 save without them loads
    // with bags: []. Entries pass through UNVALIDATED —
    // the placed-bag restore validates (finite coords)
    // and drops bad records. A non-array bags field
    // loads as [] — the section drops, the document
    // survives. `id` passes through only as a string.
    const bags: SavedBag[] = [];
    if (value.bags !== undefined && Array.isArray(value.bags)) {
      for (const entry of value.bags) {
        if (!isRecord(entry)) continue;
        bags.push({
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
    // The known-facts register is optional on read, same
    // additive-field rule: an old v1 save without it loads
    // empty. Non-record / non-array members load empty —
    // the section drops, the document survives; non-string
    // entries drop here AND again in restoreKnowledge().
    const knowledge: KnowledgeSnapshot = {
      metItems: [],
      knownUseRecipes: [],
      usedItems: [],
    };
    if (isRecord(value.knowledge)) {
      if (Array.isArray(value.knowledge.metItems)) {
        for (const entry of value.knowledge.metItems) {
          if (typeof entry === 'string') knowledge.metItems.push(entry);
        }
      }
      if (Array.isArray(value.knowledge.knownUseRecipes)) {
        for (const entry of value.knowledge.knownUseRecipes) {
          if (typeof entry === 'string') {
            knowledge.knownUseRecipes.push(entry);
          }
        }
      }
      // Used items (the register's third set) are additive:
      // an older save without the field restores as [].
      if (Array.isArray(value.knowledge.usedItems)) {
        const used: string[] = [];
        for (const entry of value.knowledge.usedItems) {
          if (typeof entry === 'string') used.push(entry);
        }
        knowledge.usedItems = used;
      }
    }
    // Her cold / wet gauges are optional on read, same
    // additive-field rule: an old v1 save without them
    // loads 0/0. A non-record field or non-finite member
    // loads as 0 — the section drops, the document
    // survives; range clamping is ColdWetState's own.
    let coldWet: ColdWetSnapshot = { cold: 0, wet: 0 };
    if (isRecord(value.coldWet)) {
      coldWet = {
        cold:
          typeof value.coldWet.cold === 'number' &&
          Number.isFinite(value.coldWet.cold)
            ? value.coldWet.cold
            : 0,
        wet:
          typeof value.coldWet.wet === 'number' &&
          Number.isFinite(value.coldWet.wet)
            ? value.coldWet.wet
            : 0,
      };
    }
    // The spell record is optional on read, same
    // additive-field rule: an old v1 save without it
    // loads null and the machine seats a fresh spell.
    // A malformed record (unknown kind, non-finite
    // member) loads as null — the record drops whole,
    // the document survives; semantic validation is
    // the machine's own seatWeatherState.
    let weather: SavedWeather | null = null;
    if (isRecord(value.weather)) {
      const w = value.weather;
      if (
        (w.kind === 'dry' || w.kind === 'wet' || w.kind === 'inclement') &&
        typeof w.startDay === 'number' &&
        Number.isFinite(w.startDay) &&
        typeof w.lengthDays === 'number' &&
        Number.isFinite(w.lengthDays) &&
        typeof w.index === 'number' &&
        Number.isFinite(w.index)
      ) {
        weather = {
          kind: w.kind,
          startDay: w.startDay,
          lengthDays: w.lengthDays,
          index: w.index,
        };
      }
    }
    // Injury is optional on read, same additive-field
    // rule: an old v1 save without it loads sound. A
    // record whose stage names a real stage rides;
    // anything else loads sound — the section drops,
    // the document survives.
    let injury: InjurySnapshot = { stage: 'sound' };
    if (
      isRecord(value.injury) &&
      typeof value.injury.stage === 'string' &&
      (INJURY_STAGES as readonly string[]).includes(value.injury.stage)
    ) {
      injury = { stage: value.injury.stage as InjuryStage };
    }
    // Scent is optional on read, same additive rule:
    // an old v1 save without it loads unscented. A
    // record naming a real kind with a finite
    // positive clock rides (category kept for the
    // attractor); anything else loads unscented —
    // ScentState.restore applies the same leniency
    // at its own seat.
    let scent: ScentSnapshot = { kind: null, category: null, secondsLeft: 0 };
    if (
      isRecord(value.scent) &&
      (value.scent.kind === 'repellent' || value.scent.kind === 'attractor') &&
      typeof value.scent.secondsLeft === 'number' &&
      Number.isFinite(value.scent.secondsLeft) &&
      value.scent.secondsLeft > 0
    ) {
      scent = {
        kind: value.scent.kind,
        category:
          value.scent.kind === 'attractor' &&
          typeof value.scent.category === 'string'
            ? value.scent.category
            : null,
        secondsLeft: value.scent.secondsLeft,
      };
    }
    // The last sleep site is optional on read: a
    // record with finite coords rides; anything else
    // loads null (no completed sleep on record).
    let lastSleepSite: SavedSleepSite | null = null;
    if (
      isRecord(value.lastSleepSite) &&
      Number.isFinite(value.lastSleepSite.x) &&
      Number.isFinite(value.lastSleepSite.z)
    ) {
      lastSleepSite = {
        x: value.lastSleepSite.x as number,
        z: value.lastSleepSite.z as number,
      };
    }
    // The encounter ledger is optional on read: string
    // ids ride, deduped in first-seen order; a
    // non-array field loads as [] — the section drops,
    // the document survives.
    const feralWarned: string[] = [];
    if (value.feralWarned !== undefined && Array.isArray(value.feralWarned)) {
      for (const entry of value.feralWarned) {
        if (typeof entry !== 'string' || entry === '') continue;
        if (feralWarned.includes(entry)) continue;
        feralWarned.push(entry);
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
        awakenings.push({
          kind: entry.kind,
          tier: entry.tier as number,
          // The toggle rides only when it is a real
          // boolean: a bad toggle value is IGNORED
          // (the entry reads on — absent = on) rather
          // than costing the awakening its record.
          ...(typeof entry.enabled === 'boolean'
            ? { enabled: entry.enabled }
            : {}),
        });
      }
    }
    // Bone acquisitions are optional on read, same
    // additive-field rule: an old v1 save without the
    // field loads with boneAcquisitions: []. Entries
    // are KIND-VALIDATED against the bone set (a kind
    // outside it — or a non-string — drops) and
    // DEDUPED, first occurrence keeping its place; a
    // non-array field loads as [] — the section drops,
    // the document survives.
    const boneAcquisitions: string[] = [];
    if (
      value.boneAcquisitions !== undefined &&
      Array.isArray(value.boneAcquisitions)
    ) {
      for (const entry of value.boneAcquisitions) {
        if (typeof entry !== 'string') continue;
        if (!isBoneQuestKind(entry)) continue;
        if (boneAcquisitions.includes(entry)) continue;
        boneAcquisitions.push(entry);
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
        'familiarObtained',
        'journalRead',
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
    // THE CHARM-LIST MIGRATION IS RETIRED (2026-11-01):
    // the 2026-10-28 migration dropped a carried shrew
    // item on load when a shrew awakening stood —
    // sound only while the grant was the shrew's sole
    // source and the world excluded shrew. Both
    // premises are gone (the gift retired; Adam's (a1)
    // put the shrew in the position cycle): a carried
    // shrew skull beside a standing awakening is now
    // legitimate play (a found spare), and load takes
    // no side against it. Nothing migrates here.
    // World name: optional string, additive (old saves load
    // without it). Non-string values drop — the name is a
    // display label, never load-bearing, so a bad value
    // drops the field, never the document.
    const worldName =
      typeof value.worldName === 'string' ? value.worldName : undefined;
    // Dimension buckets are optional on read, same
    // additive rule: an old v1 save without the field
    // loads {}. Each bucket is validated by the SAME
    // parsers the surface uses (piles via
    // parseSavedPiles, harvest via the verbatim read);
    // a bucket that fails drops WHOLE — the document
    // and its sibling buckets survive (the contrast
    // with the surface piles' strictness is the
    // design's: a bad bucket is one place's state, not
    // the world's). An empty-string key drops (it
    // would counterfeit the surface); a key no longer
    // resolving is inert data, kept, never reaped.
    const dimensionStates: Record<string, SavedDimensionWorldState> = {};
    if (isRecord(value.dimensionStates)) {
      for (const [key, bucket] of Object.entries(value.dimensionStates)) {
        if (key === '') continue;
        if (!isRecord(bucket)) continue;
        const bucketPiles = parseSavedPiles(bucket.piles);
        if (bucketPiles === null) continue;
        dimensionStates[key] = {
          piles: bucketPiles,
          harvest: readSavedHarvestState(bucket.harvest),
        };
      }
    }
    // NOTE (2026-11-03): cave takes do NOT move
    // here. Their ids are scatter target ids (chunk,
    // kind, position — nothing names the cave), so no
    // document-side rule can assign them a bucket; the
    // relocation is a shell-side pass in the swap
    // wiring, against Background's cave feature index.
    // This seat only stores the buckets it is given.
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
      craftedWorkstations,
      cauldrons,
      patches,
      mossPaint,
      namedPlaces,
      hedges,
      hearthhome,
      gazetteer,
      dimensionVisit,
      acquisitionOrder,
      companions,
      familiarNames,
      fragments,
      discovery,
      tents,
      bags,
      nameSight,
      knowledge,
      coldWet,
      weather,
      injury,
      scent,
      lastSleepSite,
      feralWarned,
      stagings,
      awakenings,
      boneAcquisitions,
      ...(quests !== undefined ? { quests } : {}),
      harvestState,
      dimensionStates,
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
