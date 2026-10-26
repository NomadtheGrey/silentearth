/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — proximity harvest button (UI lane, presentation only).
 *
 * The button that appears when the witch is close enough to something
 * harvestable. It shows the action and the source, and nothing else:
 * one press reports a HarvestRequest through onHarvest. It does not
 * harvest anything itself, does not touch inventory, and does not
 * import the event bus — the wiring step connects onHarvest to
 * bus.emit('harvest:requested', request) once that event is
 * registered (see proximityHarvest.ts for the pending status).
 *
 * The glyph differs by kind, lightly: a leaf for an object, soil
 * specks for the ground. Ground buttons look and behave exactly
 * like object buttons — nearly-anyplace harvesting means the ground
 * underfoot is not a second-class target.
 */

import type { HarvestTarget, HarvestRequest } from './proximityHarvest';
import { harvestRequestFor } from './proximityHarvest';
import { UI_THEMES, type UiThemeName } from './themes';

export interface HarvestButtonProps {
  /** The in-range target this button harvests. */
  target: HarvestTarget;
  /** Called with the HarvestRequest when the player presses the button. */
  onHarvest?: (request: HarvestRequest) => void;
  /** Whether the button is currently unavailable, caller-decided. */
  disabled?: boolean;
  /** Why the button is unavailable, in the caller's words. Optional. */
  disabledNote?: string;
  /** Look for the button. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

function KindGlyph({ kind }: { kind: HarvestTarget['kind'] }) {
  if (kind === 'ground') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="3" cy="10" r="1.6" fill="#a8a29e" />
        <circle cx="7" cy="12" r="1.6" fill="#a8a29e" />
        <circle cx="11" cy="10" r="1.6" fill="#a8a29e" />
        <circle cx="5" cy="6" r="1.4" fill="#78716c" />
        <circle cx="9" cy="6" r="1.4" fill="#78716c" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M 7,13 C 2,10 2,4 7,1 C 12,4 12,10 7,13 Z"
        fill="#5c823d"
      />
      <path d="M 7,3 L 7,12" stroke="#2d451e" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function HarvestButton({
  target,
  onHarvest,
  disabled,
  disabledNote,
  theme = 'mire',
}: HarvestButtonProps) {
  const t = UI_THEMES[theme];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onHarvest?.(harvestRequestFor(target))}
      aria-label={`${target.actionLabel} ${target.sourceName}`}
      className={
        'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ' +
        t.panel
      }
    >
      <KindGlyph kind={target.kind} />
      <span className="font-medium">{target.actionLabel}</span>
      <span className={t.muted}>{target.sourceName}</span>
      {disabledNote ? (
        <span className={'text-xs italic ' + t.muted}>{disabledNote}</span>
      ) : null}
    </button>
  );
}
