/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACED-TRAP STATE (Adam 2026-10-26 — placement rule only).
 * Mirrors the fireState/shelterState/loomState pattern: a
 * dependency-free singleton (imports only the bus + defs)
 * that the renderer and the shell both read, so neither
 * imports the other for it.
 *
 * ADAM'S RULE: crafting a trap places it right there. The
 * caller at craft-success time calls placeTrap(type, x, z)
 * — at her position — and this module stores the trap and
 * emits 'trap:placed', which the renderer listens to.
 *
 * EMIT OWNERSHIP — READ BEFORE WIRING: no Systems emit of
 * 'trap:placed' exists today (grep-verified: zero hits in
 * src/). placeTrap OWNS this emit, fireState-style. The
 * craft-success call site (shell and/or Systems) is the
 * follow-up, and exactly ONE caller must place per craft:
 * either the shell calls placeTrap, or Systems emits
 * 'trap:placed' directly — never both, or one craft places
 * two traps. This module does not pick the caller.
 *
 * SAVE SEAM: snapshot() + restore() are the persistence
 * seam (same shape as fires/houses/looms/piles). SaveData
 * has no traps field today (Systems' save.ts) and App
 * snapshot/restore wiring is UI's — those are the
 * follow-up; placement is not blocked on them. restore()
 * is silent (no per-trap emit; the caller rebuilds once)
 * and drops invalid records, the way save filters them.
 *
 * SCOPE: placement only. No catch, check, bait, or decay
 * behavior; traps are not harvest targets. setWorldGen
 * clears traps (new world = new traps, like fires/houses/
 * looms/piles).
 */

import { bus } from './events';
import { isTrapType, type TrapType } from './traps';

/** A placed trap entity. */
export interface PlacedTrap {
  id: string;
  type: TrapType;
  x: number;
  z: number;
}

class TrapState {
  private traps = new Map<string, PlacedTrap>();
  private counter = 0;

  placeTrap(type: TrapType, x: number, z: number): PlacedTrap {
    const id = `trap:${type}:${++this.counter}`;
    const trap: PlacedTrap = { id, type, x, z };
    this.traps.set(id, trap);
    bus.emit('trap:placed', { id, type, x, z });
    return trap;
  }

  get(id: string): PlacedTrap | undefined {
    return this.traps.get(id);
  }

  snapshot(): PlacedTrap[] {
    return [...this.traps.values()];
  }

  /** Silent bulk restore (save boot path): replaces state, drops invalid records. */
  restore(placed: ReadonlyArray<PlacedTrap>): void {
    this.traps.clear();
    let maxSuffix = 0;
    for (const trap of placed) {
      if (!isTrapType(trap.type) || !Number.isFinite(trap.x) || !Number.isFinite(trap.z)) continue;
      if (typeof trap.id !== 'string' || trap.id === '') continue;
      this.traps.set(trap.id, { id: trap.id, type: trap.type, x: trap.x, z: trap.z });
      const suffix = Number(trap.id.split(':').pop());
      if (Number.isFinite(suffix) && suffix > maxSuffix) maxSuffix = suffix;
    }
    this.counter = maxSuffix;
  }

  clear(): void {
    this.traps.clear();
    this.counter = 0;
  }
}

export const trapState = new TrapState();
