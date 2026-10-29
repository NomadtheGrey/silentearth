/**
 * QUEST LOG — v1 definitions + completion predicates
 * (Systems, 2026-10-28; Adam ordered: mini-quest hints
 * in priority order, Quest Log tab in Options).
 *
 * DRAFT FOR ADAM'S PIN PASS — titles, order, and rules
 * below are draft, not pinned. v1 is these 15 only;
 * later quests (traps, beehives, loom, pottery,
 * further houses, charm tiers) grow the list as those
 * systems land — do not build them here.
 *
 * SPLIT (brief): derived where possible from existing
 * state (placed fires/houses, tool stage, inventory);
 * event flags ONLY where derivation can't work — the
 * four QuestFlags, set by the shell (UI wiring
 * follow-up, not this landing; flags default false
 * until wired — format now, wiring later):
 *   ateWhileHungry — shell sets on eat success while
 *     hunger stage is 'hungry' (the hungry band).
 *   slept — shell sets on 'sleep:completed'.
 *   ritualCompleted — shell sets on ritual complete()
 *     non-null ONLY (outright grants, e.g. shrew,
 *     never set it).
 *   craftedAtStump — shell sets on craft success
 *     with the stump as the active station.
 * Predicates are pure functions of QuestFacts (shell-
 * supplied snapshots; game never imported — the
 * divination/ritual fact pattern).
 *
 * PIN QUESTIONS / EDGES (flagged, not baked in):
 * - Make Campfire counts PLACED only, not crafted —
 *   Adam's pin.
 * - Wake a Charm counts ritual completion only;
 *   shrew outright does NOT count — Adam's pin.
 * - Collect Food uses FOOD_ITEMS only: raw acorns do
 *   NOT count until cooked (recommend; alternative:
 *   raw acorns count).
 * - Upgrade Your Tool = ownedToolStage ≥ 1 (past the
 *   trowel family — recommend; alternative ≥ 0 =
 *   owns any tool).
 * - Eat When Hungry = 'hungry' band only (recommend
 *   per brief wording; alternative: hungry-or-
 *   too-hungry).
 * - Make Torch pile-drop edge: crafted then dropped
 *   in a pile, none held/lit/placed, reads undone
 *   (minor; a fifth flag is the alternative, not
 *   proposed).
 * Literal vocabularies below — each facts field speaks
 * its OWN (2026-10-29 correction; the original note here
 * claimed house literals were verified against shelter.ts
 * HouseItem, which was exactly wrong): inventory literals
 * are ITEM ids (recipes.ts ITEMS); fire literals are
 * ENGINE FireType values (fire.ts); HOUSE literals are
 * ENGINE HouseType values (game/shelter.ts — 'leanTo',
 * 'thatchHut', 'wovenCottage', 'smallWoodenHut'), NOT the
 * house ITEM ids ('primitive-lean-to', 'thatch-hut').
 * QuestFacts.houses is shell-mapped from the shelter
 * snapshot, whose type is the engine type (App maps item
 * -> engine type at placement). Comparing it against an
 * item id made make-lean-to and better-house impossible
 * to complete (Adam's live find, 2026-10-29) — any new
 * literal against a shell-mapped snapshot field must be
 * checked against the ENGINE vocabulary, not the item's.
 */

import type { PersonalInventory } from './inventory';
import { FOOD_ITEMS } from './hunger';
import { FIRST_CHARM_KIND, boneItemFor } from './charms';
import { RITUAL_RECIPES } from './rituals';

/**
 * One placed fire, shell-mapped from the fire snapshot.
 * (type is an ENGINE FireType value, e.g. 'campfire'.)
 */
export interface QuestFire {
  type: string;
  lit: boolean;
}

/**
 * One placed house, shell-mapped from the house snapshot.
 * (type is an ENGINE HouseType value — 'leanTo' etc. —
 * never the house item id; see the header note.)
 */
export interface QuestHouse {
  type: string;
}

/** Event flags derivation can't see (shell-owned, shell-set). */
export interface QuestFlags {
  ateWhileHungry: boolean;
  slept: boolean;
  ritualCompleted: boolean;
  craftedAtStump: boolean;
}

/** All-false flags (fresh save / before any flag is set). */
export function emptyQuestFlags(): QuestFlags {
  return {
    ateWhileHungry: false,
    slept: false,
    ritualCompleted: false,
    craftedAtStump: false,
  };
}

/**
 * Saved shape of the flags (save.ts single-sources this
 * type — no second mirror to drift). All fields
 * optional: absent = false (old saves).
 */
export interface SavedQuestFlags {
  ateWhileHungry?: boolean;
  slept?: boolean;
  ritualCompleted?: boolean;
  craftedAtStump?: boolean;
}

/** Everything a predicate reads, shell-supplied. */
export interface QuestFacts {
  inventory: PersonalInventory;
  /** Shell-computed via ownedStage (owned-tool.ts). */
  ownedToolStage: number;
  fires: readonly QuestFire[];
  houses: readonly QuestHouse[];
  /** Placed-torch count, shell-mapped from torchState. */
  placedTorches: number;
  flags: QuestFlags;
}

/** One quest: id + draft title + completion predicate. */
export interface QuestDefinition {
  id: string;
  title: string;
  isDone: (facts: QuestFacts) => boolean;
}

/** Every bone item id: generic + all 18 primal-bone kinds. */
const BONE_ITEM_IDS: readonly string[] = [
  'bone',
  ...RITUAL_RECIPES.map((recipe) => boneItemFor(recipe.boneKind)),
  boneItemFor(FIRST_CHARM_KIND),
];

/** The 15 v1 quests, in priority order. */
export const QUEST_DEFINITIONS: readonly QuestDefinition[] = [
  {
    id: 'collect-food',
    title: 'Collect Food',
    isDone: (facts) =>
      FOOD_ITEMS.some((food) => facts.inventory.count(food) > 0),
  },
  {
    id: 'eat-when-hungry',
    title: 'Eat When Hungry',
    isDone: (facts) => facts.flags.ateWhileHungry,
  },
  {
    id: 'make-campfire',
    title: 'Make Campfire',
    isDone: (facts) =>
      facts.fires.some((fire) => fire.type === 'campfire'),
  },
  {
    id: 'light-campfire',
    title: 'Light Campfire',
    isDone: (facts) =>
      facts.fires.some((fire) => fire.type === 'campfire' && fire.lit),
  },
  {
    id: 'make-lean-to',
    title: 'Make Lean-To',
    isDone: (facts) =>
      facts.houses.some((house) => house.type === 'leanTo'),
  },
  {
    id: 'rest',
    title: 'Rest',
    isDone: (facts) => facts.flags.slept,
  },
  {
    id: 'find-flint',
    title: 'Find Flint',
    isDone: (facts) => facts.inventory.count('flint') > 0,
  },
  {
    id: 'make-torch',
    title: 'Make Torch',
    isDone: (facts) =>
      facts.inventory.count('torch') > 0 ||
      facts.inventory.count('lit-torch') > 0 ||
      facts.placedTorches > 0,
  },
  {
    id: 'light-torch',
    title: 'Light Torch',
    isDone: (facts) =>
      facts.inventory.count('lit-torch') > 0 || facts.placedTorches > 0,
  },
  {
    id: 'use-stump',
    title: 'Use the Stump',
    isDone: (facts) => facts.flags.craftedAtStump,
  },
  {
    id: 'upgrade-tool',
    title: 'Upgrade Your Tool',
    isDone: (facts) => facts.ownedToolStage >= 1,
  },
  {
    id: 'gather-clay',
    title: 'Gather Clay',
    isDone: (facts) => facts.inventory.count('clay') > 0,
  },
  {
    id: 'better-house',
    title: 'Build a Better House',
    // ANY house beyond the lean-to (engine HouseType values):
    // a fresh-placed woven cottage completes this without
    // ever passing through thatch, and upgrades change a
    // house's type in place up the same ladder.
    isDone: (facts) =>
      facts.houses.some(
        (house) =>
          house.type === 'thatchHut' ||
          house.type === 'wovenCottage' ||
          house.type === 'smallWoodenHut',
      ),
  },
  {
    id: 'find-bone',
    title: 'Find a Bone',
    isDone: (facts) =>
      BONE_ITEM_IDS.some((bone) => facts.inventory.count(bone) > 0),
  },
  {
    id: 'wake-charm',
    title: 'Wake a Charm',
    isDone: (facts) => facts.flags.ritualCompleted,
  },
];

/** Done state of one quest id (unknown id → false). */
export function isQuestDone(id: string, facts: QuestFacts): boolean {
  return QUEST_DEFINITIONS.find((quest) => quest.id === id)?.isDone(facts) ?? false;
}

/** Done state of all v1 quests, in priority order. */
export function evaluateQuests(
  facts: QuestFacts,
): { id: string; title: string; done: boolean }[] {
  return QUEST_DEFINITIONS.map((quest) => ({
    id: quest.id,
    title: quest.title,
    done: quest.isDone(facts),
  }));
}
