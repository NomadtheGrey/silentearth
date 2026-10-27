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
 *    ingredients and reports success via placedTrap {type} —
 *    and NOTHING else. It does not place, and it does not emit
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
 * ------------------------------------------------------------------
 * CONSTRUCTION (corrected 2026-10-27): the former temporary
 * wiring inventory is DELETED — shell construction is direct,
 * with the mode passed explicitly (no silent default was added
 * to the model — the constructor still requires
 * largeBasketMode, and wiring currently passes 'replace').
 * Replace-vs-stack is OPEN (DEV 2026-10-27): 'replace' is the
 * current wiring value, NOT a ruling, and neither total (70
 * vs 95 with pockets + apron + baskets) is settled until Adam
 * picks. An earlier version of this note called replace
 * pinned (2026-10-26 record); that is corrected here.
 *
 *   new PersonalInventory({ largeBasketMode: 'replace', initial })
 */

import { canCraft } from './crafting';
import { craftIntoInventory, PersonalInventory } from './inventory';
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
import type { CraftingStation, ItemId, Recipe } from './recipes';

/**
 * Station presence, as passed in by wiring. Single station (or
 * null) = the station she is crafting at; array = stations present.
 * Never computed here — see the header.
 */
export type StationInput = CraftingStation | CraftingStation[] | null;

export interface CraftExecutionResult {
  /**
   * What was crafted. When `placedTrap` is present, this output
   * was NOT added to inventory — the shell must not treat it as
   * a grant (it is carried here for feedback naming only), and
   * must place it via trapState.placeTrap (see header point 5).
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
): CraftExecutionResult {
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

  // TRAP REPORT PATH: a placesTrap craft never enters inventory
  // and never places or emits — it consumes and reports success
  // (placedTrap {type}), and the SHELL places via placeTrap on
  // that result (header point 5, single-caller rule).
  if (recipe.placesTrap) {
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
    return {
      output: { ...recipe.output },
      placedTrap: { type: recipe.id },
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

