/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FARMHOUSES — the recurring family derivation
 * (Background claim approved 2026-11-01). The singular
 * farmhouse is the family's FIRST (unburnt, two-story,
 * ransacked — Adam's exception, enlarged 2026-10-31);
 * these are its country kin, seated on the distribution
 * pattern: coarse cells, a labelled per-cell stream, a
 * candidate seat, the farm-country taste test, and the
 * spacing law against every singular site, the cave
 * instances, the HOMESTEAD instances (this family
 * resolves after homesteads and yields to their seats),
 * and its own siblings.
 *
 * THE ASSEMBLY IS LEGO (Adam's framing, pinned): each
 * instance rolls one seeded index per PIECE SLOT —
 * footprint, window rhythm, gable end-width, porch,
 * stairs/loft dressing — resolved through the
 * table-length seam (farmhouseTable.ts), so Models'
 * authored pieces fill the slots without the derivation
 * changing. The chimney is not a slot: the roll produces
 * a chimney SEAT (a position along the ridge, plot
 * frame). The UPSTAIRS FORM rolls after the slots —
 * 'attic' or a full second 'floor' — one upstairs zone
 * per house, recorded here so exterior and interior can
 * never disagree when the zones build.
 *
 * STATE: standing-weathered, or FLED-RANSACKED (the
 * occupants left in a hurry — toppled, scattered,
 * opened; ransacked is not burnt and not raided, and
 * the hand stays ambiguous).
 *
 * FRAGMENT CARRIAGE IS NOT ROLLED. Whether distributed
 * farmhouses ever carry fragments is Adam's open dial,
 * unstated either way — this record mints no carrier,
 * asserts nothing, and waits for his word.
 *
 * This module is the DERIVATION ONLY: instance records,
 * pure in the world seed. Features, walls, scatter
 * integration, and the upstairs zones are their own
 * later landings, sequenced behind this core.
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
import { homesteadInstancesInRect, HOMESTEAD_CLEAR_RADIUS_M } from './homesteads';
import { farmhouseSlotIndex, type FarmhouseSlot } from './farmhouseTable';

/** Per-cell presence draw (DRAFT). */
export const FARMHOUSE_CELL_PRESENCE = 0.4;
/** The instance clearing's radius (m) — house + yard. */
export const FARMHOUSE_CLEAR_RADIUS_M = 22;
/** A seated instance's occupants fled, ransacked, on
 *  this draw (DRAFT — Background's flagged reading,
 *  Adam's to strike). */
export const FARMHOUSE_RANSACKED_FRACTION = 0.35;
/** The upstairs is a FULL FLOOR (not an attic) on this
 *  draw (DRAFT). */
export const FARMHOUSE_FULL_FLOOR_FRACTION = 0.3;

export type FarmhouseState = 'standing' | 'ransacked';
export type UpstairsForm = 'attic' | 'floor';

export interface FarmhouseInstance {
  /** Stable key: 'farmhouse:<cx>,<cz>'. */
  key: string;
  cellX: number;
  cellZ: number;
  /** The house seat. */
  center: { x: number; z: number };
  biome: BiomeId;
  /** The house frame's quarter-turn bearing (rad). */
  theta: number;
  /** Weathered-standing, or fled-in-a-hurry ransacked. */
  state: FarmhouseState;
  /** One resolved variant index per piece slot (the
   *  table-length seam's counts at derivation time). */
  slots: Record<FarmhouseSlot, number>;
  /** The chimney's seat along the ridge, 0..1 in the
   *  plot frame (NOT a variant index — Models' ruling). */
  chimneySeatU: number;
  /** The one upstairs form this house carries. */
  upstairsForm: UpstairsForm;
  /** The hearth stone's seat (the family's organ, as
   *  the singular's great stone). */
  hearthStone: { x: number; z: number };
  /** Yard dressing richness 0..1. */
  dressing: number;
  clearRadius: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const instanceCache = new Map<string, FarmhouseInstance | null>();

/** A cell's RAW candidate seat — fixed draw order:
 *  presence, seat jitter x, seat jitter z, taste test. */
function farmhouseCandidate(
  worldSeed: string,
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): { center: { x: number; z: number }; biome: BiomeId } | null {
  const rand = distributionCellStream(worldSeed, 'distribution:farmhouse', cx, cz);
  if (rand() >= FARMHOUSE_CELL_PRESENCE) return null;
  const x = (cx + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const z = (cz + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const w = weightsAtPos(x, z);
  if (w.dominant !== 'oldfieldRise' && w.dominant !== 'meadow') return null;
  return { center: { x, z }, biome: w.dominant };
}

/** The accepted instance for one cell, or null. */
function farmhouseInstanceAt(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): FarmhouseInstance | null {
  const cacheKey = `${worldSeed}::${cx},${cz}`;
  if (instanceCache.has(cacheKey)) return instanceCache.get(cacheKey)!;
  let result: FarmhouseInstance | null = null;
  const cand = farmhouseCandidate(worldSeed, weightsAtPos, cx, cz);
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
        s.clearRadius + FARMHOUSE_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M,
    );
    if (legal) {
      const road = sunkenRoadSite(worldSeed, spawn, weightsAtPos);
      const siding = railSidingSite(worldSeed, spawn, weightsAtPos);
      legal =
        distToSegment(x, z, road.a, road.b) >= ROAD_RIBBON_HALF_WIDTH_M + FARMHOUSE_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M &&
        distToSegment(x, z, siding.a, siding.b) >= SIDING_HALF_WIDTH_M + FARMHOUSE_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M;
    }
    // Cave instances (the earlier family): same law.
    if (legal) {
      const reach = CAVE_MOUTH_CLEAR_RADIUS_M + FARMHOUSE_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M;
      const caves = caveInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach,
        maxX: x + reach,
        minZ: z - reach,
        maxZ: z + reach,
      });
      legal = caves.every((c) => Math.hypot(x - c.center.x, z - c.center.z) >= reach);
    }
    // Homestead instances (the family before this one):
    // their seats stand; this family yields.
    if (legal) {
      const reach = HOMESTEAD_CLEAR_RADIUS_M + FARMHOUSE_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M;
      const homes = homesteadInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach,
        maxX: x + reach,
        minZ: z - reach,
        maxZ: z + reach,
      });
      legal = homes.every((h) => Math.hypot(x - h.center.x, z - h.center.z) >= reach);
    }
    // Sibling precedence (the families' shape): the cell
    // that reads first by (row, column) keeps its seat.
    if (legal) {
      const floor = FARMHOUSE_CLEAR_RADIUS_M * 2 + SITE_SPACING_MARGIN_M;
      outer: for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
        for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
          if (ncx === cx && ncz === cz) continue;
          const sib = farmhouseCandidate(worldSeed, weightsAtPos, ncx, ncz);
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
      const key = `farmhouse:${cx},${cz}`;
      // The instance's own stream — fixed order: frame,
      // state, the five slot draws, the chimney seat, the
      // upstairs form, the dressing richness.
      const rand = mulberry32(deriveSeed(worldSeed, `farmhouse:${key}`));
      const swap = rand() < 0.5;
      const theta = swap ? Math.PI / 2 : 0;
      const state: FarmhouseState = rand() < FARMHOUSE_RANSACKED_FRACTION ? 'ransacked' : 'standing';
      const slots: Record<FarmhouseSlot, number> = {
        footprint: farmhouseSlotIndex('footprint', rand()),
        windowRhythm: farmhouseSlotIndex('windowRhythm', rand()),
        gableWidth: farmhouseSlotIndex('gableWidth', rand()),
        porch: farmhouseSlotIndex('porch', rand()),
        stairsDressing: farmhouseSlotIndex('stairsDressing', rand()),
      };
      const chimneySeatU = rand();
      const upstairsForm: UpstairsForm = rand() < FARMHOUSE_FULL_FLOOR_FRACTION ? 'floor' : 'attic';
      const dressing = rand();
      // The hearth stone: ahead of the house in the plot
      // frame (the singular's placement, at family scale).
      const lx = 3.5;
      const lz = 4.5;
      const hearthStone = swap
        ? { x: x + lz, z: z - lx }
        : { x: x + lx, z: z + lz };
      result = {
        key,
        cellX: cx,
        cellZ: cz,
        center: cand.center,
        biome: cand.biome,
        theta,
        state,
        slots,
        chimneySeatU,
        upstairsForm,
        hearthStone,
        dressing,
        clearRadius: FARMHOUSE_CLEAR_RADIUS_M,
        bounds: {
          minX: x - FARMHOUSE_CLEAR_RADIUS_M,
          maxX: x + FARMHOUSE_CLEAR_RADIUS_M,
          minZ: z - FARMHOUSE_CLEAR_RADIUS_M,
          maxZ: z + FARMHOUSE_CLEAR_RADIUS_M,
        },
      };
    }
  }
  instanceCache.set(cacheKey, result);
  return result;
}

/**
 * Every registered farmhouse instance whose clearing
 * bounds intersect a world rect. Pure in (seed, rect).
 */
export function farmhouseInstancesInRect(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  rect: { minX: number; maxX: number; minZ: number; maxZ: number },
): FarmhouseInstance[] {
  const out: FarmhouseInstance[] = [];
  for (const cell of distributionCellsOverlapping(rect.minX, rect.maxX, rect.minZ, rect.maxZ)) {
    const inst = farmhouseInstanceAt(worldSeed, spawn, weightsAtPos, cell.cx, cell.cz);
    if (!inst) continue;
    const b = inst.bounds;
    if (b.maxX < rect.minX || b.minX > rect.maxX || b.maxZ < rect.minZ || b.minZ > rect.maxZ) continue;
    out.push(inst);
  }
  return out;
}

/** One registered instance by its key, or null. */
export function farmhouseInstanceForKey(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  key: string,
): FarmhouseInstance | null {
  const m = /^farmhouse:(-?\d+),(-?\d+)$/.exec(key);
  if (!m) return null;
  const inst = farmhouseInstanceAt(worldSeed, spawn, weightsAtPos, Number(m[1]), Number(m[2]));
  return inst && inst.key === key ? inst : null;
}
