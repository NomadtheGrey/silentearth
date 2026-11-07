/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BURNT VILLAGES — the family (Background claim ratified
 * 2026-11-03; Adam's population ruling 2026-11-01: 'other
 * burnt villages with a hearthstone' populate on seed +
 * location, the authored Burnt Village staying the
 * first; Adam 2026-11-03: 'we'll get villages placed and
 * buildings enumerated').
 *
 * PLACED: a recurring family on the distribution pattern
 * (the homesteads' shape): 512 m cells, a labelled
 * per-cell stream, a candidate seat, a taste test, the
 * unified spacing law. The taste is the AUTHORED
 * village's own — oldfieldRise or creekBottom dominant
 * with real creek weight — so family villages sit in the
 * same country as the first. The taste is the thin gate
 * (~9% of seats pass), hence the rich presence: villages
 * are meant to be found every few kilometres of ranging,
 * not on every walk. Villages resolve LAST among the
 * families, yielding to the singulars, both ribbons,
 * cave instances, homestead instances, and farmhouse
 * instances already seated — the biggest, rarest family
 * takes the leavings.
 *
 * ENUMERATED: Adam's size law, applied literally — a
 * village's STRUCTURE count rolls 3–6 and EXPLODES: on a
 * one-third roll it gains 3–6 more, repeating until the
 * third fails (mean ≈ 6.75; two-thirds of villages are
 * the base roll alone). The count is structures: houses
 * PLUS exactly one general store, counted within the
 * roll (DEV's reading, standing — a 3-structure village
 * is a store and two houses). Houses compose from the
 * village kit on the authored street grammar (stations
 * every 15.4 m, quarter-turn frame, plots filled centre-
 * outward); the store composes from the store kit at the
 * station nearest the centre and is never 'gone' — a
 * store's footprint always reads. One house is the
 * hearth house, forced standing. The well rides outside
 * the count — the village's constant furniture, like its
 * street (ratified with the claim).
 *
 * CARRIAGE IS STRUCTURAL (the population ruling's own
 * words): every instance's hearthstone is a HOME-pillar
 * carrier, minted per instance key in the burnt band on
 * the homestead pattern — no presence roll, because the
 * hearth house is forced, not rolled. Since the deal
 * (Adam, 2026-11-05) each hearthstone deals ONE
 * Home-pillar mark by its own hash (homeDeal.ts); the
 * pillar completes through the populated world.
 *
 * Beats ride each instance in the first's shape: bone
 * spots at two built houses, the well, and the street;
 * the hearth house exports its hearth spot + smoke
 * anchor as the first's does.
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
  STORE_SEGMENT_M,
  STORE_WALL_H_M,
  STORE_WALL_W_M,
  STORE_WALL_D_M,
  VILLAGE_CREEK_MIN_WEIGHT,
  VILLAGE_SEGMENT_M,
  VILLAGE_WALL_H_M,
  type SiteWallBox,
  type VillageHouseState,
  ROOF_RECT_INSET_M,
  type RoofRect,
} from './sites';
import {
  DISTRIBUTION_CELL_M,
  distributionCellStream,
  distributionCellsOverlapping,
} from './distribution';
import { deriveSeed, mulberry32 } from './seed';
import { dealHomeMark } from './homeDeal';
import { caveInstancesInRect } from './caves';
import { homesteadInstancesInRect, HOMESTEAD_CLEAR_RADIUS_M } from './homesteads';
import { farmhouseInstancesInRect, FARMHOUSE_CLEAR_RADIUS_M } from './farmhouses';
import type { FragmentCarrier } from './carriers';
import { dealFragmentArc } from './fragmentArc';

/** Per-cell presence draw (DRAFT — priced against the
 *  taste's ~9% pass rate in the claim census). */
export const VILLAGE_CELL_PRESENCE = 0.3;
/** Station pitch along the street (m) — the authored
 *  plot spacing, kept. */
export const VILLAGE_STATION_PITCH_M = 15.4;
/** House-centre offset from the street axis (m) — the
 *  authored setback, kept. */
export const VILLAGE_HOUSE_SETBACK_M = 6.8;
/** Clearing beyond the street's half-length (m): the
 *  authored residual (58 − 30.8 at five stations). */
export const VILLAGE_CLEAR_RESIDUAL_M = 27.2;
/** Rect queries expand by this before enumerating cells:
 *  a village's bounds can overhang its cell by up to its
 *  clearing radius, and rect consumers (the site pass,
 *  the wall query) ask with honest rects. Covers every
 *  village the dice plausibly roll (radius reaches 160 m
 *  only past ~46 structures). */
export const VILLAGE_QUERY_MARGIN_M = 160;
/** The store kit's wall half-thickness (m) — sites.ts
 *  keeps its own copy private; same value. */
const STORE_WALL_HALF_T = 0.15;
const VILLAGE_WALL_HALF_T = 0.15;

/** Adam's size law: 3–6 structures, exploding on a
 *  one-third roll for 3–6 more, repeating. */
export function rollVillageSize(rand: () => number): number {
  let n = 3 + Math.floor(rand() * 4);
  while (rand() < 1 / 3) n += 3 + Math.floor(rand() * 4);
  return n;
}

/** Stations a village of n structures needs (two plots
 *  per station). */
export function villageStationsFor(n: number): number {
  return Math.ceil(n / 2);
}

/** A village's clearing radius, derived from its size —
 *  never rolled: half the street plus the authored
 *  residual. */
export function villageClearRadiusFor(n: number): number {
  return (villageStationsFor(n) - 1) * (VILLAGE_STATION_PITCH_M / 2) + VILLAGE_CLEAR_RESIDUAL_M;
}

/** One enumerated plot of a family village. */
export interface VillageInstancePlot {
  x: number;
  z: number;
  /** 'house' or the one 'store'. */
  kind: 'house' | 'store';
  /** The house fate vocabulary; the store never 'gone'. */
  state: VillageHouseState;
  /** True for the one hearth house (forced standing). */
  hearth: boolean;
}

export interface VillageInstance {
  /** Stable key: 'village:<cx>,<cz>'. */
  key: string;
  cellX: number;
  cellZ: number;
  center: { x: number; z: number };
  biome: BiomeId;
  /** The structure count the size law rolled. */
  structureCount: number;
  /** World axis the street runs along. */
  streetAxis: 'x' | 'z';
  plots: VillageInstancePlot[];
  /** Roofed interiors for the rain-shelter read (2026-11-05). */
  roofRects: RoofRect[];
  /** The one hearth-standing house + its hearth spot. */
  hearthHouse: {
    x: number;
    z: number;
    hearthSpot: { x: number; z: number };
    smokeAnchor: { x: number; z: number; y: number };
  };
  well: { x: number; z: number };
  /** Seeded bone-scatter spots for the bones beat. */
  boneSpots: { x: number; z: number; where: 'house' | 'well' | 'street' }[];
  /** The hearthstone's carrier facts — minted for EVERY
   *  instance (carriage is structural, see the header). */
  fragmentCarrier: FragmentCarrier;
  /** Where the fragment machinery reads: the hearth spot. */
  fragmentSpot: { x: number; z: number };
  features: ScatterObject[];
  walls: SiteWallBox[];
  clearRadius: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const instanceCache = new Map<string, VillageInstance | null>();

interface VillageCandidate {
  center: { x: number; z: number };
  biome: BiomeId;
  structureCount: number;
  clearRadius: number;
}

/** A cell's RAW candidate — fixed draw order: presence,
 *  seat jitter x, seat jitter z, the taste test (no
 *  draw), then the size law (its draws price the
 *  footprint the spacing law judges). */
function villageCandidate(
  worldSeed: string,
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): VillageCandidate | null {
  const rand = distributionCellStream(worldSeed, 'distribution:village', cx, cz);
  if (rand() >= VILLAGE_CELL_PRESENCE) return null;
  const x = (cx + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const z = (cz + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const w = weightsAtPos(x, z);
  if (
    !(
      (w.dominant === 'oldfieldRise' || w.dominant === 'creekBottom') &&
      (w.weights.creekBottom ?? 0) >= VILLAGE_CREEK_MIN_WEIGHT
    )
  ) {
    return null;
  }
  const structureCount = rollVillageSize(rand);
  return {
    center: { x, z },
    biome: w.dominant,
    structureCount,
    clearRadius: villageClearRadiusFor(structureCount),
  };
}

/**
 * The composition for one accepted instance: the
 * authored village's street grammar, generalized to the
 * rolled count. All draws ride the instance's own plan
 * stream; the beats ride their own, as the first's do.
 */
function buildVillagePlan(
  worldSeed: string,
  key: string,
  center: { x: number; z: number },
  structureCount: number,
  clearRadius: number,
): {
  streetAxis: 'x' | 'z';
  plots: VillageInstancePlot[];
  hearthHouse: VillageInstance['hearthHouse'];
  well: { x: number; z: number };
  boneSpots: VillageInstance['boneSpots'];
  features: ScatterObject[];
  walls: SiteWallBox[];
} {
  const planRand = mulberry32(deriveSeed(worldSeed, `village-plan:${key}`));
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

  // --- Slots: stations centre-outward, sides alternating
  // from a stream-picked first side. Slot 0 is the store
  // (the station nearest the centre, on that side); the
  // rest are houses.
  const stations = villageStationsFor(structureCount);
  const stationLxs: number[] = [];
  for (let i = 0; i < stations; i++) stationLxs.push((i - (stations - 1) / 2) * VILLAGE_STATION_PITCH_M);
  const centreOut = [...stationLxs].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
  const firstSide: -1 | 1 = planRand() < 0.5 ? -1 : 1;
  interface Slot {
    lx: number;
    side: -1 | 1;
  }
  const slots: Slot[] = [];
  for (const lx of centreOut) {
    slots.push({ lx, side: firstSide });
    slots.push({ lx, side: firstSide === 1 ? -1 : 1 });
  }
  const taken = slots.slice(0, structureCount);
  const houseSlots = taken.slice(1);
  const hearthSlotIdx = Math.floor(planRand() * houseSlots.length);

  const plots: VillageInstancePlot[] = [];
  const builtHouses: { slot: Slot; world: { x: number; z: number } }[] = [];
  let hearthHouse: VillageInstance['hearthHouse'] | null = null;

  /** One house on the authored 7×7 grammar (the first
   *  village's segment machinery, per-plot). */
  const buildHouse = (slot: Slot, isHearth: boolean): void => {
    const world = toWorld(slot.lx, slot.side * VILLAGE_HOUSE_SETBACK_M);
    let state: VillageHouseState;
    if (isHearth) state = 'standing';
    else if (planRand() < 0.15) state = 'gone';
    else {
      const roll = planRand();
      state = roll < 0.25 ? 'standing' : roll < 0.7 ? 'charred' : 'collapsed';
    }
    plots.push({ x: world.x, z: world.z, kind: 'house', state, hearth: isHearth });
    if (state === 'gone') return;
    builtHouses.push({ slot, world });

    interface Seg {
      lx: number;
      lz: number;
      running: 'x' | 'z';
      doorSide: boolean;
    }
    const segs: Seg[] = [];
    const H = VILLAGE_SEGMENT_M; // 3.5 — half the house side
    for (const off of [-H / 2, H / 2]) {
      segs.push({ lx: slot.lx + off, lz: slot.side * VILLAGE_HOUSE_SETBACK_M - H, running: 'x', doorSide: slot.side === 1 });
      segs.push({ lx: slot.lx + off, lz: slot.side * VILLAGE_HOUSE_SETBACK_M + H, running: 'x', doorSide: slot.side === -1 });
      segs.push({ lx: slot.lx - H, lz: slot.side * VILLAGE_HOUSE_SETBACK_M + off, running: 'z', doorSide: false });
      segs.push({ lx: slot.lx + H, lz: slot.side * VILLAGE_HOUSE_SETBACK_M + off, running: 'z', doorSide: false });
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
      for (const s of segs) {
        if (planRand() < 0.55) continue;
        emitSeg(s, 'villageWallCharred', 0.5);
      }
      const rubbleRand = mulberry32(deriveSeed(worldSeed, `village-rubble:${key}:${slot.lx},${slot.side}`));
      const rubbleCount = 2 + Math.floor(rubbleRand() * 2);
      for (let i = 0; i < rubbleCount; i++) {
        const w = toWorld(
          slot.lx + (rubbleRand() * 2 - 1) * 2.4,
          slot.side * VILLAGE_HOUSE_SETBACK_M + (rubbleRand() * 2 - 1) * 2.4,
        );
        feat('rubble', w.x, w.z, 0, 0.7 + rubbleRand() * 0.6, rubbleRand() * Math.PI);
      }
    }

    if (isHearth) {
      const spotLocal = { lx: slot.lx, lz: slot.side * VILLAGE_HOUSE_SETBACK_M + slot.side * 2.4 };
      const spot = toWorld(spotLocal.lx, spotLocal.lz);
      const chimney = toWorld(slot.lx + 2.3, slot.side * VILLAGE_HOUSE_SETBACK_M);
      hearthHouse = {
        x: world.x,
        z: world.z,
        hearthSpot: spot,
        smokeAnchor: { x: chimney.x, z: chimney.z, y: 5.2 },
      };
      // THE HEARTHSTONE SEAT (2026-11-05, DEV filing):
      // the carrier resolves at this spot, so a dressed
      // stone stands at it — plain, as the hearth house
      // always stands in this family — sized to read at
      // a glance. No wall box (the farmhouse great
      // stone's precedent). No carrier fact moves.
      feat('hearthStone', spot.x, spot.z, 0, 1.1, theta);
    }
  };

  /** The store: the store kit composed at village scale —
   *  long axis along the street, the false front facing
   *  it. The kit has no charred twins, so a charred store
   *  reads by its fire-missing stretches and its absent
   *  roof; a collapsed one by stubs and rubble. No
   *  interior furniture in v1 (the claim). */
  const buildStore = (slot: Slot): void => {
    // Centre set back so the front aligns with the
    // houses' street faces (the store is 0.5 m deeper).
    const setback = VILLAGE_HOUSE_SETBACK_M + (STORE_WALL_D_M - VILLAGE_SEGMENT_M * 2) / 2;
    const world = toWorld(slot.lx, slot.side * setback);
    const roll = planRand();
    const state: VillageHouseState = roll < 0.4 ? 'standing' : roll < 0.75 ? 'charred' : 'collapsed';
    plots.push({ x: world.x, z: world.z, kind: 'store', state, hearth: false });

    const W = STORE_WALL_W_M;
    const D = STORE_WALL_D_M;
    const SEG = STORE_SEGMENT_M;
    interface SSeg {
      lx: number;
      lz: number;
      running: 'x' | 'z';
      front: boolean;
    }
    const ssegs: SSeg[] = [];
    const perLong = Math.round(W / SEG);
    const perShort = Math.round(D / SEG);
    // Local frame: the store's length runs along the
    // street (local x); its street side is -side in the
    // plot frame, as a house's door side is.
    for (let i = 0; i < perLong; i++) {
      const lx = slot.lx - W / 2 + SEG / 2 + i * SEG;
      ssegs.push({ lx, lz: slot.side * setback - slot.side * (D / 2), running: 'x', front: true });
      ssegs.push({ lx, lz: slot.side * setback + slot.side * (D / 2), running: 'x', front: false });
    }
    for (let i = 0; i < perShort; i++) {
      const lz = slot.side * setback - slot.side * (D / 2) + SEG / 2 + i * SEG;
      ssegs.push({ lx: slot.lx - W / 2, lz, running: 'z', front: false });
      ssegs.push({ lx: slot.lx + W / 2, lz, running: 'z', front: false });
    }
    const doorPool = ssegs.filter((s) => s.front);
    const door = doorPool[Math.floor(doorPool.length / 2)];
    const emitWall = (s: SSeg, scale: number): void => {
      const w = toWorld(s.lx, s.lz);
      const runsWorldX = (s.running === 'x') !== swap;
      feat(s.front ? 'storeFront' : 'storeWall', w.x, w.z, 0, scale, runsWorldX ? 0 : Math.PI / 2);
      const halfLen = (SEG / 2) * scale;
      if (runsWorldX) box(w.x, w.z, halfLen, STORE_WALL_HALF_T);
      else box(w.x, w.z, STORE_WALL_HALF_T, halfLen);
    };

    if (state === 'standing') {
      for (const s of ssegs) {
        if (s === door) continue;
        emitWall(s, 1);
      }
      feat('storeRoof', world.x, world.z, STORE_WALL_H_M, 1, theta);
      // The boardwalk porch along the front.
      for (const s of doorPool) {
        const w = toWorld(s.lx, s.lz - slot.side * 0.95);
        feat('storePorch', w.x, w.z, 0, 1, theta);
      }
    } else if (state === 'charred') {
      const others = ssegs.filter((s) => s !== door);
      const missingCount = 2 + Math.floor(planRand() * 3);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(planRand() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      const missing = new Set(others.slice(0, missingCount));
      for (const s of ssegs) {
        if (s === door || missing.has(s)) continue;
        emitWall(s, 1);
      }
      // No roof: it burned away. Ash at the plot.
      const w = toWorld(slot.lx, slot.side * setback);
      feat('ashPatch', w.x, w.z, 0.02, 1.6, planRand() * Math.PI);
    } else {
      for (const s of ssegs) {
        if (planRand() < 0.5) continue;
        emitWall(s, 0.5);
      }
      const rubbleCount = 3 + Math.floor(planRand() * 3);
      for (let i = 0; i < rubbleCount; i++) {
        const w = toWorld(
          slot.lx + (planRand() * 2 - 1) * 4.4,
          slot.side * setback + (planRand() * 2 - 1) * 2.6,
        );
        feat('rubble', w.x, w.z, 0, 0.7 + planRand() * 0.6, planRand() * Math.PI);
      }
    }
  };

  buildStore(taken[0]);
  houseSlots.forEach((slot, i) => buildHouse(slot, i === hearthSlotIdx));

  // The well: the village's constant furniture, riding
  // outside the count — just off the street's edge near
  // its middle, as the first's stands.
  const wellLocal = { lx: 5.5, lz: 4.4 };
  const wellWorld = toWorld(wellLocal.lx, wellLocal.lz);
  feat('villageWell', wellWorld.x, wellWorld.z, 0, 1, theta);
  box(wellWorld.x, wellWorld.z, 0.85, 0.85);

  // Ash: the street reads as an ash track along its whole
  // length, and the footprint stands in ash fall.
  {
    const rand = mulberry32(deriveSeed(worldSeed, `village-ash:${key}`));
    const halfStreet = ((stations - 1) * VILLAGE_STATION_PITCH_M) / 2 + 8;
    for (let lx = -halfStreet; lx <= halfStreet; lx += 6.5) {
      const w = toWorld(lx, (rand() * 2 - 1) * 1.6);
      feat('ashPatch', w.x, w.z, 0.02, 1.4 + rand() * 1.2, rand() * Math.PI);
    }
    for (let i = 0; i < 22; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * (clearRadius - 4);
      const w = toWorld(Math.cos(a) * r, Math.sin(a) * r);
      feat('ashPatch', w.x, w.z, 0.02, 0.8 + rand() * 1.6, rand() * Math.PI);
    }
  }

  // Bone spots (the bones beat stages here, per instance).
  const boneSpots: VillageInstance['boneSpots'] = [];
  {
    const rand = mulberry32(deriveSeed(worldSeed, `village-bones:${key}`));
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

  return {
    streetAxis: swap ? 'z' : 'x',
    plots,
    // The hearth house always exists (its slot is forced).
    hearthHouse: hearthHouse!,
    well: wellWorld,
    boneSpots,
    features,
    walls,
  };
}

/** The accepted instance for one cell, or null. */
/**
 * The instance's roofed interiors (rain-shelter read,
 * 2026-11-05): every STANDING plot shelters — houses
 * are squares (rotation-free at VILLAGE_SEGMENT_M
 * half-side); the store's long axis runs along the
 * street, so its halves swap with the street axis. A
 * charred plot's roof has fallen; collapsed/gone have
 * none — they contribute no rect.
 */
function villageRoofRects(
  plots: VillageInstancePlot[],
  streetAxis: 'x' | 'z',
): RoofRect[] {
  const rects: RoofRect[] = [];
  for (const p of plots) {
    if (p.state !== 'standing') continue;
    if (p.kind === 'store') {
      const hw = (streetAxis === 'z' ? STORE_WALL_D_M : STORE_WALL_W_M) / 2 - ROOF_RECT_INSET_M;
      const hd = (streetAxis === 'z' ? STORE_WALL_W_M : STORE_WALL_D_M) / 2 - ROOF_RECT_INSET_M;
      rects.push({ minX: p.x - hw, maxX: p.x + hw, minZ: p.z - hd, maxZ: p.z + hd });
    } else {
      const h = VILLAGE_SEGMENT_M - ROOF_RECT_INSET_M;
      rects.push({ minX: p.x - h, maxX: p.x + h, minZ: p.z - h, maxZ: p.z + h });
    }
  }
  return rects;
}

function villageInstanceAt(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): VillageInstance | null {
  const cacheKey = `${worldSeed}::${cx},${cz}`;
  if (instanceCache.has(cacheKey)) return instanceCache.get(cacheKey)!;
  let result: VillageInstance | null = null;
  const cand = villageCandidate(worldSeed, weightsAtPos, cx, cz);
  if (cand) {
    const { x, z } = cand.center;
    const R = cand.clearRadius;
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
        distToSegment(x, z, road.a, road.b) >= ROAD_RIBBON_HALF_WIDTH_M + R + SITE_SPACING_MARGIN_M &&
        distToSegment(x, z, siding.a, siding.b) >= SIDING_HALF_WIDTH_M + R + SITE_SPACING_MARGIN_M;
    }
    // The earlier families (villages resolve last and
    // yield to every seat already taken).
    if (legal) {
      const reach = CAVE_MOUTH_CLEAR_RADIUS_M + R + SITE_SPACING_MARGIN_M;
      const caves = caveInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach,
        maxX: x + reach,
        minZ: z - reach,
        maxZ: z + reach,
      });
      legal = caves.every((c) => Math.hypot(x - c.center.x, z - c.center.z) >= reach);
    }
    if (legal) {
      const reach = HOMESTEAD_CLEAR_RADIUS_M + R + SITE_SPACING_MARGIN_M;
      const homes = homesteadInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach,
        maxX: x + reach,
        minZ: z - reach,
        maxZ: z + reach,
      });
      legal = homes.every((h) => Math.hypot(x - h.center.x, z - h.center.z) >= reach);
    }
    if (legal) {
      const reach = FARMHOUSE_CLEAR_RADIUS_M + R + SITE_SPACING_MARGIN_M;
      const farms = farmhouseInstancesInRect(worldSeed, spawn, weightsAtPos, {
        minX: x - reach,
        maxX: x + reach,
        minZ: z - reach,
        maxZ: z + reach,
      });
      legal = farms.every((f) => Math.hypot(x - f.center.x, z - f.center.z) >= reach);
    }
    // Sibling precedence (the families' shape): the cell
    // that reads first by (row, column) keeps its seat;
    // the floor is radius-aware, since villages vary.
    if (legal) {
      outer: for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
        for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
          if (ncx === cx && ncz === cz) continue;
          const sib = villageCandidate(worldSeed, weightsAtPos, ncx, ncz);
          if (!sib) continue;
          const d = Math.hypot(x - sib.center.x, z - sib.center.z);
          if (d < R + sib.clearRadius + SITE_SPACING_MARGIN_M && (ncz < cz || (ncz === cz && ncx < cx))) {
            legal = false;
            break outer;
          }
        }
      }
    }
    if (legal) {
      const key = `village:${cx},${cz}`;
      const plan = buildVillagePlan(worldSeed, key, cand.center, cand.structureCount, R);
      // The carrier facts (minted here to keep the
      // derivation self-contained; the arc deal is the
      // one mint range, carriers.ts). Structural: the
      // hearth house is forced, so every instance mints.
      // THE DEAL (Adam, 2026-11-05): the mark is dealt by
      // the instance's own hash (homeDeal.ts — its stream
      // is a sibling of this mint stream, so the
      // arc roll below is the mint's two draws off
      // this same stream (Adam's mint, 2026-11-07).
      const crand = mulberry32(deriveSeed(worldSeed, `carrier:${key}`));
      const fragmentCarrier: FragmentCarrier = {
        fragmentId: `${key}:fragment`,
        mark: dealHomeMark(worldSeed, key),
        ...dealFragmentArc(crand),
      };
      result = {
        key,
        cellX: cx,
        cellZ: cz,
        center: cand.center,
        biome: cand.biome,
        structureCount: cand.structureCount,
        streetAxis: plan.streetAxis,
        plots: plan.plots,
        roofRects: villageRoofRects(plan.plots, plan.streetAxis),
        hearthHouse: plan.hearthHouse,
        well: plan.well,
        boneSpots: plan.boneSpots,
        fragmentCarrier,
        fragmentSpot: plan.hearthHouse.hearthSpot,
        features: plan.features,
        walls: plan.walls,
        clearRadius: R,
        bounds: {
          minX: x - R,
          maxX: x + R,
          minZ: z - R,
          maxZ: z + R,
        },
      };
    }
  }
  instanceCache.set(cacheKey, result);
  return result;
}

/**
 * Every registered village instance whose clearing
 * bounds intersect a world rect. Pure in (seed, rect).
 * The query expands by VILLAGE_QUERY_MARGIN_M before
 * enumerating cells, so an instance seated in a
 * neighbouring cell whose street reaches into the rect
 * is still found; results filter on true bounds.
 */
export function villageInstancesInRect(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  rect: { minX: number; maxX: number; minZ: number; maxZ: number },
): VillageInstance[] {
  const out: VillageInstance[] = [];
  const wide = {
    minX: rect.minX - VILLAGE_QUERY_MARGIN_M,
    maxX: rect.maxX + VILLAGE_QUERY_MARGIN_M,
    minZ: rect.minZ - VILLAGE_QUERY_MARGIN_M,
    maxZ: rect.maxZ + VILLAGE_QUERY_MARGIN_M,
  };
  for (const cell of distributionCellsOverlapping(wide.minX, wide.maxX, wide.minZ, wide.maxZ)) {
    const inst = villageInstanceAt(worldSeed, spawn, weightsAtPos, cell.cx, cell.cz);
    if (!inst) continue;
    const b = inst.bounds;
    if (b.maxX < rect.minX || b.minX > rect.maxX || b.maxZ < rect.minZ || b.minZ > rect.maxZ) continue;
    out.push(inst);
  }
  return out;
}

/** One registered instance by its key, or null. */
export function villageInstanceForKey(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  key: string,
): VillageInstance | null {
  const m = /^village:(-?\d+),(-?\d+)$/.exec(key);
  if (!m) return null;
  const inst = villageInstanceAt(worldSeed, spawn, weightsAtPos, Number(m[1]), Number(m[2]));
  return inst && inst.key === key ? inst : null;
}
