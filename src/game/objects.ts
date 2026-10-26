/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Harvest-source objects for Silent Earth (fill-in landing, 2026-10-25).
 *
 * This file is DATA + mesh descriptors, not a system. It answers, per
 * source: what it is, what it looks like, where it grows, and what it
 * yields. It does NOT implement harvest interaction (prompts, actions,
 * inventory changes) — that wiring is later work with the UI and Systems
 * lanes, and nothing here may be read as that system.
 *
 * YIELD RULES (from the task brief, not invented here):
 * - Yields use the item vocabulary in src/data/world_data.json
 *   (SNAP_WOOD, TENDER_VINES, PEAT_MOSS, RIVER_SLUDGE, RIVER_STONE, BONE,
 *   SALT_CRYSTAL, DOWNED_OAK, SPORES, DRY_KINDLING, STUMP) plus CLAY —
 *   the one exception, and it is Adam's, not this file's: clay is the
 *   pinned new item reserved for pottery/bricks (2026-10-25; Systems
 *   recipes already spend it), and per Adam's 2026-10-26 ruling it is
 *   now a normal harvest yield of silt ground (see below). No other
 *   new items are introduced.
 * - Secondary drops and multi-step harvest shapes marked `prototype` are
 *   carried verbatim from world_data.json (its harvestAction /
 *   harvestStep / secondaryDrops), NOT pinned by Adam and NOT re-balanced.
 * - Mappings marked `draft` are new source->yield mappings this landing
 *   had to choose so every source yields something sensible; they are
 *   draft, not prototype-carried and not pinned, and Adam's pin pass can
 *   change them without touching any system.
 * - CLAY HARVEST RULE (Adam, 2026-10-26 — SUPERSEDES the 2026-10-25
 *   dig-verb distinction): clay is harvested LIKE NORMAL, through the
 *   normal harvest interaction on silt ground (creek beds, damp
 *   hollows). No fuss over different verbs, no separate dig action.
 *   It is gated and scaled by tool, following the tool ladder's "more
 *   of whatever it does" shape. QUANTITIES (Adam, 2026-10-26, no longer
 *   TBD): trowel = base 1 + chance of +1; spade / axe-trowel (both
 *   middles, same tier) = base 2 + chance of +1; spade-axe = base 3 +
 *   chance of +1; trundle-tool = base 4 + chance of +1. Each tier's
 *   base rises by 1, with a chance of +1 bonus on top. BONUS CHANCE
 *   (Adam, 2026-10-26, starting value — "maybe", so tunable): 25%,
 *   UNIFORM at every tier, as the single named constant
 *   CLAY_BONUS_CHANCE = 0.25 — one place to change it, never scattered
 *   per tier. Sharp trowel is not named in Adam's table; it holds the
 *   trowel amount (base 1, same 25% bonus) pending his word — flagged,
 *   not silently settled.
 *   Clay stays out of every OTHER source; only silt ground yields it.
 * - No other quantities are invented: the prototype carries no
 *   per-harvest amounts, so other sources carry item ids + secondary
 *   chances only. Amounts belong to the later harvest system /
 *   balancing pass, not here.
 */

import type { BiomeId, ScatterKind } from '../types';

/** Item ids: src/data/world_data.json, plus CLAY (see header note). */
export type ItemId =
  | 'SNAP_WOOD'
  | 'TENDER_VINES'
  | 'PEAT_MOSS'
  | 'RIVER_SLUDGE'
  | 'RIVER_STONE'
  | 'BONE'
  | 'SALT_CRYSTAL'
  | 'DOWNED_OAK'
  | 'SPORES'
  | 'DRY_KINDLING'
  | 'STUMP'
  | 'CLAY';

/**
 * Tool ladder stages for tool-gated yields (the garden trowel and its
 * evolutions, per the 2026-10-25 tool ladder). Spade and axe-trowel are
 * parallel middle routes, not sequential stages — see the tier groups.
 */
export type ToolTier =
  | 'trowel'
  | 'sharpTrowel'
  | 'spade'
  | 'axeTrowel'
  | 'spadeAxe'
  | 'trundleTool';

/**
 * Clay tool-tier groups, lowest to highest. Each group is one rank:
 * spade and axe-trowel share a rank because they are alternative routes
 * to the same convergence (spade-axe), not one better than the other.
 */
export const CLAY_TOOL_TIER_GROUPS: ToolTier[][] = [
  ['trowel'],
  ['sharpTrowel'],
  ['spade', 'axeTrowel'],
  ['spadeAxe'],
  ['trundleTool'],
];

/** Rank of a tool in the clay ladder, or -1 when she has no tool at all
 *  (no tool = no clay yield). Pure ordering data, not a harvest system. */
export function toolTierRank(tier: ToolTier | null): number {
  if (!tier) return -1;
  return CLAY_TOOL_TIER_GROUPS.findIndex((group) => group.includes(tier));
}

/**
 * The bonus chance for the +1 clay bonus (Adam, 2026-10-26, starting
 * value — "maybe"): 25%, uniform at every tier. A SINGLE named constant
 * on purpose: tune it in this one place and every tier follows; it is
 * never copied per tier, so the table cannot drift apart by accident.
 */
export const CLAY_BONUS_CHANCE = 0.25;

/** One tier's clay yield: guaranteed base + a chance of a +1 bonus. */
export interface ClayYieldTier {
  base: number;
  bonus: number;
  bonusChance: number;
}

/**
 * Clay yield per tier group, in CLAY_TOOL_TIER_GROUPS order (Adam,
 * 2026-10-26): base rises by 1 per tier, +1 bonus on top at every tier.
 * Sharp trowel (group 1) is not named in Adam's table, so it holds the
 * trowel amount (base 1) pending his word — see the header note.
 */
export const CLAY_YIELD_BY_TIER_GROUP: ClayYieldTier[] = [
  { base: 1, bonus: 1, bonusChance: CLAY_BONUS_CHANCE },
  { base: 1, bonus: 1, bonusChance: CLAY_BONUS_CHANCE },
  { base: 2, bonus: 1, bonusChance: CLAY_BONUS_CHANCE },
  { base: 3, bonus: 1, bonusChance: CLAY_BONUS_CHANCE },
  { base: 4, bonus: 1, bonusChance: CLAY_BONUS_CHANCE },
];

/** Clay yield for a tool, or null when she has no tool (no clay yield).
 *  Pure lookup data, not a harvest system. */
export function clayYieldForTool(tier: ToolTier | null): ClayYieldTier | null {
  const rank = toolTierRank(tier);
  if (rank < 0) return null;
  return CLAY_YIELD_BY_TIER_GROUP[rank];
}

/**
 * A tool-gated yield: present only when she holds at least the required
 * tool, and scaled upward along the tier groups via yieldByTierGroup.
 */
export interface ToolGatedYield {
  item: ItemId;
  requiresTool: ToolTier;
  tierGroups: ToolTier[][];
  yieldByTierGroup: ClayYieldTier[];
}

/** A prototype-carried secondary drop: item + chance + prototype message. */
export interface SecondaryYield {
  item: ItemId;
  chance: number;
  /** Prototype message, kept so later UI text can reuse it verbatim. */
  message: string;
}

/** Prototype multi-step harvest shape (vines TUG, oak STOMP). */
export interface MultiStep {
  action: string;
  step: number;
  struggleMessage: string;
  successMessage: string;
}

/**
 * Mesh shape vocabulary. The renderer (src/game/renderer.ts) builds one
 * shared geometry per shape from this descriptor; shapes are primitives
 * with distinct silhouettes, not the landing-1 colored blobs — a stump
 * reads as a stump, a reed bed as tall thin stalks, a bog tuft as a
 * flattened moss mound. `extra` is a second primitive for composite
 * shapes (tree canopy, stump top, reed seed-head), placed above the base.
 */
export type MeshShape =
  | 'bush'
  | 'stick'
  | 'vine'
  | 'log'
  | 'oakLog'
  | 'tree'
  | 'stump'
  | 'reed'
  | 'grassTuft'
  | 'bogTuft'
  | 'disc'
  | 'stone'
  | 'crystal'
  | 'bone';

export interface MeshSpec {
  shape: MeshShape;
  /** Main material color (packed 0xRRGGBB). */
  color: number;
  /** Extra-primitive color (canopy, stump top, seed-head). */
  extraColor?: number;
  /** Base height above ground before scatter scale (see renderer). */
  baseY: number;
  /** Extra-primitive height above ground (when present). */
  extraY?: number;
}

export interface HarvestSourceDef {
  id: string;
  /** Scatter kind this source renders as (one source per kind). */
  kind: ScatterKind;
  name: string;
  description: string;
  /** False for ground character (bog patch, standing water, marsh grass):
   *  present in the world, yields nothing, harvest system must skip it. */
  harvestable: boolean;
  /** Primary yield, when harvestable. */
  primaryYield?: ItemId;
  /** Prototype-carried secondary yields (empty when the prototype had none). */
  secondaryYields: SecondaryYield[];
  /** Tool-gated yields (clay on silt ground only, per the 2026-10-26
   *  ruling). Absent on every other source. */
  toolGatedYields?: ToolGatedYield[];
  /** Prototype-carried multi-step shape, when the prototype had one. */
  multiStep?: MultiStep;
  /** 'prototype' = carried verbatim from world_data.json; 'draft' = new
   *  mapping chosen by this landing, awaiting Adam's pin pass. */
  provenance: 'prototype' | 'draft';
  /** Biomes where this source grows (draft biome set, not pinned). */
  biomes: BiomeId[];
  /** True when the source also grows in marsh ground character (the
   *  overlay, not a biome): reeds and marsh grass chiefly. */
  marsh?: boolean;
  mesh: MeshSpec;
}

const SPORES_25: SecondaryYield = {
  item: 'SPORES',
  chance: 0.25,
  message: 'A cloud of luminescent spores clings to your sleeves. Potency gathered.',
};

export const SOURCES: HarvestSourceDef[] = [
  {
    id: 'vineTangle',
    kind: 'vine',
    name: 'Vine Tangle',
    description:
      'Thick hanging vines, scenery twin of the harvestable vine strands. ' +
      'The harvestable form is tenderVines below; this tangle marks dense growth.',
    harvestable: false,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['mirewood', 'tanglewood', 'creekBottom', 'oldfieldRise'],
    mesh: { shape: 'vine', color: 0x4a6b2f, baseY: 0.7 },
  },
  {
    id: 'bush',
    kind: 'bush',
    name: 'Brush',
    description:
      'Low brush and saplings — young, brittle growth that snaps for framing.',
    harvestable: true,
    primaryYield: 'SNAP_WOOD',
    secondaryYields: [SPORES_25],
    provenance: 'draft',
    biomes: ['mirewood', 'oldfieldRise', 'tanglewood', 'deepBog', 'creekBottom', 'saltFlat'],
    mesh: { shape: 'bush', color: 0x3f5a2c, baseY: 0.45 },
  },
  {
    id: 'fallenLog',
    kind: 'log',
    name: 'Fallen Log',
    description: 'A plain fallen log, lighter than downed oak — framing wood, not structure.',
    harvestable: true,
    primaryYield: 'SNAP_WOOD',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['mirewood', 'oldfieldRise', 'tanglewood', 'deepBog', 'creekBottom', 'saltFlat'],
    mesh: { shape: 'log', color: 0x5a4028, baseY: 0.24 },
  },
  {
    id: 'bogPatch',
    kind: 'bogPatch',
    name: 'Bog Patch',
    description:
      'Dark peaty ground, not a harvestable object. Bog growth (bogGrowth) ' +
      'grows on and around it; peat moss is harvested from the moss carpet.',
    harvestable: false,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['mirewood', 'deepBog', 'creekBottom', 'oldfieldRise'],
    mesh: { shape: 'disc', color: 0x241d16, baseY: 0 },
  },
  {
    id: 'standingWater',
    kind: 'standingWater',
    name: 'Standing Water',
    description:
      'Shallow standing water — ground character, not a source. Silt and ' +
      'stones are harvested at creek beds, not from open water.',
    harvestable: false,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['mirewood', 'deepBog', 'creekBottom'],
    mesh: { shape: 'disc', color: 0x2a4a5a, baseY: 0 },
  },
  {
    id: 'standingTree',
    kind: 'tree',
    name: 'Standing Tree',
    description:
      'A standing tree. Its snapped lower limbs are snap-wood; felling a ' +
      'whole tree is not part of this source (no such mechanic is invented here).',
    harvestable: true,
    primaryYield: 'SNAP_WOOD',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['mirewood', 'oldfieldRise', 'tanglewood'],
    mesh: { shape: 'tree', color: 0x4a2e18, extraColor: 0x2f4a26, baseY: 0.8, extraY: 2.4 },
  },
  {
    id: 'snapwoodThicket',
    kind: 'snapWood',
    name: 'Snap-Wood Thicket',
    description: 'Brittle dead branches and framing wood throughout the silt.',
    harvestable: true,
    primaryYield: 'SNAP_WOOD',
    secondaryYields: [SPORES_25],
    provenance: 'prototype',
    biomes: ['mirewood', 'oldfieldRise', 'tanglewood', 'deepBog', 'creekBottom', 'saltFlat'],
    mesh: { shape: 'stick', color: 0x7a5a34, baseY: 0.55 },
  },
  {
    id: 'tenderVineStrands',
    kind: 'tenderVines',
    name: 'Tender-Vine Strands',
    description: 'Primary binding and lashing for all structural work.',
    harvestable: true,
    primaryYield: 'TENDER_VINES',
    secondaryYields: [SPORES_25],
    multiStep: {
      action: 'TUG',
      step: 0.5,
      struggleMessage: 'You tug against the stubborn fibers... They groan but hold.',
      successMessage: 'The vines finally snap free.',
    },
    provenance: 'prototype',
    biomes: ['mirewood', 'tanglewood', 'creekBottom', 'oldfieldRise', 'deepBog', 'saltFlat'],
    mesh: { shape: 'vine', color: 0x6a8a3a, baseY: 0.5 },
  },
  {
    id: 'peatMossCarpet',
    kind: 'peatMoss',
    name: 'Peat Moss Carpet',
    description: 'Spongy insulation and flooring that drinks up dampness.',
    harvestable: true,
    primaryYield: 'PEAT_MOSS',
    secondaryYields: [SPORES_25],
    provenance: 'prototype',
    biomes: ['deepBog', 'mirewood', 'creekBottom', 'oldfieldRise', 'tanglewood', 'saltFlat'],
    mesh: { shape: 'disc', color: 0x4a6b2f, baseY: 0 },
  },
  {
    id: 'siltBed',
    kind: 'riverSilt',
    name: 'Silt Bed',
    description:
      'Fine mineral particles gathered from the creek bed. Useful as a binder. ' +
      'Silt ground also yields clay through the NORMAL harvest interaction ' +
      '(Adam, 2026-10-26 — no separate dig verb): trowel 1 (+chance 1), ' +
      'spade / axe-trowel 2 (+chance 1), spade-axe 3 (+chance 1), ' +
      'trundle-tool 4 (+chance 1); the bonus chance is 25% at every ' +
      'tier (CLAY_BONUS_CHANCE, starting value). Silt ground is the ' +
      'ONLY source that yields clay.',
    harvestable: true,
    primaryYield: 'RIVER_SLUDGE',
    secondaryYields: [
      {
        item: 'BONE',
        chance: 0.15,
        message: 'Your fingers brush against a calcified fragment in the silt.',
      },
    ],
    toolGatedYields: [
      {
        item: 'CLAY',
        requiresTool: 'trowel',
        tierGroups: CLAY_TOOL_TIER_GROUPS,
        yieldByTierGroup: CLAY_YIELD_BY_TIER_GROUP,
      },
    ],
    provenance: 'prototype',
    biomes: ['creekBottom', 'mirewood', 'deepBog', 'oldfieldRise', 'saltFlat'],
    mesh: { shape: 'disc', color: 0x6b5b43, baseY: 0 },
  },
  {
    id: 'stoneCluster',
    kind: 'riverStone',
    name: 'River Stone Cluster',
    description:
      'Smooth basalt shaped by moving water. Useful for grinding or weighing — ' +
      'and river stone is the pinned whetstone (kept, no loss) for sharpening.',
    harvestable: true,
    primaryYield: 'RIVER_STONE',
    secondaryYields: [
      {
        item: 'BONE',
        chance: 0.05,
        message: 'A calcified fragment is embedded in the stone.',
      },
    ],
    provenance: 'prototype',
    biomes: ['creekBottom', 'oldfieldRise', 'saltFlat', 'mirewood', 'deepBog', 'tanglewood'],
    mesh: { shape: 'stone', color: 0x8a8a86, baseY: 0.15 },
  },
  {
    id: 'boneScatter',
    kind: 'bone',
    name: 'Bone Scatter',
    description:
      'Bleached remains found deep within the silt. Exceptionally hard — ' +
      'and, per the arc ruling, Primal Bone stays with a reagent hint in its ' +
      'description for when the magic layer opens. Survival first, magic hinted.',
    harvestable: true,
    primaryYield: 'BONE',
    secondaryYields: [],
    provenance: 'prototype',
    biomes: ['saltFlat', 'deepBog', 'creekBottom', 'oldfieldRise', 'mirewood', 'tanglewood'],
    mesh: { shape: 'bone', color: 0xe8e0cc, baseY: 0.08 },
  },
  {
    id: 'saltCrust',
    kind: 'saltCrystal',
    name: 'Salt Crust',
    description: 'Sharp, grey mineral deposits found where moisture has evaporated. High potency.',
    harvestable: true,
    primaryYield: 'SALT_CRYSTAL',
    secondaryYields: [
      {
        item: 'SPORES',
        chance: 0.4,
        message: 'The crystals hum as they crumble, releasing dense spores.',
      },
    ],
    provenance: 'prototype',
    biomes: ['saltFlat', 'oldfieldRise'],
    mesh: { shape: 'crystal', color: 0xd8e8e8, baseY: 0.2 },
  },
  {
    id: 'downedOakLog',
    kind: 'downedOak',
    name: 'Downed Oak',
    description: 'Heavy structural logs that form the skeleton of true shelters. Hard to process.',
    harvestable: true,
    primaryYield: 'DOWNED_OAK',
    secondaryYields: [
      {
        item: 'SPORES',
        chance: 0.25,
        message: 'A cloud of luminescent spores clings to your sleeves.',
      },
      {
        item: 'DRY_KINDLING',
        chance: 0.2,
        message: 'You recover some dry splinters from the core.',
      },
    ],
    multiStep: {
      action: 'STOMP',
      step: 0.34,
      struggleMessage: 'Stomping down on the heavy oak. Your legs ache as the wood splinters slowly.',
      successMessage: 'The heavy log yields a structural piece.',
    },
    provenance: 'prototype',
    biomes: ['tanglewood', 'mirewood', 'oldfieldRise', 'saltFlat'],
    mesh: { shape: 'oakLog', color: 0x3a2818, baseY: 0.38 },
  },
  {
    id: 'oldStump',
    kind: 'stump',
    name: 'Old Stump',
    description:
      'A solid, ancient anchor in the earth. Serves as a reliable workstation ' +
      '(prototype STUMP, isWorkstation) — it is an anchor to upgrade into a ' +
      'workstation, not a consumable harvest. Later wiring must not consume it.',
    harvestable: true,
    primaryYield: 'STUMP',
    secondaryYields: [],
    provenance: 'prototype',
    biomes: ['oldfieldRise', 'mirewood', 'tanglewood', 'deepBog'],
    mesh: { shape: 'stump', color: 0x5a4028, extraColor: 0x8a6a44, baseY: 0.3, extraY: 0.6 },
  },
  {
    id: 'reedBed',
    kind: 'reed',
    name: 'Reed Bed',
    description:
      'Tall reeds of the marsh and creek edge — the marsh\'s harvestable fiber. ' +
      'Reeds bind like vines; the yield maps to the existing fiber item.',
    harvestable: true,
    primaryYield: 'TENDER_VINES',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom', 'mirewood'],
    marsh: true,
    mesh: { shape: 'reed', color: 0x8a8a4a, extraColor: 0x6a5a2a, baseY: 0.65, extraY: 1.3 },
  },
  {
    id: 'marshGrassTuft',
    kind: 'marshGrass',
    name: 'Marsh Grass',
    description:
      'Grassy marsh ground cover — the reedy, grassy face of marsh character. ' +
      'Scenery/ground cover, not a harvest source; the marsh harvest is the reed bed.',
    harvestable: false,
    secondaryYields: [],
    provenance: 'draft',
    biomes: [],
    marsh: true,
    mesh: { shape: 'grassTuft', color: 0x6a7048, baseY: 0.3 },
  },
  {
    id: 'bogGrowthTuft',
    kind: 'bogGrowth',
    name: 'Bog Growth',
    description:
      'Tufty bog plants crowning a bog patch — the living face of the bog, ' +
      'distinct from the dark peat ground beneath it. Yields peat moss.',
    harvestable: true,
    primaryYield: 'PEAT_MOSS',
    secondaryYields: [SPORES_25],
    provenance: 'draft',
    biomes: ['deepBog', 'mirewood', 'tanglewood', 'creekBottom'],
    mesh: { shape: 'bogTuft', color: 0x3a5a2a, baseY: 0.25 },
  },
];

export const SOURCE_BY_ID: Record<string, HarvestSourceDef> = Object.fromEntries(
  SOURCES.map((s) => [s.id, s]),
);

export const SOURCE_FOR_KIND: Record<ScatterKind, HarvestSourceDef> =
  Object.fromEntries(SOURCES.map((s) => [s.kind, s])) as Record<
    ScatterKind,
    HarvestSourceDef
  >;

/** Every harvestable source's primary yield, for Systems-lane checks. */
export function harvestableSources(): HarvestSourceDef[] {
  return SOURCES.filter((s) => s.harvestable);
}
