/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — proximity harvest buttons (UI lane, presentation only).
 *
 * The layer that turns in-range targets into buttons, world-anchored:
 * each target gets a HarvestButton inside a WorldAnchor at the
 * target's screen point, so the button sits on the thing it harvests
 * — a bush, a log, a stump, or the ground underfoot. No separate
 * screen, no panel, no list: the world itself is the menu.
 *
 * Appearance and disappearance are the caller's doing, by design:
 * the caller passes ONLY in-range targets (supplied by the proximity
 * system Background is building). A target that stops being passed
 * stops having a button. With no targets, this renders nothing —
 * that empty state IS the disappeared state, not an error and not a
 * placeholder panel. This layer computes no proximity and holds no
 * target list of its own.
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
  /** In-range targets only, supplied by the proximity system. */
  targets: HarvestTarget[];
  /** Called with the HarvestRequest for any button press. */
  onHarvest?: (request: HarvestRequest) => void;
  /** Look for the buttons. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function ProximityHarvestButtons({
  targets,
  onHarvest,
  theme = 'mire',
}: ProximityHarvestButtonsProps) {
  if (targets.length === 0) {
    return null;
  }
  return (
    <>
      {targets.map((target) => (
        <Fragment key={target.id}>
          <WorldAnchor x={target.anchorX} y={target.anchorY} interactive>
            <HarvestButton target={target} onHarvest={onHarvest} theme={theme} />
          </WorldAnchor>
        </Fragment>
      ))}
    </>
  );
}
