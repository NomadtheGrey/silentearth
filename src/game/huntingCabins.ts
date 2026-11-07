/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HUNTING CABINS — the derivation (Background, 2026-11-07;
 * the Home structures program's FIRST FAMILY, Adam via
 * DEV). A recurring family on the distribution pattern
 * (the homesteads' shape): coarse cells, a labelled
 * per-cell stream, a candidate seat in the WOODS, the
 * spacing law against every singular site, the ribbons,
 * the cave instances, the homesteads (the cabins land
 * last and yield), and its own siblings.
 *
 * THE STRUCTURE is Models' whole-cabin kinds
 * (huntCabin / huntCabinLean / huntCabinBare — one
 * feature per cabin, 2ae9a77): log walls with a door
 * GAP on the +Z long side, a stone chimney, and an
 * empty hearth-seat volume inside. The derivation
 * seats a hearthStone at that seat (Models' header:
 * 'the homestead idiom') and the fragment rides it.
 * Siting facts ride Models' CABIN_* constants so
 * geometry and collision can never drift apart.
 *
 * CARRIAGE DECLARED AT BIRTH (the program's standing
 * rule): every cabin carries a HOME fragment — every
 * state, intact, leaning, or bare (the burnt-homestead
 * precedent: a ruined hearth still seats its stone).
 * The mark is dealt by the pillar table (homeDeal —
 * no cabin specializes), the arc by the one mint
 * range; the mint is restated here to keep the
 * derivation self-contained (the villages' idiom).
 *
 * The cabin seats on the QUARTER-TURN frame every
 * house in the game reads by, so its collision boxes
 * and roof rects stay axis-aligned and exact.
 */

import type { BiomeId, BiomeWeights, ScatterKind, ScatterObject } from '../types';
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
  type SiteWallBox,
  type RoofRect,
} from './sites';
import {
  DISTRIBUTION_CELL_M,
  distributionCellStream,
  distributionCellsOverlapping,
} from './distribution';
import { deriveSeed, mulberry32 } from './seed';
import { caveInstancesInRect } from './caves';
import { homesteadInstancesInRect, HOMESTEAD_CLEAR_RADIUS_M } from './homesteads';
import type { FragmentCarrier } from './carriers';
import { dealFragmentArc } from './fragmentArc';
import { dealHomeMark } from './homeDeal';
import {
  CABIN_WALL_W_M,
  CABIN_WALL_D_M,
  CABIN_DOOR,
  CABIN_HEARTH_SEAT,
  CABIN_CLEAR_ASK_M,
} from './models';

/** Per-cell presence draw in woods cells (DRAFT —
 * DEV's starting number, 2026-11-07). */
export const CABIN_CELL_PRESENCE = 0.35;
/** Collision half-thickness of a cabin wall (m, DRAFT). */
export const CABIN_WALL_HALF_T = 0.15;
/** The three states' shares of the state roll, in
 * kind order (intact, leaning, bare). DRAFT. */
export const CABIN_STATE_SHARES: readonly number[] = [0.55, 0.3, 0.15];
export const CABIN_KINDS: readonly ScatterKind[] = ['huntCabin', 'huntCabinLean', 'huntCabinBare'];

export interface HuntingCabinInstance {
  /** Stable key: 'cabin:<cx>,<cz>'. */
  key: string;
  cellX: number;
  cellZ: number;
  /** The cabin seat. */
  center: { x: number; z: number };
  biome: BiomeId;
  /** Quarter-turn bearing (rad): 0, PI/2, PI, or 3PI/2. */
  theta: number;
  /** The state kind this cabin wears. */
  kind: ScatterKind;
  /** The hearth stone's seat, inside at Models' hearth seat. */
  hearthSpot: { x: number; z: number };
  /** Where the fragment machinery reads: the hearth, always (carriage at birth). */
  fragmentSpot: { x: number; z: number };
  /** The carrier facts, minted at birth: a dealt Home-pillar mark, the one arc range. */
  fragmentCarrier: FragmentCarrier;
  /** Roofed interiors + roofed porch/lean-to for the rain-shelter read. */
  roofRects: RoofRect[];
  /** The cabin + its hearth stone as scatter (the site pass emits). */
  features: ScatterObject[];
  /** Collision boxes: the wall rectangle, the door side split at the gap. */
  walls: SiteWallBox[];
  clearRadius: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const instanceCache = new Map<string, HuntingCabinInstance | null>();

/** A cell's RAW candidate seat — fixed draw order:
 *  presence, seat jitter x, seat jitter z, taste test.
 *  The taste is the WOODS: forest or tanglewood. */
function cabinCandidate(
  worldSeed: string,
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): { center: { x: number; z: number }; biome: BiomeId } | null {
  const rand = distributionCellStream(worldSeed, 'distribution:hunting-cabin', cx, cz);
  if (rand() >= CABIN_CELL_PRESENCE) return null;
  const x = (cx + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const z = (cz + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const w = weightsAtPos(x, z);
  if (w.dominant !== 'forest' && w.dominant !== 'tanglewood') return null;
  return { center: { x, z }, biome: w.dominant };
}

/** Rotate a local point by the quarter-turn frame. */
function rot(lx: number, lz: number, cos: number, sin: number): { x: number; z: number } {
  return { x: lx * cos - lz * sin, z: lx * sin + lz * cos };
}

/** A local axis-aligned box as a world AABB under the frame. */
function boxAt(
  center: { x: number; z: number },
  cos: number,
  sin: number,
  minLx: number,
  maxLx: number,
  minLz: number,
  maxLz: number,
): SiteWallBox {
  const corners = [
    rot(minLx, minLz, cos, sin),
    rot(minLx, maxLz, cos, sin),
    rot(maxLx, minLz, cos, sin),
    rot(maxLx, maxLz, cos, sin),
  ];
  const xs = corners.map((c) => center.x + c.x);
  const zs = corners.map((c) => center.z + c.z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

function cabinInstanceAt(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): HuntingCabinInstance | null {
  const cacheKey = `${worldSeed}::${cx},${cz}`;
  if (instanceCache.has(cacheKey)) return instanceCache.get(cacheKey)!;
  let result: HuntingCabinInstance | null = null;
  const cand = cabinCandidate(worldSeed, weightsAtPos, cx, cz);
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
        s.clearRadius + CABIN_CLEAR_ASK_M + SITE_SPACING_MARGIN_M,
    );
    if (legal) {
      const road = sunkenRoadSite(worldSeed, spawn, weightsAtPos);
      const siding = railSidingSite(worldSeed, spawn, weightsAtPos);
      legal =
        distToSegment(x, z, road.a, road.b) >= ROAD_RIBBON_HALF_WIDTH_M + CABIN_CLEAR_ASK_M + SITE_SPACING_MARGIN_M &&
        distToSegment(x, z, siding.a, siding.b) >= SIDING_HALF_WIDTH_M + CABIN_CLEAR_ASK_M + SITE_SPACING_MARGIN_M;
    }
    // Cave instances (an earlier family): same law.
    if (legal) {
      const reach = CAVE_MOUTH_CLEAR_RADIUS_M + CABIN_CLEAR_ASK_M + SITE_SPACING_MARGIN_M;
      const caves = caveInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach,
        maxX: x + reach,
        minZ: z - reach,
        maxZ: z + reach,
      });
      legal = caves.every((c) => Math.hypot(x - c.center.x, z - c.center.z) >= reach);
    }
    // Homesteads (an earlier family): the cabins yield.
    if (legal) {
      const reach = HOMESTEAD_CLEAR_RADIUS_M + CABIN_CLEAR_ASK_M + SITE_SPACING_MARGIN_M;
      const homes = homesteadInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach,
        maxX: x + reach,
        minZ: z - reach,
        maxZ: z + reach,
      });
      legal = homes.every((h) => Math.hypot(x - h.center.x, z - h.center.z) >= reach);
    }
    // Sibling precedence: the cell that reads first by
    // (row, column) keeps its seat.
    if (legal) {
      const floor = CABIN_CLEAR_ASK_M * 2 + SITE_SPACING_MARGIN_M;
      outer: for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
        for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
          if (ncx === cx && ncz === cz) continue;
          const sib = cabinCandidate(worldSeed, weightsAtPos, ncx, ncz);
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
      const key = `cabin:${cx},${cz}`;
      // The instance's own stream: the quarter turn,
      // the state roll — fixed order.
      const rand = mulberry32(deriveSeed(worldSeed, `hunting-cabin:${key}`));
      const theta = Math.floor(rand() * 4) * (Math.PI / 2);
      const stateDraw = rand();
      let kind: ScatterKind = CABIN_KINDS[0];
      let acc = 0;
      for (let i = 0; i < CABIN_KINDS.length; i++) {
        acc += CABIN_STATE_SHARES[i];
        if (stateDraw < acc) {
          kind = CABIN_KINDS[i];
          break;
        }
      }
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const toWorld = (lx: number, lz: number): { x: number; z: number } => {
        const r = rot(lx, lz, cos, sin);
        return { x: x + r.x, z: z + r.z };
      };
      const hearthSpot = toWorld(CABIN_HEARTH_SEAT.x, CABIN_HEARTH_SEAT.z);
      // The carrier facts (minted here, self-contained;
      // the arc deal is the one mint range, carriers.ts).
      const crand = mulberry32(deriveSeed(worldSeed, `carrier:${key}`));
      const fragmentCarrier: FragmentCarrier = {
        fragmentId: `${key}:fragment`,
        mark: dealHomeMark(worldSeed, key),
        ...dealFragmentArc(crand),
      };
      const features: ScatterObject[] = [
        { kind, x, z, y: 0, scale: 1, rotY: theta },
        { kind: 'hearthStone', x: hearthSpot.x, z: hearthSpot.z, y: 0, scale: 1, rotY: theta },
      ];
      // The wall rectangle, half-thickness out; the door
      // side (+Z local) splits at the door gap.
      const hw = CABIN_WALL_W_M / 2;
      const hd = CABIN_WALL_D_M / 2;
      const t = CABIN_WALL_HALF_T;
      const gap0 = CABIN_DOOR.offsetX - CABIN_DOOR.width / 2;
      const gap1 = CABIN_DOOR.offsetX + CABIN_DOOR.width / 2;
      const walls: SiteWallBox[] = [
        boxAt(cand.center, cos, sin, -hw, hw, -hd - t, -hd + t),
        boxAt(cand.center, cos, sin, -hw, gap0, hd - t, hd + t),
        boxAt(cand.center, cos, sin, gap1, hw, hd - t, hd + t),
        boxAt(cand.center, cos, sin, -hw - t, -hw + t, -hd, hd),
        boxAt(cand.center, cos, sin, hw - t, hw + t, -hd, hd),
      ];
      // Roofs: the wall rectangle shelters in every
      // state (the bare cabin keeps its roof); the
      // intact cabin's porch and the leaning cabin's
      // lean-to add their slabs' rects.
      const roofRects: RoofRect[] = [boxAt(cand.center, cos, sin, -hw + 0.3, hw - 0.3, -hd + 0.3, hd - 0.3)];
      if (kind === 'huntCabin') roofRects.push(boxAt(cand.center, cos, sin, -2.25, 2.25, 1.6, 3.0));
      if (kind === 'huntCabinLean') roofRects.push(boxAt(cand.center, cos, sin, 1.9, 3.3, -1.65, 1.65));
      result = {
        key,
        cellX: cx,
        cellZ: cz,
        center: cand.center,
        biome: cand.biome,
        theta,
        kind,
        hearthSpot,
        fragmentSpot: hearthSpot,
        fragmentCarrier,
        roofRects,
        features,
        walls,
        clearRadius: CABIN_CLEAR_ASK_M,
        bounds: {
          minX: x - CABIN_CLEAR_ASK_M,
          maxX: x + CABIN_CLEAR_ASK_M,
          minZ: z - CABIN_CLEAR_ASK_M,
          maxZ: z + CABIN_CLEAR_ASK_M,
        },
      };
    }
  }
  instanceCache.set(cacheKey, result);
  return result;
}

/**
 * Every registered hunting-cabin instance whose
 * clearing bounds intersect a world rect. Pure in
 * (seed, rect).
 */
export function huntingCabinInstancesInRect(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  rect: { minX: number; maxX: number; minZ: number; maxZ: number },
): HuntingCabinInstance[] {
  const out: HuntingCabinInstance[] = [];
  for (const cell of distributionCellsOverlapping(rect.minX, rect.maxX, rect.minZ, rect.maxZ)) {
    const inst = cabinInstanceAt(worldSeed, spawn, weightsAtPos, cell.cx, cell.cz);
    if (!inst) continue;
    const b = inst.bounds;
    if (b.maxX < rect.minX || b.minX > rect.maxX || b.maxZ < rect.minZ || b.minZ > rect.maxZ) continue;
    out.push(inst);
  }
  return out;
}

/** One registered instance by its key, or null. */
export function huntingCabinInstanceForKey(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  key: string,
): HuntingCabinInstance | null {
  const m = /^cabin:(-?\d+),(-?\d+)$/.exec(key);
  if (!m) return null;
  const inst = cabinInstanceAt(worldSeed, spawn, weightsAtPos, Number(m[1]), Number(m[2]));
  return inst && inst.key === key ? inst : null;
}
