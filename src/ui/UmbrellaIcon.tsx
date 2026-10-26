/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — umbrella icon (UI lane, presentation only).
 *
 * The umbrella's glyph, in the directory's existing inline-SVG
 * pattern (flat fills, 16 px, aria-hidden, like the heart in
 * WitchHealth and the flame in FireState): a scalloped moss
 * canopy over a short pole with a hooked handle. It is a
 * picture only — it carries no item data, no protection
 * number, and no mechanic. The caller decides where it
 * appears (inventory rows and crafting rows, via the panels'
 * caller-supplied icon slots); this file only draws it.
 *
 * COORDINATION (Systems, 026b793): the umbrella is item id
 * ITEMS.umbrella ('umbrella'), recipe id 'umbrella', and its
 * rain mechanic lives in systems/umbrella.ts (35% rain
 * protection, a starting value for Adam's pin pass, applied
 * when carried — no equip step). App keys this icon off that
 * id; this file only draws it. The rain-protection NOTE (see
 * WornList's umbrellaNote) carries the number from Systems'
 * single constant — this glyph itself never implies one.
 */

export function UmbrellaIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M 1,9 Q 1,3 8,3 Q 15,3 15,9 Q 13.5,7 12,9 Q 10.5,7 9,9 Q 8,7.5 7,9 Q 5.5,7 4,9 Q 2.5,7 1,9 Z"
        fill="#5c823d"
      />
      <path
        d="M 8,9 L 8,13 Q 8,15 6,15"
        fill="none"
        stroke="#78716c"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
