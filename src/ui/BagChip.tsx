/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — placed sleeping-bag chip
 * (UI lane, presentation only).
 *
 * The small world-anchored chip for one placed
 * sleeping bag, tent-chip pattern. The label is just
 * "Sleeping Bag" — the bag is a sleep site, and the
 * chip claims nothing more (its warmth is the sleep
 * itself, not a standing shelter signal). Tapping it
 * opens the bag menu (the caller's job — this chip
 * never acts itself). The button keeps the 44 px
 * touch rule and stops its touch start from reaching
 * the look field below (the campfire tap fix: stopPropagation,
 * never preventDefault, so the tap itself still lands).
 */

export interface BagChipProps {
  /** Called when the player taps the chip. Optional. */
  onSelect?: () => void;
}

export function BagChip({ onSelect }: BagChipProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onTouchStart={(e) => {
        e.stopPropagation();
      }}
      aria-label="Sleeping Bag"
      className="pointer-events-auto flex min-h-[44px] items-center gap-2 rounded-full bg-black/60 px-2 py-1 text-sm text-stone-100"
    >
      Sleeping Bag
    </button>
  );
}
