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
 * Rows STACK (Adam, 2026-10-31, from his screenshot —
 * the subgrid rows collided: a long name wrapped a word
 * per line over three lines while 'pile ×0' rode on it
 * and 'carried' collided mid-word; his words: 'let's
 * give the name and amounts more space'). Each arrow
 * row is three lines of its own: the NAME on a full-
 * width line (wraps naturally, truncates never), the
 * COUNTS on their own right-aligned line in the single-
 * line form ('pile ×0 · carried ×3'), and the ARROW
 * cluster on its own line, right-aligned, unchanged in
 * order, glyphs, disabled states, and digit badges —
 * the arrows keep their places (same cluster, side,
 * order; down a line, not away). One form at all widths:
 * the old 3-column subgrid (name | counts | arrows)
 * starved the name column to ~30 px at these seats
 * (~188 px of 44 px arrows + ~70 px of counts inside
 * ~296 px of content), and widening the panel is no
 * answer on the touch sheet. Legibility is bought with
 * height; the modal scrolls. Notes stack under names.
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
      <ul className="flex flex-col gap-1">
        {actions.map((action) => {
          if (action.arrows) {
            const countsLine =
              action.countsText ??
              (action.counts
                ? `pile ×${action.counts.pile} · carried ×${action.counts.carried}`
                : null);
            return (
              <li key={action.id} className="flex flex-col gap-1 py-1">
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm">{action.label}</span>
                  {action.disabledNote ? (
                    <span className={'text-xs ' + t.muted}>
                      {action.disabledNote}
                    </span>
                  ) : null}
                </span>
                {countsLine !== null ? (
                  <span
                    className={
                      'whitespace-nowrap text-right text-sm tabular-nums ' +
                      t.muted
                    }
                  >
                    {countsLine}
                  </span>
                ) : null}
                <span className="flex justify-end gap-1">
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
            <li key={action.id}>
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
