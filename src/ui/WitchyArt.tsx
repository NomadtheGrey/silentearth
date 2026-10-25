/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — witchy artwork (UI lane, presentation only).
 *
 * Adam's direction, 2026-10-25: "decent witchy artwork, whatever that
 * means", with the prototype witch as the starting seed. This lane's
 * reading, kept light — two small SVG ornaments, no images, no weight:
 *
 * - WitchMark: a bone crescent moon carrying a candle flame, with
 *   three sparkles. The mark that sits beside crafting and dialog
 *   headings — moon + flame is the game's artwork shorthand.
 * - VineDivider: a twig stem with leaves and buds, the quiet divider
 *   under gathering-screen headings.
 *
 * Palette is the prototype's own: bone #f5efe0, flame #d4b768,
 * moss #5c823d, bark #4a2e18, coal #1f1f1f. Colours are copied here,
 * not imported from game code. Both ornaments are decorative
 * (aria-hidden); any meaning lives in the surrounding text.
 */

export interface WitchyArtProps {
  className?: string;
}

/** Crescent moon + candle flame + sparkles. */
export function WitchMark({ className }: WitchyArtProps) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      aria-hidden="true"
      className={className}
    >
      {/* Crescent moon */}
      <path
        d="M 20,3 A 11,11 0 1,0 20,25 A 9,9 0 1,1 20,3 Z"
        fill="#f5efe0"
        stroke="#1f1f1f"
        strokeWidth="1"
      />
      {/* Candle flame resting in the crescent's hollow */}
      <path
        d="M 14,17 C 11,13 12,9 14,6 C 16,9 17,13 14,17 Z"
        fill="#d4b768"
      />
      <circle cx="14" cy="12" r="1.4" fill="#f5efe0" opacity="0.8" />
      {/* Sparkles */}
      <path d="M 23,7 L 24,10 L 27,11 L 24,12 L 23,15 L 22,12 L 19,11 L 22,10 Z" fill="#d4b768" />
      <path d="M 5,5 L 5.8,7 L 8,7.8 L 5.8,8.6 L 5,10.6 L 4.2,8.6 L 2,7.8 L 4.2,7 Z" fill="#f5efe0" />
      <path d="M 24,19 L 24.6,20.6 L 26.2,21.2 L 24.6,21.8 L 24,23.4 L 23.4,21.8 L 21.8,21.2 L 23.4,20.6 Z" fill="#d4b768" />
    </svg>
  );
}

/** Twig stem with leaves and buds, for dividing headings from content. */
export function VineDivider({ className }: WitchyArtProps) {
  return (
    <svg
      width="120"
      height="14"
      viewBox="0 0 120 14"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M 4,7 L 116,7"
        stroke="#4a2e18"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Leaves */}
      <ellipse cx="30" cy="4" rx="7" ry="3" fill="#5c823d" transform="rotate(-25 30 4)" />
      <ellipse cx="60" cy="10" rx="7" ry="3" fill="#5c823d" transform="rotate(25 60 10)" />
      <ellipse cx="90" cy="4" rx="7" ry="3" fill="#5c823d" transform="rotate(-25 90 4)" />
      {/* Buds */}
      <circle cx="45" cy="7" r="2" fill="#d4b768" />
      <circle cx="75" cy="7" r="2" fill="#d4b768" />
    </svg>
  );
}
