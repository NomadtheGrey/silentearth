/**
 * Silent Earth — clothes, wearable (player-systems lane, MVP round).
 *
 * PINNED (Adam, 2026-10-26):
 * - The loom is a forked upgrade to a crafted workstation,
 *   SEPARATE from the potter's wheel, and REQUIRED for clothes:
 *   all five garment recipes carry station 'loom' (see
 *   recipes.ts; the loom recipe itself already exists as a draft
 *   fork, and its note now records the requirement).
 * - Five garments, five distinct slots, all wearable AT ONCE.
 *   There is no equip-choice step: wearing is per-slot, not a
 *   single held slot — the owning=using spirit (owning the tool
 *   is sufficient to use it) applied to clothes. Wearing does
 *   not consume the garment: wear() records the slot from an
 *   owned item, and the garment stays carried (see the inventory
 *   note below).
 * - Worn capacity bonuses, ADDITIVE with pockets / apron /
 *   baskets / Trundle-Tool: Pointy Hat +1, Shawl +3, Cloak +6.
 *   Mossy Mittens and bog boots add no capacity (their bonuses
 *   are weather, not carrying).
 *
 * INVENTORY NOTE: worn garments are carrying-gear-like — a worn
 * garment is not counted against personal capacity (mirroring
 * the apron/basket/Trundle rule in inventory.ts), and its bonus
 * counts. PersonalInventory reads the worn list through
 * setWorn(): wiring calls inventory.setWorn(wardrobe.wornItemIds())
 * after any wear/remove, so the one capacity number stays
 * correct. Until wiring calls it, worn is empty and capacity is
 * unchanged — no behaviour change for callers that never wear.
 *
 * WEATHER SHAPE (do NOT re-decide percentages): Background's
 * weather.ts already owns GARMENT_PROTECTION and the
 * multiplicative stacking (cloak rain 40% wind 30%, shawl cold
 * 30%, hat rain 15%, mittens cold 15%, boots wet 40%). This
 * module exposes the worn list in exactly the shape that table
 * expects: wornGarments() returns Background GarmentIds
 * ('cloak' | 'shawl' | 'pointyHat' | 'mossyMittens' |
 * 'bogBoots'), for the weather ExposureModifiers.clothing
 * input. Bog boots' less-slow travel effect lives in
 * movement.ts behind a BogBootsQuery — bogBootsWorn() feeds
 * that query. This module computes NO weather percentages.
 *
 * Garment items live in recipes.ts ITEMS (kebab-case, systems
 * vocabulary — garments are crafted, not harvested, so they do
 * not use the UPPER_SNAKE harvest vocabulary).
 */

import type { CraftingInventory } from './crafting';
import { ITEMS, type ItemId } from './recipes';

// ---------------------------------------------------------------------------
// Garments, slots, and the Background shape
// ---------------------------------------------------------------------------

export type GarmentSlot = 'cloak' | 'shawl' | 'hat' | 'mittens' | 'boots';

/** Background weather.ts GarmentId, same order as its table. */
export type BackgroundGarmentId =
  | 'cloak'
  | 'shawl'
  | 'pointyHat'
  | 'mossyMittens'
  | 'bogBoots';

export interface GarmentDef {
  item: ItemId;
  slot: GarmentSlot;
  /** Background GarmentId for the weather table input. */
  backgroundId: BackgroundGarmentId;
  /** PINNED worn capacity bonus (0 when the garment adds none). */
  capacityBonus: number;
}

export const GARMENTS: ReadonlyArray<GarmentDef> = [
  {
    item: ITEMS.hoodedCloak,
    slot: 'cloak',
    backgroundId: 'cloak',
    capacityBonus: 6,
  },
  {
    item: ITEMS.shawl,
    slot: 'shawl',
    backgroundId: 'shawl',
    capacityBonus: 3,
  },
  {
    item: ITEMS.pointyHat,
    slot: 'hat',
    backgroundId: 'pointyHat',
    capacityBonus: 1,
  },
  {
    item: ITEMS.mossyMittens,
    slot: 'mittens',
    backgroundId: 'mossyMittens',
    capacityBonus: 0,
  },
  {
    item: ITEMS.bogBoots,
    slot: 'boots',
    backgroundId: 'bogBoots',
    capacityBonus: 0,
  },
];

const GARMENT_BY_ITEM = new Map<ItemId, GarmentDef>(
  GARMENTS.map((g) => [g.item, g]),
);

/**
 * Worn capacity bonus per garment item id. PINNED (Adam,
 * 2026-10-26): cloak +6, shawl +3, hat +1, mittens +0, boots +0.
 * PersonalInventory imports this table (clothes.ts imports no
 * inventory module, so there is no cycle).
 */
export const WORN_CAPACITY_BONUS: Readonly<Record<string, number>> = {
  [ITEMS.hoodedCloak]: 6,
  [ITEMS.shawl]: 3,
  [ITEMS.pointyHat]: 1,
  [ITEMS.mossyMittens]: 0,
  [ITEMS.bogBoots]: 0,
};

export function isGarment(item: ItemId): boolean {
  return GARMENT_BY_ITEM.has(item);
}

export function garmentDef(item: ItemId): GarmentDef | undefined {
  return GARMENT_BY_ITEM.get(item);
}

// ---------------------------------------------------------------------------
// Wardrobe — the worn list
// ---------------------------------------------------------------------------

export class Wardrobe {
  private readonly worn = new Map<GarmentSlot, ItemId>();

  /**
   * Wear an owned garment into its slot. Ownership is checked
   * against the passed inventory when one is given (a garment
   * she does not carry cannot be worn); the garment is NOT
   * removed from inventory — wearing is a slot flag, not a
   * move, and inventory.ts excludes worn ids from used().
   * Wearing into an occupied slot replaces the previous garment
   * in that slot (it stays carried, simply no longer worn).
   * Wiring must call inventory.setWorn(this.wornItemIds())
   * afterwards so capacity follows the worn list.
   */
  wear(inventory: CraftingInventory | null, item: ItemId): GarmentSlot {
    const def = garmentDef(item);
    if (def === undefined) {
      throw new Error(`Cannot wear ${item}: not a garment.`);
    }
    if (inventory !== null && inventory.count(item) < 1) {
      throw new Error(`Cannot wear ${item}: none carried.`);
    }
    this.worn.set(def.slot, item);
    return def.slot;
  }

  /** Clear one slot (the garment stays carried, no longer worn). */
  remove(slot: GarmentSlot): void {
    this.worn.delete(slot);
  }

  /** Worn garment item ids, in slot order (cloak first). */
  wornItemIds(): ItemId[] {
    return GARMENTS.filter((g) => this.worn.get(g.slot) === g.item).map(
      (g) => g.item,
    );
  }

  /**
   * Worn list in Background's weather-table shape, for
   * ExposureModifiers.clothing. No percentages are computed here
   * — weather.ts owns the table and the stacking.
   */
  wornGarments(): BackgroundGarmentId[] {
    return GARMENTS.filter((g) => this.worn.get(g.slot) === g.item).map(
      (g) => g.backgroundId,
    );
  }

  /** Bog-boots query shape for movement.ts (less-slow effect). */
  bogBootsWorn(): boolean {
    return this.worn.get('boots') === ITEMS.bogBoots;
  }

  /** PINNED worn capacity bonus total (cloak +6, shawl +3, hat +1). */
  wornCapacityBonus(): number {
    let total = 0;
    for (const item of this.worn.values()) {
      total += WORN_CAPACITY_BONUS[item] ?? 0;
    }
    return total;
  }

  /** Item worn in a slot, or undefined when the slot is empty. */
  wornIn(slot: GarmentSlot): ItemId | undefined {
    return this.worn.get(slot);
  }
}
