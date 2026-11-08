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
 *   mark         Systems' mark id. The grove stone, the
 *                lesser groves' carved stones, and the
 *                cave circles teach CIRCLE; the
 *                homestead great stones teach TRAVEL.
 *                THE HOME CARRIERS DEAL (Adam, 2026-11-05):
 *                the farmhouse great stone, every village
 *                hearthstone, and the burnt village no
 *                longer mint the family 'home' tally —
 *                each deals ONE Home-pillar mark
 *                (returning / hedge / hearthhome / naming)
 *                by its own hash; see homeDeal.ts for the
 *                table and the stream law.
 *   completeness the legible fraction, 0..1, seeded per
 *                carrier. THE MINT (Adam's ruling,
 *                2026-11-07): the dealt truth is an ARC —
 *                arcStart (a random hour, 0–11) and
 *                arcHours (a random integer length,
 *                4–6) — ONE dealing range for every
 *                carrier family, Home, Circle and Travel
 *                alike; the old class bands (standing
 *                0.7–1.0, cave 0.25–0.6, burnt 0.35–0.75)
 *                are RETIRED as deal inputs.
 *                completeness rides as the arc's derived
 *                share, arcHours / 12, so standing
 *                consumers read the same number the arc
 *                implies until Systems' filled-clock
 *                accumulation re-keys them.
 *
 * GRAVES ARE RESERVED (Adam, 2026-11-01): graves and
 * their marks belong to the mark line that starts with
 * HUMAN BONE. No grave carrier mints for the founding
 * three — the chapel's inscription stone was minted as
 * Home's third seat for one landing (b8dbfae) and came
 * straight back out on this ruling. And Home gets no
 * third SINGULAR seat at all: Adam's population ruling
 * closed the question the same morning — the answer is
 * the families, not a seat (other burnt villages'
 * hearthstones carry Home as the world populates).
 * Home stands at two singular carriers BY RULING.
 *
 * WHERE THE FACTS LIVE: plural instances carry the
 * field on their record beside fragmentSpot (homesteads
 * and villages mint it in their derivation; cave
 * instances resolve it from their layout here). The
 * singular sites ARE
 * their records — their carriers resolve here from the
 * standing site facts (the farmhouse's hearthStone, the
 * village's hearthSpot, the grove's carved stone), no
 * record change needed. fragmentCarriersHere is the
 * shell's faced-target projection over all of them.
 */

import { deriveSeed, mulberry32 } from './seed';
import { dealFragmentArc } from './fragmentArc';

export { dealFragmentArc };
import type { BiomeWeights } from '../types';
import { farmhouseSite, groveSite, villageSite } from './sites';
import { caveInstancesInRect, caveLayoutForKey } from './caves';
import { homesteadInstancesInRect } from './homesteads';
import { huntingCabinInstancesInRect } from './huntingCabins';
import { villageInstancesInRect } from './villages';
import { groveInstancesInRect } from './groves';
import { dealHomeMark } from './homeDeal';

/** The facts a faced carrier hands the shell: the arc
 * (start + length, the dealt truth) and its share. */
export interface FragmentCarrier {
  fragmentId: string;
  mark: string;
  /** The arc's start hour, 0–11 (Adam's mint, 2026-11-07). */
  arcStart: number;
  /** The arc's length in hours, an integer 4–6. */
  arcHours: number;
  /** The arc's share of the whole sign: arcHours / 12. */
  completeness: number;
}

/** A carrier with its seat — the projection's entry shape. */
export interface CarrierHere extends FragmentCarrier {
  x: number;
  z: number;
}

type Band = readonly [number, number];
/** RETIRED as deal inputs (Adam's mint, 2026-11-07 —
 * one arc range for every family). Kept as the record
 * of the bands the portion era dealt by; nothing reads
 * them to mint any longer. */
export const CARRIER_BAND_STONE: Band = [0.7, 1.0];
export const CARRIER_BAND_CIRCLE: Band = [0.25, 0.6];
export const CARRIER_BAND_BURNT: Band = [0.35, 0.75];

/** Mint a carrier's facts: id from its key, the arc off its own stream. */
export function mintCarrier(worldSeed: string, carrierKey: string, mark: string): FragmentCarrier {
  const rand = mulberry32(deriveSeed(worldSeed, `carrier:${carrierKey}`));
  return {
    fragmentId: `${carrierKey}:fragment`,
    mark,
    ...dealFragmentArc(rand),
  };
}

/** The farmhouse great stone — a Home carrier; its mark is dealt (homeDeal.ts). */
export function farmhouseCarrier(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): CarrierHere {
  const farm = farmhouseSite(worldSeed, spawn, weightsAtPos);
  return { ...mintCarrier(worldSeed, 'farmhouse', dealHomeMark(worldSeed, 'farmhouse')), x: farm.hearthStone.x, z: farm.hearthStone.z };
}

/** The burnt village's hearth stone — a home that was; its mark is dealt (homeDeal.ts). */
export function villageCarrier(
  worldSeed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
): CarrierHere {
  const village = villageSite(worldSeed, spawn, weightsAtPos);
  const spot = village.hearthHouse.hearthSpot;
  return { ...mintCarrier(worldSeed, 'village', dealHomeMark(worldSeed, 'village')), x: spot.x, z: spot.z };
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
  return { ...mintCarrier(worldSeed, grove.id, 'circle'), x: stone.x, z: stone.z };
}

/** A cave instance's runic circle, from its layout's fragment spot. */
export function caveCarrier(worldSeed: string, instanceKey: string): CarrierHere | null {
  const layout = caveLayoutForKey(worldSeed, instanceKey);
  if (!layout.fragmentSpot) return null;
  return {
    ...mintCarrier(worldSeed, instanceKey, 'circle'),
    x: layout.fragmentSpot.x,
    z: layout.fragmentSpot.z,
  };
}

/**
 * ONE FLOOR's carrier (the depth + fragment core,
 * 2026-11-06): the carrier standing on the given
 * 1-based layer of a cave, or null when that floor
 * carries no stone. The deepest floor's read IS
 * caveCarrier — its fragment id ('<key>:fragment')
 * and completeness stream are unchanged, so copies
 * already banked in saves keep their identity. Any
 * other paying floor mints its own: id
 * '<key>:fragment:L<n>', completeness off its own
 * virgin carrier stream. The shell's underground
 * wrapper reads the ACTIVE floor through this.
 */
export function caveCarrierForLayer(
  worldSeed: string,
  instanceKey: string,
  layer: number,
): CarrierHere | null {
  const layout = caveLayoutForKey(worldSeed, instanceKey);
  const floor = layout.layers[layer - 1];
  if (!floor || !floor.stoneSpot) return null;
  if (layer === layout.layers.length) return caveCarrier(worldSeed, instanceKey);
  const rand = mulberry32(deriveSeed(worldSeed, `carrier:${instanceKey}:L${layer}`));
  return {
    fragmentId: `${instanceKey}:fragment:L${layer}`,
    mark: 'circle',
    ...dealFragmentArc(rand),
    x: floor.stoneSpot.x,
    z: floor.stoneSpot.z,
  };
}

/**
 * Every carrier within r of a point, nearest first —
 * the shell's faced-target projection (UI's seam).
 * (The debut cave dealt no fragment under the v1
 * rules — Adam, 2026-11-01; since the depth core,
 * 2026-11-06, the family's carriage includes
 * cave:main and it mints like any cave.)
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
  // The village family's hearthstones (DEV ruling,
  // 2026-11-05: the enumeration belongs with the deal —
  // a dealt fragment no door can reach is not a deal).
  // Every instance mints its carrier, so no guard.
  for (const inst of villageInstancesInRect(worldSeed, spawn, weightsAtPos, rect)) {
    near({ ...inst.fragmentCarrier, x: inst.fragmentSpot.x, z: inst.fragmentSpot.z });
  }
  // The hunting cabins' hearths (2026-11-07: carriage
  // at birth — every cabin mints, so no guard).
  for (const inst of huntingCabinInstancesInRect(worldSeed, spawn, weightsAtPos, rect)) {
    near({ ...inst.fragmentCarrier, x: inst.fragmentSpot.x, z: inst.fragmentSpot.z });
  }
  // The lesser groves' carved stones (the family's own
  // carriers — every instance mints, so no guard).
  for (const inst of groveInstancesInRect(worldSeed, spawn, weightsAtPos, rect)) {
    near({ ...inst.fragmentCarrier, x: inst.fragmentSpot.x, z: inst.fragmentSpot.z });
  }
  out.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  return out;
}
