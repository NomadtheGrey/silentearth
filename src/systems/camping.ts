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
 * no home chip (all house-anchored). Shelter effect
 * LIVE in the THATCH TIER: factor 0.5 at 2.5 m from the
 * engine's live table (Adam's reading, 2026-11-02 —
 * Background cb42878 moved the proposed 0.85 to 0.5);
 * this module implements no shelter number.
 *
 * SLEEPING BAG — a PLACED sleep site (Adam's pin,
 * 2026-11-02; the carried-passive draft this section
 * carried is superseded): place/pickup mirror the
 * tent's exactly (validate before consuming; pack-full
 * pickup leaves the bag placed). The shell hands the
 * placed record to Background's setBags body; SavedBag
 * seats it in the save. While she SLEEPS IN the placed
 * bag, her shelter factor is the thatch hut's 0.5,
 * read from the engine's live table, scoped to the
 * sleeping occupant only — no storage, no radius
 * shelter, no garment row. The learn event is the
 * FIRST COMPLETED SLEEP (recordItemUse —
 * knowledge.ts); placement teaches nothing.
 * carriesSleepingBag remains as the carried-marker
 * check. The bag still does NOT gate sleep —
 * sleep-anywhere already works.
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
 * A placed sleeping bag, as handed to Background's
 * setBags call. Singular by definition: one press
 * places one bag. `item` is always 'sleeping-bag'.
 */
export interface PlacedBag {
  item: string;
  x: number;
  z: number;
}

/**
 * Place outcome. `bag` is the record the shell hands to
 * Background's setBags call; `reason` is player-facing
 * on failure only. Failure touches nothing.
 */
export type PlaceBagOutcome =
  | { placed: true; bag: PlacedBag }
  | { placed: false; reason: string };

/**
 * Move one carried sleeping bag out of the inventory
 * into a placed-bag record at (x, z). Validates before
 * mutating (finite position, bag carried), so a failed
 * place consumes nothing — the tent's grant semantics
 * whole.
 */
export function placeBag(
  inventory: PersonalInventory,
  x: number,
  z: number,
): PlaceBagOutcome {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { placed: false, reason: 'Invalid position.' };
  }
  if (inventory.count(ITEMS.sleepingBag) <= 0) {
    return { placed: false, reason: 'No sleeping bag carried.' };
  }
  inventory.remove(ITEMS.sleepingBag, 1);
  return { placed: true, bag: { item: ITEMS.sleepingBag, x, z } };
}

/**
 * Grant for taking a placed sleeping bag back up:
 * 1 = the bag is back in the pack (shell removes the
 * placed record); 0 = pack full, the placed bag stays
 * where it is (pile-pickup rule: take granted only).
 */
export function pickupBag(inventory: PersonalInventory): {
  granted: number;
} {
  const grant = inventory.addPartial(ITEMS.sleepingBag, 1);
  return { granted: grant.granted };
}

/**
 * Sleeping-bag marker: true while a sleeping bag is
 * carried — a live inventory check, no save field.
 * (The placed bag is the sleep site; this remains the
 * carried check the shell may read.)
 */
export function carriesSleepingBag(inventory: PersonalInventory): boolean {
  return inventory.count(ITEMS.sleepingBag) > 0;
}
