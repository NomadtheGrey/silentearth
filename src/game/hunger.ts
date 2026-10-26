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
 * HUNGER → HEALTH GATE (Adam, 2026-10-26, PINNED ruling):
 * hunger does NOT affect Health until it gets cold — at least
 * a November equivalent (see the season axis in weather.ts).
 * BEFORE that threshold, hunger effects are slowdown + lockout
 * ONLY, no health effect. The health system itself is NOT built
 * yet, so this is a CONSTRAINT on its future design, not a
 * current behavior change — and current behavior already
 * complies: nothing in the engine's hunger handling touches
 * health at all (slowdown in player.ts, lockout in harvest.ts,
 * nothing else). When the health system lands, it must gate
 * any hunger→health link behind the cold/November threshold.
 *
 * STAGE VOCABULARY — ALIGNED WITH SYSTEMS (correction, 2026-10-26):
 * Systems owns the meter and its stage (src/systems/hunger.ts,
 * HungerState.stage()), and its literals are 'fed' | 'hungry' |
 * 'too-hungry'. An earlier engine draft guessed 'starving' for the
 * lockout stage — that literal is never emitted, so the lockout
 * would never have fired once wired. This union now matches
 * Systems exactly; the engine still treats any unrecognized stage
 * as 'fed' (no effect), so a future mismatch fails safe instead
 * of starving the player by accident.
 */
export type HungerStage = 'fed' | 'hungry' | 'too-hungry';

/** Query shape, mirroring ToolTierQuery in harvest.ts. */
export type HungerStageQuery = () => HungerStage | null;

/**
 * Movement slowdown while hungry — LANE-DECIDED starting tunable
 * (Adam's pin pass still applies). Applied at 'hungry' AND at
 * 'too-hungry' (too-hungry is hungry or worse — slowing only the
 * middle stage and not the worst would read as a bug).
 */
export const HUNGRY_SPEED_MULTIPLIER = 0.7;

/**
 * The too-hungry stage: harvests are locked out at this stage
 * except for exempt food sources (see below). 'too-hungry' is the
 * lockout stage; 'hungry' only slows movement.
 */
export const TOO_HUNGRY_STAGE: HungerStage = 'too-hungry';

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
 * exempts sources, and a too-hungry witch gathering berries should
 * not have to drop the wood she gathered alongside them.
 *
 * GATHER vs EAT (Adam, 2026-10-26, PINNED clarification): this
 * exemption is about GATHERING only. Acorns stay gather-exempt
 * (she can still forage them when too hungry), but EATING them
 * requires the campfire cooking step — see COOK_REQUIRED_ITEMS.
 * Berries carry no such note: they are eaten as gathered.
 */
export const HUNGER_EXEMPT_ITEMS = ['ACORNS', 'BOG_BERRIES', 'ELDERBERRIES'] as const;

/**
 * Foods that must be cooked before eating (Adam, 2026-10-26,
 * PINNED): acorns, and only acorns in this set. This is a
 * contract for Systems' eating/cooking code — the engine half
 * implements no eating, so nothing here gates it yet. When the
 * fire system lands, its cooking step turns ACORNS into edible
 * food; raw acorns must not count as eaten food.
 */
export const COOK_REQUIRED_ITEMS = ['ACORNS'] as const;

/**
 * HOOKS, NOT BUILT (Adam's brief, explicit):
 * - Traps are still brainstorm-stage: when a trap system exists,
 *   its yields join this exemption the same way (flag the trap
 *   source hungerExempt, or extend the exempt-items list) — no
 *   trap mechanics are invented here.
 * - Campfire cooking is a fire-system action, not yet built, and
 *   is itself a TOO-HUNGRY EXCEPTION (Adam, 2026-10-26): a
 *   too-hungry witch can still cook — the future fire system must
 *   not lock the cooking step behind hunger, or the acorn path
 *   (forage when too-hungry, then cook to eat) would deadlock.
 *   Cooked food is hunger recovery through that system, not
 *   through this lockout — this module does not gate cooking.
 * - Shelter/clothes do not touch hunger here; they plug into
 *   weather.exposureAt instead.
 */
