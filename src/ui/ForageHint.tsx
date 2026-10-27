/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — forage hint (UI lane, presentation only).
 *
 * One short HUD line, shown only when the caller says she is
 * hungry or too-hungry (the stage it is passed — this element
 * computes nothing about hunger itself and imports no game or
 * systems code). It names what to forage for, in the brief's
 * mappings: brush → elderberries, bog growth → bog berries,
 * ground acorns → acorns (cook first). It checks no
 * availability and opens no panel — it is a hint line, not
 * a guide page.
 *
 * ACORN MAPPING CHANGED (2026-10-26, DEV signal, verified in
 * code): acorns used to ride downed oak as a secondary; the
 * oak landing (6be0299) moved them to their own hand source,
 * groundAcorns (hand permit, hunger-exempt, cook-first), and
 * the log no longer drops them — so the line now names ground
 * acorns, not downed oak. Wording lane-decided, flagged.
 *
 * WORDING IS LANE-DECIDED (flagged for Adam's pin pass): the
 * brief supplied the three mappings, the lane worded the line.
 *
 * MUSHROOM LINE (added 2026-10-26, DEV brief, now that sources
 * landed at 8315d21): a second line names mushrooms and
 * DISTINGUISHES them by cap — edible is the tan plain cap and
 * is safe; poison is the rust cap with pale spots and is
 * "do not eat". No poison symptoms are invented here: eat
 * effects are Systems' proposal, not pinned, so the poison
 * wording stops at "do not eat". "Look close before picking"
 * is the brief's caution, carried verbatim in spirit.
 * Wording is lane-decided, flagged for Adam's pin pass, as
 * with the first line.
 */

import type { HungerStage } from './HungerIndicator';

export interface ForageHintProps {
  /** Current hunger stage, caller-supplied. Undefined = hidden. */
  stage?: HungerStage;
}

export function ForageHint({ stage }: ForageHintProps) {
  if (stage !== 'hungry' && stage !== 'too-hungry') {
    return null;
  }
  return (
    <div
      aria-label="Forage hint"
      className="mt-2 rounded bg-black/50 px-2 py-1 text-sm text-stone-100"
    >
      Forage: brush → elderberries · bog growth → bog berries · ground
      acorns → acorns (cook first).
      <div>
        Mushrooms: tan plain cap is safe · rust cap with pale spots —
        do not eat. Look close before picking.
      </div>
    </div>
  );
}
