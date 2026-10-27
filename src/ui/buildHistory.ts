/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — build records (UI lane, data only).
 *
 * The first built piece of the changelog system Adam ordered
 * (2026-10-26): the Options modal's second tab lists these,
 * newest first, capped at 20. Each record carries what changed,
 * WHY, the date, and the merge reference (PR number + short
 * merge SHA) — all four are the minimum the spec requires.
 *
 * The data lives here on the UI side, per the brief: if Adam
 * later wants it Systems-owned, moving this file is a trivial
 * follow-up, not a rewrite. Nothing here is game logic — just
 * the record list the tab renders.
 *
 * WORDINGS ARE DRAFT for Adam's pin pass: the brief supplied
 * the batch summaries, and the lane worded the why-lines from
 * them. Correct them in this file when Adam corrects them.
 *
 * The docs-only merge 4062a94 (PR #3, ReadMeDocs copy) is
 * DELIBERATELY EXCLUDED: the tab lists game builds, and a
 * docs copy changed no game code. Adding it back is one
 * entry here if Adam wants the complete merge sequence.
 */

/** One merged batch, as the Build history tab shows it. */
export interface BuildRecord {
  /** Batch label, e.g. "Merge #4". */
  merge: string;
  /** Merge PR number (reverse-sync PRs are not records). */
  pr: number;
  /** Short merge SHA on main. */
  sha: string;
  /** Merge date, YYYY-MM-DD. */
  date: string;
  /** What changed in the batch. */
  what: string;
  /** WHY — the reason the batch exists. */
  why: string;
}

const ALL_RECORDS: BuildRecord[] = [
  {
    merge: 'Merge #7',
    pr: 15,
    sha: 'd0812a2',
    date: '2026-10-27',
    what: 'Carried candle light, trap craft confirm + placement + save, forage hints, mushroom sources + foods, oak axe gates + ground acorns, kindling, fire light + flame animation, apple trees + apple food, hunger bar + number, touch row level, first-person default, world-state save (fires lit + lighting, harvest, sky, facing).',
    why: 'The world now remembers itself across a refresh — harvested ground, lit fires, sky time, and facing — traps stay placed, and the first fruit tree arrives with the forage guidance for its food.',
  },
  {
    merge: 'Merge #5',
    pr: 11,
    sha: 'eaf5ec6',
    date: '2026-10-26',
    what: 'Pile pickup + save, desktop pickup, umbrella graphic + driving, pause complete, crafting grouping + accordion + dependency rows, tap fix, glyphs, perspective in Options, build-history tab, below-permit wording, station UI, sky, cordage hand-crafted.',
    why: "The post-merge-#4 follow-through Adam ordered: piles you can pick up and keep, a pause that holds, crafting you can read, and the umbrella you can see.",
  },
  {
    merge: 'Merge #4',
    pr: 9,
    sha: 'b007a40',
    date: '2026-10-26',
    what: 'Turning fixes, behind-camera view, turn stick, inventory front, screen-fixed harvest buttons, overflow piles, pitch fix.',
    why: "Adam's phone playtest findings (turning, thumb travel), his behind-view order, and the pitch fix he asked after.",
  },
  {
    merge: 'Merge #3',
    pr: 7,
    sha: '756a5a4',
    date: '2026-10-26',
    what: 'Local save, location/biome/FPS chip, options modal, display names, detailed models, id fix.',
    why: "The phone batch's follow-through: a save that survives a refresh, and the screen info Adam asked for.",
  },
  {
    merge: 'Merge #2',
    pr: 5,
    sha: '00999d4',
    date: '2026-10-26',
    what: 'Phone build: touch controls (move/look/USE), phone HUD, scrollbars.',
    why: "Adam's Android playtest found the game unplayable on portrait phone — touch controls and a squished HUD were the answer.",
  },
  {
    merge: 'Merge #1',
    pr: 1,
    sha: 'edb7006',
    date: '2026-10-26',
    what: 'Redesign + MVP + gaps: first playable 3D batch (world, harvest, hunger, crafting, fire, shelter, clothes, umbrella).',
    why: "The rebuild's first landing — the 3D game Adam could actually play.",
  },
];

/** Build records, newest first, capped at 20. */
export const BUILD_HISTORY: BuildRecord[] = ALL_RECORDS.slice(0, 20);
