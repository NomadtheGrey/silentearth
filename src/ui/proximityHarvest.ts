/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — proximity harvest contract (UI lane).
 *
 * The prop/event shape for proximity harvest buttons, matching the
 * bus contract Background registered (src/game/events.ts,
 * src/game/proximity.ts, 2026-10-26). This file is a contract, not
 * a system: it defines shapes, computes nothing, and touches no
 * inventory, no yields, and no outcome — the outcome (items into
 * inventory) is the next step, not this landing.
 *
 * HOW PROXIMITY FLOWS (the whole agreement, in one paragraph):
 * The engine supplies in-range state: ProximityTracker watches
 * 'player:moved', 'player:looked', and 'camera:switched' and emits
 * 'harvest:inRange' only when the SET of in-range targets changes,
 * ground target first when eligible, scatter nearest first, within
 * HARVEST_RANGE 2.5 m. The wiring caller maps each bus target to a
 * UI HarvestTarget (table below) and passes ONLY those targets as
 * props to ProximityHarvestButtons; a button appears when its
 * target is passed and disappears when its target stops being
 * passed. The UI computes no distance, no range, and no position:
 * anchor coordinates arrive as screen percentages, projected by
 * the caller from the bus target's world x/z.
 *
 * BUS TARGET -> UI TARGET (the mapping the wiring caller applies):
 *   bus id          -> UI id (stable: 'scatter:<chunk>:<kind>:<x>:<z>'
 *                      or 'ground:<material>')
 *   bus sourceId    -> UI sourceId ('dirt' | 'mud' | 'grass' for
 *                      ground; a scatter source id otherwise)
 *   bus kind        -> UI kind, unchanged ('scatter' | 'ground')
 *   bus name        -> UI name (the button's source label)
 *   bus x, z        -> UI worldX, worldZ (carried for the request
 *                      payload) AND projected to UI anchorX, anchorY
 *   bus distance, primaryYield, permitTier -> NOT carried in the
 *     UI target. The wiring caller keeps them: distance is already
 *     reflected in the bus's nearest-first order, permitTier is
 *     for the caller's disabled decisions (proximity itself does
 *     NOT gate by tool — Systems re-validates range + permit at
 *     outcome time), and primaryYield belongs to the outcome step.
 *
 * NEARLY ANYWHERE (Adam's scope note):
 * A target is a target — the UI gates on nothing. `kind: 'scatter'`
 * covers bushes, logs, and other scatter sources (anchors excluded
 * by proximity itself); kind 'ground' covers the ground underfoot —
 * dirt, mud, grass, the Adam-named ground materials, now real
 * sources in objects.ts (hand permit, yields DIRT/MUD/GRASS).
 * Ground targets get buttons exactly like scatter targets,
 * because the button layer never asks whether a target is
 * special enough — subject to the look-down gate below, which
 * lives in the tracker, not in this layer (see below).
 *
 * LOOK-DOWN GATE (Adam, 2026-10-26 — the clutter rule, as
 * implemented by Background in proximity.ts, 7e0de60):
 * Ground-harvest UI appears ONLY when she looks down at the ground.
 * No look down, no ground button — even standing on harvestable
 * ground. Adam's reason: ground is everywhere, so a permanent
 * ground button would be constant clutter. This is load-bearing,
 * not cosmetic: per proximity.ts the ground target is always in
 * proximity range (distance 0), so without the gate the ground
 * button would literally never disappear. Scatter buttons are
 * UNCHANGED: proximity only, no look-down requirement.
 *
 * WHERE THE GATE LIVES — READ THIS, IT CHANGED: the gate lives
 * in ProximityTracker, NOT in the UI layer. An earlier version of
 * this landing added a UI-side `lookingDown` prop to
 * ProximityHarvestButtons; that prop is REMOVED, because a second
 * UI gate would hide buttons the tracker already deemed eligible:
 * in first-person the tracker's threshold is -0.4 rad while the
 * removed UI proposal was -0.5, leaving a pitch window where the
 * tracker emits ground and the UI would have hidden it, and in
 * third-person the tracker's fallback rule (below) would have been
 * hidden entirely by a UI layer passing `lookingDown: false`.
 * The UI renders exactly what the tracker emits. A caller that
 * bypasses the tracker and passes targets directly owns gating
 * for those targets itself.
 *
 * FIRST-PERSON (tracker definition, proximity.ts LOOK_DOWN_PITCH):
 * Looking down is pitch <= -0.4 rad, about 23 degrees below level:
 * a clear intentional look-down, not a slight downward glance.
 * Pitch is in radians, clamped to ±1.45, and negative means
 * looking down (mouse-up raises pitch). The tracker re-evaluates
 * on 'player:looked' (throttled ~10 Hz, first-person only), so a
 * stationary look-down still reveals the ground button — that
 * event exists for exactly this reason. The UI keeps NO second
 * threshold constant: the tracker's -0.4 is the single value.
 *
 * THIRD-PERSON (tracker definition, PINNED by Adam 2026-10-26 —
 * keep the fallback): the overhead camera already looks down,
 * and third-person has no look input at all (mouse look is
 * first-person only), so "looking down" is trivially true there
 * — and the clutter problem is instead solved by a fallback rule:
 * in third-person the ground target appears ONLY when no scatter
 * target is in range. Ground is the fallback action when nothing
 * else is near, never a competitor to scatter buttons. Adam's
 * words: "object in range for harvest is ok."
 *
 * THE BUS SHAPE (registered in EventMap by Background, 2026-10-26):
 * The bus is the single dispatch point, events named `domain:verb`
 * with plain-object payloads. UI renders buttons from
 * 'harvest:inRange' and fires 'harvest:requested' on a press:
 *
 *   bus.emit('harvest:requested', {
 *     targetId, sourceId, kind, x, z,
 *   })
 *
 * where x, z are the WORLD coordinates from 'harvest:inRange', so
 * Systems can re-validate range + permit at outcome time rather
 * than trusting the button. No listener grants items yet — that
 * outcome is the next step (Systems). The UI never imports the
 * bus: importing game code from src/ui/ would break the lane
 * boundary this directory keeps. The wiring step connects
 * ProximityHarvestButtons' onHarvest to bus.emit with the
 * HarvestRequest below, which is exactly the bus payload.
 */

/** What a harvestable target is: a scatter source, or the ground itself. */
export type HarvestTargetKind = 'scatter' | 'ground';

/**
 * One in-range harvestable, as mapped from a 'harvest:inRange' bus
 * target (see the mapping table above). This layer holds no source
 * registry and no item ids beyond the sourceId it carries through.
 */
export interface HarvestTarget {
  /** Stable id from the bus ('scatter:...' or 'ground:<material>'). */
  id: string;
  /** Source id from the bus (scatter source id, or dirt/mud/grass). */
  sourceId: string;
  /** Display name from the bus, for the button label. */
  name: string;
  /** 'scatter' for bushes/logs/etc., 'ground' for dirt/mud/grass. */
  kind: HarvestTargetKind;
  /**
   * Whether Remove may be OFFERED for this target
   * (the Remove offer's honesty, 2026-10-31): minted by
   * the caller at projection from the source definition
   * (SOURCE_BY_ID.removable — plant-like sources only).
   * Ground targets and ground-class scatter (logs,
   * stones, silt beds, anchors) are never removable:
   * no Remove renders or arms for them, and the engine's
   * 'not-removable' outcome remains only as a backstop.
   */
  removable: boolean;
  /** Screen x of the target, in percent (0–100), caller-projected. */
  anchorX: number;
  /** Screen y of the target, in percent (0–100), caller-projected. */
  anchorY: number;
  /** World x from the bus, carried for the request payload. */
  worldX: number;
  /** World z from the bus, carried for the request payload. */
  worldZ: number;
  /**
   * Button verb override, caller-supplied. When omitted the button
   * reads "Harvest" — the bus carries no verb, so the verb is
   * presentation, not data.
   */
  actionLabel?: string;
}

/**
 * The payload a button press carries to the bus. This IS the
 * 'harvest:requested' EventMap payload, field for field — no
 * amounts, no yields, no inventory effect. Outcome logic belongs
 * to the next step.
 *
 * REMOVE (Adam, 2026-10-26; shape documented by Background in
 * events.ts, 2003619): a remove press is the same event with
 * `action: 'remove'` — totally remove the plant, bigger one-time
 * yield (primary base x 3 + bonus roll + all secondaries), gone
 * permanently (no regrow). Omitted action means 'harvest', as
 * every button already fires. Removability is outcome-time
 * (plant-like sources only; logs, stones, bone, salt, silt, and
 * anchors reject with 'not-removable'), so this layer renders
 * the remove option on all scatter targets and lets the outcome
 * event explain a rejection honestly — it holds no source
 * registry to pre-judge removability, by design.
 */
export interface HarvestRequest {
  targetId: string;
  sourceId: string;
  kind: HarvestTargetKind;
  x: number;
  z: number;
  /** What the press means. Omitted = 'harvest'. */
  action?: 'harvest' | 'remove';
}

/** Bus event name for a harvest press (registered in EventMap). */
export const HARVEST_REQUEST_EVENT = 'harvest:requested' as const;

/** Build a HarvestRequest from a target. Pure shape, no logic. */
export function harvestRequestFor(target: HarvestTarget): HarvestRequest {
  return {
    targetId: target.id,
    sourceId: target.sourceId,
    kind: target.kind,
    x: target.worldX,
    z: target.worldZ,
  };
}

/** Build a remove press from a target: same event, action 'remove'. */
export function removeRequestFor(target: HarvestTarget): HarvestRequest {
  return {
    ...harvestRequestFor(target),
    action: 'remove',
  };
}
