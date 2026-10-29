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
 * the personal rows above, gated by onDepositItem — and since
 * 2026-10-29 a destination line at the top of the personal
 * list names the house they deposit into (Adam found the
 * buttons unreadable without it). The caller owns both
 * inventories; this panel never moves anything itself.
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

/** One worn-gear section in the portrait strip (caller-supplied display text). */
export interface InventoryWornSection {
  /** Section title: "Clothing", "Storage", or "Tools". */
  title: string;
  /** Display lines, e.g. "Cloak — worn, +6 lb". */
  entries: string[];
}

/** One kind in the Inventory modal's nearby-pile section. */
export interface InventoryNearbyPileKind {
  /** Item id (kind key for take actions). */
  id: string;
  /** Display name. */
  name: string;
  /** Quantity in the pile. */
  pileQuantity: number;
  /** Quantity carried. */
  carriedQuantity: number;
}

/** The nearest in-range pile for the modal's pickup section. */
export interface InventoryNearbyPile {
  kinds: InventoryNearbyPileKind[];
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
   * Item ids that can be lit (unlit torches). Items in this
   * set gain a Light button. Omitted = no Light buttons;
   * lighting itself is the caller's job.
   */
  lightableIds?: ReadonlySet<string>;
  /** Called when the player presses Light on an item. Optional. */
  onLightItem?: (id: string) => void;
  /**
   * Home-storage section, shown when the caller opens one
   * (sheltered at a placed house). Omitted = personal list
   * only, no Deposit buttons.
   */
  storage?: InventoryStorageSection;
  /** Called when the player presses Deposit on a carried item. */
  onDepositItem?: (id: string) => void;
  /**
   * Called when the player presses Drop-one on a carried item.
   * Every personal row gains a ↓ button when this is
   * passed; storage rows never get one (dropping is from
   * the pack she carries, not the house store). Dropping
   * itself is the caller's job.
   */
  onDropItem?: (id: string) => void;
  /**
   * Called when the player presses Drop-all on a carried item.
   * Every personal row gains a ↓↓ button when this is
   * passed (same feet destination as ↓, whole carried
   * stack). Dropping itself is the caller's job.
   */
  onDropAllItem?: (id: string) => void;
  /**
   * Nearby pile for the pickup section, shown after the
   * personal rows when present (nearest in-range pile,
   * caller-derived). Its kinds gain ↑/↑↑ buttons via
   * onTakeItem. Omitted = no pickup section. Worn-gear
   * kinds are NOT filtered here — pile Take is recovery.
   */
  nearbyPile?: InventoryNearbyPile;
  /**
   * Called when the player presses a Take arrow on a
   * nearby-pile kind: quantity 1 (↑) or 'all' (↑↑, the
   * live pile quantity). Taking itself is the caller's job.
   */
  onTakeItem?: (id: string, quantity: 1 | 'all') => void;
  /**
   * Worn-gear strip, shown directly under the portrait and
   * above the Carrying line (Adam, 2026-10-28): the worn
   * clothing, carried storage gear, and owned tool, as
   * caller-composed display sections. These items are NOT
   * in `items` (the caller filters them out), so they carry
   * no Drop or Deposit button anywhere — display only.
   * Omitted or empty = no strip.
   */
  worn?: InventoryWornSection[];
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
  lightableIds,
  onLightItem,
  storage,
  onDepositItem,
  onDropItem,
  onDropAllItem,
  nearbyPile,
  onTakeItem,
  worn,
  capacityText,
  onClose,
  comfortable = false,
  theme = 'mire',
}: InventoryPanelProps) {
  const t = UI_THEMES[theme];
  const actionBtn = comfortable
    ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
    : 'rounded bg-moss-deep px-2 py-1 text-xs hover:bg-moss';
  const closeBtn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
    : 'rounded px-2 py-1 text-sm ' + t.button;
  return (
    <section aria-label="Inventory" className={'rounded-2xl p-3 ' + t.panel}>
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

      {/* Worn gear, directly under the portrait: one wrapping
          line per section, display only — no buttons here. */}
      {worn !== undefined &&
      worn.some((section) => section.entries.length > 0) ? (
        <div className="mb-2 flex flex-col gap-0.5">
          {worn
            .filter((section) => section.entries.length > 0)
            .map((section) => (
              <p key={section.title} className="text-sm">
                <span className={t.muted}>{section.title}: </span>
                {section.entries.join(' · ')}
              </p>
            ))}
        </div>
      ) : null}

      {capacityText ? (
        <p className={'mb-2 text-sm ' + t.muted}>{capacityText}</p>
      ) : null}
      <p className={'mb-2 text-xs ' + t.muted}>
        ↓ Drop one at feet · ↓↓ Drop all at feet · ↑ Take one from pile · ↑↑
        Take all from pile
      </p>
      {/* Deposit destination (Adam, 2026-10-29 — the buttons
        appeared beside a plant outdoors and the destination
        read nowhere near them): while home storage is open,
        state where Deposit goes at the TOP of the list, with
        the legend. The section header far below names the
        same house (storage.label); this line exists so the
        rows carrying the buttons say it too. Unsheltered =
        no storage prop = no line, no buttons, as before. */}
      {storage !== undefined ? (
        <p className={'mb-2 text-xs ' + t.muted}>
          Home storage — {storage.label}. Deposit stores one there.
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className={'italic ' + t.muted}>Nothing carried yet.</p>
      ) : (
        // Row layout (narrow-width fix, 2026-10-29 — Adam's
        // screenshot: descriptors wrapped one word per line
        // and the meta line printed OVER the descriptor):
        // the old single-line 3-column subgrid (name+note |
        // nowrap meta | button cluster) starves the text
        // column at phone width — meta ~170 px + touch
        // buttons ~150 px + padding leave the name column
        // a sliver, and the overflowing centered meta
        // overprints the note. Below sm the row STACKS in
        // normal flow (name+note full width, meta on its
        // own line, buttons on their own line — overlap is
        // impossible); at sm and up the original 3-column
        // grid returns unchanged. All three lists in this
        // panel (personal, pile, storage) share the shape
        // and the fix.
        <ul className="flex flex-col gap-y-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-2 sm:gap-y-1">
          {items.map((item) => {
            const selected = item.id === selectedItemId;
            const placeable = placeableIds?.has(item.id) ?? false;
            const food = foodIds?.has(item.id) ?? false;
            return (
              <li
                key={item.id}
                className="flex flex-col gap-y-1 sm:col-span-3 sm:grid sm:grid-cols-subgrid sm:items-center"
              >
                <button
                  type="button"
                  onClick={() => onSelectItem?.(item.id)}
                  aria-pressed={selected}
                  className={
                    'rounded px-2 py-1 text-left ' +
                    (selected ? t.selected : 'hover:bg-stone-800')
                  }
                >
                  <span className="flex items-center gap-1.5">
                    {item.icon ? (
                      <span className="inline-flex shrink-0">{item.icon}</span>
                    ) : null}
                    <span className="min-w-0">{item.name}</span>
                  </span>
                  {item.note ? (
                    <span className={'block text-sm ' + t.muted}>
                      {item.note}
                    </span>
                  ) : null}
                </button>
                <span className="whitespace-nowrap text-left text-sm tabular-nums text-stone-300 sm:text-right">
                  {[item.quantityText, item.weightText]
                    .filter(
                      (part): part is string =>
                        part !== undefined && part !== '',
                    )
                    .join(' · ')}
                </span>
                <span className="flex gap-1">
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
                {(lightableIds?.has(item.id) ?? false) && onLightItem ? (
                  <button
                    type="button"
                    onClick={() => onLightItem(item.id)}
                    aria-label={`Light ${item.name}`}
                    className={actionBtn}
                  >
                    Light
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
                    aria-label={`Drop one ${item.name} at feet`}
                    className="min-h-[44px] min-w-[44px] rounded text-base hover:bg-stone-800"
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                ) : null}
                {onDropAllItem ? (
                  <button
                    type="button"
                    onClick={() => onDropAllItem(item.id)}
                    aria-label={`Drop all ${item.name} at feet`}
                    className="min-h-[44px] min-w-[44px] rounded text-base hover:bg-stone-800"
                  >
                    <span aria-hidden="true">↓↓</span>
                  </button>
                ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {nearbyPile !== undefined && nearbyPile.kinds.length > 0 ? (
        <>
          <VineDivider className="mb-2 mt-3" />
          <h3 className={'text-base font-semibold ' + t.heading}>
            Nearby pile
          </h3>
          <ul className="flex flex-col gap-y-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-2 sm:gap-y-1">
            {nearbyPile.kinds.map((kind) => (
              <li
                key={kind.id}
                className="flex flex-col gap-y-1 sm:col-span-3 sm:grid sm:grid-cols-subgrid sm:items-center"
              >
                <span className="rounded px-2 py-1 text-left text-sm">
                  {kind.name}
                </span>
                <span className="whitespace-nowrap text-left text-sm tabular-nums text-stone-300 sm:text-right">
                  pile ×{kind.pileQuantity} · carried ×{kind.carriedQuantity}
                </span>
                <span className="flex gap-1">
                {onTakeItem ? (
                  <button
                    type="button"
                    onClick={() => onTakeItem(kind.id, 1)}
                    aria-label={`Take one ${kind.name} from pile`}
                    className="min-h-[44px] min-w-[44px] rounded text-base hover:bg-stone-800"
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                ) : null}
                {onTakeItem ? (
                  <button
                    type="button"
                    onClick={() => onTakeItem(kind.id, 'all')}
                    aria-label={`Take all ${kind.name} from pile`}
                    className="min-h-[44px] min-w-[44px] rounded text-base hover:bg-stone-800"
                  >
                    <span aria-hidden="true">↑↑</span>
                  </button>
                ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
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
            <ul className="flex flex-col gap-y-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-2 sm:gap-y-1">
              {storage.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-y-1 sm:col-span-3 sm:grid sm:grid-cols-subgrid sm:items-center"
                >
                  <span className="rounded px-2 py-1 text-left">
                    <span className="flex items-center gap-1.5">
                      {item.icon ? (
                        <span className="inline-flex shrink-0">
                          {item.icon}
                        </span>
                      ) : null}
                      <span className="min-w-0">{item.name}</span>
                    </span>
                    {/* Row note, same block as the personal
                      rows (descriptor wiring, 2026-10-29):
                      storage rows carry notes by the same
                      rule, so they render them the same
                      way — before this, a stored item's
                      note had nowhere to show. */}
                    {item.note ? (
                      <span className={'block text-sm ' + t.muted}>
                        {item.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="whitespace-nowrap text-left text-sm tabular-nums text-stone-300 sm:text-right">
                    {item.quantityText ?? null}
                  </span>
                  <span className="flex gap-1">
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
                  </span>
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
