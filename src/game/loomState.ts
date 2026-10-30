/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACED-LOOM STATE (gap-closing round, Adam 2026-10-26).
 * Mirrors the fireState/shelterState pattern: a dependency-free
 * singleton (imports only the bus) that the renderer and the
 * shell both read, so neither imports the other for it.
 *
 * THE GAP IT CLOSES: garment recipes already carry station
 * 'loom' (Systems 0916b8e, src/systems/recipes.ts — all five
 * garment recipes, PINNED requirement), but no loom presence
 * existed, so garments were uncraftable in play. A placed loom
 * supplies station 'loom' the same way a stump supplies
 * 'workstation'. How presence feeds stations has changed
 * since: under Adam's faced-target law (2026-10-30) the loom
 * station feeds from the FACED loom in the shell's winner
 * race; stationPresence in harvest.ts still reads this
 * module's range query for its loom fact, which now serves
 * the shell's station-anchor derivation.
 *
 * STATION TAG — CONFIRMED MATCH: Systems' CraftingStation
 * (src/systems/recipes.ts) includes the literal 'loom', and
 * the loom recipe itself has id 'loom'. This module uses
 * that same literal nowhere as a string constant — so there
 * is no second spelling to drift.
 *
 * PLACEMENT: free — no zone, plot, or biome gate (same free-
 * placement rule as fires and houses). placeLoom is a
 * cost-free engine primitive; recipe/cost gating lives with
 * Systems + UI (the loom recipe in Systems: snapWood 6 +
 * twinedCordage 6, DRAFT cost). UI wires the Place button +
 * CraftingMenu presence after this landing.
 *
 * RANGE: presence follows the workstation precedent — a loom
 * within HARVEST_RANGE (2.5 m) of her position counts (see
 * stationPresence). No different range is flagged; the
 * precedent was explicitly approved for this landing.
 */

import { bus } from './events';

/** A placed loom entity. */
export interface PlacedLoom {
  id: string;
  x: number;
  z: number;
}

class LoomState {
  private looms = new Map<string, PlacedLoom>();
  private counter = 0;

  placeLoom(x: number, z: number): PlacedLoom {
    const id = `loom:${++this.counter}`;
    const loom: PlacedLoom = { id, x, z };
    this.looms.set(id, loom);
    bus.emit('loom:placed', { id, x, z });
    return loom;
  }

  get(id: string): PlacedLoom | undefined {
    return this.looms.get(id);
  }

  snapshot(): PlacedLoom[] {
    return [...this.looms.values()];
  }

  clear(): void {
    this.looms.clear();
    this.counter = 0;
  }

  /** True when any placed loom is within `range` metres of (x, z). */
  loomsInRange(x: number, z: number, range: number): boolean {
    for (const loom of this.looms.values()) {
      if (Math.hypot(loom.x - x, loom.z - z) <= range) return true;
    }
    return false;
  }
}

export const loomState = new LoomState();
