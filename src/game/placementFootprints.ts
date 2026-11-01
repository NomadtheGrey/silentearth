/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACEMENT FOOTPRINTS — the ground shape of each
 * placeable, for the placement surface's terrain-painted
 * outline (Adam's placement rulings, 2026-11-01; joint
 * claim UI + Background). The renderer paints the
 * outline at the AIMED point; this module is the one
 * place that knows how big each placeable stands.
 *
 * KEYS: the item ids the shell's placement state already
 * carries (Systems' ITEMS strings), with the game-side
 * type names accepted as aliases where they differ
 * (houses) — the shell may hand either spelling and the
 * paint must not miss on a naming seam. Cauldron is
 * absent on purpose: it is object-targeted on its faced
 * hearth, never ground-placed.
 *
 * FRESH PLACEMENTS ONLY (Adam, 2026-11-01): the outline
 * follows the thing's own base shape, 'round or
 * rectangular as the case may be' — the thatch hut's
 * round paint is the ruling's own example. UPGRADES take
 * no placement surface at all ('it should just
 * upgrade'): this table never grows an upgrade case.
 *
 * SOURCES (each entry cites its def/builder; all values
 * DRAFT for Adam's pin pass — if a mesh and its def
 * disagree, the DEF is the authority the outline reads,
 * and the disagreement is named where it exists):
 * - campfire: the renderer's stone ring (r 0.55) + the
 *   stones' own width -> r 0.7.
 * - hearth: the renderer's cap slab, 1.4 x 1.4.
 * - kiln: the renderer's base plinth cylinder, r 0.9
 *   (Adam: the kiln's outline is ROUND).
 * - houses: HOUSE_DEFS.footprint (shelter.ts), a square
 *   of that width — the thatch hut excepted, drawn round
 *   at that width because its wall IS a cylinder of
 *   r = footprint/2. (The lean-to's MESH is shallower
 *   than its def square — named, def wins for v1.)
 * - loom: the renderer frame's posts/beam span 1.6,
 *   depth the frame + cloth roll, 0.4.
 * - lit torch: a pole, r 0.2.
 * - altar: the stump it transforms — trunk base r 0.55
 *   (models.ts 'stump').
 * - writing desk: the desk top, 1.2 x 0.65 (models.ts
 *   buildDeskGroup header measurement).
 * - tent: the renderer's A-frame, 1.4 wide x 2.0 long.
 */

import { HOUSE_DEFS, type HouseType } from './shelter';

/** A placeable's ground shape, in metres. */
export type PlacementFootprint =
  | { shape: 'circle'; r: number }
  | { shape: 'rect'; w: number; d: number };

/** Paint register: neutral stands unless a REAL check
 *  exists (Adam's ruling — never a hardcoded green). */
export type PlacementTint = 'neutral' | 'valid' | 'invalid';

/** The shell's armed-placement projection (the seam's
 *  payload — renderer.setPlacementPreview). */
export interface PlacementPreview {
  /** The placeable's key (item id or type alias). */
  key: string;
  /** The aimed ground point. */
  x: number;
  z: number;
  /** Placement facing (rects rotate; circles ignore). */
  rotY: number;
  tint: PlacementTint;
}

const FOOTPRINTS: Record<string, PlacementFootprint> = {
  campfire: { shape: 'circle', r: 0.7 },
  hearth: { shape: 'rect', w: 1.4, d: 1.4 },
  kiln: { shape: 'circle', r: 0.9 },
  loom: { shape: 'rect', w: 1.6, d: 0.4 },
  'lit-torch': { shape: 'circle', r: 0.2 },
  altar: { shape: 'circle', r: 0.55 },
  'writing-desk': { shape: 'rect', w: 1.2, d: 0.65 },
  tent: { shape: 'rect', w: 1.4, d: 2.0 },
};

/** House item ids (Systems' spellings) -> their defs. */
const HOUSE_ITEM_KEYS: Record<string, HouseType> = {
  'primitive-lean-to': 'leanTo',
  'thatch-hut': 'thatchHut',
  'woven-cottage': 'wovenCottage',
  'small-wooden-hut': 'smallWoodenHut',
};

function houseFootprint(type: HouseType): PlacementFootprint {
  const f = HOUSE_DEFS[type].footprint;
  // The thatch hut's wall is a cylinder of r = f/2; the
  // others stand square on their def width.
  return type === 'thatchHut'
    ? { shape: 'circle', r: f / 2 }
    : { shape: 'rect', w: f, d: f };
}

/** The footprint for a placeable key, or null when the
 *  key names nothing ground-placeable. */
export function placementFootprintFor(key: string): PlacementFootprint | null {
  const direct = FOOTPRINTS[key];
  if (direct) return direct;
  const houseType =
    HOUSE_ITEM_KEYS[key] ?? ((key in HOUSE_DEFS ? key : null) as HouseType | null);
  return houseType ? houseFootprint(houseType) : null;
}

/**
 * The outline's ground points for a footprint, centred
 * on the origin, counter-clockwise — the pure shape the
 * renderer paints (and the probe measures). Rects give
 * their four corners; circles give `segments` points.
 */
export function outlinePoints(
  fp: PlacementFootprint,
  segments = 40,
): { x: number; z: number }[] {
  if (fp.shape === 'rect') {
    const hw = fp.w / 2;
    const hd = fp.d / 2;
    return [
      { x: -hw, z: -hd },
      { x: hw, z: -hd },
      { x: hw, z: hd },
      { x: -hw, z: hd },
    ];
  }
  const pts: { x: number; z: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * fp.r, z: Math.sin(a) * fp.r });
  }
  return pts;
}
