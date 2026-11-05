// HEDGE — THE MARK OF HEDGE, SYSTEMS HALF (Adam's
// design, 2026-11-05; sequence: Returning, then
// Hedge, then HearthHome).
//
// THE SHAPE OF IT: the Hedge rings a HOME of hers —
// a placed shelter, a lean-to camp included. ONE
// hedge per home. It PERSISTS: a home she leaves is
// kept, its hedge standing and working whenever she
// wanders back (Adam: a left home is kept, not lost).
//
// THIS MODULE OWNS: the hedge state (which homes are
// ringed, where, and since when), the LAYING GRANT
// (the completion act of the held working), and the
// TIER READS the field effects consult. The field
// effects themselves (what the ring does to beasts
// and allies inside it) are Background's, reading
// this state; the laying door + the ring's rendering
// are UI / Background's.
//
// ROOTING: a laid hedge is not yet a working hedge —
// its effects wake when it ROOTS, ROOT_DAYS after the
// laying (DRAFT: a day). The state records both days;
// isRooted is the read.
//
// THE RADIUS IS DERIVED, NEVER STORED: the ring's
// reach follows her CURRENT knowledge of the mark
// (T1 6 m / T2 10 m / T3 15 m, DRAFT) — a hedge laid
// at T1 grows when she learns T2, the way every
// mark's facts derive from the fragment record at
// read time. hedgeRadiusM is the one derivation.
//
// THE ANCHOR: the first cutting at her feet is the
// MOTHER SHRUB — the record's anchor is the ring's
// centre, the home's own position as the shell names
// it. A home is identified by an OPAQUE caller-named
// id (the placed shelter's id; the buckets law —
// keys verbatim, systems never mints them).

import { ITEMS } from './recipes';
import type { FragmentState } from './fragments';
import type { PersonalInventory } from './inventory';

/** The canonical mark string (fragments.ts registry). */
export const HEDGE_MARK = 'hedge';

/** Cuttings a laying consumes, at completion (DRAFT). */
export const CUTTINGS_TO_LAY = 6;

/** Days from laying to rooted (DRAFT: a day). */
export const ROOT_DAYS = 1;

/** Ring radius in metres by known tier (DRAFT). Tier 0 has no ring. */
export const HEDGE_RADIUS_M: Readonly<Record<number, number>> = {
  1: 6,
  2: 10,
  3: 15,
};

/** The tier she knows Hedge at (0 = not learned). */
export function hedgeTier(fragments: FragmentState): number {
  return fragments.knownTier(HEDGE_MARK);
}

/**
 * The ring's radius for her current knowledge —
 * THE derivation every effect and rendering reads.
 * 0 when the mark is unlearned (no hedge can stand).
 */
export function hedgeRadiusM(fragments: FragmentState): number {
  return HEDGE_RADIUS_M[hedgeTier(fragments)] ?? 0;
}

// ---------------------------------------------------------------------------
// The state — one record per ringed home
// ---------------------------------------------------------------------------

/** One laid hedge, as the state keeps it (the save mirrors this shape). */
export interface HedgeRecord {
  /** The home's id, opaque + verbatim (caller-named). */
  homeId: string;
  /** The ring's centre (the home's anchor; the mother shrub stands here). */
  x: number;
  z: number;
  /** The world day the laying completed. */
  laidDay: number;
  /** The world day the hedge roots (effects wake). laidDay + ROOT_DAYS. */
  rootedDay: number;
}

/** True once the hedge has rooted by this day (its effects wake). */
export function isRooted(hedge: HedgeRecord, day: number): boolean {
  return day >= hedge.rootedDay;
}

export class HedgeState {
  private readonly hedges = new Map<string, HedgeRecord>();

  /**
   * Restore is lenient per entry (the register law):
   * an entry with a blank id, a non-finite centre, or
   * non-finite days drops alone; the first record for
   * a home wins. Old saves carry no hedges.
   */
  constructor(saved?: readonly HedgeRecord[]) {
    if (saved) {
      for (const entry of saved) {
        if (!entry || typeof entry.homeId !== 'string' || entry.homeId.length === 0) {
          continue;
        }
        if (this.hedges.has(entry.homeId)) {
          continue;
        }
        if (!Number.isFinite(entry.x) || !Number.isFinite(entry.z)) {
          continue;
        }
        if (!Number.isFinite(entry.laidDay) || !Number.isFinite(entry.rootedDay)) {
          continue;
        }
        this.hedges.set(entry.homeId, { ...entry });
      }
    }
  }

  /** Every hedge (the save snapshot reads this). Copies. */
  snapshot(): HedgeRecord[] {
    return [...this.hedges.values()].map((hedge) => ({ ...hedge }));
  }

  /** Every hedge, in laying order. Copies. */
  list(): HedgeRecord[] {
    return this.snapshot();
  }

  /** One home's hedge, if it stands. A copy. */
  hedgeFor(homeId: string): HedgeRecord | undefined {
    const hedge = this.hedges.get(homeId);
    return hedge ? { ...hedge } : undefined;
  }

  /** True when this home already wears its hedge. */
  hasHedge(homeId: string): boolean {
    return this.hedges.has(homeId);
  }

  /** How many homes she has ringed. */
  get size(): number {
    return this.hedges.size;
  }

  // -------------------------------------------------------------------------
  // The laying grant — the completion act of the held working
  // -------------------------------------------------------------------------

  /**
   * Lay the hedge around a home: THE COMPLETION ACT.
   * The held working's timing is the shell's — it
   * calls this when the working completes, and only
   * then: an interrupted laying never calls it and
   * consumes NOTHING (the standing cost-at-completion
   * law). Validates everything before touching
   * anything: a real position, the mark learned
   * (tier >= 1), the home unhedged (one hedge per
   * home), and the cuttings in hand — then consumes
   * exactly CUTTINGS_TO_LAY and records the hedge,
   * its mother shrub at the centre.
   */
  layHedge(
    fragments: FragmentState,
    inventory: PersonalInventory,
    home: { homeId: string; x: number; z: number },
    day: number,
  ): LayHedgeOutcome {
    if (
      typeof home.homeId !== 'string' ||
      home.homeId.length === 0 ||
      !Number.isFinite(home.x) ||
      !Number.isFinite(home.z) ||
      !Number.isFinite(day)
    ) {
      return { ok: false, code: 'bad-home' };
    }
    if (hedgeTier(fragments) < 1) {
      return { ok: false, code: 'tier' };
    }
    if (this.hedges.has(home.homeId)) {
      return { ok: false, code: 'already-hedged' };
    }
    if (inventory.count(ITEMS.cuttings) < CUTTINGS_TO_LAY) {
      return { ok: false, code: 'no-cuttings' };
    }
    inventory.remove(ITEMS.cuttings, CUTTINGS_TO_LAY);
    const hedge: HedgeRecord = {
      homeId: home.homeId,
      x: home.x,
      z: home.z,
      laidDay: day,
      rootedDay: day + ROOT_DAYS,
    };
    this.hedges.set(hedge.homeId, hedge);
    return { ok: true, hedge: { ...hedge } };
  }
}

/** Laying outcome: the recorded hedge, or a typed refusal. */
export type LayHedgeOutcome =
  | { ok: true; hedge: HedgeRecord }
  | {
      ok: false;
      code: 'bad-home' | 'tier' | 'already-hedged' | 'no-cuttings';
    };
