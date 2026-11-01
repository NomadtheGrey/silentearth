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
 *
 * DISMISSAL (Adam, 2026-10-27 — Esc + [X] out of any modal):
 * the dialog closes via its Close button (kept), a visible
 * [X] button beside it (thumb-sized when comfortable), and
 * Escape while open. The Escape listener mounts only while
 * the dialog is open, so Esc never fires with no modal up;
 * it acts on Escape alone and swallows nothing, so V/C
 * camera cycling and WASD movement are untouched. Stacking:
 * each modal's backdrop covers the screen, so a second
 * modal cannot be user-opened beneath an open one — one
 * Esc closes the one open modal (topmost by construction).
 */

import { useEffect } from 'react';
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
  /** Called when Enter is pressed while the dialog is
   * open — the confirm half of the shell (the fold of
   * the standalone confirm dialogs, 2026-10-31: Popup
   * is the ONE confirm shell, so Enter lives here).
   * Optional: dialogs without it ignore Enter. Enter
   * typed into a text field never confirms (the typing
   * law). */
  onConfirm?: () => void;
  /** Thumb-sized controls on touch. Default false. */
  comfortable?: boolean;
  /** Look for the dialog. Default "hearth" (firelit). */
  theme?: UiThemeName;
}

export function Popup({
  open,
  title,
  children,
  showWitch = false,
  onClose,
  onConfirm,
  comfortable = false,
  theme = 'hearth',
}: PopupProps) {
  // Escape closes the dialog and Enter confirms it, but
  // only while it is open: the listener is added only
  // when open is true, so neither key fires with no
  // modal up. The keys act alone (no preventDefault, no
  // stopPropagation), so V/C camera cycling and WASD
  // movement are untouched; Enter typed into a text
  // field is the field's, never the dialog's.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key === 'Enter' && onConfirm !== undefined) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          return;
        }
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, onConfirm]);

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
      onClick={(e) => {
        // Backdrop tap dismisses (the folded confirms'
        // law, now the shell's): only a tap on the
        // backdrop itself, never a click inside the
        // panel (those carry their own target).
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={'flex max-w-lg items-start gap-4 rounded-2xl p-4 ' + t.panel}>
        {showWitch ? <WitchPortrait size={84} /> : null}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className={'text-base font-semibold ' + t.heading}>{title}</h2>
            {onClose ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className={'rounded px-2 py-1 text-sm ' + t.button}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className={
                    comfortable
                      ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
                      : 'rounded px-2 py-1 text-sm ' + t.button
                  }
                >
                  X
                </button>
              </div>
            ) : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
