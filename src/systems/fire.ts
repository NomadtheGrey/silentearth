/**
 * Silent Earth — fire + open-fire cooking (player-systems lane,
 * MVP round).
 *
 * PINNED (Adam, 2026-10-26, and earlier fire-ladder rulings):
 * - Cooking is OPEN-FIRE: on a stick, or fire-buried — NOT pot
 *   cooking. The cook() method below takes 'stick' | 'buried'
 *   only; there is no pot method to pass, and pot cooking is
 *   not a transformation in this module.
 * - Acorns are COOK-REQUIRED: raw acorns must still be refused
 *   by eat() (see hunger.ts) — cooking is the step that makes
 *   them edible. Cooked acorns are THIS module's output.
 * - Conversion PRESERVES quantity (no magic shrinkage): cooking
 *   N raw acorns yields exactly N cooked acorns. The same rule
 *   holds for any future cookable added to the table.
 * - Fire lighting: flint = fast, sticks/friction = slow
 *   (Adam: 20–30 s of rub). The lighting cost and timing live
 *   here, as lane-decided starting tunables (flagged below).
 * - Fire ladder context (not re-decided here): campfire → hearth
 *   (better/more food from cooking) → kiln. V1
 *   cooking is UNIFORM across fire kinds: a hearth cooking
 *   bonus is NOT modelled yet (flagged future hook), so a hearth
 *   fire cooks exactly like a campfire fire in v1.
 *
 * FUEL / DURATION — OPEN, with a v1 default CHOSEN (not a
 * ruling): Adam's brief leaves fuel/duration open and allows a
 * simple lit-while-cooking default. That is what v1 does: a lit
 * fire stays lit until extinguish() is called (wiring or a later
 * weather effect may extinguish it). No fuel is consumed, no
 * duration is tracked, and lighting does not burn fuel. If Adam
 * wants fuel (wood over time, a burn-down clock), that is a
 * later addition on top of this state, not a correction to it.
 *
 * CANDLE FLAG — DO NOT ASSUME (Adam's brief, explicit): she
 * walks around with a candle (avatar flame). This module does
 * NOT assume the candle lights fires or cooks: there is no
 * candle lighting method, and no cook path takes a candle.
 * Candle = light only, unless Adam rules it a fire-starter.
 * That call is flagged here and in the landing report; the code
 * invents nothing about it either way.
 *
 * WHAT A FIRE IS HERE: FireState is one fire's state (a campfire
 * or hearth the player built and placed — placement itself is
 * Background's entity side, not modelled here). Wiring creates
 * one FireState per placed fire, calls light() + tick() as the
 * player works the lighting, and passes the lit fire to cook().
 * Cooking does not use the crafting engine: cooking is not a
 * craft (see crafting-execution.ts docs), so cook() lives here,
 * not in RECIPES.
 */

import type { CraftingInventory } from './crafting';
import { ITEMS, type ItemId } from './recipes';
import { normalizeItemId } from './inventory';

// ---------------------------------------------------------------------------
// Lighting — lane-decided starting tunables (NOT pinned)
// ---------------------------------------------------------------------------

export type LightingMethod = 'flint' | 'sticks';

/**
 * Seconds to light, by method. LANE-DECIDED: flint 3 s (fast —
 * click-click-click-WOOF), sticks 25 s (inside Adam's 20–30 s
 * rub). For Adam's pin pass.
 */
export const LIGHTING_SECONDS: Readonly<Record<LightingMethod, number>> = {
  flint: 3,
  sticks: 25,
};

/**
 * Lighting costs, by method. LANE-DECIDED: flint requires a
 * carried flint item, NOT consumed (kept, like the river-stone
 * whetstone precedent); sticks/friction consumes 1 dry-kindling
 * (Adam, 2026-10-26: kindling is made from snap wood, 2 per
 * snap wood, by hand — recipes.ts). Raw snap-wood NO LONGER
 * lights a fire: friction lighting needs a carried kindling
 * item. That is the rule's natural consequence, flagged for
 * Adam's pin pass (he may overrule it, e.g. accept either).
 * For Adam's pin pass.
 */
export const LIGHTING_COST_ITEM: Readonly<
  Record<LightingMethod, ItemId | null>
> = {
  flint: ITEMS.flint,
  sticks: ITEMS.dryKindling,
};

export const LIGHTING_COST_CONSUMED: Readonly<
  Record<LightingMethod, boolean>
> = {
  flint: false,
  sticks: true,
};

// ---------------------------------------------------------------------------
// Cookable transformations — quantity preserved, always
// ---------------------------------------------------------------------------

/** Cooked acorns: the fire-system output (UPPER_SNAKE, like all foods). */
export const FOOD_COOKED_ACORNS: ItemId = 'COOKED_ACORNS';

/**
 * Raw → cooked, 1:1, no shrinkage, ever. Acorns are the only
 * cookable in v1; a future cookable joins this table (and, if it
 * is eaten raw today, its eat() handling must change with it —
 * see hunger.ts).
 */
export const COOK_TRANSFORMATIONS: Readonly<Record<string, ItemId>> = {
  ACORNS: FOOD_COOKED_ACORNS,
};

/**
 * The raw key in COOK_TRANSFORMATIONS matching an item in either
 * spelling (harvest 'ACORNS' or normalized 'acorns' — see
 * inventory.ts). Undefined when the item is not cookable.
 */
function cookableRaw(item: ItemId): string | undefined {
  const wanted = normalizeItemId(item);
  return Object.keys(COOK_TRANSFORMATIONS).find(
    (raw) => normalizeItemId(raw) === wanted,
  );
}

/** True when the item cooks (either spelling). */
export function isCookable(item: ItemId): boolean {
  return cookableRaw(item) !== undefined;
}

/**
 * Cooked form of a cookable item (either spelling in, the
 * table's cooked constant out — inventory.add normalizes the
 * stored stack, so the stored form is always normalized).
 */
export function cookedForm(item: ItemId): ItemId | undefined {
  const raw = cookableRaw(item);
  return raw === undefined ? undefined : COOK_TRANSFORMATIONS[raw];
}

// ---------------------------------------------------------------------------
// Fire state
// ---------------------------------------------------------------------------

export type FireStatus = 'unlit' | 'lighting' | 'lit';

export class FireState {
  private status: FireStatus = 'unlit';
  private secondsRemaining = 0;

  /** Current status. */
  fireStatus(): FireStatus {
    return this.status;
  }

  /** True only once lighting has completed. */
  get lit(): boolean {
    return this.status === 'lit';
  }

  /** Seconds of lighting left (0 unless currently lighting). */
  lightingRemaining(): number {
    return this.status === 'lighting' ? this.secondsRemaining : 0;
  }

  /**
   * Begin lighting with a method. Validates the cost BEFORE
   * consuming anything (a failed light touches nothing), then
   * consumes the sticks cost when the method consumes. A lit
   * fire cannot be re-lit; an in-progress lighting restarts
   * with the new method (the old attempt's sticks cost is not
   * refunded — it was kindling spent, not a deposit).
   */
  light(method: LightingMethod, inventory: CraftingInventory): void {
    if (this.status === 'lit') {
      throw new Error('Fire is already lit.');
    }
    const costItem = LIGHTING_COST_ITEM[method];
    if (costItem !== null && inventory.count(costItem) < 1) {
      throw new Error(
        `Cannot light a fire with ${method}: no ${costItem} carried.`,
      );
    }
    if (costItem !== null && LIGHTING_COST_CONSUMED[method]) {
      inventory.remove(costItem, 1);
    }
    this.status = 'lighting';
    this.secondsRemaining = LIGHTING_SECONDS[method];
  }

  /** Advance lighting by real seconds; completes to lit at 0. */
  tick(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error('Tick seconds must be a finite non-negative number.');
    }
    if (this.status !== 'lighting') {
      return;
    }
    this.secondsRemaining = Math.max(0, this.secondsRemaining - seconds);
    if (this.secondsRemaining === 0) {
      this.status = 'lit';
    }
  }

  /**
   * Put the fire out. A later weather effect or wiring action
   * may call this; v1 itself never extinguishes a lit fire on
   * its own (see the fuel/duration note in the header).
   */
  extinguish(): void {
    this.status = 'unlit';
    this.secondsRemaining = 0;
  }
}

// ---------------------------------------------------------------------------
// Cooking
// ---------------------------------------------------------------------------

export type CookMethod = 'stick' | 'buried';

export interface CookResult {
  raw: ItemId;
  cooked: ItemId;
  count: number;
  method: CookMethod;
}

/**
 * Cook at a lit open fire. Checks before consuming anything:
 * the fire must be lit, the item must be cookable, and the
 * count must be carried — a failed cook touches nothing.
 * Quantity is PRESERVED: N raw in, N cooked out, by removal
 * then addition (net-zero, so a full pack still cooks — the
 * removal frees exactly the room the cooked items need).
 * Cooking is not a craft and takes no station argument: the lit
 * fire IS the context. No pot method exists (see the header).
 */
export function cook(
  fire: FireState,
  inventory: CraftingInventory,
  item: ItemId,
  count = 1,
  method: CookMethod = 'stick',
): CookResult {
  if (!fire.lit) {
    throw new Error('Cannot cook: the fire is not lit.');
  }
  const cooked = cookedForm(item);
  if (cooked === undefined) {
    throw new Error(`Cannot cook ${item}: not a cookable food.`);
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Cook count must be a positive integer.');
  }
  if (inventory.count(item) < count) {
    throw new Error(
      `Cannot cook ${count} ${item}: only ${inventory.count(item)} carried.`,
    );
  }
  inventory.remove(item, count);
  inventory.add(cooked, count);
  return { raw: item, cooked, count, method };
}
