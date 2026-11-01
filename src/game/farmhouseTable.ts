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

/** Authored piece counts per slot (filled by Models'
 *  table landing, 2026-11-01 — see the manifest below). */
export const FARMHOUSE_SLOT_COUNTS: Record<FarmhouseSlot, number> = {
  footprint: 2,
  windowRhythm: 2,
  gableWidth: 2,
  porch: 2,
  stairsDressing: 1,
};

/**
 * THE PIECE MANIFEST (Models, 2026-11-01) — what each
 * slot index MEANS, for the formed integration:
 *
 * footprint (the plan's LENGTH, in wall segments):
 *   0 -> 3 segments (7.5 m)   1 -> 4 segments (10 m)
 * gableWidth (the plan's DEPTH — the gable end spans
 *   it, so the two slots compose the plan):
 *   0 -> 5.0 m, kind 'farmGableEnd'
 *   1 -> 7.5 m, kind 'farmGableEndWide'
 * windowRhythm (wall kinds, ground + upper):
 *   0 -> 'farmWall' + 'farmWallUpper'   (windows left)
 *   1 -> 'farmWallB' + 'farmWallUpperB' (windows right)
 * porch:
 *   0 -> 'farmPorch'   1 -> none
 * stairsDressing (one piece authored so far; the slot
 *   grows with the attic / upper-floor landings):
 *   0 -> 'farmStairs' (+ 'farmFloorSlab' tiles above)
 *
 * Not slots: the chimney is the 'farmChimney' BRICK,
 * seated by the instance's chimneySeatU along the
 * ridge; the cellar mouth is 'farmCellarDoor', seated
 * by the integration where the plan wants it.
 */
export const FARMHOUSE_LENGTH_SEGMENTS: readonly number[] = [3, 4];
export const FARMHOUSE_GABLE_KINDS: readonly string[] = ['farmGableEnd', 'farmGableEndWide'];
export const FARMHOUSE_GABLE_WIDTHS_M: readonly number[] = [5.0, 7.5];
export const FARMHOUSE_RHYTHM_KINDS: readonly { ground: string; upper: string }[] = [
  { ground: 'farmWall', upper: 'farmWallUpper' },
  { ground: 'farmWallB', upper: 'farmWallUpperB' },
];
export const FARMHOUSE_PORCH_KINDS: readonly (string | null)[] = ['farmPorch', null];
export const FARMHOUSE_STAIRS_KINDS: readonly string[] = ['farmStairs'];

/** Resolve a raw draw (0..1) to a slot index under the
 *  slot's current count. */
export function farmhouseSlotIndex(slot: FarmhouseSlot, raw: number): number {
  const count = Math.max(1, Math.floor(FARMHOUSE_SLOT_COUNTS[slot]));
  return Math.min(count - 1, Math.floor(raw * count));
}
