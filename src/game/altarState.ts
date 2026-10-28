/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACED-ALTAR STATE (Adam 2026-10-27 — made ritual altars,
 * placeable in game, visible). Mirrors the torchState
 * pattern: a dependency-free singleton (imports only the
 * bus) that the renderer and the shell both read, so
 * neither imports the other for it.
 *
 * PLACEMENT: free — no zone, plot, or biome gate (same free-
 * placement rule as fires/houses/torches). placeAltar is a
 * cost-free engine primitive; the cost gating (craft recipe
 * + carried altar consumed on Place, Systems' draft: river
 * stone 4 + snap-wood 2 + clay 2 + cordage 2, station 'hand')
 * lives with Systems + UI. Removal mechanics are NOT in
 * this order (UI's chip is label-only for now) — removeAltar
 * exists for the same reason removeTorch does: the shell and
 * the save path need a way to drop an entity, and the
 * renderer rebuilds from the event either way.
 *
 * NO RITUAL STATE: an altar is a SITE, not an action — what
 * happens at stump/altar is still undesigned, so the entity
 * shape is just id + position (no ritual, offering, or
 * blessing fields). The stump's altar role is separate
 * (stumps are felled-tree objects, not this entity) and
 * activates with rituals, not here.
 *
 * SAVE SHAPE (proposal for Systems — mirrors SavedTorch):
 * SavedAltar { id, x, z }; boot calls altarState.restore
 * (saved.altars) BEFORE renderer construction (fire/torch
 * pattern), and the constructor's initial rebuildPlacedGroup
 * picks the restored altars up. restore() is silent — the
 * caller rebuilds once (trap restore precedent). A non-array
 * restore input is ignored entirely (state untouched — a
 * corrupt save must not wipe a live world); invalid entries
 * inside an array are dropped.
 */

import { bus } from './events';

/** A placed altar entity. A site only; position is the whole state. */
export interface PlacedAltar {
  id: string;
  x: number;
  z: number;
}

class AltarState {
  private altars = new Map<string, PlacedAltar>();
  private counter = 0;

  placeAltar(x: number, z: number): PlacedAltar {
    const id = `altar:${++this.counter}`;
    const altar: PlacedAltar = { id, x, z };
    this.altars.set(id, altar);
    bus.emit('altar:placed', { id, x, z });
    return altar;
  }

  removeAltar(id: string): boolean {
    if (!this.altars.has(id)) return false;
    this.altars.delete(id);
    bus.emit('altar:removed', { id });
    return true;
  }

  get(id: string): PlacedAltar | undefined {
    const altar = this.altars.get(id);
    return altar ? { ...altar } : undefined;
  }

  /** Copies, never aliases (trap snapshot precedent). */
  snapshot(): PlacedAltar[] {
    return [...this.altars.values()].map((altar) => ({ ...altar }));
  }

  restore(altars: ReadonlyArray<PlacedAltar>): void {
    if (!Array.isArray(altars)) return;
    this.altars.clear();
    let maxSuffix = 0;
    for (const altar of altars) {
      if (!altar || typeof altar !== 'object') continue;
      if (typeof altar.id !== 'string' || altar.id === '') continue;
      if (!Number.isFinite(altar.x) || !Number.isFinite(altar.z)) continue;
      this.altars.set(altar.id, { id: altar.id, x: altar.x, z: altar.z });
      const suffix = Number(altar.id.split(':').pop());
      if (Number.isFinite(suffix) && suffix > maxSuffix) maxSuffix = suffix;
    }
    this.counter = maxSuffix;
  }

  clear(): void {
    this.altars.clear();
    this.counter = 0;
  }
}

export const altarState = new AltarState();
