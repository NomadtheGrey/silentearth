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

import { BIOMES, createFields, weightsAt, groundColorAt, marshWeight } from './biomes';
import type { Fields } from './biomes';
import { mulberry32, deriveSeed } from './seed';
import { treeKindAt } from './treeKind';
import { groveSite, schoolhouseSite } from './sites';
import { CHUNK_SIZE, BASE_SCATTER_PER_CHUNK, GROUND_SEGMENTS } from '../constants';
import type { ChunkData, ScatterKind, ScatterObject } from '../types';

export interface WorldGen {
  seed: string;
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
  'bone', 'saltCrystal', 'downedOak',
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
  // apple landing noted).
  'yarrow', 'coneflower', 'clover', 'dandelion', 'milkweed',
  'poppy', 'sunflower', 'aster', 'trillium', 'violet',
  'ladySlipper', 'iris', 'waterLily',
];

export function createWorldGen(seed: string): WorldGen {
  const fieldsAt = createFields(seed);

  const weightsAtPos = (x: number, z: number) => weightsAt(fieldsAt(x, z));
  const groundColorAtPos = (x: number, z: number) =>
    groundColorAt(fieldsAt(x, z), weightsAtPos(x, z));

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

    // Ground acorns (Adam, 2026-10-26): one cluster beside each
    // downed oak in this chunk — acorns are hand-picked from the
    // ground around the log, not from the log itself. A SEPARATE
    // derived rand stream (never the chunk's main stream) so this
    // landing leaves every pre-existing scatter object untouched;
    // offsets clamp inside the chunk so chunk-gen objects never
    // cross chunk borders (proximity regenerates per chunk).
    const acornRand = mulberry32(deriveSeed(seed, `acorns:${cx},${cz}`));
    const oaks = objects.filter((obj) => obj.kind === 'downedOak');
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

    // Tree kinds (Adam, 2026-10-30): a deterministic share of
    // standing-tree slots are OAKS. Runs LAST among the passes,
    // so every earlier derivation (the acorn scatter, the hive
    // hosting above — hives host on 'tree') reads the original
    // kinds. Pure relabel: treeKindAt is a position hash (no
    // RNG consumed), and position/scale/rotY are untouched, so
    // slot identity and counts are exactly today's — only the
    // kind string changes, on oak spots only. 'oakTree' never
    // enters the biome mixes; it exists only by this conversion.
    for (const obj of objects) {
      if (obj.kind === 'tree' && treeKindAt(seed, obj.x, obj.z) === 'oak') {
        obj.kind = 'oakTree';
      }
    }

    // The sites (Grove landing 2026-10-30; Schoolhouse landing
    // #2, same day): the site pass runs LAST, after every other
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
        groveSite(seed, findSpawn(), (x, z) => weightsAtPos(x, z).dominant),
        schoolhouseSite(seed, findSpawn(), weightsAtPos),
      ];
      const chunkMinX = originX;
      const chunkMaxX = originX + CHUNK_SIZE;
      const chunkMinZ = originZ;
      const chunkMaxZ = originZ + CHUNK_SIZE;
      for (const site of sites) {
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
    let best = { x: 0, z: 0 };
    let bestWeight = -1;
    for (let z = -200; z <= 200; z += 8) {
      for (let x = -200; x <= 200; x += 8) {
        const w = weightsAtPos(x, z).weights.mirewood;
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
