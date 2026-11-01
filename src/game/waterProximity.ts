/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WATER PROXIMITY + WATER LIST (Adam 2026-10-27 — water
 * scrying reveals her camps as arrows; SCRY BUTTON RULING,
 * superseding the no-button amendment: approach still water
 * → SCRY BUTTON appears → press → camp arrows. The button
 * IS the magic signal, no tutorial popup. Systems' 9927ddab
 * evaluation serves on press: near-water state = button
 * visibility, reveal = on press.) Water bodies are
 * this lane's (river + ponds, 2026-10-27): this module adapts
 * them for Systems' divination evaluation.
 *
 * LAYER RULE (Systems' divination.ts header): Systems owns
 * the RULE (how close counts as "at" water), the game layer
 * owns the water DATA. So the primary API here is
 * stillWatersNear(): StillWaterBody circles — ponds as their
 * circle, the river as centerline samples RIVER_STEP apart
 * with radius RIVER_WIDTH / 2 (samples 4 m apart with 2.5 m
 * radii overlap, so the river reads continuous). The
 * StillWaterBody shape below STRUCTURALLY matches Systems'
 * divination.ts interface (game never imports systems — the
 * shell passes this list straight into evaluateCampReveal /
 * distanceToStillWater).
 *
 * PROXIMITY RULE (mirrors Systems' divination.ts, flagged
 * for pin pass): SCRY_WATER_RANGE = 2.5 m from the water's
 * EDGE (mirrors HARVEST_RANGE 2.5). BANK-SIDE gate,
 * deliberately: water bodies are visible-only (no swimming /
 * wading), so the bank counts as "at the water". The
 * authoritative gate is Systems' evaluateCampReveal;
 * isNearWater here matches its rule for any shell-side quick
 * check — keep the two values in sync.
 *
 * RIVER DISTANCE: min over samples around the course-axis
 * projection of the point (t0 ± 500 m, step 4 m; meander
 * amplitude ≤ 40 m, so the closest point's t stays well
 * inside that window). Edge distance: centerline distance
 * minus RIVER_WIDTH / 2. POND DISTANCE: the 3×3 chunks around
 * the point are scanned (generateChunk is deterministic and
 * cheap); a pond counts at its disc edge (DISC_RADIUS['pond']
 * × instance scale, the same radius the renderer draws).
 * EXACTNESS NOTE: distanceToWater is exact-near (exact while
 * the answer is within ~one chunk, which covers every gate
 * threshold); far away it is an upper bound (ponds beyond the
 * 3×3 scan are not counted) — isNearWater only needs
 * exactness near its threshold, so the gate is exact.
 * Call on action press / player-moved evaluation, NOT per
 * frame: findSpawn runs once per seed (memoized below), but
 * the chunk scan is still evaluation-priced, not frame-priced.
 */

import { riverCenterAt, riverParamsFor, RIVER_STEP, RIVER_WIDTH, type RiverParams } from './river';
import { DISC_RADIUS } from './models';
import { standingInWater, type WaterDisc } from './movement';
import { CHUNK_SIZE } from '../constants';
import { jarPatchState, PATCH_R_M } from './jarPatchState';
import type { WorldGen } from './worldgen';

/**
 * A still-water body, normalized for the proximity rule.
 * Structural match for Systems' divination.ts StillWaterBody
 * (game never imports systems — same shape, kept in sync by
 * the shell passing this list in).
 */
export interface StillWaterBody {
  x: number;
  z: number;
  /** Circle radius in meters (pond radius, or river half-width). */
  radius: number;
}

/**
 * How close to still water counts as "at" it, in meters
 * from the water's edge. Mirrors Systems' divination.ts
 * SCRY_WATER_RANGE (2.5, mirrors HARVEST_RANGE).
 */
export const SCRY_WATER_RANGE = 2.5;

/** Default adapter range: waters within 50 m of the point (must exceed the gate). */
export const STILL_WATER_ADAPTER_RANGE = 50;

const RIVER_SAMPLE_HALF = 500;
const RIVER_SAMPLE_STEP = 4;

let cachedSeed: string | null = null;
let cachedParams: RiverParams | null = null;

function paramsFor(gen: WorldGen): RiverParams {
  if (cachedParams && cachedSeed === gen.seed) return cachedParams;
  cachedParams = riverParamsFor(String(gen.seed), gen.findSpawn());
  cachedSeed = gen.seed;
  return cachedParams;
}

/** Distance from (x, z) to the river's CENTERLINE. */
export function distanceToRiver(params: RiverParams, x: number, z: number): number {
  const t0 = (x - params.ox) * params.dx + (z - params.oz) * params.dz;
  let best = Infinity;
  for (let t = t0 - RIVER_SAMPLE_HALF; t <= t0 + RIVER_SAMPLE_HALF; t += RIVER_SAMPLE_STEP) {
    const center = riverCenterAt(params, t);
    const d = Math.hypot(center.x - x, center.z - z);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Distance from (x, z) to the nearest water EDGE (river bank or
 * pond disc edge); 0 or negative = standing in water. See the
 * exactness note in the header.
 */
export function distanceToWater(gen: WorldGen, x: number, z: number): number {
  const params = paramsFor(gen);
  let best = distanceToRiver(params, x, z) - RIVER_WIDTH / 2;
  const pcx = Math.floor(x / CHUNK_SIZE);
  const pcz = Math.floor(z / CHUNK_SIZE);
  for (let cx = pcx - 1; cx <= pcx + 1; cx++) {
    for (let cz = pcz - 1; cz <= pcz + 1; cz++) {
      for (const obj of gen.generateChunk(cx, cz).objects) {
        if (obj.kind !== 'pond') continue;
        const d = Math.hypot(obj.x - x, obj.z - z) - (DISC_RADIUS['pond'] ?? 1.0) * obj.scale;
        if (d < best) best = d;
      }
    }
  }
  // Her hauled ponds count (the jar patches' composition,
  // 2026-11-01): a placed WATER patch is water to this
  // edge distance exactly as a pond is. Surface only.
  if (!gen.dimensionKey) {
    for (const patch of jarPatchState.all()) {
      if (patch.kind !== 'water') continue;
      const d = Math.hypot(patch.x - x, patch.z - z) - PATCH_R_M;
      if (d < best) best = d;
    }
  }
  return best;
}

/** Scry gate: true while (x, z) is within range of a water edge. */
export function isNearWater(gen: WorldGen, x: number, z: number, range: number = SCRY_WATER_RANGE): boolean {
  return distanceToWater(gen, x, z) <= range;
}

/**
 * Still-water bodies near (x, z), for Systems'
 * evaluateCampReveal / distanceToStillWater: ponds in the 3×3
 * chunks around the point as circles + river centerline
 * samples RIVER_STEP apart (radius RIVER_WIDTH / 2) whose
 * centers fall within range of the point. The range MUST
 * exceed SCRY_WATER_RANGE for the gate to be exact (a water
 * within gate range always has its circle in the list);
 * 50 m is the default. River samples are cut to centers
 * within range: a sample with edge distance ≤ 2.5 m has
 * center distance ≤ 5 m, so it is always included.
 */
export function stillWatersNear(gen: WorldGen, x: number, z: number, range: number = STILL_WATER_ADAPTER_RANGE): StillWaterBody[] {
  const waters: StillWaterBody[] = [];
  const pcx = Math.floor(x / CHUNK_SIZE);
  const pcz = Math.floor(z / CHUNK_SIZE);
  for (let cx = pcx - 1; cx <= pcx + 1; cx++) {
    for (let cz = pcz - 1; cz <= pcz + 1; cz++) {
      for (const obj of gen.generateChunk(cx, cz).objects) {
        if (obj.kind !== 'pond') continue;
        waters.push({ x: obj.x, z: obj.z, radius: (DISC_RADIUS['pond'] ?? 1.0) * obj.scale });
      }
    }
  }
  const params = paramsFor(gen);
  const t0 = (x - params.ox) * params.dx + (z - params.oz) * params.dz;
  for (let t = t0 - range; t <= t0 + range; t += RIVER_STEP) {
    const center = riverCenterAt(params, t);
    if (Math.hypot(center.x - x, center.z - z) <= range) {
      waters.push({ x: center.x, z: center.z, radius: RIVER_WIDTH / 2 });
    }
  }
  // Placed WATER patches ride as still-water bodies of
  // their own shape (the facing system's read — Scry and
  // Fill Jar offer at her hauled pond as at wild water).
  if (!gen.dimensionKey) {
    for (const patch of jarPatchState.all()) {
      if (patch.kind !== 'water') continue;
      if (Math.hypot(patch.x - x, patch.z - z) <= range + PATCH_R_M) {
        waters.push({ x: patch.x, z: patch.z, radius: PATCH_R_M });
      }
    }
  }
  return waters;
}

/**
 * The water discs (pond + standing water — the wading
 * model's set, wider than this family's pond-only list)
 * in the 3×3 chunks around (x, z), as movement.ts
 * WaterDisc circles. The same scan the renderer's
 * per-frame memo performs; here it is per-action priced,
 * like the rest of the adapter family.
 */
export function waterDiscsNear(gen: WorldGen, x: number, z: number): WaterDisc[] {
  const discs: WaterDisc[] = [];
  const pcx = Math.floor(x / CHUNK_SIZE);
  const pcz = Math.floor(z / CHUNK_SIZE);
  for (let cx = pcx - 1; cx <= pcx + 1; cx++) {
    for (let cz = pcz - 1; cz <= pcz + 1; cz++) {
      for (const obj of gen.generateChunk(cx, cz).objects) {
        if (obj.kind !== 'pond' && obj.kind !== 'standingWater') continue;
        discs.push({ x: obj.x, z: obj.z, r: (DISC_RADIUS[obj.kind] ?? 1.0) * obj.scale });
      }
    }
  }
  // Placed WATER patches are wading discs too — so
  // siteWaterFacts' inWater (which reads this set through
  // standingInWater) answers true inside her hauled pond.
  // MUD patches are NOT here: mud slows (the renderer's
  // movement set carries it) but never answers inWater.
  if (!gen.dimensionKey) {
    for (const patch of jarPatchState.all()) {
      if (patch.kind !== 'water') continue;
      if (Math.abs(patch.x - x) <= CHUNK_SIZE * 1.5 && Math.abs(patch.z - z) <= CHUNK_SIZE * 1.5) {
        discs.push({ x: patch.x, z: patch.z, r: PATCH_R_M });
      }
    }
  }
  return discs;
}

/** The site-water facts at a point (the trap gate's wire, 2026-11-01). */
export interface SiteWaterFacts {
  /** She is standing in water — the engine's wading fact itself. */
  inWater: boolean;
  /** A water edge is within creekRange (the crafting gate's fact). */
  nearCreek: boolean;
}

/**
 * The site-water facts at (x, z), from the engine's own
 * water model — the supplier Systems' trap site-gates
 * named (DEV routing, 2026-11-01): the weir and the pot
 * trap belong IN water, the snare / pitfall / deadfall
 * on dry land, and the shell computes these once at her
 * position and passes them in (the same call also feeds
 * crafting's nearCreek, which the shell has passed null
 * until now).
 *
 * inWater IS movement.ts's standingInWater — the river
 * ribbon (half width + the wading margin) or a pond /
 * standing-water disc (+ margin) — composed from the
 * adapter's data, never a second test that could drift
 * from the wading she feels. nearCreek is the family's
 * edge-distance fact at the scry range by default.
 *
 * A dimension generator (a cave) answers both false:
 * cave pools are their own question, not this gate's.
 */
export function siteWaterFacts(
  gen: WorldGen,
  x: number,
  z: number,
  creekRange: number = SCRY_WATER_RANGE,
): SiteWaterFacts {
  if (gen.dimensionKey) return { inWater: false, nearCreek: false };
  const inWater = standingInWater(paramsFor(gen), waterDiscsNear(gen, x, z), x, z);
  const nearCreek = distanceToWater(gen, x, z) <= creekRange;
  return { inWater, nearCreek };
}
