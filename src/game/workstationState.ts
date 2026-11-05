/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACED-WORKSTATION STATE (the fix, 2026-11-05 — Adam
 * crafted a bench on the live build and found no Place
 * in his pack; Systems' landing 7dcc026 built the place
 * grant + the save seat, and this is the entity those
 * hand to). Mirrors the deskState pattern whole: a
 * dependency-free singleton (imports only the bus) that
 * the renderer and the shell both read, so neither
 * imports the other for it.
 *
 * PLACEMENT: free — no zone, plot, or biome gate (the
 * desk rule). workstationState.placeWorkstation is a
 * cost-free engine primitive; the cost gating (the
 * carried bench consumed on Place, Systems'
 * placeWorkstation grant in systems/workstation.ts)
 * lives with Systems + UI — the shell hands the grant
 * record's position to placeWorkstation, exactly as
 * desks hand theirs. MULTIPLE benches are legitimate
 * (a second camp wants a second bench).
 *
 * PICKUP (Adam, 2026-11-05 — "Haven't met the woman yet
 * who doesn't like to rearrange furniture"): a placed
 * bench CAN be picked up and moved. The pickup grant
 * is Systems' (a full pack leaves the piece standing);
 * removeWorkstation is the entity half the shell calls
 * on that grant's success, and the renderer rebuilds
 * from the event — the desk's removeDesk pattern, here
 * with a player's verb behind it.
 *
 * THE STATION: a placed bench supplies 'workstation'
 * presence where no stump stands (the wheel/loom forks
 * read it) — the shell's station feed reads snapshot()
 * for its faced-bench branch, the stump pattern: this
 * module keeps the facts, the feed keeps the ranges.
 *
 * SAVE SHAPE (Systems, landed): SavedCraftedWorkstation
 * { x, z, rotY?, id? } in save.ts — position always, the
 * rest draft-optional, exactly the SavedDesk shape.
 * restore() therefore accepts id-less entries and MINTS
 * ids for them, keeps provided ids, and resyncs the
 * counter past every provided numeric suffix. Boot
 * calls workstationState.restore(saved.craftedWorkstations)
 * BEFORE renderer construction (the desk pattern), and
 * the constructor's initial rebuildPlacedGroup picks
 * the restored benches up. restore() is silent — the
 * caller rebuilds once. A non-array restore input is
 * ignored entirely; invalid entries inside an array
 * are dropped; entry order is preserved.
 */

import { bus } from './events';

/** A placed crafted workstation: a site — position and
 *  facing (absent reads as 0, the desk shape). */
export interface PlacedWorkstationBench {
  id: string;
  x: number;
  z: number;
  rotY?: number;
}

class WorkstationState {
  private benches = new Map<string, PlacedWorkstationBench>();
  private counter = 0;

  placeWorkstation(x: number, z: number, rotY = 0): PlacedWorkstationBench {
    const id = `workstation:${++this.counter}`;
    const bench: PlacedWorkstationBench = { id, x, z, rotY };
    this.benches.set(id, bench);
    bus.emit('workstation:placed', { id, x, z, rotY });
    return bench;
  }

  /** The pickup's entity half (and the shell/save path's
   *  way to drop an entity). False on an unknown id. */
  removeWorkstation(id: string): boolean {
    if (!this.benches.has(id)) return false;
    this.benches.delete(id);
    bus.emit('workstation:removed', { id });
    return true;
  }

  get(id: string): PlacedWorkstationBench | undefined {
    const bench = this.benches.get(id);
    return bench ? { ...bench } : undefined;
  }

  /** Copies, never aliases (trap snapshot precedent). */
  snapshot(): PlacedWorkstationBench[] {
    return [...this.benches.values()].map((bench) => ({ ...bench }));
  }

  restore(benches: ReadonlyArray<{ id?: string; x: number; z: number; rotY?: number }>): void {
    if (!Array.isArray(benches)) return;
    this.benches.clear();
    // Ceiling first (the desk law): the counter must
    // clear every provided numeric suffix BEFORE any id
    // is minted below.
    let maxSuffix = 0;
    for (const bench of benches) {
      if (!bench || typeof bench !== 'object') continue;
      if (typeof bench.id === 'string') {
        const suffix = Number(bench.id.split(':').pop());
        if (Number.isFinite(suffix) && suffix > maxSuffix) maxSuffix = suffix;
      }
    }
    this.counter = maxSuffix;
    for (const bench of benches) {
      if (!bench || typeof bench !== 'object') continue;
      if (!Number.isFinite(bench.x) || !Number.isFinite(bench.z)) continue;
      const id =
        typeof bench.id === 'string' && bench.id !== ''
          ? bench.id
          : `workstation:${++this.counter}`;
      const restored: PlacedWorkstationBench = { id, x: bench.x, z: bench.z };
      if (Number.isFinite(bench.rotY)) restored.rotY = bench.rotY;
      this.benches.set(id, restored);
    }
  }

  clear(): void {
    this.benches.clear();
    this.counter = 0;
  }
}

export const workstationState = new WorkstationState();
