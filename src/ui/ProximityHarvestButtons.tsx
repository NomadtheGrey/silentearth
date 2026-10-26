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
 * LOOK-DOWN GATE (Adam, 2026-10-26): this layer does NOT gate.
 * Ground targets arrive here only when ProximityTracker already
 * deemed them eligible (first-person pitch <= -0.4 rad, or
 * third-person with no scatter target in range — see
 * proximityHarvest.ts). An earlier version of this landing added
 * a UI-side `lookingDown` prop; it was removed, because a second
 * gate would hide buttons the tracker already approved. This
 * component renders exactly what it is passed: the tracker's
 * output is the gate. A caller bypassing the tracker owns
 * gating for the targets it passes directly.
 *
 * Render this inside a relatively-positioned overlay (e.g. HudShell)
 * so the anchors position against the game view. A press on any
 * button reports its HarvestRequest through onHarvest; outcome
 * (items into inventory) is the next step, not this component.
 *
 * REMOVE OPTION (Adam, 2026-10-26): when the caller passes
 * onRemove, each SCATTER target also gets a RemoveButton stacked
 * under its Harvest button — totally remove the plant, more at
 * once, gone permanently. Ground targets never get one (no plant
 * to remove), and with no onRemove passed nothing extra renders.
 * onRemove receives the target itself, not a bus payload — the
 * wiring caller maps the target to Background's documented
 * remove shape ('harvest:requested' with action 'remove',
 * 2003619); this layer invents no event.
 */

import { Fragment } from 'react';
import { WorldAnchor } from './WorldAnchor';
import { HarvestButton, RemoveButton } from './HarvestButton';
import type { HarvestTarget, HarvestRequest } from './proximityHarvest';
import type { UiThemeName } from './themes';

export interface ProximityHarvestButtonsProps {
  /** In-range targets only, mapped from 'harvest:inRange' (see proximityHarvest.ts). */
  targets: HarvestTarget[];
  /** Called with the HarvestRequest for any button press. */
  onHarvest?: (request: HarvestRequest) => void;
  /**
   * Called with the target for a remove press. Scatter targets
   * only; when omitted, no remove button renders. The wiring
   * caller maps the target to Background's documented remove
   * event — this layer defines no bus payload for removal.
   */
  onRemove?: (target: HarvestTarget) => void;
  /** Verb for the remove button. Default "Remove" (lane's pick). */
  removeLabel?: string;
  /** Look for the buttons. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function ProximityHarvestButtons({
  targets,
  onHarvest,
  onRemove,
  removeLabel = 'Remove',
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
            {target.kind === 'scatter' && onRemove ? (
              <div className="flex flex-col items-center gap-1">
                <HarvestButton
                  target={target}
                  onHarvest={onHarvest}
                  theme={theme}
                />
                <RemoveButton
                  target={target}
                  onRemove={onRemove}
                  removeLabel={removeLabel}
                  theme={theme}
                />
              </div>
            ) : (
              <HarvestButton
                target={target}
                onHarvest={onHarvest}
                theme={theme}
              />
            )}
          </WorldAnchor>
        </Fragment>
      ))}
    </>
  );
}
