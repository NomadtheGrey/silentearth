/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — crow pile arrows (UI lane, presentation only).
 *
 * The rows the crow tiers 2/3 show: one row per visible pile,
 * each a rotated arrow glyph pointing toward that pile, with
 * tier-3 rows adding range + compass text (the frog-hint
 * pattern). Tier-2 rows show direction only (glyph, no text);
 * tier 0/1 show no rows at all (glow only). The caller owns
 * visibility (Background's crowPileArrow per pile), the tier,
 * and the glyph rotation; this layer renders rows and formats
 * the compass label. No game imports, no tier logic, no state
 * of its own. The list scrolls with nothing — piles are few,
 * and the seat is the frog-hint seat (bottom-centre, lifted
 * above lower seats when asked).
 */

import { UI_THEMES, type UiThemeName } from './themes';

/** Compass points, frog pin (bearing 0 = N, clockwise). */
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** One pile arrow, as the caller maps it from crowPileArrow. */
export interface CrowArrow {
  /** Stable pile id (pile-state id). */
  id: string;
  /** Unit-vector east component toward the pile. */
  dx: number;
  /** Unit-vector z component toward the pile. */
  dz: number;
  /** Flat XZ distance in metres (fact's float; rounded here). */
  distanceM: number;
  /** Glyph rotation in degrees, caller-computed (mode-aware). */
  rotationDeg: number;
  /** True at tier 3: show range + compass text beside the glyph. */
  showRange: boolean;
}

export interface CrowArrowsProps {
  /** Visible pile arrows, caller-gated per pile. Empty = nothing. */
  arrows: CrowArrow[];
  /** True while a lower seat shows (frog hint or scry button) — lifts the list above it. */
  lifted?: boolean;
  /** Look for the rows. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function CrowArrows({
  arrows,
  lifted = false,
  theme = 'mire',
}: CrowArrowsProps) {
  const t = UI_THEMES[theme];
  if (arrows.length === 0) {
    return null;
  }
  return (
    <div
      className={
        'pointer-events-none absolute left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-1 ' +
        (lifted ? 'bottom-28' : 'bottom-12')
      }
    >
      {arrows.map((arrow) => {
        // Compass label, frog pattern (East = +x, North = −z):
        // bearing clockwise from north, angle 0 = east.
        const angle = Math.atan2(-arrow.dz, arrow.dx);
        const bearing = (90 - (angle * 180) / Math.PI + 360) % 360;
        const direction = COMPASS[Math.round(bearing / 45) % 8];
        const text = arrow.showRange
          ? `Pile ${Math.round(arrow.distanceM)} m ${direction}`
          : `Pile ${direction}`;
        return (
          <p
            key={arrow.id}
            className={
              'whitespace-nowrap rounded px-2 py-1 text-xs text-stone-100 ' +
              t.overlay
            }
            aria-label={text}
          >
            <span
              style={{
                display: 'inline-block',
                transform: `rotate(${arrow.rotationDeg}deg)`,
              }}
            >
              ▲
            </span>
            {arrow.showRange
              ? ` ${Math.round(arrow.distanceM)} m ${direction}`
              : null}
          </p>
        );
      })}
    </div>
  );
}
