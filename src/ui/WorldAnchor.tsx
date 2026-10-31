/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — world anchor (UI lane, presentation only).
 *
 * The piece that makes UI world-anchored: it places its children at a
 * screen point above a world object (a bush, a stump, whatever the
 * caller is pointing at) and nowhere else. No fullscreen, no panel
 * chrome — the UI sits on the object it belongs to.
 *
 * The caller owns everything this component does NOT do: projecting
 * the object's 3D position to screen coordinates, deciding when the
 * anchor is visible, and what lives inside it (a prompt, a small
 * menu, feedback). `x` and `y` are screen percentages (0–100) as
 * supplied by the caller. This component only positions.
 */

import type { ReactNode } from 'react';

export interface WorldAnchorProps {
  /** Screen x of the object, in percent (0–100), caller-supplied. */
  x: number;
  /** Screen y of the object, in percent (0–100), caller-supplied. */
  y: number;
  /** Content anchored to the object. */
  children?: ReactNode;
  /** Whether the anchor renders. Default true. */
  visible?: boolean;
  /**
   * Whether the anchored content takes pointer input (e.g. a menu
   * the player clicks). Default false, so prompts never block the
   * world behind them.
   */
  interactive?: boolean;
  /**
   * Extra downward offset in px, added to the seat's lift
   * (the window normally floats 8 px above its anchor).
   * For windows whose top crowds the screen edge (Adam,
   * 2026-10-31: the site window sits high — 'lower that
   * window a smidge'). Default 0 = the standard seat.
   */
  dropPx?: number;
  className?: string;
}

export function WorldAnchor({
  x,
  y,
  children,
  visible = true,
  interactive = false,
  dropPx = 0,
  className,
}: WorldAnchorProps) {
  if (!visible) {
    return null;
  }
  return (
    <div
      aria-hidden={!interactive}
      className={
        'pointer-events-none absolute z-40 flex flex-col items-center ' +
        (className ?? '')
      }
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, calc(-100% - 8px + ${dropPx}px))`,
      }}
    >
      <div className={interactive ? 'pointer-events-auto' : 'pointer-events-none'}>
        {children}
      </div>
    </div>
  );
}
