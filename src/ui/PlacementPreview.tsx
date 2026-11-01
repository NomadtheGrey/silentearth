/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — placement preview (UI lane, presentation only).
 *
 * The label that rides the placement ghost: a dashed plate
 * naming the thing being placed, positioned by the caller at
 * screen percentages (the caller owns world→screen projection,
 * exactly like the harvest buttons). The GHOST itself is the
 * terrain-painted outline at the aimed point (Adam's ghost
 * ruling, 2026-11-01 — Background paints it); this plate is
 * the label that rides along, and — by Adam's kiln ruling the
 * same day ('I would think the Kiln button down below would
 * also place it') — the plate is ALSO a door: when the caller
 * passes onConfirm, the plate renders as a real button and a
 * click places, the same act as Enter. The button branch seats
 * its WorldAnchor INTERACTIVE: a non-interactive anchor is
 * aria-hidden, which would strike the door from the
 * accessibility tree even though the mouse still finds it
 * (measured by the place drive, 2026-11-01 — the role query
 * counted 0 on a working button). When no onConfirm is
 * passed (the upgrade pill stands — the pill is the one
 * confirm in that state) the plate stays a plain label.
 *
 * The hint line (desktop, caller's wording): while armed,
 * the bar speaks its doors — an armed mode names its own
 * confirm at the moment of arming (Adam's placement-bar
 * addition, 2026-11-01).
 *
 * TINT HONESTY: the plate colors green/red ONLY when the
 * caller passes a real validity verdict; with no check
 * behind it (the common case — placeFire refuses nothing)
 * the plate paints NEUTRAL. A hardcoded green would be a
 * lie about a check that never ran.
 */

import { WorldAnchor } from './WorldAnchor';

export interface PlacementPreviewProps {
  /** Screen x of the preview, in percent (0–100), caller-projected. */
  x: number;
  /** Screen y of the preview, in percent (0–100), caller-projected. */
  y: number;
  /** What is being placed, in the caller's words. */
  label: string;
  /**
   * A real validity verdict when one exists; omit for the
   * neutral plate (no check ran).
   */
  valid?: boolean;
  /**
   * When given, the plate is a working confirm: a click
   * places (the same act as the caller's Enter door).
   * Omitted while another surface is the one confirm.
   */
  onConfirm?: () => void;
  /** The spoken doors line, shown under the label when given. */
  hint?: string;
}

export function PlacementPreview({
  x,
  y,
  label,
  valid,
  onConfirm,
  hint,
}: PlacementPreviewProps) {
  const tint =
    valid === undefined
      ? 'border-stone-100/70 bg-black/45 text-stone-100'
      : valid
        ? 'border-[#5c823d] bg-[#5c823d]/20 text-stone-100'
        : 'border-[#a82424] bg-[#a82424]/20 text-stone-100';
  const body = (
    <>
      {label}
      {valid === false ? (
        <span className="italic text-stone-300"> — cannot place here</span>
      ) : null}
      {hint ? (
        <span className="mt-0.5 block text-[11px] text-stone-300">
          {hint}
        </span>
      ) : null}
    </>
  );
  if (onConfirm) {
    return (
      <WorldAnchor x={x} y={y} interactive>
        <button
          type="button"
          onClick={onConfirm}
          aria-label={`Place ${label} there`}
          className={
            'pointer-events-auto cursor-pointer rounded border-2 border-dashed px-3 py-2 text-sm hover:brightness-150 ' +
            tint
          }
        >
          {body}
        </button>
      </WorldAnchor>
    );
  }
  return (
    <WorldAnchor x={x} y={y}>
      <div
        aria-label={`Placing ${label}${valid === false ? ' (invalid spot)' : ''}`}
        className={'rounded border-2 border-dashed px-3 py-2 text-sm ' + tint}
      >
        {body}
      </div>
    </WorldAnchor>
  );
}
