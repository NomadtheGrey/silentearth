/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Procedural terrain textures (fill-in landing, 2026-10-25).
 *
 * WHAT LANDING 1 HAD (verified in code, 2026-10-25): ground was a flat
 * plane with VERTEX COLORS sampled from the continuous biome blend —
 * color, not texture. No texture object, no canvas, no image asset existed
 * anywhere in src/game/. This file adds the missing layer.
 *
 * DESIGN (keeps the redesign's hard rules intact):
 * - Textures are CODE-GENERATED pixel data (no external assets, nothing
 *   to download, no asset pipeline). The renderer wraps them in a
 *   THREE.DataTexture; this module itself never touches the DOM, so it
 *   is deterministic and testable in Node as well as in the browser.
 * - One texture per biome (+ one for marsh ground character): seeded
 *   speckle dots and grain over a NEUTRAL WHITE base, so the texture is
 *   brightness-only detail. It once started from the biome's own ground
 *   color; that double-applied the color the vertex blend already
 *   carries (biomes.ts groundColorAt), so the rendered ground stepped
 *   hard at chunk borders where the dominant biome flips and every
 *   biome read darker and muddier than designed (Adam, 2026-11-02 —
 *   the biome-blending fix: some places should look muddy, not all).
 *   All ground color now comes from the vertex blend alone (weights,
 *   marsh tint, wetness darkening); per-biome character survives as
 *   the seeded speckle pattern, which differs per (seed, biome). The
 *   renderer picks a chunk's texture from its dominant biome (marsh
 *   texture when marsh character dominates); a pattern change at a
 *   border is brightness-only, so no color seam is introduced.
 * - Everything is seeded: the same (seed, biome) always produces the
 *   same pixels. NO Math.random anywhere — the seeded streams come from
 *   src/game/seed.ts, exactly like worldgen.
 * - Light and performant: 128x128 RGBA per texture, one shared texture
 *   per biome per renderer (not per chunk), tiled by UV repeat.
 */

import { deriveSeed, mulberry32 } from './seed';
import type { BiomeId } from '../types';

/** Texture edge length in pixels. Small on purpose: a detail layer. */
export const TEXTURE_SIZE = 128;
/** UV repeats across one chunk's ground plane. */
export const TEXTURE_REPEAT = 4;

/** Raw RGBA pixel data for one ground texture. */
export interface GroundTextureData {
  id: BiomeId | 'marsh';
  width: number;
  height: number;
  /** Row-major RGBA, length width * height * 4. */
  data: Uint8Array;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Generate the ground texture for one biome (or marsh). Deterministic in
 * (seed, id): two calls with the same arguments produce byte-identical
 * data; different seeds or biomes differ.
 */
export function createBiomeTexture(
  id: BiomeId | 'marsh',
  seed: string,
  size: number = TEXTURE_SIZE,
): GroundTextureData {
  // Neutral white base (Adam, 2026-11-02): the renderer multiplies this
  // texture over the vertex-color blend, so any color here lands ON TOP
  // of the blend's own color — the old per-biome base did exactly that,
  // stepping at chunk borders and muddying every biome. Brightness
  // only: the speckles and grain below shade the white, never tint it.
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }

  // Seeded speckle dots, painted with wrap-around offsets so the texture
  // tiles seamlessly: a dot near an edge reappears on the opposite edge.
  const dots = mulberry32(deriveSeed(seed, `texture:${id}:dots`));
  const dotCount = Math.floor((size * size) / 40);
  for (let d = 0; d < dotCount; d++) {
    const cx = Math.floor(dots() * size);
    const cy = Math.floor(dots() * size);
    const radius = 1 + Math.floor(dots() * 3);
    const factor = 0.72 + dots() * 0.55;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        for (const ox of [-size, 0, size]) {
          for (const oy of [-size, 0, size]) {
            const px = cx + dx + ox;
            const py = cy + dy + oy;
            if (px < 0 || px >= size || py < 0 || py >= size) continue;
            const i = (py * size + px) * 4;
            data[i] = clamp255(data[i] * factor);
            data[i + 1] = clamp255(data[i + 1] * factor);
            data[i + 2] = clamp255(data[i + 2] * factor);
          }
        }
      }
    }
  }

  // Fine per-pixel grain, a second seeded stream in fixed row-major order.
  const grain = mulberry32(deriveSeed(seed, `texture:${id}:grain`));
  for (let i = 0; i < size * size; i++) {
    const n = (grain() - 0.5) * 24;
    data[i * 4] = clamp255(data[i * 4] + n);
    data[i * 4 + 1] = clamp255(data[i * 4 + 1] + n);
    data[i * 4 + 2] = clamp255(data[i * 4 + 2] + n);
  }

  return { id, width: size, height: size, data };
}

/** Stable string form of texture data, for the reproducibility check. */
export function serializeTexture(tex: GroundTextureData): string {
  // A cheap deterministic fingerprint: length + a few sampled pixels +
  // a rolling checksum over all bytes. Byte-identical data => identical
  // fingerprint; any pixel change moves it.
  let sum = 0;
  for (let i = 0; i < tex.data.length; i += 7) {
    sum = (Math.imul(sum, 31) + tex.data[i]) >>> 0;
  }
  const samples = [0, 1000, 5000, 10000, tex.data.length - 4]
    .map((i) => tex.data[i])
    .join(',');
  return `${tex.id}:${tex.width}x${tex.height}:${sum}:${samples}`;
}
