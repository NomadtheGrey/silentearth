/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — paused indicator (UI lane, presentation only).
 *
 * A small "Paused" badge, rendered by the shell while the engine
 * pause flag is set (core 54e525c: the renderer loop gates on
 * pauseState, and the shell gates its timers on the same
 * 'game:pause-changed' event). Badge only — no resume control
 * here: triggers (visibility/blur listeners, auto vs tap resume)
 * plug into setPaused only after Adam answers, and the indicator
 * gains its resume affordance with that half, not this one.
 *
 * Placement is bottom-centre above the LocationChip (bottom-12):
 * it clears the touch sticks (all start 96 px from the bottom),
 * the chip itself (ends ~36 px up), the middle-anchored harvest
 * column, and the top bars entirely — and it is
 * pointer-events-none, so it never eats a tap even when it
 * floats over a panel sheet or a look-field drag.
 */

export function PausedIndicator() {
  return (
    <div className="pointer-events-none absolute bottom-12 left-1/2 z-40 -translate-x-1/2">
      <span
        role="status"
        className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-[#f0ead6]"
      >
        Paused
      </span>
    </div>
  );
}
