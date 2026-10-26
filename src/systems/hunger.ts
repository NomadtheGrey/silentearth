/**
 * Silent Earth — hunger system, v1 (player-systems lane).
 *
 * PINNED DIRECTION (Adam, 2026-10-26): a pocket full of food takes
 * care of hunger — she eats carried food. Hungry → she slows down.
 * Too hungry → she cannot harvest or build, EXCEPT her traps, a
 * campfire (cooking things that need it), and nuts and berries.
 *
 * RATES DELEGATION (Adam, 2026-10-26: "I trust you or background
 * to come up with rates"): every number below is a LANE-DECIDED
 * STARTING TUNABLE, flagged as such wherever it appears. None of
 * it is pinned — Adam's pin pass may change any of it. The numbers
 * live as single named constants so a pin-pass change touches one
 * place, never scattered literals.
 *
 * ------------------------------------------------------------------
 * METER + STAGES (one source of truth, same pattern as the
 * owned-tool tier query):
 *
 * - Value 0–100. 100 = fully fed, 0 = empty. Wiring constructs
 *   HungerState with a starting value (full by default; a saved
 *   value on load) and calls tick() as time passes; nothing else
 *   in the game keeps its own hunger value. Background and UI
 *   consume stage() — they do not duplicate this state.
 * - Stages, by value (boundaries: exactly 40 is fed, exactly 15
 *   is hungry, not too-hungry):
 *     fed:       value >= 40
 *     hungry:    15 <= value < 40  → slowdown (Background's half)
 *     too-hungry: value < 15       → lockout (see below)
 * - STAGE VOCABULARY ALIGNMENT (read before wiring): this module
 *   emits exactly the brief's stage names, 'fed' | 'hungry' |
 *   'too-hungry' — the same literals UI's HungerIndicator already
 *   expects. Background's engine consumer (src/game/hunger.ts,
 *   landed 2026-10-26) currently names the lockout stage
 *   'starving' instead, and treats an unrecognized stage as fed
 *   (fail-safe). Background's own doc names their union as the
 *   one place that changes to match Systems' brief — so their
 *   union, TOO_HUNGRY_STAGE, and player.ts's 'starving' check
 *   need the one-word alignment to 'too-hungry' before their
 *   slowdown/lockout activate from this stage. Until that lands,
 *   their halves fail safe to full speed / no lockout — they do
 *   NOT starve the player by accident, and nothing here is
 *   changed to chase their literal (which would break UI's
 *   indicator instead). This is a wiring/alignment step for the
 *   main chat, not a second stage vocabulary.
 * - Drain: full → empty in HUNGER_SECONDS_TO_EMPTY real seconds
 *   (starting tunable). tick() takes REAL seconds; if the game
 *   clock later runs at a different rate, wiring scales the dt it
 *   passes in — this module does not invent a game clock.
 *
 * ------------------------------------------------------------------
 * EAT:
 *
 * - eat() consumes ONE food item from inventory and restores its
 *   nutrition, clamped at 100. It checks before removing anything,
 *   so a failed eat (not food, none carried) leaves inventory and
 *   hunger untouched.
 * - Eating is NEVER gated by hunger stage: eating is the recovery
 *   action, and gating it would deadlock a too-hungry player.
 *   Berries are eaten as gathered, so eat() is always allowed
 *   for them when carried, including at too-hungry (Adam's
 *   too-hungry eating exemption).
 * - GATHER vs EAT (Adam, 2026-10-26, PINNED clarification,
 *   landed in src/game/hunger.ts): the nuts/berries exemption is
 *   about GATHERING. Acorns stay gather-exempt (she can forage
 *   them when too hungry), but EATING them requires the campfire
 *   cooking step — raw acorns must NOT count as eaten food, and
 *   eat() REFUSES raw ACORNS with a cook-required error (nothing
 *   consumed). The cooked form is COOKED_ACORNS, defined by the
 *   fire system (fire.ts, MVP round) — cooking itself is not
 *   hunger-gated (a too-hungry witch can still cook; the fire
 *   module does not check hunger), so the forage → cook → eat
 *   path cannot deadlock.
 * - Food ids are the SHARED CONTRACT with Background's exemption
 *   set, and they are UPPER_SNAKE, matching objects.ts and
 *   Background's HUNGER_EXEMPT_ITEMS — NOT the kebab-case systems
 *   recipe vocabulary. The reason is mechanical, not stylistic:
 *   the harvest listener grants yields into inventory verbatim,
 *   so a player actually carries 'ACORNS', 'BOG_BERRIES',
 *   'ELDERBERRIES'; eat() must consume what harvest grants, or
 *   it would never find food in play. Canonical ids:
 *     'ACORNS' (nuts), 'BOG_BERRIES' (berries),
 *     'ELDERBERRIES' (berries).
 *   v1 defines no other foods. (Food-candidates notes about
 *   elderberries needing cooking / sickening are NOT modelled in
 *   v1: eat() restores plainly for all three. A cook/sicken
 *   distinction is later work, if Adam wants it.)
 *
 * ------------------------------------------------------------------
 * LOCKOUT (Systems' half — crafting/building):
 *
 * - The crafting gate lives in crafting-execution.ts executeCraft
 *   (optional hunger argument): at too-hungry, crafts are blocked
 *   — they throw before anything is consumed. Raw craft() /
 *   craftIntoInventory() stay hunger-agnostic; the gate belongs
 *   to the execution path, not the engine.
 * - Harvest lockout at too-hungry is Background's half (their
 *   harvest listener), using stage() from here. This module
 *   touches no harvest or movement code.
 * - EXCEPTIONS, and where they live (not in the crafting gate):
 *   - Campfire cooking: NOT a craft. Cooking is open-fire work in
 *     the fire system, which does not exist yet — so no cooking
 *     exception belongs in executeCraft. The campfire STRUCTURE
 *     recipe, being a craft, IS gated like any other craft in v1.
 *     The cooking exemption is a future fire-system hook.
 *   - Traps: traps are still brainstorm-stage (draft recipes, no
 *     trap system). No trap exception is built here either; when
 *     the trap system lands, it carries its own too-hungry
 *     exemption (trap use, not trap crafting). Note, don't build.
 * - SLOWDOWN is Background's half (movement speed). This module
 *   exposes stage() for it and touches no movement code.
 */

import type { CraftingInventory } from './crafting';
import type { ItemId } from './recipes';
import { normalizeItemId } from './inventory';

// ---------------------------------------------------------------------------
// Lane-decided starting tunables (NOT pinned — see the header)
// ---------------------------------------------------------------------------

/** Meter range: 0 (empty) to 100 (fully fed). */
export const HUNGER_MAX = 100;

/** Below this value she is hungry (slowdown, Background's half). */
export const HUNGER_HUNGRY_THRESHOLD = 40;

/** Below this value she is too hungry (lockout). */
export const HUNGER_TOO_HUNGRY_THRESHOLD = 15;

/**
 * Real seconds for a full meter to drain to empty, at the default
 * tick rate. Starting tunable: 1800 s = 30 real minutes.
 */
export const HUNGER_SECONDS_TO_EMPTY = 1800;

// ---------------------------------------------------------------------------
// Food — shared contract ids + lane-decided nutrition
// ---------------------------------------------------------------------------

/** Nuts — gather-exempt, but COOK-REQUIRED (see below). */
export const FOOD_ACORNS: ItemId = 'ACORNS';
/** Berries — eaten as gathered. */
export const FOOD_BOG_BERRIES: ItemId = 'BOG_BERRIES';
/** Berries — eaten as gathered. */
export const FOOD_ELDERBERRIES: ItemId = 'ELDERBERRIES';
/**
 * Cooked acorns — the fire-system output (fire.ts). Eaten
 * directly, unlike raw acorns (see COOK_REQUIRED_ITEMS).
 */
export const FOOD_COOKED_ACORNS: ItemId = 'COOKED_ACORNS';

/**
 * Foods eaten directly: berries as gathered, acorns once cooked.
 * SPELLING NOTE (2026-10-26 id fix): these are the NORMALIZED
 * (kebab) ids, derived from the FOOD_* harvest-spelling constants
 * above — because this list's live consumer is App's FOOD_IDS
 * set, matched against panel row ids, and panel rows are
 * normalized stack keys (see inventory.ts). The FOOD_* constants
 * keep the harvest spelling for grant-side callers; every
 * predicate below accepts EITHER spelling, so no caller has to
 * remember which list it holds.
 */
export const FOOD_ITEMS: ReadonlyArray<ItemId> = [
  FOOD_BOG_BERRIES,
  FOOD_ELDERBERRIES,
  FOOD_COOKED_ACORNS,
].map(normalizeItemId);

/**
 * Foods that must be cooked before eating (Adam, 2026-10-26,
 * PINNED — mirrors Background's COOK_REQUIRED_ITEMS): acorns,
 * and only acorns in this set. Raw acorns are not eatable food;
 * eat() refuses them (see below).
 */
export const COOK_REQUIRED_ITEMS: ReadonlyArray<ItemId> = [FOOD_ACORNS];

/**
 * Nutrition restored by eating one of each directly-eatable
 * food. LANE-DECIDED starting tunables (NOT pinned) — cooked
 * acorns included (MVP round, fire.ts output; 20 = the value
 * raw acorns carried in the first hunger draft, now earned
 * through cooking instead of granted raw).
 */
export const FOOD_NUTRITION: Readonly<Record<string, number>> = {
  [FOOD_BOG_BERRIES]: 10,
  [FOOD_ELDERBERRIES]: 15,
  [FOOD_COOKED_ACORNS]: 20,
};

/**
 * Nutrition keyed by NORMALIZED id (derived once from
 * FOOD_NUTRITION, not a second authored table) — so the
 * predicates below accept a food in either spelling: the
 * harvest spelling ('BOG_BERRIES', as a grant-side caller holds
 * it) or the normalized spelling ('bog-berries', as a panel row
 * id holds it). A Map, not a plain object, so prototype names
 * ('constructor', 'toString', ...) are never food.
 */
const NUTRITION_BY_NORMALIZED_ID: ReadonlyMap<string, number> = new Map(
  Object.entries(FOOD_NUTRITION).map(([id, nutrition]) => [
    normalizeItemId(id),
    nutrition,
  ]),
);

/** True for a directly-eatable food (berries in v1), either spelling. */
export function isEatable(item: ItemId): boolean {
  return NUTRITION_BY_NORMALIZED_ID.has(normalizeItemId(item));
}

/** True for a food that must be cooked first (acorns in v1), either spelling. */
export function needsCooking(item: ItemId): boolean {
  return normalizeItemId(item) === normalizeItemId(FOOD_ACORNS);
}

/**
 * True for any food item, eatable or cook-required. (Raw acorns
 * are food — just not food she can eat yet. eat() distinguishes
 * them with a cook-required error, not a not-food error.)
 */
export function isFood(item: ItemId): boolean {
  return isEatable(item) || needsCooking(item);
}

/**
 * Nutrition for a directly-eatable food, or undefined when it is
 * not directly eatable (including cook-required acorns, which
 * have no direct nutrition until the fire system cooks them).
 */
export function nutritionFor(item: ItemId): number | undefined {
  return NUTRITION_BY_NORMALIZED_ID.get(normalizeItemId(item));
}

// ---------------------------------------------------------------------------
// Hunger state
// ---------------------------------------------------------------------------

export type HungerStage = 'fed' | 'hungry' | 'too-hungry';

export class HungerState {
  private hunger: number;

  /** Starts fully fed unless wiring passes a starting/saved value. */
  constructor(initial: number = HUNGER_MAX) {
    if (!Number.isFinite(initial)) {
      throw new Error('Hunger initial value must be a finite number.');
    }
    this.hunger = clampHunger(initial);
  }

  /** Current meter value, 0–100. */
  value(): number {
    return this.hunger;
  }

  /**
   * Current stage — THE query Background and UI consume. Do not
   * keep a second hunger value elsewhere; read this one.
   */
  stage(): HungerStage {
    if (this.hunger < HUNGER_TOO_HUNGRY_THRESHOLD) {
      return 'too-hungry';
    }
    if (this.hunger < HUNGER_HUNGRY_THRESHOLD) {
      return 'hungry';
    }
    return 'fed';
  }

  /** True at the fed stage. */
  isFed(): boolean {
    return this.stage() === 'fed';
  }

  /**
   * True when hungry OR too-hungry (value below the hungry
   * threshold). The slowdown condition: Background slows her
   * whenever this is true, since too-hungry is not faster than
   * hungry — use stage() if the distinction matters.
   */
  isHungry(): boolean {
    return this.hunger < HUNGER_HUNGRY_THRESHOLD;
  }

  /** True only at the too-hungry stage (lockout stage). */
  isTooHungry(): boolean {
    return this.stage() === 'too-hungry';
  }

  /** Drain an absolute amount (clamped at 0). */
  drain(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Drain amount must be a finite non-negative number.');
    }
    this.hunger = clampHunger(this.hunger - amount);
  }

  /**
   * Advance time: drain for `seconds` real seconds at the default
   * rate (full → empty in HUNGER_SECONDS_TO_EMPTY). Wiring scales
   * `seconds` if the game clock runs at a different rate.
   */
  tick(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error('Tick seconds must be a finite non-negative number.');
    }
    this.drain((HUNGER_MAX * seconds) / HUNGER_SECONDS_TO_EMPTY);
  }

  /** Restore hunger by an absolute amount (clamped at 100). */
  restore(amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Restore amount must be a finite non-negative number.');
    }
    this.hunger = clampHunger(this.hunger + amount);
  }
}

function clampHunger(value: number): number {
  return Math.max(0, Math.min(HUNGER_MAX, value));
}

// ---------------------------------------------------------------------------
// Eat
// ---------------------------------------------------------------------------

export interface EatResult {
  item: ItemId;
  /** Nutrition restored (the food's table value, before clamping). */
  nutrition: number;
  hungerBefore: number;
  hungerAfter: number;
  /** Stage after eating. */
  stage: HungerStage;
}

/**
 * Eat one carried food item. Never gated by hunger stage (eating
 * is the recovery action; see the header). Checks before removing
 * anything, so a failed eat leaves inventory and hunger untouched.
 * Raw cook-required food (acorns) is refused with a cook-required
 * error — it is food, just not eatable yet — and stays in
 * inventory for the future fire system's cooking step. Returns
 * the post-eat stage for UI/Background feedback.
 */
export function eat(
  hunger: HungerState,
  inventory: CraftingInventory,
  item: ItemId,
): EatResult {
  if (needsCooking(item)) {
    throw new Error(
      `Cannot eat ${item}: it must be cooked first (campfire ` +
        `cooking, future fire system).`,
    );
  }
  const nutrition = nutritionFor(item);
  if (nutrition === undefined) {
    throw new Error(`Cannot eat ${item}: not a food item.`);
  }
  if (inventory.count(item) < 1) {
    throw new Error(`Cannot eat ${item}: none carried.`);
  }
  const hungerBefore = hunger.value();
  inventory.remove(item, 1);
  hunger.restore(nutrition);
  return {
    item,
    nutrition,
    hungerBefore,
    hungerAfter: hunger.value(),
    stage: hunger.stage(),
  };
}
