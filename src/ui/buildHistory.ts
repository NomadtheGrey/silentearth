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
    merge: 'Merge #36',
    pr: 73,
    sha: '4c4b7ff',
    date: '2026-10-30',
    what: 'A new old place: the Grain Silo \u2014 a galvanized tower on a cracked pad in oldfield country. In some worlds it stands whole, ladder up its side; in others its seam has split and old grain lies spilled pale at its base; in others it is down on its side where it fell, pointing a compass point. A squat grain bin stands beside some of them. And the caves are no longer one: they recur across the whole country now, a mouth in broken wooded ground wherever she ranges \u2014 each its own dark, its own chambers, and in the deepest part of each a fragment anchor waits. She enters at any mouth she faces and comes out the way she went in; quitting inside a cave wakes her at its mouth. Small pack wording now says the cauldron sits at a lit hearth, which is where it sits.',
    why: 'Adam asked why there was only one cave \u2014 there should be plenty, for exploring, however far she travels. So the world learned distribution: recurring places now derive cell by cell across the whole map instead of sitting on a single bearing from home, and lesser grove-mazes will follow caves onto the same layer. Underneath, the last five of the older siting scans took the fallback repair the barn\u2019s build had exposed: a census across twenty-four worlds proved no lawfully seated place moved \u2014 two rail sidings that had been seated too close to their neighbours were the only seats to change, and both are legal now.',
  },
  {
    merge: 'Merge #35',
    pr: 71,
    sha: 'cd1b386',
    date: '2026-10-30',
    what: 'Her position reads in whole numbers now \u2014 no decimals trailing her across the country. The woods have been tuned by her own walk through them: the first gathering read as scattered trees, so the groves now stand bigger and tighter, trunks close enough to close a canopy, and the country between them is honestly sparse \u2014 a lone tree is a landmark again. A new old place joins the world: the Barn, farm country\u2019s working ruin \u2014 in some worlds standing whole with its big door ajar, stalls along one wall and the loft overhead; in others holed; in others with one end down and its roof dropped inside. No two barns roll the same: length, ruin, stalls, lean-to and hay all draw from the place\u2019s own streams. On her phone, USE and JUMP have moved out of the middle of her view into one row above the turn ring, on her right thumb\u2019s arc.',
    why: 'Adam\u2019s playtest verdicts, carried through: the woods remark, the buttons sitting on the reticle, coordinates finer than anyone needs. The barn opens the new-types run \u2014 every place of a type now rolls its own dial sheet, so a type is a family, not a stamp. Underneath, the barn\u2019s build caught a quiet flaw in how three older places chose their ground \u2014 a seat could land closer to a neighbour than the spacing law allows; the fix was gated on a census proving no lawfully seated place moves, and none did.',
  },
  {
    merge: 'Merge #34',
    pr: 69,
    sha: '2420645',
    date: '2026-10-30',
    what: 'Four more of the world\u2019s old places, and a save that stays saved. The General Store: a mostly-standing false-front shop on the oldfield edge \u2014 boardwalk porch, a counter with the keeper\u2019s gap, shelves of goods nobody can take, and a gap at the back where the stove stood. The Drowned Mill: seated on the river itself \u2014 in some worlds standing, its wheel in the current and its race running to the water; in others gone over entirely, hinge wall broken and slabs in the wreck. The Sunken Road: a drowned stretch of old pavement running somewhere with its ends lost, water over its middle and one blank sign where her approach meets it. The Rail Siding: a grid-straight spur ending at a timber buffer, a stranded boxcar mid-line with its door open on a load that shifted against it long ago. And a fix she will feel rather than see: starting a new game, or bringing one down from the cloud, can no longer be undone by the page closing \u2014 the unload was quietly rewriting the old session over the fresh start.',
    why: 'Adam\u2019s locations buildout, carried through the standing places \u2014 and underneath them the world learned a new shape: the ribbon, a place that is a line with a width, so a road and a rail line sit in the world as what they are instead of as chains of circles. The save fix closes a race Adam found live on his phone: the pagehide autosave firing during the very reload that was meant to leave the old session behind.',
  },
  {
    merge: 'Merge #33',
    pr: 67,
    sha: '1be468c',
    date: '2026-10-30',
    what: 'Two more of the world\u2019s old places, and the first way down. The Farmhouse: a roofed ruin in the oldfield country \u2014 porch, a partition wall, a hearth with its great stone, and a cellar door set in the back foundation. The Chapel: a taller shell with a steeple over the door end and a quiet graveyard of stones beside it, one stone by the door path carrying the inscription. And the cave: a dark opening in broken ground, seeded like every other place, with the farmhouse\u2019s cellar door for its second mouth \u2014 step through and she is somewhere else entirely, a pocket dimension of rock chambers in true dark, pale fungus glowing near the entrance and nothing lit deeper except what she carries; in some worlds a shaft drops to a second layer. She comes out the mouth she went in by, and a save written underground wakes her at that mouth, never down in the dark. Every place now also keeps the one distance from every other \u2014 the same margin, everywhere.',
    why: 'Adam\u2019s locations buildout, and his ruling that caves are their own dimension: the overworld is dimension 0, and this cave is the first other entry on that list. The farmhouse is the Home story\u2019s ground and the chapel the Circle\u2019s; the cave machinery underneath \u2014 dimensions, travel that checks the ground before it moves her \u2014 is built to carry every pocket place that comes after.',
  },
  {
    merge: 'Merge #32',
    pr: 65,
    sha: '0b08e06',
    date: '2026-10-30',
    what: 'The woods gather. Trees no longer scatter evenly across the world \u2014 they stand in groves and stands with open country between, small copses in meadow and oldfield, full woods where the forest carries, none at all in salt flat or deep bog, and never close enough to swallow a place\u2019s clearing. A stump can become an altar: at a plain stump she can place four river stones, draw a glyph with a charcoal stick (held, never spent), and set a candle burning \u2014 each making shows on the stump itself, a ring of stones at its base, the dark glyph on its face, the lit candle on top \u2014 and a finished Stumpy Altar is altar-grade ground, where her carried journal can be linked to the one grimoire. And far out, the smoke has a source: the Burnt Village, a street of houses in ash \u2014 some standing with their roofs on, most charred or fallen \u2014 a well at the street\u2019s edge, one hearth house still whole, and its smoke column rising high enough to be seen from most of the way there.',
    why: 'Three of Adam\u2019s threads land together: the landscape grammar he asked for (spread-out trees, yes, but also smaller groves and larger forests), the stump\u2019s second calling as the poor altar anyone can make, and the first avenue made real \u2014 the smoke she has wondered at finally has somewhere to lead her.',
  },
  {
    merge: 'Merge #31',
    pr: 63,
    sha: '175e0d3',
    date: '2026-10-30',
    what: 'The world gains its first unique places. The Grove: a seeded place of old trees west of spawn, ringed by standing stones, its heart and a carved fragment stone hidden in a hedgerow maze whose hedges block and slide like walls — and the trees are hers and protected, wearing a plain Grove Tree name tag and no pill, their refusal spoken in the witch\u2019s own voice if a harvest is forced. The Schoolhouse: an open-air ruin farther out (occupied places sit deeper in the world — she has not met people yet), a roofless wall ring with a door gap she enters by, rows of desks, the blackboard on the teaching wall, a bell tower at the corner, and a flagpole beside the door; its walls and desks are solid, its rubble is not. And the ground itself now resists: marsh and swamp already slowed her on their curve, and standing in water — the river or a pond — floors her at wading pace, one wetness never charged twice; bog boots ease the bog and do nothing in water.',
    why: 'Adam\u2019s place-work: a world she can cross deserves places that are somewhere — seeded from the world itself, so every world has its grove and its school, always in the same spot. Resistance finishes the terrain story he asked for: marsh, more for swamp, much more for wading.',
  },
  {
    merge: 'Merge #30',
    pr: 61,
    sha: '32768ab',
    date: '2026-10-30',
    what: 'The placed cauldron is complete end to end: from the pack it goes onto a faced hearth, and from then on the pot is a target of its own \u2014 it outranks its own hearth when both are faced, its pill reads RENDER, and picking it up refuses on a full pack and leaves the pot standing. Its save binds by hearth alone. So rendering tallow and melting candles now happen where they belong: at a faced pot on a lit hearth. The same batch sweeps the station-presence surface clean \u2014 the dead lit-fire fact, its orphaned query, and the caller-less fallback mapper are out, and the two live facts stay for the station door and anchor. No station is dark anywhere now.',
    why: 'The cauldron was founded in the last batch; this one gives it its hands. And the presence cleanup is the faced-target law keeping its own house \u2014 what no longer feeds anything no longer stands in the code.',
  },
  {
    merge: 'Merge #29',
    pr: 59,
    sha: '5feba05',
    date: '2026-10-30',
    what: 'No iron anywhere: the bloomery is gone end to end and the fire ladder tops at the kiln \u2014 the witch does not touch iron, and old saves migrate the retired fire and item cleanly. The writing desk and journal are built end to end (the grimoire\u2019s desk stands in the world; the journal is a listed single), and the clay cauldron is founded: kiln-fired, set on a hearth as its own target, bound to that hearth in the save. Candles burn from both roads \u2014 beeswax (hives now yield wax with the honey) and tallow, three per melt \u2014 and a charcoal stick joins the fire goods. Crafting obeys the station law: the panel shows only what her one faced target feeds, radius is retired, and the loom joins the race \u2014 every one of the 51 recipes sits in its group. Trees have kinds now: an oak is a fact of its spot, broader in the canopy, and fells to snap-wood plus a Downed Oak. Traps take their settled allocations (pot traps gain mice and voles; deer are untrappable), tallow no longer renders from frog or crayfish, and the station pills speak their acts: WEAVE, KRAFT, LIGHT, COOK, FIRE \u2014 and a lit hearth wears its name, Hearth.',
    why: 'Adam\u2019s no-iron tenet closed the bloomery thread for good, the desk gives the grimoire its home, and the station law makes crafting answer the thing she is actually facing \u2014 one target, one set of honest options. The rest is the world filling in: oak in the woods, wax in the hive, verbs on the pills.',
  },
  {
    merge: 'Merge #28',
    pr: 57,
    sha: 'ec250d0',
    date: '2026-10-29',
    what: 'The inventory title row reads as one line: in the stacked layout each row opens name \u2014 count @ weight \u2014 total (the one-liner format Adam pinned), composed at a single point, spelled \u201clb\u201d with the @ carrying the per-item meaning. The descriptor and buttons stay beneath it.',
    why: 'Adam\u2019s format pin on the last batch\u2019s title-row work \u2014 one line to scan, nothing wasted. A single-commit merge on his word.',
  },
  {
    merge: 'Merge #27',
    pr: 55,
    sha: '5f6bd16',
    date: '2026-10-29',
    what: 'Accidental-close guard: leaving, refreshing, or pressing back mid-game now asks first, with a leave-confirm dialog, so a stray swipe can\u2019t end a run. Inventory rows key their columns to the panel\u2019s own width instead of the screen\u2019s, and each row\u2019s meta rides its title row \u2014 name left, figures right, descriptor unobstructed beneath.',
    why: 'Adam kept losing the game to a stray back-swipe, and the inventory columns were answering the wrong width. A tiny batch, merged on his word as soon as everybody was done.',
  },
  {
    merge: 'Merge #26',
    pr: 53,
    sha: '615cad8',
    date: '2026-10-29',
    what: 'Cloud mirror coalescing ends the write-per-harvest burn: cloud saves now write at most once a minute (latest state only, flushed when the page hides). Harvest buttons fill as you work them, with the press count shown. Inventory rows and headers lay out cleanly on a phone; the quest log\u2019s house quests can actually complete; the ritual bone list greys out the kinds you don\u2019t carry. The opossum gains its long skinny tail, pointy face, and ears. Houses: recipe rows explain the upgrade ladder; the Thatch Hut loses its false ceiling cap and gains a real packed-earth floor; the Woven Cottage and Wooden Hut roofs open the same way; the home menu works anywhere inside your hut. The umbrella shows in the Protection line, and the apron is a true garment \u2014 worn, its +10 lb in the pockets only while you wear it.',
    why: 'Adam\u2019s live-play session drove the batch \u2014 and the cloud bill forced the headline: saving on every harvest was burning through the save box\u2019s writes, so testing paused until the coalesce shipped.',
  },
  {
    merge: 'Merge #25',
    pr: 51,
    sha: '247555a',
    date: '2026-10-29',
    what: 'Cloud saves made whole + resume re-lock: the cloud list now reads the save box\u2019s real index, so saved worlds actually appear in the panel, and a visible Load from cloud door lets typed words reach them. Resuming from pause in first-person now captures the mouse in the same click that unpauses \u2014 no second click to play.',
    why: 'A save you cannot see is not a save, and resume should put you back in the game in one gesture.',
  },
  {
    merge: 'Merge #24',
    pr: 49,
    sha: '6258e17',
    date: '2026-10-29',
    what: 'The playtest-fix stack (23 commits): menus release the mouse, panels swap in one press, one target at a time, and pausing never traps the pointer (no lock while paused, click anywhere on the veil to resume). Double-tap W sprints and Space jumps. Fish and eels swim under the surface, crayfish stay in the water, and the raccoon reads as a raccoon. Tall Sunflowers stand 2 m and turn their faces with the sun; the Thatch Hut loses its false ceiling; bones stay removed once taken. Crafting sinks owned recipes to the bottom, a completed sleep says so at dawn, and inventory rows now carry a short descriptor saying what each thing is for.',
    why: 'One long live-play session drove every line: the controls should not trap or double-act, the animals should live where they belong, and the world should say what things are.',
  },
  {
    merge: 'Merge #23',
    pr: 47,
    sha: '6132ede',
    date: '2026-10-29',
    what: 'PC keys rework + beautification + typing-leak fix: E now runs one USE action on the target she faces (R is that target\u2019s second action), with a desktop controls hint and digit badges on open menus (piles and the ritual panel included). The UI gains a consistency pass and three switchable looks (Mire & Hearth, Parchment & Ink, Ember Night) with the current look kept for comparison. And typing in a text field no longer moves her or flips the camera.',
    why: 'The keyboard should work without unlocking the mouse and hunting for buttons, the panels should feel like one game, and a text field should only ever type.',
  },
  {
    merge: 'Merge #22',
    pr: 45,
    sha: '5c9f6c9',
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
