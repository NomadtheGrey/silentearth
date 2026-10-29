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
 * Placement is viewport-centred on both axes (Adam,
 * 2026-10-28: center + bigger): while paused nothing
 * underneath is playable, so the control takes the
 * middle instead of sitting bottom-centre above the
 * LocationChip — it no longer competes with the chip,
 * the sticks, or the harvest column at all. The button
 * is bigger (min 64 px tall, text-xl) for a surer tap
 * target on phone and desktop alike. Wording unchanged
 * ("Paused — tap to resume", pinned 2026-10-26).
 *
 * CLICK ANYWHERE TO RESUME (Adam, 2026-10-29: "Tap to
 * Resume kinda works. I should be able to click
 * anyplace on screen to resume"): the VEIL is the
 * resume surface now, not just the button — the
 * full-screen wrapper takes the click itself
 * (pointer-events-auto + onClick), and the button is
 * the visual label (its click bubbles up to the
 * wrapper; there is deliberately one handler). Before
 * this, the wrapper was pointer-events-none and only
 * the button took the tap, so every other click fell
 * through to the canvas. Layering keeps modal clicks
 * the modal's: this veil is z-40 and the modals are
 * full-screen z-50 roots, so a click that lands on an
 * open modal never reaches here.
 */

import { KEY_BADGE_CLASS } from './themes';

export function PausedIndicator({
  onResume,
  showKeyHint = false,
}: {
  onResume: () => void;
  /**
   * Desktop key hint: the shell passes !isTouch, so the P badge
   * shows only on keyboard contexts and never adds noise to
   * phone touch UI. Default false — badges only when asked.
   */
  showKeyHint?: boolean;
}) {
  return (
    <div
      onClick={onResume}
      className="pointer-events-auto absolute inset-0 z-40 flex cursor-pointer items-center justify-center"
    >
      <button
        type="button"
        className="min-h-[64px] rounded-full bg-black/60 px-8 py-4 text-xl font-medium text-[#f0ead6]"
      >
        Paused — tap to resume
        {showKeyHint ? (
          <span
            aria-hidden="true"
            className={'ml-1 ' + KEY_BADGE_CLASS}
          >
            P
          </span>
        ) : null}
      </button>
    </div>
  );
}
