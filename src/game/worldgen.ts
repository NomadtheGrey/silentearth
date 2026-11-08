/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic chunk generation for the seeded biome world.
 *
 * Chunks are pure functions of (seed, chunkX, chunkZ): the same seed
 * regenerates the same chunk, byte for byte in scatter order, so streaming
 * can discard and rebuild chunks freely without changing the world. Chunk
 * borders cannot seam: biome weights and ground colors are continuous
 * functions of world position, sampled per vertex / per scatter point, so
 * two adjacent chunks always agree at their shared edge.
 *
 * Ground is flat in landing 1 (y = 0); the elevation field drives biome
 * weights only. Terrain height is a later decision, not a placeholder.
 */

import { BIOMES, createFields, weightsAt, legacyWeightsAt, groundColorAt, marshWeight } from './biomes';
import type { Fields } from './biomes';
import { mulberry32, deriveSeed, hashSeed } from './seed';
import { barnSite, caveMouthSite, chapelSite, distToSegment, drownedMillSite, farmhouseSite, generalStoreSite, groveSite, railSidingSite, schoolhouseSite, siloSite, sunkenRoadSite, villageSite, waterTowerSite, type GroveSite, type SiteFootprint } from './sites';
import { CHUNK_SIZE, BASE_SCATTER_PER_CHUNK, GROUND_SEGMENTS } from '../constants';
import { caveInstancesInRect } from './caves';
import { homesteadInstancesInRect } from './homesteads';
import { huntingCabinInstancesInRect } from './huntingCabins';
import { farmhouseInstancesInRect } from './farmhouses';
import { villageInstancesInRect } from './villages';
import { groveInstancesInRect } from './groves';
import type { BiomeWeights, ChunkData, ScatterKind, ScatterObject } from '../types';

export interface WorldGen {
  seed: string;
  /** Dimension key when this generator is a non-surface
   *  dimension (dimensions, Adam 2026-10-30); undefined
   *  for the overworld. The renderer branches on it
   *  (sites, river, sky/fog gates). */
  dimensionKey?: string;
  fieldsAt: (x: number, z: number) => Fields;
  weightsAt: (x: number, z: number) => ReturnType<typeof weightsAt>;
  groundColorAt: (x: number, z: number) => number;
  generateChunk: (cx: number, cz: number) => ChunkData;
  /** Deterministic spawn: the most Mirewood-dominant point near origin. */
  findSpawn: () => { x: number; z: number };
}

const SCATTER_KINDS: ScatterKind[] = [
  'bush', 'log', 'bogPatch', 'standingWater', 'tree',
  'snapWood', 'tenderVines', 'peatMoss', 'riverSilt', 'riverStone',
  'bone', 'pineTree',
  // Fill-in landing (2026-10-25): stump, reed, marshGrass, bogGrowth.
  'stump', 'reed', 'marshGrass', 'bogGrowth',
  // Meadow/forest landing (2026-10-26): flower, tallTree (scenery only).
  'flower', 'tallTree',
  // Mushroom landing (2026-10-26): edible + poison lookalikes.
  'edibleMushroom', 'poisonMushroom',
  // Acorn landing (2026-10-26): ground acorns spawn by adjacency
  // to downed oaks, not by mix — registered here like reed and
  // marshGrass (overlay/adjacency kinds), so a future mix weight
  // would just work.
  'groundAcorns',
  // Apple landing (2026-10-27): first fruit tree, old orchard
  // remnants in oldfieldRise + meadow (mix-driven, unlike acorns).
  'appleTree',
  // Flint + pond landing (2026-10-27): flint is a mix-driven
  // scatter stone (the "wherever" spread); pond is a big
  // standing-water disc in wet biomes. Appended last, like
  // appleTree — the pick loop walks this order, so existing
  // kinds keep their relative order (the added mix weights still
  // re-roll kind picks per slot, as the apple landing did).
  'flint',
  'pond',
  // Beehive landing (2026-10-28): wild hives in flowered
  // biomes only, mix-driven. Appended last, like flint/pond
  // — existing kinds keep their relative order.
  'beehive',
  // Flowers landing (2026-10-28): 13 new flower kinds in the
  // four flowered biomes only, mix-driven. Appended last, like
  // beehive — existing kinds keep their relative order (the
  // added mix weights still re-roll kind picks per slot, as the
  // apple landing noted). EXCEPTION (places build, 2026-11-03):
  // 'ladySlipper' keeps its slot here (kind order is load-
  // bearing) but left the mixes — grove patches plant it.
  'yarrow', 'coneflower', 'clover', 'dandelion', 'milkweed',
  'poppy', 'sunflower', 'aster', 'trillium', 'violet',
  'ladySlipper', 'iris', 'waterLily',
];

// === Clustering pass (Adam, 2026-10-30) ======================================
//
// Adam's landscape grammar: "some spread out trees, ya, but
// also smaller groves, larger forests, etc." Until now trees
// were pure mix picks — uniform within a chunk, no grove or
// stand formation anywhere. This pass is a POST-PASS over the
// slot loop's output, on its own derived streams: every
// non-tree object stays byte-identical, and only standing-tree
// objects ('tree', and scenery 'tallTree' for the thinning
// half) are filtered and added. Downstream passes (acorns,
// hives, oak conversion, sites) read the final tree set, so
// they follow the clustered world without knowing it exists.

// Grove centres derive from a coarse world grid, independent
// of chunks: cell size in meters (DRAFT).
export const CLUSTER_CELL_M = 128;
// Woodland weight (forest + tanglewood + mirewood) at the
// centre at or above which a cell runs the full spectrum.
export const CLUSTER_WOODLAND_MIN = 0.35;
// Presence rolls per cell (DRAFT; full-spectrum presence
// raised in the 2026-10-30 tuning pass — woodland cells
// reliably grow their grove).
export const CLUSTER_PRESENCE_FULL = 0.8;
export const CLUSTER_PRESENCE_SMALL = 0.3;
// Pine stands (Adam, 2026-11-03: 'For scrub, scattered is
// fine. I see no reason we can't have pine forests though
// sometimes'): a scrub-dominant cell rolls this presence
// for a stand that plants PINES. Purely additive — lone
// pines stay unculled, the scrub's scatter stands as it
// was; the tier's draws run only on cells that returned
// null before it existed, so every standing derivation
// is byte-identical. Stands plant UNNAMED (Adam deferred
// naming the same day — 'maybe a Mark of Naming', a
// parked seed, not a build). Presence PINNED by Adam the
// same day ('Then we can do one third'), after the first
// build's census corrected the rate's yield: at one
// third, measured on the true grid, the default world
// stands 30 pine stands per ±2048 m (was 24 at the
// draft quarter) and 'Blah' stands 49 (was 33).
export const CLUSTER_PRESENCE_PINE = 1 / 3;
// Fraction of lone trees (outside every grove) culled
// (DRAFT; raised hard in the 2026-10-30 tuning pass, on
// Adam's verdict that the clustered woods read as
// scattered trees: the in-between goes genuinely sparse,
// and a lone tree becomes a landmark again).
export const CLUSTER_THIN_CULL = 0.85;
// Scenery tall trees (DRAFT; the same tuning): they plant
// no groves of their own, so their cull stays the gentler
// of the two — but the field quiets for them too, or the
// contrast the tuning exists for never arrives.
export const CLUSTER_TALL_THIN_CULL = 0.6;

// === Lady slipper places (Adam, 2026-11-03: 'That flower
// isn't an ingredient yet, we might find one later. Let's
// find good places to grow those in game.') =================
// The pink lady slipper is PLACE-BOUND, not mix-scattered:
// the real flower keeps to acidic woods (pine/oak company)
// on moist but well-drained ground, in small colonies. In
// the game's own terms the company is the clustering
// pass's woodland stands, and the drainage is a field read
// at the grove's centre — wetness in the band below, marsh
// under the mud line. The forest mix entry retired in the
// same landing: the orchid stops sprinkling the open
// forest and becomes somewhere she can be brought to.
// All numbers DRAFT for Adam's pin pass.
/** A qualifying grove rolls this chance of carrying a patch. */
export const LADY_SLIPPER_PRESENCE = 0.6;
/** The drained band: wetness at the grove's centre, inclusive. */
export const LADY_SLIPPER_WET_MIN = 0.3;
export const LADY_SLIPPER_WET_MAX = 0.62;
/** Standing-water country is out: marsh weight stays under this. */
export const LADY_SLIPPER_MARSH_MAX = 0.5;
/** Stems per patch in a clustering grove: MIN + roll of SPAN (3–9). */
export const LADY_SLIPPER_STEMS_MIN = 3;
export const LADY_SLIPPER_STEMS_SPAN = 7;
/** A patch's clump radius (m): stems scatter within it. */
export const LADY_SLIPPER_PATCH_RADIUS_M = 2.5;
/** The singular Grove's patch: stems MIN + roll of SPAN (7–12),
 *  planted in the annulus from its clearing's edge outward by
 *  BAND (m) — in the oak shade around the maze, off its heart.
 *  The Grove always carries its patch (no presence roll): the
 *  raven's destination rewards the arrival. */
export const LADY_SLIPPER_GROVE_STEMS_MIN = 7;
export const LADY_SLIPPER_GROVE_STEMS_SPAN = 6;
export const LADY_SLIPPER_GROVE_BAND_M = 14;

export interface ClusterGrove {
  /** World position of the grove centre. */
  x: number;
  z: number;
  radius: number;
  /** Standing trees the grove plants (before chunk containment). */
  count: number;
  sizeClass: 'small' | 'large' | 'huge';
  /** What the stand plants: hardwoods, or pines for a
   *  pine stand (the scrub tier). Consumers that read
   *  groves — the thinning consult, the lady slipper's
   *  company gate — key on this flavour. */
  plantKind: 'tree' | 'pineTree';
  /** The grid cell this grove derives from (its stream key). */
  cellX: number;
  cellZ: number;
}

/**
 * The grove (if any) deriving from grid cell (gx, gz) — a pure
 * function of the seed, the biome weights, and the registered
 * sites. The biome mask (Adam's tentative shape): no groves
 * where deepBog or fen dominates (the salt flat stood in
 * this line until it retired, 2026-11-02 — open wet and
 * treeless ground grows no stands); the full spectrum where
 * woodland carries; small groves only in meadow / oldfieldRise
 * country (hedgerow character); pine stands sometimes in
 * scrub country (Adam, 2026-11-03). DEV's condition: a centre
 * whose radius would overlap a site's clear footprint is
 * skipped outright — a stand beheaded by a clearing would read
 * as a bug, not a grove.
 */
export function groveForCell(
  seed: string,
  gx: number,
  gz: number,
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  sites: readonly SiteFootprint[],
): ClusterGrove | null {
  const rand = mulberry32(deriveSeed(seed, `grove-cell:${gx},${gz}`));
  const jitter = CLUSTER_CELL_M / 4;
  const x = (gx + 0.5) * CLUSTER_CELL_M + (rand() * 2 - 1) * jitter;
  const z = (gz + 0.5) * CLUSTER_CELL_M + (rand() * 2 - 1) * jitter;
  const w = weightsAtPos(x, z);
  if (w.dominant === 'deepBog' || w.dominant === 'fen') return null;
  const woodland =
    (w.weights.forest ?? 0) + (w.weights.tanglewood ?? 0) + (w.weights.mirewood ?? 0);
  let tier: 'full' | 'small' | 'pine' | null = null;
  if (woodland >= CLUSTER_WOODLAND_MIN) tier = 'full';
  else if (w.dominant === 'meadow' || w.dominant === 'oldfieldRise') tier = 'small';
  else if (w.dominant === 'scrub') tier = 'pine';
  if (tier === null) return null;
  const presence =
    tier === 'full'
      ? CLUSTER_PRESENCE_FULL
      : tier === 'small'
        ? CLUSTER_PRESENCE_SMALL
        : CLUSTER_PRESENCE_PINE;
  if (rand() >= presence) {
    return null;
  }
  let sizeClass: ClusterGrove['sizeClass'];
  let radius: number;
  let count: number;
  if (tier === 'pine') {
    // Pine stands: the small/large classes only, counts
    // in the claim's band (12–40) — no huge class; a
    // pine forest is a sometimes thing, not a sea. The
    // site-overlap rejection below is shared, unchanged.
    if (rand() < 0.7) {
      sizeClass = 'small';
      radius = 8 + rand() * 4;
      count = 12 + Math.floor(rand() * 9);
    } else {
      sizeClass = 'large';
      radius = 18 + rand() * 10;
      count = 24 + Math.floor(rand() * 17);
    }
  }
  if (tier !== 'pine') {
    const roll = tier === 'small' ? 0 : rand();
    if (tier === 'small' || roll < 0.55) {
      sizeClass = 'small';
      radius = 8 + rand() * 4;
      count = 10 + Math.floor(rand() * 7);
    } else if (roll < 0.9) {
      sizeClass = 'large';
      radius = 18 + rand() * 10;
      count = 34 + Math.floor(rand() * 27);
    } else {
      // Huge forests: Adam's "maybe" — present in v1, rare.
      // Sizes shifted up a class in the 2026-10-30 tuning
      // pass (bigger stands, counts to match).
      sizeClass = 'huge';
      radius = 40 + rand() * 20;
      count = 90 + Math.floor(rand() * 51);
    }
  }
  for (const site of sites) {
    if (site.ribbon) {
      if (distToSegment(x, z, site.ribbon.a, site.ribbon.b) < radius + site.ribbon.halfWidth) {
        return null;
      }
    } else if (Math.hypot(x - site.center.x, z - site.center.z) < radius + site.clearRadius) {
      return null;
    }
  }
  return {
    x,
    z,
    radius,
    count,
    sizeClass,
    plantKind: tier === 'pine' ? 'pineTree' : 'tree',
    cellX: gx,
    cellZ: gz,
  };
}

/**
 * Apply the clustering pass to one chunk's freshly rolled
 * scatter: thin the lone trees, then plant each nearby grove's
 * trees that land inside this chunk. Grove candidate positions
 * derive per grove from its own stream, drawn unconditionally
 * in a fixed order, so every chunk that consults a grove
 * reproduces the same candidates and takes only its own — no
 * duplicates, no misses at borders.
 */
function applyClustering(
  objects: ScatterObject[],
  seed: string,
  cx: number,
  cz: number,
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  fieldsAt: (x: number, z: number) => Fields,
  sites: readonly SiteFootprint[],
): void {
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  // This chunk's cell + its neighbours: a grove's farthest
  // reach (jitter 32 + radius 60 = 92 m) never crosses more
  // than one cell border (a centre two cells out sits at
  // least 96 m past the shared edge), so the 3x3 is
  // exhaustive.
  const cellX = Math.floor(originX / CLUSTER_CELL_M);
  const cellZ = Math.floor(originZ / CLUSTER_CELL_M);
  const groves: ClusterGrove[] = [];
  for (let gx = cellX - 1; gx <= cellX + 1; gx++) {
    for (let gz = cellZ - 1; gz <= cellZ + 1; gz++) {
      const g = groveForCell(seed, gx, gz, weightsAtPos, sites);
      if (g) groves.push(g);
    }
  }
  // Thinning: lone standing trees outside every grove are
  // culled at CLUSTER_THIN_CULL, rolled per position (seeded),
  // so the verdict is the tree's, not the chunk's.
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.kind !== 'tree' && o.kind !== 'tallTree') continue;
    if (groves.some((g) => Math.hypot(o.x - g.x, o.z - g.z) <= g.radius)) continue;
    const roll = mulberry32(hashSeed(`${seed}::thin:${o.x.toFixed(2)},${o.z.toFixed(2)}`))();
    const cull = o.kind === 'tallTree' ? CLUSTER_TALL_THIN_CULL : CLUSTER_THIN_CULL;
    if (roll < cull) objects.splice(i, 1);
  }
  // Planting: each grove's candidate trees, centre-weighted
  // (the pow curve crowds the middle and softens the edge;
  // the exponent steepened in the 2026-10-30 tuning pass —
  // a HIGHER exponent concentrates the core: at 0.85 about
  // 44% of a grove's trees stand within its half-radius,
  // against 25% for a uniform disc).
  for (const g of groves) {
    const rand = mulberry32(deriveSeed(seed, `grove-trees:${g.cellX},${g.cellZ}`));
    for (let i = 0; i < g.count; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = g.radius * Math.pow(rand(), 0.85);
      const scale = 0.7 + rand() * 0.7;
      const rotY = rand() * Math.PI * 2;
      const x = g.x + Math.cos(angle) * dist;
      const z = g.z + Math.sin(angle) * dist;
      if (x < originX || x >= originX + CHUNK_SIZE || z < originZ || z >= originZ + CHUNK_SIZE) {
        continue;
      }
      objects.push({ kind: g.plantKind, x, z, y: 0, scale, rotY });
    }
  }
  // Lady slipper patches (the places build, 2026-11-03):
  // a grove that reads as the flower's ground — woodland
  // company at the full-tier measure, moist but drained
  // at its centre — rolls for a patch on its own stream.
  // The gates are pure reads of the grove's centre, the
  // same in every chunk that consults the grove, and the
  // stream's draws run in a fixed order per grove, so
  // patches agree at chunk borders like the trees do.
  // (Pine company joins via the pine stands, 2026-11-03:
  // a stand's flavour is its company — the same drained
  // band below gates both companies, one law.)
  for (const g of groves) {
    const w = weightsAtPos(g.x, g.z);
    const woodland =
      (w.weights.forest ?? 0) + (w.weights.tanglewood ?? 0) + (w.weights.mirewood ?? 0);
    if (woodland < CLUSTER_WOODLAND_MIN && g.plantKind !== 'pineTree') continue;
    const f = fieldsAt(g.x, g.z);
    if (f.wetness < LADY_SLIPPER_WET_MIN || f.wetness > LADY_SLIPPER_WET_MAX) continue;
    if (marshWeight(f) >= LADY_SLIPPER_MARSH_MAX) continue;
    const rand = mulberry32(deriveSeed(seed, `lady-slipper:${g.cellX},${g.cellZ}`));
    if (rand() >= LADY_SLIPPER_PRESENCE) continue;
    const angle = rand() * Math.PI * 2;
    const dist = g.radius * 0.8 * Math.pow(rand(), 0.85);
    const px = g.x + Math.cos(angle) * dist;
    const pz = g.z + Math.sin(angle) * dist;
    const stems = LADY_SLIPPER_STEMS_MIN + Math.floor(rand() * LADY_SLIPPER_STEMS_SPAN);
    for (let i = 0; i < stems; i++) {
      const sa = rand() * Math.PI * 2;
      const sd = LADY_SLIPPER_PATCH_RADIUS_M * Math.sqrt(rand());
      const scale = 0.7 + rand() * 0.7;
      const rotY = rand() * Math.PI * 2;
      const x = px + Math.cos(sa) * sd;
      const z = pz + Math.sin(sa) * sd;
      if (x < originX || x >= originX + CHUNK_SIZE || z < originZ || z >= originZ + CHUNK_SIZE) {
        continue;
      }
      objects.push({ kind: 'ladySlipper', x, z, y: 0, scale, rotY });
    }
  }
}

/**
 * The singular Grove's lady slipper patch (the places
 * build, 2026-11-03): always planted (no presence roll),
 * in the annulus around its clearing — from the clearing's
 * edge outward by LADY_SLIPPER_GROVE_BAND_M — in the oak
 * shade around the maze, off its heart. Its own stream,
 * drawn in a fixed order, takes only this chunk's stems.
 * Runs BEFORE the site pass, so the stems stand under the
 * same suppression law as any scatter (the annulus keeps
 * them clear of the Grove's own clearing by construction).
 */
function applyGroveLadySlipper(
  objects: ScatterObject[],
  seed: string,
  cx: number,
  cz: number,
  grove: GroveSite,
): void {
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  const inner = grove.clearRadius + 2;
  const outer = grove.clearRadius + LADY_SLIPPER_GROVE_BAND_M;
  // Cheap rejection: the chunk's nearest point to the
  // centre beyond the annulus, or its farthest inside it.
  const nearX = Math.max(originX, Math.min(grove.center.x, originX + CHUNK_SIZE));
  const nearZ = Math.max(originZ, Math.min(grove.center.z, originZ + CHUNK_SIZE));
  if (Math.hypot(grove.center.x - nearX, grove.center.z - nearZ) > outer) return;
  const rand = mulberry32(deriveSeed(seed, 'lady-slipper:grove'));
  const stems = LADY_SLIPPER_GROVE_STEMS_MIN + Math.floor(rand() * LADY_SLIPPER_GROVE_STEMS_SPAN);
  for (let i = 0; i < stems; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = inner + rand() * (outer - inner);
    const scale = 0.7 + rand() * 0.7;
    const rotY = rand() * Math.PI * 2;
    const x = grove.center.x + Math.cos(angle) * dist;
    const z = grove.center.z + Math.sin(angle) * dist;
    if (x < originX || x >= originX + CHUNK_SIZE || z < originZ || z >= originZ + CHUNK_SIZE) {
      continue;
    }
    objects.push({ kind: 'ladySlipper', x, z, y: 0, scale, rotY });
  }
}

export function createWorldGen(seed: string): WorldGen {
  const fieldsAt = createFields(seed);

  const weightsAtPos = (x: number, z: number) => weightsAt(fieldsAt(x, z));
  const groundColorAtPos = (x: number, z: number) =>
    groundColorAt(fieldsAt(x, z), weightsAtPos(x, z));

  // The registered sites, derived once per generator (both the
  // clustering pass and the site pass consult them; findSpawn
  // is a full scan, so it runs once here, not once per chunk).
  let sitesCache: SiteFootprint[] | null = null;
  // The distributed cave instances overlapping a world
  // rect (the pluralization, 2026-10-30): recurring places
  // join the singular sites in the passes that consult
  // places — grove overlap in clustering, suppression +
  // feature emission in the site pass.
  let spawnMemo: { x: number; z: number } | null = null;
  const spawnOnce = (): { x: number; z: number } => (spawnMemo ??= findSpawn());
  // The singular Grove, derived once (groveSite memoizes
  // by seed as well) — the lady slipper patch pass reads
  // its centre and clearing.
  let groveMemo: GroveSite | null = null;
  const groveOnce = (): GroveSite =>
    (groveMemo ??= groveSite(seed, spawnOnce(), (x, z) => weightsAtPos(x, z).dominant));
  const getInstancesNear = (rect: { minX: number; maxX: number; minZ: number; maxZ: number }): SiteFootprint[] => [
    ...caveInstancesInRect(seed, spawnOnce(), weightsAtPos, rect),
    ...homesteadInstancesInRect(seed, spawnOnce(), weightsAtPos, rect),
    ...huntingCabinInstancesInRect(seed, spawnOnce(), weightsAtPos, rect),
    ...farmhouseInstancesInRect(seed, spawnOnce(), weightsAtPos, rect),
    ...villageInstancesInRect(seed, spawnOnce(), weightsAtPos, rect),
    ...groveInstancesInRect(seed, spawnOnce(), weightsAtPos, rect),
  ];

  const getSites = (): SiteFootprint[] => {
    if (!sitesCache) {
      sitesCache = [
        groveSite(seed, findSpawn(), (x, z) => weightsAtPos(x, z).dominant),
        schoolhouseSite(seed, findSpawn(), weightsAtPos),
        villageSite(seed, findSpawn(), weightsAtPos),
        farmhouseSite(seed, findSpawn(), weightsAtPos),
        chapelSite(seed, findSpawn(), weightsAtPos),
        caveMouthSite(seed, findSpawn(), weightsAtPos),
        generalStoreSite(seed, findSpawn(), weightsAtPos),
        drownedMillSite(seed, findSpawn(), weightsAtPos),
        sunkenRoadSite(seed, findSpawn(), weightsAtPos).footprint,
        railSidingSite(seed, findSpawn(), weightsAtPos).footprint,
        barnSite(seed, findSpawn(), weightsAtPos),
        siloSite(seed, findSpawn(), weightsAtPos),
        waterTowerSite(seed, findSpawn(), weightsAtPos),
      ];
    }
    return sitesCache;
  };

  function generateChunk(cx: number, cz: number): ChunkData {
    // One PRNG stream per chunk, derived from seed + chunk coords. Scatter
    // order is fixed, so the chunk serializes identically every time.
    const rand = mulberry32(deriveSeed(seed, `chunk:${cx},${cz}`));
    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;
    const objects: ScatterObject[] = [];

    for (let i = 0; i < BASE_SCATTER_PER_CHUNK; i++) {
      const x = originX + rand() * CHUNK_SIZE;
      const z = originZ + rand() * CHUNK_SIZE;
      const fields = fieldsAt(x, z);
      const weights = weightsAt(fields);
      // Local density thins or thickens scatter by biome mix.
      let density = 0;
      for (const biome of BIOMES) {
        density += weights.weights[biome.id] * biome.density;
      }
      if (rand() > Math.min(1, density)) continue;
      // Marsh overlay (fill-in landing): marsh is ground character, not a
      // biome, so it does not enter the biome mixes above. Where marsh
      // character is strong, a share of scatter becomes reeds (the marsh
      // harvest) or marsh grass (ground cover) instead of the blended mix.
      // Still fully seeded: the decision consumes the chunk's rand stream.
      const mw = marshWeight(fields);
      if (mw > 0.05 && rand() < mw * 0.45) {
        const marshKind: ScatterKind = rand() < 0.6 ? 'reed' : 'marshGrass';
        objects.push({
          kind: marshKind,
          x,
          z,
          y: 0,
          scale: 0.7 + rand() * 0.7,
          rotY: rand() * Math.PI * 2,
        });
        continue;
      }
      // Blended mix: each biome contributes its object mix by its weight.
      const mix = new Map<ScatterKind, number>();
      let total = 0;
      for (const biome of BIOMES) {
        const w = weights.weights[biome.id];
        if (w <= 0) continue;
        for (const [kind, mw] of Object.entries(biome.mix) as [ScatterKind, number][]) {
          const v = w * mw;
          mix.set(kind, (mix.get(kind) ?? 0) + v);
          total += v;
        }
      }
      if (total <= 0) continue;
      let pick = rand() * total;
      let kind: ScatterKind = 'bush';
      for (const k of SCATTER_KINDS) {
        const v = mix.get(k) ?? 0;
        if (v <= 0) continue;
        pick -= v;
        if (pick <= 0) {
          kind = k;
          break;
        }
      }
      objects.push({
        kind,
        x,
        z,
        // Ground-hugging kinds sit on the plane; uprights rise from it.
        y: kind === 'bogPatch' || kind === 'standingWater' || kind === 'pond' || kind === 'peatMoss' || kind === 'riverSilt'
          ? 0.02
          : 0,
        scale: 0.7 + rand() * 0.7,
        rotY: rand() * Math.PI * 2,
      });
    }

    // Clustering pass (Adam, 2026-10-30): groves and stands
    // form, lone trees thin — its own streams, so only the
    // tree set moves; every later pass reads the final trees.
    // NOTE (pluralization, 2026-10-30): instances do NOT
    // join the clustering consult — groves are scatter,
    // not places, and a moved grove would break this
    // pass's byte-identical-outside-footprints promise.
    // A grove overlapping a mouth clearing simply loses
    // its in-clearing trees to the site pass below.
    applyClustering(objects, seed, cx, cz, weightsAtPos, fieldsAt, getSites());

    // The singular Grove's lady slipper patch (the places
    // build, 2026-11-03): the Grove always carries one,
    // in the annulus around its clearing.
    applyGroveLadySlipper(objects, seed, cx, cz, groveOnce());

    // Ground acorns (Adam, 2026-10-26): one cluster beside each
    // downed oak in this chunk — acorns are hand-picked from the
    // ground around the log, not from the log itself. A SEPARATE
    // derived rand stream (never the chunk's main stream) so this
    // landing leaves every pre-existing scatter object untouched;
    // offsets clamp inside the chunk so chunk-gen objects never
    // cross chunk borders (proximity regenerates per chunk).
    // THE LOG MERGER (Adam, 2026-11-02): the downed oak is a
    // fallen log now, and fallen logs are everywhere the oaks
    // were and more — a cluster beside EVERY log would more
    // than double the acorn supply. The pass gates on the
    // log's own spot instead (a position hash, the treeKind
    // pattern): roughly one log in four carries a cluster
    // (ACORN_LOG_SHARE, DRAFT), holding the acorn census
    // near what the oaks alone provided.
    const acornRand = mulberry32(deriveSeed(seed, `acorns:${cx},${cz}`));
    const oaks = objects.filter(
      (obj) =>
        obj.kind === 'log' &&
        ((deriveSeed(seed, `acornlog:${obj.x.toFixed(2)},${obj.z.toFixed(2)}`) % 4) + 4) % 4 === 0,
    );
    for (const oak of oaks) {
      const angle = acornRand() * Math.PI * 2;
      const dist = 0.8 + acornRand() * 1.2;
      const ax = Math.min(Math.max(oak.x + Math.cos(angle) * dist, originX + 0.5), originX + CHUNK_SIZE - 0.5);
      const az = Math.min(Math.max(oak.z + Math.sin(angle) * dist, originZ + 0.5), originZ + CHUNK_SIZE - 0.5);
      objects.push({
        kind: 'groundAcorns',
        x: ax,
        z: az,
        y: 0,
        scale: 0.7 + acornRand() * 0.7,
        rotY: acornRand() * Math.PI * 2,
      });
    }

    // Standing oaks (Adam, 2026-10-26 — same fix as downed oak):
    // one cluster beside each standing tree in this chunk, on its
    // OWN derived stream so the downed-oak clusters above stay
    // byte-identical. Scenery tall trees (kind 'tallTree') are not
    // standing trees and get no clusters (flagged). State-appended
    // trees (regrown saplings) never reach this block — same as
    // spawned logs beside downed oaks — so clusters sit beside
    // worldgen-placed trees only.
    const standingAcornRand = mulberry32(deriveSeed(seed, `acorns-standing:${cx},${cz}`));
    const standingTrees = objects.filter((obj) => obj.kind === 'tree');
    for (const tree of standingTrees) {
      const angle = standingAcornRand() * Math.PI * 2;
      const dist = 0.8 + standingAcornRand() * 1.2;
      const ax = Math.min(Math.max(tree.x + Math.cos(angle) * dist, originX + 0.5), originX + CHUNK_SIZE - 0.5);
      const az = Math.min(Math.max(tree.z + Math.sin(angle) * dist, originZ + 0.5), originZ + CHUNK_SIZE - 0.5);
      objects.push({
        kind: 'groundAcorns',
        x: ax,
        z: az,
        y: 0,
        scale: 0.7 + standingAcornRand() * 0.7,
        rotY: standingAcornRand() * Math.PI * 2,
      });
    }

    // Tree-hung beehives (beehive landing, 2026-10-28 — Adam:
    // wild hives go ON TREES, not on the ground, so a torch
    // beneath one reads as "under" for the safe-harvest rule).
    // Each hive picked by the mix moves to the nearest 'tree'
    // in the SAME chunk, hanging beside its trunk: direction =
    // slot-to-tree (fallback +x if coincident), offset =
    // mid-trunk radius + skep radius, both scaled by their own
    // scatter scales (the skep touches the trunk, never floats),
    // base height 1.8 m (trunk top / canopy zone at scale 1).
    // Host kind is 'tree' only v1 (tallTree/appleTree don't
    // host). Pure rewrite — NO RNG consumed, so every other
    // scatter is byte-identical. A hive in a chunk with no
    // 'tree' is culled (no host): honey shifts toward
    // oldfield/forest country, meadow + creek thinning
    // accepted as this landing's cost of the ruling.
    {
      const trees = objects.filter((obj) => obj.kind === 'tree');
      const hung: ScatterObject[] = [];
      for (const obj of objects) {
        if (obj.kind !== 'beehive') {
          hung.push(obj);
          continue;
        }
        let nearest: ScatterObject | null = null;
        let nearestD2 = Infinity;
        for (const tree of trees) {
          const d2 = (tree.x - obj.x) ** 2 + (tree.z - obj.z) ** 2;
          if (d2 < nearestD2) {
            nearestD2 = d2;
            nearest = tree;
          }
        }
        if (!nearest) continue; // culled: no host tree in this chunk
        const dx = nearest.x - obj.x;
        const dz = nearest.z - obj.z;
        const len = Math.hypot(dx, dz);
        const ux = len > 0 ? dx / len : 1;
        const uz = len > 0 ? dz / len : 0;
        const offset = 0.25 * nearest.scale + 0.38 * obj.scale;
        hung.push({
          ...obj,
          x: nearest.x + ux * offset,
          z: nearest.z + uz * offset,
          y: 1.8,
        });
      }
      objects.splice(0, objects.length, ...hung);
    }

    // Tree kinds RETIRED (Adam, 2026-11-02 — the flattening:
    // "just make them generic trees... Unless we want to get
    // into all the varieties of trees, which i don't"). The
    // oak relabel pass that stood here is gone; every standing
    // tree is 'tree'. Apple trees stand as the one accepted
    // variation — the fruit is visible, not a hidden type.

    // The sites (Grove landing 2026-10-30; Schoolhouse landing
    // #2 and the Burnt Village #3, same day): the site pass runs LAST, after every other
    // pass has read the original scatter. Sites are pure
    // functions of the seed (sites.ts, memoized), so this pass
    // consumes NO rand from any stream: inside a site's clearing
    // it suppresses ordinary scatter (position-based, so chunk
    // borders agree), and it emits each site feature into
    // exactly the chunk containing the feature's position.
    // Outside every clearing the chunk is byte-identical to a
    // world without sites — the site probes prove it against a
    // pre-change baseline.
    {
      const sites = [
        ...getSites(),
        ...getInstancesNear({ minX: originX, maxX: originX + CHUNK_SIZE, minZ: originZ, maxZ: originZ + CHUNK_SIZE }),
      ];
      const chunkMinX = originX;
      const chunkMaxX = originX + CHUNK_SIZE;
      const chunkMinZ = originZ;
      const chunkMaxZ = originZ + CHUNK_SIZE;
      for (const site of sites) {
        if (site.ribbon) {
          // Ribbon: skip by bounds, suppress by the LINE.
          if (
            chunkMaxX < site.bounds.minX || chunkMinX > site.bounds.maxX ||
            chunkMaxZ < site.bounds.minZ || chunkMinZ > site.bounds.maxZ
          ) {
            continue;
          }
          for (let i = objects.length - 1; i >= 0; i--) {
            const o = objects[i];
            if (distToSegment(o.x, o.z, site.ribbon.a, site.ribbon.b) < site.ribbon.halfWidth) {
              objects.splice(i, 1);
            }
          }
        } else {
          // Circle vs chunk-rect distance: skip the site entirely
          // for the overwhelming majority of chunks.
          const nearX = Math.max(chunkMinX, Math.min(site.center.x, chunkMaxX));
          const nearZ = Math.max(chunkMinZ, Math.min(site.center.z, chunkMaxZ));
          const d2 = (site.center.x - nearX) ** 2 + (site.center.z - nearZ) ** 2;
          if (d2 > site.clearRadius * site.clearRadius) continue;
          for (let i = objects.length - 1; i >= 0; i--) {
            const o = objects[i];
            const od2 = (o.x - site.center.x) ** 2 + (o.z - site.center.z) ** 2;
            if (od2 < site.clearRadius * site.clearRadius) objects.splice(i, 1);
          }
        }
        for (const f of site.features) {
          if (f.x >= chunkMinX && f.x < chunkMaxX && f.z >= chunkMinZ && f.z < chunkMaxZ) {
            objects.push({ ...f });
          }
        }
      }
    }

    return { cx, cz, objects };
  }

  function findSpawn(): { x: number; z: number } {
    // Deterministic scan: the most Mirewood-dominant point within 200 m of
    // origin, so the player always starts in the sloppy-wet hybrid start.
    // PINNED (Adam, 2026-11-02): the scan reads the legacy
    // siting grammar (biomes.ts LEGACY_ANCHORS), not the
    // living weights — the spawn seat stands where it
    // stood before the biome landing, on every seed.
    let best = { x: 0, z: 0 };
    let bestWeight = -1;
    for (let z = -200; z <= 200; z += 8) {
      for (let x = -200; x <= 200; x += 8) {
        const w = legacyWeightsAt(fieldsAt(x, z)).weights.mirewood;
        if (w > bestWeight) {
          bestWeight = w;
          best = { x, z };
        }
      }
    }
    return best;
  }

  return {
    seed,
    fieldsAt,
    weightsAt: weightsAtPos,
    groundColorAt: groundColorAtPos,
    generateChunk,
    findSpawn,
  };
}

/**
 * Stable serialization of a chunk for the reproducibility check: fixed key
 * order, fixed float precision. Two runs from the same seed must produce
 * identical strings; different seeds must differ.
 */
export function serializeChunk(chunk: ChunkData): string {
  const objs = chunk.objects.map((o) => [
    o.kind,
    o.x.toFixed(4),
    o.z.toFixed(4),
    o.y.toFixed(4),
    o.scale.toFixed(4),
    o.rotY.toFixed(4),
  ]);
  return JSON.stringify({ cx: chunk.cx, cz: chunk.cz, objects: objs });
}

/** Ground vertex colors for a chunk, row-major over (SEGMENTS+1)^2 verts. */
export function chunkGroundColors(gen: WorldGen, cx: number, cz: number): number[] {
  const colors: number[] = [];
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  for (let gz = 0; gz <= GROUND_SEGMENTS; gz++) {
    for (let gx = 0; gx <= GROUND_SEGMENTS; gx++) {
      const x = originX + (gx / GROUND_SEGMENTS) * CHUNK_SIZE;
      const z = originZ + (gz / GROUND_SEGMENTS) * CHUNK_SIZE;
      colors.push(gen.groundColorAt(x, z));
    }
  }
  return colors;
}
