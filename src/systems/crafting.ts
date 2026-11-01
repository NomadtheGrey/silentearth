/**
 * Silent Earth — crafting engine (player-systems lane).
 *
 * Pure TypeScript logic: no UI, no game wiring, no imports from the
 * rest of the game. It consumes the recipe data in ./recipes.ts and
 * nothing else, so it can be wired to any inventory later.
 *
 * ------------------------------------------------------------------
 * THE MINIMAL INVENTORY INTERFACE (the only contract the engine needs)
 * ------------------------------------------------------------------
 *
 * The full inventory system is a LATER piece and is deliberately NOT
 * built here. Whoever builds it (or any adapter, test harness, or
 * save system) only has to satisfy this interface:
 *
 *   interface CraftingInventory {
 *     // How many of `item` the player currently holds (0 if none).
 *     count(item: ItemId): number;
 *     // Add `quantity` of `item` (quantity > 0).
 *     add(item: ItemId, quantity: number): void;
 *     // Remove `quantity` of `item`. Callers must have checked via
 *     // canCraft first; the engine never removes more than held.
 *     remove(item: ItemId, quantity: number): void;
 *   }
 *
 * What this interface deliberately does NOT cover (later work):
 * capacity / carrying limits, slots, weight, size classes, stacking
 * rules, home storage vs personal carrying, and persistence. A
 * capacityBonus on a container recipe (see recipes.ts) is data for
 * that later system, not something this engine enforces.
 *
 * A tiny in-memory adapter, `createSimpleInventory`, is included at
 * the bottom for tests and for wiring experiments only. It is NOT
 * the inventory system — it has no capacity, no slots, no save/load.
 *
 * ------------------------------------------------------------------
 * STATION CONTEXT
 * ------------------------------------------------------------------
 *
 * Callers pass the station the player is currently crafting at (or
 * null when crafting with no station at hand) as the third argument.
 * - A recipe with a stated station requires exactly that station.
 * - A recipe with NO stated station (prototype recipes the prototype
 *   gives no workstation requirement for) passes from any context —
 *   "unstated" is not "hand", and this engine does not invent a
 *   requirement the doc / prototype did not state.
 * - 'hand' recipes pass from any context, including null, because
 *   "made anywhere" is what 'hand' means.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

import { ownedStage, ownedToolItem, TOOL_MAPPING } from './owned-tool';
// GARMENTS is the single source for garment item ids. clothes.ts
// imports CraftingInventory from here as type-only (erased at
// compile), so this is not a runtime cycle.
import { GARMENTS } from './clothes';
import {
  ITEMS,
  type CraftingStation,
  type Ingredient,
  type ItemId,
  type Recipe,
  type SiteFacts,
  type SiteRequirement,
} from './recipes';
// The shelf rule reads the item registry's categories.
// inventory.ts imports CraftingInventory from here as
// type-only (erased at compile), so this value import
// is not a runtime cycle — the same shape as clothes.ts.
import { categoryFor, type ItemCategory } from './inventory';

/**
 * Minimal inventory interface — see the header. This is the engine's
 * entire dependency on inventory. Nothing else is assumed.
 */
export interface CraftingInventory {
  count(item: ItemId): number;
  add(item: ItemId, quantity: number): void;
  remove(item: ItemId, quantity: number): void;
}

/**
 * Station the player is crafting at, or null when no station is at
 * hand. 'hand' recipes ignore this; other stated stations must match.
 */
export type StationContext = CraftingStation | null;

export interface MissingIngredient extends Ingredient {
  /** How many the player actually holds. */
  held: number;
}

export interface CanCraftResult {
  ok: boolean;
  /** Ingredients held in short supply (empty when ok). */
  missingIngredients: MissingIngredient[];
  /**
   * Upgrade predecessor shortfall. For a single predecessor this is
   * that item; for an either/or predecessor (Spade-Axe) this lists
   * every acceptable predecessor the player lacks — ok is false only
   * when NONE of them is held, and this list is then the full set.
   */
  missingUpgradeFrom: ItemId[];
  /** Required-but-not-consumed items held in short supply. */
  missingRequirements: MissingIngredient[];
  /**
   * Owned-tool-stage shortfall, when the recipe states a
   * requiresToolStage and the owned stage falls short: the
   * required stage and the stage actually held (-1 hands).
   * Absent when the recipe states no stage or the stage is met.
   * The shell reads this for the "Needs Spade."-style note.
   */
  toolStageShortfall?: { required: number; held: number };
  /** True when the recipe states a station and the context mismatches. */
  stationMismatch: boolean;
  /**
   * True when the recipe states requiresCreek and the context
   * says not near a creek. A null nearCreek leaves this
   * false (gate off — see Recipe.requiresCreek).
   */
  creekMismatch: boolean;
  /**
   * True when the recipe states requiresSite and the
   * supplied site facts say she stands wrong for it
   * (fork B). A null site input leaves this false
   * (gate off — see Recipe.requiresSite).
   */
  siteMismatch: boolean;
  /** The site the recipe requires, when it states one. */
  requiredSite?: SiteRequirement;
  /** The station the recipe requires, when it states one. */
  requiredStation?: CraftingStation;
  /**
   * No-recraft ownership status (Adam, 2026-10-28): a recipe
   * already owned or superseded is not craftable — ok is
   * false when this is not 'available'. The menu renders
   * disabled + bottom-sorted + labeled from this field.
   */
  ownership: CraftOwnership;
}

/**
 * No-recraft ownership status (Adam, 2026-10-28):
 * - 'available': craftable as far as ownership goes
 *   (materials/station/tool-stage gates still apply).
 * - 'already-owned': the exact output is already held.
 * - 'superseded': a better rung of the same ladder is
 *   already held (baskets: large held → small is
 *   superseded; tools: higher rung held → lower is
 *   superseded; same-stage non-upgrade siblings too).
 */
export type CraftOwnership = 'available' | 'already-owned' | 'superseded';

/**
 * Adam's pinned words for the two disabled states
 * (single source — the menu renders these verbatim).
 */
export const CRAFT_OWNERSHIP_LABELS: Record<
  Exclude<CraftOwnership, 'available'>,
  string
> = {
  'already-owned': 'Already Owned',
  superseded: 'Superseded',
};

/**
 * The ONE SHELF SYSTEM (Adam, 2026-10-31): the crafting
 * book files a recipe by its OUTPUT item's category —
 * the same ITEM_CATEGORIES table the inventory panel
 * groups by, so the two panels can never drift. Section
 * order is ITEM_CATEGORY_ORDER (inventory.ts). Placed
 * outcomes file by the thing made (a trap, a house, a
 * kiln all sit in 'Structures & Stations'); the Owned &
 * Superseded section is a state view, not a shelf, and
 * is not this function's business. An output with no
 * category reads 'Other' via categoryFor — the recipe
 * trails there rather than vanishing.
 */
export function craftingSection(recipe: Recipe): ItemCategory {
  return categoryFor(recipe.output.item);
}

/**
 * Pure ownership check: may this recipe be crafted again
 * from this inventory, ignoring materials/station?
 *
 * UpgradeFrom-chain-first, stage-second (DEV-required
 * refinement of the rung rule): the rung rule alone
 * would block trowel → sharp-trowel (both stage 0),
 * so a recipe whose upgradeFrom IS the owned tool
 * stays available at the same stage; same-stage
 * siblings (not the upgradeFrom) are superseded.
 * Yields are stage-based, so a blocked sibling loses
 * nothing mechanically.
 *
 * Baskets: large held → small superseded + large
 * already-owned; small only → small already-owned +
 * large available; both (old saves) → small
 * superseded + large already-owned.
 * Singles (garments + apron + umbrella + journal +
 * clay jar + grimoire): held → already-owned. Worn ⊆
 * carried (wear never removes), and a dropped
 * garment's worn flag grants nothing, so inventory
 * presence is the ownership source. The journal is
 * listed because the name-chain design implies ONE
 * (names live in it; a second would split the record
 * — DEV's call, 2026-10-30). The GRIMOIRE is listed
 * on the same ground (Adam, 2026-10-31): one book of
 * workings, bound to its journal — a second would
 * split that too; the founding-era unlisted precedent
 * ends here. The writing desk stays UNLISTED (a
 * second camp legitimately wants a second desk).
 * Everything else (placed structures, consumables,
 * materials, and the desk — the one unlisted single)
 * → available (multiples allowed or flagged for pin).
 */
export function craftOwnershipStatus(
  recipe: Recipe,
  inventory: CraftingInventory,
): CraftOwnership {
  const output = recipe.output.item;

  // Tool ladder.
  const rung = TOOL_MAPPING[output]?.stage;
  if (rung !== undefined) {
    const ownedItem = ownedToolItem(inventory);
    if (ownedItem === 'none') {
      return 'available';
    }
    if (output === ownedItem) {
      return 'already-owned';
    }
    const ownedRung = TOOL_MAPPING[ownedItem].stage;
    if (rung < ownedRung) {
      return 'superseded';
    }
    if (rung === ownedRung) {
      const predecessors =
        recipe.upgradeFrom === undefined
          ? []
          : Array.isArray(recipe.upgradeFrom)
            ? recipe.upgradeFrom
            : [recipe.upgradeFrom];
      return predecessors.includes(ownedItem) ? 'available' : 'superseded';
    }
    return 'available';
  }

  // Basket ladder.
  if (output === ITEMS.largeBasket) {
    return inventory.count(ITEMS.largeBasket) >= 1
      ? 'already-owned'
      : 'available';
  }
  if (output === ITEMS.smallBasket) {
    if (inventory.count(ITEMS.largeBasket) >= 1) {
      return 'superseded';
    }
    return inventory.count(ITEMS.smallBasket) >= 1
      ? 'already-owned'
      : 'available';
  }

  // Singles: garments + apron + umbrella + journal + clay jar + grimoire.
  const isSingle =
    output === ITEMS.apron ||
    output === ITEMS.umbrella ||
    output === ITEMS.journal ||
    output === ITEMS.clayJar ||
    output === ITEMS.grimoire ||
    GARMENTS.some((g) => g.item === output);
  if (isSingle) {
    // The clay jar has TWO forms (empty / filled with water):
    // ownership counts either form, or a filled jar would leak
    // a second jar through the listing.
    const forms =
      output === ITEMS.clayJar
        ? [ITEMS.clayJar, ITEMS.waterJar]
        : [output];
    const held = forms.reduce(
      (n, form) => n + inventory.count(form),
      0,
    );
    return held >= 1 ? 'already-owned' : 'available';
  }

  return 'available';
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function missingFor(
  ingredients: Ingredient[],
  inventory: CraftingInventory,
): MissingIngredient[] {
  const missing: MissingIngredient[] = [];
  for (const ingredient of ingredients) {
    const held = inventory.count(ingredient.item);
    if (held < ingredient.quantity) {
      missing.push({ ...ingredient, held });
    }
  }
  return missing;
}

/**
 * Pure check: can this recipe be crafted from this inventory, at this
 * station context? Never mutates the inventory. A recipe stating
 * requiresCreek mismatches unless nearCreek is true; a null
 * nearCreek leaves the creek gate off (transitional — see
 * Recipe.requiresCreek).
 */
export function canCraft(
  recipe: Recipe,
  inventory: CraftingInventory,
  station: StationContext = null,
  nearCreek: boolean | null = null,
  site: SiteFacts | null = null,
): CanCraftResult {
  const missingIngredients = missingFor(recipe.ingredients, inventory);
  const missingRequirements = recipe.requires
    ? missingFor(recipe.requires, inventory)
    : [];

  let missingUpgradeFrom: ItemId[] = [];
  if (recipe.upgradeFrom !== undefined) {
    const predecessors = Array.isArray(recipe.upgradeFrom)
      ? recipe.upgradeFrom
      : [recipe.upgradeFrom];
    const heldAny = predecessors.some(
      (item) => inventory.count(item) >= 1,
    );
    if (!heldAny) {
      missingUpgradeFrom = predecessors;
    }
  }

  // Owned-tool-stage rule: a stated requiresToolStage reads the
  // owned stage from the inventory (owned-tool.ts) — never a
  // literal item, so upgrading past the required tool cannot lock
  // the recipe out. Unstated means no stage requirement.
  const heldStage = ownedStage(inventory);
  const toolStageShortfall =
    recipe.requiresToolStage !== undefined &&
    heldStage < recipe.requiresToolStage
      ? { required: recipe.requiresToolStage, held: heldStage }
      : undefined;

  // Station rule: unstated station passes anywhere; 'hand' passes
  // anywhere (including null); any other stated station must match.
  const stationMismatch =
    recipe.station !== undefined &&
    recipe.station !== 'hand' &&
    station !== recipe.station;

  // Creek rule: a stated requiresCreek mismatches only when the
  // shell positively says not near a creek. Null input leaves
  // the gate off (transitional — see Recipe.requiresCreek).
  const creekMismatch =
    recipe.requiresCreek === true && nearCreek === false;

  // Site rule (fork B + the trap table): a stated requiresSite
  // mismatches only when the shell positively supplies where
  // she stands and she stands wrong for it — 'in-water' wants
  // inWater true, 'dry-land' wants it false. Null input leaves
  // the gate off (transitional — see Recipe.requiresSite).
  // The CRAFT-side check bites only where craft IS placement
  // (placesTrap, the site-built two); a carryable trap's site
  // is read at placement by its grant, never here, or the
  // menu would refuse a weir's craft on dry land it is only
  // being carried across.
  const siteMismatch =
    site !== null &&
    recipe.placesTrap === true &&
    recipe.requiresSite !== undefined &&
    (recipe.requiresSite === 'in-water' ? !site.inWater : site.inWater);

  // No-recraft ownership: an already-owned or superseded
  // recipe is not craftable, whatever the materials say.
  const ownership = craftOwnershipStatus(recipe, inventory);

  const ok =
    missingIngredients.length === 0 &&
    missingRequirements.length === 0 &&
    missingUpgradeFrom.length === 0 &&
    toolStageShortfall === undefined &&
    !stationMismatch &&
    !creekMismatch &&
    !siteMismatch &&
    ownership === 'available';

  return {
    ok,
    missingIngredients,
    missingRequirements,
    missingUpgradeFrom,
    toolStageShortfall,
    stationMismatch,
    creekMismatch,
    siteMismatch,
    requiredSite: recipe.requiresSite,
    requiredStation: recipe.station,
    ownership,
  };
}

/** Convenience boolean wrapper around canCraft. */
export function canCraftSimple(
  recipe: Recipe,
  inventory: CraftingInventory,
  station: StationContext = null,
): boolean {
  return canCraft(recipe, inventory, station).ok;
}

// ---------------------------------------------------------------------------
// Crafting
// ---------------------------------------------------------------------------

/**
 * Craft one unit of the recipe's output.
 *
 * Atomic: the check runs first, and nothing is consumed or produced
 * unless the check passes. On failure it throws an Error naming the
 * first shortfall (use canCraft for the full breakdown, e.g. for UI).
 *
 * What is consumed: every ingredient, plus 1 of the upgrade
 * predecessor (for upgrade recipes — the tool you already have is
 * transformed, not duplicated). What is NOT consumed: `requires`
 * items (e.g. the whetstone river stone: present, kept).
 *
 * Returns the output (item + quantity) that was added to inventory.
 */
export function craft(
  recipe: Recipe,
  inventory: CraftingInventory,
  station: StationContext = null,
): { item: ItemId; quantity: number } {
  const check = canCraft(recipe, inventory, station);
  if (!check.ok) {
    if (check.ownership !== 'available') {
      throw new Error(
        `Cannot craft ${recipe.name}: ` +
          `${CRAFT_OWNERSHIP_LABELS[check.ownership]}.`,
      );
    }
    if (check.stationMismatch) {
      throw new Error(
        `Cannot craft ${recipe.name}: requires station ` +
          `${check.requiredStation}, but crafting at ${station ?? 'none'}.`,
      );
    }
    const firstMissing = check.missingIngredients[0];
    if (firstMissing) {
      throw new Error(
        `Cannot craft ${recipe.name}: need ${firstMissing.quantity} ` +
          `${firstMissing.item}, have ${firstMissing.held}.`,
      );
    }
    if (check.missingUpgradeFrom.length > 0) {
      throw new Error(
        `Cannot craft ${recipe.name}: need one of ` +
          `${check.missingUpgradeFrom.join(' or ')} to upgrade from.`,
      );
    }
    const firstRequirement = check.missingRequirements[0];
    if (firstRequirement) {
      throw new Error(
        `Cannot craft ${recipe.name}: requires ${firstRequirement.quantity} ` +
          `${firstRequirement.item} present (not consumed), have ` +
          `${firstRequirement.held}.`,
      );
    }
    if (check.toolStageShortfall) {
      throw new Error(
        `Cannot craft ${recipe.name}: requires owned tool stage ` +
          `${check.toolStageShortfall.required} or better, have stage ` +
          `${check.toolStageShortfall.held}.`,
      );
    }
    throw new Error(`Cannot craft ${recipe.name}: check failed.`);
  }

  for (const ingredient of recipe.ingredients) {
    inventory.remove(ingredient.item, ingredient.quantity);
  }

  if (recipe.upgradeFrom !== undefined) {
    const predecessors = Array.isArray(recipe.upgradeFrom)
      ? recipe.upgradeFrom
      : [recipe.upgradeFrom];
    // Either/or: consume the predecessor the player actually holds.
    // The check above guarantees at least one is held.
    const held = predecessors.find(
      (item) => inventory.count(item) >= 1,
    );
    if (held !== undefined) {
      inventory.remove(held, 1);
    }
  }

  inventory.add(recipe.output.item, recipe.output.quantity);
  return { ...recipe.output };
}

// ---------------------------------------------------------------------------
// Test / wiring adapter only — NOT the inventory system
// ---------------------------------------------------------------------------

/**
 * Minimal in-memory CraftingInventory backed by a Map. For tests and
 * wiring experiments only: no capacity, no slots, no weight, no
 * persistence. The real inventory system replaces this, satisfying the
 * same interface.
 */
export function createSimpleInventory(
  initial: Record<string, number> = {},
): CraftingInventory {
  const counts = new Map<string, number>();
  for (const [item, quantity] of Object.entries(initial)) {
    if (quantity > 0) {
      counts.set(item, quantity);
    }
  }
  return {
    count(item: ItemId): number {
      return counts.get(item) ?? 0;
    },
    add(item: ItemId, quantity: number): void {
      if (quantity <= 0) {
        throw new Error('add quantity must be positive.');
      }
      counts.set(item, (counts.get(item) ?? 0) + quantity);
    },
    remove(item: ItemId, quantity: number): void {
      if (quantity <= 0) {
        throw new Error('remove quantity must be positive.');
      }
      const held = counts.get(item) ?? 0;
      if (held < quantity) {
        throw new Error(
          `Cannot remove ${quantity} ${item}: only ${held} held.`,
        );
      }
      const remaining = held - quantity;
      if (remaining === 0) {
        counts.delete(item);
      } else {
        counts.set(item, remaining);
      }
    },
  };
}
