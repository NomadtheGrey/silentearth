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

export interface CraftingMenuProps {
  recipes: CraftingRecipe[];
  /** Id of the selected recipe, if any. Undefined = nothing selected. */
  selectedRecipeId?: string;
  /** Called when the player picks a recipe. Optional. */
  onSelectRecipe?: (id: string) => void;
  /** Called when the player asks to craft the selected recipe. Optional. */
  onCraft?: (id: string) => void;
  /** Called when the menu is closed. Optional. */
  onClose?: () => void;
}

export function CraftingMenu({
  recipes,
  selectedRecipeId,
  onSelectRecipe,
  onCraft,
  onClose,
}: CraftingMenuProps) {
  return (
    <section
      aria-label="Crafting"
      className="rounded bg-stone-900/90 p-3 text-stone-100 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Crafting</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close crafting menu"
            className="rounded bg-stone-700 px-2 py-1 text-sm hover:bg-stone-600"
          >
            Close
          </button>
        ) : null}
      </div>

      {recipes.length === 0 ? (
        <p className="italic text-stone-400">
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
                  (selected
                    ? 'bg-amber-800/60 outline outline-1 outline-amber-500'
                    : 'bg-stone-800/60')
                }
              >
                <button
                  type="button"
                  onClick={() => onSelectRecipe?.(recipe.id)}
                  aria-pressed={selected}
                  className="w-full text-left"
                >
                  <span className="font-medium">{recipe.name}</span>
                  {recipe.description ? (
                    <span className="mt-1 block text-sm text-stone-300">
                      {recipe.description}
                    </span>
                  ) : null}
                </button>
                <ul className="mt-1 flex flex-col gap-0.5 text-sm text-stone-300">
                  {recipe.ingredients.map((ingredient, index) => (
                    <li key={index}>
                      {ingredient.name}
                      {ingredient.amountText ? (
                        <span className="ml-2 text-stone-400">
                          {ingredient.amountText}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {recipe.availabilityNote ? (
                  <p className="mt-1 text-sm text-stone-400">
                    {recipe.availabilityNote}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={!recipe.canCraft}
                  onClick={() => onCraft?.(recipe.id)}
                  className="mt-2 rounded bg-amber-700 px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40 hover:bg-amber-600"
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
