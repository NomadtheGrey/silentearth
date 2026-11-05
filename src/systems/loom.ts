// LOOM — THE PICKUP GRANT (Adam's furniture-verbs
// ruling, 2026-11-05: a placed thing's verbs live on
// the thing itself — the faced loom's own menu
// carries its work AND its Pick up, like the bench
// and the desk).
//
// SCOPE, stated plainly: this module is born with
// the pickup only. The loom's PLACEMENT rides the
// shell -> loomState path as built (no systems place
// grant exists for it, and none is invented here);
// any future loom grants land in this file, beside
// this one.
//
// THE ACT (the bench's mirror — the loom is
// free-standing, like the bench, not keyed to a
// hearth like the cauldron): pickupLoom judges the
// taking only. The shell removes the placed record
// ONLY on a grant of 1: the loom is 4 lb carried, so
// a pack that cannot hold it grants 0 and the loom
// STAYS standing (the standing catch law — the
// refusal is the door's voice for the 0).
//
// NO HUNGER GATE (the furniture precedent): pickup
// is an inventory <-> world move, like drop/pickup.

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';

/**
 * Grant for picking a placed loom back up: 1 = the
 * loom is back in the pack as 'loom' (the shell
 * removes the placed record); 0 = the pack cannot
 * hold its 4 lb, the placed loom stays standing
 * where it is (pile-pickup rule: take granted only).
 * The faced record is the shell's to identify — this
 * grant only judges the taking.
 */
export function pickupLoom(inventory: PersonalInventory): {
  granted: number;
} {
  const grant = inventory.addPartial(ITEMS.loom, 1);
  return { granted: grant.granted };
}
