/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — HUD shell (UI lane, presentation only).
 *
 * Renders the frame the game view sits in: a needs row across the top
 * and a content area for whatever the caller composes inside it
 * (camera toggle, panels, popups). It owns no state and computes
 * nothing — needs arrive as props, or not at all.
 *
 * PLACEHOLDER RULE: survival systems do not exist yet. No meter Adam
 * has not ruled is rendered. With no `needSlots`, the needs row says
 * plainly that it awaits the survival systems, instead of showing
 * invented health / warmth / dryness bars.
 *
 * POINTER RULE (wiring fix, 2026-10-26): the content area below
 * the needs row is pointer-events-none, not auto. An auto content
 * area would swallow clicks across the whole screen — including
 * the click that captures the mouse in first-person. Interactive
 * children (panels, buttons) re-enable pointer events on their own
 * containers; the shell itself never blocks the world.
 */

import type { ReactNode } from 'react';
import type { NeedSlot } from './types';
import { UI_THEMES, type UiThemeName } from './themes';

export interface HudShellProps {
  /** Slots a real survival system provides. Empty = awaiting systems. */
  needSlots?: NeedSlot[];
  /** Hide the needs row (touch HUD-collapsed state). Default false. */
  hideNeeds?: boolean;
  /**
   * Top readout row (Adam, 2026-10-28 — the LocationChip
   * moved up top): rendered between the Needs row and
   * the children, ALWAYS — never gated by hideNeeds or
   * collapse (the readout shows with the HUD collapsed,
   * as it did at the bottom). Null = no row, no offset
   * (the caller's hide rule lives in the prop value).
   */
  topReadout?: ReactNode;
  /** Caller-composed content inside the shell (panels, toggles, etc.). */
  children?: ReactNode;
  /** Look for the overlay pill. Default "mire" (the world outside). */
  theme?: UiThemeName;
  className?: string;
}

export function HudShell({
  needSlots = [],
  hideNeeds = false,
  topReadout,
  children,
  theme = 'mire',
  className,
}: HudShellProps) {
  return (
    <div
      className={
        'pointer-events-none absolute inset-0 flex flex-col ' + (className ?? '')
      }
    >
      {hideNeeds ? null : (
      <div className="pointer-events-auto flex items-start justify-between gap-2 p-2">
        <div
          aria-label="Needs"
          className={
            'flex flex-wrap items-center gap-2 rounded px-3 py-2 text-sm text-stone-200 ' +
            UI_THEMES[theme].overlay
          }
        >
          {needSlots.length === 0 ? (
            <span className="italic text-stone-400">
              Needs — awaiting survival systems
            </span>
          ) : (
            needSlots.map((slot) => (
              <span key={slot.id} className="flex items-baseline gap-1">
                <span>{slot.label}</span>
                {slot.detail ? (
                  <span className="text-stone-400">{slot.detail}</span>
                ) : null}
              </span>
            ))
          )}
        </div>
      </div>
      )}
      {/* TOP READOUT ROW (Adam, 2026-10-28): the
          LocationChip lives here now, in flow below the
          Needs row and above the children — flow, not a
          fixed offset, so wrapping Needs / HUD rows
          shift it instead of overlapping it. The row
          needs no z: the readout hides with panels /
          modals open (the caller's rule), so its old
          above-panels/below-modals stacking is moot,
          and it paints in shell flow above the canvas.
          COLLAPSED MARGIN: hideNeeds is true exactly
          when touch is HUD-collapsed, the one state
          with the absolute slim bar across the top
          (left-2 right-2 top-2) — the 112px margin
          clears its wrapped two-row height (104px +
          8px clearance; single-row 52px covered). */}
      {topReadout ? (
        <div
          className={
            'pointer-events-none flex justify-center' +
            (hideNeeds ? ' mt-[112px]' : '')
          }
        >
          {topReadout}
        </div>
      ) : null}
      <div className="pointer-events-none flex-1">{children}</div>
    </div>
  );
}
