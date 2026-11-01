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
 *
 * SUBGROUPS (Adam approved the frame, 2026-11-01): within
 * Act I (the v1 fifteen), each quest carries a `thread` —
 * one of the five survival threads in QUEST_THREADS —
 * and the log renders nested folds by thread. Seats were
 * grounded in the predicates, with the misfits NAMED,
 * never silently forced: rest rides Shelter with its
 * flag standing (sleep is its own system; rest is what
 * shelter is for); find-flint and make-torch ride Fire
 * as flagged duals; wake-charm rides The Land as the
 * named misfit — the rite has no survival home, and it
 * sits with find-bone as the land's closing pair (the
 * bone road) because Act I's last fold is the door into
 * Act II (the magic thread, pinned 2026-11-01).
 *
 * COMPONENTS (2026-11-01): each quest also carries
 * `components` — sub-objectives with their own predicates
 * over the SAME QuestFacts. The law: components
 * DECOMPOSE the quest's own isDone exactly (under
 * componentsMode, 'all' by default, 'any' for the
 * OR-shaped predicates); they never invent facts and
 * never gate completion — isDone stays the sole
 * authority, and the equivalence is probe-asserted.
 * Components exist for the HUD's active-task card.
 * One named pattern inside the law: a ROAD STEP
 * (wake-charm's bone and altar steps, Adam's ruling —
 * 'the altar goes in there') derives as (completion)
 * OR (its own fact), so a finished quest never shows
 * an unfinished step even when the road was walked
 * another way; before completion the step reads its
 * own fact alone.
 *
 * THE ACTIVE MARK (2026-11-01): ONE quest may be marked
 * active; its id rides SavedQuestFlags.active in the
 * existing SaveData.quests record. The mark is data,
 * not a gate — ACTS ARE NOT GATES (Adam, 2026-11-01:
 * a player may start Act II tasks immediately, at
 * higher difficulty), and neither is the mark: it
 * changes nothing about availability or completion.
 * Whether a quest LISTS before she's touched its
 * system is an open pin-pass question; this data shape
 * takes no position on listing.
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
  /**
   * The ACTIVE MARK: the one quest id she has marked
   * active (the HUD card's quest), or absent for none.
   * Validated against QUEST_DEFINITIONS on save read —
   * an unknown or stale id reads as no mark.
   */
  active?: string;
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
  /**
   * Whether an altar stands — shell-mapped from the
   * altar state (a stump whose additions carry 'altar';
   * Systems' isStumpyAltar reads it). OPTIONAL: absent
   * reads as none-standing for the one component that
   * consults it (wake-charm's road step), and quest
   * completion never depends on it — see that quest.
   */
  altarRaised?: boolean;
}

/**
 * A thread within an act — the subgrouping (Adam's
 * approved frame, 2026-11-01). The first five are Act
 * I's survival threads; 'wakings' opens Act II's.
 * Ids are stable; names are DRAFT for his pin pass.
 */
export type QuestThread =
  | 'food'
  | 'fire'
  | 'shelter'
  | 'tools'
  | 'land'
  | 'wakings';

/**
 * A quest's act (Adam's frame): Act I, the survival
 * act; Act II — Witchery (title PINNED, 2026-11-01),
 * the magic thread. Acts are shelves, not locks (see
 * the header): the act field groups, it never gates.
 */
export type QuestAct = 'survival' | 'witchery';

/** The acts, with their display names. */
export const QUEST_ACTS: readonly { id: QuestAct; name: string }[] = [
  { id: 'survival', name: 'Act I — Survival' },
  { id: 'witchery', name: 'Act II — Witchery' },
];

/**
 * The threads, in fold order: Act I's five (= first
 * appearance in the quest list's own priority order),
 * then Act II's Wakings — the first Witchery thread,
 * DRAFT, opened by its first quest; Witchery's full
 * set comes with its subgrouping pass.
 */
export const QUEST_THREADS: readonly {
  id: QuestThread;
  name: string;
  act: QuestAct;
}[] = [
  { id: 'food', name: 'Food', act: 'survival' },
  { id: 'fire', name: 'Fire', act: 'survival' },
  { id: 'shelter', name: 'Shelter', act: 'survival' },
  { id: 'tools', name: 'Tools', act: 'survival' },
  { id: 'land', name: 'The Land', act: 'survival' },
  { id: 'wakings', name: 'Wakings', act: 'witchery' },
];

/**
 * One component (sub-objective) of a quest: its own
 * predicate over the same QuestFacts as the quest's
 * isDone. Ids are unique WITHIN their quest only.
 * Labels are DRAFT for Adam's pin pass.
 */
export interface QuestComponent {
  id: string;
  label: string;
  isDone: (facts: QuestFacts) => boolean;
}

/** One quest: id + draft title + completion predicate. */
export interface QuestDefinition {
  id: string;
  title: string;
  isDone: (facts: QuestFacts) => boolean;
  /** The quest's act (grouping only — never a gate). */
  act: QuestAct;
  /** The quest's thread within its act (see header). */
  thread: QuestThread;
  /**
   * The quest's components — an EXACT decomposition of
   * isDone over the same facts (see the header's law).
   */
  components: readonly QuestComponent[];
  /**
   * How components compose: 'all' (default) or 'any'
   * (the OR-shaped predicates). Under the mode, the
   * components' combined state EQUALS isDone — probed.
   */
  componentsMode?: 'all' | 'any';
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
    thread: 'food',
    act: 'survival',
    isDone: (facts) =>
      FOOD_ITEMS.some((food) => facts.inventory.count(food) > 0),
    components: [
      {
        id: 'have-food',
        label: 'Carry any food',
        isDone: (facts) =>
          FOOD_ITEMS.some((food) => facts.inventory.count(food) > 0),
      },
    ],
  },
  {
    id: 'eat-when-hungry',
    title: 'Eat When Hungry',
    thread: 'food',
    act: 'survival',
    isDone: (facts) => facts.flags.ateWhileHungry,
    components: [
      {
        id: 'eat-while-hungry',
        label: 'Eat while hungry',
        isDone: (facts) => facts.flags.ateWhileHungry,
      },
    ],
  },
  {
    id: 'make-campfire',
    title: 'Make Campfire',
    thread: 'fire',
    act: 'survival',
    isDone: (facts) =>
      facts.fires.some((fire) => fire.type === 'campfire'),
    components: [
      {
        id: 'place-campfire',
        label: 'Place a campfire',
        isDone: (facts) =>
          facts.fires.some((fire) => fire.type === 'campfire'),
      },
    ],
  },
  {
    id: 'light-campfire',
    title: 'Light Campfire',
    thread: 'fire',
    act: 'survival',
    isDone: (facts) =>
      facts.fires.some((fire) => fire.type === 'campfire' && fire.lit),
    components: [
      {
        id: 'place-campfire',
        label: 'Place a campfire',
        isDone: (facts) =>
          facts.fires.some((fire) => fire.type === 'campfire'),
      },
      {
        id: 'light-it',
        label: 'Light the campfire',
        isDone: (facts) =>
          facts.fires.some((fire) => fire.type === 'campfire' && fire.lit),
      },
    ],
  },
  {
    id: 'make-lean-to',
    title: 'Make Lean-To',
    thread: 'shelter',
    act: 'survival',
    isDone: (facts) =>
      facts.houses.some((house) => house.type === 'leanTo'),
    components: [
      {
        id: 'place-lean-to',
        label: 'Build the lean-to',
        isDone: (facts) =>
          facts.houses.some((house) => house.type === 'leanTo'),
      },
    ],
  },
  {
    id: 'rest',
    title: 'Rest',
    // Shelter with its flag standing (see header): sleep
    // is its own system; rest is what shelter is for.
    thread: 'shelter',
    act: 'survival',
    isDone: (facts) => facts.flags.slept,
    components: [
      {
        id: 'sleep',
        label: 'Sleep through a night',
        isDone: (facts) => facts.flags.slept,
      },
    ],
  },
  {
    id: 'find-flint',
    title: 'Find Flint',
    // Fire as a flagged dual (see header): found by
    // gathering, but its only job is lighting fires.
    thread: 'fire',
    act: 'survival',
    isDone: (facts) => facts.inventory.count('flint') > 0,
    components: [
      {
        id: 'find-flint',
        label: 'Find a piece of flint',
        isDone: (facts) => facts.inventory.count('flint') > 0,
      },
    ],
  },
  {
    id: 'make-torch',
    title: 'Make Torch',
    // Fire as a flagged dual (see header): crafted gear,
    // but a torch is carried fire.
    thread: 'fire',
    act: 'survival',
    isDone: (facts) =>
      facts.inventory.count('torch') > 0 ||
      facts.inventory.count('lit-torch') > 0 ||
      facts.placedTorches > 0,
    componentsMode: 'any',
    components: [
      {
        id: 'carry-torch',
        label: 'Carry a torch',
        isDone: (facts) => facts.inventory.count('torch') > 0,
      },
      {
        id: 'carry-lit-torch',
        label: 'Carry a lit torch',
        isDone: (facts) => facts.inventory.count('lit-torch') > 0,
      },
      {
        id: 'place-torch',
        label: 'Set a torch down',
        isDone: (facts) => facts.placedTorches > 0,
      },
    ],
  },
  {
    id: 'light-torch',
    title: 'Light Torch',
    thread: 'fire',
    act: 'survival',
    isDone: (facts) =>
      facts.inventory.count('lit-torch') > 0 || facts.placedTorches > 0,
    componentsMode: 'any',
    components: [
      {
        id: 'carry-lit-torch',
        label: 'Carry a lit torch',
        isDone: (facts) => facts.inventory.count('lit-torch') > 0,
      },
      {
        id: 'place-torch',
        label: 'Set a torch down',
        isDone: (facts) => facts.placedTorches > 0,
      },
    ],
  },
  {
    id: 'use-stump',
    title: 'Use the Stump',
    thread: 'tools',
    act: 'survival',
    isDone: (facts) => facts.flags.craftedAtStump,
    components: [
      {
        id: 'craft-at-stump',
        label: 'Make something at a stump',
        isDone: (facts) => facts.flags.craftedAtStump,
      },
    ],
  },
  {
    id: 'upgrade-tool',
    title: 'Upgrade Your Tool',
    thread: 'tools',
    act: 'survival',
    isDone: (facts) => facts.ownedToolStage >= 1,
    components: [
      {
        id: 'tool-stage',
        label: 'Own a tool past the garden trowel',
        isDone: (facts) => facts.ownedToolStage >= 1,
      },
    ],
  },
  {
    id: 'gather-clay',
    title: 'Gather Clay',
    thread: 'land',
    act: 'survival',
    isDone: (facts) => facts.inventory.count('clay') > 0,
    components: [
      {
        id: 'gather-clay',
        label: 'Gather clay',
        isDone: (facts) => facts.inventory.count('clay') > 0,
      },
    ],
  },
  {
    id: 'better-house',
    title: 'Build a Better House',
    thread: 'shelter',
    act: 'survival',
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
    componentsMode: 'any',
    components: [
      {
        id: 'thatch-hut',
        label: 'Build a thatch hut',
        isDone: (facts) =>
          facts.houses.some((house) => house.type === 'thatchHut'),
      },
      {
        id: 'woven-cottage',
        label: 'Build a woven cottage',
        isDone: (facts) =>
          facts.houses.some((house) => house.type === 'wovenCottage'),
      },
      {
        id: 'wooden-hut',
        label: 'Build a small wooden hut',
        isDone: (facts) =>
          facts.houses.some((house) => house.type === 'smallWoodenHut'),
      },
    ],
  },
  {
    id: 'find-bone',
    title: 'Find a Bone',
    thread: 'land',
    act: 'survival',
    isDone: (facts) =>
      BONE_ITEM_IDS.some((bone) => facts.inventory.count(bone) > 0),
    components: [
      {
        id: 'find-bone',
        label: 'Find a bone',
        isDone: (facts) =>
          BONE_ITEM_IDS.some((bone) => facts.inventory.count(bone) > 0),
      },
    ],
  },
  {
    id: 'wake-charm',
    title: 'Wake a Charm',
    // ACT II — WITCHERY'S FIRST QUEST (Adam's re-seat,
    // 2026-11-01: 'let's put that into witchery'): the
    // rite was Act I's named misfit for an hour; it has
    // a home now, opening the Wakings fold. The bone
    // road crosses the act line — find-bone stays in
    // The Land, and acts are not gates, so the road
    // walks fine.
    thread: 'wakings',
    act: 'witchery',
    isDone: (facts) => facts.flags.ritualCompleted,
    // THE ROAD, AS COMPONENTS (Adam, 2026-11-01: 'the
    // altar goes in there'): find a bone / raise an
    // altar / wake the charm. The first two are ROAD
    // STEPS, derived so the decomposition stays EXACT:
    // each reads (the rite is done) OR (its own fact),
    // because a completed rite need not still carry its
    // bone, and a Waking can complete at a grade-1 site
    // where no altar was raised — completion must imply
    // every step, or the card would un-check a finished
    // quest. Before completion each step reads its own
    // fact honestly; the steps never gate (isDone is
    // the flag alone, as it always was).
    components: [
      {
        id: 'find-a-bone',
        label: 'Find a bone',
        isDone: (facts) =>
          facts.flags.ritualCompleted ||
          BONE_ITEM_IDS.some((bone) => facts.inventory.count(bone) > 0),
      },
      {
        id: 'raise-an-altar',
        label: 'Raise an altar',
        isDone: (facts) =>
          facts.flags.ritualCompleted || facts.altarRaised === true,
      },
      {
        id: 'wake-the-charm',
        label: 'Wake the charm',
        isDone: (facts) => facts.flags.ritualCompleted,
      },
    ],
  },
];

/** Done state of one quest id (unknown id → false). */
export function isQuestDone(id: string, facts: QuestFacts): boolean {
  return QUEST_DEFINITIONS.find((quest) => quest.id === id)?.isDone(facts) ?? false;
}

/** Done state of all v1 quests, in priority order. */
export function evaluateQuests(
  facts: QuestFacts,
): {
  id: string;
  title: string;
  done: boolean;
  thread: QuestThread;
  act: QuestAct;
}[] {
  return QUEST_DEFINITIONS.map((quest) => ({
    id: quest.id,
    title: quest.title,
    done: quest.isDone(facts),
    thread: quest.thread,
    act: quest.act,
  }));
}

/** The definition for an id (unknown id → undefined). */
export function questById(id: string): QuestDefinition | undefined {
  return QUEST_DEFINITIONS.find((quest) => quest.id === id);
}

/**
 * A quest's components with their done states, for the
 * HUD's active-task card (unknown id → no components).
 */
export function questComponentsFor(
  id: string,
  facts: QuestFacts,
): { id: string; label: string; done: boolean }[] {
  const quest = questById(id);
  if (!quest) return [];
  return quest.components.map((component) => ({
    id: component.id,
    label: component.label,
    done: component.isDone(facts),
  }));
}

/**
 * The components' combined state under the quest's
 * mode. By the decomposition law this EQUALS the
 * quest's own isDone for every facts value (probed) —
 * it exists so a surface can read the card's roll-up
 * without re-deriving the mode; completion itself is
 * always judged by isDone.
 */
export function questComponentsDone(id: string, facts: QuestFacts): boolean {
  const quest = questById(id);
  if (!quest) return false;
  const states = quest.components.map((component) => component.isDone(facts));
  return quest.componentsMode === 'any'
    ? states.some(Boolean)
    : states.every(Boolean);
}
