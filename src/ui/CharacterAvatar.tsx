/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — the witch, as a popup face (UI lane).
 *
 * Faithful to the iso-prototype CharacterAvatar (tag iso-prototype,
 * src/components/CharacterAvatar.tsx), redrawn as a standalone SVG so it
 * needs no grid position, no iso math, and no game code:
 * - bell-shaped coal dress with pleat lines
 * - bone face with two small ink eyes
 * - primitive candle at her side, flame flickering (the prototype's
 *   SMIL glow pulse, 1.2s)
 *
 * Colours are copied from the prototype's THEME, not imported:
 * coal #1f1f1f, ink #0a0a0a, bone #f5efe0, flame #d4b768.
 *
 * Expressions are a LATER landing — this renders one neutral face only.
 * Props are presentational: size and an optional accessible label.
 */

export interface CharacterAvatarProps {
  /** Rendered size in CSS pixels (width and height). Default 80. */
  size?: number;
  /** Accessible label for the SVG. Default "The witch". */
  label?: string;
  className?: string;
}

export function CharacterAvatar({
  size = 80,
  label = 'The witch',
  className,
}: CharacterAvatarProps) {
  return (
    <svg
      width={size}
      height={size * 2}
      viewBox="0 0 20 40"
      role="img"
      aria-label={label}
      className={className}
    >
      {/* Soft shadow */}
      <ellipse cx="10" cy="38" rx="8" ry="2.5" fill="rgba(0,0,0,0.4)" />

      {/* Bell-shaped dress */}
      <path
        d="M 10,6 L 1,36 L 19,36 Z"
        fill="#1f1f1f"
        stroke="#0a0a0a"
        strokeWidth="1.5"
      />
      {/* Pleats / folds */}
      <path
        d="M 10,12 L 5,36 M 10,12 L 15,36 M 10,12 L 10,36"
        stroke="#0a0a0a"
        strokeWidth="0.5"
        opacity="0.4"
        fill="none"
      />

      {/* Bone face */}
      <g transform="translate(10, 8)">
        <path
          d="M -3.5,0 C -3.5,-5 3.5,-5 3.5,0 C 3.5,5 -3.5,5 -3.5,0"
          fill="#f5efe0"
          stroke="#0a0a0a"
          strokeWidth="1"
        />
        <path
          d="M -1.5,-1 L -1,-1 M 1.5,-1 L 1,-1"
          stroke="#0a0a0a"
          strokeWidth="1"
          fill="none"
        />
      </g>

      {/* Primitive candle */}
      <g transform="translate(17, 22)">
        <rect
          x="-0.8"
          y="-4"
          width="1.6"
          height="5"
          fill="#f5efe0"
          stroke="#0a0a0a"
          strokeWidth="0.5"
        />
        <circle cx="0" cy="-6" r="3" fill="#6a1a1a" opacity="0.4">
          <animate
            attributeName="r"
            values="2;4;2"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="0" cy="-6" r="1.2" fill="#d4b768" />
      </g>
    </svg>
  );
}
