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
 * bus.emit('harvest:requested', request), the event Background
 * registered in EventMap (see proximityHarvest.ts for the mapping).
 *
 * The glyph differs by kind, lightly: a leaf for scatter, soil
 * specks for the ground. Ground buttons look and behave exactly
 * like scatter buttons — nearly-anyplace harvesting means the ground
 * underfoot is not a second-class target. The verb reads "Harvest"
 * unless the caller overrides it per target; the bus carries no
 * verb, so the verb is presentation, not data.
 *
 * REMOVE (Adam, 2026-10-26): alongside normal harvest, she may
 * TOTALLY REMOVE a plant — more resources at once, but the plant
 * is gone permanently (no regrow), for clearing ground for a
 * house. RemoveButton below is that second option: same look,
 * an uprooted-plant glyph, and a target-level onRemove callback
 * (no bus import, no invented event — the wiring caller maps it
 * to Background's documented shape, 'harvest:requested' with
 * action 'remove', 2003619). It renders only for scatter
 * targets, only when the caller passes onRemove, and never for
 * ground: there is no plant to remove from the ground underfoot,
 * and ground never depletes. The "Remove" label is the lane's
 * pick, flagged, not pinned.
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

export interface RemoveButtonProps {
  /** The in-range scatter target this button removes. */
  target: HarvestTarget;
  /** Called with the target when the player presses the button. */
  onRemove?: (target: HarvestTarget) => void;
  /** Verb for the button. Default "Remove" (lane's pick, flagged). */
  removeLabel?: string;
  /** Look for the button. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

/** Small uprooted plant: stem, leaf, and exposed roots. */
function UprootGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M 7,1 L 7,8" stroke="#5c823d" strokeWidth="1.5" fill="none" />
      <path
        d="M 7,3 C 4,2 3,4 4,6 C 6,6 7,5 7,3 Z"
        fill="#5c823d"
      />
      <path d="M 7,8 L 5,12 M 7,8 L 7,12 M 7,8 L 9,12" stroke="#a8a29e" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function RemoveButton({
  target,
  onRemove,
  removeLabel = 'Remove',
  theme = 'mire',
}: RemoveButtonProps) {
  const t = UI_THEMES[theme];
  return (
    <button
      type="button"
      onClick={() => onRemove?.(target)}
      aria-label={`${removeLabel} ${target.name} permanently`}
      className={
        'flex min-h-[44px] items-center gap-2 rounded-full px-3 py-1.5 text-sm shadow-lg transition-transform hover:scale-105 ' +
        t.panel
      }
    >
      <UprootGlyph />
      <span className="font-medium">{removeLabel}</span>
      <span className={t.muted}>{target.name}</span>
    </button>
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
  const action = target.actionLabel ?? 'Harvest';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onHarvest?.(harvestRequestFor(target))}
      aria-label={`${action} ${target.name}`}
      className={
        'flex min-h-[44px] items-center gap-2 rounded-full px-3 py-1.5 text-sm shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ' +
        t.panel
      }
    >
      <KindGlyph kind={target.kind} />
      <span className="font-medium">{action}</span>
      <span className={t.muted}>{target.name}</span>
      {disabledNote ? (
        <span className={'text-xs italic ' + t.muted}>{disabledNote}</span>
      ) : null}
    </button>
  );
}
