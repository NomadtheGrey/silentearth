/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — pile inventory modal, presentation only (UI lane).
 *
 * The pile's inventory as a PANEL, not a world-anchored menu
 * (Adam, 2026-10-28 — one pile UI; the menu content IS the
 * modal content, same data, same handler). It renders in
 * the panels column (same seat as InventoryPanel: desktop
 * right-2 top-20 w-80, touch bottom sheet max-h-60vh) and
 * is gated on the selected pile alone — no anchor, no
 * WorldAnchor. The chip press that opens it is unchanged
 * (sets selectedPileId); the modal appears in the column
 * and stays open + live re-renders while the pile is in
 * range. Emptying the pile (or walking away) closes it
 * via the EXISTING refreshPilesFromState clear — no new
 * logic, no empty view.
 *
 * Rows ARE subgrid columns (columnar landing, 2026-10-28):
 * name | counts | arrows as three distinct cells under
 * one ul grid (minmax(0,1fr)/auto/auto), so counts align
 * across rows and names wrap instead of truncating. Pile
 * counts stack two lines (pile over carried) because four
 * 44px arrows leave no room for one line at phone width.
 * Notes stack under names, not inline.
 * Actions are the SAME ContextAction[] pileMenuActions
 * emits, dispatched through the SAME handlePileAction —
 * zero new handlers. Deposits go into THIS pile at its
 * exact x/z (the handler's verbatim coords). Worn-gear
 * rules ride pileMenuActions (no deposit arrows for worn
 * kinds; carried-only worn kinds get no entry; Take
 * stays). Whole-pile take is not a modal action (it is
 * R's pile second action + the desktop pile button).
 */

import type { ContextAction } from './types';
import { KEY_BADGE_CLASS, UI_THEMES, type UiThemeName } from './themes';
import { VineDivider } from './WitchyArt';

export interface PileInventoryModalProps {
  /** Title, mirroring the old menu's objectName rule. */
  title: string;
  /** Same ContextAction[] pileMenuActions emits. */
  actions: ContextAction[];
  /** Dispatches action ids through handlePileAction. */
  onSelect: (id: string) => void;
  /** Closes the modal (clears ref + state, menu parity). */
  onClose: () => void;
  /**
   * Show PC digit badges (beautification rider, 2026-10-29):
   * every dispatchable target numbered in the shell's
   * digit-dispatch flatten order (actions in order; an
   * arrows row contributes its arrows in order), capped
   * at 9 — the ContextMenu rule, so the modal and the
   * menus tell the same story. Caller passes !isTouch.
   * Hint only. Default false = no badges.
   */
  showKeyHints?: boolean;
  /** Look for the modal. Default "mire". */
  theme?: UiThemeName;
}

export function PileInventoryModal({
  title,
  actions,
  onSelect,
  onClose,
  showKeyHints = false,
  theme = 'mire',
}: PileInventoryModalProps) {
  const t = UI_THEMES[theme];
  // Digit-badge counter, consumed in render order (see
  // the prop doc): a plain action takes one number, an
  // arrows row takes one per arrow. Beyond 9 there is
  // no digit, so no badge.
  let hintCount = 0;
  const nextHint = (): number | null => {
    hintCount += 1;
    return showKeyHints && hintCount <= 9 ? hintCount : null;
  };
  return (
    <section aria-label={title} className={'rounded-2xl p-3 ' + t.panel}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className={'text-base font-semibold ' + t.heading}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close pile"
          className={
            'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
          }
        >
          Close
        </button>
      </div>
      <VineDivider className="mb-2" />
      <p className={'mb-2 text-xs ' + t.muted}>
        ↑ Pick up one · ↑↑ Pick up all · ↓ Drop one here · ↓↓ Drop all here
      </p>
      <ul className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-2 gap-y-1">
        {actions.map((action) => {
          if (action.arrows) {
            return (
              <li
                key={action.id}
                className="col-span-3 grid grid-cols-subgrid items-center"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm">{action.label}</span>
                  {action.disabledNote ? (
                    <span className={'text-xs ' + t.muted}>
                      {action.disabledNote}
                    </span>
                  ) : null}
                </span>
                <span
                  className={
                    'whitespace-nowrap text-right text-sm tabular-nums ' +
                    t.muted
                  }
                >
                  {action.countsText ? (
                    action.countsText
                  ) : action.counts ? (
                    <>
                      pile ×{action.counts.pile}
                      <br />
                      carried ×{action.counts.carried}
                    </>
                  ) : null}
                </span>
                <span className="flex gap-1">
                  {action.arrows.map((arrow) => {
                    const hint = nextHint();
                    return (
                      <button
                        key={arrow.id}
                        type="button"
                        disabled={arrow.disabled}
                        onClick={() => onSelect(arrow.id)}
                        aria-label={arrow.ariaLabel}
                        className="relative min-h-[44px] min-w-[44px] rounded text-base disabled:cursor-not-allowed disabled:opacity-40 hover:bg-stone-800"
                      >
                        <span aria-hidden="true">{arrow.glyph}</span>
                        {hint !== null ? (
                          <span
                            aria-hidden="true"
                            className={
                              'absolute -right-1 -top-1 ' + KEY_BADGE_CLASS
                            }
                          >
                            {hint}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </span>
              </li>
            );
          }
          const hint = nextHint();
          return (
            <li key={action.id} className="col-span-3">
              <button
                type="button"
                disabled={action.disabled}
                onClick={() => onSelect(action.id)}
                className="w-full rounded px-2 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 hover:bg-stone-800"
              >
                {action.label}
                {hint !== null ? (
                  <span aria-hidden="true" className={'ml-1 ' + KEY_BADGE_CLASS}>
                    {hint}
                  </span>
                ) : null}
              </button>
              {action.disabledNote ? (
                <span className={'mt-0.5 block text-xs ' + t.muted}>
                  {action.disabledNote}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
