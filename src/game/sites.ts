/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SITES — unique seeded places in the biome world (Adam, 2026-10-30;
 * locations build-out, the Grove first). A site is a PURE FUNCTION
 * OF THE WORLD SEED, like the biomes themselves: no save state, no
 * stored record — the seed says the place is there, identically on
 * every load, in every chunk that overlaps it. Site features are
 * emitted by worldgen's site pass (worldgen.ts) by POSITION: a
 * feature belongs to exactly the chunk containing its position, so
 * chunk borders can neither duplicate nor drop one, and ordinary
 * scatter outside a site's clearing is byte-identical to a world
 * without sites (proven against a pre-change baseline in the
 * grove-check probe).
 *
 * THE GROVE (the wild; locations build #1, merge #31 with the
 * Schoolhouse): standing stones in a ring, old trees behind them,
 * and inside the ring a HEDGEROW MAZE (Adam's amendment) — the
 * crow's hoard at the maze's heart, a carved stone hiding the
 * fragment site in the farthest dead end. CONTENTS STAGE WITH
 * THEIR OWN SYSTEMS: the crow's lead-in, the first object charm,
 * and the mark fragment are later landings; this module places
 * the physical site only (the hoard is a scenery mound, the
 * carved stone a scenery stone).
 *
 * PROTECTION (Adam, 2026-10-30, PINNED): the Grove's trees are
 * protected, and the refusal is HERS, in-fiction — she will not
 * cut them. The surface is UI's name tag ('Grove Tree', no pill);
 * the engine backstop lives in harvest.ts and refuses with
 * GROVE_REFUSAL_LINE (copy DRAFT, Adam's pin pass). Her own
 * planted saplings are NOT grove trees (they never carry the
 * groveOak kind), so the protection never reaches them.
 *
 * COLLISION: the hedge walls are the game's first colliders, and
 * they stay SITE-LOCAL by design — this module derives the wall
 * boxes and the push-out resolver; player.ts consults them only
 * through a renderer-wired query that returns walls when she is
 * near the site. No other object gains collision here. Known v1
 * limit (named at claim time): ambient animals wander by their
 * own rules and may clip a hedge inside the grove.
 *
 * Every number below is DRAFT (Adam's pin pass), and the maze
 * grid size is ONE named constant (GROVE_GRID_CELLS) so the pin
 * pass can shrink the maze by changing a single number.
 *
 * INSTANCES (Adam, 2026-10-30, design steer): groves come in the
 * plural eventually — lesser groves holding Circle fragments,
 * each maze seeded from its own instance stream. This build
 * places ONE (the crow's Grove), but the registry stays
 * instance-friendly: the layout derivation (deriveMazeLayout)
 * takes a label and a centre and hard-codes nothing about being
 * the only place; a lesser grove registers by deriving its own
 * layout under its own label ('grove:lesser-1' style streams)
 * and adding its features to the same site pass. Siting for
 * instances is their own future claim.
 */

import { deriveSeed, mulberry32 } from './seed';
import type { BiomeId, BiomeWeights, ScatterKind, ScatterObject } from '../types';

/** One axis-aligned collision box (a hedge unit's footprint). */
export interface SiteWallBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** A grid cell in the grove maze (col west->east, row north->south). */
export interface MazeCell {
  col: number;
  row: number;
}

/** The derived Grove: one per world seed. */
export interface GroveSite {
  /** Instance id ('grove' for the crow's Grove; lesser groves
   *  register their own ids — the registry is instance-shaped,
   *  see the header note). */
  id: string;
  seed: string;
  /** World position of the grove's centre (the maze's heart). */
  center: { x: number; z: number };
  /** Dominant biome at the centre (the siting scan's match). */
  biome: BiomeId;
  /** Distance from spawn along the seeded bearing, meters. */
  distance: number;
  /** Ordinary scatter is suppressed inside this radius, meters. */
  clearRadius: number;
  /** Standing-stone ring radius, meters. */
  ringRadius: number;
  /** Which side of the hedge square the entrance gap opens on —
   *  the side facing spawn, so the gap meets her approach. */
  entranceSide: 'north' | 'south' | 'east' | 'west';
  entranceCell: MazeCell;
  heartCell: MazeCell;
  /** The dead end farthest from the entrance by path length —
   *  the carved stone (the fragment site) stands there. */
  fragmentCell: MazeCell;
  /** Every site feature as a scatter object in world coordinates
   *  (stones, grove oaks, hedge units, the hoard, the carved
   *  stone, the great tree). Worldgen emits each into the chunk
   *  containing its position. */
  features: ScatterObject[];
  /** Collision boxes for the hedge units (same edges as the
   *  'hedgeWall' features, at wall thickness). */
  walls: SiteWallBox[];
  /** Cheap rejection square: the clearing circle's bounding box. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/**
 * Her refusal, in her voice (Adam, 2026-10-30: the refusal is
 * hers, not a system block). DRAFT copy — Adam's pin pass.
 */
export const GROVE_REFUSAL_LINE =
  'No. These were old when the world was young, and they are hers to keep.';

// --- Siting (all DRAFT) -------------------------------------------------

/** Siting band (Adam, 2026-10-30): five zones out is the CLOSEST
 *  any grove gets — 5 chunks x 32 m = 160 m floor from spawn. The
 *  300 m cap is unchanged: farther is fine. Previously-occupied
 *  places sit farther than groves (her story: human traces
 *  deepen with distance). */
export const GROVE_MIN_DIST_M = 160;
export const GROVE_MAX_DIST_M = 300;
const GROVE_SCAN_STEP_M = 10;
/** Biomes that can host the Grove (dominant-weight match). */
const GROVE_BIOMES: ReadonlySet<BiomeId> = new Set(['forest', 'tanglewood', 'oldfieldRise']);

// --- Layout (all DRAFT) --------------------------------------------------

/** Maze grid size: cells per side. ONE constant — the pin pass
 *  shrinks or grows the whole maze by changing this alone. Odd,
 *  so a single centre cell (the heart) exists. FLOOR 11 (Adam,
 *  2026-10-30): a solved-once maze earns nothing by being small,
 *  so the grid never goes below 11x11. */
export const GROVE_GRID_CELLS = 11;
/** Maze cell width, meters (also the hedge geometry's length). */
export const GROVE_CELL_M = 2.6;
export const GROVE_RING_RADIUS_M = 22;
export const GROVE_CLEAR_RADIUS_M = 28;
export const GROVE_STONE_COUNT = 9;
export const GROVE_OAK_COUNT = 7;
const GROVE_OAK_MIN_R = 23.5;
const GROVE_OAK_MAX_R = 26;
/** Hedge collision thickness, meters (the visual row is bushier;
 *  her body stops at the woody core). */
export const GROVE_WALL_THICKNESS_M = 0.6;

const groveCache = new Map<string, GroveSite>();

/**
 * Derive the world's Grove. `biomeAt` returns the DOMINANT biome
 * at a position (the generator's weightsAt().dominant). Memoized
 * by seed + instance id: spawn and biome fields are pure
 * functions of the seed, so the first caller's arguments define
 * the site for every later caller of the same world.
 */
export function groveSite(
  seed: string,
  spawn: { x: number; z: number },
  biomeAt: (x: number, z: number) => BiomeId,
): GroveSite {
  const cached = groveCache.get(`${seed}::grove`);
  if (cached) return cached;

  // Siting: a seeded bearing from spawn, scanned outward in
  // bounded steps until the dominant biome can host a grove. If
  // the band exhausts, the band's end stands (never an unbounded
  // search, never Math.random — worldgen rules).
  const bearingRand = mulberry32(deriveSeed(seed, 'site:grove'));
  const bearing = bearingRand() * Math.PI * 2;
  let center = {
    x: spawn.x + Math.cos(bearing) * GROVE_MAX_DIST_M,
    z: spawn.z + Math.sin(bearing) * GROVE_MAX_DIST_M,
  };
  let biome = biomeAt(center.x, center.z);
  let distance = GROVE_MAX_DIST_M;
  for (let d = GROVE_MIN_DIST_M; d <= GROVE_MAX_DIST_M; d += GROVE_SCAN_STEP_M) {
    const x = spawn.x + Math.cos(bearing) * d;
    const z = spawn.z + Math.sin(bearing) * d;
    const b = biomeAt(x, z);
    if (GROVE_BIOMES.has(b)) {
      center = { x, z };
      biome = b;
      distance = d;
      break;
    }
  }


  // Entrance side: the perimeter side facing spawn (she arrives
  // from spawn's direction). The layout derivation turns the
  // side into the entrance cell (the side's middle cell).
  const toSpawnX = spawn.x - center.x;
  const toSpawnZ = spawn.z - center.z;
  const entranceSide: GroveSite['entranceSide'] =
    Math.abs(toSpawnX) > Math.abs(toSpawnZ)
      ? toSpawnX > 0
        ? 'east'
        : 'west'
      : toSpawnZ > 0
        ? 'south'
        : 'north';

  const layout = deriveMazeLayout(seed, 'grove', center, entranceSide);

  const site: GroveSite = {
    id: 'grove',
    seed,
    center,
    biome,
    distance,
    clearRadius: GROVE_CLEAR_RADIUS_M,
    ringRadius: GROVE_RING_RADIUS_M,
    entranceSide,
    entranceCell: layout.entranceCell,
    heartCell: layout.heartCell,
    fragmentCell: layout.fragmentCell,
    features: layout.features,
    walls: layout.walls,
    bounds: {
      minX: center.x - GROVE_CLEAR_RADIUS_M,
      maxX: center.x + GROVE_CLEAR_RADIUS_M,
      minZ: center.z - GROVE_CLEAR_RADIUS_M,
      maxZ: center.z + GROVE_CLEAR_RADIUS_M,
    },
  };
  groveCache.set(`${seed}::grove`, site);
  return site;
}

/** One maze-grove instance's layout: everything about the place
 *  that derives from (seed, label, centre, entrance side). */
export interface MazeLayout {
  entranceCell: MazeCell;
  heartCell: MazeCell;
  fragmentCell: MazeCell;
  features: ScatterObject[];
  walls: SiteWallBox[];
}

/**
 * Derive a maze-grove layout under an instance label. The
 * label names the instance's streams ('grove' for the crow's
 * Grove; a lesser grove passes its own label and gets its own
 * maze, stones, and trees from the same code — instance-friendly
 * by construction, nothing here assumes it is the only place).
 * Ring radius, oak band, and clearing come from the shared
 * constants today; an instance that needs its own scale can
 * grow parameters here when its claim lands.
 */
export function deriveMazeLayout(
  seed: string,
  label: string,
  center: { x: number; z: number },
  entranceSide: GroveSite['entranceSide'],
): MazeLayout {
  const grid = GROVE_GRID_CELLS;
  const mid = (grid - 1) / 2;
  const cellM = GROVE_CELL_M;
  const cellCenter = (col: number, row: number): { x: number; z: number } => ({
    x: center.x + (col - mid) * cellM,
    z: center.z + (row - mid) * cellM,
  });
  const entranceCell: MazeCell =
    entranceSide === 'east'
      ? { col: grid - 1, row: mid }
      : entranceSide === 'west'
        ? { col: 0, row: mid }
        : entranceSide === 'south'
          ? { col: mid, row: grid - 1 }
          : { col: mid, row: 0 };

  // The maze: recursive backtracker over the cell graph, seeded
  // from the instance's own stream. A backtracker maze is a
  // spanning tree — every cell reachable, exactly one path
  // between any two cells, and its leaves are the dead ends.
  // hOpen[r][c] is the passage between (c, r) and (c+1, r);
  // vOpen[r][c] between (c, r) and (c, r+1).
  const mazeRand = mulberry32(deriveSeed(seed, `${label}:maze`));
  const hOpen: boolean[][] = Array.from({ length: grid }, () =>
    new Array<boolean>(grid - 1).fill(false),
  );
  const vOpen: boolean[][] = Array.from({ length: grid - 1 }, () =>
    new Array<boolean>(grid).fill(false),
  );
  {
    const visited: boolean[][] = Array.from({ length: grid }, () =>
      new Array<boolean>(grid).fill(false),
    );
    const stack: MazeCell[] = [{ col: 0, row: 0 }];
    visited[0][0] = true;
    while (stack.length > 0) {
      const cur = stack[stack.length - 1];
      const options: { cell: MazeCell; carve: () => void }[] = [];
      if (cur.col > 0 && !visited[cur.row][cur.col - 1]) {
        options.push({
          cell: { col: cur.col - 1, row: cur.row },
          carve: () => (hOpen[cur.row][cur.col - 1] = true),
        });
      }
      if (cur.col < grid - 1 && !visited[cur.row][cur.col + 1]) {
        options.push({
          cell: { col: cur.col + 1, row: cur.row },
          carve: () => (hOpen[cur.row][cur.col] = true),
        });
      }
      if (cur.row > 0 && !visited[cur.row - 1][cur.col]) {
        options.push({
          cell: { col: cur.col, row: cur.row - 1 },
          carve: () => (vOpen[cur.row - 1][cur.col] = true),
        });
      }
      if (cur.row < grid - 1 && !visited[cur.row + 1][cur.col]) {
        options.push({
          cell: { col: cur.col, row: cur.row + 1 },
          carve: () => (vOpen[cur.row][cur.col] = true),
        });
      }
      if (options.length === 0) {
        stack.pop();
        continue;
      }
      const pick = options[Math.floor(mazeRand() * options.length)];
      pick.carve();
      visited[pick.cell.row][pick.cell.col] = true;
      stack.push(pick.cell);
    }
  }

  const degree = (col: number, row: number): number => {
    let d = 0;
    if (col > 0 && hOpen[row][col - 1]) d++;
    if (col < grid - 1 && hOpen[row][col]) d++;
    if (row > 0 && vOpen[row - 1][col]) d++;
    if (row < grid - 1 && vOpen[row][col]) d++;
    return d;
  };

  // BFS path distances from the entrance over the passage graph.
  const dist = new Map<string, number>();
  {
    const key = (c: number, r: number): string => `${c},${r}`;
    const queue: MazeCell[] = [entranceCell];
    dist.set(key(entranceCell.col, entranceCell.row), 0);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const d = dist.get(key(cur.col, cur.row))!;
      const next: MazeCell[] = [];
      if (cur.col > 0 && hOpen[cur.row][cur.col - 1]) next.push({ col: cur.col - 1, row: cur.row });
      if (cur.col < grid - 1 && hOpen[cur.row][cur.col]) next.push({ col: cur.col + 1, row: cur.row });
      if (cur.row > 0 && vOpen[cur.row - 1][cur.col]) next.push({ col: cur.col, row: cur.row - 1 });
      if (cur.row < grid - 1 && vOpen[cur.row][cur.col]) next.push({ col: cur.col, row: cur.row + 1 });
      for (const n of next) {
        const k = key(n.col, n.row);
        if (!dist.has(k)) {
          dist.set(k, d + 1);
          queue.push(n);
        }
      }
    }
  }

  // The fragment cell: the dead end (degree 1, the entrance
  // excluded) with the greatest path distance from the entrance;
  // ties break by scan order (row, then col) — deterministic.
  let fragmentCell: MazeCell = entranceCell;
  let fragmentDist = -1;
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      if (col === entranceCell.col && row === entranceCell.row) continue;
      if (degree(col, row) !== 1) continue;
      const d = dist.get(`${col},${row}`) ?? -1;
      if (d > fragmentDist) {
        fragmentDist = d;
        fragmentCell = { col, row };
      }
    }
  }
  const heartCell: MazeCell = { col: mid, row: mid };

  // --- Features ------------------------------------------------------------
  const features: ScatterObject[] = [];
  const feat = (
    kind: ScatterKind,
    x: number,
    z: number,
    scale: number,
    rotY: number,
  ): void => {
    features.push({ kind, x, z, y: 0, scale, rotY });
  };

  // Standing stones: a ring, angles evenly spread with stream
  // jitter, each stone turned tangentially with its own lean of
  // facing. Stones have no collision — she walks between them;
  // the ring MARKS the place, the hedge is the wall.
  {
    const rand = mulberry32(deriveSeed(seed, `${label}:stones`));
    for (let i = 0; i < GROVE_STONE_COUNT; i++) {
      const a = (i / GROVE_STONE_COUNT) * Math.PI * 2 + (rand() - 0.5) * 0.3;
      const r = GROVE_RING_RADIUS_M + (rand() - 0.5) * 1.0;
      feat(
        'standingStone',
        center.x + Math.cos(a) * r,
        center.z + Math.sin(a) * r,
        0.9 + rand() * 0.45,
        a + Math.PI / 2 + (rand() - 0.5) * 0.4,
      );
    }
  }

  // The old trees: a band behind the ring (outside the hedge,
  // silhouettes over the walls), visibly older than wild trees —
  // their own kind ('groveOak', models.ts gives the older look).
  {
    const rand = mulberry32(deriveSeed(seed, `${label}:oaks`));
    for (let i = 0; i < GROVE_OAK_COUNT; i++) {
      const a = (i / GROVE_OAK_COUNT) * Math.PI * 2 + rand() * 0.5;
      const r = GROVE_OAK_MIN_R + rand() * (GROVE_OAK_MAX_R - GROVE_OAK_MIN_R);
      feat(
        'groveOak',
        center.x + Math.cos(a) * r,
        center.z + Math.sin(a) * r,
        1.15 + rand() * 0.5,
        rand() * Math.PI * 2,
      );
    }
  }

  // Hedges + their collision boxes: one unit per walled cell
  // edge. Iterating each cell's east + south edges covers every
  // internal edge and the east/south perimeter; the north and
  // west perimeters ride the row-0 / col-0 cells' north/west
  // edges. The entrance cell's outer edge is the one gap.
  const walls: SiteWallBox[] = [];
  const halfT = GROVE_WALL_THICKNESS_M / 2;
  const hedge = (x: number, z: number, alongZ: boolean): void => {
    feat('hedgeWall', x, z, 1, alongZ ? Math.PI / 2 : 0);
    walls.push(
      alongZ
        ? { minX: x - halfT, maxX: x + halfT, minZ: z - cellM / 2, maxZ: z + cellM / 2 }
        : { minX: x - cellM / 2, maxX: x + cellM / 2, minZ: z - halfT, maxZ: z + halfT },
    );
  };
  const isEntranceEdge = (
    side: 'north' | 'south' | 'east' | 'west',
    col: number,
    row: number,
  ): boolean =>
    entranceSide === side && entranceCell.col === col && entranceCell.row === row;
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const c = cellCenter(col, row);
      // East edge: internal wall, or the east perimeter.
      const eastWalled =
        col < grid - 1 ? !hOpen[row][col] : !isEntranceEdge('east', col, row);
      if (eastWalled) hedge(c.x + cellM / 2, c.z, true);
      // South edge: internal wall, or the south perimeter.
      const southWalled =
        row < grid - 1 ? !vOpen[row][col] : !isEntranceEdge('south', col, row);
      if (southWalled) hedge(c.x, c.z + cellM / 2, false);
      // North perimeter (row 0 only).
      if (row === 0 && !isEntranceEdge('north', col, row)) {
        hedge(c.x, c.z - cellM / 2, false);
      }
      // West perimeter (col 0 only).
      if (col === 0 && !isEntranceEdge('west', col, row)) {
        hedge(c.x - cellM / 2, c.z, true);
      }
    }
  }

  // The heart: the hoard mound at the centre cell's middle, the
  // grove's oldest tree at its edge, canopy over the hoard. The
  // hoard's CONTENTS stage with their own systems — the mound is
  // the place they will live.
  {
    const rand = mulberry32(deriveSeed(seed, `${label}:heart`));
    const heart = cellCenter(heartCell.col, heartCell.row);
    feat('hoardMound', heart.x + 0.3, heart.z + 0.35, 1, rand() * Math.PI * 2);
    feat('groveOak', heart.x - 0.85, heart.z - 0.85, 1.6, rand() * Math.PI * 2);
  }

  // The carved stone in the fragment cell, standing against the
  // dead end's closed side, its carved face turned toward the
  // cell's one open passage — she meets the face as she arrives.
  {
    const fc = cellCenter(fragmentCell.col, fragmentCell.row);
    // The dead end's single open direction (toward its neighbor).
    let openX = 0;
    let openZ = 0;
    if (fragmentCell.col > 0 && hOpen[fragmentCell.row][fragmentCell.col - 1]) openX = -1;
    else if (fragmentCell.col < grid - 1 && hOpen[fragmentCell.row][fragmentCell.col]) openX = 1;
    else if (fragmentCell.row > 0 && vOpen[fragmentCell.row - 1][fragmentCell.col]) openZ = -1;
    else if (fragmentCell.row < grid - 1 && vOpen[fragmentCell.row][fragmentCell.col]) openZ = 1;
    feat('carvedStone', fc.x - openX * 0.7, fc.z - openZ * 0.7, 1, Math.atan2(openX, openZ));
  }

  return { entranceCell, heartCell, fragmentCell, features, walls };
}
// === The Schoolhouse (site #2) ============================================
//
// An OPEN-AIR ruin she walks into in the same world — no
// zone-swap (Adam's shape, DEV framing 2026-10-30; locations
// build #2, merge #31 beside the Grove). A roofless wall ring
// with a door gap, a bell tower for the silhouette, rows of
// desks inside, the blackboard on the teaching wall (scenery —
// its fragment wiring stages with the marks system, like the
// hoard's contents), a flagpole by the door.
//
// Siting: previously-occupied places sit FARTHER than groves
// (Adam, 2026-10-30 — she hasn't met people yet; human traces
// deepen with distance): band 250–450 m (DRAFT), its own bearing
// stream, drier ground — oldfieldRise-dominant, or meadow-edge
// (meadow weight at or over the threshold; the biome census
// proved meadow cannot DOMINATE inside ~500 m under the
// distance gate, so the weight threshold is the honest form of
// meadow-edge character). SPACING vs the grove is a HARD filter
// during the scan — no candidate inside the sum of both
// clearings plus a margin is ever accepted.
//
// Collision: YES (Background's call, DEV-approved): the door
// gap is the design — a ring she can walk through anywhere has
// no door. The grove's stones MARK (she walks between them by
// design); these walls ENCLOSE — opposite functions, opposite
// calls. Walls, tower, desks, blackboard, and flagpole are
// solid on the same push-out machinery as the hedges; rubble is
// low and non-colliding (she steps over rubble).
//
// Orientation: quarter-turns only (build refinement, reported
// with the landing) — a stream-chosen axis swap rather than
// fine rotation snaps, so every collision box stays an EXACT
// axis-aligned box; the ruin read rides on the broken segments,
// rubble, and askew desks. All numbers DRAFT.

/** Siting band for the schoolhouse, meters from spawn (DRAFT). */
export const SCHOOL_MIN_DIST_M = 250;
export const SCHOOL_MAX_DIST_M = 450;
/** Clearing radius around the schoolhouse centre (DRAFT). */
export const SCHOOL_CLEAR_RADIUS_M = 16;
/** Meadow weight at/over which a candidate reads meadow-edge. */
export const SCHOOL_MEADOW_EDGE_WEIGHT = 0.2;
/** Wall ring dimensions, meters (DRAFT): 12 m long, 9 m deep,
 *  built from 3 m segments. */
export const SCHOOL_WALL_W_M = 12;
export const SCHOOL_WALL_D_M = 9;
export const SCHOOL_SEGMENT_M = 3;
const SCHOOL_WALL_HALF_T = 0.24;

/** The derived Schoolhouse: one per world seed. */
export interface SchoolSite {
  id: string;
  seed: string;
  center: { x: number; z: number };
  /** Dominant biome at the chosen centre. */
  biome: BiomeId;
  /** Siting distance from spawn, meters. */
  distance: number;
  clearRadius: number;
  /** Which side the door gap is on (the spawn-approach side). */
  doorSide: 'north' | 'south' | 'east' | 'west';
  features: ScatterObject[];
  walls: SiteWallBox[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const schoolCache = new Map<string, SchoolSite>();

/**
 * Derive the world's Schoolhouse. `weightsAtPos` returns the
 * full weights + dominant at a position (acceptance reads the
 * meadow weight, not just the dominant). Memoized by seed +
 * instance id, like the grove.
 */
export function schoolhouseSite(
  seed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): SchoolSite {
  const cached = schoolCache.get(`${seed}::schoolhouse`);
  if (cached) return cached;

  // Spacing is measured against the grove (memoized derivation).
  const grove = groveSite(seed, spawn, (x, z) => weightsAtPos(x, z).dominant);
  const spacing = grove.clearRadius + SCHOOL_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M;

  // Siting: its own bearing stream, scanned outward over the
  // band. The fallback guarantees a world always has its
  // schoolhouse: the first spacing-legal candidate, biome
  // unchecked; should no candidate be spacing-legal at all
  // (near-impossible — the rays would have to coincide), the
  // band-end point stands regardless.
  const bearing = mulberry32(deriveSeed(seed, 'site:schoolhouse'))() * Math.PI * 2;
  const dirX = Math.cos(bearing);
  const dirZ = Math.sin(bearing);
  let center = {
    x: spawn.x + dirX * SCHOOL_MAX_DIST_M,
    z: spawn.z + dirZ * SCHOOL_MAX_DIST_M,
  };
  let biome = weightsAtPos(center.x, center.z).dominant;
  let distance = SCHOOL_MAX_DIST_M;
  let fallback: { x: number; z: number; biome: BiomeId; distance: number } | null = null;
  for (let d = SCHOOL_MIN_DIST_M; d <= SCHOOL_MAX_DIST_M; d += GROVE_SCAN_STEP_M) {
    const x = spawn.x + dirX * d;
    const z = spawn.z + dirZ * d;
    if (Math.hypot(x - grove.center.x, z - grove.center.z) < spacing) continue;
    const w = weightsAtPos(x, z);
    if (!fallback) fallback = { x, z, biome: w.dominant, distance: d };
    if (w.dominant === 'oldfieldRise' || (w.weights.meadow ?? 0) >= SCHOOL_MEADOW_EDGE_WEIGHT) {
      center = { x, z };
      biome = w.dominant;
      distance = d;
      break;
    }
    if (d === SCHOOL_MAX_DIST_M && fallback) {
      center = { x: fallback.x, z: fallback.z };
      biome = fallback.biome;
      distance = fallback.distance;
    }
  }

  // --- Plan (streams under the 'schoolhouse' label) -------------------------
  const planRand = mulberry32(deriveSeed(seed, 'schoolhouse:plan'));
  // Axis swap: the 12 m axis runs world X (no swap) or world Z.
  const swap = planRand() < 0.5;
  const theta = swap ? Math.PI / 2 : 0;
  // Local -> world: quarter-turn rotation + translation.
  const toWorld = (lx: number, lz: number): { x: number; z: number } =>
    swap
      ? { x: center.x + lz, z: center.z - lx }
      : { x: center.x + lx, z: center.z + lz };

  // Door side: the side facing spawn (the grove-entrance
  // pattern), computed in the LOCAL frame — the plan is built
  // locally, so the approach direction is inverse-rotated into
  // it (under the swap, world (dx, dz) is local (-dz, dx)). The
  // site exports the WORLD side, re-rotated at assembly.
  const toSpawnX = spawn.x - center.x;
  const toSpawnZ = spawn.z - center.z;
  const localSpawnX = swap ? -toSpawnZ : toSpawnX;
  const localSpawnZ = swap ? toSpawnX : toSpawnZ;
  const doorSide: SchoolSite['doorSide'] =
    Math.abs(localSpawnX) > Math.abs(localSpawnZ)
      ? localSpawnX > 0
        ? 'east'
        : 'west'
      : localSpawnZ > 0
        ? 'south'
        : 'north';
  // Local -> world side names under the swap (a local outward
  // normal (nx, nz) maps to world (nz, -nx)): north -> west,
  // west -> south, south -> east, east -> north.
  const worldDoorSide: SchoolSite['doorSide'] = !swap
    ? doorSide
    : doorSide === 'north'
      ? 'west'
      : doorSide === 'west'
        ? 'south'
        : doorSide === 'south'
          ? 'east'
          : 'north';

  const W = SCHOOL_WALL_W_M;
  const D = SCHOOL_WALL_D_M;
  const SEG = SCHOOL_SEGMENT_M;
  interface Segment {
    side: 'north' | 'south' | 'east' | 'west';
    index: number;
    lx: number;
    lz: number;
    running: 'x' | 'z';
    cornerAdjacent: boolean;
  }
  const segments: Segment[] = [];
  const perLong = Math.round(W / SEG); // 4 along the 12 m sides
  const perShort = Math.round(D / SEG); // 3 along the 9 m sides
  for (let i = 0; i < perLong; i++) {
    const lx = -W / 2 + SEG / 2 + i * SEG;
    const corner = i === 0 || i === perLong - 1;
    segments.push({ side: 'north', index: i, lx, lz: -D / 2, running: 'x', cornerAdjacent: corner });
    segments.push({ side: 'south', index: i, lx, lz: D / 2, running: 'x', cornerAdjacent: corner });
  }
  for (let i = 0; i < perShort; i++) {
    const lz = -D / 2 + SEG / 2 + i * SEG;
    const corner = i === 0 || i === perShort - 1;
    segments.push({ side: 'west', index: i, lx: -W / 2, lz, running: 'z', cornerAdjacent: corner });
    segments.push({ side: 'east', index: i, lx: W / 2, lz, running: 'z', cornerAdjacent: corner });
  }

  // The door: the middle segment of the door side (on a 4-segment
  // side the plan stream picks which of the two middle segments).
  const doorPool = segments.filter((s) => s.side === doorSide);
  const door =
    doorPool.length % 2 === 0
      ? doorPool[doorPool.length / 2 - 1 + Math.floor(planRand() * 2)]
      : doorPool[Math.floor(doorPool.length / 2)];

  // Ruin: interior segments (never corner-adjacent, never the
  // door) are shuffled by the plan stream; the first 1–2 go
  // missing outright, the next 2–4 stand as broken stubs. The
  // rest stand full. Corners always stand.
  const candidates = segments.filter((s) => !s.cornerAdjacent && s !== door);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(planRand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const missingCount = 1 + Math.floor(planRand() * 2);
  const stubCount = 2 + Math.floor(planRand() * 3);
  const missing = new Set(candidates.slice(0, missingCount));
  const stubs = new Set(candidates.slice(missingCount, missingCount + stubCount));

  const features: ScatterObject[] = [];
  const walls: SiteWallBox[] = [];
  const feat = (kind: ScatterKind, x: number, z: number, scale: number, rotY: number): void => {
    features.push({ kind, x, z, y: 0, scale, rotY });
  };
  const box = (cx: number, cz: number, hx: number, hz: number): void => {
    walls.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });
  };
  /** Box for a local footprint (hx along local x, hz along local
   *  z) at a world centre, quarter-turn aware. */
  const localBox = (cx: number, cz: number, hx: number, hz: number): void => {
    if (swap) box(cx, cz, hz, hx);
    else box(cx, cz, hx, hz);
  };

  // Wall segments: feature + collision for every standing one
  // (stubs collide too — a 1.3 m broken wall is still a wall to
  // a witch whose hop is 0.6 m). Missing segments and the door
  // leave real gaps: no feature, no box.
  for (const s of segments) {
    if (s === door || missing.has(s)) continue;
    const w = toWorld(s.lx, s.lz);
    const runsWorldX = (s.running === 'x') !== swap;
    feat(stubs.has(s) ? 'ruinWallStub' : 'ruinWall', w.x, w.z, 1, (runsWorldX ? 0 : Math.PI / 2));
    if (runsWorldX) box(w.x, w.z, SEG / 2, SCHOOL_WALL_HALF_T);
    else box(w.x, w.z, SCHOOL_WALL_HALF_T, SEG / 2);
  }

  // Bell tower: at one of the door side's corners (plan stream
  // picks which), inset toward the interior so its footprint
  // sits on the corner.
  {
    const cornerX = (planRand() < 0.5 ? -1 : 1) * (W / 2 - 0.95);
    const alongWall =
      doorSide === 'north' || doorSide === 'south'
        ? { lx: cornerX, lz: (doorSide === 'north' ? -1 : 1) * (D / 2 - 0.95) }
        : { lx: (doorSide === 'west' ? -1 : 1) * (W / 2 - 0.95), lz: cornerX * (D / W) };
    const w = toWorld(alongWall.lx, alongWall.lz);
    feat('bellTower', w.x, w.z, 1, theta);
    box(w.x, w.z, 0.95, 0.95);
  }

  // Desks: 3 rows x 3 in local space, plan-stream jitter, one
  // desk turned square across its row (the askew read; its
  // collision uses the same quarter turn, so box and shape agree).
  {
    const rand = mulberry32(deriveSeed(seed, 'schoolhouse:desks'));
    const askew = Math.floor(rand() * 9);
    let n = 0;
    for (const lx of [-3.6, 0, 3.6]) {
      for (const lz of [-2.3, 0, 2.3]) {
        const jx = lx + (rand() - 0.5) * 0.5;
        const jz = lz + (rand() - 0.5) * 0.5;
        const turned = n === askew;
        const w = toWorld(jx, jz);
        feat('schoolDesk', w.x, w.z, 1, theta + (rand() - 0.5) * 0.14 + (turned ? Math.PI / 2 : 0));
        // Collision snaps to the desk's quarter (jitter ignored):
        // footprint 1.05 x 1.0 (top + bench).
        const quarterOdd = (swap ? 1 : 0) + (turned ? 1 : 0);
        if (quarterOdd % 2 === 0) box(w.x, w.z, 0.52, 0.5);
        else box(w.x, w.z, 0.5, 0.52);
        n++;
      }
    }
  }

  // Blackboard: centred on the wall OPPOSITE the door — the
  // teaching wall — facing into the room.
  {
    const side = doorSide === 'north' ? 'south' : doorSide === 'south' ? 'north' : doorSide === 'east' ? 'west' : 'east';
    const local =
      side === 'north'
        ? { lx: 0, lz: -D / 2 + 0.14, rot: 0 }
        : side === 'south'
          ? { lx: 0, lz: D / 2 - 0.14, rot: Math.PI }
          : side === 'east'
            ? { lx: W / 2 - 0.14, lz: 0, rot: -Math.PI / 2 }
            : { lx: -W / 2 + 0.14, lz: 0, rot: Math.PI / 2 };
    const w = toWorld(local.lx, local.lz);
    feat('blackboard', w.x, w.z, 1, theta + local.rot);
    localBox(w.x, w.z, side === 'north' || side === 'south' ? 1.7 : 0.12, side === 'north' || side === 'south' ? 0.12 : 1.7);
  }

  // Flagpole: BESIDE the door (Adam's framing) — outside the
  // wall, offset along the wall from the door segment's centre,
  // so the entry path through the doorway stays clear.
  {
    const beside = 1.9;
    const out =
      doorSide === 'north'
        ? { lx: door.lx + beside, lz: -D / 2 - 2.3 }
        : doorSide === 'south'
          ? { lx: door.lx + beside, lz: D / 2 + 2.3 }
          : doorSide === 'east'
            ? { lx: W / 2 + 2.3, lz: door.lz + beside }
            : { lx: -W / 2 - 2.3, lz: door.lz + beside };
    const w = toWorld(out.lx, out.lz);
    feat('flagpole', w.x, w.z, 1, theta);
    box(w.x, w.z, 0.13, 0.13);
  }

  // Rubble: 4–6 low mounds just inside the walls (own stream).
  // No collision — she steps over rubble.
  {
    const rand = mulberry32(deriveSeed(seed, 'schoolhouse:rubble'));
    const count = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const sidePick = rand();
      const along = (rand() * 2 - 1) * 0.8;
      const inset = 0.7 + rand() * 0.5;
      const local =
        sidePick < 0.25
          ? { lx: along * (W / 2), lz: -D / 2 + inset }
          : sidePick < 0.5
            ? { lx: along * (W / 2), lz: D / 2 - inset }
            : sidePick < 0.75
              ? { lx: -W / 2 + inset, lz: along * (D / 2) }
              : { lx: W / 2 - inset, lz: along * (D / 2) };
      const w = toWorld(local.lx, local.lz);
      feat('rubble', w.x, w.z, 0.7 + rand() * 0.6, rand() * Math.PI);
    }
  }

  const site: SchoolSite = {
    id: 'schoolhouse',
    seed,
    center,
    biome,
    distance,
    clearRadius: SCHOOL_CLEAR_RADIUS_M,
    doorSide: worldDoorSide,
    features,
    walls,
    bounds: {
      minX: center.x - SCHOOL_CLEAR_RADIUS_M,
      maxX: center.x + SCHOOL_CLEAR_RADIUS_M,
      minZ: center.z - SCHOOL_CLEAR_RADIUS_M,
      maxZ: center.z + SCHOOL_CLEAR_RADIUS_M,
    },
  };
  schoolCache.set(`${seed}::schoolhouse`, site);
  return site;
}

/** True when a world position lies inside the schoolhouse's
 *  clearing (the footprint check, groveContains' twin). */
export function schoolhouseContains(site: SchoolSite, x: number, z: number): boolean {
  return Math.hypot(x - site.center.x, z - site.center.z) <= site.clearRadius;
}

// ---------------------------------------------------------------------------
// THE BURNT VILLAGE — site #3 (Adam, 2026-10-30; claim
// approved by DEV the same day with both open calls ruled:
// smoke = the fog-exempt billboard column; spacing = the
// radii-sum + margin rule, not a literal 200 m edge-to-edge).
// The smoke avenue's destination and the populated-places
// framework's first customer: a settlement composed on the
// registry — a street spine on an old movement line, plots
// along it, one house per plot, each house rolled a ruin
// state. RECENTLY burned: ash, char, collapsed roofs.
//
// Siting (the doctrine: previously-occupied places sit
// FARTHER than groves — she hasn't met people yet): the far
// band 550–950 m, beyond the Schoolhouse's 250–450. Country:
// a settlement needs water — oldfield- or creek-dominant
// with creek weight present. Spacing against BOTH earlier
// sites is a hard scan filter (radii + 60 m margin; the
// bands keep real separations wide in practice).
//
// Layout composes in a quarter-turn frame (the schoolhouse
// refinement): the street runs along world X or Z by plan
// stream, so every wall stays an exact AABB. Houses are
// walk-in shells (Adam's interiors rule: small = walk-in).
// ---------------------------------------------------------------------------

/** Siting band from spawn, meters (DRAFT). */
export const VILLAGE_MIN_DIST_M = 550;
export const VILLAGE_MAX_DIST_M = 950;
/** Clearing radius around the village centre (DRAFT). */
export const VILLAGE_CLEAR_RADIUS_M = 58;
/** Creek-bottom weight at/over which a candidate has water. */
export const VILLAGE_CREEK_MIN_WEIGHT = 0.15;
/** House wall segment length / wall height, meters (DRAFT):
 *  a house is 7×7 m, two segments per side. */
export const VILLAGE_SEGMENT_M = 3.5;
export const VILLAGE_WALL_H_M = 2.6;
const VILLAGE_WALL_HALF_T = 0.15;
/** House-centre offset from the street axis (DRAFT). */
const VILLAGE_HOUSE_SETBACK_M = 6.8;
/** Plot centres along the street (local meters). */
const VILLAGE_PLOT_XS = [-30.8, -15.4, 0, 15.4, 30.8];
/** A plot's ruin fate (or 'gone' — burned to the ground). */
export type VillageHouseState = 'standing' | 'charred' | 'collapsed' | 'gone';

/** One village plot, as exported for the contents stagings. */
export interface VillagePlot {
  /** House centre, world coords ('gone' plots: the plot point). */
  x: number;
  z: number;
  state: VillageHouseState;
  /** True for the one hearth house (forced standing). */
  hearth: boolean;
}

/** The derived Burnt Village: one per world seed. */
export interface VillageSite {
  id: string;
  seed: string;
  center: { x: number; z: number };
  /** Dominant biome at the chosen centre. */
  biome: BiomeId;
  /** Siting distance from spawn, meters. */
  distance: number;
  clearRadius: number;
  /** World axis the street runs along. */
  streetAxis: 'x' | 'z';
  plots: VillagePlot[];
  /** The one hearth-standing house + its hearth spot (the
   *  found-familiar beat stages at the spot). */
  hearthHouse: {
    x: number;
    z: number;
    hearthSpot: { x: number; z: number };
    /** Where the smoke column rises (the chimney top). */
    smokeAnchor: { x: number; z: number; y: number };
  };
  /** The village well (the bones beat stages one spot here). */
  well: { x: number; z: number };
  /** Seeded bone-scatter spots for the bones beat. */
  boneSpots: { x: number; z: number; where: 'house' | 'well' | 'street' }[];
  features: ScatterObject[];
  walls: SiteWallBox[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const villageCache = new Map<string, VillageSite>();

/**
 * Derive the world's Burnt Village. `weightsAtPos` returns
 * the full weights + dominant at a position. Memoized by
 * seed, like the other sites.
 */
export function villageSite(
  seed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): VillageSite {
  const cached = villageCache.get(`${seed}::village`);
  if (cached) return cached;

  // Spacing is measured against both earlier sites.
  const grove = groveSite(seed, spawn, (x, z) => weightsAtPos(x, z).dominant);
  const school = schoolhouseSite(seed, spawn, weightsAtPos);
  const spacingVs = (other: SiteFootprint): number =>
    other.clearRadius + VILLAGE_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M;
  const spacingLegal = (x: number, z: number): boolean =>
    Math.hypot(x - grove.center.x, z - grove.center.z) >= spacingVs(grove) &&
    Math.hypot(x - school.center.x, z - school.center.z) >= spacingVs(school);

  // Siting: its own bearing stream, scanned outward over the
  // band (the schoolhouse fallback shape: the first
  // spacing-legal candidate is remembered biome-unchecked;
  // should none be spacing-legal, the band-end point stands).
  const bearing = mulberry32(deriveSeed(seed, 'site:village'))() * Math.PI * 2;
  const dirX = Math.cos(bearing);
  const dirZ = Math.sin(bearing);
  let center = {
    x: spawn.x + dirX * VILLAGE_MAX_DIST_M,
    z: spawn.z + dirZ * VILLAGE_MAX_DIST_M,
  };
  let biome = weightsAtPos(center.x, center.z).dominant;
  let distance = VILLAGE_MAX_DIST_M;
  let fallback: { x: number; z: number; biome: BiomeId; distance: number } | null = null;
  for (let d = VILLAGE_MIN_DIST_M; d <= VILLAGE_MAX_DIST_M; d += GROVE_SCAN_STEP_M) {
    const x = spawn.x + dirX * d;
    const z = spawn.z + dirZ * d;
    if (!spacingLegal(x, z)) continue;
    const w = weightsAtPos(x, z);
    if (!fallback) fallback = { x, z, biome: w.dominant, distance: d };
    if (
      (w.dominant === 'oldfieldRise' || w.dominant === 'creekBottom') &&
      (w.weights.creekBottom ?? 0) >= VILLAGE_CREEK_MIN_WEIGHT
    ) {
      center = { x, z };
      biome = w.dominant;
      distance = d;
      break;
    }
    if (d === VILLAGE_MAX_DIST_M && fallback) {
      center = { x: fallback.x, z: fallback.z };
      biome = fallback.biome;
      distance = fallback.distance;
    }
  }

  // --- Layout (streams under the 'village' label) ---------------------------
  const planRand = mulberry32(deriveSeed(seed, 'village:plan'));
  // Quarter-turn frame: the street runs along local X; the
  // swap turns it onto world Z. Local -> world like the school.
  const swap = planRand() < 0.5;
  const theta = swap ? Math.PI / 2 : 0;
  const toWorld = (lx: number, lz: number): { x: number; z: number } =>
    swap
      ? { x: center.x + lz, z: center.z - lx }
      : { x: center.x + lx, z: center.z + lz };

  const features: ScatterObject[] = [];
  const walls: SiteWallBox[] = [];
  const feat = (kind: ScatterKind, x: number, z: number, y: number, scale: number, rotY: number): void => {
    features.push({ kind, x, z, y, scale, rotY });
  };
  const box = (cx: number, cz: number, hx: number, hz: number): void => {
    walls.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });
  };

  // Plots: five stations along the street, a house plot on
  // each side of each station. The hearth plot is picked
  // first and forced built + standing.
  interface PlotPlan {
    lx: number;
    lz: number;
    side: -1 | 1;
  }
  const plotPlans: PlotPlan[] = [];
  for (const side of [-1, 1] as const) {
    for (const px of VILLAGE_PLOT_XS) {
      plotPlans.push({ lx: px, lz: side * VILLAGE_HOUSE_SETBACK_M, side });
    }
  }
  const hearthIndex = Math.floor(planRand() * plotPlans.length);

  const plots: VillagePlot[] = [];
  const builtHouses: { plan: PlotPlan; world: { x: number; z: number } }[] = [];
  let hearthHouse: VillageSite['hearthHouse'] | null = null;

  plotPlans.forEach((plan, idx) => {
    const world = toWorld(plan.lx, plan.lz);
    const isHearth = idx === hearthIndex;
    let state: VillageHouseState;
    if (isHearth) state = 'standing';
    else if (planRand() < 0.15) state = 'gone';
    else {
      const roll = planRand();
      state = roll < 0.25 ? 'standing' : roll < 0.7 ? 'charred' : 'collapsed';
    }
    plots.push({ x: world.x, z: world.z, state, hearth: isHearth });
    if (state === 'gone') return;
    builtHouses.push({ plan, world });

    // Segments: two per side of the 7×7 ring. The street
    // side is local -side (toward the axis); its door gap is
    // one segment, plan-picked (the door burned away — the
    // gap is the full segment, like the schoolhouse).
    interface Seg {
      lx: number;
      lz: number;
      running: 'x' | 'z';
      doorSide: boolean;
    }
    const segs: Seg[] = [];
    const H = VILLAGE_SEGMENT_M; // 3.5 — half the house side
    for (const off of [-H / 2, H / 2]) {
      segs.push({ lx: plan.lx + off, lz: plan.lz - H, running: 'x', doorSide: plan.side === 1 });
      segs.push({ lx: plan.lx + off, lz: plan.lz + H, running: 'x', doorSide: plan.side === -1 });
      segs.push({ lx: plan.lx - H, lz: plan.lz + off, running: 'z', doorSide: false });
      segs.push({ lx: plan.lx + H, lz: plan.lz + off, running: 'z', doorSide: false });
    }
    const doorPool = segs.filter((s) => s.doorSide);
    const door = doorPool[Math.floor(planRand() * doorPool.length)];

    const emitSeg = (s: Seg, kind: ScatterKind, scale: number): void => {
      const w = toWorld(s.lx, s.lz);
      const runsWorldX = (s.running === 'x') !== swap;
      feat(kind, w.x, w.z, 0, scale, runsWorldX ? 0 : Math.PI / 2);
      const halfLen = (VILLAGE_SEGMENT_M / 2) * scale;
      if (runsWorldX) box(w.x, w.z, halfLen, VILLAGE_WALL_HALF_T);
      else box(w.x, w.z, VILLAGE_WALL_HALF_T, halfLen);
    };

    if (state === 'standing') {
      for (const s of segs) {
        if (s === door) continue;
        emitSeg(s, 'villageWall', 1);
      }
      feat('villageRoof', world.x, world.z, VILLAGE_WALL_H_M, 1, theta);
    } else if (state === 'charred') {
      // One or two non-door segments burned through entirely.
      const others = segs.filter((s) => s !== door);
      const missingCount = 1 + Math.floor(planRand() * 2);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(planRand() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      const missing = new Set(others.slice(0, missingCount));
      for (const s of segs) {
        if (s === door || missing.has(s)) continue;
        emitSeg(s, 'villageWallCharred', 1);
      }
      feat('villageRoofFallen', world.x, world.z, 0, 1, theta);
    } else {
      // Collapsed: most segments gone; the rest stand as
      // half-height charred stubs (scale 0.5 — box follows).
      for (const s of segs) {
        if (planRand() < 0.55) continue;
        emitSeg(s, 'villageWallCharred', 0.5);
      }
      const rubbleRand = mulberry32(deriveSeed(seed, `village:rubble:${idx}`));
      const rubbleCount = 2 + Math.floor(rubbleRand() * 2);
      for (let i = 0; i < rubbleCount; i++) {
        const w = toWorld(
          plan.lx + (rubbleRand() * 2 - 1) * 2.4,
          plan.lz + (rubbleRand() * 2 - 1) * 2.4,
        );
        feat('rubble', w.x, w.z, 0, 0.7 + rubbleRand() * 0.6, rubbleRand() * Math.PI);
      }
    }

    if (isHearth) {
      // The hearth stands against the back wall (away from
      // the street); the smoke rises from the roof's chimney
      // (the villageRoof build carries it at local +2.3 x).
      const spotLocal = { lx: plan.lx, lz: plan.lz + plan.side * 2.4 };
      const spot = toWorld(spotLocal.lx, spotLocal.lz);
      const chimney = toWorld(plan.lx + 2.3, plan.lz);
      hearthHouse = {
        x: world.x,
        z: world.z,
        hearthSpot: spot,
        smokeAnchor: { x: chimney.x, z: chimney.z, y: 5.2 },
      };
    }
  });

  // The well: just off the street's edge near its middle,
  // on the + side. Solid — she walks around it.
  const wellLocal = { lx: 5.5, lz: 4.4 };
  const wellWorld = toWorld(wellLocal.lx, wellLocal.lz);
  feat('villageWell', wellWorld.x, wellWorld.z, 0, 1, theta);
  box(wellWorld.x, wellWorld.z, 0.85, 0.85);

  // Ash: the street reads as an ash track (discs along the
  // axis), and the whole footprint stands in ash fall.
  {
    const rand = mulberry32(deriveSeed(seed, 'village:ash'));
    for (let lx = -39; lx <= 39; lx += 6.5) {
      const w = toWorld(lx, (rand() * 2 - 1) * 1.6);
      feat('ashPatch', w.x, w.z, 0.02, 1.4 + rand() * 1.2, rand() * Math.PI);
    }
    for (let i = 0; i < 22; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * (VILLAGE_CLEAR_RADIUS_M - 4);
      const w = toWorld(Math.cos(a) * r, Math.sin(a) * r);
      feat('ashPatch', w.x, w.z, 0.02, 0.8 + rand() * 1.6, rand() * Math.PI);
    }
  }

  // Bone spots (the bones beat stages here — positions and
  // their ground only; the bones themselves are contents).
  const boneSpots: VillageSite['boneSpots'] = [];
  {
    const rand = mulberry32(deriveSeed(seed, 'village:bones'));
    const houses = [...builtHouses];
    for (let i = houses.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [houses[i], houses[j]] = [houses[j], houses[i]];
    }
    for (const h of houses.slice(0, 2)) {
      boneSpots.push({
        x: h.world.x + (rand() * 2 - 1) * 1.5,
        z: h.world.z + (rand() * 2 - 1) * 1.5,
        where: 'house',
      });
    }
    boneSpots.push({ x: wellWorld.x + 1.1, z: wellWorld.z + 0.6, where: 'well' });
    const streetW = toWorld((rand() * 2 - 1) * 20, 0);
    boneSpots.push({ x: streetW.x, z: streetW.z, where: 'street' });
  }

  const site: VillageSite = {
    id: 'village',
    seed,
    center,
    biome,
    distance,
    clearRadius: VILLAGE_CLEAR_RADIUS_M,
    streetAxis: swap ? 'z' : 'x',
    plots,
    // The hearth house always exists (its plot is forced).
    hearthHouse: hearthHouse!,
    well: wellWorld,
    boneSpots,
    features,
    walls,
    bounds: {
      minX: center.x - VILLAGE_CLEAR_RADIUS_M,
      maxX: center.x + VILLAGE_CLEAR_RADIUS_M,
      minZ: center.z - VILLAGE_CLEAR_RADIUS_M,
      maxZ: center.z + VILLAGE_CLEAR_RADIUS_M,
    },
  };
  villageCache.set(`${seed}::village`, site);
  return site;
}

/** True when a world position lies inside the village's
 *  clearing (the footprint check). */
export function villageContains(site: VillageSite, x: number, z: number): boolean {
  return Math.hypot(x - site.center.x, z - site.center.z) <= site.clearRadius;
}

// ---------------------------------------------------------------------------
// THE FARMHOUSE — site #4 (Adam, 2026-10-30; claim approved
// by DEV with the spacing margin corrected to the standing
// 60 m). The schoolhouse's opposite number: a domestic ruin
// that is MOSTLY INTACT — roofed, walk-in, with a partition,
// a porch, and the hearth whose great stone carries the
// Home fragments. Domestic ground: it sites on farm country
// (the old fields) in the 300–600 m band, with the spacing
// filter (radii-sum + 60 against all three earlier sites)
// doing real work where the bands overlap.
// ---------------------------------------------------------------------------

/** Siting band from spawn, meters (DRAFT). */
export const FARM_MIN_DIST_M = 300;
export const FARM_MAX_DIST_M = 600;
/** Clearing radius around the farmhouse centre (DRAFT). */
export const FARM_CLEAR_RADIUS_M = 20;
/** Oldfield weight at/over which a candidate reads farm-edge. */
export const FARM_OLDFIELD_EDGE_WEIGHT = 0.25;
/** Wall segment length / house plan, meters (DRAFT): the
 *  house is 10 × 7.5 m of 2.5 m segments. */
export const FARM_SEGMENT_M = 2.5;
export const FARM_WALL_W_M = 10;
export const FARM_WALL_D_M = 7.5;
export const FARM_WALL_H_M = 2.6;
const FARM_WALL_HALF_T = 0.15;

/** The derived Farmhouse: one per world seed. */
export interface FarmSite {
  id: string;
  seed: string;
  center: { x: number; z: number };
  /** Dominant biome at the chosen centre. */
  biome: BiomeId;
  /** Siting distance from spawn, meters. */
  distance: number;
  clearRadius: number;
  /** Which side the door (and porch) is on, world frame. */
  doorSide: 'north' | 'south' | 'east' | 'west';
  /** The hearth block's position (inside, at the chimney end). */
  hearthSpot: { x: number; z: number };
  /** THE GREAT STONE's position — the Home-fragment carrier. */
  hearthStone: { x: number; z: number };
  /** The cellar door's spot (anchor only — nothing below in v1). */
  cellarDoor: { x: number; z: number };
  features: ScatterObject[];
  walls: SiteWallBox[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const farmCache = new Map<string, FarmSite>();

/**
 * Derive the world's Farmhouse. `weightsAtPos` returns the
 * full weights + dominant at a position. Memoized by seed.
 */
export function farmhouseSite(
  seed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): FarmSite {
  const cached = farmCache.get(`${seed}::farmhouse`);
  if (cached) return cached;

  // Spacing against all three earlier sites (radii + 60).
  const grove = groveSite(seed, spawn, (x, z) => weightsAtPos(x, z).dominant);
  const school = schoolhouseSite(seed, spawn, weightsAtPos);
  const village = villageSite(seed, spawn, weightsAtPos);
  const spacingLegal = (x: number, z: number): boolean =>
    [grove, school, village].every(
      (s) =>
        Math.hypot(x - s.center.x, z - s.center.z) >=
        s.clearRadius + FARM_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M,
    );

  // Siting: own bearing stream over the band, the standing
  // fallback shape.
  const bearing = mulberry32(deriveSeed(seed, 'site:farmhouse'))() * Math.PI * 2;
  const dirX = Math.cos(bearing);
  const dirZ = Math.sin(bearing);
  let center = {
    x: spawn.x + dirX * FARM_MAX_DIST_M,
    z: spawn.z + dirZ * FARM_MAX_DIST_M,
  };
  let biome = weightsAtPos(center.x, center.z).dominant;
  let distance = FARM_MAX_DIST_M;
  let fallback: { x: number; z: number; biome: BiomeId; distance: number } | null = null;
  for (let d = FARM_MIN_DIST_M; d <= FARM_MAX_DIST_M; d += GROVE_SCAN_STEP_M) {
    const x = spawn.x + dirX * d;
    const z = spawn.z + dirZ * d;
    if (!spacingLegal(x, z)) continue;
    const w = weightsAtPos(x, z);
    if (!fallback) fallback = { x, z, biome: w.dominant, distance: d };
    if (w.dominant === 'oldfieldRise' || (w.weights.oldfieldRise ?? 0) >= FARM_OLDFIELD_EDGE_WEIGHT) {
      center = { x, z };
      biome = w.dominant;
      distance = d;
      break;
    }
    if (d === FARM_MAX_DIST_M && fallback) {
      center = { x: fallback.x, z: fallback.z };
      biome = fallback.biome;
      distance = fallback.distance;
    }
  }

  // --- Plan (streams under the 'farmhouse' label) ---------------------------
  const planRand = mulberry32(deriveSeed(seed, 'farmhouse:plan'));
  const swap = planRand() < 0.5;
  const theta = swap ? Math.PI / 2 : 0;
  const toWorld = (lx: number, lz: number): { x: number; z: number } =>
    swap
      ? { x: center.x + lz, z: center.z - lx }
      : { x: center.x + lx, z: center.z + lz };

  // Door side: the spawn-approach side, computed in the
  // local frame (the schoolhouse pattern, verbatim shape).
  const toSpawnX = spawn.x - center.x;
  const toSpawnZ = spawn.z - center.z;
  const localSpawnX = swap ? -toSpawnZ : toSpawnX;
  const localSpawnZ = swap ? toSpawnX : toSpawnZ;
  const doorSide: FarmSite['doorSide'] =
    Math.abs(localSpawnX) > Math.abs(localSpawnZ)
      ? localSpawnX > 0
        ? 'east'
        : 'west'
      : localSpawnZ > 0
        ? 'south'
        : 'north';
  const worldDoorSide: FarmSite['doorSide'] = !swap
    ? doorSide
    : doorSide === 'north'
      ? 'west'
      : doorSide === 'west'
        ? 'south'
        : doorSide === 'south'
          ? 'east'
          : 'north';

  const W = FARM_WALL_W_M;
  const D = FARM_WALL_D_M;
  const SEG = FARM_SEGMENT_M;

  const features: ScatterObject[] = [];
  const walls: SiteWallBox[] = [];
  const feat = (kind: ScatterKind, x: number, z: number, y: number, scale: number, rotY: number): void => {
    features.push({ kind, x, z, y, scale, rotY });
  };
  const box = (cx: number, cz: number, hx: number, hz: number): void => {
    walls.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });
  };

  interface Segment {
    side: 'north' | 'south' | 'east' | 'west';
    lx: number;
    lz: number;
    running: 'x' | 'z';
    cornerAdjacent: boolean;
  }
  const segments: Segment[] = [];
  const perLong = Math.round(W / SEG); // 4
  const perShort = Math.round(D / SEG); // 3
  for (let i = 0; i < perLong; i++) {
    const lx = -W / 2 + SEG / 2 + i * SEG;
    const corner = i === 0 || i === perLong - 1;
    segments.push({ side: 'north', lx, lz: -D / 2, running: 'x', cornerAdjacent: corner });
    segments.push({ side: 'south', lx, lz: D / 2, running: 'x', cornerAdjacent: corner });
  }
  for (let i = 0; i < perShort; i++) {
    const lz = -D / 2 + SEG / 2 + i * SEG;
    const corner = i === 0 || i === perShort - 1;
    segments.push({ side: 'west', lx: -W / 2, lz, running: 'z', cornerAdjacent: corner });
    segments.push({ side: 'east', lx: W / 2, lz, running: 'z', cornerAdjacent: corner });
  }

  // The door: the middle segment of the door side.
  const doorPool = segments.filter((s) => s.side === doorSide);
  const door =
    doorPool.length % 2 === 0
      ? doorPool[doorPool.length / 2 - 1 + Math.floor(planRand() * 2)]
      : doorPool[Math.floor(doorPool.length / 2)];

  // Mostly intact: 0–2 interior (non-corner, non-door)
  // segments are damaged — the plan stream splits them
  // between missing and stub (a stub is a half-height wall:
  // scale 0.45, box follows the scale, village precedent).
  const candidates = segments.filter((s) => !s.cornerAdjacent && s !== door);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(planRand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const damagedCount = Math.floor(planRand() * 3); // 0..2
  const missing = new Set(candidates.slice(0, Math.ceil(damagedCount / 2)));
  const stubs = new Set(candidates.slice(Math.ceil(damagedCount / 2), damagedCount));

  const emitWall = (lx: number, lz: number, running: 'x' | 'z', scale: number): void => {
    const w = toWorld(lx, lz);
    const runsWorldX = (running === 'x') !== swap;
    feat('farmWall', w.x, w.z, 0, scale, runsWorldX ? 0 : Math.PI / 2);
    const halfLen = (SEG / 2) * scale;
    if (runsWorldX) box(w.x, w.z, halfLen, FARM_WALL_HALF_T);
    else box(w.x, w.z, FARM_WALL_HALF_T, halfLen);
  };
  for (const s of segments) {
    if (s === door || missing.has(s)) continue;
    emitWall(s.lx, s.lz, s.running, stubs.has(s) ? 0.45 : 1);
  }

  // The roof: whole, always (mostly intact is the point).
  feat('farmRoof', center.x, center.z, FARM_WALL_H_M, 1, theta);

  // The porch: one composed feature at the door, facing
  // out; its two front posts collide.
  {
    const outRot =
      doorSide === 'north' ? Math.PI : doorSide === 'south' ? 0 : doorSide === 'east' ? Math.PI / 2 : -Math.PI / 2;
    const doorW = toWorld(door.lx, door.lz);
    feat('farmPorch', doorW.x, doorW.z, 0, 1, theta + outRot);
    // Post spots in the porch's local frame (front corners),
    // rotated into the house frame then the world.
    const rot = (lx: number, lz: number, r: number): { x: number; z: number } => {
      const c = Math.cos(r);
      const s = Math.sin(r);
      return { x: lx * c + lz * s, z: -lx * s + lz * c };
    };
    for (const px of [-1.65, 1.65]) {
      const inHouse = rot(px, 2.05, outRot);
      const w = toWorld(door.lx + inHouse.x, door.lz + inHouse.z);
      box(w.x, w.z, 0.13, 0.13);
    }
  }

  // The partition: a wall line at local z +1.25 (dividing
  // the house into the big north room — the hearth's room
  // — and a south strip), four segments along x with one
  // of the middle two open: the doorway between rooms. The
  // line runs parallel to the long walls, so it can never
  // cross a door's span the way a cross-line could (probe
  // catch, first build: a z-running partition at x +1.67
  // met the north wall inside a door segment's span).
  {
    const lz = 1.25;
    const gapIndex = 1 + Math.floor(planRand() * 2); // a middle segment
    [-3.75, -1.25, 1.25, 3.75].forEach((lx, i) => {
      if (i !== gapIndex) emitWall(lx, lz, 'x', 1);
    });
  }

  // The hearth: against the chimney end wall (local −X),
  // centred; the great stone stands beside it along the
  // same wall. The hearth block collides; the great stone
  // (the carrier) is low and she steps to it — no box.
  const hearthLocal = { lx: -W / 2 + 1.05, lz: 0 };
  const hearthWorld = toWorld(hearthLocal.lx, hearthLocal.lz);
  feat('hearthStone', hearthWorld.x, hearthWorld.z, 0, 1.5, theta);
  // Hearth box in the house frame (0.55 along the wall's
  // depth axis, 0.85 across), quarter-turn aware.
  if (swap) box(hearthWorld.x, hearthWorld.z, 0.85, 0.55);
  else box(hearthWorld.x, hearthWorld.z, 0.55, 0.85);
  const stoneLocal = { lx: -W / 2 + 1.05, lz: -1.85 };
  const stoneWorld = toWorld(stoneLocal.lx, stoneLocal.lz);
  feat('hearthStone', stoneWorld.x, stoneWorld.z, 0, 1, theta + Math.PI / 5);

  // The cellar door: an anchor only, at the back foundation
  // (the side opposite the door) — a staged cave-mouth host.
  const backSign = doorSide === 'north' || doorSide === 'west' ? 1 : -1;
  const cellarLocal =
    doorSide === 'north' || doorSide === 'south'
      ? { lx: 2.0, lz: backSign * (D / 2 + 0.9) }
      : { lx: backSign * (W / 2 + 0.9), lz: 2.0 };
  const cellarWorld = toWorld(cellarLocal.lx, cellarLocal.lz);

  // A little rubble where the years have nibbled.
  {
    const rand = mulberry32(deriveSeed(seed, 'farmhouse:rubble'));
    const count = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const w = toWorld((rand() * 2 - 1) * (W / 2 + 1.5), (rand() < 0.5 ? -1 : 1) * (D / 2 + 0.6 + rand()));
      feat('rubble', w.x, w.z, 0, 0.6 + rand() * 0.5, rand() * Math.PI);
    }
  }

  const site: FarmSite = {
    id: 'farmhouse',
    seed,
    center,
    biome,
    distance,
    clearRadius: FARM_CLEAR_RADIUS_M,
    doorSide: worldDoorSide,
    hearthSpot: hearthWorld,
    hearthStone: stoneWorld,
    cellarDoor: cellarWorld,
    features,
    walls,
    bounds: {
      minX: center.x - FARM_CLEAR_RADIUS_M,
      maxX: center.x + FARM_CLEAR_RADIUS_M,
      minZ: center.z - FARM_CLEAR_RADIUS_M,
      maxZ: center.z + FARM_CLEAR_RADIUS_M,
    },
  };
  farmCache.set(`${seed}::farmhouse`, site);
  return site;
}

/** True when a world position lies inside the farmhouse's
 *  clearing (the footprint check). */
export function farmhouseContains(site: FarmSite, x: number, z: number): boolean {
  return Math.hypot(x - site.center.x, z - site.center.z) <= site.clearRadius;
}

// ---------------------------------------------------------------------------
// THE CHAPEL — site #5 (Adam, 2026-10-30; claim approved by
// DEV with the spacing margin at the standing 60). Circle
// ground: a tall, mostly-intact shell with a steeple, and
// its GRAVEYARD — a field of stones on one side, one of
// them named (the inscription stone, exported for the
// marks staging). It sites 350–650 m out where its people
// farmed and gathered, spacing-checked against all four
// earlier sites on the standing radii + 60 rule.
// ---------------------------------------------------------------------------

/** Siting band from spawn, meters (DRAFT). */
export const CHAPEL_MIN_DIST_M = 350;
export const CHAPEL_MAX_DIST_M = 650;
/** Clearing radius around the chapel centre (DRAFT):
 *  covers the shell and the yard. */
export const CHAPEL_CLEAR_RADIUS_M = 24;
/** Meadow weight at/over which a candidate reads meadow-edge. */
export const CHAPEL_MEADOW_EDGE_WEIGHT = 0.2;
/** Wall segment length / nave plan, meters (DRAFT): the
 *  nave is 11 × 5.5 m of 2.75 m segments; walls stand
 *  3.4 m — taller than a house's, a church's read. */
export const CHAPEL_SEGMENT_M = 2.75;
export const CHAPEL_WALL_W_M = 11;
export const CHAPEL_WALL_D_M = 5.5;
export const CHAPEL_WALL_H_M = 3.4;
const CHAPEL_WALL_HALF_T = 0.16;

/** The derived Chapel: one per world seed. */
export interface ChapelSite {
  id: string;
  seed: string;
  center: { x: number; z: number };
  /** Dominant biome at the chosen centre. */
  biome: BiomeId;
  /** Siting distance from spawn, meters. */
  distance: number;
  clearRadius: number;
  /** Which side the door is on, world frame. */
  doorSide: 'north' | 'south' | 'east' | 'west';
  /** Which side the graveyard lies on, world frame. */
  yardSide: 'north' | 'south' | 'east' | 'west';
  /** The named gravestone nearest the door path — the
   *  marks staging's inscription anchor. */
  inscriptionStone: { x: number; z: number };
  features: ScatterObject[];
  walls: SiteWallBox[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const chapelCache = new Map<string, ChapelSite>();

/**
 * Derive the world's Chapel. `weightsAtPos` returns the
 * full weights + dominant at a position. Memoized by seed.
 */
export function chapelSite(
  seed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): ChapelSite {
  const cached = chapelCache.get(`${seed}::chapel`);
  if (cached) return cached;

  // Spacing against all four earlier sites (radii + 60).
  const grove = groveSite(seed, spawn, (x, z) => weightsAtPos(x, z).dominant);
  const school = schoolhouseSite(seed, spawn, weightsAtPos);
  const village = villageSite(seed, spawn, weightsAtPos);
  const farm = farmhouseSite(seed, spawn, weightsAtPos);
  const spacingLegal = (x: number, z: number): boolean =>
    [grove, school, village, farm].every(
      (s) =>
        Math.hypot(x - s.center.x, z - s.center.z) >=
        s.clearRadius + CHAPEL_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M,
    );

  // Siting: own bearing stream over the band, the standing
  // fallback shape.
  const bearing = mulberry32(deriveSeed(seed, 'site:chapel'))() * Math.PI * 2;
  const dirX = Math.cos(bearing);
  const dirZ = Math.sin(bearing);
  let center = {
    x: spawn.x + dirX * CHAPEL_MAX_DIST_M,
    z: spawn.z + dirZ * CHAPEL_MAX_DIST_M,
  };
  let biome = weightsAtPos(center.x, center.z).dominant;
  let distance = CHAPEL_MAX_DIST_M;
  let fallback: { x: number; z: number; biome: BiomeId; distance: number } | null = null;
  for (let d = CHAPEL_MIN_DIST_M; d <= CHAPEL_MAX_DIST_M; d += GROVE_SCAN_STEP_M) {
    const x = spawn.x + dirX * d;
    const z = spawn.z + dirZ * d;
    if (!spacingLegal(x, z)) continue;
    const w = weightsAtPos(x, z);
    if (!fallback) fallback = { x, z, biome: w.dominant, distance: d };
    if (w.dominant === 'oldfieldRise' || (w.weights.meadow ?? 0) >= CHAPEL_MEADOW_EDGE_WEIGHT) {
      center = { x, z };
      biome = w.dominant;
      distance = d;
      break;
    }
    if (d === CHAPEL_MAX_DIST_M && fallback) {
      center = { x: fallback.x, z: fallback.z };
      biome = fallback.biome;
      distance = fallback.distance;
    }
  }

  // --- Plan (streams under the 'chapel' label) -------------------------------
  const planRand = mulberry32(deriveSeed(seed, 'chapel:plan'));
  const swap = planRand() < 0.5;
  const theta = swap ? Math.PI / 2 : 0;
  const toWorld = (lx: number, lz: number): { x: number; z: number } =>
    swap
      ? { x: center.x + lz, z: center.z - lx }
      : { x: center.x + lx, z: center.z + lz };

  const toSpawnX = spawn.x - center.x;
  const toSpawnZ = spawn.z - center.z;
  const localSpawnX = swap ? -toSpawnZ : toSpawnX;
  const localSpawnZ = swap ? toSpawnX : toSpawnZ;
  const doorSide: ChapelSite['doorSide'] =
    Math.abs(localSpawnX) > Math.abs(localSpawnZ)
      ? localSpawnX > 0
        ? 'east'
        : 'west'
      : localSpawnZ > 0
        ? 'south'
        : 'north';
  const toWorldSide = (s: 'north' | 'south' | 'east' | 'west'): 'north' | 'south' | 'east' | 'west' =>
    !swap
      ? s
      : s === 'north'
        ? 'west'
        : s === 'west'
          ? 'south'
          : s === 'south'
            ? 'east'
            : 'north';

  const W = CHAPEL_WALL_W_M;
  const D = CHAPEL_WALL_D_M;
  const SEG = CHAPEL_SEGMENT_M;

  const features: ScatterObject[] = [];
  const walls: SiteWallBox[] = [];
  const feat = (kind: ScatterKind, x: number, z: number, y: number, scale: number, rotY: number): void => {
    features.push({ kind, x, z, y, scale, rotY });
  };
  const box = (cx: number, cz: number, hx: number, hz: number): void => {
    walls.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });
  };

  interface Segment {
    side: 'north' | 'south' | 'east' | 'west';
    lx: number;
    lz: number;
    running: 'x' | 'z';
    cornerAdjacent: boolean;
  }
  const segments: Segment[] = [];
  const perLong = Math.round(W / SEG); // 4
  const perShort = Math.round(D / SEG); // 2
  for (let i = 0; i < perLong; i++) {
    const lx = -W / 2 + SEG / 2 + i * SEG;
    const corner = i === 0 || i === perLong - 1;
    segments.push({ side: 'north', lx, lz: -D / 2, running: 'x', cornerAdjacent: corner });
    segments.push({ side: 'south', lx, lz: D / 2, running: 'x', cornerAdjacent: corner });
  }
  for (let i = 0; i < perShort; i++) {
    const lz = -D / 2 + SEG / 2 + i * SEG;
    // Both segments of a 2-segment side touch a corner.
    segments.push({ side: 'west', lx: -W / 2, lz, running: 'z', cornerAdjacent: true });
    segments.push({ side: 'east', lx: W / 2, lz, running: 'z', cornerAdjacent: true });
  }

  // The door: a middle segment of the door side.
  const doorPool = segments.filter((s) => s.side === doorSide);
  const door =
    doorPool.length % 2 === 0
      ? doorPool[doorPool.length / 2 - 1 + Math.floor(planRand() * 2)]
      : doorPool[Math.floor(doorPool.length / 2)];

  // Mostly intact: at most one interior segment damaged
  // (missing or a half-height stub).
  const candidates = segments.filter((s) => !s.cornerAdjacent && s !== door);
  let missingSeg: Segment | null = null;
  let stubSeg: Segment | null = null;
  if (candidates.length > 0 && planRand() < 0.6) {
    const pick = candidates[Math.floor(planRand() * candidates.length)];
    if (planRand() < 0.5) missingSeg = pick;
    else stubSeg = pick;
  }

  const emitWall = (s: Segment, scale: number): void => {
    const w = toWorld(s.lx, s.lz);
    const runsWorldX = (s.running === 'x') !== swap;
    feat('chapelWall', w.x, w.z, 0, scale, runsWorldX ? 0 : Math.PI / 2);
    const halfLen = (SEG / 2) * scale;
    if (runsWorldX) box(w.x, w.z, halfLen, CHAPEL_WALL_HALF_T);
    else box(w.x, w.z, CHAPEL_WALL_HALF_T, halfLen);
  };
  for (const s of segments) {
    if (s === door || s === missingSeg) continue;
    emitWall(s, s === stubSeg ? 0.5 : 1);
  }

  // The roof: whole, steep (mostly intact).
  feat('chapelRoof', center.x, center.z, CHAPEL_WALL_H_M, 1, theta);

  // The steeple: at the door end's corner — over the
  // entrance, the silhouette she navigates by. Its base
  // collides.
  const doorSign = doorSide === 'north' || doorSide === 'west' ? -1 : 1;
  const steepleLocal =
    doorSide === 'north' || doorSide === 'south'
      ? { lx: -W / 2, lz: doorSign * (D / 2) }
      : { lx: doorSign * (W / 2), lz: -D / 2 };
  const steepleWorld = toWorld(steepleLocal.lx, steepleLocal.lz);
  feat('steeple', steepleWorld.x, steepleWorld.z, 0, 1, theta);
  box(steepleWorld.x, steepleWorld.z, 0.95, 0.95);

  // The graveyard: on a long side — opposite the door when
  // the door is on a long side, else a plan-picked long
  // side. Rows of stones with jitter, facing the chapel.
  // The stones carry NO collision (the claim's snag rule).
  const yardLocalSide: 'north' | 'south' =
    doorSide === 'north'
      ? 'south'
      : doorSide === 'south'
        ? 'north'
        : planRand() < 0.5
          ? 'north'
          : 'south';
  const yardSign = yardLocalSide === 'north' ? -1 : 1;
  const yardRand = mulberry32(deriveSeed(seed, 'chapel:yard'));
  const stoneCount = 14 + Math.floor(yardRand() * 9); // 14..22
  const stoneSpots: { x: number; z: number }[] = [];
  {
    const rows = [4.2, 6.6, 9.0];
    let placed = 0;
    for (const rowOff of rows) {
      for (let lx = -W / 2 + 0.6; lx <= W / 2 - 0.6 && placed < stoneCount; lx += 2.2) {
        const jx = (yardRand() * 2 - 1) * 0.55;
        const jz = (yardRand() * 2 - 1) * 0.5;
        const w = toWorld(lx + jx, yardSign * (D / 2 + rowOff) + jz);
        const cross = yardRand() < 0.3;
        // Stones face the chapel: their +Z looks at the
        // shell (back along the yard direction), jittered.
        const face = yardSign < 0 ? 0 : Math.PI;
        feat(cross ? 'gravestoneCross' : 'gravestone', w.x, w.z, 0, 0.85 + yardRand() * 0.4, theta + face + (yardRand() * 2 - 1) * 0.12);
        stoneSpots.push(w);
        placed += 1;
      }
    }
  }

  // The inscription stone: the stone nearest the door
  // path (the door's spot pushed outward 5 m).
  const doorWorld = toWorld(door.lx, door.lz);
  const outLocal =
    doorSide === 'north'
      ? { lx: door.lx, lz: door.lz - 5 }
      : doorSide === 'south'
        ? { lx: door.lx, lz: door.lz + 5 }
        : doorSide === 'east'
          ? { lx: door.lx + 5, lz: door.lz }
          : { lx: door.lx - 5, lz: door.lz };
  const pathPoint = toWorld(outLocal.lx, outLocal.lz);
  let inscription = stoneSpots[0];
  let best = Infinity;
  for (const s of stoneSpots) {
    const d = Math.hypot(s.x - pathPoint.x, s.z - pathPoint.z);
    if (d < best) {
      best = d;
      inscription = s;
    }
  }

  const site: ChapelSite = {
    id: 'chapel',
    seed,
    center,
    biome,
    distance,
    clearRadius: CHAPEL_CLEAR_RADIUS_M,
    doorSide: toWorldSide(doorSide),
    yardSide: toWorldSide(yardLocalSide),
    inscriptionStone: inscription,
    features,
    walls,
    bounds: {
      minX: center.x - CHAPEL_CLEAR_RADIUS_M,
      maxX: center.x + CHAPEL_CLEAR_RADIUS_M,
      minZ: center.z - CHAPEL_CLEAR_RADIUS_M,
      maxZ: center.z + CHAPEL_CLEAR_RADIUS_M,
    },
  };
  chapelCache.set(`${seed}::chapel`, site);
  return site;
}

/** True when a world position lies inside the chapel's
 *  clearing (the footprint check). */
export function chapelContains(site: ChapelSite, x: number, z: number): boolean {
  return Math.hypot(x - site.center.x, z - site.center.z) <= site.clearRadius;
}

// ---------------------------------------------------------------------------
// THE CAVE MOUTH — site #6 (Adam, 2026-10-30; machinery
// claim approved by DEV). The surface door of the world's
// one cave dimension (caves.ts): a rock facade with a dark
// opening, snapped to a cardinal face like every other
// site's plan. She does not walk in — the threshold is
// solid; entering is a travel act (dimensionTravel) from
// the approach spot. The dimension's SECOND mouth is the
// farmhouse's cellar door (exported by the farm site;
// caves.ts assembles the mouth list).
// ---------------------------------------------------------------------------

/** Siting band from spawn, meters (DRAFT). */
export const CAVE_MOUTH_MIN_DIST_M = 400;
export const CAVE_MOUTH_MAX_DIST_M = 800;
/** Clearing radius around the mouth (DRAFT). */
export const CAVE_MOUTH_CLEAR_RADIUS_M = 14;

/** The derived Cave Mouth: one per world seed. */
export interface CaveMouthSite {
  id: string;
  seed: string;
  center: { x: number; z: number };
  /** Dominant biome at the chosen centre. */
  biome: BiomeId;
  /** Siting distance from spawn, meters. */
  distance: number;
  clearRadius: number;
  /** The cardinal the opening faces (toward the approach). */
  faceSide: 'north' | 'south' | 'east' | 'west';
  /** Where a traveller stands to enter / arrives on exit:
   *  on the approach axis, clear of every wall box. */
  mouthSpot: { x: number; z: number };
  features: ScatterObject[];
  walls: SiteWallBox[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const caveMouthCache = new Map<string, CaveMouthSite>();

/**
 * Derive the world's Cave Mouth. `weightsAtPos` returns the
 * full weights + dominant at a position. Memoized by seed.
 */
export function caveMouthSite(
  seed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): CaveMouthSite {
  const cached = caveMouthCache.get(`${seed}::cavemouth`);
  if (cached) return cached;

  // Spacing against all five earlier sites (radii + 60).
  const grove = groveSite(seed, spawn, (x, z) => weightsAtPos(x, z).dominant);
  const school = schoolhouseSite(seed, spawn, weightsAtPos);
  const village = villageSite(seed, spawn, weightsAtPos);
  const farm = farmhouseSite(seed, spawn, weightsAtPos);
  const chapel = chapelSite(seed, spawn, weightsAtPos);
  const spacingLegal = (x: number, z: number): boolean =>
    [grove, school, village, farm, chapel].every(
      (s) =>
        Math.hypot(x - s.center.x, z - s.center.z) >=
        s.clearRadius + CAVE_MOUTH_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M,
    );

  // Siting: own bearing stream; broken, wooded ground —
  // tanglewood or forest dominant.
  const bearing = mulberry32(deriveSeed(seed, 'site:cavemouth'))() * Math.PI * 2;
  const dirX = Math.cos(bearing);
  const dirZ = Math.sin(bearing);
  let center = {
    x: spawn.x + dirX * CAVE_MOUTH_MAX_DIST_M,
    z: spawn.z + dirZ * CAVE_MOUTH_MAX_DIST_M,
  };
  let biome = weightsAtPos(center.x, center.z).dominant;
  let distance = CAVE_MOUTH_MAX_DIST_M;
  let fallback: { x: number; z: number; biome: BiomeId; distance: number } | null = null;
  for (let d = CAVE_MOUTH_MIN_DIST_M; d <= CAVE_MOUTH_MAX_DIST_M; d += GROVE_SCAN_STEP_M) {
    const x = spawn.x + dirX * d;
    const z = spawn.z + dirZ * d;
    if (!spacingLegal(x, z)) continue;
    const w = weightsAtPos(x, z);
    if (!fallback) fallback = { x, z, biome: w.dominant, distance: d };
    if (w.dominant === 'tanglewood' || w.dominant === 'forest') {
      center = { x, z };
      biome = w.dominant;
      distance = d;
      break;
    }
    if (d === CAVE_MOUTH_MAX_DIST_M && fallback) {
      center = { x: fallback.x, z: fallback.z };
      biome = fallback.biome;
      distance = fallback.distance;
    }
  }

  // The facade: snapped to the cardinal nearest the
  // spawn-approach direction. Local frame: u along the
  // face (tangent), v out of the rock toward the approach.
  const toSpawnX = spawn.x - center.x;
  const toSpawnZ = spawn.z - center.z;
  const faceSide: CaveMouthSite['faceSide'] =
    Math.abs(toSpawnX) > Math.abs(toSpawnZ)
      ? toSpawnX > 0
        ? 'east'
        : 'west'
      : toSpawnZ > 0
        ? 'south'
        : 'north';
  // Local (u, v) -> world offset. v+ points out of the face.
  const toWorld = (u: number, v: number): { x: number; z: number } =>
    faceSide === 'south'
      ? { x: center.x + u, z: center.z + v }
      : faceSide === 'north'
        ? { x: center.x - u, z: center.z - v }
        : faceSide === 'east'
          ? { x: center.x + v, z: center.z - u }
          : { x: center.x - v, z: center.z + u };
  const faceRotY =
    faceSide === 'south' ? 0 : faceSide === 'north' ? Math.PI : faceSide === 'east' ? Math.PI / 2 : -Math.PI / 2;

  const features: ScatterObject[] = [];
  const walls: SiteWallBox[] = [];
  const feat = (kind: ScatterKind, x: number, z: number, y: number, scale: number, rotY: number): void => {
    features.push({ kind, x, z, y, scale, rotY });
  };
  const box = (cx: number, cz: number, hx: number, hz: number): void => {
    walls.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });
  };

  // The opening itself, facing the approach.
  feat('caveMouth', center.x, center.z, 0, 1, faceRotY);

  // Flanking rocks + the threshold: she stops at the
  // opening, never inside the facade. Boxes in the face
  // frame (u across, v out): flanks at u ±1.7, threshold
  // spanning the opening at the face plane.
  const alongX = faceSide === 'north' || faceSide === 'south';
  const flank1 = toWorld(-1.7, 0);
  const flank2 = toWorld(1.7, 0);
  const threshold = toWorld(0, 0.15);
  if (alongX) {
    box(flank1.x, flank1.z, 0.75, 0.55);
    box(flank2.x, flank2.z, 0.75, 0.55);
    box(threshold.x, threshold.z, 1.05, 0.4);
  } else {
    box(flank1.x, flank1.z, 0.55, 0.75);
    box(flank2.x, flank2.z, 0.55, 0.75);
    box(threshold.x, threshold.z, 0.4, 1.05);
  }

  // The rock surround: boulders arcing behind and beside
  // the facade (v negative = into the hill).
  {
    const rand = mulberry32(deriveSeed(seed, 'cavemouth:rocks'));
    const spots: [number, number][] = [
      [-2.9, -0.7],
      [2.9, -0.7],
      [-2.3, -2.1],
      [2.3, -2.1],
      [0, -3.0],
      [-3.6, 0.6],
      [3.6, 0.6],
    ];
    for (const [u, v] of spots) {
      const w = toWorld(u + (rand() * 2 - 1) * 0.3, v + (rand() * 2 - 1) * 0.3);
      feat('caveBoulder', w.x, w.z, 0, 0.8 + rand() * 0.9, rand() * Math.PI);
    }
  }

  const mouthSpot = toWorld(0, 2.6);

  const site: CaveMouthSite = {
    id: 'cavemouth',
    seed,
    center,
    biome,
    distance,
    clearRadius: CAVE_MOUTH_CLEAR_RADIUS_M,
    faceSide,
    mouthSpot,
    features,
    walls,
    bounds: {
      minX: center.x - CAVE_MOUTH_CLEAR_RADIUS_M,
      maxX: center.x + CAVE_MOUTH_CLEAR_RADIUS_M,
      minZ: center.z - CAVE_MOUTH_CLEAR_RADIUS_M,
      maxZ: center.z + CAVE_MOUTH_CLEAR_RADIUS_M,
    },
  };
  caveMouthCache.set(`${seed}::cavemouth`, site);
  return site;
}

/** True when a world position lies inside the cave
 *  mouth's clearing (the footprint check). */
export function caveMouthContains(site: CaveMouthSite, x: number, z: number): boolean {
  return Math.hypot(x - site.center.x, z - site.center.z) <= site.clearRadius;
}

// ---------------------------------------------------------------------------
// THE GENERAL STORE — site #7 (Adam, 2026-10-30; claim
// approved by DEV). The locations doc's word: "salvage-
// rich; the old world's goods on shelves" — a mostly-
// intact candidate. A single building, so the interiors
// rule makes it a WALK-IN shell (the farmhouse pattern):
// walls, a whole roof, a boardwalk porch — and the piece
// that makes it a store: a tall FALSE FRONT on the door
// side, its silhouette. Inside: a long counter across
// the room and shelf units along the walls (solid; their
// dressing is silhouette geometry — the SALVAGE content,
// what's actually takeable, is a later Systems claim
// hanging off the exported shelfSpots).
// ---------------------------------------------------------------------------

/** Siting band from spawn, meters (DRAFT). */
export const STORE_MIN_DIST_M = 500;
export const STORE_MAX_DIST_M = 850;
/** Clearing radius around the store (DRAFT). */
export const STORE_CLEAR_RADIUS_M = 18;
/** Meadow weight that also qualifies a scan point (DRAFT). */
export const STORE_MEADOW_EDGE_WEIGHT = 0.2;
/** Wall segment length, meters (the farm's measure). */
export const STORE_SEGMENT_M = 2.5;
/** Footprint: 12.5 x 7.5 m. */
export const STORE_WALL_W_M = 12.5;
export const STORE_WALL_D_M = 7.5;
/** Wall height, meters (DRAFT). */
export const STORE_WALL_H_M = 3.0;
const STORE_WALL_HALF_T = 0.15;

/** The derived General Store: one per world seed. */
export interface StoreSite {
  id: string;
  seed: string;
  center: { x: number; z: number };
  /** Dominant biome at the chosen centre. */
  biome: BiomeId;
  /** Siting distance from spawn, meters. */
  distance: number;
  clearRadius: number;
  /** The front (false-front + door) side, world frame. */
  doorSide: 'north' | 'south' | 'east' | 'west';
  /** Centre of the counter line (world). */
  counterSpot: { x: number; z: number };
  /** Shelf-unit anchors (world + facing): the salvage
   *  pass's hooks for a later content claim. */
  shelfSpots: { x: number; z: number; rotY: number }[];
  /** The stove spot (world): the back shelf run leaves a
   *  gap for it; an anchor only in this landing. */
  stoveSpot: { x: number; z: number };
  features: ScatterObject[];
  walls: SiteWallBox[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const storeCache = new Map<string, StoreSite>();

/**
 * Derive the world's General Store. `weightsAtPos` returns
 * the full weights + dominant at a position. Memoized.
 */
export function generalStoreSite(
  seed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): StoreSite {
  const cached = storeCache.get(`${seed}::store`);
  if (cached) return cached;

  // Spacing against all six earlier sites (radii + 60).
  const grove = groveSite(seed, spawn, (x, z) => weightsAtPos(x, z).dominant);
  const school = schoolhouseSite(seed, spawn, weightsAtPos);
  const village = villageSite(seed, spawn, weightsAtPos);
  const farm = farmhouseSite(seed, spawn, weightsAtPos);
  const chapel = chapelSite(seed, spawn, weightsAtPos);
  const mouth = caveMouthSite(seed, spawn, weightsAtPos);
  const spacingLegal = (x: number, z: number): boolean =>
    [grove, school, village, farm, chapel, mouth].every(
      (s) =>
        Math.hypot(x - s.center.x, z - s.center.z) >=
        s.clearRadius + STORE_CLEAR_RADIUS_M + SITE_SPACING_MARGIN_M,
    );

  // Siting: own bearing stream; settled country —
  // oldfieldRise dominant, or meadow at the edge weight.
  const bearing = mulberry32(deriveSeed(seed, 'site:store'))() * Math.PI * 2;
  const dirX = Math.cos(bearing);
  const dirZ = Math.sin(bearing);
  let center = {
    x: spawn.x + dirX * STORE_MAX_DIST_M,
    z: spawn.z + dirZ * STORE_MAX_DIST_M,
  };
  let biome = weightsAtPos(center.x, center.z).dominant;
  let distance = STORE_MAX_DIST_M;
  let fallback: { x: number; z: number; biome: BiomeId; distance: number } | null = null;
  for (let d = STORE_MIN_DIST_M; d <= STORE_MAX_DIST_M; d += GROVE_SCAN_STEP_M) {
    const x = spawn.x + dirX * d;
    const z = spawn.z + dirZ * d;
    if (!spacingLegal(x, z)) continue;
    const w = weightsAtPos(x, z);
    if (!fallback) fallback = { x, z, biome: w.dominant, distance: d };
    if (w.dominant === 'oldfieldRise' || w.weights.meadow >= STORE_MEADOW_EDGE_WEIGHT) {
      center = { x, z };
      biome = w.dominant;
      distance = d;
      break;
    }
    if (d === STORE_MAX_DIST_M && fallback) {
      center = { x: fallback.x, z: fallback.z };
      biome = fallback.biome;
      distance = fallback.distance;
    }
  }

  // --- Plan (streams under the 'store' label; the
  // farmhouse frame idiom: axis swap + local door side).
  const planRand = mulberry32(deriveSeed(seed, 'store:plan'));
  const swap = planRand() < 0.5;
  const theta = swap ? Math.PI / 2 : 0;
  const toWorld = (lx: number, lz: number): { x: number; z: number } =>
    swap
      ? { x: center.x + lz, z: center.z - lx }
      : { x: center.x + lx, z: center.z + lz };
  const toSpawnX = spawn.x - center.x;
  const toSpawnZ = spawn.z - center.z;
  const localSpawnX = swap ? -toSpawnZ : toSpawnX;
  const localSpawnZ = swap ? toSpawnX : toSpawnZ;
  const doorSide: StoreSite['doorSide'] =
    Math.abs(localSpawnX) > Math.abs(localSpawnZ)
      ? localSpawnX > 0
        ? 'east'
        : 'west'
      : localSpawnZ > 0
        ? 'south'
        : 'north';
  const worldDoorSide: StoreSite['doorSide'] = !swap
    ? doorSide
    : doorSide === 'north'
      ? 'west'
      : doorSide === 'west'
        ? 'south'
        : doorSide === 'south'
          ? 'east'
          : 'north';

  const W = STORE_WALL_W_M;
  const D = STORE_WALL_D_M;
  const SEG = STORE_SEGMENT_M;

  const features: ScatterObject[] = [];
  const walls: SiteWallBox[] = [];
  const feat = (kind: ScatterKind, x: number, z: number, y: number, scale: number, rotY: number): void => {
    features.push({ kind, x, z, y, scale, rotY });
  };
  const box = (cx: number, cz: number, hx: number, hz: number): void => {
    walls.push({ minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz });
  };

  interface Segment {
    side: 'north' | 'south' | 'east' | 'west';
    lx: number;
    lz: number;
    running: 'x' | 'z';
    cornerAdjacent: boolean;
  }
  const segments: Segment[] = [];
  const perLong = Math.round(W / SEG); // 5
  const perShort = Math.round(D / SEG); // 3
  for (let i = 0; i < perLong; i++) {
    const lx = -W / 2 + SEG / 2 + i * SEG;
    const corner = i === 0 || i === perLong - 1;
    segments.push({ side: 'north', lx, lz: -D / 2, running: 'x', cornerAdjacent: corner });
    segments.push({ side: 'south', lx, lz: D / 2, running: 'x', cornerAdjacent: corner });
  }
  for (let i = 0; i < perShort; i++) {
    const lz = -D / 2 + SEG / 2 + i * SEG;
    const corner = i === 0 || i === perShort - 1;
    segments.push({ side: 'west', lx: -W / 2, lz, running: 'z', cornerAdjacent: corner });
    segments.push({ side: 'east', lx: W / 2, lz, running: 'z', cornerAdjacent: corner });
  }

  const doorPool = segments.filter((s) => s.side === doorSide);
  const door =
    doorPool.length % 2 === 0
      ? doorPool[doorPool.length / 2 - 1 + Math.floor(planRand() * 2)]
      : doorPool[Math.floor(doorPool.length / 2)];

  // Mostly intact (its candidacy): at most ONE interior
  // segment damaged, missing or stub (the chapel shape).
  const candidates = segments.filter((s) => !s.cornerAdjacent && s !== door);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(planRand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const damagedCount = Math.floor(planRand() * 2); // 0..1
  const missing = new Set<Segment>();
  const stubs = new Set<Segment>();
  if (damagedCount === 1 && candidates.length > 0) {
    (planRand() < 0.5 ? missing : stubs).add(candidates[0]);
  }

  const emitWall = (kind: ScatterKind, lx: number, lz: number, running: 'x' | 'z', scale: number): void => {
    const w = toWorld(lx, lz);
    const runsWorldX = (running === 'x') !== swap;
    feat(kind, w.x, w.z, 0, scale, runsWorldX ? 0 : Math.PI / 2);
    const halfLen = (SEG / 2) * scale;
    if (runsWorldX) box(w.x, w.z, halfLen, STORE_WALL_HALF_T);
    else box(w.x, w.z, STORE_WALL_HALF_T, halfLen);
  };
  for (const s of segments) {
    if (s === door || missing.has(s)) continue;
    // The door side wears the FALSE FRONT; the rest plain wall.
    emitWall(s.side === doorSide ? 'storeFront' : 'storeWall', s.lx, s.lz, s.running, stubs.has(s) ? 0.5 : 1);
  }

  // The roof: whole, behind the false front.
  feat('storeRoof', center.x, center.z, STORE_WALL_H_M, 1, theta);

  // The boardwalk porch: a slab per door-side segment,
  // posts along its outer edge (boxes at the joints).
  {
    const outRot =
      doorSide === 'north' ? Math.PI : doorSide === 'south' ? 0 : doorSide === 'east' ? Math.PI / 2 : -Math.PI / 2;
    for (const s of doorPool) {
      const out =
        s.side === 'north'
          ? { lx: s.lx, lz: s.lz - 0.95 }
          : s.side === 'south'
            ? { lx: s.lx, lz: s.lz + 0.95 }
            : s.side === 'west'
              ? { lx: s.lx - 0.95, lz: s.lz }
              : { lx: s.lx + 0.95, lz: s.lz };
      const w = toWorld(out.lx, out.lz);
      feat('storePorch', w.x, w.z, 0, 1, theta + outRot);
    }
    const alongX = doorSide === 'north' || doorSide === 'south';
    const runLen = alongX ? W : D;
    const joints = Math.round(runLen / SEG);
    for (let i = 0; i <= joints; i++) {
      const along = -runLen / 2 + i * SEG;
      const p =
        doorSide === 'north'
          ? { lx: along, lz: -D / 2 - 1.7 }
          : doorSide === 'south'
            ? { lx: along, lz: D / 2 + 1.7 }
            : doorSide === 'west'
              ? { lx: -W / 2 - 1.7, lz: along }
              : { lx: W / 2 + 1.7, lz: along };
      const w = toWorld(p.lx, p.lz);
      box(w.x, w.z, 0.13, 0.13);
    }
  }

  // Interior frame: front = the door wall; the counter
  // runs parallel to it, 2.2 m into the room, with a
  // keeper's gap at one plan-picked end.
  const frontIsLong = doorSide === 'north' || doorSide === 'south';
  const frontSign = doorSide === 'south' || doorSide === 'east' ? 1 : -1;
  const counterLocal: { lx: number; lz: number } = frontIsLong
    ? { lx: 0, lz: frontSign * (D / 2 - 2.2) }
    : { lx: frontSign * (W / 2 - 2.2), lz: 0 };
  const counterWorld = toWorld(counterLocal.lx, counterLocal.lz);
  {
    const runLen = (frontIsLong ? W : D) - 3; // counter length
    const unit = 2.4;
    const units = Math.floor(runLen / unit);
    const gapAtStart = planRand() < 0.5;
    for (let i = 0; i < units; i++) {
      // The keeper's gap: skip the end unit on one side
      // (only when a unit remains — a short counter IS
      // the whole counter).
      if (units >= 2 && ((gapAtStart && i === 0) || (!gapAtStart && i === units - 1))) continue;
      const along = -runLen / 2 + unit / 2 + i * unit;
      const p = frontIsLong
        ? { lx: along, lz: counterLocal.lz }
        : { lx: counterLocal.lx, lz: along };
      const w = toWorld(p.lx, p.lz);
      const runsWorldX = frontIsLong !== swap;
      feat('storeCounter', w.x, w.z, 0, 1, runsWorldX ? 0 : Math.PI / 2);
      if (runsWorldX) box(w.x, w.z, unit / 2, 0.35);
      else box(w.x, w.z, 0.35, unit / 2);
    }
  }

  // Shelves: every wall but the front, inset, corner-
  // clear. One run skips its middle unit — the stove
  // stands there (an anchor; the gap is its place): the
  // back run when it is long enough, else a long side.
  const shelfSpots: StoreSite['shelfSpots'] = [];
  let stoveSpot = counterWorld;
  {
    const unit = 2.2;
    const inset = 0.5;
    const sides: ('north' | 'south' | 'east' | 'west')[] = ['north', 'south', 'east', 'west'];
    const backSide = frontIsLong
      ? doorSide === 'north'
        ? 'south'
        : 'north'
      : doorSide === 'west'
        ? 'east'
        : 'west';
    const gapSide =
      backSide && Math.floor(((backSide === 'north' || backSide === 'south' ? W : D) - 1.4) / unit) >= 3
        ? backSide
        : sides.find((s) => s !== doorSide && (s === 'north' || s === 'south'));
    for (const side of sides) {
      if (side === doorSide) continue;
      const isLong = side === 'north' || side === 'south';
      const runLen = (isLong ? W : D) - 1.4; // corner clearance
      const units = Math.floor(runLen / unit);
      const isGap = side === gapSide;
      for (let i = 0; i < units; i++) {
        const along = -((units * unit) / 2) + unit / 2 + i * unit;
        if (isGap && units >= 3 && i === Math.floor(units / 2)) {
          // The stove gap.
          const p =
            side === 'north'
              ? { lx: along, lz: -D / 2 + inset }
              : side === 'south'
                ? { lx: along, lz: D / 2 - inset }
                : side === 'west'
                  ? { lx: -W / 2 + inset, lz: along }
                  : { lx: W / 2 - inset, lz: along };
          stoveSpot = toWorld(p.lx, p.lz);
          continue;
        }
        const p =
          side === 'north'
            ? { lx: along, lz: -D / 2 + inset }
            : side === 'south'
              ? { lx: along, lz: D / 2 - inset }
              : side === 'west'
                ? { lx: -W / 2 + inset, lz: along }
                : { lx: W / 2 - inset, lz: along };
        const w = toWorld(p.lx, p.lz);
        const runsWorldX = isLong !== swap;
        const rotY = runsWorldX ? 0 : Math.PI / 2;
        feat('storeShelf', w.x, w.z, 0, 1, rotY);
        if (runsWorldX) box(w.x, w.z, unit / 2, 0.32);
        else box(w.x, w.z, 0.32, unit / 2);
        shelfSpots.push({ x: w.x, z: w.z, rotY });
      }
    }
  }

  // A little rubble, as everywhere.
  {
    const rand = mulberry32(deriveSeed(seed, 'store:rubble'));
    const count = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const w = toWorld((rand() * 2 - 1) * (W / 2 + 1.5), (rand() < 0.5 ? -1 : 1) * (D / 2 + 0.6 + rand()));
      feat('rubble', w.x, w.z, 0, 0.6 + rand() * 0.5, rand() * Math.PI);
    }
  }

  const site: StoreSite = {
    id: 'store',
    seed,
    center,
    biome,
    distance,
    clearRadius: STORE_CLEAR_RADIUS_M,
    doorSide: worldDoorSide,
    counterSpot: counterWorld,
    shelfSpots,
    stoveSpot,
    features,
    walls,
    bounds: {
      minX: center.x - STORE_CLEAR_RADIUS_M,
      maxX: center.x + STORE_CLEAR_RADIUS_M,
      minZ: center.z - STORE_CLEAR_RADIUS_M,
      maxZ: center.z + STORE_CLEAR_RADIUS_M,
    },
  };
  storeCache.set(`${seed}::store`, site);
  return site;
}

/** True when a world position lies inside the store's
 *  clearing (the footprint check). */
export function generalStoreContains(site: StoreSite, x: number, z: number): boolean {
  return Math.hypot(x - site.center.x, z - site.center.z) <= site.clearRadius;
}

/** The standing spacing rule (formalized by DEV,
 *  2026-10-30): every site's siting scan keeps its centre
 *  at least (the other site's clear radius + its own
 *  clear radius + this margin) from every earlier site.
 *  ONE number, one home — a place that ever needs a
 *  different margin gets a named amendment, not a
 *  per-site constant. */
export const SITE_SPACING_MARGIN_M = 60;

/** The shared footprint shape both sites (and the worldgen
 *  pass + the renderer's wall query) read: a clearing circle,
 *  its features, its collision boxes, and its broad bounds.
 *  GroveSite and SchoolSite both satisfy it structurally. */
export interface SiteFootprint {
  center: { x: number; z: number };
  clearRadius: number;
  features: ScatterObject[];
  walls: SiteWallBox[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** True when a world position lies inside the grove's clearing —
 *  the footprint check (UI's 'Grove Tree' name-tag rule and
 *  harvest's protection backstop both read this fact). */
export function groveContains(site: GroveSite, x: number, z: number): boolean {
  return Math.hypot(x - site.center.x, z - site.center.z) <= site.clearRadius;
}

/**
 * A site's wall boxes when (x, z) is within its bounds + margin,
 * else null — the player query shape: one bounds test per frame
 * in open country, the box list only near the site. Reads the
 * structural footprint, so it serves every registered site.
 */
export function groveWallsNear(
  site: SiteFootprint,
  x: number,
  z: number,
  margin: number,
): SiteWallBox[] | null {
  const b = site.bounds;
  if (
    x < b.minX - margin ||
    x > b.maxX + margin ||
    z < b.minZ - margin ||
    z > b.maxZ + margin
  ) {
    return null;
  }
  return site.walls;
}

/**
 * The union of every registered site's walls near (x, z), or
 * null when she is near none of them — the renderer's single
 * query into the player controller.
 */
export function wallsNearSites(
  sites: readonly SiteFootprint[],
  x: number,
  z: number,
  margin: number,
): SiteWallBox[] | null {
  let out: SiteWallBox[] | null = null;
  for (const s of sites) {
    const w = groveWallsNear(s, x, z, margin);
    if (w) out = out ? out.concat(w) : w.slice();
  }
  return out;
}

/**
 * Circle-vs-boxes push-out: move (x, z) out of every wall box by
 * the circle's radius, a few relaxation passes so corners settle.
 * Pure — the player controller applies the result as its position.
 */
export function pushOutOfWalls(
  x: number,
  z: number,
  walls: readonly SiteWallBox[],
  radius: number,
): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 3; pass++) {
    for (const w of walls) {
      const cx = Math.max(w.minX, Math.min(px, w.maxX));
      const cz = Math.max(w.minZ, Math.min(pz, w.maxZ));
      const dx = px - cx;
      const dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > radius * radius) continue;
      if (d2 > 0) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * radius;
        pz = cz + (dz / d) * radius;
        continue;
      }
      // Centre inside the box: leave by the nearest face.
      const left = px - w.minX;
      const right = w.maxX - px;
      const top = pz - w.minZ;
      const bottom = w.maxZ - pz;
      const min = Math.min(left, right, top, bottom);
      if (min === left) px = w.minX - radius;
      else if (min === right) px = w.maxX + radius;
      else if (min === top) pz = w.minZ - radius;
      else pz = w.maxZ + radius;
    }
  }
  return { x: px, z: pz };
}
