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
 * Part 2 — ground materials: the ground underfoot is always in
 * proximity range (distance 0), but its BUTTON is look-down-gated
 * (Adam, 2026-10-26 refinement): ground targets appear ONLY when she
 * is looking down at the ground — otherwise the button would get in
 * the way, since ground is everywhere. Object sources are unchanged:
 * proximity only. Which material the ground is follows terrain at her
 * position (groundSourceAt, lane-decided mapping): marsh ground or
 * very wet ground -> mud; meadow/oldfield ground -> grass; everything
 * else -> dirt. The ground target's id is 'ground:<material>', so
 * walking from mud onto grass changes the target set and UI swaps
 * the button.
 *
 * "Looking down", per perspective (see LOOK_DOWN_PITCH):
 * - First-person: pitch <= -0.4 rad (about 23° below horizontal).
 *   Pitch is negative when looking down (mouse-up raises pitch).
 *   A clear intentional look-down, not a slight downward glance.
 *   Threshold lane-decided, single tunable constant.
 * - Third-person overhead: PINNED by Adam 2026-10-26 — keep the
 *   fallback. There is no look input at all (mouse look only exists
 *   in first-person, and the overhead camera at offset (0, 16, 10)
 *   looks steeply down by construction), so "looking down" is
 *   trivially true there — and the clutter problem Adam named is
 *   solved by the fallback rule: in third-person the ground target
 *   appears ONLY when no scatter target is in range. Adam's words:
 *   "object in range for harvest is ok" — objects in range win.
 *   Ground is the fallback action when nothing else is near, never
 *   a competitor to object buttons. This rule is now Adam-pinned,
 *   not lane-decided; it was already live and is unchanged by the
 *   pin, only its marking.
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
 *   Also excluded by the TRACKER (not by pure findInRange): regrowing
 *   targets (shrunk, not yet regrown — see harvestState.ts) and
 *   removed targets (the wrapped generator filters those). Spawned
 *   logs are appended by the tracker as ordinary scatter targets.
 * - No occlusion yet: range is distance only, through objects and
 *   walls alike. That is a known limit for a later pass, not a bug
 *   to paper over here.
 */

import { bus } from './events';
import { marshWeight } from './biomes';
import { CHUNK_SIZE } from '../constants';
import {
  SOURCE_BY_ID,
  SOURCE_FOR_KIND,
  GROUND_MATERIAL_BY_ID,
  type GroundMaterialDef,
} from './objects';
import { harvestState, scatterTargetId } from './harvestState';

export { scatterTargetId };
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

/**
 * First-person look-down threshold in radians (lane-decided starting
 * value, single tunable constant like HARVEST_RANGE). Pitch <= this
 * means looking down: about 23° below horizontal. Pitch is negative
 * when looking down (mouse-up raises pitch, clamped to ±1.45 rad).
 */
export const LOOK_DOWN_PITCH = -0.4;

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

/** The ground target at (x, z): always distance 0, always "in range"
 *  by proximity — whether its BUTTON appears is the look-down gate,
 *  decided by the caller/tracker, not here. */
export function groundTarget(gen: WorldGen, x: number, z: number): HarvestTarget {
  const ground = groundSourceAt(gen, x, z);
  return {
    id: `ground:${ground.id}`,
    sourceId: ground.id,
    kind: 'ground',
    x,
    z,
    distance: 0,
    name: ground.name,
    primaryYield: ground.primaryYield,
    permitTier: ground.permitTier,
  };
}

/**
 * All in-range harvest targets at (x, z): the ground target first when
 * lookingDown is true (default true, for callers that do not gate),
 * then scatter sources within HARVEST_RANGE, nearest first. Scatter
 * target ids are stable across regenerations (they encode chunk +
 * kind + position), so the tracker can diff by id. Object sources are
 * NOT look-gated — only ground is.
 */
export function findInRange(
  gen: WorldGen,
  x: number,
  z: number,
  lookingDown = true,
): HarvestTarget[] {
  const targets: HarvestTarget[] = lookingDown ? [groundTarget(gen, x, z)] : [];

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
          id: scatterTargetId(cx, cz, obj),
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
 * Watches 'player:moved', 'player:looked', and 'camera:switched' and
 * emits 'harvest:inRange' only when the target set changes. The
 * renderer owns one instance (see WorldRenderer); Systems/tests can
 * construct their own and call update() directly. dispose()
 * unsubscribes from all three.
 *
 * Look-down gating lives here, not in findInRange's callers: the
 * tracker remembers her last position, mode, and pitch, so a
 * stationary look-down (a 'player:looked' with no movement) still
 * re-evaluates, and a camera switch does too.
 * - First-person: ground appears iff pitch <= LOOK_DOWN_PITCH.
 * - Third-person: ground appears iff no scatter target is in range
 *   (fallback rule — see the header; lane-decided, flaggable).
 * Scatter targets are never look-gated in either perspective.
 */
export class ProximityTracker {
  private gen: WorldGen;
  private lastIds = new Set<string>();
  private lastX: number | null = null;
  private lastZ: number | null = null;
  private lastMode: 'first' | 'third' = 'third';
  private lastPitch = 0;
  private unsubscribes: (() => void)[] = [];

  constructor(gen: WorldGen, subscribe = true) {
    this.gen = gen;
    if (subscribe) {
      this.unsubscribes = [
        bus.on('player:moved', (p) => this.update(p.x, p.z)),
        bus.on('player:looked', (p) => {
          this.lastMode = p.mode;
          this.lastPitch = p.pitch;
          this.recompute();
        }),
        bus.on('camera:switched', (p) => {
          this.lastMode = p.mode;
          this.recompute();
        }),
      ];
    }
  }

  setGen(gen: WorldGen): void {
    this.gen = gen;
    this.lastIds = new Set();
  }

  /** Move to (x, z) and recompute; emit only if the set changed. */
  update(x: number, z: number): HarvestTarget[] {
    this.lastX = x;
    this.lastZ = z;
    return this.recompute();
  }

  private recompute(): HarvestTarget[] {
    if (this.lastX === null || this.lastZ === null) return [];
    // State filtering (shrink + regrow model, Adam 2026-10-26):
    // regrowing targets are NOT buttons — they show shrunk in the
    // world but cannot be harvested again until regrown. Removed
    // targets never reach here (the wrapped generator filters
    // them). Spawned logs (log-renewal system) are appended as
    // ordinary scatter targets. The filter runs BEFORE the
    // third-person ground fallback, so a nearby regrowing plant
    // does not suppress the ground button — only actually
    // harvestable scatter does (Adam-pinned fallback).
    const now = Date.now();
    const scatter = findInRange(this.gen, this.lastX, this.lastZ, false).filter(
      (t) => !harvestState.isRegrowing(t.id, now),
    );
    const logSource = SOURCE_BY_ID['fallenLog'];
    if (logSource) {
      for (const log of harvestState.spawnedLogsInRange(
        this.lastX,
        this.lastZ,
        HARVEST_RANGE,
      )) {
        const distance = Math.hypot(log.x - this.lastX, log.z - this.lastZ);
        scatter.push({
          id: log.id,
          sourceId: logSource.id,
          kind: 'scatter',
          x: log.x,
          z: log.z,
          distance,
          name: logSource.name,
          primaryYield: logSource.primaryYield ?? '',
          permitTier: logSource.permitTier,
        });
      }
      scatter.sort((a, b) => a.distance - b.distance);
    }
    const groundEligible =
      this.lastMode === 'first'
        ? this.lastPitch <= LOOK_DOWN_PITCH
        : scatter.length === 0;
    const targets = groundEligible
      ? [groundTarget(this.gen, this.lastX, this.lastZ), ...scatter]
      : scatter;
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
    for (const unsub of this.unsubscribes) unsub();
    this.unsubscribes = [];
  }
}
