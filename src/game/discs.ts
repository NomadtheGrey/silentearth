/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GROUND-DISC FEATURES — the one rect query over the
 * flat discs the world paints on its ground (Background,
 * 2026-11-01; UI's tag claim ask, routed by DEV). The
 * shell's faced-name derivation reads it: a disc's
 * identity (Adam's tag law — everything faced names
 * itself) needs kind + position + TRUE radius, and no
 * shell path served all three until here (proximity's
 * findInRange surfaces harvestables only).
 *
 * THE UNION, three sources, no duplicates possible:
 * - CHUNK SCATTER (the ambient discs — bog, pond,
 *   standing water, silt, peat) from generateChunk,
 *   filtered to sources whose mesh is a flat disc
 *   (shape 'disc' at baseY 0 — the grove heart mound,
 *   a bespoke build at baseY 0.5, is not ground and
 *   never appears).
 * - THE BURNT VILLAGE's placed discs (its ash street +
 *   footprint falls) from villageSite's features.
 * - HOMESTEAD yard discs (ash) from the instances'
 *   features, via homesteadInstancesInRect — the
 *   instance-rect idiom this query mirrors.
 * Ash is a placed feature, never scatter (it is absent
 * from SCATTER_KINDS), so the site folds and the chunk
 * pass can never return the same disc twice.
 *
 * EFFECTIVE RADIUS: r = (DISC_RADIUS[kind] ?? 1) × the
 * feature's own scale — the radius the renderer
 * actually paints (models.ts is the one source), times
 * the per-feature scale the passes rolled. A feature is
 * returned when its disc INTERSECTS the rect (centre
 * within the rect grown by r), so a small facing rect
 * still catches the big pond it stands in.
 *
 * Dimension gens (caves, upstairs) fold NO sites —
 * village/homestead derivations are surface facts —
 * but their own chunk discs (cave pools) answer
 * truthfully through the scatter pass.
 */

import { CHUNK_SIZE } from '../constants';
import type { ScatterKind } from '../types';
import type { WorldGen } from './worldgen';
import { SOURCE_FOR_KIND } from './objects';
import { DISC_RADIUS } from './models';
import { villageSite } from './sites';
import { homesteadInstancesInRect } from './homesteads';

/** One flat ground disc: kind, centre, effective radius. */
export interface DiscFeature {
  kind: ScatterKind;
  x: number;
  z: number;
  /** Effective radius in metres (paint radius × scale). */
  r: number;
}

/** A flat ground disc source (the mound excluded by baseY). */
function isGroundDisc(kind: ScatterKind): boolean {
  const mesh = SOURCE_FOR_KIND[kind]?.mesh;
  return mesh?.shape === 'disc' && mesh.baseY === 0;
}

function radiusFor(kind: ScatterKind, scale: number): number {
  return (DISC_RADIUS[kind] ?? 1.0) * scale;
}

/** findSpawn is unmemoized in the gen; the site folds
 *  want it once per gen, not once per query (the
 *  waterProximity paramsFor memo precedent). */
const spawnMemo = new WeakMap<WorldGen, { x: number; z: number }>();
function spawnFor(gen: WorldGen): { x: number; z: number } {
  let spawn = spawnMemo.get(gen);
  if (!spawn) {
    spawn = gen.findSpawn();
    spawnMemo.set(gen, spawn);
  }
  return spawn;
}

/**
 * Every flat ground disc intersecting the rect, from
 * scatter + the village + the homesteads. Unsorted —
 * the caller ranks by its own need (facing, distance).
 */
export function discFeaturesInRect(
  gen: WorldGen,
  rect: { minX: number; maxX: number; minZ: number; maxZ: number },
): DiscFeature[] {
  const out: DiscFeature[] = [];
  const push = (kind: ScatterKind, x: number, z: number, scale: number): void => {
    if (!isGroundDisc(kind)) return;
    const r = radiusFor(kind, scale);
    if (x >= rect.minX - r && x <= rect.maxX + r && z >= rect.minZ - r && z <= rect.maxZ + r) {
      out.push({ kind, x, z, r });
    }
  };

  // Chunk scatter over the chunks the rect overlaps.
  const cx0 = Math.floor(rect.minX / CHUNK_SIZE);
  const cx1 = Math.floor(rect.maxX / CHUNK_SIZE);
  const cz0 = Math.floor(rect.minZ / CHUNK_SIZE);
  const cz1 = Math.floor(rect.maxZ / CHUNK_SIZE);
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) {
      for (const obj of gen.generateChunk(cx, cz).objects) {
        push(obj.kind, obj.x, obj.z, obj.scale);
      }
    }
  }

  // The site folds — surface gens only.
  if (!gen.dimensionKey) {
    const seed = String(gen.seed);
    const spawn = spawnFor(gen);
    const weightsAtPos = (x: number, z: number) => gen.weightsAt(x, z);
    const village = villageSite(seed, spawn, weightsAtPos);
    for (const f of village.features) push(f.kind, f.x, f.z, f.scale);
    for (const inst of homesteadInstancesInRect(seed, spawn, weightsAtPos, rect)) {
      for (const f of inst.features) push(f.kind, f.x, f.z, f.scale);
    }
  }
  return out;
}
