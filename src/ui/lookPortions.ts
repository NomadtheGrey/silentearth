/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — LOOK portion table (UI lane).
 *
 * DRAFT content, flagged for Adam's pin pass (DEV, 2026-10-27):
 * the true-name portions a LOOK reveals, per kind. DEV authored
 * this table; the UI lane writes it down verbatim and invents
 * nothing beyond it. A kind with no entry here shows its plain
 * (mundane) name when looked at, per Systems' null rule
 * (name-sight.ts: display null -> caller shows plain name).
 *
 * Portions join with ' - ' in known order (family first).
 * Knowledge generalizes across instances of a kind: looking
 * at one bush teaches bushes (Systems' key recommendation).
 * The owl hook (+1 portion while owned) lives in NameSight;
 * this file holds content only, no progression.
 */

/** DEV-authored DRAFT portions, 3 per kind (pin pass pending). */
export const LOOK_PORTIONS: Readonly<Record<string, readonly string[]>> = {
  bush: ['Brush', 'elderberry brush', 'bears fruit'],
  bogGrowth: ['Bog growth', 'bog berries', 'low and wet'],
  snapWood: ['Snap-wood', 'deadfall kindling', 'snaps clean'],
  tenderVines: ['Tender vines', 'cordage fiber', 'twines well'],
  peatMoss: ['Peat moss', 'bog moss', 'holds water'],
  riverStone: ['River stone', 'whetstone', 'smooth and hard'],
  riverSilt: ['Silt bed', 'fine silt', 'clay beneath'],
  saltCrystal: ['Salt crystal', 'flat salt', 'sharp and clean'],
  downedOak: ['Downed oak', 'fallen oak', 'acorns nearby'],
  tree: ['Standing oak', 'tall oak', 'acorns above'],
  groundAcorns: ['Ground acorns', 'fallen acorns', 'cook first'],
  edibleMushroom: ['Mushroom', 'tan plain cap', 'safe to eat'],
  poisonMushroom: ['Mushroom', 'rust cap, pale spots', 'do not eat'],
  appleTree: ['Apple tree', 'orchard tree', 'fruit by hand'],
  flint: ['Flint stone', 'knapped shard', 'strikes fire'],
  reed: ['Reed bed', 'tall reeds', 'fiber'],
  stump: ['Tree stump', 'old stump', 'workstation'],
  flower: ['Meadow flower', 'wildflower', 'pretty, not food'],
};

/** Portions for a kind, or null when the kind is unlisted. */
export function portionsForKind(kind: string): readonly string[] | null {
  return LOOK_PORTIONS[kind] ?? null;
}

/**
 * The NameSight key for an in-range harvest target: the scatter
 * kind encoded in the target id ('scatter:chunk:kind:x,z').
 * Ground targets (dirt/mud/grass) are not things to look at
 * and yield null; a malformed id yields null.
 */
export function lookKeyForTarget(target: {
  id: string;
  kind: string;
}): string | null {
  if (target.kind !== 'scatter') return null;
  const parts = target.id.split(':');
  const kind = parts[2];
  return kind ? kind : null;
}
