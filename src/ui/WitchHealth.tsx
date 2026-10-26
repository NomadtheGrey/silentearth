/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — witch's health element (UI lane, presentation only).
 *
 * Adam's direction, 2026-10-25: a health element belongs in the UI,
 * kept light. The health SYSTEM itself is a later landing, so this
 * element is built as a clean presentation awaiting it: with no value
 * it says plainly that it awaits the health system, instead of
 * inventing a health model. With a value (a 0–1 fraction, caller-
 * supplied, like every other bar in this directory) it shows a heart
 * and a bar. Compose it inside HudShell; it takes no system input
 * and computes nothing about health itself.
 *
 * Heart colour is the prototype's blood, #a82424.
 */

export interface WitchHealthProps {
  /** Health fraction, 0–1, caller-supplied. Undefined = awaiting system. */
  value?: number;
  /** Label for the element. Default "Health". */
  label?: string;
  /** Caller-supplied secondary text. Optional. */
  detail?: string;
  className?: string;
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M 8,14 C 3,10 1,7 1,4.5 C 1,2.5 2.5,1 4.5,1 C 6,1 7.5,2 8,3.5 C 8.5,2 10,1 11.5,1 C 13.5,1 15,2.5 15,4.5 C 15,7 13,10 8,14 Z"
        fill={filled ? '#a82424' : 'none'}
        stroke={filled ? '#a82424' : '#78716c'}
        strokeWidth="1"
      />
    </svg>
  );
}

export function WitchHealth({
  value,
  label = 'Health',
  detail,
  className,
}: WitchHealthProps) {
  return (
    <div
      aria-label={label}
      className={
        'flex items-center gap-2 rounded bg-black/50 px-2 py-1 text-sm text-stone-100 ' +
        (className ?? '')
      }
    >
      <Heart filled={value !== undefined} />
      {value === undefined ? (
        <span className="italic text-stone-400">{label} — awaiting health system</span>
      ) : (
        <>
          <span>{label}</span>
          <div className="h-2 w-24 overflow-hidden rounded bg-stone-700">
            <div
              className="h-full rounded bg-red-700"
              style={{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }}
            />
          </div>
          {detail ? <span className="text-stone-400">{detail}</span> : null}
        </>
      )}
    </div>
  );
}
