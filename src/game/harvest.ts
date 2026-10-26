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
 * INVENTORY SHAPE: HarvestInventory is structural — PersonalInventory
 * satisfies it (free() + add()). The listener checks the TOTAL
 * non-gear quantity against free() BEFORE adding anything
 * (all-or-nothing, mirroring crafting's simulate-first): if it does
 * not fit, it emits 'harvest:failed' with reason 'inventory-full'
 * and grants nothing, shrinks/removes nothing, and does not consume
 * multi-step progress. Harvest yields are never carrying gear
 * (apron/basket/trundle are crafted, not harvested), so the free()
 * check is exact for them; if a future harvestable ever yielded
 * gear, the check would be conservative (it might fail when it
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
 *     and the after-harvest step happen.
 *  5. Yields: primary base + a bonus roll (rng() < bonusChance ?
 *     bonus : 0); each secondary drop rolls its own chance for +1;
 *     tool-gated yields (clay on silt, Adam-pinned) pay their table
 *     when the tool meets requiresTool. Same-item quantities merge.
 *  6. Capacity: total vs inventory.free(). Fits -> add each yield,
 *     then the after-harvest step (below), then emit
 *     'harvest:completed' with merged yields + chunk coords +
 *     action 'harvest'.
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
  SOURCE_BY_ID,
  harvestStageRank,
  harvestYieldForTool,
  type GroundMaterialDef,
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
 */
export interface HarvestInventory {
  free(): number;
  add(item: string, quantity: number): void;
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
  /** Defaults to Math.random (gameplay luck, not worldgen). */
  rng?: () => number;
  /** Clock for shrink/regrow/spawn timing. Defaults to Date.now. */
  now?: () => number;
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
): { workstation: boolean } {
  const minCx = Math.floor((x - HARVEST_RANGE) / CHUNK_SIZE);
  const maxCx = Math.floor((x + HARVEST_RANGE) / CHUNK_SIZE);
  const minCz = Math.floor((z - HARVEST_RANGE) / CHUNK_SIZE);
  const maxCz = Math.floor((z + HARVEST_RANGE) / CHUNK_SIZE);
  for (let cz = minCz; cz <= maxCz; cz++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (const obj of gen.generateChunk(cx, cz).objects) {
        if (obj.kind !== 'stump') continue;
        if (harvestState.isRemoved(scatterTargetId(cx, cz, obj))) continue;
        if (Math.hypot(obj.x - x, obj.z - z) <= HARVEST_RANGE) {
          return { workstation: true };
        }
      }
    }
  }
  return { workstation: false };
}

/** Map station presence onto Systems' StationContext values. */
export function stationContextForPresence(presence: {
  workstation: boolean;
}): 'workstation' | null {
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
  | 'inventory-full';

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
      const yields = new Map<string, number>();
      mergeYields(
        yields,
        ground.primaryYield,
        outcome.base + (rng() < outcome.bonusChance ? outcome.bonus : 0),
      );
      const merged = [...yields.entries()].map(([item, quantity]) => ({ item, quantity }));
      const total = merged.reduce((sum, y) => sum + y.quantity, 0);
      if (total > deps.inventory.free()) {
        fail(req, 'inventory-full', merged);
        return;
      }
      for (const y of merged) deps.inventory.add(y.item, y.quantity);
      bus.emit('harvest:completed', {
        targetId: req.targetId,
        sourceId: ground.id,
        kind: 'ground',
        x: pos.x,
        z: pos.z,
        cx: Math.floor(pos.x / CHUNK_SIZE),
        cz: Math.floor(pos.z / CHUNK_SIZE),
        yields: merged,
        action: 'harvest',
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
      const logYields = new Map<string, number>();
      mergeYields(
        logYields,
        logSource.primaryYield ?? '',
        logOutcome.base + (rng() < logOutcome.bonusChance ? logOutcome.bonus : 0),
      );
      logYields.delete('');
      const logMerged = [...logYields.entries()].map(([item, quantity]) => ({ item, quantity }));
      if (logMerged.reduce((sum, y) => sum + y.quantity, 0) > deps.inventory.free()) {
        fail(req, 'inventory-full', logMerged);
        return;
      }
      for (const y of logMerged) deps.inventory.add(y.item, y.quantity);
      state.takeSpawnedLog(req.targetId, nowMs, gen.seed);
      bus.emit('harvest:completed', {
        targetId: req.targetId,
        sourceId: logSource.id,
        kind: 'scatter',
        x: spawned.x,
        z: spawned.z,
        cx: spawned.cx,
        cz: spawned.cz,
        yields: logMerged,
        action: 'harvest',
      });
      return;
    }

    // --- Worldgen scatter: removed, range, source match, permit.
    if (state.isRemoved(req.targetId)) {
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
        source.primaryYield ?? '',
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
          mergeYields(
            removeYields,
            gated.item,
            gatedYield.base + (rng() < gatedYield.bonusChance ? gatedYield.bonus : 0),
          );
        }
      }
      removeYields.delete('');
      const removeMerged = [...removeYields.entries()].map(([item, quantity]) => ({ item, quantity }));
      if (removeMerged.reduce((sum, y) => sum + y.quantity, 0) > deps.inventory.free()) {
        fail(req, 'inventory-full', removeMerged);
        return;
      }
      for (const y of removeMerged) deps.inventory.add(y.item, y.quantity);
      state.remove(req.targetId);
      bus.emit('harvest:completed', {
        targetId: req.targetId,
        sourceId: req.sourceId,
        kind: 'scatter',
        x: req.x,
        z: req.z,
        cx: Math.floor(req.x / CHUNK_SIZE),
        cz: Math.floor(req.z / CHUNK_SIZE),
        yields: removeMerged,
        action: 'remove',
      });
      return;
    }

    // --- HARVEST action: regrowing targets refuse (stale buttons).
    if (state.isRegrowing(req.targetId, nowMs)) {
      fail(req, 'regrowing');
      return;
    }
    if (source.multiStep) {
      const progress = Math.min(1, state.progressFor(req.targetId) + source.multiStep.step);
      if (progress < 1) {
        state.setProgress(req.targetId, progress);
        bus.emit('harvest:progress', {
          targetId: req.targetId,
          sourceId: req.sourceId,
          progress,
        });
        return;
      }
      // Progress reaches 1: fall through to grant; cleared on success
      // below, and left at 1 on capacity failure so the next press
      // retries the grant without redoing the steps.
      state.setProgress(req.targetId, 1);
    }

    const yields = new Map<string, number>();
    mergeYields(
      yields,
      source.primaryYield ?? '',
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
        mergeYields(
          yields,
          gated.item,
          gatedYield.base + (rng() < gatedYield.bonusChance ? gatedYield.bonus : 0),
        );
      }
    }
    // Drop any empty-item entry (a source without a primary yield
    // cannot reach here — harvestable sources all have one — but a
    // merged '' would corrupt the inventory, so never emit it).
    yields.delete('');
    const merged = [...yields.entries()].map(([item, quantity]) => ({ item, quantity }));
    const total = merged.reduce((sum, y) => sum + y.quantity, 0);
    if (total > deps.inventory.free()) {
      fail(req, 'inventory-full', merged);
      return;
    }
    for (const y of merged) deps.inventory.add(y.item, y.quantity);
    if (source.renewal === 'spawn-near-trees') {
      // Logs are TAKEN, not shrunk: gone from this spot for good,
      // and a fresh log spawns near trees after LOG_SPAWN_MS.
      state.remove(req.targetId);
      state.scheduleLogSpawn(req.x, req.z, gen.seed, nowMs);
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
      yields: merged,
      action: 'harvest',
    });
  });

  return () => {
    unsubMoved();
    unsubRequested();
  };
}
