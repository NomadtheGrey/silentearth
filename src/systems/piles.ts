/**
 * Silent Earth — ground piles for harvest overflow (player-systems
 * lane, Adam's order 2026-10-26: "for harvestables that don't fit,
 * show them on the ground so we can pick them up later").
 *
 * SCOPE — systems only, pure, no game imports, no engine state:
 * - A pile is one item stack at one world position: { item,
 *   quantity, x, z }. The item id is NORMALIZED (see
 *   inventory.ts) — a pile never carries an UPPER id, exactly
 *   like inventory stacks and save documents.
 * - grantWithOverflow() is the harvest path: grant what fits via
 *   addPartial(), pile the remainder at the harvest site. The
 *   harvest listener (Background's change) calls it once per
 *   yield and hands a non-null pile to the pile entity spawner.
 * - grantFromPile() is the pickup path: the same addPartial()
 *   underneath, so pickup grants what fits and the remainder
 *   STAYS in the pile — never vanishes, never duplicates.
 * - UNIT (since 2026-10-27): "what fits" is WEIGHT in pounds
 *   (inventory.ts weight model) — no code change was needed
 *   here, because both paths already delegate to addPartial(),
 *   which now grants floor(free weight / item weight).
 * - dropFromInventory() is the drop path (Adam's "next pass"
 *   brief, 2026-10-26): remove a carried quantity and return
 *   the GroundPile record for the shell to hand to pileState's
 *   spawn. Per-drop record, no merge here (same rule as
 *   overflow — merging lives in the entity layer). Dropped
 *   piles ride the same pile save wiring as overflow piles;
 *   no separate save handling exists or is needed. The shell
 *   passes the drop position (its player position) and owns
 *   any wardrobe consequence: dropping a worn garment is a
 *   plain removal here, and its worn bonus already
 *   self-cancels when its carried count hits 0 — the shell
 *   decides whether to unwear it in the wardrobe as well.
 *
 * CONTRACTS FOR THE OTHER LANES (read before wiring):
 * - Conservation: granted + piled === the yield, and granted +
 *   remaining === the original pile, across every step. These
 *   functions never create or destroy items; a probe asserts it.
 * - Source spent: when a harvest yields a pile, the source is
 *   SPENT (Background's listener consumes it). If the source
 *   stayed harvestable, she could re-harvest the same yield on
 *   top of the pile and duplicate items. Partial grant is not
 *   "try again later" — the remainder is the pile, and the
 *   pile is the retry.
 * - One pile per remainder: this module does not merge piles.
 *   Two remainders at the same spot stay two piles (two
 *   entities) unless the entity layer merges them deliberately;
 *   merging here would change entity counts under the visual.
 * - Persistence: piles ride the save document (see save.ts:
 *   SaveData.piles, version 1, optional on read so old saves
 *   load with piles: []). App wiring for save/restore follows
 *   the pile entity landing (Background's singleton becomes
 *   the saveNow source and the boot-restore target, the same
 *   shape as fires/houses/looms); until that wiring lands,
 *   piles are session-only — stated, not silent.
 * - Positions are world x/z numbers, finite, in the same frame
 *   as player/fire/house positions. This module never interprets
 *   them beyond passing them through.
 * - SELECTIVE TAKE + DEPOSIT (Adam's full pile ruling,
 *   2026-10-27, UI's chip-menu shape via DEV): a world-anchored
 *   pile chip opens Take one / Take all / Deposit one /
 *   Deposit all, all scoped to the pile's item (USE + desktop
 *   button keep take-all as the fast path; no exact-number
 *   picker — the menu covers it). Systems' half, in this file:
 *   takeFromPile() + handlePileTakeRequest() for the take
 *   side (an exact requested quantity, capped at the pile,
 *   partial by weight as today, remainder stays in the pile),
 *   and depositIntoPile() for the deposit side (remove the
 *   carried quantity and return the record for the shell to
 *   hand to pileState.drop()/spawnPile() — the same
 *   shell-composes-record-plus-drop shape as the existing
 *   drop path). Deposit is structurally scoped to the pile's
 *   item: there is NO item parameter on depositIntoPile, so a
 *   deposit of anything but the pile's own item cannot even
 *   be expressed. MERGE RULE (confirmed at origin in
 *   pileState.ts, not assumed): drop() merges on the verbatim
 *   item string + coords rounded to 2 decimals in the pile
 *   id — so a deposit record reusing the pile's EXACT x/z
 *   merges into that pile, and a different item at the same
 *   coords is a separate pile. A deposit aimed at a pile that
 *   is gone by the time drop() runs still lands as a pile at
 *   those coords (drop creates when nothing matches) —
 *   nothing vanishes, and the shell's chip should refresh
 *   from pileState rather than assuming the pile survived.
 */

import {
  PersonalInventory,
  normalizeItemId,
  type PartialGrant,
} from './inventory';
import type { ItemId } from './recipes';

/** One item stack lying on the ground at one world position. */
export interface GroundPile {
  item: ItemId;
  quantity: number;
  x: number;
  z: number;
}

/**
 * Build a pile. Normalizes the id (UPPER in, kebab out) and
 * throws on a bad shape — positive-integer quantity, finite
 * coordinates — exactly like the other constructors' validation:
 * a pile is created by code, not parsed from untrusted input
 * (parsing lives in save.ts's deserialize, which returns null
 * instead of throwing).
 */
export function createGroundPile(
  item: ItemId,
  quantity: number,
  x: number,
  z: number,
): GroundPile {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`pile quantity must be a positive integer.`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    throw new Error(`pile position must be finite numbers.`);
  }
  return { item: normalizeItemId(item), quantity, x, z };
}

/**
 * Harvest split: what fit + the pile for the rest (null when
 * everything fit). The harvest listener's one call per yield:
 *   const { granted, pile } = grantWithOverflow(yieldItem,
 *     yieldQty, inventory, harvestX, harvestZ);
 *   if (pile) spawnPileEntity(pile);
 * granted + pile?.quantity === yieldQty, always.
 */
export interface HarvestOverflow {
  granted: number;
  pile: GroundPile | null;
}

export function grantWithOverflow(
  item: ItemId,
  quantity: number,
  inventory: PersonalInventory,
  x: number,
  z: number,
): HarvestOverflow {
  const grant: PartialGrant = inventory.addPartial(item, quantity);
  return {
    granted: grant.granted,
    pile:
      grant.remainder > 0
        ? createGroundPile(grant.item, grant.remainder, x, z)
        : null,
  };
}

/**
 * Pickup split: grant what fits from a pile; the returned pile
 * is null when fully taken (despawn the entity) or the same
 * position with the reduced quantity (update the entity).
 * granted + pile?.quantity === the original quantity, always —
 * a remainder never vanishes and a pickup never duplicates.
 */
export interface PileGrant {
  granted: number;
  pile: GroundPile | null;
}

/**
 * 'pile:pickup-requested' listener logic (Systems' listener,
 * landed 2026-10-26 on DEV's bridge-out signal, b23a042 —
 * the shell bridge is out, so this is the SOLE granter on
 * the event; a second subscriber would double-grant). The
 * shell registers this on the bus and owns refresh + save
 * + feedback from the outcome; the grant logic itself
 * lives here, beside grantFromPile.
 *
 * Sequence, mirroring the bridge exactly (so the swap is
 * behavior-identical): look the pile up; grant what fits;
 * take EXACTLY the granted amount from the pile (partial:
 * the remainder stays); report. Stale/missing pile: silent
 * nothing (found: false). Full pack: granted 0, NO take
 * call, and the shell shows the Pack-full note without
 * refresh or save. The take's remaining is authoritative
 * for the outcome (it owns the pile); in single-threaded
 * execution the get → grant → take sequence cannot
 * interleave, so take.taken === granted in practice — the
 * outcome still reports take's numbers, never invented
 * ones. PileStore is structural on purpose: Background's
 * pileState satisfies it without systems importing game
 * modules (item/quantity/x/z + take; the store pile's id
 * is addressed by the pileId argument, not read here).
 */
export interface PileStore {
  get(
    id: string,
  ): { item: string; quantity: number; x: number; z: number } | null | undefined;
  take(id: string, quantity: number): { taken: number; remaining: number };
}

export type PilePickupOutcome =
  | { found: false; pileId: string }
  | {
      found: true;
      pileId: string;
      item: ItemId;
      granted: number;
      remaining: number;
      /** Pile position, for the shell's anchored feedback (same values the bridge used). */
      x: number;
      z: number;
    };

export function handlePilePickupRequest(
  pileId: string,
  store: PileStore,
  inventory: PersonalInventory,
): PilePickupOutcome {
  const pile = store.get(pileId);
  if (!pile) {
    return { found: false, pileId };
  }
  const grant = grantFromPile(
    { item: pile.item, quantity: pile.quantity, x: pile.x, z: pile.z },
    inventory,
  );
  if (grant.granted <= 0) {
    return {
      found: true,
      pileId,
      item: normalizeItemId(pile.item),
      granted: 0,
      remaining: pile.quantity,
      x: pile.x,
      z: pile.z,
    };
  }
  const take = store.take(pileId, grant.granted);
  return {
    found: true,
    pileId,
    item: normalizeItemId(pile.item),
    granted: grant.granted,
    remaining: take.remaining,
    x: pile.x,
    z: pile.z,
  };
}

/**
 * Drop path: remove a carried quantity and return the pile
 * record for the shell to spawn (pileState.spawn or equivalent;
 * the shell passes its player position as x/z — systems never
 * knows the player position itself).
 *
 * Failure is a throw, mirroring remove(): she doesn't carry
 * that many, the quantity isn't a positive integer, or the
 * position isn't finite — the shell catches, shows a note,
 * and no pile is spawned. ATOMIC: the pile record is built
 * (validating everything) BEFORE the removal, and remove()
 * itself throws before mutating on insufficiency — so a
 * failed drop leaves the inventory exactly as it was, never
 * negative, never partially removed, and never duplicated
 * (removed count + pile quantity === the held count change
 * is exactly the requested quantity, or nothing at all).
 * V1 quantity is one per press (the UI Drop action calls
 * with 1; Adam can correct the rule later) — the function
 * takes the quantity, so a later rule change needs no
 * systems change. Normalized ids throughout, as everywhere
 * in this module.
 */
export function dropFromInventory(
  item: ItemId,
  quantity: number,
  inventory: PersonalInventory,
  x: number,
  z: number,
): GroundPile {
  const pile = createGroundPile(item, quantity, x, z);
  inventory.remove(item, quantity);
  return pile;
}

export function grantFromPile(
  pile: GroundPile,
  inventory: PersonalInventory,
): PileGrant {
  const grant: PartialGrant = inventory.addPartial(pile.item, pile.quantity);
  return {
    granted: grant.granted,
    pile:
      grant.remainder > 0
        ? { item: pile.item, quantity: grant.remainder, x: pile.x, z: pile.z }
        : null,
  };
}

/**
 * Selective take: grant an exact requested quantity from a pile
 * (the chip menu's Take one / Take all — Take all passes the
 * pile's quantity, or any larger number; the grant caps at the
 * pile). Weight capacity is honored exactly as in grantFromPile:
 * the grant is min(requested, pile quantity, what fits by
 * weight), and granted + pile?.quantity === the original pile
 * quantity, always — a remainder never vanishes and a take
 * never duplicates. An invalid requested quantity (not a
 * positive integer) throws, like the other constructors here;
 * a request against an empty pile record grants 0 with a null
 * pile (the pile is already gone — the handler below reports
 * missing piles before this is ever called).
 */
export function takeFromPile(
  pile: GroundPile,
  quantity: number,
  inventory: PersonalInventory,
): PileGrant {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`take quantity must be a positive integer.`);
  }
  const wanted = Math.min(quantity, pile.quantity);
  if (wanted <= 0) {
    return { granted: 0, pile: null };
  }
  const grant: PartialGrant = inventory.addPartial(pile.item, wanted);
  const remaining = pile.quantity - grant.granted;
  return {
    granted: grant.granted,
    pile:
      remaining > 0
        ? { item: pile.item, quantity: remaining, x: pile.x, z: pile.z }
        : null,
  };
}

/**
 * Chip-menu take handler, mirroring handlePilePickupRequest's
 * sequence with a requested quantity: look the pile up; grant
 * the request (capped, partial by weight); take EXACTLY the
 * granted amount from the pile (partial: the remainder stays);
 * report. Stale/missing pile: silent nothing (found: false).
 * Full pack: granted 0, NO take call, and the shell shows the
 * Pack-full note without refresh or save — same as the
 * take-all listener. `requested` in the outcome is the
 * pile-scoped request (min(requested, pile quantity)), so menu
 * feedback can say "Took N of M" truthfully; the take's
 * remaining is authoritative for the outcome (it owns the
 * pile). The shell registers no bus listener for this — the
 * chip menu calls it directly with the tapped pile's id and
 * the menu's quantity (1 for Take one, the pile's quantity
 * for Take all).
 */
export type PileTakeOutcome =
  | { found: false; pileId: string }
  | {
      found: true;
      pileId: string;
      item: ItemId;
      /** Pile-scoped request: min(requested, pile quantity). */
      requested: number;
      granted: number;
      remaining: number;
      /** Pile position, for the shell's anchored feedback. */
      x: number;
      z: number;
    };

export function handlePileTakeRequest(
  pileId: string,
  quantity: number,
  store: PileStore,
  inventory: PersonalInventory,
): PileTakeOutcome {
  const pile = store.get(pileId);
  if (!pile) {
    return { found: false, pileId };
  }
  const wanted = Math.min(quantity, pile.quantity);
  const grant = takeFromPile(
    { item: pile.item, quantity: pile.quantity, x: pile.x, z: pile.z },
    quantity,
    inventory,
  );
  if (grant.granted <= 0) {
    return {
      found: true,
      pileId,
      item: normalizeItemId(pile.item),
      requested: wanted,
      granted: 0,
      remaining: pile.quantity,
      x: pile.x,
      z: pile.z,
    };
  }
  const take = store.take(pileId, grant.granted);
  return {
    found: true,
    pileId,
    item: normalizeItemId(pile.item),
    requested: wanted,
    granted: grant.granted,
    remaining: take.remaining,
    x: pile.x,
    z: pile.z,
  };
}

/**
 * Deposit path: move a carried quantity of the PILE'S OWN item
 * into that pile (the chip menu's Deposit one / Deposit all —
 * Deposit all passes the carried count; the menu disables
 * deposit when she carries none of it). There is deliberately
 * NO item parameter: a deposit is always of the pile's item,
 * so depositing anything else cannot be expressed here.
 *
 * ATOMIC, mirroring dropFromInventory(): the record is built
 * (validating quantity + coords) BEFORE the removal, and
 * remove() itself throws before mutating on insufficiency —
 * so a failed deposit leaves the inventory exactly as it was.
 * The shell hands the returned record to pileState.drop() (or
 * spawnPile(), same delegation) — which merges it into the
 * existing pile when the item + exact coords match (see the
 * header's merge note), or creates a pile at those coords
 * when the original is gone. Systems never touches the entity
 * layer: merging lives in pileState, as everywhere else here.
 */
export function depositIntoPile(
  pile: GroundPile,
  quantity: number,
  inventory: PersonalInventory,
): GroundPile {
  const record = createGroundPile(pile.item, quantity, pile.x, pile.z);
  inventory.remove(pile.item, quantity);
  return record;
}
