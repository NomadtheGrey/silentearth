/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — intro modal (UI lane, presentation only).
 *
 * First-run modal (Adam, 2026-10-27): it explains the game
 * briefly, says who you're playing, then gives the player
 * bullet points. Content order is the brief's order: (1) a
 * brief game explanation, (2) who you're playing, (3) the
 * bullet points.
 *
 * COPY IS DRAFT for Adam's pin pass — he will correct the
 * wording, especially the who-you're-playing lines. What is
 * NOT draft is the restraint: she has no pinned name and no
 * pinned origin story, so the copy invents neither. The
 * bullets are Adam's examples in his words where given
 * (harvest; find food; hunger is real; discover your true
 * abilities; discover what happened) plus the other core
 * loops ONLY as they actually exist in code (build shelter,
 * craft tools, light fires, explore). Nothing here promises
 * a system that isn't built, and ruins are NOT listed as
 * playable — "discover what happened" covers traces and
 * ruins as a direction, not a built feature.
 *
 * DISMISSAL: X button, backdrop tap, and Escape — the same
 * trio as OptionsModal, so the Esc/[X]-out-of-any-modal
 * brief is met by construction here. The footer line teaches
 * the re-open path: the modal is re-openable any time from
 * the Introduction section in Options (Settings tab).
 * No pause wiring: the modal is read-and-dismiss, and the
 * world ticking behind it on a first run is trivial
 * (nothing placed, hunger drains 1 point per 30 seconds).
 */

import { useEffect } from 'react';
import { UI_THEMES, type UiThemeName } from './themes';

export interface IntroModalProps {
  /** Called when the modal is dismissed. */
  onClose?: () => void;
  /** Bottom-sheet layout + thumb-sized controls on touch. Default false. */
  comfortable?: boolean;
  /** Look for the panel. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

/** Adam's examples first, then the other core loops as built. */
const INTRO_POINTS = [
  'Harvest',
  'Find food',
  'Hunger is real',
  'Build shelter',
  'Craft tools',
  'Light fires',
  'Explore',
  'Discover your true abilities',
  'Discover what happened',
];

export function IntroModal({
  onClose,
  comfortable = false,
  theme = 'mire',
}: IntroModalProps) {
  const t = UI_THEMES[theme];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Introduction"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => onClose?.()}
      />
      <section
        aria-label="Introduction"
        className={
          'absolute flex flex-col overflow-hidden rounded-2xl ' +
          t.panel +
          (comfortable
            ? ' left-2 right-2 bottom-2 max-h-[70vh]'
            : ' left-1/2 top-1/2 w-[min(32rem,calc(100vw-2rem))] max-h-[80vh] -translate-x-1/2 -translate-y-1/2')
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-3">
          <h2 className={'text-base font-semibold ' + t.heading}>
            Silent Earth
          </h2>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close introduction"
            className={
              comfortable
                ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
                : 'rounded px-2 py-1 text-sm ' + t.button
            }
          >
            X
          </button>
        </div>

        <div className="overflow-y-auto p-3">
          <p className="text-sm">
            Sixty years after the world ended, the wilds of the Great Lakes
            country are growing back — wet, strange, and full of things
            worth gathering. This is a game about living in that regrowth.
          </p>
          <p className="mt-2 text-sm">
            You are a witch, alone in the wilds, making a life from what
            grows here.
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {INTRO_POINTS.map((point) => (
              <li key={point} className="text-sm">
                · {point}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onClose?.()}
            className={
              comfortable
                ? 'mt-4 min-h-[44px] w-full rounded px-3 py-2 text-sm ' +
                  t.button
                : 'mt-4 rounded px-3 py-1 text-sm ' + t.button
            }
          >
            Begin
          </button>
          <p className={'mt-2 text-xs ' + t.muted}>
            You can read this again any time from Options.
          </p>
        </div>
      </section>
    </div>
  );
}
