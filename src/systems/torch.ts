/**
 * Silent Earth — torch batch lighting (player-systems lane).
 *
 * PINS (Adam, DEV chat 2026-10-27):
 * - "Ok let's build out torches. I doubt she needs a station
 *   to build those. Flint and Stone or a fire." — the recipe
 *   (recipes.ts) is station 'hand'; lighting has TWO routes,
 *   flint + stone OR a lit fire.
 * - BATCH: one action lights AS MANY torches as she has on
 *   hand, in one go — ALL carried unlit torches, both routes.
 *   Batch is the rule, not just the pill.
 * - NO BURNOUT ("just annoying" — rejected) and NO HOURLY
 *   CHAIN-LIGHTING ("just tedious" — rejected): together
 *   these CLOSE the duration question. A lit torch is lit
 *   while carried, no duration, no burnout, no chain.
 * - SEQUENCE (game/fire.ts header): carried candle -> torch
 *   -> placeable candles. Placeable candles are NOT in this
 *   order. The torch is BRIGHTER than the carried candle.
 *
 * STATE SHAPE (for the UI signal): lit/unlit is TWO ITEM
 * IDS, not a flag — inventory stacks carry item + quantity
 * only, so there is nowhere else for it to live. 'torch' =
 * unlit (crafted); 'lit-torch' = lit (after lightTorches).
 * The carried-unlit query is inventory.count(ITEMS.torch):
 * UI's lit-fire 'light torches' pill appears ONLY when that
 * count is >= 1. The batch call is lightTorches() below;
 * what it returns for feedback is the lit COUNT (outcome.count)
 * plus the route (outcome.method).
 *
 * ROUTES (Adam's OR — either suffices):
 * - Fire: a lit fire is present (passed in as context, like
 *   station presence — systems never knows positions). No
 *   items needed, nothing consumed.
 * - Flint: carried flint + carried river-stone. BOTH KEPT,
 *   not consumed (lane call, flagged: the fire-lighting
 *   precedent keeps flint, and a striking stone is not
 *   consumed by striking). If Adam wants the stone consumed,
 *   that is a one-line change here.
 * Fire wins when both routes are available (the fire was
 * sought out; flint stays in the pack either way).
 *
 * NO HUNGER GATE (lane call, flagged): lighting a torch is
 * a lighting action, not a build — it mirrors fire lighting
 * (flint clicks / friction), which carries no hunger gate.
 * Crafting the torch itself IS hunger-gated, like every
 * craft through executeCraft.
 *
 * ATOMICITY: the swap is clone-simulated first
 * (craftIntoInventory pattern) — remove-all then grant-all
 * is net-zero weight (both forms 0.5 lb), but a failed
 * grant still leaves the real inventory untouched.
 *
 * BACKGROUND HOOK (not built here — game side is
 * Background's): when the inventory contains 'lit-torch',
 * the carried light must be BRIGHTER than the carried
 * candle — and Adam PINNED the usefulness test
 * (2026-10-27): PLENTY bright enough to see by at 6
 * meters (well-lit, not marginal) and DIM light out to
 * AT LEAST 12 meters (12 m is the floor). The exact
 * intensity / decay / distance values are Background's
 * to set WITHIN those bounds, not invented here — with
 * one flagged tension to reconcile: the candle is now
 * 0xffb45e / intensity 30 / distance 22 / decay 2
 * (raised by Fill-in 2766045, headroom reserved for the
 * torch), so a torch dimming out at exactly 12 m would
 * be a step back in distance; the torch must beat the
 * candle OVERALL (intensity/decay carry it). A hand
 * model for the torch, if any, is Background's too
 * (candle holds left, umbrella right — torch placement
 * is theirs). The starting candle ALREADY went brighter
 * (that same Fill-in landing) — with the constraint
 * that the torch STAYS brighter than the candle, so
 * Background tunes both together.
 *
 * UI DEPENDENCY, RESOLVED (UI fe7b304, DEV-verified):
 * the fire-route pill lives in the lit-fire menu — which
 * NOW opens in every state (the lit-menu fix landed
 * before this API, so the pill's host is ready). The pill
 * itself is UI's next step, on DEV's signal with this
 * API's name + item + state + query + count. The
 * inventory Light button (App, this landing) covers the
 * flint route only, so torches are lightable without
 * waiting for the pill.
 */

import { ITEMS } from './recipes';
import { PersonalInventory } from './inventory';

/** Lighting route taken by a successful batch. */
export type TorchLightMethod = 'fire' | 'flint';

/**
 * Batch outcome. `count` is the feedback number UI asked
 * for: how many torches lit (0 on failure). `reason` is
 * player-facing on failure only.
 */
export type LightTorchesOutcome =
  | { lit: true; method: TorchLightMethod; count: number }
  | { lit: false; count: 0; reason: string };

/**
 * What the shell passes in. `litFirePresent` is fire
 * presence as input (like station presence): true when
 * the player is lighting at a lit fire the shell has
 * selected — the pill's fire. The inventory button passes
 * false (flint route only) so no range is invented.
 */
export interface TorchLightContext {
  litFirePresent: boolean;
}

/**
 * Light EVERY carried unlit torch in one batch, by
 * whichever route is available (fire first, else flint +
 * stone). Flint and stone are KEPT. Returns the count lit
 * for feedback; failure touches nothing and names the
 * missing requirement.
 */
export function lightTorches(
  inventory: PersonalInventory,
  context: TorchLightContext,
): LightTorchesOutcome {
  const count = inventory.count(ITEMS.torch);
  if (count <= 0) {
    return { lit: false, count: 0, reason: 'No unlit torch carried.' };
  }
  let method: TorchLightMethod | null = null;
  if (context.litFirePresent) {
    method = 'fire';
  } else if (
    inventory.count(ITEMS.flint) > 0 &&
    inventory.count(ITEMS.riverStone) > 0
  ) {
    method = 'flint';
  }
  if (method === null) {
    return {
      lit: false,
      count: 0,
      reason: 'Needs flint + river-stone, or a lit fire.',
    };
  }
  // Clone-simulate: a failed grant must not strand torches
  // half-converted (net-zero weight makes failure near
  // impossible, but the guarantee is free).
  const trial = inventory.clone();
  trial.remove(ITEMS.torch, count);
  const trialGrant = trial.addPartial(ITEMS.litTorch, count);
  if (trialGrant.granted !== count) {
    return {
      lit: false,
      count: 0,
      reason: 'No room for lit torches.',
    };
  }
  inventory.remove(ITEMS.torch, count);
  inventory.addPartial(ITEMS.litTorch, count);
  return { lit: true, method, count };
}

// ---------------------------------------------------------------------------
// Placed torches (Adam, DEV chat 2026-10-27: "She should also
// be able to place torches, to light an area or path" + "Or
// pick them back up"). This EXTENDS the carried-torch piece;
// placeable CANDLES are still later and distinct — placed
// torches are not candles.
//
// RULES (Adam's, via DEV):
// - PLACE: a carried LIT torch ('lit-torch') leaves the
//   inventory and becomes a placed torch at her position.
//   Placed torches are LIT — she places light, not sticks.
//   An unlit torch can never be placed (placeTorch counts
//   litTorch only).
// - PICK UP: a placed torch returns to inventory as
//   'lit-torch' — lit, not unlit. Picking it back up does
//   not unlight it.
// - NO BURNOUT EXTENDED (flagged): placed torches stay lit
//   like carried ones (Adam pinned no burnout for torches;
//   if placed torches should burn out, that is a new
//   ruling, not assumed — no duration code lives here).
// - SAVE: placed torches persist across saves (save.ts
//   SavedTorch, trap-save pattern: format now, App wiring
//   once Background's entity lands).
//
// LANE BOUNDARY: Systems owns ONLY the inventory grants
// below + the save shape. Background owns the placed-torch
// entity + its light (id scheme, renderer marker, chip
// projection source — DEV coordinates; see the report).
// The shell hands placeTorch's record to Background's
// place call and removes the placed entity only when
// pickupTorch grants (mirror of the pile pickup rule:
// take granted only, so a full pack leaves the placed
// torch where it is).
//
// NO HUNGER GATE (lane call, flagged): place/pickup are
// inventory <-> world moves, like drop/pickup — not
// builds. Placing a torch is not crafting it (crafting
// stays hunger-gated through executeCraft).
//
// QUANTITIES (lane call, flagged for pin pass): one torch
// per press, both directions (V1 drop precedent: one per
// press). Position arrives as params — systems never knows
// where she is (piles precedent).
//

/**
 * A placed torch, as handed to Background's place call.
 * Singular by definition: one press places one torch.
 * `item` is always 'lit-torch' (see rules above).
 */
export interface PlacedTorch {
  item: string;
  x: number;
  z: number;
}

/**
 * Place outcome. `torch` is the record the shell hands to
 * Background's place call; `reason` is player-facing on
 * failure only. Failure touches nothing.
 */
export type PlaceTorchOutcome =
  | { placed: true; torch: PlacedTorch }
  | { placed: false; reason: string };

/**
 * Move one carried LIT torch out of the inventory into a
 * placed-torch record at (x, z). Validates before
 * mutating (finite position, lit torch carried), so a
 * failed place consumes nothing.
 */
export function placeTorch(
  inventory: PersonalInventory,
  x: number,
  z: number,
): PlaceTorchOutcome {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { placed: false, reason: 'Invalid position.' };
  }
  if (inventory.count(ITEMS.litTorch) <= 0) {
    return { placed: false, reason: 'No lit torch carried.' };
  }
  inventory.remove(ITEMS.litTorch, 1);
  return { placed: true, torch: { item: ITEMS.litTorch, x, z } };
}

/**
 * Grant for picking a placed torch back up: 1 = the torch
 * is back in the pack as 'lit-torch' (shell removes the
 * placed entity); 0 = pack full, the placed torch stays
 * where it is (pile-pickup rule: take granted only).
 * The grant is always the LIT form — picking up never
 * unlights a torch.
 */
export function pickupTorch(inventory: PersonalInventory): {
  granted: number;
} {
  const grant = inventory.addPartial(ITEMS.litTorch, 1);
  return { granted: grant.granted };
}
