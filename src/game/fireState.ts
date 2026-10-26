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
 * PAUSE SHIFT (pause follow-up, Adam 2026-10-26): waitUntil is
 * wall-clock, so a pause would otherwise let a friction wait
 * elapse while frozen — the engine loop + shell interval stop
 * calling advanceLighting during pause, but the deadline keeps
 * its wall-clock value, so the first tick after resume would
 * flip 'ready' (and the rub check, which reads waitUntil, would
 * pass). This state subscribes to 'game:pause-changed': on pause
 * it snapshots the ids of friction waits in 'waiting'; on resume
 * it shifts those still waiting by the paused duration. Waits
 * begun during a pause are not snapshotted and never shift;
 * 'ready' waits and flint processes have no pending deadline and
 * never shift. Systems' own fire ticks are count-based (tick(1)
 * per gated interval second), not deadline-based — freezing the
 * interval freezes them, so the deadline problem does not apply
 * there (Systems' call to confirm, not this module's).
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
  /** Wall-clock ms at the current pause start, or null when playing. */
  private pauseStart: number | null = null;
  /** Friction waits in 'waiting' at pause start (snapshot — see onPauseChanged). */
  private pausedWaitingIds: Set<string> | null = null;

  constructor() {
    // Pause shift (see header): the bus subscription is the only
    // pause wiring here — no trigger, no resume path, no UI.
    bus.on('game:pause-changed', (p) => this.onPauseChanged(p.paused));
  }

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
    // A new world has no pending waits: drop any pause snapshot
    // (its ids belong to fires that no longer exist).
    this.pauseStart = null;
    this.pausedWaitingIds = null;
  }

  /**
   * Pause protocol (see header): on pause, snapshot the ids of
   * friction waits currently in 'waiting'; on resume, shift those
   * still waiting by the paused duration. `now` defaults to
   * Date.now() (the bus subscription path) and is injectable for
   * deterministic tests. Waits begun DURING a pause are not in
   * the snapshot and are never shifted. Duplicate pause input
   * keeps the original start; resume without pause is a no-op.
   */
  onPauseChanged(paused: boolean, now: number = Date.now()): void {
    if (paused) {
      if (this.pauseStart !== null) return; // duplicate pause: keep original start
      this.pauseStart = now;
      this.pausedWaitingIds = new Set(
        [...this.fires.values()]
          .filter((f) => {
            const lighting = f.lighting;
            return lighting?.method === 'friction' && lighting.phase === 'waiting';
          })
          .map((f) => f.id),
      );
      return;
    }
    if (this.pauseStart === null) return; // resume without pause: no-op
    const pausedMs = now - this.pauseStart;
    this.pauseStart = null;
    const ids = this.pausedWaitingIds;
    this.pausedWaitingIds = null;
    if (pausedMs <= 0 || !ids) return;
    for (const id of ids) {
      const fire = this.fires.get(id);
      const lighting = fire?.lighting;
      if (lighting?.method === 'friction' && lighting.phase === 'waiting') {
        lighting.waitUntil += pausedMs;
      }
    }
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
