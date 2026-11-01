/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACED-DESK STATE (Adam 2026-10-30 — the writing desk,
 * placeable, the grimoire's site). Mirrors the altarState
 * pattern: a dependency-free singleton (imports only the
 * bus) that the renderer and the shell both read, so
 * neither imports the other for it.
 *
 * PLACEMENT: free — no zone, plot, or biome gate (same free-
 * placement rule as fires/houses/torches/altars).
 * deskState.placeDesk is a cost-free engine primitive; the
 * cost gating (craft recipe + carried desk consumed on
 * Place, Systems' placeDesk grant in systems/desk.ts)
 * lives with Systems + UI — the shell hands the grant
 * record's position to placeDesk, exactly as altars hand
 * theirs. MULTIPLE desks are legitimate (a second camp
 * legitimately wants a second desk).
 *
 * NO DESK ACTIONS: a desk is a SITE, not an action — the
 * grimoire resides on it and functions while she's at it
 * (Adam, pinned 2026-10-30), and its workings arrive with
 * the grimoire's design turn. THE SEAT (2026-11-01): the
 * entity carries whether the grimoire is seated on it —
 * grimoire?: boolean, present only when true (the save's
 * own write-only-when-true shape). Systems' desk.ts
 * grants (seatGrimoire / takeGrimoire) decide; the shell
 * flips the entity through setGrimoire ONLY on a grant's
 * success, so the visible book can never lie about the
 * seat. The book itself is renderer dressing on the
 * desk's group while the flag stands. NO PICKUP either (Systems, flagged
 * follow-up: moving/removing a placed desk is Adam's word
 * later) — removeDesk exists for the same reason
 * removeAltar does: the shell and the save path need a
 * way to drop an entity, and the renderer rebuilds from
 * the event either way.
 *
 * SAVE SHAPE (Systems, landed — mirrors SavedAltar with
 * one difference): SavedDesk { x, z, id? } — the id is
 * OPTIONAL (the save carries position always and the id
 * when the entity provides one). restore() therefore
 * accepts id-less entries and MINTS ids for them, keeps
 * provided ids, and resyncs the counter past every
 * provided numeric suffix, so a restored desk and a
 * newly placed one can never collide. Boot calls
 * deskState.restore(saved.desks) BEFORE renderer
 * construction (fire/torch/altar pattern), and the
 * constructor's initial rebuildPlacedGroup picks the
 * restored desks up. restore() is silent — the caller
 * rebuilds once (trap restore precedent). A non-array
 * restore input is ignored entirely (state untouched —
 * a corrupt save must not wipe a live world); invalid
 * entries inside an array are dropped; entry order is
 * preserved.
 */

import { bus } from './events';

/** A placed desk entity: a site — position, plus the
 *  grimoire seat (present only when the book is seated). */
export interface PlacedDesk {
  id: string;
  x: number;
  z: number;
  grimoire?: boolean;
}

class DeskState {
  private desks = new Map<string, PlacedDesk>();
  private counter = 0;

  placeDesk(x: number, z: number): PlacedDesk {
    const id = `desk:${++this.counter}`;
    const desk: PlacedDesk = { id, x, z };
    this.desks.set(id, desk);
    bus.emit('desk:placed', { id, x, z });
    return desk;
  }

  removeDesk(id: string): boolean {
    if (!this.desks.has(id)) return false;
    this.desks.delete(id);
    bus.emit('desk:removed', { id });
    return true;
  }

  /**
   * Flip the grimoire seat (the shell's write path, on a
   * Systems grant's success only). False on an unknown
   * id. Emits 'desk:grimoire' on an actual change (the
   * renderer rebuilds the desk's group — the book appears
   * or lifts); a same-value call is an idempotent true
   * with no event. Unseating DELETES the flag, so the
   * record and the save keep the write-only-when-true
   * shape.
   */
  setGrimoire(id: string, seated: boolean): boolean {
    const desk = this.desks.get(id);
    if (!desk) return false;
    const current = desk.grimoire === true;
    if (current === seated) return true;
    if (seated) desk.grimoire = true;
    else delete desk.grimoire;
    bus.emit('desk:grimoire', { id, seated });
    return true;
  }

  get(id: string): PlacedDesk | undefined {
    const desk = this.desks.get(id);
    return desk ? { ...desk } : undefined;
  }

  /** Copies, never aliases (trap snapshot precedent). */
  snapshot(): PlacedDesk[] {
    return [...this.desks.values()].map((desk) => ({ ...desk }));
  }

  restore(desks: ReadonlyArray<{ id?: string; x: number; z: number; grimoire?: boolean }>): void {
    if (!Array.isArray(desks)) return;
    this.desks.clear();
    // Ceiling first: the counter must clear every provided
    // numeric suffix BEFORE any id is minted below, or a
    // minted id could collide with a kept one.
    let maxSuffix = 0;
    for (const desk of desks) {
      if (!desk || typeof desk !== 'object') continue;
      if (typeof desk.id === 'string') {
        const suffix = Number(desk.id.split(':').pop());
        if (Number.isFinite(suffix) && suffix > maxSuffix) maxSuffix = suffix;
      }
    }
    this.counter = maxSuffix;
    for (const desk of desks) {
      if (!desk || typeof desk !== 'object') continue;
      if (!Number.isFinite(desk.x) || !Number.isFinite(desk.z)) continue;
      const id =
        typeof desk.id === 'string' && desk.id !== ''
          ? desk.id
          : `desk:${++this.counter}`;
      const restored: PlacedDesk = { id, x: desk.x, z: desk.z };
      if (desk.grimoire === true) restored.grimoire = true;
      this.desks.set(id, restored);
    }
  }

  clear(): void {
    this.desks.clear();
    this.counter = 0;
  }
}

export const deskState = new DeskState();
