/**
 * Silent Earth — crafting execution (player-systems lane).
 *
 * The helper App wiring calls to actually run a craft against the
 * real inventory. No UI, no game files, no imports from src/game/*.
 *
 * ------------------------------------------------------------------
 * STEP 1 NOTE: the Trundle-Tool +50 pin is ALREADY LIVE and is NOT
 * redone here. It landed in the previous step (WIP 264c097,
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
 * 3. HELD TOOL FOLLOWS THE CRAFT, ATOMICALLY. Only after the craft
 *    succeeds, if the output is a ladder tool, the held tool becomes
 *    that output (HeldToolState.equip). Crafting a tool equips it;
 *    upgrading replaces the held tool, because the upgrade already
 *    consumed its predecessor in inventory. Crafting anything else
 *    leaves the held tool unchanged. A failed craft leaves BOTH the
 *    inventory and the held tool untouched, because equip happens
 *    strictly after success.
 *
 * 4. NO HELD-TOOL GATE ON CRAFTING. Upgrade predecessors are
 *    inventory-based (crafting.ts), not held-based: crafting an
 *    upgrade does not require the predecessor to be the held tool,
 *    only to be in inventory. This helper adds no such gate.
 *
 * ------------------------------------------------------------------
 * TEMPORARY CONSTRUCTION PATH — READ BEFORE USING (grep marker:
 * TEMPORARY-WIRING-PLACEHOLDER):
 *
 * App wiring needs a constructible inventory BEFORE Adam rules on
 * large-basket replace-vs-stack, and PersonalInventory's
 * constructor correctly requires largeBasketMode with no default —
 * that requirement must NOT be silently defaulted inside the class.
 * So the placeholder lives HERE, in wiring code, not in the model:
 *
 *   createTemporaryWiringInventory()
 *
 * It constructs a PersonalInventory with the placeholder mode
 * TEMPORARY_WIRING_LARGE_BASKET_MODE ('replace'). That value is a
 * PLACEHOLDER, NOT A RULING, and it is named as one everywhere it
 * appears. 'replace' was picked as the placeholder (not as an
 * answer) because in normal play the two modes coincide right
 * after the large-basket upgrade — the upgrade consumes the small
 * basket, so only the large basket is held and both modes give the
 * same total — which minimizes how far wiring can drift from the
 * eventual ruling while the question is open. The modes diverge
 * only if a player later holds both baskets at once.
 *
 * WHEN ADAM RULES: replace every createTemporaryWiringInventory()
 * call with a PersonalInventory constructed with the ruled mode,
 * then DELETE this function and its constant. The ruled mode must
 * never be "the placeholder, kept" — the placeholder's name is
 * there so the replacement is findable and complete.
 */

import {
  craftIntoInventory,
  PersonalInventory,
  type LargeBasketMode,
} from './inventory';
import {
  isLadderTool,
  type BackgroundToolTier,
  type HarvestStageName,
  type HeldToolItem,
  type HeldToolState,
} from './held-tool';
import type { CraftingStation, ItemId, Recipe } from './recipes';

/**
 * Station presence, as passed in by wiring. Single station (or
 * null) = the station she is crafting at; array = stations present.
 * Never computed here — see the header.
 */
export type StationInput = CraftingStation | CraftingStation[] | null;

export interface CraftExecutionResult {
  output: { item: ItemId; quantity: number };
  /** Held tool after the craft (unchanged unless a tool was made). */
  held: HeldToolItem;
  /** Background-compatible tier of the held tool, null for hands. */
  toolTier: BackgroundToolTier | null;
  /** Harvest stage of the held tool (-1 hands, 0–3). */
  harvestStage: number;
  /** Plain-language tier name of the held tool. */
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
 * craftIntoInventory. Updates the held tool only on success.
 * Throws (inventory + held tool untouched) on a missing station,
 * an ingredient shortfall, or a capacity overflow.
 */
export function executeCraft(
  recipe: Recipe,
  inventory: PersonalInventory,
  held: HeldToolState,
  station: StationInput = null,
): CraftExecutionResult {
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

  const output = craftIntoInventory(recipe, inventory, engineStation);

  // Held tool follows the craft, strictly after success.
  if (isLadderTool(output.item)) {
    held.equip(output.item);
  }

  return {
    output,
    held: held.current(),
    toolTier: held.toolTier(),
    harvestStage: held.harvestStage(),
    stageName: held.stageName(),
  };
}

// ---------------------------------------------------------------------------
// Temporary construction path (TEMPORARY-WIRING-PLACEHOLDER — see header)
// ---------------------------------------------------------------------------

/**
 * TEMPORARY-WIRING-PLACEHOLDER. Placeholder large-basket mode for
 * App wiring ONLY, until Adam rules on replace-vs-stack. NOT A
 * RULING. See the header for why 'replace' was picked as the
 * placeholder and for the replacement procedure when he rules.
 */
export const TEMPORARY_WIRING_LARGE_BASKET_MODE: LargeBasketMode =
  'replace';

/**
 * TEMPORARY-WIRING-PLACEHOLDER. Constructible inventory for App
 * wiring before Adam's large-basket ruling. Callers must use this
 * (not a guessed mode passed to PersonalInventory directly) so the
 * placeholder is findable in one place. DELETE this function and
 * its constant when Adam rules, and construct PersonalInventory
 * with the ruled mode instead.
 */
export function createTemporaryWiringInventory(
  initial?: Record<string, number>,
): PersonalInventory {
  return new PersonalInventory({
    largeBasketMode: TEMPORARY_WIRING_LARGE_BASKET_MODE,
    initial,
  });
}
