/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACED-TORCH STATE (Adam 2026-10-27 — place a carried lit
 * torch to light an area or path; pick it back up). Mirrors
 * the fireState pattern: a dependency-free singleton (imports
 * only the bus) that the renderer and the shell both read, so
 * neither imports the other for it.
 *
 * PLACEMENT: free — no zone, plot, or biome gate (same free-
 * placement rule as fires/houses). placeTorch is a cost-free
 * engine primitive; the cost gating (consume one carried
 * 'lit-torch') lives with Systems + UI, and the pickup grant
 * (return 'lit-torch', lit not unlit) lives with Systems.
 *
 * ALWAYS LIT: a placed torch IS a lit torch — no lit flag, no
 * lighting machine, no burnout/duration (Adam's torch pin
 * extended). The entity shape is therefore just id + position.
 *
 * SAVE SHAPE (proposal for Systems — mirrors SavedFire minus
 * type/lit/lighting): SavedTorch { id, x, z }; boot calls
 * torchState.restore(saved.torches) BEFORE renderer
 * construction (fire pattern), and the constructor's initial
 * rebuildPlacedGroup picks the restored torches up.
 * restore() is silent — the caller rebuilds once (trap
 * restore precedent). A non-array restore input is ignored
 * entirely (state untouched — a corrupt save must not wipe
 * a live world); invalid entries inside an array are dropped.
 */

import { bus } from './events';

/** A placed torch entity. Always lit; position is the whole state. */
export interface PlacedTorch {
  id: string;
  x: number;
  z: number;
}

class TorchState {
  private torches = new Map<string, PlacedTorch>();
  private counter = 0;

  placeTorch(x: number, z: number): PlacedTorch {
    const id = `torch:${++this.counter}`;
    const torch: PlacedTorch = { id, x, z };
    this.torches.set(id, torch);
    bus.emit('torch:placed', { id, x, z });
    return torch;
  }

  removeTorch(id: string): boolean {
    if (!this.torches.has(id)) return false;
    this.torches.delete(id);
    bus.emit('torch:removed', { id });
    return true;
  }

  get(id: string): PlacedTorch | undefined {
    const torch = this.torches.get(id);
    return torch ? { ...torch } : undefined;
  }

  /** Copies, never aliases (trap snapshot precedent). */
  snapshot(): PlacedTorch[] {
    return [...this.torches.values()].map((torch) => ({ ...torch }));
  }

  restore(torches: ReadonlyArray<PlacedTorch>): void {
    if (!Array.isArray(torches)) return;
    this.torches.clear();
    let maxSuffix = 0;
    for (const torch of torches) {
      if (!torch || typeof torch !== 'object') continue;
      if (typeof torch.id !== 'string' || torch.id === '') continue;
      if (!Number.isFinite(torch.x) || !Number.isFinite(torch.z)) continue;
      this.torches.set(torch.id, { id: torch.id, x: torch.x, z: torch.z });
      const suffix = Number(torch.id.split(':').pop());
      if (Number.isFinite(suffix) && suffix > maxSuffix) maxSuffix = suffix;
    }
    this.counter = maxSuffix;
  }

  clear(): void {
    this.torches.clear();
    this.counter = 0;
  }
}

export const torchState = new TorchState();
