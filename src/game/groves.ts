/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LESSER GROVES — THE DISTRIBUTION FAMILY (Adam's
 * correction, 2026-11-05: "The groves are supposed to be
 * generated in similar fashion as the caves and
 * homesteads and such, from seed/location/etc."). Until
 * this build the world derived exactly ONE grove — the
 * authored Grove of sites.ts, maze and all — while the
 * principle always intended a family. This module is
 * that family, on the caves/homesteads idiom: one
 * candidate per distribution cell on the family's own
 * stream, seated by taste, spaced against everything
 * already standing, each instance a pure function of
 * (seed, cell) with no save state.
 *
 * THE FORM (Adam's correction, 2026-11-05 — supersedes
 * the same day's no-maze pricing, which DEV's dispatch
 * and this lane both read wrong): EVERY grove has its
 * hedge maze — "that's half the fun of getting to the
 * grove." A lesser grove is The Grove's form at family
 * scale: a clearing, a ring of standing stones, grove
 * oaks in the band, a randomized hedge maze from the
 * instance's OWN stream (sites.ts' deriveMazeLayout
 * under the instance's label — one machinery, every
 * grove), and ONE carved stone carrying a CIRCLE
 * fragment at the maze's farthest dead end — the
 * fragment cell, The Grove's own rule for its stone.
 * The maze's size IS dealt per instance, on Adam's
 * exploding ladder (see dealGroveGrid): 11 at base —
 * The Grove's own size is the family's MINIMUM — with
 * 1/3 climbs of +4 through 15, 19, 23, on without cap,
 * so country mazes run from The Grove's scale up to
 * rare giants. The whole footprint scales with the grid
 * (sites.ts' per-grid helpers): ring, oak band, and
 * clearing all stand their grid-11 distance outside
 * the maze square, and spacing reads the instance's
 * own clearing. The entrance side is dealt four ways
 * (The Grove faces spawn because it is the authored
 * first; a distributed grove is approached from
 * anywhere).
 * What stays singular: the HEART — no hoard mound, no
 * great tree in a lesser grove (the layout's heart cell
 * stands open), and The Grove's authored seat.
 *
 * NO PROTECTION (Adam did not revisit it in the
 * correction): The Grove's tree protection stays its
 * own — lesser groves' oaks are ordinary country trees,
 * fellable and harvestable. harvest.ts' refusal stays
 * scoped to the singular's footprint and never learns
 * these instances.
 *
 * THE CARRIER: every lesser grove's carved stone
 * carries a Circle fragment (structural, like the
 * villages' hearthstones — carriage is not rolled).
 * Completeness band 0.4–0.8 DRAFT (DEV's pricing: above
 * the cave-ruined band, below the great stone's). The
 * facts mint on the record in the villages' self-
 * contained idiom; carriers.ts projects them.
 *
 * RESOLUTION ORDER: groves resolve LAST among the
 * families (singulars → caves → homesteads → farmhouses
 * → villages → groves) and yield to every seat already
 * taken, The Grove's own clearing first among them.
 * Sibling cells settle by the families' precedence: the
 * cell that reads first by (row, column) keeps its seat.
 *
 * NUMBERS (all DRAFT for Adam's pin pass): presence
 * 0.30 per 512 m cell (the village mark — Circle's
 * surface source should not be common country); taste =
 * The Grove's own siting set dominant (forest /
 * tanglewood / oldfieldRise, sites.ts' GROVE_BIOMES,
 * mirrored here as that set is private there); the
 * grid ladder and the entrance side dealt off the
 * candidate stream after the taste test (fixed draw
 * order — see groveCandidate); the clearing at grid
 * 11 is 28 m and grows 1.3 m per grid step past it.
 */

import type { BiomeId, BiomeWeights, ScatterObject } from '../types';
import type { MazeCell, SiteWallBox } from './sites';
import { deriveSeed, mulberry32 } from './seed';
import {
  DISTRIBUTION_CELL_M,
  distributionCellStream,
  distributionCellsOverlapping,
} from './distribution';
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
  deriveMazeLayout,
  groveClearRadiusForGrid,
  groveOakBandForGrid,
  groveRingRadiusForGrid,
  CAVE_MOUTH_CLEAR_RADIUS_M,
  GROVE_GRID_CELLS,
  ROAD_RIBBON_HALF_WIDTH_M,
  SIDING_HALF_WIDTH_M,
  SITE_SPACING_MARGIN_M,
} from './sites';
import { caveInstancesInRect } from './caves';
import { homesteadInstancesInRect, HOMESTEAD_CLEAR_RADIUS_M } from './homesteads';
import { farmhouseInstancesInRect, FARMHOUSE_CLEAR_RADIUS_M } from './farmhouses';
import { villageInstancesInRect } from './villages';
import type { FragmentCarrier } from './carriers';

/** Presence per distribution cell. DRAFT. */
export const GROVE_CELL_PRESENCE = 0.3;
/** The carved stone's completeness band. DRAFT. */
export const LESSER_GROVE_CARRIER_BAND: readonly [number, number] = [0.4, 0.8];
/**
 * ADAM'S GROVE SIZE LAW (2026-11-05, as corrected by
 * Adam minutes after the first speaking — 'I meant to
 * skip some. Should be 11 -> 15 -> 19'): the maze grid
 * starts at 11 and every 1/3 roll climbs +4 — 15, 19,
 * 23, 27, on without cap, every roll on the instance's
 * own stream. P(11) = 2/3, P(15) = 2/9, P(19) = 2/27,
 * P(23) = 2/81 — giants are rare and genuinely giant
 * (a 23 spans 60 m of maze; a 27 spans 70 m). The
 * Grove stays authored at 11: the family's minimum,
 * not a roll.
 */
function dealGroveGrid(rand: () => number): number {
  let grid = GROVE_GRID_CELLS;
  while (rand() < 1 / 3) grid += 4;
  return grid;
}
/** Entrance sides, dealt by index off the candidate stream. */
const LESSER_GROVE_SIDES: readonly ('north' | 'east' | 'south' | 'west')[] = [
  'north',
  'east',
  'south',
  'west',
];
/** Rect queries expand by a full cell before enumerating. */
const GROVE_QUERY_MARGIN_M = DISTRIBUTION_CELL_M;
/** The Grove's siting set (sites.ts' GROVE_BIOMES, mirrored). */
const GROVE_TASTE: ReadonlySet<BiomeId> = new Set(['forest', 'tanglewood', 'oldfieldRise']);

export interface LesserGroveInstance {
  key: string;
  cellX: number;
  cellZ: number;
  center: { x: number; z: number };
  biome: BiomeId;
  /** The carved stone's carrier facts — minted for EVERY
   *  instance (carriage is structural, see the header). */
  fragmentCarrier: FragmentCarrier;
  /** Where the fragment machinery reads: the carved stone. */
  fragmentSpot: { x: number; z: number };
  /** The dealt maze grid (cells per side) and its mouth. */
  grid: number;
  entranceSide: 'north' | 'south' | 'east' | 'west';
  entranceCell: MazeCell;
  features: ScatterObject[];
  /** The maze's hedge collision boxes (the layout's own). */
  walls: SiteWallBox[];
  clearRadius: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const instanceCache = new Map<string, LesserGroveInstance | null>();

/** A cell's RAW candidate — fixed draw order: presence,
 *  seat jitter x, seat jitter z, the taste test, then
 *  (accepted candidates only) the maze grid and the
 *  entrance side. */
function groveCandidate(
  worldSeed: string,
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): {
  center: { x: number; z: number };
  biome: BiomeId;
  grid: number;
  entranceSide: 'north' | 'east' | 'south' | 'west';
} | null {
  const rand = distributionCellStream(worldSeed, 'distribution:grove', cx, cz);
  if (rand() >= GROVE_CELL_PRESENCE) return null;
  const x = (cx + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const z = (cz + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const w = weightsAtPos(x, z);
  if (!GROVE_TASTE.has(w.dominant)) return null;
  const grid = dealGroveGrid(rand);
  const entranceSide = LESSER_GROVE_SIDES[Math.floor(rand() * LESSER_GROVE_SIDES.length)];
  return { center: { x, z }, biome: w.dominant, grid, entranceSide };
}

export function lesserGroveInstanceAt(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): LesserGroveInstance | null {
  const cacheKey = `${worldSeed}::${cx},${cz}`;
  if (instanceCache.has(cacheKey)) return instanceCache.get(cacheKey)!;
  let result: LesserGroveInstance | null = null;
  const cand = groveCandidate(worldSeed, weightsAtPos, cx, cz);
  if (cand) {
    const { x, z } = cand.center;
    // The footprint derives from the dealt grid (Adam's
    // size law): the clearing — and every spacing read
    // below — takes THIS instance's own extent, so a
    // giant is never clipped by a fixed 28 m.
    const R = groveClearRadiusForGrid(cand.grid);
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
      (s) => Math.hypot(x - s.center.x, z - s.center.z) >= s.clearRadius + R + SITE_SPACING_MARGIN_M,
    );
    if (legal) {
      const road = sunkenRoadSite(worldSeed, spawn, weightsAtPos);
      const siding = railSidingSite(worldSeed, spawn, weightsAtPos);
      legal =
        distToSegment(x, z, road.footprint.ribbon!.a, road.footprint.ribbon!.b) >=
          ROAD_RIBBON_HALF_WIDTH_M + R + SITE_SPACING_MARGIN_M &&
        distToSegment(x, z, siding.footprint.ribbon!.a, siding.footprint.ribbon!.b) >=
          SIDING_HALF_WIDTH_M + R + SITE_SPACING_MARGIN_M;
    }
    // The earlier families (groves resolve last and yield
    // to every seat already taken).
    if (legal) {
      const reach = CAVE_MOUTH_CLEAR_RADIUS_M + R + SITE_SPACING_MARGIN_M;
      const caves = caveInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach, maxX: x + reach, minZ: z - reach, maxZ: z + reach,
      });
      legal = caves.every((c) => Math.hypot(x - c.center.x, z - c.center.z) >= reach);
    }
    if (legal) {
      const reach = HOMESTEAD_CLEAR_RADIUS_M + R + SITE_SPACING_MARGIN_M;
      const homes = homesteadInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach, maxX: x + reach, minZ: z - reach, maxZ: z + reach,
      });
      legal = homes.every((h) => Math.hypot(x - h.center.x, z - h.center.z) >= reach);
    }
    if (legal) {
      const reach = FARMHOUSE_CLEAR_RADIUS_M + R + SITE_SPACING_MARGIN_M;
      const farms = farmhouseInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach, maxX: x + reach, minZ: z - reach, maxZ: z + reach,
      });
      legal = farms.every((f) => Math.hypot(x - f.center.x, z - f.center.z) >= reach);
    }
    if (legal) {
      const reach = R + SITE_SPACING_MARGIN_M;
      const vills = villageInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach - 200, maxX: x + reach + 200, minZ: z - reach - 200, maxZ: z + reach + 200,
      });
      legal = vills.every(
        (v) => Math.hypot(x - v.center.x, z - v.center.z) >= v.clearRadius + R + SITE_SPACING_MARGIN_M,
      );
    }
    // Sibling precedence (the families' shape): the cell
    // that reads first by (row, column) keeps its seat.
    if (legal) {
      outer: for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
        for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
          if (ncx === cx && ncz === cz) continue;
          const sib = groveCandidate(worldSeed, weightsAtPos, ncx, ncz);
          if (!sib) continue;
          const d = Math.hypot(x - sib.center.x, z - sib.center.z);
          if (d < R + groveClearRadiusForGrid(sib.grid) + SITE_SPACING_MARGIN_M && (ncz < cz || (ncz === cz && ncx < cx))) {
            legal = false;
            break outer;
          }
        }
      }
    }
    if (legal) {
      const key = `grove:lesser:${cx},${cz}`;
      // The form comes from the ONE maze machinery
      // (Adam's correction): this grove's dealt grid and
      // entrance side, its own streams under its key,
      // and no heart contents. The carved stone stands
      // at the layout's fragment cell; the fragment
      // reads at the stone's exact seat.
      const layout = deriveMazeLayout(worldSeed, key, cand.center, cand.entranceSide, {
        grid: cand.grid,
        heart: false,
        ringRadius: groveRingRadiusForGrid(cand.grid),
        oakBand: groveOakBandForGrid(cand.grid),
      });
      const carved = layout.features.find((f) => f.kind === 'carvedStone');
      const carvedSpot = carved ? { x: carved.x, z: carved.z } : cand.center;
      // The carrier facts (minted here to keep the
      // derivation self-contained; the band is this
      // family's own, priced in the header).
      const crand = mulberry32(deriveSeed(worldSeed, `carrier:${key}`));
      const fragmentCarrier: FragmentCarrier = {
        fragmentId: `${key}:fragment`,
        mark: 'circle',
        completeness: LESSER_GROVE_CARRIER_BAND[0] + crand() * (LESSER_GROVE_CARRIER_BAND[1] - LESSER_GROVE_CARRIER_BAND[0]),
      };
      result = {
        key,
        cellX: cx,
        cellZ: cz,
        center: cand.center,
        biome: cand.biome,
        fragmentCarrier,
        fragmentSpot: carvedSpot,
        grid: cand.grid,
        entranceSide: cand.entranceSide,
        entranceCell: layout.entranceCell,
        features: layout.features,
        walls: layout.walls,
        clearRadius: R,
        bounds: { minX: x - R, maxX: x + R, minZ: z - R, maxZ: z + R },
      };
    }
  }
  instanceCache.set(cacheKey, result);
  return result;
}

export function groveInstancesInRect(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  rect: { minX: number; maxX: number; minZ: number; maxZ: number },
): LesserGroveInstance[] {
  const out: LesserGroveInstance[] = [];
  const wide = {
    minX: rect.minX - GROVE_QUERY_MARGIN_M,
    maxX: rect.maxX + GROVE_QUERY_MARGIN_M,
    minZ: rect.minZ - GROVE_QUERY_MARGIN_M,
    maxZ: rect.maxZ + GROVE_QUERY_MARGIN_M,
  };
  for (const cell of distributionCellsOverlapping(wide.minX, wide.maxX, wide.minZ, wide.maxZ)) {
    const inst = lesserGroveInstanceAt(worldSeed, spawn, weightsAtPos, cell.cx, cell.cz);
    if (!inst) continue;
    const b = inst.bounds;
    if (b.maxX < rect.minX || b.minX > rect.maxX || b.maxZ < rect.minZ || b.minZ > rect.maxZ) continue;
    out.push(inst);
  }
  return out;
}

export function lesserGroveInstanceForKey(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  key: string,
): LesserGroveInstance | null {
  const m = /^grove:lesser:(-?\d+),(-?\d+)$/.exec(key);
  if (!m) return null;
  return lesserGroveInstanceAt(worldSeed, spawn, weightsAtPos, Number(m[1]), Number(m[2]));
}
