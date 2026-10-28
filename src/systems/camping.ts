/**
 * Camping (Systems, 2026-10-28 — Adam: portable sleeping bag +
 * tent, ingredients delegated, existing materials only).
 *
 * TENT — placeable portable shelter, torch mirror: one press
 * places one tent (finite-position check, then consume 1);
 * pickup grants 1 via addPartial (pack full → granted 0, the
 * placed tent stays where it is — pile-pickup rule: take
 * granted only). Multiples allowed. No hunger gate (moves,
 * like drop/pickup — flagged). The shell hands the placed
 * record to Background's placed-tent entity (dependency,
 * DEV-routed: ids tent:<n>, snapshot/restore, graphic).
 *
 * NOT A HOUSETYPE — the choice and its consequences: a tent
 * is NOT a HouseType, so it gets no HomeStorage/Store/Take,
 * no upgrade pill, no FIND CAMP camp (camps = houses), and
 * no home chip (all house-anchored). Shelter effect PROPOSED
 * draft 0.85 (lean-to 0.7, unsheltered 1.0) with NO live
 * benefit until Background's tent-aware shelterQuery branch
 * lands (their claim, DEV-routed) — this module implements
 * no shelter number.
 *
 * SLEEPING BAG — carried bedding, PASSIVE while carried
 * (umbrella precedent: inventory-carried, no equip, no
 * use-action). It does NOT gate sleep — sleep-anywhere
 * already works. V1 effect is the marker + the fiction:
 * carriesSleepingBag is a live inventory check at sleep
 * time — NO save field, NO number today (no
 * cold/exposure-during-sleep model to attach a number to,
 * and a waking-refresh number would collide with groundhog
 * +10 — Adam's word needed, not baked).
 *
 * Numbers DRAFT for Adam's pin pass: bag 2 lb
 * (hooded-cloak precedent), tent 4 lb (carried-structure
 * precedent); stations bag-loom / tent-workstation
 * (redirectable to hand, flagged not pinned); ingredients
 * bag cordage 4 + grass 6 + vines 2, tent wood 4 + cordage
 * 6 + vines 4. Both pack-counted (portable ≠ weight-exempt,
 * unlike charms). NEITHER joins the no-recraft singles in
 * this landing (tent multiples by design; bag multiples by
 * default — one-person-one-bag single is a follow-up only
 * if Adam wants it).
 *
 * UI App shell follow-up (DEV briefs UI once camping.ts
 * lands): Place row + placement mode + Take-down surface
 * + bag row — not built here.
 */

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';

/**
 * A placed tent, as handed to Background's place call.
 * Singular by definition: one press places one tent.
 * `item` is always 'tent'.
 */
export interface PlacedTent {
  item: string;
  x: number;
  z: number;
}

/**
 * Place outcome. `tent` is the record the shell hands to
 * Background's place call; `reason` is player-facing on
 * failure only. Failure touches nothing.
 */
export type PlaceTentOutcome =
  | { placed: true; tent: PlacedTent }
  | { placed: false; reason: string };

/**
 * Move one carried tent out of the inventory into a
 * placed-tent record at (x, z). Validates before mutating
 * (finite position, tent carried), so a failed place
 * consumes nothing.
 */
export function placeTent(
  inventory: PersonalInventory,
  x: number,
  z: number,
): PlaceTentOutcome {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { placed: false, reason: 'Invalid position.' };
  }
  if (inventory.count(ITEMS.tent) <= 0) {
    return { placed: false, reason: 'No tent carried.' };
  }
  inventory.remove(ITEMS.tent, 1);
  return { placed: true, tent: { item: ITEMS.tent, x, z } };
}

/**
 * Grant for taking a placed tent back down: 1 = the tent is
 * back in the pack (shell removes the placed entity); 0 =
 * pack full, the placed tent stays where it is
 * (pile-pickup rule: take granted only).
 */
export function pickupTent(inventory: PersonalInventory): {
  granted: number;
} {
  const grant = inventory.addPartial(ITEMS.tent, 1);
  return { granted: grant.granted };
}

/**
 * V1 sleeping-bag marker: true while a sleeping bag is
 * carried. The shell checks it at sleep time — live
 * inventory, no save field, no number (see header).
 */
export function carriesSleepingBag(inventory: PersonalInventory): boolean {
  return inventory.count(ITEMS.sleepingBag) > 0;
}
