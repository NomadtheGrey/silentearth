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
  /**
   * Caller-supplied title-row one-liner segment (FORMAT
   * PIN, Adam, 2026-10-29), e.g. "- 2 @ 0.1 lb each -
   * 0.2 lb": rides the name's line after the name. When
   * present it replaces the quantityText/weightText pair
   * in the personal rows' meta slot. Never computed here.
   */
  titleMeta?: string;
  /** Caller-supplied short note, e.g. a category or origin. Optional. */
  note?: string;
  /**
   * Caller-supplied sort category (inventory sorting,
   * 2026-10-31): the Grouped order's bucket for this item,
   * from the systems category table. Display data only —
   * the Grouped heading prints it verbatim. Optional.
   */
  category?: string;
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
  /**
   * Caller-composed counts line for a kind-entry row, rendered
   * instead of the structured pile counts when present (home
   * menu rows: "carried ×M · stored ×N" / "stored ×N ·
   * carried ×M"). Pile entries keep structured counts.
   */
  countsText?: string;
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
  /** The ingredient's item id, caller-supplied — the chain-craft button's target. Optional. */
  itemId?: string;
  /**
   * Caller-decided chain-craft flag (prerequisite crafting,
   * Adam 2026-10-31): a recipe chain exists that makes this
   * item AND she holds fewer than the open recipe needs. When
   * true (with an itemId and the menu's onCraftPrerequisite),
   * the row renders its Craft button. Decided by the caller —
   * the menu never checks recipes or counts itself. Optional.
   */
  chainCraftable?: boolean;
}

/**
 * One entry in the crafting menu.
 *
 * PLACEHOLDER-FRIENDLY: recipes arrive from the Systems lane. This type
 * carries display text and a caller-decided `canCraft` flag only — the
 * panel never checks an inventory, never decides craftability itself.
 * The optional ownership label ('Already Owned' / 'Superseded', from
 * Systems' CRAFT_OWNERSHIP_LABELS) renders under the name and replaces
 * the availability note when set.
 */
export interface CraftingRecipe {
  id: string;
  name: string;
  description?: string;
  /**
   * Housing ladder line (caller-supplied; the four house
   * recipes only), rendered under the description. A
   * truthful placement note — NOT a requirement: houses
   * upgrade in place or place on their own, and nothing
   * in the row is gated by it. Optional.
   */
  ladderLine?: string;
  ingredients: RecipeIngredient[];
  canCraft: boolean;
  /** Why crafting is or is not available, in the caller's words. Optional. */
  availabilityNote?: string;
  /**
   * No-recraft ownership label, caller-supplied from Systems'
   * CRAFT_OWNERSHIP_LABELS. When set, the row is disabled
   * and bottom-sorted, and this label replaces availabilityNote.
   * Optional.
   */
  disabledLabel?: string;
  /** Caller-supplied glyph, rendered before the name. Optional. */
  icon?: ReactNode;
}
