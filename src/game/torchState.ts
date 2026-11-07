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
 * KIND (2026-11-07 — the pitch torch, DEV/Systems' shape):
 * the record carries the LIT ITEM ID it was planted from
 * ('lit-torch', or 'lit-pitch-torch' for the pitch torch)
 * as a plain string — the renderer keys its light profile
 * off it, and the pickup grant returns the same kind.
 * placeTorch's kind defaults to the standing 'lit-torch',
 * and a restore entry without a usable kind reads as the
 * standing torch, so every pre-pitch save stands unchanged.
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

/** A placed torch entity. Always lit; position + the lit kind it was planted from. */
export interface PlacedTorch {
  id: string;
  x: number;
  z: number;
  /** The lit item id ('lit-torch' | 'lit-pitch-torch'); the renderer's light-profile key. */
  kind: string;
}

/** The standing torch's lit item id — the default kind, and every old save's reading. */
export const STANDING_TORCH_KIND = 'lit-torch';

class TorchState {
  private torches = new Map<string, PlacedTorch>();
  private counter = 0;

  placeTorch(x: number, z: number, kind: string = STANDING_TORCH_KIND): PlacedTorch {
    const id = `torch:${++this.counter}`;
    const torch: PlacedTorch = { id, x, z, kind: kind === '' ? STANDING_TORCH_KIND : kind };
    this.torches.set(id, torch);
    bus.emit('torch:placed', { id, x, z, kind: torch.kind });
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
      const kind =
        typeof torch.kind === 'string' && torch.kind !== '' ? torch.kind : STANDING_TORCH_KIND;
      this.torches.set(torch.id, { id: torch.id, x: torch.x, z: torch.z, kind });
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
