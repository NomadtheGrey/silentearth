/**
 * The crawl-back (Systems, 2026-11-03 — the feral
 * build's consequence; Adam's reframe, pinned
 * 2026-11-03: 'she crawls back (narratively) to her
 * last encampment, missing stuff at random. She'll
 * have to go to the pile where it was left and pick
 * the missing stuff up').
 *
 * When the DOWN fires (injury.ts: a landed strike at
 * critical), this module prices what the crawl costs
 * and where she wakes. It is a pure derivation — the
 * shell executes it (removes the stacks, seats the
 * pile through the standing pile system, moves her,
 * sets the clock and the gauges). No new persistence
 * is invented for the pile: it is an ordinary pile,
 * saved and picked up by the standing rules, seated
 * in whatever dimension she fell in.
 *
 * All numbers DRAFT for Adam's pin pass.
 */

import type { PersonalInventory } from './inventory';

/** Share of her carried stacks the fall takes: a
 * random third, rounded up, minimum one stack. */
export const MISSING_STACK_FRACTION = 1 / 3;

/** The hunger she wakes with: the hungry band's
 * floor — she crawled home unfed, but the model does
 * not stack a starvation emergency on the fall. */
export const WAKE_HUNGER = 15;

export interface DroppedStack {
  item: string;
  quantity: number;
}

export interface CrawlBackPlan {
  /** Whole stacks the fall takes, in pack order —
   * the fallen pile's contents, seated as one pile
   * where she fell. Empty when nothing could drop. */
  dropped: DroppedStack[];
}

/**
 * Choose what the fall takes: a random subset of her
 * carried stacks — WHOLE stacks, never split units,
 * so what she walks back for is legible. EXEMPT by
 * law (the finalized claim): the owned tool (the
 * ladder is never the toll), what she wears (it is on
 * her body), and awakened charms (the Waking is not
 * lootable) — the shell composes that set and passes
 * it in. `random` is injected (the shell's source;
 * probes seed it). Pure: the inventory is not touched.
 */
export function planCrawlBack(
  inventory: PersonalInventory,
  exemptItems: ReadonlySet<string>,
  random: () => number,
): CrawlBackPlan {
  const candidates = inventory
    .stacksSnapshot()
    .filter((stack) => stack.quantity > 0 && !exemptItems.has(stack.item));
  if (candidates.length === 0) return { dropped: [] };
  const take = Math.max(
    1,
    Math.ceil(candidates.length * MISSING_STACK_FRACTION),
  );
  // Partial Fisher-Yates over a copy: choose `take`
  // distinct candidate indexes with the injected rng.
  const indexes = candidates.map((_, i) => i);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(random() * (indexes.length - i));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  const chosen = new Set(indexes.slice(0, take));
  return {
    dropped: candidates
      .filter((_, i) => chosen.has(i))
      .map((stack) => ({ item: stack.item, quantity: stack.quantity })),
  };
}

export interface GroundPoint {
  x: number;
  z: number;
}

/**
 * Her last encampment (the finalized claim): the last
 * place she COMPLETED a sleep — falling back to her
 * bound home, then spawn. The seat that persists the
 * sleep site is save.ts's lastSleepSite; the chain
 * itself is this one expression, read by the shell
 * when a down fires.
 */
export function resolveEncampment(
  lastSleepSite: GroundPoint | null | undefined,
  boundHome: GroundPoint | null | undefined,
  spawn: GroundPoint,
): GroundPoint {
  return lastSleepSite ?? boundHome ?? spawn;
}
