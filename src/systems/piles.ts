/**
 * Silent Earth — ground piles for harvest overflow (player-systems
 * lane, Adam's order 2026-10-26: "for harvestables that don't fit,
 * show them on the ground so we can pick them up later").
 *
 * SCOPE — systems only, pure, no game imports, no engine state:
 * - A pile is MANY kinds at one world position (multi-kind
 *   model, Adam 2026-10-27 — the one-kind model is
 *   SUPERSEDED): { id, stacks, x, z }, stacks one entry per
 *   kind { item, quantity }[] in first-dropped order.
 *   Kind ids are NORMALIZED (see inventory.ts) — a pile
 *   never carries an UPPER id, exactly like inventory
 *   stacks and save documents. A single-kind record
 *   (GroundPile { item, quantity, x, z }) is NOT the pile
 *   entity: it is the drop/overflow record handed to
 *   pileState.drop(), which merges it into the pile at
 *   those coords.
 * - grantWithOverflow() is the harvest path: grant what fits via
 *   addPartial(), pile the remainder at the harvest site. The
 *   harvest listener (Background's change) calls it once per
 *   yield and hands a non-null pile to the pile entity spawner.
 * - grantFromPile() is the pickup path: the same addPartial()
 *   underneath, so pickup grants what fits and the remainder
 *   STAYS in the pile — never vanishes, never duplicates.
 * - UNIT (since 2026-10-27): "what fits" is WEIGHT in pounds
 *   (inventory.ts weight model) — no code change was needed
 *   here, because both paths already delegate to addPartial(),
 *   which now grants floor(free weight / item weight).
 * - dropFromInventory() is the drop path (Adam's "next pass"
 *   brief, 2026-10-26): remove a carried quantity and return
 *   the GroundPile record for the shell to hand to pileState's
 *   spawn. Per-drop record, no merge here (same rule as
 *   overflow — merging lives in the entity layer). Dropped
 *   piles ride the same pile save wiring as overflow piles;
 *   no separate save handling exists or is needed. The shell
 *   passes the drop position (its player position) and owns
 *   any wardrobe consequence: dropping a worn garment is a
 *   plain removal here, and its worn bonus already
 *   self-cancels when its carried count hits 0 — the shell
 *   decides whether to unwear it in the wardrobe as well.
 *
 * CONTRACTS FOR THE OTHER LANES (read before wiring):
 * - Conservation: granted + piled === the yield, and granted +
 *   remaining === the original pile, across every step. These
 *   functions never create or destroy items; a probe asserts it.
 * - Source spent: when a harvest yields a pile, the source is
 *   SPENT (Background's listener consumes it). If the source
 *   stayed harvestable, she could re-harvest the same yield on
 *   top of the pile and duplicate items. Partial grant is not
 *   "try again later" — the remainder is the pile, and the
 *   pile is the retry.
 * - One pile per spot: this module does not merge piles.
 *   Two remainders at the same spot are two drop records,
 *   and the entity layer merges them into ONE pile at that
 *   spot (kinds added or topped up) — merging here would
 *   duplicate the entity layer's job.
 * - Persistence: piles ride the save document (see save.ts:
 *   SaveData.piles, version 1, stacks shape, optional on
 *   read so old saves load with piles: []). Old
 *   single-kind documents migrate on read: entries are
 *   grouped by rounded coords into one stacks pile per
 *   spot, kinds in saved order, nothing dropped (same rule
 *   as pileState.restore() for old-shape inputs).
 * - Positions are world x/z numbers, finite, in the same frame
 *   as player/fire/house positions. This module never interprets
 *   them beyond passing them through.
 * - SELECTIVE TAKE + DEPOSIT, KIND-SCOPED (Adam's full pile
 *   ruling, 2026-10-27, UI's chip-menu shape via DEV, grant
 *   reworked 2026-10-27 for the multi-kind entity): a
 *   world-anchored pile chip opens Take one / Take all /
 *   Deposit one / Deposit all, all scoped to ONE KIND in
 *   the pile (USE + desktop button keep take-all as the
 *   fast path — see the take-all note below; no
 *   exact-number picker — the menu covers it). Systems'
 *   half, in this file: takeFromPile() + handlePileTakeRequest()
 *   for the take side (an exact requested quantity of a
 *   NAMED kind, capped at that kind's quantity in the pile,
 *   partial by weight as today, remainder stays in the pile),
 *   and depositIntoPile() for the deposit side (remove a
 *   carried quantity of a NAMED kind and return the record
 *   for the shell to hand to pileState.drop() — the same
 *   shell-composes-record-plus-drop shape as the existing
 *   drop path; drop merges BY COORDS, so the kind is added
 *   to the pile at those coords or tops up its entry —
 *   never a second pile at the spot). MERGE RULE
 *   (confirmed at origin in pileState.ts, not assumed):
 *   drop() merges by coords rounded to 2 decimals in the
 *   spot-keyed pile id (pile:<x.toFixed(2)>,<z.toFixed(2)>)
 *   — so a deposit record reusing the pile's EXACT x/z
 *   lands in that pile whatever kind it carries, and a
 *   deposit aimed at a pile that is gone by the time drop()
 *   runs still lands as a pile at those coords (drop
 *   creates when nothing matches) — nothing vanishes, and
 *   the shell's chip should refresh from pileState rather
 *   than assuming the pile survived.
 * - TAKE-ALL FAST PATH (whole pile, DEV brief 2026-10-27):
 *   handlePilePickupRequest() — the USE + desktop take-all
 *   listener — takes the WHOLE pile: kinds in stacks order,
 *   partial by weight as today, remainder stays in the
 *   pile, pile deleted + 'pile:removed' when no kinds
 *   remain. The menu's Take all is per-kind
 *   (handlePileTakeRequest with the kind's quantity) and
 *   is unaffected. PARITY (Adam, 2026-10-27, direct:
 *   "Desktop functionality must match phone
 *   functionality"): touch USE and the desktop button
 *   emit the SAME 'pile:pickup-requested' event to this
 *   one listener, so the grant matches by construction
 *   on both — and the desktop button's label names the
 *   whole pile (not just the first kind) when the pile
 *   holds many kinds, so the label never understates
 *   the action.
 */

import {
  PersonalInventory,
  normalizeItemId,
  type PartialGrant,
} from './inventory';
import type { ItemId } from './recipes';

/** One item stack lying on the ground at one world position. */
export interface GroundPile {
  item: ItemId;
  quantity: number;
  x: number;
  z: number;
}

/**
 * One kind inside a multi-kind pile (structural mirror of the
 * game layer's PileStack — systems never imports game).
 */
export interface PileStack {
  item: ItemId;
  quantity: number;
}

/**
 * A multi-kind pile: one spot holding one entry per kind, in
 * first-dropped order. Structural mirror of the game layer's
 * Pile (id + stacks + x/z) — the shell passes pileState
 * piles/targets straight in (extra fields, e.g. distance or
 * interim legacy item/quantity, are ignored by structural
 * typing). Kind ids are NORMALIZED on Systems boundaries.
 */
export interface MultiKindPile {
  id: string;
  stacks: PileStack[];
  x: number;
  z: number;
}

/**
 * Build a pile. Normalizes the id (UPPER in, kebab out) and
 * throws on a bad shape — positive-integer quantity, finite
 * coordinates — exactly like the other constructors' validation:
 * a pile is created by code, not parsed from untrusted input
 * (parsing lives in save.ts's deserialize, which returns null
 * instead of throwing).
 */
export function createGroundPile(
  item: ItemId,
  quantity: number,
  x: number,
  z: number,
): GroundPile {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`pile quantity must be a positive integer.`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    throw new Error(`pile position must be finite numbers.`);
  }
  return { item: normalizeItemId(item), quantity, x, z };
}

/**
 * Harvest split: what fit + the pile for the rest (null when
 * everything fit). The harvest listener's one call per yield:
 *   const { granted, pile } = grantWithOverflow(yieldItem,
 *     yieldQty, inventory, harvestX, harvestZ);
 *   if (pile) spawnPileEntity(pile);
 * granted + pile?.quantity === yieldQty, always.
 */
export interface HarvestOverflow {
  granted: number;
  pile: GroundPile | null;
}

export function grantWithOverflow(
  item: ItemId,
  quantity: number,
  inventory: PersonalInventory,
  x: number,
  z: number,
): HarvestOverflow {
  const grant: PartialGrant = inventory.addPartial(item, quantity);
  return {
    granted: grant.granted,
    pile:
      grant.remainder > 0
        ? createGroundPile(grant.item, grant.remainder, x, z)
        : null,
  };
}

/**
 * Pickup split: grant what fits from a pile; the returned pile
 * is null when fully taken (despawn the entity) or the same
 * position with the reduced quantity (update the entity).
 * granted + pile?.quantity === the original quantity, always —
 * a remainder never vanishes and a pickup never duplicates.
 */
export interface PileGrant {
  granted: number;
  pile: GroundPile | null;
}

/**
 * 'pile:pickup-requested' listener logic (Systems' listener,
 * landed 2026-10-26 on DEV's bridge-out signal, b23a042 —
 * the shell bridge is out, so this is the SOLE granter on
 * the event; a second subscriber would double-grant). The
 * shell registers this on the bus and owns refresh + save
 * + feedback from the outcome; the grant logic itself
 * lives here, beside grantFromPile.
 *
 * Sequence (whole pile, DEV brief 2026-10-27): look the
 * pile up; for EACH kind in stacks order, grant what fits
 * by weight (free weight shrinks as kinds are taken, so
 * later kinds get whatever room remains); take EXACTLY
 * the granted amount of each kind (partial: the remainder
 * stays); report. Stale/missing pile: silent nothing
 * (found: false). Full pack: granted 0, NO take calls at
 * all, and the shell shows the Pack-full note without
 * refresh or save. The take's remaining is authoritative
 * per kind (it owns the pile); in single-threaded
 * execution the get → grant → take sequence cannot
 * interleave, so take.taken === granted in practice — the
 * outcome still reports take's numbers, never invented
 * ones. A kind taken to zero drops out of the stacks
 * (entity-side); a pile with no kinds left is deleted
 * with 'pile:removed'. The outcome carries per-kind
 * taken + remaining lists (a single item/quantity cannot
 * represent a whole-pile take truthfully) — the shell's
 * feedback joins them. PileStore is structural on
 * purpose: Background's pileState satisfies it without
 * systems importing game modules (stacks/x/z +
 * kind-scoped take; the store pile's id is addressed by
 * the pileId argument, not read here).
 */
export interface PileStore {
  get(
    id: string,
  ): {
    id: string;
    stacks: { item: string; quantity: number }[];
    x: number;
    z: number;
  } | null | undefined;
  take(
    id: string,
    item: string,
    quantity: number,
  ): { taken: number; remaining: number };
}

export type PilePickupOutcome =
  | { found: false; pileId: string }
  | {
      found: true;
      pileId: string;
      /** Kinds actually taken, in the pile's stacks order. Empty when the pack was full. */
      taken: { item: ItemId; granted: number }[];
      /** Total items taken across kinds. */
      granted: number;
      /** Kinds left in the pile after the take, in stacks order. Empty when the pile was deleted. */
      remaining: { item: ItemId; quantity: number }[];
      /** Pile position, for the shell's anchored feedback (same values the bridge used). */
      x: number;
      z: number;
    };

export function handlePilePickupRequest(
  pileId: string,
  store: PileStore,
  inventory: PersonalInventory,
): PilePickupOutcome {
  const pile = store.get(pileId);
  if (!pile || pile.stacks.length === 0) {
    return { found: false, pileId };
  }
  const taken: { item: ItemId; granted: number }[] = [];
  const remaining: { item: ItemId; quantity: number }[] = [];
  let total = 0;
  // Copy the stacks list: store.take() splices kinds out of
  // the live pile as they empty, and iterating the live
  // array would SKIP the kind after every fully-taken one.
  // Each stack object is visited once, so sharing the
  // objects is safe — only the list itself is copied.
  for (const stack of [...pile.stacks]) {
    // Defensive only: the entity never holds a zero
    // stack (kinds drop out at zero) — and addPartial
    // throws on a non-positive quantity, so skip one
    // rather than crashing the listener on bad state.
    if (stack.quantity <= 0) continue;
    const grant = grantFromPile(
      { item: stack.item, quantity: stack.quantity, x: pile.x, z: pile.z },
      inventory,
    );
    if (grant.granted <= 0) {
      // Pack full (or this kind cannot fit): nothing taken
      // for this kind, and NO take call — same discipline
      // as the single-kind path. Later kinds face the same
      // full pack, so they grant 0 too; the loop still
      // visits them so `remaining` lists every kind left.
      remaining.push({
        item: normalizeItemId(stack.item),
        quantity: stack.quantity,
      });
      continue;
    }
    // VERBATIM stack item: pileState matches kinds
    // verbatim (see handlePileTakeRequest's spelling note).
    const take = store.take(pileId, stack.item, grant.granted);
    taken.push({ item: normalizeItemId(stack.item), granted: grant.granted });
    total += grant.granted;
    if (take.remaining > 0) {
      remaining.push({
        item: normalizeItemId(stack.item),
        quantity: take.remaining,
      });
    }
    // take.remaining === 0: the kind dropped out of the
    // stacks; when it was the last kind, the entity
    // deleted the pile with 'pile:removed'.
  }
  return {
    found: true,
    pileId,
    taken,
    granted: total,
    remaining,
    x: pile.x,
    z: pile.z,
  };
}

/**
 * Drop path: remove a carried quantity and return the pile
 * record for the shell to spawn (pileState.spawn or equivalent;
 * the shell passes its player position as x/z — systems never
 * knows the player position itself).
 *
 * Failure is a throw, mirroring remove(): she doesn't carry
 * that many, the quantity isn't a positive integer, or the
 * position isn't finite — the shell catches, shows a note,
 * and no pile is spawned. ATOMIC: the pile record is built
 * (validating everything) BEFORE the removal, and remove()
 * itself throws before mutating on insufficiency — so a
 * failed drop leaves the inventory exactly as it was, never
 * negative, never partially removed, and never duplicated
 * (removed count + pile quantity === the held count change
 * is exactly the requested quantity, or nothing at all).
 * V1 quantity is one per press (the UI Drop action calls
 * with 1; Adam can correct the rule later) — the function
 * takes the quantity, so a later rule change needs no
 * systems change. Normalized ids throughout, as everywhere
 * in this module.
 */
export function dropFromInventory(
  item: ItemId,
  quantity: number,
  inventory: PersonalInventory,
  x: number,
  z: number,
): GroundPile {
  const pile = createGroundPile(item, quantity, x, z);
  inventory.remove(item, quantity);
  return pile;
}

export function grantFromPile(
  pile: GroundPile,
  inventory: PersonalInventory,
): PileGrant {
  const grant: PartialGrant = inventory.addPartial(pile.item, pile.quantity);
  return {
    granted: grant.granted,
    pile:
      grant.remainder > 0
        ? { item: pile.item, quantity: grant.remainder, x: pile.x, z: pile.z }
        : null,
  };
}

/**
 * Selective take: grant an exact requested quantity of a
 * NAMED kind from a multi-kind pile (the chip menu's Take
 * one / Take all — Take all passes the kind's quantity, or
 * any larger number; the grant caps at the kind).
 * Weight capacity is honored exactly as in grantFromPile:
 * the grant is min(requested, kind quantity, what fits by
 * weight), and granted + pile?.quantity === the kind's
 * original quantity, always — a remainder never vanishes
 * and a take never duplicates. NOTE on the returned pile:
 * it carries the TAKEN KIND's remainder (or null when the
 * kind is fully taken), not the whole pile — the whole
 * pile's other kinds are untouched by this call, and the
 * handler reports the take's remaining, not this record.
 * An invalid requested quantity (not a positive integer)
 * throws, like the other constructors here; a request
 * against a kind the pile does not hold grants 0 with a
 * null pile (the handler below reports absent kinds
 * before this is ever called). Kind matching normalizes
 * both sides (a spelling variant in the stacks still
 * matches); the grant itself runs on the normalized kind.
 */
export function takeFromPile(
  pile: MultiKindPile,
  kind: ItemId,
  quantity: number,
  inventory: PersonalInventory,
): PileGrant {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`take quantity must be a positive integer.`);
  }
  const wantedKind = normalizeItemId(kind);
  const stack = pile.stacks.find(
    (entry) => normalizeItemId(entry.item) === wantedKind,
  );
  if (!stack) {
    return { granted: 0, pile: null };
  }
  const wanted = Math.min(quantity, stack.quantity);
  if (wanted <= 0) {
    return { granted: 0, pile: null };
  }
  const grant: PartialGrant = inventory.addPartial(wantedKind, wanted);
  const remaining = stack.quantity - grant.granted;
  return {
    granted: grant.granted,
    pile:
      remaining > 0
        ? { item: wantedKind, quantity: remaining, x: pile.x, z: pile.z }
        : null,
  };
}

/**
 * Chip-menu take handler, mirroring handlePilePickupRequest's
 * sequence with a requested quantity of a NAMED kind: look
 * the pile up; grant the request (capped at the kind,
 * partial by weight); take EXACTLY the granted amount of
 * that kind from the pile (partial: the remainder stays);
 * report. Stale/missing pile, or a kind the pile no longer
 * holds: silent nothing (found: false) — the menu
 * refreshes from pileState. Full pack: granted 0, NO take
 * call, and the shell shows the Pack-full note without
 * refresh or save — same as the take-all listener.
 * `requested` in the outcome is the kind-scoped request
 * (min(requested, kind quantity)), so menu feedback can
 * say "Took N of M" truthfully; the take's remaining is
 * authoritative for the outcome (it owns the pile — a
 * kind taken to zero drops out of the stacks, and a pile
 * with no kinds left is deleted with 'pile:removed').
 * The shell registers no bus listener for this — the chip
 * menu calls it directly with the tapped pile's id, the
 * tapped kind, and the menu's quantity (1 for Take one,
 * the kind's quantity for Take all). SPELLING NOTE: kind
 * matching normalizes, but the store take passes the
 * matched stack's VERBATIM item — pileState matches kinds
 * verbatim, so passing the normalized form of a
 * variant-spelled stack would take nothing.
 */
export type PileTakeOutcome =
  | { found: false; pileId: string }
  | {
      found: true;
      pileId: string;
      item: ItemId;
      /** Kind-scoped request: min(requested, kind quantity). */
      requested: number;
      granted: number;
      remaining: number;
      /** Pile position, for the shell's anchored feedback. */
      x: number;
      z: number;
    };

export function handlePileTakeRequest(
  pileId: string,
  kind: ItemId,
  quantity: number,
  store: PileStore,
  inventory: PersonalInventory,
): PileTakeOutcome {
  const pile = store.get(pileId);
  if (!pile) {
    return { found: false, pileId };
  }
  const wantedKind = normalizeItemId(kind);
  const stack = pile.stacks.find(
    (entry) => normalizeItemId(entry.item) === wantedKind,
  );
  if (!stack) {
    return { found: false, pileId };
  }
  const wanted = Math.min(quantity, stack.quantity);
  const grant = takeFromPile(
    { id: pile.id, stacks: pile.stacks, x: pile.x, z: pile.z },
    kind,
    quantity,
    inventory,
  );
  if (grant.granted <= 0) {
    return {
      found: true,
      pileId,
      item: wantedKind,
      requested: wanted,
      granted: 0,
      remaining: stack.quantity,
      x: pile.x,
      z: pile.z,
    };
  }
  const take = store.take(pileId, stack.item, grant.granted);
  return {
    found: true,
    pileId,
    item: wantedKind,
    requested: wanted,
    granted: grant.granted,
    remaining: take.remaining,
    x: pile.x,
    z: pile.z,
  };
}

/**
 * Deposit path: move a carried quantity of a NAMED kind into
 * a pile (the chip menu's Deposit one / Deposit all —
 * Deposit all passes the carried count; the menu disables
 * deposit when she carries none of it). ANY carried kind
 * may be deposited: the kind is added to the pile as a new
 * entry or tops up its existing entry — the one-kind
 * model's no-item-parameter shape retires with it (a
 * deposit of "the pile's own item" is meaningless when a
 * pile holds many kinds). The pile argument supplies the
 * coords (and the shell's refresh identity); it does NOT
 * gate the kind — a kind the pile does not yet hold is a
 * new entry, not an error.
 *
 * ATOMIC, mirroring dropFromInventory(): the record is built
 * (validating kind + quantity + coords) BEFORE the removal,
 * and remove() itself throws before mutating on
 * insufficiency — so a failed deposit leaves the inventory
 * exactly as it was. The shell hands the returned record
 * to pileState.drop() (or spawnPile(), same delegation) —
 * which merges it into the pile at those coords by the
 * coords rule (see the header's merge note), or creates a
 * pile at those coords when the original is gone. Systems
 * never touches the entity layer: merging lives in
 * pileState, as everywhere else here.
 */
export function depositIntoPile(
  pile: MultiKindPile,
  kind: ItemId,
  quantity: number,
  inventory: PersonalInventory,
): GroundPile {
  const record = createGroundPile(kind, quantity, pile.x, pile.z);
  inventory.remove(kind, quantity);
  return record;
}
