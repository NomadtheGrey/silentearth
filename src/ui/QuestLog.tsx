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
  /**
   * The act this quest belongs to, as the caller assigns
   * it (dialog #4 amendment: the journal's log renders
   * grouped by act). Omitted rows group under the default
   * act. Options' flat list ignores the field.
   */
  act?: string;
  /**
   * True when this quest carries her ACTIVE MARK (the
   * HUD card's quest). The title names it (' — active',
   * ahead of the current suffix); with a mark control
   * wired, its button reads as the clear.
   */
  active?: boolean;
  /**
   * The quest's THREAD display name, as the caller
   * stamps it from Systems' QUEST_THREADS (the thread
   * folds chunk). The journal nests its folds by this
   * name; flat lists ignore it. Omitted = threadless
   * (renders under its act with no fold of its own).
   */
  thread?: string;
}

/** The act unassigned rows belong to (Adam's frame: the survival act). */
export const DEFAULT_QUEST_ACT = 'Act I — Survival';

/** One act's slice of a quest list, for grouped rendering. */
export interface QuestActGroup {
  act: string;
  quests: QuestDisplay[];
}

/**
 * Group rows by act, preserving the caller's order twice
 * over: groups stand in first-appearance order, rows keep
 * their list order inside their group (the log's own
 * within-act ordering is untouched).
 */
export function groupQuestsByAct(quests: QuestDisplay[]): QuestActGroup[] {
  const groups: QuestActGroup[] = [];
  for (const quest of quests) {
    const act = quest.act ?? DEFAULT_QUEST_ACT;
    const group = groups.find((candidate) => candidate.act === act);
    if (group) group.quests.push(quest);
    else groups.push({ act, quests: [quest] });
  }
  return groups;
}

/** One thread's slice of an act's quest list, for nested rendering. */
export interface QuestThreadGroup {
  /** Thread display name; '' for threadless rows. */
  thread: string;
  quests: QuestDisplay[];
}

/**
 * Group one act's rows by thread, same law as the acts:
 * first-appearance order (which is QUEST_THREADS' fold
 * order, Systems having defined it as first appearance
 * in the quest list), rows in list order inside.
 */
export function groupQuestsByThread(
  quests: QuestDisplay[],
): QuestThreadGroup[] {
  const groups: QuestThreadGroup[] = [];
  for (const quest of quests) {
    const thread = quest.thread ?? '';
    const group = groups.find((candidate) => candidate.thread === thread);
    if (group) group.quests.push(quest);
    else groups.push({ thread, quests: [quest] });
  }
  return groups;
}

export interface QuestLogProps {
  /** Quests in priority order, all visible. Empty = no rows + a line. */
  quests: QuestDisplay[];
  /** Look for the list. Default "mire" (the world outside). */
  theme?: UiThemeName;
  /**
   * The MARK CONTROL (the HUD-card chunk): when wired,
   * each incomplete row carries its mark toggle — 'Mark
   * active', or '✓ Active — clear mark' on the marked
   * row. The journal wires it; Options' list does not
   * (the book is the quest home).
   */
  onMarkQuest?: (questId: string) => void;
}

export function QuestLog({
  quests,
  theme = 'mire',
  onMarkQuest,
}: QuestLogProps) {
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
              {quest.active
                ? ' — active'
                : isCurrent
                  ? ' — current'
                  : ''}
            </p>
            <p className={'mt-0.5 text-sm ' + t.muted}>{quest.hint}</p>
            {onMarkQuest && !quest.done ? (
              <button
                type="button"
                onClick={() => onMarkQuest(quest.id)}
                aria-pressed={!!quest.active}
                className={
                  'mt-1 text-xs underline ' +
                  (quest.active ? t.heading : t.muted)
                }
              >
                {quest.active ? '✓ Active — clear mark' : 'Mark active'}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
