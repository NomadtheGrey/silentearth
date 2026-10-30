/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DIMENSION STATE (Adam, 2026-10-30 — the cave machinery).
 *
 * The active-dimension fact, and nothing else. Dimensions
 * are framed as their own little pocket worlds: the
 * overworld is dimension 0 (key 'surface'), each cave is
 * its own dimension keyed by a stable string label
 * ('cave:<mouth-id>') — never a sequence number, so adding
 * a dimension can never renumber an existing one and
 * orphan its records. Wherever a numeric seed is needed
 * it derives from the label by the world's own idiom
 * (deriveSeed(worldSeed, 'dimension:<key>')) — see
 * caves.ts.
 *
 * This module holds SESSION state only: which dimension
 * she is in, which mouth she entered by, which layer she
 * stands on. It does not move her (dimensionTravel does,
 * validated), does not render (the renderer reads the
 * active key for its sky/fog gate), and does not persist
 * (Systems' boot-at-the-mouth fact wires through the
 * snapshot shape below when their piece lands).
 *
 * Placed state inside a dimension needs dimension-keyed
 * records; v1 caves are VISIT-ONLY, so no placed-state
 * module reads this yet. The key is the seam they will
 * read when the scoping piece lands.
 */

import { bus } from './events';

/** The overworld's dimension key (dimension 0). */
export const SURFACE_DIMENSION_KEY = 'surface';

export interface DimensionSnapshot {
  /** Active dimension key ('surface' at boot). */
  key: string;
  /** The surface mouth she entered by, when underground. */
  mouthId: string | null;
  /** Layer inside the dimension (1-based; 1 on the surface). */
  layer: number;
}

class DimensionState {
  private key: string = SURFACE_DIMENSION_KEY;
  private mouthId: string | null = null;
  private layer = 1;

  /** The active dimension's key. */
  activeKey(): string {
    return this.key;
  }

  /** True when she is in any non-surface dimension. */
  isUnderground(): boolean {
    return this.key !== SURFACE_DIMENSION_KEY;
  }

  /** The mouth she entered by (null on the surface). */
  enteredBy(): string | null {
    return this.mouthId;
  }

  /** Her current layer inside the active dimension. */
  currentLayer(): number {
    return this.layer;
  }

  /**
   * Record an entry (dimensionTravel calls this AFTER the
   * swap has landed). Emits 'dimension:entered'.
   */
  enter(key: string, mouthId: string): void {
    this.key = key;
    this.mouthId = mouthId;
    this.layer = 1;
    bus.emit('dimension:entered', { key, mouthId });
  }

  /**
   * Record an exit back to the surface (dimensionTravel,
   * after the swap). Emits 'dimension:exited' with the key
   * of the dimension left.
   */
  exit(): void {
    const left = this.key;
    this.key = SURFACE_DIMENSION_KEY;
    this.mouthId = null;
    this.layer = 1;
    if (left !== SURFACE_DIMENSION_KEY) {
      bus.emit('dimension:exited', { key: left });
    }
  }

  /** Record a layer change inside the active dimension. */
  setLayer(layer: number): void {
    this.layer = layer;
    bus.emit('dimension:layer', { key: this.key, layer });
  }

  /**
   * The boot-fact shape (Systems' save piece): which
   * dimension + mouth a save was written in, or null on
   * the surface. Session state is NOT restored from this —
   * boot always starts on the surface; the shell uses the
   * fact to place her at the mouth (the boot-at-the-mouth
   * default) when their wiring lands.
   */
  snapshot(): DimensionSnapshot {
    return { key: this.key, mouthId: this.mouthId, layer: this.layer };
  }

  /** Test/boot reset: back to the surface, no events. */
  clear(): void {
    this.key = SURFACE_DIMENSION_KEY;
    this.mouthId = null;
    this.layer = 1;
  }
}

/** The shared dimension state singleton. */
export const dimensionState = new DimensionState();
