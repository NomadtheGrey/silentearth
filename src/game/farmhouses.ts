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
 * THE INTEGRATION (this landing) gives each instance
 * its FEATURES + WALLS from a plan stream appended
 * after the derivation draws (the homestead shape):
 * the house assembled from the slots on Models'
 * manifest — length from the footprint, depth from the
 * gable width (the slots compose the plan), walls in
 * the rolled window rhythm on both stories where the
 * form carries an upper floor, gable ends at the wall
 * top, the chimney seated on the ridge by its seat
 * roll, the porch at the door, the stairs inside, the
 * cellar bulkhead at the back, the great stone in the
 * yard, under a TILED roof (Models' roof wave: slope
 * slabs + ridge beams, seated per segment). The
 * upstairs ZONES are their own later landing still.
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
  FARM_SEGMENT_M,
  FARM_WALL_H_M,
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
import { homesteadInstancesInRect, HOMESTEAD_CLEAR_RADIUS_M } from './homesteads';
import {
  farmhouseSlotIndex,
  FARMHOUSE_GABLE_KINDS,
  FARMHOUSE_GABLE_WIDTHS_M,
  FARMHOUSE_LENGTH_SEGMENTS,
  FARMHOUSE_PORCH_KINDS,
  FARMHOUSE_RHYTHM_KINDS,
  FARMHOUSE_STAIRS_KINDS,
  type FarmhouseSlot,
} from './farmhouseTable';

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
  /** THE PLAN (the integration landing): the scatter
   *  features the house emits into its clearing. */
  features: ScatterObject[];
  /** Collision boxes for the emitted walls (ground
   *  lines; the upper story shares the footprint). */
  walls: SiteWallBox[];
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
        features: [],
        walls: [],
        clearRadius: FARMHOUSE_CLEAR_RADIUS_M,
        bounds: {
          minX: x - FARMHOUSE_CLEAR_RADIUS_M,
          maxX: x + FARMHOUSE_CLEAR_RADIUS_M,
          minZ: z - FARMHOUSE_CLEAR_RADIUS_M,
          maxZ: z + FARMHOUSE_CLEAR_RADIUS_M,
        },
      };
      const plan = buildFarmhousePlan(worldSeed, result);
      result.features = plan.features;
      result.walls = plan.walls;
    }
  }
  instanceCache.set(cacheKey, result);
  return result;
}

/** Wall half-thickness (m) — the farm wall build is
 *  0.3 thick; sites' own FARM_WALL_HALF_T is private. */
export const FARMHOUSE_WALL_HALF_T = 0.15;

/** The plan's dimensions for an instance, from its
 *  slots on Models' manifest (the slots compose). */
export function farmhousePlanDims(inst: FarmhouseInstance): { L: number; D: number } {
  return {
    L: FARMHOUSE_LENGTH_SEGMENTS[inst.slots.footprint] * FARM_SEGMENT_M,
    D: FARMHOUSE_GABLE_WIDTHS_M[inst.slots.gableWidth],
  };
}

/** The stair flight's seat in the house's LOCAL frame
 *  — one source: the plan emits the flight here, and
 *  the upstairs zones (attics.ts) read the same seat
 *  for their stair-head anchor. The seat is FORM-AWARE
 *  (zones-build amendment, 2026-11-01, geometry-forced):
 *  a FLOOR house's flight climbs the north wall (full
 *  height everywhere, no pinch); an ATTIC house's
 *  flight runs ALONG THE RIDGE from the west end —
 *  a 3.6 m run across a 5.0-deep attic would arrive
 *  under 0.9 m of slope, while the ridge line carries
 *  standing height the whole way. dir names the
 *  climb's local direction ('z' north-wall, 'x' ridge). */
export function farmhouseStairLocal(inst: FarmhouseInstance): { lx: number; lz: number; dir: 'x' | 'z' } {
  const { L, D } = farmhousePlanDims(inst);
  if (inst.upstairsForm === 'attic') return { lx: -L / 2 + 0.55, lz: -0.45, dir: 'x' };
  return { lx: -L / 2 + 1.0, lz: -D / 2 + 0.55, dir: 'z' };
}

/** House-local -> world through the instance's
 *  quarter-turn frame. */
export function farmhouseLocalToWorld(
  inst: FarmhouseInstance,
  lx: number,
  lz: number,
): { x: number; z: number } {
  return inst.theta !== 0
    ? { x: inst.center.x + lz, z: inst.center.z - lx }
    : { x: inst.center.x + lx, z: inst.center.z + lz };
}

/**
 * THE ROOF TABLE (settled with Models, 2026-11-01):
 * the family roof is TILED, not fixed — one slope
 * segment per wall segment per side ('farmRoofSlab'
 * for the 5.0 depth, 'farmRoofSlabWide' for 7.5,
 * authored on the -Z side with origin at wall top;
 * the +Z side seats by rotY π), plus 'farmRidgeBeam'
 * segments at the ridge height. The ridge heights are
 * Models' MEASURED figures (where the two slopes'
 * edges meet, roof-local). A future footprint costs
 * no new kinds — the tiles simply run longer.
 */
export const FARMHOUSE_ROOF_SLAB_KINDS: readonly ScatterKind[] = ['farmRoofSlab', 'farmRoofSlabWide'];
export const FARMHOUSE_RIDGE_H_M: readonly number[] = [2.04, 2.93];

/**
 * THE PLAN (integration): the house assembled from the
 * instance's slots on Models' manifest, from a plan
 * stream appended AFTER the derivation draws — the
 * derivation facts never move. Shells are WHOLE in v1:
 * ransacked is an interior condition (Adam's word —
 * toppled, scattered, opened), not shell damage; the
 * interior dressing wave deepens it later.
 */
function buildFarmhousePlan(
  worldSeed: string,
  inst: FarmhouseInstance,
): { features: ScatterObject[]; walls: SiteWallBox[] } {
  const rand = mulberry32(deriveSeed(worldSeed, `farmhouse-plan:${inst.key}`));
  const { x: cx, z: cz } = inst.center;
  const swap = inst.theta !== 0;
  const toWorld = (lx: number, lz: number): { x: number; z: number } =>
    swap ? { x: cx + lz, z: cz - lx } : { x: cx + lx, z: cz + lz };

  const SEG = FARM_SEGMENT_M;
  const GH = FARM_WALL_H_M;
  const L = FARMHOUSE_LENGTH_SEGMENTS[inst.slots.footprint] * SEG;
  const D = FARMHOUSE_GABLE_WIDTHS_M[inst.slots.gableWidth];
  const perLong = Math.round(L / SEG);
  const perShort = Math.round(D / SEG);
  const rhythm = FARMHOUSE_RHYTHM_KINDS[inst.slots.windowRhythm];
  const isFloor = inst.upstairsForm === 'floor';
  const topY = isFloor ? GH * 2 : GH;

  const features: ScatterObject[] = [];
  const walls: SiteWallBox[] = [];
  const feat = (kind: ScatterKind, x: number, z: number, y: number, scale: number, rotY: number): void => {
    features.push({ kind, x, z, y, scale, rotY });
  };
  const box = (bx: number, bz: number, hx: number, hz: number): void => {
    walls.push({ minX: bx - hx, maxX: bx + hx, minZ: bz - hz, maxZ: bz + hz });
  };

  type Side = 'north' | 'south' | 'east' | 'west';
  interface Segment { side: Side; lx: number; lz: number; running: 'x' | 'z' }
  const segments: Segment[] = [];
  for (let i = 0; i < perLong; i++) {
    const lx = -L / 2 + SEG / 2 + i * SEG;
    segments.push({ side: 'north', lx, lz: -D / 2, running: 'x' });
    segments.push({ side: 'south', lx, lz: D / 2, running: 'x' });
  }
  for (let i = 0; i < perShort; i++) {
    const lz = -D / 2 + SEG / 2 + i * SEG;
    segments.push({ side: 'west', lx: -L / 2, lz, running: 'z' });
    segments.push({ side: 'east', lx: L / 2, lz, running: 'z' });
  }

  // The door: the middle segment of a plan-picked side.
  const SIDES: Side[] = ['south', 'north', 'east', 'west'];
  const doorSide = SIDES[Math.min(3, Math.floor(rand() * 4))];
  const doorPool = segments.filter((s) => s.side === doorSide);
  const door =
    doorPool.length % 2 === 0
      ? doorPool[doorPool.length / 2 - 1 + Math.floor(rand() * 2)]
      : doorPool[Math.floor(doorPool.length / 2)];

  const emitWall = (s: Segment, kind: ScatterKind, y: number, withBox: boolean): void => {
    const w = toWorld(s.lx, s.lz);
    const runsWorldX = (s.running === 'x') !== swap;
    feat(kind, w.x, w.z, y, 1, runsWorldX ? 0 : Math.PI / 2);
    if (withBox) {
      if (runsWorldX) box(w.x, w.z, SEG / 2, FARMHOUSE_WALL_HALF_T);
      else box(w.x, w.z, FARMHOUSE_WALL_HALF_T, SEG / 2);
    }
  };
  for (const s of segments) {
    if (s !== door) emitWall(s, rhythm.ground as ScatterKind, 0, true);
    if (isFloor) emitWall(s, rhythm.upper as ScatterKind, GH, false);
  }

  // The upper floor itself ('floor' form): slab tiles
  // across the footprint at the story line.
  if (isFloor) {
    for (let i = 0; i < perLong; i++) {
      for (let j = 0; j < perShort; j++) {
        const w = toWorld(-L / 2 + SEG / 2 + i * SEG, -D / 2 + SEG / 2 + j * SEG);
        feat('farmFloorSlab', w.x, w.z, GH, 1, inst.theta);
      }
    }
  }

  // Gable ends at both length-ends, seated at the top
  // of the wall stack the form carries.
  const gableKind = FARMHOUSE_GABLE_KINDS[inst.slots.gableWidth] as ScatterKind;
  for (const endSign of [-1, 1]) {
    const w = toWorld(endSign * (L / 2), 0);
    feat(gableKind, w.x, w.z, topY, 1, inst.theta);
  }

  // The roof: tiled slabs, one per wall segment per
  // side, plus the ridge beam segments — all seated at
  // the wall top the form carries.
  {
    const slabKind = FARMHOUSE_ROOF_SLAB_KINDS[inst.slots.gableWidth];
    const ridgeH = FARMHOUSE_RIDGE_H_M[inst.slots.gableWidth];
    for (let i = 0; i < perLong; i++) {
      const lx = -L / 2 + SEG / 2 + i * SEG;
      const w = toWorld(lx, 0);
      feat(slabKind, w.x, w.z, topY, 1, inst.theta);
      feat(slabKind, w.x, w.z, topY, 1, inst.theta + Math.PI);
      feat('farmRidgeBeam', w.x, w.z, topY + ridgeH, 1, inst.theta);
    }
  }

  // The chimney: seated on the ridge by its seat roll,
  // its skirt sunk so the stack straddles the ridge
  // line (the measured ridge height for the depth).
  {
    const ridgeH = FARMHOUSE_RIDGE_H_M[inst.slots.gableWidth];
    const lx = -L / 2 + 0.8 + inst.chimneySeatU * (L - 1.6);
    const w = toWorld(lx, 0);
    feat('farmChimney', w.x, w.z, topY + ridgeH - 0.35, 1, inst.theta);
  }

  // The porch at the door (when the slot carries one):
  // the singular's idiom, posts colliding.
  const outRot = (side: Side): number =>
    side === 'north' ? Math.PI : side === 'south' ? 0 : side === 'east' ? Math.PI / 2 : -Math.PI / 2;
  const porchKind = FARMHOUSE_PORCH_KINDS[inst.slots.porch];
  if (porchKind) {
    const doorW = toWorld(door.lx, door.lz);
    feat(porchKind as ScatterKind, doorW.x, doorW.z, 0, 1, inst.theta + outRot(doorSide));
    const rot = (lx: number, lz: number, r: number): { x: number; z: number } => {
      const c = Math.cos(r);
      const s = Math.sin(r);
      return { x: lx * c + lz * s, z: -lx * s + lz * c };
    };
    for (const px of [-1.65, 1.65]) {
      const inHouse = rot(px, 2.05, outRot(doorSide));
      const w = toWorld(door.lx + inHouse.x, door.lz + inHouse.z);
      box(w.x, w.z, 0.13, 0.13);
    }
  }

  // The stairs inside (the stairsDressing slot's one
  // piece) — seated at farmhouseStairLocal (form-aware:
  // north wall for floor houses, along the ridge for
  // attic houses), the seat the upstairs zones read
  // for their stair-head anchor (one source).
  {
    const kind = FARMHOUSE_STAIRS_KINDS[inst.slots.stairsDressing] as ScatterKind;
    const seat = farmhouseStairLocal(inst);
    const w = toWorld(seat.lx, seat.lz);
    feat(kind, w.x, w.z, 0, 1, inst.theta + (seat.dir === 'x' ? Math.PI / 2 : 0));
  }

  // The cellar bulkhead at the back foundation.
  {
    const backSide: Side =
      doorSide === 'south' ? 'north' : doorSide === 'north' ? 'south' : doorSide === 'east' ? 'west' : 'east';
    const backSign = backSide === 'north' || backSide === 'west' ? 1 : -1;
    const local =
      backSide === 'north' || backSide === 'south'
        ? { lx: L / 4, lz: backSign * (D / 2 + 0.9) }
        : { lx: backSign * (L / 2 + 0.9), lz: L / 4 };
    const w = toWorld(local.lx, local.lz);
    feat('farmCellarDoor', w.x, w.z, 0, 1, inst.theta + outRot(backSide));
  }

  // The great stone in the yard (the core's seat).
  feat('hearthStone', inst.hearthStone.x, inst.hearthStone.z, 0, 1.25, inst.theta + Math.PI / 5);

  // Dressing: standing houses shed a little rubble at
  // their feet. A RANSACKED house's disorder is the
  // authored set (Models' ransacked wave): toppled
  // table, chair, shelf, opened crate and drawers, the
  // spilled barrel — a plan-shuffled subset seated on
  // the ground floor, clear of the stair run (either
  // form's), plus one rubble spill at the door where
  // the flight went out.
  const rubbleAt = (lx: number, lz: number): void => {
    const w = toWorld(lx, lz);
    feat('rubble', w.x, w.z, 0, 0.7 + rand() * 0.6, rand() * Math.PI);
  };
  if (inst.state === 'standing') {
    const n = Math.floor(inst.dressing * 2.99);
    for (let i = 0; i < n; i++) {
      const side = Math.floor(rand() * 4);
      const t = rand();
      if (side === 0) rubbleAt(-L / 2 + t * L, -D / 2 - 0.8);
      else if (side === 1) rubbleAt(-L / 2 + t * L, D / 2 + 0.8);
      else if (side === 2) rubbleAt(-L / 2 - 0.8, -D / 2 + t * D);
      else rubbleAt(L / 2 + 0.8, -D / 2 + t * D);
    }
  } else {
    const RANSACKED_SET: ScatterKind[] = [
      'farmTableToppled',
      'farmChairToppled',
      'farmShelfToppled',
      'farmCrateOpen',
      'farmDrawersOpen',
      'farmBarrelSpilled',
    ];
    const roster = [...RANSACKED_SET];
    for (let i = roster.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [roster[i], roster[j]] = [roster[j], roster[i]];
    }
    // Seats as fractions of (L, D), clear of the stair
    // run in the north-west and of the walls.
    const SEATS: readonly (readonly [number, number])[] = [
      [0.28, -0.22],
      [-0.02, 0.24],
      [0.3, 0.26],
      [-0.08, -0.28],
      [0.12, 0.02],
      [-0.26, 0.05],
    ];
    const n = Math.min(roster.length, 3 + Math.floor(inst.dressing * 3.99));
    for (let i = 0; i < n; i++) {
      const [fx, fz] = SEATS[i];
      const w = toWorld(fx * L, fz * D);
      feat(roster[i], w.x, w.z, 0, 1, inst.theta + Math.floor(rand() * 4) * (Math.PI / 2));
    }
    const out = { lx: door.lx * 1.15, lz: door.lz * 1.15 };
    rubbleAt(out.lx, out.lz);
  }

  return { features, walls };
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
