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
 * GLYPH VISIBILITY (Adam, 2026-10-26): the old 14 px glyphs
 * read as digits on a phone — the leaf oval as "0", the
 * uprooted plant's thin stem as "1". All three glyphs are now
 * 22 px, and each is shaped so it cannot read as a digit: the
 * leaf carries a stem sticking out below its body, the soil
 * dots are larger and spread, and the uprooted plant's roots
 * fan in curves instead of straight parallel strokes.
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
  /**
   * Multi-step progress for THIS target (pill-fill, Adam
   * 2026-10-29): while a multi-step harvest is in progress,
   * the pill IS the progress display — its background fills
   * with the retired world bar's orange to `fraction`, the
   * verb swaps to the source's verb, and the press count
   * shows. All values arrive from the caller's
   * 'harvest:progress' payload (pressIndex / pressesTotal /
   * verb carried on the event since the Systems rider) —
   * nothing is derived here. Null/absent = an ordinary
   * pill (single-press harvests never carry progress).
   */
  progress?: {
    fraction: number;
    verb: string;
    pressIndex: number;
    pressesTotal: number;
  } | null;
  /** Look for the button. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

function KindGlyph({ kind }: { kind: HarvestTarget['kind'] }) {
  if (kind === 'ground') {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <circle cx="5" cy="15" r="2.6" fill="#a8a29e" />
        <circle cx="11" cy="18" r="2.6" fill="#a8a29e" />
        <circle cx="17" cy="15" r="2.6" fill="#a8a29e" />
        <circle cx="8" cy="9" r="2.2" fill="#78716c" />
        <circle cx="14" cy="9" r="2.2" fill="#78716c" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path
        d="M 11,18 C 4,14 4,4 11,1 C 18,4 18,14 11,18 Z"
        fill="#5c823d"
      />
      <path d="M 11,4 L 11,15" stroke="#2d451e" strokeWidth="1.5" fill="none" />
      <path d="M 11,18 L 11,21" stroke="#2d451e" strokeWidth="1.5" fill="none" />
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
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <path d="M 11,1 L 11,13" stroke="#5c823d" strokeWidth="2" fill="none" />
      <path
        d="M 11,4 C 6,2 4,5 6,8 C 9,8 11,6 11,4 Z"
        fill="#5c823d"
      />
      <path
        d="M 11,13 C 9,16 7,18 6,21 M 11,13 L 11,21 M 11,13 C 13,16 15,18 16,21"
        stroke="#a8a29e"
        strokeWidth="1.5"
        fill="none"
      />
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
  progress,
  theme = 'mire',
}: HarvestButtonProps) {
  const t = UI_THEMES[theme];
  const action = progress ? progress.verb : (target.actionLabel ?? 'Harvest');
  const fillPct = progress
    ? Math.min(100, Math.max(0, progress.fraction * 100))
    : 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onHarvest?.(harvestRequestFor(target))}
      aria-label={
        `${action} ${target.name}` +
        (progress
          ? `, press ${progress.pressIndex} of ${progress.pressesTotal}`
          : '')
      }
      className={
        'relative flex min-h-[44px] items-center gap-2 overflow-hidden rounded-full px-3 py-1.5 text-sm shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ' +
        t.panel
      }
    >
      {progress ? (
        // The fill: the retired world bar's orange
        // (InteractionProgress hearth fill, bg-amber-600),
        // translucent so the label stays readable over it;
        // content spans carry `relative` to paint above it.
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-amber-600/60"
          style={{ width: `${fillPct}%` }}
        />
      ) : null}
      <span className="relative inline-flex">
        <KindGlyph kind={target.kind} />
      </span>
      <span className="relative font-medium">{action}</span>
      <span className={'relative ' + t.muted}>{target.name}</span>
      {progress ? (
        <span className={'relative text-xs ' + t.muted}>
          {progress.pressIndex} of {progress.pressesTotal}
        </span>
      ) : null}
      {disabledNote ? (
        <span className={'relative text-xs italic ' + t.muted}>
          {disabledNote}
        </span>
      ) : null}
    </button>
  );
}
