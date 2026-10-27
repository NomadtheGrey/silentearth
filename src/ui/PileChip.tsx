/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — pile chip (UI lane, presentation only).
 *
 * The small world-anchored chip for one in-range dropped pile,
 * fire-chip pattern. A single-kind pile reads item name +
 * ×count; a multi-kind pile reads "Pile × total (N kinds)"
 * (the caller supplies name "Pile", the summed total, and
 * the kind count — the chip never invents a kind list).
 * Tapping it opens the pile menu (the caller's job — this
 * chip never acts itself).
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
  /** How many kinds the pile holds; above 1 the label reads multi-kind. */
  kinds?: number;
  /** Called when the player taps the chip. Optional. */
  onSelect?: () => void;
}

export function PileChip({ name, quantity, kinds, onSelect }: PileChipProps) {
  const label =
    kinds !== undefined && kinds > 1
      ? `${name} × ${quantity} (${kinds} kinds)`
      : `${name} × ${quantity}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      onTouchStart={(e) => {
        e.stopPropagation();
      }}
      aria-label={`Pile: ${label}`}
      className="pointer-events-auto flex min-h-[44px] items-center gap-2 rounded bg-black/50 px-2 py-1 text-sm text-stone-100"
    >
      {label}
    </button>
  );
}
