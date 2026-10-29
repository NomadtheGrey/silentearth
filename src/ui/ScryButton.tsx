/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — scry button (UI lane, presentation only).
 *
 * The button that appears when the witch is close enough to still
 * water to scry in it (Adam, 2026-10-27: "We can have a scry
 * button when she approaches water. This let's the player know
 * there is magic."). One press reports through onPress; the
 * button itself scries nothing, reveals nothing, and holds no
 * state — appearance, disappearance, and what a press does are
 * the shell's doing (see App.tsx). The button IS the magic
 * signal: no tutorial popup rides with it.
 *
 * Look: the screen-fixed action-button family (the desktop pile
 * button's classes verbatim) — rounded, dark, thumb-sized
 * (min 44 px, the touch rule), label "Scry" (Adam's verb).
 * Positioning belongs to the caller: the shell seats it
 * bottom-centre above the LocationChip, the PausedIndicator's
 * seat (the two never show together). Touch + desktop share
 * this button exactly (parity); the touch stopPropagation
 * mirrors the fire-chip pattern so a tap never leaks into
 * the look field beneath.
 */

export interface ScryButtonProps {
  /** Called when the player presses the button. */
  onPress?: () => void;
  /**
   * Show the PC key badge ("F" — the button-keys map,
   * Adam 2026-10-29). Caller passes !isTouch (the
   * PausedIndicator showKeyHint precedent): hint only,
   * handler and sizing untouched. Default false.
   */
  showKeyHint?: boolean;
}

export function ScryButton({ onPress, showKeyHint = false }: ScryButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      onTouchStart={(e) => e.stopPropagation()}
      className="pointer-events-auto min-h-[44px] rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-[#f0ead6]"
    >
      Scry
      {showKeyHint ? (
        <span
          aria-hidden="true"
          className="ml-2 rounded border border-stone-500/60 bg-black/30 px-1.5 font-mono text-xs"
        >
          F
        </span>
      ) : null}
    </button>
  );
}
