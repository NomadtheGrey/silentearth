/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UPSTAIRS ZONES — the attics module (Background claim,
 * approved 2026-10-31; DEV order 2026-11-01: zones
 * immediately behind claim B). Adam's ruling: the
 * upstairs is ENTERABLE AS ANOTHER ZONE — no
 * floor-height engine is owed. This module is the
 * cave idiom applied to a house: a layout per zone
 * key, a createGen-shaped factory, anchors and mouth
 * facts for the shell. The travel wiring (the faced
 * pill at the stairs, the dimension swap) is the
 * joint follow-on claim with UI, caves-style.
 *
 * KEYS: 'attic:<house key>' or 'floor:<house key>',
 * where a house key is 'farmhouse' (the singular —
 * floor form only, by the exception) or a family
 * instance's 'farmhouse:<cx>,<cz>'. The form in the
 * key is read FROM the house's record
 * (upstairsKeyFor), so the exterior and the zone can
 * never disagree. One upstairs zone per house in v1.
 *
 * THE ROOM IS THE HOUSE: the zone's floor plan is the
 * house's own footprint rect (length/depth from its
 * slots), staged at a shared ATTIC_ORIGIN in the
 * house's LOCAL frame — safe while zone dressing is
 * non-harvestable, the standing shared-origin
 * reasoning the caves run on. The attic form carries
 * the gable's sloped ceiling (Models' interior
 * slopes, knee walls, collar beams, windowed gable
 * ends, a dormer); the floor form carries a flat
 * ceiling line, a landing strip at the stair head,
 * and bedrooms off it — partitions with door gaps, no
 * door objects v1. The instance's STATE carries up:
 * a fled house's bedrooms are tossed too.
 *
 * LIGHT REGISTER: attic GLOOM (UPSTAIRS_LIGHT_REGISTER)
 * — a dim window slit and her torch, never the cave's
 * true dark. The layout exports its light spots (the
 * dormer, the gable windows, the floor form's window
 * line) for the shell's lights when the wiring lands.
 *
 * ENTRY: the stair-head door (farmAtticDoor — Models
 * named it THE MOUTH) stands at the head of the same
 * flight the surface shows; she arrives just inside
 * it, and exit returns her to exactly that stair
 * head on the surface. The seat facts are one-sourced
 * from the surface emissions (farmhouses.ts exports
 * its stair seat; the singular's flight is read off
 * the site's own features).
 *
 * DRESSING v1: the attic's storage crates stand in
 * the eaves (non-harvestable, like all zone dressing
 * in v1); the floor form's bedrooms dress from
 * Models' upper-floor set (bed, dresser, bedside
 * table, rug, the landing rail at the stair head,
 * door leaves on the partition doorways) — and a
 * fled house's dresser reads as its ransacked twin,
 * the settled-twin swap Models built it for.
 * Lootable contents remain the named follow-on
 * (Systems' per-dimension state design).
 */

import type { BiomeId, BiomeWeights, ChunkData, ScatterKind, ScatterObject } from '../types';
import { CHUNK_SIZE } from '../constants';
import type { Fields } from './biomes';
import { deriveSeed, mulberry32 } from './seed';
import {
  FARM_SEGMENT_M,
  farmhouseSite,
  type SiteFootprint,
  type SiteWallBox,
} from './sites';
import {
  farmhouseInstanceForKey,
  farmhouseLocalToWorld,
  farmhousePlanDims,
  farmhouseStairLocal,
  type FarmhouseInstance,
} from './farmhouses';
import {
  FARMHOUSE_GABLE_WIDTHS_M,
  FARMHOUSE_RHYTHM_KINDS,
} from './farmhouseTable';
import type { WorldGen } from './worldgen';

/** Shared staging origin for every upstairs zone (only
 *  one dimension is ever active at a time). Clear of
 *  CAVE_ORIGIN (100000, 100000) and its layer offset. */
export const ATTIC_ORIGIN = { x: 200000, z: 100000 };
/** The light register upstairs: gloom, never true dark. */
export const UPSTAIRS_LIGHT_REGISTER = 'gloom';
/** Fog density inside an upstairs zone (DRAFT — the
 *  surface runs 0.008, the caves' true dark 0.05; the
 *  gloom sits between, a room's worth of murk). */
export const UPSTAIRS_FOG_DENSITY = 0.02;
/** Background / fog colour upstairs (DRAFT): a warm
 *  dark, lit-room-at-dusk against the cave's black. */
export const UPSTAIRS_BACKGROUND = 0x171310;
/** The zone light spots' colour (dim warm — window
 *  light, not fungus glow). */
export const UPSTAIRS_LIGHT_COLOR = 0xffd9a0;
/** Knee-wall inset from the long walls (m): where the
 *  slope clears standing height (DRAFT). */
export const ATTIC_KNEE_INSET_M = 1.25;
/** Collar beam seat height in the zone (DRAFT — sized
 *  so the king posts meet the ridge in both depths). */
export const ATTIC_COLLAR_Y_M = 1.45;
/** The stair run's length (m) — the surface flight's
 *  own geometry (farmStairs: nine treads over ~3.6). */
export const STAIR_RUN_M = 3.6;

export type UpstairsForm = 'attic' | 'floor';

export interface UpstairsLayout {
  /** 'attic:<house key>' | 'floor:<house key>'. */
  key: string;
  form: UpstairsForm;
  /** The house key (instance key or 'farmhouse'). */
  houseKey: string;
  worldSeed: string;
  /** The room's dimensions (the house's footprint). */
  lengthM: number;
  depthM: number;
  /** Where she arrives inside the zone (just inside
   *  the stair-head door), + the yaw she faces. */
  entryAnchor: { x: number; z: number; yaw: number };
  /** The stair-head door's seat (zone frame). */
  doorSeat: { x: number; z: number };
  /** Dim light spots for the shell (zone frame). */
  lightSpots: { x: number; z: number }[];
  features: ScatterObject[];
  walls: SiteWallBox[];
  footprint: SiteFootprint;
}

/** The zone key for a family instance — the form is
 *  the instance's own upstairsForm, always. */
export function upstairsKeyFor(inst: FarmhouseInstance): string {
  return `${inst.upstairsForm}:${inst.key}`;
}

/** True for an upstairs zone key ('attic:' / 'floor:'). */
export function isUpstairsKey(key: string): boolean {
  return key.startsWith('attic:') || key.startsWith('floor:');
}

interface HouseFacts {
  form: UpstairsForm;
  lengthM: number;
  depthM: number;
  gableWidthIdx: number;
  state: 'standing' | 'ransacked';
  dressing: number;
  biome: BiomeId;
  /** Stair seat in the house's LOCAL frame + which
   *  length-end the flight hugs (-1 west, +1 east). */
  stairLocal: { lx: number; lz: number; dir: 'x' | 'z' };
  stairEnd: -1 | 1;
  /** Window-rhythm slot index (the perimeter's kind). */
  rhythmIdx: number;
}

function houseFacts(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  key: string,
): HouseFacts | null {
  const m = /^(attic|floor):(.+)$/.exec(key);
  if (!m) return null;
  const form = m[1] as UpstairsForm;
  const houseKey = m[2];
  if (houseKey === 'farmhouse') {
    if (form !== 'floor') return null; // the singular's one-zone rule
    const site = farmhouseSite(worldSeed, spawn, weightsAtPos);
    // The singular's flight is read off the site's own
    // emitted features — one source, no restated seat.
    const stairs = site.features.find((f) => f.kind === 'farmStairs');
    if (!stairs) return null;
    return {
      form,
      lengthM: 10,
      depthM: 7.5,
      gableWidthIdx: 1,
      state: 'ransacked', // the exception's word: its occupants fled
      dressing: 1,
      biome: site.biome,
      stairLocal: { lx: 4.0, lz: -3.2, dir: 'z' as const },
      stairEnd: 1,
      rhythmIdx: 0,
    };
  }
  const inst = farmhouseInstanceForKey(worldSeed, spawn, weightsAtPos, houseKey);
  if (!inst) return null;
  if (inst.upstairsForm !== form) return null; // form never disagrees
  const dims = farmhousePlanDims(inst);
  return {
    form,
    lengthM: dims.L,
    depthM: dims.D,
    gableWidthIdx: inst.slots.gableWidth,
    state: inst.state,
    dressing: inst.dressing,
    biome: inst.biome,
    stairLocal: farmhouseStairLocal(inst),
    stairEnd: -1,
    rhythmIdx: inst.slots.windowRhythm,
  };
}

const layoutCache = new Map<string, UpstairsLayout>();

/**
 * Derive one upstairs zone's layout by its key.
 * Memoized per (seed, key). Returns null for a key
 * that names no house, or a form the house doesn't
 * carry.
 */
export function atticLayoutForKey(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  key: string,
): UpstairsLayout | null {
  const cacheKey = `${worldSeed}::${key}`;
  const cached = layoutCache.get(cacheKey);
  if (cached) return cached;
  const facts = houseFacts(worldSeed, spawn, weightsAtPos, key);
  if (!facts) return null;

  const rand = mulberry32(deriveSeed(worldSeed, `dimension:${key}`));
  const { lengthM: L, depthM: D } = facts;
  const SEG = FARM_SEGMENT_M;
  const perLong = Math.round(L / SEG);
  const perShort = Math.round(D / SEG);
  const ox = ATTIC_ORIGIN.x;
  const oz = ATTIC_ORIGIN.z;
  const at = (lx: number, lz: number): { x: number; z: number } => ({ x: ox + lx, z: oz + lz });

  const features: ScatterObject[] = [];
  const walls: SiteWallBox[] = [];
  const feat = (kind: ScatterKind, lx: number, lz: number, y: number, rotY: number): void => {
    const w = at(lx, lz);
    features.push({ kind, x: w.x, z: w.z, y, scale: 1, rotY });
  };
  const box = (lx: number, lz: number, hx: number, hz: number): void => {
    const w = at(lx, lz);
    walls.push({ minX: w.x - hx, maxX: w.x + hx, minZ: w.z - hz, maxZ: w.z + hz });
  };

  // The floor: slab tiles across the footprint.
  for (let i = 0; i < perLong; i++) {
    for (let j = 0; j < perShort; j++) {
      feat('farmFloorSlab', -L / 2 + SEG / 2 + i * SEG, -D / 2 + SEG / 2 + j * SEG, 0, 0);
    }
  }

  // The stair head + the mouth. The head is one run
  // along the flight's climb direction (form-aware —
  // farmhouseStairLocal); the door stands just past
  // the head, facing the arriving climber, and she
  // arrives inside it facing her climb's way. The
  // FLOOR form's anchor steps sideways off the head
  // instead (a 5.0-deep house's head lands close to
  // the far wall; the sideways step is the landing).
  const alongX = facts.stairLocal.dir === 'x';
  const head = alongX
    ? { lx: facts.stairLocal.lx + STAIR_RUN_M, lz: facts.stairLocal.lz }
    : { lx: facts.stairLocal.lx, lz: facts.stairLocal.lz + STAIR_RUN_M };
  const doorSeat = alongX
    ? { lx: head.lx + 0.35, lz: head.lz }
    : { lx: head.lx, lz: head.lz + 0.35 };
  feat('farmAtticDoor', doorSeat.lx, doorSeat.lz, 0, alongX ? Math.PI / 2 : 0);
  const entryAt = alongX
    ? at(head.lx + 1.0, head.lz)
    : at(head.lx - facts.stairEnd * 0.7, head.lz + 0.35);
  const entryAnchor = { x: entryAt.x, z: entryAt.z, yaw: alongX ? -Math.PI / 2 : Math.PI };
  const doorSeatWorld = at(doorSeat.lx, doorSeat.lz);

  const lightSpots: { x: number; z: number }[] = [];

  if (facts.form === 'attic') {
    const slopeKind: ScatterKind = facts.gableWidthIdx === 1 ? 'farmAtticSlopeWide' : 'farmAtticSlope';
    const collarKind: ScatterKind = facts.gableWidthIdx === 1 ? 'farmAtticCollarBeamWide' : 'farmAtticCollarBeam';
    const gableKind: ScatterKind = facts.gableWidthIdx === 1 ? 'farmGableEndWideWindow' : 'farmGableEndWindow';
    const kneeZ = D / 2 - ATTIC_KNEE_INSET_M;
    for (let i = 0; i < perLong; i++) {
      const lx = -L / 2 + SEG / 2 + i * SEG;
      feat(slopeKind, lx, 0, 0, 0);
      feat(slopeKind, lx, 0, 0, Math.PI);
      feat(collarKind, lx, 0, ATTIC_COLLAR_Y_M, 0);
      feat('farmAtticKneeWall', lx, -kneeZ, 0, 0);
      feat('farmAtticKneeWall', lx, kneeZ, 0, 0);
    }
    // Windowed gable ends (windowed face outward).
    feat(gableKind, -L / 2, 0, 0, Math.PI);
    feat(gableKind, L / 2, 0, 0, 0);
    lightSpots.push(at(-L / 2, 0), at(L / 2, 0));
    // A dormer on a plan-picked slope segment.
    const dormerSeg = Math.floor(rand() * perLong);
    const dormerSide = rand() < 0.5 ? -1 : 1;
    const dlx = -L / 2 + SEG / 2 + dormerSeg * SEG;
    feat('farmDormer', dlx, dormerSide * (kneeZ + 0.55), 0.35, dormerSide < 0 ? Math.PI : 0);
    lightSpots.push(at(dlx, dormerSide * (kneeZ + 0.55)));
    // Collision: the knee lines + the gable ends (the
    // eaves beyond the knees are storage, seen over
    // the low wall, not walked).
    box(0, -kneeZ, L / 2, 0.1);
    box(0, kneeZ, L / 2, 0.1);
    box(-L / 2, 0, 0.15, D / 2);
    box(L / 2, 0, 0.15, D / 2);
    // The landing rail beside the stair-head door.
    feat('farmLandingRail', head.lx + 0.85, head.lz, 0, Math.PI / 2);
    // Storage in the eaves: crates along both knee
    // lines' outer side, count on the house's
    // dressing richness.
    const crates = 2 + Math.floor(facts.dressing * 2.99);
    for (let i = 0; i < crates; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const lx = -L / 2 + 0.7 + rand() * (L - 1.4);
      feat('farmCrateOpen', lx, side * (kneeZ + 0.55), 0, Math.floor(rand() * 4) * (Math.PI / 2));
    }
  } else {
    // FLOOR form: perimeter in the upper rhythm kind,
    // a landing strip at the stair end, bedrooms east
    // (or west, mirrored) of two partition lines.
    const upperKind = FARMHOUSE_RHYTHM_KINDS[facts.rhythmIdx].upper as ScatterKind;
    const emitRun = (lx0: number, lz: number, horizontal: boolean, count: number, y: number, kind: ScatterKind, withBox: boolean): void => {
      for (let i = 0; i < count; i++) {
        const lx = horizontal ? lx0 + i * SEG : lx0;
        const zz = horizontal ? lz : lz + i * SEG;
        feat(kind, lx, zz, y, horizontal ? 0 : Math.PI / 2);
        if (withBox) {
          if (horizontal) box(lx, zz, SEG / 2, 0.15);
          else box(lx, zz, 0.15, SEG / 2);
        }
      }
    };
    emitRun(-L / 2 + SEG / 2, -D / 2, true, perLong, 0, upperKind, true);
    emitRun(-L / 2 + SEG / 2, D / 2, true, perLong, 0, upperKind, true);
    emitRun(-L / 2, -D / 2 + SEG / 2, false, perShort, 0, upperKind, true);
    emitRun(L / 2, -D / 2 + SEG / 2, false, perShort, 0, upperKind, true);
    // Partitions (mirrored by the stair end): landing
    // line at 2.2 from the stair end, bedroom line at
    // the far quarter. Dividers are Models' inner
    // walls; each line's doorway is the doorway BRICK
    // (the door-is-a-gap law indoors — its passage is
    // vertex-clear, and it takes no collision box),
    // with a hinged leaf swung closed or ajar.
    const e = facts.stairEnd;
    const p1 = e * (L / 2) - e * 2.2;
    const p2 = -e * (L / 4);
    const gap1 = Math.floor(rand() * perShort);
    const gap2 = Math.floor(rand() * perShort);
    const emitPartition = (px: number, gap: number): void => {
      for (let j = 0; j < perShort; j++) {
        const lz = -D / 2 + SEG / 2 + j * SEG;
        if (j === gap) {
          feat('farmWallInnerDoor', px, lz, 0, Math.PI / 2);
          // The leaf: hinged at the doorway's north
          // jamb, closed or ajar on the stream.
          const ajar = rand() < 0.5 ? 0 : 0.6;
          feat('farmDoorLeaf', px, lz + SEG / 2, 0, Math.PI / 2 - ajar);
        } else {
          feat('farmWallInner', px, lz, 0, Math.PI / 2);
          box(px, lz, 0.15, SEG / 2);
        }
      }
    };
    emitPartition(p1, gap1);
    emitPartition(p2, gap2);
    // The landing rail announces the stair head.
    feat('farmLandingRail', head.lx, head.lz + 0.8, 0, 0);
    // The window line's light (the upper walls'
    // windows — spots along both long sides).
    lightSpots.push(at(0, -D / 2), at(0, D / 2));
    // THE BEDROOMS DRESS (Models' upper-floor set):
    // each bedroom takes a bed against the north wall,
    // a rug, a dresser on the south wall, a bedside
    // table. The state's carry-up: in a fled house the
    // dresser reads as its RANSACKED TWIN (drawers
    // hanging open — the settled-twin swap) and the
    // toss roster scatters through the bedrooms too.
    const spans: (readonly [number, number])[] = [
      [Math.min(p1, p2), Math.max(p1, p2)],
      [Math.min(p2, -e * (L / 2)), Math.max(p2, -e * (L / 2))],
    ];
    for (const [lo, hi] of spans) {
      const midX = (lo + hi) / 2;
      feat('farmBed', midX, -D / 2 + 1.1, 0, 0);
      feat('farmBedsideTable', midX + 0.85, -D / 2 + 0.5, 0, 0);
      feat('farmRug', midX, D / 2 - 1.25, 0, 0);
      feat(facts.state === 'ransacked' ? 'farmDrawersOpen' : 'farmDresser', midX + 0.6, D / 2 - 0.4, 0, Math.PI);
    }
    if (facts.state === 'ransacked') {
      const SET: ScatterKind[] = ['farmTableToppled', 'farmChairToppled', 'farmCrateOpen'];
      const n = 1 + Math.floor(rand() * 2.99);
      for (let i = 0; i < n; i++) {
        const kind = SET[Math.floor(rand() * SET.length)];
        const [lo, hi] = spans[Math.floor(rand() * spans.length)];
        const lx = lo + 0.7 + rand() * Math.max(0.4, hi - lo - 1.4);
        const lz = (rand() * 2 - 1) * (D / 2 - 0.9);
        feat(kind, lx, lz, 0, Math.floor(rand() * 4) * (Math.PI / 2));
      }
    }
  }

  const span = Math.max(L, D) / 2 + 4;
  const footprint: SiteFootprint = {
    center: ATTIC_ORIGIN,
    clearRadius: span,
    features: [],
    walls,
    bounds: { minX: ox - span, maxX: ox + span, minZ: oz - span, maxZ: oz + span },
  };
  const layout: UpstairsLayout = {
    key,
    form: facts.form,
    houseKey: /^(?:attic|floor):(.+)$/.exec(key)![1],
    worldSeed,
    lengthM: L,
    depthM: D,
    entryAnchor,
    doorSeat: doorSeatWorld,
    lightSpots,
    features,
    walls,
    footprint,
  };
  layoutCache.set(cacheKey, layout);
  return layout;
}

/** The footprint the renderer's wall query reads
 *  while an upstairs dimension is active. */
export function atticFootprintFor(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  key: string,
): SiteFootprint | null {
  const layout = atticLayoutForKey(worldSeed, spawn, weightsAtPos, key);
  return layout ? layout.footprint : null;
}

const ATTIC_FIELDS: Fields = { wetness: 0.05, elevation: 0, density: 0, mineral: 0, creek: 0, distance: 0 };
const ATTIC_GROUND_COLOR = 0x4a3b28;

/**
 * An upstairs dimension as a WorldGen: chunks emit
 * only the layout's features; the surface world is
 * never consulted (the cave gen's shape).
 */
export function createAtticGen(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  key: string,
): WorldGen | null {
  const layout = atticLayoutForKey(worldSeed, spawn, weightsAtPos, key);
  if (!layout) return null;
  const facts = houseFacts(worldSeed, spawn, weightsAtPos, key)!;
  const weights: BiomeWeights = {
    weights: {
      mirewood: 0, deepBog: 0, oldfieldRise: 0, creekBottom: 0,
      tanglewood: 0, saltFlat: 0, meadow: 0, forest: 0,
    } as Record<BiomeId, number>,
    dominant: facts.biome,
  };
  const allFeatures = layout.features;
  return {
    seed: worldSeed,
    dimensionKey: key,
    fieldsAt: () => ATTIC_FIELDS,
    weightsAt: () => weights,
    groundColorAt: () => ATTIC_GROUND_COLOR,
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

/**
 * THE MOUTH FACTS for the shell's travel wiring: for
 * a house key, its zone key + the surface seats of
 * the flight's base and head (where she stands to
 * climb, and where the exit returns her).
 */
export function upstairsMouthFor(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  houseKey: string,
): {
  zoneKey: string;
  form: UpstairsForm;
  stairBase: { x: number; z: number };
  stairHead: { x: number; z: number };
} | null {
  if (houseKey === 'farmhouse') {
    const site = farmhouseSite(worldSeed, spawn, weightsAtPos);
    const stairs = site.features.find((f) => f.kind === 'farmStairs');
    if (!stairs) return null;
    const dirX = Math.sin(stairs.rotY);
    const dirZ = Math.cos(stairs.rotY);
    return {
      zoneKey: 'floor:farmhouse',
      form: 'floor',
      stairBase: { x: stairs.x, z: stairs.z },
      stairHead: { x: stairs.x + dirX * STAIR_RUN_M, z: stairs.z + dirZ * STAIR_RUN_M },
    };
  }
  const inst = farmhouseInstanceForKey(worldSeed, spawn, weightsAtPos, houseKey);
  if (!inst) return null;
  const local = farmhouseStairLocal(inst);
  const base = farmhouseLocalToWorld(inst, local.lx, local.lz);
  const headLocal = local.dir === 'x'
    ? { lx: local.lx + STAIR_RUN_M, lz: local.lz }
    : { lx: local.lx, lz: local.lz + STAIR_RUN_M };
  const head = farmhouseLocalToWorld(inst, headLocal.lx, headLocal.lz);
  return { zoneKey: upstairsKeyFor(inst), form: inst.upstairsForm, stairBase: base, stairHead: head };
}
