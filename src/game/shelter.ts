/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SHELTER PLACEMENT SYSTEM + ENTITIES (MVP build round, Adam
 * 2026-10-26) — engine side.
 *
 * PLACEMENT IS FREE (Adam, 2026-10-26, PINNED): no zones, no
 * plots. She places a house/hut anywhere she likes; biomes are
 * continuous fields, so nothing gates placement. placeHouse is
 * a cost-free engine primitive — recipe/cost gating lives with
 * Systems + UI, not here.
 *
 * HOUSING LADDER (Adam, 2026-10-25/26): lean-to → thatch hut →
 * Woven Cottage (the wattle-and-daub + woven cottage merge, one
 * stage) → small wooden hut. HOME FUNCTION + SIZE RULE (Adam,
 * PINNED): each type holds more supplies safe from the elements
 * and is progressively larger.
 *
 * NUMBERS — READ THE LABELS:
 * - Lean-to storage 50 is PINNED (Adam, 2026-10-25).
 * - Every other number below is a LANE-DECIDED starting tunable
 *   for Adam's pin pass, NOT pinned: storage per upgrade
 *   (100/200/400), shelter multipliers (0.7/0.5/0.35/0.2 — the
 *   fraction of harshness that REMAINS inside), footprints
 *   (2.5/3.5/5/6.5 m), and SHELTER_RADIUS (6 m: standing within
 *   this of a house center counts as sheltered AT that house).
 * - Storage capacities are DATA for Systems' home-storage
 *   system: no storage behavior is built here (Systems owns
 *   storage mechanics + recipes). The shelter query is the live
 *   engine side: shelterQuery() closes over this state, so
 *   houses placed later count without re-wiring.
 *
 * "Sheltered = at her placed house, wherever placed" (Adam's
 * brief): the query takes the BEST (lowest multiplier) house
 * within radius, else 1 (unsheltered). It keys on placed-house
 * POSITION — never on a zone or plot, because there are none.
 */

import { bus } from './events';
import type { ShelterQuery } from './weather';

/** Placeable house types, in ladder order. */
export type HouseType = 'leanTo' | 'thatchHut' | 'wovenCottage' | 'smallWoodenHut';

export interface HouseDef {
  id: HouseType;
  name: string;
  description: string;
  /** Supplies held safe from the elements (Systems' storage data). */
  storageCapacity: number;
  /** Fraction of harshness remaining when sheltered here (lower = safer). */
  shelterMultiplier: number;
  /** Footprint width in metres (render scale; grows up the ladder). */
  footprint: number;
}

export const HOUSE_DEFS: Record<HouseType, HouseDef> = {
  leanTo: {
    id: 'leanTo',
    name: 'Lean-To',
    description: 'A slanted roof on poles — the first roof over her head.',
    storageCapacity: 50,
    shelterMultiplier: 0.7,
    footprint: 2.5,
  },
  thatchHut: {
    id: 'thatchHut',
    name: 'Thatch Hut',
    description: 'A round hut under a thatch roof.',
    storageCapacity: 100,
    shelterMultiplier: 0.5,
    footprint: 3.5,
  },
  wovenCottage: {
    id: 'wovenCottage',
    name: 'Woven Cottage',
    description: 'Wattle and daub, woven tight — a real cottage.',
    storageCapacity: 200,
    shelterMultiplier: 0.35,
    footprint: 5,
  },
  smallWoodenHut: {
    id: 'smallWoodenHut',
    name: 'Small Wooden Hut',
    description: 'A proper wooden hut, built from cut logs.',
    storageCapacity: 400,
    shelterMultiplier: 0.2,
    footprint: 6.5,
  },
};

/** Standing within this of a house center counts as sheltered there. */
export const SHELTER_RADIUS = 6;

/** A placed house entity. */
export interface PlacedHouse {
  id: string;
  type: HouseType;
  x: number;
  z: number;
}

/**
 * Best shelter multiplier at (x, z) among a house list: the
 * lowest multiplier within radius, else 1. Pure helper, so the
 * query and probes share one rule.
 */
export function shelterMultiplierAt(x: number, z: number, houses: PlacedHouse[]): number {
  let best = 1;
  for (const house of houses) {
    if (Math.hypot(house.x - x, house.z - z) <= SHELTER_RADIUS) {
      best = Math.min(best, HOUSE_DEFS[house.type].shelterMultiplier);
    }
  }
  return best;
}

/**
 * Nearest sheltering house at (x, z): the multiplier from
 * shelterMultiplierAt plus the id of the house that provides it
 * (nearest within radius on ties — first found wins). Null id
 * when unsheltered. The tracker's 'shelter:changed' payload.
 */
export function shelterAt(
  x: number,
  z: number,
  houses: PlacedHouse[],
): { multiplier: number; houseId: string | null } {
  let best: PlacedHouse | null = null;
  let bestDist = Infinity;
  for (const house of houses) {
    const d = Math.hypot(house.x - x, house.z - z);
    if (d <= SHELTER_RADIUS && d < bestDist) {
      best = house;
      bestDist = d;
    }
  }
  return {
    multiplier: best ? HOUSE_DEFS[best.type].shelterMultiplier : 1,
    houseId: best ? best.id : null,
  };
}

class ShelterState {
  private houses = new Map<string, PlacedHouse>();
  private counter = 0;

  placeHouse(type: HouseType, x: number, z: number): PlacedHouse {
    const id = `house:${type}:${++this.counter}`;
    const house: PlacedHouse = { id, type, x, z };
    this.houses.set(id, house);
    bus.emit('shelter:placed', { id, type, x, z });
    return house;
  }

  get(id: string): PlacedHouse | undefined {
    return this.houses.get(id);
  }

  snapshot(): PlacedHouse[] {
    return [...this.houses.values()];
  }

  clear(): void {
    this.houses.clear();
    this.counter = 0;
  }

  /** Live shelter query for exposureAtPosition: reads current houses. */
  query(): ShelterQuery {
    return (x, z) => shelterMultiplierAt(x, z, this.snapshot());
  }
}

export const shelterState = new ShelterState();
