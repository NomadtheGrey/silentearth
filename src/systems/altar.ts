// RITUAL ALTAR — PLACEABLE ONLY (Adam, DEV chat 2026-10-27,
// "Let's make these items placeable in game, visible").
//
// SCOPE, stated plainly: placeable + visible ONLY. This
// file is the PLACE GRANT (craft -> carried item -> Place
// consumes, houses/fires pattern) + the save shape's
// companion, NOT the ritual system. RITUALS THEMSELVES
// ARE NOT IN THIS ORDER — what happens at a stump/altar
// is still undesigned, so no ritual actions are invented
// here (no circumstances, no effects, no offerings).
//
// WHAT THIS ORDER BUILDS (standalone placeable, the
// no-stump shape): a made ritual site, built where she
// stands, for no-stump areas. Moss / salt / bone dressing
// + focus are NOT in the recipe (later dressing, flagged
// — do not add them). Upgrade tiers are NOT built
// (Adam's "altar upgrade" meaning resolved elsewhere: the
// STUMP is the multipurpose altar + optional workshop
// upgrade, PINNED — the made altar stands beside it).
//
// STUMP: NO stump code change here (pinned: no stump
// change until rituals land — the stump's altar role
// activates with rituals, which are still undesigned).
// Stump and made altar do the SAME rituals (pinned) —
// one ritual set, two sites — but that set does not
// exist yet, so nothing here branches on site.
//
// LANE BOUNDARY (torch precedent): Systems owns ONLY the
// recipe (recipes.ts) + the place grant below + the save
// shape (save.ts SavedAltar, trap-save pattern: format
// now, App wiring later). Background owns the placed-
// altar entity + its visible graphic (flat-stone base +
// wood frame + clay bowl draft suggestion — must read as
// altar, not house/fire). UI owns the Place row button +
// placed-altar marker/chip (label minimum; no invented
// ritual actions) + App saveNow / boot restore wiring.
// The shell hands placeAltar's record to Background's
// place call, exactly as torches hand theirs.
//
// NO HUNGER GATE (lane call, flagged, torch precedent):
// place is an inventory <-> world move, like drop/pickup
// — not a build. Placing an altar is not crafting it
// (crafting stays hunger-gated through executeCraft).
//
// NO PICKUP (not in this brief, flagged follow-up): only
// the place direction is built. Whether she can ever
// move / remove a placed altar is Adam's word later.
//
// QUANTITIES (lane call, flagged for pin pass): one altar
// per press (V1 drop precedent: one per press). Position
// arrives as params — systems never knows where she is
// (piles precedent).
//

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';

/**
 * A placed altar, as handed to Background's place call.
 * Singular by definition: one press places one altar.
 * `item` is always 'altar' (see rules above).
 */
export interface PlacedAltar {
  item: string;
  x: number;
  z: number;
}

/**
 * Place outcome. `altar` is the record the shell hands to
 * Background's place call; `reason` is player-facing on
 * failure only. Failure touches nothing.
 */
export type PlaceAltarOutcome =
  | { placed: true; altar: PlacedAltar }
  | { placed: false; reason: string };

/**
 * Move one carried altar out of the inventory into a
 * placed-altar record at (x, z). Validates before
 * mutating (finite position, altar carried), so a failed
 * place consumes nothing.
 */
export function placeAltar(
  inventory: PersonalInventory,
  x: number,
  z: number,
): PlaceAltarOutcome {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { placed: false, reason: 'Invalid position.' };
  }
  if (inventory.count(ITEMS.altar) <= 0) {
    return { placed: false, reason: 'No altar carried.' };
  }
  inventory.remove(ITEMS.altar, 1);
  return { placed: true, altar: { item: ITEMS.altar, x, z } };
}
