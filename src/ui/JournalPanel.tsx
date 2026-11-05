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
 *
 * The book also carries her PLACES (the naming build,
 * 2026-11-05): the names she has GIVEN, beside the
 * Names page's names she was taught. Rows are the
 * caller's — current dimension first with distance +
 * bearing words, other dimensions' places after with
 * their dimension label and no distance (a cave name
 * does not surface topside). The section carries the
 * naming door itself: "Name this place" plants a name
 * at the spot she stands at (the caller supplies the
 * position; the entry here is free verbatim text),
 * and the selected row carries Rename / Remove name.
 * Selection is the caller's state — this panel only
 * reports the tap.
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

/**
 * One true name she has been taught by a rite (the
 * familiar road, 2026-11-02): the kind, its name as
 * written in the book, and its gift. The standing
 * familiar's row carries the Recite door when its gift
 * is a working one; borrowState is the caller's read of
 * the borrowing (span/rest live in FamiliarState).
 */
export interface JournalNameRow {
  kind: string;
  /** The kind's plain label (caller's). */
  label: string;
  /** The true name, as written. */
  name: string;
  /** The gift's phrase. */
  gift: string;
  /** This kind stands as her familiar now. */
  isFamiliar: boolean;
  /** The gift works today (a Recite can be offered). */
  giftWorking: boolean;
  /** For the familiar's row: the borrowing's posture. */
  borrowState?: 'ready' | 'borrowed' | 'resting';
}

/**
 * One place she has named (the naming build): her
 * name verbatim, and the caller's read of where it
 * stands from where she stands. `here` = her current
 * dimension — those rows carry a distance + bearing
 * `detail`; other dimensions' rows carry a
 * `dimensionLabel` instead (distance across dimensions
 * means nothing).
 */
export interface JournalPlaceRow {
  /** The place's id (the register's key). */
  id: string;
  /** Her name for the place, verbatim. */
  name: string;
  /** Stands in the dimension she is in now. */
  here: boolean;
  /** Distance + bearing words (here rows). */
  detail: string | null;
  /** Dimension label (elsewhere rows). */
  dimensionLabel: string | null;
  /** The world-day she named it. */
  day: number;
}

export interface JournalPanelProps {
  /** One row per begun mark, caller's order. */
  marks: JournalMarkRow[];
  /**
   * The true names the rites have taught her (the
   * familiar road): rendered as the book's Names page,
   * below the marks. Omitted/empty = no names yet (the
   * section does not render).
   */
  names?: JournalNameRow[];
  /** Recite a name — borrow the familiar's gift. */
  onRecite?: (kind: string) => void;
  /**
   * The places she has named (the naming build), the
   * caller's order — current dimension first.
   * Omitted = no Places section. An empty list still
   * renders the section (the naming door must stand).
   */
  places?: JournalPlaceRow[];
  /** The selected place's id, if any (caller's). */
  selectedPlaceId?: string | null;
  /** Select a place (the scry seat's selection). */
  onSelectPlace?: (id: string) => void;
  /**
   * Set when she stands at an already-named spot:
   * naming here renames it. The caller's words.
   */
  nameHereHint?: string | null;
  /** Name the spot she stands at (verbatim text). */
  onNamePlace?: (name: string) => void;
  /** Rename one place by id (verbatim text). */
  onRenamePlace?: (id: string, name: string) => void;
  /** Ask to remove one place's name (caller confirms). */
  onUnnamePlace?: (id: string) => void;
  /** Name length cap (the register's, caller's). */
  nameMaxChars?: number;
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
  names,
  onRecite,
  places,
  selectedPlaceId,
  onSelectPlace,
  nameHereHint,
  onNamePlace,
  onRenamePlace,
  onUnnamePlace,
  nameMaxChars = 40,
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
  // THE NAMING ENTRIES (the naming build): the panel's
  // own presentation state — which entry stands open
  // and its draft text. The acts themselves are the
  // caller's; a submitted entry closes here, the
  // register's blank-refusal is the backstop (the
  // buttons stand disabled on a blank draft besides).
  const [namingOpen, setNamingOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const submitName = () => {
    const name = nameDraft;
    setNamingOpen(false);
    setNameDraft('');
    if (name.trim() !== '' && onNamePlace) onNamePlace(name);
  };
  const submitRename = (id: string) => {
    const name = renameDraft;
    setRenamingId(null);
    setRenameDraft('');
    if (name.trim() !== '' && onRenamePlace) onRenamePlace(id, name);
  };
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
            Close [X]
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
      {names && names.length > 0 ? (
        <div className="mt-3">
          <h3 className={'mb-2 text-sm font-semibold ' + t.heading}>
            Names
          </h3>
          <ul className="flex flex-col gap-2">
            {names.map((row) => (
              <li
                key={row.kind}
                className="flex flex-col gap-y-0.5 rounded-xl bg-black/20 px-3 py-2"
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-xs text-stone-400">
                    the {row.label}
                    {row.isFamiliar ? ' — your familiar' : ''}
                  </span>
                </span>
                <span className="text-xs text-stone-400">
                  Gift: {row.gift}
                  {row.isFamiliar && !row.giftWorking
                    ? ' — not yet hers to borrow'
                    : ''}
                </span>
                {row.isFamiliar && row.giftWorking && onRecite ? (
                  <span className="mt-1">
                    <button
                      type="button"
                      disabled={row.borrowState !== 'ready'}
                      onClick={() => onRecite(row.kind)}
                      className={btn + t.button}
                    >
                      {row.borrowState === 'borrowed'
                        ? 'Borrowed now'
                        : row.borrowState === 'resting'
                          ? 'The gift rests'
                          : `Recite — borrow: ${row.gift}`}
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {places ? (
        <div className="mt-3">
          <h3 className={'mb-2 text-sm font-semibold ' + t.heading}>
            Places
          </h3>
          {onNamePlace ? (
            namingOpen ? (
              <form
                className="mb-2 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitName();
                }}
              >
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  maxLength={nameMaxChars}
                  placeholder="Name this place"
                  aria-label="Name for this place"
                  autoFocus
                  className="min-w-0 flex-1 rounded bg-black/30 px-2 py-1 text-sm text-stone-100"
                />
                <button
                  type="submit"
                  disabled={nameDraft.trim() === ''}
                  className={btn + t.button}
                >
                  Name it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNamingOpen(false);
                    setNameDraft('');
                  }}
                  className={btn + t.button}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => setNamingOpen(true)}
                  className={btn + t.button}
                >
                  Name this place
                </button>
                {nameHereHint ? (
                  <p className="mt-1 text-xs text-stone-400">
                    {nameHereHint}
                  </p>
                ) : null}
              </div>
            )
          ) : null}
          {places.length === 0 ? (
            <p className="text-sm text-stone-300">
              No places named yet. The names you give will be kept
              here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {places.map((row) => {
                const selected = row.id === selectedPlaceId;
                return (
                  <li
                    key={row.id}
                    className={
                      'flex flex-col gap-y-0.5 rounded-xl px-3 py-2 ' +
                      (selected ? 'bg-white/10' : 'bg-black/20')
                    }
                  >
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        onSelectPlace ? onSelectPlace(row.id) : undefined
                      }
                      className="flex flex-wrap items-baseline gap-x-2 text-left"
                    >
                      <span className="font-medium">{row.name}</span>
                      <span className="text-xs text-stone-400">
                        {row.here
                          ? (row.detail ?? '')
                          : (row.dimensionLabel ?? '')}
                        {selected ? ' · Selected' : ''}
                      </span>
                    </button>
                    <span className="text-xs text-stone-400">
                      Named on day {row.day}
                    </span>
                    {selected && renamingId === row.id ? (
                      <form
                        className="mt-1 flex flex-wrap items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitRename(row.id);
                        }}
                      >
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(event) =>
                            setRenameDraft(event.target.value)
                          }
                          maxLength={nameMaxChars}
                          aria-label={`New name for ${row.name}`}
                          autoFocus
                          className="min-w-0 flex-1 rounded bg-black/30 px-2 py-1 text-sm text-stone-100"
                        />
                        <button
                          type="submit"
                          disabled={renameDraft.trim() === ''}
                          className={btn + t.button}
                        >
                          Save name
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(null);
                            setRenameDraft('');
                          }}
                          className={btn + t.button}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : selected &&
                      (onRenamePlace || onUnnamePlace) ? (
                      <span className="mt-1 flex flex-wrap gap-2">
                        {onRenamePlace ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingId(row.id);
                              setRenameDraft(row.name);
                            }}
                            className={btn + t.button}
                          >
                            Rename
                          </button>
                        ) : null}
                        {onUnnamePlace ? (
                          <button
                            type="button"
                            onClick={() => onUnnamePlace(row.id)}
                            className={btn + t.button}
                          >
                            Remove name
                          </button>
                        ) : null}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
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
