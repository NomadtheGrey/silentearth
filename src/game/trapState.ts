/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACED-TRAP STATE (Adam 2026-10-26 — placement rule only;
 * catch state added 2026-10-28, DEV-approved claim).
 * Mirrors the fireState/shelterState/loomState pattern: a
 * dependency-free singleton (imports only the bus + defs)
 * that the renderer and the shell both read, so neither
 * imports the other for it.
 *
 * ADAM'S RULE: crafting a trap places it right there. The
 * caller at craft-success time calls placeTrap(type, x, z)
 * — at her position — and this module stores the trap and
 * emits 'trap:placed', which the renderer listens to.
 *
 * EMIT OWNERSHIP — READ BEFORE WIRING: no Systems emit of
 * 'trap:placed' exists today (grep-verified: zero hits in
 * src/). placeTrap OWNS this emit, fireState-style. The
 * craft-success call site (shell and/or Systems) is the
 * follow-up, and exactly ONE caller must place per craft:
 * either the shell calls placeTrap, or Systems emits
 * 'trap:placed' directly — never both, or one craft places
 * two traps. This module does not pick the caller.
 * setCatch OWNS 'trap:catch' the same way: the SHELL is
 * the only writer (set on caught hour-roll, cleared on
 * granted collection); Systems never mutates game state.
 *
 * SAVE SEAM: snapshot() + restore() are the persistence
 * seam (same shape as fires/houses/looms/piles). Systems'
 * save.ts carries traps (SavedTrap catch/baited passthrough)
 * and restore() reads catch/baited field-explicitly; App
 * snapshot/restore wiring is UI's. restore() is silent
 * (no per-trap emit; the caller rebuilds once) and drops
 * invalid records, the way save filters them.
 *
 * SCOPE: placement + catch state + hour trigger. setCatch is
 * the shell's write path; no bait setter yet (no baiting
 * mechanic exists — no dead API), no decay. checkHour is
 * the hour boundary (the shell rolls per trap on 'trap:hour');
 * sleepJump is the sleep-jump burst (one 'trap:hour' per
 * skipped night hour, delivered at dawn — Adam 2026-10-28).
 * Traps are not harvest targets. setWorldGen clears traps
 * (new world = new traps, like fires/houses/looms/piles).
 */

import { bus } from './events';
import { isTrapType, type TrapType } from './traps';

/** A placed trap entity. catch = caught kind, or null when empty; baited carried, always false until a baiting landing adds a setter. */
export interface PlacedTrap {
  id: string;
  type: TrapType;
  x: number;
  z: number;
  catch: string | null;
  baited: boolean;
}

/**
 * A restorable trap record: id/type/x/z validated as today, catch/baited
 * optional (old saves carry neither → null/false). PlacedTrap[] assigns here.
 */
export interface RestorableTrap {
  id: string;
  type: TrapType;
  x: number;
  z: number;
  catch?: string | null;
  baited?: boolean;
}

class TrapState {
  private traps = new Map<string, PlacedTrap>();
  private counter = 0;
  /** Game-hour index last seen by checkHour (-1 = never checked). */
  private lastHourIndex = -1;

  placeTrap(type: TrapType, x: number, z: number): PlacedTrap {
    const id = `trap:${type}:${++this.counter}`;
    const trap: PlacedTrap = { id, type, x, z, catch: null, baited: false };
    this.traps.set(id, trap);
    bus.emit('trap:placed', { id, type, x, z });
    return trap;
  }

  get(id: string): PlacedTrap | undefined {
    return this.traps.get(id);
  }

  /**
   * The shell's catch write path: set on caught hour-roll, clear (null) on
   * granted collection. Emits 'trap:catch' { id, kind } (kind null = cleared)
   * so the shell saves and the UI row re-reads the snapshot. Unknown id is a
   * no-op (false, no emit). Systems never calls this — game state is not
   * Systems' to mutate. No setBaited: no baiting mechanic exists yet.
   */
  setCatch(id: string, kind: string | null): boolean {
    const trap = this.traps.get(id);
    if (!trap) return false;
    trap.catch = kind;
    bus.emit('trap:catch', { id, kind });
    return true;
  }

  /**
   * Pure hour boundary, called from the renderer's 2 s worldTick with the
   * live cycleT: emits 'trap:hour' { hour } exactly when the game hour
   * changes (hour = floor(cycleT × 24)). First call establishes silently
   * (no emit on load/boot); 23 → 0 wrap emits (midnight is a change);
   * same-hour repeats are no-ops. A sleep jump does NOT use this
   * method for its skipped hours — see sleepJump below (Adam
   * 2026-10-28: once per skipped hour, batched at dawn). The
   * shell rolls per trap on the emit; this method rolls nothing
   * and knows no trap positions.
   */
  checkHour(cycleT: number): void {
    const hour = Math.floor(cycleT * 24);
    if (this.lastHourIndex === -1) {
      // First call establishes the baseline silently (load/boot must
      // not trigger a roll for the hour the player loaded into).
      this.lastHourIndex = hour;
      return;
    }
    if (hour === this.lastHourIndex) return;
    this.lastHourIndex = hour;
    bus.emit('trap:hour', { hour });
  }

  /**
   * Sleep-jump burst (Adam 2026-10-28: once per skipped hour,
   * rolled all at once at dawn). Called by the sleep listener
   * BEFORE restoreDawn, with the pre-sleep cycleT: emits one
   * 'trap:hour' per skipped hour, in order — the hours strictly
   * after the sleep hour through 23, plus dawn 0 (the wake
   * hour's roll). Sleep at 20 → [21, 22, 23, 0]; sleep at 23 →
   * [0] only (identical to the v1 dawn roll). The sleep hour
   * itself never re-rolls (its roll already fired when the tick
   * crossed into it). Ends lastHourIndex at 0, so the next
   * worldTick's checkHour(0) is a no-op — dawn never
   * double-rolls. Assumes the listener's night gate (the sleep
   * hour is a night hour, so the coming dawn is the next one;
   * a daytime press never reaches here). Non-finite input is
   * a no-op (the listener already fails 'no-sky' first).
   * The shell rolls per emit exactly as for a normal hour tick
   * — the burst needs no shell change; uncaught-only skipping
   * is the row's per-emit rule, not this method's.
   */
  sleepJump(fromCycleT: number): void {
    if (!Number.isFinite(fromCycleT)) return;
    const fromHour = Math.floor(fromCycleT * 24);
    for (let h = fromHour + 1; h < 24; h++) {
      this.lastHourIndex = h;
      bus.emit('trap:hour', { hour: h });
    }
    this.lastHourIndex = 0;
    bus.emit('trap:hour', { hour: 0 });
  }

  snapshot(): PlacedTrap[] {
    return [...this.traps.values()];
  }

  /** Silent bulk restore (save boot path): replaces state, drops invalid records. */
  restore(placed: ReadonlyArray<RestorableTrap>): void {
    this.traps.clear();
    let maxSuffix = 0;
    for (const trap of placed) {
      if (!isTrapType(trap.type) || !Number.isFinite(trap.x) || !Number.isFinite(trap.z)) continue;
      if (typeof trap.id !== 'string' || trap.id === '') continue;
      this.traps.set(trap.id, {
        id: trap.id,
        type: trap.type,
        x: trap.x,
        z: trap.z,
        catch: typeof trap.catch === 'string' ? trap.catch : null,
        baited: trap.baited === true,
      });
      const suffix = Number(trap.id.split(':').pop());
      if (Number.isFinite(suffix) && suffix > maxSuffix) maxSuffix = suffix;
    }
    this.counter = maxSuffix;
  }

  clear(): void {
    this.traps.clear();
    this.counter = 0;
    this.lastHourIndex = -1;
  }
}

export const trapState = new TrapState();
