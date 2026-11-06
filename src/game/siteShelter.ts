/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SITE SHELTER (2026-11-05, DEV's found-roofs filing) —
 * the site-side sibling of shelterAt (game/shelter.ts).
 * shelterAt sees PLACED houses + tents; the found
 * structures — village houses, the farmhouse, the
 * Burnt Village, the other roofed singulars and the
 * distributed families — are worldgen, invisible to
 * it, so rain fell through their roofs in the facts.
 *
 * Each roofed site record now carries its own
 * roofRects (world AABBs of the interiors its roof
 * actually covers), computed in its build where the
 * frame and the ruin state are known: a standing
 * village house shelters; a charred one's roof has
 * fallen and it contributes no rect; the mill shelters
 * its land half (the standing slope); a fallen-end
 * barn shelters all but the fallen bay. This read
 * answers the one question the shell's rain
 * composition needs — does she stand inside a found
 * roof at (x, z)? — in shelterAt's calling pattern,
 * so the shell composes placed + site shelter as one
 * read (ColdWetFacts.rainShelter: enclosed -> 0).
 *
 * Every site roof reads 'enclosed': a standing roof
 * is a whole roof. The leaky class (lean-to, 0.5
 * DRAFT) belongs to placed houses alone.
 */

import {
  barnSite,
  chapelSite,
  drownedMillSite,
  farmhouseSite,
  generalStoreSite,
  schoolhouseSite,
  villageSite,
  type RoofRect,
} from './sites';
import { villageInstancesInRect } from './villages';
import { farmhouseInstancesInRect } from './farmhouses';
import { homesteadInstancesInRect } from './homesteads';
import type { ShelterRoofClass } from './shelter';
import type { WorldGen } from './worldgen';

function inside(r: RoofRect, x: number, z: number): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

/**
 * The found roof over (x, z), or null. Surface only —
 * dimensions carry no sites. Singular derivations are
 * memoized per seed; the family queries scan a 1 m
 * probe rect around the point, so the read stays
 * cheap enough for the shell's facts cadence.
 */
export function siteShelterAt(
  gen: WorldGen,
  x: number,
  z: number,
): { roof: ShelterRoofClass } | null {
  if (gen.dimensionKey) return null;
  const seed = String(gen.seed);
  const spawn = gen.findSpawn();
  const weightsAtPos = (px: number, pz: number) => gen.weightsAt(px, pz);
  const singulars = [
    villageSite(seed, spawn, weightsAtPos),
    farmhouseSite(seed, spawn, weightsAtPos),
    schoolhouseSite(seed, spawn, weightsAtPos),
    chapelSite(seed, spawn, weightsAtPos),
    generalStoreSite(seed, spawn, weightsAtPos),
    drownedMillSite(seed, spawn, weightsAtPos),
    barnSite(seed, spawn, weightsAtPos),
  ];
  for (const s of singulars) {
    for (const r of s.roofRects) {
      if (inside(r, x, z)) return { roof: 'enclosed' };
    }
  }
  const probe = { minX: x - 1, maxX: x + 1, minZ: z - 1, maxZ: z + 1 };
  for (const inst of villageInstancesInRect(seed, spawn, weightsAtPos, probe)) {
    for (const r of inst.roofRects) {
      if (inside(r, x, z)) return { roof: 'enclosed' };
    }
  }
  for (const inst of farmhouseInstancesInRect(seed, spawn, weightsAtPos, probe)) {
    for (const r of inst.roofRects) {
      if (inside(r, x, z)) return { roof: 'enclosed' };
    }
  }
  for (const inst of homesteadInstancesInRect(seed, spawn, weightsAtPos, probe)) {
    for (const r of inst.roofRects) {
      if (inside(r, x, z)) return { roof: 'enclosed' };
    }
  }
  return null;
}
