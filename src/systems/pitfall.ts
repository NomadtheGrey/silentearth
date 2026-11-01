// PITFALL LIFECYCLE — THE FILL (Adam, 2026-11-01: 'I
// imagine digging a pitfall results in a lot of dirt. I
// also imagine it could be filled back in.').
//
// The pitfall is the one trap with NO pick-up, by
// physics: you can't carry a hole, but you can un-dig
// it. Its removal is FILLING IT IN, and this file is
// that removal's GRANT (the desk/cauldron idiom:
// outcome records, validate before mutating, failure
// touches nothing). The shell composes the act: it
// names the FACED trap (the faced-target law — Systems
// never knows where she stands), calls this grant, and
// on success calls the trap state's removal, which is
// Background's primitive (single-caller rule, the
// placeTrap precedent reversed).
//
// THE PRICE: the same spoil the digging yielded. The
// cost READS the pitfall recipe's spoil quantity — one
// source, so the fill takes exactly what the digging
// gave, by construction. If she kept the spoil, it
// goes back in; if she spent or scattered it, dirt is
// gatherable anywhere (it is scooped from the ground).
// The quantity itself is DRAFT (the recipe's spoil
// field carries the pin-pass note).
//
// NO HUNGER GATE: filling is a removal act, not a
// build (the pickup idiom — pickupCauldron/pickupTorch
// carry none either). The DIGGING stays a craft and
// keeps whatever gates crafts carry.
//
// STATE-BLIND BY DESIGN: whether the pit holds a catch
// is the shell's knowledge, not this grant's (the desk
// precedent) — the verb's availability against a
// catch-holding pit is a shell/presentation call.

import { ITEMS, RECIPES } from './recipes';
import type { PersonalInventory } from './inventory';

/** The fill's cost in dirt, read from the recipe (one source). */
export function pitfallFillCost(): number {
  const pitfall = RECIPES.find((recipe) => recipe.id === 'pitfall');
  return pitfall?.spoil?.quantity ?? 0;
}

/** Fill outcome. On success `consumed` dirt left her pack. */
export type FillPitfallOutcome =
  | { filled: true; consumed: number }
  | { filled: false; reason: string };

/**
 * Fill in one pitfall: consume its spoil's worth of
 * dirt from her pack. `trapType` is the shell's faced
 * trap — anything but a pitfall refuses (only a hole
 * is filled). Validates before mutating: a short pack
 * refuses plainly and consumes nothing.
 */
export function fillPitfall(
  inventory: PersonalInventory,
  trapType: string,
): FillPitfallOutcome {
  if (trapType !== 'pitfall') {
    return { filled: false, reason: 'Only a pitfall is filled in.' };
  }
  const cost = pitfallFillCost();
  if (cost <= 0) {
    return { filled: false, reason: 'Nothing to fill with.' };
  }
  if (inventory.count(ITEMS.dirt) < cost) {
    return {
      filled: false,
      reason: `Not enough dirt carried — filling takes ${cost}.`,
    };
  }
  inventory.remove(ITEMS.dirt, cost);
  return { filled: true, consumed: cost };
}
