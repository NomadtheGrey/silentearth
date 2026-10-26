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

export interface CraftingMenuProps {
  recipes: CraftingRecipe[];
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
  /** Look for the menu. Default "hearth" (firelit making). */
  theme?: UiThemeName;
}

export function CraftingMenu({
  recipes,
  stationNote,
  selectedRecipeId,
  onSelectRecipe,
  onCraft,
  onClose,
  theme = 'hearth',
}: CraftingMenuProps) {
  const t = UI_THEMES[theme];
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
            className={'rounded px-2 py-1 text-sm ' + t.button}
          >
            Close
          </button>
        ) : null}
      </div>

      {stationNote ? (
        <p className={'mb-2 text-sm ' + t.muted}>{stationNote}</p>
      ) : null}

      {recipes.length === 0 ? (
        <p className={'italic ' + t.muted}>
          No recipes yet — recipes arrive from the Systems lane.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {recipes.map((recipe) => {
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
                  className={
                    'mt-2 rounded px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40 ' +
                    t.primary
                  }
                >
                  Craft
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
