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
 *
 * SORTING (Adam, 2026-10-31): the personal list can render in
 * three orders — Recent (most recently gained first), Grouped
 * (by category, with heading rows), Alphabetical — plus a
 * Reverse flip of whichever order is active. The panel owns
 * the CONTROLS and the ordering arithmetic; every fact it
 * orders by is caller-supplied (the recency list, each item's
 * category, the category order), and the preference itself is
 * a caller-owned prop. The preference persists per-device in
 * the shared settings key (the font/look pattern — never in
 * the world save): loadInventorySort / saveInventorySort below.
 */

import type { ReactNode } from 'react';
import type { InventoryItem } from './types';
import { UI_THEMES, type UiThemeName } from './themes';
import { VineDivider } from './WitchyArt';
import { WitchPortrait } from './WitchPortrait';

/** The personal list's sort orders (labels DRAFT). */
export type InventorySortMode = 'recent' | 'grouped' | 'alpha';

export interface InventorySortPreference {
  mode: InventorySortMode;
  reversed: boolean;
}

export const INVENTORY_SORT_OPTIONS: Array<{
  id: InventorySortMode;
  label: string;
}> = [
  { id: 'recent', label: 'Recent' },
  { id: 'grouped', label: 'Grouped' },
  { id: 'alpha', label: 'Alphabetical' },
];

/** No stored choice reads as Recent, not reversed. */
export const DEFAULT_INVENTORY_SORT: InventorySortPreference = {
  mode: 'recent',
  reversed: false,
};

const SORT_SETTINGS_KEY = 'silent-earth-settings';
const SORT_MODES = new Set<string>(
  INVENTORY_SORT_OPTIONS.map((option) => option.id),
);

/** Read the stored sort preference; anything unreadable is the default. */
export function loadInventorySort(): InventorySortPreference {
  try {
    const raw = window.localStorage.getItem(SORT_SETTINGS_KEY);
    if (!raw) return DEFAULT_INVENTORY_SORT;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      return {
        mode:
          typeof record.inventorySortMode === 'string' &&
          SORT_MODES.has(record.inventorySortMode)
            ? (record.inventorySortMode as InventorySortMode)
            : DEFAULT_INVENTORY_SORT.mode,
        reversed:
          typeof record.inventorySortReversed === 'boolean'
            ? record.inventorySortReversed
            : DEFAULT_INVENTORY_SORT.reversed,
      };
    }
  } catch {
    // Corrupt or unavailable storage reads as the default.
  }
  return DEFAULT_INVENTORY_SORT;
}

/** Persist the sort preference (merge-write, the font/look pattern). */
export function saveInventorySort(pref: InventorySortPreference): void {
  try {
    let current: Record<string, unknown> = {};
    const raw = window.localStorage.getItem(SORT_SETTINGS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        current = parsed as Record<string, unknown>;
      }
    }
    window.localStorage.setItem(
      SORT_SETTINGS_KEY,
      JSON.stringify({
        ...current,
        inventorySortMode: pref.mode,
        inventorySortReversed: pref.reversed,
      }),
    );
  } catch {
    // Blocked storage: the choice applies for this session only.
  }
}

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
  /**
   * Sort preference for the personal list (sorting,
   * 2026-10-31). Omitted = no sort controls and the
   * incoming order, the pre-feature behavior.
   */
  sortMode?: InventorySortMode;
  /** Reverse flip of the active sort order. Default false. */
  sortReversed?: boolean;
  /** Called when the player changes the sort controls. Optional. */
  onSortChange?: (pref: InventorySortPreference) => void;
  /**
   * Held kinds, most recently gained first (caller-read
   * from the inventory's acquisition order). Kinds missing
   * from the list keep their incoming order after the
   * listed ones (legacy saves). Used by Recent.
   */
  recencyOrder?: readonly string[];
  /**
   * Category sequence for Grouped (caller-supplied from
   * the systems table); categories missing from it sort
   * after, and items carry their category on the item
   * itself (InventoryItem.category).
   */
  categoryOrder?: readonly string[];
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
  sortMode,
  sortReversed = false,
  onSortChange,
  recencyOrder,
  categoryOrder,
  onClose,
  comfortable = false,
  theme = 'mire',
}: InventoryPanelProps) {
  const t = UI_THEMES[theme];
  const actionBtn = comfortable
    ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
    : 'rounded bg-moss-deep px-2 py-1 text-xs hover:bg-moss';
  const sortBtn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] '
    : 'rounded px-2 py-1 text-sm ';
  // SORTING (2026-10-31): order the personal list from the
  // caller-supplied facts. No sortMode = incoming order
  // (the pre-feature behavior), and Reverse only ever
  // flips an active sort's flattened order — in Grouped
  // that reverses the groups and their contents together,
  // one honest definition with no special cases.
  const orderedItems = ((): InventoryItem[] => {
    if (sortMode === undefined) return items;
    const list = [...items];
    if (sortMode === 'recent') {
      const rank = new Map(
        (recencyOrder ?? []).map((id, index) => [id, index] as const),
      );
      // Stable sort: unlisted kinds (legacy) keep their
      // incoming order after every listed kind.
      list.sort(
        (a, b) =>
          (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
    } else if (sortMode === 'alpha') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const order = categoryOrder ?? [];
      const rankOf = (item: InventoryItem): number => {
        const index = order.indexOf(item.category ?? 'Other');
        return index === -1 ? order.length : index;
      };
      list.sort(
        (a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name),
      );
    }
    if (sortReversed) list.reverse();
    return list;
  })();
  const closeBtn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
    : 'rounded px-2 py-1 text-sm ' + t.button;
  // One personal row (extracted so the sorted render
  // below can interleave Grouped headings without a
  // second copy of the row shape).
  const renderPersonalRow = (item: InventoryItem): ReactNode => {
    const selected = item.id === selectedItemId;
    const placeable = placeableIds?.has(item.id) ?? false;
    const food = foodIds?.has(item.id) ?? false;
    return (
      <li
        key={item.id}
        className={
          'flex flex-col gap-y-1 @xl:col-span-3 @xl:grid @xl:grid-cols-subgrid @xl:items-center' +
          (item.note
            ? ' @xl:row-span-2 @xl:grid-rows-subgrid'
            : '')
        }
      >
        {/* Title row: name left, the one-line meta
          right on the SAME line, the descriptor
          unobstructed beneath (Adam's shape — see
          the row-layout comment above). */}
        <div className="flex flex-wrap items-center gap-x-2 @xl:contents">
          <button
            type="button"
            onClick={() => onSelectItem?.(item.id)}
            aria-pressed={selected}
            className={
              'min-w-[8ch] flex-1 rounded px-2 py-1 text-left @xl:col-start-1 @xl:row-start-1 ' +
              (item.note ? 'rounded-b-none ' : '') +
              (selected ? t.selected : 'hover:bg-stone-800')
            }
          >
            <span className="flex items-center gap-1.5">
              {item.icon ? (
                <span className="inline-flex shrink-0">{item.icon}</span>
              ) : null}
              <span className="min-w-0 truncate">{item.name}</span>
            </span>
          </button>
          <span className="whitespace-nowrap text-right text-sm tabular-nums text-stone-300 @max-[12rem]:whitespace-normal @max-[12rem]:text-left @xl:col-start-2 @xl:row-start-1">
            {item.titleMeta ??
              [item.quantityText, item.weightText]
                .filter(
                  (part): part is string =>
                    part !== undefined && part !== '',
                )
                .join(' · ')}
          </span>
        </div>
        {item.note ? (
          <span
            onClick={() => onSelectItem?.(item.id)}
            className={
              'block cursor-pointer rounded-b px-2 pb-1 text-sm @xl:col-start-1 @xl:row-start-2 ' +
              (selected ? t.selected + ' ' : '') +
              t.muted
            }
          >
            {item.note}
          </span>
        ) : null}
        <span className="flex flex-wrap gap-1 @xl:col-start-3 @xl:row-start-1">
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
  };
  // Personal rows in display order, with Grouped's
  // category headings interleaved when the category
  // changes (grouped mode only).
  const personalRows: ReactNode[] = [];
  orderedItems.forEach((item, index) => {
    if (sortMode === 'grouped') {
      const category = item.category ?? 'Other';
      const previous =
        index > 0 ? (orderedItems[index - 1].category ?? 'Other') : null;
      if (category !== previous) {
        personalRows.push(
          <li
            key={`category:${category}`}
            className={
              'pt-1 text-xs font-semibold uppercase tracking-wide @xl:col-span-3 ' +
              t.muted
            }
          >
            {category}
          </li>,
        );
      }
    }
    personalRows.push(renderPersonalRow(item));
  });
  return (
    <section aria-label="Inventory" className={'@container rounded-2xl p-3 ' + t.panel}>
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

      {/* Worn gear, directly under the portrait, display
          only — no buttons here. COLUMNATED (Adam,
          2026-10-29 — the header ran together as prose):
          each section is a small table — title as the
          heading, then one row per entry with the name
          left and its detail right. Entries arrive as
          "Name — detail" by construction in the caller
          (every section's entries use that one shape), so
          the split is a render rule, not new data; an
          entry with no separator renders as a name-only
          row. Wording is untouched — layout only. */}
      {worn !== undefined &&
      worn.some((section) => section.entries.length > 0) ? (
        <div className="mb-2 flex flex-col gap-2">
          {worn
            .filter((section) => section.entries.length > 0)
            .map((section) => (
              <div key={section.title}>
                <p className={'text-sm ' + t.muted}>{section.title}:</p>
                <ul className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
                  {section.entries.map((entry) => {
                    const splitAt = entry.indexOf(' — ');
                    const name =
                      splitAt >= 0 ? entry.slice(0, splitAt) : entry;
                    const detail =
                      splitAt >= 0 ? entry.slice(splitAt + 3) : null;
                    return (
                      <li
                        key={entry}
                        className="col-span-2 grid grid-cols-subgrid text-sm"
                      >
                        <span>{name}</span>
                        {detail !== null ? (
                          <span className="text-right tabular-nums">
                            {detail}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </div>
      ) : null}

      {/* Carrying total: its own row under the tables
          (same columnation) — the caller text is
          "Carrying <used> lb / <cap> lb"; the label and
          the figures split at the first space so the
          figures right-align with the bonuses above. A
          text that does not start with "Carrying" renders
          whole, as before. */}
      {capacityText ? (
        (() => {
          const match = /^Carrying\s+(.*)$/.exec(capacityText);
          return (
            <p className="mb-2 flex items-baseline justify-between gap-3 text-sm">
              <span className={t.muted}>
                {match ? 'Carrying' : capacityText}
              </span>
              {match ? (
                <span className="tabular-nums">{match[1]}</span>
              ) : null}
            </p>
          );
        })()
      ) : null}
      {/* Arrow legend as a 2×2 grid (Adam, 2026-10-29):
          Drop actions in one column pair, Take in the
          other, arrows in their own aligned cells so the
          eye pairs symbol → meaning without parsing a
          sentence. Wording exactly as the prose line read. */}
      <div
        className={
          'mb-2 grid grid-cols-[auto_1fr_auto_1fr] items-baseline gap-x-2 gap-y-0.5 text-xs ' +
          t.muted
        }
      >
        <span className="text-center">↓</span>
        <span>Drop one at feet</span>
        <span className="text-center">↑</span>
        <span>Take one from pile</span>
        <span className="text-center">↓↓</span>
        <span>Drop all at feet</span>
        <span className="text-center">↑↑</span>
        <span>Take all from pile</span>
      </div>
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

      {/* Sort controls (2026-10-31): a radio row + a
          Reverse checkbox, directly above the list they
          order. Rendered only when the caller wires the
          preference (onSortChange); labels DRAFT. */}
      {onSortChange ? (
        <div
          className="mb-2 flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Sort inventory"
        >
          {INVENTORY_SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={sortMode === option.id}
              onClick={() =>
                onSortChange({ mode: option.id, reversed: sortReversed })
              }
              className={
                sortBtn + (sortMode === option.id ? t.selected : t.button)
              }
            >
              {option.label}
            </button>
          ))}
          <label
            className={
              'ml-2 flex items-center gap-1 text-sm ' + t.muted
            }
          >
            <input
              type="checkbox"
              checked={sortReversed}
              onChange={(event) =>
                onSortChange({
                  mode: sortMode ?? DEFAULT_INVENTORY_SORT.mode,
                  reversed: event.target.checked,
                })
              }
            />
            Reverse
          </label>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className={'italic ' + t.muted}>Nothing carried yet.</p>
      ) : (
        // Row layout (narrow-width fix, 2026-10-29 — Adam's
        // screenshot: descriptors wrapped one word per line
        // and the meta line printed OVER the descriptor):
        // the single-line 3-column subgrid (name+note |
        // nowrap meta | button cluster) starves the text
        // column at phone width — meta + buttons + padding
        // leave the name column a sliver, and the note's
        // text paints out of its collapsed box over the
        // meta. The first fix stacked the row below the
        // sm VIEWPORT breakpoint — but the panel never
        // gets a viewport-sized box (desktop stack caps at
        // max-w-sm, the touch stack at 46vw), so the grid
        // still engaged inside ~360 px on every desktop
        // window and landscape phone and Adam hit the same
        // screenshot on the merged build. Now the switch
        // is keyed to the PANEL's own width: the section
        // is a CSS container (@container) and the grid
        // returns only at @xl (panel ≥ 36 rem, where meta
        // + the widest button cluster + a readable text
        // column genuinely fit — verified by measurement:
        // starved at 358/371 px containers, healthy at
        // 559). Below that the row STACKS.
        //
        // TITLE-ROW SHAPE (Adam, later the same day:
        // "Still could put the one liner next to the
        // item's title, get it out of the way"): in the
        // stack, the meta does NOT get a line of its own
        // — it rides the title row, name left (flexing,
        // truncating past a min-w stub), meta right,
        // nowrap; the descriptor takes the full width
        // beneath, unobstructed, and the buttons keep
        // their own row (flex-wrap, for the ~150 px
        // portrait touch column). If name + meta
        // genuinely can't share the title line, the
        // header wraps: the meta drops to its own line
        // UNDER the name, still above the descriptor —
        // it never spills into the descriptor's space.
        // At @xl the header div dissolves (@xl:contents)
        // and name / meta / buttons take their subgrid
        // columns on row 1 while the descriptor moves to
        // row 2 under the name (the li spans both rows) —
        // so the wide form's noted rows stand one
        // descriptor-line taller than the original
        // single-row grid, the one visible change there.
        // All three lists in this panel (personal, pile,
        // storage) share the shape and the fix.
        <ul className="flex flex-col gap-y-2 @xl:grid @xl:grid-cols-[minmax(0,1fr)_auto_auto] @xl:gap-x-2 @xl:gap-y-1">
          {personalRows}
        </ul>
      )}

      {nearbyPile !== undefined && nearbyPile.kinds.length > 0 ? (
        <>
          <VineDivider className="mb-2 mt-3" />
          <h3 className={'text-base font-semibold ' + t.heading}>
            Nearby pile
          </h3>
          <ul className="flex flex-col gap-y-2 @xl:grid @xl:grid-cols-[minmax(0,1fr)_auto_auto] @xl:gap-x-2 @xl:gap-y-1">
            {nearbyPile.kinds.map((kind) => (
              <li
                key={kind.id}
                className="flex flex-col gap-y-1 @xl:col-span-3 @xl:grid @xl:grid-cols-subgrid @xl:items-center"
              >
                <div className="flex flex-wrap items-center gap-x-2 @xl:contents">
                  <span className="min-w-[8ch] flex-1 truncate rounded px-2 py-1 text-left text-sm @xl:col-start-1 @xl:row-start-1">
                    {kind.name}
                  </span>
                  <span className="whitespace-nowrap text-right text-sm tabular-nums text-stone-300 @max-[12rem]:whitespace-normal @max-[12rem]:text-left @xl:col-start-2 @xl:row-start-1">
                    pile ×{kind.pileQuantity} · carried ×{kind.carriedQuantity}
                  </span>
                </div>
                <span className="flex flex-wrap gap-1 @xl:col-start-3 @xl:row-start-1">
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
            <ul className="flex flex-col gap-y-2 @xl:grid @xl:grid-cols-[minmax(0,1fr)_auto_auto] @xl:gap-x-2 @xl:gap-y-1">
              {storage.items.map((item) => (
                <li
                  key={item.id}
                  className={
                    'flex flex-col gap-y-1 @xl:col-span-3 @xl:grid @xl:grid-cols-subgrid @xl:items-center' +
                    (item.note
                      ? ' @xl:row-span-2 @xl:grid-rows-subgrid'
                      : '')
                  }
                >
                  <div className="flex flex-wrap items-center gap-x-2 @xl:contents">
                    <span className="min-w-[8ch] flex-1 rounded px-2 py-1 text-left @xl:col-start-1 @xl:row-start-1">
                      <span className="flex items-center gap-1.5">
                        {item.icon ? (
                          <span className="inline-flex shrink-0">
                            {item.icon}
                          </span>
                        ) : null}
                        <span className="min-w-0 truncate">{item.name}</span>
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-right text-sm tabular-nums text-stone-300 @max-[12rem]:whitespace-normal @max-[12rem]:text-left @xl:col-start-2 @xl:row-start-1">
                      {item.quantityText ?? null}
                    </span>
                  </div>
                  {/* Row note, same shape as the personal
                    rows (descriptor wiring, 2026-10-29):
                    storage rows carry notes by the same
                    rule, so they render them the same
                    way — full width beneath the title
                    row. */}
                  {item.note ? (
                    <span
                      className={
                        'block px-2 pb-1 text-sm @xl:col-start-1 @xl:row-start-2 ' +
                        t.muted
                      }
                    >
                      {item.note}
                    </span>
                  ) : null}
                  <span className="flex flex-wrap gap-1 @xl:col-start-3 @xl:row-start-1">
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
