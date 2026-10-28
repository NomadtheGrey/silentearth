/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — sheltered indicator (UI lane, presentation only).
 *
 * One line in the HUD that says whether she is sheltered: a
 * "Sheltered" pill when she is at her placed house, a muted
 * "Unsheltered" line when she is not. It computes nothing about
 * shelter itself — the caller passes the boolean, and the caller
 * (the housing system, when it lands) owns what counts as "at
 * her placed house" (position, radius, which house). The house
 * name is optional caller-supplied text, shown only when
 * sheltered.
 *
 * WIRING — READ THIS: App passes the real sheltered value
 * through from placed-house state (shelterAt: within 6 m of
 * a placed house center), plus the sheltering house's name,
 * so the pill appears when she is home. Rest does NOT live
 * here: it lives in the home menu (Adam, 2026-10-28 — the
 * indicator button sat far left where it went unnoticed).
 * Home storage surfaces through the InventoryPanel pattern
 * (items + capacity text) and through the home menu; this
 * indicator carries shelter text only.
 */

export interface ShelteredIndicatorProps {
  /** Whether she is at her placed house, caller-supplied. */
  sheltered: boolean;
  /** Placed house name, caller-supplied. Shown only when sheltered. */
  houseName?: string;
  className?: string;
}

export function ShelteredIndicator({
  sheltered,
  houseName,
  className,
}: ShelteredIndicatorProps) {
  if (!sheltered) {
    return (
      <div
        aria-label="Unsheltered"
        className={'text-sm italic text-stone-400 ' + (className ?? '')}
      >
        Shelter: unsheltered
      </div>
    );
  }
  return (
    <div className={className ?? ''}>
      <div
        aria-label={
          houseName ? `Sheltered at ${houseName}` : 'Sheltered'
        }
        className="rounded bg-black/50 px-2 py-1 text-sm text-stone-100"
      >
        Sheltered{houseName ? ` at ${houseName}` : ''}
      </div>
    </div>
  );
}
