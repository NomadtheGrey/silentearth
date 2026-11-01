/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — companions panel (UI lane,
 * presentation only).
 *
 * The bonded companions list: one row per companion the
 * caller passes, each with its stance trio (Stay /
 * Follow / Come) and a Release act, plus an All-row
 * whose trio addresses every companion at once. The
 * panel owns NO rules: it renders the caller's rows,
 * marks the standing stance, and reports presses. What
 * a press does — including a cat's refusal, which the
 * caller voices as theater on the row's note line — is
 * the caller's business entirely.
 *
 * CAT ROWS (Adam, 2026-10-31): a cat's stance is null
 * (inapplicable, not a default), so no button reads
 * pressed — but the trio still RENDERS and still
 * reports presses, by ruling: the panel offers the
 * cat commands as pure theater, and the caller plays
 * the non-compliance. Do not "fix" this by hiding a
 * cat's controls; the joke is the design.
 *
 * RELEASE is guarded here, in the row: the first press
 * arms the row ('Release?' with Release / Keep),
 * the second confirms. The arm is panel-local state
 * and dies with the row. There is no release-all —
 * a guarded act stays singular.
 *
 * THE FAMILIAR READS (Build 2, Piece 4): a familiar's
 * row carries a LIT badge — the theme's active fill,
 * not muted text — the panel register of the glow the
 * world side shows. Row ORDER is the caller's (the
 * shell seats the familiar first); the panel renders
 * the order it is given.
 */

import { useState } from 'react';
import { UI_THEMES, type UiThemeName } from './themes';

export type CompanionStanceLabel = 'stay' | 'follow' | 'come';

export interface CompanionRow {
  /** The individual's stable id (the caller's key). */
  creatureId: string;
  /** Display name for the kind (caller's wording). */
  kindLabel: string;
  /** 'familiar' earns the row's lit Familiar badge. */
  bond: 'companion' | 'familiar';
  /** The standing stance; null = inapplicable (the cat). */
  stance: CompanionStanceLabel | null;
  /** True when the kind takes no commands (the cat). */
  isCat: boolean;
}

export interface CompanionsPanelProps {
  companions: CompanionRow[];
  /** A stance press on one row (the cat's included). */
  onStance?: (creatureId: string, stance: CompanionStanceLabel) => void;
  /** A stance press on the All-row. */
  onStanceAll?: (stance: CompanionStanceLabel) => void;
  /** A confirmed Release on one row (post-guard). */
  onRelease?: (creatureId: string) => void;
  /** Per-row note text, keyed by creatureId (the cat's theater line lands here). */
  notes?: Readonly<Record<string, string | undefined>>;
  /** Note text under the All-row (the cat's line when the All-row meets one). */
  allNote?: string;
  /** Called when the player closes the panel. Optional. */
  onClose?: () => void;
  /** Thumb-sized action buttons (44 px targets) on touch. Default false. */
  comfortable?: boolean;
  /** Look for the panel. Default "mire". */
  theme?: UiThemeName;
}

const STANCES: Array<{ id: CompanionStanceLabel; label: string }> = [
  { id: 'stay', label: 'Stay' },
  { id: 'follow', label: 'Follow' },
  { id: 'come', label: 'Come' },
];

export function CompanionsPanel({
  companions,
  onStance,
  onStanceAll,
  onRelease,
  notes,
  allNote,
  onClose,
  comfortable = false,
  theme = 'mire',
}: CompanionsPanelProps) {
  const t = UI_THEMES[theme];
  const [armedReleaseId, setArmedReleaseId] = useState<string | null>(null);
  const btn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] '
    : 'rounded px-2 py-1 text-sm ';
  const stanceBtn = (active: boolean) =>
    btn + (active ? t.selected : t.button);

  const trio = (
    current: CompanionStanceLabel | null,
    press: (stance: CompanionStanceLabel) => void,
  ) => (
    <span className="flex flex-wrap gap-1">
      {STANCES.map((stance) => (
        <button
          key={stance.id}
          type="button"
          aria-pressed={current === stance.id}
          onClick={() => press(stance.id)}
          className={stanceBtn(current === stance.id)}
        >
          {stance.label}
        </button>
      ))}
    </span>
  );

  return (
    <section
      aria-label="Companions"
      className={'@container rounded-2xl p-3 ' + t.panel}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className={'text-base font-semibold ' + t.heading}>Companions</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close companions"
            className={btn + t.button}
          >
            Close
          </button>
        ) : null}
      </div>

      {companions.length === 0 ? (
        <p className={'italic ' + t.muted}>No companions yet.</p>
      ) : (
        <ul className="flex flex-col gap-y-3">
          {companions.map((row) => (
            <li key={row.creatureId} className="flex flex-col gap-y-1">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="min-w-[8ch] flex-1 font-medium">
                  {row.kindLabel}
                  {row.bond === 'familiar' ? (
                    <span
                      className={
                        'ml-2 rounded px-1.5 py-0.5 text-xs font-semibold ' +
                        t.active
                      }
                    >
                      Familiar
                    </span>
                  ) : null}
                </span>
                {armedReleaseId === row.creatureId ? (
                  <span className="flex flex-wrap items-center gap-1">
                    <span className={'text-sm ' + t.muted}>Release?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setArmedReleaseId(null);
                        onRelease?.(row.creatureId);
                      }}
                      className={btn + t.primary}
                    >
                      Release
                    </button>
                    <button
                      type="button"
                      onClick={() => setArmedReleaseId(null)}
                      className={btn + t.button}
                    >
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setArmedReleaseId(row.creatureId)}
                    aria-label={`Release ${row.kindLabel}`}
                    className={btn + t.button}
                  >
                    Release
                  </button>
                )}
              </div>
              {trio(row.stance, (stance) => onStance?.(row.creatureId, stance))}
              {notes?.[row.creatureId] ? (
                <p className={'text-sm italic ' + t.muted}>
                  {notes[row.creatureId]}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {companions.length > 1 ? (
        <div className="mt-3 border-t border-stone-700/60 pt-2">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="min-w-[8ch] flex-1 font-medium">All</span>
            {trio(null, (stance) => onStanceAll?.(stance))}
          </div>
          {allNote ? (
            <p className={'mt-1 text-sm italic ' + t.muted}>{allNote}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
