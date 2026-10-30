/**
 * TRAP CATCH — catch-resolution + collection outcome
 * (Systems, 2026-10-28; Adam's sequence #3, traps
 * before beehives).
 *
 * DECIDED (Adam): abstract set-and-wait; 5% per
 * placed trap per game hour; equal spread among
 * eligible kinds; kinds = trap set ∩ biome-present
 * kinds; bait OPTIONAL; weather NO modifier.
 * Game hour = 25 real s (10-min day); the hour
 * boundary (floor(cycleT×24) change) is the
 * trigger — the trigger itself is shell/Background
 * wiring (follow-up, DEV-routed), not this module:
 * the shell detects the boundary and calls
 * resolveTrapHour per placed trap.
 *
 * PROPOSALS (Adam pins, not baked):
 * - Bait +5pp PER GAME HOUR (10% total) — one roll,
 *   one unit, no daily accumulator. Alternative
 *   flagged: Adam's "another 5% per day" wording
 *   (daily accumulator negligible vs ~71%/day base,
 *   or a separate daily roll = more machinery).
 * - NO decay v1: a caught animal waits in the trap
 *   until collected (simplest). Alternative flagged:
 *   escape after N game-hours + folk-horror
 *   taking flavor (future).
 * - Catch items are kind-specific carcass ids
 *   (draft, Adam pins names/weights/uses). Weight
 *   rides the 1 lb unknown-id default until pin
 *   pass (no fake-precision rows). FIRST SINK
 *   (2026-10-30): render-tallow — eight kinds render
 *   in the cauldron (recipes.ts). Frog, crayfish,
 *   mice, and voles stay sinkless, stated plainly in
 *   their descriptors. Carcasses are not food (not
 *   in FOOD_ITEMS) and not ritual offerings until
 *   Adam pins cooking / butchery / fur uses.
 *
 * COLLECTION (DEV lean): the trap STAYS placed but
 * EMPTY after collect; it re-catches over time; the
 * trap is NOT consumed; removal stays the separate
 * Remove action. State: empty → caught(kind) →
 * collect → empty. The shell clears the trapState
 * catch field on a granted collection — Systems
 * never mutates game state (never imports game).
 *
 * PERSISTENCE (both halves needed before catch
 * persists; either alone is inert but harmless):
 * save.ts carries optional catch/baited through the
 * traps entries; Background's trapState owns the
 * catch/baited fields + restore + snapshot
 * (dependency, DEV-routed).
 *
 * KIND SETS (DRAFT, creatures doc — adopted, not
 * invented; pin pass): trap-type keys are literal
 * mirrors of game/traps.ts TrapType (systems never
 * imports game — the save.ts literal-mirror
 * pattern). Excluded everywhere: bat (flying),
 * bear (size). DEER IS UNTRAPPABLE (Adam's
 * agreement, 2026-10-30): nothing in the five
 * honestly takes one — deer belong to encounters.
 * UNASSIGNED (flagged): beaver (assigned to no
 * trap yet). Mice / voles ride the pot-trap (the
 * small-critter trap takes the small critters,
 * Adam, 2026-10-30).
 * Kind words are the doc's words ('eels' plural);
 * carcass ids singular-normalize (eels→eel).
 */

import type { PersonalInventory } from './inventory';
import { ITEMS } from './recipes';

/** Base catch chance per placed trap per game hour. */
export const TRAP_CATCH_RATE = 0.05;
/** Baited catch chance (proposal: +5pp per game hour). */
export const TRAP_CATCH_RATE_BAITED = 0.10;

/**
 * Draft per-trap catch sets (creatures doc, pin pass).
 * Systems owns the plausibility sets; biome presence
 * is Background data, intersected by the shell.
 */
export const TRAP_CATCH_SETS: Record<string, readonly string[]> = {
  snare: ['rabbit', 'squirrel', 'muskrat'],
  'fish-weir-trap': ['fish', 'eels', 'crayfish'],
  'pot-trap': ['crayfish', 'frog', 'muskrat', 'mice', 'voles'],
  pitfall: ['rabbit', 'opossum', 'groundhog', 'raccoon'],
  deadfall: ['squirrel', 'raccoon', 'opossum'],
};

/** Eligible kinds for one trap: its set ∩ biome-present. */
export function eligibleKindsFor(
  trapType: string,
  biomePresent: readonly string[],
): string[] {
  return (TRAP_CATCH_SETS[trapType] ?? []).filter((kind) =>
    biomePresent.includes(kind),
  );
}

/** One hourly roll's outcome. */
export type TrapHourOutcome =
  | { caught: false }
  | { caught: true; kind: string };

/**
 * Resolve one game-hour roll for one placed trap.
 * rng injectable (harvest precedent: gameplay luck,
 * default Math.random). Two draws: catch roll, then
 * equal-spread kind pick. Empty eligible → never.
 */
export function resolveTrapHour(
  eligibleKinds: readonly string[],
  baited: boolean,
  rng: () => number = Math.random,
): TrapHourOutcome {
  if (eligibleKinds.length === 0) return { caught: false };
  const rate = baited ? TRAP_CATCH_RATE_BAITED : TRAP_CATCH_RATE;
  if (rng() >= rate) return { caught: false };
  const pick = Math.min(
    eligibleKinds.length - 1,
    Math.floor(rng() * eligibleKinds.length),
  );
  return { caught: true, kind: eligibleKinds[pick] };
}

/** Kind → carcass item (single source: ITEMS). */
const CATCH_ITEM_BY_KIND: Record<string, string> = {
  rabbit: ITEMS.rabbitCarcass,
  squirrel: ITEMS.squirrelCarcass,
  muskrat: ITEMS.muskratCarcass,
  fish: ITEMS.fishCarcass,
  eels: ITEMS.eelCarcass,
  crayfish: ITEMS.crayfishCarcass,
  frog: ITEMS.frogCarcass,
  opossum: ITEMS.opossumCarcass,
  groundhog: ITEMS.groundhogCarcass,
  raccoon: ITEMS.raccoonCarcass,
  mice: ITEMS.mouseCarcass,
  voles: ITEMS.voleCarcass,
};

/** Carcass item for a caught kind, or null when unknown. */
export function catchItemFor(kind: string): string | null {
  return CATCH_ITEM_BY_KIND[kind] ?? null;
}

/** Collection outcome (grant only — shell clears the trap). */
export type TrapCollectOutcome =
  | { collected: true; item: string }
  | { collected: false; reason: string };

/**
 * Collect one caught animal into inventory (1 item).
 * Pack full (granted 0) → catch STAYS in the trap
 * (pile-grant precedent); granted 1 → the shell
 * clears the trap's catch field.
 */
export function collectTrapCatch(
  inventory: PersonalInventory,
  kind: string,
): TrapCollectOutcome {
  const item = catchItemFor(kind);
  if (item === null) {
    return { collected: false, reason: 'Unknown catch kind.' };
  }
  const result = inventory.addPartial(item, 1);
  if (result.granted === 0) {
    return { collected: false, reason: 'Pack full.' };
  }
  return { collected: true, item };
}
