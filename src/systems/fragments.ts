/**
 * Fragments — the journal's record of a mark learned
 * in pieces (Adam, 2026-10-30/31; the first-fragment
 * teaching, 2026-10-31).
 *
 * A mark's tier is split into fragments — inscriptions
 * left in situ by earlier hands (a cave's circle, the
 * Grove's carved stone, a village hearth stone, the
 * farmhouse's great stone) — and she transcribes them
 * into her JOURNAL where she finds them (mirrored in
 * the grimoire by the linked-books law). This module
 * is the facts half: what the journal holds, what an
 * inscription changes, and what the tallies read.
 * Presentation — the transcription beat, the journal's
 * tally surface, the pill and its pinned lines — is
 * the shell's; the faced fragment, its mark, and its
 * weathering arrive as caller facts.
 *
 * Adam's laws this module keeps:
 * - THE CLOCK (Adam, 2026-11-07 — supersedes the
 *   count threshold): fragments deal ARCS of the
 *   mark's sign (integer clock hours), and collecting
 *   UNIONS them per mark. A mark's clock FILLED
 *   (12 of 12 hours) earns a tier; the clock then
 *   resets and fills again toward the next. Filling
 *   is per-mark, never pooled — one mark's hours
 *   never fill another's clock.
 * - THE TEACHING: the first fragment of a mark is a
 *   once-per-mark fact (inscribe reports it as
 *   `first`), and from that moment she is LOOKING —
 *   the pursuit is a named, dated fact on the record
 *   (seekingSinceDay), not a UI inference.
 * - NO JOURNAL, NO INSCRIPTION: without the journal
 *   carried, nothing is recorded and the fragment
 *   stays in the world for her return (the pill's
 *   "Wish I had a journal..." is the shell's voice
 *   for this code).
 * - A NOTED FRAGMENT IS NOTED: re-transcribing the
 *   same fragment changes nothing and double-counts
 *   nothing.
 * - DUPLICATES LAND HONESTLY (ruling still open):
 *   a duplicate is a NEW fragment of a mark she
 *   already holds. Every copy is recorded — the count
 *   grows past any fill, nothing is capped or
 *   discarded — and the kept-best copy is a DERIVED
 *   read (the best weathering among the copies), so
 *   any ruling Adam lands (keeps-the-better; more
 *   copies, more benefit; past-3-doesn't-count) is a
 *   tally change over a true record, not a migration.
 *
 * THE HOME WIRING (Adam, 2026-11-05): the Home
 * pillar's own marks — Returning, Hedge, HearthHome,
 * Naming — join the fragment world as marks in their
 * own right, taught by their own fragments like the
 * founding three (never pooled — a Returning fragment
 * teaches Returning, nothing else). Under the clock
 * law their TIERS are clock fills: the tiered Home
 * marks climb three fills (T1/T2/T3); Naming is
 * single-tier, whole at one fill; the founding three
 * likewise open at one fill (see MARK_TIER_CAPS).
 *
 * All numbers and the completeness scale are DRAFT
 * for Adam's pin pass.
 */

import { emitJournalChange } from './journalChanges';
// ---------------------------------------------------------------------------
// Records — the persisted shape
// ---------------------------------------------------------------------------

/** Hours around a mark's clock — one full sign. */
export const CLOCK_HOURS = 12;

/**
 * Per-mark TIER CAPS under the clock law (Adam,
 * 2026-11-07): a mark's tier is its FILLED CLOCKS,
 * capped here — the tiered Home marks climb three
 * fills; Naming is single-tier by Adam's ruling (a
 * key, not a ladder), whole at one fill; every other
 * mark — the founding three included — opens at one
 * fill. This table is the ONE place a later pin
 * raises a mark's ladder. (It supersedes the retired
 * cumulative count thresholds [3, 6, 10] / [3]: the
 * count law no longer gates any tier.)
 */
export const MARK_TIER_CAPS: Readonly<Record<string, number>> = {
  returning: 3,
  hedge: 3,
  hearthhome: 3,
  naming: 1,
};

/** The tier cap a mark climbs to (1 unless registered tiered). */
export function tierCapFor(mark: string): number {
  return MARK_TIER_CAPS[mark] ?? 1;
}

// ---------------------------------------------------------------------------
// Arcs — the stretch of the sign one copy carries
// ---------------------------------------------------------------------------

/**
 * One copy's ARC: the contiguous stretch of its
 * mark's sign it carries, in clock hours — a start
 * hour (0-11) and a forward length in hours (dealt
 * copies carry 4-6, Adam 2026-11-07; the record
 * admits 0-12 so every dealt or bridged arc fits).
 */
export interface FragmentArc {
  arcStart: number;
  arcHours: number;
}

/**
 * A copy's arc: its DEALT arc when it carries one;
 * a LEGACY copy (inscribed before arcs were dealt)
 * BRIDGES from its stored completeness — length =
 * round(completeness x 12), start centred on the top
 * (the 2026-11-07 sector placement, surviving as
 * exactly this bridge, not as the dealing model).
 */
export function arcOfCopy(copy: SavedFragmentCopy): FragmentArc {
  if (
    typeof copy.arcStart === 'number' &&
    Number.isFinite(copy.arcStart) &&
    typeof copy.arcHours === 'number' &&
    Number.isFinite(copy.arcHours)
  ) {
    return {
      arcStart: Math.min(11, Math.max(0, Math.floor(copy.arcStart))),
      arcHours: Math.min(12, Math.max(0, Math.floor(copy.arcHours))),
    };
  }
  const grade = Number.isFinite(copy.completeness)
    ? Math.min(1, Math.max(0, copy.completeness))
    : 0;
  const hours = Math.round(grade * CLOCK_HOURS);
  const start =
    (((12 - Math.round(hours / 2)) % CLOCK_HOURS) + CLOCK_HOURS) %
    CLOCK_HOURS;
  return { arcStart: start, arcHours: hours };
}

/** The 12-segment bitmask one arc covers (bit h = hour h). */
function arcMask(arc: FragmentArc): number {
  let mask = 0;
  for (let i = 0; i < arc.arcHours; i += 1) {
    mask |= 1 << ((arc.arcStart + i) % CLOCK_HOURS);
  }
  return mask;
}

/** A mark's clock state, derived from its copies. */
export interface MarkClocks {
  /** Clocks filled so far (tiers earned, before the cap). */
  fills: number;
  /** Hours covered in the CURRENT clock (0-11). */
  coveredHours: number;
  /** The current clock's union mask. */
  mask: number;
  /** Each copy's clock index, in inscription order. */
  clocks: number[];
  /** The day the first fill completed (null until one does). */
  firstFillDay: number | null;
}

/**
 * THE ACCUMULATION (Adam, 2026-11-07): replay a
 * mark's copies in inscription order, unioning arcs
 * into the current clock. When a copy's arc completes
 * the clock, the fill counts and the union resets
 * EMPTY — the completing copy is consumed WHOLE by
 * its clock (DEV's boundary call): its overflow does
 * not spill into the next clock, which starts clean.
 * Overlaps count once, always (a union, not a sum).
 * Derived, never stored — the copy list is the one
 * source of truth, so the duplicates law and per-copy
 * provenance stand untouched beneath it.
 */
export function deriveMarkClocks(
  copies: readonly SavedFragmentCopy[],
): MarkClocks {
  let fills = 0;
  let mask = 0;
  let coveredHours = 0;
  let firstFillDay: number | null = null;
  const clocks: number[] = [];
  for (const copy of copies) {
    clocks.push(fills);
    const next = mask | arcMask(arcOfCopy(copy));
    if (next === (1 << CLOCK_HOURS) - 1) {
      fills += 1;
      if (firstFillDay === null) firstFillDay = copy.day;
      mask = 0;
      coveredHours = 0;
    } else {
      mask = next;
      coveredHours = 0;
      for (let h = 0; h < CLOCK_HOURS; h += 1) {
        if (mask & (1 << h)) coveredHours += 1;
      }
    }
  }
  return { fills, coveredHours, mask, clocks, firstFillDay };
}

// ---------------------------------------------------------------------------
// Portions — the arc of the sign a copy carries
// ---------------------------------------------------------------------------

/**
 * The portion of its mark's sign a fragment copy
 * represents, DERIVED from its completeness (the
 * portion model, Adam 2026-11-07 — superseding the
 * 2026-11-05 ring/centre split, which RETIRES here):
 * a fragment shows ONE CONTIGUOUS ARC of the WHOLE
 * sign — ring and centre sliced together by angle,
 * clock-style (his examples: 10:00-2:00 = a third;
 * 12:00-6:00 = a half) — drawn SOLID, and the rest
 * of the sign drawn FADED, so the player can see
 * what the entire glyph is supposed to look like.
 * Arc share = the copy's completeness.
 *
 * PLACEMENT (DEV's reading of his examples, flagged
 * to Adam for correction): the arc is CENTRED ON THE
 * TOP — 10:00-2:00 straddles 12:00, so the sign's
 * crown is the first thing a fragment keeps. Angles
 * are degrees measured CLOCKWISE FROM 12:00: a
 * centred arc of fraction f spans -180*f to +180*f.
 *
 * THE derivation lives in this ONE helper: the glyph
 * surfaces (UI's drawSign contract: sector-solid +
 * ghost-rest) read portions from here, never
 * re-derive them. The completeness BANDS themselves
 * do not move (the carriers still deal the same
 * numbers); only the reading of a number changes.
 */
export interface FragmentSector {
  /** The arc's share of the whole sign, [0, 1]. */
  fraction: number;
  /** The arc's start, degrees clockwise from 12:00. */
  startDeg: number;
  /** The arc's end, degrees clockwise from 12:00. */
  endDeg: number;
}

/**
 * The sector a copy represents. A copy carrying a
 * DEALT ARC (arcOfCopy resolves dealt-or-bridged)
 * shows ITS OWN stretch: startDeg = its start hour
 * in degrees, endDeg one arc-length on (past 360
 * when the arc wraps past 12:00 — the drawing owns
 * the wrap). The completeness-only form keeps the
 * centred-on-top reading for callers holding nothing
 * but the fraction.
 */
export function fragmentSectorFor(
  completeness: number,
  arc?: FragmentArc,
): FragmentSector {
  if (arc) {
    return {
      fraction: Math.min(1, Math.max(0, arc.arcHours / CLOCK_HOURS)),
      startDeg: arc.arcStart * 30,
      endDeg: arc.arcStart * 30 + arc.arcHours * 30,
    };
  }
  const fraction = Math.min(1, Math.max(0, completeness));
  return {
    fraction,
    startDeg: -180 * fraction,
    endDeg: 180 * fraction,
  };
}

// ---------------------------------------------------------------------------
// Mark names — the ONE naming home (UI's need, 2026-10-31)
// ---------------------------------------------------------------------------
//
// Surfaces must not each title-case the mark id and hope
// they agree: the pill, the teaching beat, the journal
// rows, and the grimoire all read the name from HERE.
// A mark registers when its first fragment site is
// placed; the fragment-bearing marks today are the
// founding three. Unregistered marks render as their
// bare id (markDisplayName passes it through) — the
// visible prompt to register a mark here BEFORE its
// surfaces ship, never after they drift.

export const MARK_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  home: 'Home',
  circle: 'Circle',
  travel: 'Travel',
  // The Home pillar's marks (2026-11-05 — the Home
  // wiring): each taught by its own fragments.
  returning: 'Returning',
  hedge: 'Hedge',
  hearthhome: 'HearthHome',
  naming: 'Naming',
};

/** The canonical display name for a mark id (the id itself until registered). */
export function markDisplayName(mark: string): string {
  return MARK_DISPLAY_NAMES[mark] ?? mark;
}

/** One transcribed fragment, as the journal keeps it. */
export interface SavedFragmentCopy {
  /** The site-carrier's stable identity (the caller's anchor id). */
  fragmentId: string;
  /**
   * The copy's weathering grade in [0, 1] — the site's
   * fact (how complete a copy this inscription yields),
   * passed by the caller and clamped here.
   */
  completeness: number;
  /**
   * The copy's DEALT arc (2026-11-07): the start hour
   * (0-11) of its stretch of the sign. OPTIONAL — a
   * copy inscribed before arcs were dealt carries
   * neither arc field and bridges from its
   * completeness (see arcOfCopy).
   */
  arcStart?: number;
  /** The copy's dealt arc length in hours (dealt: 4-6). */
  arcHours?: number;
  /**
   * The clock this copy was dealt into (0-based),
   * DERIVED by the accumulation replay and written on
   * snapshot for the journal's per-clock reading.
   * Restore never trusts it — the replay re-derives.
   */
  clock?: number;
  /** The day she transcribed it (the caller's day count). */
  day: number;
}

/** One mark's progress in the journal. */
export interface SavedMarkProgress {
  mark: string;
  copies: SavedFragmentCopy[];
  /** The day the first copy landed — the pursuit's named start. */
  seekingSinceDay: number | null;
  /** The day the first clock first filled (tier 1's day). */
  completedDay: number | null;
}

/** The journal-surface read of one mark. */
export interface MarkTally {
  /** Copies held of this mark (the record's count). */
  count: number;
  /** Clocks filled (tiers earned, before the cap). */
  fills: number;
  /** Hours covered in the current clock (0-11). */
  coveredHours: number;
  /**
   * Hours still wanted to fill the current clock
   * (12 - coveredHours). RE-READ under the clock law
   * (2026-11-07): this field once carried the count
   * threshold; the toast prose that reads it is the
   * surface's to reword to the clock.
   */
  needed: number;
  /** The mark stands at its tier cap. */
  complete: boolean;
  /**
   * The current clock's coverage as a fraction
   * (coveredHours / 12; null before any copy).
   * RE-READ under the clock law: this once carried
   * the kept-best copy's weathering; the journal's
   * grade words now read COVERAGE (Systems' proposed
   * scale: >= 9/12 clear, >= 5/12 worn, else faint —
   * DRAFT, for the surface's adoption).
   */
  best: number | null;
}

// ---------------------------------------------------------------------------
// Outcomes — typed codes, never prose (the rename lesson)
// ---------------------------------------------------------------------------

export type InscribeRefusalCode =
  | 'no-journal' // nothing recorded; the fragment stays in the world
  | 'already-inscribed'; // this fragment is already noted

export type InscribeResult =
  | {
      ok: true;
      /** True exactly once per mark: the teaching moment. */
      first: boolean;
      /** Copies of THIS mark after this inscription. */
      count: number;
      /** This inscription FILLED a clock (a tier stands earned). */
      tierComplete: boolean;
      /**
       * This copy added sign she did not have — the
       * union grew (a completing copy always qualifies;
       * a fully-overlapping duplicate never does).
       * RE-READ under the clock law (the successor of
       * the kept-best beat; the name is a rename
       * candidate for the surface's pass).
       */
      bestImproved: boolean;
    }
  | { ok: false; code: InscribeRefusalCode };

// ---------------------------------------------------------------------------
// The state — progress by mark, noted fragment ids across all marks
// ---------------------------------------------------------------------------

export class FragmentState {
  private readonly marks = new Map<string, SavedMarkProgress>();
  private readonly inscribedIds = new Set<string>();

  constructor(saved?: readonly SavedMarkProgress[]) {
    if (saved) {
      for (const progress of saved) {
        if (this.marks.has(progress.mark)) {
          continue;
        }
        const copies: SavedFragmentCopy[] = [];
        for (const copy of progress.copies) {
          if (this.inscribedIds.has(copy.fragmentId)) {
            continue;
          }
          this.inscribedIds.add(copy.fragmentId);
          copies.push({ ...copy });
        }
        const derived = deriveMarkClocks(copies);
        this.marks.set(progress.mark, {
          mark: progress.mark,
          copies,
          seekingSinceDay: progress.seekingSinceDay,
          completedDay:
            progress.completedDay ??
            (derived.fills >= 1 ? derived.firstFillDay : null),
        });
      }
    }
  }

  /** Every mark's progress (the save snapshot reads this). */
  snapshot(): SavedMarkProgress[] {
    return [...this.marks.values()].map((progress) => {
      const derived = deriveMarkClocks(progress.copies);
      return {
        ...progress,
        copies: progress.copies.map((copy, index) => ({
          ...copy,
          clock: derived.clocks[index] ?? 0,
        })),
      };
    });
  }

  /** One mark's progress, if she has begun it. */
  progressFor(mark: string): SavedMarkProgress | undefined {
    const progress = this.marks.get(mark);
    return progress
      ? { ...progress, copies: progress.copies.map((copy) => ({ ...copy })) }
      : undefined;
  }

  /** The tally the journal surface reads for one mark. */
  tallyFor(mark: string): MarkTally {
    const progress = this.marks.get(mark);
    const count = progress?.copies.length ?? 0;
    const derived = deriveMarkClocks(progress?.copies ?? []);
    return {
      count,
      fills: derived.fills,
      coveredHours: derived.coveredHours,
      needed: CLOCK_HOURS - derived.coveredHours,
      complete: derived.fills >= tierCapFor(mark),
      best: count === 0 ? null : derived.coveredHours / CLOCK_HOURS,
    };
  }

  /**
   * The tier a mark stands KNOWN at: its FILLED
   * CLOCKS, capped at the mark's tier cap (0 = not
   * yet a mark she holds). The read the doors gate
   * on — a tiered mark reads 0..3, a single-tier or
   * founding mark 0..1 (the clock law, 2026-11-07;
   * the copy count gates nothing).
   */
  knownTier(mark: string): number {
    const derived = deriveMarkClocks(
      this.marks.get(mark)?.copies ?? [],
    );
    return Math.min(derived.fills, tierCapFor(mark));
  }

  /**
   * Standing toward the next tier, under the clock
   * law: the fills banked and the current clock's
   * covered hours; nextTier is null at the cap.
   */
  tierProgress(mark: string): {
    fills: number;
    coveredHours: number;
    nextTier: number | null;
  } {
    const derived = deriveMarkClocks(
      this.marks.get(mark)?.copies ?? [],
    );
    return {
      fills: derived.fills,
      coveredHours: derived.coveredHours,
      nextTier:
        derived.fills < tierCapFor(mark) ? derived.fills + 1 : null,
    };
  }

  /**
   * The pursuit list: marks begun but not complete —
   * she is looking for more of each. Completed marks
   * leave the list by completing, not by expiring.
   */
  seekingMarks(): SavedMarkProgress[] {
    return this.snapshot().filter(
      (progress) =>
        progress.copies.length > 0 &&
        deriveMarkClocks(progress.copies).fills <
          tierCapFor(progress.mark),
    );
  }

  /**
   * Transcribe one faced fragment into the journal.
   * Checks before recording anything: the journal
   * gate first (nothing is recorded without it), then
   * the already-noted gate. On a mark's first copy the
   * pursuit begins (seekingSinceDay); on the copy that
   * first FILLS a clock, completedDay is set.
   * Duplicates — new fragments of held marks — record
   * like any copy, past a fill too.
   */
  inscribe(
    fragmentId: string,
    mark: string,
    completeness: number,
    hasJournal: boolean,
    day: number,
    arc?: FragmentArc,
  ): InscribeResult {
    if (!hasJournal) {
      return { ok: false, code: 'no-journal' };
    }
    if (this.inscribedIds.has(fragmentId)) {
      return { ok: false, code: 'already-inscribed' };
    }
    const dealtArc: FragmentArc | undefined =
      arc &&
      Number.isFinite(arc.arcStart) &&
      Number.isFinite(arc.arcHours)
        ? {
            arcStart: Math.min(11, Math.max(0, Math.floor(arc.arcStart))),
            arcHours: Math.min(12, Math.max(1, Math.floor(arc.arcHours))),
          }
        : undefined;
    // A dealt copy's completeness IS its arc share, so
    // the record reads the same under either dealing.
    const grade = dealtArc
      ? dealtArc.arcHours / CLOCK_HOURS
      : Number.isFinite(completeness)
        ? Math.min(1, Math.max(0, completeness))
        : 0;
    let progress = this.marks.get(mark);
    const first = progress === undefined;
    if (!progress) {
      progress = {
        mark,
        copies: [],
        seekingSinceDay: day,
        completedDay: null,
      };
      this.marks.set(mark, progress);
    }
    const before = deriveMarkClocks(progress.copies);
    const signBefore = before.fills * CLOCK_HOURS + before.coveredHours;
    progress.copies.push({
      fragmentId,
      completeness: grade,
      day,
      ...(dealtArc
        ? { arcStart: dealtArc.arcStart, arcHours: dealtArc.arcHours }
        : {}),
    });
    this.inscribedIds.add(fragmentId);
    const count = progress.copies.length;
    const after = deriveMarkClocks(progress.copies);
    const tierComplete = after.fills > before.fills;
    if (after.fills >= 1 && progress.completedDay === null) {
      progress.completedDay = day;
    }
    const signAfter = after.fills * CLOCK_HOURS + after.coveredHours;
    // The journal declares its own change (journalChanges.ts):
    // a banked copy is a journal write — the mark's first
    // copy stands a new entry, every later copy deepens it.
    // The refusals above returned already and emit nothing;
    // the constructor's restore path never reaches here, so
    // a load stays silent by construction.
    emitJournalChange({
      kind: 'fragment',
      label: markDisplayName(mark),
      ...(first ? {} : { deepen: true }),
    });
    return {
      ok: true,
      first,
      count,
      tierComplete,
      bestImproved: !first && signAfter > signBefore,
    };
  }
}
