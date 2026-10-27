/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — pile chip (UI lane, presentation only).
 *
 * The small world-anchored chip for one in-range dropped pile:
 * item name + ×count, fire-chip pattern. Tapping it opens the
 * pile menu (the caller's job — this chip never acts itself).
 * The button keeps the 44 px touch rule and stops its touch
 * start from reaching the look field below (the campfire tap
 * fix, 8e9f4d5: stopPropagation, never preventDefault, so the
 * tap itself still lands as a click).
 */

export interface PileChipProps {
  /** Display name of the piled item, caller-supplied. */
  name: string;
  /** How many of the item the pile holds. */
  quantity: number;
  /** Called when the player taps the chip. Optional. */
  onSelect?: () => void;
}

export function PileChip({ name, quantity, onSelect }: PileChipProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onTouchStart={(e) => {
        e.stopPropagation();
      }}
      aria-label={`Pile: ${name} × ${quantity}`}
      className="pointer-events-auto flex min-h-[44px] items-center gap-2 rounded bg-black/50 px-2 py-1 text-sm text-stone-100"
    >
      {name} × {quantity}
    </button>
  );
}
