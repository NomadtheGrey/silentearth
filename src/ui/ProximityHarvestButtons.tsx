/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — proximity harvest buttons (UI lane, presentation only).
 *
 * The layer that turns in-range targets into buttons, world-anchored:
 * each target gets a HarvestButton inside a WorldAnchor at the
 * target's screen point, so the button sits on the thing it harvests
 * — a bush, a log, or the ground underfoot. No separate screen,
 * no panel, no list: the world itself is the menu.
 *
 * Appearance and disappearance are the caller's doing, by design:
 * the caller passes ONLY in-range targets, mapped from the bus's
 * 'harvest:inRange' event (see proximityHarvest.ts for the mapping).
 * A target that stops being passed stops having a button. With no
 * targets, this renders nothing — that empty state IS the
 * disappeared state, not an error and not a placeholder panel.
 * This layer computes no proximity and holds no target list of
 * its own. Note the ground target is always in range per
 * proximity.ts, so the look-down gate below is what keeps the
 * ground button from being permanent.
 *
 * LOOK-DOWN GATE (Adam, 2026-10-26): ground targets render only
 * when `lookingDown` is true; scatter targets are unaffected and
 * render whenever passed. Ground is everywhere — and per
 * proximity.ts the ground target is always in range — so an
 * ungated ground button would be permanent clutter: no look
 * down, no ground button, even standing on harvestable ground.
 * See proximityHarvest.ts for the first-person pitch threshold
 * and for the third-person gap, which needs Adam's call.
 *
 * Render this inside a relatively-positioned overlay (e.g. HudShell)
 * so the anchors position against the game view. A press on any
 * button reports its HarvestRequest through onHarvest; outcome
 * (items into inventory) is the next step, not this component.
 */

import { Fragment } from 'react';
import { WorldAnchor } from './WorldAnchor';
import { HarvestButton } from './HarvestButton';
import type { HarvestTarget, HarvestRequest } from './proximityHarvest';
import type { UiThemeName } from './themes';

export interface ProximityHarvestButtonsProps {
  /** In-range targets only, mapped from 'harvest:inRange' (see proximityHarvest.ts). */
  targets: HarvestTarget[];
  /** Called with the HarvestRequest for any button press. */
  onHarvest?: (request: HarvestRequest) => void;
  /** Look for the buttons. Default "mire" (the world outside). */
  theme?: UiThemeName;
  /**
   * Whether she is looking down at the ground (Adam's clutter rule).
   * Ground targets render only when true; scatter targets are
   * unaffected. Default false: no look down, no ground button.
   * First-person source: pitch <= LOOK_DOWN_PITCH_RAD (see
   * proximityHarvest.ts). Third-person has no natural source yet —
   * pass false there until Adam picks a reveal gesture.
   */
  lookingDown?: boolean;
}

export function ProximityHarvestButtons({
  targets,
  onHarvest,
  theme = 'mire',
  lookingDown = false,
}: ProximityHarvestButtonsProps) {
  const visibleTargets = targets.filter(
    (target) => target.kind !== 'ground' || lookingDown,
  );
  if (visibleTargets.length === 0) {
    return null;
  }
  return (
    <>
      {visibleTargets.map((target) => (
        <Fragment key={target.id}>
          <WorldAnchor x={target.anchorX} y={target.anchorY} interactive>
            <HarvestButton target={target} onHarvest={onHarvest} theme={theme} />
          </WorldAnchor>
        </Fragment>
      ))}
    </>
  );
}
