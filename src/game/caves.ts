/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * THE CAVE DIMENSION (Adam, 2026-10-30 — machinery claim
 * approved by DEV). The world's one cave system as its own
 * pocket dimension: a separate generator swapped in on
 * entry (dimensionTravel), cave-local coordinates, true
 * dark (the renderer gates sky/fog off the active
 * dimension key).
 *
 * Coordinates: the dimension lives around CAVE_ORIGIN, far
 * outside surface play space, so chunk indices, harvest
 * target ids and position-keyed state can never collide
 * with the surface world's. The dimension key is a stable
 * label ('cave:main'); its seeds derive from the world
 * seed by the usual idiom.
 *
 * Layout: per layer, a backtracker maze (the grove's
 * derivation pattern, cave dressing) — chambers and
 * corridors as rock wall boxes under a per-cell ceiling.
 * Layer 1 always; layer 2 on a stream draw, offset in
 * cave-local space and reached only through the shaft
 * anchor pair. Dressing: stalactites, floor rubble, one
 * pool per layer, and twilight fungus ONLY near layer 1's
 * entry (Adam's entrance-glow allowance) — its positions
 * are exported for the renderer's dim lights.
 *
 * Mouths: the surface doors are the cave mouth site
 * (sites.ts) and the farmhouse's cellar door; this module
 * assembles the list. Entering through either arrives at
 * the same entry anchor; exiting returns her to the mouth
 * she used (dimensionState remembers it).
 */

import { deriveSeed, mulberry32 } from './seed';
import { CHUNK_SIZE } from '../constants';
import type { BiomeId, BiomeWeights, ChunkData, ScatterKind, ScatterObject } from '../types';
import type { Fields } from './biomes';
import type { WorldGen } from './worldgen';
import {
  caveMouthSite,
  farmhouseSite,
  type SiteFootprint,
  type SiteWallBox,
} from './sites';

/** The one cave system's dimension key (dimension label). */
export const CAVE_DIMENSION_KEY = 'cave:main';

/** Cave-local origin: far outside surface play space. */
export const CAVE_ORIGIN = { x: 100000, z: 100000 };
/** Chamber cell size, meters (DRAFT). */
export const CAVE_CELL_M = 3.4;
/** Rock wall height, meters (DRAFT): the ceiling sits here. */
export const CAVE_WALL_H_M = 3.2;
/** Layer grids (DRAFT): layer 1 is 9x9 cells, layer 2 7x7. */
export const CAVE_LAYER1_GRID = 9;
export const CAVE_LAYER2_GRID = 7;
/** Layer 2's offset from the origin in cave-local space. */
export const CAVE_LAYER2_OFFSET = { x: 260, z: 0 };
/** Chance layer 2 exists at all (DRAFT stream draw). */
export const CAVE_LAYER2_CHANCE = 0.75;

const WALL_HALF_T = 0.28;

/** A travel anchor: a position + the yaw she faces there. */
export interface CaveAnchor {
  x: number;
  z: number;
  yaw: number;
}

/** One derived cave layer. */
export interface CaveLayer {
  index: number;
  origin: { x: number; z: number };
  grid: number;
  /** Where she arrives entering this layer. */
  entryAnchor: CaveAnchor;
  /** The layer's far dead-end anchor: on layer 1 it is
   *  the DESCEND point (the shaft); on deeper layers it
   *  is presently just the far anchor (a future shaft
   *  would hang off it). */
  shaftAnchor: CaveAnchor | null;
  walls: SiteWallBox[];
  features: ScatterObject[];
}

/** The whole derived cave dimension. */
export interface CaveLayout {
  key: string;
  worldSeed: string;
  layers: CaveLayer[];
  /** Entry anchor of layer 1 (all mouths arrive here). */
  entryAnchor: CaveAnchor;
  /** Twilight-fungus light spots (layer 1 entry only). */
  fungusLights: { x: number; z: number }[];
  /** The footprint the wall query reads underground. */
  footprint: SiteFootprint;
}

const layoutCache = new Map<string, CaveLayout>();

/** Yaw facing a look direction (three.js YXZ convention:
 *  forward = (-sin yaw, -cos yaw) in (x, z)). */
function yawFacing(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz);
}

function deriveLayer(
  worldSeed: string,
  index: number,
  origin: { x: number; z: number },
  grid: number,
): CaveLayer {
  const label = `dimension:${CAVE_DIMENSION_KEY}:layer${index}`;
  const mid = (grid - 1) / 2;
  const cellCenter = (col: number, row: number): { x: number; z: number } => ({
    x: origin.x + (col - mid) * CAVE_CELL_M,
    z: origin.z + (row - mid) * CAVE_CELL_M,
  });

  // The maze: recursive backtracker (the grove pattern) —
  // a spanning tree over the cells, so every cell is
  // reachable from the entry.
  const mazeRand = mulberry32(deriveSeed(worldSeed, `${label}:maze`));
  const hOpen: boolean[][] = Array.from({ length: grid }, () => new Array<boolean>(grid - 1).fill(false));
  const vOpen: boolean[][] = Array.from({ length: grid - 1 }, () => new Array<boolean>(grid).fill(false));
  {
    const visited: boolean[][] = Array.from({ length: grid }, () => new Array<boolean>(grid).fill(false));
    const stack = [{ col: 0, row: 0 }];
    visited[0][0] = true;
    while (stack.length > 0) {
      const cur = stack[stack.length - 1];
      const options: { col: number; row: number; carve: () => void }[] = [];
      if (cur.col > 0 && !visited[cur.row][cur.col - 1]) {
        options.push({ col: cur.col - 1, row: cur.row, carve: () => (hOpen[cur.row][cur.col - 1] = true) });
      }
      if (cur.col < grid - 1 && !visited[cur.row][cur.col + 1]) {
        options.push({ col: cur.col + 1, row: cur.row, carve: () => (hOpen[cur.row][cur.col] = true) });
      }
      if (cur.row > 0 && !visited[cur.row - 1][cur.col]) {
        options.push({ col: cur.col, row: cur.row - 1, carve: () => (vOpen[cur.row - 1][cur.col] = true) });
      }
      if (cur.row < grid - 1 && !visited[cur.row + 1][cur.col]) {
        options.push({ col: cur.col, row: cur.row + 1, carve: () => (vOpen[cur.row][cur.col] = true) });
      }
      if (options.length === 0) {
        stack.pop();
        continue;
      }
      const next = options[Math.floor(mazeRand() * options.length)];
      next.carve();
      visited[next.row][next.col] = true;
      stack.push({ col: next.col, row: next.row });
    }
  }

  // BFS distances from the entry cell (0, mid).
  const dist: number[][] = Array.from({ length: grid }, () => new Array<number>(grid).fill(-1));
  {
    const queue = [{ col: 0, row: mid }];
    dist[mid][0] = 0;
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const d = dist[cur.row][cur.col];
      const step = (col: number, row: number): void => {
        if (dist[row][col] === -1) {
          dist[row][col] = d + 1;
          queue.push({ col, row });
        }
      };
      if (cur.col > 0 && hOpen[cur.row][cur.col - 1]) step(cur.col - 1, cur.row);
      if (cur.col < grid - 1 && hOpen[cur.row][cur.col]) step(cur.col + 1, cur.row);
      if (cur.row > 0 && vOpen[cur.row - 1][cur.col]) step(cur.col, cur.row - 1);
      if (cur.row < grid - 1 && vOpen[cur.row][cur.col]) step(cur.col, cur.row + 1);
    }
  }
  const degree = (col: number, row: number): number => {
    let n = 0;
    if (col > 0 && hOpen[row][col - 1]) n += 1;
    if (col < grid - 1 && hOpen[row][col]) n += 1;
    if (row > 0 && vOpen[row - 1][col]) n += 1;
    if (row < grid - 1 && vOpen[row][col]) n += 1;
    return n;
  };

  // The shaft cell: a far dead end (max BFS distance,
  // dead ends preferred on ties).
  let shaftCell = { col: grid - 1, row: mid };
  {
    let best = -1;
    let bestDead = false;
    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        if (col === 0 && row === mid) continue;
        const d = dist[row][col];
        const dead = degree(col, row) === 1;
        if (d > best || (d === best && dead && !bestDead)) {
          best = d;
          bestDead = dead;
          shaftCell = { col, row };
        }
      }
    }
  }

  const features: ScatterObject[] = [];
  const walls: SiteWallBox[] = [];
  const feat = (kind: ScatterKind, x: number, z: number, y: number, scale: number, rotY: number): void => {
    features.push({ kind, x, z, y, scale, rotY });
  };
  const wallAt = (cx: number, cz: number, runsX: boolean): void => {
    feat('caveRock', cx, cz, 0, 1, runsX ? 0 : Math.PI / 2);
    if (runsX) walls.push({ minX: cx - CAVE_CELL_M / 2, maxX: cx + CAVE_CELL_M / 2, minZ: cz - WALL_HALF_T, maxZ: cz + WALL_HALF_T });
    else walls.push({ minX: cx - WALL_HALF_T, maxX: cx + WALL_HALF_T, minZ: cz - CAVE_CELL_M / 2, maxZ: cz + CAVE_CELL_M / 2 });
  };

  // Walls: each cell's west + north edges (closed or
  // boundary), then the east + south boundary passes.
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const c = cellCenter(col, row);
      if (col === 0 || !hOpen[row][col - 1]) wallAt(c.x - CAVE_CELL_M / 2, c.z, false);
      if (row === 0 || !vOpen[row - 1][col]) wallAt(c.x, c.z - CAVE_CELL_M / 2, true);
      if (col === grid - 1) wallAt(c.x + CAVE_CELL_M / 2, c.z, false);
      if (row === grid - 1) wallAt(c.x, c.z + CAVE_CELL_M / 2, true);
      // The ceiling: one slab per cell.
      feat('caveCeiling', c.x, c.z, CAVE_WALL_H_M + 0.2, 1, 0);
    }
  }

  // Anchors: entry at the west-middle cell facing in;
  // the shaft at its cell facing back toward the entry.
  const entryC = cellCenter(0, mid);
  const entryAnchor: CaveAnchor = { x: entryC.x, z: entryC.z, yaw: yawFacing(1, 0) };
  const shaftC = cellCenter(shaftCell.col, shaftCell.row);
  const shaftAnchor: CaveAnchor = {
    x: shaftC.x,
    z: shaftC.z,
    yaw: yawFacing(entryC.x - shaftC.x, entryC.z - shaftC.z),
  };

  // Dressing (the layer's own stream).
  const dress = mulberry32(deriveSeed(worldSeed, `${label}:dress`));
  const isEntry = (col: number, row: number): boolean => col === 0 && row === mid;
  const isShaft = (col: number, row: number): boolean => col === shaftCell.col && row === shaftCell.row;
  let poolPlaced = false;
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      if (isEntry(col, row) || isShaft(col, row)) continue;
      const c = cellCenter(col, row);
      const d = dist[row][col];
      // Twilight fungus: layer 1, near the entry only.
      if (index === 1 && d >= 1 && d <= 2 && dress() < 0.55) {
        feat('twilightFungus', c.x + (dress() * 2 - 1) * 0.9, c.z + (dress() * 2 - 1) * 0.9, 0, 0.8 + dress() * 0.5, dress() * Math.PI);
        continue;
      }
      if (!poolPlaced && d >= 3 && dress() < 0.3) {
        feat('cavePool', c.x, c.z, 0.02, 1, 0);
        poolPlaced = true;
        continue;
      }
      if (dress() < 0.45) {
        feat('stalactite', c.x + (dress() * 2 - 1) * 1.1, c.z + (dress() * 2 - 1) * 1.1, CAVE_WALL_H_M + 0.15, 0.8 + dress() * 0.6, dress() * Math.PI);
      }
      if (dress() < 0.22) {
        feat('caveBoulder', c.x + (dress() * 2 - 1) * 1.15, c.z + (dress() * 2 - 1) * 1.15, 0, 0.35 + dress() * 0.35, dress() * Math.PI);
      }
    }
  }

  return { index, origin, grid, entryAnchor, shaftAnchor, walls, features };
}

/** Derive the world's cave dimension layout. Memoized. */
export function caveLayoutFor(worldSeed: string): CaveLayout {
  const cached = layoutCache.get(worldSeed);
  if (cached) return cached;

  const layer1 = deriveLayer(worldSeed, 1, CAVE_ORIGIN, CAVE_LAYER1_GRID);
  const layers: CaveLayer[] = [layer1];
  const hasLayer2 =
    mulberry32(deriveSeed(worldSeed, `dimension:${CAVE_DIMENSION_KEY}:depth`))() < CAVE_LAYER2_CHANCE;
  if (hasLayer2) {
    layers.push(
      deriveLayer(worldSeed, 2, { x: CAVE_ORIGIN.x + CAVE_LAYER2_OFFSET.x, z: CAVE_ORIGIN.z + CAVE_LAYER2_OFFSET.z }, CAVE_LAYER2_GRID),
    );
  }

  const fungusLights = layer1.features
    .filter((f) => f.kind === 'twilightFungus')
    .slice(0, 6)
    .map((f) => ({ x: f.x, z: f.z }));

  const allWalls = layers.flatMap((l) => l.walls);
  const span = (CAVE_LAYER1_GRID * CAVE_CELL_M) / 2 + CAVE_CELL_M;
  const footprint: SiteFootprint = {
    center: CAVE_ORIGIN,
    clearRadius: span,
    features: [],
    walls: allWalls,
    bounds: {
      minX: CAVE_ORIGIN.x - span,
      maxX: CAVE_ORIGIN.x + CAVE_LAYER2_OFFSET.x + span,
      minZ: CAVE_ORIGIN.z - span,
      maxZ: CAVE_ORIGIN.z + span,
    },
  };

  const layout: CaveLayout = {
    key: CAVE_DIMENSION_KEY,
    worldSeed,
    layers,
    entryAnchor: layer1.entryAnchor,
    fungusLights,
    footprint,
  };
  layoutCache.set(worldSeed, layout);
  return layout;
}

/** The footprint the renderer's wall query reads while
 *  the cave dimension is active. */
export function caveFootprintFor(worldSeed: string): SiteFootprint {
  return caveLayoutFor(worldSeed).footprint;
}

const CAVE_FIELDS: Fields = { wetness: 0.35, elevation: 0, density: 0, mineral: 0.6, creek: 0, distance: 0 };
const CAVE_WEIGHTS: BiomeWeights = {
  weights: {
    mirewood: 0,
    deepBog: 0,
    oldfieldRise: 0,
    creekBottom: 0,
    tanglewood: 0,
    saltFlat: 0,
    meadow: 0,
    forest: 0,
  } as Record<BiomeId, number>,
  // The least-wrong standing biome: dark and wet. Cave
  // strata naming is a later design piece.
  dominant: 'deepBog',
};
const CAVE_GROUND_COLOR = 0x35322c;

/**
 * The cave dimension as a WorldGen: chunks emit only the
 * layout's features; the surface world is never consulted.
 */
export function createCaveGen(worldSeed: string): WorldGen {
  const layout = caveLayoutFor(worldSeed);
  const allFeatures = layout.layers.flatMap((l) => l.features);
  return {
    seed: worldSeed,
    dimensionKey: CAVE_DIMENSION_KEY,
    fieldsAt: () => CAVE_FIELDS,
    weightsAt: () => CAVE_WEIGHTS,
    groundColorAt: () => CAVE_GROUND_COLOR,
    generateChunk: (cx: number, cz: number): ChunkData => {
      const minX = cx * CHUNK_SIZE;
      const minZ = cz * CHUNK_SIZE;
      const objects = allFeatures.filter(
        (f) => f.x >= minX && f.x < minX + CHUNK_SIZE && f.z >= minZ && f.z < minZ + CHUNK_SIZE,
      );
      return { cx, cz, objects };
    },
    findSpawn: () => ({ x: layout.entryAnchor.x, z: layout.entryAnchor.z }),
  };
}

/** A surface mouth of the cave dimension. */
export interface CaveMouthRef {
  id: string;
  /** Where she stands to enter / arrives on exit. */
  spot: { x: number; z: number };
  /** Yaw she faces on exit (outward, away from the dark). */
  exitYaw: number;
  /** The owning site's wall boxes (exit validation). */
  walls: SiteWallBox[];
}

/**
 * The cave dimension's surface mouths: the cave mouth
 * site, and the farmhouse's cellar door as the second
 * mouth into the same dimension (Adam's staged anchor;
 * cellars proper are later design — in v1 the door is a
 * mouth, not a room).
 */
export function caveMouths(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): CaveMouthRef[] {
  const mouth = caveMouthSite(worldSeed, spawn, weightsAtPos);
  const outM = {
    x: mouth.mouthSpot.x - mouth.center.x,
    z: mouth.mouthSpot.z - mouth.center.z,
  };
  const farm = farmhouseSite(worldSeed, spawn, weightsAtPos);
  const outC = {
    x: farm.cellarDoor.x - farm.center.x,
    z: farm.cellarDoor.z - farm.center.z,
  };
  return [
    {
      id: 'mouth',
      spot: mouth.mouthSpot,
      exitYaw: yawFacing(outM.x, outM.z),
      walls: mouth.walls,
    },
    {
      id: 'cellar',
      spot: farm.cellarDoor,
      exitYaw: yawFacing(outC.x, outC.z),
      walls: farm.walls,
    },
  ];
}
