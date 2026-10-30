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
  FIRE_DEFS,
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

  /**
   * Lit-fire presence (Background, 2026-10-30 — station
   * presence for 'fire' / 'cauldron' work): true iff some
   * placed fire with lit === true sits within range of
   * (x, z). Mirrors loomState.loomsInRange. The lit flag
   * is the honest test by construction: placeFire creates
   * lit:false and the flag flips only at ignition (or via
   * setLit on boot restore), so an UNLIT fire never counts
   * and a fire mid-lighting does not count until it
   * catches. Any lit fire type counts — bare-fire work
   * does not care which rung of the ladder burns.
   */
  litFireInRange(x: number, z: number, range: number): boolean {
    for (const fire of this.fires.values()) {
      if (!fire.lit) continue;
      if (Math.hypot(fire.x - x, fire.z - z) <= range) return true;
    }
    return false;
  }

  /**
   * Save-boot API (Adam 2026-10-27): mark a restored fire lit (or
   * unlit). Restored fires used to boot unlit because placeFire
   * always creates lit:false and no API marked them lit — the save
   * already carries the lit flag (Systems' SavedFire), only this
   * marking was missing. Silent (no emit — the caller rebuilds
   * once, trap restore precedent). Lighting a fire clears any
   * lighting process (a lit fire never has one — the lighting
   * machine's invariant). Returns false for an unknown id.
   */
  setLit(id: string, lit: boolean): boolean {
    const fire = this.fires.get(id);
    if (!fire) return false;
    fire.lit = lit;
    if (lit) fire.lighting = null;
    return true;
  }

  /**
   * Silent bulk restore (save boot path): replaces state, drops
   * invalid records. Identity fields (id, type, coords, lit) must
   * validate or the fire is dropped; an invalid lighting process
   * is nulled instead (the fire itself survives — a corrupt
   * lighting subfield must not nuke a placed entity). Entries are
   * copied, never aliased. Counter continues past the max id
   * suffix (trap restore shape). Any pause snapshot is dropped,
   * like clear() — pause does not survive a refresh, and boot is
   * unpaused. A restored friction wait keeps its absolute
   * waitUntil: a wait restored after a long absence reads 'ready'
   * (absolute-deadline consequence, flagged — refresh itself,
   * seconds later, is unaffected).
   */
  restore(fires: ReadonlyArray<PlacedFire>): void {
    this.fires.clear();
    this.pauseStart = null;
    this.pausedWaitingIds = null;
    let maxSuffix = 0;
    for (const fire of fires) {
      if (!fire || typeof fire !== 'object') continue;
      if (typeof fire.id !== 'string' || fire.id === '') continue;
      if (typeof fire.type !== 'string' || !(fire.type in FIRE_DEFS)) continue;
      if (!Number.isFinite(fire.x) || !Number.isFinite(fire.z)) continue;
      if (typeof fire.lit !== 'boolean') continue;
      this.fires.set(fire.id, {
        id: fire.id,
        type: fire.type,
        x: fire.x,
        z: fire.z,
        lit: fire.lit,
        lighting: validLighting(fire.lighting),
      });
      const suffix = Number(fire.id.split(':').pop());
      if (Number.isFinite(suffix) && suffix > maxSuffix) maxSuffix = suffix;
    }
    this.counter = maxSuffix;
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

/** Validate + copy a lighting process for restore (null in, null out). */
function validLighting(
  lighting: LightingProcess | null | undefined,
): LightingProcess | null {
  if (!lighting) return null;
  if (lighting.method === 'flint') {
    if (
      !Number.isInteger(lighting.clicks) ||
      lighting.clicks < 0 ||
      lighting.clicks >= FLINT_CLICKS
    ) {
      return null;
    }
    return { method: 'flint', clicks: lighting.clicks };
  }
  if (lighting.method === 'friction') {
    if (
      (lighting.phase !== 'waiting' && lighting.phase !== 'ready') ||
      !Number.isFinite(lighting.waitUntil)
    ) {
      return null;
    }
    return { method: 'friction', phase: lighting.phase, waitUntil: lighting.waitUntil };
  }
  return null;
}
