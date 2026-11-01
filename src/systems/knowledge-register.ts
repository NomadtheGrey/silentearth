// THE KNOWN-FACTS REGISTER — STATE ONLY (Adam pinned
// the item info card 2026-11-01; gate ratified by DEV
// the same day).
//
// Two sets of earned knowledge:
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
// THIS FILE IS A LEAF ON PURPOSE: it imports nothing but
// a type, because its writers live in inventory.ts and
// crafting-execution.ts while its reader (itemFactsFor,
// knowledge.ts) composes tables from modules that import
// inventory back (hunger normalizes ids through it). The
// first landing put state + derivation in one module and
// the cycle — inventory → knowledge → hunger → inventory
// — crashed the bundle at boot (TDZ on an uninitialized
// binding; tsc cannot see evaluation order). State in a
// leaf breaks the cycle structurally: writers and reader
// both point at the leaf, never at each other.
//
// SAVE: knowledgeSnapshot / restoreKnowledge on the
// nameSight pattern (format now, App wiring on UI's
// surface claim). Restore is boot-only: clears + rebuilds.

import type { ItemId } from './recipes';

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
