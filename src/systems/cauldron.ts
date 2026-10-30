// THE CAULDRON ON ITS HEARTH — PLACE + PICKUP GRANTS
// (Adam's ruling, 2026-10-30: the cauldron goes on the
// Hearth, and facing the cauldron is a different target
// from facing the hearth).
//
// SCOPE, stated plainly: this file is the PLACE /
// PICKUP GRANT pair + the save shape's companion
// (save.ts SavedCauldron), in the desk.ts idiom
// throughout — outcome records, validate before
// mutating, failure touches nothing. Systems owns ONLY
// this grant + the save shape. Background owns the
// placed-cauldron entity + its pot model + the
// cauldron as its own target kind (facing it is not
// facing the hearth). UI owns the place / pickup
// wiring. The shell hands placeCauldron's record to
// Background's place call, exactly as desks hand
// theirs, and removes the entity on a successful
// pickup.
//
// KEYED TO THE HEARTH: a placed cauldron belongs to
// exactly one hearth, named by Background's
// fire-entity id (hearthId, stored verbatim — the
// restore binding rides on it). One cauldron per
// hearth.
//
// WORLD FACTS ARRIVE AS INPUTS (the creek / station
// input-only idiom): whether the faced target is a
// hearth, whether it already bears a cauldron, and
// whether one is placed there are the shell's to
// certify from Background's state — Systems keeps no
// world record (desk precedent). The grant enforces
// the inventory side and the one-per-hearth rule
// against those inputs.
//
// NO HUNGER GATE (desk precedent): place / pickup is
// an inventory <-> world move, like drop/pickup — not
// a build.
//
// NO LIT GATE: she sets the pot on the hearth before
// she lights it. Whether the hearth burns is the
// station feed's concern (the 'cauldron' station
// context), never the grant's.
//
// PICKUP IS BUILT (a stated divergence from the
// desk / altar no-pickup precedent, per the brief):
// the cauldron travels between hearths. A pickup the
// pack cannot take REFUSES and the cauldron STAYS
// placed — it is never voided.

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';

/**
 * A placed cauldron, as handed to Background's place
 * call. Singular by definition: one press places one
 * cauldron on one hearth. `item` is always 'cauldron'.
 */
export interface PlacedCauldron {
  item: string;
  hearthId: string;
}

/**
 * Place outcome. `cauldron` is the record the shell
 * hands to Background's place call; `reason` is
 * player-facing on failure only. Failure touches
 * nothing.
 */
export type PlaceCauldronOutcome =
  | { placed: true; cauldron: PlacedCauldron }
  | { placed: false; reason: string };

/** Pickup outcome; `reason` on failure only. */
export type PickupCauldronOutcome =
  | { pickedUp: true }
  | { pickedUp: false; reason: string };

/**
 * Move one carried cauldron out of the inventory onto
 * the hearth named by `hearthId`. `hearthOccupied` is
 * the shell's certification that the faced hearth
 * already bears a cauldron. Validates before
 * mutating, so a failed place consumes nothing.
 */
export function placeCauldron(
  inventory: PersonalInventory,
  hearthId: string,
  hearthOccupied: boolean,
): PlaceCauldronOutcome {
  if (typeof hearthId !== 'string' || hearthId.length === 0) {
    return { placed: false, reason: 'No hearth there.' };
  }
  if (hearthOccupied) {
    return {
      placed: false,
      reason: 'That hearth already bears a cauldron.',
    };
  }
  if (inventory.count(ITEMS.cauldron) <= 0) {
    return { placed: false, reason: 'No cauldron carried.' };
  }
  inventory.remove(ITEMS.cauldron, 1);
  return {
    placed: true,
    cauldron: { item: ITEMS.cauldron, hearthId },
  };
}

/**
 * Return the cauldron placed on the hearth named by
 * `hearthId` to her pack. `cauldronPlaced` is the
 * shell's certification that one is there. A pack
 * that cannot take it refuses — the cauldron stays
 * placed, never voided.
 */
export function pickupCauldron(
  inventory: PersonalInventory,
  hearthId: string,
  cauldronPlaced: boolean,
): PickupCauldronOutcome {
  if (typeof hearthId !== 'string' || hearthId.length === 0) {
    return { pickedUp: false, reason: 'No hearth there.' };
  }
  if (!cauldronPlaced) {
    return {
      pickedUp: false,
      reason: 'No cauldron on that hearth.',
    };
  }
  const result = inventory.addPartial(ITEMS.cauldron, 1);
  if (result.granted < 1) {
    return {
      pickedUp: false,
      reason: 'Your pack is too full for the cauldron.',
    };
  }
  return { pickedUp: true };
}
