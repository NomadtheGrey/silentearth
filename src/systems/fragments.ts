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
 * - THE THRESHOLD: a Tier I mark takes 3 fragments OF
 *   THAT MARK. Counting is per-mark, never pooled —
 *   2 Home + 2 Travel completes neither.
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
 *   grows past the threshold, nothing is capped or
 *   discarded — and the kept-best copy is a DERIVED
 *   read (the best weathering among the copies), so
 *   any ruling Adam lands (keeps-the-better; more
 *   copies, more benefit; past-3-doesn't-count) is a
 *   tally change over a true record, not a migration.
 *
 * All numbers and the completeness scale are DRAFT
 * for Adam's pin pass.
 */

// ---------------------------------------------------------------------------
// Records — the persisted shape
// ---------------------------------------------------------------------------

/** Fragments of one mark a Tier I wants (Adam's threshold rule). */
export const FRAGMENTS_FOR_TIER = 3;

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
  /** The day she transcribed it (the caller's day count). */
  day: number;
}

/** One mark's progress in the journal. */
export interface SavedMarkProgress {
  mark: string;
  copies: SavedFragmentCopy[];
  /** The day the first copy landed — the pursuit's named start. */
  seekingSinceDay: number | null;
  /** The day the count first reached the threshold. */
  completedDay: number | null;
}

/** The journal-surface read of one mark. */
export interface MarkTally {
  count: number;
  needed: number;
  complete: boolean;
  /** The kept-best copy's weathering (null before any copy). */
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
      tierComplete: boolean;
      /** This copy beat the mark's previously kept best. */
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
        this.marks.set(progress.mark, {
          mark: progress.mark,
          copies,
          seekingSinceDay: progress.seekingSinceDay,
          completedDay: progress.completedDay,
        });
      }
    }
  }

  /** Every mark's progress (the save snapshot reads this). */
  snapshot(): SavedMarkProgress[] {
    return [...this.marks.values()].map((progress) => ({
      ...progress,
      copies: progress.copies.map((copy) => ({ ...copy })),
    }));
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
    let best: number | null = null;
    for (const copy of progress?.copies ?? []) {
      best = best === null ? copy.completeness : Math.max(best, copy.completeness);
    }
    return {
      count,
      needed: FRAGMENTS_FOR_TIER,
      complete: count >= FRAGMENTS_FOR_TIER,
      best,
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
        progress.copies.length < FRAGMENTS_FOR_TIER,
    );
  }

  /**
   * Transcribe one faced fragment into the journal.
   * Checks before recording anything: the journal
   * gate first (nothing is recorded without it), then
   * the already-noted gate. On a mark's first copy the
   * pursuit begins (seekingSinceDay); on the copy that
   * reaches the threshold, completedDay is set.
   * Duplicates — new fragments of held marks — record
   * like any copy, past the threshold too.
   */
  inscribe(
    fragmentId: string,
    mark: string,
    completeness: number,
    hasJournal: boolean,
    day: number,
  ): InscribeResult {
    if (!hasJournal) {
      return { ok: false, code: 'no-journal' };
    }
    if (this.inscribedIds.has(fragmentId)) {
      return { ok: false, code: 'already-inscribed' };
    }
    const grade = Number.isFinite(completeness)
      ? Math.min(1, Math.max(0, completeness))
      : 0;
    const previousBest = this.tallyFor(mark).best;
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
    progress.copies.push({ fragmentId, completeness: grade, day });
    this.inscribedIds.add(fragmentId);
    const count = progress.copies.length;
    const tierComplete = count >= FRAGMENTS_FOR_TIER;
    if (tierComplete && progress.completedDay === null) {
      progress.completedDay = day;
    }
    return {
      ok: true,
      first,
      count,
      tierComplete,
      bestImproved: previousBest !== null && grade > previousBest,
    };
  }
}
