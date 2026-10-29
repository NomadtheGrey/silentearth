/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HARVEST OUTCOME (wiring round, 2026-10-26, Adam's task).
 *
 * This module is the outcome side of the bus contract: it subscribes
 * to 'harvest:requested' (fired by UI's harvest buttons) and turns a
 * press into items — or into a failure event, granting nothing.
 * It owns world harvest state (depletion + multi-step progress) and
 * answers the station-presence question for crafting. It does NOT
 * own presentation (UI), inventory state (Systems), or tool state
 * (Systems) — those arrive by injection (see below), so this file
 * never imports from src/systems/ or src/ui/.
 *
 * WIRING (shell's one call — UI owns the shell this round, and App
 * does not create an inventory yet, so this module is NOT
 * instantiated by the renderer):
 *
 *   createHarvestOutcomeListener({
 *     gen: () => genRef.current,          // current world generator
 *     inventory,                          // Systems' PersonalInventory
 *     getToolTier: () => ownedTier(inventory), // Systems' owned-tool.ts
 *   })
 *
 * returns an unsubscribe function. The renderer does NOT call this
 * (it has no inventory or tool state); it only hosts removed
 * filtering + shrink scaling + chunk reload, which work off the
 * shared harvestState (see harvestState.ts) regardless of who
 * instantiated the listener.
 *
 * TOOL QUERY SHAPE — OWNED TIER, NOT EQUIPPED (Adam, 2026-10-26,
 * correcting the brief's word): there is NO equipping anywhere in
 * the loop. Owning the tool is sufficient to use it, because it is
 * the only tool. getToolTier therefore returns the OWNED tier: null
 * before she has made a tool (hands), advancing when she crafts /
 * upgrades — she owns exactly one tier at a time, since upgrades
 * consume the predecessor. No tool state is duplicated here.
 * Systems' owned-tool module (src/systems/owned-tool.ts) provides
 * exactly this value: ownedTier(inventory) returns
 * BackgroundToolTier | null with literals matching ToolTier by
 * name, null for none — the shell passes
 * () => ownedTier(inventory). The owned tier is read from the
 * inventory itself (highest-stage ladder tool present), so there
 * is no held/equipped state for this listener to disagree with:
 * Systems' earlier held-tool module (HeldToolState, equip() /
 * unequip()) was deleted in the same correction and must not be
 * referenced — any code still importing './systems/held-tool' is
 * stale. If no query is supplied, the default () => null applies:
 * hand-permitted sources and ground work, tool-gated sources
 * correctly fail 'below-permit'.
 *
 * HUNGER LOCKOUT (Adam, 2026-10-26 — weather + hunger build,
 * engine half): Systems owns the hunger meter and stage; this
 * listener reads it through deps.getHungerStage (same pattern as
 * getToolTier — no hunger state duplicated here). At the
 * too-hungry stage ('too-hungry'), harvests fail 'too-hungry' —
 * EXCEPT hungerExempt food sources (nuts/berries, see hunger.ts:
 * downed oak for acorns, bog growth for bog berries, brush for
 * elderberries). Ground counts as harvest and is never exempt, so
 * ground is blocked too. The lockout sits after the permit check
 * and before any progress, yield, or state change: a locked-out
 * press consumes nothing and depletes nothing. GATHER vs EAT
 * (Adam, 2026-10-26): acorns stay gather-exempt but NEED COOKED
 * — eating them requires the campfire cooking step, which is
 * itself a too-hungry exception via the future fire system.
 * Traps and campfire cooking are HOOKS for when those systems
 * exist (see hunger.ts), not exceptions built here.
 *
 * INVENTORY SHAPE: HarvestInventory is structural — PersonalInventory
 * satisfies it (free() + add() + addPartial()). The listener grants
 * PARTIALLY (harvest overflow, Adam 2026-10-26, superseding the earlier
 * all-or-nothing rule): per merged yield, what fits goes into
 * inventory and the remainder drops as a ground pile at the target's
 * spot (pileState.ts). Capacity never fails a validated press. Harvest yields are never carrying gear
 * (apron/basket/trundle are crafted, not harvested), so the free()
 * check is exact for them; if a future harvestable ever yielded
 * gear, the check would be conservative (it might pile when it
 * would fit), never over-granting.
 *
 * OUTCOME ORDER (every press, in order — a failure at any step stops
 * the press, and nothing before it has mutated anything):
 *  1. Ground: material is resolved at CURRENT position (she is
 *     always on ground, wherever she stands; the requested material
 *     is what the button showed, but the ground under her NOW is
 *     what she scoops). No range check, no shrink, no progress.
 *     Ground rejects 'remove' with 'not-removable' (you cannot
 *     remove the ground).
 *  2. Scatter: removed? -> 'removed' (permanently gone: a removed
 *     plant, or a taken log). Then the target must still be in
 *     findInRange at her last known position (range re-validation,
 *     not trusting the button) and its source must match the
 *     request -> 'out-of-range' / 'target-mismatch'. Range
 *     re-validation needs a 'player:moved' to have been seen; if
 *     none has (tests, or a listener created mid-game before the
 *     first move), it degrades to permit + state checks only — in
 *     the live game 'player:moved' fires constantly, so this
 *     fallback is not the normal path.
 *  3. Permit: harvestYieldForTool(source, tool). Not permitted ->
 *     the outcome reason ('below-permit' / 'permit-tbd' / 'anchor' /
 *     'not-harvestable'). Note the tracker already excludes anchors
 *     and non-harvestables from buttons, so those reasons are
 *     defense-in-depth, not expected paths.
 *  4a. REMOVE action (req.action === 'remove'): source must be
 *     removable (plant-like sources only; logs, stones, bone, salt,
 *     silt, and anchors reject with 'not-removable'). Multi-step
 *     progress is bypassed (removal is one action) and cleared.
 *     Yields: primary base x REMOVE_YIELD_MULTIPLIER (3, lane-
 *     decided tunable, flagged) + the normal bonus roll; every
 *     secondary drop granted (no roll); tool-gated yields as
 *     normal. On success the plant is marked removed permanently
 *     (no regrow) and 'harvest:completed' carries action 'remove'.
 *  4b. HARVEST action: regrowing? -> 'regrowing' (shrunk, not yet
 *     regrown — the tracker already hides these buttons, so this
 *     is a stale-button defense). Multi-step (prototype TUG/STOMP,
 *     lane decision following the prototype shape): each press
 *     adds the source's step to stored progress and emits
 *     'harvest:progress' with no grant and no shrink until
 *     progress reaches 1. Only then do yields, capacity, grant,
 *     and the after-harvest step happen. Pill-fill payloads
 *     (2026-10-29): progress events also carry pressIndex /
 *     pressesTotal / verb / struggleMessage from the def, and
 *     the finishing press's 'harvest:completed' carries the
 *     def's successMessage (absent on every other completion).
 *  5. Yields: primary base + a bonus roll (rng() < bonusChance ?
 *     bonus : 0); each secondary drop rolls its own chance for +1;
 *     tool-gated yields (clay on silt, Adam-pinned) pay their table
 *     when the tool meets requiresTool. Same-item quantities merge.
 *  6. Capacity — PARTIAL GRANT + PILES (harvest overflow, Adam
 *     2026-10-26, supersedes the earlier all-or-nothing rule): the
 *     harvest always completes once validation passes. What fits
 *     goes into inventory (Systems' addPartial() when offered —
 *     normalized item + granted + remainder — else sequential
 *     free()/add()); what doesn't fit drops as ground piles at
 *     the target's spot via pileState (same item + same spot
 *     merges). 'harvest:completed' carries yields = granted, plus
 *     dropped when non-empty. No capacity failure exists anymore,
 *     so the after-harvest step (below) always runs on a validated
 *     press.
 *
 * AFTER HARVEST (Adam, 2026-10-26, PINNED — supersedes the earlier
 * vanish model):
 * - Ordinary sources SHRINK and REGROW (harvestState.ts: shrunk at
 *   SHRINK_SCALE, harvestable again after REGROW_MS). The tracker
 *   hides regrowing targets; the renderer scales them.
 * - LOG sources (renewal 'spawn-near-trees': fallen logs, downed
 *   oak) are TAKEN: marked removed (gone from that spot for good)
 *   and a fresh log is scheduled to spawn near trees after
 *   LOG_SPAWN_MS. Spawned logs harvest like fallen logs and, when
 *   taken, schedule their own replacement — the chain renews.
 * - TAKEN-permanent sources (renewal 'taken': flint stones,
 *   bone scatters) are removed for good with NO replacement
 *   scheduled — single pickups, not clusters; the infinite
 *   world supplies more. Bones joined by Adam's ruling
 *   (2026-10-29, PINNED — "bones don't grow back"): a
 *   harvested bone is gone permanently, no shrink, no regrow.
 * - TREES FELL (Adam, 2026-10-26, PINNED — answers the flagged
 *   fell-vs-shrink question with FELL): a harvested tree becomes
 *   a STUMP at its spot (a workstation anchor like any other
 *   stump), and a sapling grows into a new tree in a nearby clear
 *   spot over SAPLING_GROWTH_MS. The remove action on a tree is
 *   different: total removal, NO stump, and the ground stays
 *   cleared (no saplings return there).
 * - REMOVE on any plant marks its ground CLEARED (a cleared spot
 *   within CLEARED_SPOT_RADIUS): no saplings return there. This is
 *   the house-plot case. (Removed plants themselves never regrow,
 *   as already pinned.)
 * - Ground NEVER shrinks, depletes, or regrows: always scoopable.
 *
 * BONUS ROLLS: rng defaults to Math.random. That is GAMEPLAY randomness,
 * not world generation — the world-seed reproducibility rule covers
 * worldgen (chunk contents, ground colors, textures), which this file
 * never touches, so harvest luck does not break it. Tests inject a
 * deterministic rng. The same roll function is used for bonus and
 * secondary drops, in primary-then-secondary-then-gated order, so an
 * injected rng makes an entire outcome reproducible.
 */

import { bus } from './events';
import { CHUNK_SIZE } from '../constants';
import {
  CLAY_BONUS_CHANCE,
  SOURCE_BY_ID,
  harvestStageRank,
  harvestYieldForTool,
  type GroundMaterialDef,
  type HarvestSourceDef,
  type MultiStep,
  type ToolTier,
} from './objects';
import {
  HARVEST_RANGE,
  findInRange,
  groundSourceAt,
  type HarvestTarget,
} from './proximity';
import {
  harvestState,
  REMOVE_YIELD_MULTIPLIER,
  scatterTargetId,
  type HarvestState,
} from './harvestState';
import type { WorldGen } from './worldgen';
import { boneItemId, boneKindAt } from './boneKind';
import { TOO_HUNGRY_STAGE, type HungerStageQuery } from './hunger';
import { loomState } from './loomState';
import { pileState } from './pileState';
import { torchState } from './torchState';

/** Re-exported so existing importers keep one harvest entry point. */
export { harvestState };

/** One merged yield line. */
export interface HarvestYield {
  item: string;
  quantity: number;
}

/**
 * The inventory surface the outcome listener needs. Structural, so
 * Systems' PersonalInventory satisfies it without this file importing
 * Systems code. free() is remaining contents capacity; add() grants.
 * addPartial() is Systems' partial grant (d76cb51): when present
 * the listener prefers it — it returns the NORMALIZED item plus
 * granted + remainder, so piles carry Systems' spelling (the
 * single normalization truth) instead of the yield spelling. When
 * absent (tests, older callers) the listener falls back to
 * free()/add() and piles keep the yield spelling, which Systems'
 * save/pickup boundaries re-normalize on read.
 */
export interface HarvestInventory {
  free(): number;
  add(item: string, quantity: number): void;
  addPartial?: (item: string, quantity: number) => {
    item: string;
    granted: number;
    remainder: number;
  };
}

/** Owned-tier query shape (see header: owned, never equipped). */
export type ToolTierQuery = () => ToolTier | null;

export interface HarvestOutcomeDeps {
  /** Current world generator (value or getter — the shell passes a
   *  getter when the generator can be replaced, e.g. on seed change). */
  gen: WorldGen | (() => WorldGen);
  inventory: HarvestInventory;
  /** Defaults to () => null (no tool) until Systems lands the query. */
  getToolTier?: ToolTierQuery;
  /**
   * Hunger stage query (Systems owns hunger state — same pattern
   * as getToolTier). Defaults to () => null (fed) until Systems
   * lands the meter. At 'too-hungry', harvests lock out except for
   * hungerExempt food sources (see hunger.ts); see the lockout
   * note in the header.
   */
  getHungerStage?: HungerStageQuery;
  /** Defaults to Math.random (gameplay luck, not worldgen). */
  rng?: () => number;
  /** Clock for shrink/regrow/spawn timing. Defaults to Date.now. */
  now?: () => number;
}

/**
 * Primary-yield item for a scatter source at a position:
 * bones yield their kind item (Adam 2026-10-28 —
 * individual bones in the world, each carrying its kind);
 * everything else yields the def's primary. The kind
 * derives from the TARGET position (boneKindAt on the
 * world seed + target x/z) — never the player's position.
 * Quantities are untouched (generic base + bonus rule) —
 * only the item string changes for bones.
 */
function primaryYieldItem(source: HarvestSourceDef, gen: WorldGen, x: number, z: number): string {
  if (source.kind === 'bone') return boneItemId(boneKindAt(gen.seed, x, z));
  return source.primaryYield ?? '';
}

/**
 * Mole paw — earth sense (tier-1 charm): shell-supplied
 * carried + awakened boolean (UI wiring follows).
 */
let moleEarthSense = false;

/** Shell setter for mole earth sense (see clayBonusChanceFor). */
export function setMoleEarthSense(active: boolean): void {
  moleEarthSense = active;
}

/**
 * Clay bonus chance (tier-1 charm, DRAFT +10pp): 0.25 →
 * 0.35 while carried + awakened, capped at 1.0. The
 * gated-'CLAY' grant sites below read through this, so
 * the chance lives in one place, never scattered.
 */
export function clayBonusChanceFor(moleActive: boolean): number {
  return Math.min(1, CLAY_BONUS_CHANCE + (moleActive ? 0.1 : 0));
}

/**
 * Station presence at (x, z): a stump within HARVEST_RANGE means a
 * workstation is available (stumps are workstation anchors in
 * objects.ts). Query, not event — crafting checks availability at
 * craft time, and UI can re-check whenever 'harvest:inRange' fires.
 * Shape for consumers: workstation true maps to Systems'
 * StationContext 'workstation', false maps to null. Other stations
 * (wheel, loom, kiln, hearth, bloomery) do not exist yet, so they
 * correctly read as unavailable — no placeholder stations are
 * invented here, and none are returned.
 */
export function stationPresence(
  gen: WorldGen,
  x: number,
  z: number,
): { workstation: boolean; loom: boolean } {
  // Felled stumps count too — and this check must read state, not
  // just the passed generator, because callers pass the RAW
  // generator (App passes genRef.current) while felled stumps live
  // in state until the wrapped generator adds them.
  let workstation = harvestState.felledStumpsInRange(x, z, HARVEST_RANGE);
  if (!workstation) {
    const minCx = Math.floor((x - HARVEST_RANGE) / CHUNK_SIZE);
    const maxCx = Math.floor((x + HARVEST_RANGE) / CHUNK_SIZE);
    const minCz = Math.floor((z - HARVEST_RANGE) / CHUNK_SIZE);
    const maxCz = Math.floor((z + HARVEST_RANGE) / CHUNK_SIZE);
    for (let cz = minCz; cz <= maxCz && !workstation; cz++) {
      for (let cx = minCx; cx <= maxCx && !workstation; cx++) {
        for (const obj of gen.generateChunk(cx, cz).objects) {
          if (obj.kind !== 'stump') continue;
          if (harvestState.isRemoved(scatterTargetId(cx, cz, obj))) continue;
          if (Math.hypot(obj.x - x, obj.z - z) <= HARVEST_RANGE) {
            workstation = true;
            break;
          }
        }
      }
    }
  }
  // Loom presence (gap-closing round, Adam 2026-10-26): a placed
  // loom within the same HARVEST_RANGE (2.5 m, workstation
  // precedent) counts as station 'loom'. This reads live
  // loomState, like the felled-stump check reads live state.
  const loom = loomState.loomsInRange(x, z, HARVEST_RANGE);
  return { workstation, loom };
}

/**
 * Stump positions at (x, z) (Adam 2026-10-28 — UI gap #4:
 * the shell needs positions, not just presence booleans,
 * to stage onto stumps). Mirrors stationPresence exactly:
 * felled stumps in state + grown stump objects in range
 * (minus removed), deduped by rounded position. Default
 * range HARVEST_RANGE (staging is a near-site interaction,
 * same range as workstation presence). Positions are the
 * whole site identity for stumps (stumpSiteId derives from
 * them in ritualSite.ts).
 */
export function stumpPositions(
  gen: WorldGen,
  x: number,
  z: number,
  range: number = HARVEST_RANGE,
): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  const seen = new Set<string>();
  const push = (sx: number, sz: number): void => {
    const key = `${sx.toFixed(2)},${sz.toFixed(2)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ x: sx, z: sz });
  };
  for (const s of harvestState.felledStumpPositionsInRange(x, z, range)) push(s.x, s.z);
  const minCx = Math.floor((x - range) / CHUNK_SIZE);
  const maxCx = Math.floor((x + range) / CHUNK_SIZE);
  const minCz = Math.floor((z - range) / CHUNK_SIZE);
  const maxCz = Math.floor((z + range) / CHUNK_SIZE);
  for (let cz = minCz; cz <= maxCz; cz++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (const obj of gen.generateChunk(cx, cz).objects) {
        if (obj.kind !== 'stump') continue;
        if (harvestState.isRemoved(scatterTargetId(cx, cz, obj))) continue;
        if (Math.hypot(obj.x - x, obj.z - z) <= range) push(obj.x, obj.z);
      }
    }
  }
  return out;
}

/**
 * Hive positions at (x, z) (beehive landing, 2026-10-28):
 * the harvest interaction point for wild hives. Mirrors
 * stumpPositions exactly — hive objects in range from chunk
 * data — MINUS the felled/removed branches: nothing removes
 * hives v1 (no harvest path yet), so there is no removal
 * state to consult; Systems' harvest landing adds removal
 * tracking if hives deplete. Default range HARVEST_RANGE
 * (a near-site interaction, same range as workstation
 * presence).
 */
export function hivePositions(
  gen: WorldGen,
  x: number,
  z: number,
  range: number = HARVEST_RANGE,
): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  const minCx = Math.floor((x - range) / CHUNK_SIZE);
  const maxCx = Math.floor((x + range) / CHUNK_SIZE);
  const minCz = Math.floor((z - range) / CHUNK_SIZE);
  const maxCz = Math.floor((z + range) / CHUNK_SIZE);
  for (let cz = minCz; cz <= maxCz; cz++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (const obj of gen.generateChunk(cx, cz).objects) {
        if (obj.kind !== 'beehive') continue;
        if (Math.hypot(obj.x - x, obj.z - z) <= range) out.push({ x: obj.x, z: obj.z });
      }
    }
  }
  return out;
}

/**
 * Torch-under-hive fact (beehive landing, 2026-10-28):
 * true when a PLACED torch stands within range of the hive
 * — the "torch under hive" half of the safe-harvest rule.
 * Placed torches are ALWAYS lit (torchState: no lit flag,
 * position is the whole state), so no lit check. Carried
 * lit torches do NOT count v1 (literal smoker reading;
 * carried-lit is Systems' inventory fact — if Adam wants
 * it counted, Systems adds it to their rule with no
 * Background change). Default range HARVEST_RANGE.
 */
export function placedTorchNearHive(
  hiveX: number,
  hiveZ: number,
  range: number = HARVEST_RANGE,
): boolean {
  for (const torch of torchState.snapshot()) {
    if (Math.hypot(torch.x - hiveX, torch.z - hiveZ) <= range) return true;
  }
  return false;
}

/**
 * Map station presence onto Systems' StationContext values.
 * Loom takes precedence when both are nearby: canCraft
 * requires an EXACT station match, so a single context cannot
 * satisfy both families at once, and the gap this landing
 * closes is garments — standing at a loom must read as
 * 'loom', or garments stay uncraftable. FLAGGED WART: while
 * both a stump and a loom are in range, workstation recipes
 * read as mismatched until she steps out of loom range.
 * The presence object itself carries both booleans, so UI's
 * later CraftingMenu wiring can surface both contexts if it
 * wants; this mapping is the single-context fallback. The
 * `loom` field is optional so presence objects built before
 * this landing (workstation only) still map.
 */
export function stationContextForPresence(presence: {
  workstation: boolean;
  loom?: boolean;
}): 'workstation' | 'loom' | null {
  if (presence.loom) return 'loom';
  return presence.workstation ? 'workstation' : null;
}

/** Type guard: the permitted:false arm of HarvestYieldOutcome. */
function isNotPermitted(o: ReturnType<typeof harvestYieldForTool>): o is {
  permitted: false;
  reason: 'not-harvestable' | 'below-permit' | 'permit-tbd' | 'anchor';
} {
  return !o.permitted;
}

type FailedReason =
  | 'out-of-range'
  | 'removed'
  | 'regrowing'
  | 'not-removable'
  | 'below-permit'
  | 'permit-tbd'
  | 'anchor'
  | 'not-harvestable'
  | 'target-mismatch'
  | 'inventory-full'
  | 'too-hungry';

/**
 * Subscribe the outcome listener to 'harvest:requested' (+ track
 * 'player:moved' for range re-validation). Returns an unsubscribe
 * function that removes both subscriptions. One listener per shell;
 * creating a second one would double-grant, so the shell owns
 * exactly one.
 */
export function createHarvestOutcomeListener(
  deps: HarvestOutcomeDeps,
  state: HarvestState = harvestState,
): () => void {
  const genDep = deps.gen;
  const getGen = typeof genDep === 'function' ? genDep : () => genDep;
  const getToolTier = deps.getToolTier ?? (() => null);
  const getHungerStage = deps.getHungerStage ?? (() => null);
  /**
   * Too-hungry lockout (Adam, 2026-10-26): at the 'too-hungry'
   * stage, harvests fail 'too-hungry' — except hungerExempt food
   * sources (nuts/berries, see hunger.ts). The check sits AFTER
   * the permit check (tool capability still reports first) and
   * BEFORE any progress, yield, or state change, so a locked-out
   * press consumes nothing and depletes nothing.
   */
  const hungerLocked = (sourceExempt: boolean): boolean =>
    getHungerStage() === TOO_HUNGRY_STAGE && !sourceExempt;
  const rng = deps.rng ?? Math.random;
  const clock = deps.now ?? Date.now;
  let lastX: number | null = null;
  let lastZ: number | null = null;

  const unsubMoved = bus.on('player:moved', (p) => {
    lastX = p.x;
    lastZ = p.z;
  });

  const fail = (
    req: { targetId: string; sourceId: string; kind: 'scatter' | 'ground' },
    reason: FailedReason,
    yields: HarvestYield[] = [],
  ): void => {
    bus.emit('harvest:failed', {
      targetId: req.targetId,
      sourceId: req.sourceId,
      kind: req.kind,
      reason,
      yields,
    });
  };

  const mergeYields = (into: Map<string, number>, item: string, qty: number): void => {
    if (qty <= 0) return;
    into.set(item, (into.get(item) ?? 0) + qty);
  };

  /**
   * Partial grant (harvest overflow, Adam 2026-10-26): per merged
   * yield, grant what fits and drop the remainder as a ground pile
   * at (dropX, dropZ) via pileState. Preferred path: Systems'
   * addPartial() when the inventory offers it — one call returns
   * the normalized item + granted + remainder (conservation:
   * granted + remainder === quantity, always), so the pile's item
   * spelling matches inventory stacks and save documents. Fallback
   * (no addPartial): sequential free()/add() with the yield
   * spelling; earlier items consume room before later ones. A
   * grant never fails here — free()-checked adds and addPartial
   * both cap at capacity instead of throwing — so callers run
   * their after-harvest step unconditionally after this.
   * 'harvest:completed' yields and dropped both carry the pile's
   * spelling (normalized on the addPartial path).
   */
  const grantOrPile = (
    merged: { item: string; quantity: number }[],
    dropX: number,
    dropZ: number,
  ): {
    granted: { item: string; quantity: number }[];
    dropped: { item: string; quantity: number }[];
  } => {
    const granted: { item: string; quantity: number }[] = [];
    const dropped: { item: string; quantity: number }[] = [];
    for (const y of merged) {
      if (deps.inventory.addPartial) {
        const g = deps.inventory.addPartial(y.item, y.quantity);
        if (g.granted > 0) granted.push({ item: g.item, quantity: g.granted });
        if (g.remainder > 0) {
          pileState.drop(g.item, g.remainder, dropX, dropZ);
          dropped.push({ item: g.item, quantity: g.remainder });
        }
        continue;
      }
      const take = Math.min(y.quantity, deps.inventory.free());
      if (take > 0) {
        deps.inventory.add(y.item, take);
        granted.push({ item: y.item, quantity: take });
      }
      const rest = y.quantity - take;
      if (rest > 0) {
        pileState.drop(y.item, rest, dropX, dropZ);
        dropped.push({ item: y.item, quantity: rest });
      }
    }
    return { granted, dropped };
  };

  const unsubRequested = bus.on('harvest:requested', (req) => {
    const gen = getGen();
    const tool = getToolTier();
    const nowMs = clock();
    const action = req.action ?? 'harvest';
    const pos =
      lastX !== null && lastZ !== null ? { x: lastX, z: lastZ } : { x: req.x, z: req.z };

    // --- Ground: material resolved at CURRENT position, never shrunk.
    if (req.kind === 'ground') {
      if (action === 'remove') {
        fail(req, 'not-removable');
        return;
      }
      const ground: GroundMaterialDef = groundSourceAt(gen, pos.x, pos.z);
      const outcome = harvestYieldForTool(
        { harvestable: true, permitTier: ground.permitTier, bonusChance: undefined, anchor: undefined },
        tool,
      );
      if (isNotPermitted(outcome)) {
        // Unreachable for hand-permitted ground today, but the shape
        // stays honest if a ground material ever gains a tool gate.
        fail(req, outcome.reason);
        return;
      }
      // Ground counts as harvest here: blocked when too hungry
      // (ground is never a nuts/berries source, so never exempt).
      if (hungerLocked(false)) {
        fail(req, 'too-hungry');
        return;
      }
      const yields = new Map<string, number>();
      mergeYields(
        yields,
        ground.primaryYield,
        outcome.base + (rng() < outcome.bonusChance ? outcome.bonus : 0),
      );
      const merged = [...yields.entries()].map(([item, quantity]) => ({ item, quantity }));
      const { granted, dropped } = grantOrPile(merged, pos.x, pos.z);
      bus.emit('harvest:completed', {
        targetId: req.targetId,
        sourceId: ground.id,
        kind: 'ground',
        x: pos.x,
        z: pos.z,
        cx: Math.floor(pos.x / CHUNK_SIZE),
        cz: Math.floor(pos.z / CHUNK_SIZE),
        yields: granted,
        action: 'harvest',
        ...(dropped.length > 0 ? { dropped } : {}),
      });
      return;
    }

    // --- Spawned logs (log-renewal system): targets the tracker
    // appended from state, not from worldgen. They harvest exactly
    // like fallen logs (hand permit, SNAP_WOOD) and, when taken,
    // schedule their own replacement near trees.
    if (req.targetId.startsWith('spawned-log:')) {
      // Logs are never removable: harvesting already takes them,
      // and their renewal is the spawn system.
      if (action === 'remove') {
        fail(req, 'not-removable');
        return;
      }
      const spawned = state.spawnedLog(req.targetId);
      if (!spawned) {
        fail(req, 'removed');
        return;
      }
      if (Math.hypot(spawned.x - pos.x, spawned.z - pos.z) > HARVEST_RANGE) {
        fail(req, 'out-of-range');
        return;
      }
      const logSource = SOURCE_BY_ID['fallenLog'];
      if (!logSource) {
        fail(req, 'target-mismatch');
        return;
      }
      const logOutcome = harvestYieldForTool(logSource, tool);
      if (isNotPermitted(logOutcome)) {
        fail(req, logOutcome.reason);
        return;
      }
      // Logs are not hunger-exempt food: locked out when too-hungry.
      if (hungerLocked(logSource.hungerExempt ?? false)) {
        fail(req, 'too-hungry');
        return;
      }
      const logYields = new Map<string, number>();
      mergeYields(
        logYields,
        logSource.primaryYield ?? '',
        logOutcome.base + (rng() < logOutcome.bonusChance ? logOutcome.bonus : 0),
      );
      logYields.delete('');
      const logMerged = [...logYields.entries()].map(([item, quantity]) => ({ item, quantity }));
      const { granted: logGranted, dropped: logDropped } = grantOrPile(
        logMerged,
        spawned.x,
        spawned.z,
      );
      state.takeSpawnedLog(req.targetId, nowMs, gen.seed);
      bus.emit('harvest:completed', {
        targetId: req.targetId,
        sourceId: logSource.id,
        kind: 'scatter',
        x: spawned.x,
        z: spawned.z,
        cx: spawned.cx,
        cz: spawned.cz,
        yields: logGranted,
        action: 'harvest',
        ...(logDropped.length > 0 ? { dropped: logDropped } : {}),
      });
      return;
    }

    // --- Spawned trees (tree lifecycle): mature saplings are tree
    // targets; immature ones are not targets at all (a stale press
    // for one reads as regrowing). Harvest fells them (stump +
    // new sapling nearby); remove clears them with no stump.
    if (req.targetId.startsWith('spawned-tree:')) {
      const sapling = state.spawnedTree(req.targetId);
      if (!sapling) {
        fail(req, 'removed');
        return;
      }
      if (state.saplingGrowth(sapling, nowMs) < 1) {
        fail(req, 'regrowing');
        return;
      }
      if (Math.hypot(sapling.x - pos.x, sapling.z - pos.z) > HARVEST_RANGE) {
        fail(req, 'out-of-range');
        return;
      }
      const treeSource = SOURCE_BY_ID['standingTree'];
      if (!treeSource) {
        fail(req, 'target-mismatch');
        return;
      }
      const treeOutcome = harvestYieldForTool(treeSource, tool);
      if (isNotPermitted(treeOutcome)) {
        fail(req, treeOutcome.reason);
        return;
      }
      // Trees are not hunger-exempt food: locked out when too-hungry
      // (both felling and clearing — a too-hungry witch does not fell
      // a tree for wood she cannot eat).
      if (hungerLocked(treeSource.hungerExempt ?? false)) {
        fail(req, 'too-hungry');
        return;
      }
      const treeYields = new Map<string, number>();
      if (action === 'remove') {
        mergeYields(
          treeYields,
          treeSource.primaryYield ?? '',
          treeOutcome.base * REMOVE_YIELD_MULTIPLIER +
            (rng() < treeOutcome.bonusChance ? treeOutcome.bonus : 0),
        );
        for (const secondary of treeSource.secondaryYields) {
          mergeYields(treeYields, secondary.item, 1);
        }
      } else {
        mergeYields(
          treeYields,
          treeSource.primaryYield ?? '',
          treeOutcome.base + (rng() < treeOutcome.bonusChance ? treeOutcome.bonus : 0),
        );
        for (const secondary of treeSource.secondaryYields) {
          if (rng() < secondary.chance) mergeYields(treeYields, secondary.item, 1);
        }
      }
      treeYields.delete('');
      const treeMerged = [...treeYields.entries()].map(([item, quantity]) => ({ item, quantity }));
      const { granted: treeGranted, dropped: treeDropped } = grantOrPile(
        treeMerged,
        sapling.x,
        sapling.z,
      );
      if (action === 'remove') {
        state.removeSpawnedTree(req.targetId);
        state.markCleared(sapling.x, sapling.z);
      } else {
        state.removeSpawnedTree(req.targetId);
        state.fellTree(req.targetId, sapling.x, sapling.z, sapling.cx, sapling.cz, gen, nowMs);
      }
      bus.emit('harvest:completed', {
        targetId: req.targetId,
        sourceId: treeSource.id,
        kind: 'scatter',
        x: sapling.x,
        z: sapling.z,
        cx: sapling.cx,
        cz: sapling.cz,
        yields: treeGranted,
        action,
        ...(treeDropped.length > 0 ? { dropped: treeDropped } : {}),
      });
      return;
    }

    // --- Worldgen scatter: removed, felled, range, source match, permit.
    if (state.isRemoved(req.targetId)) {
      fail(req, 'removed');
      return;
    }
    if (state.isFelled(req.targetId)) {
      // The tree is gone (a stump stands there now); a stale button
      // for it reads as removed, not as a harvestable tree.
      fail(req, 'removed');
      return;
    }
    let target: HarvestTarget | undefined;
    if (lastX !== null && lastZ !== null) {
      target = findInRange(gen, lastX, lastZ, false).find((t) => t.id === req.targetId);
      if (!target) {
        fail(req, 'out-of-range');
        return;
      }
    }
    const source = SOURCE_BY_ID[req.sourceId];
    if (!source || (target && target.sourceId !== req.sourceId)) {
      fail(req, 'target-mismatch');
      return;
    }
    const outcome = harvestYieldForTool(source, tool);
    if (isNotPermitted(outcome)) {
      fail(req, outcome.reason);
      return;
    }
    // Too-hungry lockout, before remove AND harvest branches:
    // exempt food sources pass through; everything else refuses
    // with no progress consumed and nothing depleted.
    if (hungerLocked(source.hungerExempt ?? false)) {
      fail(req, 'too-hungry');
      return;
    }

    // --- REMOVE action: bigger one-time yield, gone permanently.
    // Bypasses multi-step progress (removal is one action) and the
    // regrow check (removing a regrowing plant kills it for good).
    if (action === 'remove') {
      if (!source.removable) {
        fail(req, 'not-removable');
        return;
      }
      const removeYields = new Map<string, number>();
      mergeYields(
        removeYields,
        primaryYieldItem(source, gen, req.x, req.z),
        outcome.base * REMOVE_YIELD_MULTIPLIER +
          (rng() < outcome.bonusChance ? outcome.bonus : 0),
      );
      for (const secondary of source.secondaryYields) {
        mergeYields(removeYields, secondary.item, 1);
      }
      if (source.toolGatedYields) {
        for (const gated of source.toolGatedYields) {
          if (tool === null || harvestStageRank(tool) < harvestStageRank(gated.requiresTool)) {
            continue;
          }
          const gatedYield = gated.yieldByStage[harvestStageRank(tool)];
          if (!gatedYield) continue;
          // Mole paw — earth sense (tier-1 charm): clay's
          // bonus chance rises while carried + awakened.
          const bonusChance =
            gated.item === 'CLAY' ? clayBonusChanceFor(moleEarthSense) : gatedYield.bonusChance;
          mergeYields(
            removeYields,
            gated.item,
            gatedYield.base + (rng() < bonusChance ? gatedYield.bonus : 0),
          );
        }
      }
      removeYields.delete('');
      const removeMerged = [...removeYields.entries()].map(([item, quantity]) => ({ item, quantity }));
      const { granted: removeGranted, dropped: removeDropped } = grantOrPile(
        removeMerged,
        req.x,
        req.z,
      );
      state.remove(req.targetId);
      // Intentional clearing marks the ground: no saplings return
      // within CLEARED_SPOT_RADIUS — the house-plot case (Adam,
      // 2026-10-26, PINNED). No stump is left, even for a tree.
      state.markCleared(req.x, req.z);
      bus.emit('harvest:completed', {
        targetId: req.targetId,
        sourceId: req.sourceId,
        kind: 'scatter',
        x: req.x,
        z: req.z,
        cx: Math.floor(req.x / CHUNK_SIZE),
        cz: Math.floor(req.z / CHUNK_SIZE),
        yields: removeGranted,
        action: 'remove',
        ...(removeDropped.length > 0 ? { dropped: removeDropped } : {}),
      });
      return;
    }

    // --- HARVEST action: regrowing targets refuse (stale buttons).
    if (state.isRegrowing(req.targetId, nowMs)) {
      fail(req, 'regrowing');
      return;
    }
    // Pill-fill (2026-10-29): when this press FINISHES a
    // multi-step harvest, the completion below carries the
    // def's successMessage; progress presses carry the pill
    // fields (pressIndex / pressesTotal / verb / struggle).
    let finishedMultiStep: MultiStep | undefined;
    if (source.multiStep) {
      const progress = Math.min(1, state.progressFor(req.targetId) + source.multiStep.step);
      if (progress < 1) {
        state.setProgress(req.targetId, progress);
        bus.emit('harvest:progress', {
          targetId: req.targetId,
          sourceId: req.sourceId,
          progress,
          pressIndex: Math.round(progress / source.multiStep.step),
          pressesTotal: Math.ceil(1 / source.multiStep.step - 1e-9),
          verb: source.multiStep.action,
          struggleMessage: source.multiStep.struggleMessage,
        });
        return;
      }
      finishedMultiStep = source.multiStep;
      // Progress reaches 1: fall through to grant. The grant
      // always succeeds (overflow piles — see step 6), so the
      // after-harvest step below clears progress via shrink /
      // remove / fell, and no capacity-failure retry path remains.
      state.setProgress(req.targetId, 1);
    }

    const yields = new Map<string, number>();
    mergeYields(
      yields,
      primaryYieldItem(source, gen, req.x, req.z),
      outcome.base + (rng() < outcome.bonusChance ? outcome.bonus : 0),
    );
    for (const secondary of source.secondaryYields) {
      if (rng() < secondary.chance) mergeYields(yields, secondary.item, 1);
    }
    if (source.toolGatedYields) {
      for (const gated of source.toolGatedYields) {
        if (tool === null || harvestStageRank(tool) < harvestStageRank(gated.requiresTool)) {
          continue;
        }
        const gatedYield = gated.yieldByStage[harvestStageRank(tool)];
        if (!gatedYield) continue;
        // Mole paw — earth sense (tier-1 charm): clay's
        // bonus chance rises while carried + awakened.
        const bonusChance =
          gated.item === 'CLAY' ? clayBonusChanceFor(moleEarthSense) : gatedYield.bonusChance;
        mergeYields(
          yields,
          gated.item,
          gatedYield.base + (rng() < bonusChance ? gatedYield.bonus : 0),
        );
      }
    }
    // Drop any empty-item entry (a source without a primary yield
    // cannot reach here — harvestable sources all have one — but a
    // merged '' would corrupt the inventory, so never emit it).
    yields.delete('');
    const merged = [...yields.entries()].map(([item, quantity]) => ({ item, quantity }));
    const { granted, dropped } = grantOrPile(merged, req.x, req.z);
    if (source.fellOnHarvest) {
      // TREES FELL (Adam, 2026-10-26, PINNED): the tree becomes a
      // stump at its spot, and a sapling is planted in a nearby
      // clear spot (it grows into a tree over SAPLING_GROWTH_MS).
      state.fellTree(
        req.targetId,
        req.x,
        req.z,
        Math.floor(req.x / CHUNK_SIZE),
        Math.floor(req.z / CHUNK_SIZE),
        gen,
        nowMs,
      );
    } else if (source.renewal === 'spawn-near-trees') {
      // Logs are TAKEN, not shrunk: gone from this spot for good,
      // and a fresh log spawns near trees after LOG_SPAWN_MS.
      state.remove(req.targetId);
      state.scheduleLogSpawn(req.x, req.z, gen.seed, nowMs);
    } else if (source.renewal === 'taken') {
      // TAKEN-permanent (flint stones, Adam 2026-10-27; bone
      // scatters, Adam 2026-10-29 — bones don't grow back): a
      // single pickup, gone from this spot for good — no
      // shrink, no respawn scheduling. The chunk reload on
      // harvest:completed (renderer, via wrapGenWithState)
      // removes it from view.
      state.remove(req.targetId);
    } else {
      // Ordinary sources SHRINK and REGROW (Adam, 2026-10-26).
      state.shrink(
        req.targetId,
        Math.floor(req.x / CHUNK_SIZE),
        Math.floor(req.z / CHUNK_SIZE),
        nowMs,
      );
    }
    bus.emit('harvest:completed', {
      targetId: req.targetId,
      sourceId: req.sourceId,
      kind: 'scatter',
      x: req.x,
      z: req.z,
      cx: Math.floor(req.x / CHUNK_SIZE),
      cz: Math.floor(req.z / CHUNK_SIZE),
      yields: granted,
      action: 'harvest',
      ...(dropped.length > 0 ? { dropped } : {}),
      ...(finishedMultiStep
        ? { successMessage: finishedMultiStep.successMessage }
        : {}),
    });
  });

  return () => {
    unsubMoved();
    unsubRequested();
  };
}
