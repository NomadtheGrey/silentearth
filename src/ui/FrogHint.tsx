// FrogHint — the frog tier-1 water hint (UI lane, frog-hint
// build 2026-10-28, Systems 126c9aa).
//
// Props-driven presentation only: the caller (App) derives
// Systems' nearestStillWater fact and passes its numbers;
// nothing here imports game, engine, or systems code, and
// nothing here owns state. The fact's float distance is
// the truth — rounding to whole meters is presentation
// only, here in the display.
//
// Direction is an 8-point compass from the fact's unit
// vector under the compass pin (East = +x, North = −z):
// the vector's east component is dx, its north component
// is −dz. The fact guarantees a nonzero vector on
// non-null (the zero-vector branch only wins at edge
// distance 0, which returns null), so no zero guard.
//
// Seat: bottom-centre above the LocationChip, the scry /
// pause seat family. When the scry button is also showing
// (near water + camp exists), the hint lifts above it
// (aboveScry) so the two never stack on one seat.

import { UI_THEMES, type UiThemeName } from './themes';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export interface FrogHintProps {
  /** Unit-vector east component toward the water's edge point. */
  dx: number;
  /** Unit-vector z component toward the water's edge point. */
  dz: number;
  /** Edge distance in meters (fact's float; rounded here). */
  distanceMeters: number;
  /** True while the scry button shows — lifts the hint above it. */
  aboveScry?: boolean;
  /** Look for the pill. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function FrogHint({
  dx,
  dz,
  distanceMeters,
  aboveScry = false,
  theme = 'mire',
}: FrogHintProps) {
  const t = UI_THEMES[theme];
  // Bearing clockwise from north: angle 0 = east, π/2 =
  // north (atan2 of north-component over east-component),
  // so bearing = 90° − angle, folded to [0, 360).
  const angle = Math.atan2(-dz, dx);
  const bearing = (90 - (angle * 180) / Math.PI + 360) % 360;
  const direction = COMPASS[Math.round(bearing / 45) % 8];
  const text = `Still water ${Math.round(distanceMeters)} m ${direction}`;
  return (
    <div
      className={
        'pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 ' +
        (aboveScry ? 'bottom-28' : 'bottom-12')
      }
      aria-label={text}
    >
      <p
        className={
          'whitespace-nowrap rounded px-2 py-1 text-xs text-stone-100 ' +
          t.overlay
        }
      >
        {text}
      </p>
    </div>
  );
}
