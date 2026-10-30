/**
 * Beehive honey (Systems, 2026-10-28 — follow-up to Background's
 * wildHive landing, which placed the hive object + the
 * placedTorchNearHive fact and left the honey item + harvest rule
 * to this module).
 *
 * SAFE-HARVEST RULE (ordered): a PLACED torch under the hive =
 * safe harvest. The torch fact arrives as a SHELL-SUPPLIED boolean
 * (Background's placedTorchNearHive, like nearCreek for pulp) —
 * this module never reads game state.
 *
 * UNSAFE (no torch under the hive) = REFUSED: no honey, NO
 * DAMAGE. Stings are NOT invented — no bee-damage model exists;
 * a real consequence, if Adam wants one later, rides a future
 * health/damage model (flagged, not built).
 *
 * PLACED-ONLY v1: a carried lit torch does NOT satisfy the rule
 * (Background's fact is placed-only; carried-counting is a
 * follow-up option — a Systems-side addition, no Background
 * change — if Adam wants it, not built now).
 *
 * RE-HARVEST v1: NO depletion, NO cooldown, repeatable — the hive
 * stays scenery + source (matches v1's no-removal-tracking).
 * Balance question FLAGGED for Adam's pin pass (infinite honey
 * from one hive); regrow/cooldown/depletion tracking is a
 * follow-up when he pins it, not invented now.
 *
 * BEESWAX (Background rider, 2026-10-30 — the candle line's
 * source, flagged in Systems' candle landing): a successful
 * harvest ALSO gathers beeswax, the honey's secondary — one
 * wax per harvest, riding the SAME torch gate and refusals
 * (a refused harvest gathers nothing, wax included). The wax
 * grant is a second addPartial AFTER the honey: if the honey
 * itself does not fit, the harvest refuses 'Pack full.' as
 * before and no wax is attempted; if the honey fits but the
 * wax (another 0.25 lb) does not, the harvest still SUCCEEDS
 * with waxGranted 0 — the partial-grant idiom, no new refusal
 * invented. The outcome carries waxGranted so the shell can
 * word it when it wants to.
 *
 * The hive is NOT engine-harvested (harvestable stays false —
 * the torch gate can't ride the engine's yield table). The
 * interaction is a dedicated row (trap-row precedent) calling
 * harvestHoney; the UI row + too-hungry row gating are
 * follow-ups, not built here. No hunger gate inside this
 * function (grant function, like collectTrapCatch) — the
 * too-hungry harvest rule applies at the interaction layer.
 *
 * Numbers DRAFT for Adam's pin pass: yields 1 honey + 1
 * beeswax per harvest, each 0.25 lb, honey food +15
 * (berry tier).
 */

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';

export interface HoneyHarvestOutcome {
  granted: number;
  /**
   * Beeswax gathered alongside the honey: 1 on a successful
   * harvest with room for it, 0 on any refusal — and 0 when
   * the honey fit but the wax did not (the harvest still
   * succeeded; see the header's beeswax paragraph).
   */
  waxGranted: number;
  reason?: string;
}

/**
 * Harvest honey from a wild hive. Torch check FIRST (refuse
 * before touching inventory), then a partial grant: a full pack
 * grants 0 and the hive stays, so she retries after freeing room.
 * On success, one beeswax rides alongside (second partial grant).
 */
export function harvestHoney(
  inventory: PersonalInventory,
  torchUnderHive: boolean,
): HoneyHarvestOutcome {
  if (!torchUnderHive) {
    return { granted: 0, waxGranted: 0, reason: 'No torch under the hive.' };
  }
  const result = inventory.addPartial(ITEMS.honey, 1);
  if (result.granted === 0) {
    return { granted: 0, waxGranted: 0, reason: 'Pack full.' };
  }
  const wax = inventory.addPartial(ITEMS.beeswax, 1);
  return { granted: 1, waxGranted: wax.granted };
}
