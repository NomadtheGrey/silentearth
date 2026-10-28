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
 * the sticks, or the harvest column at all. The wrapper
 * is pointer-events-none for positioning, but the button
 * itself is pointer-events-auto — otherwise it could
 * never receive the tap it exists for. The button is
 * bigger (min 64 px tall, text-xl) for a surer tap
 * target on phone and desktop alike. Wording unchanged
 * ("Paused — tap to resume", pinned 2026-10-26).
 */

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
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <button
        type="button"
        onClick={onResume}
        className="pointer-events-auto min-h-[64px] rounded-full bg-black/60 px-8 py-4 text-xl font-medium text-[#f0ead6]"
      >
        Paused — tap to resume
        {showKeyHint ? (
          <span
            aria-hidden="true"
            className="ml-2 rounded border border-stone-500/60 bg-black/30 px-1.5 font-mono text-xs"
          >
            P
          </span>
        ) : null}
      </button>
    </div>
  );
}
