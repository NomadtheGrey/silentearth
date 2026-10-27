/**
 * Dropped-pile world entities — harvest overflow (Adam, 2026-10-26),
 * MULTI-KIND model (Adam, 2026-10-27, verbatim: "No, each pile
 * can have many kinds" — the one-kind-per-pile model is SUPERSEDED).
 *
 * A harvest that does not fit no longer fails all-or-nothing: the
 * harvest COMPLETES (the plant shrinks/regrows, the log is taken, the
 * tree fells, exactly as a fitting harvest), what FITS goes into
 * inventory, and what DOESN'T fit drops as a VISIBLE ground pile at
 * the harvested target's spot, pick-up-able later (proximity USE
 * when room exists).
 *
 * SEAM (Adam-pinned 2026-10-27, coordinated through DEV — Systems
 * builds kind-scoped pickup grant + save migration against this
 * shape; UI redesigns its chip + menu against it):
 * - Pile: { id, stacks, x, z }. stacks is ONE ENTRY PER KIND:
 *   { item, quantity }[] in first-dropped order. Counts per kind
 *   are preserved exactly (Adam's example: one pile holding
 *   13 peat moss + 6 snap wood keeps both counts).
 * - id = `pile:<x.toFixed(2)>,<z.toFixed(2)>` — SPOT-KEYED, no item
 *   in it (the old pile:<item>:coords shape is gone). Piles MERGE
 *   BY COORDS: a drop at a spot with an existing pile adds its
 *   kind to that pile (new entry) or tops up the kind's entry —
 *   never a second pile at the same spot. Merge granularity is
 *   the 2-decimal rounding (1 cm), same as before.
 * - take(id, item, quantity) removes from a NAMED kind; a kind at
 *   zero drops out of the stacks; a pile with no kinds left is
 *   deleted and emits 'pile:removed'. take's `remaining` is the
 *   taken kind's remainder (granted + remaining === the kind's
 *   original, per Systems' gated brief).
 * - snapshot()/restore() carry the stacks shape. restore() also
 *   accepts the OLD single-kind shape { item, quantity, x, z }:
 *   each old pile becomes a one-kind stack, REKEYED to the spot
 *   id — so old piles at one spot merge into ONE pile on restore,
 *   and no pile is dropped in migration. The existing drop()-
 *   based boot restore gets the same merge for free (drop merges
 *   by coords now). The save-FORMAT migration itself is Systems'
 *   half (gated on this entity); the proposal relayed to DEV is
 *   the same rule: group old GroundPile entries by rounded coords
 *   into one stacks pile per spot, kinds in saved order.
 * - Events: 'pile:dropped' (new pile only), 'pile:changed'
 *   (kind added, kind topped up, or partial take), 'pile:removed'
 *   (last kind gone). The proximity tracker carries piles
 *   separately as 'piles:inRange' — piles are NOT harvest targets
 *   and never ride 'harvest:inRange'.
 * - Pickup grant is SYSTEMS' half (their brief): they consume
 *   take() here and emit their own grant; this module grants
 *   nothing. 'pile:pickup-requested' { pileId } is defined in
 *   events.ts for UI's pile button → Systems' listener.
 *
 * INTERIM LEGACY FIELDS (do not build new code on them): Pile and
 * PileTarget still carry `item` + `quantity`, always the FIRST
 * stack's entry. They exist so the pre-redesign readers keep
 * compiling and behaving in the window between this entity
 * landing and Systems' kind-scoped grant + UI's multi-kind menu
 * landing (Systems' PileStore is structural on get/take; App's
 * saveNow map, menu, and chip read item/quantity). Interim
 * semantics: every legacy reader operates on the first kind only.
 * REMOVE item/quantity when Systems' grant + UI's menu land.
 * KNOWN INTERIM LIMIT, flagged to DEV: App's saveNow maps the
 * snapshot through the legacy fields, so until Systems' save
 * migration lands, a mixed pile saves as its first kind only —
 * non-first kinds are lost across a save in the interim window.
 * Merge #9 waits for the full multi-kind work, so this never
 * reaches main; it is still flagged, not hidden.
 *
 * Deliberately NOT invented: no pile cap, no expiry, no despawn —
 * piles persist until picked up (save persistence is Systems'
 * brief). A new world is a new pile set: pileState.clear() runs in
 * the renderer's setWorldGen, like the other placed-state clears.
 * Piles are gameplay state, not worldgen — no seed, no RNG here.
 * Item ids are NOT normalized here (the alias table lives in
 * Systems and is NOT duplicated) — kinds key on the string as
 * passed, so two spellings of one item at one spot are two kinds
 * until a Systems boundary normalizes them (pre-existing caveat,
 * unchanged from the one-kind merge rule).
 *
 * DROP PATH (Adam 2026-10-26, "for next pass"): spawnPile(record)
 * is the drop handler's entry point — it validates a GroundPile
 * record and delegates to drop(), so a dropped pile IS an
 * overflow pile (same merge, events, visuals, pickup). UI's drop
 * V1 already works via drop() directly; spawnPile is the
 * intention-revealing wrapper for the shell to adopt.
 */

import { bus } from './events';

/** One kind inside a pile: the item + how many of it are piled. */
export interface PileStack {
  item: string;
  quantity: number;
}

export interface Pile {
  id: string;
  stacks: PileStack[];
  x: number;
  z: number;
  /**
   * INTERIM legacy: the FIRST stack's entry, kept so
   * pre-redesign readers (Systems' PileStore, App's saveNow map,
   * menu, chip) keep compiling. New code must read stacks.
   * Remove when Systems' kind-scoped grant + UI's multi-kind
   * menu land.
   */
  item: string;
  /** INTERIM legacy: the FIRST stack's quantity. See `item`. */
  quantity: number;
}

/** Pile as carried on the proximity channel (distance added). */
export interface PileTarget {
  id: string;
  stacks: PileStack[];
  x: number;
  z: number;
  distance: number;
  /** INTERIM legacy: the FIRST stack's entry. See Pile.item. */
  item: string;
  /** INTERIM legacy: the FIRST stack's quantity. See Pile.item. */
  quantity: number;
}

/** Spot-keyed pile id: coords rounded to 2 decimals, no item. */
export function pileIdFor(x: number, z: number): string {
  return `pile:${x.toFixed(2)},${z.toFixed(2)}`;
}

/**
 * A pile record as handed to spawnPile — the same shape as
 * Systems' GroundPile { item, quantity, x, z } (structural
 * typing: a GroundPile value passes without importing Systems —
 * the game layer must not import the systems layer).
 */
export interface PileSpawn {
  item: string;
  quantity: number;
  x: number;
  z: number;
}

/**
 * An OLD single-kind pile as a restore input (pre-multi-kind
 * saves + the old snapshot shape): no stacks, just one kind.
 * restore() converts it to a one-kind stack and rekeys it to
 * the spot id. `id`, when present, is IGNORED (recomputed).
 */
export interface LegacyPile {
  item: string;
  quantity: number;
  x: number;
  z: number;
  id?: string;
}

/** Deep copy of a pile (stacks are copied, never shared). */
function copyPile(pile: Pile): Pile {
  return {
    ...pile,
    stacks: pile.stacks.map((s) => ({ ...s })),
  };
}

/** Deep copy of a pile target (stacks are copied, never shared). */
function copyTarget(pile: Pile, distance: number): PileTarget {
  return {
    ...pile,
    stacks: pile.stacks.map((s) => ({ ...s })),
    distance,
  };
}

/** Recompute the interim legacy fields from the first stack. */
function syncLegacy(pile: Pile): void {
  const first = pile.stacks[0];
  pile.item = first ? first.item : '';
  pile.quantity = first ? first.quantity : 0;
}

class PileState {
  private piles = new Map<string, Pile>();

  /**
   * Add quantity of item to the pile at (x, z), creating the
   * pile when the spot has none. Merges BY COORDS: the kind is
   * added as a new stack entry or tops up its existing entry.
   */
  private upsertKind(
    item: string,
    quantity: number,
    x: number,
    z: number,
  ): { pile: Pile; created: boolean } {
    const id = pileIdFor(x, z);
    let pile = this.piles.get(id);
    if (!pile) {
      pile = { id, stacks: [{ item, quantity }], x, z, item, quantity };
      this.piles.set(id, pile);
      return { pile, created: true };
    }
    const stack = pile.stacks.find((s) => s.item === item);
    if (stack) {
      stack.quantity += quantity;
    } else {
      pile.stacks.push({ item, quantity });
    }
    syncLegacy(pile);
    return { pile, created: false };
  }

  /**
   * Drop quantity of item at (x, z). Merges into the pile at
   * that spot (kind added or topped up); otherwise creates one.
   * Returns the pile, or null when quantity <= 0 (no pile for
   * nothing — callers only drop real remainders).
   */
  drop(item: string, quantity: number, x: number, z: number): Pile | null {
    if (quantity <= 0) return null;
    const { pile, created } = this.upsertKind(item, quantity, x, z);
    bus.emit(created ? 'pile:dropped' : 'pile:changed', copyPile(pile));
    return pile;
  }

  /**
   * Spawn a pile from a record — the DROP PATH entry point
   * (Adam 2026-10-26, "for next pass"). The shell's drop handler
   * hands it Systems' GroundPile record (player position, from
   * the drop handler) and it becomes a NORMAL pile: same visuals,
   * same merge rule, same events, same take() pickup path. No new
   * pile type, no separate drop entity — a dropped pile IS an
   * overflow pile, just with a different origin. Validates
   * (mirroring Systems' createGroundPile): non-empty string item,
   * positive-integer quantity, finite coords; anything else
   * returns null and creates nothing. Does NOT normalize the item
   * id (the alias table lives in Systems and is NOT duplicated
   * here) — callers pass Systems' normalized ids. Delegates to
   * drop().
   */
  spawnPile(record: PileSpawn): Pile | null {
    if (
      typeof record?.item !== 'string' ||
      record.item.length === 0 ||
      !Number.isInteger(record.quantity) ||
      record.quantity <= 0 ||
      !Number.isFinite(record.x) ||
      !Number.isFinite(record.z)
    ) {
      return null;
    }
    return this.drop(record.item, record.quantity, record.x, record.z);
  }

  get(id: string): Pile | null {
    return this.piles.get(id) ?? null;
  }

  snapshot(): Pile[] {
    return [...this.piles.values()].map(copyPile);
  }

  /**
   * Restore piles from a snapshot — the stacks shape, or the OLD
   * single-kind shape (migration). Each entry merges into the
   * pile at its coords by the drop rule: stacks entries add
   * their kinds, old entries become one-kind stacks, and old
   * piles at one spot merge into ONE pile (their ids are
   * recomputed from coords, never trusted). Invalid entries
   * (non-finite coords, empty item, non-positive-integer
   * quantity) are skipped, never created. Merges INTO current
   * state (callers wanting replace semantics clear() first).
   * Emits one event per touched pile ('pile:dropped' for a newly
   * created pile, 'pile:changed' for a modified one) and returns
   * the touched piles as copies.
   */
  restore(entries: ReadonlyArray<Pile | LegacyPile>): Pile[] {
    const touched = new Map<string, { pile: Pile; created: boolean }>();
    for (const entry of entries) {
      if (!entry || !Number.isFinite(entry.x) || !Number.isFinite(entry.z)) {
        continue;
      }
      const kinds: PileStack[] =
        'stacks' in entry && Array.isArray(entry.stacks)
          ? entry.stacks.filter(
              (s): s is PileStack =>
                typeof s?.item === 'string' &&
                s.item.length > 0 &&
                Number.isInteger(s.quantity) &&
                s.quantity > 0,
            )
          : typeof (entry as LegacyPile).item === 'string' &&
              (entry as LegacyPile).item.length > 0 &&
              Number.isInteger((entry as LegacyPile).quantity) &&
              (entry as LegacyPile).quantity > 0
            ? [
                {
                  item: (entry as LegacyPile).item,
                  quantity: (entry as LegacyPile).quantity,
                },
              ]
            : [];
      for (const kind of kinds) {
        const result = this.upsertKind(kind.item, kind.quantity, entry.x, entry.z);
        touched.set(result.pile.id, result);
      }
    }
    for (const { pile, created } of touched.values()) {
      bus.emit(created ? 'pile:dropped' : 'pile:changed', copyPile(pile));
    }
    return [...touched.values()].map(({ pile }) => copyPile(pile));
  }

  /**
   * Take up to quantity of a NAMED kind from a pile (Systems'
   * pickup grant). Returns what was actually taken and what
   * remains OF THAT KIND. A kind taken to zero drops out of the
   * stacks; a pile with no kinds left is deleted. Emits
   * 'pile:changed' on a partial take, 'pile:removed' when the
   * pile empties, nothing when the pile or kind does not exist.
   */
  take(id: string, item: string, quantity: number): { taken: number; remaining: number };
  /**
   * INTERIM legacy overload: take quantity of the pile's FIRST
   * kind. Exists only so Systems' PileStore (structural
   * take(id, quantity)) keeps compiling until their kind-scoped
   * grant lands. New code must pass the kind. Remove with the
   * legacy Pile.item/quantity fields.
   */
  take(id: string, quantity: number): { taken: number; remaining: number };
  take(
    id: string,
    itemOrQuantity: string | number,
    quantity?: number,
  ): { taken: number; remaining: number } {
    const pile = this.piles.get(id);
    if (!pile) return { taken: 0, remaining: 0 };
    const item =
      typeof itemOrQuantity === 'string' ? itemOrQuantity : pile.stacks[0]?.item;
    const wanted =
      typeof itemOrQuantity === 'string' ? (quantity ?? 0) : itemOrQuantity;
    const stack = item ? pile.stacks.find((s) => s.item === item) : undefined;
    if (!stack || wanted <= 0) {
      return { taken: 0, remaining: stack?.quantity ?? 0 };
    }
    const taken = Math.min(wanted, stack.quantity);
    stack.quantity -= taken;
    if (stack.quantity <= 0) {
      pile.stacks.splice(pile.stacks.indexOf(stack), 1);
    }
    if (pile.stacks.length === 0) {
      this.piles.delete(id);
      bus.emit('pile:removed', { id });
      return { taken, remaining: 0 };
    }
    syncLegacy(pile);
    bus.emit('pile:changed', copyPile(pile));
    return { taken, remaining: stack.quantity };
  }

  /** Piles within range of (x, z), nearest first (tracker channel). */
  pilesInRange(x: number, z: number, range: number): PileTarget[] {
    const out: PileTarget[] = [];
    for (const pile of this.piles.values()) {
      const distance = Math.hypot(pile.x - x, pile.z - z);
      if (distance > range) continue;
      out.push(copyTarget(pile, distance));
    }
    out.sort((a, b) => a.distance - b.distance);
    return out;
  }

  /** Silent clear — the renderer rebuilds the pile group after. */
  clear(): void {
    this.piles.clear();
  }
}

export const pileState = new PileState();
