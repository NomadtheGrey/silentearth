/**
 * Dropped-pile world entities — harvest overflow (Adam, 2026-10-26).
 *
 * A harvest that does not fit no longer fails all-or-nothing: the
 * harvest COMPLETES (the plant shrinks/regrows, the log is taken, the
 * tree fells, exactly as a fitting harvest), what FITS goes into
 * inventory, and what DOESN'T fit drops as a VISIBLE ground pile at
 * the harvested target's spot, pick-up-able later (proximity USE
 * when room exists).
 *
 * SEAM (coordinated through DEV — Systems builds pickup grant +
 * save persistence against this shape):
 * - Pile: { id, item, quantity, x, z }. item is the NORMALIZED
 *   item id (Systems' spelling, e.g. 'snap-wood' — the same id
 *   inventory stacks and save documents carry). The harvest
 *   listener gets it from Systems' addPartial() return (the
 *   single normalization truth — the alias table lives in
 *   Systems' inventory.ts and is NOT duplicated here); the
 *   free()/add() fallback path keeps the yield spelling, which
 *   Systems' save/pickup boundaries re-normalize on read.
 * - id = `pile:<item>:<x.toFixed(2)>,<z.toFixed(2)>`. Piles MERGE
 *   by item at the exact same spot (lane-decided, flagged for
 *   Adam's pin pass): a second drop of the same item at the same
 *   coords adds to the existing pile instead of stacking a new one.
 * - Events: 'pile:dropped' (new pile only), 'pile:changed'
 *   (merge-increase or partial take), 'pile:removed' (fully taken).
 *   The proximity tracker carries piles separately as
 *   'piles:inRange' — piles are NOT harvest targets and never ride
 *   'harvest:inRange'.
 * - Pickup grant is SYSTEMS' half (their brief): they consume
 *   take(id, qty) here and emit their own grant; this module grants
 *   nothing. 'pile:pickup-requested' { pileId } is defined in
 *   events.ts for UI's future pile button → Systems' listener.
 *
 * Deliberately NOT invented: no pile cap, no expiry, no despawn —
 * piles persist until picked up (save persistence is Systems'
 * brief). A new world is a new pile set: pileState.clear() runs in
 * the renderer's setWorldGen, like the other placed-state clears.
 * Piles are gameplay state, not worldgen — no seed, no RNG here.
 *
 * DROP PATH (Adam 2026-10-26, "for next pass"): spawnPile(record)
 * is the drop handler's entry point — it validates a GroundPile
 * record and delegates to drop(), so a dropped pile IS an
 * overflow pile (same merge, events, visuals, pickup). UI's drop
 * V1 already works via drop() directly; spawnPile is the
 * intention-revealing wrapper for the shell to adopt.
 */

import { bus } from './events';

export interface Pile {
  id: string;
  item: string;
  quantity: number;
  x: number;
  z: number;
}

/** Pile as carried on the proximity channel (distance added). */
export interface PileTarget {
  id: string;
  item: string;
  quantity: number;
  x: number;
  z: number;
  distance: number;
}

export function pileIdFor(item: string, x: number, z: number): string {
  return `pile:${item}:${x.toFixed(2)},${z.toFixed(2)}`;
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

class PileState {
  private piles = new Map<string, Pile>();

  /**
   * Drop quantity of item at (x, z). Merges into an existing pile
   * of the same item at the same spot; otherwise creates one.
   * Returns the pile, or null when quantity <= 0 (no pile for
   * nothing — callers only drop real remainders).
   */
  drop(item: string, quantity: number, x: number, z: number): Pile | null {
    if (quantity <= 0) return null;
    const id = pileIdFor(item, x, z);
    const existing = this.piles.get(id);
    if (existing) {
      existing.quantity += quantity;
      bus.emit('pile:changed', { ...existing });
      return existing;
    }
    const pile: Pile = { id, item, quantity, x, z };
    this.piles.set(id, pile);
    bus.emit('pile:dropped', { ...pile });
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
    return [...this.piles.values()].map((p) => ({ ...p }));
  }

  /**
   * Take up to quantity from a pile (Systems' pickup grant).
   * Returns what was actually taken and what remains. A fully
   * taken pile is deleted. Emits 'pile:changed' on a partial take,
   * 'pile:removed' when the pile empties, nothing when the pile
   * does not exist.
   */
  take(id: string, quantity: number): { taken: number; remaining: number } {
    const pile = this.piles.get(id);
    if (!pile || quantity <= 0) return { taken: 0, remaining: pile?.quantity ?? 0 };
    const taken = Math.min(quantity, pile.quantity);
    pile.quantity -= taken;
    if (pile.quantity <= 0) {
      this.piles.delete(id);
      bus.emit('pile:removed', { id });
      return { taken, remaining: 0 };
    }
    bus.emit('pile:changed', { ...pile });
    return { taken, remaining: pile.quantity };
  }

  /** Piles within range of (x, z), nearest first (tracker channel). */
  pilesInRange(x: number, z: number, range: number): PileTarget[] {
    const out: PileTarget[] = [];
    for (const pile of this.piles.values()) {
      const distance = Math.hypot(pile.x - x, pile.z - z);
      if (distance > range) continue;
      out.push({ ...pile, distance });
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
