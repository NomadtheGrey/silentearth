/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — proximity harvest buttons (UI lane, presentation only).
 *
 * The layer that turns in-range targets into buttons, screen-fixed:
 * one column fixed just above the middle of the screen (bottom
 * edge at 52% of view height, so it grows upward, never over the
 * middle), holding a button per target. The world-anchored
 * version slid up behind screen UI as the camera moved; this
 * version stays put, so every in-range target stays reachable
 * and tappable. No separate screen, no panel: the column is
 * the menu, and it renders above panel layers (z-40) and below
 * modals (z-50) — the caller places this component in a z-40
 * overlay for that layering to hold.
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
 * Order is the passed order: the tracker emits the ground target
 * first when eligible (it is at her feet, so nearest) and scatter
 * sorted by distance — no re-sort here, and HarvestTarget carries
 * no distance field to sort by. Each button already names its
 * target (HarvestButton shows verb + name), and buttons are
 * thumb-sized (min 44 px tall). The column scrolls past 40vh so
 * a crowd of targets never covers the screen. A press on any
 * button reports its HarvestRequest through onHarvest; outcome
 * (items into inventory) is the next step, not this component.
 * NOTE: the targets' anchorX/anchorY are no longer consumed
 * here (position is screen-fixed now); the caller still computes
 * them in its shared projection pass, which also serves fire
 * and placement anchors. Removing harvest projection is a
 * follow-up cleanup, not part of this position-only change.
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
    <div className="pointer-events-auto absolute bottom-[52%] left-1/2 z-40 flex max-h-[40vh] w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col items-center gap-2 overflow-y-auto px-1 py-1">
      {targets.map((target) => (
        <Fragment key={target.id}>
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
        </Fragment>
      ))}
    </div>
  );
}
