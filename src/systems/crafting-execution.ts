/**
 * Silent Earth — crafting execution (player-systems lane).
 *
 * The helper App wiring calls to actually run a craft against the
 * real inventory. No UI, no game files, no imports from src/game/*.
 *
 * ------------------------------------------------------------------
 * CORRECTION (Adam, 2026-10-26) — NO EQUIPPING. This file was
 * revised after the held-tool correction: owning the tool is
 * sufficient to use it, so there is no held/equipped slot, no equip
 * action, and no equip step after crafting. executeCraft takes NO
 * held-tool argument anymore. The owned tier is read from the
 * inventory after the craft (see ./owned-tool.ts): crafting a tool
 * sets the owned tier by putting the tool in inventory, and
 * upgrading advances it because the upgrade consumed its
 * predecessor. The previous HeldToolState parameter and equip step
 * are gone, and held-tool.ts is deleted in the same landing.
 *
 * STEP 1 NOTE: the Trundle-Tool +50 pin is ALREADY LIVE and is NOT
 * redone here. It landed earlier (WIP 264c097,
 * TRUNDLE_TOOL_BONUS = 50 in inventory.ts). This file builds on it
 * and changes no capacity number.
 *
 * ------------------------------------------------------------------
 * executeCraft — what it guarantees, in order:
 *
 * 1. STATION ENFORCED, FROM INPUT ONLY. Station presence arrives as
 *    the `station` argument — this helper NEVER computes proximity,
 *    distance, or world state. The wiring layer (fed by Background's
 *    proximity) translates whatever presence it knows into this
 *    argument before calling. Two shapes are accepted, so wiring
 *    does not have to guess which one this helper wants:
 *      - a single station (or null): the station she is crafting at;
 *      - an array of stations: every station present where she
 *        stands (e.g. near both a workstation and a kiln).
 *    A recipe with a stated station (workstation / kiln / fire)
 *    requires that station to be present; 'hand' recipes pass from
 *    any input, including null; recipes with NO stated station
 *    (prototype recipes the prototype gives no workstation
 *    requirement for) pass from any input — "unstated" is not
 *    "hand", and this helper invents no requirement for them.
 *    A missing required station throws BEFORE anything is consumed,
 *    naming the required station and what was present.
 *
 * 2. CAPACITY-SAFE, VIA THE EXISTING PATH. The craft itself runs
 *    through craftIntoInventory (inventory.ts), which simulates the
 *    whole craft on a clone first: an ingredient shortfall OR an
 *    output that would overflow a full pack throws with the real
 *    inventory untouched. A full pack therefore cannot eat
 *    ingredients — the failure the raw craft() path risks.
 *
 * 3. OWNED TIER FOLLOWS THE CRAFT, WITH NO EXTRA STEP. After a
 *    successful craft, the result reports the owned tier, stage,
 *    and stage name read fresh from the inventory (owned-tool.ts).
 *    No state is updated by hand: a crafted tool is in inventory,
 *    so it is owned; an upgraded tool replaced its predecessor in
 *    inventory, so the tier advanced. Crafting anything else leaves
 *    the owned tier exactly where it was. A failed craft leaves the
 *    inventory — and therefore the owned tier — untouched.
 *
 * 4. NO OWNED-TOOL GATE ON CRAFTING — except a recipe's own
 *    requiresToolStage. Upgrade predecessors are inventory-based
 *    (crafting.ts), not owned-tier-based: crafting an upgrade does
 *    not require owning any particular tier, only holding the
 *    predecessor in inventory. The ONE exception (Adam,
 *    2026-10-26): a recipe may state requiresToolStage, a
 *    minimum owned stage enforced here before anything is
 *    consumed (pitfall: stage 1, spade tier or better). This is
 *    NOT an upgrade-predecessor gate and NOT a literal item
 *    requirement — it reads the owned stage, so upgrading past
 *    the required tool never locks the recipe out.
 *
 * 5. TRAP CRAFTS REPORT, THEY DON'T GRANT — AND THEY DON'T
 *    PLACE OR EMIT EITHER (Adam, 2026-10-26; DEV correction,
 *    superseding the emit half of the original brief).
 *    A recipe with placesTrap set (all five traps) never enters
 *    inventory: on a confirmed craft this helper consumes the
 *    ingredients and reports success via placedTrap {type}.
 *    The one grant on this path is a recipe's stated SPOIL
 *    (the pitfall's dirt, 2026-11-01 — see the spoil field):
 *    granted by addPartial and reported, never the trap
 *    itself. It does not place, and it does not emit
 *    'trap:placed' (the earlier callback-emit shape from
 *    e37234e/762af40 is REMOVED by this landing). SINGLE-CALLER
 *    RULE: the SHELL calls trapState.placeTrap(type, player.x,
 *    player.z) on a placedTrap result — that call is the one
 *    and only placer (it stores the trap and emits the event;
 *    the renderer reads trapState). Systems in the emit path
 *    would risk a second place per craft, so Systems stays out
 *    of it entirely. The shell's "Place trap here?" confirm
 *    gates BEFORE this helper runs (No = abort, nothing
 *    consumed). Placing takes no capacity check: nothing enters
 *    the pack, so a full pack never blocks a placement.
 *    Hunger/station/tool-stage gates still apply in their usual
 *    order — trap CRAFTING is still building, so too-hungry
 *    still blocks it; the too-hungry trap exemption covers trap
 *    USE, once the set/check system exists, not trap crafting.
 *
 * 6. STUMP-UPGRADE CRAFTS REPORT, THEY DON'T GRANT — AND THEY
 *    DON'T TRANSFORM OR EMIT EITHER (Systems, 2026-10-28 — the
 *    Stumpy Workstation fix; trap-report precedent). A recipe
 *    with upgradesStump set (stumpy-workstation) never enters
 *    inventory: on a craft at a stump this helper consumes the
 *    ingredients and reports success via upgradedStump {type} —
 *    and NOTHING else. It does not transform the anchor, and
 *    it does not emit. SINGLE-CALLER RULE: the SHELL transforms
 *    the FACED stump via Background's anchor primitive on an
 *    upgradedStump result — that call is the one and only
 *    transformer. The anchor is NOT consumed (transformation,
 *    not harvest — pinned constraint); the stump's station
 *    presence is unchanged ('workstation' before and after);
 *    trundle-move is preserved (anchor property, Background's
 *    transform must not drop it); the splitting-wood bonus keys
 *    on the upgraded state when splitting lands (no numbers
 *    now — nothing to attach them to). The recipe's station
 *    gate ('workstation') IS the presence condition — presence
 *    comes solely from stumps today — so the entry crafts only
 *    AT a stump. The double-upgrade guard is shell-side
 *    (Systems cannot read anchor state): at an already-upgraded
 *    stump the entry must not execute. Upgrading takes no
 *    capacity check (nothing enters the pack). Hunger/station/
 *    tool-stage gates still apply in their usual order.
 *    Additions-aware (Adam, 2026-10-28): the workstation is ONE
 *    addition on the stump anchor, not an exclusive flag — other
 *    additions (e.g. altar) coexist; this report path is
 *    workstation-specific, the altar rides the ritual system.
 *
 * ------------------------------------------------------------------
 * PINNED CONSTRUCTION (Adam, main chat 2026-10-27, "for
 * simplicity"): LARGE BASKET REPLACES SMALL BASKET. Total
 * with pockets + apron + large = 70; the small basket's +25
 * does NOT stack with the large basket's 50. The former
 * temporary wiring inventory is DELETED — shell construction
 * is direct, with the pinned mode passed explicitly (no
 * silent default was added to the model — the constructor
 * still requires largeBasketMode, and wiring passes
 * 'replace').
 *
 *   new PersonalInventory({ largeBasketMode: 'replace', initial })
 */

import {
  canCraft,
  craftOwnershipStatus,
  CRAFT_OWNERSHIP_LABELS,
} from './crafting';
import {
  craftIntoInventory,
  displayNameFor,
  normalizeItemId,
  PersonalInventory,
} from './inventory';
import { RECIPES } from './recipes';
import type { HungerState } from './hunger';
import {
  ownedStage,
  ownedStageName,
  ownedTier,
  ownedToolItem,
  type BackgroundToolTier,
  type HarvestStageName,
  type OwnedToolItem,
} from './owned-tool';
import type {
  CraftingStation,
  ItemId,
  Recipe,
  SiteFacts,
} from './recipes';

/**
 * Station presence, as passed in by wiring. Single station (or
 * null) = the station she is crafting at; array = stations present.
 * Never computed here — see the header.
 */
export type StationInput = CraftingStation | CraftingStation[] | null;

export interface CraftExecutionResult {
  /**
   * What was crafted. When `placedTrap` or `upgradedStump` is
   * present, this output was NOT added to inventory — the shell
   * must not treat it as a grant (it is carried here for
   * feedback naming only), and must place / transform via
   * trapState.placeTrap or Background's anchor primitive
   * (see header points 5–6).
   */
  output: { item: ItemId; quantity: number };
  /**
   * Present only for placesTrap crafts: the trap's type (recipe
   * id — == its output item for all five traps). The shell
   * places it: trapState.placeTrap(type, player.x, player.z).
   * Systems never places and never emits. Absent for every
   * ordinary grant craft.
   */
  placedTrap?: { type: string };
  /**
   * Present only for upgradesStump crafts: the upgraded
   * workbench's type (recipe id — == its output item, as with
   * traps). The shell transforms the FACED stump via
   * Background's anchor primitive on this result (single-caller
   * rule, trap precedent). Systems never transforms and never
   * emits. Absent for every ordinary grant craft. The anchor is
   * NOT consumed; station presence unchanged; trundle-move
   * preserved (Background's transform); the double-upgrade
   * guard is shell-side (Systems cannot read anchor state).
   */
  upgradedStump?: { type: string };
  /**
   * Present only when the recipe states spoil (the
   * pitfall's dirt): what the craft threw up, granted
   * into the pack by addPartial after consumption.
   * `granted` is what the pack took; `remainder` is
   * what did not fit — the shell piles it at her feet
   * (the pit's edge); it is never voided. Absent for
   * every spoil-less craft.
   */
  spoil?: { item: ItemId; granted: number; remainder: number };
  /** Owned tool after the craft, read from inventory ('none' if none). */
  owned: OwnedToolItem;
  /** Background-compatible tier of the owned tool, null for none. */
  toolTier: BackgroundToolTier | null;
  /** Harvest stage of the owned tool (-1 none, 0–3). */
  harvestStage: number;
  /** Plain-language tier name of the owned tool. */
  stageName: HarvestStageName;
}

function presentStations(input: StationInput): Set<CraftingStation> {
  if (input === null) {
    return new Set();
  }
  return new Set(Array.isArray(input) ? input : [input]);
}

function describePresent(present: Set<CraftingStation>): string {
  return present.size === 0 ? 'none' : [...present].join(', ');
}

/**
 * Run one craft against the real inventory, with station
 * requirements enforced from the input and capacity safety from
 * craftIntoInventory. Reports the owned tier read fresh from the
 * inventory after the craft. Throws (inventory — and therefore
 * owned tier — untouched) on a missing station, an ingredient
 * shortfall, or a capacity overflow.
 *
 * HUNGER GATE (Adam, 2026-10-26: too hungry → cannot build): when
 * a HungerState is passed and it is at the too-hungry stage, the
 * craft is blocked — it throws before anything is consumed, so a
 * blocked craft eats no ingredients. The gate is checked FIRST,
 * before the station gate, so a too-hungry attempt reports hunger
 * rather than station. Omitting hunger leaves the gate OFF
 * (transitional, for callers not yet tracking hunger) — shell
 * wiring MUST pass the hunger state for the lockout to bite in
 * play. The gate applies to EVERY recipe through this helper,
 * including the campfire STRUCTURE recipe: campfire COOKING is
 * not a craft (open-fire, future fire system), so no cooking
 * exception belongs here, and trap recipes get no exception
 * either (traps are brainstorm-stage; their exemption, when the
 * trap system lands, is trap use, not trap crafting).
 */
export function executeCraft(
  recipe: Recipe,
  inventory: PersonalInventory,
  station: StationInput = null,
  hunger: HungerState | null = null,
  nearCreek: boolean | null = null,
  site: SiteFacts | null = null,
): CraftExecutionResult {
  // Ownership gate, FIRST (before hunger): an already-owned
  // or superseded recipe refuses with Adam's label and
  // consumes nothing. Ownership is a recipe+inventory
  // fact, not her state — it outranks the hunger message.
  // canCraft reports the same status (ok=false) for the
  // menu; this gate is the enforcement, never UI-only.
  const ownership = craftOwnershipStatus(recipe, inventory);
  if (ownership !== 'available') {
    throw new Error(
      `Cannot craft ${recipe.name}: ` +
        `${CRAFT_OWNERSHIP_LABELS[ownership]}.`,
    );
  }

  // Hunger gate, before anything is consumed.
  if (hunger !== null && hunger.isTooHungry()) {
    throw new Error(
      `Cannot craft ${recipe.name}: too hungry to craft ` +
        `(hunger ${hunger.value()}, stage too-hungry). ` +
        `Eat carried food first.`,
    );
  }

  const present = presentStations(station);

  // Station gate, before anything is consumed. 'hand' and unstated
  // recipes pass from any input; any other stated station must be
  // present.
  if (
    recipe.station !== undefined &&
    recipe.station !== 'hand' &&
    !present.has(recipe.station)
  ) {
    throw new Error(
      `Cannot craft ${recipe.name}: requires station ` +
        `${recipe.station}, but present stations are ` +
        `${describePresent(present)}.`,
    );
  }

  // Owned-tool-stage gate, before anything is consumed. A stated
  // requiresToolStage reads the owned stage (owned-tool.ts) —
  // never a literal item — so a spade-axe or trundle-tool holder
  // with no 'spade' item in inventory still passes a stage-1
  // requirement. Mirrors canCraft's gate; the engine's own check
  // then agrees by construction.
  if (recipe.requiresToolStage !== undefined) {
    const heldStage = ownedStage(inventory);
    if (heldStage < recipe.requiresToolStage) {
      throw new Error(
        `Cannot craft ${recipe.name}: requires owned tool stage ` +
          `${recipe.requiresToolStage} or better, have stage ${heldStage}.`,
      );
    }
  }

  // Creek gate, before anything is consumed. A stated
  // requiresCreek reads creek proximity from INPUT only
  // (same input-only shape as the station gate — Systems
  // never computes proximity). Null / omitted input leaves
  // the gate OFF (transitional, like hunger omitted):
  // until Background's water adapter lands, the shell
  // cannot compute creek proximity, so the recipe crafts
  // by hand anywhere meanwhile. When the input is supplied
  // and false, the craft refuses before consuming anything.
  if (recipe.requiresCreek === true && nearCreek === false) {
    throw new Error(
      `Cannot craft ${recipe.name}: requires creek water — craft near a creek.`,
    );
  }

  // Site gate (fork B, Adam 2026-11-01), before anything is
  // consumed. A stated requiresSite reads where she stands
  // from INPUT only (the creek gate's shape — Systems never
  // computes where she stands). Null / omitted input leaves
  // the gate OFF (transitional, like the creek gate until
  // the water adapter lands). For a placesTrap recipe the
  // craft IS the placement, so this gate is the trap's
  // placement rule. Refusal copy is DRAFT for the pin pass.
  if (site !== null && recipe.requiresSite !== undefined) {
    if (recipe.requiresSite === 'in-water' && !site.inWater) {
      throw new Error(
        `Cannot craft ${recipe.name}: built standing in the ` +
          `water — step into the creek first.`,
      );
    }
    if (recipe.requiresSite === 'dry-land' && site.inWater) {
      throw new Error(
        `Cannot craft ${recipe.name}: set on dry ground — ` +
          `step out of the water first.`,
      );
    }
  }

  // Engine station for craftIntoInventory: the required station when
  // one is stated (it is present, per the gate above), otherwise the
  // single input station when there is one, otherwise null. The
  // engine's own check then agrees with the gate above by
  // construction.
  const engineStation: CraftingStation | null =
    recipe.station !== undefined && recipe.station !== 'hand'
      ? recipe.station
      : Array.isArray(station)
        ? null
        : station;

  // TRAP + STUMP-UPGRADE REPORT PATH: a placesTrap craft never
  // enters inventory and never places or emits — it consumes and
  // reports success (placedTrap {type}), and the SHELL places via
  // placeTrap on that result (header point 5, single-caller rule).
  // An upgradesStump craft mirrors it exactly (header point 6):
  // it consumes and reports upgradedStump {type}, and the SHELL
  // transforms the FACED stump via Background's anchor primitive
  // on that result — never grants, never transforms, never emits.
  // Upgrading takes no capacity check (nothing enters the pack).
  if (recipe.placesTrap || recipe.upgradesStump) {
    // Ingredient / requirement / predecessor check, via the same
    // engine check the grant path uses — but the grant itself is
    // NOT run: placing takes no capacity check (nothing enters
    // the pack) and adds no item. Consumption below cannot fail
    // after this check passes (synchronous, no interleave).
    const check = canCraft(recipe, inventory, engineStation);
    if (!check.ok) {
      if (check.stationMismatch) {
        throw new Error(
          `Cannot craft ${recipe.name}: requires station ` +
            `${check.requiredStation}.`,
        );
      }
      const firstMissing = check.missingIngredients[0];
      if (firstMissing) {
        throw new Error(
          `Cannot craft ${recipe.name}: need ${firstMissing.quantity} ` +
            `${firstMissing.item}, have ${firstMissing.held}.`,
        );
      }
      if (check.missingUpgradeFrom.length > 0) {
        throw new Error(
          `Cannot craft ${recipe.name}: need one of ` +
            `${check.missingUpgradeFrom.join(' or ')} to upgrade from.`,
        );
      }
      const firstRequirement = check.missingRequirements[0];
      if (firstRequirement) {
        throw new Error(
          `Cannot craft ${recipe.name}: requires ${firstRequirement.quantity} ` +
            `${firstRequirement.item} present (not consumed), have ` +
            `${firstRequirement.held}.`,
        );
      }
      if (check.toolStageShortfall) {
        throw new Error(
          `Cannot craft ${recipe.name}: requires owned tool stage ` +
            `${check.toolStageShortfall.required} or better, have stage ` +
            `${check.toolStageShortfall.held}.`,
        );
      }
      throw new Error(`Cannot craft ${recipe.name}: check failed.`);
    }
    for (const ingredient of recipe.ingredients) {
      inventory.remove(ingredient.item, ingredient.quantity);
    }
    if (recipe.upgradeFrom !== undefined) {
      const predecessors = Array.isArray(recipe.upgradeFrom)
        ? recipe.upgradeFrom
        : [recipe.upgradeFrom];
      const held = predecessors.find(
        (item) => inventory.count(item) >= 1,
      );
      if (held !== undefined) {
        inventory.remove(held, 1);
      }
    }
    // SPOIL (the pitfall's dirt): the report path's one
    // grant, by addPartial AFTER consumption (the freed
    // ingredient weight counts first). It cannot throw —
    // what fits is granted, the rest rides the result
    // for the shell to pile at her feet.
    const spoilGrant = recipe.spoil
      ? inventory.addPartial(recipe.spoil.item, recipe.spoil.quantity)
      : undefined;
    return {
      output: { ...recipe.output },
      ...(recipe.placesTrap
        ? { placedTrap: { type: recipe.id } }
        : { upgradedStump: { type: recipe.id } }),
      ...(spoilGrant && recipe.spoil
        ? {
            spoil: {
              item: recipe.spoil.item,
              granted: spoilGrant.granted,
              remainder: spoilGrant.remainder,
            },
          }
        : {}),
      owned: ownedToolItem(inventory),
      toolTier: ownedTier(inventory),
      harvestStage: ownedStage(inventory),
      stageName: ownedStageName(inventory),
    };
  }

  const output = craftIntoInventory(recipe, inventory, engineStation);

  // Owned tier is read from the inventory — no equip step, no
  // separate state to update. A crafted tool is owned by virtue of
  // being in inventory; an upgrade advanced the tier by consuming
  // its predecessor.
  return {
    output,
    owned: ownedToolItem(inventory),
    toolTier: ownedTier(inventory),
    harvestStage: ownedStage(inventory),
    stageName: ownedStageName(inventory),
  };
}


// ---------------------------------------------------------------------------
// Prerequisite chains (Adam, 2026-10-31)
// ---------------------------------------------------------------------------
//
// Adam's words: "allow a button to craft these prerequisites
// (and any of its prerequisites) without leaving that recipe,
// if we have the ingredients." The button sits on an
// ingredient row of the open recipe; this is the execution
// behind it. The chain crafts the INGREDIENT — never the open
// recipe itself; she presses Craft for that when its rows
// read ready.
//
// PLAN BEFORE ANYTHING IS CONSUMED. The whole chain is first
// walked against a CLONE of the pack (PersonalInventory
// .clone()), through executeCraft itself, so every gate a
// real craft obeys — ownership, hunger, station, tool stage,
// creek, counts, capacity — is checked in planning, deepest
// missing link first. If the walk throws, the refusal names
// the blocker (a raw item with have/need, a step's station,
// an owned single's label, the step that would overflow) and
// the real pack is untouched: no half-chains. Execution then
// replays the planned batches against the real inventory
// through the same executeCraft — one validated craft path,
// no second implementation. A step throwing at replay after
// a clean plan is a can't-happen path; if it ever fired, the
// earlier steps stand (real items, honestly hers) and the
// error propagates.
//
// PRODUCERS. A producer of an item is a recipe whose output
// it is — EXCLUDING placesTrap / upgradesStump recipes: their
// outputs never enter the pack, so they can never satisfy an
// ingredient. Producers are tried in recipe-book order; the
// first whose sub-chain fully plans wins (the candle's two
// waxes); if none plans, the FIRST producer's blocker is the
// refusal — the book's canonical path speaks. `requires`
// items are held gates, not ingredients: the chain never
// crafts them, and a missing one refuses, naming it. A step's
// upgradeFrom predecessor IS consumed by its craft, so the
// walk ensures one (any listed option; a craftable option is
// chained, otherwise it must be held). Batch surplus
// (dry-kindling x2 against a need of 1) stays in the pack,
// untrimmed.

/** One step of an executed chain (consecutive batches merged). */
export interface CraftChainStep {
  recipeId: string;
  name: string;
  batches: number;
  /** Total produced by this step (recipe output x batches). */
  output: { item: ItemId; quantity: number };
}

/** Chain outcome: the steps run, and what the chain made. */
export interface CraftChainResult {
  steps: CraftChainStep[];
  /** Total of the requested ingredient the chain produced. */
  crafted: { item: ItemId; quantity: number };
}

/** Producer candidacy for chains (see the section header). */
function chainProducersFor(item: ItemId): Recipe[] {
  return RECIPES.filter(
    (recipe) =>
      recipe.output.item === item &&
      !recipe.placesTrap &&
      !recipe.upgradesStump,
  );
}

/**
 * True when some recipe can produce this item INTO the pack
 * — the button's craftable half (UI pairs it with
 * held < required for the row). Producer candidacy (incl.
 * the trap/stump exclusion) lives here, in one place.
 */
export function hasChainProducer(item: ItemId): boolean {
  return chainProducersFor(normalizeItemId(item)).length > 0;
}

interface ChainContext {
  station: StationInput;
  hunger: HungerState | null;
  nearCreek: boolean | null;
  site: SiteFacts | null;
}

interface PlanState {
  sim: PersonalInventory;
  batches: Recipe[];
}

/** Display name for messages, falling back to the raw id. */
function chainItemName(item: ItemId): string {
  return displayNameFor(item) ?? item;
}

/**
 * Plan ONE batch of `producer` (plus everything the batch
 * needs first) against the simulation. Returns the threaded
 * state; throws the blocker's refusal.
 */
function planProducerBatch(
  producer: Recipe,
  state: PlanState,
  ctx: ChainContext,
  path: ItemId[],
): PlanState {
  let s = state;
  // Held gates are not ingredients: never crafted, only read.
  for (const req of producer.requires ?? []) {
    if (s.sim.count(req.item) < req.quantity) {
      throw new Error(
        `Cannot craft ${producer.name}: requires ` +
          `${chainItemName(req.item)} in hand (have ` +
          `${s.sim.count(req.item)}, need ${req.quantity}).`,
      );
    }
  }
  for (const ingredient of producer.ingredients) {
    s = planEnsure(ingredient.item, ingredient.quantity, s, ctx, path);
  }
  if (producer.upgradeFrom !== undefined) {
    const options: ItemId[] = Array.isArray(producer.upgradeFrom)
      ? producer.upgradeFrom
      : [producer.upgradeFrom];
    if (!options.some((option) => s.sim.count(option) >= 1)) {
      const craftable = options.find(
        (option) => chainProducersFor(option).length > 0,
      );
      if (craftable !== undefined) {
        s = planEnsure(craftable, 1, s, ctx, path);
      } else {
        throw new Error(
          `Cannot craft ${producer.name}: it upgrades from ` +
            `${options.map(chainItemName).join(' or ')}, and ` +
            `none is in the pack.`,
        );
      }
    }
  }
  // The validated path itself: every remaining gate (station,
  // hunger, ownership, tool stage, creek, capacity) speaks
  // with executeCraft's own voice, against the simulation.
  executeCraft(producer, s.sim, ctx.station, ctx.hunger, ctx.nearCreek, ctx.site);
  return { sim: s.sim, batches: [...s.batches, producer] };
}

/**
 * Ensure the simulation holds `need` of `item`, planning the
 * producing chain deepest-first when it falls short. Producer
 * fallback rolls the attempt's simulation back whole — a
 * failed producer leaves no trace in the plan.
 */
function planEnsure(
  item: ItemId,
  need: number,
  state: PlanState,
  ctx: ChainContext,
  path: ItemId[],
): PlanState {
  if (state.sim.count(item) >= need) return state;
  if (path.includes(item)) {
    throw new Error(
      `Cannot craft prerequisites: a recipe cycle runs ` +
        `through ${chainItemName(item)}.`,
    );
  }
  const producers = chainProducersFor(item);
  const have = state.sim.count(item);
  if (producers.length === 0) {
    throw new Error(
      `Cannot craft prerequisites: no recipe makes ` +
        `${chainItemName(item)}, and the pack holds ${have} ` +
        `of the ${need} needed.`,
    );
  }
  let firstError: Error | null = null;
  for (const producer of producers) {
    let attempt: PlanState = { sim: state.sim.clone(), batches: [] };
    try {
      const batches = Math.ceil((need - have) / producer.output.quantity);
      for (let b = 0; b < batches; b++) {
        attempt = planProducerBatch(producer, attempt, ctx, [
          ...path,
          item,
        ]);
      }
      return {
        sim: attempt.sim,
        batches: [...state.batches, ...attempt.batches],
      };
    } catch (err) {
      if (firstError === null) {
        firstError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }
  throw firstError ?? new Error('Cannot craft prerequisites.');
}

/**
 * Craft the missing prerequisites of ONE ingredient of the
 * open recipe (see the section header). `item` must be an
 * ingredient of `recipe`; the amount crafted covers the
 * recipe's stated need minus what the pack already holds.
 * Returns the steps run (deepest first) and the total made;
 * an already-satisfied ingredient returns empty steps.
 * Throws — consuming nothing — when the chain cannot
 * complete (the planning refusal names the blocker).
 */
export function executeCraftChain(
  recipe: Recipe,
  item: ItemId,
  inventory: PersonalInventory,
  station: StationInput = null,
  hunger: HungerState | null = null,
  nearCreek: boolean | null = null,
  site: SiteFacts | null = null,
): CraftChainResult {
  const wanted = normalizeItemId(item);
  const ingredient = recipe.ingredients.find((i) => i.item === wanted);
  if (ingredient === undefined) {
    throw new Error(
      `Cannot craft prerequisites for ${recipe.name}: ` +
        `${chainItemName(wanted)} is not one of its ingredients.`,
    );
  }
  const before = inventory.count(wanted);
  if (before >= ingredient.quantity) {
    return { steps: [], crafted: { item: wanted, quantity: 0 } };
  }
  const ctx: ChainContext = { station, hunger, nearCreek, site };
  const planned = planEnsure(
    wanted,
    ingredient.quantity,
    { sim: inventory.clone(), batches: [] },
    ctx,
    [],
  );
  const steps: CraftChainStep[] = [];
  for (const batchRecipe of planned.batches) {
    executeCraft(batchRecipe, inventory, station, hunger, nearCreek, site);
    const last = steps[steps.length - 1];
    if (last !== undefined && last.recipeId === batchRecipe.id) {
      last.batches += 1;
      last.output.quantity += batchRecipe.output.quantity;
    } else {
      steps.push({
        recipeId: batchRecipe.id,
        name: batchRecipe.name,
        batches: 1,
        output: {
          item: batchRecipe.output.item,
          quantity: batchRecipe.output.quantity,
        },
      });
    }
  }
  return {
    steps,
    crafted: { item: wanted, quantity: inventory.count(wanted) - before },
  };
}
