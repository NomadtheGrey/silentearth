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
 * WIRING — READ THIS: at the time this file was written, no
 * housing state exists in the repo (houses are craftable
 * inventory items, not placed world objects), and the weather
 * module's shelter hook explicitly defaults to unsheltered
 * until housing supplies positions. So App mounts this with
 * sheltered=false today — the engine's current truth, not a
 * guess — and the indicator reads "Unsheltered". The moment
 * housing lands and supplies placed-house positions, App
 * passes the real value through and the pill appears when she
 * is home. Home storage is a separate concern (see below) and
 * is not rendered here.
 *
 * HOME STORAGE — FLAGGED, NOT BUILT: no home inventory exists
 * yet, so there is nothing to surface. When one lands, it
 * surfaces through the EXISTING InventoryPanel pattern (items
 * + capacity text) — that panel already carries exactly what a
 * home inventory needs, so no separate storage panel is
 * invented here. If the existing panel cannot carry it, that
 * is a flag for the housing round, not a second panel built
 * in advance.
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
    <div
      aria-label={
        houseName ? `Sheltered at ${houseName}` : 'Sheltered'
      }
      className={
        'rounded bg-black/50 px-2 py-1 text-sm text-stone-100 ' +
        (className ?? '')
      }
    >
      Sheltered{houseName ? ` at ${houseName}` : ''}
    </div>
  );
}
