/**
 * Applying a glow dose (Systems, 2026-11-03 — the
 * glow-moss road's apply grant; order fixed by DEV
 * from Background's seam facts).
 *
 * THE GRANT wraps the seat call in DEV's order —
 * the jar law read strictly: aim → the register's
 * patchAt refusal → seatPatch → consume ONLY on a
 * non-null seat. The door (UI) composes the aim-side
 * refusals in its own voice (not underground,
 * nothing faced) and binds Background's seatPatch
 * for the aimed patch into the `seat` callback this
 * grant takes; everything from the seat onward is
 * decided HERE, in one tested place, so the
 * consumption invariant — a refusal consumes
 * nothing and teaches nothing — cannot drift
 * between doors.
 *
 * Refusals are typed codes; UI voices the sentences
 * (the feed / tend precedent).
 */

import { ITEMS, type ItemId } from './recipes';
import type { PersonalInventory } from './inventory';
import { recordItemUse } from './knowledge-register';

export const GLOW_DOSE_ITEM: ItemId = ITEMS.glowDose;

export type ApplyGlowDoseResult =
  | { ok: true; patchId: string }
  | { ok: false; code: 'no-dose' | 'occupied' };

/**
 * Apply one glow dose at the door's aimed patch.
 * `seat` is the register's seatPatch bound to the
 * aim (the shell composes it): it returns the seated
 * patch's id, or null where the patch is already
 * painted (the register's patchAt refusal, folded
 * into the seat attempt).
 *
 * Order, exactly as fixed: a dose must be carried
 * before the seat is even attempted; the dose is
 * consumed ONLY when the seat returns a patch id;
 * the exercised door (recordItemUse — the card's
 * 'Painted on a cave wall' line) fires in the same
 * act, on success only.
 */
export function applyGlowDose(
  inventory: PersonalInventory,
  seat: () => string | null,
): ApplyGlowDoseResult {
  if (inventory.count(GLOW_DOSE_ITEM) <= 0) {
    return { ok: false, code: 'no-dose' };
  }
  const patchId = seat();
  if (patchId === null) return { ok: false, code: 'occupied' };
  inventory.remove(GLOW_DOSE_ITEM, 1);
  recordItemUse(GLOW_DOSE_ITEM);
  return { ok: true, patchId };
}
