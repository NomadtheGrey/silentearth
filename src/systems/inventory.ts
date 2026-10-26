/**
 * Silent Earth — personal inventory (player-systems lane).
 *
 * The REAL inventory behind the crafting engine's minimal interface
 * (see ./crafting.ts: count / add / remove). It replaces the tiny
 * in-memory adapter in crafting.ts, which stays as a test-only helper.
 *
 * SCOPE — personal carrying ONLY:
 * - Item stacks, existing item vocabulary only (./recipes.ts ITEMS).
 *   No new items are introduced here.
 * - The carrying-capacity ladder from
 *   ~/workspace/silent-earth/docs/carrying-capacity-2026-10-25.md.
 * - NOT home storage: house storage (homes hold supplies safe from
 *   the elements, increasing per house upgrade) is separate and rides
 *   with housing work later. Do not fold it into this class.
 * - NOT station hauling: the Trundle-Tool moves stations (a separate
 *   system); its carrying-capacity bonus is modelled here only as a
 *   number, because the bonus applies to personal carrying.
 * - NO UI in this file (presentation lives in the UI lane).
 * - NO harvest wiring: harvest buttons fire bus events, and
 *   connecting harvest outcomes to inventory add() is the wiring
 *   step AFTER this lands, not something inside this file.
 *
 * CAPACITY MODEL (count-based; no slots, no weight, no size classes —
 * size-based capacity was brainstorm, not a pick):
 * - used = sum of all stacks EXCEPT carrying gear (see below).
 * - capacity = pockets base + each owned gear type's bonus (additive).
 *
 * PINNED NUMBERS (do not retune silently):
 * - Pockets base: 10. Apron: +10. Small Basket: +25. Large Basket: 50
 *   (all Adam, 2026-10-25). Trundle-Tool: +50 (PINNED by Adam,
 *   2026-10-26 — previously "hefty, size TBD").
 *
 * PINNED (Adam, 2026-10-26): LARGE BASKET REPLACES SMALL BASKET.
 *     Total with pockets + apron + large = 70; the small basket's
 *     +25 does NOT stack with the large basket's 50. (The 'stack'
 *     total, 95, is no longer live — it survives only as the
 *     non-ruled alternative of the `largeBasketMode` option, which
 *     wiring must NOT pass.) The mode stays a required constructor
 *     option with NO default: shell construction passes the ruled
 *     value explicitly — new PersonalInventory({ largeBasketMode:
 *     'replace' }) — and no silent default was added to the model.
 *     Practical note: crafting a large basket CONSUMES the small
 *     basket (upgrade), so right after the upgrade the player holds
 *     only the large basket; the modes diverge only if the player
 *     later holds both baskets at once (e.g. by crafting a second
 *     small basket while owning a large one) — under the ruling,
 *     that second small basket adds nothing while the large basket
 *     is held.
 *
 * PINNED (Adam, 2026-10-26): Trundle-Tool carrying bonus is +50.
 *     It was previously "hefty, size TBD"; that TBD is now closed.
 *     The bonus is the TRUNDLE_TOOL_BONUS constant below — the live
 *     value, not a tunable and not an unset placeholder. It applies
 *     only while the player holds a Trundle-Tool.
 *
 * PINNED (Adam, 2026-10-26): WORN clothes capacity bonuses, ADDITIVE
 *     with the gear above — Pointy Hat +1, Shawl +3, Cloak +6
 *     (mittens and bog boots add none). Worn garments follow the
 *     gear rule: a worn garment is NOT counted against used
 *     capacity, and its bonus counts while it is both worn and
 *     carried. The worn list lives in clothes.ts (Wardrobe);
 *     wiring keeps this inventory in sync by calling setWorn()
 *     after any wear/remove. Until then worn is empty and
 *     capacity is unchanged.
 *
 * IMPLEMENTATION CHOICES (not pinned rulings — Adam can overturn):
 * - Carrying gear grants capacity and is NOT counted against it.
 *   Rationale: the doc's totals read as contents capacity, and a
 *   basket you just crafted must be carryable. Gear = apron, small
 *   basket, large basket, Trundle-Tool. Every other item (including
 *   other tools) counts toward used capacity.
 * - A gear bonus applies once per gear TYPE owned, not per unit:
 *   two aprons do not give +20.
 * - add() enforces capacity with a HARD cap (throws
 *   InventoryCapacityError). The soft-cap brainstorm
 *   (overfill-but-slow) was NOT picked, and movement speed lives in
 *   another lane, so this file invents no slow mechanic. Gear adds
 *   are never capacity-blocked (otherwise picking up a basket while
 *   full would deadlock progression).
 * - The constructor does NOT capacity-check `initial` stacks: it is
 *   a state-restoration path (e.g. loading), and a later capacity
 *   ruling change must not make old states unloadable. Gameplay
 *   additions go through add(), which does enforce.
 *
 * ID NORMALIZATION (2026-10-26 bug fix — Adam's live playtest):
 * Harvest yields in src/game/objects.ts spell items UPPER_SNAKE
 * (SNAP_WOOD, TENDER_VINES, ...) while recipes in ./recipes.ts
 * spell them kebab-case (snap-wood, tender-vines, ...), and this
 * class used to match keys EXACTLY — so every harvested stack
 * missed every recipe (count('snap-wood') read 0 with a full
 * SNAP_WOOD stack beside it). The fix is HERE, at this one seam:
 * every id entering or queried against this inventory passes
 * through normalizeItemId() below (add / count / remove /
 * canCarry / setWorn / constructor initial stacks), so stacks
 * are stored under ONE spelling — the recipes kebab spelling —
 * whatever spelling arrived. The mapping is EXPLICIT, not blind
 * case conversion: two names differ by more than case
 * (RIVER_SLUDGE -> river-silt, SPORES -> luminous-spores), and
 * a blind lowercaser would have shipped those two wrong. Ids
 * with no table entry pass through UNCHANGED (kebab recipe ids,
 * crafted ids, flint, and any future id keep working); STUMP is
 * deliberately NOT in the table — it is a workstation anchor,
 * not an inventory item, and no stump stack is invented here.
 * Hunger (hunger.ts) and fire (fire.ts) predicates consult the
 * same table so their UPPER food/cook constants keep working
 * against normalized stacks AND against panel row ids (which
 * are normalized stack keys) — see those files' notes.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import {
  craft,
  type CraftingInventory,
  type StationContext,
} from './crafting';
import { WORN_CAPACITY_BONUS } from './clothes';
import { ITEMS, type ItemId, type Recipe } from './recipes';

/** Pinned numbers — see the header. Change only on Adam's word. */
export const POCKETS_BASE_CAPACITY = 10;
export const APRON_BONUS = 10;
export const SMALL_BASKET_BONUS = 25;
export const LARGE_BASKET_BONUS = 50;
/** PINNED by Adam 2026-10-26 (was "hefty, size TBD"). */
export const TRUNDLE_TOOL_BONUS = 50;

/**
 * Items that grant carrying capacity. Gear is not counted against
 * used capacity (implementation choice, see header).
 */
export const CARRYING_GEAR: ReadonlySet<ItemId> = new Set([
  ITEMS.apron,
  ITEMS.smallBasket,
  ITEMS.largeBasket,
  ITEMS.trundleTool,
]);

export function isCarryingGear(item: ItemId): boolean {
  return CARRYING_GEAR.has(item);
}

// ---------------------------------------------------------------------------
// Id normalization — the harvest/recipe spelling seam (2026-10-26)
// ---------------------------------------------------------------------------

/**
 * Game-layer harvest spelling -> systems-layer recipe spelling.
 * Covers EVERY yield string in src/game/objects.ts (primary and
 * secondary yields, ground materials, and the clay rule's CLAY)
 * plus the fire system's output COOKED_ACORNS. Values use ITEMS
 * where a recipe item exists; BONE, SALT_CRYSTAL, DIRT, MUD,
 * GRASS have no recipe item yet, so they normalize to plain
 * kebab — the stack displays and counts consistently, and a
 * future recipe can adopt the kebab id without a migration.
 * STUMP is deliberately ABSENT: it is a workstation anchor, not
 * an inventory item (see the header note).
 */
export const ITEM_ID_ALIASES: Readonly<Record<string, ItemId>> = {
  SNAP_WOOD: ITEMS.snapWood,
  TENDER_VINES: ITEMS.tenderVines,
  PEAT_MOSS: ITEMS.peatMoss,
  RIVER_SLUDGE: ITEMS.riverSilt,
  RIVER_STONE: ITEMS.riverStone,
  BONE: 'bone',
  SALT_CRYSTAL: 'salt-crystal',
  DOWNED_OAK: ITEMS.downedOak,
  SPORES: ITEMS.luminousSpores,
  DRY_KINDLING: ITEMS.dryKindling,
  CLAY: ITEMS.clay,
  DIRT: 'dirt',
  MUD: 'mud',
  GRASS: 'grass',
  ACORNS: 'acorns',
  BOG_BERRIES: 'bog-berries',
  ELDERBERRIES: 'elderberries',
  COOKED_ACORNS: 'cooked-acorns',
};

/**
 * Canonical id for an item, in either spelling. Unknown ids pass
 * through unchanged — normalization never invents or drops an
 * item, it only unifies the known aliases.
 */
export function normalizeItemId(item: ItemId): ItemId {
  return ITEM_ID_ALIASES[item] ?? item;
}

// ---------------------------------------------------------------------------
// Display spelling — code ids are never printed (2026-10-26)
// ---------------------------------------------------------------------------

/**
 * Display spelling for every known item, keyed by NORMALIZED id.
 * RULE (Adam, 2026-10-26): the UI NEVER prints a raw code id —
 * code spelling lives in code, display spelling lives HERE.
 * Crafted names match their RECIPES names (the single display
 * source; if a recipe is renamed, this table follows it);
 * harvested/food/ground names follow the design doc's display
 * names (snap-wood -> "Snap-Wood", tender-vines ->
 * "Tender-Vines", luminous-spores -> "Luminous Spores",
 * twined-cordage -> "Twined Cordage", bog-berries ->
 * "Bog Berries" per the food-candidates doc). The panel row
 * name comes from displayNameFor(), never from the stack key.
 */
export const ITEM_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  'snap-wood': 'Snap-Wood',
  'tender-vines': 'Tender-Vines',
  'peat-moss': 'Peat Moss',
  'downed-oak': 'Downed Oak',
  'river-silt': 'River Silt',
  'river-stone': 'River Stone',
  'luminous-spores': 'Luminous Spores',
  'dry-kindling': 'Dry Kindling',
  clay: 'Clay',
  flint: 'Flint',
  'old-stump': 'Old Stump',
  'twined-cordage': 'Twined Cordage',
  'garden-trowel': 'Garden Trowel',
  'sharp-trowel': 'Sharp Trowel',
  spade: 'Spade',
  'axe-trowel': 'Axe-Trowel',
  'spade-axe': 'Spade-Axe',
  'trundle-tool': 'Trundle-Tool',
  'primitive-lean-to': 'Primitive Lean-to',
  'thatch-hut': 'Thatch Hut',
  'wattle-and-daub-hut': 'Wattle-and-Daub Hut',
  'woven-cottage': 'Woven Cottage',
  'small-wooden-hut': 'Small Wooden Hut',
  'moss-cradle': 'Moss Cradle',
  campfire: 'Campfire',
  hearth: 'Hearth',
  kiln: 'Kiln',
  bloomery: 'Bloomery',
  'stumpy-workstation': 'Stumpy Workstation',
  'crafted-workstation': 'Crafted Workstation',
  'potters-wheel': "Potter's Wheel",
  loom: 'Loom',
  'clay-pot': 'Clay Pot',
  'clay-brick': 'Clay Brick',
  'small-basket': 'Small Basket',
  'large-basket': 'Large Basket',
  apron: 'Apron',
  'hooded-cloak': 'Hooded Cloak',
  shawl: 'Shawl',
  'pointy-hat': 'Pointy Hat',
  'mossy-mittens': 'Mossy Mittens',
  'bog-boots': 'Bog Boots',
  umbrella: 'Umbrella',
  snare: 'Snare',
  'fish-weir-trap': 'Fish / Weir Trap',
  'pot-trap': 'Pot Trap',
  pitfall: 'Pitfall',
  deadfall: 'Deadfall',
  bone: 'Bone',
  'salt-crystal': 'Salt Crystal',
  dirt: 'Dirt',
  mud: 'Mud',
  grass: 'Grass',
  acorns: 'Acorns',
  'bog-berries': 'Bog Berries',
  elderberries: 'Elderberries',
  'cooked-acorns': 'Cooked Acorns',
};

/**
 * Display spelling for an item in either code spelling
 * ('SNAP_WOOD' and 'snap-wood' both give 'Snap-Wood').
 * Unknown ids fall back to themselves — the function never
 * blanks a row, it just has no prettier name to offer; the
 * table above covers every known id, so a fallback print
 * means a new item arrived without a display name yet.
 */
export function displayNameFor(item: ItemId): string {
  return ITEM_DISPLAY_NAMES[normalizeItemId(item)] ?? item;
}

/**
 * Large-basket question, as an explicit switch. No default exists:
 * PersonalInventoryOptions requires this field.
 */
export type LargeBasketMode = 'replace' | 'stack';

export interface PersonalInventoryOptions {
  /** REQUIRED — pass the RULED mode 'replace' (total 70). 'stack' (95) is the non-ruled alternative; wiring must not pass it. No default. */
  largeBasketMode: LargeBasketMode;
  /** Starting stacks (restoration path; not capacity-checked). */
  initial?: Record<string, number>;
  /** Worn garment item ids (from Wardrobe); see setWorn(). */
  worn?: readonly ItemId[];
}

export interface CapacityBreakdown {
  pockets: number;
  apron: number;
  smallBasket: number;
  largeBasket: number;
  trundleTool: number;
  /** PINNED worn bonuses total (hat +1, shawl +3, cloak +6). */
  worn: number;
  total: number;
  largeBasketMode: LargeBasketMode;
  /** PINNED 50 (Adam 2026-10-26) — the live Trundle-Tool bonus. */
  trundleToolBonus: number;
}

export interface InventoryStack {
  item: ItemId;
  quantity: number;
}

/** Thrown by add() when a non-gear addition would exceed capacity. */
export class InventoryCapacityError extends Error {
  readonly item: ItemId;
  readonly quantity: number;
  readonly free: number;

  constructor(item: ItemId, quantity: number, free: number) {
    super(
      `Cannot carry ${quantity} ${item}: only ${free} capacity free.`,
    );
    this.name = 'InventoryCapacityError';
    this.item = item;
    this.quantity = quantity;
    this.free = free;
  }
}

// ---------------------------------------------------------------------------
// Personal inventory
// ---------------------------------------------------------------------------

export class PersonalInventory implements CraftingInventory {
  private readonly stacks = new Map<ItemId, number>();
  private readonly largeBasketMode: LargeBasketMode;
  private worn = new Set<ItemId>();

  constructor(options: PersonalInventoryOptions) {
    this.largeBasketMode = options.largeBasketMode;
    if (options.worn) {
      this.worn = new Set(options.worn.map(normalizeItemId));
    }
    if (options.initial) {
      for (const [item, quantity] of Object.entries(options.initial)) {
        if (quantity > 0) {
          // Normalize + merge: an initial state naming the same
          // item in both spellings lands as ONE stack, not two.
          const id = normalizeItemId(item);
          this.stacks.set(id, (this.stacks.get(id) ?? 0) + quantity);
        }
      }
    }
  }

  /**
   * Sync the worn list from Wardrobe (call after any wear /
   * remove). A worn garment counts its PINNED bonus only while
   * it is also carried (count >= 1); a worn id with no stack
   * contributes nothing and is excluded from nothing.
   */
  setWorn(worn: readonly ItemId[]): void {
    this.worn = new Set(worn.map(normalizeItemId));
  }

  /** Current worn garment item ids. */
  wornItems(): ItemId[] {
    return [...this.worn];
  }

  // --- CraftingInventory interface (count / add / remove) ---

  count(item: ItemId): number {
    return this.stacks.get(normalizeItemId(item)) ?? 0;
  }

  add(item: ItemId, quantity: number): void {
    assertPositiveInteger(quantity, 'add');
    const id = normalizeItemId(item);
    if (!isCarryingGear(id) && !this.canCarry(id, quantity)) {
      throw new InventoryCapacityError(id, quantity, this.free());
    }
    this.stacks.set(id, this.count(id) + quantity);
  }

  remove(item: ItemId, quantity: number): void {
    assertPositiveInteger(quantity, 'remove');
    const id = normalizeItemId(item);
    const held = this.count(id);
    if (held < quantity) {
      throw new Error(
        `Cannot remove ${quantity} ${item}: only ${held} held.`,
      );
    }
    const remaining = held - quantity;
    if (remaining === 0) {
      this.stacks.delete(id);
    } else {
      this.stacks.set(id, remaining);
    }
  }

  // --- Capacity ---

  /** Total carrying capacity right now, given owned gear. */
  capacity(): number {
    return this.capacityBreakdown().total;
  }

  /** Per-source breakdown, so both open-question totals stay visible. */
  capacityBreakdown(): CapacityBreakdown {
    const hasApron = this.count(ITEMS.apron) >= 1;
    const hasSmallBasket = this.count(ITEMS.smallBasket) >= 1;
    const hasLargeBasket = this.count(ITEMS.largeBasket) >= 1;
    const hasTrundleTool = this.count(ITEMS.trundleTool) >= 1;

    // Replace mode: a held large basket supersedes the small
    // basket's bonus. Stack mode: both bonuses apply. Either way a
    // lone small basket (no large basket) always gives its +25.
    const smallBasket =
      hasSmallBasket &&
      !(hasLargeBasket && this.largeBasketMode === 'replace')
        ? SMALL_BASKET_BONUS
        : 0;

    // Worn bonus: PINNED per garment (clothes.ts), counted only
    // for worn garments actually carried — mirrors the gear rule
    // (bonus once per garment, not per unit).
    let worn = 0;
    for (const item of this.worn) {
      if (this.count(item) >= 1) {
        worn += WORN_CAPACITY_BONUS[item] ?? 0;
      }
    }

    const breakdown: CapacityBreakdown = {
      pockets: POCKETS_BASE_CAPACITY,
      apron: hasApron ? APRON_BONUS : 0,
      smallBasket,
      largeBasket: hasLargeBasket ? LARGE_BASKET_BONUS : 0,
      trundleTool: hasTrundleTool ? TRUNDLE_TOOL_BONUS : 0,
      worn,
      total: 0,
      largeBasketMode: this.largeBasketMode,
      trundleToolBonus: TRUNDLE_TOOL_BONUS,
    };
    breakdown.total =
      breakdown.pockets +
      breakdown.apron +
      breakdown.smallBasket +
      breakdown.largeBasket +
      breakdown.trundleTool +
      breakdown.worn;
    return breakdown;
  }

  /** Contents count: every stack except carrying gear and worn garments. */
  used(): number {
    let total = 0;
    for (const [item, quantity] of this.stacks) {
      if (!isCarryingGear(item) && !this.worn.has(item)) {
        total += quantity;
      }
    }
    return total;
  }

  /** Remaining contents capacity (never below 0 in normal play). */
  free(): number {
    return Math.max(0, this.capacity() - this.used());
  }

  /**
   * Would this addition fit? Gear and worn garments always fit
   * (they are not counted). Other items fit when used + quantity
   * <= capacity.
   */
  canCarry(item: ItemId, quantity: number): boolean {
    const id = normalizeItemId(item);
    if (isCarryingGear(id) || this.worn.has(id)) {
      return true;
    }
    return this.used() + quantity <= this.capacity();
  }

  // --- Inspection / cloning ---

  /** Snapshot of all stacks, in insertion order. */
  stacksSnapshot(): InventoryStack[] {
    return [...this.stacks.entries()].map(([item, quantity]) => ({
      item,
      quantity,
    }));
  }

  /** Independent copy with the same options, stacks, and worn list. */
  clone(): PersonalInventory {
    const copy = new PersonalInventory({
      largeBasketMode: this.largeBasketMode,
      worn: [...this.worn],
    });
    for (const [item, quantity] of this.stacks) {
      copy.stacks.set(item, quantity);
    }
    return copy;
  }
}

// ---------------------------------------------------------------------------
// Crafting into a capacity-limited inventory
// ---------------------------------------------------------------------------

/**
 * Craft into a PersonalInventory without breaking craft()'s atomicity.
 *
 * Why this helper exists: raw craft() checks ingredients, then
 * removes them, then adds the output. Against a capacity-limited
 * inventory, an output that does not fit would throw from add()
 * AFTER the ingredients were consumed — the one case where craft()
 * is not atomic. This helper simulates the whole craft on a clone
 * first (which throws on either an ingredient or a capacity
 * shortfall, leaving the real inventory untouched), and only then
 * performs the real craft, which is then guaranteed to succeed.
 *
 * Callers crafting into a PersonalInventory should use this, not
 * raw craft(). Callers with a non-capacity inventory (tests, the
 * crafting adapter) can keep using raw craft().
 */
export function craftIntoInventory(
  recipe: Recipe,
  inventory: PersonalInventory,
  station: StationContext = null,
): { item: ItemId; quantity: number } {
  const trial = inventory.clone();
  craft(recipe, trial, station); // throws before any real mutation
  return craft(recipe, inventory, station);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertPositiveInteger(quantity: number, verb: string): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`${verb} quantity must be a positive integer.`);
  }
}
