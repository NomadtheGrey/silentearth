/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ZONE GRID (Adam 2026-10-28 — zone coords display).
 * Display-only coordinate grid: NOT plots, NOT placement
 * gates (placement stays free — the free-placement pin
 * is untouched). UI's chip displays from this helper
 * (DEV signal); this file formats no strings.
 *
 * SPEC (DEV-approved claim):
 * - SIZE: one zone = one chunk (CHUNK_SIZE 32 m), one
 *   constant. Chunks are the only existing spatial
 *   partition (streaming, scatter, harvest targets all
 *   chunk-keyed), so zone coords double as chunk coords
 *   — debuggable, no new boundary artifacts. Retune is
 *   one constant (e.g. 4 chunks = 128 m), helper shape
 *   unchanged. At 5 m/s a 32 m zone ticks every ~6.4 s
 *   while walking — busy but normal for a coords display.
 * - ORIGIN: world origin (0, 0), NOT spawn. Spawn is
 *   seed-dependent per world (findSpawn searches for
 *   the most Mirewood-dominant point within 200 m —
 *   (24, −32) is one world's spawn, not a constant);
 *   anchoring to spawn would make zone coords shift
 *   per world. World origin is the only stable anchor.
 * - SIGNS: first = EAST = +x (Adam's example: 10 zones
 *   east → [+10, 0]); second = NORTH = +z — Cartesian
 *   (Adam's pin, REVERSED 2026-10-30: north is positive
 *   z; the earlier −z north was a three.js screen habit
 *   from the claim's drafting). A position and its zone
 *   carry the same signs on both axes: raw (623, −532)
 *   is zone (19, −17), south-east, honestly signed.
 * - FLOOR, not trunc: zones tile correctly across
 *   origin (x = −1 → zone −1, not 0).
 */

import { CHUNK_SIZE } from '../constants';

/** Meters per zone (one chunk; retune = one constant). */
export const ZONE_SIZE_METERS = CHUNK_SIZE;

/**
 * Zone coords at world (x, z): [east zone, north zone].
 * Numbers only — the [+10, 0] sign formatting is the
 * display's call, not this helper's.
 */
export function zoneCoords(x: number, z: number): [number, number] {
  return [Math.floor(x / ZONE_SIZE_METERS), Math.floor(z / ZONE_SIZE_METERS)];
}
