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
 * Ground targets in 'harvest:inRange' are look-down-gated (Adam,
 * 2026-10-26): proximity AND looking down, per proximity.ts.
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
  /**
   * Player look changed in first-person (throttled to ~10 Hz by the
   * controller). Exists because looking down while STANDING STILL must
   * still update proximity: 'player:moved' only fires while walking,
   * so a stationary look-down would otherwise never reach the tracker.
   * Pitch sign: negative = looking down (mouse-up raises pitch).
   */
  'player:looked': { pitch: number; mode: CameraMode };
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
    /**
     * What the press means. Omitted = 'harvest' (backward compatible
     * with every button already firing this event). 'remove' =
     * TOTALLY REMOVE the plant (Adam, 2026-10-26): a bigger one-time
     * yield, and the plant is gone permanently (no regrow). UI
     * renders the remove option alongside the normal harvest button
     * for removable sources (see harvest.ts); ground and
     * non-removable sources reject 'remove' with 'not-removable'.
     */
    action?: 'harvest' | 'remove';
  };
  /**
   * A harvest press resolved into items (harvest.ts outcome listener).
   * UI shows feedback from this and refreshes inventory. cx/cz are
   * the chunk containing the target, so the renderer can reload just
   * that chunk (the harvested object shrinks, or leaves on remove). Yields are already
   * merged by item (one entry per item).
   */
  'harvest:completed': {
    targetId: string;
    sourceId: string;
    kind: 'scatter' | 'ground';
    x: number;
    z: number;
    cx: number;
    cz: number;
    yields: { item: string; quantity: number }[];
    /** Which action produced this completion ('harvest' or 'remove'). */
    action: 'harvest' | 'remove';
  };
  /**
   * A multi-step harvest (prototype TUG/STOMP) advanced but has not
   * finished: progress is 0..1, no items granted, nothing shrinks or is removed.
   * UI shows progress from this; the next press on the same target
   * continues from this progress.
   */
  'harvest:progress': {
    targetId: string;
    sourceId: string;
    progress: number;
  };
  /**
   * A harvest press that granted NOTHING (failure/feedback event).
   * All-or-nothing: on any failure, no items move, nothing shrinks or is removed,
   * and multi-step progress is NOT consumed (a capacity failure at
   * full progress leaves progress at 1, so freeing space and pressing
   * again collects without redoing the steps). 'yields' carries the
   * attempted yields on 'inventory-full' only, so UI can name what
   * did not fit; it is empty otherwise.
   */
  'harvest:failed': {
    targetId: string;
    sourceId: string;
    kind: 'scatter' | 'ground';
    reason:
      | 'out-of-range'
      | 'regrowing'
      | 'removed'
      | 'not-removable'
      | 'below-permit'
      | 'permit-tbd'
      | 'anchor'
      | 'not-harvestable'
      | 'target-mismatch'
      | 'inventory-full';
    yields: { item: string; quantity: number }[];
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
