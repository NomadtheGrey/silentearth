/**
 * Silent Earth — umbrella rain protection (player-systems lane).
 *
 * MECHANIC (Adam, 2026-10-26, via the umbrella brief):
 * - Rain protection 35% — a STARTING value for Adam's pin pass,
 *   not a pinned number. It lives as the single named constant
 *   UMBRELLA_RAIN_PROTECTION below so a pin-pass change touches
 *   one place.
 * - Protection applies when the umbrella is IN INVENTORY — no
 *   equip step, no worn slot, no held slot. Carrying = protected,
 *   in the owning=using spirit (owning the tool is sufficient to
 *   use it; owning the umbrella is sufficient to be sheltered by
 *   it). Carrying two umbrellas does not double the effect: the
 *   bonus applies once, like a gear bonus once per type.
 * - Stacking is MULTIPLICATIVE with worn clothes, on the rain
 *   axis only (the umbrella blocks rain, not wind, cold, or
 *   wet): final rain remaining = clothes rain remaining ×
 *   umbrella rain factor. Full kit (cloak + hat) rain remaining
 *   is 0.6 × 0.85 = 0.51 (49% protection); with the umbrella
 *   0.51 × 0.65 = 0.3315, i.e. ~67% protection — the brief's
 *   number, reproduced here as the check, not as a second
 *   constant.
 *
 * WHERE THE MATH LIVES (do NOT re-decide percentages):
 * Background's weather.ts owns GARMENT_PROTECTION, the
 * multiplicative stacking, and clothingRemaining(). This module
 * does not import it (lane boundary — systems mirrors game
 * shapes by literal, it does not import game modules) and does
 * not recompute clothes protection. It supplies the umbrella
 * half only: carriesUmbrella() and umbrellaRainFactor(), plus
 * applyUmbrellaToRainRemaining() for wiring that already holds
 * a clothes rain-remaining value. Wiring composes them:
 *   weather.clothingRemaining(worn).rain
 *     → applyUmbrellaToRainRemaining(that, inventory)
 *     → final rain remaining.
 * If Background prefers the umbrella inside weather.ts itself,
 * the contract to mirror is one line: rain remaining × 0.65
 * when an umbrella is carried, × 1 otherwise.
 *
 * COORDINATION SHAPE (no umbrella existed anywhere in the tree
 * when this landed — these ids ARE the contract):
 * - Item id: 'umbrella' (kebab-case systems vocabulary — the
 *   umbrella is crafted, not harvested, so it does not use the
 *   UPPER_SNAKE harvest vocabulary). Recipe id: 'umbrella'.
 * - Background (world graphic): key the graphic off item id
 *   'umbrella' (carried item; there is no worn/held presentation
 *   for it, since protection needs no equip step).
 * - UI (icon): key the inventory icon off item id 'umbrella'.
 *
 * CAPACITY NOTE: the umbrella is carried, not gear — it has no
 * capacity bonus and it COUNTS against personal capacity like
 * any ordinary item (it is not in CARRYING_GEAR, and wearing
 * does not apply — there is nothing to wear). That is
 * deliberate: shelter from rain costs a pack slot.
 */

import type { CraftingInventory } from './crafting';
import { ITEMS, type ItemId } from './recipes';

/** The umbrella item (see the coordination shape in the header). */
export const UMBRELLA_ITEM: ItemId = ITEMS.umbrella;

/**
 * Rain fraction blocked by a carried umbrella. STARTING VALUE
 * for Adam's pin pass (brief's 35%), NOT pinned.
 */
export const UMBRELLA_RAIN_PROTECTION = 0.35;

/** Rain remaining factor with a carried umbrella (1 − 0.35). */
export const UMBRELLA_RAIN_FACTOR = 1 - UMBRELLA_RAIN_PROTECTION;

/** True when the inventory carries at least one umbrella. */
export function carriesUmbrella(inventory: CraftingInventory): boolean {
  return inventory.count(UMBRELLA_ITEM) >= 1;
}

/**
 * Umbrella rain factor: 0.65 when carried, 1 otherwise.
 * Duplicates do not stack (one umbrella's worth, once).
 */
export function umbrellaRainFactor(inventory: CraftingInventory): number {
  return carriesUmbrella(inventory) ? UMBRELLA_RAIN_FACTOR : 1;
}

/**
 * Apply the umbrella to an already-computed clothes rain
 * remaining (e.g. weather.clothingRemaining(worn).rain):
 * multiplicative, rain axis only. Other elements pass through
 * untouched — callers apply this to the rain value alone.
 */
export function applyUmbrellaToRainRemaining(
  clothesRainRemaining: number,
  inventory: CraftingInventory,
): number {
  return clothesRainRemaining * umbrellaRainFactor(inventory);
}
