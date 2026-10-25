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
 * Landing 1 events only. Survival, harvest, and craft events arrive with
 * their systems in later landings.
 */

import type { CameraMode } from '../types';

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
