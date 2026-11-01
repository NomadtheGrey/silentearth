/**
 * THE FARMHOUSE TABLE-LENGTH SEAM (2026-11-01).
 *
 * Adam's framing for the farmhouse family is Lego:
 * "We are making this out of Legos — mix and match for
 * more combinations." A farmhouse is assembled from
 * Models' authored pieces, one variant per PIECE SLOT,
 * and the siting derivation (farmhouses.ts) rolls one
 * seeded index per slot. The roll must not hard-code how
 * many pieces exist — pieces are authored over time —
 * so the derivation reads the COUNT per slot from this
 * table and resolves its raw draw modulo the count.
 *
 * The counts here are PLACEHOLDERS (1 = the slot has a
 * single piece, so every index resolves to 0). Models'
 * table landing fills each count as its pieces are
 * authored; the derivation never changes. The settled
 * caveat stands: growing a count RE-ROLLS the worlds
 * (an index that meant piece 0 of 1 may mean piece 1
 * of 3) — determinism is per-table-state, not eternal.
 *
 * The CHIMNEY is deliberately NOT a slot here (Models'
 * adjustment): the chimney is one brick (farmChimney)
 * seatable anywhere, so the siting roll produces a
 * chimney SEAT POSITION, recorded on the instance —
 * no count, no index.
 */

export type FarmhouseSlot =
  | 'footprint'
  | 'windowRhythm'
  | 'gableWidth'
  | 'porch'
  | 'stairsDressing';

/** Authored piece counts per slot (PLACEHOLDER 1s until
 *  Models' table landing fills them). */
export const FARMHOUSE_SLOT_COUNTS: Record<FarmhouseSlot, number> = {
  footprint: 1,
  windowRhythm: 1,
  gableWidth: 1,
  porch: 1,
  stairsDressing: 1,
};

/** Resolve a raw draw (0..1) to a slot index under the
 *  slot's current count. */
export function farmhouseSlotIndex(slot: FarmhouseSlot, raw: number): number {
  const count = Math.max(1, Math.floor(FARMHOUSE_SLOT_COUNTS[slot]));
  return Math.min(count - 1, Math.floor(raw * count));
}
