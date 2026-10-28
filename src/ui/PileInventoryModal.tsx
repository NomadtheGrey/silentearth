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
 * Rows are laid out name | counts | arrows as three
 * distinct cells, so the columnar landing reshapes them
 * into subgrid columns rather than rebuilding them.
 * Actions are the SAME ContextAction[] pileMenuActions
 * emits, dispatched through the SAME handlePileAction —
 * zero new handlers. Deposits go into THIS pile at its
 * exact x/z (the handler's verbatim coords). Worn-gear
 * rules ride pileMenuActions (no deposit arrows for worn
 * kinds; carried-only worn kinds get no entry; Take
 * stays). The desktop USE whole-pile take is untouched
 * (separate path, not a menu/modal action).
 */

import type { ContextAction } from './types';
import { UI_THEMES, type UiThemeName } from './themes';
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
  /** Look for the modal. Default "mire". */
  theme?: UiThemeName;
}

export function PileInventoryModal({
  title,
  actions,
  onSelect,
  onClose,
  theme = 'mire',
}: PileInventoryModalProps) {
  const t = UI_THEMES[theme];
  return (
    <section aria-label={title} className={'rounded p-3 ' + t.panel}>
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
            return (
              <li key={action.id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{action.label}</span>
                  <span
                    className={'whitespace-nowrap text-xs ' + t.muted}
                  >
                    {action.countsText
                      ? action.countsText
                      : action.counts
                        ? `pile ×${action.counts.pile} · carried ×${action.counts.carried}`
                        : null}
                  </span>
                  <span className="flex gap-1">
                    {action.arrows.map((arrow) => (
                      <button
                        key={arrow.id}
                        type="button"
                        disabled={arrow.disabled}
                        onClick={() => onSelect(arrow.id)}
                        aria-label={arrow.ariaLabel}
                        className="min-h-[44px] min-w-[44px] rounded text-base disabled:cursor-not-allowed disabled:opacity-40 hover:bg-stone-800"
                      >
                        <span aria-hidden="true">{arrow.glyph}</span>
                      </button>
                    ))}
                  </span>
                </div>
                {action.disabledNote ? (
                  <span className={'text-xs ' + t.muted}>
                    {action.disabledNote}
                  </span>
                ) : null}
              </li>
            );
          }
          return (
            <li key={action.id}>
              <button
                type="button"
                disabled={action.disabled}
                onClick={() => onSelect(action.id)}
                className="w-full rounded px-2 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 hover:bg-stone-800"
              >
                {action.label}
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
