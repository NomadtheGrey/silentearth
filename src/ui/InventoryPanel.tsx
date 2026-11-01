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
 * THE LISTS (Inventory Unification, Adam via DEV,
 * 2026-10-31): every list in this panel — the personal
 * list, the home-storage section, the nearby-pile
 * section — renders through the shared ItemListSurface
 * (see its header): one row anatomy, one grouping, one
 * sort, one search, one fold, the caller's ONE
 * persisted sort preference passed to all three. The
 * only differences are the verbs each list's rows
 * carry (Place / Eat / Light / Deposit / Drop on hers;
 * Withdraw in the store; Take at the pile), composed
 * here from the panel's standing props and dispatched
 * back out through them — no handler changed. The
 * sort/search/fold machinery itself lives in the
 * surface now; this file keeps the panel's chrome
 * (portrait, worn strip, carrying line, legend,
 * deposit destination) and the section frames.
 */

import type { InventoryItem } from './types';
import { UI_THEMES, type UiThemeName } from './themes';
import { VineDivider } from './WitchyArt';
import { WitchPortrait } from './WitchPortrait';
import {
  ItemListSurface,
  type InventorySortMode,
  type InventorySortPreference,
  type ItemListVerb,
} from './ItemListSurface';

export {
  loadInventorySort,
  saveInventorySort,
  DEFAULT_INVENTORY_SORT,
  INVENTORY_SORT_OPTIONS,
} from './ItemListSurface';
export type {
  InventorySortMode,
  InventorySortPreference,
} from './ItemListSurface';

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
   * Item ids that can be read (her books). Items in this
   * set gain a Read button. Omitted = no Read buttons;
   * what reading opens is the caller's job.
   */
  readableIds?: ReadonlySet<string>;
  /** Called when the player presses Read on an item. Optional. */
  onReadItem?: (id: string) => void;
  /** The jar build: rows whose item carries a Dump verb (the water-jar), and its press. */
  dumpableIds?: ReadonlySet<string>;
  onDumpItem?: (id: string) => void;
  /**
   * The shrew's wake door: rows whose item carries a
   * Wake verb (the found shrew skull), and its press.
   * The caller owns the grant; this layer only reports.
   */
  wakeableIds?: ReadonlySet<string>;
  onWakeItem?: (id: string) => void;
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
   * caller-derived AS ITEM ROWS — the unified shape: the
   * caller composes name, category, and the counts line).
   * Its rows gain ↑/↑↑ verbs via onTakeItem. Omitted =
   * no pickup section. Worn-gear kinds are NOT filtered
   * here — pile Take is recovery.
   */
  nearbyPileItems?: InventoryItem[];
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
   * The ONE sort preference, shared by every list in the
   * panel (unification): the caller's persisted choice.
   */
  sortMode?: InventorySortMode;
  /** Reverse flip of the active sort order. Default false. */
  sortReversed?: boolean;
  /** Called when the player changes any list's sort controls. */
  onSortChange?: (pref: InventorySortPreference) => void;
  /**
   * Held kinds, most recently gained first (caller-read
   * from the inventory's acquisition order). Kinds missing
   * from the list keep their incoming order after the
   * listed ones (legacy saves). Used by Recent (personal
   * list only — the store and the pile have no recency).
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
  readableIds,
  onReadItem,
  dumpableIds,
  onDumpItem,
  wakeableIds,
  onWakeItem,
  storage,
  onDepositItem,
  onDropItem,
  onDropAllItem,
  nearbyPileItems,
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
  const closeBtn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
    : 'rounded px-2 py-1 text-sm ' + t.button;
  // THE PERSONAL VERBS (the standing row rules, composed
  // for the surface): Place / Eat / Light by id set,
  // Deposit while a home store is open, Drop arrows
  // always (when wired). Aria labels verbatim.
  const personalVerbsFor = (item: InventoryItem): ItemListVerb[] => {
    const verbs: ItemListVerb[] = [];
    if ((placeableIds?.has(item.id) ?? false) && onPlaceItem) {
      verbs.push({ id: 'place', label: 'Place', ariaLabel: `Place ${item.name}` });
    }
    if ((foodIds?.has(item.id) ?? false) && onEatItem) {
      verbs.push({ id: 'eat', label: 'Eat', ariaLabel: `Eat ${item.name}` });
    }
    if ((lightableIds?.has(item.id) ?? false) && onLightItem) {
      verbs.push({ id: 'light', label: 'Light', ariaLabel: `Light ${item.name}` });
    }
    if ((readableIds?.has(item.id) ?? false) && onReadItem) {
      verbs.push({ id: 'read', label: 'Read', ariaLabel: `Read ${item.name}` });
    }
    if ((dumpableIds?.has(item.id) ?? false) && onDumpItem) {
      verbs.push({ id: 'dump', label: 'Dump', ariaLabel: `Dump ${item.name}` });
    }
    if ((wakeableIds?.has(item.id) ?? false) && onWakeItem) {
      verbs.push({ id: 'wake', label: 'Wake', ariaLabel: `Wake ${item.name}` });
    }
    if (storage !== undefined && onDepositItem) {
      verbs.push({
        id: 'deposit',
        label: 'Deposit',
        ariaLabel: `Deposit ${item.name} at ${storage.label}`,
      });
    }
    if (onDropItem) {
      verbs.push({
        id: 'drop-one',
        glyph: '↓',
        ariaLabel: `Drop one ${item.name} at feet`,
      });
    }
    if (onDropAllItem) {
      verbs.push({
        id: 'drop-all',
        glyph: '↓↓',
        ariaLabel: `Drop all ${item.name} at feet`,
      });
    }
    return verbs;
  };
  const handlePersonalVerb = (itemId: string, verbId: string): void => {
    if (verbId === 'place') onPlaceItem?.(itemId);
    else if (verbId === 'eat') onEatItem?.(itemId);
    else if (verbId === 'light') onLightItem?.(itemId);
    else if (verbId === 'read') onReadItem?.(itemId);
    else if (verbId === 'dump') onDumpItem?.(itemId);
    else if (verbId === 'wake') onWakeItem?.(itemId);
    else if (verbId === 'deposit') onDepositItem?.(itemId);
    else if (verbId === 'drop-one') onDropItem?.(itemId);
    else if (verbId === 'drop-all') onDropAllItem?.(itemId);
  };
  const storageVerbsFor = (item: InventoryItem): ItemListVerb[] =>
    storage?.onWithdrawItem
      ? [
          {
            id: 'withdraw',
            label: 'Withdraw',
            ariaLabel: `Withdraw ${item.name} from ${storage.label}`,
          },
        ]
      : [];
  const nearbyVerbsFor = (item: InventoryItem): ItemListVerb[] =>
    onTakeItem
      ? [
          {
            id: 'take-one',
            glyph: '↑',
            ariaLabel: `Take one ${item.name} from pile`,
          },
          {
            id: 'take-all',
            glyph: '↑↑',
            ariaLabel: `Take all ${item.name} from pile`,
          },
        ]
      : [];
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
            Close [X]
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

      <ItemListSurface
        items={items}
        verbsFor={personalVerbsFor}
        onVerb={handlePersonalVerb}
        selectedItemId={selectedItemId}
        onSelectItem={onSelectItem}
        sortMode={sortMode}
        sortReversed={sortReversed}
        onSortChange={onSortChange}
        recencyOrder={recencyOrder}
        categoryOrder={categoryOrder}
        emptyText="Nothing carried yet."
        searchLabel="Search items"
        comfortable={comfortable}
        theme={theme}
      />

      {nearbyPileItems !== undefined && nearbyPileItems.length > 0 ? (
        <>
          <VineDivider className="mb-2 mt-3" />
          <h3 className={'text-base font-semibold ' + t.heading}>
            Nearby pile
          </h3>
          <ItemListSurface
            items={nearbyPileItems}
            verbsFor={nearbyVerbsFor}
            onVerb={(itemId, verbId) =>
              onTakeItem?.(itemId, verbId === 'take-all' ? 'all' : 1)
            }
            sortMode={sortMode}
            sortReversed={sortReversed}
            onSortChange={onSortChange}
            categoryOrder={categoryOrder}
            emptyText="Nothing in the pile."
            searchLabel="Search pile items"
            comfortable={comfortable}
            theme={theme}
          />
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
          <ItemListSurface
            items={storage.items}
            verbsFor={storageVerbsFor}
            onVerb={(itemId) => storage.onWithdrawItem?.(itemId)}
            sortMode={sortMode}
            sortReversed={sortReversed}
            onSortChange={onSortChange}
            categoryOrder={categoryOrder}
            emptyText="Nothing stored here yet."
            searchLabel="Search stored items"
            comfortable={comfortable}
            theme={theme}
          />
          {storage.note ? (
            <p className="mt-1 text-xs text-red-300">{storage.note}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
