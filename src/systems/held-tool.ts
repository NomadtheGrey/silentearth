/**
 * Silent Earth — held-tool state (player-systems lane).
 *
 * A small module tracking which tool she holds. No UI, no game
 * wiring, no imports from src/game/* (lane boundary: this module
 * must stay usable without the engine).
 *
 * STARTING STATE: hands (no tool). That is deliberate and consistent
 * with the world as built: ground is hand-permitted, and clay needs
 * a trowel — hands cannot yield clay, a trowel can.
 *
 * CRAFTING EQUIPS: crafting a tool equips it (see
 * ./crafting-execution.ts executeCraft). Upgrading replaces the held
 * tool, because the upgrade consumes its predecessor (per the tool
 * ladder) — the held tool is never duplicated by an upgrade.
 *
 * ------------------------------------------------------------------
 * TIER QUERY — three views of the same held tool, for different
 * callers. All three derive from one mapping table below, so they
 * cannot drift apart.
 *
 * 1. toolTier(): Background-compatible tool tier, or null for hands.
 *    The string literals deliberately MATCH src/game/objects.ts
 *    ToolTier ('trowel' | 'sharpTrowel' | 'spade' | 'axeTrowel' |
 *    'spadeAxe' | 'trundleTool'), by name only — this module does
 *    NOT import from src/game, so the two unions are kept in sync
 *    by this comment and by the shared literals, not by a type
 *    import across the lane boundary. Harvest code can pass this
 *    value straight to Background's harvestStageRank /
 *    clayYieldForTool (null = no tool, same convention).
 *
 * 2. harvestStage(): numeric stage, mirroring Background's
 *    HARVEST_STAGES grouping in objects.ts: hands = -1 (same as
 *    harvestStageRank(null)); trowel + sharp trowel share stage 0;
 *    spade + axe-trowel share stage 1; spade-axe is stage 2;
 *    trundle-tool is stage 3. Sharp trowel is a SHARPENING of the
 *    trowel stage, not a separate harvest stage — counting it
 *    separately would wrongly push spade above a trowel permit.
 *    (Objects.ts notes the same, and that sharp holds the trowel
 *    yield amount pending Adam's word.)
 *
 * 3. stageName(): the plain-language tier the design docs use —
 *    'hands' | 'trowel' | 'spade-or-axe-trowel' | 'spade-axe' |
 *    'trundle'. This is the tier query in the wiring brief's terms.
 *
 * ------------------------------------------------------------------
 * WHAT THIS MODULE DOES NOT DO:
 * - It does not gate crafting: upgrade predecessors are
 *   inventory-based (see crafting.ts), not held-based. A player may
 *   craft an upgrade whose predecessor sits in inventory while a
 *   different tool is held; the craft still succeeds, and the held
 *   tool then becomes the new output.
 * - It does not know whether the held item is actually owned: equip()
 *   validates that the item is a ladder tool, not that it is in
 *   inventory. Callers that equip outside a craft (e.g. re-equipping
 *   an owned tool) own that check.
 * - It has no persistence: save/load serializes current() and
 *   restores it via the constructor. That wiring is later work.
 */

import { ITEMS, type ItemId } from './recipes';

/** What she holds: 'hands', or one of the ladder tools. */
export type HeldToolItem = 'hands' | ItemId;

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

/** The ladder tools — the only items that can be held as tools. */
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

/** Pure helpers, for callers that do not hold state. */
export function toolTierFor(item: HeldToolItem): BackgroundToolTier | null {
  if (item === 'hands') {
    return null;
  }
  return TOOL_MAPPING[item]?.tier ?? null;
}

/** -1 for hands, else the harvest stage (see header). */
export function harvestStageFor(item: HeldToolItem): number {
  if (item === 'hands') {
    return -1;
  }
  return TOOL_MAPPING[item]?.stage ?? -1;
}

export function stageNameFor(item: HeldToolItem): HarvestStageName {
  if (item === 'hands') {
    return 'hands';
  }
  return TOOL_MAPPING[item]?.stageName ?? 'hands';
}

/**
 * Held-tool state. Starts at hands unless an initial tool is given
 * (e.g. restoring a save).
 */
export class HeldToolState {
  private held: HeldToolItem;

  constructor(initial: HeldToolItem = 'hands') {
    if (initial !== 'hands' && !isLadderTool(initial)) {
      throw new Error(`Cannot hold ${initial}: not a ladder tool.`);
    }
    this.held = initial;
  }

  /** What she holds right now ('hands' or a tool item id). */
  current(): HeldToolItem {
    return this.held;
  }

  /** Background-compatible tier, or null for hands. */
  toolTier(): BackgroundToolTier | null {
    return toolTierFor(this.held);
  }

  /** Harvest stage: -1 hands, 0 trowel, 1 spade, 2 spade-axe, 3 trundle. */
  harvestStage(): number {
    return harvestStageFor(this.held);
  }

  /** Plain-language tier name for the design docs' terms. */
  stageName(): HarvestStageName {
    return stageNameFor(this.held);
  }

  /**
   * Hold a ladder tool. Throws for non-tools. This does not check
   * inventory ownership — see the header.
   */
  equip(item: ItemId): void {
    if (!isLadderTool(item)) {
      throw new Error(`Cannot equip ${item}: not a ladder tool.`);
    }
    this.held = item;
  }

  /** Back to hands (tool lost, dropped, or otherwise gone). */
  unequip(): void {
    this.held = 'hands';
  }
}
