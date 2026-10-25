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

import {
  type CraftingStation,
  type Ingredient,
  type ItemId,
  type Recipe,
} from './recipes';

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
  /** True when the recipe states a station and the context mismatches. */
  stationMismatch: boolean;
  /** The station the recipe requires, when it states one. */
  requiredStation?: CraftingStation;
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
 * station context? Never mutates the inventory.
 */
export function canCraft(
  recipe: Recipe,
  inventory: CraftingInventory,
  station: StationContext = null,
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

  // Station rule: unstated station passes anywhere; 'hand' passes
  // anywhere (including null); any other stated station must match.
  const stationMismatch =
    recipe.station !== undefined &&
    recipe.station !== 'hand' &&
    station !== recipe.station;

  const ok =
    missingIngredients.length === 0 &&
    missingRequirements.length === 0 &&
    missingUpgradeFrom.length === 0 &&
    !stationMismatch;

  return {
    ok,
    missingIngredients,
    missingRequirements,
    missingUpgradeFrom,
    stationMismatch,
    requiredStation: recipe.station,
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
