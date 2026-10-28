/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — storm warning (UI lane, presentation only).
 *
 * The deer charm's weather sense, as one line in the HUD stack
 * beside HungerIndicator. It mirrors the shrew warning line's
 * pattern exactly: steady while the latch is active, pulsing
 * (animate-pulse) on the fired edge, with the shell owning
 * the flash timing — this element holds no timers and
 * computes nothing itself. It renders nothing unless active.
 *
 * The line names the rising-front signal and promises no
 * timing: 'A storm approaches.' is the fact (Background's
 * stormApproaching), not a countdown — the minutes behind
 * the signal are Background's definition, not a promise
 * this line makes.
 */

/** Storm warning props, caller-supplied from Systems' latch. */
export interface StormWarningProps {
  /** Latch steady state: render the line only while true. */
  active: boolean;
  /** Latch entry edge: pulse while true (shell's flash window). */
  flash: boolean;
}

/**
 * One storm-warning line, text-only and pointer-events-none
 * (it never blocks play input). Null unless active.
 */
export function StormWarning({ active, flash }: StormWarningProps) {
  if (!active) return null;
  return (
    <div className="pointer-events-none">
      <span
        className={
          'text-xs text-amber-200 ' + (flash ? 'animate-pulse' : '')
        }
      >
        A storm approaches.
      </span>
    </div>
  );
}
