/**
 * mossPaintState.ts — the GLOW-PAINT register (Background,
 * 2026-11-03; glow-moss build, piece one under Adam's
 * re-aim: 'if twilight fungus glows, we can use it').
 *
 * She renders twilight fungus into glow doses (Systems'
 * recipe) and PAINTS them onto cave surfaces — a mark of
 * pale light she placed herself, so she can light her
 * way deeper than the fungus grows. This module is the
 * REGISTER of those marks: the patches seated in each
 * dimension, nothing more. The dose, the recipe, and the
 * save seat are Systems'; the door is UI's; the render
 * (discs + the shared light budget) is the renderer's;
 * the faced-surface read is the renderer's aim. Layers
 * meet only through the shapes below.
 *
 * SHAPES (fixed with the door before either side built —
 * DEV relay, 2026-11-03):
 * - A patch is the WHOLE record { id, x, y, z, surface,
 *   nx, nz }: a mark without its height, surface, and
 *   normal cannot re-render. Coordinates are CAVE-LOCAL,
 *   the dimension's own frame; y is the surface height
 *   (0 for floors, the aim height for walls, the ceiling
 *   height for ceilings).
 * - surface 'floor' = an upward face. surface 'wall' =
 *   any side face (nx/nz = its outward axis normal) OR
 *   the ceiling (nx = nz = 0, read with y > 0 — the
 *   vocabulary completion the aim's geometry forced).
 * - The id is position-keyed: 'moss-paint:<key>:<x>,<y>,<z>'
 *   at 2 dp — the same mark aimed twice is the same mark.
 * - Dimensions key the register (v1: 'cave:main' and the
 *   distributed cave keys as they come).
 *
 * THE OVERLAP LAW: a new patch whose centre lands within
 * PAINT_PATCH_R_M of a seated patch in the same dimension
 * is REFUSED — seatPatch returns null and nothing is
 * consumed (the jar law: never eaten silently). The door
 * checks patchAt first for its refusal line; the register
 * refuses again at the seat, so no caller order can seat
 * an overlap.
 *
 * On a successful seat the register emits 'moss:painted'
 * { dimensionKey, id } on the bus — the renderer's rebuild
 * trigger. Snapshot/restore speak the save's own array
 * ({ dimensionKey, patches }[] verbatim, Systems' seat).
 */

import { bus } from './events';

/** Two patches closer than this (centre distance) overlap. DRAFT. */
export const PAINT_PATCH_R_M = 1.2;

export interface MossPaintPatch {
  id: string;
  x: number;
  y: number;
  z: number;
  surface: 'wall' | 'floor';
  /** The wall's outward axis normal (0/0 for floors and ceilings). */
  nx: number;
  nz: number;
}

export interface MossPaintDimension {
  dimensionKey: string;
  patches: MossPaintPatch[];
}

function patchId(dimensionKey: string, x: number, y: number, z: number): string {
  return `moss-paint:${dimensionKey}:${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
}

/** The register: patches by dimension key. */
const byDimension = new Map<string, MossPaintPatch[]>();

/** The nearest seated patch within PAINT_PATCH_R_M of a
 *  point (3D centre distance), or null. */
export function patchAt(
  dimensionKey: string,
  x: number,
  y: number,
  z: number,
): MossPaintPatch | null {
  const patches = byDimension.get(dimensionKey);
  if (!patches) return null;
  let best: MossPaintPatch | null = null;
  let bestD = PAINT_PATCH_R_M;
  for (const p of patches) {
    const d = Math.hypot(p.x - x, p.y - y, p.z - z);
    if (d <= bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/**
 * Seat a patch from an aim spot. Returns the seated
 * patch, or NULL when it would overlap a seated patch
 * (the refusal — the caller consumes nothing on null).
 * Emits 'moss:painted' on a successful seat.
 */
export function seatPatch(
  dimensionKey: string,
  spot: { x: number; y: number; z: number; surface: 'wall' | 'floor'; nx: number; nz: number },
): MossPaintPatch | null {
  if (patchAt(dimensionKey, spot.x, spot.y, spot.z) !== null) return null;
  const patch: MossPaintPatch = {
    id: patchId(dimensionKey, spot.x, spot.y, spot.z),
    x: spot.x,
    y: spot.y,
    z: spot.z,
    surface: spot.surface,
    nx: spot.nx,
    nz: spot.nz,
  };
  const patches = byDimension.get(dimensionKey) ?? [];
  patches.push(patch);
  byDimension.set(dimensionKey, patches);
  bus.emit('moss:painted', { dimensionKey, id: patch.id });
  return patch;
}

/** Every patch seated in a dimension (render order = seat order). */
export function patchesFor(dimensionKey: string): readonly MossPaintPatch[] {
  return byDimension.get(dimensionKey) ?? [];
}

/** Save seam: a serializable copy in the save's own array shape. */
export function snapshotMossPaint(): MossPaintDimension[] {
  return [...byDimension.entries()].map(([dimensionKey, patches]) => ({
    dimensionKey,
    patches: patches.map((p) => ({ ...p })),
  }));
}

/** Silent bulk restore (the save's shape, verbatim; a
 *  malformed row drops, the register replaces whole). */
export function restoreMossPaint(shape: readonly MossPaintDimension[]): void {
  byDimension.clear();
  if (!Array.isArray(shape)) return;
  for (const dim of shape) {
    if (!dim || typeof dim.dimensionKey !== 'string' || !Array.isArray(dim.patches)) continue;
    const patches: MossPaintPatch[] = [];
    for (const p of dim.patches) {
      if (
        p &&
        typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        typeof p.z === 'number' &&
        (p.surface === 'wall' || p.surface === 'floor')
      ) {
        patches.push({
          id: typeof p.id === 'string' ? p.id : patchId(dim.dimensionKey, p.x, p.y, p.z),
          x: p.x,
          y: p.y,
          z: p.z,
          surface: p.surface,
          nx: typeof p.nx === 'number' ? p.nx : 0,
          nz: typeof p.nz === 'number' ? p.nz : 0,
        });
      }
    }
    if (patches.length > 0) byDimension.set(dim.dimensionKey, patches);
  }
}

/** Empty the register (new game / test hygiene). */
export function clearMossPaint(): void {
  byDimension.clear();
}

/** The register as a state object (the jar idiom). */
export const mossPaintState = {
  patchAt,
  seatPatch,
  patchesFor,
  snapshot: snapshotMossPaint,
  restore: restoreMossPaint,
  clear: clearMossPaint,
};
