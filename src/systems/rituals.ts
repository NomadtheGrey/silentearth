// RITUAL RECIPES + PROCESSES — TIER-1 WAKING ONLY (Adam,
// DEV chat 2026-10-27: "it's time to build out these
// recipes and processes").
//
// SCOPE, stated plainly: tier-1 Waking ONLY. Tier 2 is
// NOT built (Adam's tier-2 idea unshared — do not build
// tier 2). This file is (1) the ritual recipe DATA as code
// + (2) the staging + completion LOGIC. Ritual EXECUTION
// beyond staging/completion (the awakening's in-world
// effects) + the altar DISPLAY UI ride the later ritual
// build, not this one.
//
// DATA SOURCE: the consult determination (~/workspace/
// silent-earth/docs/ritual-recipes-2026-10-27.md, local
// doc — all DRAFT for Adam's pin pass). The set below is
// that determination as code: 20 Waking recipes (every
// determined kind EXCEPT shrew skull — the first charm is
// given OUTRIGHT, no ritual; see charms.ts). Muskrat,
// opossum, and vole joined 2026-10-31 (Adam: "let's put
// the bones in for those creatures") so the awakening
// road — and the companion name-gate that reads it —
// covers every feedable kind but squirrel.
//
// NOT IN recipes.ts — DELIBERATELY: RECIPES has no status
// filter, so ritual recipes there would become craftable
// by hand, which is wrong. Rituals live in this separate
// ritual store, never in the crafting menu.
//
// RECIPE SHAPE (brief's shape, carried as data):
// { ritual 'waking', boneKind design key, tier 1, bone 1
// + any-food 1, spokenName minLooks 1, sky per kind }.
// boneKind is a DESIGN key (e.g. 'owl-talon'), NOT an
// inventory item id — bone item ids land with the bone
// build (mapping rule, documented: 'primal-bone-<kind>').
// Do NOT invent bone ids here. The one exception is the
// first charm's id (charms.ts), which UI needs on landing.
//
// EXTRAS + SUBSTITUTES (brief: shape must ALLOW them,
// nothing locked): recipes carry an OPTIONAL extras list
// (empty until Adam pins an extra — sky-independent kinds
// carry theirs when pinned; candidates spitballed, NOT
// pinned, so no extras are locked here). An extra is
// { key, items, substitutes? } — satisfied by any listed
// item or substitute. The offering's substitutes are all
// foods by definition (any-food = every FOOD_ITEMS id
// substitutes for every other). Staging tracks done
// extras by key; a recipe with no extras is extras-done
// vacuously (extrasDone starts true — see RitualStaging).
//
// STAGING + COMPLETION (brief's logic):
// bone placed on site + offering given + name spoken +
// extras done = STAGED. Completion = staged + sky window
// open. READING (state-based, flagged): the check is a
// STATE (staged + window currently open), not a
// transition — staging completed MID-window completes
// immediately (a window that fully passes while something
// is missing is MISSED → waits for the NEXT window).
// Sky 'none' → window always open → immediate on
// all-offered. A strict arrival-only reading (mid-window
// staging waits a full cycle) would be punitive and is
// NOT the rule; if Adam wants it, the seam is
// checkCompletion below (one-line change).
//
// SHELL CONTRACTS (Systems logic is pure state — the
// shell owns the world moves, documented, not assumed):
// - Inventory moves at each step are the shell's: the
//   shell consumes the offering iff giveOffering accepts.
// - PLACE-BONE CONSUMES (2026-10-28 bone build — UI gap
//   #3 CLOSED): shells stage a bone via
//   stageBoneFromInventory (possession check + consume
//   1 bone), NOT raw RitualStaging.placeBone (a
//   record-only primitive — calling it without consuming
//   is a shell bug: the bone would be both carried and
//   staged). One-bone-per-site (ritualSite) is NOT
//   enforced here (Systems never imports game) — the
//   shell checks the ritualSite snapshot first (refuse,
//   or replace + clear the old StagingBook entry).
// - Sky facts arrive as INPUT (systems never imports
//   game): phase from cycleSplit/cyclePhase + moonPhase
//   from currentMoonPhase. TRAP (documented): day means
//   phase === 'day' STRICTLY — isDay must NOT be used,
//   or dawn/dusk would leak into day (dawn's day-side
//   half is day per the sky model, but dawn is its own
//   ritual condition).
// - Looks arrive as INPUT from NameSight (shell queries
//   looksAt(kind)); speakName enforces minLooks itself.
// - PICKUP vs LOOK (RULED, Adam 2026-10-28: "picking
//   it up is sufficient, counts as a look" — SUPERSEDES
//   the 2026-10-28 shaping, which recommended
//   inventory-LOOK and is NOT the rule): a bone pickup
//   records 1 LOOK at the kind (charms.
//   recordBonePickupLook — shell calls it after every
//   successful bone pickup grant); pickup ALONE
//   satisfies speakName's minLooks 1. No separate world
//   LOOK required before speaking; no inventory LOOK
//   required either (world/inventory LOOKs still deepen
//   name portions as before — they are no longer a
//   gate for speaking).
// - Site keys are caller-defined (altar ids 'altar:N' or
//   the stump's key — Background's call); staging keys on
//   (siteKey, boneKind).
// - Dawn/dusk windows LANDED in the sky model (Fill-in
//   d7196c7: TWILIGHT_DEG 8° band, CyclePhase, cyclePhase
//   / cycleSplit) — the consult's twilight follow-up is
//   CLOSED. Twilight windows are BRIEF (~half a real
//   minute per window at the 10-minute day): staging
//   should be done BEFORE the window — the altar
//   display's time line exists so she can prepare.
// - Completion's effect (the awakening record) is the
//   shell's to apply: complete() returns { kind, tier }
//   and the shell records it via charms.ts (awaken).
//
// SAVE (trap-save pattern: format now, App wiring later):
// StagingBook.snapshot() / restore() carry stagings
// (boot-only, clears + rebuilds, bad entries dropped).
// SaveData.stagings (save.ts) carries the snapshot.
//

import { FOOD_ITEMS } from './hunger';
import { normalizeItemId } from './inventory';
import type { PersonalInventory } from './inventory';
import { boneItemFor } from './charms';

/** Sky/time condition kinds for Waking rituals. */
export type SkyCondition =
  | 'day'
  | 'night'
  | 'dawn'
  | 'dusk'
  | 'full-moon'
  | 'none';

/** Sky phase, mirror of game CyclePhase by literal (systems never imports game). */
export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night';

/**
 * Sky facts the shell supplies (cycleSplit/cyclePhase +
 * currentMoonPhase). moonPhase null = unknown → the
 * full-moon window reads CLOSED (never complete on an
 * unknown sky — safe default, documented).
 */
export interface SkyFacts {
  phase: SkyPhase;
  moonPhase: number | null;
}

/** An optional extra requirement (shape only — none pinned yet). */
export interface RitualExtra {
  key: string;
  items: string[];
  substitutes?: string[];
}

/** A tier-1 Waking recipe (data, all DRAFT for pin pass). */
export interface RitualRecipe {
  ritual: 'waking';
  boneKind: string;
  tier: 1;
  /** Offering: any food, 1, consumed (all foods substitute). */
  offering: 'any-food';
  /** Spoken name: minimum LOOKs at the bone kind (family known). */
  spokenName: { minLooks: number };
  sky: SkyCondition;
  /** Optional extras (empty until Adam pins one). */
  extras?: RitualExtra[];
}

/**
 * Full-moon window = the full octant of moonPhaseName
 * (mirror by literal): phase in [START, END). About 3.7
 * game-days per 29.5-day cycle — a multi-night window.
 */
export const FULL_MOON_START = 0.4375;
export const FULL_MOON_END = 0.5625;

/** Is the recipe's sky window open under these sky facts? */
export function windowOpen(sky: SkyCondition, facts: SkyFacts): boolean {
  switch (sky) {
    case 'day':
      return facts.phase === 'day';
    case 'night':
      return facts.phase === 'night';
    case 'dawn':
      return facts.phase === 'dawn';
    case 'dusk':
      return facts.phase === 'dusk';
    case 'full-moon': {
      if (facts.moonPhase === null) return false;
      const p = ((facts.moonPhase % 1) + 1) % 1;
      return p >= FULL_MOON_START && p < FULL_MOON_END;
    }
    case 'none':
      return true;
  }
}

function recipe(
  boneKind: string,
  sky: SkyCondition,
): RitualRecipe {
  return {
    ritual: 'waking',
    boneKind,
    tier: 1,
    offering: 'any-food',
    spokenName: { minLooks: 1 },
    sky,
  };
}

/**
 * The determined tier-1 Waking set (consult doc — all
 * DRAFT). Grouped by sky. Shrew skull is ABSENT
 * deliberately (outright first charm, no ritual).
 */
export const RITUAL_RECIPES: readonly RitualRecipe[] = [
  // DAY (sun).
  recipe('pigeon-wing-bone', 'day'),
  recipe('snake-vertebra', 'day'),
  recipe('turtle-shell-fragment', 'day'),
  recipe('crow-beak', 'day'),
  // NIGHT.
  recipe('owl-talon', 'night'),
  recipe('bat-wing-bone', 'night'),
  recipe('mouse-spine', 'night'),
  recipe('raccoon-tooth', 'night'),
  recipe('groundhog-tooth', 'night'),
  recipe('opossum-crest', 'night'),
  // TWILIGHT.
  recipe('fox-femur', 'dusk'),
  recipe('deer-antler-tip', 'dawn'),
  recipe('muskrat-tail', 'dusk'),
  // MOON PHASE.
  recipe('wolf-tooth', 'full-moon'),
  // SKY-INDEPENDENT (no time line on display).
  recipe('frog-pelvis', 'none'),
  recipe('mole-paw', 'none'),
  recipe('bear-claw', 'none'),
  recipe('rabbit-jaw', 'none'),
  recipe('beaver-incisor', 'none'),
  recipe('vole-skull', 'none'),
];

/** Find a Waking recipe by bone kind (undefined when none — e.g. shrew). */
export function ritualRecipeFor(boneKind: string): RitualRecipe | undefined {
  return RITUAL_RECIPES.find((r) => r.boneKind === boneKind);
}

/** One staging's saved shape (see StagingBook.snapshot). */
export interface SavedRitualStaging {
  siteKey: string;
  boneKind: string;
  bonePlaced: boolean;
  offeringGiven: boolean;
  nameSpoken: boolean;
  extrasDone: string[];
  completed: boolean;
}

/** Step result: ok = the step was recorded; reason is player-facing on failure. */
export interface StepResult {
  ok: boolean;
  reason?: string;
}

/**
 * One bone's Waking staging at one site. Pure state —
 * the shell owns inventory moves (see header contracts).
 * Each step records once; repeats are refused with a
 * reason (a second offering does not double-count, a
 * second speaking does not re-speak).
 */
export class RitualStaging {
  readonly siteKey: string;
  readonly boneKind: string;
  bonePlaced = false;
  offeringGiven = false;
  nameSpoken = false;
  extrasDone: string[] = [];
  completed = false;

  constructor(siteKey: string, boneKind: string) {
    this.siteKey = siteKey;
    this.boneKind = boneKind;
  }

  /** Record the bone placed on the site (shell verifies possession — see header). */
  placeBone(): StepResult {
    if (this.bonePlaced) return { ok: false, reason: 'Bone already placed.' };
    this.bonePlaced = true;
    return { ok: true };
  }

  /**
   * Record the offering given. Validates the food FIRST
   * (normalized id in FOOD_ITEMS — poison is not food,
   * raw acorns are not food): the shell consumes the
   * food item iff this accepts.
   */
  giveOffering(foodItem: string): StepResult {
    if (this.offeringGiven) {
      return { ok: false, reason: 'Offering already given.' };
    }
    const normalized = normalizeItemId(foodItem);
    if (!(FOOD_ITEMS as readonly string[]).includes(normalized)) {
      return { ok: false, reason: 'That is not food to offer.' };
    }
    this.offeringGiven = true;
    return { ok: true };
  }

  /** Record the name spoken (looks from NameSight — shell supplies the count). */
  speakName(looks: number, minLooks: number): StepResult {
    if (this.nameSpoken) {
      return { ok: false, reason: 'Name already spoken.' };
    }
    if (looks < minLooks) {
      return { ok: false, reason: 'She does not know its name yet.' };
    }
    this.nameSpoken = true;
    return { ok: true };
  }

  /** Record one extra done (key must be a recipe extra key). */
  markExtraDone(key: string, recipe: RitualRecipe): StepResult {
    const extras = recipe.extras ?? [];
    if (!extras.some((e) => e.key === key)) {
      return { ok: false, reason: 'That is not part of this ritual.' };
    }
    if (this.extrasDone.includes(key)) {
      return { ok: false, reason: 'That is already done.' };
    }
    this.extrasDone.push(key);
    return { ok: true };
  }

  /** All four staged? (Extras vacuous when the recipe has none.) */
  isStaged(recipe: RitualRecipe): boolean {
    const extras = recipe.extras ?? [];
    return (
      this.bonePlaced &&
      this.offeringGiven &&
      this.nameSpoken &&
      extras.every((e) => this.extrasDone.includes(e.key))
    );
  }

  /** Pure check: staged + sky window open (state-based reading — see header). */
  checkCompletion(recipe: RitualRecipe, facts: SkyFacts): boolean {
    return this.isStaged(recipe) && windowOpen(recipe.sky, facts);
  }

  /**
   * Complete the Waking: marks completed + returns the
   * awakening for the shell to record (charms.awaken).
   * Null when not completable (unstaged, window closed,
   * or already completed — idempotent, no double-awaken).
   */
  complete(
    recipe: RitualRecipe,
    facts: SkyFacts,
  ): { kind: string; tier: number } | null {
    if (this.completed) return null;
    if (!this.checkCompletion(recipe, facts)) return null;
    this.completed = true;
    return { kind: recipe.boneKind, tier: recipe.tier };
  }

  /** Snapshot for save (copies). */
  snapshot(): SavedRitualStaging {
    return {
      siteKey: this.siteKey,
      boneKind: this.boneKind,
      bonePlaced: this.bonePlaced,
      offeringGiven: this.offeringGiven,
      nameSpoken: this.nameSpoken,
      extrasDone: [...this.extrasDone],
      completed: this.completed,
    };
  }
}

/**
 * Stage a bone from the carried inventory onto a site
 * (THE shell path for placing — see header contracts).
 * Order: recipe exists? -> not already placed? -> bone
 * carried? -> consume 1 + record. Refusals consume
 * NOTHING. No-recipe kinds refuse (shrew: no Waking —
 * the found-bone stacking question stays open, flagged;
 * unknown kinds likewise). One-bone-per-site is the
 * shell's check (ritualSite snapshot first), not this
 * function's — Systems never imports game.
 */
export function stageBoneFromInventory(
  inventory: PersonalInventory,
  book: StagingBook,
  siteKey: string,
  boneKind: string,
): { staged: boolean; reason?: string } {
  const recipe = ritualRecipeFor(boneKind);
  if (!recipe) {
    return { staged: false, reason: 'No Waking for this bone.' };
  }
  const staging = book.getOrCreate(siteKey, boneKind);
  if (staging.bonePlaced) {
    return { staged: false, reason: 'Bone already placed.' };
  }
  const item = boneItemFor(boneKind);
  if (inventory.count(item) < 1) {
    return { staged: false, reason: 'No such bone carried.' };
  }
  inventory.remove(item, 1);
  const recorded = staging.placeBone();
  if (!recorded.ok) {
    // Defensive rollback (unreachable: bonePlaced was
    // just checked false, single-threaded) — the bone
    // goes back rather than vanishing.
    inventory.add(item, 1);
    return { staged: false, reason: recorded.reason };
  }
  return { staged: true };
}

/**
 * All stagings, keyed (siteKey, boneKind). Snapshot /
 * restore carry the save shape (boot-only restore:
 * clears + rebuilds, bad entries dropped).
 */
export class StagingBook {
  private stagings = new Map<string, RitualStaging>();

  private static key(siteKey: string, boneKind: string): string {
    return `${siteKey}::${boneKind}`;
  }

  getOrCreate(siteKey: string, boneKind: string): RitualStaging {
    const key = StagingBook.key(siteKey, boneKind);
    let staging = this.stagings.get(key);
    if (!staging) {
      staging = new RitualStaging(siteKey, boneKind);
      this.stagings.set(key, staging);
    }
    return staging;
  }

  get(siteKey: string, boneKind: string): RitualStaging | undefined {
    return this.stagings.get(StagingBook.key(siteKey, boneKind));
  }

  /** Snapshot for save (insertion order, copies). */
  snapshot(): SavedRitualStaging[] {
    return [...this.stagings.values()].map((s) => s.snapshot());
  }

  /**
   * Boot restore only: clears and rebuilds from valid
   * entries (non-empty siteKey/boneKind + boolean flags +
   * string[] extrasDone; bad entries dropped). Never
   * call mid-game over live stagings.
   */
  restore(entries: readonly SavedRitualStaging[]): void {
    this.stagings.clear();
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.siteKey !== 'string' || entry.siteKey === '') continue;
      if (typeof entry.boneKind !== 'string' || entry.boneKind === '') continue;
      if (
        typeof entry.bonePlaced !== 'boolean' ||
        typeof entry.offeringGiven !== 'boolean' ||
        typeof entry.nameSpoken !== 'boolean' ||
        typeof entry.completed !== 'boolean'
      ) {
        continue;
      }
      if (
        !Array.isArray(entry.extrasDone) ||
        entry.extrasDone.some((e) => typeof e !== 'string')
      ) {
        continue;
      }
      const staging = new RitualStaging(entry.siteKey, entry.boneKind);
      staging.bonePlaced = entry.bonePlaced;
      staging.offeringGiven = entry.offeringGiven;
      staging.nameSpoken = entry.nameSpoken;
      staging.extrasDone = [...entry.extrasDone];
      staging.completed = entry.completed;
      this.stagings.set(
        StagingBook.key(entry.siteKey, entry.boneKind),
        staging,
      );
    }
  }
}
