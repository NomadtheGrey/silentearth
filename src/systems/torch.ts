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
 * ON DEMAND (Adam, 2026-11-03, the settled shape after
 * two earlier coats were struck): torches ride in her
 * pack UNLIT — 'it makes no sense to carry lit torches
 * in pretty much any container' — and 'lit-torch' means
 * the one in her hand. She lights them ON DEMAND off
 * the candle she always carries (the candle ROUTE in
 * lightTorches below): no gain conversion, no boot
 * sweep; a restored pack's unlit torches are correct
 * as they stand.
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
 * - Candle: the candle in her hand (Adam, 2026-11-03).
 *   ALWAYS available — no items, nothing consumed. The
 *   auto order tries it LAST; a door may name it
 *   directly via the context's route (see
 *   TorchLightContext).
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

import { ITEMS, type ItemId } from './recipes';
import { PersonalInventory } from './inventory';

/** Lighting route taken by a successful batch. */
export type TorchLightMethod = 'fire' | 'flint' | 'candle';

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
  /**
   * The route the DOOR asks for (Adam's on-demand
   * ruling, 2026-11-03): 'candle' is ALWAYS available
   * — she lights them off the candle in her hand,
   * nothing consumed, no flint, no stone, no fire
   * needed. 'fire' requires litFirePresent; 'flint'
   * requires flint + river-stone; a named route that
   * is not available fails with its reason rather
   * than falling through. UNSET keeps the standing
   * auto order (fire, then flint, then candle), so
   * existing doors see no change.
   */
  route?: TorchLightMethod;
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
  // BOTH pairs convert in the one press (the pitch
  // torch, 2026-11-07): the batch law is one press
  // lights every unlit torch she carries — pitch
  // torches included, each to its own lit form.
  const plainCount = inventory.count(ITEMS.torch);
  const pitchCount = inventory.count(ITEMS.pitchTorch);
  const count = plainCount + pitchCount;
  if (count <= 0) {
    return { lit: false, count: 0, reason: 'No unlit torch carried.' };
  }
  const fireAvailable = context.litFirePresent;
  const flintAvailable =
    inventory.count(ITEMS.flint) > 0 &&
    inventory.count(ITEMS.riverStone) > 0;
  let method: TorchLightMethod | null = null;
  if (context.route === 'candle') {
    method = 'candle';
  } else if (context.route === 'fire') {
    if (fireAvailable) method = 'fire';
  } else if (context.route === 'flint') {
    if (flintAvailable) method = 'flint';
  } else if (fireAvailable) {
    method = 'fire';
  } else if (flintAvailable) {
    method = 'flint';
  } else {
    // The candle in her hand: always there (Adam,
    // 2026-11-03 — torches light ON DEMAND). The auto
    // order tries it last so fire/flint behavior at
    // existing doors is unchanged.
    method = 'candle';
  }
  if (method === null) {
    return {
      lit: false,
      count: 0,
      reason:
        context.route === 'fire'
          ? 'No lit fire here.'
          : 'Needs flint + river-stone.',
    };
  }
  // Clone-simulate: a failed grant must not strand torches
  // half-converted (net-zero weight makes failure near
  // impossible, but the guarantee is free).
  const trial = inventory.clone();
  trial.remove(ITEMS.torch, plainCount);
  trial.remove(ITEMS.pitchTorch, pitchCount);
  const trialPlain = trial.addPartial(ITEMS.litTorch, plainCount);
  const trialPitch = trial.addPartial(ITEMS.litPitchTorch, pitchCount);
  if (trialPlain.granted !== plainCount || trialPitch.granted !== pitchCount) {
    return {
      lit: false,
      count: 0,
      reason: 'No room for lit torches.',
    };
  }
  inventory.remove(ITEMS.torch, plainCount);
  inventory.remove(ITEMS.pitchTorch, pitchCount);
  inventory.addPartial(ITEMS.litTorch, plainCount);
  inventory.addPartial(ITEMS.litPitchTorch, pitchCount);
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
// - PLACE: a carried torch leaves the inventory and
//   becomes a placed torch at her position. Placed
//   torches are LIT — she places light, not sticks: a
//   carried lit torch places as-is, and an unlit one
//   is lit in the act of setting it down (Adam,
//   2026-11-03, the on-demand ruling).
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
 * `item` is the LIT form placed — 'lit-torch', or
 * 'lit-pitch-torch' for a pitch torch (2026-11-07);
 * the item id IS the light profile's record, and
 * Background's place call keys its profile off it.
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
 * Move one carried torch out of the inventory into a
 * placed-torch record at (x, z): a carried LIT torch is
 * preferred; an UNLIT one is lit in the act of setting
 * it down, so the seated record is 'lit-torch' either
 * way. Validates before mutating (finite position, a
 * torch of either form carried), so a failed place
 * consumes nothing.
 */
export function placeTorch(
  inventory: PersonalInventory,
  x: number,
  z: number,
  prefer?: 'pitch' | 'plain',
): PlaceTorchOutcome {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return { placed: false, reason: 'Invalid position.' };
  }
  // The kind ladder (the pitch torch, 2026-11-07): a
  // carried LIT torch of the preferred kind first,
  // then the other kind's lit form, then an unlit
  // torch lit in the act of setting it down (Adam,
  // 2026-11-03 — the placed record is lit either
  // way), preferred kind first. Default: pitch leads
  // (the better light is the one she sets down when
  // the verb does not choose).
  const pairs =
    prefer === 'plain'
      ? [
          { lit: ITEMS.litTorch, unlit: ITEMS.torch },
          { lit: ITEMS.litPitchTorch, unlit: ITEMS.pitchTorch },
        ]
      : [
          { lit: ITEMS.litPitchTorch, unlit: ITEMS.pitchTorch },
          { lit: ITEMS.litTorch, unlit: ITEMS.torch },
        ];
  for (const pair of pairs) {
    if (inventory.count(pair.lit) > 0) {
      inventory.remove(pair.lit, 1);
      return { placed: true, torch: { item: pair.lit, x, z } };
    }
  }
  for (const pair of pairs) {
    if (inventory.count(pair.unlit) > 0) {
      inventory.remove(pair.unlit, 1);
      return { placed: true, torch: { item: pair.lit, x, z } };
    }
  }
  return { placed: false, reason: 'No torch carried.' };
}

/**
 * Grant for picking a placed torch back up: 1 = the torch
 * is back in the pack as 'lit-torch' (shell removes the
 * placed entity); 0 = pack full, the placed torch stays
 * where it is (pile-pickup rule: take granted only).
 * The grant is always the LIT form — picking up never
 * unlights a torch.
 */
export function pickupTorch(
  inventory: PersonalInventory,
  item: string = ITEMS.litTorch,
): {
  granted: number;
} {
  // The grant is the placed record's own lit kind
  // (the pitch torch, 2026-11-07): picking up never
  // unlights a torch, and never changes its kind. A
  // record naming no lit torch grants nothing.
  if (item !== ITEMS.litTorch && item !== ITEMS.litPitchTorch) {
    return { granted: 0 };
  }
  const grant = inventory.addPartial(item as ItemId, 1);
  return { granted: grant.granted };
}
