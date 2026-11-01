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
// water point gates the CALL — the shell calls
// fillJar when the world says she can (UI's verbs,
// the container wiring). These grants take inventory
// only (dumpJar additionally takes the ground the
// shell certifies at the pour point).
//
// THE ONE VESSEL (Adam, 2026-11-01): the clay pot
// retired — the jar took its pot-trap job (the trap
// recipe consumes a jar now) and stands alone as THE
// container, water first among its contents (the
// universal-container trajectory, 2026-10-31). Its
// water cycle is Adam's design, verbatim in spirit:
// fill at open water; DUMP a filled jar on dry ground
// and it makes MUD; dump on mud and it makes WATER —
// a hauled water source near camp, built jar by jar
// (dumpJar, below; the patch state itself is
// Background's placed state — the grant names the
// patch, the world keeps it).
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

// ---------------------------------------------------------------------------
// The pour (Adam's water cycle, 2026-11-01)
// ---------------------------------------------------------------------------

/** The ground the shell certifies at the pour point. */
export type DumpTarget = 'dry' | 'mud';

/**
 * Dump outcome. `patch` names the ground the pour
 * makes — the shell hands it to Background's placed
 * state, which keeps the patch; Systems keeps none.
 */
export type DumpJarOutcome =
  | { dumped: true; patch: 'mud' | 'water' }
  | { dumped: false; reason: string };

/**
 * Pour one filled jar out on the ground (Adam,
 * 2026-11-01: 'if dumped on the ground makes mud.
 * If dumped on mud makes water. If we want a water
 * source closer, that is.'). The WATER is consumed;
 * the jar itself returns to her pack empty — she
 * keeps the vessel. One jar = one stage (DRAFT): dry
 * ground becomes a mud patch, a mud patch becomes a
 * water patch. A pour onto a WATER patch REFUSES:
 * saturation means nothing in v1 (Background's word,
 * 2026-11-01 — no growth, no depth; either would be
 * a mechanic Adam never specced, smuggled in as a
 * side effect), and eating a jar silently for
 * nothing is the one dishonest outcome on the table.
 * The refusal leaves her water hers to spend where
 * it matters. (A 'water'-accepting widening lived
 * for one interval and came back out on exactly
 * this word.) Ground outside the named kinds refuses
 * likewise; the guard keeps outcomes honest for
 * targets the verb is never offered on. No hunger
 * gate (an inventory move, the module's idiom).
 */
export function dumpJar(
  inventory: PersonalInventory,
  target: DumpTarget,
): DumpJarOutcome {
  if ((target as string) === 'water') {
    return {
      dumped: false,
      reason: 'That ground is water already — the pour adds nothing.',
    };
  }
  if (target !== 'dry' && target !== 'mud') {
    return { dumped: false, reason: 'Pouring it there does nothing.' };
  }
  if (inventory.count(ITEMS.waterJar) <= 0) {
    return { dumped: false, reason: 'No filled jar carried.' };
  }
  inventory.remove(ITEMS.waterJar, 1);
  inventory.add(ITEMS.clayJar, 1);
  return { dumped: true, patch: target === 'dry' ? 'mud' : 'water' };
}
