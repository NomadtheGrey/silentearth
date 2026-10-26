/**
 * Silent Earth — owned-tool tier (player-systems lane).
 *
 * CORRECTION (Adam, 2026-10-26) — this module SUPERSEDES
 * held-tool.ts, which is deleted in the same landing. Do not
 * reintroduce an equip slot: OWNING the tool is sufficient to use
 * it. It is the only tool, so there is no equipment choice to make.
 * There is no equip action, no equip/unequip state, and no equip
 * step after crafting anywhere in this module or in
 * crafting-execution.ts.
 *
 * HOW OWNERSHIP IS TRACKED: the owned tier is DERIVED from the
 * inventory, not stored in a separate slot. The query functions
 * below read whatever ladder tools are present in personal
 * inventory and report the highest tier among them. That is what
 * makes "owning is sufficient" literally true in code:
 * - Starts at none (hands): an inventory with no ladder tool has
 *   no tier, stage -1, stage name 'hands'.
 * - Crafting a tool sets the owned tier: the crafted tool enters
 *   inventory, so the next query reports its tier. No separate
 *   state update is needed, and none can get out of sync.
 * - Upgrading advances the owned tier: the upgrade consumes its
 *   predecessor in inventory and adds the new tool, so the query
 *   now reports the higher tier. Under normal ladder flow she owns
 *   exactly one tier at a time (predecessor consumed), which is
 *   what makes the query unambiguous.
 * - There is no slot to save, load, or synchronize: save/load
 *   restores the inventory, and the owned tier follows for free.
 *
 * EDGE CASE (documented, not a ruling): if inventory ever holds
 * more than one ladder tool at once (e.g. a spare trowel crafted
 * while owning a spade-axe), the query reports the HIGHEST stage
 * present — crafting a lower tool never downgrades the owned tier.
 * Within one stage (spade vs axe-trowel, the two routes to the
 * same convergence), the first in ladder order wins; harvest
 * scaling is stage-based, so that tie cannot change yields.
 *
 * TIER VIEWS (same three views the old held-tool module offered,
 * now reading ownership instead of a slot):
 * 1. ownedTier(): Background-compatible tier, or null for none.
 *    Literals deliberately MATCH src/game/objects.ts ToolTier
 *    ('trowel' | 'sharpTrowel' | 'spade' | 'axeTrowel' | 'spadeAxe'
 *    | 'trundleTool'), by name only — no import from src/game, so
 *    the unions stay in sync by shared literals, not by a type
 *    import across the lane boundary. Passable straight to
 *    Background's harvestStageRank / clayYieldForTool (null = none).
 * 2. ownedStage(): numeric stage mirroring objects.ts
 *    HARVEST_STAGES — none = -1; trowel + sharp trowel share stage
 *    0 (sharp is a sharpening of the trowel stage, not a separate
 *    stage); spade + axe-trowel share stage 1; spade-axe is stage
 *    2; trundle-tool is stage 3.
 * 3. ownedStageName(): plain-language tier — 'hands' | 'trowel' |
 *    'spade-or-axe-trowel' | 'spade-axe' | 'trundle'. 'hands' is
 *    the stage name for the 'none' state; the two words name the
 *    same state (no tool).
 *
 * OPEN (not settled here): ownership currently means presence in
 * PERSONAL inventory. Whether a tool stored at home (home storage
 * is a separate, later system) still counts as owned is a future
 * question for when home storage exists — this module does not
 * answer it.
 */

import { ITEMS, type ItemId } from './recipes';

/** What she owns: 'none', or one of the ladder tools. */
export type OwnedToolItem = 'none' | ItemId;

/**
 * Background-compatible tool tier literals (see header — mirrors
 * src/game/objects.ts ToolTier by name, no cross-lane import).
 */
export type BackgroundToolTier =
  | 'trowel'
  | 'sharpTrowel'
  | 'spade'
  | 'axeTrowel'
  | 'spadeAxe'
  | 'trundleTool';

/** Plain-language stage name, in the design docs' terms. */
export type HarvestStageName =
  | 'hands'
  | 'trowel'
  | 'spade-or-axe-trowel'
  | 'spade-axe'
  | 'trundle';

/**
 * Minimal inventory surface these queries need: only count().
 * PersonalInventory and the crafting adapter both satisfy it.
 */
export interface ToolCountingInventory {
  count(item: ItemId): number;
}

/** The ladder tools — the only items that carry a tool tier. */
export const LADDER_TOOLS: ReadonlySet<ItemId> = new Set([
  ITEMS.gardenTrowel,
  ITEMS.sharpTrowel,
  ITEMS.spade,
  ITEMS.axeTrowel,
  ITEMS.spadeAxe,
  ITEMS.trundleTool,
]);

export function isLadderTool(item: ItemId): boolean {
  return LADDER_TOOLS.has(item);
}

interface ToolMapping {
  tier: BackgroundToolTier;
  /** Harvest stage, mirroring objects.ts HARVEST_STAGES. */
  stage: number;
  stageName: HarvestStageName;
}

/**
 * One mapping table for all three tier views. Sharp trowel shares
 * the trowel stage (stage 0) — see the header.
 */
const TOOL_MAPPING: Record<string, ToolMapping> = {
  [ITEMS.gardenTrowel]: { tier: 'trowel', stage: 0, stageName: 'trowel' },
  [ITEMS.sharpTrowel]: {
    tier: 'sharpTrowel',
    stage: 0,
    stageName: 'trowel',
  },
  [ITEMS.spade]: {
    tier: 'spade',
    stage: 1,
    stageName: 'spade-or-axe-trowel',
  },
  [ITEMS.axeTrowel]: {
    tier: 'axeTrowel',
    stage: 1,
    stageName: 'spade-or-axe-trowel',
  },
  [ITEMS.spadeAxe]: {
    tier: 'spadeAxe',
    stage: 2,
    stageName: 'spade-axe',
  },
  [ITEMS.trundleTool]: {
    tier: 'trundleTool',
    stage: 3,
    stageName: 'trundle',
  },
};

/** Ladder order, used only for the within-stage tie-break. */
const LADDER_ORDER: ItemId[] = [
  ITEMS.gardenTrowel,
  ITEMS.sharpTrowel,
  ITEMS.spade,
  ITEMS.axeTrowel,
  ITEMS.spadeAxe,
  ITEMS.trundleTool,
];

/**
 * The owned ladder tool: the highest-stage tool present in
 * inventory, or 'none'. Within one stage, the first in ladder
 * order wins (see the header's edge-case note).
 */
export function ownedToolItem(
  inventory: ToolCountingInventory,
): OwnedToolItem {
  let best: OwnedToolItem = 'none';
  let bestStage = -1;
  for (const item of LADDER_ORDER) {
    if (inventory.count(item) < 1) {
      continue;
    }
    const stage = TOOL_MAPPING[item].stage;
    if (stage > bestStage) {
      best = item;
      bestStage = stage;
    }
  }
  return best;
}

/** Background-compatible tier of the owned tool, or null for none. */
export function ownedTier(
  inventory: ToolCountingInventory,
): BackgroundToolTier | null {
  const item = ownedToolItem(inventory);
  if (item === 'none') {
    return null;
  }
  return TOOL_MAPPING[item].tier;
}

/** Harvest stage of the owned tool: -1 none, 0 trowel, 1 spade, 2 spade-axe, 3 trundle. */
export function ownedStage(inventory: ToolCountingInventory): number {
  const item = ownedToolItem(inventory);
  if (item === 'none') {
    return -1;
  }
  return TOOL_MAPPING[item].stage;
}

/** Plain-language tier name of the owned tool ('hands' when none). */
export function ownedStageName(
  inventory: ToolCountingInventory,
): HarvestStageName {
  const item = ownedToolItem(inventory);
  if (item === 'none') {
    return 'hands';
  }
  return TOOL_MAPPING[item].stageName;
}
