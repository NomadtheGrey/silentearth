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
 * - Yields use ONLY the existing item vocabulary in
 *   src/data/world_data.json (SNAP_WOOD, TENDER_VINES, PEAT_MOSS,
 *   RIVER_SLUDGE, RIVER_STONE, BONE, SALT_CRYSTAL, DOWNED_OAK, SPORES,
 *   DRY_KINDLING, STUMP). No new items are introduced.
 * - Secondary drops and multi-step harvest shapes marked `prototype` are
 *   carried verbatim from world_data.json (its harvestAction /
 *   harvestStep / secondaryDrops), NOT pinned by Adam and NOT re-balanced.
 * - Mappings marked `draft` are new source->yield mappings this landing
 *   had to choose so every source yields something sensible; they are
 *   draft, not prototype-carried and not pinned, and Adam's pin pass can
 *   change them without touching any system.
 * - Clay is deliberately ABSENT: clay is tool-gated digging from silt
 *   ground (per the 2026-10-25 rulings), never a harvest yield.
 * - No quantities are invented: the prototype carries no per-harvest
 *   amounts, so sources carry item ids + secondary chances only. Amounts
 *   belong to the later harvest system / balancing pass, not here.
 */

import type { BiomeId, ScatterKind } from '../types';

/** Item ids from src/data/world_data.json (the only allowed yields). */
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
  | 'STUMP';

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
    description: 'Fine mineral particles gathered from the creek bed. Useful as a binder.',
    harvestable: true,
    primaryYield: 'RIVER_SLUDGE',
    secondaryYields: [
      {
        item: 'BONE',
        chance: 0.15,
        message: 'Your fingers brush against a calcified fragment in the silt.',
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
