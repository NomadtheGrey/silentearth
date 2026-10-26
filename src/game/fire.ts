/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FIRE ENTITIES (MVP build round, Adam 2026-10-26) — engine side.
 *
 * FIRE LADDER (Adam, 2026-10-25/26, PINNED): campfire → hearth →
 * kiln → bloomery. Roles:
 * - Campfire: open-fire cooking + light. Cooking is open-fire
 *   (on a stick, or chucked in the fire and dug out) — NOT pot
 *   cooking. Cooking mechanics themselves are SYSTEMS' (recipes
 *   + eating), not built here: this module is entities + light.
 * - Hearth: better cooking (Systems) + light.
 * - Kiln: firing clay — pottery, bricks (Systems recipes).
 * - Bloomery: smelting bog iron for the next tool upgrade.
 *   BOG IRON INPUT FLAGGED, NOT INVENTED: bog iron's source
 *   mechanic is TBD (Adam's brief), so no iron item id exists in
 *   the vocabulary yet and no smelt execution is built — the
 *   bloomery is a lit fire entity with a documented smelt role,
 *   and smelt execution waits on the iron item + Systems recipes.
 *   Nothing here invents where iron comes from.
 *
 * LIGHTING (Adam, 2026-10-25/26, PINNED shapes): two paths, both
 * built — flint is FAST (click-click-click-WOOF), sticks/friction
 * is SLOW (rub, wait 20–30 s, rub). Counts/timing below are
 * lane-decided tunables (flagged), inside Adam's shapes.
 *
 * CANDLE FLAG — DO NOT ASSUME (Adam's brief, 2026-10-26): she
 * walks around with a candle (avatar flame), but how the candle
 * relates to fire-starting is UNDECIDED — light only, or a
 * starter? Until Adam calls it, the candle lights NOTHING and
 * cooks NOTHING: lighting methods here are flint and friction
 * only, and no code path reads the candle. This flag stays until
 * his call lands; do not wire the candle in quietly.
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
export type FireType = 'campfire' | 'hearth' | 'kiln' | 'bloomery';

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
  bloomery: {
    id: 'bloomery',
    name: 'Bloomery',
    description: 'A tall smelting furnace for bog iron.',
    role: 'Smelting bog iron for the next tool upgrade — INPUT FLAGGED: bog iron item id TBD, source mechanic TBD, no smelt execution yet (see header).',
    flameWhenLit: true,
  },
};
