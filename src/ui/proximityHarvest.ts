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
 * 'player:moved' and emits 'harvest:inRange' only when the SET of
 * in-range targets changes, ground target first, scatter nearest
 * first, within HARVEST_RANGE 2.5 m. The wiring caller maps each
 * bus target to a UI HarvestTarget (table below) and passes ONLY
 * those targets as props to ProximityHarvestButtons; a button
 * appears when its target is passed and disappears when its
 * target stops being passed. The UI computes no distance, no
 * range, and no position: anchor coordinates arrive as screen
 * percentages, projected by the caller from the bus target's
 * world x/z.
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
 * A target is a target — the UI gates on nothing except the
 * look-down gate below. `kind: 'scatter'` covers bushes, logs,
 * stumps (anchors excluded by proximity itself), and other
 * scatter sources; kind 'ground' covers the ground underfoot —
 * dirt, mud, grass, the Adam-named ground materials, now real
 * sources in objects.ts (hand permit, yields DIRT/MUD/GRASS).
 * Ground targets get buttons exactly like scatter targets,
 * because the button layer never asks whether a target is
 * special enough — subject to the look-down gate, which exists
 * for clutter, not for gating harvestability itself.
 *
 * LOOK-DOWN GATE (Adam, 2026-10-26 — the clutter rule):
 * Ground-harvest UI appears ONLY when she looks down at the ground.
 * No look down, no ground button — even standing on harvestable
 * ground. Adam's reason: ground is everywhere, so a permanent
 * ground button would be constant clutter. This is load-bearing,
 * not cosmetic: per proximity.ts the ground target is ALWAYS in
 * range (distance 0), so without the gate the ground button
 * would literally never disappear. Scatter buttons are UNCHANGED:
 * proximity only, no look-down requirement. The gate lives in
 * ProximityHarvestButtons as the `lookingDown` prop: ground
 * targets render only when it is true; scatter targets render
 * whenever they are passed, as before. A standalone HarvestButton
 * has no gate — gating is the layer's job, so a caller that
 * renders a button directly has chosen to show it.
 *
 * FIRST-PERSON (this lane's proposed threshold, for the wiring step):
 * Looking down is a pitch threshold. In the controller, pitch is
 * in radians, clamped to ±1.45, and positive pitch looks up
 * (camera rotation.x, order YXZ), so looking down is NEGATIVE
 * pitch. LOOK_DOWN_PITCH_RAD below is -0.5 rad, about 29 degrees
 * below level: a deliberate downward glance, not level gaze and
 * not staring at her feet. The wiring step computes
 * `lookingDown = pitch <= LOOK_DOWN_PITCH_RAD` in first-person
 * and passes it as the prop. The threshold is a proposal —
 * Background / Adam may tune it — but the sign and the shape
 * (a single pitch comparison) are the agreement.
 *
 * THIRD-PERSON — NO NATURAL RULE YET (needs Adam's call, not
 * silently invented): the overhead camera already looks down, and
 * the controllers give third-person no pitch input at all (mouse
 * look is first-person only; pitch is a first-person field). So
 * there is currently no gesture in third-person that MEANS "she
 * looks down at the ground". This layer therefore defines
 * nothing for third-person: callers pass `lookingDown` as
 * supplied, and until Adam picks a reveal gesture, third-person
 * callers should pass false — ground buttons stay hidden there
 * rather than the UI inventing a substitute (standing still,
 * say) and calling it looking down. Options for Adam's call,
 * none decided here: a dedicated inspect-ground key in
 * third-person; ground buttons appearing when stationary with
 * no scatter button shown; or ground harvesting in third-person
 * through a held interact key. The component honours
 * `lookingDown: true` in either perspective once a real source
 * for it exists, so whichever he picks needs no component change.
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
 */
export interface HarvestRequest {
  targetId: string;
  sourceId: string;
  kind: HarvestTargetKind;
  x: number;
  z: number;
}

/** Bus event name for a harvest press (registered in EventMap). */
export const HARVEST_REQUEST_EVENT = 'harvest:requested' as const;

/**
 * First-person look-down threshold, in radians (proposal, see the
 * LOOK-DOWN GATE section above). Looking down is negative pitch,
 * so the wiring step tests `pitch <= LOOK_DOWN_PITCH_RAD`.
 * About -29 degrees: a deliberate downward glance.
 */
export const LOOK_DOWN_PITCH_RAD = -0.5;

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
