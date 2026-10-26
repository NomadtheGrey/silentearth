/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — proximity harvest contract (UI lane).
 *
 * The prop/event shape for proximity harvest buttons, agreed with
 * the event bus by convention (see below). This file is a contract,
 * not a system: it defines shapes, computes nothing, and touches no
 * inventory, no yields, and no outcome — the outcome (items into
 * inventory) is the next step, not this landing, and there is no
 * real inventory yet.
 *
 * HOW PROXIMITY FLOWS (the whole agreement, in one paragraph):
 * The engine side supplies in-range state — Background is building
 * proximity detection in parallel. The caller passes ONLY in-range
 * targets as props to ProximityHarvestButtons; a button appears when
 * its target is passed and disappears when its target stops being
 * passed. The UI computes no distance, no range, and no position:
 * anchor coordinates arrive as screen percentages, exactly like
 * WorldAnchor's x/y, projected by the caller.
 *
 * NEARLY ANYWHERE (Adam's scope note):
 * A target is a target — the UI gates on nothing. `kind: 'object'`
 * covers bushes, logs, stumps, and other special objects; kind
 * 'ground' covers the ground underfoot — dirt, mud, grass, the
 * Adam-named ground materials — which are harvestable too. Ground
 * targets get buttons exactly like objects, because the button
 * layer never asks whether a target is special enough.
 *
 * THE BUS SHAPE (proposed, following the existing bus exactly):
 * The bus (src/game/events.ts) is the single dispatch point, with
 * events named `domain:verb` and plain-object payloads
 * ('world:seedSet', 'player:moved', 'camera:switched'). The harvest
 * press therefore carries this payload, under the proposed event
 * name 'harvest:requested':
 *
 *   bus.emit('harvest:requested', {
 *     targetId, sourceName, actionLabel, kind,
 *   })
 *
 * STATUS — READ THIS BEFORE WIRING: 'harvest:requested' is NOT yet
 * registered in the bus's EventMap (which still says harvest events
 * arrive with their systems in later landings), and no proximity
 * detector has landed yet. This lane deliberately did NOT edit
 * events.ts — that file is shared, Background's proximity work is
 * in flight, and a second writer inventing the event would collide
 * with it. The wiring step (or Background's proximity landing)
 * registers this exact shape in EventMap and connects
 * ProximityHarvestButtons' onHarvest to bus.emit. Until then, the
 * button reports its press through onHarvest and nothing else.
 * The UI never imports the bus: importing game code from src/ui/
 * would break the lane boundary this directory keeps.
 */

/** What a harvestable target is: a special object, or the ground itself. */
export type HarvestTargetKind = 'object' | 'ground';

/**
 * One in-range harvestable, as supplied by the proximity system.
 * `sourceName` and `actionLabel` are caller-supplied display words;
 * this layer holds no source registry and no item ids.
 */
export interface HarvestTarget {
  /** Stable id for the target, supplied by the proximity system. */
  id: string;
  /** What is being harvested, in the caller's words. */
  sourceName: string;
  /** The action on the button, in the caller's words. */
  actionLabel: string;
  /** 'object' for bushes/logs/stumps/etc., 'ground' for dirt/mud/grass. */
  kind: HarvestTargetKind;
  /** Screen x of the target, in percent (0–100), caller-supplied. */
  anchorX: number;
  /** Screen y of the target, in percent (0–100), caller-supplied. */
  anchorY: number;
}

/**
 * The payload a button press carries to the bus (see the header for
 * the proposed event name and its pending-registration status).
 * It carries identity and words only — no amounts, no yields, no
 * inventory effect. Outcome logic belongs to the next step.
 */
export interface HarvestRequest {
  targetId: string;
  sourceName: string;
  actionLabel: string;
  kind: HarvestTargetKind;
}

/** Proposed bus event name for a harvest press (pending registration). */
export const HARVEST_REQUEST_EVENT = 'harvest:requested' as const;

/** Build a HarvestRequest from a target. Pure shape, no logic. */
export function harvestRequestFor(target: HarvestTarget): HarvestRequest {
  return {
    targetId: target.id,
    sourceName: target.sourceName,
    actionLabel: target.actionLabel,
    kind: target.kind,
  };
}
