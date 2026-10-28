/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — placed-torch chip (UI lane,
 * presentation only).
 *
 * The small world-anchored chip for one placed torch,
 * fire-chip pattern. A placed torch is always lit, so the
 * label is just "Lit Torch" — no count, no state word.
 * Tapping it opens the torch menu (the caller's job — this
 * chip never acts itself).
 * The button keeps the 44 px touch rule and stops its touch
 * start from reaching the look field below (the campfire tap
 * fix, 8e9f4d5: stopPropagation, never preventDefault, so the
 * tap itself still lands as a click).
 */

export interface TorchChipProps {
  /** Called when the player taps the chip. Optional. */
  onSelect?: () => void;
}

export function TorchChip({ onSelect }: TorchChipProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onTouchStart={(e) => {
        e.stopPropagation();
      }}
      aria-label="Lit torch"
      className="pointer-events-auto flex min-h-[44px] items-center gap-2 rounded bg-black/50 px-2 py-1 text-sm text-stone-100"
    >
      Lit Torch
    </button>
  );
}
