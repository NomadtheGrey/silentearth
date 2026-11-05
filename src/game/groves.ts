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
 * THE FORM (DEV's shape, 2026-11-05): a lesser grove is
 * The Grove's form WITHOUT its signatures — a clearing,
 * a ring of standing stones, grove oaks in the band,
 * and ONE carved stone carrying a CIRCLE fragment. NO
 * maze (the maze is The Grove's alone), no hoard mound,
 * no heart tree. The ring and oak derivations mirror
 * sites.ts' own (same numbers, same stream shapes)
 * under the instance's own label, so a lesser grove
 * reads as the same kind of place at a glance. The
 * carved stone stands inside the ring at the clearing's
 * heart, where the maze's heart would be (lane-decided
 * siting, DRAFT).
 *
 * NO PROTECTION (priced with the claim; DEV leans the
 * same): The Grove's tree protection is its signature,
 * like the maze — lesser groves' oaks are ordinary
 * country trees, fellable and harvestable. harvest.ts'
 * refusal stays scoped to the singular's footprint and
 * never learns these instances.
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
 * mirrored here as that set is private there); clearing
 * 28 m and ring 22 m at the GroveSite numbers; 9 ring
 * stones; 7 band oaks at 23.5–26 m (sites.ts' private
 * band, mirrored); the carved stone at ring/2.
 */

import type { BiomeId, BiomeWeights, ScatterKind, ScatterObject } from '../types';
import type { SiteWallBox } from './sites';
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
  CAVE_MOUTH_CLEAR_RADIUS_M,
  GROVE_CLEAR_RADIUS_M,
  GROVE_OAK_COUNT,
  GROVE_RING_RADIUS_M,
  GROVE_STONE_COUNT,
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
/** Oak band (sites.ts' private GROVE_OAK_MIN_R/MAX_R, mirrored). */
const LESSER_OAK_MIN_R = 23.5;
const LESSER_OAK_MAX_R = 26;
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
  features: ScatterObject[];
  /** Always empty — a lesser grove has no walls (no maze). */
  walls: SiteWallBox[];
  clearRadius: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const instanceCache = new Map<string, LesserGroveInstance | null>();

/** A cell's RAW candidate — fixed draw order: presence,
 *  seat jitter x, seat jitter z, the taste test. */
function groveCandidate(
  worldSeed: string,
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  cx: number,
  cz: number,
): { center: { x: number; z: number }; biome: BiomeId } | null {
  const rand = distributionCellStream(worldSeed, 'distribution:grove', cx, cz);
  if (rand() >= GROVE_CELL_PRESENCE) return null;
  const x = (cx + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const z = (cz + 0.2 + 0.6 * rand()) * DISTRIBUTION_CELL_M;
  const w = weightsAtPos(x, z);
  if (!GROVE_TASTE.has(w.dominant)) return null;
  return { center: { x, z }, biome: w.dominant };
}

/** The instance's own layout: ring, oaks, carved stone —
 *  sites.ts' grove derivations under this grove's label. */
function buildLesserGroveFeatures(
  worldSeed: string,
  key: string,
  center: { x: number; z: number },
): { features: ScatterObject[]; carvedSpot: { x: number; z: number } } {
  const features: ScatterObject[] = [];
  const feat = (kind: ScatterKind, x: number, z: number, scale: number, rotY: number): void => {
    features.push({ kind, x, z, y: 0, scale, rotY });
  };
  // The ring (sites.ts' stones block, verbatim shape).
  {
    const rand = mulberry32(deriveSeed(worldSeed, `${key}:stones`));
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
  // The band oaks (sites.ts' oaks block, verbatim shape).
  {
    const rand = mulberry32(deriveSeed(worldSeed, `${key}:oaks`));
    for (let i = 0; i < GROVE_OAK_COUNT; i++) {
      const a = (i / GROVE_OAK_COUNT) * Math.PI * 2 + rand() * 0.5;
      const r = LESSER_OAK_MIN_R + rand() * (LESSER_OAK_MAX_R - LESSER_OAK_MIN_R);
      feat(
        'groveOak',
        center.x + Math.cos(a) * r,
        center.z + Math.sin(a) * r,
        1.15 + rand() * 0.5,
        rand() * Math.PI * 2,
      );
    }
  }
  // The carved stone at the clearing's heart, facing out
  // along its own offset (The Grove's carved stone faces
  // its approach the same way).
  const rand = mulberry32(deriveSeed(worldSeed, `${key}:carved`));
  const a = rand() * Math.PI * 2;
  const r = GROVE_RING_RADIUS_M / 2;
  const carvedSpot = { x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r };
  feat('carvedStone', carvedSpot.x, carvedSpot.z, 1, Math.atan2(Math.cos(a), Math.sin(a)));
  return { features, carvedSpot };
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
    const R = GROVE_CLEAR_RADIUS_M;
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
          if (d < R * 2 + SITE_SPACING_MARGIN_M && (ncz < cz || (ncz === cz && ncx < cx))) {
            legal = false;
            break outer;
          }
        }
      }
    }
    if (legal) {
      const key = `grove:lesser:${cx},${cz}`;
      const { features, carvedSpot } = buildLesserGroveFeatures(worldSeed, key, cand.center);
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
        features,
        walls: [],
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
