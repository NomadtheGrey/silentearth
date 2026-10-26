/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — paused indicator (UI lane, presentation only).
 *
 * The "Paused" control, rendered by the shell while the engine
 * pause flag is set (core 54e525c: the renderer loop gates on
 * pauseState, and the shell gates its timers on the same
 * 'game:pause-changed' event). It is a BUTTON, not a badge:
 * resume is TAP-TO-RESUME (Adam, 2026-10-26, pinned) — tapping
 * it calls the caller's onResume, and there is no auto-resume
 * anywhere. The label says so outright ("Paused — tap to
 * resume"), so the control is visible before first use.
 *
 * Placement is bottom-centre above the LocationChip (bottom-12):
 * it clears the touch sticks (all start 96 px from the bottom),
 * the chip itself (ends ~36 px up), the middle-anchored harvest
 * column, and the top bars entirely. The wrapper is
 * pointer-events-none for positioning, but the button itself is
 * pointer-events-auto — otherwise it could never receive the
 * tap it exists for.
 */

export function PausedIndicator({ onResume }: { onResume: () => void }) {
  return (
    <div className="pointer-events-none absolute bottom-12 left-1/2 z-40 -translate-x-1/2">
      <button
        type="button"
        onClick={onResume}
        className="pointer-events-auto min-h-[44px] rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-[#f0ead6]"
      >
        Paused — tap to resume
      </button>
    </div>
  );
}
