/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FIRE ENTITIES (MVP build round, Adam 2026-10-26) — engine side.
 *
 * FIRE LADDER (Adam, 2026-10-25/26, PINNED): campfire → hearth →
 * kiln. Roles:
 * - Campfire: open-fire cooking + light. Cooking is open-fire
 *   (on a stick, or chucked in the fire and dug out) — NOT pot
 *   cooking. Cooking mechanics themselves are SYSTEMS' (recipes
 *   + eating), not built here: this module is entities + light.
 * - Hearth: better cooking (Systems) + light.
 * - Kiln: firing clay — pottery, bricks (Systems recipes).
 * A fourth rung, the bloomery (bog-iron smelting), was REMOVED
 * 2026-10-30 under Adam's no-iron ruling: there is no iron in
 * this world and no smelting — the kiln is the ladder's top.
 *
 * LIGHTING (Adam, 2026-10-25/26, PINNED shapes): two paths, both
 * built — flint is FAST (click-click-click-WOOF), sticks/friction
 * is SLOW (rub, wait 20–30 s, rub). Counts/timing below are
 * lane-decided tunables (flagged), inside Adam's shapes.
 *
 * CANDLE — LIGHT SETTLED, STARTER STILL OPEN (Adam, 2026-10-26):
 * the carried candle PROVIDES LIGHT (visible model + real point
 * light, renderer/models — see buildCandle + candleLight). That
 * settles the light half of this flag. The starter half is STILL
 * UNDECIDED: the candle lights NO fires and cooks NOTHING —
 * lighting methods here stay flint and friction only, and no code
 * path reads the candle as a starter. Do not wire it as one
 * quietly; that call is still Adam's.
 *
 * LIGHT DIRECTION (Adam, 2026-10-26 — NOTED, NOT A BUILD ORDER:
 * do not pull this into the fire/shelters round): when light
 * work lands, it looks like this —
 * - Day/night cycle ~10 minutes (Adam's "maybe" = starting
 *   value, tunable, NOT pinned) — with a SEASONAL split
 *   (Adam's 2026-10-26 refinement): total stays ~10 minutes,
 *   but nights run longer in winter, shorter in summer; see
 *   dayFraction/nightFraction in weather.ts.
 * - Darkness is a REAL mechanic: night is genuinely dark, not
 *   cosmetic.
 * - She carries a candle (personal light).
 * - Torches are craftable for MORE light (brighter than the
 *   candle).
 * - AFTER torches, candles can be made for PLACING on the map
 *   where she needs them (placeable lights).
 * - Sequence: carried candle → torch → placeable candles.
 * The rest is still unbuilt here: no cycle, no darkness
 * mechanic, no torch item, no placeable candle entity
 * (carried light itself landed in renderer/models, Adam
 * 2026-10-26). And carried light does NOT settle the
 * candle-as-starter flag above — that call is still open.
 *
 * SCOPE BOUNDARIES: placement here is a cost-free engine
 * primitive — recipe/cost gating lives with Systems + UI, not in
 * placeFire. Lit fires STAY lit in this MVP: no extinguish, fuel,
 * or rain/wind effect on a lit fire is built (rain putting out a
 * campfire is an open question, flagged, not invented). Placed
 * fires are gameplay state, not worldgen — the seed
 * reproducibility rule covers generated chunks, which this state
 * never rewrites.
 */

/** Placeable fire entity types, in ladder order. */
export type FireType = 'campfire' | 'hearth' | 'kiln';

/** How a fire gets lit. Flint is fast; friction is slow. */
export type LightingMethod = 'flint' | 'friction';

/**
 * Flint clicks to ignition (lane-decided, flagged): click-click-
 * click-WOOF. The shape (a few clicks, then flame) is Adam's;
 * the exact count is tunable.
 */
export const FLINT_CLICKS = 3;

/**
 * Friction wait between the two rubs, in ms (lane-decided,
 * flagged): inside Adam's 20–30 s window, at 25 s.
 */
export const FRICTION_WAIT_MS = 25_000;

/** Fire entity definition: display + role only, no mechanics. */
export interface FireDef {
  id: FireType;
  name: string;
  description: string;
  /** What this fire is FOR (Systems build the mechanics). */
  role: string;
  /** Whether this fire shows a flame visual when lit. */
  flameWhenLit: boolean;
}

export const FIRE_DEFS: Record<FireType, FireDef> = {
  campfire: {
    id: 'campfire',
    name: 'Campfire',
    description: 'Stones ringed round crossed logs, open to the sky.',
    role: 'Open-fire cooking (stick or fire-buried, never pot) + light.',
    flameWhenLit: true,
  },
  hearth: {
    id: 'hearth',
    name: 'Hearth',
    description: 'A stone hearth, built to hold a fire properly.',
    role: 'Better cooking (Systems) + light.',
    flameWhenLit: true,
  },
  kiln: {
    id: 'kiln',
    name: 'Kiln',
    description: 'A clay-firing kiln, domed and patient.',
    role: 'Firing clay — pottery, bricks (Systems recipes).',
    flameWhenLit: true,
  },
};
