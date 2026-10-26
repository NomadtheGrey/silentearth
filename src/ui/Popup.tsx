/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — popup / dialog (UI lane, presentation only).
 *
 * A generic dialog shell: title, body content supplied by the caller,
 * and an optional witch face. It owns no game state — `open` is a prop,
 * closing is reported through `onClose`, and the body is whatever the
 * caller renders as children.
 *
 * The witch face is the popup toy from the task: her prototype look
 * (WitchPortrait, built on CharacterAvatar) beside the dialog text. Expressions are a later
 * landing; this shows the neutral face only, via `showWitch`.
 */

import type { ReactNode } from 'react';
import { WitchPortrait } from './WitchPortrait';
import { UI_THEMES, type UiThemeName } from './themes';

export interface PopupProps {
  /** Whether the dialog is shown. Caller-owned. */
  open: boolean;
  title: string;
  /** Body content, supplied by the caller. */
  children?: ReactNode;
  /** Show the witch's portrait beside the dialog. Default false. */
  showWitch?: boolean;
  /** Called when the dialog is dismissed. Optional. */
  onClose?: () => void;
  /** Look for the dialog. Default "hearth" (firelit). */
  theme?: UiThemeName;
}

export function Popup({
  open,
  title,
  children,
  showWitch = false,
  onClose,
  theme = 'hearth',
}: PopupProps) {
  if (!open) {
    return null;
  }
  const t = UI_THEMES[theme];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className={'flex max-w-lg items-start gap-4 rounded p-4 ' + t.panel}>
        {showWitch ? <WitchPortrait size={84} /> : null}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className={'text-base font-semibold ' + t.heading}>{title}</h2>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className={'rounded px-2 py-1 text-sm ' + t.button}
              >
                Close
              </button>
            ) : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
