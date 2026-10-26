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
