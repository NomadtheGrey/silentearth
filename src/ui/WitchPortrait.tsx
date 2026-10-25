/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — witch portrait (UI lane, presentation only).
 *
 * The popup face, dressed up: the prototype witch (CharacterAvatar)
 * standing in a moonlit arch — a tall rounded frame with a soft
 * candle-amber glow at the bottom and a small bone crescent above
 * her. The arch echoes her bell-shaped dress, so the frame and the
 * figure belong to each other.
 *
 * Pure div + SVG, no images. Expressions are still a later landing;
 * this shows the neutral face only, larger and framed.
 */

import { CharacterAvatar } from './CharacterAvatar';

export interface WitchPortraitProps {
  /** Frame width in CSS pixels. Default 96. */
  size?: number;
  /** Accessible label. Default "The witch". */
  label?: string;
  className?: string;
}

export function WitchPortrait({
  size = 96,
  label = 'The witch',
  className,
}: WitchPortraitProps) {
  const avatarWidth = Math.round(size * 0.62);
  return (
    <div
      role="img"
      aria-label={label}
      className={'relative shrink-0 overflow-hidden ' + (className ?? '')}
      style={{
        width: size,
        height: Math.round(size * 1.55),
        borderRadius: `${Math.round(size / 2)}px ${Math.round(size / 2)}px 12px 12px`,
        background:
          'radial-gradient(ellipse at 50% 85%, rgba(212,183,104,0.35) 0%, rgba(31,31,31,0.9) 60%, #1f1f1f 100%)',
        border: '1px solid rgba(245,239,224,0.25)',
      }}
    >
      {/* Small crescent above her */}
      <svg
        width={Math.round(size * 0.28)}
        height={Math.round(size * 0.28)}
        viewBox="0 0 28 28"
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: Math.round(size * 0.08),
          right: Math.round(size * 0.1),
        }}
      >
        <path
          d="M 20,3 A 11,11 0 1,0 20,25 A 9,9 0 1,1 20,3 Z"
          fill="#f5efe0"
          opacity="0.85"
        />
      </svg>
      {/* The witch, standing at the foot of the arch */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          lineHeight: 0,
        }}
      >
        <CharacterAvatar size={avatarWidth} label={label} />
      </div>
    </div>
  );
}
