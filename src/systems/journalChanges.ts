/**
 * JOURNAL CHANGES — the journal's states declare their
 * own changes (Systems, 2026-11-06; the journal phase's
 * first bite: Adam's toast — 'whenever the Journal is
 * updated, we want a message to appear on screen').
 *
 * THE PATTERN: the emitter declares its own events. A
 * journal-writing state emits a named change fact at
 * its live write seat; the shell subscribes once at
 * boot and surfaces the fact (the toast + the Newest
 * ordering read the same facts). This module is a
 * LEAF — no imports, no game bus (systems never
 * imports game) — so any state may emit into it
 * without a cycle.
 *
 * RESTORE SILENCE, as law: facts fire on LIVE WRITES
 * ONLY. The emit seats are the write functions
 * (inscribe, awaken, the naming writes); restore and
 * snapshot paths never emit, so a load can never
 * toast for entries the player wrote in a past
 * session.
 *
 * COALESCING a burst into one line is the shell's
 * draft care, not this module's: every write emits
 * its own fact, in order.
 */

/** What kind of journal entry a change belongs to. */
export type JournalChangeKind = 'fragment' | 'awakening' | 'place' | 'quest';

/**
 * One journal change. label is the player-facing name
 * where one exists (the mark's display name, the
 * charm's 'Primal Bone - ...' spelling, the place's
 * name, the quest's title). deepen = the change
 * deepened an EXISTING entry (a further fragment
 * copy, a tier-up) rather than standing a new one;
 * absent on a first entry.
 */
export interface JournalChange {
  kind: JournalChangeKind;
  label: string;
  deepen?: boolean;
}

type JournalChangeListener = (change: JournalChange) => void;

const listeners = new Set<JournalChangeListener>();

/**
 * Declare a journal change. Called ONLY by the
 * journal-writing states at their live write seats —
 * never by restore, never by the shell on a state's
 * behalf (the emitter declares its own events; the
 * one named exception is the quest seat, whose writer
 * is the shell's completion detection — DEV's ruling,
 * 2026-11-06).
 */
export function emitJournalChange(change: JournalChange): void {
  // Iterate a copy: a listener may unsubscribe itself
  // mid-burst without skipping its neighbours.
  for (const listener of [...listeners]) {
    listener(change);
  }
}

/**
 * Hear journal changes. Returns the unsubscribe.
 * The shell subscribes once at boot.
 */
export function subscribeJournalChanges(
  listener: JournalChangeListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
