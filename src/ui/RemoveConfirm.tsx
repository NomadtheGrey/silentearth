/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — remove confirm dialog (UI lane, presentation only).
 *
 * The key-driven confirm for Shift+E remove: a centered modal
 * (fixed z-50, backdrop, centered card — the OptionsModal
 * pattern, not Popup) asking once before a permanent remove.
 * Enter confirms, Escape cancels, backdrop tap cancels
 * (cancel is the safe direction for a destructive action).
 * Props-driven: the caller owns the target and the open flag;
 * this layer renders the question and reports the answer.
 * Own keydown listener while open — the single Esc path:
 * the App Esc listener yields while this dialog is open, so
 * cancel cannot double-fire. The dialog's own listener is
 * the only Enter path too (App handles no Enter key).
 */

import { useEffect } from 'react';
import { UI_THEMES, type UiThemeName } from './themes';

export interface RemoveConfirmProps {
  /** Whether the dialog shows. False = renders nothing. */
  open: boolean;
  /** Display name of the scatter target (e.g. "Grass"). */
  targetName: string;
  /** Confirm press (Enter or the Remove button). */
  onConfirm: () => void;
  /** Cancel press (Escape, backdrop tap, or Cancel button). */
  onCancel: () => void;
  /** Look for the panel. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function RemoveConfirm({
  open,
  targetName,
  onConfirm,
  onCancel,
  theme = 'mire',
}: RemoveConfirmProps) {
  const t = UI_THEMES[theme];
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') onConfirm();
      else if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onConfirm, onCancel]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm remove"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <section
        className={
          'absolute left-1/2 top-1/2 w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded ' +
          t.panel
        }
      >
        <p className={'p-4 text-base font-semibold ' + t.heading}>
          Remove {targetName}?
        </p>
        <p className={'px-4 pb-2 text-sm ' + t.muted}>
          This removes it permanently — it will not regrow.
        </p>
        <div className="flex gap-2 p-4">
          <button
            type="button"
            onClick={onConfirm}
            className={
              'min-h-[44px] rounded px-4 py-2 text-sm ' + t.button
            }
          >
            Remove
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={
              'min-h-[44px] rounded px-4 py-2 text-sm ' + t.button
            }
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
