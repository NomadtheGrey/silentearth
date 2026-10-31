/**
 * Companions — trust, feeding, and the bond
 * (Adam, 2026-10-31; build 1: friendship).
 *
 * Adam's shape: "feed them what they eat to earn their
 * trust, then their friendship. A familiar would be
 * more, requiring a ritual at the altar." This module
 * is the friendship build: diets, trust, the faced
 * OFFER, and the bond. The familiar's rite is build 2 —
 * the record carries its bond and origin fields from
 * day one so the rite arrives as a transition on this
 * shape, not a migration.
 *
 * The laws this module keeps:
 * - Trust is PER-INDIVIDUAL (this crow, not crows) and
 *   volatile until bonded: an unbonded record is the
 *   courtship; the BOND is the persistent fact.
 * - The bond's lever is the TRUE NAME: full trust plus
 *   the kind's awakened name, spoken from the journal
 *   (the landed name chain; this module takes the
 *   name-known fact as a context parameter and never
 *   reads the awakening state itself).
 * - A smaller fraction of individuals are FERAL —
 *   untamable, fixed by identity, never rolled in the
 *   moment (see isFeral).
 * - Costs sit on GOODS: feeding spends a carried food
 *   item, and only when the animal accepts it. Nothing
 *   here ever costs her body.
 * - Diets are keyed to the ANIMAL's digestion, not
 *   hers: her cook-required rule for raw acorns binds
 *   her eat(), never this table.
 * - The cat takes no stance and no commands (Adam:
 *   "by ruling and nature"). Its stance is null — an
 *   inapplicability, not a default — and stance orders
 *   refuse it with a typed code the panel turns into
 *   theater.
 *
 * Bodies, movement, home ranges, and the services
 * (warning / deterrence / intervention / provisioning)
 * are Background's engine half; this module owns the
 * data and the transitions. All numbers are DRAFT for
 * Adam's pin pass.
 */

import { ITEMS, type ItemId } from './recipes';
import { normalizeItemId, type PersonalInventory } from './inventory';
import type { CraftingInventory } from './crafting';
import type { HungerState } from './hunger';

// ---------------------------------------------------------------------------
// Diets — what each kind eats (DRAFT, authored per kind)
// ---------------------------------------------------------------------------
//
// Every entry is an item she can carry and give up.
// Kinds with NO row are unfeedable in build 1, for
// stated reasons, not by omission:
// - Insect-eaters with no insect item in the world:
//   frog, bat, mole, shrew.
// - Aquatic kinds a faced offer cannot reach:
//   fish, eel, crayfish (fish meet her hand as prey —
//   see the snatch rider below — not as companions).
// The cat has no row in build 1: it is a singular
// kind (the hearth resident), and its diet row rides
// build 2's claim with its record shape.

export const DIETS: Readonly<Record<string, readonly ItemId[]>> = {
  rabbit: ['grass', 'tender-vines', 'yellow-dandelion'],
  squirrel: ['acorns', 'edible-mushroom', 'tall-sunflower'],
  muskrat: ['grass', 'tender-vines', 'white-water-lily'],
  mouse: ['grass', 'acorns', 'bog-berries'],
  vole: ['grass', 'tender-vines', 'bog-berries'],
  groundhog: ['grass', 'yellow-dandelion', 'purple-clover', 'apple'],
  opossum: ['apple', 'elderberries', 'edible-mushroom', 'bog-berries'],
  raccoon: ['bog-berries', 'elderberries', 'acorns', 'apple'],
  beaver: ['snap-wood', 'tender-vines', 'grass'],
  deer: ['grass', 'acorns', 'apple', 'yellow-dandelion'],
  fox: ['rabbit-carcass', 'mouse-carcass', 'vole-carcass', 'bog-berries'],
  wolf: ['rabbit-carcass', 'groundhog-carcass', 'muskrat-carcass'],
  bear: ['honey', 'bog-berries', 'elderberries', 'apple', 'fish-carcass', 'rabbit-carcass'],
  crow: ['bog-berries', 'elderberries', 'acorns', 'mouse-carcass'],
  owl: ['mouse-carcass', 'vole-carcass'],
  snake: ['mouse-carcass', 'vole-carcass', 'frog-carcass'],
  turtle: ['grass', 'bog-berries', 'white-water-lily', 'wood-violet'],
  pigeon: ['grass', 'tall-sunflower', 'acorns'],
};

/** The foods a kind eats (empty for unfeedable / unknown kinds). */
export function dietFor(kind: string): readonly ItemId[] {
  return DIETS[kind] ?? [];
}

/** True when the kind can be fed at all in build 1. */
export function isFeedable(kind: string): boolean {
  return (DIETS[kind]?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Feral — fixed by identity, never rolled in the moment
// ---------------------------------------------------------------------------

/**
 * The feral fraction (DRAFT dial for the pin pass —
 * one constant, read by every lane; Background's 0.15
 * proposal rides the same pass).
 */
export const FERAL_FRACTION = 0.2;

/**
 * FNV-1a over the id plus an avalanche finalizer —
 * small, stable, seed-law clean. The finalizer is
 * load-bearing, not decoration: spawn ids share long
 * prefixes and differ in their last characters
 * (animal:<cx>,<cz>:<spawnIndex>), and plain FNV-1a
 * leaves neighbours correlated — measured before the
 * fix, 17% of chunks rolled ALL-feral, which breaks
 * the per-individual ruling in play. With the
 * finalizer the same census reads independent.
 */
function idHash(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0x100000000;
}

export type CompanionOrigin = 'wild' | 'found';

/**
 * Is this individual feral — untamable, forever? A
 * pure function of its stable id (Background's
 * creature id): same id, same answer, across saves
 * and sessions. The FOUND origin is exempt by
 * construction — the hearth resident's bond cannot be
 * stillborn.
 */
export function isFeral(creatureId: string, origin: CompanionOrigin = 'wild'): boolean {
  if (origin === 'found') {
    return false;
  }
  return idHash(creatureId) < FERAL_FRACTION;
}

// ---------------------------------------------------------------------------
// Records — the persisted shape
// ---------------------------------------------------------------------------

/** Bond depth. Build 1 writes only 'none' | 'companion'. */
export type CompanionBond = 'none' | 'companion' | 'familiar';

export type CompanionStance = 'stay' | 'follow' | 'come';

/**
 * One touched individual. Untouched animals have no
 * record — worldgen stays sovereign over them, and the
 * save stays lean. The record IS the bond's memory:
 * releasing clears it, and the individual is gone
 * (Background's departure), never re-meetable.
 */
export interface SavedCompanion {
  creatureId: string;
  kind: string;
  trust: number;
  bond: CompanionBond;
  origin: CompanionOrigin;
  /** Null for the cat — inapplicable, not a default. */
  stance: CompanionStance | null;
  /** The day trust last grew (one feeding per day feeds trust). */
  lastFedDay: number | null;
}

/** Trust one accepted feeding earns (DRAFT). */
export const TRUST_PER_FEEDING = 1;
/** Trust the bond wants (DRAFT: several feedings, several days). */
export const TRUST_FOR_BOND = 3;

// ---------------------------------------------------------------------------
// Outcomes — typed codes, never prose (the rename lesson:
// a code cannot be orphaned by a wording pass)
// ---------------------------------------------------------------------------

export type FeedRefusalCode =
  | 'feral' // the ANIMAL is the refusal — final, not retryable
  | 'not-food' // wrong offering; the animal might take something else
  | 'not-held' // she doesn't carry the offered item
  | 'sated' // already fed today; trust grows once a day
  | 'bonded'; // the offer is a courtship act; a friend is past it

export type FeedResult =
  | { ok: true; trust: number; bondReady: boolean }
  | { ok: false; code: FeedRefusalCode };

export type BondRefusalCode =
  | 'unknown' // no record — she has never fed this one
  | 'feral'
  | 'already'
  | 'trust' // not yet enough
  | 'name'; // the kind's true name is not hers to speak

export type BondResult = { ok: true } | { ok: false; code: BondRefusalCode };

export type StanceRefusalCode = 'unknown' | 'unbonded' | 'cat';

export type StanceResult = { ok: true } | { ok: false; code: StanceRefusalCode };

// ---------------------------------------------------------------------------
// The state — records by creature id
// ---------------------------------------------------------------------------

export class CompanionState {
  private readonly records = new Map<string, SavedCompanion>();

  constructor(saved?: readonly SavedCompanion[]) {
    if (saved) {
      for (const record of saved) {
        if (!this.records.has(record.creatureId)) {
          this.records.set(record.creatureId, { ...record });
        }
      }
    }
  }

  /** The record for an individual, if she has touched it. */
  recordFor(creatureId: string): SavedCompanion | undefined {
    const record = this.records.get(creatureId);
    return record ? { ...record } : undefined;
  }

  /** Every record (the save snapshot reads this). */
  snapshot(): SavedCompanion[] {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  /** The standing familiar, if one stands (build 2's rite reads this). */
  familiar(): SavedCompanion | undefined {
    for (const record of this.records.values()) {
      if (record.bond === 'familiar') {
        return { ...record };
      }
    }
    return undefined;
  }

  /**
   * The faced OFFER: feed one carried food to one
   * individual. Checks before consuming anything, in
   * an order that teaches: feral first (the animal
   * itself), then the offering (held? in its diet?),
   * then the day (trust grows once a day). Only an
   * accepted feeding spends the item and moves trust.
   * `day` is the caller's day count (this module keeps
   * no clock).
   */
  feed(
    creatureId: string,
    kind: string,
    item: ItemId,
    inventory: CraftingInventory,
    day: number,
  ): FeedResult {
    const existing = this.records.get(creatureId);
    const origin = existing?.origin ?? 'wild';
    if (isFeral(creatureId, origin)) {
      return { ok: false, code: 'feral' };
    }
    if (existing && existing.bond !== 'none') {
      return { ok: false, code: 'bonded' };
    }
    const offered = normalizeItemId(item);
    const diet = dietFor(kind);
    if (!diet.some((food) => normalizeItemId(food) === offered)) {
      return { ok: false, code: 'not-food' };
    }
    if (inventory.count(offered) < 1) {
      return { ok: false, code: 'not-held' };
    }
    if (existing && existing.lastFedDay === day) {
      return { ok: false, code: 'sated' };
    }
    inventory.remove(offered, 1);
    const record: SavedCompanion = existing ?? {
      creatureId,
      kind,
      trust: 0,
      bond: 'none',
      origin: 'wild',
      stance: kind === 'cat' ? null : 'follow',
      lastFedDay: null,
    };
    record.trust += TRUST_PER_FEEDING;
    record.lastFedDay = day;
    this.records.set(creatureId, record);
    return { ok: true, trust: record.trust, bondReady: record.trust >= TRUST_FOR_BOND };
  }

  /**
   * The bond: full trust + the kind's true name,
   * spoken. `nameKnown` is the caller's fact (the
   * awakening state is not read here). Success makes a
   * companion; the familiar's rite is build 2's
   * transition on this same record.
   */
  bondWith(creatureId: string, nameKnown: boolean): BondResult {
    const record = this.records.get(creatureId);
    if (!record) {
      return { ok: false, code: 'unknown' };
    }
    if (isFeral(creatureId, record.origin)) {
      return { ok: false, code: 'feral' };
    }
    if (record.bond !== 'none') {
      return { ok: false, code: 'already' };
    }
    if (record.trust < TRUST_FOR_BOND) {
      return { ok: false, code: 'trust' };
    }
    if (!nameKnown) {
      return { ok: false, code: 'name' };
    }
    record.bond = 'companion';
    return { ok: true };
  }

  /**
   * RELEASE (Adam's verb): end the whole bond — courtship
   * or companion. The record clears whole; the caller
   * runs the departure off the returned record (a wild
   * individual dissolves into Background's world; a
   * found one returns to its hearth seat). Null when
   * there was nothing to release.
   */
  release(creatureId: string): SavedCompanion | null {
    const record = this.records.get(creatureId);
    if (!record) {
      return null;
    }
    this.records.delete(creatureId);
    return { ...record };
  }

  /**
   * Set a bonded companion's stance. The cat refuses
   * with its own code — the panel's theater runs on it.
   */
  setStance(creatureId: string, stance: CompanionStance): StanceResult {
    const record = this.records.get(creatureId);
    if (!record) {
      return { ok: false, code: 'unknown' };
    }
    if (record.kind === 'cat') {
      return { ok: false, code: 'cat' };
    }
    if (record.bond === 'none') {
      return { ok: false, code: 'unbonded' };
    }
    record.stance = stance;
    return { ok: true };
  }
}

// ---------------------------------------------------------------------------
// Rider — her own hand: the fish snatch (Adam, 2026-10-31)
// ---------------------------------------------------------------------------

/**
 * The snatch chance (DRAFT dial for the pin pass): a
 * hand is worse than a weir, and failure's price is
 * the attempt itself — the fish spooks.
 */
export const SNATCH_CHANCE = 0.25;

export type SnatchOutcome = 'caught' | 'spooked' | 'slipped' | 'too-hungry';

/**
 * Snatch at a faced living fish. `roll` is the
 * caller's runtime roll in [0, 1) (the trap precedent:
 * the seed law governs worldgen, not the moment).
 * Success grants fish-carcass by the harvest idiom —
 * addPartial — and a full pack grants nothing:
 * 'slipped' means the lunge connected but her hands
 * could not hold it, and NOTHING is consumed — the
 * fish escapes and spooks, per the standing harvest
 * law that capacity failure never consumes the world
 * (DEV ruling, 2026-10-31). Too-hungry refuses
 * (hand-harvest work, not trap collection — DRAFT
 * lean, the pin pass settles).
 */
export function snatchFish(
  inventory: PersonalInventory,
  roll: number,
  hunger: HungerState | null = null,
): SnatchOutcome {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error('Snatch roll must be in [0, 1).');
  }
  if (hunger !== null && hunger.isTooHungry()) {
    return 'too-hungry';
  }
  if (roll >= SNATCH_CHANCE) {
    return 'spooked';
  }
  const grant = inventory.addPartial(ITEMS.fishCarcass, 1);
  return grant.granted > 0 ? 'caught' : 'slipped';
}
