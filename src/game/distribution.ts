/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * THE DISTRIBUTION MODEL (Adam + DEV, 2026-10-30 — the
 * layer the recurring places share). Singular story
 * places (the Grove, the Burnt Village, the twelve
 * registered sites) sit on seeded bearings from spawn;
 * RECURRING places cannot — she ranges thousands of
 * meters, and travel in any direction should keep
 * finding them. So recurring places derive by
 * DISTRIBUTION: the world divides into coarse cells,
 * each cell rolls its own labelled stream for candidate
 * instances, and a candidate registers only if it keeps
 * the spacing law against the singular sites and its
 * sibling instances.
 *
 * The model is deliberately small: cell math + labelled
 * per-cell streams. Each customer (caves first, lesser
 * groves second) owns its presence test, seat draw, and
 * acceptance. Derivation is a pure function of the world
 * seed and the cell — position-based, so chunk borders
 * and query order can never disagree, and memoized per
 * cell by the customer.
 *
 * Precedent: the clustering pass's per-cell grove
 * derivation (worldgen.ts) — same shape, one level up:
 * groves are scatter dressing; these are PLACES, with
 * footprints, walls, and (for caves) dimensions of
 * their own.
 */

import { deriveSeed, mulberry32 } from './seed';

/** Distribution cell size, meters (DRAFT). One candidate
 *  seat per cell at most, so instance density reads off
 *  this and the customer's presence draw. */
export const DISTRIBUTION_CELL_M = 512;

/** The cell containing a world position (floor division —
 *  correct for negative coordinates). */
export function distributionCellAt(x: number, z: number): { cx: number; cz: number } {
  return {
    cx: Math.floor(x / DISTRIBUTION_CELL_M),
    cz: Math.floor(z / DISTRIBUTION_CELL_M),
  };
}

/** A cell's stable label (instance keys build on it). */
export function distributionCellLabel(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/** The labelled stream for one cell of one customer.
 *  Consumption order inside the cell is the customer's
 *  contract — fixed, like every site stream. */
export function distributionCellStream(
  worldSeed: string,
  label: string,
  cx: number,
  cz: number,
): () => number {
  return mulberry32(deriveSeed(worldSeed, `${label}:${cx},${cz}`));
}

/** Every cell overlapping a world rect (inclusive). */
export function distributionCellsOverlapping(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): { cx: number; cz: number }[] {
  const a = distributionCellAt(minX, minZ);
  const b = distributionCellAt(maxX, maxZ);
  const out: { cx: number; cz: number }[] = [];
  for (let cz = a.cz; cz <= b.cz; cz++) {
    for (let cx = a.cx; cx <= b.cx; cx++) {
      out.push({ cx, cz });
    }
  }
  return out;
}
