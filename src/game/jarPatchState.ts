/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * JAR PATCHES — the placed ground state of the clay
 * jar's water cycle (Adam, 2026-11-01: dump a filled jar
 * on dry ground and it makes mud; dump on mud and it
 * makes water — 'a hauled pond by camp'). The dump
 * OUTCOME is Systems' (clay-jar.ts names the resulting
 * kind against the shell-certified ground); the STATE
 * is here, on the placed-family idiom (trapState's
 * shape): seat / rise / snapshot / restore / clear, bus
 * events the renderer rebuilds on.
 *
 * THE LADDER: a patch is mud or water, one identity
 * through the rise — a dump inside a mud patch's disc
 * turns THAT patch to water (risePatch, same id — the
 * placeHouse upgrade idiom); a dump on dry ground seats
 * a new mud patch; on water it saturates (the record
 * already reads water — nothing changes). patchAt is
 * the pre-read the shell certifies the ground from:
 * the patch whose disc holds the point (nearest when
 * discs overlap — overlaps are allowed, the yard reads
 * as the union).
 *
 * LIFETIME (Background's DRAFT reading, Adam's pin
 * pending): PERSISTENT — placed state in this world
 * persists (fires, traps, houses), and each patch cost
 * jar trips to make. The named alternative is a decay
 * ladder (water sinks to mud, mud dries to ground).
 * No removal verb exists in v1.
 *
 * THE FACTS COMPOSITION lives in waterProximity.ts:
 * a WATER patch is water to every fact (inWater, fill,
 * drink, facing, wading); a MUD patch only slows. This
 * module keeps no fact logic — it is the record.
 */

import { bus } from './events';

/** A patch's rung on the ladder. */
export type PatchKind = 'mud' | 'water';

/** One dumped patch of ground. */
export interface PlacedPatch {
  id: string;
  kind: PatchKind;
  x: number;
  z: number;
}

/** The patch disc's radius (DRAFT): one jar's water,
 *  spread thin — the scatter standing-water disc is 1.2. */
export const PATCH_R_M = 1.0;

/** The patch discs' dress colors (DRAFT): wet earth,
 *  and the standing-water color exactly (twin law — a
 *  dumped-water disc looks like the water it is). */
export const MUD_PATCH_COLOR = 0x4f3d2a;
export const WATER_PATCH_COLOR = 0x2a4a5a;

const patches = new Map<string, PlacedPatch>();
let counter = 0;

/** The patch whose disc holds the point, nearest first
 *  when discs overlap; null on dry (unpatched) ground. */
export function patchAt(x: number, z: number): PlacedPatch | null {
  let best: PlacedPatch | null = null;
  let bestD = Infinity;
  for (const p of patches.values()) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d <= PATCH_R_M && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Every live patch (the water adapter + the renderer
 *  read this; the shell's certification reads patchAt). */
export function allPatches(): PlacedPatch[] {
  return [...patches.values()];
}

/** Seat a new patch of the given kind at the point. */
export function seatPatch(kind: PatchKind, x: number, z: number): PlacedPatch {
  counter += 1;
  const patch: PlacedPatch = { id: `patch:${counter}`, kind, x, z };
  patches.set(patch.id, patch);
  bus.emit('patch:seated', { id: patch.id, kind, x, z });
  return patch;
}

/** Rise a mud patch to water (same identity). Returns
 *  the patch, or null when the id is unknown or the
 *  patch already reads water (saturation is no change). */
export function risePatch(id: string): PlacedPatch | null {
  const patch = patches.get(id);
  if (!patch || patch.kind === 'water') return null;
  patch.kind = 'water';
  bus.emit('patch:risen', { id: patch.id, x: patch.x, z: patch.z });
  return patch;
}

/** The persisted shape (Systems' SaveData seats this). */
export interface SavedPatch {
  id: string;
  kind: PatchKind;
  x: number;
  z: number;
}

export function snapshotPatches(): SavedPatch[] {
  return [...patches.values()].map((p) => ({ ...p }));
}

/** Restore saved patches (silent — the renderer rebuilds
 *  from state at gen install; unknown kinds drop). */
export function restorePatches(saved: SavedPatch[]): void {
  patches.clear();
  let maxSuffix = 0;
  for (const s of saved ?? []) {
    if (!s || (s.kind !== 'mud' && s.kind !== 'water')) continue;
    if (typeof s.x !== 'number' || typeof s.z !== 'number') continue;
    const id = typeof s.id === 'string' && s.id ? s.id : `patch:${++maxSuffix}`;
    patches.set(id, { id, kind: s.kind, x: s.x, z: s.z });
    const n = Number(id.split(':')[1]);
    if (Number.isFinite(n) && n > maxSuffix) maxSuffix = n;
  }
  counter = maxSuffix;
}

/** The state singleton, on the family's idiom. */
export const jarPatchState = {
  patchAt,
  all: allPatches,
  seat: seatPatch,
  rise: risePatch,
  snapshot: snapshotPatches,
  restore: restorePatches,
  clear(): void {
    patches.clear();
    counter = 0;
  },
};
