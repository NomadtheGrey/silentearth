/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RAIDED HOMESTEADS — the derivation (Background claim
 * approved 2026-10-31). A recurring family on the
 * distribution pattern (the caves' shape): coarse cells,
 * a labelled per-cell stream, a candidate seat, the
 * biome taste test, and the spacing law against every
 * singular site, the cave instances, and its own
 * siblings.
 *
 * ADAM'S RULING AS A DERIVATION: homesteads that carry
 * fragments are BURNT AND RAIDED — the Reapers' work.
 * So fragment presence is the instance's one seeded
 * roll, and BURNT IS NEVER ROLLED: burnt === carries,
 * in both directions, by construction. A homestead
 * without a fragment stands ordinary — weathered, empty,
 * unburnt. The census probe asserts the equivalence.
 *
 * THE FRAGMENT SEAT is the instance's GREAT STONE (its
 * hearth stone, the farmhouse's organ at family scale):
 * the fragment presents carved into the stone, and the
 * instance's fragmentSpot reads it, as the shell's
 * fragment machinery reads the caves'.
 *
 * THE FARMHOUSE SINGULAR IS EXCLUDED ENTIRELY: it is
 * held out of this family's derivation (Adam's
 * exception — unburnt, two-story, ransacked, its own
 * Home fragment whole) and enters here only as a
 * singular the spacing law respects.
 *
 * This module is the DERIVATION ONLY: instance records,
 * pure in the world seed. Scatter, kinds, and the
 * charred kit are the integration landing (Models'
 * charred-variant builders are its dependency). The
 * farmhouse FAMILY, when it lands, resolves after this
 * family and yields to these seats, as this family
 * yields to the singulars.
 */

import type { BiomeId, BiomeWeights } from '../types';
import {
  barnSite,
  caveMouthSite,
  chapelSite,
  distToSegment,
  drownedMillSite,
  farmhouseSite,
  generalStoreSite,
  groveSite,
  railSidingSite,
  schoolhouseSite,
  siloSite,
  sunkenRoadSite,
  villageSite,
  waterTowerSite,
  CAVE_MOUTH_CLEAR_RADIUS_M,
  ROAD_RIBBON_HALF_WIDTH_M,
  SIDING_HALF_WIDTH_M,
  SITE_SPACING_MARGIN_M,
} from './sites';
import {
  DISTRIBUTION_CELL_M,
  distributionCellStream,
  distributionCellsOverlapping,
} from './distribution';
import { deriveSeed, mulberry32 } from './seed';
import { caveInstancesInRect } from './caves';

/** Per-cell presence draw (DRAFT). */
export const HOMESTEAD_CELL_PRESENCE = 0.45;
/** The instance clearing's radius (m) — house + yard. */
export const HOMESTEAD_CLEAR_RADIUS_M = 20;
/** A seated instance carries a fragment on this draw (DRAFT). */
export const HOMESTEAD_FRAGMENT_PRESENCE = 0.5;

export interface HomesteadInstance {
  /** Stable key: 'homestead:<cx>,<cz>'. */
  key: string;
  cellX: number;
  cellZ: number;
  /** The house seat. */
  center: { x: number; z: number };
  biome: BiomeId;
  /** Plot bearing (rad). */
  theta: number;
  /** THE ROLL: this instance carries a fragment on its great stone. */
  carriesFragment: boolean;
  /**
   * DERIVED, never rolled — Adam's ruling as a
   * derivation: burnt === carriesFragment, always.
   */
  burnt: boolean;
  /** The great stone's seat (the instance's hearth stone). */
  greatStone: { x: number; z: number };
  /** Where the fragment machinery reads: the stone, when one is carried. */
  fragmentSpot: { x: number; z: number } | null;
  /** Yard dressing richness 0..1 (the integration landing consumes). */
  dressing: number;
  clearRadius: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const instanceCache = new Map<string, HomesteadInstance | null>();

/** A cell's RAW candidate seat — fixed draw order:
 *  presence, seat jitter x, seat jitter z, taste test. */
function homesteadCandidate(
  worldSeed: string,
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): { center: { x: number; z: number }; biome: BiomeId } | null {
  const rand = distributionCellStream(worldSeed, 'distribution:homestead', cx, cz);
  if (rand() >= HOMESTEAD_CELL_PRESENCE) return null;
  const x = (cx + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const z = (cz + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const w = weightsAtPos(x, z);
  if (w.dominant !== 'oldfieldRise' && w.dominant !== 'meadow') return null;
  return { center: { x, z }, biome: w.dominant };
}

/** The accepted instance for one cell, or null. */
function homesteadInstanceAt(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): HomesteadInstance | null {
  const cacheKey = `${worldSeed}::${cx},${cz}`;
  if (instanceCache.has(cacheKey)) return instanceCache.get(cacheKey)!;
  let result: HomesteadInstance | null = null;
  const cand = homesteadCandidate(worldSeed, weightsAtPos, cx, cz);
  if (cand) {
    const { x, z } = cand.center;
    const biomeAt = (px: number, pz: number) => weightsAtPos(px, pz).dominant;
    const singulars = [
      groveSite(worldSeed, spawn, biomeAt),
      schoolhouseSite(worldSeed, spawn, weightsAtPos),
      villageSite(worldSeed, spawn, weightsAtPos),
      farmhouseSite(worldSeed, spawn, weightsAtPos),
      chapelSite(worldSeed, spawn, weightsAtPos),
      caveMouthSite(worldSeed, spawn, weightsAtPos),
      generalStoreSite(worldSeed, spawn, weightsAtPos),
      drownedMillSite(worldSeed, spawn, weightsAtPos),
      barnSite(worldSeed, spawn, weightsAtPos),
      siloSite(worldSeed, spawn, weightsAtPos),
      waterTowerSite(worldSeed, spawn, weightsAtPos),
    ];
    let legal = singulars.every(
      (s) =>
        Math.hypot(x - s.center.x, z - s.center.z) >=
        s.clearRadius + HOMESTEAD_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M,
    );
    if (legal) {
      const road = sunkenRoadSite(worldSeed, spawn, weightsAtPos);
      const siding = railSidingSite(worldSeed, spawn, weightsAtPos);
      legal =
        distToSegment(x, z, road.a, road.b) >= ROAD_RIBBON_HALF_WIDTH_M + HOMESTEAD_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M &&
        distToSegment(x, z, siding.a, siding.b) >= SIDING_HALF_WIDTH_M + HOMESTEAD_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M;
    }
    // Cave instances (the earlier family): same law.
    if (legal) {
      const reach = CAVE_MOUTH_CLEAR_RADIUS_M + HOMESTEAD_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M;
      const caves = caveInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach,
        maxX: x + reach,
        minZ: z - reach,
        maxZ: z + reach,
      });
      legal = caves.every((c) => Math.hypot(x - c.center.x, z - c.center.z) >= reach);
    }
    // Sibling precedence (the caves' shape): the cell
    // that reads first by (row, column) keeps its seat.
    if (legal) {
      const floor = HOMESTEAD_CLEAR_RADIUS_M * 2 + SITE_SPACING_MARGIN_M;
      outer: for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
        for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
          if (ncx === cx && ncz === cz) continue;
          const sib = homesteadCandidate(worldSeed, weightsAtPos, ncx, ncz);
          if (!sib) continue;
          const d = Math.hypot(x - sib.center.x, z - sib.center.z);
          if (d < floor && (ncz < cz || (ncz === cz && ncx < cx))) {
            legal = false;
            break outer;
          }
        }
      }
    }
    if (legal) {
      const key = `homestead:${cx},${cz}`;
      // The instance's own stream: bearing, the fragment
      // roll, the dressing richness — fixed order.
      const rand = mulberry32(deriveSeed(worldSeed, `homestead:${key}`));
      const theta = rand() * Math.PI * 2;
      const carriesFragment = rand() < HOMESTEAD_FRAGMENT_PRESENCE;
      const dressing = rand();
      // The great stone: ahead of the house plot in the
      // plot frame (the farmhouse's hearth placement,
      // at family scale).
      const lx = 3.5;
      const lz = 4.5;
      const greatStone = {
        x: x + lx * Math.cos(theta) - lz * Math.sin(theta),
        z: z + lx * Math.sin(theta) + lz * Math.cos(theta),
      };
      result = {
        key,
        cellX: cx,
        cellZ: cz,
        center: cand.center,
        biome: cand.biome,
        theta,
        carriesFragment,
        burnt: carriesFragment,
        greatStone,
        fragmentSpot: carriesFragment ? greatStone : null,
        dressing,
        clearRadius: HOMESTEAD_CLEAR_RADIUS_M,
        bounds: {
          minX: x - HOMESTEAD_CLEAR_RADIUS_M,
          maxX: x + HOMESTEAD_CLEAR_RADIUS_M,
          minZ: z - HOMESTEAD_CLEAR_RADIUS_M,
          maxZ: z + HOMESTEAD_CLEAR_RADIUS_M,
        },
      };
    }
  }
  instanceCache.set(cacheKey, result);
  return result;
}

/**
 * Every registered homestead instance whose clearing
 * bounds intersect a world rect. Pure in (seed, rect).
 */
export function homesteadInstancesInRect(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  rect: { minX: number; maxX: number; minZ: number; maxZ: number },
): HomesteadInstance[] {
  const out: HomesteadInstance[] = [];
  for (const cell of distributionCellsOverlapping(rect.minX, rect.maxX, rect.minZ, rect.maxZ)) {
    const inst = homesteadInstanceAt(worldSeed, spawn, weightsAtPos, cell.cx, cell.cz);
    if (!inst) continue;
    const b = inst.bounds;
    if (b.maxX < rect.minX || b.minX > rect.maxX || b.maxZ < rect.minZ || b.minZ > rect.maxZ) continue;
    out.push(inst);
  }
  return out;
}

/** One registered instance by its key, or null. */
export function homesteadInstanceForKey(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  key: string,
): HomesteadInstance | null {
  const m = /^homestead:(-?\d+),(-?\d+)$/.exec(key);
  if (!m) return null;
  const inst = homesteadInstanceAt(worldSeed, spawn, weightsAtPos, Number(m[1]), Number(m[2]));
  return inst && inst.key === key ? inst : null;
}
