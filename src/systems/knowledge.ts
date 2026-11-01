// THE KNOWN-FACTS REGISTER (Adam pinned the item info
// card 2026-11-01; gate ratified by DEV the same day).
//
// Two sets of earned knowledge, and the derivation the
// item info card reads:
//
// - MET: an item is met when it has entered her pack at
//   least once. Recorded inside PersonalInventory's gain
//   choke points (add / addPartial / the constructor's
//   initial stacks), so every door into the pack marks
//   it and no grant route can dodge it.
// - KNOWN USES (recipes): a recipe's use of an item is
//   known when she has EXERCISED it (a craft completed —
//   recorded at executeCraft's success, which chains
//   ride per batch) or been TAUGHT it. Teaching has no
//   caller yet: teachRecipeUse() is the named door the
//   fragment-teaching surface will use when its claim
//   comes (Adam's pin: 'exercised OR TAUGHT') — one set,
//   two writers, so the door is not walled later.
//
// THE GATES (ratified, verbatim shape): the card's name /
// description / weight never gate (she is looking at the
// row). SOURCE facts print only for a met item. A recipe
// USE prints only when that recipe's use is known —
// table membership alone never prints. Non-recipe uses
// (food) print for a met item, since the row itself
// already offers those verbs. Where nothing is known the
// derivation returns empty lists and the SHELL renders
// the hole ('Not yet known' is presentation, UI's lane).
//
// SOURCES this derivation composes today: crafted-by
// (recipe outputs) and trapped kinds (trap-catch). The
// harvest/scatter sources — the largest class for raw
// materials — live in Background's harvest defs behind
// the game/ dependency direction; their lines join this
// same shape when that seam is exposed, with no change
// to the register or the gates.
//
// SAVE: knowledgeSnapshot / restoreKnowledge on the
// nameSight pattern (format now, App wiring on UI's
// surface claim). Restore is boot-only: it clears and
// rebuilds. Fact LINES are DRAFT until Adam's pin pass.

import { RECIPES } from './recipes';
import type { ItemId } from './recipes';
import { isFood } from './hunger';
import { TRAP_CATCH_SETS, catchItemFor } from './trap-catch';

const metItems = new Set<string>();
const knownUseRecipes = new Set<string>();

/** Record that an item has entered her pack. Called by
 * PersonalInventory's gain choke points; idempotent. */
export function markItemMet(item: ItemId): void {
  metItems.add(item);
}

export function isItemMet(item: ItemId): boolean {
  return metItems.has(item);
}

/** Record a use as EXERCISED: a craft of this recipe
 * completed. Called at executeCraft's success. */
export function recordCraftedUse(recipeId: string): void {
  knownUseRecipes.add(recipeId);
}

/**
 * Record a use as TAUGHT (Adam's pin: 'exercised OR
 * TAUGHT'). No caller yet — this is the door the
 * fragment-teaching surface uses when its claim comes.
 */
export function teachRecipeUse(recipeId: string): void {
  knownUseRecipes.add(recipeId);
}

export function isRecipeUseKnown(recipeId: string): boolean {
  return knownUseRecipes.has(recipeId);
}

export interface KnowledgeSnapshot {
  metItems: string[];
  knownUseRecipes: string[];
}

/** Save-format snapshot (first-recorded order). */
export function knowledgeSnapshot(): KnowledgeSnapshot {
  return {
    metItems: [...metItems],
    knownUseRecipes: [...knownUseRecipes],
  };
}

/** Boot-only restore: clears and rebuilds both sets. */
export function restoreKnowledge(
  snapshot: KnowledgeSnapshot | null | undefined,
): void {
  metItems.clear();
  knownUseRecipes.clear();
  if (snapshot === null || snapshot === undefined) return;
  for (const item of snapshot.metItems ?? []) {
    if (typeof item === 'string') metItems.add(item);
  }
  for (const recipeId of snapshot.knownUseRecipes ?? []) {
    if (typeof recipeId === 'string') knownUseRecipes.add(recipeId);
  }
}

/** New game: nothing is known. */
export function resetKnowledge(): void {
  metItems.clear();
  knownUseRecipes.clear();
}

export interface ItemFacts {
  sources: string[];
  uses: string[];
}

/**
 * The card's facts for one item (canonical id, as the
 * rows carry it). Empty lists where nothing is known —
 * the shell renders the hole. Never throws.
 */
export function itemFactsFor(item: ItemId): ItemFacts {
  const met = metItems.has(item);
  const uses: string[] = [];
  for (const recipe of RECIPES) {
    const consumes =
      recipe.ingredients.some((ingredient) => ingredient.item === item) ||
      (recipe.upgradeFrom !== undefined &&
        (Array.isArray(recipe.upgradeFrom)
          ? recipe.upgradeFrom.includes(item)
          : recipe.upgradeFrom === item));
    if (consumes && knownUseRecipes.has(recipe.id)) {
      uses.push(recipe.name);
    }
  }
  if (met && isFood(item)) {
    uses.push('Eaten to restore hunger');
  }
  const sources: string[] = [];
  if (met) {
    for (const recipe of RECIPES) {
      if (recipe.output.item === item) {
        sources.push(`Crafted: ${recipe.name}`);
      }
    }
    const trappedKinds = new Set<string>();
    for (const kinds of Object.values(TRAP_CATCH_SETS)) {
      for (const kind of kinds) {
        if (catchItemFor(kind) === item) trappedKinds.add(kind);
      }
    }
    for (const kind of trappedKinds) {
      sources.push(`Trapped: ${kind}`);
    }
  }
  return { sources, uses };
}
