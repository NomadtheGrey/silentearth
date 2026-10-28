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
