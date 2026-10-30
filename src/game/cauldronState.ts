/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACED-CAULDRON STATE (Adam 2026-10-30 — the cauldron
 * goes ON a hearth and is its OWN target, distinct from
 * the hearth fire beneath it). The deskState/altarState
 * pattern with the binding as the essence: a cauldron
 * belongs to exactly one hearth, named by the fire
 * entity's id, and that hearthId is the cauldron's WHOLE
 * identity — Systems' save shape (SavedCauldron) stores
 * the hearthId and nothing else (no position, no
 * cauldron id), and the place/pickup grants are keyed
 * by it too.
 *
 * ONE PER HEARTH, BY CONSTRUCTION: the internal map is
 * keyed by hearthId. placeCauldron on a hearth that
 * already bears one returns the existing record (no
 * duplicate, no second event) — validity (a cauldron
 * carried, the hearth free) is Systems' grant's gate,
 * certified by the shell; this state is the record.
 *
 * BINDING: unlike the bus-only state singletons, this
 * module reads fireState — the landed save contract
 * forces it: a saved cauldron is only a hearthId, so
 * placing and restoring must RESOLVE the id against
 * the live fires to recover the position, and drop
 * what cannot bind (unknown id, or a fire that is not
 * a hearth — a pot on a campfire is corrupt data, not
 * a cauldron). The dependency runs one way only:
 * fireState never reads this module. A record's x/z
 * are the hearth's position, resolved at place/restore
 * time — position is a cache of the binding, never a
 * second truth. Boot order rides the existing one:
 * the shell restores fires before cauldrons (fires
 * restore before renderer construction, as always), so
 * every legitimate hearthId resolves.
 *
 * NO LIT GATE (Systems' grant ruling): she sets the pot
 * on the hearth before she lights it; whether the
 * hearth burns is the station feed's concern, never
 * this state's. PICKUP IS BUILT (Systems, a stated
 * divergence from the desk/altar precedent): the
 * cauldron travels between hearths — removeCauldron is
 * the pickup path's second half, called by the shell
 * after Systems' pickup grant succeeds.
 */

import { bus } from './events';
import { fireState } from './fireState';

/** A placed cauldron. Its identity is its hearth's id. */
export interface PlacedCauldron {
  hearthId: string;
  x: number;
  z: number;
}

class CauldronState {
  private cauldrons = new Map<string, PlacedCauldron>();

  /**
   * Record a cauldron on the hearth named by hearthId,
   * resolving the hearth from live fireState. Returns
   * the record (the existing one if the hearth already
   * bears a cauldron), or undefined when the id cannot
   * bind — unknown fire, or a fire that is not a
   * hearth. Emits 'cauldron:placed' on a new record
   * only.
   */
  placeCauldron(hearthId: string): PlacedCauldron | undefined {
    const existing = this.cauldrons.get(hearthId);
    if (existing) return { ...existing };
    const fire = fireState.get(hearthId);
    if (!fire || fire.type !== 'hearth') return undefined;
    const record: PlacedCauldron = { hearthId, x: fire.x, z: fire.z };
    this.cauldrons.set(hearthId, record);
    bus.emit('cauldron:placed', { hearthId, x: fire.x, z: fire.z });
    return { ...record };
  }

  /** The pickup path: drop the record on hearthId. */
  removeCauldron(hearthId: string): boolean {
    if (!this.cauldrons.has(hearthId)) return false;
    this.cauldrons.delete(hearthId);
    bus.emit('cauldron:removed', { hearthId });
    return true;
  }

  /** The cauldron on a hearth, if it bears one. */
  cauldronForHearth(hearthId: string): PlacedCauldron | undefined {
    const record = this.cauldrons.get(hearthId);
    return record ? { ...record } : undefined;
  }

  get(hearthId: string): PlacedCauldron | undefined {
    return this.cauldronForHearth(hearthId);
  }

  /** Copies, never aliases (trap snapshot precedent). */
  snapshot(): PlacedCauldron[] {
    return [...this.cauldrons.values()].map((record) => ({ ...record }));
  }

  /**
   * Boot restore from the save shape: entries carry a
   * hearthId and nothing else (Systems' SavedCauldron).
   * Silent — the caller rebuilds once. Each entry binds
   * against live fireState or drops: unknown ids,
   * non-hearth fires, empty/non-string ids, and
   * non-object entries all drop, and a corrupt entry
   * can never take the world with it. Duplicate
   * hearthIds collapse (one per hearth). A non-array
   * input is ignored entirely (state untouched).
   * fireState must already hold the restored fires —
   * the shell's boot order guarantees it.
   */
  restore(cauldrons: ReadonlyArray<{ hearthId: string }>): void {
    if (!Array.isArray(cauldrons)) return;
    this.cauldrons.clear();
    for (const entry of cauldrons) {
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.hearthId !== 'string' || entry.hearthId === '') continue;
      if (this.cauldrons.has(entry.hearthId)) continue;
      const fire = fireState.get(entry.hearthId);
      if (!fire || fire.type !== 'hearth') continue;
      this.cauldrons.set(entry.hearthId, {
        hearthId: entry.hearthId,
        x: fire.x,
        z: fire.z,
      });
    }
  }

  clear(): void {
    this.cauldrons.clear();
  }
}

export const cauldronState = new CauldronState();
