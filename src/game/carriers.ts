/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FRAGMENT CARRIERS — the facts (Background, named
 * 2026-10-31, built on DEV's relay for UI's fragment
 * presentation). A carrier is a place that holds a
 * fragment of a mark: the faced target must hand the
 * shell exactly three facts for Systems' inscribe() —
 * fragmentId, mark, completeness — and this module is
 * their one home.
 *
 * THE FIELD SET (one shape, all carriers):
 *   fragmentId   '<carrierKey>:fragment' — derived from
 *                the carrier's own stable key, never
 *                rolled, so the same stone is the same
 *                fragment in every telling.
 *   mark         Systems' mark id. Class-bound here:
 *                the farmhouse great stone + the village
 *                hearth teach HOME; the grove stone and
 *                the cave circles teach CIRCLE; the
 *                homestead great stones teach TRAVEL.
 *                (The village binding is lane-decided —
 *                a home that was, beside the home that
 *                stands; the pin pass can re-bind it,
 *                it is one field.)
 *   completeness the legible fraction, 0..1, seeded per
 *                carrier. Class bands (DRAFT): standing
 *                stones read high (0.7–1.0); the cave
 *                circles are mostly ruined (0.25–0.6);
 *                fire-touched inscriptions — the village
 *                hearth, the burnt homesteads' stones —
 *                read between (0.35–0.75).
 *
 * WHERE THE FACTS LIVE: plural instances carry the
 * field on their record beside fragmentSpot (homesteads
 * mint it in their derivation; cave instances resolve
 * it from their layout here). The singular sites ARE
 * their records — their carriers resolve here from the
 * standing site facts (the farmhouse's hearthStone, the
 * village's hearthSpot, the grove's carved stone), no
 * record change needed. fragmentCarriersHere is the
 * shell's faced-target projection over all of them.
 */

import { deriveSeed, mulberry32 } from './seed';
import type { BiomeWeights } from '../types';
import { farmhouseSite, groveSite, villageSite } from './sites';
import { caveInstancesInRect, caveLayoutForKey } from './caves';
import { homesteadInstancesInRect } from './homesteads';

/** The three facts a faced carrier hands the shell. */
export interface FragmentCarrier {
  fragmentId: string;
  mark: string;
  completeness: number;
}

/** A carrier with its seat — the projection's entry shape. */
export interface CarrierHere extends FragmentCarrier {
  x: number;
  z: number;
}

type Band = readonly [number, number];
/** Standing stones, little weathered. */
export const CARRIER_BAND_STONE: Band = [0.7, 1.0];
/** Runic circles, mostly ruined (Adam's cave reading). */
export const CARRIER_BAND_CIRCLE: Band = [0.25, 0.6];
/** Fire-touched inscriptions. */
export const CARRIER_BAND_BURNT: Band = [0.35, 0.75];

/** Mint a carrier's facts: id from its key, completeness seeded in its band. */
export function mintCarrier(worldSeed: string, carrierKey: string, mark: string, band: Band): FragmentCarrier {
  const rand = mulberry32(deriveSeed(worldSeed, `carrier:${carrierKey}`));
  return {
    fragmentId: `${carrierKey}:fragment`,
    mark,
    completeness: band[0] + rand() * (band[1] - band[0]),
  };
}

/** The farmhouse great stone — the Home fragment (sites' own naming). */
export function farmhouseCarrier(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): CarrierHere {
  const farm = farmhouseSite(worldSeed, spawn, weightsAtPos);
  return { ...mintCarrier(worldSeed, 'farmhouse', 'home', CARRIER_BAND_STONE), x: farm.hearthStone.x, z: farm.hearthStone.z };
}

/** The burnt village's hearth stone — a home that was. */
export function villageCarrier(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): CarrierHere {
  const village = villageSite(worldSeed, spawn, weightsAtPos);
  const spot = village.hearthHouse.hearthSpot;
  return { ...mintCarrier(worldSeed, 'village', 'home', CARRIER_BAND_BURNT), x: spot.x, z: spot.z };
}

/** The Grove's carved stone — a Circle fragment, standing. */
export function groveCarrier(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): CarrierHere | null {
  const grove = groveSite(worldSeed, spawn, (x, z) => weightsAtPos(x, z).dominant);
  const stone = grove.features.find((f) => f.kind === 'carvedStone');
  if (!stone) return null;
  return { ...mintCarrier(worldSeed, grove.id, 'circle', CARRIER_BAND_STONE), x: stone.x, z: stone.z };
}

/** A cave instance's runic circle, from its layout's fragment spot. */
export function caveCarrier(worldSeed: string, instanceKey: string): CarrierHere | null {
  const layout = caveLayoutForKey(worldSeed, instanceKey);
  if (!layout.fragmentSpot) return null;
  return {
    ...mintCarrier(worldSeed, instanceKey, 'circle', CARRIER_BAND_CIRCLE),
    x: layout.fragmentSpot.x,
    z: layout.fragmentSpot.z,
  };
}

/**
 * Every carrier within r of a point, nearest first —
 * the shell's faced-target projection (UI's seam). The
 * designated cave (cave:main) mints no carrier yet: its
 * fragment presentation rides the cave-touch swap, as
 * held; plural caves carry circles now.
 */
export function fragmentCarriersHere(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  x: number,
  z: number,
  r: number,
): CarrierHere[] {
  const out: CarrierHere[] = [];
  const near = (c: CarrierHere | null) => {
    if (c && Math.hypot(c.x - x, c.z - z) <= r) out.push(c);
  };
  near(farmhouseCarrier(worldSeed, spawn, weightsAtPos));
  near(villageCarrier(worldSeed, spawn, weightsAtPos));
  near(groveCarrier(worldSeed, spawn, weightsAtPos));
  const rect = { minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r };
  for (const inst of caveInstancesInRect(worldSeed, spawn, weightsAtPos, rect)) {
    near(caveCarrier(worldSeed, inst.key));
  }
  for (const inst of homesteadInstancesInRect(worldSeed, spawn, weightsAtPos, rect)) {
    if (inst.fragmentCarrier && inst.fragmentSpot) {
      near({ ...inst.fragmentCarrier, x: inst.fragmentSpot.x, z: inst.fragmentSpot.z });
    }
  }
  out.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  return out;
}
