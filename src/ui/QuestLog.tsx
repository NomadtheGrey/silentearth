/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — quest log list (UI lane, presentation only).
 *
 * The list the Quest Log tab shows: every quest in priority order,
 * all visible (no hidden future quests). Completed quests are
 * marked done (check); the first incomplete quest is the current
 * one, highlighted. No gating lives here — a player may do things
 * out of order and completion still counts; this layer only
 * renders the done states the caller passes. The caller owns the
 * list (Systems predicates via the shell); this layer owns no
 * completion logic, no game imports, no state of its own.
 * The list scrolls with the modal's own overflow (the Options
 * panel scrolls), so no scroll container lives here.
 */

import { UI_THEMES, type UiThemeName } from './themes';

/** One quest row, as the caller maps it from Systems results. */
export interface QuestDisplay {
  /** Stable quest id (Systems definition id). */
  id: string;
  /** Player-facing title (draft, Adam pins before merge). */
  title: string;
  /** Player-facing hint, one line, plain words (draft). */
  hint: string;
  /** Completion state from the Systems predicate. */
  done: boolean;
}

export interface QuestLogProps {
  /** Quests in priority order, all visible. Empty = no rows + a line. */
  quests: QuestDisplay[];
  /** Look for the list. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function QuestLog({ quests, theme = 'mire' }: QuestLogProps) {
  const t = UI_THEMES[theme];
  const currentIndex = quests.findIndex((quest) => !quest.done);
  if (quests.length === 0) {
    return <p className={'italic ' + t.muted}>No quests to show.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {quests.map((quest, index) => {
        const isCurrent = index === currentIndex;
        return (
          <li key={quest.id}>
            <p
              className={
                'text-sm ' +
                (quest.done
                  ? t.muted
                  : isCurrent
                    ? 'font-bold ' + t.heading
                    : 'font-medium ' + t.heading)
              }
            >
              {quest.done ? '✓ ' : ''}
              {quest.title}
              {isCurrent ? ' — current' : ''}
            </p>
            <p className={'mt-0.5 text-sm ' + t.muted}>{quest.hint}</p>
          </li>
        );
      })}
    </ul>
  );
}
