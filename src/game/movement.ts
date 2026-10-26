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
import type { WorldGen } from './worldgen';

/** Speed multiplier at full marsh/bog (lane-decided, not pinned). */
export const BOGGY_SLOW_MIN = 0.6;

/** Fraction of the terrain slow that bog boots remove (lane-decided). */
export const BOG_BOOTS_MITIGATION = 0.5;

/** Terrain speed query shape: raw (boots-free) multiplier at (x, z). */
export type TerrainSpeedQuery = (x: number, z: number) => number;

/** Bog-boots worn-state query shape (clothes system, future). */
export type BogBootsQuery = () => boolean;

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
