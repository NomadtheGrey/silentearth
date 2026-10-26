/**
 * Silent Earth — umbrella precipitation protection (player-systems lane).
 *
 * MECHANIC (Adam, 2026-10-26, REVISED — this revision SUPERSEDES
 * the 35% rain-only value from the earlier umbrella brief):
 * - Precipitation protection 60% — SUBSTANTIAL, covering rain +
 *   sleet/etc., not rain only. A STARTING value for Adam's pin
 *   pass, not a pinned number. It lives as the single named
 *   constant UMBRELLA_PRECIPITATION_PROTECTION below so a
 *   pin-pass change touches one place.
 * - Protection applies when the umbrella is IN INVENTORY — no
 *   equip step, no worn slot, no held slot. Carrying = protected,
 *   in the owning=using spirit (owning the tool is sufficient to
 *   use it; owning the umbrella is sufficient to be sheltered by
 *   it). Carrying two umbrellas does not double the effect: the
 *   bonus applies once, like a gear bonus once per type.
 * - Stacking is MULTIPLICATIVE with worn clothes, on the
 *   precipitation axis only (the umbrella blocks falling
 *   precipitation, not wind, cold, or ground wet): final
 *   precipitation remaining = clothes precipitation remaining ×
 *   umbrella precipitation factor. Full kit (cloak + hat) rain
 *   remaining is 0.6 × 0.85 = 0.51 (49% protection); with the
 *   umbrella 0.51 × 0.4 = 0.204, i.e. ~80% protection — the
 *   brief's number, reproduced here as the check, not as a
 *   second constant.
 *
 * WHAT "PRECIPITATION" MEANS IN TODAY'S WEATHER MODEL:
 * Background's weather.ts (the element vocabulary at this
 * landing) models elements 'rain' | 'wind' | 'cold' | 'wet' —
 * there is NO separate sleet element. Rain IS the precipitation
 * axis today: profile.rain is the 0..1 precipitation intensity
 * for a biome. So the umbrella factor applies to the rain
 * remaining, and it covers whatever precipitation that axis
 * carries — rain today, sleet and other falling forms if
 * Background later models them on (or alongside) that axis.
 * If a sleet element is ever split out, the same factor
 * applies to it too — the helper is named for precipitation,
 * not for rain, precisely so the wiring does not have to
 * change when the vocabulary grows.
 *
 * WHERE THE MATH LIVES (do NOT re-decide percentages):
 * Background's weather.ts owns GARMENT_PROTECTION, the
 * multiplicative stacking, and clothingRemaining(). This module
 * does not import it (lane boundary — systems mirrors game
 * shapes by literal, it does not import game modules) and does
 * not recompute clothes protection. It supplies the umbrella
 * half only: carriesUmbrella() and umbrellaPrecipitationFactor(),
 * plus applyUmbrellaToPrecipitationRemaining() for wiring that
 * already holds a clothes precipitation-remaining value. Wiring
 * composes them:
 *   weather.clothingRemaining(worn).rain
 *     → applyUmbrellaToPrecipitationRemaining(that, inventory)
 *     → final precipitation remaining.
 * If Background prefers the umbrella inside weather.ts itself,
 * the contract to mirror is one line: precipitation remaining
 * × 0.4 when an umbrella is carried, × 1 otherwise.
 *
 * COORDINATION SHAPE (no umbrella existed anywhere in the tree
 * when the item landed — these ids ARE the contract):
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
 * deliberate: shelter from precipitation costs a pack slot.
 */

import type { CraftingInventory } from './crafting';
import { ITEMS, type ItemId } from './recipes';

/** The umbrella item (see the coordination shape in the header). */
export const UMBRELLA_ITEM: ItemId = ITEMS.umbrella;

/**
 * Precipitation fraction blocked by a carried umbrella.
 * REVISED STARTING VALUE for Adam's pin pass (60%, superseding
 * the earlier 35% rain-only value), NOT pinned.
 */
export const UMBRELLA_PRECIPITATION_PROTECTION = 0.6;

/** Precipitation remaining factor with a carried umbrella (1 − 0.6). */
export const UMBRELLA_PRECIPITATION_FACTOR = 1 - UMBRELLA_PRECIPITATION_PROTECTION;

/** True when the inventory carries at least one umbrella. */
export function carriesUmbrella(inventory: CraftingInventory): boolean {
  return inventory.count(UMBRELLA_ITEM) >= 1;
}

/**
 * Umbrella precipitation factor: 0.4 when carried, 1 otherwise.
 * Duplicates do not stack (one umbrella's worth, once).
 */
export function umbrellaPrecipitationFactor(inventory: CraftingInventory): number {
  return carriesUmbrella(inventory) ? UMBRELLA_PRECIPITATION_FACTOR : 1;
}

/**
 * Apply the umbrella to an already-computed clothes
 * precipitation remaining (today: weather.clothingRemaining(worn).rain,
 * the precipitation axis — see the header's vocabulary note):
 * multiplicative, precipitation axis only. Other elements pass
 * through untouched — callers apply this to the precipitation
 * value alone.
 */
export function applyUmbrellaToPrecipitationRemaining(
  clothesPrecipitationRemaining: number,
  inventory: CraftingInventory,
): number {
  return clothesPrecipitationRemaining * umbrellaPrecipitationFactor(inventory);
}
