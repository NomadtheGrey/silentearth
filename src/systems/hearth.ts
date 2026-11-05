// HEARTH — THE PICKUP GRANT (Adam's ruling,
// 2026-11-05: "The hearth is heavy, but should be
// moveable, similar to anything else" — the hearth
// is FURNITURE, like the bench, the desk, and the
// loom, under his furniture-verbs law: a placed
// thing's verbs live on the thing itself).
//
// THE WEIGHT: the hearth reads 20 lb (DEV-set
// DRAFT for Adam's pin pass) — pockets can't stage
// it, a basket carries it, and it sits below the
// grimoire's class. The catch law below is priced
// at that weight.
//
// THE CAULDRON GUARD (the desk pattern exactly):
// while a cauldron sits on the hearth, the pickup
// refuses in words — 'Take the cauldron from it
// first.' — and touches nothing. The guard speaks
// BEFORE the capacity check (the desk law: she is
// told what stands in the way before she is told
// her pack is full).
//
// THE FIRE RIDES (Adam's standing law: fires stay
// lit; the torch precedent): a lit hearth picked up
// does NOT lose its fire. Lit-ness rides the ITEM
// ID, exactly as a lit torch rides as 'lit-torch':
// a lit hearth comes back into the pack as a
// 'lit-hearth' item, an unlit one as 'hearth', and
// the place side reads hearthItemFireLit to restore
// the fire already burning on re-place. No new save
// seat — the item id IS the state, persisted in her
// pack. Mid-lighting progress does NOT ride: a fire
// being lit is not yet a lit fire; only lit rides.
//
// THE COMPOSITION: the shell faces the fire entity
// and passes the seat facts in (whether a cauldron
// sits on it, whether it burns). On a taken grant
// the shell removes the fire record (Background's
// fire seat) — the record leaves only when the
// taking succeeds, and a refusal strands nothing.
//
// SCOPE: the hearth only. The campfire and the kiln
// stay place-once under this ruling unless Adam
// extends it.
//
// NO HUNGER GATE (the furniture precedent): pickup
// is an inventory <-> world move.

import { ITEMS } from './recipes';
import type { ItemId } from './recipes';
import type { PersonalInventory } from './inventory';

/**
 * The faced hearth's charges, as the shell reports
 * them: whether a cauldron sits on it (its one
 * charge, the cauldron binding) and whether it
 * burns. A future charge joins this shape and the
 * guard list below.
 */
export interface HearthSeat {
  cauldron: boolean;
  lit: boolean;
}

/** Pickup outcomes: taken (the item granted), or a refusal in words. */
export type PickupHearthOutcome =
  | {
      taken: true;
      granted: 1;
      /** The fire state that rode out with it (the granted item carries it). */
      fireLit: boolean;
    }
  | { taken: false; reason: string };

/**
 * Pick a placed hearth back up. The guard first
 * (a cauldron on it refuses, naming the blocker),
 * then the taking at 20 lb (the catch law): an
 * unlit hearth grants 'hearth', a lit one grants
 * 'lit-hearth' — the fire survives the move in the
 * item itself. A refusal touches NOTHING: no item
 * moves and the placed fire record stands.
 */
export function pickupHearth(
  inventory: PersonalInventory,
  hearth: HearthSeat,
): PickupHearthOutcome {
  if (hearth.cauldron) {
    return { taken: false, reason: 'Take the cauldron from it first.' };
  }
  const grant = inventory.addPartial(
    hearth.lit ? ITEMS.litHearth : ITEMS.hearth,
    1,
  );
  if (grant.granted < 1) {
    return { taken: false, reason: 'No room in the pack for it.' };
  }
  return { taken: true, granted: 1, fireLit: hearth.lit };
}

/**
 * The place side's read: does this carried hearth
 * item carry a living fire? ('lit-hearth' yes,
 * 'hearth' no, anything else no.) The shell
 * consumes the item and hands this fact to the
 * fire seat, so a re-placed lit hearth burns from
 * the moment it stands.
 */
export function hearthItemFireLit(item: ItemId): boolean {
  return item === ITEMS.litHearth;
}
