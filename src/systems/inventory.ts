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
 * CAPACITY MODEL (WEIGHT-BASED since 2026-10-27, DEV brief —
 * count-based before that; no slots, no size classes):
 * - used = sum over stacks of quantity × weight, EXCEPT carrying
 *   gear and worn garments (see below). Unit: POUNDS (lb).
 * - capacity = pockets base + each owned gear type's bonus
 *   (additive), all in pounds.
 * - used() / capacity() / free() return POUNDS. The explicit
 *   accessors for UI are usedLb() / capacityLb() (same values,
 *   clearer names); weightOf(item) gives one item's pounds.
 *
 * PINNED NUMBERS (do not retune silently — the 2026-10-27 change
 * is the UNIT only, count -> pounds; every number below is
 * unchanged):
 * - Pockets base: 10 lb. Apron: +10 lb. Small Basket: +25 lb.
 *   Large Basket: 50 lb (all Adam, 2026-10-25). Trundle-Tool:
 *   +50 lb (PINNED by Adam, 2026-10-26 — previously "hefty, size
 *   TBD"). Full kit: 130 lb (10 + 10 + 50 + 50 + 10 worn) —
 *   FLAGGED for Adam's pin pass (the trundle is wheeled, but
 *   130 is his call to keep or trim).
 *
 * PINNED (Adam, main chat 2026-10-27, "for simplicity"):
 *     LARGE BASKET REPLACES SMALL BASKET. Total with pockets
 *     + apron + large = 70 lb; the small basket's +25 lb does
 *     NOT stack with the large basket's 50 lb (the 'stack'
 *     total, 95 lb, is closed — it survives only as the
 *     unruled branch of the `largeBasketMode` option, which
 *     wiring does not pass). History, full chain: 10-26
 *     replace pin → 10-27 open under the pin note (DEV
 *     confirmed it open) → 10-27 replace ruling, final
 *     (Adam, "for simplicity"); this header now states the
 *     pin. The mode
 *     stays a required constructor option with NO default:
 *     shell construction passes the pinned value explicitly
 *     — new PersonalInventory({ largeBasketMode: 'replace' })
 *     — and no silent default was added to the model.
 *     Practical note: crafting a large basket CONSUMES the
 *     small basket (upgrade), so right after the upgrade the
 *     player holds only the large basket; the modes diverge
 *     only if the player later holds both baskets at once
 *     (e.g. by crafting a second small basket while owning a
 *     large one) — under the pin, that second small basket
 *     adds nothing while the large basket is held.
 *
 * PINNED (Adam, 2026-10-26): Trundle-Tool carrying bonus is +50 lb.
 *     It was previously "hefty, size TBD"; that TBD is now closed.
 *     The bonus is the TRUNDLE_TOOL_BONUS constant below — the live
 *     value, not a tunable and not an unset placeholder. It applies
 *     only while the player holds a Trundle-Tool.
 *
 * PINNED (Adam, 2026-10-26): WORN clothes capacity bonuses, ADDITIVE
 *     with the gear above — Pointy Hat +1 lb, Shawl +3 lb, Cloak
 *     +6 lb (mittens and bog boots add none). Worn garments follow
 *     the gear rule: a worn garment is NOT counted against used
 *     capacity, and its bonus counts while it is both worn and
 *     carried. The worn list lives in clothes.ts (Wardrobe);
 *     wiring keeps this inventory in sync by calling setWorn()
 *     after any wear/remove. Until then worn is empty and
 *     capacity is unchanged.
 *
 * WEIGHT TABLE (DEV draft 2026-10-27, lane-decided, for Adam's
 * pin pass — every weight divides 1 lb evenly, so 1/weight is
 * 1, 2, 4, 5, or 10):
 * - 0.1 lb: acorns, bog-berries, elderberries, luminous-spores.
 * - 0.25 lb: dry-kindling, twined-cordage, grass, salt-crystal,
 *   edible-mushroom, poison-mushroom, apple, paper.
 * - 0.5 lb: tender-vines, peat-moss, bone, flint, pointy-hat,
 *   mossy-mittens, plant-pulp, pressed-sheets.
 * - 1 lb: snap-wood, river-silt, clay, dirt, mud, garden-trowel,
 *   sharp-trowel, shawl, umbrella, clay-pot, grimoire.
 * - 2 lb: river-stone, downed-oak, spade, axe-trowel,
 *   hooded-cloak, bog-boots.
 * - 4 lb: spade-axe, clay-brick, and homes / fires / stations
 *   while carried between craft and place (short interval —
 *   flagged: primitive-lean-to, thatch-hut, wattle-and-daub-hut,
 *   woven-cottage, small-wooden-hut, moss-cradle, campfire,
 *   hearth, kiln, bloomery, stumpy-workstation,
 *   crafted-workstation, potters-wheel, loom).
 * - Unknown ids default to 1 lb (never block the game on a
 *   missing row — flagged). LANE JUDGMENTS inside that rule,
 *   for the pin pass: cooked-acorns 0.1 lb (same as acorns —
 *   cooking adds no mass) and the plural mushroom ids
 *   ('mushrooms', 'poison-mushrooms') 0.25 lb (same food family
 *   as the singulars the brief names); traps are unmapped, so
 *   old-save trap items weigh the 1 lb default.
 * - FLOAT SAFETY: pounds like 0.1 are not exact in binary, so
 *   all capacity math runs in INTEGER units of 0.05 lb
 *   (1 lb = 20 units; every table weight is a whole number of
 *   units: 2, 5, 10, 20, 40, 80). Pounds are computed once, at
 *   the boundary (units / 20), never accumulated as floats.
 *   A partial grant is floor(free units / units per item).
 *
 * IMPLEMENTATION CHOICES (not pinned rulings — Adam can overturn):
 * - Carrying gear grants capacity and is NOT counted against it.
 *   Rationale: the doc's totals read as contents capacity, and a
 *   basket you just crafted must be carryable. Gear = apron, small
 *   basket, large basket, Trundle-Tool. Every other item counts
 *   toward used capacity — tools count (ladder tools at their
 *   table weights; the Trundle-Tool itself is gear, not counted),
 *   and the umbrella counts (1 lb, not gear).
 * - A gear bonus applies once per gear TYPE owned, not per unit:
 *   two aprons do not give +20 lb.
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
 * - Home storage stays COUNT-based (shelter.ts) — out of scope
 *   for this change unless Adam orders it. Save format unchanged:
 *   stacks store item + quantity, weight is derived — no
 *   migration.
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
import {
  isLadderTool,
  ownedToolItem,
  type OwnedToolItem,
} from './owned-tool';
import { ITEMS, type ItemId, type Recipe } from './recipes';

/** Pinned numbers, in POUNDS — see the header. Change only on Adam's word. */
export const POCKETS_BASE_CAPACITY = 10;
export const APRON_BONUS = 10;
export const SMALL_BASKET_BONUS = 25;
export const LARGE_BASKET_BONUS = 50;
/** PINNED by Adam 2026-10-26 (was "hefty, size TBD"). Pounds. */
export const TRUNDLE_TOOL_BONUS = 50;

/**
 * Integer weight units per pound (0.05 lb per unit). Every table
 * weight below is a whole number of units, so capacity math never
 * accumulates binary-float error (see the header's float note).
 */
export const POUND_UNITS_PER_LB = 20;

/** Default weight in pounds for ids with no table row. */
export const DEFAULT_ITEM_WEIGHT_LB = 1;

/**
 * Weight table (DEV draft 2026-10-27, lane-decided, for Adam's
 * pin pass). Keyed by NORMALIZED id; weightOf() normalizes its
 * input, so either spelling resolves. Rows the brief did not name
 * but the lane mapped by parity are marked in the header.
 */
export const ITEM_WEIGHT_LB: Readonly<Record<string, number>> = {
  // 0.1 lb
  acorns: 0.1,
  'bog-berries': 0.1,
  elderberries: 0.1,
  [ITEMS.luminousSpores]: 0.1,
  'cooked-acorns': 0.1, // lane judgment: same as acorns
  // 0.25 lb
  [ITEMS.dryKindling]: 0.25,
  [ITEMS.twinedCordage]: 0.25,
  grass: 0.25,
  'salt-crystal': 0.25,
  'edible-mushroom': 0.25,
  'poison-mushroom': 0.25,
  mushrooms: 0.25, // lane judgment: plural food family
  'poison-mushrooms': 0.25, // lane judgment: plural food family
  apple: 0.25,
  // Paper chain: dry paper lighter than damp sheets.
  [ITEMS.paper]: 0.25,
  // 0.5 lb
  [ITEMS.tenderVines]: 0.5,
  [ITEMS.peatMoss]: 0.5,
  bone: 0.5,
  [ITEMS.flint]: 0.5,
  // Lane judgment: stick + binding + tinder, light to carry.
  [ITEMS.torch]: 0.5,
  [ITEMS.litTorch]: 0.5,
  [ITEMS.pointyHat]: 0.5,
  [ITEMS.mossyMittens]: 0.5,
  // Paper chain: wet mass / damp sheets.
  [ITEMS.plantPulp]: 0.5,
  [ITEMS.pressedSheets]: 0.5,
  // 1 lb
  [ITEMS.snapWood]: 1,
  [ITEMS.riverSilt]: 1,
  [ITEMS.clay]: 1,
  dirt: 1,
  mud: 1,
  [ITEMS.gardenTrowel]: 1,
  [ITEMS.sharpTrowel]: 1,
  [ITEMS.shawl]: 1,
  [ITEMS.umbrella]: 1,
  [ITEMS.clayPot]: 1,
  [ITEMS.grimoire]: 1,
  // 2 lb
  [ITEMS.riverStone]: 2,
  [ITEMS.downedOak]: 2,
  [ITEMS.spade]: 2,
  [ITEMS.axeTrowel]: 2,
  [ITEMS.hoodedCloak]: 2,
  [ITEMS.bogBoots]: 2,
  // 4 lb
  [ITEMS.spadeAxe]: 4,
  [ITEMS.clayBrick]: 4,
  // Homes / fires / stations while carried (flagged interval).
  [ITEMS.primitiveLeanTo]: 4,
  [ITEMS.thatchHut]: 4,
  [ITEMS.wattleAndDaubHut]: 4,
  [ITEMS.wovenCottage]: 4,
  [ITEMS.smallWoodenHut]: 4,
  [ITEMS.mossCradle]: 4,
  [ITEMS.campfire]: 4,
  [ITEMS.hearth]: 4,
  [ITEMS.kiln]: 4,
  [ITEMS.bloomery]: 4,
  [ITEMS.stumpyWorkstation]: 4,
  [ITEMS.craftedWorkstation]: 4,
  [ITEMS.pottersWheel]: 4,
  [ITEMS.loom]: 4,
  // Ritual altar while carried (same flagged interval as
  // homes / fires / stations — placed structures ride 4 lb
  // between craft and place).
  [ITEMS.altar]: 4,
};

/**
 * One item's weight in pounds, in either spelling. Unknown ids
 * weigh the 1 lb default — a missing row never blocks the game.
 */
export function weightOf(item: ItemId): number {
  return ITEM_WEIGHT_LB[normalizeItemId(item)] ?? DEFAULT_ITEM_WEIGHT_LB;
}

/** One item's weight in integer 0.05 lb units (exact). */
function weightUnits(item: ItemId): number {
  return Math.round(weightOf(item) * POUND_UNITS_PER_LB);
}

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
  MUSHROOMS: 'mushrooms',
  POISON_MUSHROOMS: 'poison-mushrooms',
  EDIBLE_MUSHROOM: 'edible-mushroom',
  POISON_MUSHROOM: 'poison-mushroom',
  APPLE: 'apple',
  // FLINT (Background e6853c6, DEV brief 2026-10-27): the
  // flint source yields UPPER_SNAKE 'FLINT' like every
  // other item, but this table had no FLINT entry — so
  // granted flint stacked under 'FLINT' while the
  // lighting menu counts 'flint' (ITEMS.flint), and flint
  // lighting stayed unreachable despite the source
  // landing. One line, Systems side (a lowercase yield
  // from Background would break convention).
  FLINT: ITEMS.flint,
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
  altar: 'Altar',
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
  torch: 'Torch',
  'lit-torch': 'Lit Torch',
  'plant-pulp': 'Plant Pulp',
  'pressed-sheets': 'Pressed Sheets',
  paper: 'Paper',
  grimoire: 'Grimoire',
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
  mushrooms: 'Mushrooms',
  'poison-mushrooms': 'Poison Mushrooms',
  'edible-mushroom': 'Edible Mushroom',
  'poison-mushroom': 'Poison Mushroom',
  apple: 'Apple',
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
  /** REQUIRED — pass the PINNED mode 'replace' (total 70 lb). 'stack' (95 lb) is the closed alternative; wiring does not pass it. No default. */
  largeBasketMode: LargeBasketMode;
  /** Starting stacks (restoration path; not capacity-checked). */
  initial?: Record<string, number>;
  /** Worn garment item ids (from Wardrobe); see setWorn(). */
  worn?: readonly ItemId[];
}

/** All values in POUNDS (weight model, 2026-10-27). */
export interface CapacityBreakdown {
  pockets: number;
  apron: number;
  smallBasket: number;
  largeBasket: number;
  trundleTool: number;
  /** PINNED worn bonuses total (hat +1 lb, shawl +3 lb, cloak +6 lb). */
  worn: number;
  total: number;
  largeBasketMode: LargeBasketMode;
  /** PINNED 50 lb (Adam 2026-10-26) — the live Trundle-Tool bonus. */
  trundleToolBonus: number;
}

export interface InventoryStack {
  item: ItemId;
  quantity: number;
}

/**
 * Result of addPartial(): the normalized item, how much actually
 * landed in the pack, and how much did not fit. granted +
 * remainder === the requested quantity, always.
 */
export interface PartialGrant {
  item: ItemId;
  granted: number;
  remainder: number;
}

/** Thrown by add() when a non-gear addition would exceed capacity. `free` is in pounds. */
export class InventoryCapacityError extends Error {
  readonly item: ItemId;
  readonly quantity: number;
  readonly free: number;

  constructor(item: ItemId, quantity: number, free: number) {
    super(
      `Cannot carry ${quantity} ${item}: only ${free} lb free.`,
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

  /**
   * Partial grant (harvest overflow, 2026-10-26; weight-based
   * since 2026-10-27): add what fits BY WEIGHT, return the
   * remainder instead of throwing. granted + remainder always
   * equals the requested quantity, and a full pack grants 0
   * with the whole quantity as remainder — never a throw for
   * lack of room (invalid quantities still throw, exactly like
   * add()). The fit is floor(free weight / item weight): a
   * 0.25 lb item with 0.4 lb free grants 1, not 1.6. Gear and
   * worn garments always fit in full, mirroring canCarry() /
   * add(): adding a basket while full must still work. TOOLS
   * (Adam's 2026-10-27 amendment) grant by POST-ADD fit, not
   * by floor division: a first tool grants in full even from
   * a full pack (it is uncounted once held), while a second
   * unit counts — so a full pack grants 1 of 2 spades, and an
   * upgrade that would displace a counted predecessor grants
   * only if the post-add weight still fits. The harvest
   * listener uses this to split fits vs remainder; the
   * remainder becomes a ground pile (see ./piles.ts), never
   * silently dropped. add() itself is unchanged — crafting keeps
   * its hard cap and its atomicity.
   */
  addPartial(item: ItemId, quantity: number): PartialGrant {
    assertPositiveInteger(quantity, 'addPartial');
    const id = normalizeItemId(item);
    let granted: number;
    if (isCarryingGear(id) || this.worn.has(id)) {
      granted = quantity;
    } else if (isLadderTool(id)) {
      // Tool case: largest grant whose POST-ADD weight fits.
      // Post-add weight is monotonic in the grant (adding more
      // of one item never lightens the pack), so the first
      // failure ends the search.
      granted = 0;
      for (let g = 1; g <= quantity; g++) {
        if (this.fitsAfterAdd(id, g)) {
          granted = g;
        } else {
          break;
        }
      }
    } else {
      granted = Math.min(
        quantity,
        Math.floor(this.freeUnits() / weightUnits(id)),
      );
    }
    if (granted > 0) {
      this.stacks.set(id, this.count(id) + granted);
    }
    return { item: id, granted, remainder: quantity - granted };
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

  // --- Capacity (pounds) ---

  /** Total carrying capacity right now, given owned gear, in pounds. */
  capacity(): number {
    return this.capacityBreakdown().total;
  }

  /** Explicit pounds accessor for UI (same value as capacity()). */
  capacityLb(): number {
    return this.capacity();
  }

  /** Per-source breakdown, in pounds. */
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

  /**
   * Contents weight in pounds: every stack except carrying gear
   * and worn garments, quantity × weight — MINUS exactly one
   * unit of the owned tool (Adam's 2026-10-27 amendment).
   * Computed in integer 0.05 lb units and converted once, so
   * 0.1 lb items never drift (ten bog-berries weigh exactly
   * 1 lb, not 0.999...).
   */
  used(): number {
    return this.usedUnits() / POUND_UNITS_PER_LB;
  }

  /** Explicit pounds accessor for UI (same value as used()). */
  usedLb(): number {
    return this.used();
  }

  /**
   * Contents weight in integer 0.05 lb units (exact; the math
   * unit), for an explicit stack map and owned tool. Exclusions,
   * in precedence order: carrying gear and worn garments exclude
   * the WHOLE stack (existing rule); the owned tool excludes
   * exactly ONE unit (Adam's 2026-10-27 amendment — she holds
   * one tool at a time, so a second tool id or a duplicate unit
   * counts at its table weight). The trundle-tool is gear, so
   * it exits on the gear branch and is never double-exempted
   * as a tool.
   */
  private usedUnitsFor(
    stacks: Map<ItemId, number>,
    owned: OwnedToolItem,
  ): number {
    let total = 0;
    for (const [item, quantity] of stacks) {
      if (isCarryingGear(item) || this.worn.has(item)) {
        continue;
      }
      if (item === owned && quantity >= 1) {
        total += (quantity - 1) * weightUnits(item);
      } else {
        total += quantity * weightUnits(item);
      }
    }
    return total;
  }

  /** Current contents weight in integer 0.05 lb units. */
  private usedUnits(): number {
    return this.usedUnitsFor(this.stacks, ownedToolItem(this));
  }

  /** Capacity in integer 0.05 lb units. */
  private capacityUnits(): number {
    return this.capacityBreakdown().total * POUND_UNITS_PER_LB;
  }

  /**
   * Would the pack still fit AFTER adding quantity of item?
   * Post-add semantics matter for tools: the added tool may
   * BECOME the owned tool, and the previously owned tool then
   * counts at its table weight — so the check runs against
   * the merged stacks with the post-add owned tool, never
   * against used + quantity × weight. (A first tool therefore
   * fits even a full pack; an upgrade fits only if the pack
   * still holds the displaced predecessor's weight.)
   */
  private fitsAfterAdd(id: ItemId, quantity: number): boolean {
    const merged = new Map(this.stacks);
    merged.set(id, (merged.get(id) ?? 0) + quantity);
    const probe = { count: (it: ItemId) => merged.get(it) ?? 0 };
    return (
      this.usedUnitsFor(merged, ownedToolItem(probe)) <=
      this.capacityUnits()
    );
  }

  /** Remaining free weight in integer 0.05 lb units (never below 0). */
  private freeUnits(): number {
    return Math.max(
      0,
      this.capacityBreakdown().total * POUND_UNITS_PER_LB -
        this.usedUnits(),
    );
  }

  /** Remaining contents capacity in pounds (never below 0 in normal play). */
  free(): number {
    return this.freeUnits() / POUND_UNITS_PER_LB;
  }

  /**
   * Would this addition fit? Gear and worn garments always fit
   * (they are not counted). Everything else is judged POST-ADD
   * (see fitsAfterAdd): a first tool fits even a full pack,
   * because it is uncounted once held.
   */
  canCarry(item: ItemId, quantity: number): boolean {
    const id = normalizeItemId(item);
    if (isCarryingGear(id) || this.worn.has(id)) {
      return true;
    }
    return this.fitsAfterAdd(id, quantity);
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
