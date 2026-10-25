/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — UI presentation types (UI lane, first UI landing).
 *
 * Props-only. These types describe what a caller shows; they own no game
 * state, run no game logic, and import nothing from src/game, src/data,
 * or any engine code. Systems (recipes, needs, inventory contents) arrive
 * later from the Systems lane as props — nothing here invents them.
 *
 * NOT wired into App yet. Wiring happens after landing 1 lands, in a
 * separate step. This directory is new files only.
 */

/** Camera perspectives. Values match the redesign's switchable camera. */
export type CameraPerspective = 'first' | 'third';

/**
 * One slot in the HUD needs row.
 *
 * PLACEHOLDER-FRIENDLY: survival systems do not exist yet, and no meter
 * Adam has not ruled is invented here. A caller passes only slots a real
 * system provides; an empty list renders the "awaiting systems" note.
 * `label` is caller-supplied display text, `detail` is caller-supplied
 * secondary text (also optional). This component never computes a value.
 */
export interface NeedSlot {
  id: string;
  label: string;
  detail?: string;
}

/** One entry in the inventory panel. Quantity/capacity text is caller-supplied. */
export interface InventoryItem {
  id: string;
  name: string;
  /** Caller-supplied, e.g. "3". Never computed here. */
  quantityText?: string;
  /** Caller-supplied short note, e.g. a category or origin. Optional. */
  note?: string;
}

/** One ingredient line in a crafting recipe. Amounts are caller-supplied. */
export interface RecipeIngredient {
  name: string;
  /** Caller-supplied, e.g. "2 / 3". Never computed here. */
  amountText?: string;
}

/**
 * One entry in the crafting menu.
 *
 * PLACEHOLDER-FRIENDLY: recipes arrive from the Systems lane. This type
 * carries display text and a caller-decided `canCraft` flag only — the
 * panel never checks an inventory, never decides craftability itself.
 */
export interface CraftingRecipe {
  id: string;
  name: string;
  description?: string;
  ingredients: RecipeIngredient[];
  canCraft: boolean;
  /** Why crafting is or is not available, in the caller's words. Optional. */
  availabilityNote?: string;
}
