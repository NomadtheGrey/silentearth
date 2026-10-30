/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * STUMP-ADDITIONS STATE (Adam 2026-10-28 — stumpy
 * workstation upgrade, DEV-approved claim). Mirrors the
 * trapState/altarState pattern: a dependency-free
 * singleton (imports only the bus + the stump-site id)
 * that the renderer and the shell both read, so neither
 * imports the other for it.
 *
 * WHAT A STUMP IS: stumps are NOT entities — they are
 * worldgen scatter objects (kind 'stump') plus felled
 * stumps in harvestState, both position-keyed. Identity
 * IS position: stumpSiteId (ritualSite.ts) derives from
 * (x, z), and the shell's faced-stump identity is the
 * nearest stumpPositions record (harvest.ts). This
 * module never invents a stump id and never moves,
 * removes, or consumes a stump — it only records what
 * has been ADDED to one.
 *
 * ADDITIONS, NOT A FLAG (Adam's amendment, 2026-10-28):
 * the stump anchor is an ADDITIONS BASE. The record
 * per stump is a SET of additions, so workstation +
 * altar (and later additions) coexist on one anchor —
 * never a single exclusive upgraded boolean that
 * forecloses the altar path. This primitive writes
 * the WORKSTATION addition via upgradeStump; the
 * ALTAR TRANSFORMATION members (Systems' stumpy-altar
 * landing, 2026-10-30) live in the SAME set — the
 * three step members 'altar-stones' / 'altar-glyph' /
 * 'altar-candle' plus the completing 'altar' member —
 * and arrive via applyAddition, the writer the shell
 * calls with Systems' act outcomes (one member per
 * call, applied sequentially in one handler, so the
 * candle step and 'altar' land in the same tick).
 * Ritual grade reads the 'altar' MEMBER (Systems'
 * isStumpyAltar / siteGrade; mirrored here by
 * isAltar) — never derived from the steps, so the
 * game side can never hold a second grade truth.
 *
 * CONTRACT (Systems' approved stumpy claim): on
 * upgrade the anchor is NOT consumed (transformation,
 * not harvest); identity + position preserved (same
 * stumpSiteId, same x/z); state becomes workbench;
 * station presence UNCHANGED (presence derives from
 * stump existence, which this module never removes);
 * trundle-move PRESERVED STRUCTURALLY — no move
 * machinery exists in game today, so preserved means
 * identity unchanged + additions ride the anchor for
 * a future move, no move code touched.
 *
 * REMOVE EDGE (approval condition 2, verified at
 * build): stumps are NOT removable — the stump source
 * carries anchor: true and no removable flag, the
 * harvest REMOVE gate fails non-removable sources,
 * and proximity excludes anchors from targets, so no
 * remove path can ever reach a stump. The orphan-
 * overlay case cannot occur; no clear-on-remove
 * rides this landing. If a removal path ever lands,
 * it must clear the addition there.
 *
 * SAVE SEAM (approval condition 3): snapshot() +
 * restore() exist (trap precedent, JSON-safe shapes),
 * but the App serialize/restore wiring is UI's shell
 * branch landing, NOT this one — upgrades VANISH on
 * reload until that wiring lands. Do not claim
 * persistence for this landing.
 *
 * EMIT OWNERSHIP: upgradeStump OWNS 'stump:upgraded'
 * and applyAddition OWNS 'stump:altar-stepped'
 * (fireState-style). The shell branch that calls them
 * is UI's follow-up; exactly ONE caller upgrades per
 * craft (the shell branch after executeCraft reports
 * upgradedStump), or one craft upgrades twice.
 * Duplicate upgradeStump calls return false and emit
 * nothing — the engine-side double-upgrade guard.
 */

import { bus } from './events';
import { stumpSiteId } from './ritualSite';

/**
 * An addition on a stump anchor. 'workstation' is the
 * workbench upgrade; the altar transformation adds its
 * three step members plus the completing 'altar' member
 * (Systems' stumpy-altar constants mirror these strings).
 */
export type StumpAddition =
  | 'workstation'
  | 'altar'
  | 'altar-stones'
  | 'altar-glyph'
  | 'altar-candle';

/** One stump's additions, JSON-safe (arrays, not Sets) for the save seam. */
export interface StumpAdditionRecord {
  siteId: string;
  x: number;
  z: number;
  additions: StumpAddition[];
}

const ADDITIONS: ReadonlySet<string> = new Set([
  'workstation',
  'altar',
  'altar-stones',
  'altar-glyph',
  'altar-candle',
]);

/**
 * The altar-transformation members applyAddition accepts —
 * the step members plus the completing 'altar'. The
 * workstation has its own writer (upgradeStump) and is
 * refused here, so each writer owns exactly its acts.
 */
const ALTAR_ADDITIONS: ReadonlySet<string> = new Set([
  'altar-stones',
  'altar-glyph',
  'altar-candle',
  'altar',
]);

class StumpState {
  private records = new Map<string, { siteId: string; x: number; z: number; additions: Set<StumpAddition> }>();

  /**
   * Add the workstation addition to the stump at (x, z).
   * Returns true on a new upgrade (emits 'stump:upgraded'),
   * false if the workstation addition is already present
   * (no emit — the double-upgrade guard) or the position
   * is not finite. Trusts the shell's identity (trap
   * precedent — stumpPositions already existence-checked
   * the faced stump before the shell passes it here).
   */
  upgradeStump(x: number, z: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    const siteId = stumpSiteId(x, z);
    const existing = this.records.get(siteId);
    if (existing?.additions.has('workstation')) return false;
    if (existing) {
      existing.additions.add('workstation');
    } else {
      this.records.set(siteId, { siteId, x, z, additions: new Set(['workstation']) });
    }
    bus.emit('stump:upgraded', { siteId, x, z });
    return true;
  }

  /**
   * Apply ONE altar-transformation addition to the stump
   * at (x, z) — the writer the shell calls with Systems'
   * stumpy-altar act outcomes (an outcome's members are
   * applied sequentially in one handler; the candle
   * outcome carries 'altar-candle' then 'altar', so the
   * pair lands in the same tick). Returns true on a real
   * change (emits 'stump:altar-stepped'); false — no
   * emit, nothing mutates — when the member is already
   * present, is not an altar member (the workstation
   * refuses here; upgradeStump owns it), or the position
   * is not finite. Trusts the shell's identity, same as
   * upgradeStump.
   */
  applyAddition(x: number, z: number, addition: StumpAddition): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (!ALTAR_ADDITIONS.has(addition)) return false;
    const siteId = stumpSiteId(x, z);
    const existing = this.records.get(siteId);
    if (existing?.additions.has(addition)) return false;
    if (existing) {
      existing.additions.add(addition);
    } else {
      this.records.set(siteId, { siteId, x, z, additions: new Set([addition]) });
    }
    bus.emit('stump:altar-stepped', { siteId, x, z, addition });
    return true;
  }

  /**
   * Is this stump a completed Stumpy Altar? Reads the
   * 'altar' MEMBER — the same fact Systems' isStumpyAltar
   * / siteGrade read (the grade-read call, Background
   * claim 2026-10-30: one grade truth, never derived
   * from the step members).
   */
  isAltar(x: number, z: number): boolean {
    return this.hasAddition(x, z, 'altar');
  }

  /** Per-addition query — UI's guard asks "is the WORKSTATION addition present?", not a single upgraded bit. */
  hasAddition(x: number, z: number, addition: StumpAddition): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    return this.records.get(stumpSiteId(x, z))?.additions.has(addition) ?? false;
  }

  /** Shorthand for the guard's question: is this stump already a workbench? */
  isWorkbench(x: number, z: number): boolean {
    return this.hasAddition(x, z, 'workstation');
  }

  /** Copies, never aliases (trap snapshot precedent). */
  snapshot(): StumpAdditionRecord[] {
    return [...this.records.values()].map((record) => ({
      siteId: record.siteId,
      x: record.x,
      z: record.z,
      additions: [...record.additions],
    }));
  }

  /**
   * Restore from a snapshot (trap precedent). Silent — the
   * caller rebuilds once. A non-array input is ignored
   * entirely (state untouched — a corrupt save must not
   * wipe a live world); invalid entries inside an array
   * are dropped.
   */
  restore(records: ReadonlyArray<StumpAdditionRecord>): void {
    if (!Array.isArray(records)) return;
    this.records.clear();
    for (const record of records) {
      if (!record || typeof record !== 'object') continue;
      if (typeof record.siteId !== 'string' || record.siteId === '') continue;
      if (!Number.isFinite(record.x) || !Number.isFinite(record.z)) continue;
      if (!Array.isArray(record.additions)) continue;
      const additions = new Set<StumpAddition>();
      for (const addition of record.additions) {
        if (typeof addition === 'string' && ADDITIONS.has(addition)) {
          additions.add(addition as StumpAddition);
        }
      }
      this.records.set(record.siteId, { siteId: record.siteId, x: record.x, z: record.z, additions });
    }
  }

  /** Empty the record (regenerate/new world). Silent. */
  clear(): void {
    this.records.clear();
  }
}

export const stumpState = new StumpState();
