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
 */

import type { ReactNode } from 'react';
import type { NeedSlot } from './types';
import { UI_THEMES, type UiThemeName } from './themes';

export interface HudShellProps {
  /** Slots a real survival system provides. Empty = awaiting systems. */
  needSlots?: NeedSlot[];
  /** Caller-composed content inside the shell (panels, toggles, etc.). */
  children?: ReactNode;
  /** Look for the overlay pill. Default "mire" (the world outside). */
  theme?: UiThemeName;
  className?: string;
}

export function HudShell({
  needSlots = [],
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
      <div className="pointer-events-auto flex-1">{children}</div>
    </div>
  );
}
