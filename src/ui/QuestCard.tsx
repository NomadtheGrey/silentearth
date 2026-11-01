/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — the HUD's active-task card
 * (UI lane, presentation only).
 *
 * The card Systems' questComponentsFor was written for:
 * the quest she has MARKED active (or, unmarked, the
 * current quest) with its components and their done
 * states. The card owns no rules — the caller resolves
 * which quest stands, reads the components off Systems'
 * data, and passes plain rows in. Marking itself lives
 * in the journal's quest log, not here: the card is a
 * readout. Its ONE control is its close (Adam, 2026-11-01
 * — no Close [X] button on the task chip): the caller
 * owns the dismissal and its lifetime; this component
 * only renders the door when handed an onClose.
 */

import { UI_THEMES, type UiThemeName } from './themes';

/** One component row, as Systems' questComponentsFor shapes it. */
export interface QuestCardComponent {
  id: string;
  label: string;
  done: boolean;
}

export interface QuestCardProps {
  /** The standing quest's title (Systems, draft). */
  title: string;
  /** The standing quest's one-line hint (draft). */
  hint: string;
  /** Component rows with done states; empty renders title + hint only. */
  components: QuestCardComponent[];
  /**
   * True when the standing quest is the one she MARKED;
   * false when the card falls back to the current quest.
   * The eyebrow names which.
   */
  marked: boolean;
  /** Look for the card. Default "mire" (the world outside). */
  theme?: UiThemeName;
  /**
   * The card's close door (Adam, 2026-11-01): when the
   * caller hands this in, the card renders its
   * 'Close [X]' button; the caller owns what dismissal
   * means and how long it lasts.
   */
  onClose?: () => void;
}

export function QuestCard({
  title,
  hint,
  components,
  marked,
  theme = 'mire',
  onClose,
}: QuestCardProps) {
  const t = UI_THEMES[theme];
  return (
    <section
      aria-label="Active quest"
      className={'rounded px-3 py-2 ' + t.panel}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={
            'text-[11px] font-semibold uppercase tracking-wide ' + t.muted
          }
        >
          {marked ? 'Active quest' : 'Current quest'}
        </p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quest card"
            className={
              'pointer-events-auto rounded px-1.5 py-0.5 text-xs ' + t.button
            }
          >
            Close [X]
          </button>
        ) : null}
      </div>
      <h3 className={'text-sm font-semibold ' + t.heading}>{title}</h3>
      {hint ? (
        <p className={'mt-0.5 text-xs ' + t.muted}>{hint}</p>
      ) : null}
      {components.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {components.map((component) => (
            <li
              key={component.id}
              className={
                'text-xs ' + (component.done ? t.muted : t.heading)
              }
            >
              {component.done ? '✓ ' : ''}
              {component.label}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
