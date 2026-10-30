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
import type { BiomeId, ScatterKind, ScatterObject } from '../types';

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

export const GROVE_MIN_DIST_M = 150;
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
/** True when a world position lies inside the grove's clearing —
 *  the footprint check (UI's 'Grove Tree' name-tag rule and
 *  harvest's protection backstop both read this fact). */
export function groveContains(site: GroveSite, x: number, z: number): boolean {
  return Math.hypot(x - site.center.x, z - site.center.z) <= site.clearRadius;
}

/**
 * The site's wall boxes when (x, z) is within the grove bounds +
 * margin, else null — the player query shape: one bounds test per
 * frame in open country, the box list only near the grove.
 */
export function groveWallsNear(
  site: GroveSite,
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
