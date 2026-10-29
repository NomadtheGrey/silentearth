/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — leave confirm dialog (UI lane,
 * presentation only).
 *
 * The back-button trap's question (Adam, 2026-10-29 —
 * protect the player against accidental tab closing /
 * refresh / back on phone): when a back press arrives
 * with nothing open, the shell shows this instead of
 * leaving. A centered modal (fixed z-50, backdrop,
 * centered card — the RemoveConfirm/OptionsModal
 * pattern). Stay is the safe direction: backdrop tap
 * and Escape stay; Enter and the Leave button leave.
 * Props-driven: the caller owns the open flag and the
 * history mechanics; this layer renders the question
 * and reports the answer. Own keydown listener while
 * open — the App Esc listener yields while this dialog
 * is open, so Stay cannot double-fire.
 */

import { useEffect } from 'react';
import { UI_THEMES, type UiThemeName } from './themes';

export interface LeaveConfirmProps {
  /** Whether the dialog shows. False = renders nothing. */
  open: boolean;
  /** Stay press (Escape, backdrop tap, or the Stay button). */
  onStay: () => void;
  /** Leave press (Enter or the Leave button). */
  onLeave: () => void;
  /** Look for the panel. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function LeaveConfirm({
  open,
  onStay,
  onLeave,
  theme = 'mire',
}: LeaveConfirmProps) {
  const t = UI_THEMES[theme];
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') onLeave();
      else if (e.key === 'Escape') onStay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onStay, onLeave]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm leave"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onStay} />
      <section
        className={
          'absolute left-1/2 top-1/2 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded ' +
          t.panel
        }
      >
        <p className={'p-4 text-base font-semibold ' + t.heading}>
          Leave the game?
        </p>
        <p className={'px-4 pb-2 text-sm ' + t.muted}>
          Your progress is saved.
        </p>
        <div className="flex gap-2 p-4">
          <button
            type="button"
            onClick={onStay}
            className={
              'min-h-[44px] rounded px-4 py-2 text-sm ' + t.button
            }
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onLeave}
            className={
              'min-h-[44px] rounded px-4 py-2 text-sm ' + t.button
            }
          >
            Leave
          </button>
        </div>
      </section>
    </div>
  );
}
