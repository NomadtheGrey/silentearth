/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — placement preview (UI lane, presentation only).
 *
 * The ghost that shows WHERE something will go before it is
 * placed: a translucent footprint with a dashed outline and a
 * label, positioned by the caller at screen percentages (the
 * caller owns world→screen projection, exactly like the harvest
 * buttons). Green-tinted when the caller says the spot is valid,
 * red-tinted when the caller says it is not. The caller owns
 * validity entirely — this component checks no slope, no
 * collision, no spacing, no ownership, because placement rules
 * belong to the placement system, not to the preview.
 *
 * Placement is FREE (no zones/plots, per Adam's ruling), so the
 * preview carries no plot frame and no zone check: any position
 * the caller passes is a candidate, and validity is whatever
 * the caller decides for that spot.
 *
 * SHARED BY FIRE AND SHELTER: the same preview serves a
 * campfire/hearth/kiln being placed and a house being
 * placed — the label names the thing, the shape stays the same.
 * It is pointer-transparent (it must never swallow the click
 * that confirms or cancels placement).
 *
 * MOUNTING — READ THIS: at the time this file was written, no
 * placement flow exists in the repo (fire and house items are
 * craftable inventory items, not placed world objects), so this
 * preview is currently UNMOUNTED in App. It is staged,
 * verified, and ready for the placement flow to drive it.
 */

import { WorldAnchor } from './WorldAnchor';

export interface PlacementPreviewProps {
  /** Screen x of the preview, in percent (0–100), caller-projected. */
  x: number;
  /** Screen y of the preview, in percent (0–100), caller-projected. */
  y: number;
  /** What is being placed, in the caller's words. */
  label: string;
  /** Whether the caller considers this spot valid. */
  valid: boolean;
}

export function PlacementPreview({
  x,
  y,
  label,
  valid,
}: PlacementPreviewProps) {
  return (
    <WorldAnchor x={x} y={y}>
      <div
        aria-label={`Placing ${label}${valid ? '' : ' (invalid spot)'}`}
        className={
          'rounded border-2 border-dashed px-3 py-2 text-sm ' +
          (valid
            ? 'border-[#5c823d] bg-[#5c823d]/20 text-stone-100'
            : 'border-[#a82424] bg-[#a82424]/20 text-stone-100')
        }
      >
        {label}
        {valid ? null : (
          <span className="italic text-stone-300"> — cannot place here</span>
        )}
      </div>
    </WorldAnchor>
  );
}
