/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — the companions ROSTER (UI
 * lane, presentation only; the roster dialog, Adam's
 * design of 2026-11-05, built 2026-11-07).
 *
 * The roster is the management answer to NO companion
 * cap: her whole company on one page, grouped by KIND
 * with counts, each individual's bond, stance, and
 * trust standing on its row — and the acts record-level
 * and position-free (Adam: "She shouldn't have to try
 * to walk through a pond to drown them"): a release or
 * a stance change lands on the animal wherever it
 * stands, across any distance or dimension. Feeding,
 * the rite, and name-speaking stay in the world — they
 * are not panel acts.
 *
 * ONE COMPONENT, TWO DOORS (DEV's shaping): the
 * standalone Companions panel (the N door) and the
 * journal's Companions page render THIS component —
 * one row source, two doors, the charm-toggle pattern,
 * so the two can never disagree. It succeeds
 * CompanionsPanel (2026-10-31), whose behaviors
 * transplant whole: the stance trio, the All-row, the
 * per-row notes, the two-press Release guard, and the
 * CAT's theater (below).
 *
 * GROUPING is the caller's composition: it passes one
 * group per kind — label, count, rows — in its chosen
 * order; the familiar's row leads its group (the
 * caller sorts). This panel only renders.
 *
 * TRUST stands on the row as the caller stamps it (the
 * record's number, beside the bond). The panel owns no
 * trust arithmetic.
 *
 * THE RELEASE LADDER (Adam's law, defined 2026-11-07:
 * 'Releasing a familiar makes it a companion. Releasing
 * a companion lets it loose.'): the familiar's release
 * control STANDS like every row's — and its two-press
 * confirm NAMES THE OUTCOME before it lands (the
 * pill<->E honesty law: a confirm may not deliver a
 * different outcome than it names): a demote row arms
 * with the step-down line; a free row arms plain. The
 * demote itself is the caller's act (Systems' seat);
 * this panel only voices it honestly.
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
 * arms the row ('Release?' with Release / Keep), the
 * second confirms. The arm is panel-local state and
 * dies with the row. There is no release-all — a
 * guarded act stays singular.
 *
 * WHEREABOUTS (cut 2): a row may carry the caller's
 * whereabouts line — where the animal stands, composed
 * shell-side from the actor runtime (records carry no
 * position; the panel only renders the caller's text,
 * or nothing when the caller cannot honestly say).
 *
 * RELEASE BY NUMBER (cut 2): a group of 2+ companions
 * offers a 'Release some…' door on its header: the
 * player picks a count (1..count, default all), the
 * arm names the kind and the number, and the confirm
 * runs the caller's bulk act (Systems' releaseByKind:
 * bonded companions only, oldest first — the familiar
 * is never swept, and a demoted cat IS a companion of
 * its kind: the accepted edge, DEV 2026-11-07). The
 * arm is panel-local, like the row's.
 */

import { useState } from 'react';
import { UI_THEMES, type UiThemeName } from './themes';

export type RosterStanceLabel = 'stay' | 'follow' | 'come';

export interface RosterRow {
  /** The individual's stable id (the caller's key). */
  creatureId: string;
  /** Display label for the kind (caller's wording). */
  kindLabel: string;
  /** 'familiar' earns the row's lit Familiar badge. */
  bond: 'companion' | 'familiar';
  /** The standing stance; null = inapplicable (the cat). */
  stance: RosterStanceLabel | null;
  /** The record's trust, stamped by the caller. */
  trust: number;
  /**
   * What this row's release act does (the ladder, the
   * caller's stamp of Systems' per-row fact): 'demote'
   * steps a familiar down to a companion; 'free' lets
   * a companion loose. RENDERED through the arm: a
   * demote row's confirm names the step down.
   */
  releaseEffect: 'demote' | 'free';
  /** True when the kind takes no commands (the cat). */
  isCat: boolean;
  /**
   * The whereabouts line (cut 2): where this animal
   * stands, in the caller's words ('With you',
   * 'At <place>', '<n> m <wind>', 'Out of sight').
   * Null = the caller cannot honestly say; no line
   * renders.
   */
  whereaboutsLine: string | null;
}

export interface RosterKindGroup {
  /** The kind (the caller's key). */
  kind: string;
  /** Display label for the kind (caller's wording). */
  kindLabel: string;
  /** How many of this kind stand in her company. */
  count: number;
  /** The kind's individuals, caller's order (familiar first). */
  rows: RosterRow[];
}

export interface RosterPanelProps {
  /** Her company, grouped by kind (caller's composition). */
  groups: RosterKindGroup[];
  /** A stance press on one row (the cat's included). */
  onStance?: (creatureId: string, stance: RosterStanceLabel) => void;
  /** A stance press on the All-row. */
  onStanceAll?: (stance: RosterStanceLabel) => void;
  /** A confirmed Release on one row (post-guard; the caller runs the ladder). */
  onRelease?: (creatureId: string) => void;
  /**
   * A confirmed release-by-number (cut 2; post-guard):
   * free `count` companions of `kind` (the caller's
   * bulk act; the familiar is never among them).
   */
  onReleaseKind?: (kind: string, count: number) => void;
  /** Per-row note text, keyed by creatureId (the cat's theater line lands here). */
  notes?: Readonly<Record<string, string | undefined>>;
  /** Note text under the All-row (the cat's line when the All-row meets one). */
  allNote?: string;
  /** Called when the player closes the panel. Optional; the journal door renders without one. */
  onClose?: () => void;
  /** Thumb-sized action buttons (44 px targets) on touch. Default false. */
  comfortable?: boolean;
  /** Look for the panel. Default "mire". */
  theme?: UiThemeName;
  /**
   * Embedded render (the journal's Companions page):
   * the roster stands as a SECTION of the book — no
   * panel chrome, no heading, no close. Default false
   * (the standalone door's full panel).
   */
  embedded?: boolean;
}

/**
 * The arm lines (DRAFT, DEV's wording family 2026-11-07):
 * the two-press confirm NAMES who goes and what the
 * act does — a demote names the step down; a free
 * names the loose-ing.
 */
export const demoteArmLine = (name: string) =>
  `Release ${name} as your familiar? They will stay on as your companion.`;
export const freeArmLine = (name: string) =>
  `Release ${name}? They will go loose.`;

const STANCES: Array<{ id: RosterStanceLabel; label: string }> = [
  { id: 'stay', label: 'Stay' },
  { id: 'follow', label: 'Follow' },
  { id: 'come', label: 'Come' },
];

export function RosterPanel({
  groups,
  onStance,
  onStanceAll,
  onRelease,
  onReleaseKind,
  notes,
  allNote,
  onClose,
  comfortable = false,
  theme = 'mire',
  embedded = false,
}: RosterPanelProps) {
  const t = UI_THEMES[theme];
  const [armedReleaseId, setArmedReleaseId] = useState<string | null>(null);
  const [armedKind, setArmedKind] = useState<string | null>(null);
  const [kindCount, setKindCount] = useState(1);
  const btn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] '
    : 'rounded px-2 py-1 text-sm ';
  const stanceBtn = (active: boolean) =>
    btn + (active ? t.selected : t.button);
  const total = groups.reduce((sum, group) => sum + group.count, 0);

  const trio = (
    current: RosterStanceLabel | null,
    press: (stance: RosterStanceLabel) => void,
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

  const body = (
    <>
      {total === 0 ? (
        <p className={'italic ' + t.muted}>No companions yet.</p>
      ) : (
        <div className="flex flex-col gap-y-4">
          {groups.map((group) => {
            const freeable = group.rows.filter(
              (r) => r.releaseEffect === 'free',
            ).length;
            return (
            <div key={group.kind}>
              <div className="mb-1.5 flex flex-wrap items-center gap-x-2">
                <h3
                  className={
                    'text-sm font-semibold ' + t.heading
                  }
                >
                  {group.kindLabel}
                  <span className={'font-normal ' + t.muted}>
                    {' '}
                    — {group.count}
                  </span>
                </h3>
                {onReleaseKind && freeable >= 2 ? (
                  armedKind === group.kind ? (
                    <span className="flex flex-wrap items-center gap-1">
                      <span className={'text-sm ' + t.muted}>
                        Release {kindCount} {group.kindLabel}
                        {kindCount === 1 ? '' : 's'}? They will go
                        loose.
                      </span>
                      {Array.from(
                        { length: freeable },
                        (_, i) => i + 1,
                      ).map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={kindCount === n}
                          aria-label={`Release ${n}`}
                          onClick={() => setKindCount(n)}
                          className={
                            btn +
                            (kindCount === n ? t.selected : t.button)
                          }
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const n = kindCount;
                          setArmedKind(null);
                          onReleaseKind(group.kind, n);
                        }}
                        className={btn + t.primary}
                      >
                        Release
                      </button>
                      <button
                        type="button"
                        onClick={() => setArmedKind(null)}
                        className={btn + t.button}
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setKindCount(freeable);
                        setArmedKind(group.kind);
                      }}
                      aria-label={`Release some ${group.kindLabel}`}
                      className={btn + t.button}
                    >
                      Release some…
                    </button>
                  )
                ) : null}
              </div>
              <ul className="flex flex-col gap-y-3">
                {group.rows.map((row) => (
                  <li
                    key={row.creatureId}
                    className="flex flex-col gap-y-1"
                  >
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
                        <span
                          className={
                            'ml-2 text-xs font-normal ' + t.muted
                          }
                        >
                          Trust {row.trust}
                        </span>
                      </span>
                      {armedReleaseId === row.creatureId ? (
                        <span className="flex flex-wrap items-center gap-1">
                          <span className={'text-sm ' + t.muted}>
                            {row.releaseEffect === 'demote'
                              ? demoteArmLine(row.kindLabel)
                              : freeArmLine(row.kindLabel)}
                          </span>
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
                          onClick={() =>
                            setArmedReleaseId(row.creatureId)
                          }
                          aria-label={`Release ${row.kindLabel}`}
                          className={btn + t.button}
                        >
                          Release
                        </button>
                      )}
                    </div>
                    {row.whereaboutsLine ? (
                      <p className={'text-sm ' + t.muted}>
                        {row.whereaboutsLine}
                      </p>
                    ) : null}
                    {trio(row.stance, (stance) =>
                      onStance?.(row.creatureId, stance),
                    )}
                    {notes?.[row.creatureId] ? (
                      <p className={'text-sm italic ' + t.muted}>
                        {notes[row.creatureId]}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            );
          })}
        </div>
      )}

      {total > 1 ? (
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
    </>
  );

  if (embedded) return body;

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
            Close [X]
          </button>
        ) : null}
      </div>
      {body}
    </section>
  );
}
