/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic seeding utilities. Everything in world generation derives
 * from a world seed STRING through these functions alone, so the same seed
 * always builds the same world. No Math.random() anywhere in worldgen.
 */

/** FNV-1a hash: string seed -> uint32. Stable across runs and platforms. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: small deterministic PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a child seed from a parent seed + a label (e.g. one per noise field). */
export function deriveSeed(seed: string, label: string): number {
  return hashSeed(`${seed}::${label}`);
}
