/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — location + biome + FPS chip (UI
 * lane, presentation only).
 *
 * A small translucent pill, always bottom-centre: dominant
 * biome with its percentage, player position, and framerate.
 * It carries no game logic — position, biome, and FPS arrive
 * as props, and the caller decides when it shows. It is
 * pointer-events-none, so it never steals a touch or a click
 * from the world, the look field, or a panel beneath it, and
 * it sits above the panels (z-40) but below modals (z-50).
 * Placement keeps it clear of the touch controls by
 * construction: the stick and USE buttons end 96 px above
 * the bottom edge, and this chip lives in the bottom ~36 px.
 */

import { UI_THEMES, type UiThemeName } from './themes';

export interface LocationChipProps {
  /** Player x, same coords the shell tracks for the readout. */
  x: number;
  /** Player z, same coords the shell tracks for the readout. */
  z: number;
  /** Dominant biome name at her position. */
  biomeName: string;
  /** Dominant biome weight as a whole percent (0–100). */
  biomePercent: number;
  /** Measured framerate, or null until the first sample lands. */
  fps: number | null;
  /** Look for the pill. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function LocationChip({
  x,
  z,
  biomeName,
  biomePercent,
  fps,
  theme = 'mire',
}: LocationChipProps) {
  const t = UI_THEMES[theme];
  return (
    <div
      className="pointer-events-none absolute bottom-2 left-1/2 z-40 -translate-x-1/2"
      aria-label={`Location: ${biomeName} ${biomePercent} percent, position ${x.toFixed(1)}, ${z.toFixed(1)}${fps !== null ? `, ${fps} frames per second` : ''}`}
    >
      <p
        className={
          'whitespace-nowrap rounded px-2 py-1 text-xs text-stone-100 ' +
          t.overlay
        }
      >
        {biomeName} {biomePercent}% · ({x.toFixed(1)}, {z.toFixed(1)})
        {fps !== null ? ` · ${fps} FPS` : ''}
      </p>
    </div>
  );
}
