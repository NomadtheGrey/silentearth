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
 * THE INTEGRATION (2026-11-01, on Models' landed kit
 * 01b7c7c): the instance record carries its FEATURES +
 * WALLS, derived from a separate plan stream appended
 * after the landed draws (so theta, the fragment roll,
 * the dressing, and the carrier facts stay byte-stable):
 * a 6x6 m house on the quarter-turn frame every house in
 * the game reads by, walls in units of the shared ruler
 * (HOMESTEAD_SEGMENT_M), Models' five kinds by state.
 * worldgen folds the instances into the site pass beside
 * the cave instances; the renderer's wall query unions
 * them the same way. The farmhouse FAMILY, when it
 * lands, resolves after this family and yields to these
 * seats, as this family yields to the singulars.
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
  HOMESTEAD_SEGMENT_M,
  ROAD_RIBBON_HALF_WIDTH_M,
  SIDING_HALF_WIDTH_M,
  SITE_SPACING_MARGIN_M,
  type SiteWallBox,
} from './sites';
import {
  DISTRIBUTION_CELL_M,
  distributionCellStream,
  distributionCellsOverlapping,
} from './distribution';
import { deriveSeed, mulberry32 } from './seed';
import { caveInstancesInRect } from './caves';
import type { FragmentCarrier } from './carriers';

/** Per-cell presence draw (DRAFT). */
export const HOMESTEAD_CELL_PRESENCE = 0.45;
/** The instance clearing's radius (m) — house + yard. */
export const HOMESTEAD_CLEAR_RADIUS_M = 20;
/** A seated instance carries a fragment on this draw (DRAFT). */
export const HOMESTEAD_FRAGMENT_PRESENCE = 0.5;
/** The kit's wall height (m): the standing roofs seat at
 *  the wall top (Models' builders carry it in the
 *  feature's y). */
export const HOMESTEAD_WALL_H_M = 2.5;
/** Collision half-thickness of a homestead wall (m, DRAFT). */
export const HOMESTEAD_WALL_HALF_T = 0.15;
/** A burnt house keeps its charred-but-standing roof on
 *  this draw; otherwise the roof fell (DRAFT). */
export const HOMESTEAD_CHARRED_ROOF_STANDS = 0.5;

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
  /**
   * The carrier facts for Systems' inscribe() (the
   * carriers.ts field set): minted iff carrying — the
   * TRAVEL mark, completeness in the burnt band (the
   * stone's inscription went through the fire).
   */
  fragmentCarrier: FragmentCarrier | null;
  /** Yard dressing richness 0..1 (the plan consumes). */
  dressing: number;
  /** The house plan's quarter-turn bearing (rad). */
  houseTheta: number;
  /** The house + yard as scatter (the site pass emits). */
  features: ScatterObject[];
  /** Collision boxes for the standing wall segments +
   *  the great stone (the wall query reads). */
  walls: SiteWallBox[];
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

/**
 * The house plan for one instance (the village idiom at
 * family scale): a 6x6 m ring of 3.0 m segments on a
 * quarter-turn frame, one segment of a plan-picked side
 * left open as the door. Standing houses wear the plain
 * kit and a whole roof; burnt houses (=== carrying) wear
 * the charred kit with fire-missing stretches and a roof
 * that either stands charred or fell. The great stone
 * stands in the yard at the record's seat. All draws ride
 * the instance's own plan stream; rates DRAFT.
 */
function buildHomesteadPlan(
  worldSeed: string,
  key: string,
  center: { x: number; z: number },
  theta: number,
  burnt: boolean,
  dressing: number,
  greatStone: { x: number; z: number },
): { features: ScatterObject[]; walls: SiteWallBox[]; houseTheta: number } {
  const rand = mulberry32(deriveSeed(worldSeed, `homestead-plan:${key}`));
  const swap = rand() < 0.5;
  const houseTheta = swap ? Math.PI / 2 : 0;
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

  const SEG = HOMESTEAD_SEGMENT_M;
  const H = SEG; // half the 6 m side
  interface Seg {
    lx: number;
    lz: number;
    running: 'x' | 'z';
    side: 'north' | 'south' | 'west' | 'east';
  }
  const segs: Seg[] = [];
  for (const off of [-SEG / 2, SEG / 2]) {
    segs.push({ lx: off, lz: -H, running: 'x', side: 'north' });
    segs.push({ lx: off, lz: H, running: 'x', side: 'south' });
    segs.push({ lx: -H, lz: off, running: 'z', side: 'west' });
    segs.push({ lx: H, lz: off, running: 'z', side: 'east' });
  }
  const sides = ['north', 'south', 'west', 'east'] as const;
  const doorSide = sides[Math.floor(rand() * 4)];
  const doorPool = segs.filter((s) => s.side === doorSide);
  const door = doorPool[Math.floor(rand() * doorPool.length)];

  const emitSeg = (s: Seg, kind: ScatterKind): void => {
    const w = toWorld(s.lx, s.lz);
    const runsWorldX = (s.running === 'x') !== swap;
    feat(kind, w.x, w.z, 0, 1, runsWorldX ? 0 : Math.PI / 2);
    if (runsWorldX) box(w.x, w.z, SEG / 2, HOMESTEAD_WALL_HALF_T);
    else box(w.x, w.z, HOMESTEAD_WALL_HALF_T, SEG / 2);
  };
  /** Pick n of the non-door segments to be missing (Fisher-Yates on the plan stream). */
  const pickMissing = (n: number): Set<Seg> => {
    const others = segs.filter((s) => s !== door);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    return new Set(others.slice(0, n));
  };

  if (!burnt) {
    // Weathered and empty: at most one stretch gone.
    const missing = pickMissing(rand() < 0.35 ? 1 : 0);
    for (const s of segs) {
      if (s === door || missing.has(s)) continue;
      emitSeg(s, 'homesteadWall');
    }
    feat('homesteadRoof', center.x, center.z, HOMESTEAD_WALL_H_M, 1, houseTheta);
    // Yard dressing: rubble where the years dropped it.
    const rubble = Math.floor(dressing * 2.99);
    for (let i = 0; i < rubble; i++) {
      const w = toWorld((rand() * 2 - 1) * 2.4, (rand() * 2 - 1) * 2.4);
      feat('rubble', w.x, w.z, 0, 0.7 + rand() * 0.6, rand() * Math.PI);
    }
  } else {
    // Burnt and raided: the fire took whole stretches.
    const missing = pickMissing(2 + Math.floor(rand() * 3));
    for (const s of segs) {
      if (s === door || missing.has(s)) continue;
      emitSeg(s, 'homesteadWallCharred');
    }
    if (rand() < HOMESTEAD_CHARRED_ROOF_STANDS) {
      feat('homesteadRoofCharred', center.x, center.z, HOMESTEAD_WALL_H_M, 1, houseTheta);
    } else {
      feat('homesteadRoofFallen', center.x, center.z, 0, 1, houseTheta);
    }
    // Ash where the house stood, richer yards ashier.
    const ash = 1 + Math.floor(dressing * 3);
    for (let i = 0; i < ash; i++) {
      const w = toWorld((rand() * 2 - 1) * 2.2, (rand() * 2 - 1) * 2.2);
      feat('ashPatch', w.x, w.z, 0, 0.8 + rand() * 0.7, rand() * Math.PI);
    }
  }

  // The great stone: the instance's hearth stone in the
  // yard, at the derivation's seat (free bearing — a
  // stone sits at its own angle). Solid: she walks around.
  feat('hearthStone', greatStone.x, greatStone.z, 0, 1.25, theta);
  box(greatStone.x, greatStone.z, 0.7, 0.7);

  return { features, walls, houseTheta };
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
      // The carrier facts (minted here to keep the
      // derivation self-contained; the band mirrors
      // carriers.ts CARRIER_BAND_BURNT).
      let fragmentCarrier: FragmentCarrier | null = null;
      if (carriesFragment) {
        const crand = mulberry32(deriveSeed(worldSeed, `carrier:${key}`));
        fragmentCarrier = {
          fragmentId: `${key}:fragment`,
          mark: 'travel',
          completeness: 0.35 + crand() * 0.4,
        };
      }
      const plan = buildHomesteadPlan(worldSeed, key, cand.center, theta, carriesFragment, dressing, greatStone);
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
        fragmentCarrier,
        dressing,
        houseTheta: plan.houseTheta,
        features: plan.features,
        walls: plan.walls,
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
