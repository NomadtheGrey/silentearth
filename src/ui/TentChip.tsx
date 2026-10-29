/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — placed-tent chip (UI lane,
 * presentation only).
 *
 * The small world-anchored chip for one placed tent,
 * torch-chip pattern. The label is just "Tent" — no
 * count, no state word (a placed tent's shelter effect
 * is not live yet — Background's tent-aware shelter
 * branch is still to land — so the chip claims no
 * shelter state). Tapping it opens the tent menu (the
 * caller's job — this chip never acts itself).
 * The button keeps the 44 px touch rule and stops its touch
 * start from reaching the look field below (the campfire tap
 * fix, 8e9f4d5: stopPropagation, never preventDefault, so the
 * tap itself still lands as a click).
 */

export interface TentChipProps {
  /** Called when the player taps the chip. Optional. */
  onSelect?: () => void;
}

export function TentChip({ onSelect }: TentChipProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onTouchStart={(e) => {
        e.stopPropagation();
      }}
      aria-label="Tent"
      className="pointer-events-auto flex min-h-[44px] items-center gap-2 rounded-full bg-black/60 px-2 py-1 text-sm text-stone-100"
    >
      Tent
    </button>
  );
}
