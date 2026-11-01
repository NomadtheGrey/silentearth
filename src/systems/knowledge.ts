// ITEM FACTS — the item info card's derivation (Adam
// pinned the card 2026-11-01; gate ratified by DEV the
// same day). The register's STATE lives in
// knowledge-register.ts (a leaf — see its header for the
// boot-crash cycle that forced the split); this module
// only READS it and composes the tables. Its register
// API is re-exported here so the card's surface has one
// import point.
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
// to the register or the gates. Fact LINES are DRAFT
// until Adam's pin pass.

import { RECIPES } from './recipes';
import type { ItemId } from './recipes';
import { isFood } from './hunger';
import { TRAP_CATCH_SETS, catchItemFor } from './trap-catch';
import { isItemMet, isRecipeUseKnown } from './knowledge-register';

export {
  markItemMet,
  isItemMet,
  recordCraftedUse,
  teachRecipeUse,
  isRecipeUseKnown,
  knowledgeSnapshot,
  restoreKnowledge,
  resetKnowledge,
} from './knowledge-register';
export type { KnowledgeSnapshot } from './knowledge-register';

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
  const met = isItemMet(item);
  const uses: string[] = [];
  for (const recipe of RECIPES) {
    const consumes =
      recipe.ingredients.some((ingredient) => ingredient.item === item) ||
      (recipe.upgradeFrom !== undefined &&
        (Array.isArray(recipe.upgradeFrom)
          ? recipe.upgradeFrom.includes(item)
          : recipe.upgradeFrom === item));
    if (consumes && isRecipeUseKnown(recipe.id)) {
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
