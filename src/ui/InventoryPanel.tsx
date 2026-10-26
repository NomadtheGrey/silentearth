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
 *
 * The witch herself stands at the top of her inventory, front-facing
 * (WitchPortrait, default size): this screen shows whose things these
 * are, not just a list. Worn garments are NOT reflected yet —
 * CharacterAvatar has no garment layers, and two of the five garments
 * (mittens, boots) have no body part drawn to hang them on — so that
 * reflection is a separate illustration landing, not part of this mount.
 */

import type { InventoryItem } from './types';
import { UI_THEMES, type UiThemeName } from './themes';
import { VineDivider } from './WitchyArt';
import { WitchPortrait } from './WitchPortrait';

/**
 * A home-storage section inside the inventory panel (the SAME
 * panel pattern, not a second panel): the sheltering house's
 * stored items, with Withdraw buttons. Deposit buttons live on
 * the personal rows above, gated by onDepositItem. The caller
 * owns both inventories; this panel never moves anything
 * itself.
 */
export interface InventoryStorageSection {
  /** Display name of the house holding these supplies. */
  label: string;
  /** Stored items, caller-supplied rows like the personal list. */
  items: InventoryItem[];
  /** Caller-supplied capacity line for the home store. */
  capacityText?: string;
  /** Caller-supplied note line (e.g. a transfer error). */
  note?: string | null;
  /** Called when the player presses Withdraw on a stored item. */
  onWithdrawItem?: (id: string) => void;
}

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
  /**
   * Item ids that can be eaten (foods, including cook-required
   * ones whose press surfaces the cook-first note). Items in
   * this set gain an Eat button. Omitted = no Eat buttons;
   * eating itself is the caller's job.
   */
  foodIds?: ReadonlySet<string>;
  /** Called when the player presses Eat on an item. Optional. */
  onEatItem?: (id: string) => void;
  /**
   * Home-storage section, shown when the caller opens one
   * (sheltered at a placed house). Omitted = personal list
   * only, no Deposit buttons.
   */
  storage?: InventoryStorageSection;
  /** Called when the player presses Deposit on a carried item. */
  onDepositItem?: (id: string) => void;
  /**
   * Called when the player presses Drop on a carried item.
   * Every personal row gains a Drop button when this is
   * passed; storage rows never get one (dropping is from
   * the pack she carries, not the house store). Dropping
   * itself is the caller's job.
   */
  onDropItem?: (id: string) => void;
  /** Caller-supplied capacity line, e.g. a total the system provides. */
  capacityText?: string;
  /** Called when the panel is closed. Optional. */
  onClose?: () => void;
  /** Thumb-sized action buttons (44 px targets) on touch. Default false. */
  comfortable?: boolean;
  /** Look for the panel. Default "mire" (gathering / the world outside). */
  theme?: UiThemeName;
}

export function InventoryPanel({
  items,
  selectedItemId,
  onSelectItem,
  placeableIds,
  onPlaceItem,
  foodIds,
  onEatItem,
  storage,
  onDepositItem,
  onDropItem,
  capacityText,
  onClose,
  comfortable = false,
  theme = 'mire',
}: InventoryPanelProps) {
  const t = UI_THEMES[theme];
  const actionBtn = comfortable
    ? 'rounded bg-[#3a4436] px-3 py-2 text-sm min-h-[44px] hover:bg-[#4a5546]'
    : 'rounded bg-[#3a4436] px-2 py-1 text-xs hover:bg-[#4a5546]';
  const closeBtn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
    : 'rounded px-2 py-1 text-sm ' + t.button;
  return (
    <section aria-label="Inventory" className={'rounded p-3 ' + t.panel}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className={'text-base font-semibold ' + t.heading}>Inventory</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inventory"
            className={closeBtn}
          >
            Close
          </button>
        ) : null}
      </div>
      <VineDivider className="mb-2" />

      {/* The witch, front-facing, above her things. */}
      <div className="mb-2 flex justify-center">
        <WitchPortrait />
      </div>

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
            const food = foodIds?.has(item.id) ?? false;
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
                  <span className="flex items-center gap-1.5">
                    {item.icon ? (
                      <span className="inline-flex shrink-0">{item.icon}</span>
                    ) : null}
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
                    className={actionBtn}
                  >
                    Place
                  </button>
                ) : null}
                {food && onEatItem ? (
                  <button
                    type="button"
                    onClick={() => onEatItem(item.id)}
                    aria-label={`Eat ${item.name}`}
                    className={actionBtn}
                  >
                    Eat
                  </button>
                ) : null}
                {storage !== undefined && onDepositItem ? (
                  <button
                    type="button"
                    onClick={() => onDepositItem(item.id)}
                    aria-label={`Deposit ${item.name} at ${storage.label}`}
                    className={actionBtn}
                  >
                    Deposit
                  </button>
                ) : null}
                {onDropItem ? (
                  <button
                    type="button"
                    onClick={() => onDropItem(item.id)}
                    aria-label={`Drop ${item.name}`}
                    className={actionBtn}
                  >
                    Drop
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {storage !== undefined ? (
        <>
          <VineDivider className="mb-2 mt-3" />
          <h3 className={'text-base font-semibold ' + t.heading}>
            Home storage — {storage.label}
          </h3>
          {storage.capacityText ? (
            <p className={'mb-2 text-sm ' + t.muted}>
              {storage.capacityText}
            </p>
          ) : null}
          {storage.items.length === 0 ? (
            <p className={'italic ' + t.muted}>Nothing stored here yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {storage.items.map((item) => (
                <li key={item.id} className="flex items-center gap-1">
                  <span className="flex flex-1 items-baseline justify-between gap-2 rounded px-2 py-1 text-left">
                    <span className="flex items-center gap-1.5">
                      {item.icon ? (
                        <span className="inline-flex shrink-0">
                          {item.icon}
                        </span>
                      ) : null}
                      {item.name}
                    </span>
                    {item.quantityText ? (
                      <span className="text-sm text-stone-300">
                        {item.quantityText}
                      </span>
                    ) : null}
                  </span>
                  {storage.onWithdrawItem ? (
                    <button
                      type="button"
                      onClick={() => storage.onWithdrawItem?.(item.id)}
                      aria-label={`Withdraw ${item.name} from ${storage.label}`}
                      className={actionBtn}
                    >
                      Withdraw
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {storage.note ? (
            <p className="mt-1 text-xs text-red-300">{storage.note}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
