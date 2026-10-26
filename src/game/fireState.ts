/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACED-FIRE STATE + LIGHTING MACHINE (MVP build round, Adam
 * 2026-10-26). Mirrors the harvestState pattern: a dependency-free
 * singleton (imports only the bus + fire defs) that the renderer
 * and the shell both read, so neither imports the other for it.
 *
 * PLACEMENT: free — no zone, plot, or biome gate (same free-
 * placement rule as houses). placeFire is a cost-free engine
 * primitive; recipe/cost gating lives with Systems + UI.
 *
 * LIGHTING MACHINE (two paths, Adam's shapes):
 * - Flint: startLighting(method 'flint') opens a click process;
 *   each flintClick adds one; at FLINT_CLICKS the fire lights.
 * - Friction: startLighting(method 'friction') opens a rub
 *   process in phase 'waiting' (waitUntil = now +
 *   FRICTION_WAIT_MS). A rub before the wait ends is wasted
 *   ('still-waiting', wait NOT reset); a rub at/after the wait
 *   ends lights the fire. advanceLighting(now) moves
 *   'waiting' → 'ready' for display once the wait passes.
 * A lit fire stays lit (no extinguish/fuel in this MVP — see
 * fire.ts). Method availability (does she HAVE flint?) is the
 * caller's check (Systems inventory + UI), not this machine's:
 * startLighting takes the method at face value.
 *
 * Time is wall-clock ms (Date.now()); callers that need
 * deterministic tests pass `now` explicitly, like harvestState.
 */

import { bus } from './events';
import {
  FLINT_CLICKS,
  FRICTION_WAIT_MS,
  type FireType,
  type LightingMethod,
} from './fire';

/** Lighting in progress on an unlit fire. */
export type LightingProcess =
  | { method: 'flint'; clicks: number }
  | { method: 'friction'; phase: 'waiting' | 'ready'; waitUntil: number };

/** A placed fire entity. */
export interface PlacedFire {
  id: string;
  type: FireType;
  x: number;
  z: number;
  lit: boolean;
  lighting: LightingProcess | null;
}

export type FireResult =
  | { ok: true; fire: PlacedFire }
  | { ok: false; reason: string };

class FireState {
  private fires = new Map<string, PlacedFire>();
  private counter = 0;

  placeFire(type: FireType, x: number, z: number): PlacedFire {
    const id = `fire:${type}:${++this.counter}`;
    const fire: PlacedFire = { id, type, x, z, lit: false, lighting: null };
    this.fires.set(id, fire);
    bus.emit('fire:placed', { id, type, x, z });
    return fire;
  }

  get(id: string): PlacedFire | undefined {
    return this.fires.get(id);
  }

  snapshot(): PlacedFire[] {
    return [...this.fires.values()];
  }

  clear(): void {
    this.fires.clear();
    this.counter = 0;
  }

  startLighting(id: string, method: LightingMethod, now: number): FireResult {
    const fire = this.fires.get(id);
    if (!fire) return { ok: false, reason: 'unknown-fire' };
    if (fire.lit) return { ok: false, reason: 'already-lit' };
    if (fire.lighting) return { ok: false, reason: 'already-lighting' };
    fire.lighting =
      method === 'flint'
        ? { method: 'flint', clicks: 0 }
        : { method: 'friction', phase: 'waiting', waitUntil: now + FRICTION_WAIT_MS };
    bus.emit('fire:lighting', {
      id,
      type: fire.type,
      method,
      clicks: 0,
      phase: method === 'friction' ? 'waiting' : null,
    });
    return { ok: true, fire };
  }

  flintClick(id: string): FireResult {
    const fire = this.fires.get(id);
    if (!fire) return { ok: false, reason: 'unknown-fire' };
    if (fire.lit) return { ok: false, reason: 'already-lit' };
    if (!fire.lighting || fire.lighting.method !== 'flint') {
      return { ok: false, reason: 'not-lighting' };
    }
    fire.lighting.clicks += 1;
    if (fire.lighting.clicks >= FLINT_CLICKS) {
      fire.lit = true;
      fire.lighting = null;
      bus.emit('fire:lit', { id, type: fire.type, x: fire.x, z: fire.z, method: 'flint' });
    } else {
      bus.emit('fire:lighting', {
        id,
        type: fire.type,
        method: 'flint',
        clicks: fire.lighting.clicks,
        phase: null,
      });
    }
    return { ok: true, fire };
  }

  frictionRub(id: string, now: number): FireResult {
    const fire = this.fires.get(id);
    if (!fire) return { ok: false, reason: 'unknown-fire' };
    if (fire.lit) return { ok: false, reason: 'already-lit' };
    if (!fire.lighting || fire.lighting.method !== 'friction') {
      return { ok: false, reason: 'not-lighting' };
    }
    if (fire.lighting.phase === 'waiting' && now < fire.lighting.waitUntil) {
      return { ok: false, reason: 'still-waiting' };
    }
    fire.lit = true;
    fire.lighting = null;
    bus.emit('fire:lit', { id, type: fire.type, x: fire.x, z: fire.z, method: 'friction' });
    return { ok: true, fire };
  }

  /** Move friction waits that have elapsed into 'ready' (display). */
  advanceLighting(now: number): void {
    for (const fire of this.fires.values()) {
      if (
        fire.lighting &&
        fire.lighting.method === 'friction' &&
        fire.lighting.phase === 'waiting' &&
        now >= fire.lighting.waitUntil
      ) {
        fire.lighting.phase = 'ready';
        bus.emit('fire:lighting', {
          id: fire.id,
          type: fire.type,
          method: 'friction',
          clicks: 0,
          phase: 'ready',
        });
      }
    }
  }
}

export const fireState = new FireState();
