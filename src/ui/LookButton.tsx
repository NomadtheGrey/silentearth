/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — look button (UI lane, presentation only).
 *
 * The button that looks closely at a thing (Adam, 2026-10-27:
 * the LOOK action — look at a thing, learn a portion of its
 * true name). One press reports through onPress; the button
 * itself looks at nothing, records nothing, and holds no
 * state — appearance, disappearance, target choice, and what
 * a press reveals are the shell's doing (see App.tsx). No
 * tutorial popup rides with it.
 *
 * Look: the screen-fixed action-button family (the desktop pile
 * button's classes verbatim) — rounded, dark, thumb-sized
 * (min 44 px, the touch rule), label "Look" (Adam's verb).
 * Positioning belongs to the caller: the shell seats it first
 * in the harvest column, above the nearest target's button.
 * Touch + desktop share this button exactly (parity); the
 * touch stopPropagation mirrors the fire-chip pattern so a
 * tap never leaks into the look field beneath.
 */

export interface LookButtonProps {
  /** Called when the player presses the button. */
  onPress?: () => void;
}

export function LookButton({ onPress }: LookButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      onTouchStart={(e) => e.stopPropagation()}
      className="pointer-events-auto min-h-[44px] rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-[#f0ead6]"
    >
      Look
    </button>
  );
}
