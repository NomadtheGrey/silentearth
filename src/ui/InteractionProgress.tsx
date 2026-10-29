/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — in-place interaction progress (UI lane).
 *
 * A small progress bar for an interaction happening at an object —
 * render it inside a WorldAnchor, under the prompt or menu, so the
 * player watches the thing they are doing, where they are doing it.
 *
 * Presentation only: `fraction` (0–1) is caller-supplied and is only
 * clamped for display so the bar cannot overflow its track. Nothing
 * here advances, times, or completes an interaction.
 */

import type { UiThemeName } from './themes';

export interface InteractionProgressProps {
  /** Progress fraction, 0–1, caller-supplied. */
  fraction: number;
  /** Label for the bar, in the caller's words. Optional. */
  label?: string;
  /** Look for the bar fill. Default "hearth" (amber). */
  theme?: UiThemeName;
  className?: string;
}

const FILL_CLASSES: Record<UiThemeName, string> = {
  mire: 'bg-lime-600',
  hearth: 'bg-amber-600',
  parchment: 'bg-stone-600',
  ember: 'bg-amber-600',
};

export function InteractionProgress({
  fraction,
  label,
  theme = 'hearth',
  className,
}: InteractionProgressProps) {
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <div className={'w-40 ' + (className ?? '')}>
      {label ? (
        <p className="mb-1 text-center text-xs text-stone-300">{label}</p>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        className="h-2 overflow-hidden rounded bg-stone-700"
      >
        <div
          className={'h-full rounded ' + FILL_CLASSES[theme]}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
    </div>
  );
}
