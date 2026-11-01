/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PLACED-TRAP TYPES (Adam 2026-10-26 — placement rule only).
 *
 * Adam's rule, PINNED: crafting a trap places it right there.
 * That rule is the only settled part. The TYPES below are the
 * current brainstorm vocabulary from Systems' recipes.ts
 * (DRAFT, explicitly "NOTHING PICKED" there — do not present
 * any of them as a settled recipe): snare, fish-weir-trap,
 * pot-trap, pitfall, deadfall. If Adam picks, renames, or
 * cuts a type, this table follows the recipes, not the
 * other way around.
 *
 * Placed `type` is the recipe id. It is also the item id —
 * verified identical strings for all five (ITEMS.snare =
 * 'snare', ITEMS.fishWeirTrap = 'fish-weir-trap', and so
 * on) — so no recipe-to-item mapping table is needed, and
 * none is kept here (a second spelling would only drift).
 *
 * PLACEMENT ONLY: this module + trapState carry where traps
 * are. No catch, check, bait, or decay behavior exists
 * anywhere in this landing — catch mechanics are a later
 * brief, and traps are not harvest targets (no proximity
 * channel, no harvest listener reads them).
 */

/** A trap kind, as crafted (recipe id = item id). */
export type TrapType = 'snare' | 'fish-weir-trap' | 'pot-trap' | 'pitfall' | 'deadfall';

/** All trap kinds, in recipe order. */
export const TRAP_TYPES: TrapType[] = ['snare', 'fish-weir-trap', 'pot-trap', 'pitfall', 'deadfall'];

export interface TrapDef {
  name: string;
  description: string;
}

/** Display names + short descriptions (lane-decided, flagged). */
export const TRAP_DEFS: Record<TrapType, TrapDef> = {
  snare: { name: 'Snare', description: 'Vine + stake snare for small game.' },
  'fish-weir-trap': { name: 'Fish / Weir Trap', description: 'Woven funnel trap for the creek.' },
  'pot-trap': { name: 'Pot Trap', description: 'Clay pot sunk in the creek.' },
  pitfall: { name: 'Pitfall', description: 'Spade-dug pit under a peat-moss cover.' },
  deadfall: { name: 'Deadfall', description: 'Oak + vine + river-stone weight.' },
};

/**
 * THE SITE RULES LIVE IN THE RECIPE DATA (Systems'
 * recipes.ts, requiresSite — the one source; DEV's (B)
 * ruling, 2026-11-01): the carryable three read them at
 * placement through Systems' trap-place grants, the
 * site-built two at craft. No site table is kept here —
 * a game-side copy of the recipe fact is exactly the
 * second source that ruling retired.
 */

/** Runtime guard for values arriving from save data or the bus. */
export function isTrapType(value: unknown): value is TrapType {
  return typeof value === 'string' && (TRAP_DEFS as Record<string, TrapDef | undefined>)[value] !== undefined;
}
