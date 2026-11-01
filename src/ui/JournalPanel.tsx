/**
 * Silent Earth redesign — journal panel (UI lane,
 * presentation only).
 *
 * The journal's tally surface (First-Fragment
 * Presentation, 2026-10-31): one row per mark she has
 * BEGUN — unbegun marks are absent by design (Systems'
 * snapshot lists begun marks only; the panel renders
 * the order it is given and invents nothing). Each row
 * reads the mark's canonical name, its fragment tally
 * against the tier threshold, the day the pursuit
 * began, and the kept-best copy's weathering as a word
 * (the caller's derivation — the panel owns no numbers).
 *
 * Opened by the Read verb on her journal (and, by the
 * linked-books law, on her grimoire — the same book by
 * the other name), and — dialog audit #4, Adam's release
 * 2026-11-01 — by its own doors: the J key and the panel
 * buttons, live once she carries the journal. The panel
 * owns NO rules: it renders rows and reports a close.
 *
 * The book also carries her QUEST LOG now (the audit's
 * missing half: the log hid inside the Options modal
 * though the journal is a carried item). The caller
 * passes the same mapped quest rows it gives Options;
 * Options keeps its own copy — the audit's complaint
 * was hiding, not duplication.
 */

import { Fragment, useState } from 'react';

import { UI_THEMES, type UiThemeName } from './themes';
import {
  QuestLog,
  DEFAULT_QUEST_ACT,
  groupQuestsByAct,
  groupQuestsByThread,
  type QuestDisplay,
} from './QuestLog';

export interface JournalMarkRow {
  /** The mark id (the caller's key). */
  mark: string;
  /** Canonical display name (Systems' markDisplayName). */
  name: string;
  /** Copies held of this mark. */
  count: number;
  /** Copies the first tier needs (Systems' tally). */
  needed: number;
  /** The first tier stands whole. */
  complete: boolean;
  /** The kept-best copy's weathering as a word (caller's DRAFT scale). */
  bestWord: string | null;
  /** The day the pursuit of this mark began. */
  seekingSinceDay: number | null;
}

export interface JournalPanelProps {
  /** One row per begun mark, caller's order. */
  marks: JournalMarkRow[];
  /**
   * The quest log the book carries (dialog audit #4):
   * the caller's mapped rows, rendered below the marks
   * as NESTED independent folds — by ACT, then by
   * THREAD within the act (Adam's log design), rows in
   * the caller's order inside their thread.
   * Omitted = marks only.
   */
  quests?: QuestDisplay[];
  /**
   * The mark control for the book's quest log (the
   * HUD-card chunk): passed through to the QuestLogs.
   * Omitted = the log renders read-only.
   */
  onMarkQuest?: (questId: string) => void;
  /** Called when the player closes the panel. Optional. */
  onClose?: () => void;
  /** Thumb-sized close button (44 px target) on touch. Default false. */
  comfortable?: boolean;
  /** Look for the panel. Default "mire". */
  theme?: UiThemeName;
}

export function JournalPanel({
  marks,
  quests,
  onMarkQuest,
  onClose,
  comfortable = false,
  theme = 'mire',
}: JournalPanelProps) {
  const t = UI_THEMES[theme];
  // ACT FOLDS (accordion amendment, Adam via DEV
  // 2026-11-01): each act group is an INDEPENDENT fold —
  // the unification's class default, mirroring
  // ItemListSurface's collapsed-set idiom. Default: the
  // act holding the current quest (the first incomplete
  // row in the caller's order) starts OPEN; every other
  // act starts folded. The panel mounts per opening, so
  // the default re-settles each time she opens the book;
  // while it stands open the folds are hers alone.
  const groups = quests ? groupQuestsByAct(quests) : [];
  const currentAct =
    quests?.find((quest) => !quest.done)?.act ?? DEFAULT_QUEST_ACT;
  const [collapsedActs, setCollapsedActs] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        groups
          .filter((group) => group.act !== currentAct)
          .map((group) => group.act),
      ),
  );
  const toggleActFold = (act: string) =>
    setCollapsedActs((previous) => {
      const next = new Set(previous);
      if (next.has(act)) next.delete(act);
      else next.add(act);
      return next;
    });
  // THREAD FOLDS (Adam's log design, nested): within an
  // act, quests fold again by THREAD — independent of
  // the act fold and of each other, same idiom. Default:
  // the thread holding its act's first incomplete quest
  // starts open, the rest folded — so an act unfolded by
  // hand already shows its current thread (Wakings over
  // Wake a Charm, in Act II). Keys are act + thread, so
  // same-named threads in different acts never share a
  // fold state.
  const threadFoldKey = (act: string, thread: string) =>
    act + '::' + thread;
  const [collapsedThreads, setCollapsedThreads] =
    useState<ReadonlySet<string>>(() => {
      const closed = new Set<string>();
      for (const group of groups) {
        const current = group.quests.find((quest) => !quest.done);
        for (const threadGroup of groupQuestsByThread(group.quests)) {
          if (
            threadGroup.thread !== '' &&
            threadGroup.thread !== (current?.thread ?? '')
          ) {
            closed.add(threadFoldKey(group.act, threadGroup.thread));
          }
        }
      }
      return closed;
    });
  const toggleThreadFold = (key: string) =>
    setCollapsedThreads((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const btn = comfortable
    ? 'rounded px-3 py-2 text-sm min-h-[44px] '
    : 'rounded px-2 py-1 text-sm ';
  return (
    <section
      aria-label="Journal"
      className={'@container rounded-2xl p-3 ' + t.panel}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className={'text-base font-semibold ' + t.heading}>Journal</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close journal"
            className={btn + t.button}
          >
            Close
          </button>
        ) : null}
      </div>
      {marks.length === 0 ? (
        <p className="text-sm text-stone-300">
          No marks begun yet. What you copy down will be kept here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {marks.map((row) => (
            <li
              key={row.mark}
              className="flex flex-col gap-y-0.5 rounded-xl bg-black/20 px-3 py-2"
            >
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{row.name}</span>
                <span className="text-xs text-stone-400">
                  {row.complete
                    ? 'First tier whole'
                    : `${row.count} of ${row.needed} toward the first tier`}
                </span>
              </span>
              <span className="text-xs text-stone-400">
                {row.seekingSinceDay !== null
                  ? `Looking since day ${row.seekingSinceDay}`
                  : 'Looking'}
                {row.bestWord !== null
                  ? ` · best copy ${row.bestWord}`
                  : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      {quests ? (
        <div className="mt-3">
          <h3 className={'mb-2 text-sm font-semibold ' + t.heading}>
            Quests
          </h3>
          {quests.length === 0 ? (
            <QuestLog
              quests={quests}
              theme={theme}
              onMarkQuest={onMarkQuest}
            />
          ) : (
            groups.map((group) => {
              const folded = collapsedActs.has(group.act);
              return (
                <div key={group.act} className="mt-2">
                  <button
                    type="button"
                    aria-expanded={!folded}
                    onClick={() => toggleActFold(group.act)}
                    className={
                      'w-full pt-1 text-left text-xs font-semibold uppercase tracking-wide ' +
                      t.muted
                    }
                  >
                    <span aria-hidden="true">{folded ? '▸ ' : '▾ '}</span>
                    {group.act}
                  </button>
                  {!folded
                    ? groupQuestsByThread(group.quests).map(
                        (threadGroup) => {
                          if (threadGroup.thread === '') {
                            return (
                              <Fragment key="threadless">
                                <QuestLog
                                  quests={threadGroup.quests}
                                  theme={theme}
                                  onMarkQuest={onMarkQuest}
                                />
                              </Fragment>
                            );
                          }
                          const key = threadFoldKey(
                            group.act,
                            threadGroup.thread,
                          );
                          const threadFolded = collapsedThreads.has(key);
                          return (
                            <div key={key} className="mt-1.5 ml-2">
                              <button
                                type="button"
                                aria-expanded={!threadFolded}
                                onClick={() => toggleThreadFold(key)}
                                className={
                                  'w-full pt-1 text-left text-xs font-medium ' +
                                  t.heading
                                }
                              >
                                <span aria-hidden="true">
                                  {threadFolded ? '▸ ' : '▾ '}
                                </span>
                                {threadGroup.thread}
                              </button>
                              {!threadFolded ? (
                                <QuestLog
                                  quests={threadGroup.quests}
                                  theme={theme}
                                  onMarkQuest={onMarkQuest}
                                />
                              ) : null}
                            </div>
                          );
                        },
                      )
                    : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </section>
  );
}
