/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACED-ALTAR STATE (Adam 2026-10-27 — made ritual altars,
 * placeable in game, visible). Mirrors the torchState
 * pattern: a dependency-free singleton (imports only the
 * bus) that the renderer and the shell both read, so
 * neither imports the other for it.
 *
 * PLACEMENT: free — no zone, plot, or biome gate (same free-
 * placement rule as fires/houses/torches). placeAltar is a
 * cost-free engine primitive; the cost gating (craft recipe
 * + carried altar consumed on Place, Systems' draft: river
 * stone 4 + snap-wood 2 + clay 2 + cordage 2, station 'hand')
 * lives with Systems + UI. Removal mechanics are NOT in
 * this order (UI's chip is label-only for now) — removeAltar
 * exists for the same reason removeTorch does: the shell and
 * the save path need a way to drop an entity, and the
 * renderer rebuilds from the event either way.
 *
 * NO RITUAL STATE: an altar is a SITE, not an action — what
 * happens at stump/altar is still undesigned, so the entity
 * shape is just id + position (no ritual, offering, or
 * blessing fields). The stump's altar role is separate
 * (stumps are felled-tree objects, not this entity) and
 * activates with rituals, not here.
 *
 * PARITY (Adam, 2026-11-01: 'Both types of altars should
 * work the same — just 2 flavors for the same thing'):
 * the placed altar now carries the CONSECRATION record —
 * additions, the same ordered step members the stump's
 * dressing reads ('altar-stones' / 'altar-glyph' /
 * 'altar-candle') — sparse on the record (present only
 * while non-empty), mirroring Systems' SavedAltar
 * .additions. The grade derives from the additions on
 * Systems' side for both bases; this state only HOLDS
 * the record and reports its changes ('altar:additions'),
 * so the shell's base-blind consecration acts can seat
 * the steps on a placed altar exactly as on a stump.
 *
 * SAVE SHAPE (proposal for Systems — mirrors SavedTorch):
 * SavedAltar { id, x, z }; boot calls altarState.restore
 * (saved.altars) BEFORE renderer construction (fire/torch
 * pattern), and the constructor's initial rebuildPlacedGroup
 * picks the restored altars up. restore() is silent — the
 * caller rebuilds once (trap restore precedent). A non-array
 * restore input is ignored entirely (state untouched — a
 * corrupt save must not wipe a live world); invalid entries
 * inside an array are dropped.
 */

import { bus } from './events';

/** A placed altar entity: a site — position, plus the
 *  consecration additions once its acts begin (sparse:
 *  the field is absent until the first step seats). */
export interface PlacedAltar {
  id: string;
  x: number;
  z: number;
  additions?: string[];
}

/** Copy a record without aliasing its additions array. */
function copyAltar(altar: PlacedAltar): PlacedAltar {
  return altar.additions
    ? { ...altar, additions: [...altar.additions] }
    : { ...altar };
}

/** The consecration vocabulary — the placed altar's
 *  closed additions set: the three step members PLUS
 *  the completing 'altar' member, exactly the stump's
 *  set (stumpState ALTAR_ADDITIONS). 'altar' in an
 *  additions array is the COMPLETION MARKER, not a
 *  kind claim — the stump's record carries it too, and
 *  Systems' isConsecratedAltar reads it; a set without
 *  it caps a placed altar at grade 1 forever (Systems'
 *  parity ruling (i), 2026-11-01). Restore and the
 *  setter both validate against it, the stumpState
 *  pattern: a non-member never rides the record. */
const ALTAR_STEP_MEMBERS: ReadonlySet<string> = new Set([
  'altar-stones',
  'altar-glyph',
  'altar-candle',
  'altar',
]);

class AltarState {
  private altars = new Map<string, PlacedAltar>();
  private counter = 0;

  placeAltar(x: number, z: number): PlacedAltar {
    const id = `altar:${++this.counter}`;
    const altar: PlacedAltar = { id, x, z };
    this.altars.set(id, altar);
    bus.emit('altar:placed', { id, x, z });
    return altar;
  }

  removeAltar(id: string): boolean {
    if (!this.altars.has(id)) return false;
    this.altars.delete(id);
    bus.emit('altar:removed', { id });
    return true;
  }

  get(id: string): PlacedAltar | undefined {
    const altar = this.altars.get(id);
    return altar ? copyAltar(altar) : undefined;
  }

  /** Copies, never aliases (trap snapshot precedent). */
  snapshot(): PlacedAltar[] {
    return [...this.altars.values()].map(copyAltar);
  }

  /**
   * Seat (or clear) an altar's consecration additions —
   * the desk setGrimoire pattern: false on an unknown
   * id; an unchanged set is an idempotent true with NO
   * event; an empty set DELETES the field (the record
   * returns to bare, the sparse shape both saves write);
   * a real change emits 'altar:additions' with a copy.
   * The shell calls this only after Systems' base-blind
   * consecration grant succeeds.
   */
  setAdditions(id: string, additions: readonly string[]): boolean {
    const altar = this.altars.get(id);
    if (!altar) return false;
    const next = additions.filter(
      (a) => typeof a === 'string' && ALTAR_STEP_MEMBERS.has(a),
    );
    const current = altar.additions ?? [];
    if (next.length === current.length && next.every((a, i) => a === current[i])) {
      return true;
    }
    if (next.length === 0) delete altar.additions;
    else altar.additions = next;
    bus.emit('altar:additions', { id, additions: [...next] });
    return true;
  }

  restore(altars: ReadonlyArray<PlacedAltar>): void {
    if (!Array.isArray(altars)) return;
    this.altars.clear();
    let maxSuffix = 0;
    for (const altar of altars) {
      if (!altar || typeof altar !== 'object') continue;
      if (typeof altar.id !== 'string' || altar.id === '') continue;
      if (!Number.isFinite(altar.x) || !Number.isFinite(altar.z)) continue;
      const record: PlacedAltar = { id: altar.id, x: altar.x, z: altar.z };
      // Additions restore under membership validation
      // (the stumpState pattern: step members only,
      // anything else drops; an empty result leaves the
      // record bare — pre-parity saves load exactly as
      // they saved).
      if (Array.isArray(altar.additions)) {
        const adds = altar.additions.filter(
          (a) => typeof a === 'string' && ALTAR_STEP_MEMBERS.has(a),
        );
        if (adds.length > 0) record.additions = adds;
      }
      this.altars.set(altar.id, record);
      const suffix = Number(altar.id.split(':').pop());
      if (Number.isFinite(suffix) && suffix > maxSuffix) maxSuffix = suffix;
    }
    this.counter = maxSuffix;
  }

  clear(): void {
    this.altars.clear();
    this.counter = 0;
  }
}

export const altarState = new AltarState();
