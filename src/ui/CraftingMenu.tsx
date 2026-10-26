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
 */

import type { CraftingRecipe } from './types';
import { UI_THEMES, type UiThemeName } from './themes';
import { WitchMark } from './WitchyArt';

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
   * the grouping — this menu never invents one.
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
  /** Called when the menu is closed. Optional. */
  onClose?: () => void;
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
  onClose,
  comfortable = false,
  theme = 'hearth',
}: CraftingMenuProps) {
  const t = UI_THEMES[theme];
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
        <button
          type="button"
          onClick={() => onSelectRecipe?.(recipe.id)}
          aria-pressed={selected}
          className="w-full text-left"
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
        </button>
        <ul className="mt-1 flex flex-col gap-0.5 text-sm text-stone-300">
          {recipe.ingredients.map((ingredient, index) => (
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
            </li>
          ))}
        </ul>
        {recipe.availabilityNote ? (
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
  // list is the fallback when no sections are passed.
  const shownSections = (sections ?? []).filter(
    (section) => section.recipes.length > 0,
  );
  const isEmpty =
    sections !== undefined ? shownSections.length === 0 : recipes.length === 0;
  return (
    <section aria-label="Crafting" className={'rounded p-3 ' + t.panel}>
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
            Close
          </button>
        ) : null}
      </div>

      {stationNote ? (
        <p className={'mb-2 text-sm ' + t.muted}>{stationNote}</p>
      ) : null}

      {isEmpty ? (
        <p className={'italic ' + t.muted}>
          No recipes yet — recipes arrive from the Systems lane.
        </p>
      ) : sections !== undefined ? (
        <div className="flex flex-col gap-4">
          {shownSections.map((section) => (
            <div key={section.title}>
              <h3 className={'text-sm font-semibold ' + t.heading}>
                {section.title}
              </h3>
              <ul className="mt-1 flex flex-col gap-2">
                {section.recipes.map(renderRecipe)}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">{recipes.map(renderRecipe)}</ul>
      )}
    </section>
  );
}
