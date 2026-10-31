// THE CLAY JAR — FILL / EMPTY GRANTS (Adam's
// carried-water ruling, 2026-10-27; the jar build,
// 2026-10-30).
//
// The jar carries water as a STATE OF THE PACK, not
// of the world: two item ids — 'clay-jar' (empty)
// and 'water-jar' (filled) — and these grants swap
// them. No save machinery: the filled state rides
// the inventory like any other stack.
//
// Adam's framing, pinned: NO THIRST. Water is an
// ingredient, never a need. The jar's first named
// job is carrying water for soup; brews stand behind
// it. Nothing in this module makes water urgent.
//
// GRANT IDIOM (cauldron precedent): outcome records,
// validate before mutating, failure touches nothing,
// NO hunger gate (an inventory move, not a build).
//
// THE WORLD TRIGGER IS NOT HERE: whether she stands
// in water (Background's wading fact) or faces a
// water point gates the CALL, in a later wiring
// claim. These grants take inventory only — the
// shell calls fillJar when the world says she can.
//
// WIP (Adam, 2026-10-31): fill/empty are NOT orphans
// awaiting a water feature — they are the seed of a
// UNIVERSAL CONTAINER. The jar is being built as THE
// container, water first among its contents; the
// general-contents design and the world trigger land
// together in the container wiring claim. Until then
// these verbs are deliberately unwired.
//
// THE EXTRA POUND, handled honestly: a filled jar
// weighs 2 lb against the empty jar's 1 lb, so
// filling GAINS a pound net. fillJar checks the free
// space BEFORE the swap and refuses a pack that
// cannot take the water — the swap never strands
// half-done (jar removed, water unadded). Emptying
// only frees weight, so it cannot be blocked.

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';
import { weightOf } from './inventory';

/** Fill outcome; `reason` is player-facing on failure only. */
export type FillJarOutcome =
  | { filled: true }
  | { filled: false; reason: string };

/** Empty outcome; `reason` on failure only. */
export type EmptyJarOutcome =
  | { emptied: true }
  | { emptied: false; reason: string };

/**
 * Fill one carried empty jar: clay-jar out,
 * water-jar in. Refuses when no empty jar is carried
 * or the pack cannot take the net extra weight —
 * in both cases nothing changes hands.
 */
export function fillJar(
  inventory: PersonalInventory,
): FillJarOutcome {
  if (inventory.count(ITEMS.clayJar) <= 0) {
    return { filled: false, reason: 'No empty jar carried.' };
  }
  const netGain = weightOf(ITEMS.waterJar) - weightOf(ITEMS.clayJar);
  if (inventory.free() < netGain) {
    return { filled: false, reason: 'Too full to take the water.' };
  }
  inventory.remove(ITEMS.clayJar, 1);
  inventory.add(ITEMS.waterJar, 1);
  return { filled: true };
}

/**
 * Empty one filled jar: water-jar out, clay-jar in.
 * Refuses only when no filled jar is carried —
 * emptying frees weight, so capacity never blocks it.
 */
export function emptyJar(
  inventory: PersonalInventory,
): EmptyJarOutcome {
  if (inventory.count(ITEMS.waterJar) <= 0) {
    return { emptied: false, reason: 'No filled jar carried.' };
  }
  inventory.remove(ITEMS.waterJar, 1);
  inventory.add(ITEMS.clayJar, 1);
  return { emptied: true };
}
