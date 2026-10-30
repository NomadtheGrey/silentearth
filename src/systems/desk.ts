// WRITING DESK — PLACEABLE ONLY (Adam's grimoire design
// turn, 2026-10-30: "Of course the grimoire needs a desk").
//
// SCOPE, stated plainly: placeable + carried ONLY, in
// the altar idiom (altar.ts is the pattern throughout).
// This file is the PLACE GRANT (craft -> carried item ->
// Place consumes) + the save shape's companion (save.ts
// SavedDesk), NOT the grimoire system. WHAT THE DESK IS
// FOR — the grimoire resides on it and functions while
// she's at the desk (Adam, pinned 2026-10-30) — arrives
// with the grimoire's design turn, so no desk actions
// are invented here (no open-the-book, no workings).
//
// LANE BOUNDARY (altar precedent): Systems owns ONLY
// the recipe (recipes.ts) + the place grant below +
// the save shape (save.ts SavedDesk, trap-save pattern:
// format now, App wiring later). Background owns the
// placed-desk entity + its visible graphic (must read
// as a desk). UI owns the Place row button + placed-
// desk marker/chip + App saveNow / boot restore wiring.
// The shell hands placeDesk's record to Background's
// place call, exactly as altars hand theirs.
//
// NO HUNGER GATE (altar precedent): place is an
// inventory <-> world move, like drop/pickup — not a
// build. Placing a desk is not crafting it (crafting
// stays hunger-gated through executeCraft).
//
// NO PICKUP (altar precedent, flagged follow-up): only
// the place direction is built. Whether she can ever
// move / remove a placed desk is Adam's word later.
// MULTIPLE desks are legitimate (crafting.ts leaves
// the desk unlisted, on the grimoire precedent: a
// second camp legitimately wants a second desk).
//
// QUANTITIES: one desk per press (altar precedent).
// Position arrives as params — systems never knows
// where she is (piles precedent).

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';

/**
 * A placed desk, as handed to Background's place call.
 * Singular by definition: one press places one desk.
 * `item` is always 'writing-desk' (see rules above).
 */
export interface PlacedDesk {
  item: string;
  x: number;
  z: number;
}

/**
 * Place outcome. `desk` is the record the shell hands
 * to Background's place call; `reason` is player-facing
 * on failure only. Failure touches nothing.
 */
export type PlaceDeskOutcome =
  | { placed: true; desk: PlacedDesk }
  | { placed: false; reason: string };

/**
 * Move one carried writing desk out of the inventory
 * into a placed-desk record at (x, z). Validates before
 * mutating (finite position, desk carried), so a failed
 * place consumes nothing.
 */
export function placeDesk(
  inventory: PersonalInventory,
  x: number,
  z: number,
): PlaceDeskOutcome {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { placed: false, reason: 'Invalid position.' };
  }
  if (inventory.count(ITEMS.writingDesk) <= 0) {
    return { placed: false, reason: 'No writing desk carried.' };
  }
  inventory.remove(ITEMS.writingDesk, 1);
  return { placed: true, desk: { item: ITEMS.writingDesk, x, z } };
}
