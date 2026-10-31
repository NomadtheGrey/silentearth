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
 * - GENERAL HARVEST RULE (Adam, 2026-10-26): every harvest follows
 *   clay's shape (base + 25% chance of +1, rising per harvest stage)
 *   plus a permit tier (hard gate, yield 0 below it, progression
 *   starting at 1 + 25% at the permit). See HARVEST_STAGES /
 *   harvestYieldForTool below.
 * - STATUS MARKING (do not blur): Adam-pinned = the pattern itself,
 *   the clay table, and clay's trowel permit. LANE-DECIDED (this lane,
 *   2026-10-26, Adam's pin pass still applies) = every other source's
 *   permit tier and amounts below. TBD = anything genuinely unsettled
 *   (none left for permits after this landing; per-harvestable bonus
 *   overrides are still open, defaulting to 25%).
 * - LANE-DECIDED PERMITS (2026-10-26, rationale in brief): better
 *   tools make acquisition EASIER — less waste, more complete
 *   gathering — never magic creation. Amounts are what she RECOVERS
 *   from a source, never more than the source holds; the later system
 *   must deplete the source accordingly. Conversion (e.g. logs →
 *   lumber) is Systems' business and must never magically reduce
 *   what was provided — no conversion rule is set here.
 *   HAND (no tool needed — hand stage, below trowel): brush, fallen
 *   log, standing tree (snapped limbs only, no felling), snap-wood
 *   thicket, tender-vine strands (prototype TUG by hand), peat moss
 *   carpet, silt bed PRIMARY ONLY (silt scooped by hand; its clay
 *   still needs the trowel — see below), river stone cluster, bone
 *   scatter (surface fragments; rarity comes from sparse spawn, not
 *   a gate, and bone already reaches her as a silt/stone secondary),
 *   salt crust, reed bed, bog growth. Hand is forced for the first
 *   three by the game itself: the first trowel costs snap-wood +
 *   cordage (from vines) + river stone, so gating any of those behind
 *   the trowel would make the first tool uncraftable.
 *   SPADE-AXE (the one gated source): downed oak. Heavy structural
 *   wood for true shelters (wattle hut onward, all mid-game), and a
 *   route-symmetric gate: an axe-trowel-only gate would lock out
 *   spade-route players until convergence, and vice versa. Below
 *   spade-axe oak yields 0; at spade-axe 1 + 25% →2; trundle 2 + 25% →3
 *   (hauling heavy logs is exactly what the wheeled tool is for).
 *   STUMP: claiming needs no tool (permit 'hand'), but it is an
 *   ANCHOR, not a counted harvest — the amount pattern does not apply
 *   to it (see anchor flag); moving it still needs the trundle-tool
 *   per the dolly rule.
 *   SILT CLARIFICATION (lane-decided, clay untouched): siltBed's
 *   permitTier was 'trowel' in the last landing because that field
 *   then described only clay. It now describes the PRIMARY yield, so
 *   it is 'hand' for silt itself; clay's trowel gate lives separately
 *   in toolGatedYields (requiresTool: 'trowel') and is unchanged.
 *   A silt-bed harvest therefore yields silt (general pattern) AND
 *   clay (clay table) when she holds the trowel — two yields from one
 *   ground, as the silt rulings have always said.
 * - No other quantities are invented: the prototype carries no
 *   per-harvest amounts, so other sources carry item ids + secondary
 *   chances only. Amounts belong to the later harvest system /
 *   balancing pass, not here.
 */

import type { BiomeId, ScatterKind } from '../types';

/** Item ids: src/data/world_data.json, plus CLAY (see header note) and
 *  the Adam-named ground materials DIRT / MUD / GRASS (2026-10-26:
 *  she can harvest nearly anyplace, even just dirt, mud, grass — the
 *  materials ARE the harvest, not a mapping onto an older item).
 *  Their uses (thatch, daub, etc.) are Systems' business, not set here. */
export type ItemId =
  | 'SNAP_WOOD'
  | 'TENDER_VINES'
  | 'PEAT_MOSS'
  | 'RIVER_SLUDGE'
  | 'RIVER_STONE'
  | 'FLINT'
  | 'BONE'
  | 'SALT_CRYSTAL'
  | 'DOWNED_OAK'
  | 'SPORES'
  | 'DRY_KINDLING'
  | 'STUMP'
  | 'CLAY'
  | 'DIRT'
  | 'MUD'
  | 'GRASS'
  | 'ACORNS'
  | 'BOG_BERRIES'
  | 'ELDERBERRIES'
  | 'EDIBLE_MUSHROOM'
  | 'POISON_MUSHROOM'
  | 'APPLE'
  /**
   * Flower item ids (Background flowers landing, 2026-10-28):
   * KEBAB strings, verbatim from Systems' approved list — the
   * single shared list both halves key on. The union mixes cases
   * BY DESIGN: do not "fix" these to UPPER_SNAKE, or Systems'
   * ITEMS keys and these primaryYield values stop matching.
   */
  | 'white-yarrow'
  | 'gold-coneflower'
  | 'purple-clover'
  | 'yellow-dandelion'
  | 'pink-milkweed'
  | 'red-poppy'
  | 'tall-sunflower'
  | 'blue-aster'
  | 'white-trillium'
  | 'wood-violet'
  | 'creek-iris'
  | 'white-water-lily'
  | 'meadow-flower';

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
 * GENERAL HARVEST RULE (Adam, 2026-10-26 — extends the clay table to
 * all harvests). Every harvest follows the same shape as clay: a base
 * amount + a chance of a +1 bonus, rising per tool stage — plus a
 * PERMIT TIER, the lowest tool stage that permits harvesting at all:
 * - Below the permit tier: cannot harvest, yield 0. Hard gate, not a
 *   low yield.
 * - At the permit tier: base 1 + bonus chance of +1 (→2). This is the
 *   START of that harvestable's progression, whatever stage the permit
 *   sits at.
 * - Each tool stage above the permit: base rises by 1 (2 + chance →3,
 *   then 3 + chance →4, etc.).
 * - Bonus chance: 25% as the standing default (clay's number), uniform
 *   across stages, unless a harvestable is later given its own number.
 *
 * HARVEST STAGES (one model for clay and for everything else): sharp
 * trowel is a SHARPENING of the trowel stage, not a separate harvest
 * stage — so trowel and sharp trowel share stage 0. This is what makes
 * the general rule reproduce clay's pinned table exactly (permit stage
 * 0 → trowel 1, spade stage 1 → 2, spade-axe stage 2 → 3, trundle stage
 * 3 → 4). Counting sharp as its own stage would wrongly give spade
 * base 3 above a trowel permit. Spade and axe-trowel share a stage
 * because they are alternative routes to the same convergence.
 */
export const HARVEST_STAGES: ToolTier[][] = [
  ['trowel', 'sharpTrowel'],
  ['spade', 'axeTrowel'],
  ['spadeAxe'],
  ['trundleTool'],
];

/**
 * Axe family (Adam, 2026-10-26, downed-oak override): axe-trowel
 * and its descendants. Spade and axe-trowel share stage 1, so
 * stage rank alone cannot gate axe work — a spade is not an axe.
 */
export const AXE_FAMILY_TIERS: ToolTier[] = ['axeTrowel', 'spadeAxe', 'trundleTool'];

/** Harvest stage of a tool, or -1 when she has no tool at all.
 *  Pure ordering data, not a harvest system. */
export function harvestStageRank(tier: ToolTier | null): number {
  if (!tier) return -1;
  return HARVEST_STAGES.findIndex((stage) => stage.includes(tier));
}

/**
 * Standing default bonus chance for the +1 harvest bonus (Adam's clay
 * number, 2026-10-26): 25%, uniform across stages. A harvestable may
 * later be given its own number; until then this is the number.
 */
export const HARVEST_BONUS_CHANCE = 0.25; // Same value as CLAY_BONUS_CHANCE, by design.

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
 * Clay yield per harvest stage, in HARVEST_STAGES order (Adam,
 * 2026-10-26): base rises by 1 per stage, +1 bonus on top at every
 * stage. Sharp trowel shares the trowel stage, so it holds the trowel
 * amount (base 1) pending Adam's word — see the header note.
 */
export const CLAY_YIELD_BY_STAGE: ClayYieldTier[] = [
  { base: 1, bonus: 1, bonusChance: CLAY_BONUS_CHANCE },
  { base: 2, bonus: 1, bonusChance: CLAY_BONUS_CHANCE },
  { base: 3, bonus: 1, bonusChance: CLAY_BONUS_CHANCE },
  { base: 4, bonus: 1, bonusChance: CLAY_BONUS_CHANCE },
];

/** Clay yield for a tool, or null when she has no tool (no clay yield).
 *  Pure lookup data, not a harvest system. This is the general rule
 *  applied with permit stage 0 (trowel); see harvestYieldForTool. */
export function clayYieldForTool(tier: ToolTier | null): ClayYieldTier | null {
  const stage = harvestStageRank(tier);
  if (stage < 0) return null;
  return CLAY_YIELD_BY_STAGE[stage];
}

/**
 * A tool-gated yield: present only when she holds at least the required
 * tool, and scaled upward along the harvest stages via yieldByStage.
 */
export interface ToolGatedYield {
  item: ItemId;
  requiresTool: ToolTier;
  stages: ToolTier[][];
  yieldByStage: ClayYieldTier[];
}

/**
 * Permit tier for a harvest source: the lowest tool tier that permits
 * harvesting it at all. 'hand' = no tool needed (the hand stage, below
 * trowel — see harvestStageRank: a null tool counts as the hand stage,
 * so a hand-permitted source yields at base 1 with no tool, and rises
 * with better tools). 'TBD' remains available for any future source
 * whose gate Adam has not named; after the 2026-10-26 lane decisions
 * no current source is left at 'TBD'. (Clay's gate is separate:
 * toolGatedYields requiresTool 'trowel', Adam-pinned.)
 */
export type PermitTier = 'hand' | ToolTier | 'TBD';

/** Outcome of the general harvest pattern for one source + tool. */
export type HarvestYieldOutcome =
  | { permitted: true; base: number; bonus: number; bonusChance: number }
  | {
      permitted: false;
      reason: 'not-harvestable' | 'below-permit' | 'permit-tbd' | 'anchor';
    };

/**
 * The general harvest pattern (Adam, 2026-10-26) for a source's PRIMARY
 * yield amount. Secondary drops keep their prototype chances and are
 * NOT scaled by this function; multi-step shapes (TUG, STOMP) are
 * unchanged — this governs the amount once the harvest succeeds.
 * Pure lookup data, not a harvest system: it does not roll the bonus,
 * prompt, or change inventory — the later harvest system does that,
 * using these numbers.
 */
/**
 * The harvestable shape harvestYieldForTool accepts: a scatter source
 * (HarvestSourceDef) OR a ground material (GroundMaterialDef). Ground
 * materials are always harvestable and never anchors, so they satisfy
 * this shape with harvestable true and anchor omitted.
 */
export type HarvestableSource = Pick<
  HarvestSourceDef,
  'harvestable' | 'permitTier' | 'permitFamily' | 'bonusChance' | 'anchor' | 'fixedYield'
>;

export function harvestYieldForTool(
  source: HarvestableSource,
  tier: ToolTier | null,
): HarvestYieldOutcome {
  if (!source.harvestable || source.permitTier === null) {
    return { permitted: false, reason: 'not-harvestable' };
  }
  if (source.anchor) {
    // A unique world anchor (the stump) is claimed, not counted: the
    // amount pattern must never be applied to it, whatever its permit.
    return { permitted: false, reason: 'anchor' };
  }
  if (source.permitTier === 'TBD') {
    return { permitted: false, reason: 'permit-tbd' };
  }
  // 'hand' is the stage below trowel: a null tool IS the hand stage
  // (harvestStageRank(null) = -1), so hand-permitted sources yield at
  // base 1 with no tool and rise with better tools.
  const permitStage =
    source.permitTier === 'hand' ? -1 : harvestStageRank(source.permitTier);
  const stage = harvestStageRank(tier);
  if (stage < permitStage) {
    return { permitted: false, reason: 'below-permit' };
  }
  // Branch gate (Adam, 2026-10-26): when a source names a permit
  // family, the tool must belong to it IN ADDITION to meeting the
  // stage rank. Rank alone would let a spade (stage 1) take
  // axe-family work (stage 1 permit) — a spade is not an axe.
  if (source.permitFamily === 'axe' && (tier === null || !AXE_FAMILY_TIERS.includes(tier))) {
    return { permitted: false, reason: 'below-permit' };
  }
  // Fixed yield (Adam 2026-10-28): bone, flint, and river-stone
  // primaries grant exactly 1 at any tool — no tier scaling, no
  // bonus roll. Both guards (bonus 0 AND chance 0) so every call
  // site's base + (rng < chance ? bonus : 0) formula yields 1.
  // Gates above are unchanged and still apply first.
  if (source.fixedYield) {
    return { permitted: true, base: 1, bonus: 0, bonusChance: 0 };
  }
  return {
    permitted: true,
    base: 1 + (stage - permitStage),
    bonus: 1,
    bonusChance: source.bonusChance ?? HARVEST_BONUS_CHANCE,
  };
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
  | 'bone'
  | 'flower'
  | 'flowerDisc'
  | 'flowerCone'
  | 'flowerCup'
  | 'flowerTallDisc'
  | 'flowerTrillium'
  | 'flowerPouch'
  | 'flowerIris'
  | 'flowerPad'
  | 'tallTree'
  | 'mushroom'
  | 'acornCluster'
  | 'appleTree'
  | 'beehive';

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
  /**
   * Permit tier (general harvest rule, Adam 2026-10-26): the lowest tool
   * tier that permits harvesting this source at all. 'hand' = no tool
   * needed. 'TBD' = gate not named (none left after the 2026-10-26
   * lane decisions). null = not a harvestable source (ground
   * character). Adam-pinned: clay's trowel gate only (in
   * toolGatedYields, not here). Lane-decided: every other permit.
   */
  permitTier: PermitTier | null;
  /**
   * Branch gate (Adam, 2026-10-26, downed-oak override): when set,
   * the tool must belong to this family in addition to meeting the
   * permit stage rank. Needed because spade and axe-trowel share
   * stage 1 — rank alone cannot express "an axe". Only 'axe'
   * exists today (axe-trowel + spade-axe + trundle-tool).
   */
  permitFamily?: 'axe';
  /**
   * True only for a unique world anchor (the stump): it is claimed as
   * a workstation, not counted as a harvest amount. harvestYieldForTool
   * refuses anchors outright, so no system can stack them.
   */
  anchor?: boolean;
  /**
   * Bonus chance for this source's primary-yield +1 bonus. Omitted
   * means the standing default HARVEST_BONUS_CHANCE (0.25); a source
   * may later be given its own number by Adam.
   */
  bonusChance?: number;
  /**
   * Fixed yield (Adam 2026-10-28, PINNED for bone/flint/river-stone):
   * the primary grants exactly 1 at any tool — no tier scaling, no
   * bonus roll. harvestYieldForTool returns { base 1, bonus 0,
   * bonusChance 0 } for marked sources, after the permit/anchor/
   * family gates (gates unchanged). OPTIONAL by design: the ground
   * synthetic literal omits it. Silt is NOT marked (its primary +
   * gated clay keep scaling); no other source carries this flag.
   */
  fixedYield?: boolean;
  /** Primary yield, when harvestable. */
  primaryYield?: ItemId;
  /**
   * Bee-forage tier (Background flowers landing, 2026-10-28):
   * a beehive parameter, DATA ONLY in v1 — the beehive branch
   * interprets these tiers later. Words are the brainstorm doc's
   * own: 'high' / 'low' plain tiers, 'early' / 'late' seasonal
   * (their semantics need the season axis, still open),
   * 'forage' plain. Absent = no forage value (not bee food).
   */
  beeForage?: 'high' | 'low' | 'early' | 'late' | 'forage';
  /** Prototype-carried secondary yields (empty when the prototype had none). */
  secondaryYields: SecondaryYield[];
  /** Tool-gated yields (clay on silt ground only, per the 2026-10-26
   *  ruling). Absent on every other source. */
  toolGatedYields?: ToolGatedYield[];
  /** Prototype-carried multi-step shape, when the prototype had one. */
  multiStep?: MultiStep;
  /**
   * What happens to the object AFTER a successful harvest (Adam,
   * 2026-10-26): 'shrink' (default) = it shrinks and regrows for
   * more harvesting; 'spawn-near-trees' = logs only — the log is
   * taken and a fresh log spawns near trees over time. Ground
   * never uses this (it never depletes). 'taken' (flint stones,
   * Adam 2026-10-27) = a single pickup, gone from that spot for
   * good with no respawn scheduled — stones do not regrow.
   */
  renewal?: 'shrink' | 'spawn-near-trees' | 'taken';
  /**
   * Remove action (Adam, 2026-10-26): may this source be TOTALLY
   * removed for a bigger one-time yield (clearing ground for a
   * house)? Plant-like sources only. Logs are never removable
   * (harvest already takes them, and their renewal is the spawn
   * system); stones, bone, salt, and silt are not plants either.
   */
  removable?: boolean;
  /**
   * Tree lifecycle (Adam, 2026-10-26, PINNED): when true, a
   * successful harvest FELLS the tree (it becomes a stump, and a
   * sapling grows nearby) instead of the general shrink rule.
   * Only standing trees set this.
   */
  fellOnHarvest?: boolean;
  /**
   * Hunger exemption (Adam, 2026-10-26 — weather + hunger build):
   * when true, this source may still be harvested at the
   * too-hungry ('too-hungry') stage, when all other harvests lock
   * out. Set exactly on the sources yielding the exemption foods
   * (ACORNS, BOG_BERRIES, ELDERBERRIES — see hunger.ts). The
   * exemption covers the whole source harvest, both actions
   * (harvest and remove): a too-hungry witch gathering berries
   * keeps the wood she gathered alongside them.
   */
  hungerExempt?: boolean;
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

/**
 * Nuts/berries secondaries (Adam, 2026-10-26 — weather + hunger
 * build; bog berries ride bog growth, elderberries ride brush.
 * Acorns USED to ride downed oak the same way; Adam 2026-10-26
 * overrode that — acorns are HAND PICKUP from their own ground
 * source now (groundAcorns), so no ACORNS secondary remains here.
 * Chances are LANE-DECIDED starting values (Adam's pin pass still
 * applies) — generous on purpose, so a too-hungry witch can
 * actually recover.
 */

/**
 * The oak's fell companion (Adam, 2026-10-30): a felled
 * standing oak yields its snap-wood PLUS one Downed Oak
 * — the structural piece the hut recipes already
 * consume. Chance 1 = every fell (quantity DRAFT for
 * the pin pass). The REMOVE action grants secondaries
 * outright, so a removed oak yields it too, exactly as
 * the common tree's def shape would.
 */
const DOWNED_OAK_ALWAYS: SecondaryYield = {
  item: 'DOWNED_OAK',
  chance: 1,
  message: 'A sound oak length comes down with it — a Downed Oak piece.',
};

const BOG_BERRIES_50: SecondaryYield = {
  item: 'BOG_BERRIES',
  chance: 0.5,
  message: 'Dark bog berries among the tufts — tart, but food.',
};

const ELDERBERRIES_50: SecondaryYield = {
  item: 'ELDERBERRIES',
  chance: 0.5,
  message: 'Elderberries hang among the brush — berries for the hungry.',
};

export const SOURCES: HarvestSourceDef[] = [
  {
    id: 'bush',
    kind: 'bush',
    name: 'Brush',
    description:
      'Low brush and saplings — young, brittle growth that snaps for framing. ' +
      'Elderberries hang among it (hunger-exempt food, Adam 2026-10-26).',
    harvestable: true,
    removable: true,
    permitTier: 'hand',
    hungerExempt: true,
    primaryYield: 'SNAP_WOOD',
    secondaryYields: [SPORES_25, ELDERBERRIES_50],
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
    permitTier: 'hand',
    renewal: 'spawn-near-trees',
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
    permitTier: null,
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
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['mirewood', 'deepBog', 'creekBottom'],
    mesh: { shape: 'disc', color: 0x2a4a5a, baseY: 0 },
  },
  {
    id: 'pond',
    kind: 'pond',
    name: 'Pond',
    description:
      'A standing body of water in wet low ground — ground character, ' +
      'not a source. Bigger than a standing-water pool; no fishing, ' +
      'swimming, or water harvest here (visibility only, Adam 2026-10-27).',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['mirewood', 'deepBog', 'creekBottom'],
    mesh: { shape: 'disc', color: 0x2f5a6e, baseY: 0 },
  },
  {
    id: 'standingTree',
    kind: 'tree',
    name: 'Standing Tree',
    description:
      'A standing tree, harvested DIRECTLY with the axe-trowel (Adam, ' +
      '2026-10-26, PINNED permit: axe-trowel, stage 1). Yield maps to ' +
      'the existing wood vocabulary (SNAP_WOOD, wood for fire/building) ' +
      '— no new log item is invented here; if Adam wants whole-tree ' +
      'yields to differ from limb wood, that is a new item for him to ' +
      'name. TREE LIFECYCLE (Adam, 2026-10-26, PINNED — fell, not ' +
      'shrink): a harvested tree is FELLED — it becomes a stump ' +
      '(a workstation anchor like any other stump, same reading as ' +
      'Adam\'s parenthetical), and a sapling grows into a new tree ' +
      'in a nearby clear spot over time. The remove action on a ' +
      'tree is different: total removal, NO stump, and the ground ' +
      'stays cleared (no saplings return there) — the house-plot case.',
    harvestable: true,
    permitTier: 'axeTrowel',
    permitFamily: 'axe',
    removable: true,
    fellOnHarvest: true,
    primaryYield: 'SNAP_WOOD',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['mirewood', 'oldfieldRise', 'tanglewood'],
    mesh: { shape: 'tree', color: 0x4a2e18, extraColor: 0x2f4a26, baseY: 0.8, extraY: 2.4 },
  },
  {
    id: 'standingOak',
    kind: 'oakTree',
    name: 'Standing Oak',
    description:
      'An oak among the standing trees (Adam, 2026-10-30 — tree ' +
      'kinds: which trees are oaks is a fact of the spot they grow ' +
      'on, read off the world seed). Broader in the canopy than ' +
      'the common run, and heavier coming down: felled, it yields ' +
      'its snap-wood plus a Downed Oak piece. Same lifecycle as ' +
      'any standing tree otherwise — fell leaves a stump and a ' +
      'sapling rises nearby; remove clears the ground for good. ' +
      'No new log item comes from it; the Downed Oak is the ' +
      'existing structural piece.',
    harvestable: true,
    permitTier: 'axeTrowel',
    permitFamily: 'axe',
    removable: true,
    fellOnHarvest: true,
    primaryYield: 'SNAP_WOOD',
    secondaryYields: [DOWNED_OAK_ALWAYS],
    provenance: 'draft',
    biomes: ['mirewood', 'oldfieldRise', 'tanglewood'],
    mesh: { shape: 'tree', color: 0x4a2e18, extraColor: 0x476b2a, baseY: 0.8, extraY: 2.4 },
  },
  {
    id: 'groveOak',
    kind: 'groveOak',
    name: 'Grove Tree',
    description:
      'One of the Grove\'s old trees (Adam, 2026-10-30 — the site ' +
      'system, sites.ts): older and broader than any wild oak, and ' +
      'PROTECTED — she will not cut them; the refusal is hers, ' +
      'in-fiction, enforced as a backstop in harvest.ts (the ' +
      'surface is a name tag with no pill). In every mechanical ' +
      'respect it is a real tree — the place, not the wood, is ' +
      'what refuses.',
    harvestable: true,
    permitTier: 'axeTrowel',
    permitFamily: 'axe',
    removable: true,
    fellOnHarvest: true,
    primaryYield: 'SNAP_WOOD',
    secondaryYields: [DOWNED_OAK_ALWAYS],
    provenance: 'draft',
    biomes: ['forest', 'tanglewood', 'oldfieldRise'],
    mesh: { shape: 'tree', color: 0x453324, extraColor: 0x55663c, baseY: 0.8, extraY: 2.4 },
  },
  {
    id: 'standingStone',
    kind: 'standingStone',
    name: 'Standing Stone',
    description:
      'A weathered slab of the Grove\'s ring (Adam, 2026-10-30). ' +
      'Scenery, never a source: a mineable monument is a deleted ' +
      'monument. The ring marks the place; it does not wall it.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['forest', 'tanglewood', 'oldfieldRise'],
    mesh: { shape: 'stone', color: 0x8a8d90, baseY: 1.0 },
  },
  {
    id: 'carvedStone',
    kind: 'carvedStone',
    name: 'Carved Stone',
    description:
      'A shorter slab deep in the Grove maze, its face turned to ' +
      'the path (Adam, 2026-10-30). Scenery in this landing: the ' +
      'carving it will carry — the fragment site — stages with ' +
      'the marks system.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['forest', 'tanglewood', 'oldfieldRise'],
    mesh: { shape: 'stone', color: 0x97928a, extraColor: 0xcfc7b4, baseY: 0.75 },
  },
  {
    id: 'hedgeWall',
    kind: 'hedgeWall',
    name: 'Hedgerow',
    description:
      'A dense old hedgerow walling the Grove maze (Adam, ' +
      '2026-10-30). Scenery — and the game\'s first collider: ' +
      'its wall boxes live in sites.ts and the player resolves ' +
      'against them near the grove. Never a harvest target.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['forest', 'tanglewood', 'oldfieldRise'],
    mesh: { shape: 'bush', color: 0x2e4a22, extraColor: 0x3d5c2a, baseY: 1.1 },
  },
  {
    id: 'hoardMound',
    kind: 'hoardMound',
    name: "Crow's Hoard",
    description:
      'A low mound of gathered things at the Grove maze\'s heart ' +
      '(Adam, 2026-10-30). Scenery in this landing: what the crow ' +
      'has stockpiled here — the first charm among it — stages ' +
      'with its own systems.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['forest', 'tanglewood', 'oldfieldRise'],
    mesh: { shape: 'disc', color: 0x5a4632, extraColor: 0x8a8d90, baseY: 0.5 },
  },
  // The Schoolhouse set (sites landing #2, 2026-10-30): the
  // ruined school's standing fabric. ALL non-harvestable
  // scenery, like the grove's stones — nobody mines a ruin for
  // parts; these exist only as site features (sites.ts emits
  // them; their `biomes` lists name the ground the schoolhouse
  // sites on and never drive scatter). The schoolDesk shares
  // its kind between the item-shaped desk rows only — the
  // writing desk is a different, placed thing entirely.
  {
    id: 'ruinWall',
    kind: 'ruinWall',
    name: 'Ruined Wall',
    description:
      'A standing stretch of the schoolhouse wall (Adam, ' +
      '2026-10-30). Roofless ruin scenery; solid — she enters ' +
      'through the door gap.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x8a8578, extraColor: 0x6e6a5e, baseY: 1.3 },
  },
  {
    id: 'ruinWallStub',
    kind: 'ruinWallStub',
    name: 'Broken Wall',
    description:
      'A schoolhouse wall segment broken down to a stub (Adam, ' +
      '2026-10-30). Still solid — broken is not gone.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x8a8578, extraColor: 0x6e6a5e, baseY: 0.58 },
  },
  {
    id: 'bellTower',
    kind: 'bellTower',
    name: 'Bell Tower',
    description:
      'The schoolhouse bell tower at the corner (Adam, ' +
      '2026-10-30) — the place\u2019s landmark silhouette. The bell ' +
      'still hangs in its frame.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x8a8578, extraColor: 0x5a4632, baseY: 2.1 },
  },
  {
    id: 'schoolDesk',
    kind: 'schoolDesk',
    name: 'School Desk',
    description:
      'A pupil\u2019s desk, still in its row (Adam, 2026-10-30). ' +
      'Scenery; solid — she walks the aisles.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x7a5c38, extraColor: 0x4a3826, baseY: 0.72 },
  },
  {
    id: 'blackboard',
    kind: 'blackboard',
    name: 'Blackboard',
    description:
      'The blackboard on the teaching wall (Adam, 2026-10-30). ' +
      'Scenery in this landing: what may one day be written on ' +
      'it stages with the marks system.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x7a5c38, extraColor: 0x252b25, baseY: 1.5 },
  },
  {
    id: 'flagpole',
    kind: 'flagpole',
    name: 'Flagpole',
    description:
      'The flagpole by the schoolhouse door (Adam, 2026-10-30), ' +
      'its flag faded to a remnant. Scenery.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x9a9a92, extraColor: 0x9a4a42, baseY: 3.0 },
  },
  {
    id: 'rubble',
    kind: 'rubble',
    name: 'Rubble',
    description:
      'Fallen stone and broken brick along the schoolhouse ' +
      'walls (Adam, 2026-10-30). Low scenery — she steps over it.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x7d7668, extraColor: 0x665f52, baseY: 0.25 },
  },
  // The Burnt Village set (Adam, 2026-10-30 — the smoke
  // avenue's destination; site-pass only, exactly like the
  // schoolhouse set: never in the scatter mix; their `biomes`
  // lists name the village's siting country).
  {
    id: 'villageWall',
    kind: 'villageWall',
    name: 'House Wall',
    description:
      'A standing stretch of a village house wall (Adam, ' +
      '2026-10-30). The houses that kept their walls; solid — ' +
      'she enters through the gap where the door burned away.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'creekBottom'],
    mesh: { shape: 'stone', color: 0x6e5136, extraColor: 0x241a12, baseY: 1.3 },
  },
  {
    id: 'villageWallCharred',
    kind: 'villageWallCharred',
    name: 'Charred Wall',
    description:
      'A village house wall the fire took first (Adam, ' +
      '2026-10-30). Charred through, still standing; solid.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'creekBottom'],
    mesh: { shape: 'stone', color: 0x2e2622, extraColor: 0x17120e, baseY: 1.3 },
  },
  {
    id: 'villageRoof',
    kind: 'villageRoof',
    name: 'House Roof',
    description:
      'A gable roof still on its walls (Adam, 2026-10-30). ' +
      'Only the luckiest houses kept theirs.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'creekBottom'],
    mesh: { shape: 'stone', color: 0x5a4632, extraColor: 0x4a3a28, baseY: 0 },
  },
  {
    id: 'villageRoofFallen',
    kind: 'villageRoofFallen',
    name: 'Fallen Roof',
    description:
      'A roof that fell in when its house burned (Adam, ' +
      '2026-10-30), lying tilted among the walls.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'creekBottom'],
    mesh: { shape: 'stone', color: 0x33291f, extraColor: 0x1f1813, baseY: 0 },
  },
  {
    id: 'villageWell',
    kind: 'villageWell',
    name: 'Village Well',
    description:
      'The well at the village street\u2019s edge (Adam, ' +
      '2026-10-30). Stone ring, two posts, a little roof — ' +
      'the one thing in the village nobody burned. Solid.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'creekBottom'],
    mesh: { shape: 'stone', color: 0x7d7668, extraColor: 0x4a3826, baseY: 0.9 },
  },
  {
    id: 'ashPatch',
    kind: 'ashPatch',
    name: 'Ash',
    description:
      'Ash and cinder ground where the fire passed (Adam, ' +
      '2026-10-30). The street and the houses stand in it.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'creekBottom'],
    mesh: { shape: 'disc', color: 0x9a958c, baseY: 0 },
  },
  // The Farmhouse set (Adam, 2026-10-30 — the Home
  // fragments' home ground; site-pass only, same rule as
  // the sets above).
  {
    id: 'farmWall',
    kind: 'farmWall',
    name: 'Farmhouse Wall',
    description:
      'A standing stretch of the farmhouse wall (Adam, ' +
      '2026-10-30). Weathered boards under a whole roof; ' +
      'solid — she enters through the door, under the porch.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise'],
    mesh: { shape: 'stone', color: 0x7a6248, extraColor: 0x201812, baseY: 1.3 },
  },
  {
    id: 'farmRoof',
    kind: 'farmRoof',
    name: 'Farmhouse Roof',
    description:
      'The farmhouse roof, whole (Adam, 2026-10-30) — the ' +
      'house kept it, which is most of why the house stands.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise'],
    mesh: { shape: 'stone', color: 0x4f4630, extraColor: 0x7d7668, baseY: 0 },
  },
  {
    id: 'farmPorch',
    kind: 'farmPorch',
    name: 'Farmhouse Porch',
    description:
      'The porch over the farmhouse door (Adam, 2026-10-30): ' +
      'two posts, a flat roof, a step stone. Its posts are solid.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise'],
    mesh: { shape: 'stone', color: 0x6e5136, extraColor: 0x59422a, baseY: 1.15 },
  },
  {
    id: 'hearthStone',
    kind: 'hearthStone',
    name: 'Hearth Stone',
    description:
      'A great hewn stone of the farmhouse hearth (Adam, ' +
      '2026-10-30). Home fragments are carried on stones ' +
      'like this one.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise'],
    mesh: { shape: 'stone', color: 0x8a8578, extraColor: 0x6e6a5e, baseY: 0.42 },
  },
  // The Chapel set (Adam, 2026-10-30 — Circle ground;
  // site-pass only, same rule as the sets above).
  {
    id: 'chapelWall',
    kind: 'chapelWall',
    name: 'Chapel Wall',
    description:
      'A standing stretch of the chapel wall (Adam, ' +
      '2026-10-30) — taller than a house wall, with a tall ' +
      'narrow window. Solid; she enters by the door.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x9a927f, extraColor: 0x1c1a24, baseY: 1.7 },
  },
  {
    id: 'chapelRoof',
    kind: 'chapelRoof',
    name: 'Chapel Roof',
    description:
      'The chapel\u2019s steep roof, whole (Adam, 2026-10-30).',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x3f4450, extraColor: 0x59616e, baseY: 0 },
  },
  {
    id: 'steeple',
    kind: 'steeple',
    name: 'Steeple',
    description:
      'The chapel steeple (Adam, 2026-10-30): tower, belfry ' +
      'and spire over the door end — the silhouette she ' +
      'navigates by. Solid at its base.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x8a8578, extraColor: 0x4a4238, baseY: 3.1 },
  },
  {
    id: 'gravestone',
    kind: 'gravestone',
    name: 'Gravestone',
    description:
      'A rounded gravestone in the chapel yard (Adam, ' +
      '2026-10-30). Low — she steps among the dead; the ' +
      'stones do not bar her way.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x8f8b80, extraColor: 0x77736a, baseY: 0.35 },
  },
  {
    id: 'gravestoneCross',
    kind: 'gravestoneCross',
    name: 'Gravestone Cross',
    description:
      'A cross gravestone in the chapel yard (Adam, ' +
      '2026-10-30). Low — she steps among the dead.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x8f8b80, extraColor: 0x77736a, baseY: 0.5 },
  },
  // The Cave Mouth set (Adam, 2026-10-30 — site-pass only,
  // same rule as the sets above).
  {
    id: 'caveMouth',
    kind: 'caveMouth',
    name: 'Cave Mouth',
    description:
      'A dark opening in a rock face (Adam, 2026-10-30). ' +
      'True dark inside; what light she has down there, ' +
      'she carries. Entering is a travel act at its threshold.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['tanglewood', 'forest'],
    mesh: { shape: 'stone', color: 0x6b675e, extraColor: 0x050505, baseY: 1.5 },
  },
  {
    id: 'caveBoulder',
    kind: 'caveBoulder',
    name: 'Cave Rock',
    description:
      'Fallen rock around the cave mouth — and rubble on ' +
      'the cave floor inside (Adam, 2026-10-30).',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['tanglewood', 'forest'],
    mesh: { shape: 'stone', color: 0x716d64, extraColor: 0x5b574f, baseY: 0.55 },
  },
  // The cave-dimension set (Adam, 2026-10-30 — emitted by
  // the cave generator only; the surface world never
  // spawns them).
  {
    id: 'caveRock',
    kind: 'caveRock',
    name: 'Cave Wall',
    description:
      'The living rock of the cave (Adam, 2026-10-30). ' +
      'Solid; the chambers are cut through it.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['deepBog'],
    mesh: { shape: 'stone', color: 0x4c463f, extraColor: 0x3a362f, baseY: 1.6 },
  },
  {
    id: 'caveCeiling',
    kind: 'caveCeiling',
    name: 'Cave Ceiling',
    description:
      'The cave\u2019s roof of rock (Adam, 2026-10-30), ' +
      'always overhead inside.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['deepBog'],
    mesh: { shape: 'stone', color: 0x403b34, extraColor: 0x332f2a, baseY: 0 },
  },
  {
    id: 'stalactite',
    kind: 'stalactite',
    name: 'Stalactite',
    description:
      'A stone tooth hanging from the cave ceiling (Adam, ' +
      '2026-10-30).',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['deepBog'],
    mesh: { shape: 'stone', color: 0x7a7264, extraColor: 0x655d50, baseY: 1.5 },
  },
  {
    id: 'cavePool',
    kind: 'cavePool',
    name: 'Cave Pool',
    description:
      'Still black water pooled on the cave floor (Adam, ' +
      '2026-10-30).',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['deepBog'],
    mesh: { shape: 'disc', color: 0x10161c, baseY: 0 },
  },
  {
    id: 'twilightFungus',
    kind: 'twilightFungus',
    name: 'Twilight Fungus',
    description:
      'A pale-glowing fungus that grows where the cave ' +
      'still remembers the entrance (Adam, 2026-10-30). ' +
      'Its light reaches a few steps, no farther.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['deepBog'],
    mesh: { shape: 'stone', color: 0x9fd8c8, extraColor: 0x6fae9d, baseY: 0.25 },
  },
  // The General Store set (Adam, 2026-10-30 — site-pass
  // only, same rule as the sets above). The shelf dressing
  // is silhouette geometry: nothing here is takeable until
  // the salvage content claim lands.
  {
    id: 'storeWall',
    kind: 'storeWall',
    name: 'Store Wall',
    description:
      'A board wall of the old general store (Adam, ' +
      '2026-10-30), still standing in settled country.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x6e5136, extraColor: 0x201812, baseY: 1.5 },
  },
  {
    id: 'storeFront',
    kind: 'storeFront',
    name: 'Store Front',
    description:
      'The store\u2019s false front (Adam, 2026-10-30): a ' +
      'tall board face built to look grander than the room ' +
      'behind it, its shop window dark.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x77603f, extraColor: 0x1d1a14, baseY: 2.3 },
  },
  {
    id: 'storeRoof',
    kind: 'storeRoof',
    name: 'Store Roof',
    description:
      'The general store\u2019s roof (Adam, 2026-10-30), ' +
      'whole behind its tall front.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x54472e, extraColor: 0x6e5136, baseY: 0 },
  },
  {
    id: 'storePorch',
    kind: 'storePorch',
    name: 'Boardwalk',
    description:
      'A stretch of the store\u2019s boardwalk porch (Adam, ' +
      '2026-10-30), where the whole road once stopped.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x5d4630, extraColor: 0x6e5136, baseY: 0.55 },
  },
  {
    id: 'storeCounter',
    kind: 'storeCounter',
    name: 'Counter',
    description:
      'The store\u2019s long counter (Adam, 2026-10-30). ' +
      'Customers on one side, the keeper on the other; a ' +
      'gap at one end where the keeper passed.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x7a6248, extraColor: 0x4a3b28, baseY: 0.55 },
  },
  {
    id: 'storeShelf',
    kind: 'storeShelf',
    name: 'Shelf',
    description:
      'A store shelf (Adam, 2026-10-30), still holding the ' +
      'shapes of the old world\u2019s goods. Shapes only — ' +
      'what can be taken is a later reckoning.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x6b5638, extraColor: 0x8a7a5a, baseY: 1.1 },
  },
  // The Drowned Mill set (Adam, 2026-10-30 — site-pass
  // only, same rule as the sets above). Wood and stone:
  // the no-iron ruling binds the build as it binds her
  // crafting.
  {
    id: 'millWall',
    kind: 'millWall',
    name: 'Mill Wall',
    description:
      'A stone wall of the drowned mill (Adam, 2026-10-30), ' +
      'dark at its foot where the water has stood.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom', 'mirewood'],
    mesh: { shape: 'stone', color: 0x77706a, extraColor: 0x3f3a33, baseY: 1.6 },
  },
  {
    id: 'millWallFallen',
    kind: 'millWallFallen',
    name: 'Fallen Mill Wall',
    description:
      'A wall of the tipped mill (Adam, 2026-10-30), gone ' +
      'over toward the water and lying where it fell. She ' +
      'scrambles across these; nothing here is a room.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom', 'mirewood'],
    mesh: { shape: 'stone', color: 0x6e675e, extraColor: 0x3f3a33, baseY: 0.2 },
  },
  {
    id: 'millRoof',
    kind: 'millRoof',
    name: 'Mill Roof',
    description:
      'The mill\u2019s standing roof slope (Adam, 2026-10-30) — ' +
      'the land side. The water side fell long ago.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom', 'mirewood'],
    mesh: { shape: 'stone', color: 0x4f4234, extraColor: 0x6e5136, baseY: 0 },
  },
  {
    id: 'millRoofFallen',
    kind: 'millRoofFallen',
    name: 'Fallen Roof',
    description:
      'The mill\u2019s water-side roof slope (Adam, 2026-10-30), ' +
      'slid down against the wall it used to cover.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom', 'mirewood'],
    mesh: { shape: 'stone', color: 0x5d4c38, extraColor: 0x3a3128, baseY: 0.8 },
  },
  {
    id: 'millWheel',
    kind: 'millWheel',
    name: 'Mill Wheel',
    description:
      'The mill\u2019s great wooden wheel (Adam, 2026-10-30), ' +
      'broken and stilled, its lower arc sunk in the water ' +
      'it once drank from.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom', 'mirewood'],
    mesh: { shape: 'stone', color: 0x5d4630, extraColor: 0x3e2f20, baseY: 1.35 },
  },
  {
    id: 'millRace',
    kind: 'millRace',
    name: 'Mill Race',
    description:
      'The mill\u2019s race (Adam, 2026-10-30): a stone-cheeked ' +
      'channel that once hurried the river under the wheel. ' +
      'Now it just lets the water through.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom', 'mirewood'],
    mesh: { shape: 'stone', color: 0x6e6a5e, extraColor: 0x141a16, baseY: 0.25 },
  },
  // The Sunken Road set (Adam, 2026-10-30 — site-pass
  // only, same rule as the sets above).
  {
    id: 'roadSlab',
    kind: 'roadSlab',
    name: 'Road Slab',
    description:
      'A slab of the old road (Adam, 2026-10-30), cracked ' +
      'and shouldered with ditch-dark edges. The road ran ' +
      'somewhere once; its ends are lost.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom', 'deepBog'],
    mesh: { shape: 'stone', color: 0x5a574e, extraColor: 0x33302a, baseY: 0.06 },
  },
  {
    id: 'roadSlabSunk',
    kind: 'roadSlabSunk',
    name: 'Sunken Slab',
    description:
      'A road slab (Adam, 2026-10-30) that sank where the ' +
      'wet took the road\u2019s middle — tilted, drowned, ' +
      'still holding the line.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom', 'deepBog'],
    mesh: { shape: 'stone', color: 0x504e45, extraColor: 0x2c2a24, baseY: 0.02 },
  },
  {
    id: 'roadPost',
    kind: 'roadPost',
    name: 'Road Post',
    description:
      'A marker post from the old road\u2019s shoulder ' +
      '(Adam, 2026-10-30). Some still stand; some broke.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom', 'deepBog'],
    mesh: { shape: 'stone', color: 0x5d4630, extraColor: 0x3e2f20, baseY: 0.55 },
  },
  {
    id: 'roadSign',
    kind: 'roadSign',
    name: 'Road Sign',
    description:
      'The road\u2019s signed post (Adam, 2026-10-30). The ' +
      'board is blank now — whatever it named, the weather ' +
      'took it.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom', 'deepBog'],
    mesh: { shape: 'stone', color: 0x5d4630, extraColor: 0x8a7a5a, baseY: 0.9 },
  },
  // The Rail Siding set (Adam, 2026-10-30 — site-pass
  // only, same rule as the sets above). The rails are
  // rusty iron-brown SCENERY (the mines precedent): the
  // no-iron tenet binds her hands and her crafting, not
  // the old world's leavings.
  // The Barn set (Adam, 2026-10-30 — site-pass only,
  // same rule as the sets above).
  // The Grain Silo set (Adam, 2026-10-30 — site-pass
  // only, same rule as the sets above).
  {
    id: 'siloBody',
    kind: 'siloBody',
    name: 'Grain Silo',
    description:
      'A grain silo (Adam, 2026-10-30), galvanized and rust-streaked, its hatch shut on the dark inside.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x9a958c, extraColor: 0x6e6a62, baseY: 4.7 },
  },
  {
    id: 'siloBreached',
    kind: 'siloBreached',
    name: 'Breached Silo',
    description:
      'A grain silo (Adam, 2026-10-30) with its seam split \u2014 old grain spilled at its base.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x948e84, extraColor: 0x655f57, baseY: 4.7 },
  },
  {
    id: 'siloFallen',
    kind: 'siloFallen',
    name: 'Fallen Silo',
    description:
      'A grain silo (Adam, 2026-10-30) down on its side where it fell.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x8f8a80, extraColor: 0x5f5a52, baseY: 1.7 },
  },
  {
    id: 'grainBin',
    kind: 'grainBin',
    name: 'Grain Bin',
    description:
      'A squat grain bin (Adam, 2026-10-30), the silo\u2019s smaller companion.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x8a857c, extraColor: 0x6e6a62, baseY: 1.5 },
  },
  {
    id: 'barnWall',
    kind: 'barnWall',
    name: 'Barn Wall',
    description:
      'A wall of the barn (Adam, 2026-10-30), board-and-batten, weathered grey-brown.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x77685a, extraColor: 0x5d4c38, baseY: 1.6 },
  },
  {
    id: 'barnWallPatch',
    kind: 'barnWallPatch',
    name: 'Patched Barn Wall',
    description:
      'A barn wall (Adam, 2026-10-30) patched with mismatched boards \u2014 the wear dial, in geometry.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x77685a, extraColor: 0x4a3b28, baseY: 1.6 },
  },
  {
    id: 'barnWallFallen',
    kind: 'barnWallFallen',
    name: 'Fallen Barn Wall',
    description:
      'A barn wall (Adam, 2026-10-30) down where it fell.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x6e6154, extraColor: 0x4a3f33, baseY: 0.25 },
  },
  {
    id: 'barnRoofBay',
    kind: 'barnRoofBay',
    name: 'Barn Roof',
    description:
      'A bay of the barn\u2019s roof (Adam, 2026-10-30).',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x5d5044, extraColor: 0x3e362c, baseY: 0 },
  },
  {
    id: 'barnRoofEnd',
    kind: 'barnRoofEnd',
    name: 'Barn Gable',
    description:
      'The barn roof\u2019s gabled end bay (Adam, 2026-10-30).',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x5d5044, extraColor: 0x3e362c, baseY: 0 },
  },
  {
    id: 'barnRoofFallen',
    kind: 'barnRoofFallen',
    name: 'Fallen Barn Roof',
    description:
      'A slope of the barn\u2019s roof (Adam, 2026-10-30), down inside its fallen end.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x54493c, extraColor: 0x3a3128, baseY: 0.9 },
  },
  {
    id: 'barnDoor',
    kind: 'barnDoor',
    name: 'Barn Door',
    description:
      'The barn\u2019s big door (Adam, 2026-10-30), standing ajar.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x6e5136, extraColor: 0x4a3b28, baseY: 1.3 },
  },
  {
    id: 'barnLoft',
    kind: 'barnLoft',
    name: 'Barn Loft',
    description:
      'A strip of the barn\u2019s loft floor (Adam, 2026-10-30), on its posts over the far end.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x7a6248, extraColor: 0x5d4630, baseY: 0 },
  },
  {
    id: 'barnLeanTo',
    kind: 'barnLeanTo',
    name: 'Lean-To',
    description:
      'The barn\u2019s lean-to (Adam, 2026-10-30), a sloped shelter along one side.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x5d5044, extraColor: 0x5d4630, baseY: 1.35 },
  },
  {
    id: 'hayBale',
    kind: 'hayBale',
    name: 'Hay Bale',
    description:
      'A round hay bale (Adam, 2026-10-30), old and grey-gold.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0xb3a05f, extraColor: 0x8a7a48, baseY: 0.45 },
  },
  {
    id: 'sidingBed',
    kind: 'sidingBed',
    name: 'Rail Bed',
    description:
      'The siding\u2019s gravel bed (Adam, 2026-10-30), its ' +
      'ties still holding the line\u2019s measure.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x6b665a, extraColor: 0x4a4238, baseY: 0.05 },
  },
  {
    id: 'sidingRail',
    kind: 'sidingRail',
    name: 'Rail',
    description:
      'A rusted rail (Adam, 2026-10-30) — the old world\u2019s ' +
      'iron, left where it lay. Scenery, not salvage: her ' +
      'hands and her crafting keep the tenet; the ground ' +
      'keeps its leavings.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x6e4a38, extraColor: 0x8a6a52, baseY: 0.14 },
  },
  {
    id: 'boxcarBody',
    kind: 'boxcarBody',
    name: 'Boxcar',
    description:
      'A stranded boxcar (Adam, 2026-10-30), its sliding ' +
      'door open on a load that shifted against it long ' +
      'ago. She can look in. The load says no further.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x74584a, extraColor: 0x2e2622, baseY: 1.55 },
  },
  {
    id: 'sidingPlatform',
    kind: 'sidingPlatform',
    name: 'Loading Platform',
    description:
      'The siding\u2019s loading platform (Adam, 2026-10-30), ' +
      'built to meet a boxcar\u2019s door.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x6e5136, extraColor: 0x4a3b28, baseY: 0.22 },
  },
  {
    id: 'sidingBuffer',
    kind: 'sidingBuffer',
    name: 'Buffer Stop',
    description:
      'The buffer stop (Adam, 2026-10-30) where the spur ' +
      'gives up — the end of the line, in timber.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'stone', color: 0x5d4630, extraColor: 0x3e2f20, baseY: 0.7 },
  },
  {
    id: 'snapwoodThicket',
    kind: 'snapWood',
    name: 'Snap-Wood Thicket',
    description: 'Brittle dead branches and framing wood throughout the silt.',
    harvestable: true,
    removable: true,
    permitTier: 'hand',
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
    removable: true,
    permitTier: 'hand',
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
    removable: true,
    permitTier: 'hand',
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
      'ONLY source that yields clay. Silt itself is scooped by hand ' +
      '(lane-decided primary permit); only its clay needs the trowel.',
    harvestable: true,
    permitTier: 'hand',
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
        stages: HARVEST_STAGES,
        yieldByStage: CLAY_YIELD_BY_STAGE,
      },
    ],
    provenance: 'prototype',
    biomes: ['creekBottom', 'mirewood', 'deepBog', 'oldfieldRise', 'saltFlat'],
    mesh: { shape: 'disc', color: 0x6b5b43, baseY: 0 },
  },
  // DENSITY DIRECTION (Adam, 2026-10-26, expectation — "I would
  // think"): river stone is RELATIVELY EASY TO FIND — common,
  // not rare. This balances the high stone demand from deadfall
  // counterweights. The tunable is the riverStone mix weight per
  // biome in biomes.ts (creekBottom 0.15 and saltFlat 0.20 are
  // the richest today; most biomes sit at 0.02–0.05). Density
  // number TBD — no weight changed here; when stone sources are
  // next touched, raise toward common and flag the number.
  {
    id: 'stoneCluster',
    kind: 'riverStone',
    name: 'River Stone Cluster',
    description:
      'Smooth basalt shaped by moving water. Useful for grinding or weighing — ' +
      'and river stone is the pinned whetstone (kept, no loss) for sharpening.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'RIVER_STONE',
    fixedYield: true,
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
  // FLINT (Adam, 2026-10-27: "let's be able to find Flint" — the
  // "lies around wherever" spread). A single dark stone, picked up
  // by hand: the fast fire-starter, kept not consumed (three
  // clicks and the fire catches; friction is the slow fallback).
  // DEPLETION (lane-decided, flagged): renewal 'taken' — a picked
  // flint is gone from that spot for good, no respawn scheduled.
  // This DIFFERS from stoneCluster's shrink/regrow: a cluster has
  // many stones to thin out, a single flint does not regrow.
  // NOTE (Systems gap, flagged to DEV): the game yield here is
  // 'FLINT', but Systems' ITEM_ID_ALIASES has no FLINT entry, so
  // grants stack under 'FLINT' while the lighting menu counts
  // 'flint' — flint lighting stays unreachable until Systems adds
  // the one-line alias (FLINT: ITEMS.flint). The source alone
  // does not complete the path.
  {
    id: 'flintStone',
    kind: 'flint',
    name: 'Flint Stone',
    description:
      'A dark, sharp-edged stone lying around wherever — the fast ' +
      'fire-starter. Three clicks and the fire catches; the flint ' +
      'itself is kept, not consumed.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'FLINT',
    fixedYield: true,
    secondaryYields: [],
    renewal: 'taken',
    provenance: 'draft',
    biomes: ['mirewood', 'deepBog', 'oldfieldRise', 'creekBottom', 'tanglewood', 'saltFlat', 'meadow', 'forest'],
    mesh: { shape: 'stone', color: 0x232326, baseY: 0.10 },
  },
  // DEPLETION (Adam, 2026-10-29, PINNED — "bones don't grow
  // back"): renewal 'taken' — a harvested bone scatter is
  // gone permanently (the removed set, like removed plants),
  // no shrink state, no regrow. The yield is unchanged
  // (1 bone, fixedYield). Other sources regrow as before;
  // bones were named alone.
  {
    id: 'boneScatter',
    kind: 'bone',
    name: 'Bone Scatter',
    description:
      'Bleached remains found deep within the silt. Exceptionally hard — ' +
      'and, per the arc ruling, Primal Bone stays with a reagent hint in its ' +
      'description for when the magic layer opens. Survival first, magic hinted. ' +
      'Surface fragments are picked up by hand (lane-decided); rarity comes ' +
      'from sparse spawn, not a gate.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'BONE',
    fixedYield: true,
    secondaryYields: [],
    renewal: 'taken',
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
    permitTier: 'hand',
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
    description:
      'Heavy structural logs that form the skeleton of true shelters. Hard to process. ' +
      'Axe work (Adam, 2026-10-26, PINNED permit: axe-family — axe-trowel and its ' +
      'descendants; a spade is not an axe). Acorns scatter around it on the ground — ' +
      'hand-picked, not from the log (gather-exempt food, Adam 2026-10-26 — ' +
      'but acorns NEED COOKED: eating them requires the campfire ' +
      'cooking step, Adam 2026-10-26).',
    harvestable: true,
    permitTier: 'axeTrowel',
    permitFamily: 'axe',
    renewal: 'spawn-near-trees',
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
      'workstation, not a consumable harvest. Later wiring must not consume it. ' +
      'Claiming it needs no tool (permit hand); the amount pattern does not ' +
      'apply to a unique anchor, and moving it still needs the trundle-tool.',
    harvestable: true,
    permitTier: 'hand',
    anchor: true,
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
    removable: true,
    permitTier: 'hand',
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
    permitTier: null,
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
      'distinct from the dark peat ground beneath it. Yields peat moss. ' +
      'Bog berries grow among it (hunger-exempt food, Adam 2026-10-26).',
    harvestable: true,
    removable: true,
    permitTier: 'hand',
    hungerExempt: true,
    primaryYield: 'PEAT_MOSS',
    secondaryYields: [SPORES_25, BOG_BERRIES_50],
    provenance: 'draft',
    biomes: ['deepBog', 'mirewood', 'tanglewood', 'creekBottom'],
    mesh: { shape: 'bogTuft', color: 0x3a5a2a, baseY: 0.25 },
  },
  {
    id: 'meadowFlower',
    kind: 'flower',
    name: 'Meadow Flower',
    description:
      'Small bright flowers of the open meadow \u2014 pink petals around a ' +
      'yellow heart. Picked by hand, taken whole as a meadow flower. ' +
      '(Harvestable since Adam\u2019s ruling, 2026-10-31: a flower should ' +
      'have a name and be harvestable \u2014 this supersedes the ' +
      '2026-10-26 scenery-only note.)',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'meadow-flower',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['meadow', 'forest', 'oldfieldRise', 'creekBottom'],
    mesh: { shape: 'flower', color: 0xe08aa8, baseY: 0.18 },
  },
  {
    id: 'whiteYarrow',
    kind: 'yarrow',
    name: 'White Yarrow',
    description:
      'Low meadow weed: thin green stems topped with flat clusters of tiny white flowers. ' +
      'Picked by hand for bouquets.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'white-yarrow',
    secondaryYields: [],
    beeForage: 'low',
    provenance: 'draft',
    biomes: ['meadow', 'oldfieldRise'],
    mesh: { shape: 'flowerDisc', color: 0xf2f0e6, extraColor: 0xe8e0c8, baseY: 0 },
  },
  {
    id: 'goldConeflower',
    kind: 'coneflower',
    name: 'Gold Coneflower',
    description:
      'Tall meadow flower: a dark brown cone centre ringed with yellow petal rays — ' +
      'the loudest flower in the meadow. Picked by hand; a show flower for home.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'gold-coneflower',
    secondaryYields: [],
    beeForage: 'high',
    provenance: 'draft',
    biomes: ['meadow'],
    mesh: { shape: 'flowerCone', color: 0xe8c832, extraColor: 0x4a2e18, baseY: 0 },
  },
  {
    id: 'purpleClover',
    kind: 'clover',
    name: 'Purple Clover',
    description:
      'Low meadow clover: small purple sphere heads on low stems. Picked by hand; bee food first.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'purple-clover',
    secondaryYields: [],
    beeForage: 'high',
    provenance: 'draft',
    biomes: ['meadow'],
    mesh: { shape: 'flower', color: 0x8a5ab8, baseY: 0 },
  },
  {
    id: 'yellowDandelion',
    kind: 'dandelion',
    name: 'Yellow Dandelion',
    description:
      'Low meadow weed: a yellow disc head on a low stem, greens eaten raw. ' +
      'Picked by hand; early bee forage. (Disc form v1; the white puff form is deferred.)',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'yellow-dandelion',
    secondaryYields: [],
    beeForage: 'early',
    provenance: 'draft',
    biomes: ['meadow', 'oldfieldRise'],
    mesh: { shape: 'flowerDisc', color: 0xf2d832, extraColor: 0xe8a832, baseY: 0 },
  },
  {
    id: 'pinkMilkweed',
    kind: 'milkweed',
    name: 'Pink Milkweed',
    description:
      'Meadow milkweed: stems topped with pink blob clusters. Picked by hand; high bee forage. ' +
      '(Blob-cluster form v1; the pod form is deferred.)',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'pink-milkweed',
    secondaryYields: [],
    beeForage: 'high',
    provenance: 'draft',
    biomes: ['meadow', 'oldfieldRise'],
    mesh: { shape: 'flower', color: 0xe89ab8, baseY: 0 },
  },
  {
    id: 'redPoppy',
    kind: 'poppy',
    name: 'Red Poppy',
    description:
      'Oldfield poppy: a thin stem holding an open red cup with a dark centre — ' +
      'the red accent flower. Picked by hand.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'red-poppy',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise'],
    mesh: { shape: 'flowerCup', color: 0xc83228, extraColor: 0x1a1a12, baseY: 0 },
  },
  {
    id: 'tallSunflower',
    kind: 'sunflower',
    name: 'Tall Sunflower',
    description:
      'Tall oldfield sunflower: a thick tall stem with a large yellow disc head and dark centre — ' +
      'a landmark flower, visible from afar. Seeds eaten; picked by hand.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'tall-sunflower',
    secondaryYields: [],
    beeForage: 'forage',
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'flowerTallDisc', color: 0xf2c832, extraColor: 0x2a2018, baseY: 0 },
  },
  {
    id: 'blueAster',
    kind: 'aster',
    name: 'Blue Aster',
    description:
      'Late-season oldfield aster: a star disc of blue-purple petal rays, blooming when other ' +
      'flowers are done. Picked by hand; late bee forage.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'blue-aster',
    secondaryYields: [],
    beeForage: 'late',
    provenance: 'draft',
    biomes: ['oldfieldRise', 'forest'],
    mesh: { shape: 'flowerDisc', color: 0x7a6ac8, extraColor: 0xf2d832, baseY: 0 },
  },
  {
    id: 'whiteTrillium',
    kind: 'trillium',
    name: 'White Trillium',
    description:
      'Rare forest trillium: three white petal discs in a triangle over three green leaves — ' +
      'unmistakable, and rare on purpose. Picked by hand.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'white-trillium',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['forest'],
    mesh: { shape: 'flowerTrillium', color: 0xf5f2ea, extraColor: 0x3a5a2a, baseY: 0 },
  },
  {
    id: 'woodViolet',
    kind: 'violet',
    name: 'Wood Violet',
    description:
      'Very low forest violet: a small purple disc head over green leaves at the base. ' +
      'Picked by hand; a small raw garnish.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'wood-violet',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['forest'],
    mesh: { shape: 'flowerDisc', color: 0x7a4ab8, extraColor: 0xf2f0e6, baseY: 0 },
  },
  {
    id: 'pinkLadySlipper',
    kind: 'ladySlipper',
    name: 'Pink Lady Slipper',
    description:
      'Rare forest orchid: a pink pouch (the slipper) with petal discs behind it. ' +
      'SCENERY ONLY v1 — it yields nothing, so its rarity is preserved; a rare-harvest ' +
      'option belongs to the later potion branch, not this landing.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['forest'],
    mesh: { shape: 'flowerPouch', color: 0xdd7a9a, baseY: 0 },
  },
  {
    id: 'creekIris',
    kind: 'iris',
    name: 'Creek Iris',
    description:
      'Tall creek-bottom iris: blade leaves and purple petal discs with a yellow centre, ' +
      'growing at the wet edge. Picked by hand.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'creek-iris',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom'],
    mesh: { shape: 'flowerIris', color: 0x6a4ab8, extraColor: 0xf2d832, baseY: 0 },
  },
  {
    id: 'whiteWaterLily',
    kind: 'waterLily',
    name: 'White Water Lily',
    description:
      'Pond-edge water lily of creek country: a wide green pad disc with a white petal flower ' +
      'on top. V1 places it as creek-bottom ground scatter (true floating rides a later ' +
      'water-placement pass). Picked by hand.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'white-water-lily',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['creekBottom'],
    mesh: { shape: 'flowerPad', color: 0xf5f2ea, extraColor: 0x3a6a2a, baseY: 0 },
  },
  {
    id: 'wildHive',
    kind: 'beehive',
    name: 'Wild Hive',
    description:
      'A wild beehive hung beside a tree trunk in the flowered country ' +
      '(tree-hung landing, 2026-10-28 — Adam: hives go ON TREES, so a torch ' +
      'beneath one reads as "under" for the safe-harvest rule): honey comes ' +
      'from it when a placed torch stands beneath; without a torch the harvest ' +
      'is refused, and bees never sting (no damage model).',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['meadow', 'forest', 'oldfieldRise', 'creekBottom'],
    mesh: { shape: 'beehive', color: 0xc9a86a, baseY: 0 },
  },
  {
    id: 'forestTallTree',
    kind: 'tallTree',
    name: 'Tall Tree',
    description:
      'A tall forest tree, canopy high above the dappled floor — SCENERY ' +
      'ONLY (meadow/forest landing, 2026-10-26): it yields nothing, and no ' +
      'new item is invented for it. The forest harvest is the brush, vines, ' +
      'and downed wood beneath it.',
    harvestable: false,
    permitTier: null,
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['forest'],
    mesh: { shape: 'tallTree', color: 0x4a2e18, extraColor: 0x2f5a26, baseY: 1.6, extraY: 3.7 },
  },
  {
    id: 'edibleMushroom',
    kind: 'edibleMushroom',
    name: 'Edible Mushroom',
    description:
      'Tan-capped mushroom, smooth with no spots — the safe one. ' +
      'Its toxic lookalike wears a rust-red cap with pale spots; ' +
      'when in doubt, leave it. Gather-exempt food (Adam 2026-10-27) — ' +
      'she can still pick it when too-hungry.',
    harvestable: true,
    permitTier: 'hand',
    hungerExempt: true,
    primaryYield: 'EDIBLE_MUSHROOM',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['mirewood', 'deepBog', 'creekBottom', 'tanglewood', 'forest'],
    mesh: { shape: 'mushroom', color: 0xa8793f, extraColor: 0xe8dcc0, baseY: 0.2 },
  },
  {
    id: 'poisonMushroom',
    kind: 'poisonMushroom',
    name: 'Poison Mushroom',
    description:
      'WARNING — TOXIC, do not eat. Rust-red cap with pale spots, ' +
      'the lookalike of the safe tan mushroom. Pretty, and poisonous.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'POISON_MUSHROOM',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['mirewood', 'deepBog', 'creekBottom', 'tanglewood', 'forest'],
    mesh: { shape: 'mushroom', color: 0x9a4a28, extraColor: 0xe8dcc0, baseY: 0.2 },
  },
  {
    id: 'groundAcorns',
    kind: 'groundAcorns',
    name: 'Ground Acorns',
    description:
      'Acorns on the ground around oaks, fallen or standing, ' +
      'hand-picked. Gather-exempt nuts (Adam 2026-10-26) — but they NEED COOKED before eating ' +
      '(campfire cooking step, Adam 2026-10-26).',
    harvestable: true,
    permitTier: 'hand',
    hungerExempt: true,
    primaryYield: 'ACORNS',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['tanglewood', 'mirewood', 'oldfieldRise', 'saltFlat'],
    mesh: { shape: 'acornCluster', color: 0x6b4a2f, extraColor: 0x4a2e18, baseY: 0.08 },
  },
  {
    id: 'appleTree',
    kind: 'appleTree',
    name: 'Apple Tree',
    description:
      'An old orchard apple tree (oldfieldRise + meadow remnants, Adam ' +
      '2026-10-26, PINNED biomes) — fruit picked BY HAND, tree stays ' +
      'living (shrink + regrow, never felled by the pick). Gather-exempt ' +
      'fruit (Adam 2026-10-26 pin pass applies to the exemption). FELL ' +
      'FOR WOOD IS OPEN (Adam 2026-10-27 brief): no fell verb exists for ' +
      'this tree yet — timber still comes from standing trees.',
    harvestable: true,
    permitTier: 'hand',
    hungerExempt: true,
    primaryYield: 'APPLE',
    secondaryYields: [],
    provenance: 'draft',
    biomes: ['oldfieldRise', 'meadow'],
    mesh: { shape: 'appleTree', color: 0x4a2e18, extraColor: 0x4a7a30, baseY: 0 },
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

/**
 * GROUND MATERIALS (Adam, 2026-10-26: she can harvest nearly anyplace
 * — even just dirt, mud, grass). These are NOT scatter objects: they
 * have no kind, no mesh, no chunk placement. They are the ground under
 * her feet, determined by terrain at her position (see proximity.ts).
 * Existence is Adam's; permits + amounts are LANE-DECIDED under the
 * deciding brief, and marked so. All three are BASIC materials, so all
 * three are hand-permitted: she scoops dirt, pulls grass, and lifts mud
 * with no tool at all, and better tools only recover more of what is
 * there (general pattern: hand 1 + 25% →2, trowel 2 + 25% →3, spade /
 * axe-trowel 3 + 25% →4, spade-axe 4 + 25% →5, trundle 5 + 25% →6).
 * No secondary yields: ground is everywhere, so a spore drop on every
 * handful would flood the economy — ground gives exactly its material.
 * Their uses are Systems' business, not set here.
 */
export interface GroundMaterialDef {
  id: 'dirt' | 'mud' | 'grass';
  name: string;
  description: string;
  harvestable: true;
  permitTier: PermitTier;
  primaryYield: ItemId;
}

export const GROUND_MATERIALS: GroundMaterialDef[] = [
  {
    id: 'dirt',
    name: 'Dirt',
    description:
      'Dry earth, scooped from anywhere that is not wet or grassy — the ' +
      'default ground underfoot. Basic, hand-gathered.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'DIRT',
  },
  {
    id: 'mud',
    name: 'Mud',
    description:
      'Wet earth from mire, bog, creek edges, and marsh ground — soft, ' +
      'heavy, and close kin to silt as a binder. Basic, hand-gathered.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'MUD',
  },
  {
    id: 'grass',
    name: 'Grass',
    description:
      'Open-ground grass from meadow and oldfield ground — pulled by the ' +
      'handful for thatch, bedding, and binding. Basic, hand-gathered.',
    harvestable: true,
    permitTier: 'hand',
    primaryYield: 'GRASS',
  },
];

export const GROUND_MATERIAL_BY_ID: Record<string, GroundMaterialDef> =
  Object.fromEntries(GROUND_MATERIALS.map((g) => [g.id, g]));
