/**
 * Silent Earth — shelter storage + shelter protection
 * (player-systems lane, MVP round).
 *
 * SEPARATION (standing rule): home storage is NOT personal
 * inventory. PersonalInventory (inventory.ts) is what she
 * carries; HomeStorage below is what a house holds, safe from
 * the elements. The two never mix: moving supplies between them
 * is a transfer the wiring step performs (remove here, add
 * there, capacity-checked on each side), not something either
 * class does for the other.
 *
 * HOUSE TYPES: keyed by the house recipe's item id (the same
 * vocabulary as RECIPES). Wattle-and-daub hut and woven cottage
 * are ONE ladder stage (merged 2026-10-25, in-game name 'Woven
 * Cottage'), so they share storage and protection values.
 *
 * STORAGE — in POUNDS since 2026-10-28 (Adam's standing ruling:
 * "pounds here and going forward"). The numerals below are
 * POUNDS, not counts — carried over from the count era, ALL
 * flagged for Adam's pin pass (the unit change redefines what
 * they hold: a 50-lb lean-to holds far less than 50 count).
 * - primitive-lean-to: 50 lb (PINNED numeral, Adam 2026-10-25).
 * - thatch-hut, woven-cottage / wattle-and-daub-hut, and
 *   small-wooden-hut: LANE-DECIDED starting tunables for Adam's
 *   pin pass (100 / 175 / 250 lb), rising per house upgrade per
 *   the home-function rule (each type progressively larger).
 * Per-kind rows stay QUANTITIES (count()); only used /
 * capacity / free are pounds. Existing over-cap stores STAY:
 * a store under the old count cap but over the pound cap keeps
 * everything — future adds refuse, nothing is ever dropped
 * (same rule as the upgrade capacity rule).
 *
 * PROTECTION — lane-decided values for Background's hook:
 * Background's weather.ts takes shelter as a ShelterQuery
 * (x, z) => multiplier, 1 = unsheltered, lower = more
 * protected, and evaluates it where she STANDS against the
 * placed house's position (free placement — no zones, no
 * plots, pinned). This module supplies the values and the
 * query: shelterMultiplierFor(house) gives the multiplier at
 * the house, and createShelterQuery(placed) closes over a
 * placed house's coordinates. Radius is lane-decided
 * (SHELTER_RADIUS = 5 m, hard edge in v1 — no falloff curve
 * invented; falloff is a later refinement if Adam wants it).
 * Multiple placed houses: shelterMultiplierAt() takes the best
 * (lowest) multiplier of any house in range.
 */

import { ITEMS, RECIPES, type ItemId, type Recipe } from './recipes';
import {
  POUND_UNITS_PER_LB,
  normalizeItemId,
  weightUnits,
} from './inventory';
import type { CraftingInventory } from './crafting';

// ---------------------------------------------------------------------------
// House types, storage, protection
// ---------------------------------------------------------------------------

export type HouseItem =
  | typeof ITEMS.primitiveLeanTo
  | typeof ITEMS.thatchHut
  | typeof ITEMS.wattleAndDaubHut
  | typeof ITEMS.wovenCottage
  | typeof ITEMS.smallWoodenHut;

/**
 * Home storage capacity per house item, in POUNDS (numerals
 * carried over from the count era 2026-10-28, ALL flagged for
 * Adam's pin pass). Lean-to 50 is PINNED (numeral); the rest
 * are LANE-DECIDED starting tunables.
 */
export const HOME_STORAGE_CAPACITY: Readonly<Record<string, number>> = {
  [ITEMS.primitiveLeanTo]: 50,
  [ITEMS.thatchHut]: 100,
  [ITEMS.wattleAndDaubHut]: 175,
  [ITEMS.wovenCottage]: 175,
  [ITEMS.smallWoodenHut]: 250,
};

/**
 * Shelter exposure multiplier at the house (1 = unsheltered;
 * lower = more protected). LANE-DECIDED starting tunables for
 * Adam's pin pass, in Background's ShelterQuery shape.
 *
 * STAGED, NOT DEAD (Adam, 2026-10-31, answering the code
 * audit): this protection half — SHELTER_PROTECTION,
 * SHELTER_RADIUS, shelterMultiplierFor, createShelterQuery,
 * shelterMultiplierAt — is NOT YET CALLED because cold and
 * wet are not implemented yet; it is the staged shelter
 * side of the cold/wet build, not an orphan. The live
 * shelter evaluation today is the engine's (game/shelter.ts,
 * HOUSE_DEFS), whose numbers DIFFER from these (multipliers
 * and radius). That divergence is a known, open pin-pass
 * item: when the cold/wet build wires this half, the two
 * sets are settled as ONE decision — one set of numbers
 * per fact — not before, and neither table is edited to
 * match the other in the meantime.
 */
export const SHELTER_PROTECTION: Readonly<Record<string, number>> = {
  [ITEMS.primitiveLeanTo]: 0.7,
  [ITEMS.thatchHut]: 0.55,
  [ITEMS.wattleAndDaubHut]: 0.4,
  [ITEMS.wovenCottage]: 0.4,
  [ITEMS.smallWoodenHut]: 0.25,
};

/** Radius (metres) within which a placed house shelters. LANE-DECIDED. */
export const SHELTER_RADIUS = 5;

export function isHouseItem(item: ItemId): boolean {
  return item in HOME_STORAGE_CAPACITY;
}

export function homeStorageCapacity(house: ItemId): number {
  const capacity = HOME_STORAGE_CAPACITY[house];
  if (capacity === undefined) {
    throw new Error(`No home storage capacity for ${house}: not a house.`);
  }
  return capacity;
}

// ---------------------------------------------------------------------------
// The home-screen Upgrade door (Adam, 2026-10-31: an
// upgrade needs no stump or workstation, so the button
// belongs on the home screen). The transition machinery
// is the engine's (upgradeHouse in place, same house id,
// contents ride); this section is the PRICE: the next
// rung's existing recipe, consumed from her pack with
// nothing granted — no transient house item, no second
// price list. The first lean-to still comes via Crafting
// + placement; this door only climbs from a standing
// house. No hunger or station gates: home acts (storing,
// sleeping) are not gated, and the rung recipes carry no
// station of their own.
// ---------------------------------------------------------------------------

/** The ladder's rungs, as recipe ids, lowest first. */
export const HOME_LADDER_RUNGS: readonly string[] = [
  'primitive-lean-to',
  'thatch-hut',
  'woven-cottage',
  'small-wooden-hut',
];

/**
 * The rung a house item stands on (its recipe id), or
 * null for a non-house. Wattle-and-daub and woven
 * cottage are one stage, so both items read the
 * 'woven-cottage' rung.
 */
export function homeRungFor(house: ItemId): string | null {
  const item = normalizeItemId(house);
  if (item === ITEMS.wattleAndDaubHut || item === ITEMS.wovenCottage) {
    return 'woven-cottage';
  }
  return HOME_LADDER_RUNGS.includes(item) ? item : null;
}

/**
 * The next rung up from a house item: its rung id and
 * the recipe that prices it. Null at the top rung and
 * for non-houses (the screen shows no button for either).
 */
export function nextHomeUpgrade(
  house: ItemId,
): { rung: string; recipe: Recipe } | null {
  const rung = homeRungFor(house);
  if (rung === null) {
    return null;
  }
  const next = HOME_LADDER_RUNGS[HOME_LADDER_RUNGS.indexOf(rung) + 1];
  if (next === undefined) {
    return null;
  }
  const recipe = RECIPES.find((r) => r.id === next);
  return recipe ? { rung: next, recipe } : null;
}

export type HomeUpgradeResult =
  | {
      ok: true;
      /** The rung climbed from (recipe id). */
      from: string;
      /** The rung climbed to (recipe id). */
      to: string;
      /** What the price took, in recipe order. */
      consumed: { item: ItemId; quantity: number }[];
    }
  | {
      ok: false;
      code: 'unknown-house' | 'top-rung' | 'missing';
      /** On 'missing': every short ingredient, needed vs held. */
      missing?: { item: ItemId; needed: number; held: number }[];
    };

/**
 * Pay the next rung's price from her pack. Every
 * ingredient is checked before anything is consumed
 * (executeCraft's refusal hygiene): a refusal spends
 * nothing. On success the price is out of the pack and
 * the caller runs the engine's in-place upgrade to the
 * `to` rung's type; this function grants no item.
 */
export function consumeHomeUpgradePrice(
  house: ItemId,
  inventory: CraftingInventory,
): HomeUpgradeResult {
  const from = homeRungFor(house);
  if (from === null) {
    return { ok: false, code: 'unknown-house' };
  }
  const next = nextHomeUpgrade(house);
  if (next === null) {
    return { ok: false, code: 'top-rung' };
  }
  const missing: { item: ItemId; needed: number; held: number }[] = [];
  for (const ingredient of next.recipe.ingredients) {
    const item = normalizeItemId(ingredient.item);
    const held = inventory.count(item);
    if (held < ingredient.quantity) {
      missing.push({ item, needed: ingredient.quantity, held });
    }
  }
  if (missing.length > 0) {
    return { ok: false, code: 'missing', missing };
  }
  const consumed: { item: ItemId; quantity: number }[] = [];
  for (const ingredient of next.recipe.ingredients) {
    const item = normalizeItemId(ingredient.item);
    inventory.remove(item, ingredient.quantity);
    consumed.push({ item, quantity: ingredient.quantity });
  }
  return { ok: true, from, to: next.rung, consumed };
}

export function shelterMultiplierFor(house: ItemId): number {
  const multiplier = SHELTER_PROTECTION[house];
  if (multiplier === undefined) {
    throw new Error(`No shelter protection for ${house}: not a house.`);
  }
  return multiplier;
}

// ---------------------------------------------------------------------------
// Position-keyed shelter query (Background's ShelterQuery shape)
// ---------------------------------------------------------------------------

export interface PlacedHouse {
  x: number;
  z: number;
  house: ItemId;
  /** Override for SHELTER_RADIUS, when a house warrants it. */
  radius?: number;
}

/**
 * Build a ShelterQuery closing over one placed house: the
 * house's multiplier inside its radius, 1 (unsheltered) outside
 * it. Wiring passes this to weather's exposureAtPosition as
 * shelterQuery. Placement itself (where houses go) is
 * Background's entity side; this function only answers "how
 * sheltered is (x, z) given this placed house".
 */
export function createShelterQuery(
  placed: PlacedHouse,
): (x: number, z: number) => number {
  const multiplier = shelterMultiplierFor(placed.house);
  const radius = placed.radius ?? SHELTER_RADIUS;
  return (x: number, z: number): number => {
    const dx = x - placed.x;
    const dz = z - placed.z;
    return dx * dx + dz * dz <= radius * radius ? multiplier : 1;
  };
}

/**
 * Best (lowest) shelter multiplier across placed houses at
 * (x, z); 1 when no placed house is in range. For shells that
 * hold several houses without building a combined query.
 */
export function shelterMultiplierAt(
  placed: readonly PlacedHouse[],
  x: number,
  z: number,
): number {
  let best = 1;
  for (const house of placed) {
    const multiplier = createShelterQuery(house)(x, z);
    if (multiplier < best) {
      best = multiplier;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Home storage — contents held by one house
// ---------------------------------------------------------------------------

export class HomeStorage {
  private readonly stacks = new Map<ItemId, number>();
  private house: ItemId;

  /**
   * Charm storage bonus in POUNDS (mouse, Track B):
   * session state, shell-synced (setCharmBonus on boot
   * + list change) — never saved; derives from the
   * awakening record, which IS saved. Default 0.
   */
  private charmBonus = 0;

  constructor(house: ItemId, initial?: Record<string, number>) {
    // Validates the house (throws for non-houses) before storing.
    homeStorageCapacity(house);
    this.house = house;
    if (initial) {
      for (const [item, quantity] of Object.entries(initial)) {
        if (quantity > 0) {
          this.stacks.set(item, quantity);
        }
      }
    }
  }

  /** The house type holding these supplies. */
  houseType(): ItemId {
    return this.house;
  }

  /**
   * Set the charm storage bonus in POUNDS (mouse +25 lb
   * while carried + awakened, else 0 — see
   * mouseStorageBonus in charms.ts). Must be a
   * non-negative integer.
   */
  setCharmBonus(pounds: number): void {
    if (!Number.isInteger(pounds) || pounds < 0) {
      throw new Error('Charm storage bonus must be a non-negative integer.');
    }
    this.charmBonus = pounds;
  }

  /**
   * Current charm storage bonus, in pounds. Method name kept
   * for call-site stability — the 'counts' in the name is
   * stale since the pounds rework.
   */
  charmBonusCounts(): number {
    return this.charmBonus;
  }

  /** Storage capacity in POUNDS of the current house, including any charm bonus. */
  capacity(): number {
    return homeStorageCapacity(this.house) + this.charmBonus;
  }

  /** Stored quantity of one kind (counts — per-kind rows stay quantities). */
  count(item: ItemId): number {
    return this.stacks.get(item) ?? 0;
  }

  /** Stored weight in POUNDS (sum over stacks of quantity × item weight). */
  used(): number {
    return this.usedUnits() / POUND_UNITS_PER_LB;
  }

  /**
   * Stored weight in integer 0.05-lb units (exact arithmetic —
   * float pounds would dust at exact boundaries, the
   * personal-carry precedent). The add() gate compares units.
   */
  private usedUnits(): number {
    let total = 0;
    for (const [item, quantity] of this.stacks.entries()) {
      total += quantity * weightUnits(item);
    }
    return total;
  }

  /** Free storage in POUNDS. */
  free(): number {
    return Math.max(0, this.capacity() - this.used());
  }

  /**
   * Store supplies. Throws (nothing stored) when the addition
   * would exceed capacity (compared in integer units, so an
   * exactly-full store reads exactly full). Unlike
   * PersonalInventory there is no gear exception here —
   * everything stored counts toward the weight.
   */
  add(item: ItemId, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('Add quantity must be a positive integer.');
    }
    if (
      this.usedUnits() + quantity * weightUnits(item) >
      this.capacity() * POUND_UNITS_PER_LB
    ) {
      throw new Error(
        `Cannot store ${quantity} ${item}: only ${this.free()} lb home ` +
          `storage free in ${this.house}.`,
      );
    }
    this.stacks.set(item, this.count(item) + quantity);
  }

  remove(item: ItemId, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('Remove quantity must be a positive integer.');
    }
    const held = this.count(item);
    if (held < quantity) {
      throw new Error(
        `Cannot remove ${quantity} ${item}: only ${held} stored.`,
      );
    }
    const remaining = held - quantity;
    if (remaining === 0) {
      this.stacks.delete(item);
    } else {
      this.stacks.set(item, remaining);
    }
  }

  /**
   * Upgrade the house (ladder stages only increase capacity, but
   * this method does not assume that): contents persist across
   * the change, and if a new house were smaller than the stored
   * contents, adds simply block until contents drop under the
   * new capacity — nothing is ever dropped by an upgrade.
   */
  setHouse(house: ItemId): void {
    homeStorageCapacity(house);
    this.house = house;
  }
}
