/**
 * Silent Earth — recipes data module (player-systems lane).
 *
 * Source of truth: ~/workspace/silent-earth/docs/recipes-2026-10-25.md
 * (2026-10-25). Read that doc before changing anything here.
 *
 * STATUS RULE — do not blur it:
 * - `status: 'prototype'` recipes are kept VERBATIM from the prototype
 *   (src/data/world_data.json, structures section). Their ingredients,
 *   quantities and workstation gating are the prototype's own, including
 *   the prototype's item names as renamed in the design doc
 *   (RIVER_SLUDGE -> River Silt, SPORES -> Luminous Spores).
 * - `status: 'draft'` recipes are DRAFT for Adam's pin pass. Every draft
 *   recipe is marked draft here, and no draft number is ever presented
 *   as settled. Quantities, costs and open questions stay exactly as
 *   the doc states them.
 *
 * DELIBERATELY LEFT OUT (Adam's mechanics-first rule, 2026-10-25):
 * - Salve / medicine / restorative recipes — mechanics not designed yet.
 * - Food prep recipes — food cooks on open fire (stick or fire-buried),
 *   not via recipes. Food items are harvests / trap catches, not crafts.
 * - Anything iron. NO IRON PATH (Adam, 2026-10-30: witches don't
 *   touch iron — the whole iron path is closed, and the cauldron
 *   is clay). There is no iron tool and no bloomery; the tool
 *   ladder is stone to its top (the Trundle-Tool).
 *
 * No UI and no game wiring in this file. The crafting engine in
 * ./crafting.ts consumes this data; the inventory system is a later
 * piece and is NOT built here.
 */

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
//
// Item ids are kebab-case slugs of the design doc's display names.
// Display names below are the doc's names, not the prototype's keys.

export type ItemId = string;

export const ITEMS = {
  // Harvest / raw ingredients (prototype names in the design doc).
  snapWood: 'snap-wood',
  tenderVines: 'tender-vines',
  grass: 'grass',
  peatMoss: 'peat-moss',
  downedOak: 'downed-oak',
  riverSilt: 'river-silt',
  riverStone: 'river-stone',
  luminousSpores: 'luminous-spores',
  dryKindling: 'dry-kindling',
  charcoalStick: 'charcoal-stick',
  candle: 'candle',
  beeswax: 'beeswax',
  tallow: 'tallow',
  cauldron: 'cauldron',
  // New items (2026-10-25 design work).
  dirt: 'dirt',
  clay: 'clay',
  flint: 'flint',
  oldStump: 'old-stump',
  // Refined good.
  twinedCordage: 'twined-cordage',
  // Tools (one tool, evolving — never a second tool).
  gardenTrowel: 'garden-trowel',
  sharpTrowel: 'sharp-trowel',
  spade: 'spade',
  axeTrowel: 'axe-trowel',
  spadeAxe: 'spade-axe',
  trundleTool: 'trundle-tool',
  // Homes / structures.
  primitiveLeanTo: 'primitive-lean-to',
  thatchHut: 'thatch-hut',
  wattleAndDaubHut: 'wattle-and-daub-hut',
  wovenCottage: 'woven-cottage',
  smallWoodenHut: 'small-wooden-hut',
  mossCradle: 'moss-cradle',
  // Fire ladder.
  campfire: 'campfire',
  hearth: 'hearth',
  kiln: 'kiln',
  // Stations.
  stumpyWorkstation: 'stumpy-workstation',
  craftedWorkstation: 'crafted-workstation',
  pottersWheel: 'potters-wheel',
  loom: 'loom',
  // Receptacles.
  clayPot: 'clay-pot',
  clayJar: 'clay-jar',
  waterJar: 'water-jar',
  clayBrick: 'clay-brick',
  // Carrying containers.
  smallBasket: 'small-basket',
  largeBasket: 'large-basket',
  apron: 'apron',
  // Garments (MVP round, 2026-10-26 — woven at the loom; see
  // clothes.ts for slots, worn bonuses, and the weather shape).
  hoodedCloak: 'hooded-cloak',
  shawl: 'shawl',
  pointyHat: 'pointy-hat',
  mossyMittens: 'mossy-mittens',
  bogBoots: 'bog-boots',
  // Umbrella (2026-10-26 queued work — carried rain protection,
  // see umbrella.ts for the mechanic and coordination shape).
  umbrella: 'umbrella',
  // Torch (2026-10-27 — carried light, brighter than the candle;
  // see torch.ts for the batch lighting action).
  torch: 'torch',
  litTorch: 'lit-torch',
  // Paper chain (2026-10-27 — grimoire materials; see the
  // paper-chain recipes below for the chain).
  plantPulp: 'plant-pulp',
  pressedSheets: 'pressed-sheets',
  paper: 'paper',
  grimoire: 'grimoire',
  journal: 'journal',
  // Ritual altar (2026-10-27 — made ritual site, placeable
  // only; see altar.ts for the place grant + scope guard).
  altar: 'altar',
  writingDesk: 'writing-desk',
  // Primal bones (2026-10-27 first charm + 2026-10-28
  // individual bones build; see charms.ts). Kind rule,
  // documented: 'primal-bone-<shape-slug>'. Grouped by
  // ritual sky (rituals.ts order). Shrew is the outright
  // first charm (no Waking); the rest are Waking kinds.
  primalBoneShrewSkull: 'primal-bone-shrew-skull',
  // DAY.
  primalBonePigeonWingBone: 'primal-bone-pigeon-wing-bone',
  primalBoneSnakeVertebra: 'primal-bone-snake-vertebra',
  primalBoneTurtleShellFragment: 'primal-bone-turtle-shell-fragment',
  primalBoneCrowBeak: 'primal-bone-crow-beak',
  primalBoneSquirrelTailBone: 'primal-bone-squirrel-tail-bone',
  // NIGHT.
  primalBoneOwlTalon: 'primal-bone-owl-talon',
  primalBoneBatWingBone: 'primal-bone-bat-wing-bone',
  primalBoneMouseSpine: 'primal-bone-mouse-spine',
  primalBoneRaccoonTooth: 'primal-bone-raccoon-tooth',
  primalBoneGroundhogTooth: 'primal-bone-groundhog-tooth',
  primalBoneOpossumCrest: 'primal-bone-opossum-crest',
  // TWILIGHT.
  primalBoneFoxFemur: 'primal-bone-fox-femur',
  primalBoneDeerAntlerTip: 'primal-bone-deer-antler-tip',
  primalBoneMuskratTail: 'primal-bone-muskrat-tail',
  // MOON PHASE.
  primalBoneWolfTooth: 'primal-bone-wolf-tooth',
  // SKY-INDEPENDENT.
  primalBoneFrogPelvis: 'primal-bone-frog-pelvis',
  primalBoneMolePaw: 'primal-bone-mole-paw',
  primalBoneBearClaw: 'primal-bone-bear-claw',
  primalBoneRabbitJaw: 'primal-bone-rabbit-jaw',
  primalBoneBeaverIncisor: 'primal-bone-beaver-incisor',
  primalBoneVoleSkull: 'primal-bone-vole-skull',
  // Traps (brainstorm only — nothing picked; see their notes).
  snare: 'snare',
  fishWeirTrap: 'fish-weir-trap',
  potTrap: 'pot-trap',
  pitfall: 'pitfall',
  deadfall: 'deadfall',
  // Trap catches (draft carcass ids, trap-catch.ts —
  // Adam pins names/weights/uses; weight rides the
  // 1 lb unknown-id default until pin pass).
  rabbitCarcass: 'rabbit-carcass',
  squirrelCarcass: 'squirrel-carcass',
  muskratCarcass: 'muskrat-carcass',
  fishCarcass: 'fish-carcass',
  eelCarcass: 'eel-carcass',
  crayfishCarcass: 'crayfish-carcass',
  frogCarcass: 'frog-carcass',
  opossumCarcass: 'opossum-carcass',
  groundhogCarcass: 'groundhog-carcass',
  raccoonCarcass: 'raccoon-carcass',
  mouseCarcass: 'mouse-carcass',
  voleCarcass: 'vole-carcass',
  // Beehive honey (2026-10-28 — Systems follow-up to Background's
  // wildHive landing; see honey.ts for the harvest rule).
  honey: 'honey',
  // Camping (2026-10-28 — sleeping bag + tent; see camping.ts).
  sleepingBag: 'sleeping-bag',
  tent: 'tent',
  // Flowers (2026-10-28 — brainstorm doc, 13 new kinds + existing
  // pink; the 12 sibling kinds here, plus the Meadow Flower
  // since Adam's 2026-10-31 flip — DRAFT for Adam's pin pass).
  // Pink lady slipper gets NO item in v1: the doc's scenery-only
  // option "needs nothing," and the rare-harvest option is a
  // potion-branch decision for the pin pass (lane-decided
  // exclusion, flippable then). The existing pink 'flower' —
  // the Meadow Flower — was scenery-only under the same
  // decision until Adam flipped it (2026-10-31): it has an
  // item now (meadow-flower), harvested like its siblings.
  // No recipes: flowers are harvested, not crafted. Yields
  // (1 per harvest, proposed) ride Background's harvest
  // table, not this registry.
  whiteYarrow: 'white-yarrow',
  goldConeflower: 'gold-coneflower',
  purpleClover: 'purple-clover',
  yellowDandelion: 'yellow-dandelion',
  pinkMilkweed: 'pink-milkweed',
  redPoppy: 'red-poppy',
  tallSunflower: 'tall-sunflower',
  blueAster: 'blue-aster',
  whiteTrillium: 'white-trillium',
  woodViolet: 'wood-violet',
  creekIris: 'creek-iris',
  whiteWaterLily: 'white-water-lily',
  // The Meadow Flower (Adam's flip, 2026-10-31): the
  // pre-existing scenery 'flower', now a picked item like
  // its siblings. No use yet — it joins the no-use census
  // (decorative tag pending Adam's read of that list).
  meadowFlower: 'meadow-flower',
} as const;

// ---------------------------------------------------------------------------
// Recipe shape
// ---------------------------------------------------------------------------

/**
 * Station tags follow the doc's workstation / fire split:
 * - 'workstation': no-fire work (making the tool, processing raw
 *   ingredients, upgrading the tool, cordage, ...).
 * - 'fire': fire-required work.
 * - 'hand': made anywhere.
 * - 'kiln': fired in the kiln (receptacles). A kiln is a fire-ladder
 *   structure, not a workstation; it gets its own tag rather than
 *   being folded into 'fire', because the kiln must exist first.
 *
 * A recipe with no `station` is one the doc / prototype gives no
 * station for. That is NOT the same as 'hand' — it means "unstated,
 * do not assume". The engine treats an unstated station as passable
 * from any station context; see crafting.ts.
 */
export type CraftingStation =
  | 'workstation'
  | 'fire'
  | 'cauldron'
  | 'hand'
  | 'kiln'
  | 'loom';

/** A field-site requirement (see Recipe.requiresSite). */
export type SiteRequirement = 'in-water' | 'dry-land';

/**
 * Where she is standing, shell-supplied (the water
 * adapter's facts; Systems never computes them). The
 * crafting gates read this input only — a null input
 * leaves every site gate off (see Recipe.requiresSite).
 */
export interface SiteFacts {
  /** True when she stands in water (a creek's flow). */
  inWater: boolean;
  /**
   * True when the crosshair's ground point — where a
   * placement would land (the placement ruling, Adam
   * 2026-11-01: all placement goes to the aimed point
   * within reach) — sits in water. Absent when the
   * shell supplies no aim; the feet fact then governs.
   */
  aimedInWater?: boolean;
}

/**
 * The one reading rule for site facts (the placement
 * ruling): a trap meets the ground at the AIMED point
 * when an aim is supplied, else at her feet. Every
 * site evaluation — the craft gates and the place
 * grant alike — reads this, never the raw fields.
 */
export function effectiveInWater(site: SiteFacts): boolean {
  return site.aimedInWater ?? site.inWater;
}

export interface Ingredient {
  item: ItemId;
  quantity: number;
}

export interface RecipeOutput {
  item: ItemId;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  /** 'prototype' = kept verbatim. 'draft' = DRAFT for Adam's pin pass. */
  status: 'prototype' | 'draft';
  output: RecipeOutput;
  /** Consumed on craft. */
  ingredients: Ingredient[];
  /** Required station, when the doc / prototype states one. */
  station?: CraftingStation;
  /**
   * Upgrade recipes transform this item into the output: the engine
   * consumes 1 of `upgradeFrom` and produces the output. Tool upgrades
   * are priced as upgrade COSTS (what it takes to evolve the tool you
   * already have), not full rebuilds. An array means "either
   * predecessor" (the Spade-Axe convergence): the engine accepts any
   * one of them and consumes the one the player has.
   */
  upgradeFrom?: ItemId | ItemId[];
  /**
   * Required but NOT consumed on craft (e.g. the whetstone: present,
   * kept). Checked by canCraft, untouched by craft.
   */
  requires?: Ingredient[];
  /**
   * Minimum OWNED tool stage (owned-tool.ts stages: -1 hands, 0
   * trowel, 1 spade tier, 2 spade-axe, 3 trundle-tool) the crafter
   * must hold. Present, not consumed — and NEVER a literal item:
   * a literal 'spade' requirement would lock the recipe out the
   * moment the tool upgrades past spade (upgrades consume the
   * predecessor), so the gate reads the owned stage, not an item.
   * Checked by canCraft (and executeCraft) alongside `requires`.
   * First use: pitfall, stage 1 (Adam, 2026-10-26).
   */
  requiresToolStage?: number;
  /**
   * Creek-water requirement (paper chain, Adam 2026-10-27):
   * the recipe must be crafted near a creek. PROXIMITY, not
   * carried water — water-carrying is NOT invented — and
   * NOT a station: a creek is a place, not a structure.
   * Checked by canCraft + executeCraft ONLY when the shell
   * supplies creek proximity (nearCreek input); a null /
   * omitted input leaves the gate OFF (transitional, like
   * hunger omitted — until Background's water adapter
   * lands, the shell cannot compute creek proximity, so
   * the recipe crafts by hand anywhere meanwhile).
   * First use: plant-pulp.
   */
  requiresCreek?: boolean;
  /**
   * Field-site requirement (fork B, Adam 2026-11-01:
   * traps are field-built — 'those are field-based
   * items'): where she must be STANDING for the craft,
   * because for a placesTrap recipe the craft IS the
   * placement. 'in-water' = standing in the water (the
   * weir, the creek-sunk pot); 'dry-land' = NOT standing
   * in water (stakes, a dug pit, a weighted rig).
   * Checked ONLY when the shell supplies the site facts
   * (SiteFacts input); a null / omitted input leaves the
   * gate OFF (transitional, the creek rule's exact shape).
   * WHERE it is checked follows the trap table (Adam,
   * 2026-11-01): at CRAFT for site-built recipes
   * (placesTrap — craft is placement), by canCraft +
   * executeCraft; at PLACEMENT for the carryable three,
   * by the place grant (trap-place.ts). This field is
   * the one source either way.
   */
  requiresSite?: SiteRequirement;
  /**
   * Craft-places (Adam, 2026-10-26; DEV correction: Systems
   * does NOT emit): crafting this recipe places right there
   * instead of granting an inventory item — executeCraft
   * consumes the ingredients and reports placedTrap {type},
   * and the SHELL places via trapState.placeTrap(type,
   * player.x, player.z) on that result (single-caller rule:
   * that call is the one and only placer). The shell's "Place
   * trap here?" confirm gates BEFORE execution (No = abort,
   * nothing consumed). First use: THE SITE-BUILT TWO
   * (deadfall + pitfall) — the trap table (Adam, 2026-11-01)
   * made the other three CARRYABLE: their crafts grant the
   * item, and their requiresSite is read at PLACEMENT by
   * the place grant (trap-place.ts), not at craft. Trap items
   * already sitting in an inventory from earlier saves stay
   * items for now (flagged edge, not solved here) — only
   * fresh crafts place.
   */
  placesTrap?: boolean;
  /**
   * Spoil (Adam, 2026-11-01 — the pitfall lifecycle):
   * what the act of crafting THROWS UP, granted into
   * the pack on a successful craft (the report path's
   * one grant; see crafting-execution.ts). Digging a
   * pit yields its dirt — the same dirt its filling-in
   * later consumes (pitfall.ts reads THIS quantity as
   * the fill cost, one source). What does not fit rides
   * the result as a remainder for the shell to pile at
   * her feet — the pit's edge; earth is never voided.
   * Quantity DRAFT for the pin pass. First use: pitfall.
   */
  spoil?: { item: ItemId; quantity: number };
  /**
   * Stump-upgrade (Systems, 2026-10-28 — the Stumpy Workstation
   * fix; trap-report precedent). Crafting this recipe transforms
   * the FACED stump into a workbench instead of granting an
   * inventory item — executeCraft consumes the ingredients and
   * reports upgradedStump {type}, and the SHELL transforms via
   * Background's anchor primitive on that result (single-caller
   * rule, trap precedent). The anchor is NOT consumed
   * (transformation, not harvest); station presence unchanged;
   * trundle-move preserved; the splitting bonus keys on the
   * upgraded state when splitting lands. The recipe's station
   * gate ('workstation') IS the presence condition —
   * 'workstation' presence comes solely from stumps today — so
   * the entry crafts only AT a stump. First use:
   * stumpy-workstation. Additions-aware (Adam, 2026-10-28):
   * the workstation is ONE addition on the stump anchor, not an
   * exclusive flag — other additions (e.g. altar) coexist;
   * Systems' report path is workstation-specific, the altar
   * rides the ritual system.
   */
  upgradesStump?: boolean;
  /**
   * Carrying-capacity bonus, containers only. The BONUS numbers are
   * Adam's pinned numbers; the COSTS beside them are draft. Where the
   * doc leaves a bonus open, this field is left off and the open
   * question is in `notes` instead of being guessed.
   */
  capacityBonus?: number;
  /** Doc provenance, open questions, and anything not yet pinned. */
  notes?: string;
}

const i = (item: ItemId, quantity: number): Ingredient => ({ item, quantity });

// ---------------------------------------------------------------------------
// Prototype recipes — VERBATIM (do not "improve" these)
// ---------------------------------------------------------------------------

const PROTOTYPE_RECIPES: Recipe[] = [
  {
    id: 'garden-trowel',
    name: 'Garden Trowel',
    status: 'prototype',
    output: { item: ITEMS.gardenTrowel, quantity: 1 },
    ingredients: [
      i(ITEMS.snapWood, 4),
      i(ITEMS.twinedCordage, 2),
      i(ITEMS.riverStone, 2),
    ],
    station: 'workstation', // prototype: requiresWorkstation = true
    notes:
      'Prototype verbatim. She creates it; it upgrades as she goes. ' +
      'First tool, made at a workstation.',
  },
  {
    id: 'primitive-lean-to',
    name: 'Primitive Lean-to',
    status: 'prototype',
    output: { item: ITEMS.primitiveLeanTo, quantity: 1 },
    ingredients: [
      i(ITEMS.snapWood, 6),
      i(ITEMS.tenderVines, 3),
      i(ITEMS.peatMoss, 2),
    ],
    // Prototype lists no workstation requirement; station left unstated.
    notes: 'Prototype verbatim. Prototype lists no workstation requirement.',
  },
  {
    id: 'moss-cradle',
    name: 'Moss Cradle',
    status: 'prototype',
    output: { item: ITEMS.mossCradle, quantity: 1 },
    ingredients: [
      i(ITEMS.luminousSpores, 3),
      i(ITEMS.riverSilt, 4),
      i(ITEMS.peatMoss, 6),
    ],
    // Prototype lists no workstation requirement; station left unstated.
    notes:
      'Prototype verbatim (prototype key SPORES = Luminous Spores). ' +
      'PARKED until crops exist: a garden plot with no crops. The recipe ' +
      'is kept, not built on, until then.',
  },
];

// ---------------------------------------------------------------------------
// Draft recipes — DRAFT for Adam's pin pass (nothing here is settled)
// ---------------------------------------------------------------------------

const DRAFT_RECIPES: Recipe[] = [
  // --- The base refined good: everything else prices through cordage.
  {
    id: 'twined-cordage',
    name: 'Twined Cordage',
    status: 'draft',
    output: { item: ITEMS.twinedCordage, quantity: 1 },
    ingredients: [i(ITEMS.tenderVines, 2)],
    station: 'hand',
    notes:
      'DRAFT. Tender-Vines 2 -> 1 cordage, twisted by hand anywhere — ' +
      'no stump or workstation needed (Adam\'s ruling, 2026-10-26: ' +
      'cordage is hand-crafted). Explicit station "hand" (not ' +
      'unstated) so the UI shows "by hand" plainly; the first ' +
      'recipe to use "hand". She can twist cordage before ' +
      'finding a stump; the trowel itself still needs one.',
  },

  // --- Kindling: snap wood split by hand (Adam's ruling, 2026-10-26).
  {
    id: 'dry-kindling',
    name: 'Dry Kindling',
    status: 'draft',
    output: { item: ITEMS.dryKindling, quantity: 2 },
    ingredients: [i(ITEMS.snapWood, 1)],
    station: 'hand',
    notes:
      'DRAFT. Snap-Wood 1 -> 2 kindling, split by hand anywhere — ' +
      'no stump or workstation needed (Adam\'s ruling, 2026-10-26: ' +
      'kindling is made from snap wood, 2 per snap wood, by hand — ' +
      'his daughter does this by hand). Explicit station "hand" ' +
      '(not unstated) so the UI shows "by hand" plainly. This is ' +
      'the friction-lighting fuel: slow lighting consumes 1 ' +
      'dry-kindling (fire.ts), not raw snap-wood.',
  },
  {
    id: 'charcoal-stick',
    name: 'Charred Stick',
    status: 'draft',
    output: { item: ITEMS.charcoalStick, quantity: 1 },
    ingredients: [i(ITEMS.snapWood, 1)],
    station: 'fire',
    notes:
      'DRAFT. Adam\'s shape (2026-10-30): "a simple easy to ' +
      'fashion bit of charcoal — a stick burnt on the end." ' +
      'One snap wood, its end charred at a lit fire: station ' +
      '"fire" (the CraftingStation literal — any lit fire; ' +
      'the shell\'s fire presence must mean LIT, wiring is ' +
      'Background/App\'s step, so this recipe sits dormant ' +
      'in-game until that lands). The glyph-drawer for the ' +
      'Stumpy Altar working (stone + glyph + candle): the ' +
      'stick draws the glyph; consumption per glyph rides ' +
      'the transformation claim, not this recipe. ' +
      'Quantities draft.',
  },
  {
    id: 'render-tallow',
    name: 'Render Tallow',
    status: 'draft',
    output: { item: ITEMS.tallow, quantity: 1 },
    ingredients: [],
    upgradeFrom: [
      ITEMS.rabbitCarcass,
      ITEMS.squirrelCarcass,
      ITEMS.muskratCarcass,
      ITEMS.fishCarcass,
      ITEMS.eelCarcass,
      ITEMS.opossumCarcass,
      ITEMS.groundhogCarcass,
      ITEMS.raccoonCarcass,
    ],
    station: 'cauldron',
    notes:
      'DRAFT. The carcasses\' first consuming recipe: a ' +
      'trap carcass, rendered in the cauldron, yields ' +
      'tallow x1. ONE recipe for EIGHT kinds via the ' +
      'either/or predecessor (upgradeFrom array — the ' +
      'Spade-Axe convergence path): the carcass is the ' +
      'input, consumed whole. FROG and CRAYFISH are OUT ' +
      '(Adam, 2026-10-30: no tallow worth the name in ' +
      'either, and a crayfish doesn\'t come from a rabbit ' +
      'trap); fish and eel stay in unless the pin pass ' +
      'narrows further. A fatty-kinds premium (raccoon / ' +
      'opossum yielding more) is an UNUSED dial — the ' +
      'x3 melt is the longer road\'s reward, shared by ' +
      'both roads. Station ' +
      '"cauldron" (Adam\'s ruling, 2026-10-30): the ' +
      'context is the FACED cauldron, placed on its ' +
      'hearth, with the hearth lit (Background + UI ' +
      'supply the feed; dormant in-game until those ' +
      'land). Yield stays x1 so the ' +
      'tallow road does not compound with the candle ' +
      'x3. Quantities draft.',
  },
  {
    id: 'candle-from-beeswax',
    name: 'Candle (Beeswax)',
    status: 'draft',
    output: { item: ITEMS.candle, quantity: 3 },
    ingredients: [i(ITEMS.beeswax, 1), i(ITEMS.twinedCordage, 1)],
    station: 'cauldron',
    notes:
      'DRAFT. One candle item, two roads (Adam, 2026-10-30: ' +
      '"We could do either, both really"). Beeswax x1 + ' +
      'twined cordage x1 for the wick, melted in the ' +
      'cauldron and dipped — one melt makes THREE candles ' +
      '(Adam: the process is the involved part, so the ' +
      'melt pays out; render-tallow stays x1 so this ' +
      'road does not compound). Station "cauldron" ' +
      '(Adam\'s ruling, 2026-10-30). Beeswax source: ' +
      'hives yield it alongside honey (Background\'s ' +
      'rider, landed). Quantities draft.',
  },
  {
    id: 'candle-from-tallow',
    name: 'Candle (Tallow)',
    status: 'draft',
    output: { item: ITEMS.candle, quantity: 3 },
    ingredients: [i(ITEMS.tallow, 1), i(ITEMS.twinedCordage, 1)],
    station: 'cauldron',
    notes:
      'DRAFT. The tallow road to the same candle item: ' +
      'tallow x1 + twined cordage x1 for the wick, melted ' +
      'in the cauldron and dipped — one melt makes THREE ' +
      'candles, same as the beeswax road (one carcass -> ' +
      'one tallow -> three candles; the yield lives in ' +
      'the melt, not the render). Station "cauldron" ' +
      '(Adam\'s ruling, 2026-10-30). Quantities draft.',
  },

  // --- Torch: stick + binding + tinder, made by hand (Adam, 2026-10-27).
  {
    id: 'torch',
    name: 'Torch',
    status: 'draft',
    output: { item: ITEMS.torch, quantity: 1 },
    ingredients: [
      i(ITEMS.snapWood, 1),
      i(ITEMS.twinedCordage, 1),
      i(ITEMS.dryKindling, 1),
    ],
    station: 'hand',
    notes:
      'DRAFT. Snap-Wood 1 + Twined Cordage 1 + Dry Kindling 1 -> ' +
      '1 torch, made by hand anywhere — no station needed ' +
      "(Adam's doubt, 2026-10-27: she needs no station for " +
      'these). Lighting is a SEPARATE batch action (torch.ts ' +
      'lightTorches): one press lights EVERY carried unlit ' +
      'torch — at a lit fire, or with carried flint + ' +
      'river-stone (both kept, fire-lighting precedent). Lit ' +
      'torches are carried light, brighter than the candle ' +
      '(Adam: well-lit to 6 m, dim to at least 12 m; exact ' +
      'values Background\'s); no burnout, no duration, ' +
      'no chain-lighting (Adam: both rejected as ' +
      'annoying/tedious). Quantities + the cordage binding ' +
      'are lane-decided for the pin pass; no tallow/resin ' +
      '(not in the game). Placeable candles are NOT in this ' +
      'order (later, after torches).',
  },

  // --- Paper chain (Adam, DEV chat 2026-10-27, solid-points
  // round): plant fiber + creek water -> pulp -> pressed
  // sheets -> dried paper -> grimoire. ALL quantities below
  // are lane-decided DRAFT for Adam's pin pass. Pressing +
  // drying are instant recipe steps (like all crafts) — no
  // timed press/dry mechanic is invented here.
  {
    id: 'plant-pulp',
    name: 'Plant Pulp',
    status: 'draft',
    output: { item: ITEMS.plantPulp, quantity: 2 },
    ingredients: [i(ITEMS.tenderVines, 2), i(ITEMS.grass, 2)],
    station: 'hand',
    requiresCreek: true,
    notes:
      'DRAFT. Fiber + creek water -> pulp. Fiber sources, ' +
      'both on hand: tender-vines (reed harvests yield ' +
      'tender-vines — reedBed primaryYield is TENDER_VINES, ' +
      'so reeds are covered without a reeds item) + grass. ' +
      'Water shape decided (lane call, flagged): PROXIMITY ' +
      'to a creek (requiresCreek), NOT carried water (never ' +
      'invented) and NOT a station (a creek is a place, not ' +
      'a structure). Gate is transitional: until ' +
      "Background's water adapter lands, the shell cannot " +
      'compute creek proximity, so pulp crafts by hand ' +
      'anywhere meanwhile — the gate arms the moment the ' +
      'shell supplies nearCreek. Quantities draft.',
  },
  {
    id: 'pressed-sheets',
    name: 'Pressed Sheets',
    status: 'draft',
    output: { item: ITEMS.pressedSheets, quantity: 2 },
    ingredients: [i(ITEMS.plantPulp, 2)],
    station: 'hand',
    notes:
      'DRAFT. Pulp -> pressed sheets, by hand. Pressing is ' +
      'an instant recipe step (no timed press invented). ' +
      'Quantities draft.',
  },
  {
    id: 'paper',
    name: 'Paper',
    status: 'draft',
    output: { item: ITEMS.paper, quantity: 2 },
    ingredients: [i(ITEMS.pressedSheets, 2)],
    station: 'hand',
    notes:
      'DRAFT. Pressed sheets -> dried paper, by hand. ' +
      'Drying is an instant recipe step (no timed drying ' +
      'invented); dry paper weighs less than damp sheets ' +
      '(0.25 lb vs 0.5 lb). Quantities draft.',
  },
  {
    id: 'grimoire',
    name: 'Grimoire',
    status: 'draft',
    output: { item: ITEMS.grimoire, quantity: 1 },
    ingredients: [i(ITEMS.paper, 4), i(ITEMS.twinedCordage, 2)],
    station: 'hand',
    notes:
      'DRAFT. Grimoire assembly = paper + cordage binding, ' +
      'by hand. Cover TBD (flagged — NOT in this recipe; ' +
      'a cover item comes later, not invented here). PAGES ' +
      'NOT BUILT: the book is an object now; page-unlock ' +
      '(record) behavior ties to the discovery mechanic ' +
      '(still proposal, not pinned) and is a follow-up ' +
      'when discovery pins. Quantities draft.',
  },
  {
    id: 'journal',
    name: 'Journal',
    status: 'draft',
    output: { item: ITEMS.journal, quantity: 1 },
    ingredients: [i(ITEMS.paper, 2), i(ITEMS.twinedCordage, 1)],
    station: 'hand',
    notes:
      'DRAFT. The pocket book: the grimoire recipe\'s binding ' +
      'idiom at half scale (paper 2 + cordage 1, by hand). ' +
      'MUNDANE as crafted — the enchantment that links it to ' +
      'the grimoire is a separate later step (Adam\'s altar ' +
      'decision), NOT part of this recipe. One journal only ' +
      '(a listed single in crafting.ts: names live in it, a ' +
      'second would split the record). Quantities draft.',
  },

  // --- Tool ladder: ONE tool, evolving. Upgrade costs, not rebuilds.
  // Route A: Trowel -> Sharp Trowel -> Spade -> Spade-Axe -> Trundle-Tool.
  // Route B: Trowel -> Sharp Trowel -> Axe-Trowel -> Spade-Axe.
  // Both routes converge at Spade-Axe for the same delta.
  {
    id: 'sharp-trowel',
    name: 'Sharp Trowel',
    status: 'draft',
    output: { item: ITEMS.sharpTrowel, quantity: 1 },
    ingredients: [],
    station: 'workstation',
    upgradeFrom: ITEMS.gardenTrowel,
    requires: [i(ITEMS.riverStone, 1)],
    notes:
      'DRAFT. Sharpen the garden trowel. RESOLVED 2026-10-25: no ' +
      'conversion, no loss — the river stone is the whetstone, kept, ' +
      'not consumed, so sharpening costs nothing consumable. The stone ' +
      'is modelled as `requires` (present, not consumed), not as an ' +
      'ingredient. Benefits live in the upgraded tool\'s description.',
  },
  {
    id: 'spade',
    name: 'Spade',
    status: 'draft',
    output: { item: ITEMS.spade, quantity: 1 },
    ingredients: [
      i(ITEMS.snapWood, 4),
      i(ITEMS.riverStone, 2),
      i(ITEMS.twinedCordage, 2),
    ],
    station: 'workstation',
    upgradeFrom: ITEMS.sharpTrowel,
    notes: 'DRAFT. Route A middle stage, from the sharp trowel.',
  },
  {
    id: 'axe-trowel',
    name: 'Axe-Trowel',
    status: 'draft',
    output: { item: ITEMS.axeTrowel, quantity: 1 },
    ingredients: [
      i(ITEMS.snapWood, 4),
      i(ITEMS.riverStone, 4),
      i(ITEMS.twinedCordage, 2),
    ],
    station: 'workstation',
    upgradeFrom: ITEMS.sharpTrowel,
    notes:
      'DRAFT. Route B middle stage, from the sharp trowel. The axe edge ' +
      'is stone — bog iron comes later, post-axe.',
  },
  {
    id: 'spade-axe',
    name: 'Spade-Axe',
    status: 'draft',
    output: { item: ITEMS.spadeAxe, quantity: 1 },
    ingredients: [
      i(ITEMS.snapWood, 4),
      i(ITEMS.riverStone, 2),
      i(ITEMS.twinedCordage, 2),
    ],
    station: 'workstation',
    upgradeFrom: [ITEMS.spade, ITEMS.axeTrowel],
    notes:
      'DRAFT. Convergence: from EITHER middle stage (spade or axe-trowel) ' +
      'for the same delta — modelled as an either/or upgradeFrom, so ' +
      'neither route is silently picked over the other. Name ' +
      'PROVISIONAL ("fine for now", Adam 2026-10-25), not a hard pin.',
  },
  {
    id: 'trundle-tool',
    name: 'Trundle-Tool',
    status: 'draft',
    output: { item: ITEMS.trundleTool, quantity: 1 },
    ingredients: [
      i(ITEMS.snapWood, 6),
      i(ITEMS.twinedCordage, 4),
      i(ITEMS.riverStone, 2),
    ],
    station: 'workstation',
    upgradeFrom: ITEMS.spadeAxe,
    notes:
      'DRAFT. Wheeled form of the Spade-Axe (the dolly upgrade = the ' +
      'tool, wheeled). Wood wheels and frame, cordage lashing, stone ' +
      'axle/pivot. Name PICKED by Adam 2026-10-25 ("final for now", ' +
      'further upgrade possible). Moves stations (workstation, loom, ' +
      'etc., maybe hearth — maybe, not pinned). Hauling device is a ' +
      'dolly or sledge, whichever fits the terrain (wheels firm ground, ' +
      'sledge soft/wet swamp). Carrying-capacity bonus PINNED by Adam ' +
      '2026-10-26: +50 — modelled as TRUNDLE_TOOL_BONUS in ' +
      'inventory.ts, deliberately NOT a number here.',
  },

  // --- Housing ladder (merged cottage stage; no workstation required).
  {
    id: 'thatch-hut',
    name: 'Thatch Hut',
    status: 'draft',
    output: { item: ITEMS.thatchHut, quantity: 1 },
    ingredients: [
      i(ITEMS.snapWood, 8),
      i(ITEMS.tenderVines, 6),
      i(ITEMS.riverSilt, 8),
    ],
    notes:
      'DRAFT. New stage between lean-to and cottage. COMPOSITION PINNED ' +
      '2026-10-25: thatch = snap-wood + tender-vines + silt (moss ' +
      'provisional withdrawn); quantities are draft.',
  },
  {
    id: 'woven-cottage',
    name: 'Woven Cottage',
    status: 'draft',
    output: { item: ITEMS.wovenCottage, quantity: 1 },
    ingredients: [
      i(ITEMS.downedOak, 8),
      i(ITEMS.riverSilt, 8),
      i(ITEMS.tenderVines, 6),
      i(ITEMS.twinedCordage, 4),
      i(ITEMS.peatMoss, 10),
      i(ITEMS.riverStone, 2),
    ],
    // No workstation requirement, per the 2026-10-25 workstation ruling.
    notes:
      'DRAFT. MERGED stage replacing both prototype recipes: ' +
      'wattle-and-daub and woven cottage are one ladder stage. In-game ' +
      'name "Woven Cottage", description carries "Wattle and Daub". ' +
      'A true merge, not the sum: oak and moss up from the hut, silt ' +
      'and vines down, stone down. No workstation requirement.',
  },
  {
    id: 'small-wooden-hut',
    name: 'Small Wooden Hut',
    status: 'draft',
    output: { item: ITEMS.smallWoodenHut, quantity: 1 },
    ingredients: [
      i(ITEMS.downedOak, 14),
      i(ITEMS.twinedCordage, 6),
      i(ITEMS.peatMoss, 8),
      i(ITEMS.riverStone, 4),
    ],
    notes:
      'DRAFT. New stage above the cottage. Plank walls, cordage lashing, ' +
      'moss insulation, stone footing.',
  },

  // --- Fire ladder.
  {
    id: 'campfire',
    name: 'Campfire',
    status: 'draft',
    output: { item: ITEMS.campfire, quantity: 1 },
    ingredients: [i(ITEMS.snapWood, 3), i(ITEMS.dryKindling, 2)],
    notes:
      'DRAFT. Flint OPTIONAL, never required: with flint, ' +
      'click-click-click-WOOF (fast); without, rub-rub-rub with a ' +
      '20-30 second wait (slow). Convenience, not gate. Flint is ' +
      'therefore NOT an ingredient here — do not add it as one.',
  },
  {
    id: 'hearth',
    name: 'Hearth',
    status: 'draft',
    output: { item: ITEMS.hearth, quantity: 1 },
    ingredients: [
      i(ITEMS.riverStone, 6),
      i(ITEMS.clay, 4),
      i(ITEMS.snapWood, 4),
    ],
    notes:
      'DRAFT. Stone ring, clay lining, wood fuel. Better / more food ' +
      'from cooking. Whether a hearth is moveable by the Trundle-Tool ' +
      'is MAYBE, not pinned.',
  },
  {
    id: 'kiln',
    name: 'Kiln',
    status: 'draft',
    output: { item: ITEMS.kiln, quantity: 1 },
    ingredients: [i(ITEMS.clay, 10), i(ITEMS.riverStone, 8)],
    notes: 'DRAFT. Fires pottery and bricks.',
  },
  // --- Stations.
  {
    id: 'stumpy-workstation',
    name: 'Stumpy Workstation',
    status: 'draft',
    output: { item: ITEMS.stumpyWorkstation, quantity: 1 },
    station: 'workstation',
    ingredients: [
      i(ITEMS.snapWood, 4),
      i(ITEMS.twinedCordage, 4),
    ],
    upgradesStump: true,
    notes:
      'DRAFT. A found Old Stump upgraded into a proper workbench ' +
      '("feed the stump wood and cordage and it BECOMES the proper ' +
      'workbench"). PINNED 2026-10-25: stumps upgrade to a workstation. ' +
      'Presence condition: station \'workstation\' (presence comes ' +
      'solely from stumps today), so the entry crafts only AT a stump. ' +
      'Execution reports upgradedStump (trap-report precedent): the ' +
      'shell transforms the FACED stump; the anchor is NOT consumed ' +
      '(transformation, not harvest); station presence unchanged; ' +
      'trundle-move preserved. Moveable via the Trundle-Tool; ' +
      'splitting wood there yields more lumber than in the field ' +
      '(bonus keys on the upgraded state when splitting lands — no ' +
      'splitting mechanic exists yet, no numbers now). Additions-aware: ' +
      'the workstation is ONE addition on the stump anchor, not an ' +
      'exclusive flag — other additions (e.g. altar) coexist.',
  },
  {
    id: 'crafted-workstation',
    name: 'Crafted Workstation',
    status: 'draft',
    output: { item: ITEMS.craftedWorkstation, quantity: 1 },
    ingredients: [i(ITEMS.downedOak, 6), i(ITEMS.twinedCordage, 4)],
    notes:
      'DRAFT. A proper bench: oak top, cordage lashing. She can make ' +
      'her own workstation; the stump is the starter workstation. ' +
      'Wheel and loom fork off a crafted workstation (found-stump ' +
      'forks still open).',
  },
  {
    id: 'potters-wheel',
    name: "Potter's Wheel",
    status: 'draft',
    output: { item: ITEMS.pottersWheel, quantity: 1 },
    ingredients: [
      i(ITEMS.snapWood, 6),
      i(ITEMS.riverStone, 2),
      i(ITEMS.twinedCordage, 2),
    ],
    notes:
      'DRAFT. Fork off the crafted workstation — NEEDED for pottery. ' +
      'Wheel and loom are SEPARATE, not combined. Whether a found stump ' +
      'can take the wheel fork is still open.',
  },
  {
    id: 'loom',
    name: 'Loom',
    status: 'draft',
    output: { item: ITEMS.loom, quantity: 1 },
    ingredients: [i(ITEMS.snapWood, 6), i(ITEMS.twinedCordage, 6)],
    notes:
      'DRAFT cost. Fork off the crafted workstation, SEPARATE from ' +
      'the wheel. PINNED 2026-10-26: the loom is REQUIRED for ' +
      'clothes — all five garment recipes carry station \'loom\'. ' +
      'A placed loom supplies that station the same way a stump ' +
      'supplies \'workstation\' (presence is wiring input, not ' +
      'settled here).',
  },

  // --- Garments (MVP round, 2026-10-26). All woven at the loom
  // --- (station 'loom', PINNED requirement). Every garment needs
  // --- a bunch of cordage (Adam's words) — quantities below are
  // --- LANE-DECIDED starting tunables for his pin pass, flagged
  // --- as such; the other ingredients are likewise lane-decided.
  // --- Worn bonuses are PINNED and live in clothes.ts, NOT in
  // --- capacityBonus here (that field is a carried-container
  // --- bonus; a worn bonus applies only while worn, per slot).
  {
    id: 'hooded-cloak',
    name: 'Hooded Cloak',
    status: 'draft',
    output: { item: ITEMS.hoodedCloak, quantity: 1 },
    ingredients: [
      i(ITEMS.twinedCordage, 8),
      i(ITEMS.tenderVines, 4),
    ],
    station: 'loom',
    notes:
      'DRAFT cost (cordage bunch = lane-decided). Worn bonus ' +
      'PINNED: +6 capacity. Weather (Background table, not ' +
      're-decided here): rain 40%, wind 30%.',
  },
  {
    id: 'shawl',
    name: 'Shawl',
    status: 'draft',
    output: { item: ITEMS.shawl, quantity: 1 },
    ingredients: [
      i(ITEMS.twinedCordage, 6),
      i(ITEMS.peatMoss, 2),
    ],
    station: 'loom',
    notes:
      'DRAFT cost (cordage bunch = lane-decided). Worn bonus ' +
      'PINNED: +3 capacity. Weather (Background table): cold 30%.',
  },
  {
    id: 'pointy-hat',
    name: 'Pointy Hat',
    status: 'draft',
    output: { item: ITEMS.pointyHat, quantity: 1 },
    ingredients: [
      i(ITEMS.twinedCordage, 4),
      i(ITEMS.tenderVines, 2),
    ],
    station: 'loom',
    notes:
      'DRAFT cost (cordage bunch = lane-decided). Worn bonus ' +
      'PINNED: +1 capacity. Weather (Background table): rain 15%.',
  },
  {
    id: 'mossy-mittens',
    name: 'Mossy Mittens',
    status: 'draft',
    output: { item: ITEMS.mossyMittens, quantity: 1 },
    ingredients: [
      i(ITEMS.twinedCordage, 4),
      i(ITEMS.peatMoss, 4),
    ],
    station: 'loom',
    notes:
      'DRAFT cost (cordage bunch = lane-decided). No capacity ' +
      'bonus. Weather (Background table): cold 15%.',
  },
  {
    id: 'bog-boots',
    name: 'Bog Boots',
    status: 'draft',
    output: { item: ITEMS.bogBoots, quantity: 1 },
    ingredients: [
      i(ITEMS.twinedCordage, 6),
      i(ITEMS.tenderVines, 4),
    ],
    station: 'loom',
    notes:
      'DRAFT cost (cordage bunch = lane-decided). No capacity ' +
      'bonus. Weather (Background table): wet 40%, plus the ' +
      'less-slow bog travel effect in movement.ts.',
  },
  {
    id: 'umbrella',
    name: 'Umbrella',
    status: 'draft',
    output: { item: ITEMS.umbrella, quantity: 1 },
    ingredients: [
      i(ITEMS.snapWood, 4),
      i(ITEMS.tenderVines, 6),
      i(ITEMS.twinedCordage, 4),
    ],
    station: 'workstation',
    notes:
      'DRAFT cost — materials and quantities are LANE-DECIDED ' +
      'starting tunables for Adam\'s pin pass, from existing ' +
      'vocabulary only (no new items): snap-wood ribs + handle, ' +
      'tender-vine woven cover, cordage lashing. Station is the ' +
      'brief\'s default workstation. LOOM FLAG: the cover half ' +
      'is woven, so the loom fits that half better — but the ' +
      'whole assembly (frame + cover + lashing) is bench work, ' +
      'so workstation stands for the single-station recipe; if ' +
      'Adam wants the weave split out, a woven cover (loom) + ' +
      'umbrella assembly (workstation) split is the shape. ' +
      'Mechanic (umbrella.ts, NOT a worn bonus): precipitation ' +
      'protection 60% (REVISED starting value, pin pass — ' +
      'supersedes the earlier 35% rain-only value; covers rain ' +
      '+ sleet/etc.) while carried in inventory — no equip ' +
      'step, multiplicative with worn clothes (full kit + ' +
      'umbrella precipitation ~80%). The umbrella counts ' +
      'against personal capacity like any ordinary item.',
  },

  // --- Receptacles. Clay is reserved for pottery / bricks / maybe tools
  // --- (NOT daub). Cooking is NOT a receptacle job: cooking is open-fire.
  {
    id: 'clay-pot',
    name: 'Clay Pot',
    status: 'draft',
    output: { item: ITEMS.clayPot, quantity: 1 },
    ingredients: [i(ITEMS.clay, 3)],
    station: 'kiln',
    notes:
      'DRAFT. Shaped on the wheel, fired in the kiln (kiln is the ' +
      'engine station here; the wheel step is a shaping step, not a ' +
      'second station). Food storage + salves / medicine / ' +
      'restoratives / reagents. NOT cooking. Also the pot trap: sink ' +
      'a pot in the creek.',
  },
  {
    id: 'clay-jar',
    name: 'Clay Jar',
    status: 'draft',
    output: { item: ITEMS.clayJar, quantity: 1 },
    ingredients: [i(ITEMS.clay, 2)],
    station: 'kiln',
    notes:
      'DRAFT. The water carrier (Adam\'s carried-water ' +
      'ruling, 2026-10-27): a small kiln-fired jar for ' +
      'carrying water. Adam\'s pins: NO THIRST — water ' +
      'is an INGREDIENT, never a need; the jar\'s first ' +
      'named job is carrying water for SOUP, and brews ' +
      'stand behind it. The filled state is a SECOND ' +
      'item (water-jar), so it rides the inventory with ' +
      'no save machinery; fillJar / emptyJar (clay-' +
      'jar.ts) swap the ids. When soup / brew recipes ' +
      'land, they consume water-jar and return the ' +
      'empty jar among their outputs (the multi-output ' +
      'idiom) — none in this landing. A VESSEL, plural ' +
      'by nature (Adam, 2026-11-01): unlisted in ' +
      'crafting.ts — she makes as many as storage wants. ' +
      'Quantities draft.',
  },
  {
    id: 'cauldron',
    name: 'Cauldron',
    status: 'draft',
    output: { item: ITEMS.cauldron, quantity: 1 },
    ingredients: [i(ITEMS.clay, 8)],
    station: 'kiln',
    notes:
      'DRAFT. The big vessel, founded here (Adam\'s ' +
      'no-iron ruling, 2026-10-30: the cauldron is CLAY — ' +
      'shaped and kiln-fired like the pot, at several ' +
      'times its size). Set it on a hearth and it ' +
      'works: carcasses render in it, wax melts in it, ' +
      'and her brews brew in it (the future potions / ' +
      'salves pot, per Adam\'s hearth picture). The ' +
      'vessel gates its recipes AS A STATION (Adam\'s ' +
      'ruling, 2026-10-30): station "cauldron" — the ' +
      'context is the faced cauldron, placed on its ' +
      'hearth, with the hearth lit. Quantities draft.',
  },
  {
    id: 'clay-brick',
    name: 'Clay Brick',
    status: 'draft',
    output: { item: ITEMS.clayBrick, quantity: 1 },
    ingredients: [i(ITEMS.clay, 2)],
    station: 'kiln',
    notes:
      'DRAFT. Fired in the kiln. Use: hearth / kiln building, TBD.',
  },

  // --- Carrying containers. Bonuses are Adam's pinned numbers; the
  // --- COSTS are draft. The inventory system itself is a later piece.
  {
    id: 'small-basket',
    name: 'Small Basket',
    status: 'draft',
    output: { item: ITEMS.smallBasket, quantity: 1 },
    ingredients: [i(ITEMS.tenderVines, 8)],
    capacityBonus: 25,
    notes:
      'DRAFT cost; BONUS PINNED (+25). Woven vines. The hand basket ' +
      'joins the ladder early ("in there someplace early on"); recorded ' +
      'as the small basket unless Adam says otherwise.',
  },
  {
    id: 'large-basket',
    name: 'Large Basket',
    status: 'draft',
    output: { item: ITEMS.largeBasket, quantity: 1 },
    ingredients: [
      i(ITEMS.tenderVines, 6),
      i(ITEMS.twinedCordage, 4),
    ],
    upgradeFrom: ITEMS.smallBasket,
    capacityBonus: 50,
    notes:
      'DRAFT cost; BONUS PINNED (50). Upgrade of the small basket. ' +
      'PINNED (Adam, main chat 2026-10-27, "for simplicity"): ' +
      'the large basket\'s 50 REPLACES the small\'s +25 (total ' +
      '70 with pockets + apron); it does NOT stack (95 is ' +
      'closed). The capacityBonus here is the basket\'s own ' +
      '50; the replacement itself is modelled in ' +
      'inventory.ts capacityBreakdown().',
  },
  {
    id: 'apron',
    name: 'Apron',
    status: 'draft',
    output: { item: ITEMS.apron, quantity: 1 },
    ingredients: [i(ITEMS.twinedCordage, 6)],
    station: 'loom',
    capacityBonus: 10,
    notes: 'DRAFT cost; BONUS PINNED (+10). Woven cordage cloth.',
  },

  // --- Traps: DRAFT brainstorm items, NOTHING PICKED. These are in
  // --- here so the brainstorm is not lost, not because any trap is
  // --- approved. Do not present any of them as a settled recipe.
  {
    id: 'snare',
    name: 'Snare',
    status: 'draft',
    output: { item: ITEMS.snare, quantity: 1 },
    ingredients: [i(ITEMS.tenderVines, 2), i(ITEMS.snapWood, 2)],
    station: 'hand',
    requiresSite: 'dry-land',
    notes:
      'DRAFT — BRAINSTORM, NOTHING PICKED. Stakes. CARRYABLE ' +
      '(trap table, Adam 2026-11-01): hand-crafted anywhere, ' +
      'carried, and SET on dry ground — requiresSite is read ' +
      'at PLACEMENT for the carryable three, at craft for the ' +
      'site-built two. No workstation needed (Adam\'s ruling, ' +
      '2026-10-26: traps are hand-crafted, cordage precedent).',
  },
  {
    id: 'fish-weir-trap',
    name: 'Fish / Weir Trap',
    status: 'draft',
    output: { item: ITEMS.fishWeirTrap, quantity: 1 },
    ingredients: [i(ITEMS.tenderVines, 6), i(ITEMS.snapWood, 4)],
    station: 'hand',
    requiresSite: 'in-water',
    notes:
      'DRAFT — BRAINSTORM, NOTHING PICKED. Woven funnel. ' +
      'CARRYABLE (trap table, Adam 2026-11-01): hand-crafted ' +
      'anywhere, carried, and SET standing in the water it ' +
      'fishes — his weir sentence, at placement: a weir ' +
      'belongs in the water, so it is set there where it ' +
      'goes. No workstation needed (Adam\'s ruling, ' +
      '2026-10-26: traps are hand-crafted).',
  },
  {
    id: 'pot-trap',
    name: 'Pot Trap',
    status: 'draft',
    output: { item: ITEMS.potTrap, quantity: 1 },
    ingredients: [i(ITEMS.clayPot, 1)],
    station: 'hand',
    requiresSite: 'in-water',
    notes:
      'DRAFT — BRAINSTORM, NOTHING PICKED. 1 clay pot, sunk in ' +
      'the creek. CARRYABLE (trap table, Adam 2026-11-01): ' +
      'hand-crafted anywhere, carried, and SET standing in ' +
      'the creek water. No workstation needed (Adam\'s ' +
      'ruling, 2026-10-26: traps are hand-crafted).',
  },
  {
    id: 'pitfall',
    name: 'Pitfall',
    status: 'draft',
    output: { item: ITEMS.pitfall, quantity: 1 },
    ingredients: [i(ITEMS.peatMoss, 2)],
    station: 'hand',
    placesTrap: true,
    requiresToolStage: 1,
    requiresSite: 'dry-land',
    spoil: { item: ITEMS.dirt, quantity: 6 },
    notes:
      'DRAFT — BRAINSTORM, NOTHING PICKED. Dug with the spade, ' +
      'not the trowel; peat moss is the cover. No build cost ' +
      'beyond the cover. Requires spade tier or better (owned ' +
      'tool stage 1+, present, not consumed) — a spade-axe or ' +
      'trundle-tool qualifies; a literal spade item is NOT ' +
      'required, so upgrading never locks her out (Adam\'s ' +
      'ruling, 2026-10-26). Hand-crafted on dry ground — a ' +
      'pit is dug, not scooped from a creek (fork B, Adam ' +
      '2026-11-01). No workstation needed (traps are ' +
      'hand-crafted).',
  },
  {
    id: 'deadfall',
    name: 'Deadfall',
    status: 'draft',
    output: { item: ITEMS.deadfall, quantity: 1 },
    ingredients: [
      i(ITEMS.downedOak, 2),
      i(ITEMS.tenderVines, 2),
      i(ITEMS.riverStone, 2),
    ],
    station: 'hand',
    placesTrap: true,
    requiresSite: 'dry-land',
    notes:
      'DRAFT — BRAINSTORM, NOTHING PICKED. River stone is the ' +
      'weight. Hand-crafted on dry ground (fork B, Adam ' +
      '2026-11-01). No workstation needed (Adam\'s ruling, ' +
      '2026-10-26: traps are hand-crafted).',
  },
  {
    id: 'writing-desk',
    name: 'Writing Desk',
    status: 'draft',
    output: { item: ITEMS.writingDesk, quantity: 1 },
    ingredients: [i(ITEMS.snapWood, 6), i(ITEMS.downedOak, 2)],
    station: 'workstation',
    notes:
      'DRAFT. A desk for the big book, built at the stump ' +
      'workstation (her workbench builds her desk). ' +
      'Placeable-only, in the altar idiom (desk.ts carries ' +
      'the place grant; the desk is the grimoire\'s SITE — ' +
      'the workings themselves arrive with the grimoire\'s ' +
      'design turn, not this recipe). Quantities draft.',
  },
  {
    id: 'altar',
    name: 'Altar',
    status: 'draft',
    output: { item: ITEMS.altar, quantity: 1 },
    ingredients: [
      i(ITEMS.riverStone, 4),
      i(ITEMS.snapWood, 2),
      i(ITEMS.clay, 2),
      i(ITEMS.twinedCordage, 2),
    ],
    station: 'hand',
    notes:
      'DRAFT quantities for Adam\'s pin pass (DEV brief ' +
      '2026-10-27). Ritual altar, PLACEABLE ONLY: she builds ' +
      'it where she stands (station hand — flagged), crafts ' +
      'to a carried altar item, and a Place step consumes it ' +
      '(houses/fires pattern; see altar.ts). Moss / salt / ' +
      'bone dressing + focus are NOT in this recipe (later ' +
      'dressing, flagged — do not add them). Upgrade tiers ' +
      'NOT built. RITUALS THEMSELVES NOT IN THIS ORDER — ' +
      'the altar is the SITE; rituals come later.',
  },

  // --- Camping (Adam, 2026-10-28: portable sleeping bag + tent;
  // ingredients DELEGATED — existing materials only, all numbers
  // DRAFT for Adam's pin pass; see camping.ts).
  {
    id: 'sleeping-bag',
    name: 'Sleeping Bag',
    status: 'draft',
    output: { item: ITEMS.sleepingBag, quantity: 1 },
    station: 'loom',
    ingredients: [
      i(ITEMS.twinedCordage, 4),
      i(ITEMS.grass, 6),
      i(ITEMS.tenderVines, 2),
    ],
    notes:
      'DRAFT. Carried bedding, passive while carried (umbrella ' +
      'precedent: no equip, no use-action, does NOT gate sleep — ' +
      'sleep-anywhere already works). V1 effect is the marker + ' +
      'the fiction (carriesSleepingBag, checked at sleep time); ' +
      'no number today — no cold/exposure-during-sleep model to ' +
      'attach one to, and a waking-refresh number would collide ' +
      'with groundhog +10 (Adam\'s word needed, not baked). ' +
      'Multiples by default (one-person-one-bag single is a ' +
      'follow-up only if Adam wants it); not a no-recraft single.',
  },
  {
    id: 'tent',
    name: 'Tent',
    status: 'draft',
    output: { item: ITEMS.tent, quantity: 1 },
    station: 'workstation',
    ingredients: [
      i(ITEMS.snapWood, 4),
      i(ITEMS.twinedCordage, 6),
      i(ITEMS.tenderVines, 4),
    ],
    notes:
      'DRAFT. Placeable portable shelter (torch mirror: place ' +
      'consumes 1, pickup grants 1, pack-full pickup leaves it ' +
      'placed; multiples allowed). NOT a HouseType — no ' +
      'HomeStorage/Store/Take, no upgrade pill, no FIND CAMP ' +
      'camp, no home chip (all house-anchored). Shelter effect ' +
      'PROPOSED draft 0.85 (lean-to 0.7, unsheltered 1.0) with ' +
      'NO live benefit until Background\'s tent-aware ' +
      'shelterQuery branch lands (their claim, DEV-routed). ' +
      'Not a no-recraft single (multiples by design).',
  },
];

// ---------------------------------------------------------------------------
// Public data
// ---------------------------------------------------------------------------

export const RECIPES: Recipe[] = [...PROTOTYPE_RECIPES, ...DRAFT_RECIPES];

export function findRecipe(id: string): Recipe | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}

/** Prototype recipes only — the verbatim set. */
export function prototypeRecipes(): Recipe[] {
  return RECIPES.filter((recipe) => recipe.status === 'prototype');
}

/** Draft recipes only — everything still awaiting Adam's pin pass. */
export function draftRecipes(): Recipe[] {
  return RECIPES.filter((recipe) => recipe.status === 'draft');
}
