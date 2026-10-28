/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — placed-altar chip (UI lane, presentation only).
 *
 * The world-anchored chip for a ritual site (Adam,
 * 2026-10-27: placeable + visible). At landing this chip
 * was LABEL-ONLY (no menu — rituals were not in that
 * order); the tier-1 Waking build makes it the ritual
 * panel's anchor: tapping it opens the site's staging
 * panel (RitualPanel), torch-chip pattern. Still no
 * Pick-up action — moving/removing a placed altar or
 * bone is Adam's word later, not here.
 *
 * The bone build (2026-10-28) generalizes the chip to
 * STUMP sites too: same button, label 'Stump' — one
 * chip family for both ritual site kinds, the label
 * naming the site. The panel it opens is identical
 * (siteLabel prop); only the site id differs.
 *
 * Look: the world-chip family (the torch chip's classes) —
 * dark pill, readable text. Touch + desktop share this
 * chip exactly (parity).
 */

export interface AltarChipProps {
  /** Called when the player taps the chip. Optional. */
  onSelect?: () => void;
  /** Site label. Defaults to 'Altar' (the original use). */
  label?: string;
}

export function AltarChip({ onSelect, label = 'Altar' }: AltarChipProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onTouchStart={(e) => {
        e.stopPropagation();
      }}
      aria-label={label}
      className="pointer-events-auto flex min-h-[44px] items-center gap-2 rounded bg-black/50 px-2 py-1 text-sm text-stone-100"
    >
      {label}
    </button>
  );
}
