// THE KNOWN-FACTS REGISTER — STATE ONLY (Adam pinned
// the item info card 2026-11-01; gate ratified by DEV
// the same day).
//
// Three sets of earned knowledge:
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
// - USED ITEMS: an item's OWN use, exercised — the
//   output side of the same law. A placed thing teaches
//   what it is for when she USES it, not when she makes
//   or places it: the sleeping bag's learn event is the
//   first completed sleep (Adam's ruling, 2026-11-02 —
//   placement is furniture-moving). The shell fires
//   recordItemUse() at each item's own exercised moment;
//   crafting NEVER records here (the loom is not the
//   lesson), so a made-but-unused thing keeps its hole.
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
const usedItems = new Set<string>();

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

/**
 * Record an item's OWN use as EXERCISED (the output
 * side of the law). Fired by the shell at the item's
 * own exercised moment — the sleeping bag's first
 * completed sleep is the first caller. Never fired by
 * crafting or placement. Idempotent.
 */
export function recordItemUse(item: ItemId): void {
  usedItems.add(item);
}

export function isItemUseKnown(item: ItemId): boolean {
  return usedItems.has(item);
}

export interface KnowledgeSnapshot {
  metItems: string[];
  knownUseRecipes: string[];
  /** Items whose own use has been exercised. Additive:
   * older snapshots lack it and restore as []. */
  usedItems?: string[];
}

/** Save-format snapshot (first-recorded order). */
export function knowledgeSnapshot(): KnowledgeSnapshot {
  return {
    metItems: [...metItems],
    knownUseRecipes: [...knownUseRecipes],
    usedItems: [...usedItems],
  };
}

/** Boot-only restore: clears and rebuilds all sets. */
export function restoreKnowledge(
  snapshot: KnowledgeSnapshot | null | undefined,
): void {
  metItems.clear();
  knownUseRecipes.clear();
  usedItems.clear();
  if (snapshot === null || snapshot === undefined) return;
  for (const item of snapshot.metItems ?? []) {
    if (typeof item === 'string') metItems.add(item);
  }
  for (const recipeId of snapshot.knownUseRecipes ?? []) {
    if (typeof recipeId === 'string') knownUseRecipes.add(recipeId);
  }
  for (const item of snapshot.usedItems ?? []) {
    if (typeof item === 'string') usedItems.add(item);
  }
}

/** New game: nothing is known. */
export function resetKnowledge(): void {
  metItems.clear();
  knownUseRecipes.clear();
  usedItems.clear();
}
