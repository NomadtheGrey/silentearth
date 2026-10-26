/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — witch motion study (UI lane, presentation only).
 *
 * The third-person motion read, made visible on its own: the prototype
 * witch (CharacterAvatar) animated the way she should read when she
 * walks — gentle bob, side sway, dress flaring with speed — and
 * breathing quietly when she stands. Use it as a motion review piece
 * (a popup, a settings preview, a design check) and as the reference
 * for the renderer wiring step: the bob, sway, and flare values here
 * come from MOTION_PRESENTATION in motionPresentation.ts.
 *
 * Props only: `moving` and `speedNorm` (0–1, 0 = idle, 1 = full walk
 * at 5 m/s) are caller-supplied. `leanDeg` is a caller-supplied
 * presentation lean for a turn in progress; it is not the engine's
 * facing, which currently snaps and is proposed to ease instead.
 * No movement, no input, no engine code.
 */

import { CharacterAvatar } from './CharacterAvatar';
import { MOTION_PRESENTATION } from './motionPresentation';

export interface WitchMotionProps {
  /** Whether the witch is moving. Default false (idle). */
  moving?: boolean;
  /** Speed normalised 0–1. Default 1 when moving, 0 when idle. */
  speedNorm?: number;
  /** Presentation lean in degrees for a turn. Default 0. */
  leanDeg?: number;
  /** Avatar width in CSS pixels. Default 80. */
  size?: number;
  className?: string;
}

export function WitchMotion({
  moving = false,
  speedNorm,
  leanDeg = 0,
  size = 80,
  className,
}: WitchMotionProps) {
  const speed = speedNorm ?? (moving ? 1 : 0);
  const clampedSpeed = Math.min(1, Math.max(0, speed));
  const motion = moving ? MOTION_PRESENTATION.walk : MOTION_PRESENTATION.idle;
  const bobPx = motion.bobPx * clampedSpeed;
  const swayDeg = motion.swayDeg * (moving ? clampedSpeed : 1);
  const flare = 1 + (motion.flareScale - 1) * clampedSpeed;
  const bobCycleMs = moving
    ? Math.round(
        MOTION_PRESENTATION.walk.bobCycleMs / Math.max(clampedSpeed, 0.25),
      )
    : 0;

  return (
    <div className={'inline-block ' + (className ?? '')}>
      <style>{`
        @keyframes se-witch-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-var(--se-bob, 3px)); }
        }
        @keyframes se-witch-sway {
          0%, 100% { transform: rotate(calc(-1 * var(--se-sway, 3deg))); }
          50% { transform: rotate(var(--se-sway, 3deg)); }
        }
      `}</style>
      <div
        style={{
          transform: `rotate(${leanDeg}deg) scaleX(${flare})`,
          transformOrigin: '50% 100%',
        }}
      >
        <div
          style={
            moving
              ? {
                  animation: `se-witch-bob ${bobCycleMs}ms ease-in-out infinite`,
                  ['--se-bob' as string]: `${bobPx}px`,
                }
              : undefined
          }
        >
          <div
            style={{
              animation: `se-witch-sway ${moving ? 1200 : 3000}ms ease-in-out infinite`,
              ['--se-sway' as string]: `${swayDeg}deg`,
            }}
          >
            <CharacterAvatar size={size} />
          </div>
        </div>
      </div>
    </div>
  );
}
