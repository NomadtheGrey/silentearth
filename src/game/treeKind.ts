/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TREE KINDS (Adam 2026-10-30 — standing trees have a
 * kind: some are OAKS, the rest are the common run).
 * Kind-of-the-SPOT, the boneKind precedent part for
 * part: the kind derives deterministically from the
 * world seed + the tree's position — same seed +
 * position always gives the same kind, with no
 * rand-stream consumption (no chunk re-rolls) and no
 * stored tag. Worldgen consults it to relabel oak
 * slots 'oakTree' (its own scatter kind + source — a
 * broader, fuller canopy that reads differently at a
 * glance, and a Downed Oak in the fell); the harvest
 * of a matured sapling consults it too, so a regrown
 * tree's kind is its own spot's kind, like any
 * standing tree's. The stump/sapling lifecycle is
 * unchanged — kind is never planted or inherited, it
 * is read off the ground the tree stands on.
 *
 * THE LOG STAYS OUT (Adam, 2026-10-30): no new log
 * item comes from this — the oak's extra yield is the
 * Downed Oak that already exists (the hut recipes
 * consume it). Adam's aside, recorded for whoever
 * asks next: if a Log item ever returns, it comes
 * from pine.
 *
 * OAK SHARE: 1-in-4 of tree spots (DRAFT — Adam's pin
 * pass owns the number).
 */

import { deriveSeed } from './seed';

export type TreeKindName = 'oak' | 'common';

/**
 * The kind of the tree standing at (x, z) in world
 * `seed`: FNV-1a position hash → oak on one hash in
 * four, common otherwise. Deterministic, position is
 * the whole identity.
 */
export function treeKindAt(seed: string, x: number, z: number): TreeKindName {
  const h = deriveSeed(String(seed), `tree:${x.toFixed(2)},${z.toFixed(2)}`);
  return ((h % 4) + 4) % 4 === 0 ? 'oak' : 'common';
}
