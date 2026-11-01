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
 * THE UNIFIED SHAPE (Inventory Unification, 2026-10-31):
 * the modal is a thin shell now — header, legend, Close —
 * around the shared ItemListSurface, the same surface
 * the pack panel renders. The ContextAction[] dialect
 * this file used to render is RETIRED: the caller
 * composes item rows + per-row verbs (the same verb ids
 * handlePileAction has always dispatched — Take/Deposit
 * arrows under 'take-one:kind' style ids), and digit
 * dispatch reads the surface's reported VISIBLE verb
 * list, so the numbers on the badges are the numbers
 * the keys hit, in the order the player sees — search,
 * sort, and folds included. The surface's rows stack at
 * this seat's width by the shared container rule (the
 * legibility the old stacked rows were built for, kept
 * by the one shape). Deposits go into THIS pile at its
 * exact x/z (the handler's verbatim coords). Whole-pile
 * take is not a modal action (it is R's pile second
 * action + the desktop pile button).
 */

import type { InventoryItem } from './types';
import { UI_THEMES, type UiThemeName } from './themes';
import { VineDivider } from './WitchyArt';
import {
  ItemListSurface,
  type InventorySortMode,
  type InventorySortPreference,
  type ItemListVerb,
  type ItemListVisibleVerb,
} from './ItemListSurface';

export interface PileInventoryModalProps {
  /** Title, mirroring the old menu's objectName rule. */
  title: string;
  /** The pile's kinds + carried kinds, as unified item rows. */
  items: InventoryItem[];
  /** Per-row verbs (ids are the standing pile action ids). */
  verbsFor: (item: InventoryItem) => ItemListVerb[];
  /** A verb press: the row's item id + the verb's action id. */
  onVerb: (itemId: string, verbId: string) => void;
  /**
   * The surface's visible verb list, for the caller's
   * digit dispatch (the badges are this list's order).
   */
  onVisibleVerbs?: (verbs: ItemListVisibleVerb[]) => void;
  /** Closes the modal (clears ref + state, menu parity). */
  onClose: () => void;
  /**
   * Show PC digit badges (beautification rider, 2026-10-29):
   * verbs numbered in visible order, capped at 9 — the
   * ContextMenu rule, so the modal and the menus tell the
   * same story. Caller passes !isTouch. Hint only.
   */
  showKeyHints?: boolean;
  /** The ONE shared sort preference (unification). */
  sortMode?: InventorySortMode;
  sortReversed?: boolean;
  onSortChange?: (pref: InventorySortPreference) => void;
  categoryOrder?: readonly string[];
  /** Look for the modal. Default "mire". */
  theme?: UiThemeName;
}

export function PileInventoryModal({
  title,
  items,
  verbsFor,
  onVerb,
  onVisibleVerbs,
  onClose,
  showKeyHints = false,
  sortMode,
  sortReversed = false,
  onSortChange,
  categoryOrder,
  theme = 'mire',
}: PileInventoryModalProps) {
  const t = UI_THEMES[theme];
  return (
    <section aria-label={title} className={'@container rounded-2xl p-3 ' + t.panel}>
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
      <ItemListSurface
        items={items}
        verbsFor={verbsFor}
        onVerb={onVerb}
        sortMode={sortMode}
        sortReversed={sortReversed}
        onSortChange={onSortChange}
        categoryOrder={categoryOrder}
        emptyText="Nothing here."
        searchLabel="Search pile items"
        showKeyHints={showKeyHints}
        onVisibleVerbs={onVisibleVerbs}
        theme={theme}
      />
    </section>
  );
}
