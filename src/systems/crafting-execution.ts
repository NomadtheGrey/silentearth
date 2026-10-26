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
 * 4. NO OWNED-TOOL GATE ON CRAFTING. Upgrade predecessors are
 *    inventory-based (crafting.ts), not owned-tier-based: crafting
 *    an upgrade does not require owning any particular tier, only
 *    holding the predecessor in inventory. This helper adds no
 *    such gate.
 *
 * ------------------------------------------------------------------
 * RULED CONSTRUCTION (Adam, 2026-10-26): LARGE BASKET REPLACES
 * SMALL BASKET — PINNED. Total with pockets + apron + large = 70;
 * the small basket's +25 does NOT stack with the large basket's
 * 50. The former temporary wiring inventory is DELETED in this
 * landing — the ruled mode must never be "the placeholder, kept".
 * Shell
 * construction is now direct, with the ruled value passed
 * explicitly (no silent default was added to the model — the
 * constructor still requires largeBasketMode, and wiring passes
 * 'replace'):
 *
 *   new PersonalInventory({ largeBasketMode: 'replace', initial })
 */

import { craftIntoInventory, PersonalInventory } from './inventory';
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
  output: { item: ItemId; quantity: number };
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
 */
export function executeCraft(
  recipe: Recipe,
  inventory: PersonalInventory,
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

