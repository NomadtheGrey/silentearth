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
 * downed oak → acorns (cook first). It checks no availability
 * and opens no panel — it is a hint line, not a guide page.
 *
 * WORDING IS LANE-DECIDED (flagged for Adam's pin pass): the
 * brief supplied the three mappings, the lane worded the line.
 *
 * MUSHROOM LINES JOIN LATER: when mushroom sources land, their
 * mapping joins this line as a small follow-up — not a blocker
 * now, and nothing here invents a mushroom source meanwhile.
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
      Forage: brush → elderberries · bog growth → bog berries · downed
      oak → acorns (cook first).
    </div>
  );
}
