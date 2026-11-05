// CRAFTED WORKSTATION — THE PLACEMENT HALF (the fix,
// 2026-11-05: Adam crafted a bench on the live build
// and found no Place in his pack — the recipe + item
// shipped in merge #79, the placement half never did;
// the only workbench in the world was the stump's
// addition. This file is that missing half.)
//
// SCOPE, stated plainly: placeable + carried, in the
// altar/desk idiom (desk.ts is the pattern throughout).
// This file is the PLACE GRANT (craft -> carried item
// -> Place consumes) + the save shape's companion
// (save.ts SavedCraftedWorkstation), NOT a station
// system. WHAT THE BENCH IS FOR — 'workstation'
// presence where no stump stands (its recipes' forks:
// the wheel and the loom build off it) — is the
// shell's station derivation reading the placed
// record, not a fact this grant keeps.
//
// LANE BOUNDARY (desk precedent): Systems owns ONLY
// the place grant below + the save shape (save.ts,
// trap-save pattern: format now, App wiring next).
// Background owns the placed-workstation ENTITY + its
// visible graphic (must read as a workbench) and the
// station-presence derivation off it. UI owns the
// Place row button + the placed-bench marker/chip +
// App saveNow / boot restore wiring. The shell hands
// placeWorkstation's record to Background's place
// call, exactly as desks hand theirs.
//
// NO HUNGER GATE (desk precedent): place is an
// inventory <-> world move, like drop/pickup — not a
// build. Placing a bench is not crafting it (crafting
// stays hunger-gated through executeCraft).
//
// NO PICKUP (desk precedent, flagged follow-up): only
// the place direction is built. Whether she can move
// a placed bench (the stump's bench rides the
// Trundle-Tool; this free-standing one has no such
// ruling yet) is Adam's word later — not assumed here.
// MULTIPLE benches are legitimate (the desk's logic:
// a second camp legitimately wants a second bench).
//
// QUANTITIES: one bench per press (desk precedent).
// Position arrives as params — systems never knows
// where she is (piles precedent).

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';

/**
 * A placed crafted workstation, as handed to
 * Background's place call. Singular by definition:
 * one press places one bench. `item` is always
 * 'crafted-workstation' (see rules above).
 */
export interface PlacedWorkstation {
  item: string;
  x: number;
  z: number;
}

/**
 * Place outcome. `workstation` is the record the shell
 * hands to Background's place call; `reason` is
 * player-facing on failure only. Failure touches
 * nothing.
 */
export type PlaceWorkstationOutcome =
  | { placed: true; workstation: PlacedWorkstation }
  | { placed: false; reason: string };

/**
 * Move one carried crafted workstation out of the
 * inventory into a placed-bench record at (x, z).
 * Validates before mutating (finite position, bench
 * carried), so a failed place consumes nothing.
 */
export function placeWorkstation(
  inventory: PersonalInventory,
  x: number,
  z: number,
): PlaceWorkstationOutcome {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { placed: false, reason: 'Invalid position.' };
  }
  if (inventory.count(ITEMS.craftedWorkstation) <= 0) {
    return { placed: false, reason: 'No crafted workstation carried.' };
  }
  inventory.remove(ITEMS.craftedWorkstation, 1);
  return {
    placed: true,
    workstation: { item: ITEMS.craftedWorkstation, x, z },
  };
}
