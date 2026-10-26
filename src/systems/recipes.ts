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
 * - The iron tool (post-axe) — gated by bog iron + bloomery; name and
 *   recipe TBD after the bloomery word veto. The bloomery itself is in
 *   here as a draft recipe, with its veto note attached.
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
  peatMoss: 'peat-moss',
  downedOak: 'downed-oak',
  riverSilt: 'river-silt',
  riverStone: 'river-stone',
  luminousSpores: 'luminous-spores',
  dryKindling: 'dry-kindling',
  // New items (2026-10-25 design work).
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
  bloomery: 'bloomery',
  // Stations.
  stumpyWorkstation: 'stumpy-workstation',
  craftedWorkstation: 'crafted-workstation',
  pottersWheel: 'potters-wheel',
  loom: 'loom',
  // Receptacles.
  clayPot: 'clay-pot',
  clayBrick: 'clay-brick',
  // Carrying containers.
  smallBasket: 'small-basket',
  largeBasket: 'large-basket',
  apron: 'apron',
  // Traps (brainstorm only — nothing picked; see their notes).
  snare: 'snare',
  fishWeirTrap: 'fish-weir-trap',
  potTrap: 'pot-trap',
  pitfall: 'pitfall',
  deadfall: 'deadfall',
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
export type CraftingStation = 'workstation' | 'fire' | 'hand' | 'kiln';

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
    id: 'wattle-and-daub-hut',
    name: 'Wattle-and-Daub Hut',
    status: 'prototype',
    output: { item: ITEMS.wattleAndDaubHut, quantity: 1 },
    ingredients: [
      i(ITEMS.downedOak, 4),
      i(ITEMS.riverSilt, 12),
      i(ITEMS.tenderVines, 8),
    ],
    // Prototype lists no workstation requirement; station left unstated.
    notes:
      'Prototype verbatim (prototype key RIVER_SLUDGE = River Silt). ' +
      'Silt restored 2026-10-25 (the cut was withdrawn): the hut spends 12.',
  },
  {
    id: 'woven-cottage-prototype',
    name: 'Woven Cottage (prototype)',
    status: 'prototype',
    output: { item: ITEMS.wovenCottage, quantity: 1 },
    ingredients: [
      i(ITEMS.downedOak, 10),
      i(ITEMS.twinedCordage, 6),
      i(ITEMS.peatMoss, 15),
      i(ITEMS.riverStone, 4),
    ],
    station: 'workstation', // prototype: requiresWorkstation = true
    notes:
      'Prototype verbatim, kept for the record. SUPERSEDED by the merged ' +
      'Woven Cottage draft recipe below (wattle-and-daub and woven cottage ' +
      'are one ladder stage; the merged recipe drops the workstation ' +
      'requirement per the 2026-10-25 workstation ruling). Do not craft ' +
      'from this entry once the merged recipe is pinned; it is retained ' +
      'so the verbatim prototype is not silently lost.',
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
    station: 'workstation',
    notes:
      'DRAFT. Tender-Vines 2 -> 1 cordage. Workstation jobs include raw ' +
      'ingredients that do not require fire; cordage is the named example.',
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
  {
    id: 'bloomery',
    name: 'Bloomery',
    status: 'draft',
    output: { item: ITEMS.bloomery, quantity: 1 },
    ingredients: [
      i(ITEMS.riverStone, 8),
      i(ITEMS.clay, 8),
      i(ITEMS.snapWood, 4),
    ],
    notes:
      'DRAFT. Smelts bog iron (bog iron + fuel consumed per smelt; ' +
      'exact smelt cost TBD). WORD VETO STILL PENDING: Adam is to veto ' +
      '"bloomery" or let it stand — the name is not settled.',
  },

  // --- Stations.
  {
    id: 'stumpy-workstation',
    name: 'Stumpy Workstation',
    status: 'draft',
    output: { item: ITEMS.stumpyWorkstation, quantity: 1 },
    ingredients: [
      i(ITEMS.oldStump, 1),
      i(ITEMS.snapWood, 4),
      i(ITEMS.twinedCordage, 4),
    ],
    notes:
      'DRAFT. A found Old Stump upgraded into a proper workbench ' +
      '("feed the stump wood and cordage and it BECOMES the proper ' +
      'workbench"). PINNED 2026-10-25: stumps upgrade to a workstation. ' +
      'Moveable via the Trundle-Tool; splitting wood there yields more ' +
      'lumber than in the field. The found stump is modelled as an ' +
      'ingredient because the engine works on inventory counts; the ' +
      'world-side "found stump" object is a later wiring concern, not ' +
      'something this data module settles.',
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
      'DRAFT. Fork off the crafted workstation — MAYBE (weaving). ' +
      'Products TBD. Wheel and loom are SEPARATE, not combined.',
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
      'OPEN, NOT SETTLED HERE: does it REPLACE the small basket\'s ' +
      '+25 (total 70 with pockets + apron) or STACK on top of it ' +
      '(total 95)? The engine must not bake in either total — the ' +
      'capacityBonus here is the basket\'s own 50, and the replace / ' +
      'stack ruling is Adam\'s to make.',
  },
  {
    id: 'apron',
    name: 'Apron',
    status: 'draft',
    output: { item: ITEMS.apron, quantity: 1 },
    ingredients: [i(ITEMS.twinedCordage, 6)],
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
    notes: 'DRAFT — BRAINSTORM, NOTHING PICKED. Stakes.',
  },
  {
    id: 'fish-weir-trap',
    name: 'Fish / Weir Trap',
    status: 'draft',
    output: { item: ITEMS.fishWeirTrap, quantity: 1 },
    ingredients: [i(ITEMS.tenderVines, 6), i(ITEMS.snapWood, 4)],
    notes: 'DRAFT — BRAINSTORM, NOTHING PICKED. Woven funnel.',
  },
  {
    id: 'pot-trap',
    name: 'Pot Trap',
    status: 'draft',
    output: { item: ITEMS.potTrap, quantity: 1 },
    ingredients: [i(ITEMS.clayPot, 1)],
    notes:
      'DRAFT — BRAINSTORM, NOTHING PICKED. 1 clay pot, sunk in the creek.',
  },
  {
    id: 'pitfall',
    name: 'Pitfall',
    status: 'draft',
    output: { item: ITEMS.pitfall, quantity: 1 },
    ingredients: [i(ITEMS.peatMoss, 2)],
    notes:
      'DRAFT — BRAINSTORM, NOTHING PICKED. Dug with the trowel; peat ' +
      'moss is the cover. No build cost beyond the cover.',
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
    notes: 'DRAFT — BRAINSTORM, NOTHING PICKED. River stone is the weight.',
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
