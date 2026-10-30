/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Movement speed modifiers — terrain slow + bog boots (Adam,
 * 2026-10-26, PINNED mechanic; amounts lane-decided).
 *
 * PINNED (Adam): travel through marsh and bog IS slow (slower
 * than firm ground), and bog boots mitigate that slowness —
 * "less slow," NOT full speed.
 *
 * LANE-DECIDED starting values (Adam's pin pass still applies):
 * - Full marsh/bog slows to BOGGY_SLOW_MIN of base speed.
 * - Bog boots remove BOG_BOOTS_MITIGATION of the slow (not all
 *   of it): at full bog, boots take 0.60 → 0.80, never 1.00.
 * - "Marsh and bog" at a position is the worse of the marsh
 *   overlay (marshWeight, the ground-character overlay — marsh
 *   is NOT a biome id) and the deepBog biome weight. max(), not
 *   sum: the two track the same wetness, and summing would
 *   double-count one wetness as two.
 * - Slow interpolates linearly with boggy-ness: firm ground is
 *   full speed, full bog is the minimum, partial bog is between.
 *
 * COMPOSITION (with the hunger slowdown in player.ts): terrain
 * slow and hunger slow stack as separate multipliers, and boots
 * mitigation reduces ONLY the terrain part — boots never touch
 * the hunger multiplier. A hungry witch in boots in a bog moves
 * at terrain-with-boots × hunger, not at either alone.
 *
 * BOOTS INPUT (hook, not a clothes system): the boots themselves
 * (worn state, clothes system) are NOT built yet. The player
 * controller takes a BogBootsQuery — () => boolean, worn or not
 * — defaulting to no boots (full slow) until Systems' clothes
 * work lands and the shell wires it. No boot item, recipe, or
 * wardrobe mechanics are invented here. Note the boots' SECOND
 * effect lives elsewhere: bog boots also give wet 40% exposure
 * protection in weather.ts's garment table (GARMENT_PROTECTION) —
 * speed mitigation here, wet protection there, same garment.
 *
 * TERRAIN INPUT (wired, not a query for the shell): the renderer
 * wires the terrain query itself (it owns both the generator and
 * the player), so no App.tsx change is needed for terrain slow
 * to work in-game. Only the boots query waits on the shell.
 */

import { marshWeight } from './biomes';
import { riverCenterAt, RIVER_WIDTH, type RiverParams } from './river';
import type { WorldGen } from './worldgen';

/** Speed multiplier at full marsh/bog (lane-decided, not pinned). */
export const BOGGY_SLOW_MIN = 0.6;

/** Fraction of the terrain slow that bog boots remove (lane-decided). */
export const BOG_BOOTS_MITIGATION = 0.5;

/** Terrain speed query shape: raw (boots-free) multiplier at (x, z). */
export type TerrainSpeedQuery = (x: number, z: number) => number;

/** Bog-boots worn-state query shape (clothes system, future). */
export type BogBootsQuery = () => boolean;

/** Standing-in-water query shape: true when she wades at (x, z). */
export type WaterQuery = (x: number, z: number) => boolean;

/**
 * How marshy/boggy (x, z) is, 0 (firm) to 1 (full bog): the worse
 * of the marsh overlay weight and the deepBog biome weight.
 * Pure function of the world generator — same seed, same spot,
 * same boggy-ness, so seed reproducibility holds.
 */
export function boggyAt(gen: WorldGen, x: number, z: number): number {
  const fields = gen.fieldsAt(x, z);
  const deepBog = gen.weightsAt(x, z).weights.deepBog ?? 0;
  return Math.min(1, Math.max(marshWeight(fields), deepBog));
}

/**
 * Raw terrain speed multiplier at (x, z), boots-free: 1 on firm
 * ground, BOGGY_SLOW_MIN at full bog, linear between.
 */
export function terrainSpeedAt(gen: WorldGen, x: number, z: number): number {
  return 1 - (1 - BOGGY_SLOW_MIN) * boggyAt(gen, x, z);
}

/**
 * Apply bog boots to a raw terrain multiplier: boots remove
 * BOG_BOOTS_MITIGATION of the slow, so the result sits between
 * the raw value and 1 — "less slow," never full speed. When
 * boots are not worn, the raw value passes through unchanged.
 */
export function applyBogBoots(rawTerrain: number, bootsWorn: boolean): number {
  if (!bootsWorn) return rawTerrain;
  return 1 - (1 - rawTerrain) * (1 - BOG_BOOTS_MITIGATION);
}

// === Ground resistance: the water axis (Adam, 2026-10-30) ====================
//
// The bog curve above carries marsh and swamp (Adam's steer:
// "instantiate movement slowdown for marshy ground, more for
// actual swamp, much more for wading or swimming" — the curve's
// midpoint IS the marsh factor (x0.8 at boggy 0.5), its pinned
// floor the swamp factor (x0.6)). This section adds the axis
// the curve lacks: WATER. Standing in water — the river ribbon
// or a pond / standing-water disc — floors her terrain factor
// at WADING_FACTOR, composed by MIN with the bog factor, never
// multiplied (the boggyAt precedent: one wetness is not charged
// twice — a boggy pond is wading, not wading-times-bog).
//
// COMPOSITION ORDER (load-bearing): the wading floor applies
// AFTER bog-boots mitigation, in player.ts — applyBogBoots
// mitigates the bog curve only, and bog boots are not waders
// (flagged for Adam's pin pass with the rest of the table).
// That is why wading arrives as its own query (WaterQuery)
// instead of being folded into the terrain query's result:
// folded in, the boots step would silently mitigate the water.

/** Wading speed factor, DEV draft for Adam's pin pass. */
export const WADING_FACTOR = 0.4;

/**
 * Swimming speed factor — RESERVED, applied nowhere. The world
 * has no deep water in v1 (flat ground, a 5 m river ribbon,
 * shallow pond discs), so nothing is deeper than wading. The
 * number instantiates with the first deep-water body (its own
 * claim); entry then is allowed — no invisible wall, she swims
 * slowly — and breath stays out of scope (no health system).
 */
export const SWIMMING_FACTOR = 0.25;

/** How far past a water's edge still counts as standing in it. */
export const WADING_MARGIN_M = 0.3;

/** A water disc for the wading test: centre + radius, meters. */
export interface WaterDisc {
  x: number;
  z: number;
  r: number;
}

/**
 * Distance to the river's centreline near the course-axis
 * projection of (x, z), sampled coarsely (+/-9 m around the
 * projection at 3 m steps). Exactness matters only near the
 * wading threshold; the centreline's slope keeps the true
 * nearest point inside the window for any point close enough
 * to matter, so the wading edge carries ~0.2 m of fuzz by
 * design — a speed factor's boundary, not a gate. (The exact
 * +/-500 m sampler stays in waterProximity.ts, whose scry gate
 * is priced per press, not per frame.)
 */
export function riverDistanceNear(params: RiverParams, x: number, z: number): number {
  const t0 = (x - params.ox) * params.dx + (z - params.oz) * params.dz;
  let best = Infinity;
  for (let dt = -9; dt <= 9; dt += 3) {
    const c = riverCenterAt(params, t0 + dt);
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Standing in water at (x, z): within the river ribbon (centre
 * line distance at most the half width + the wading margin) or
 * inside any supplied water disc (+ margin). The discs are the
 * caller's — the renderer memoizes the pond / standing-water
 * discs around her chunk (generateChunk is pure, so the set is
 * derivable; regenerating per frame is not the price).
 */
export function standingInWater(
  river: RiverParams | null,
  discs: readonly WaterDisc[],
  x: number,
  z: number,
): boolean {
  if (river && riverDistanceNear(river, x, z) <= RIVER_WIDTH / 2 + WADING_MARGIN_M) {
    return true;
  }
  for (const d of discs) {
    if (Math.hypot(d.x - x, d.z - z) <= d.r + WADING_MARGIN_M) return true;
  }
  return false;
}

/**
 * The wading floor: when she stands in water, her (already
 * boots-mitigated) terrain factor is floored at WADING_FACTOR —
 * a floor by MIN, so deep bog (below the factor) stays bog-slow
 * and firm ground in water drops exactly to wading.
 */
export function applyWading(terrain: number, inWater: boolean): number {
  return inWater ? Math.min(terrain, WADING_FACTOR) : terrain;
}
