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
    merge: 'Merge #50',
    pr: 89,
    sha: 'c86d4c6',
    date: '2026-11-01',
    what: 'Three commits, and a fourth \u2014 this record \u2014 rides in the same merge. The Farmhouse itself is rebuilt as Adam ruled it: the first farmhouse stands TWO STORIES now \u2014 upper walls over the ground floor, a slab floor between, gable ends, its own whole roof reseated at the top with the chimney over its hearth \u2014 and inside, a stair flight and the ransack: the toppled, scattered, opened leavings of a household that fled in a hurry. Its great stone, its porch, and its cellar door are exactly where they always were. The journal\u2019s book is completed: its quest log now nests act, then thread, then quests, each level folding on its own, so the book reads the way the roads actually run. And the attic\u2019s bricks ride as named riders \u2014 slopes, knee walls, collar beams, a dormer, the stair-head door, windowed gable ends \u2014 inert pieces waiting for the zones build that will raise them into rooms.',
    why: 'The exception completes the family: the singular was promised two stories and a ransacked heart on the day the family was approved, and a promise about the first house matters more than any other. The thread folds finish the book\u2019s shape so the quests she carries read as the braided roads they are. The attic bricks land ahead of their build on purpose \u2014 pieces first, rooms second, the same order the farmhouses themselves followed.',
  },
  {
    merge: 'Merge #49',
    pr: 88,
    sha: '2ed8fcc',
    date: '2026-11-01',
    what: 'Six commits, and a seventh \u2014 this record \u2014 rides in the same merge. The farmhouses STAND. Some seventeen a world in the oldfield and meadow country, each assembled from its own rolls: length and depth composed from the dice, walls in one of two window rhythms, a second story on the full-floor houses, gable ends, a chimney seated anywhere along the ridge, a porch where the roll allows \u2014 under a roof of tiled slabs that fits any house because it is built a segment at a time. The fled ones show it inside: a table on its side with a leg splintered short, a shelf face-down with its goods spilled, drawers hanging open, a barrel on its side soaking the boards \u2014 disorder authored piece by piece, never simulated. And the places have learned their names at a distance: a homestead reads simply Homestead as she comes up on it, a farmhouse Farmhouse \u2014 one plain name for the whole family, standing or ransacked alike, nothing about a place given away before its door.',
    why: 'The population law made visible: there was never going to be only one farmhouse in an endless world, so now the country fills the way the design always said it would \u2014 firsts become families. The plain family names carry Adam\u2019s register: The Farmhouse is a place; a farmhouse is a kind of place, and the tag does not spoil which kind of story waits inside.',
  },
  {
    merge: 'Merge #48',
    pr: 87,
    sha: '63a4076',
    date: '2026-11-01',
    what: 'Four commits, and a fifth \u2014 this record \u2014 rides in the same merge. The quests step out of the book and into the day: the journal\u2019s log can now mark the quest she is actually on, and a card in the stack carries that marked quest where she can see it as she walks \u2014 and the altar step of the waking road is wired to the world at last, so raising an altar counts where the road asks for it. The farmhouses wait in the wings, twice over: their seats are rolled in the world data \u2014 some seventeen farmhouses a world, standing or fled-and-ransacked, never burnt \u2014 and their Lego kit is built, nine new pieces (upper walls in two window rhythms, a ground-story twin, gable ends in two widths, a chimney that seats anywhere along the ridge, a cellar bulkhead, stairs, a floor slab), with the variation table filled: a house\u2019s length, depth, windows, and porch are rolls of dice the kit answers. Nothing of them shows in the world yet \u2014 the integration that raises them is the next build \u2014 but every piece is on the table. And the record of the last merge corrects itself, per Adam\u2019s word: the folds slid in ahead of schedule, and the history now says so.',
    why: 'The card closes the dialog audit\u2019s last thread: a quest you cannot see is a quest you forget. The farmhouse core and kit land inert on purpose \u2014 derivation first, bricks second, houses third \u2014 so each step can be checked before the world depends on it. And a history that hides its own untidiness teaches nobody anything; the amendment keeps the record honest about how the work actually flowed.',
  },
  {
    merge: 'Merge #47',
    pr: 86,
    sha: '8dfe012',
    date: '2026-11-01',
    what: 'Eight commits, and a ninth \u2014 this record \u2014 rides in the same merge. The journal has a door now: carry the book and J opens it (buttons on desktop and phone both), with the quest log living inside it, grouped by act under folds that open and close on their own \u2014 the current act starts open, the rest wait. (The folds themselves were built for the next chunk and arrived ahead of schedule; not everyone lands in perfect sync, so they slid into this merge on Adam\u2019s word, and the record says so.) The quests themselves grew bones: every quest carries its thread and its components as data, and the wake-a-charm road moved where Adam put it \u2014 out of survival, into Act II, Witchery \u2014 its road spelled out step by step: find a bone, raise an altar, wake the charm. And the homesteads STAND: the raided-homestead seats that have sat empty in the world data now raise their houses \u2014 standing ones plain-walled under a whole roof, the burnt fragment-carriers charred, stretches of wall gone to the fire, roofs standing charred or fallen in \u2014 some twenty houses a world in the oldfield and meadow country, each with its great stone in the yard. Models\u2019 homestead kit rides as a named rider, the five builders the houses are made of.',
    why: 'The journal door closes the last of the dialog audit\u2019s findings \u2014 the quest log was hiding in Options, and Adam\u2019s ruling put it in the book she carries. The Witchery re-seat is his word too: waking a charm is witch\u2019s work, not survival, and the book now says so. The homesteads are the population law made visible \u2014 the world\u2019s recurring families are done being data and have started being places.',
  },
  {
    merge: 'Merge #46',
    pr: 85,
    sha: '2866532',
    date: '2026-11-01',
    what: 'Four commits, and a fifth \u2014 this record \u2014 rides in the same merge. The phone can build again: in landscape the seed strip no longer paints across the ground where a shelter\u2019s ghost stands, and an armed placement on touch now carries its own Place here bar \u2014 before this, the phone showed the ghost and offered no reachable way to set it down, while the desktop worked all along. The picked flowers that feed no recipe now say what they are \u2014 \u2018Decorative\u2019 \u2014 instead of pretending a use is coming; the Poison Mushroom is pointedly NOT among them, because the cauldron has plans for it. The carriers\u2019 record is corrected to the ruling (Home stands at two singular seats by Adam\u2019s population law \u2014 the families carry the rest as the world populates), and the homestead sequence opens: the shared wall ruler the homestead builders work to is planted in the siting sheet, first step toward homestead houses standing in the country.',
    why: 'Adam found the phone defect himself, on his own world, trying to place a lean-to \u2014 desktop/phone parity is his standing law, and this restores it where it actually broke. The flower tags are honesty in the item text: no-use things should say so, and the one exception was his call, made for the brew it will feed.',
  },
  {
    merge: 'Merge #45',
    pr: 84,
    sha: 'a7a7c37',
    date: '2026-11-01',
    what: 'Seven commits, and an eighth \u2014 this record \u2014 rides in the same merge. Fire serves whole now: a fire honestly lit by friction, with no flint and no kindling in her pack, cooks and chars at no cost and no second charge \u2014 the vessel adopts the fire\u2019s lit state as bookkeeping, never as a second lighting \u2014 and a stick chars at ANY lit fire, including the hearth under a hung cauldron, where facing the pot is facing its fire. Small honesties ride with it: the wattle-and-daub hut, merged into the Woven Cottage long ago, retires its lingering item record (old saves simply let it go), and the first cave is the DEBUT cave in every word the game keeps \u2014 \u2018designated\u2019 retires, because there is nothing special about a first except that it came first. One pair of commits is recorded exactly as it happened: a Home fragment was minted onto the chapel\u2019s gravestone to complete the Home mark\u2019s three seats, and then, on Adam\u2019s word that graves and their marks are reserved for the mark line that starts with human bone, it was unminted again in the next commit \u2014 the carriers net out unchanged, and Home\u2019s third seat waits on his chosen ground rather than a grave.',
    why: 'Adam\u2019s pins run through it: a lit fire is a lit fire and lit fires consume nothing; charring belongs at any fire, not a favored kind; graves are reserved, full stop \u2014 a ruling that outranks a completed tier, and the record says so plainly rather than smoothing the pair away. The terminology sweep is the no-one-of-anything principle applied to language: the debut cave is a first, not a category.',
  },
  {
    merge: 'Merge #44',
    pr: 83,
    sha: 'b3a2bbf',
    date: '2026-11-01',
    what: 'Forty-two commits, and a forty-third \u2014 this record \u2014 rides in the same merge. The cat arrives: one cat, resident at the burnt village\u2019s hearth, living its own life in a small parish of ground. Meet it, befriend it by the road of feeding and acquaintance, and it follows her the way cats do \u2014 settling to watch from cover, scampering bush to bush to catch up. At an altar she may raise a companion as her familiar, let one step down, or raise another in its place, one guarded act with the displacement named aloud; the cat raised familiar glows faintly fungus-green and crosses with her into the caves. And the cat hunts: travelling together it stalks real creatures of the country and brings back the carcass \u2014 to home storage by day, left as a present on the floor of her house when she sleeps at home, or at the hearth before any bond at all. The Grove gets its guide: at dawn and at dusk a bird stages in a tree ahead of her and calls, and follows her pace perch to perch to the Grove\u2019s edge, retiring forever once the Grove is found. The caves answer with their own sign: at dusk the mouths pour their bats in a wheeling column, and at dawn a thinner flight comes home. Fragments become a pursuit: stones and circles in the world carry pieces of marks \u2014 Home, Circle, Travel \u2014 and with a journal in hand she can transcribe what she faces, copy by copy, toward a mark\u2019s first tier, her journal keeping the tally and the best-kept reading. The far country gains homesteads on the seeded pattern: some stand weathered and empty, and the ones carrying fragments are burnt and raided \u2014 the Reapers\u2019 work, readable at a glance (derivation only in this batch; their walls are the next build). Around all that, the house grows up: the home menu reads both pans of the scale and offers the upgrade to the next rung at its price; the pack, the home storage, and every pile now share one list with one sort, differing only in their verbs; the stump keeps a single door for its crafts; every place she faces speaks its name in a tag; a Remove is never offered for what is the ground itself; and the cat and the guide, staged-then-cleared by a signal ordering no probe had caught, exist in the real game at last.',
    why: 'Adam\u2019s shape ruled the batch: the familiar is earned past friendship and unmade only at the altar that made it; the cat answers to no commands because cats don\u2019t; the provisioning cat is a roaming hunter whose catches are real animals, never minted from nothing; and the discovery clues \u2014 a plume for the village, a bird for the Grove, bats for the caves \u2014 let the far places announce themselves without a single marker on a map. The homesteads carry his darkest ruling yet: what the Reapers wanted was the fragments, and a burnt house is how the country says so. The batch lands as one because its halves hold each other up \u2014 the rite needs the cat, the transcribing needs the carriers, the guide needs the discovery fact \u2014 and because the staging fix had to land with the actors it resurrects.',
  },
  {
    merge: 'Merge #43',
    pr: 82,
    sha: 'eed50f3',
    date: '2026-10-31',
    what: 'Twenty-three commits, and the twenty-third is this record itself. The animals of the world become individuals: every creature carries a stable name of its own now, and she can feed what one eats, earn its trust feeding by feeding, and speak its kind\u2019s true name to make a friend of it \u2014 a friend who follows at her heel, stays resident where she leaves it, comes when she calls, and can be released by a guarded word, walking away for good. A few are feral and will never soften; their answer to an offered hand is a snap that stops short of her skin, and then gone. Her own hand learns the creek: at a faced fish in the shallows she can snatch, and take it or spook the whole reach empty. The panel keeps her friends\u2019 names and stances; the faced verbs offer, speak, and snatch by one pick. Four kinds that had no bones have them now \u2014 muskrat, opossum, vole, and squirrel join the Waking set, in the registry, in the world\u2019s scatter, and in the look portions, so their names can be woken like the rest. What she places goes where she aims: torch, campfire, and tent all land at the crosshair now, and the pack and the recipe book answer a typed filter in their headers. Squirrels know their trees: startled, one runs for the nearest trunk and climbs out of reach, sits the canopy while she lingers, and comes down when the coast is clear \u2014 and no offering reaches it overhead. Two pieces of groundwork ride named as such: the cat, modelled and posed for the hearth it will haunt in the next build, and human remains, a scenery kind for the village\u2019s story \u2014 both built, neither yet met in the world.',
    why: 'Adam asked for friendship before familiars, and this is the friendship build whole: feeding, trust, following, staying, release \u2014 earned animal by animal, with the feral fraction standing as the world\u2019s refusal to be entirely tamed. The four boneless kinds closed a gap UI found (no bone, no name, no bond), the crosshair made placing honest to her aim, and the squirrel\u2019s climb is Adam\u2019s own line \u2014 let\u2019s make sure squirrels know how to climb trees \u2014 taken literally. The batch lands as one because its pieces hold each other up: the verbs need the ids, the gate needs the climb, the bones need their looks.',
  },
  {
    merge: 'Merge #42',
    pr: 81,
    sha: 'b7808c5',
    date: '2026-10-31',
    what: 'Twelve commits, and the twelfth is this record itself. The recipe book stops hiding what she cannot yet make: every row stands, and a row whose station is absent speaks its lack in plain words \u2014 Needs a loom, Needs a kiln \u2014 with a Craftable here filter in the header for when she wants only what the ground around her allows. Facing a placed torch, E now picks it up (the window stays as the second door), and the torch\u2019s whole placing is one shared core \u2014 panel, right-click, and chip tap all set it down the same way, the old torch window retired. The grimoire is listed: one book of workings, and a second craft is refused at the ownership gate; and the writing desk wants oak now, two downed-oak lengths beside its snap-wood. A new old place stands in the country: the Water Tower, the thirteenth site \u2014 four legs and a tank high enough to walk beneath, a ladder up its approach side, a pump shed beside some of them; in some worlds it has fallen, tank and legs down in the grass where they dropped. Her spoken lines gather in one feed at the bottom of the screen and follow each other in order, so a refusal at her feet is never lost off the edge of the world again; the pill she reads and the E she presses now read one and the same pick, by construction; the loom gains its WEAVE pill; and a faced hive\u2019s reach runs a little longer, so the smoking torch at its base stays in frame while she works it. One rider is named as such: the roof fix crossed in during the landing window and rides on Adam\u2019s word \u2014 five roofs in the world (village, farmhouse, chapel, store, and the drowned mill) had their pitches inverted, valleys where their ridges belonged and chimneys floating over the dip; they are flipped to the barn\u2019s pairing, eaves at the wall tops and ridges high.',
    why: 'Adam approved this scope piece by piece through the morning, and two of its pieces are his playtest made law: the loom pill, because he faced his own loom and found no verb on it, and the roof fix, because his photograph of the building with wings caught what no probe had \u2014 the measured inversion of a whole family of roofs. The Water Tower is the sites run continuing, thirteenth of the settled places. The batch lands as one so the book, the tower, the feed, and the mended roofs all arrive in the same walkable world; and the rider rides openly, on his amended word, rather than slipping in unnamed.',
  },
  {
    merge: 'Merge #41',
    pr: 80,
    sha: '24445e3',
    date: '2026-10-31',
    what: 'Nineteen commits, most of them under her hands. The inventory sorts now \u2014 recent-first by default, grouped or alphabetical when she asks \u2014 standing on the gathering-order data the last merge laid down. The stump\u2019s scattered doors fold into one crafting dialog: Craft, Upgrade, and Ritual in a single seat, and the altar keeps its honesty \u2014 no ritual staging until the stones, the glyph, and the candle have truly made it one. At a lit fire she can char a stick, the charred stick the glyph-drawing needs, renamed plainly everywhere it is spoken of. Panels mind their manners: walk away from a fire, a pile, or her tent and the window closes behind her; a pile reads as one clean stack with its counts on a single line; the crafting list scrolls inside its own frame under a pinned header; the site window sits a smidge lower, out of the centre of her eye; and looking up no longer makes a chosen window vanish. The crafting shelf speaks in one order \u2014 each thing\u2019s own kind, not a hand-kept map \u2014 the stations describe themselves truly (the apron is the loom\u2019s to gate, like the rest of its cloth), and the dome keeps its phases by the hour. In the marsh, the grass is grass again: nine green blades where a grey mound stood.',
    why: 'Adam\u2019s word: soon as the fold-in finished, merge. Nearly everything here is his playtest made law \u2014 the sorting he asked for, the charred stick his altar work needed, the grade gate from his \u201Cno ritual use until the altar items are placed,\u201D the walk-away close and pile spacing from his screenshots, grass that is green because he said a grass tuft shouldn\u2019t be gray. Nineteen commits land as one so the world she tests next is the whole stretch of work at once.',
  },
  {
    merge: 'Merge #40',
    pr: 79,
    sha: '9d23d28',
    date: '2026-10-31',
    what: 'A full batch, most of it in her hands and panels. The meadow flower is pickable: the pink bloom of the open country has a name and comes away in her hand, where before it was scenery that yielded nothing. The stump gains its hub \u2014 its gathered functions in one place \u2014 and chains now execute: where a craft or working has prerequisites, they run as a chain, and the crafting panel carries the button that sets one going. Her pack now remembers the order things were gathered in, the groundwork the sorting will stand on. Two riders landed late and are named as such: underneath, every flat ground disc in the world \u2014 pond, silt bed, ash patch, cave pool, the grain silo\u2019s cracked pad \u2014 sat exactly in the ground\u2019s plane and shimmered where they met; the whole class now sits a breath above the earth, and the sorting data rode in on the same morning.',
    why: 'Adam\u2019s advance word: merge these when they are done. Three of the pieces are his directly \u2014 the flower ruling from his own photographs (\u201Cshould have a name and be harvestable\u201D), the z-fighting he caught at the silo\u2019s pad on the library PC, and the words-and-chains work he has been steering all week. The batch lands together so the panel, the chain, and the ground she stands on all arrive in one walkable state.',
  },
  {
    merge: 'Merge #39',
    pr: 78,
    sha: '6b0f4df',
    date: '2026-10-31',
    what: 'Words that already exist in the world can now be taken up as her own. Some places stand armed with words \u2014 written, carved, left standing from before \u2014 and at such a place her panel offers what stands there: she adopts the words deliberately, and from then they are held, hers to use. Nothing is taken up by accident or by walking past: the adopting is an act, done in the open at an armed site, and what she holds is mirrored where she can see it, so she always knows which words are in her keeping before she relies on one.',
    why: 'Adam\u2019s word: this one is significant enough to merge on its own. The world is full of words the old world left standing, and a found word honestly taken up is as much hers as a learned one. The batch carries the whole feature \u2014 the adopting machinery and the mirror of her holding, the panel flow and the arming of sites \u2014 so the act is complete the first time she tries it.',
  },
  {
    merge: 'Merge #38',
    pr: 77,
    sha: 'ff9cc28',
    date: '2026-10-30',
    what: 'The compass came home. For one build the labels were turned around \u2014 north written positive, the sun\u2019s arc flipped to match \u2014 and the written compass fought the sky she navigates by. It is all set right: north is raw \u2212z again, left of east; her position readout prints (x, \u2212z), so it agrees with her zone, whose second number was right all along; and the sun and moon culminate in the south, where a Great Lakes sun belongs. The sky is the world\u2019s compass; the labels serve it. A stale note in the sky\u2019s header \u2014 it claimed the moon\u2019s day count resets on load \u2014 is corrected in the same batch: the save carries the count, and the phase continues where it left off.',
    why: 'Adam navigates by the sky: sunrise in the east, north to its left. When a rename made the written compass contradict the visible one, his word was plain \u2014 put it back. This merge restores the chip, the zone grid, and the sky to the frame the world was built in, in one batch, so the game is never left half-turned the other way.',
  },
  {
    merge: 'Merge #37',
    pr: 75,
    sha: '999c5a5',
    date: '2026-10-30',
    what: 'The compass turned around. North is positive now \u2014 plain Cartesian: east +x, north +z \u2014 and her two readouts agree: her position prints raw, and her zone carries the same signs on both axes, so a place south-east of home reads south-east in both. The sky turned with it: the sun and moon now cross the south at the top of their arcs, the way a Great Lakes sky does \u2014 the sun had been culminating in what the new compass calls the north. Nothing in the world moved; only what its directions are called, settled everywhere at once.',
    why: 'Adam\u2019s call: the old north was a screen habit that rode in on an early draft \u2014 negative z was a rendering convention, never a direction. He reversed the pin, and this batch carries the reversal through the chip, the zone grid, and the sky in one merge, so the game never sits half-turned.',
  },
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
