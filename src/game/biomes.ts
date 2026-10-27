/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Biome definitions and the DYNAMIC blending model for Silent Earth.
 *
 * There are NO tile types and NO zone identities here — that is deliberate
 * and is the opposite of BioForge's family-matrix model. A biome is a MIX
 * of objects + ground character. At any world position, continuous seeded
 * noise fields (wetness, elevation, density, mineral, creek) are sampled;
 * each biome has an affinity for a region of that field space; affinities
 * are normalized into weights. Blends are therefore continuous by
 * construction: two neighboring positions always have similar weights, so
 * chunk borders cannot seam and zones arrive blending in, never abruptly.
 *
 * The biome set below is DRAFT (2026-10-25, delegated to Marlowe by Adam;
 * names, membership, and blend widths await Adam's pin pass).
 *
 * MEADOW + FOREST (Adam, 2026-10-26): existence, farther-out placement,
 * and pretty character are his. Placement mechanism is lane-decided:
 * a 'distance' field axis (see below) — meadow/forest affinity is near
 * zero around spawn and rises with distance from it, so they read as
 * farther-out discoveries, not start neighbors. Their pretty character
 * is lane-decided scenery: meadow = open grass, flowers, light; forest
 * = tall trees, dappled light. New flora is SCENERY ONLY — no new
 * harvestable items; meadow/forest growth yields existing items (the
 * kinds they share with other biomes) or nothing.
 *
 * REGION (Adam, 2026-10-26, PINNED — "let's make it there"):
 * GREAT LAKES / UPPER MIDWEST — Michigan, Wisconsin,
 * northern Indiana/Ohio. This is the temperate wetland
 * setting the criterion below pointed at: peat bogs, marshes,
 * hardwood forest, creek bottoms, September-mild to
 * November-cold. The existing biome set already reads as
 * this region (Deep Bog = the peat bogs, the marsh overlay =
 * the marshes, Forest = the hardwood, Creek Bottom = the
 * creek bottoms), so pinning the region changes NO field
 * parameter. EXACT SPOT NOT NAMED (per the no-exact-map
 * rule): no town, county, or map label — location comes
 * later via clues/background details, not a named place.
 * RUINS ARE FUTURE CONTENT, not this round — no ruin build
 * rides on this note. MEASURED, NOT RETUNED (2026-10-26,
 * probe seed 12345, ±3000 m grid, step 64, 8836 samples):
 * marshWeight mean 0.236, >0.3 on 32.6% of the map, >0.1 on
 * 54.8%; wet biomes dominate 37.1% (mirewood 25.0% alone —
 * the single largest share — deepBog 6.5%, creekBottom
 * 5.6%); spawn itself is mirewood. If a future seed or field
 * retune breaks this regional reading, that is the number to
 * restore, not a new pocket to sprinkle.
 */

import { makeNoise2D } from 'fast-simplex-noise';
import { deriveSeed, mulberry32 } from './seed';
import type { BiomeId, BiomeWeights, ScatterKind } from '../types';

/** Per-biome object mix: scatter kind -> relative weight (normalized at use).
 * riverStone weights are the stone-availability tunable (Adam,
 * 2026-10-26: stones relatively easy to find — direction recorded
 * on stoneCluster in objects.ts, number TBD, no change made yet). */
export interface BiomeDef {
  id: BiomeId;
  name: string;
  /** Representative ground color (packed 0xRRGGBB) before wetness darkening. */
  groundColor: number;
  /** Relative scatter density (1.0 = baseline; tanglewood is denser, bog sparser). */
  density: number;
  /** Object mix. Kinds map to the item vocabulary in world_data.json where
   *  one exists (snapWood -> SNAP_WOOD, riverSilt -> RIVER_SLUDGE, etc.);
   *  vine/bush/log/bogPatch/standingWater/tree are pure scenery kinds. */
  mix: Partial<Record<ScatterKind, number>>;
  /** Preferred field-space position + blend width (sigma) per axis. Axes a
   *  biome does not care about are omitted (affinity factor 1). */
  anchor: Partial<Record<FieldAxis, { at: number; sigma: number }>>;
}

export type FieldAxis = 'wetness' | 'elevation' | 'density' | 'mineral' | 'creek' | 'distance';

export const BIOMES: BiomeDef[] = [
  {
    id: 'mirewood',
    name: 'Mirewood',
    groundColor: 0x5a5a38,
    density: 1.0,
    mix: {
      vine: 0.16, bush: 0.14, log: 0.08, bogPatch: 0.08, standingWater: 0.08,
      tree: 0.05, snapWood: 0.10, tenderVines: 0.12, peatMoss: 0.10,
      riverSilt: 0.04, riverStone: 0.03, bone: 0.01, downedOak: 0.01,
      stump: 0.01, bogGrowth: 0.03, edibleMushroom: 0.04, poisonMushroom: 0.04,
      flint: 0.05, pond: 0.02,
    },
    // The start: sloppy-wet hybrid woodland, halfway between dry and swamp.
    // A small affinity floor (applied in weightsAt) keeps Mirewood present
    // as the background matrix everything else blends out of.
    anchor: {
      wetness: { at: 0.62, sigma: 0.30 },
      elevation: { at: 0.45, sigma: 0.30 },
      density: { at: 0.60, sigma: 0.30 },
      creek: { at: 0.15, sigma: 0.35 },
    },
  },
  {
    id: 'deepBog',
    name: 'Deep Bog',
    groundColor: 0x2e2620,
    density: 0.45,
    mix: {
      bogPatch: 0.25, standingWater: 0.25, peatMoss: 0.15, snapWood: 0.05,
      tenderVines: 0.05, bush: 0.05, log: 0.05, riverSilt: 0.08, bone: 0.04,
      riverStone: 0.03, bogGrowth: 0.10, stump: 0.005, edibleMushroom: 0.06, poisonMushroom: 0.06,
      flint: 0.02, pond: 0.04,
    },
    // Outright swamp: the place Mirewood deepens into. Navigation difficulty
    // here is UNDECIDED — no slow/stuck mechanic is implemented.
    anchor: {
      wetness: { at: 0.95, sigma: 0.22 },
      elevation: { at: 0.25, sigma: 0.28 },
      density: { at: 0.30, sigma: 0.30 },
    },
  },
  {
    id: 'oldfieldRise',
    name: 'Oldfield Rise',
    groundColor: 0x7a7a4a,
    density: 0.70,
    mix: {
      bush: 0.20, tree: 0.18, snapWood: 0.15, tenderVines: 0.05, log: 0.05,
      riverStone: 0.10, bone: 0.05, peatMoss: 0.05, vine: 0.05, downedOak: 0.05,
      riverSilt: 0.02, saltCrystal: 0.02, bogPatch: 0.01, standingWater: 0.01,
      stump: 0.02, appleTree: 0.06, flint: 0.08,
    },
    // The pleasant neighbor: higher, drier, firm footing.
    anchor: {
      wetness: { at: 0.30, sigma: 0.25 },
      elevation: { at: 0.78, sigma: 0.25 },
      density: { at: 0.35, sigma: 0.30 },
    },
  },
  {
    id: 'creekBottom',
    name: 'Creek Bottom',
    groundColor: 0x6b5b43,
    density: 0.80,
    mix: {
      riverSilt: 0.25, standingWater: 0.20, riverStone: 0.15, peatMoss: 0.10,
      snapWood: 0.05, tenderVines: 0.05, bush: 0.05, log: 0.05, bone: 0.03,
      bogPatch: 0.05, vine: 0.02, bogGrowth: 0.02, edibleMushroom: 0.04, poisonMushroom: 0.04,
      flint: 0.10, pond: 0.03,
    },
    // Silt beds and shallow water along ridged creek lines.
    anchor: {
      creek: { at: 0.90, sigma: 0.25 },
      wetness: { at: 0.80, sigma: 0.25 },
      elevation: { at: 0.30, sigma: 0.30 },
    },
  },
  {
    id: 'tanglewood',
    name: 'Tanglewood',
    groundColor: 0x3d4a2a,
    density: 1.25,
    mix: {
      vine: 0.25, tenderVines: 0.20, bush: 0.20, log: 0.08, snapWood: 0.08,
      downedOak: 0.05, peatMoss: 0.05, tree: 0.05, riverStone: 0.02, bone: 0.02,
      stump: 0.01, bogGrowth: 0.02, edibleMushroom: 0.08, poisonMushroom: 0.08,
      flint: 0.03,
    },
    // Vine- and bush-choked dense growth: cordage country.
    anchor: {
      density: { at: 0.95, sigma: 0.22 },
      wetness: { at: 0.60, sigma: 0.30 },
    },
  },
  {
    id: 'saltFlat',
    name: 'Salt Flat',
    groundColor: 0xb8b0a0,
    density: 0.50,
    mix: {
      saltCrystal: 0.30, riverStone: 0.20, bone: 0.15, riverSilt: 0.10,
      bush: 0.05, snapWood: 0.05, log: 0.05, peatMoss: 0.03,
      standingWater: 0.02, vine: 0.02, tenderVines: 0.02, downedOak: 0.01,
      flint: 0.03,
    },
    // The odd dry one: mineral crust, salt crystals, bone.
    anchor: {
      mineral: { at: 0.92, sigma: 0.22 },
      wetness: { at: 0.15, sigma: 0.25 },
      elevation: { at: 0.50, sigma: 0.30 },
    },
  },
  {
    id: 'meadow',
    name: 'Meadow',
    groundColor: 0x7d9a52,
    density: 0.85,
    mix: {
      flower: 0.28, bush: 0.16, snapWood: 0.08, tree: 0.04, log: 0.04,
      tenderVines: 0.05, riverStone: 0.05, peatMoss: 0.03, vine: 0.03,
      bone: 0.01, stump: 0.01, appleTree: 0.05, flint: 0.05,
    },
    // Pretty and open: light grass, flowers, scattered brush — the
    // pleasant far-out clearing. Drier and lower than Oldfield Rise
    // (which stays the near-spawn pleasant neighbor), and gated by
    // distance so it is never a start neighbor (see distance axis).
    // 'flower' is scenery only; everything yield-bearing here is an
    // existing item shared with other biomes — except appleTree, the
    // first fruit tree (old orchard remnants, also in oldfieldRise).
    anchor: {
      wetness: { at: 0.35, sigma: 0.25 },
      elevation: { at: 0.55, sigma: 0.30 },
      density: { at: 0.30, sigma: 0.25 },
      distance: { at: 1.0, sigma: 0.25 },
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    groundColor: 0x44552e,
    density: 1.30,
    mix: {
      tallTree: 0.28, tree: 0.14, bush: 0.12, vine: 0.10, tenderVines: 0.08,
      log: 0.06, snapWood: 0.05, downedOak: 0.04, peatMoss: 0.04,
      flower: 0.03, riverStone: 0.02, bone: 0.01, stump: 0.01, bogGrowth: 0.01, edibleMushroom: 0.08, poisonMushroom: 0.08,
      flint: 0.03,
    },
    // Pretty and deep: tall trees, dappled light, a sparse flower floor.
    // Dense like Tanglewood, but mid-elevation and distance-gated, so
    // near-spawn dense growth stays Tanglewood and true forest is a
    // farther-out discovery. 'tallTree' is scenery only; yield-bearing
    // kinds here are existing items shared with other biomes.
    anchor: {
      density: { at: 0.90, sigma: 0.22 },
      wetness: { at: 0.55, sigma: 0.30 },
      elevation: { at: 0.50, sigma: 0.30 },
      distance: { at: 1.0, sigma: 0.22 },
    },
  },
];

export const BIOME_BY_ID: Record<BiomeId, BiomeDef> = Object.fromEntries(
  BIOMES.map((b) => [b.id, b]),
) as Record<BiomeId, BiomeDef>;

/**
 * MARSH GROUND CHARACTER (fill-in landing, 2026-10-25). Marsh is NOT a
 * biome id — adding it to the biome list is Adam's pin call and is
 * deliberately not done here. Marsh is a ground-character overlay computed
 * from the same seeded fields: reedy, grassy, mineral-soil wetland —
 * distinct from bog's peat (deepBog) and Mirewood's wooded wet. It peaks
 * where ground is wet but open (low vegetation density) and mid-elevation,
 * and it never overrides the biome weights: it only tints ground color,
 * spawns reed/marshGrass scatter, and selects the marsh ground texture.
 */
export const MARSH_GROUND_COLOR = 0x6a7048;

export function marshWeight(fields: Fields): number {
  const gauss = (v: number, at: number, sigma: number): number => {
    const d = (v - at) / sigma;
    return Math.exp(-0.5 * d * d);
  };
  return (
    gauss(fields.wetness, 0.78, 0.18) *
    gauss(fields.density, 0.35, 0.30) *
    gauss(fields.elevation, 0.45, 0.30)
  );
}

/** Sampled continuous fields at a world position. All in [0, 1]. */
export interface Fields {
  wetness: number;
  elevation: number;
  density: number;
  mineral: number;
  creek: number;
  /**
   * Distance axis (lane-decided, 2026-10-26): min(1, distance from world
   * origin / 1000 m). Spawn sits near the origin by construction
   * (findSpawn scans ±200 m), so at the scales involved this reads as
   * distance from spawn. Falloff with the meadow/forest anchors
   * (at 1.0): distance factor ≈0.006 (meadow) / 0.001 (forest) at 200 m,
   * ≈0.14 / 0.08 at 500 m, ≈0.73 / 0.66 at 800 m, 1.0 at 1000 m+ — first
   * patches around 500–800 m out, strong at a kilometre. Existing
   * biomes have no distance anchor (factor 1), so their near-spawn
   * affinities are unchanged; far out, meadow/forest only win where
   * their other field anchors also match, so bog/salt/etc. still hold
   * their own far-out ground. Deterministic from (x, z) — no randomness.
   */
  distance: number;
}

const norm = (n: number): number => (n + 1) / 2;

/** One seeded noise field per axis; each stream derives from seed + axis. */
export function createFields(seed: string): (x: number, z: number) => Fields {
  const wetnessN = makeNoise2D(mulberry32(deriveSeed(seed, 'wetness')));
  const elevationN = makeNoise2D(mulberry32(deriveSeed(seed, 'elevation')));
  const densityN = makeNoise2D(mulberry32(deriveSeed(seed, 'density')));
  const mineralN = makeNoise2D(mulberry32(deriveSeed(seed, 'mineral')));
  const creekN = makeNoise2D(mulberry32(deriveSeed(seed, 'creek')));
  return (x: number, z: number) => {
    // Broad features: ~150–300 m wavelengths, so blends are wide and gentle.
    const wetness = norm(wetnessN(x * 0.004, z * 0.004));
    const elevation = norm(elevationN(x * 0.003, z * 0.003));
    const density = norm(densityN(x * 0.005, z * 0.005));
    const mineral = norm(mineralN(x * 0.006, z * 0.006));
    // Ridged creek field: near 1 only along narrow winding lines.
    const creek = Math.max(0, 1 - Math.abs(creekN(x * 0.008, z * 0.008)) * 2.5);
    // Distance from origin, normalized to 1000 m (see Fields.distance).
    const distance = Math.min(1, Math.hypot(x, z) / 1000);
    return { wetness, elevation, density, mineral, creek, distance };
  };
}

/** Normalized per-biome weights at a world position. Sums to 1. */
export function weightsAt(fields: Fields): BiomeWeights {
  const raw = new Map<BiomeId, number>();
  let total = 0;
  for (const biome of BIOMES) {
    let affinity = 1;
    for (const [axis, pref] of Object.entries(biome.anchor) as [
      FieldAxis,
      { at: number; sigma: number },
    ][]) {
      const d = (fields[axis] - pref.at) / pref.sigma;
      affinity *= Math.exp(-0.5 * d * d);
    }
    // Mirewood floor: the mire is the background matrix, never fully absent.
    if (biome.id === 'mirewood') affinity = Math.max(affinity, 0.08);
    raw.set(biome.id, affinity);
    total += affinity;
  }
  const weights = {} as Record<BiomeId, number>;
  let dominant: BiomeId = 'mirewood';
  let best = -1;
  for (const [id, value] of raw) {
    const w = value / total;
    weights[id] = w;
    if (w > best) {
      best = w;
      dominant = id;
    }
  }
  return { weights, dominant };
}

/** Blended ground color at a position: biome colors mixed by weights,
 *  darkened slightly by wetness so wet ground reads wet, then tinted
 *  toward marsh ground color by the marsh overlay weight (marsh is a
 *  ground character, not a biome, so it tints rather than re-weighting). */
export function groundColorAt(fields: Fields, weights: BiomeWeights): number {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const biome of BIOMES) {
    const w = weights.weights[biome.id];
    if (w <= 0) continue;
    r += w * ((biome.groundColor >> 16) & 0xff);
    g += w * ((biome.groundColor >> 8) & 0xff);
    b += w * (biome.groundColor & 0xff);
  }
  const mw = marshWeight(fields) * 0.7;
  if (mw > 0) {
    r = r * (1 - mw) + mw * ((MARSH_GROUND_COLOR >> 16) & 0xff);
    g = g * (1 - mw) + mw * ((MARSH_GROUND_COLOR >> 8) & 0xff);
    b = b * (1 - mw) + mw * (MARSH_GROUND_COLOR & 0xff);
  }
  // Wetness darkens: wet mud is darker than dry ground.
  const darken = 1 - fields.wetness * 0.18;
  const ri = Math.max(0, Math.min(255, Math.round(r * darken)));
  const gi = Math.max(0, Math.min(255, Math.round(g * darken)));
  const bi = Math.max(0, Math.min(255, Math.round(b * darken)));
  return (ri << 16) | (gi << 8) | bi;
}
