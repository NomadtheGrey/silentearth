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
 * STATION ANCHOR (Adam, 2026-10-28, reading (b)): when the
 * caller passes stationAnchor, the column instead sits above
 * that projected point (translate(-50%, calc(-100% - 8px)) —
 * the WorldAnchor above-point placement, but inside this z-40
 * overlay, never the z-30 anchor overlay, so the behind-UI
 * sliding stays fixed). Without stationAnchor, screen-fixed
 * as above. The caller owns the point (nearest station's
 * projected center); this layer only positions on it.
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
 * thumb-sized (min 44 px tall). The column scrolls past its
 * max height so a crowd of targets never covers the screen.
 *
 * TOP EDGE (Adam's live-phone report, 2026-10-26 — harvest
 * buttons unclickable): the column is bottom-anchored at 52%,
 * so its top edge is 48vh minus its height — on a short
 * landscape viewport three buttons reached ~30 px from the
 * top, straight under the top-2 z-40 slim bar (same z-40, later
 * in DOM, so the bar painted over the top button and ate the
 * tap). The max height below IS the top constraint: height is
 * capped at 48vh minus a clearance T, so the top edge never
 * rises above T — T = 112 px on narrow screens (a wrapped
 * two-row slim bar ends at 104 px) and 60 px on screens 480 px
 * and wider (a single-row bar, or the Hide HUD button, ends
 * at 52 px), each with 8 px of clearance, and never below one
 * button (56 px floor) so the column always shows something
 * and scrolls for the rest. Bottom edge stays at 52% — the
 * "just above the middle" placement is unchanged, only the
 * visible count shrinks on short screens. The camera row that
 * used to be a second overlap band is gone on WIP (it moved
 * into Options); it still exists on main until the next merge.
 * A press on any button reports its HarvestRequest through onHarvest; outcome
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
 *
 * HARVESTED SUPPRESSION (pill fix, Adam 2026-10-28): when
 * the caller passes harvestedIds, a target in the set
 * renders NO Harvest button — it was just harvested, and
 * its button must be gone by the time the pickup pill
 * shows (the tracker hides regrowing plants until
 * regrown, so the button returns only on re-emit). The
 * Remove button still renders for a harvested scatter
 * target (remove is permanent and stays available);
 * ground targets are never marked harvested by the
 * caller (a pile may still hold items after a take).
 *
 * TRAP ROW (Adam, 2026-10-28): when the caller passes
 * trap, one trap button renders after all harvest
 * buttons (before the hive row when one follows),
 * with the caller's label and no KindGlyph — plain
 * text, same button look. Null trap = no row (the
 * caller owns gating: panels/modals/paused pass null;
 * legacy harvest rows stay ungated). A press reports
 * the trap id through onCollectTrap; the outcome
 * (grant, pack-full, nothing-caught) is the caller's
 * job, not this component's. The row renders even
 * with zero harvest targets (a trap nearby, no
 * plants) — the empty-targets null return yields only
 * when there is no trap and no hive either.
 *
 * HIVE ROW (Adam, 2026-10-28): when the caller passes
 * hive, one hive button renders LAST in the column
 * (after the trap row), with the caller's label and
 * no KindGlyph — plain text, same button look. Null
 * hive = no row (the caller owns gating, trap-row
 * list verbatim). A press reports the hive coords
 * through onHarvestHive; the outcome (grant,
 * torch-refusal, pack-full, too-hungry refusal) is
 * the caller's job, not this component's. The row
 * renders even with zero harvest targets (a hive
 * nearby, no plants) — the empty-targets null return
 * yields only when there is no trap and no hive.
 */

import { Fragment, type ReactNode } from 'react';
import { HarvestButton, RemoveButton } from './HarvestButton';
import type { HarvestTarget, HarvestRequest } from './proximityHarvest';
import { KEY_BADGE_CLASS, UI_THEMES, type UiThemeName } from './themes';

export interface ProximityHarvestButtonsProps {
  /** In-range targets only, mapped from 'harvest:inRange' (see proximityHarvest.ts). */
  targets: HarvestTarget[];
  /**
   * Ids harvested since the last projection (pill fix):
   * their Harvest button suppresses (Remove still
   * renders). Caller-owned; omitted = no suppression.
   */
  harvestedIds?: ReadonlySet<string>;
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
  /**
   * Optional node rendered first in the column, above the
   * harvest buttons (e.g. a LOOK action for the nearest
   * target). The caller owns its visibility and content.
   */
  lookNode?: ReactNode;
  /**
   * Projected station center (percent, caller-projected) to
   * anchor the column above when standing at a station
   * (pill fix (b)). Omitted or null = screen-fixed column
   * as before. The column keeps its z-40 overlay either way.
   */
  stationAnchor?: { x: number; y: number } | null;
  /**
   * Nearest placed trap in range, caller-derived (null =
   * no row — gated or none in range). Renders after all
   * harvest buttons, before the hive row when one
   * follows, even with zero harvest targets.
   */
  trap?: { id: string; label: string } | null;
  /** Called with the trap id for a trap-row press. */
  onCollectTrap?: (id: string) => void;
  /**
   * Nearest wild hive in range, caller-derived (null =
   * no row — gated or none in range). Renders LAST in
   * the column (after the trap row), even with zero
   * harvest targets. Coords are the identity — hives
   * carry no ids.
   */
  hive?: { x: number; z: number; label: string } | null;
  /** Called with the hive coords for a hive-row press. */
  onHarvestHive?: (x: number, z: number) => void;
  /**
   * Show PC key badges on the keyed rows (trap row "E",
   * hive row "E" — USE dispatches to the faced target's
   * common action, Adam 2026-10-29). Caller passes
   * !isTouch (the PausedIndicator showKeyHint
   * precedent): hint only, handlers and sizing
   * untouched. Default false = no badges.
   */
  showKeyHints?: boolean;
  /** Look for the buttons. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function ProximityHarvestButtons({
  targets,
  harvestedIds,
  onHarvest,
  onRemove,
  removeLabel = 'Remove',
  lookNode,
  stationAnchor,
  trap,
  onCollectTrap,
  hive,
  onHarvestHive,
  showKeyHints = false,
  theme = 'mire',
}: ProximityHarvestButtonsProps) {
  const t = UI_THEMES[theme];
  if (targets.length === 0 && !trap && !hive) {
    return null;
  }
  // Dirt-row suppression (Adam, 2026-10-28): the ground row
  // (Dirt/mud/grass) renders ONLY when no scatter target is in
  // range — whenever a scatter row exists, the ground row is
  // suppressed, so ground is the fallback, never a constant
  // companion (the third-person fallback rule, extended to
  // all modes at display). Filtered on KIND ('ground'), not
  // the name 'Dirt', so dirt/mud/grass alike suppress. The
  // tracker still emits ground by its own mode rules and the
  // E path still reads unfiltered App state — this filter is
  // display-only, and bare ground (no scatter) still shows
  // the ground row. Order unchanged (tracker sorts scatter
  // by distance; no re-sort), so the top row after
  // suppression is the nearest scatter.
  const visibleTargets = targets.some((target) => target.kind === 'scatter')
    ? targets.filter((target) => target.kind !== 'ground')
    : targets;
  return (
    // TOP EDGE: bottom-anchored at 52%, so top = 48vh - height.
    // Capping height at 48vh - T keeps the top edge at or below
    // T (see the file doc for the bar measurements): 112 px on
    // narrow screens, 60 px once the viewport is 480 px wide
    // (single-row bar). 40vh still caps tall viewports, and the
    // 56 px floor keeps at least one button visible; overflow
    // scrolls inside the column, never under a top control.
    // STATION-ANCHORED case: the column hangs above the point
    // (translate -100% - 8px), growing upward from it; the same
    // max-height + scroll bound it, but no top-edge guarantee
    // (the point is near the player, so mid-screen or lower
    // in practice).
    <div
      className={
        'pointer-events-auto absolute z-40 flex max-h-[min(40vh,max(56px,calc(48vh-112px)))] min-[480px]:max-h-[min(40vh,max(56px,calc(48vh-60px)))] w-max max-w-[calc(100vw-1rem)] flex-col items-center gap-2 overflow-y-auto px-1 py-1' +
        (stationAnchor ? '' : ' bottom-[52%] left-1/2 -translate-x-1/2')
      }
      style={
        stationAnchor
          ? {
              left: `${stationAnchor.x}%`,
              top: `${stationAnchor.y}%`,
              transform: 'translate(-50%, calc(-100% - 8px))',
            }
          : undefined
      }
    >
      {lookNode}
      {visibleTargets.map((target) => (
        <Fragment key={target.id}>
          {target.kind === 'scatter' && onRemove ? (
            <div className="flex flex-col items-center gap-1">
              {!harvestedIds?.has(target.id) ? (
                <HarvestButton
                  target={target}
                  onHarvest={onHarvest}
                  theme={theme}
                />
              ) : null}
              <RemoveButton
                target={target}
                onRemove={onRemove}
                removeLabel={removeLabel}
                theme={theme}
              />
            </div>
          ) : !harvestedIds?.has(target.id) ? (
            <HarvestButton
              target={target}
              onHarvest={onHarvest}
              theme={theme}
            />
          ) : null}
        </Fragment>
      ))}
      {trap && onCollectTrap ? (
        <button
          type="button"
          onClick={() => onCollectTrap(trap.id)}
          aria-label={trap.label}
          className={
            'flex min-h-[44px] items-center gap-2 rounded-full px-3 py-1.5 text-sm shadow-lg transition-transform hover:scale-105 ' +
            t.panel
          }
        >
          <span className="font-medium">{trap.label}</span>
          {showKeyHints ? (
            <span
              aria-hidden="true"
              className={KEY_BADGE_CLASS}
            >
              E
            </span>
          ) : null}
        </button>
      ) : null}
      {hive && onHarvestHive ? (
        <button
          type="button"
          onClick={() => onHarvestHive(hive.x, hive.z)}
          aria-label={hive.label}
          className={
            'flex min-h-[44px] items-center gap-2 rounded-full px-3 py-1.5 text-sm shadow-lg transition-transform hover:scale-105 ' +
            t.panel
          }
        >
          <span className="font-medium">{hive.label}</span>
          {showKeyHints ? (
            <span
              aria-hidden="true"
              className={KEY_BADGE_CLASS}
            >
              E
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
