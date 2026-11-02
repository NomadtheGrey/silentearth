/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — crafting menu, presentation only (UI lane).
 *
 * Shows the recipes a caller passes in. Craftability is a caller-decided
 * prop on each recipe — this menu never reads an inventory, never
 * checks ingredients, and never crafts anything itself. It only reports
 * the player's choice through `onCraft`.
 *
 * PLACEHOLDER-FRIENDLY: with no recipes, it says plainly that recipes
 * arrive from the Systems lane, instead of inventing a recipe list.
 *
 * FRAME (Adam via DEV, 2026-10-31 — the sharpened window ask):
 * the panel is a fixed frame with a moving middle. The header
 * (title, Close, station note) is PINNED; the section list
 * scrolls beneath it inside a region capped with the panel at
 * 70vh; the scrollbar ALWAYS wears its track, styled in the
 * stone palette, so the player can see there is more and
 * where they are in it. The menu owns this frame itself, so
 * every seat that renders it (the crafting dialog, plain or
 * on a stump's context) inherits the same behaviour — no
 * seat wraps its own clip around the menu.
 *
 * STATION ROWS + FILTER (Adam, 2026-10-31): a row whose
 * station want is unmet (caller-flagged stationUnmet) still
 * SHOWS — its availabilityNote names the want ('Needs a
 * loom.') in the row, so the station is discoverable
 * without poking around. The header's 'Craftable here'
 * checkbox (shown only when some row is unmet) filters
 * those rows out on the player's word; default shows them.
 *
 * SEARCH (Adam, 2026-10-31): a filter-as-you-type field in
 * the header narrows the rows by name — display-only: the
 * sections, their counts, and every row's actions are the
 * caller's, unchanged; the query only hides non-matches.
 * While a query stands, sections render EXPANDED (search
 * is a find-mode; a match never hides inside a collapsed
 * section). The query is menu-local presentation state —
 * the menu unmounts on close, so it clears itself. Typing
 * is safe because every key listener in the game already
 * yields to text entry (the seed-field precedent) — the
 * field needs no guard of its own. Station-name matching
 * ('loom' surfacing loom-made rows) is Adam's open call:
 * the recipe carries no station-name field (its want is
 * prose in availabilityNote), so if he approves it, the
 * caller supplies a station name per recipe and the one
 * match function below grows a second haystack.
 */

import { useState } from 'react';
import type { CraftingRecipe } from './types';
import { UI_THEMES, type UiThemeName } from './themes';
import { WitchMark } from './WitchyArt';

/**
 * 'Craftable here' filter preference (Adam, 2026-10-31):
 * per-device, stored on the shared settings key beside
 * the inventory sort — never in the world save. Default
 * FALSE: station-gated rows show (and name their want);
 * the filter is the player's choice, not the panel's.
 */
const CRAFT_FILTER_SETTINGS_KEY = 'silent-earth-settings';

function loadCraftStationFilter(): boolean {
  try {
    const raw = window.localStorage.getItem(CRAFT_FILTER_SETTINGS_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      return record.craftStationFilterOnly === true;
    }
  } catch {
    // Corrupt or unavailable storage reads as the default.
  }
  return false;
}

function saveCraftStationFilter(on: boolean): void {
  try {
    let current: Record<string, unknown> = {};
    const raw = window.localStorage.getItem(CRAFT_FILTER_SETTINGS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        current = parsed as Record<string, unknown>;
      }
    }
    window.localStorage.setItem(
      CRAFT_FILTER_SETTINGS_KEY,
      JSON.stringify({ ...current, craftStationFilterOnly: on }),
    );
  } catch {
    // Storage unavailable: the choice lasts the session.
  }
}

export interface CraftingMenuSection {
  title: string;
  recipes: CraftingRecipe[];
}

export interface CraftingMenuProps {
  recipes: CraftingRecipe[];
  /**
   * Optional sections to group the recipes under headings in one
   * scroll (no tabs). When provided, the menu renders these
   * sections (skipping any with no recipes) instead of the flat
   * list; `recipes` still feeds the empty state. The caller owns
   * the grouping — this menu never invents one. Sections render
   * as a collapsed-by-default ACCORDION (Adam, 2026-10-26):
   * all headers visible, none open on entry; tapping a header
   * expands it and collapses any other open section (one open
   * at a time); each header carries its readiness count
   * ("{title} — {craftable} of {total} craftable", computed
   * from the recipes' existing canCraft flags) so a collapsed
   * section hides nothing important.
   */
  sections?: CraftingMenuSection[];
  /** Caller-supplied nearby-stations line, e.g. "Nearby stations: workstation, loom". */
  stationNote?: string;
  /** Id of the selected recipe, if any. Undefined = nothing selected. */
  selectedRecipeId?: string;
  /** Called when the player picks a recipe. Optional. */
  onSelectRecipe?: (id: string) => void;
  /** Called when the player asks to craft the selected recipe. Optional. */
  onCraft?: (id: string) => void;
  /**
   * Called when a row's chain-craft button is pressed
   * (prerequisite crafting, Adam 2026-10-31): craft the
   * ingredient item (and whatever IT needs) without leaving
   * the open recipe. The button renders only on rows the
   * caller flagged chainCraftable with an itemId. Optional.
   */
  onCraftPrerequisite?: (recipeId: string, itemId: string) => void;
  /** Called when the menu is closed. Optional. */
  onClose?: () => void;
  /**
   * ITEM INFO CARD (2026-11-01): a row's info affordance
   * opens the card for the recipe's OUTPUT item
   * (recipe.outputItemId). The menu renders no facts.
   * Omitted = no affordance.
   */
  onInfoItem?: (itemId: string) => void;
  /** Thumb-sized action buttons (44 px targets) on touch. Default false. */
  comfortable?: boolean;
  /** Look for the menu. Default "hearth" (firelit making). */
  theme?: UiThemeName;
}

export function CraftingMenu({
  recipes,
  sections,
  stationNote,
  selectedRecipeId,
  onSelectRecipe,
  onCraft,
  onCraftPrerequisite,
  onInfoItem,
  onClose,
  comfortable = false,
  theme = 'hearth',
}: CraftingMenuProps) {
  const t = UI_THEMES[theme];
  // ACCORDION state (presentation only, menu-internal): which
  // section is open, if any. null = all collapsed, which is the
  // entry state — the menu remounts when reopened, so every
  // entry starts collapsed. The caller never manages this.
  const [openSection, setOpenSection] = useState<string | null>(null);
  // 'CRAFTABLE HERE' FILTER (Adam, 2026-10-31): when on,
  // rows whose station want is unmet (caller-flagged
  // stationUnmet) leave the list; ingredient-short rows
  // are never filtered on their own. Menu-local state,
  // per-device persisted (helpers above); default off.
  const [stationFilterOnly, setStationFilterOnly] = useState<boolean>(
    () => loadCraftStationFilter(),
  );
  const handleStationFilterChange = (on: boolean) => {
    setStationFilterOnly(on);
    saveCraftStationFilter(on);
  };
  // SEARCH state (see the header): the raw field text;
  // `searching` is its trimmed, non-empty reading, and
  // the needle is what rows match against. Menu-local —
  // nothing persists, nothing is reported upward.
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const matchesQuery = (recipe: CraftingRecipe): boolean =>
    !searching || recipe.name.toLowerCase().includes(needle);
  const closeBtn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
    : 'rounded px-2 py-1 text-sm ' + t.button;
  const craftBtn = comfortable
    ? 'mt-2 rounded px-3 py-2 text-sm min-h-[44px] disabled:cursor-not-allowed disabled:opacity-40 ' +
      t.primary
    : 'mt-2 rounded px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40 ' +
      t.primary;
  // One row renderer shared by the flat list and the sectioned
  // list, so grouping changes layout only, never row content.
  const renderRecipe = (recipe: CraftingRecipe) => {
    const selected = recipe.id === selectedRecipeId;
    return (
      <li
        key={recipe.id}
        className={
          'rounded px-2 py-2 ' +
          (selected ? t.selected : 'bg-stone-800/60')
        }
      >
        <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => onSelectRecipe?.(recipe.id)}
          aria-pressed={selected}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex items-center gap-1.5 font-medium">
            {recipe.icon ? (
              <span className="inline-flex shrink-0">{recipe.icon}</span>
            ) : null}
            {recipe.name}
          </span>
          {recipe.description ? (
            <span className="mt-1 block text-sm text-stone-300">
              {recipe.description}
            </span>
          ) : null}
          {recipe.ladderLine ? (
            <span className={'mt-0.5 block text-sm ' + t.muted}>
              {recipe.ladderLine}
            </span>
          ) : null}
        </button>
        {onInfoItem && recipe.outputItemId ? (
          <button
            type="button"
            onClick={() => onInfoItem(recipe.outputItemId as string)}
            aria-label={`About ${recipe.outputItemName ?? recipe.name}`}
            className="min-h-[44px] min-w-[44px] shrink-0 rounded text-base hover:bg-stone-800"
          >
            <span aria-hidden="true">ⓘ</span>
          </button>
        ) : null}
        </div>
        {recipe.disabledLabel ? (
          <p className={'mt-1 block text-sm ' + t.muted}>
            {recipe.disabledLabel}
          </p>
        ) : null}
        <ul className="mt-1 flex flex-col gap-0.5 text-sm text-stone-300">
          {recipe.ingredients.map((ingredient, index) => {
            // Chain-craft button (prerequisite crafting, Adam
            // 2026-10-31): rendered only when the caller flagged
            // the row chainCraftable and supplied the item id +
            // the handler. The press reports (recipe, item) —
            // the menu crafts nothing itself, and the open
            // recipe stays open (the caller runs the chain).
            const chainItemId =
              ingredient.chainCraftable && onCraftPrerequisite
                ? ingredient.itemId
                : undefined;
            return (
              <li key={index} className="flex items-center gap-1.5">
                {ingredient.icon ? (
                  <span className="inline-flex shrink-0">
                    {ingredient.icon}
                  </span>
                ) : null}
                {ingredient.name}
                {ingredient.amountText ? (
                  <span className={'ml-2 ' + t.muted}>
                    {ingredient.amountText}
                  </span>
                ) : null}
                {chainItemId ? (
                  <button
                    type="button"
                    onClick={() =>
                      onCraftPrerequisite(recipe.id, chainItemId)
                    }
                    aria-label={`Craft ${ingredient.name}`}
                    className={
                      'ml-auto shrink-0 rounded text-sm ' +
                      (comfortable
                        ? 'px-3 py-2 min-h-[44px] '
                        : 'px-2 py-1 ') +
                      t.button
                    }
                  >
                    Craft
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {recipe.availabilityNote && !recipe.disabledLabel ? (
          <p className={'mt-1 text-sm ' + t.muted}>
            {recipe.availabilityNote}
          </p>
        ) : null}
        <button
          type="button"
          disabled={!recipe.canCraft}
          onClick={() => onCraft?.(recipe.id)}
          className={craftBtn}
        >
          Craft
        </button>
      </li>
    );
  };
  // Sections, when provided, skip their empty groups; the flat
  // list is the fallback when no sections are passed. The
  // station filter (above) applies to both shapes before
  // either renders, so section counts read the filtered set.
  const anyStationUnmet = (
    sections !== undefined
      ? sections.flatMap((section) => section.recipes)
      : recipes
  ).some((recipe) => recipe.stationUnmet);
  const keepRecipe = (recipe: CraftingRecipe) =>
    (!stationFilterOnly || !recipe.stationUnmet) && matchesQuery(recipe);
  const shownSections = (sections ?? [])
    .map((section) => ({
      ...section,
      recipes: section.recipes.filter(keepRecipe),
    }))
    .filter((section) => section.recipes.length > 0);
  const shownRecipes = recipes.filter(keepRecipe);
  const isEmpty =
    sections !== undefined
      ? shownSections.length === 0
      : shownRecipes.length === 0;
  return (
    <section
      aria-label="Crafting"
      className={
        // Touch dialogs take the screen (Adam, 2026-11-01):
        // the comfortable (touch) cap rises with the sheet
        // to 92dvh so the recipe list is not clipped inside
        // a taller sheet; desktop keeps its 70vh cap.
        (comfortable
          ? 'flex max-h-[92dvh] flex-col rounded-2xl p-3 '
          : 'flex max-h-[70vh] flex-col rounded-2xl p-3 ') + t.panel
      }
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2
          className={'flex items-center gap-2 text-base font-semibold ' + t.heading}
        >
          <WitchMark />
          Crafting
        </h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close crafting menu"
            className={closeBtn}
          >
            Close [X]
          </button>
        ) : null}
      </div>

      {stationNote ? (
        <p className={'mb-2 text-sm ' + t.muted}>{stationNote}</p>
      ) : null}

      {/* Search field + the 'Craftable here' filter share
          one header row (search, 2026-10-31): the field
          grows, the checkbox keeps its conditional seat at
          the row's right. The field renders only when
          there is anything to search. */}
      {recipes.length > 0 || anyStationUnmet ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {recipes.length > 0 ? (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes"
              aria-label="Search recipes"
              className={
                'min-w-[10rem] flex-1 rounded bg-stone-800/60 px-2 py-1 text-sm text-stone-100 placeholder:text-stone-400 ' +
                (comfortable ? 'min-h-[44px]' : '')
              }
            />
          ) : null}
          {anyStationUnmet ? (
            <label
              className={
                'flex cursor-pointer items-center gap-2 text-sm ' + t.muted
              }
            >
              <input
                type="checkbox"
                checked={stationFilterOnly}
                onChange={(e) => handleStationFilterChange(e.target.checked)}
                className="h-5 w-5 shrink-0"
              />
              Craftable here
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 overflow-y-scroll pr-1 [scrollbar-color:#78716c_#1c1917] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-500 [&::-webkit-scrollbar-track]:bg-stone-900">
      {isEmpty ? (
        <p className={'italic ' + t.muted}>
          {searching
            ? `Nothing matches "${query.trim()}".`
            : stationFilterOnly && anyStationUnmet
              ? 'Nothing here is craftable at hand — every recipe wants a station elsewhere.'
              : 'No recipes yet — recipes arrive from the Systems lane.'}
        </p>
      ) : sections !== undefined ? (
        <div className="flex flex-col gap-4">
          {shownSections.map((section) => {
            // SEARCH find-mode: a standing query opens every
            // section — a match never hides inside a collapsed
            // one. The accordion state itself is untouched and
            // resumes when the query clears.
            const open = searching || openSection === section.title;
            const craftable = section.recipes.filter(
              (recipe) => recipe.canCraft,
            ).length;
            return (
              <div key={section.title}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() =>
                    setOpenSection((current) =>
                      current === section.title ? null : section.title,
                    )
                  }
                  className={
                    'flex w-full items-center justify-between gap-2 text-left text-sm font-semibold ' +
                    t.heading +
                    (comfortable ? ' min-h-[44px]' : '')
                  }
                >
                  <span>
                    {section.title} — {craftable} of{' '}
                    {section.recipes.length} craftable
                  </span>
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
                {open ? (
                  <ul className="mt-1 flex flex-col gap-2">
                    {section.recipes.map(renderRecipe)}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">{shownRecipes.map(renderRecipe)}</ul>
      )}
      </div>
    </section>
  );
}
