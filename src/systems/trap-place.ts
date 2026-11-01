// CARRYABLE TRAPS — PLACE + PICK UP (the trap table,
// Adam, 2026-11-01: 'you did the trap table justice').
//
// Three traps are CARRYABLE — pot-trap, snare,
// fish-weir: crafted by hand anywhere into the pack,
// carried, and SET later under a Place verb; a set one
// picks back up into the pack. The other two are
// SITE-BUILT (deadfall, pitfall): their craft is their
// placement, and the carried verbs refuse them — the
// pitfall's removal is its fill (pitfall.ts); the
// deadfall's is the DISMANTLE below (Adam via DEV,
// 2026-11-01): taken apart where it stands, yields
// nothing — the logs were never hers to keep, she
// only rigged found weight.
//
// This file is the GRANTS (the desk/cauldron idiom:
// outcome records, validate before mutating, failure
// touches nothing). The shell composes: on a place
// success it calls trapState.placeTrap(type, x, z) —
// the one and only placer (single-caller rule, the
// craft precedent) — and on a pick-up success it calls
// the trap state's removal (Background's primitive).
// Systems never places, removes, or emits.
//
// THE SITE RULE lives in the recipe data
// (Recipe.requiresSite — the one source): the
// site-built two read it at craft (crafting-execution),
// the carryable three read it HERE, at placement,
// where they meet the ground. Facts arrive as input
// (SiteFacts — where she stands, from the water
// adapter); a null input leaves the gate OFF, the
// standing transitional law of every site gate.
//
// NO HUNGER GATE on either verb: carrying work, like
// drop/pickup (the desk precedent) — the crafts that
// MAKE the traps keep whatever gates crafts carry.

import {
  ITEMS,
  RECIPES,
  effectiveInWater,
  type SiteFacts,
} from './recipes';
import type { PersonalInventory } from './inventory';

/** The carryable three, by trap type (== recipe id == item id). */
export const CARRYABLE_TRAPS: readonly string[] = [
  ITEMS.potTrap,
  ITEMS.snare,
  ITEMS.fishWeirTrap,
];

/** True when this trap type has a carried life. */
export function isCarryableTrap(trapType: string): boolean {
  return CARRYABLE_TRAPS.includes(trapType);
}

/** Place outcome. On success the shell places via trapState. */
export type PlaceCarriedTrapOutcome =
  | { placed: true; type: string }
  | { placed: false; reason: string };

/**
 * Set one carried trap where she stands: validate the
 * type is carryable, the trap is carried, and the
 * site (when facts are supplied) matches the recipe's
 * stated requiresSite; then consume one from the pack.
 * The refusal copy is DRAFT for the pin pass.
 */
export function placeCarriedTrap(
  inventory: PersonalInventory,
  trapType: string,
  site: SiteFacts | null = null,
): PlaceCarriedTrapOutcome {
  if (!isCarryableTrap(trapType)) {
    return {
      placed: false,
      reason: 'That trap is built where it stands — it is never carried.',
    };
  }
  if (inventory.count(trapType) <= 0) {
    return { placed: false, reason: 'No such trap carried.' };
  }
  const recipe = RECIPES.find((candidate) => candidate.id === trapType);
  if (site !== null && recipe?.requiresSite !== undefined) {
    if (recipe.requiresSite === 'in-water' && !effectiveInWater(site)) {
      return {
        placed: false,
        reason: 'Set standing in the water — step into the creek first.',
      };
    }
    if (recipe.requiresSite === 'dry-land' && effectiveInWater(site)) {
      return {
        placed: false,
        reason: 'Set on dry ground — step out of the water first.',
      };
    }
  }
  inventory.remove(trapType, 1);
  return { placed: true, type: trapType };
}

/** Pick-up outcome. `granted` is 1 on success, 0 when the pack refused. */
export type PickupTrapOutcome =
  | { picked: true; granted: 1 }
  | { picked: false; reason: string };

/**
 * Pick a set carryable trap back up into the pack.
 * Granted through addPartial: a pack that cannot take
 * its weight grants 0 and refuses — the trap STAYS
 * set, and the shell removes it from trap state only
 * on a successful pick-up. Site-built types refuse
 * (the pitfall fills in; see the header).
 */
export function pickupTrap(
  inventory: PersonalInventory,
  trapType: string,
): PickupTrapOutcome {
  if (!isCarryableTrap(trapType)) {
    return {
      picked: false,
      reason: 'That trap is built where it stands — it cannot be picked up.',
    };
  }
  const grant = inventory.addPartial(trapType, 1);
  if (grant.granted <= 0) {
    return { picked: false, reason: 'No room in the pack for it.' };
  }
  return { picked: true, granted: 1 };
}

/** Dismantle outcome. On success the shell removes via removeTrap. */
export type DismantleTrapOutcome =
  | { dismantled: true; type: string }
  | { dismantled: false; reason: string };

/**
 * Dismantle a set DEADFALL where it stands (Adam via
 * DEV, 2026-11-01): removed, yields NOTHING — the logs
 * were never hers to keep, she only rigged found
 * weight. State-blind by design (the grant does not
 * know the trap's catch — a catch held in a trap is
 * collected first or lost with it; that composition
 * is the shell's verb order, as with the fill), no
 * inventory contact, no gate. Every other type
 * refuses toward its own removal: the carryable
 * three pick up, the pitfall fills in.
 */
export function dismantleTrap(trapType: string): DismantleTrapOutcome {
  if (trapType === ITEMS.pitfall) {
    return {
      dismantled: false,
      reason: 'A pitfall is filled in, not dismantled.',
    };
  }
  if (isCarryableTrap(trapType)) {
    return {
      dismantled: false,
      reason: 'That trap picks up — it is carried, not dismantled.',
    };
  }
  if (trapType !== ITEMS.deadfall) {
    return { dismantled: false, reason: 'Not a trap she can take apart.' };
  }
  return { dismantled: true, type: trapType };
}
