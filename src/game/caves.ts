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
  barnSite,
  buildCaveMouthFacade,
  CAVE_MOUTH_OPENING_HALF_M,
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
  CAVE_MOUTH_CLEAR_RADIUS_M,
  ROAD_RIBBON_HALF_WIDTH_M,
  SIDING_HALF_WIDTH_M,
  SITE_SPACING_MARGIN_M,
  type SiteFootprint,
  type SiteWallBox,
} from './sites';
import {
  DISTRIBUTION_CELL_M,
  distributionCellStream,
  distributionCellsOverlapping,
} from './distribution';

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
  /** THE UP HOLE (Adam's separation ruling, 2026-11-06:
   *  'just move the down away from the up'): on deeper
   *  layers, the CLIMB's departure + price point, dealt
   *  at its own cell clear of the entry anchor (the down
   *  landing) — landing from the down never seats her
   *  inside the climb's circle. Null on layer 1, whose
   *  up is the exit at the entry anchor. */
  upAnchor: CaveAnchor | null;
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
  /** The fragment anchor (distributed instances only in
   *  this round: a carved stone staged at the deepest
   *  layer's own dealt seat, clear of its doors (the
   *  separation ruling, 2026-11-06 — formerly the far
   *  dead end); the DEBUT cave — cave:main, the
   *  first cave (Adam, 2026-11-01: 'designated' retires as
   *  a category; all caves populate by seed and location)
   *  — keeps its exact v1 layout and reports null: no
   *  layer guarantee under the general rules). */
  fragmentSpot: { x: number; z: number } | null;
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
  key: string,
  index: number,
  origin: { x: number; z: number },
  grid: number,
): CaveLayer {
  const label = `dimension:${key}:layer${index}`;
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

  // THE UP HOLE (Adam's ruling, 2026-11-06: 'just move
  // the down away from the up'). Dealt LAST, off its own
  // sibling stream (`${label}:anchors`), so every draw
  // above — maze, walls, dressing — stays byte-identical
  // to the pre-separation dealer; only the climb's point
  // moves (the stone's seat deals with the layout,
  // below). Cell centres are always open floor here
  // (walls ride the edges); a centre dressed with a
  // floor feature (a pool, a boulder, a fungus) is not
  // a seat.
  const anchors = mulberry32(deriveSeed(worldSeed, `${label}:anchors`));
  const euclid = (
    a: { x: number; z: number },
    b: { x: number; z: number },
  ): number => Math.hypot(a.x - b.x, a.z - b.z);
  const dressed = (c: { x: number; z: number }): boolean =>
    features.some(
      (f) =>
        (f.kind === 'cavePool' ||
          f.kind === 'caveBoulder' ||
          f.kind === 'twilightFungus') &&
        euclid(f, c) < 1.2,
    );
  const centres: { x: number; z: number }[] = [];
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      centres.push(cellCenter(col, row));
    }
  }
  const pickClear = (
    ok: { x: number; z: number }[],
    against: { x: number; z: number }[],
  ): { x: number; z: number } => {
    if (ok.length > 0) {
      return ok[Math.floor(anchors() * ok.length)];
    }
    // No satisfying cell (a cramped deal): the centre
    // whose worst clearance is greatest — deterministic,
    // and the separation census reports how often the
    // full guarantee could not be dealt.
    let bestC = centres[0];
    let bestScore = -1;
    for (const c of centres) {
      const score = Math.min(...against.map((a) => euclid(c, a)));
      if (score > bestScore) {
        bestScore = score;
        bestC = c;
      }
    }
    return bestC;
  };
  // The up hole: deeper layers only — clear of the down
  // landing by the climb's circle + walking room, and
  // clear of the layer's own shaft against a future
  // deeper door hanging off it.
  let upAnchor: CaveAnchor | null = null;
  if (index >= 2) {
    const ok = centres.filter(
      (c) =>
        euclid(c, entryAnchor) >= CAVE_UP_ENTRY_SEPARATION_M &&
        (!shaftAnchor || euclid(c, shaftAnchor) >= CAVE_STONE_CLEAR_M) &&
        !dressed(c),
    );
    const pick = pickClear(ok, [entryAnchor]);
    upAnchor = {
      x: pick.x,
      z: pick.z,
      yaw: yawFacing(entryAnchor.x - pick.x, entryAnchor.z - pick.z),
    };
  }
  return {
    index,
    origin,
    grid,
    entryAnchor,
    shaftAnchor,
    upAnchor,
    walls,
    features,
  };
}

/**
 * Derive one cave dimension's layout by its key.
 * Memoized per (seed, key). The debut cave
 * ('cave:main') derives EXACTLY as it did in v1 — same
 * streams, same grids, same depth roll; distributed
 * instances draw their grid sizes and depth from their
 * own 'draws' stream (DRAFT: layer 1 grid 7/9/11, layer
 * 2 grid 5/7/9 — odd only, the entry row needs it —
 * layer 2 on the standing chance) and stage a
 * fragment stone at their deepest dead end.
 */
export function caveLayoutForKey(worldSeed: string, key: string): CaveLayout {
  const cacheKey = `${worldSeed}::${key}`;
  const cached = layoutCache.get(cacheKey);
  if (cached) return cached;

  const isMain = key === CAVE_DIMENSION_KEY;
  let grid1 = CAVE_LAYER1_GRID;
  let grid2 = CAVE_LAYER2_GRID;
  let hasLayer2: boolean;
  if (isMain) {
    hasLayer2 =
      mulberry32(deriveSeed(worldSeed, `dimension:${key}:depth`))() < CAVE_LAYER2_CHANCE;
  } else {
    const draws = mulberry32(deriveSeed(worldSeed, `dimension:${key}:draws`));
    // Odd grids only: the maze's entry row is (grid - 1) / 2,
    // integral only for odd sizes (v1's 9 and 7 are odd).
    grid1 = 7 + 2 * Math.floor(draws() * 3);
    grid2 = 5 + 2 * Math.floor(draws() * 3);
    hasLayer2 = draws() < CAVE_LAYER2_CHANCE;
  }

  const layer1 = deriveLayer(worldSeed, key, 1, CAVE_ORIGIN, grid1);
  const layers: CaveLayer[] = [layer1];
  if (hasLayer2) {
    layers.push(
      deriveLayer(worldSeed, key, 2, { x: CAVE_ORIGIN.x + CAVE_LAYER2_OFFSET.x, z: CAVE_ORIGIN.z + CAVE_LAYER2_OFFSET.z }, grid2),
    );
  }

  // The fragment anchor (instances only this round —
  // the debut cave's layout stays byte-stable). Since
  // the separation ruling (2026-11-06) it is dealt its
  // own seat in the block below — the stone no longer
  // stands at the far shaft anchor.
  let fragmentSpot: { x: number; z: number } | null = null;
  if (!isMain) {
    const deepest = layers[layers.length - 1];
    // THE STONE'S OWN SEAT (the separation ruling,
    // 2026-11-06): dealt here, off its own virgin
    // stream, from the deepest layer's cell centres —
    // clear of that layer's up point (the up hole on
    // deeper layers; the exit at the entry anchor on a
    // one-layer cave) by the full priced reach, and
    // clear of its landing and shaft, so a readable
    // stand always exists outside every door's circle.
    // (Per-layer stone dealing was priced and struck:
    // a later round deals it from its own fresh stream
    // without moving a single cave dealt today.)
    const stoneRand = mulberry32(
      deriveSeed(worldSeed, `dimension:${key}:layer${deepest.index}:stone`),
    );
    const mid = (deepest.grid - 1) / 2;
    const centres: { x: number; z: number }[] = [];
    for (let row = 0; row < deepest.grid; row++) {
      for (let col = 0; col < deepest.grid; col++) {
        centres.push({
          x: deepest.origin.x + (col - mid) * CAVE_CELL_M,
          z: deepest.origin.z + (row - mid) * CAVE_CELL_M,
        });
      }
    }
    const distTo = (
      a: { x: number; z: number },
      b: { x: number; z: number },
    ): number => Math.hypot(a.x - b.x, a.z - b.z);
    const dressed = (c: { x: number; z: number }): boolean =>
      deepest.features.some(
        (f) =>
          (f.kind === 'cavePool' ||
            f.kind === 'caveBoulder' ||
            f.kind === 'twilightFungus') &&
          distTo(f, c) < 1.2,
      );
    const upPoint = deepest.upAnchor ?? deepest.entryAnchor;
    const ok = centres.filter(
      (c) =>
        distTo(c, upPoint) >= CAVE_STONE_UP_SEPARATION_M &&
        distTo(c, deepest.entryAnchor) >= CAVE_STONE_CLEAR_M &&
        (!deepest.shaftAnchor ||
          distTo(c, deepest.shaftAnchor) >= CAVE_STONE_CLEAR_M) &&
        !dressed(c),
    );
    let pick: { x: number; z: number };
    if (ok.length > 0) {
      pick = ok[Math.floor(stoneRand() * ok.length)];
    } else {
      // No satisfying cell: the greatest worst-clearance
      // centre (deterministic; the census reports it).
      pick = centres[0];
      let bestScore = -1;
      for (const c of centres) {
        const score = Math.min(
          distTo(c, upPoint),
          distTo(c, deepest.entryAnchor),
        );
        if (score > bestScore) {
          bestScore = score;
          pick = c;
        }
      }
    }
    fragmentSpot = { x: pick.x, z: pick.z };
    deepest.features.push({
      kind: 'carvedStone',
      x: fragmentSpot.x,
      z: fragmentSpot.z,
      y: 0,
      scale: 1,
      rotY: 0,
    });
  }

  const fungusLights = layer1.features
    .filter((f) => f.kind === 'twilightFungus')
    .slice(0, 6)
    .map((f) => ({ x: f.x, z: f.z }));

  const allWalls = layers.flatMap((l) => l.walls);
  const span = (grid1 * CAVE_CELL_M) / 2 + CAVE_CELL_M;
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
    key,
    worldSeed,
    layers,
    entryAnchor: layer1.entryAnchor,
    fungusLights,
    fragmentSpot,
    footprint,
  };
  layoutCache.set(cacheKey, layout);
  return layout;
}

/** Derive the world's debut cave layout (v1). */
export function caveLayoutFor(worldSeed: string): CaveLayout {
  return caveLayoutForKey(worldSeed, CAVE_DIMENSION_KEY);
}

/** The footprint the renderer's wall query reads while
 *  the cave dimension is active. */
export function caveFootprintFor(worldSeed: string, key: string = CAVE_DIMENSION_KEY): SiteFootprint {
  return caveLayoutForKey(worldSeed, key).footprint;
}

/** A faced cave surface (the glow-paint aim's answer,
 *  2026-11-03): cave-local point ON the surface, the
 *  surface vocabulary the paint register keeps, and the
 *  distance along the ray. */
export interface CaveSurfaceHit {
  x: number;
  y: number;
  z: number;
  surface: 'wall' | 'floor';
  /** The wall's outward axis normal (0/0: floor, or the ceiling). */
  nx: number;
  nz: number;
  distM: number;
}

/**
 * THE FACED-SURFACE READ (Background, 2026-11-03): cast
 * a ray through the cave's own geometry — the layout's
 * wall boxes as vertical prisms (floor to
 * CAVE_WALL_H_M), each layer's floor plane (y = 0) and
 * ceiling plane (y = CAVE_WALL_H_M) across its grid
 * square — and answer the NEAREST hit within maxDistM,
 * or null. The cave is a box world, so the analytic cast
 * is exact where a scene raycast would wade through
 * every mesh in the chunk. The direction need not be
 * normalized; distances come back in meters along it.
 * A floor point under a wall box is rock, not floor.
 * Ceiling hits read surface 'wall' with nx = nz = 0
 * (the register's vocabulary completion).
 */
export function caveSurfaceAim(
  layout: CaveLayout,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDistM: number,
): CaveSurfaceHit | null {
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 0)) return null;
  const ux = dx / len;
  const uy = dy / len;
  const uz = dz / len;
  let best: CaveSurfaceHit | null = null;
  const consider = (hit: CaveSurfaceHit): void => {
    if (hit.distM >= 0 && hit.distM <= maxDistM && (best === null || hit.distM < best.distM)) {
      best = hit;
    }
  };
  const inLayerSquare = (x: number, z: number): boolean =>
    layout.layers.some((layer) => {
      const half = (layer.grid * CAVE_CELL_M) / 2;
      return Math.abs(x - layer.origin.x) <= half && Math.abs(z - layer.origin.z) <= half;
    });
  // Floor and ceiling planes.
  if (uy < -1e-9) {
    const t = -oy / uy;
    const x = ox + ux * t;
    const z = oz + uz * t;
    const underWall = layout.footprint.walls.some(
      (w) => x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ,
    );
    if (inLayerSquare(x, z) && !underWall) {
      consider({ x, y: 0, z, surface: 'floor', nx: 0, nz: 0, distM: t });
    }
  }
  if (uy > 1e-9) {
    const t = (CAVE_WALL_H_M - oy) / uy;
    const x = ox + ux * t;
    const z = oz + uz * t;
    if (inLayerSquare(x, z)) {
      consider({ x, y: CAVE_WALL_H_M, z, surface: 'wall', nx: 0, nz: 0, distM: t });
    }
  }
  // Wall prisms: slab-test the ray against each box's XZ
  // rectangle; the entry face names the normal; the
  // entry height must stand inside the wall's rise.
  for (const w of layout.footprint.walls) {
    let tEnter = -Infinity;
    let tExit = Infinity;
    let nx = 0;
    let nz = 0;
    if (Math.abs(ux) < 1e-12) {
      if (ox < w.minX || ox > w.maxX) continue;
    } else {
      const t1 = (w.minX - ox) / ux;
      const t2 = (w.maxX - ox) / ux;
      const enterFace = ux > 0 ? -1 : 1;
      tEnter = Math.max(tEnter, Math.min(t1, t2));
      if (Math.min(t1, t2) === tEnter) nx = enterFace;
      tExit = Math.min(tExit, Math.max(t1, t2));
    }
    if (Math.abs(uz) < 1e-12) {
      if (oz < w.minZ || oz > w.maxZ) continue;
      nz = 0;
    } else {
      const t1 = (w.minZ - oz) / uz;
      const t2 = (w.maxZ - oz) / uz;
      const enterFace = uz > 0 ? -1 : 1;
      const tmin = Math.min(t1, t2);
      if (tmin > tEnter) {
        tEnter = tmin;
        nx = 0;
        nz = enterFace;
      }
      tExit = Math.min(tExit, Math.max(t1, t2));
    }
    if (tEnter > tExit || tEnter < 0) continue;
    const y = oy + uy * tEnter;
    if (y < 0 || y > CAVE_WALL_H_M) continue;
    consider({
      x: ox + ux * tEnter,
      y,
      z: oz + uz * tEnter,
      surface: 'wall',
      nx,
      nz,
      distM: tEnter,
    });
  }
  return best;
}

const CAVE_FIELDS: Fields = { wetness: 0.35, elevation: 0, density: 0, mineral: 0.6, creek: 0, distance: 0 };
const CAVE_WEIGHTS: BiomeWeights = {
  weights: {
    mirewood: 0,
    deepBog: 0,
    oldfieldRise: 0,
    creekBottom: 0,
    tanglewood: 0,
    fen: 0,
    scrub: 0,
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
export function createCaveGen(worldSeed: string, key: string = CAVE_DIMENSION_KEY): WorldGen {
  const layout = caveLayoutForKey(worldSeed, key);
  const allFeatures = layout.layers.flatMap((l) => l.features);
  return {
    seed: worldSeed,
    dimensionKey: key,
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

// ---------------------------------------------------------------------------
// DISTRIBUTED CAVE INSTANCES (Adam + DEV, 2026-10-30 —
// the pluralization: caves recur across the world, each
// its own dimension). The distribution model's first
// customer (distribution.ts): one candidate seat per
// 512 m cell, drawn on the cell's own stream; a candidate
// registers only where the ground suits a mouth
// (tanglewood / forest dominant — the debut mouth's
// taste) and the spacing law holds against every singular
// site (ribbons by line) and against sibling instances.
// Each registered instance is a full cave: its own stable
// key ('cave:<cell>'), its own layout, its own fragment
// anchor. The debut cave above is untouched by all
// of this — instances are ADDITIVE.
// ---------------------------------------------------------------------------

/** Per-cell cave presence draw (DRAFT). */
export const CAVE_CELL_PRESENCE = 0.5;

/** A distributed cave instance: a mouth on the surface
 *  (a full SiteFootprint) + the key of its dimension. */
export interface CaveInstance {
  key: string;
  /** The mouth id travel routes by (the key itself). */
  mouthId: string;
  cellX: number;
  cellZ: number;
  center: { x: number; z: number };
  biome: BiomeId;
  faceSide: 'north' | 'south' | 'east' | 'west';
  mouthSpot: { x: number; z: number };
  exitYaw: number;
  clearRadius: number;
  features: ScatterObject[];
  walls: SiteWallBox[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const instanceCache = new Map<string, CaveInstance | null>();

/** A cell's RAW candidate seat (before spacing): drawn
 *  in a fixed order — presence, seat jitter x, seat
 *  jitter z — then the biome taste test. */
function caveCandidate(
  worldSeed: string,
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): { center: { x: number; z: number }; biome: BiomeId } | null {
  const rand = distributionCellStream(worldSeed, 'distribution:cave', cx, cz);
  if (rand() >= CAVE_CELL_PRESENCE) return null;
  const x = (cx + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const z = (cz + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const w = weightsAtPos(x, z);
  if (w.dominant !== 'tanglewood' && w.dominant !== 'forest') return null;
  return { center: { x, z }, biome: w.dominant };
}

/** The accepted instance for one cell, or null. */
function caveInstanceAt(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): CaveInstance | null {
  const cacheKey = `${worldSeed}::${cx},${cz}`;
  if (instanceCache.has(cacheKey)) return instanceCache.get(cacheKey)!;
  let result: CaveInstance | null = null;
  const cand = caveCandidate(worldSeed, weightsAtPos, cx, cz);
  if (cand) {
    const { x, z } = cand.center;
    // Spacing against the singular sites (the standing
    // rule; ribbons measured to their lines).
    const singulars = [
      groveSite(worldSeed, spawn, (px, pz) => weightsAtPos(px, pz).dominant),
      schoolhouseSite(worldSeed, spawn, weightsAtPos),
      villageSite(worldSeed, spawn, weightsAtPos),
      farmhouseSite(worldSeed, spawn, weightsAtPos),
      chapelSite(worldSeed, spawn, weightsAtPos),
      caveMouthSite(worldSeed, spawn, weightsAtPos),
      generalStoreSite(worldSeed, spawn, weightsAtPos),
      drownedMillSite(worldSeed, spawn, weightsAtPos),
      barnSite(worldSeed, spawn, weightsAtPos),
      siloSite(worldSeed, spawn, weightsAtPos),
    ];
    const road = sunkenRoadSite(worldSeed, spawn, weightsAtPos);
    const siding = railSidingSite(worldSeed, spawn, weightsAtPos);
    let legal = singulars.every(
      (s) =>
        Math.hypot(x - s.center.x, z - s.center.z) >=
        s.clearRadius + CAVE_MOUTH_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M,
    );
    if (legal) {
      legal =
        distToSegment(x, z, road.a, road.b) >= ROAD_RIBBON_HALF_WIDTH_M + CAVE_MOUTH_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M &&
        distToSegment(x, z, siding.a, siding.b) >= SIDING_HALF_WIDTH_M + CAVE_MOUTH_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M;
    }
    // Sibling precedence: within the sibling floor, the
    // cell that reads first (row, then column) keeps its
    // instance; the other cell goes empty. (The seat
    // jitter band keeps siblings >= ~145 m apart by
    // construction, so this binds rarely — it exists so
    // the answer never depends on query order.)
    if (legal) {
      const floor = CAVE_MOUTH_CLEAR_RADIUS_M * 2 + SITE_SPACING_MARGIN_M;
      outer: for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
        for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
          if (ncx === cx && ncz === cz) continue;
          const sib = caveCandidate(worldSeed, weightsAtPos, ncx, ncz);
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
      const key = `cave:${cx},${cz}`;
      const toSpawnX = spawn.x - x;
      const toSpawnZ = spawn.z - z;
      const faceSide: CaveInstance['faceSide'] =
        Math.abs(toSpawnX) > Math.abs(toSpawnZ)
          ? toSpawnX > 0
            ? 'east'
            : 'west'
          : toSpawnZ > 0
            ? 'south'
            : 'north';
      const facade = buildCaveMouthFacade(worldSeed, `cavemouth:${key}`, cand.center, faceSide);
      result = {
        key,
        mouthId: key,
        cellX: cx,
        cellZ: cz,
        center: cand.center,
        biome: cand.biome,
        faceSide,
        mouthSpot: facade.mouthSpot,
        exitYaw: yawFacing(facade.mouthSpot.x - x, facade.mouthSpot.z - z),
        clearRadius: CAVE_MOUTH_CLEAR_RADIUS_M,
        features: facade.features,
        walls: facade.walls,
        bounds: {
          minX: x - CAVE_MOUTH_CLEAR_RADIUS_M,
          maxX: x + CAVE_MOUTH_CLEAR_RADIUS_M,
          minZ: z - CAVE_MOUTH_CLEAR_RADIUS_M,
          maxZ: z + CAVE_MOUTH_CLEAR_RADIUS_M,
        },
      };
    }
  }
  instanceCache.set(cacheKey, result);
  return result;
}

/**
 * Every registered cave instance whose clearing bounds
 * intersect a world rect — the region query worldgen,
 * the renderer, and travel all read. Pure in (seed,
 * rect): the same rect always answers the same list.
 */
export function caveInstancesInRect(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  rect: { minX: number; maxX: number; minZ: number; maxZ: number },
): CaveInstance[] {
  const out: CaveInstance[] = [];
  for (const { cx, cz } of distributionCellsOverlapping(rect.minX, rect.maxX, rect.minZ, rect.maxZ)) {
    const inst = caveInstanceAt(worldSeed, spawn, weightsAtPos, cx, cz);
    if (!inst) continue;
    const b = inst.bounds;
    if (b.maxX < rect.minX || b.minX > rect.maxX || b.maxZ < rect.minZ || b.minZ > rect.maxZ) continue;
    out.push(inst);
  }
  return out;
}

/** One instance by its dimension key, or null when the
 *  key names no registered instance (or the debut
 *  cave — that key is caveLayoutForKey's, not an
 *  instance's). */
export function caveInstanceForKey(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  key: string,
): CaveInstance | null {
  const m = /^cave:(-?\d+),(-?\d+)$/.exec(key);
  if (!m) return null;
  const inst = caveInstanceAt(worldSeed, spawn, weightsAtPos, Number(m[1]), Number(m[2]));
  return inst && inst.key === key ? inst : null;
}

/**
 * Every mouth within a radius of a point: the debut
 * cave's two mouths plus registered instances — the list
 * travel routing and the shell's faced-target arms read.
 */
export function caveMouthsNear(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  x: number,
  z: number,
  radius: number,
): CaveMouthRef[] {
  const out: CaveMouthRef[] = caveMouths(worldSeed, spawn, weightsAtPos).filter(
    (m) => Math.hypot(m.spot.x - x, m.spot.z - z) <= radius,
  );
  for (const inst of caveInstancesInRect(worldSeed, spawn, weightsAtPos, {
    minX: x - radius,
    maxX: x + radius,
    minZ: z - radius,
    maxZ: z + radius,
  })) {
    if (Math.hypot(inst.mouthSpot.x - x, inst.mouthSpot.z - z) > radius) continue;
    out.push({ id: inst.key, spot: inst.mouthSpot, exitYaw: inst.exitYaw, walls: inst.walls });
  }
  return out;
}

/** The entry offer's reach (m), priced by acceptance
 *  (Adam's cave-mouth fix, 2026-11-06; DRAFT for his pin
 *  pass): from his reported stand (-369.1, -13.4) facing
 *  the debut mouth, the ENTER pill must stand. His
 *  distance to the reseated spot is 5.48 m; the disc is
 *  6. The old geography (HARVEST_RANGE 2.5 around a spot
 *  floating 2.6 m out) left him 1.39 m outside it with no
 *  word as to why. */
export const CAVE_ENTER_RANGE_M = 6;

/** The exit offer's reach (m) — the entry BLOCK, not
 *  the anchor point (Adam's exit pin, 2026-11-06: 'The
 *  player should not have to guess where the exit is.
 *  It should be plainly obvious upon arrival'). The
 *  disc covers the arrival cell plus its ring (the
 *  3x3 of cells around the entry cell, far corner
 *  7.21 m from the anchor) + her stance margin:
 *  standing anywhere in that block, facing the entry
 *  shaft (which stands at the anchor), the EXIT pill
 *  stands. The same reach prices layer 2's climb at
 *  its own entry anchor. DRAFT for Adam's pin pass.
 *  History: the first pricing (5.5, the single cell's
 *  diagonal + margin) shipped in #88 and failed his
 *  stand the same afternoon — the shaft reads as the
 *  door from the whole entry area (its light spills
 *  10 m) while he stood 5-6 m out looking into the
 *  column, on the disc's rim, no pill in frame. The
 *  act now covers the ground the sign promises. The
 *  geography before that (HARVEST_RANGE 2.5 around
 *  the bare anchor, nothing rendered there) stranded
 *  him at the way back entirely: 0.92 m from the
 *  point, facing a wall, no pill, no sign. */
export const CAVE_EXIT_RANGE_M = 7.5;

/** THE SEPARATION REACHES (Adam's ruling, 2026-11-06:
 *  the down, the up, and the stone each keep their own
 *  ground). Derived from the pinned reaches — a door's
 *  zone (CAVE_EXIT_RANGE_M 7.5) plus a faced act's reach
 *  (2.5) plus margin — so a readable stand always
 *  exists OUTSIDE the door's circle and INSIDE the
 *  stone's reach. The margins are DRAFT for his pin
 *  pass; the structure (no point inside another's
 *  circle or reach) is the ruling. */
/** The up hole deals at least this far from the
 *  layer's down landing (the entry anchor): the climb's
 *  circle (7.5) + 1 m of walking room. */
export const CAVE_UP_ENTRY_SEPARATION_M = 8.5;
/** The stone deals at least this far from the layer's
 *  up point (on layer 1, the exit at the entry anchor):
 *  the door's circle (7.5) + the reading reach (2.5) +
 *  0.5 of slack — a stand exists that reads the stone
 *  from outside the circle. */
export const CAVE_STONE_UP_SEPARATION_M = 10.5;
/** The stone deals at least this far from the layer's
 *  other points (the down landing, the shaft): two
 *  faced reaches (2.5 + 2.5) — neither act's circle
 *  swallows the other's stand. */
export const CAVE_STONE_CLEAR_M = 5;

/** A facade mouth read as a PASSAGE: the threshold
 *  plane she crosses on foot. The plane stands at the
 *  spot's depth out of the face (planeV along the out
 *  axis from the centre), spanning the opening's width.
 *  The farmhouse cellar mouth is NOT a passage — it has
 *  no facade and no plane; it keeps the pill only. */
export interface CavePassageMouth {
  id: string;
  cx: number;
  cz: number;
  outX: number;
  outZ: number;
  planeV: number;
  halfW: number;
}

export function passageMouthsNear(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  x: number,
  z: number,
  radius: number,
): CavePassageMouth[] {
  const out: CavePassageMouth[] = [];
  const add = (id: string, center: { x: number; z: number }, spot: { x: number; z: number }): void => {
    const dx = spot.x - center.x;
    const dz = spot.z - center.z;
    const v = Math.hypot(dx, dz);
    if (v < 1e-6) return;
    if (Math.hypot(center.x - x, center.z - z) > radius + v) return;
    out.push({
      id, cx: center.x, cz: center.z,
      outX: dx / v, outZ: dz / v, planeV: v, halfW: CAVE_MOUTH_OPENING_HALF_M,
    });
  };
  const debut = caveMouthSite(worldSeed, spawn, weightsAtPos);
  add('mouth', debut.center, debut.mouthSpot);
  for (const inst of caveInstancesInRect(worldSeed, spawn, weightsAtPos, {
    minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius,
  })) {
    add(inst.key, inst.center, inst.mouthSpot);
  }
  return out;
}

/** The crossing test (pure): her step from prev to cur
 *  crosses a mouth's threshold plane INWARD, within the
 *  opening's width -> that mouth's id, else null. A step
 *  longer than 3 m is a teleport (a travel write, a
 *  restore), never a crossing — the passage is walked,
 *  not written. Outward crossings never fire: leaving a
 *  cave keeps its existing doors. */
export function crossedMouth(
  prev: { x: number; z: number },
  cur: { x: number; z: number },
  mouths: CavePassageMouth[],
): string | null {
  const step = Math.hypot(cur.x - prev.x, cur.z - prev.z);
  if (step === 0 || step > 3) return null;
  for (const m of mouths) {
    const dPrev = (prev.x - m.cx) * m.outX + (prev.z - m.cz) * m.outZ;
    if (dPrev <= m.planeV) continue;
    const dCur = (cur.x - m.cx) * m.outX + (cur.z - m.cz) * m.outZ;
    if (dCur > m.planeV) continue;
    const t = (dPrev - m.planeV) / (dPrev - dCur);
    const px = prev.x + (cur.x - prev.x) * t;
    const pz = prev.z + (cur.z - prev.z) * t;
    const lat = (px - m.cx) * -m.outZ + (pz - m.cz) * m.outX;
    if (Math.abs(lat) <= m.halfW) return m.id;
  }
  return null;
}
