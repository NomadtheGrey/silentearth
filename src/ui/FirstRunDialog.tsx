/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — first-run dialog (UI lane,
 * presentation only).
 *
 * The minimal dialog at first run (Adam, 2026-10-28):
 * world name + seed, both optional. Begin-only by design
 * — no Cancel, no X, no backdrop dismiss: on first run
 * there is nowhere to go, and Begin-with-blanks is the
 * exit (blank name → unnamed, blank seed → DEFAULT_SEED).
 * Begin hands TRIMMED values to App; App applies the
 * blanks, swaps the world, and opens the intro. No
 * autofocus: on phones an auto-popped keyboard on open
 * is intrusive — the keyboard appears when the player
 * taps a field. Form submit (Enter in either field) is
 * Begin. Copy line under the heading is PROPOSED (Adam
 * pins wording at sighting).
 *
 * NEW-GAME MODE (dialog audit claim 3, 2026-10-31):
 * the same dialog serves the cloud New Game door over
 * a live session — the caller passes a `warning`
 * (rendered directly above Begin, the commitment
 * point) and an `onBack` (an explicit back-out that
 * parks nothing). The first-run seat passes neither:
 * Begin-only remains the law where there is nowhere
 * to go back to.
 */

import { useState, type ReactNode } from 'react';
import { UI_THEMES, type UiThemeName } from './themes';

export interface FirstRunDialogProps {
  /** Begin with the dialog's trimmed name + seed (blanks allowed). */
  onBegin: (name: string, seed: string) => void;
  /** New-game mode: shown directly above Begin. */
  warning?: ReactNode;
  /** New-game mode: renders a Back button beside Begin. */
  onBack?: () => void;
  /** Touch layout (bottom sheet) vs desktop (centered). */
  comfortable?: boolean;
  theme?: UiThemeName;
}

export function FirstRunDialog({
  onBegin,
  warning,
  onBack,
  comfortable = false,
  theme = 'mire',
}: FirstRunDialogProps) {
  const t = UI_THEMES[theme];
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="New world"
    >
      {/* No backdrop dismiss: Begin-only by design (see header). */}
      <div className="absolute inset-0 bg-black/60" />
      <section
        aria-label="New world"
        className={
          'absolute flex flex-col overflow-hidden rounded-2xl ' +
          t.panel +
          (comfortable
            ? ' left-2 right-2 bottom-2 max-h-[70vh]'
            : ' left-1/2 top-1/2 w-[min(32rem,calc(100vw-2rem))] max-h-[80vh] -translate-x-1/2 -translate-y-1/2')
        }
      >
        <div className="flex items-center justify-between gap-2 p-3">
          <h2 className={'text-base font-semibold ' + t.heading}>
            New world
          </h2>
          {/* No X button: Begin-only by design (see header). */}
        </div>
        <form
          className="flex flex-col gap-3 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            onBegin(name.trim(), seed.trim());
          }}
        >
          <p className="text-sm opacity-80">
            Name your world and pick a seed — both are optional.
          </p>
          <label className="flex flex-col gap-1 text-xs opacity-70">
            World name:
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this world"
              className={
                'bg-[#1e241c] border border-moss-deep px-2 py-1 text-sm text-stone-100 outline-none ' +
                (comfortable ? 'min-h-[44px]' : '')
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs opacity-70">
            World seed:
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Leave blank for the default world"
              className={
                'bg-[#1e241c] border border-moss-deep px-2 py-1 text-sm text-stone-100 outline-none ' +
                (comfortable ? 'min-h-[44px]' : '')
              }
            />
          </label>
          {warning ? (
            <div className="flex flex-col gap-1 text-sm">{warning}</div>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              className={
                comfortable
                  ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
                  : 'rounded px-2 py-1 text-sm ' + t.button
              }
            >
              Begin
            </button>
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className={
                  comfortable
                    ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
                    : 'rounded px-2 py-1 text-sm ' + t.button
                }
              >
                Back
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
