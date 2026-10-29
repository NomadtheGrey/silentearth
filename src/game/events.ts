/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Minimal typed event bus — the SINGLE dispatch point for cross-system
 * communication in Silent Earth. Systems emit events here; they never call
 * each other directly. This is what makes the loop host-authority-shaped
 * for later P2P co-op: a future host can relay these same events to peers
 * instead of rewiring every system.
 *
 * Landing 1 events only, plus the proximity/harvest contract (2026-10-26):
 * the bus is the SHARED CONTRACT between this lane (proximity detection,
 * src/game/proximity.ts) and the UI lane (harvest buttons). Nothing is
 * agreed outside it: UI renders buttons from 'harvest:inRange' and fires
 * 'harvest:requested' when one is pressed. The OUTCOME (items into
 * inventory) is the next step, not this landing — no listener grants
 * items yet; Systems will consume 'harvest:requested'.
 * Ground targets in 'harvest:inRange' are look-down-gated (Adam,
 * 2026-10-26): proximity AND looking down, per proximity.ts.
 */

import type { BiomeId, CameraMode } from '../types';
import type { FireType, LightingMethod } from './fire';
import type { HouseType } from './shelter';
import type { SleepFailedReason } from './sleep';
import type { TrapType } from './traps';
import type { PermitTier } from './objects';

export interface EventMap {
  /** A new world seed was set (initial load or regenerate). */
  'world:seedSet': { seed: string };
  /** A chunk's meshes were built and added to the scene. */
  'world:chunkLoaded': { cx: number; cz: number; objectCount: number };
  /** A chunk's meshes were removed from the scene. */
  'world:chunkUnloaded': { cx: number; cz: number };
  /** Player position changed (throttled to ~10 Hz by the controller). */
  'player:moved': { x: number; z: number; chunkX: number; chunkZ: number };
  /**
   * Player look changed in first-person (throttled to ~10 Hz by the
   * controller). Exists because looking down while STANDING STILL must
   * still update proximity: 'player:moved' only fires while walking,
   * so a stationary look-down would otherwise never reach the tracker.
   * Pitch sign: negative = looking down (mouse-up raises pitch).
   */
  'player:looked': { pitch: number; mode: CameraMode };
  /** Camera mode toggled (V or C). */
  'camera:switched': { mode: CameraMode };
  /**
   * Sprint started or stopped (player.ts, 2026-10-29 — transitions
   * only, never per-frame). The shell's hunger wiring reads this:
   * sprinting drains hunger faster (rate is UI/Systems' half).
   */
  'player:sprint-changed': { sprinting: boolean };
  /**
   * In-range harvest targets changed (enter/leave only — the tracker
   * diffs by target id, so steady walking does not spam UI). UI renders
   * one harvest button per target and hides buttons for targets that
   * left. A target is a scatter source within HARVEST_RANGE, or the
   * ground material underfoot (always in range, distance 0, kind
   * 'ground'). permitTier is carried so UI/Systems can filter by the
   * tool she holds; proximity itself does NOT gate by tool (it does
   * not know her tool — Systems owns that). Distance is the value at
   * emission time; it does not by itself trigger a re-emit.
   */
  'harvest:inRange': {
    targets: {
      /** Stable id: 'scatter:<chunk>:<kind>:<x>:<z>' or 'ground:<material>'. */
      id: string;
      /** Scatter source id, or the ground material id (dirt/mud/grass). */
      sourceId: string;
      kind: 'scatter' | 'ground';
      /** Scatter object position, or her position for ground. */
      x: number;
      z: number;
      /** Metres from her, at emission time. */
      distance: number;
      /** Display name for the button label. */
      name: string;
      /** Primary yield item id. */
      primaryYield: string;
      /** Lowest tool tier that permits it ('hand' = no tool needed). */
      permitTier: PermitTier;
    }[];
  };
  /**
   * A harvest button was pressed. UI emits this; NO listener grants
   * items in this landing — that outcome is the next step (Systems).
   * The payload identifies the target exactly as 'harvest:inRange'
   * described it, so Systems can re-validate range + permit at
   * outcome time rather than trusting the button.
   */
  'harvest:requested': {
    targetId: string;
    sourceId: string;
    kind: 'scatter' | 'ground';
    x: number;
    z: number;
    /**
     * What the press means. Omitted = 'harvest' (backward compatible
     * with every button already firing this event). 'remove' =
     * TOTALLY REMOVE the plant (Adam, 2026-10-26): a bigger one-time
     * yield, and the plant is gone permanently (no regrow). UI
     * renders the remove option alongside the normal harvest button
     * for removable sources (see harvest.ts); ground and
     * non-removable sources reject 'remove' with 'not-removable'.
     */
    action?: 'harvest' | 'remove';
  };
  /**
   * A harvest press resolved into items (harvest.ts outcome listener).
   * UI shows feedback from this and refreshes inventory. cx/cz are
   * the chunk containing the target, so the renderer can reload just
   * that chunk (the harvested object shrinks, or leaves on remove). Yields are already
   * merged by item (one entry per item).
   */
  'harvest:completed': {
    targetId: string;
    sourceId: string;
    kind: 'scatter' | 'ground';
    x: number;
    z: number;
    cx: number;
    cz: number;
    yields: { item: string; quantity: number }[];
    /** Which action produced this completion ('harvest' or 'remove'). */
    action: 'harvest' | 'remove';
    /**
     * Overflow that did not fit (harvest overflow, Adam 2026-10-26):
     * what fits is in `yields`; the rest dropped as ground piles at
     * the target's spot (see pileState.ts). Absent when everything
     * fit. UI renders granted + dropped separately.
     */
    dropped?: { item: string; quantity: number }[];
    /**
     * The def's success message, present ONLY when this press
     * finished a multi-step harvest (pill-fill UI, 2026-10-29).
     * Absent on single-press completions, remove, pile and ground
     * completions — their shape is unchanged for other consumers.
     */
    successMessage?: string;
  };
  /**
   * A multi-step harvest (prototype TUG/STOMP) advanced but has not
   * finished: progress is 0..1, no items granted, nothing shrinks or is removed.
   * UI shows progress from this; the next press on the same target
   * continues from this progress.
   */
  'harvest:progress': {
    targetId: string;
    sourceId: string;
    progress: number;
    /**
     * Pill-fill fields (2026-10-29), all read from the source's
     * MultiStep def in the game layer (never derived in App):
     * which press this was (1-based), how many presses the def
     * takes in total, the def's verb (TUG / STOMP), and the def's
     * struggle message for this unfinished press.
     */
    pressIndex: number;
    pressesTotal: number;
    verb: string;
    struggleMessage: string;
  };
  /**
   * A harvest press that granted NOTHING (failure/feedback event).
   * On any failure, no items move, nothing shrinks or is removed,
   * and multi-step progress is NOT consumed. NOTE (harvest
   * overflow, Adam 2026-10-26): capacity is no longer a failure —
   * a harvest that does not fit COMPLETES with the overflow
   * dropped as ground piles (see pileState.ts), so 'inventory-full'
   * is no longer emitted by this listener; the reason literal
   * stays in the union for compatibility, and 'yields' still
   * carries attempted yields on it should any caller emit it.
   */
  'harvest:failed': {
    targetId: string;
    sourceId: string;
    kind: 'scatter' | 'ground';
    reason:
      | 'out-of-range'
      | 'regrowing'
      | 'removed'
      | 'not-removable'
      | 'below-permit'
      | 'permit-tbd'
      | 'anchor'
      | 'not-harvestable'
      | 'target-mismatch'
      | 'inventory-full'
      | 'too-hungry';
    yields: { item: string; quantity: number }[];
  };
  /**
   * Dropped piles (harvest overflow, Adam 2026-10-26 — see
   * pileState.ts; MULTI-KIND model, Adam 2026-10-27: one pile
   * holds many kinds in `stacks`). 'pile:dropped' fires for a
   * NEW pile only; 'pile:changed' fires when a drop merges into
   * an existing pile (kind added or topped up) or a pickup takes
   * part of one; 'pile:removed' fires when a pile's last kind
   * leaves. The tracker carries in-range piles separately
   * as 'piles:inRange' (change-only, like 'harvest:inRange').
   * 'pile:pickup-requested' is UI's future pile button → Systems'
   * pickup grant listener (Systems' half, not emitted by the
   * engine yet — no pile buttons exist until UI builds them).
   * `item` + `quantity` on the pile payloads are pileState's
   * INTERIM legacy (first stack only); new readers use stacks.
   */
  'pile:dropped': { id: string; stacks: { item: string; quantity: number }[]; item: string; quantity: number; x: number; z: number };
  'pile:changed': { id: string; stacks: { item: string; quantity: number }[]; item: string; quantity: number; x: number; z: number };
  'pile:removed': { id: string };
  'piles:inRange': {
    piles: { id: string; stacks: { item: string; quantity: number }[]; item: string; quantity: number; x: number; z: number; distance: number }[];
  };
  'pile:pickup-requested': { pileId: string };
  /**
   * Pause state changed (Adam 2026-10-26: pause when not in
   * focus — core flag + shell gate, see pause.ts). The shell
   * gates its timers (hunger interval, turn-stick rAF, FPS
   * sampler, feedback timers) on this; UI's "Paused" indicator
   * surface reads it too. Fires on CHANGE only (setPaused is
   * idempotent) — a redundant set emits nothing.
   */
  'game:pause-changed': { paused: boolean };
  /**
   * The dominant-biome weather regime changed at her position
   * (emitted by the proximity tracker — see weather.ts for the
   * query/event split). The payload carries the full blended
   * weather at the new position, so UI can display it without a
   * second query; Systems can re-read via weatherAt any time.
   * Fires on dominant-biome change only, not on every step.
   */
  'weather:changed': {
    wind: number;
    rain: number;
    harshness: number;
    dominant: BiomeId;
    weights: Record<BiomeId, number>;
  };
  /**
   * A fire entity was placed (fireState.placeFire). Free
   * placement — no cost or gate at this layer (Systems + UI own
   * recipes/gating). Renderer rebuilds the placed group from this.
   */
  'fire:placed': { id: string; type: FireType; x: number; z: number };
  /**
   * Lighting progressed on an unlit fire: flint clicks so far
   * (phase null), or friction phase ('waiting' until the wait
   * ends, then 'ready'). Renderer does not need this (only lit
   * state changes meshes); UI shows progress from it.
   */
  'fire:lighting': {
    id: string;
    type: FireType;
    method: LightingMethod;
    clicks: number;
    phase: 'waiting' | 'ready' | null;
  };
  /** A fire lit, by flint or friction. Renderer shows its flame. */
  'fire:lit': { id: string; type: FireType; x: number; z: number; method: LightingMethod };
  /**
   * A house was placed (shelterState.placeHouse). Free placement
   * — no zone/plot gate. Renderer rebuilds the placed group; the
   * shelter query reads live state, so no re-wiring is needed.
   */
  'shelter:placed': { id: string; type: HouseType; x: number; z: number };
  /**
   * A placed house UPGRADED in place (shelterState.upgradeHouse):
   * same id, same position, new type. Deliberately NOT
   * 'shelter:placed' — an upgrade is not a new house, and
   * placement-counting listeners (e.g. App's new-houses count)
   * must not fire on it. Renderer rebuilds the placed group on
   * this (new type = new meshes); the shell follows it with
   * getHomeStore(id).setHouse(newType) for capacity.
   */
  'shelter:upgraded': { id: string; type: HouseType };
  /**
   * A loom was placed (loomState.placeLoom). Free placement
   * — no zone/plot gate, like fires and houses. Renderer
   * rebuilds the placed group; stationPresence reads live
   * state, so no re-wiring is needed.
   */
  'loom:placed': { id: string; x: number; z: number };
  /**
   * A torch was placed (torchState.placeTorch, Adam 2026-10-27
   * — a carried lit torch planted to light an area or path).
   * Free placement, cost-free engine primitive — the consume
   * of one carried 'lit-torch' lives with Systems + UI.
   * Renderer rebuilds the placed group from this; UI projects
   * placed-torch chips from torchState.snapshot() + this event.
   */
  'torch:placed': { id: string; x: number; z: number };
  /**
   * A placed torch was picked back up (torchState.removeTorch).
   * The pickup grant (return 'lit-torch', lit not unlit) lives
   * with Systems. Renderer rebuilds the placed group from this.
   */
  'torch:removed': { id: string };
  /**
   * A made altar was placed (altarState.placeAltar, Adam
   * 2026-10-27 — placeable + visible ONLY, no ritual
   * actions). Free placement, cost-free engine primitive —
   * the craft + consume lives with Systems + UI. Renderer
   * rebuilds the placed group from this; UI projects
   * placed-altar chips (label-only) from altarState
   * .snapshot() + this event.
   */
  'altar:placed': { id: string; x: number; z: number };
  /**
   * A placed altar was removed (altarState.removeAltar).
   * No removal UI exists in this order (label-only chip) —
   * the event exists so the renderer + shell stay in sync
   * if one ever does. Renderer rebuilds the placed group.
   */
  'altar:removed': { id: string };
  /**
   * A stump anchor gained the workstation addition
   * (stumpState.upgradeStump, Adam 2026-10-28 — stumpy
   * workstation upgrade). Same stumpSiteId, same
   * position — transformation, not consumption, and
   * NOT a new entity. Renderer rebuilds the placed
   * group (workbench overlay appears on the stump);
   * the shell follows it with its branch (UI follow-up).
   */
  'stump:upgraded': { siteId: string; x: number; z: number };
  /**
   * A bone was staged on a ritual site (ritualSiteState
   * .stageBone, Adam 2026-10-27 — tier-1 Waking, site
   * side). Site is the full site ref (kind + siteId + x/z);
   * bone is Systems' design key (opaque here). Renderer
   * rebuilds the staged-bone group from this; Systems'
   * completion logic reads the state, not this event.
   */
  'ritual:staged': {
    site: { kind: 'altar' | 'stump' | 'boulder'; siteId: string; x: number; z: number };
    bone: string;
  };
  /**
   * A staged bone left its site (ritualSiteState
   * .unstageBone, or replaced by a new staging on the same
   * site — replace emits unstaged, then staged). Renderer
   * rebuilds the staged-bone group from this.
   */
  'ritual:unstaged': { siteId: string };
  /**
   * A trap entity was placed (trapState.placeTrap, Adam's
   * rule: crafting a trap places it right there). Cost-free
   * engine primitive — recipe/cost gating lives with Systems
   * + UI. Renderer rebuilds the trap group from this. NOTE:
   * no Systems emit exists today — placeTrap owns this emit,
   * and the craft-success call site (shell/Systems) is the
   * follow-up; exactly one caller must place per craft, or
   * one craft places two traps.
   */
  'trap:placed': { id: string; type: TrapType; x: number; z: number };
  /**
   * A trap's catch changed (trapState.setCatch, the shell's write path:
   * set on caught hour-roll, cleared on granted collection; kind null =
   * cleared). Shell saves + UI row re-reads the snapshot on this.
   */
  'trap:catch': { id: string; kind: string | null };
  /**
   * The game hour rolled (trapState.checkHour, called from the
   * renderer's 2 s worldTick). The shell rolls per placed trap on
   * this (biomePresent → eligibleKindsFor → resolveTrapHour →
   * setCatch on caught); the emit itself carries only the hour.
   */
  'trap:hour': { hour: number };
  /**
   * Shelter state at her position changed (tracker, change-only,
   * like weather:changed): multiplier from real placed houses
   * (1 = unsheltered), houseId of the nearest sheltering house
   * or null. First recompute always emits (multiplier starts
   * null, so the initial state always differs).
   */
  'shelter:changed': { multiplier: number; houseId: string | null };
  /**
   * Sleep until sunrise (Adam 2026-10-27 — see sleep.ts).
   * 'sleep:requested' is UI's sleep button → the sleep outcome
   * listener: her position at press time. 'sleep:completed'
   * means the live sky jumped to dawn (cycleT 0) — time-only,
   * no hunger/health restore, no player move; houseId names the
   * nearby house, or null when she sleeps away from any house
   * (anywhere sleep, Adam 2026-10-28 — no shelter gate).
   * 'sleep:failed' carries one reason: 'not-night' (daytime
   * press) or 'no-sky' (no live rig). Check order is sky,
   * then night.
   */
  'sleep:requested': { x: number; z: number };
  'sleep:completed': { x: number; z: number; cycleT: 0; houseId: string | null };
  'sleep:failed': { x: number; z: number; reason: SleepFailedReason };
}

type Handler<E> = (payload: E) => void;

export class EventBus {
  private listeners = new Map<keyof EventMap, Set<Handler<never>>>();

  on<K extends keyof EventMap>(type: K, handler: Handler<EventMap[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => set!.delete(handler as Handler<never>);
  }

  emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    // Copy: a handler may unsubscribe mid-dispatch.
    for (const handler of [...set]) {
      (handler as Handler<EventMap[K]>)(payload);
    }
  }
}

/** Shared singleton. Import this; do not construct a second bus. */
export const bus = new EventBus();
