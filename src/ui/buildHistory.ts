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
 * Per Adam's 2026-10-27 rule (document each one), EVERY
 * merge is recorded — including the docs-only merge
 * (PR #3, listed as 'Docs merge') and record-only merges
 * (Merge #6, which carried only the #5 entry live).
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
    merge: 'Merge #13',
    pr: 27,
    sha: '90118be',
    date: '2026-10-28',
    what: 'Ambient animals in the world — 26 kinds (bone kinds + trap set + shrew), wander/idle/flee behaviors, water + perched + night-fly shapes, simple low-poly models with bob/hop/swim-drift/wing-flutter animation, per-kind biome presence (salt flat empty, deep bog frog + muskrat only), ≤3 per chunk, deterministic seed respawn (no save changes).',
    why: 'The world stops being empty of life — animals she can watch, that wander, flee, and fly, in the biomes where they belong, without combat, hunting, or any tie to traps or bone scatters.',
  },
  {
    merge: 'Merge #12',
    pr: 25,
    sha: '5241f1a',
    date: '2026-10-28',
    what: 'Remaining-charm factor helpers (rabbit flee, raccoon loot, wolf signs — helpers only), stump crafting header names the tree stump, groundhog tier-1 rested day + waking refresh, flowers in the flowered biomes (meadow, forest, oldfield rise, creek bottom), groundhog shell wiring + snake drain factor (shrew × snake × rested = 0.729), mouse/bear/deer shell wiring (home +25, pack +10, storm warning line).',
    why: 'The tier-1 charm effects finish their wiring — a rested day, a slower drain, more room at home and in the pack, and a storm\u2019s warning — with flowers where they make sense and the stump named plainly in the crafting menu.',
  },
  {
    merge: 'Merge #11',
    pr: 23,
    sha: 'df96297',
    date: '2026-10-28',
    what: 'Torches complete + placed torches, intro modal, Esc options + Esc-[X], FIND CAMP end-to-end, paper chain, LOOK state + action then parked, moon phases, placed altar + ritual staging + Waking recipes + first charm, world + individual bones, pickup-as-look, shrew effect, charm list + examination panel, charm hooks (owl night sight, bat fog, pigeon way-home, beaver/turtle exposure inputs, deer storm signal, fox speed, mole clay sense), zone coords display, frog water hint.',
    why: 'The charm system playable end to end — bones she picks up, identifies, stages, and speaks, charms that live in their own list and work from it — with zone coords and a frog\u2019s water sense to find her way, and torches, camp-finding, and moonlight along the way.',
  },
  {
    merge: 'Merge #9',
    pr: 19,
    sha: '24c1547',
    date: '2026-10-27',
    what: 'Carrying in pounds, tool rides free, large basket replaces the small, multi-kind piles (entity + grant + menu + whole-pile take-all listener), flint findable + water bodies visible, flint alias completing the lighting path, build-history #8 entry.',
    why: 'Pounds she can read, a tool that rides free, and piles that hold many kinds and give them back one kind at a time or whole — with flint findable at last, the lighting path she already had finally works from the ground up.',
  },
  {
    merge: 'Merge #8',
    pr: 17,
    sha: '3f568d8',
    date: '2026-10-27',
    what: 'Sleep until sunrise, hunger drain pinned 1 point per 30 seconds + eat +5, edible mushrooms hunger-exempt, campfire visibility + tap fix, USE centered + pile pickup fix, build-history #7 entry + completeness.',
    why: 'Sleep at night by her house, hunger tuned to the pinned pace with food that reopens foraging, edible mushrooms that no longer lock out the hungry, and a campfire she can see and tap — with USE centered and piles that pick up.',
  },
  {
    merge: 'Merge #7',
    pr: 15,
    sha: 'd0812a2',
    date: '2026-10-27',
    what: 'Carried candle light, trap craft confirm + placement + save, forage hints, mushroom sources + foods, oak axe gates + ground acorns, kindling, fire light + flame animation, apple trees + apple food, hunger bar + number, touch row level, first-person default, world-state save (fires lit + lighting, harvest, sky, facing).',
    why: 'The world now remembers itself across a refresh — harvested ground, lit fires, sky time, and facing — traps stay placed, and the first fruit tree arrives with the forage guidance for its food.',
  },
  {
    merge: 'Merge #6',
    pr: 13,
    sha: '70ebae7',
    date: '2026-10-26',
    what: 'Build-history #5 entry — the merge #5 record itself, put on the live build.',
    why: 'The record-keeping merge: the history tab could not show merge #5 until this merge carried its entry live.',
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
    merge: 'Docs merge',
    pr: 3,
    sha: '4062a94',
    date: '2026-10-26',
    what: 'ReadMeDocs copy — documentation only, no game code changed.',
    why: 'Completeness: every merge on record, including the docs-only copy.',
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
