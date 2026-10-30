/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — location + biome + FPS chip (UI
 * lane, presentation only).
 *
 * A small translucent pill, rendered as a top row of the
 * HUD (in-flow below the Needs row, via HudShell's
 * topReadout slot — NOT an absolutely-positioned pill:
 * the top area's heights vary, so flow, not offsets,
 * keeps it clear of the Needs row, the slim bar, and
 * the HUD column on every width). Dominant biome with
 * its percentage, player position, zone coords, and
 * framerate, plus an optional time/date/month line
 * UNDER the coords (reserved slot for the calendar
 * landing — null today, so no second line renders).
 * It carries no game logic — position, biome, FPS,
 * and the date line arrive as props, and the caller
 * decides when it shows. It is pointer-events-none, so
 * it never steals a touch or a click, and it hides
 * with any panel/modal open (the caller's rule), so
 * its old above-panels/below-modals stacking is moot.
 * The move clears the bottom ~36 px entirely (touch
 * controls already end 96 px above the bottom edge).
 */

import { UI_THEMES, type UiThemeName } from './themes';

export interface LocationChipProps {
  /** Player x, same coords the shell tracks for the readout. */
  x: number;
  /** Player z, same coords the shell tracks for the readout. */
  z: number;
  /** Dominant biome name at her position. */
  biomeName: string;
  /** Dominant biome weight as a whole percent (0–100).
   *  Null = no weight to read (underground — the chip
   *  names the place alone). */
  biomePercent: number | null;
  /** Measured framerate, or null until the first sample lands. */
  fps: number | null;
  /**
   * Zone coords (east, north) from the shell's zoneCoords
   * call. Omitted = no zone readout (the chip predates
   * zones). Numbers only — the [+10, 0] sign formatting
   * lives here, in the display, not in the helper.
   */
  zoneX?: number;
  /** Second zone axis (north-positive), paired with zoneX. */
  zoneZ?: number;
  /**
   * Time/date/month line, rendered as a second line
   * inside the same pill UNDER the coords. RESERVED
   * SLOT for the calendar landing: null/omitted today
   * (no calendar exists yet) → no second line renders
   * — no empty row, no gap, no invented values. The
   * calendar landing only fills this prop.
   */
  timeDateMonth?: string | null;
  /** Look for the pill. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function LocationChip({
  x,
  z,
  biomeName,
  biomePercent,
  fps,
  zoneX,
  zoneZ,
  timeDateMonth,
  theme = 'mire',
}: LocationChipProps) {
  const t = UI_THEMES[theme];
  // Zone format (Adam's example [+10, 0]): '+' on
  // positives on BOTH axes, plain zero/negatives.
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  // Coords print WHOLE (Adam, 2026-10-30): the printed
  // and spoken position round to whole numbers, display
  // and aria together so they agree. Display-only — the
  // shell's position state keeps full precision.
  const zoneText =
    zoneX === undefined || zoneZ === undefined
      ? null
      : `[${signed(zoneX)}, ${signed(zoneZ)}]`;
  return (
    <div
      className={
        'pointer-events-none rounded px-2 py-1 text-xs text-stone-100 ' +
        t.overlay
      }
      aria-label={`Location: ${biomeName}${biomePercent !== null ? ` ${biomePercent} percent` : ''}, position ${Math.round(x)}, ${Math.round(z)}${zoneText !== null ? `, zone ${zoneText}` : ''}${fps !== null ? `, ${fps} frames per second` : ''}${timeDateMonth ? `, ${timeDateMonth}` : ''}`}
    >
      <p className="whitespace-nowrap">
        {biomeName}
        {biomePercent !== null ? ` ${biomePercent}%` : ''} · ({Math.round(x)},{' '}
        {Math.round(z)})
        {zoneText !== null ? ` · ${zoneText}` : ''}
        {fps !== null ? ` · ${fps} FPS` : ''}
      </p>
      {timeDateMonth ? (
        <p className="whitespace-nowrap text-center">{timeDateMonth}</p>
      ) : null}
    </div>
  );
}
