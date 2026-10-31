/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — the ONE item-list surface
 * (Inventory Unification, Adam via DEV, 2026-10-31:
 * one inventory shape across her pack panel, the home
 * storage screen, and the pile modal — "aside from
 * whether they can drop and pick up, that should be
 * the only difference"). Presentation only (UI lane).
 *
 * Every item list in the game renders through this
 * component: the same row anatomy (title row with the
 * meta riding it, descriptor beneath, verb cluster),
 * the same grouping (by category, in the caller's
 * category order), the same three sort orders, the
 * same filter-as-you-type search, and the same folds
 * (a grouped heading collapses its category — the
 * class default is INDEPENDENT folds per instance).
 * The ONLY differences between lists are the verbs the
 * caller hangs on each row (Drop / Take / Store /
 * Deposit / Place / Eat / Light / Withdraw…) — verbs
 * are caller-supplied per item, and a press reports
 * (itemId, verbId) back; the surface owns no rules.
 *
 * SEARCH + FOLDS are per-instance presentation state:
 * the surface mounts fresh with its panel, so both
 * clear on close by construction; while a search is
 * active the folds are ignored (find-mode shows every
 * match, the CraftingMenu precedent). The SORT
 * preference is caller-owned and shared: one persisted
 * preference (per-device, the settings key — never the
 * world save) is passed to every instance, so a change
 * made in any list re-orders them all.
 *
 * DIGIT DISPATCH: when the caller asks (showKeyHints),
 * verbs are numbered in VISIBLE order (search-narrowed,
 * sorted, unfolded) up to 9, and the surface reports
 * that same flattened visible verb list upward
 * (onVisibleVerbs) so the caller's digit keys dispatch
 * exactly what the badges show — the list the player
 * sees is the list the digits hit.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { InventoryItem } from './types';
import { KEY_BADGE_CLASS, UI_THEMES, type UiThemeName } from './themes';

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

/** One verb on a row: a labelled button or a glyph button. */
export interface ItemListVerb {
  /** Caller-unique within the row (often the full action id). */
  id: string;
  /** Text label (Place / Eat / Withdraw…). Glyph wins when both are set. */
  label?: string;
  /** Glyph text (↑ ↑↑ ↓ ↓↓) for the arrow-family verbs. */
  glyph?: string;
  /** Spoken name for the button. */
  ariaLabel: string;
  /** Caller-decided unavailability. */
  disabled?: boolean;
}

/** One dispatchable verb in visible order (the digit list). */
export interface ItemListVisibleVerb {
  itemId: string;
  verbId: string;
  disabled: boolean;
}

export interface ItemListSurfaceProps {
  items: InventoryItem[];
  /** The verbs each row carries — the ONLY difference between lists. */
  verbsFor: (item: InventoryItem) => ItemListVerb[];
  /** A verb press: the row's item id + the verb's id. */
  onVerb: (itemId: string, verbId: string) => void;
  /** Id of the selected item, if the list has selection. */
  selectedItemId?: string;
  /**
   * When passed, a row's name is a selection button (the
   * personal list's shape); omitted, the name is plain
   * text (storage / pile rows).
   */
  onSelectItem?: (id: string) => void;
  /** Shared sort preference (caller-owned, persisted by the caller). */
  sortMode?: InventorySortMode;
  sortReversed?: boolean;
  onSortChange?: (pref: InventorySortPreference) => void;
  /** Recency facts for the Recent order (carried items only). */
  recencyOrder?: readonly string[];
  /** Category sequence for Grouped (caller-supplied). */
  categoryOrder?: readonly string[];
  /** Line shown when the list itself is empty. */
  emptyText: string;
  /** Search field label (names the list it searches). */
  searchLabel: string;
  /**
   * Number the verbs in visible order (cap 9) and report
   * the visible verb list upward for digit dispatch.
   */
  showKeyHints?: boolean;
  onVisibleVerbs?: (verbs: ItemListVisibleVerb[]) => void;
  /** Thumb-sized buttons (44 px targets) on touch. Default false. */
  comfortable?: boolean;
  /** Look for the surface. Default "mire". */
  theme?: UiThemeName;
}

export function ItemListSurface({
  items,
  verbsFor,
  onVerb,
  selectedItemId,
  onSelectItem,
  sortMode,
  sortReversed = false,
  onSortChange,
  recencyOrder,
  categoryOrder,
  emptyText,
  searchLabel,
  showKeyHints = false,
  onVisibleVerbs,
  comfortable = false,
  theme = 'mire',
}: ItemListSurfaceProps) {
  const t = UI_THEMES[theme];
  const actionBtn = comfortable
    ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
    : 'rounded bg-moss-deep px-2 py-1 text-xs hover:bg-moss';
  const glyphBtn =
    'relative min-h-[44px] min-w-[44px] rounded text-base disabled:cursor-not-allowed disabled:opacity-40 hover:bg-stone-800';
  const sortBtn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] '
    : 'rounded px-2 py-1 text-sm ';
  // SEARCH: the query narrows the list BEFORE any
  // ordering — sort modes and Grouped headings derive
  // over the narrowed set exactly as over the full one,
  // and every row keeps its verbs. Instance-local.
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const visibleItems = searching
    ? items.filter((item) => item.name.toLowerCase().includes(needle))
    : items;
  // FOLDS: collapsed category names (grouped mode),
  // instance-local; ignored while searching.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const toggleFold = (category: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };
  // ORDERING (the panel's standing arithmetic, moved
  // verbatim): no sortMode = incoming order; Reverse
  // flips the active sort's flattened order — in
  // Grouped that reverses groups and contents together.
  const orderedItems = ((): InventoryItem[] => {
    if (sortMode === undefined) return visibleItems;
    const list = [...visibleItems];
    if (sortMode === 'recent') {
      const rank = new Map(
        (recencyOrder ?? []).map((id, index) => [id, index] as const),
      );
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
  // VISIBLE ROWS + the digit list: folded-away rows are
  // not visible — no rendering, no badge, no dispatch.
  const isFoldedAway = (item: InventoryItem): boolean =>
    !searching &&
    sortMode === 'grouped' &&
    collapsed.has(item.category ?? 'Other');
  const shownItems = orderedItems.filter((item) => !isFoldedAway(item));
  const visibleVerbs: ItemListVisibleVerb[] = [];
  for (const item of shownItems) {
    for (const verb of verbsFor(item)) {
      visibleVerbs.push({
        itemId: item.id,
        verbId: verb.id,
        disabled: verb.disabled === true,
      });
    }
  }
  const visibleSignature = visibleVerbs
    .map((verb) => `${verb.itemId}|${verb.verbId}|${verb.disabled ? 1 : 0}`)
    .join(';');
  const reportedSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onVisibleVerbs) return;
    if (reportedSignatureRef.current === visibleSignature) return;
    reportedSignatureRef.current = visibleSignature;
    onVisibleVerbs(visibleVerbs);
    // visibleVerbs is recomputed per render; the
    // signature is the change signal, by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSignature, onVisibleVerbs]);
  // Badge numbers follow the visible verb order.
  let hintCount = 0;
  const nextHint = (): number | null => {
    hintCount += 1;
    return showKeyHints && hintCount <= 9 ? hintCount : null;
  };
  const renderRow = (item: InventoryItem): ReactNode => {
    const selected = item.id === selectedItemId;
    const nameInner = (
      <span className="flex items-center gap-1.5">
        {item.icon ? (
          <span className="inline-flex shrink-0">{item.icon}</span>
        ) : null}
        <span className="min-w-0 truncate">{item.name}</span>
      </span>
    );
    return (
      <li
        key={item.id}
        className={
          'flex flex-col gap-y-1 @xl:col-span-3 @xl:grid @xl:grid-cols-subgrid @xl:items-center' +
          (item.note ? ' @xl:row-span-2 @xl:grid-rows-subgrid' : '')
        }
      >
        <div className="flex flex-wrap items-center gap-x-2 @xl:contents">
          {onSelectItem ? (
            <button
              type="button"
              onClick={() => onSelectItem(item.id)}
              aria-pressed={selected}
              className={
                'min-w-[8ch] flex-1 rounded px-2 py-1 text-left @xl:col-start-1 @xl:row-start-1 ' +
                (item.note ? 'rounded-b-none ' : '') +
                (selected ? t.selected : 'hover:bg-stone-800')
              }
            >
              {nameInner}
            </button>
          ) : (
            <span className="min-w-[8ch] flex-1 rounded px-2 py-1 text-left @xl:col-start-1 @xl:row-start-1">
              {nameInner}
            </span>
          )}
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
            onClick={onSelectItem ? () => onSelectItem(item.id) : undefined}
            className={
              'block rounded-b px-2 pb-1 text-sm @xl:col-start-1 @xl:row-start-2 ' +
              (onSelectItem ? 'cursor-pointer ' : '') +
              (selected && onSelectItem ? t.selected + ' ' : '') +
              t.muted
            }
          >
            {item.note}
          </span>
        ) : null}
        <span className="flex flex-wrap gap-1 @xl:col-start-3 @xl:row-start-1">
          {verbsFor(item).map((verb) => {
            const hint = nextHint();
            if (verb.glyph) {
              return (
                <button
                  key={verb.id}
                  type="button"
                  disabled={verb.disabled}
                  onClick={() => onVerb(item.id, verb.id)}
                  aria-label={verb.ariaLabel}
                  className={glyphBtn}
                >
                  <span aria-hidden="true">{verb.glyph}</span>
                  {hint !== null ? (
                    <span
                      aria-hidden="true"
                      className={'absolute -right-1 -top-1 ' + KEY_BADGE_CLASS}
                    >
                      {hint}
                    </span>
                  ) : null}
                </button>
              );
            }
            return (
              <button
                key={verb.id}
                type="button"
                disabled={verb.disabled}
                onClick={() => onVerb(item.id, verb.id)}
                aria-label={verb.ariaLabel}
                className={actionBtn + ' disabled:cursor-not-allowed disabled:opacity-40'}
              >
                {verb.label}
                {hint !== null ? (
                  <span aria-hidden="true" className={'ml-1 ' + KEY_BADGE_CLASS}>
                    {hint}
                  </span>
                ) : null}
              </button>
            );
          })}
        </span>
      </li>
    );
  };
  // Rows in display order, with Grouped's category
  // headings interleaved — headings are FOLD TOGGLES:
  // a folded heading renders alone, its rows withheld.
  const rows: ReactNode[] = [];
  orderedItems.forEach((item, index) => {
    if (sortMode === 'grouped') {
      const category = item.category ?? 'Other';
      const previous =
        index > 0 ? (orderedItems[index - 1].category ?? 'Other') : null;
      if (category !== previous) {
        const folded = !searching && collapsed.has(category);
        rows.push(
          <li
            key={`category:${category}`}
            className="@xl:col-span-3"
          >
            <button
              type="button"
              aria-expanded={!folded}
              onClick={() => toggleFold(category)}
              className={
                'w-full pt-1 text-left text-xs font-semibold uppercase tracking-wide ' +
                t.muted
              }
            >
              <span aria-hidden="true">{folded ? '▸ ' : '▾ '}</span>
              {category}
            </button>
          </li>,
        );
      }
    }
    if (!isFoldedAway(item)) rows.push(renderRow(item));
  });
  return (
    <>
      {items.length > 0 ? (
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchLabel}
          aria-label={searchLabel}
          className={
            'mb-2 w-full rounded bg-stone-800/60 px-2 py-1 text-sm text-stone-100 placeholder:text-stone-400 ' +
            (comfortable ? 'min-h-[44px]' : '')
          }
        />
      ) : null}
      {onSortChange ? (
        <div
          className="mb-2 flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Sort items"
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
            className={'ml-2 flex items-center gap-1 text-sm ' + t.muted}
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
        <p className={'italic ' + t.muted}>{emptyText}</p>
      ) : searching && visibleItems.length === 0 ? (
        <p className={'italic ' + t.muted}>
          {`Nothing matches "${query.trim()}".`}
        </p>
      ) : (
        <ul className="flex flex-col gap-y-2 @xl:grid @xl:grid-cols-[minmax(0,1fr)_auto_auto] @xl:gap-x-2 @xl:gap-y-1">
          {rows}
        </ul>
      )}
    </>
  );
}
