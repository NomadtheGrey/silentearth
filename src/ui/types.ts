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

import type { ReactNode } from 'react';

/** Camera perspectives. Values match the redesign's switchable camera. */
export type CameraPerspective = 'first' | 'third' | 'behind';

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
  /** Caller-supplied weight line, e.g. "1.5 lb" or "carried free". Never computed here. */
  weightText?: string;
  /** Caller-supplied short note, e.g. a category or origin. Optional. */
  note?: string;
  /** Caller-supplied glyph, rendered before the name. Optional. */
  icon?: ReactNode;
}

/**
 * One action in an in-place context menu. The label, hint, and
 * availability are caller-supplied; this type carries no logic.
 *
 * A kind-entry action (pile menu) carries arrows instead of
 * acting as a single button: the label names the kind, counts
 * carries its pile and carried quantities, and each arrow is
 * its own pressable action under its own id.
 */
export interface ContextAction {
  id: string;
  label: string;
  /** Short hint shown beside the label, if any. */
  hint?: string;
  /** Whether the action is currently unavailable, caller-decided. */
  disabled?: boolean;
  /** Why an action is unavailable, in the caller's words. Optional. */
  disabledNote?: string;
  /** Pile ×N · carried ×M counts for a kind-entry row, if any. */
  counts?: { pile: number; carried: number };
  /** Arrow buttons for a kind-entry row; when present the row renders arrows, not a text button. */
  arrows?: ContextActionArrow[];
}

/** One arrow button inside a kind-entry row. */
export interface ContextActionArrow {
  id: string;
  /** The glyph shown on the button (↑ ↑↑ ↓ ↓↓ for the pile menu). */
  glyph: string;
  /** Spoken label for the arrow; the glyph span itself is aria-hidden. */
  ariaLabel: string;
  /** Whether this arrow is currently unavailable, caller-decided. */
  disabled?: boolean;
}

/** Tone for object feedback text. Colours the chip only. */
export type FeedbackTone = 'gain' | 'info' | 'blocked';

/** One ingredient line in a crafting recipe. Amounts are caller-supplied. */
export interface RecipeIngredient {
  name: string;
  /** Caller-supplied, e.g. "2 / 3". Never computed here. */
  amountText?: string;
  /** Caller-supplied glyph, rendered before the name. Optional. */
  icon?: ReactNode;
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
  /** Caller-supplied glyph, rendered before the name. Optional. */
  icon?: ReactNode;
}
