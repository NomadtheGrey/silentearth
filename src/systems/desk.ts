// WRITING DESK — PLACEABLE ONLY (Adam's grimoire design
// turn, 2026-10-30: "Of course the grimoire needs a desk").
//
// SCOPE, stated plainly: placeable + carried, in
// the altar idiom (altar.ts is the pattern throughout).
// This file is the PLACE GRANT (craft -> carried item ->
// Place consumes) + the save shape's companion (save.ts
// SavedDesk), NOT the grimoire system. WHAT THE DESK IS
// FOR — the grimoire resides on it and functions while
// she's at the desk (Adam, pinned 2026-10-30) — the
// SEAT arrived with the grimoire-on-desk design
// (accepted 2026-11-01, UI's E door): the seat/take
// grants below. The book's WORKINGS remain the later
// design turn, so no workings are invented here (no
// open-the-book beyond the seated state itself).
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
// the desk unlisted: a second camp legitimately
// wants a second desk).
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

// ---------------------------------------------------------------------------
// The seat (the grimoire-on-desk design, accepted
// 2026-11-01: UI's E door — 'Place grimoire' on a bare
// desk with the book carried, 'Take grimoire' on a
// seated one; E consumes the winner).
//
// The seated state rides the desk's OWN record
// (SavedDesk.grimoire, Background's desk entity) — one
// boolean, because the grimoire is a LISTED SINGLE:
// one book ever (the no-recraft law), so a desk holds
// THE grimoire or none, never a choice of books. The
// grants take a minimal desk record and mutate its
// flag; the shell passes whichever store holds its
// desks, Systems stays agnostic. Background dresses
// the visible book off the same flag.
//
// NO HUNGER GATE (the desk precedent): seat/take are
// inventory <-> world moves, like place itself.
// ---------------------------------------------------------------------------

/** The minimal desk record the seat grants read + write. */
export interface DeskSeat {
  grimoire?: boolean;
}

/** Seat outcome. Failure touches nothing. */
export type SeatGrimoireOutcome =
  | { seated: true }
  | { seated: false; reason: string };

/**
 * Seat the carried grimoire on this desk: refuses a
 * desk already holding it and hands that carry no
 * book, before touching anything; on success the book
 * leaves the pack and the desk's flag seats. A second
 * desk offers nothing to empty hands — the book is
 * where it is (the design's own sentence).
 */
export function seatGrimoire(
  inventory: PersonalInventory,
  desk: DeskSeat,
): SeatGrimoireOutcome {
  if (desk.grimoire === true) {
    return { seated: false, reason: 'The grimoire already rests here.' };
  }
  if (inventory.count(ITEMS.grimoire) <= 0) {
    return { seated: false, reason: 'No grimoire carried.' };
  }
  inventory.remove(ITEMS.grimoire, 1);
  desk.grimoire = true;
  return { seated: true };
}

/** Take outcome. `granted` is 1 on success. */
export type TakeGrimoireOutcome =
  | { taken: true; granted: 1 }
  | { taken: false; reason: string };

/**
 * Take the seated grimoire back into the pack: granted
 * through addPartial — a pack that cannot take its
 * weight grants 0 and the book STAYS seated (the flag
 * is untouched). On success the flag clears.
 */
export function takeGrimoire(
  inventory: PersonalInventory,
  desk: DeskSeat,
): TakeGrimoireOutcome {
  if (desk.grimoire !== true) {
    return { taken: false, reason: 'No grimoire rests here.' };
  }
  const grant = inventory.addPartial(ITEMS.grimoire, 1);
  if (grant.granted <= 0) {
    return { taken: false, reason: 'No room in the pack for it.' };
  }
  desk.grimoire = false;
  return { taken: true, granted: 1 };
}
