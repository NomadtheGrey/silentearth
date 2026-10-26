/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — inventory panel, presentation only (UI lane).
 *
 * Shows the items a caller passes in. Selection is a prop, not internal
 * state: the caller owns which item (if any) is selected and decides
 * what a selection does. Capacity, if shown at all, is caller-supplied
 * text — this panel never counts, totals, or enforces a limit.
 */

import type { InventoryItem } from './types';
import { UI_THEMES, type UiThemeName } from './themes';
import { VineDivider } from './WitchyArt';

export interface InventoryPanelProps {
  items: InventoryItem[];
  /** Id of the selected item, if any. Undefined = nothing selected. */
  selectedItemId?: string;
  /** Called when the player picks an item. Optional. */
  onSelectItem?: (id: string) => void;
  /**
   * Item ids that can be placed in the world (fires, houses).
   * Items in this set gain a Place button. Omitted = no Place
   * buttons; placement itself is the caller's job.
   */
  placeableIds?: ReadonlySet<string>;
  /** Called when the player presses Place on an item. Optional. */
  onPlaceItem?: (id: string) => void;
  /** Caller-supplied capacity line, e.g. a total the system provides. */
  capacityText?: string;
  /** Called when the panel is closed. Optional. */
  onClose?: () => void;
  /** Look for the panel. Default "mire" (gathering / the world outside). */
  theme?: UiThemeName;
}

export function InventoryPanel({
  items,
  selectedItemId,
  onSelectItem,
  placeableIds,
  onPlaceItem,
  capacityText,
  onClose,
  theme = 'mire',
}: InventoryPanelProps) {
  const t = UI_THEMES[theme];
  return (
    <section aria-label="Inventory" className={'rounded p-3 ' + t.panel}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className={'text-base font-semibold ' + t.heading}>Inventory</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inventory"
            className={'rounded px-2 py-1 text-sm ' + t.button}
          >
            Close
          </button>
        ) : null}
      </div>
      <VineDivider className="mb-2" />

      {capacityText ? (
        <p className={'mb-2 text-sm ' + t.muted}>{capacityText}</p>
      ) : null}

      {items.length === 0 ? (
        <p className={'italic ' + t.muted}>Nothing carried yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const selected = item.id === selectedItemId;
            const placeable = placeableIds?.has(item.id) ?? false;
            return (
              <li key={item.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelectItem?.(item.id)}
                  aria-pressed={selected}
                  className={
                    'flex flex-1 items-baseline justify-between gap-2 rounded px-2 py-1 text-left ' +
                    (selected ? t.selected : 'hover:bg-stone-800')
                  }
                >
                  <span>
                    {item.name}
                    {item.note ? (
                      <span className={'ml-2 text-sm ' + t.muted}>
                        {item.note}
                      </span>
                    ) : null}
                  </span>
                  {item.quantityText ? (
                    <span className="text-sm text-stone-300">
                      {item.quantityText}
                    </span>
                  ) : null}
                </button>
                {placeable && onPlaceItem ? (
                  <button
                    type="button"
                    onClick={() => onPlaceItem(item.id)}
                    aria-label={`Place ${item.name}`}
                    className="rounded bg-[#3a4436] px-2 py-1 text-xs hover:bg-[#4a5546]"
                  >
                    Place
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
