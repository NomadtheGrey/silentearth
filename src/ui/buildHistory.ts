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
    merge: 'Merge #22',
    pr: 45,
    // Second merge replaces this with the real merge sha.
    sha: 'pending',
    date: '2026-10-29',
    what: 'New Game button + handler (fully fresh, reload route): a New Game section in the Cloud Saves panel parks the current save, clears only the save key, and reloads into the existing first-run dialog; Begin works verbatim and the intro re-opens. Park failure cancels cleanly, changing nothing.',
    why: 'Starting over should be one confirmed press, not file surgery: the old world is parked (bring it back with Restore), and the new world begins exactly like the first one did.',
  },
  {
    merge: 'Merge #21',
    pr: 43,
    sha: '47107b4',
    date: '2026-10-29',
    what: 'Cloud saves (module + panel + wiring + word list): three-word sign-in, save mirroring to the cloud box, cloud list, bring-down with local parking, and a 6,216-word list. New Game is not in this merge — it rides after cloud.',
    why: 'A save should survive the device: the game mirrors to the cloud when opted in, and a world can be brought down again later without ever deleting the local save.',
  },
  {
    merge: 'Merge #20',
    pr: 41,
    sha: '05bc426',
    date: '2026-10-28',
    what: 'World name field (save carries worldName; cloud envelope name rides it) + first-run dialog (name + seed before the intro, Begin opens the intro, Esc guard, Begin-only, persists at first save; the intro itself untouched).',
    why: 'A world should have a name before it has a story: the first run asks for the name and seed up front, and the name travels with the save into the cloud envelope later. New Game is not in this merge — it rides after cloud.',
  },
  {
    merge: 'Merge #19',
    pr: 39,
    sha: 'c020caf',
    date: '2026-10-28',
    what: 'Creature identifier tags (nearest animal pill, 32 m cap) + 13 new flowers with items and foods (kinds, models, weights, 12 kebab items, 3 foods) + tree-hung beehives (hives hang beside trunks at 1.8 m, torch beneath reads as "under" for safe honey harvest).',
    why: 'The world names what it shows: animals read by name at a glance, the flowered country is harvestable instead of scenery-only, and hives finally have an "under" so the torch-under-hive rule makes sense in the fiction.',
  },
  {
    merge: 'Merge #18',
    pr: 37,
    sha: '745e2d4',
    date: '2026-10-28',
    what: 'Live TDZ fix (App.tsx only): optionsOpen + introOpen declarations moved above the trapRowTrap + hiveRowHive IIFEs that read them in their gating lists — no logic change, no other file.',
    why: 'The game must boot: after merge #17 the live page went white because the trap/hive rows ran before the state they read was declared, so the declarations move above the rows that use them.',
  },
  {
    merge: 'Merge #17',
    pr: 35,
    sha: 'f0699c9',
    date: '2026-10-28',
    what: 'Camping: sleeping bag (loom) + tent (workstation) place/pickup, pack-counted weights, SavedTent save shape; house-entries merge (one Woven Cottage entry, wattle + prototype recipes removed); tent shelter branch (tent query 0.85 within 2.5 m, best-of with houses, houseId null on tent win; A-frame tent model + renderer.setTents); tent shell rows (tent place row + world-anchored TentChip + take-down) + setTents wiring (place/pickup/boot restore/regenerate clear push the shell list to the renderer).',
    why: 'She can camp where she stands — a bag to sleep on and a tent that shelters her — with one cottage entry to build toward, and the tent she places actually reading as shelter in the world.',
  },
  {
    merge: 'Merge #16',
    pr: 33,
    sha: '305af73',
    date: '2026-10-28',
    what: 'Trap catch layer (kind sets + hourly resolve + collect) + trap catch state (catch/baited + trap:catch event) + wild beehives in flowered biomes + key letters on HUD (I/K/L/P) + Dirt-row suppression when a scatter is present + nearest-scatter identifier tag + vine/tender merge (vine def deleted, weights folded into tender) + campfire chip "click to light" + touch tap-near-fire + lighting progress bar + campfire flame seated in the tipi + multi-kind pile dialog arrows + Esc closes panels topmost-first.',
    why: 'Traps get the state their trigger and row will complete, beehives arrive where the flowers are, the HUD stops shouting Dirt over what she is looking at, campfires read and light plainly, piles handle by kind, and Esc closes what is open before it opens Options.',
  },
  {
    merge: 'Merge #15',
    pr: 31,
    sha: 'd4aecc4',
    date: '2026-10-28',
    what: 'Crow pile-glow arrows + shell wiring: per-pile arrow rows (tier-2 direction-only, tier-3 + range + compass), visibility strictly via crowPileArrow, glyph rotation verified per camera mode, syncCrowTier beside syncCharmHooks (boot + ritual completion). Closes the crow glow landing.',
    why: 'The crow charm finally points the way — bright piles gain arrows that show where they are, near or far, so she can follow her memory instead of wandering.',
  },
  {
    merge: 'Merge #14',
    pr: 29,
    sha: '623cc3e',
    date: '2026-10-28',
    what: 'Quest Log tab in Options (15 quests, flags wired so every quest completes on its action), PC keys (E + click harvest, Shift+E remove confirm, I/K/L/P toggles + guards), sleep anywhere (shelter gate removed), crow pile-glow base (fact + marker; UI arrows + shell wiring follow), favicon v2 (dark hat + light outline + pale crescent), stump top fix, single-tap campfire, pill over stump center, traps doc resolutions.',
    why: 'The game gets a to-do list that completes on its actions, desktop keys that match phone taps, sleep anywhere she is, and a favicon that reads on dark and light tabs — while the crow glow starts at its base level.',
  },
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
