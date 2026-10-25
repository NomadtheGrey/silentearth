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

export interface InventoryPanelProps {
  items: InventoryItem[];
  /** Id of the selected item, if any. Undefined = nothing selected. */
  selectedItemId?: string;
  /** Called when the player picks an item. Optional. */
  onSelectItem?: (id: string) => void;
  /** Caller-supplied capacity line, e.g. a total the system provides. */
  capacityText?: string;
  /** Called when the panel is closed. Optional. */
  onClose?: () => void;
}

export function InventoryPanel({
  items,
  selectedItemId,
  onSelectItem,
  capacityText,
  onClose,
}: InventoryPanelProps) {
  return (
    <section
      aria-label="Inventory"
      className="rounded bg-stone-900/90 p-3 text-stone-100 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Inventory</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inventory"
            className="rounded bg-stone-700 px-2 py-1 text-sm hover:bg-stone-600"
          >
            Close
          </button>
        ) : null}
      </div>

      {capacityText ? (
        <p className="mb-2 text-sm text-stone-400">{capacityText}</p>
      ) : null}

      {items.length === 0 ? (
        <p className="italic text-stone-400">Nothing carried yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const selected = item.id === selectedItemId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem?.(item.id)}
                  aria-pressed={selected}
                  className={
                    'flex w-full items-baseline justify-between gap-2 rounded px-2 py-1 text-left ' +
                    (selected
                      ? 'bg-amber-800/60 outline outline-1 outline-amber-500'
                      : 'hover:bg-stone-800')
                  }
                >
                  <span>
                    {item.name}
                    {item.note ? (
                      <span className="ml-2 text-sm text-stone-400">
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
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
