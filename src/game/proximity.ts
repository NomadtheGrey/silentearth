/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PROXIMITY HARVESTING (2026-10-26, Adam's task; radius lane-decided).
 *
 * Part 1 — range check: a harvestable source is in range when the witch
 * is within HARVEST_RANGE of it (2D distance, ground is flat). The
 * tracker subscribes to 'player:moved' on the shared bus and emits
 * 'harvest:inRange' only when the SET of in-range targets changes
 * (enter/leave) — steady walking does not spam UI. UI renders one
 * harvest button per target from that event and hides buttons for
 * targets that left; pressing a button emits 'harvest:requested' (UI
 * side) — the outcome (items into inventory) is the NEXT step, not
 * here: no listener in this landing grants items.
 *
 * Part 2 — ground materials: the ground underfoot is always in range
 * (distance 0), so the ground button is always available — that is
 * Adam's "harvest nearly anyplace" ruling, not a bug. Which material
 * it is follows terrain at her position (groundSourceAt, lane-decided
 * mapping): marsh ground or very wet ground -> mud; meadow/oldfield
 * ground -> grass; everything else -> dirt. The ground target's id is
 * 'ground:<material>', so walking from mud onto grass changes the
 * target set and UI swaps the button.
 *
 * Design notes:
 * - Pure + deterministic: findInRange regenerates the chunks
 *   overlapping the radius from the seeded generator (chunks are pure
 *   functions of seed + coords, so regeneration is exact). At a 2.5 m
 *   radius that is at most 4 chunks of 40 scatter each — trivial at
 *   the 10 Hz 'player:moved' rate, and it needs no renderer state.
 *   If the radius ever grows, cache chunk data instead of regenerating.
 * - No Math.random anywhere; no tool knowledge: proximity does NOT
 *   gate by tool (Systems owns tool state). It carries permitTier so
 *   UI/Systems can filter; a below-permit target still appears, and
 *   Systems re-validates range + permit at outcome time.
 * - Excluded from targets: non-harvestable ground character (vine,
 *   bog patch, standing water, marsh grass, flowers, tall trees) and
 *   anchors (the stump is claimed as a workstation, not harvested).
 * - No occlusion yet: range is distance only, through objects and
 *   walls alike. That is a known limit for a later pass, not a bug
 *   to paper over here.
 */

import { bus } from './events';
import { marshWeight } from './biomes';
import { CHUNK_SIZE } from '../constants';
import {
  SOURCE_FOR_KIND,
  GROUND_MATERIAL_BY_ID,
  type GroundMaterialDef,
} from './objects';
import type { WorldGen } from './worldgen';
import type { ScatterKind } from '../types';

/**
 * Proximity radius in metres (lane-decided starting value, single
 * tunable constant — tune here and everything follows). Rationale:
 * about an arm's reach plus a step: standing AT a source reads as in
 * range without pixel-perfect positioning, and at 5 m/s with 10 Hz
 * position updates (0.5 m per tick) it neither flickers nor reaches
 * absurdly far. Smaller would be fiddly; larger would harvest through
 * the scenery.
 */
export const HARVEST_RANGE = 2.5;

/** One in-range harvest target, matching the 'harvest:inRange' payload. */
export interface HarvestTarget {
  id: string;
  sourceId: string;
  kind: 'scatter' | 'ground';
  x: number;
  z: number;
  distance: number;
  name: string;
  primaryYield: string;
  permitTier: import('./objects').PermitTier;
}

/**
 * Ground material at a position (lane-decided mapping, 2026-10-26).
 * Precedence is deliberate: wetness first (mud is about water, not
 * biome labels), then open-grass biomes, then the dirt default.
 * - Marsh ground character strong (> 0.5) OR wetness >= 0.60 -> mud
 *   (marsh, bog, creek edges, sloppy mire and damp tangle — the wet
 *   biomes read as mud underfoot).
 * - Dominant meadow or oldfieldRise -> grass (open grassland).
 * - Everything else -> dirt (dry ground, salt flat mineral earth,
 *   forest/tangle floor — woodland floor is litter and dirt, not lawn).
 */
export function groundSourceAt(gen: WorldGen, x: number, z: number): GroundMaterialDef {
  const fields = gen.fieldsAt(x, z);
  if (marshWeight(fields) > 0.5 || fields.wetness >= 0.6) {
    return GROUND_MATERIAL_BY_ID.mud;
  }
  const dominant = gen.weightsAt(x, z).dominant;
  if (dominant === 'meadow' || dominant === 'oldfieldRise') {
    return GROUND_MATERIAL_BY_ID.grass;
  }
  return GROUND_MATERIAL_BY_ID.dirt;
}

/**
 * All in-range harvest targets at (x, z), ground target first (it is
 * always present), then scatter sources within HARVEST_RANGE, nearest
 * first. Scatter target ids are stable across regenerations (they
 * encode chunk + kind + position), so the tracker can diff by id.
 */
export function findInRange(gen: WorldGen, x: number, z: number): HarvestTarget[] {
  const ground = groundSourceAt(gen, x, z);
  const targets: HarvestTarget[] = [
    {
      id: `ground:${ground.id}`,
      sourceId: ground.id,
      kind: 'ground',
      x,
      z,
      distance: 0,
      name: ground.name,
      primaryYield: ground.primaryYield,
      permitTier: ground.permitTier,
    },
  ];

  const minCx = Math.floor((x - HARVEST_RANGE) / CHUNK_SIZE);
  const maxCx = Math.floor((x + HARVEST_RANGE) / CHUNK_SIZE);
  const minCz = Math.floor((z - HARVEST_RANGE) / CHUNK_SIZE);
  const maxCz = Math.floor((z + HARVEST_RANGE) / CHUNK_SIZE);
  const scatter: HarvestTarget[] = [];
  for (let cz = minCz; cz <= maxCz; cz++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (const obj of gen.generateChunk(cx, cz).objects) {
        const source = SOURCE_FOR_KIND[obj.kind as ScatterKind];
        if (!source || !source.harvestable || source.anchor || source.permitTier === null) {
          continue;
        }
        const distance = Math.hypot(obj.x - x, obj.z - z);
        if (distance > HARVEST_RANGE) continue;
        scatter.push({
          id: `scatter:${cx},${cz}:${obj.kind}:${obj.x.toFixed(2)},${obj.z.toFixed(2)}`,
          sourceId: source.id,
          kind: 'scatter',
          x: obj.x,
          z: obj.z,
          distance,
          name: source.name,
          primaryYield: source.primaryYield ?? '',
          permitTier: source.permitTier,
        });
      }
    }
  }
  scatter.sort((a, b) => a.distance - b.distance);
  return [...targets, ...scatter];
}

/**
 * Watches 'player:moved' and emits 'harvest:inRange' only when the
 * target set changes. The renderer owns one instance (see
 * WorldRenderer); Systems/tests can construct their own and call
 * update() directly. dispose() unsubscribes.
 */
export class ProximityTracker {
  private gen: WorldGen;
  private lastIds = new Set<string>();
  private unsubscribe: (() => void) | null = null;

  constructor(gen: WorldGen, subscribe = true) {
    this.gen = gen;
    if (subscribe) {
      this.unsubscribe = bus.on('player:moved', (p) => this.update(p.x, p.z));
    }
  }

  setGen(gen: WorldGen): void {
    this.gen = gen;
    this.lastIds = new Set();
  }

  /** Recompute targets at (x, z); emit only if the set changed. */
  update(x: number, z: number): HarvestTarget[] {
    const targets = findInRange(this.gen, x, z);
    const ids = new Set(targets.map((t) => t.id));
    const changed =
      ids.size !== this.lastIds.size || [...ids].some((id) => !this.lastIds.has(id));
    if (changed) {
      this.lastIds = ids;
      bus.emit('harvest:inRange', { targets });
    }
    return targets;
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
