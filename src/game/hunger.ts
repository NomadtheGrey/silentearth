/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hunger interaction — ENGINE half (Adam, 2026-10-26 — weather +
 * hunger build). Systems owns the hunger meter and its stage; this
 * module is the CONSUMER contract, mirroring the owned-tool tier
 * query pattern: the engine never duplicates hunger state, it
 * reads a stage through a query the shell passes in (see
 * player.ts setHungerStageQuery and harvest.ts getHungerStage).
 * Until Systems lands the query, both consumers default to
 * unhungry (no slowdown, no lockout).
 *
 * STAGE VOCABULARY — ALIGNMENT POINT: these literals are what the
 * engine matches on. If Systems' brief names the stages
 * differently, THIS union is the one place that changes to match —
 * the engine treats any unrecognized stage as 'fed' (no effect),
 * never as hungry, so a mismatch fails safe instead of starving
 * the player by accident.
 */
export type HungerStage = 'fed' | 'hungry' | 'starving';

/** Query shape, mirroring ToolTierQuery in harvest.ts. */
export type HungerStageQuery = () => HungerStage | null;

/**
 * Movement slowdown while hungry — LANE-DECIDED starting tunable
 * (Adam's pin pass still applies). Applied at 'hungry' AND at
 * 'starving' (starving is hungry or worse — slowing only the
 * middle stage and not the worst would read as a bug).
 */
export const HUNGRY_SPEED_MULTIPLIER = 0.7;

/**
 * The too-hungry stage: harvests are locked out at this stage
 * except for exempt food sources (see below). 'starving' is the
 * lockout stage; 'hungry' only slows movement.
 */
export const TOO_HUNGRY_STAGE: HungerStage = 'starving';

/**
 * NUTS/BERRIES EXEMPTION SET — shared contract with Systems
 * (Adam, 2026-10-26). Item ids (UPPER_SNAKE, matching the existing
 * vocabulary in objects.ts):
 * - ACORNS (nuts) — secondary of downed oak.
 * - BOG_BERRIES (berries) — secondary of bog growth.
 * - ELDERBERRIES (berries) — secondary of brush.
 * The SOURCES carrying these are flagged hungerExempt in
 * objects.ts; the listener exempts the whole source harvest
 * (primary + secondaries), not just the berry roll — the dispatch
 * exempts sources, and a starving witch gathering berries should
 * not have to drop the wood she gathered alongside them.
 */
export const HUNGER_EXEMPT_ITEMS = ['ACORNS', 'BOG_BERRIES', 'ELDERBERRIES'] as const;

/**
 * HOOKS, NOT BUILT (Adam's brief, explicit):
 * - Traps are still brainstorm-stage: when a trap system exists,
 *   its yields join this exemption the same way (flag the trap
 *   source hungerExempt, or extend the exempt-items list) — no
 *   trap mechanics are invented here.
 * - Campfire cooking is a fire-system action, not yet built: when
 *   it exists, cooked food is hunger recovery through that system,
 *   not through this lockout — this module does not gate cooking.
 * - Shelter/clothes do not touch hunger here; they plug into
 *   weather.exposureAt instead.
 */
