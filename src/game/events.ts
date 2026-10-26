/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Minimal typed event bus — the SINGLE dispatch point for cross-system
 * communication in Silent Earth. Systems emit events here; they never call
 * each other directly. This is what makes the loop host-authority-shaped
 * for later P2P co-op: a future host can relay these same events to peers
 * instead of rewiring every system.
 *
 * Landing 1 events only, plus the proximity/harvest contract (2026-10-26):
 * the bus is the SHARED CONTRACT between this lane (proximity detection,
 * src/game/proximity.ts) and the UI lane (harvest buttons). Nothing is
 * agreed outside it: UI renders buttons from 'harvest:inRange' and fires
 * 'harvest:requested' when one is pressed. The OUTCOME (items into
 * inventory) is the next step, not this landing — no listener grants
 * items yet; Systems will consume 'harvest:requested'.
 */

import type { CameraMode } from '../types';
import type { PermitTier } from './objects';

export interface EventMap {
  /** A new world seed was set (initial load or regenerate). */
  'world:seedSet': { seed: string };
  /** A chunk's meshes were built and added to the scene. */
  'world:chunkLoaded': { cx: number; cz: number; objectCount: number };
  /** A chunk's meshes were removed from the scene. */
  'world:chunkUnloaded': { cx: number; cz: number };
  /** Player position changed (throttled to ~10 Hz by the controller). */
  'player:moved': { x: number; z: number; chunkX: number; chunkZ: number };
  /** Camera mode toggled (V or C). */
  'camera:switched': { mode: CameraMode };
  /**
   * In-range harvest targets changed (enter/leave only — the tracker
   * diffs by target id, so steady walking does not spam UI). UI renders
   * one harvest button per target and hides buttons for targets that
   * left. A target is a scatter source within HARVEST_RANGE, or the
   * ground material underfoot (always in range, distance 0, kind
   * 'ground'). permitTier is carried so UI/Systems can filter by the
   * tool she holds; proximity itself does NOT gate by tool (it does
   * not know her tool — Systems owns that). Distance is the value at
   * emission time; it does not by itself trigger a re-emit.
   */
  'harvest:inRange': {
    targets: {
      /** Stable id: 'scatter:<chunk>:<kind>:<x>:<z>' or 'ground:<material>'. */
      id: string;
      /** Scatter source id, or the ground material id (dirt/mud/grass). */
      sourceId: string;
      kind: 'scatter' | 'ground';
      /** Scatter object position, or her position for ground. */
      x: number;
      z: number;
      /** Metres from her, at emission time. */
      distance: number;
      /** Display name for the button label. */
      name: string;
      /** Primary yield item id. */
      primaryYield: string;
      /** Lowest tool tier that permits it ('hand' = no tool needed). */
      permitTier: PermitTier;
    }[];
  };
  /**
   * A harvest button was pressed. UI emits this; NO listener grants
   * items in this landing — that outcome is the next step (Systems).
   * The payload identifies the target exactly as 'harvest:inRange'
   * described it, so Systems can re-validate range + permit at
   * outcome time rather than trusting the button.
   */
  'harvest:requested': {
    targetId: string;
    sourceId: string;
    kind: 'scatter' | 'ground';
    x: number;
    z: number;
  };
}

type Handler<E> = (payload: E) => void;

export class EventBus {
  private listeners = new Map<keyof EventMap, Set<Handler<never>>>();

  on<K extends keyof EventMap>(type: K, handler: Handler<EventMap[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => set!.delete(handler as Handler<never>);
  }

  emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    // Copy: a handler may unsubscribe mid-dispatch.
    for (const handler of [...set]) {
      (handler as Handler<EventMap[K]>)(payload);
    }
  }
}

/** Shared singleton. Import this; do not construct a second bus. */
export const bus = new EventBus();
