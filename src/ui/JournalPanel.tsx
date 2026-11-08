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
 *
 * The book also carries her CHARMS (the toggles build,
 * 2026-11-06): Adam ruled a switch next to each charm,
 * in the panel and mirrored here. The Charms page
 * stands below Places and above Quests; each row is
 * the caller's stamp of the one charm list, and its
 * switch flips the same fact the Charms panel's
 * switch flips — off mutes the effect only.
 *
 * The book's head carries its ORDER control (the
 * Newest sort, 2026-11-06): 'Standing order' reads
 * every page as recorded (the default); 'Newest'
 * asks the caller to re-stamp the listing pages
 * freshest-first — marks by their latest copy's
 * recorded day, named places by their naming day,
 * names and charms by reversed recorded order (no
 * day is kept for those). The quest log stands
 * outside the control by ruling: its act/thread
 * grouping IS its order.
 *
 * The book also carries her COMPANY (the roster
 * dialog, 2026-11-07): the caller passes the roster
 * as an already-rendered node — the RosterPanel in
 * its embedded form — and the book seats it as its
 * Companions page, below Charms and above Quests.
 * The node is the caller's composition because the
 * roster is ONE component with TWO doors (this page
 * and the N panel): the same stamped rows render in
 * both, and the book never re-stamps them. Like the
 * quest log, the roster stands outside the sort
 * control — its grouping IS its order.
 *
 * THE BOOK (the restyle, 2026-11-08; Adam's shape in
 * his words: swap the journal's green-background UI
 * for the journal image and text and chapter tabs):
 * the panel's skin is now the OPEN BOOK — aged-paper
 * pages, a spine seam down the spread, and a row of
 * BOOKMARK CHAPTER TABS along the top edge: General
 * Info · Quests · Miniquests · Marks · Places ·
 * Names · Charms · Companions. Every page is the
 * standing content, ported unchanged — the swap is
 * presentation only: no row, door, or fold moved its
 * meaning. The dressing is pure CSS (no image asset
 * ships): the reference photograph's table is NOT
 * part of it, by Adam's note. On a narrow book the
 * spread reads as a SINGLE PAGE under the same
 * dressing (the spine seam drops away; the tabs
 * stay). The tab state is the panel's own session
 * state — the panel mounts per opening, so the book
 * opens on its front page each time; nothing is
 * saved. Contents the old stack showed only when
 * non-empty (Names, Charms) keep their pages'
 * standing empty lines rather than losing the tab —
 * a chapter tab never vanishes.
 *
 * GENERAL INFO is the book's front page: the order
 * control's home, the standing empty-book line as
 * its frontispiece, and the caller's info node when
 * one is stamped. No content is invented for it.
 *
 * MINIQUESTS get their own chapter (Adam: their own
 * section, not jumbled with the quests): the caller
 * splits its stamped quest rows by the definition's
 * section and passes miniquests + an optional
 * completion-note node per quest (the hearth's note
 * names the brewing shelf once its seating step
 * stands done — the caller's words; the panel only
 * seats the note under its quest's steps).
 *
 * PLACES carries two gatherings on one page: the
 * places she has FOUND (the gazetteer's records —
 * the caller's rows: the place's name, its family,
 * the day found, whether its carrier has been seen,
 * and distance + bearing words read from where she
 * stands, or its dimension's label when she is
 * elsewhere) above the places she has NAMED (the
 * standing section, unchanged). Found is discovery,
 * never before: a place she has not found has no row.
 */

import { Fragment, useState, type ReactNode } from 'react';

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
  /**
   * THE CLOCK READ (the clock law, 2026-11-08): the
   * tally's hours still wanted to fill the CURRENT
   * clock — the journal's progress line reads the
   * clock, not the retired copy count.
   */
  needed: number;
  /** The mark stands at its tier cap. */
  complete: boolean;
  /** Clocks filled so far (tiers earned, caller's tally). */
  fills: number;
  /** Hours covered in the current clock (0–11). */
  coveredHours: number;
  /** The current clock's coverage as a word (caller's DRAFT scale). */
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

/**
 * One base she can return to (the Returning build):
 * her last completed sleep, or a house she placed —
 * Systems' base enumeration, composed by the caller.
 * Bases stand on the surface by definition, so a row
 * carries distance + bearing words like a here place
 * (or a dimension note when she is below).
 */
export interface JournalBaseRow {
  /** The base's id ('base:last-sleep' / 'base:house:<n>'). */
  id: string;
  /** The row's name, caller's words ('Last sleep' / 'Placed house'). */
  name: string;
  /** Distance + bearing words, or the elsewhere note. */
  detail: string | null;
}

/**
 * One awakened charm, as the book's Charms page carries
 * it (the toggles build, 2026-11-06): the same row the
 * Charms panel stamps, from the caller's one mapping —
 * two doors, one fact. `enabled` is the toggle fact:
 * off mutes the effect only; the awakening, its tier,
 * and this row all stand.
 */
export interface JournalCharmRow {
  /** Bone kind (shape slug, e.g. 'pigeon-wing-bone'). */
  kind: string;
  /** Display name, e.g. 'Primal Bone - pigeon wing bone'. */
  name: string;
  /** Tier held (≥ 1). */
  tier: number;
  /** Display line (Systems' awakened-branch note). */
  note: string;
  /** The toggle fact: true = the charm's effect is on. */
  enabled: boolean;
}

/**
 * One place she has FOUND (the gazetteer surface —
 * the book build, 2026-11-08): the register's record
 * in the caller's words. `here` mirrors the named
 * places' read: rows in her current dimension carry
 * distance + bearing `detail`; rows elsewhere carry
 * a `dimensionLabel` instead. `carrierNote` is the
 * caller's fragment note: it stands only once she
 * has SEEN the place's carrier (the discovery law —
 * the book never flags a carrier by rumor), and is
 * null before that.
 */
export interface JournalFoundRow {
  /** The register's place key (the caller's key). */
  placeKey: string;
  /** The place's name, as the register keeps it. */
  name: string;
  /** The family's plain word (caller's). */
  familyLabel: string;
  /** The world-day she found it. */
  dayFound: number;
  /** Its carrier has stood in her faced read. */
  carrierSeen: boolean;
  /** The fragment note (stands only when seen). */
  carrierNote: string | null;
  /** Stands in the dimension she is in now. */
  here: boolean;
  /** Distance + bearing words (here rows). */
  detail: string | null;
  /** Dimension label (elsewhere rows). */
  dimensionLabel: string | null;
}

/**
 * One stamped miniquest step (the book build): the
 * definition's component in the caller's live read —
 * its label and whether it stands done. The panel
 * prints steps; it derives none.
 */
export interface JournalMiniquestStep {
  id: string;
  label: string;
  done: boolean;
}

/**
 * One stamped miniquest row (the book build): the
 * caller's quest row with its live steps attached.
 */
export interface JournalMiniquestRow extends QuestDisplay {
  steps: JournalMiniquestStep[];
}

/**
 * The Miniquests chapter's stamp (the book build):
 * the caller composes it (live step reads +
 * completion notes are the caller's facts) and the
 * book seats the node in its chapter — the roster
 * pattern, one component two doors' worth of truth.
 * A quest's note seats under its steps when the
 * caller supplies one (the hearth's names the
 * brewing shelf once its cauldron stands seated).
 */
export function JournalMiniquests({
  rows,
  notes,
  theme = 'mire',
}: {
  rows: JournalMiniquestRow[];
  notes?: Readonly<Record<string, string>>;
  theme?: UiThemeName;
}) {
  void theme;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-stone-300">
        No small undertakings yet. What opens will be kept here.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((quest) => (
        <li
          key={quest.id}
          className="flex flex-col gap-y-0.5 rounded-xl bg-black/20 px-3 py-2"
        >
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{quest.title}</span>
            <span className="text-xs text-stone-400">
              {quest.done ? 'Done' : 'Underway'}
            </span>
          </span>
          {quest.steps.length > 0 ? (
            <ul className="mt-0.5 flex flex-col gap-y-0.5">
              {quest.steps.map((step) => (
                <li key={step.id} className="text-xs text-stone-400">
                  {step.done ? '✓ ' : '· '}
                  {step.label}
                </li>
              ))}
            </ul>
          ) : quest.hint ? (
            <span className="text-xs text-stone-400">{quest.hint}</span>
          ) : null}
          {notes?.[quest.id] ? (
            <span className="mt-1 text-xs italic text-stone-500">
              {notes[quest.id]}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export interface JournalPanelProps {
  /**
   * The book's order (the Newest sort, 2026-11-06):
   * 'standing' = each page in its recorded order (the
   * book's standing read, the default); 'newest' =
   * the caller re-stamps the listing pages
   * freshest-first. The panel renders the control at
   * the book's head; the ordering itself is the
   * caller's stamping (the quest log is excluded by
   * ruling — its grouping IS its order). Omitted =
   * no control (the book reads standing).
   */
  sortOrder?: 'standing' | 'newest';
  /** Report a tap on the order control. */
  onSortChange?: (order: 'standing' | 'newest') => void;
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
   * Her bases (the Returning build), the caller's
   * order — the enumeration's order: last sleep
   * first, then placed houses. Rendered above the
   * named places in the same Places section, under
   * the SAME selection (base ids and place ids share
   * the seat; the namespaces never collide).
   * Omitted/empty = no base rows.
   */
  bases?: JournalBaseRow[];
  /**
   * Scry the selected row (a base or a named place)
   * — the Returning travel door. The panel renders
   * the door on whichever row is selected; the
   * caller runs the act (the first base row is the
   * home destination; every other row travels to
   * its place) and voices the outcome.
   */
  onScryTarget?: () => void;
  /**
   * Her awakened charms (the toggles build): rendered
   * as the book's Charms page, below Places and above
   * Quests — the journal mirror of the Charms panel's
   * switches, stamped from the caller's one row source.
   * Omitted/empty = no charms yet (the section does not
   * render, like Names).
   */
  charms?: JournalCharmRow[];
  /**
   * Flip one charm's effect on/off from the book — the
   * same act the Charms panel's switch runs. The caller
   * owns the act; the panel only reports the tap.
   * Omitted = rows render without a switch.
   */
  onToggleCharm?: (kind: string) => void;
  /**
   * Her company, as the book's Companions page (the
   * roster dialog): the caller-rendered RosterPanel
   * node (embedded form — the SAME component and rows
   * the N door renders). Rendered below Charms and
   * above Quests whenever supplied — an empty roster
   * still renders its page (the book's page stands
   * like the Places section's naming door does).
   * Omitted = no Companions page.
   */
  companions?: ReactNode;
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
   * Her miniquests (the book build): the caller-
   * rendered chapter node (the roster pattern — the
   * stamp is the exported JournalMiniquests below,
   * composed by the caller with live step reads and
   * completion notes the panel cannot derive).
   * Rendered as its OWN chapter — never inside the
   * Quests chapter's act folds. Omitted = the
   * chapter stands with its standing empty line.
   */
  miniquests?: ReactNode;
  /**
   * The mark control for the book's quest log (the
   * HUD-card chunk): passed through to the QuestLogs.
   * Omitted = the log renders read-only.
   */
  onMarkQuest?: (questId: string) => void;
  /**
   * The places she has FOUND (the gazetteer surface —
   * the book build): the caller's rows from the
   * register's records, rendered at the head of the
   * Places chapter above her named places. Newest
   * re-stamps them freshest-found first (the caller's
   * ordering, like every listing page). Omitted =
   * no Found gathering.
   */
  found?: JournalFoundRow[];
  /**
   * The General Info chapter's stamped content (the
   * book build): the caller's front-matter node, if
   * any. Omitted = the chapter stands on its
   * frontispiece line alone. No content is invented
   * for this chapter.
   */
  info?: ReactNode;
  /** Called when the player closes the panel. Optional. */
  onClose?: () => void;
  /** Thumb-sized close button (44 px target) on touch. Default false. */
  comfortable?: boolean;
  /** Look for the panel. Default "mire". */
  theme?: UiThemeName;
}

export function JournalPanel({
  sortOrder,
  onSortChange,
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
  bases,
  onScryTarget,
  charms,
  onToggleCharm,
  companions,
  quests,
  miniquests,
  found,
  info,
  onMarkQuest,
  onClose,
  comfortable = false,
  theme = 'mire',
}: JournalPanelProps) {
  const t = UI_THEMES[theme];
  // THE CHAPTERS (the book build): the open chapter
  // is the panel's own session state — the panel
  // mounts per opening, so the book opens on its
  // front page (General Info) each time; the state
  // is never saved. The tab order is Adam's set in
  // DEV's proposed order, General Info first as the
  // book's front page.
  const [chapter, setChapter] = useState<
    | 'info'
    | 'quests'
    | 'miniquests'
    | 'marks'
    | 'places'
    | 'names'
    | 'charms'
    | 'companions'
  >('info');
  const CHAPTERS = [
    { id: 'info', label: 'General Info' },
    { id: 'quests', label: 'Quests' },
    { id: 'miniquests', label: 'Miniquests' },
    { id: 'marks', label: 'Marks' },
    { id: 'places', label: 'Places' },
    { id: 'names', label: 'Names' },
    { id: 'charms', label: 'Charms' },
    { id: 'companions', label: 'Companions' },
  ] as const;
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
  // THE BOOK'S DRESSING (the restyle): aged-paper
  // pages in place of the theme's panel skin — warm
  // bone paper, darkened and foxed edges, ink text.
  // The look is the book's own whichever theme the
  // caller passes (a journal is a journal); the
  // theme still voices the tab strip and the
  // controls carried over from the old panel. Row
  // cards sit on the paper as a paler wash; the
  // standing text-stone-300/400 detail lines darken
  // to ink by the page's own overrides below.
  const bookSkin =
    'border border-[#8a6d3b]/80 text-stone-800 shadow-2xl ' +
    'bg-[linear-gradient(172deg,#f6efdb_0%,#efe3c2_55%,#e7d6ab_100%)] ' +
    '[&_.text-stone-300]:text-stone-600 [&_.text-stone-400]:text-stone-500 ' +
    '[&_[class~="bg-black/20"]]:bg-[#d9c48f]/60';
  const tabBtn = (active: boolean) =>
    'rounded-t-lg px-2.5 py-1.5 text-xs font-semibold tracking-wide ' +
    (comfortable ? 'min-h-[44px] ' : '') +
    (active
      ? 'bg-[#f6efdb] text-stone-900 shadow-[0_-2px_6px_rgba(60,40,10,0.25)] outline outline-1 outline-[#8a6d3b]/70'
      : 'bg-[#cbb37e] text-stone-700 hover:bg-[#dcc794] outline outline-1 outline-[#8a6d3b]/50');
  return (
    <section
      aria-label="Journal"
      className={'@container rounded-2xl p-3 ' + bookSkin}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-stone-900">Journal</h2>
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
      <div
        className="mb-2 flex flex-wrap gap-1 border-b border-[#8a6d3b]/50 pb-0"
        role="tablist"
        aria-label="Journal chapters"
      >
        {CHAPTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={chapter === entry.id}
            data-chapter={entry.id}
            onClick={() => setChapter(entry.id)}
            className={tabBtn(chapter === entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="relative rounded-xl bg-[linear-gradient(90deg,transparent_0%,rgba(120,90,40,0.14)_49.6%,rgba(90,65,25,0.38)_50%,rgba(120,90,40,0.14)_50.4%,transparent_100%)] px-1 py-1 @max-[640px]:bg-none">
      {chapter === 'info' ? (
        <div role="tabpanel" aria-label="General Info">
          <p className="text-sm italic text-stone-600">
            What you copy down will be kept here.
          </p>
          {info ?? null}
          {onSortChange ? (
            <div className="mt-3 flex items-center gap-1" role="group" aria-label="Journal order">
              <span className="mr-1 text-xs text-stone-500">
                The book&rsquo;s order:
              </span>
              <button
                type="button"
                aria-pressed={sortOrder !== 'newest'}
                onClick={() => onSortChange('standing')}
                className={btn + t.button}
              >
                Standing order
              </button>
              <button
                type="button"
                aria-pressed={sortOrder === 'newest'}
                onClick={() => onSortChange('newest')}
                className={btn + t.button}
              >
                Newest
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {chapter === 'marks' ? (
        <div role="tabpanel" aria-label="Marks">
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
                    ? 'The mark stands whole'
                    : row.fills > 0
                      ? `${row.fills} ${row.fills === 1 ? 'clock' : 'clocks'} filled · ${row.coveredHours} of 12 hours toward the next`
                      : `${row.coveredHours} of 12 hours toward the first tier`}
                </span>
              </span>
              <span className="text-xs text-stone-400">
                {row.seekingSinceDay !== null
                  ? `Looking since day ${row.seekingSinceDay}`
                  : 'Looking'}
                {` · ${row.count} ${row.count === 1 ? 'copy' : 'copies'} kept`}
                {row.bestWord !== null
                  ? ` · the clock reads ${row.bestWord}`
                  : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
        </div>
      ) : null}
      {chapter === 'names' ? (
        <div role="tabpanel" aria-label="Names">
      {names && names.length > 0 ? (
        <div>
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
      ) : (
        <p className="text-sm text-stone-300">
          No names learned yet. The rites will teach them, and they
          will be kept here.
        </p>
      )}
        </div>
      ) : null}
      {chapter === 'places' ? (
        <div role="tabpanel" aria-label="Places">
      {found && found.length > 0 ? (
        <div className="mb-3">
          <h3 className={'mb-2 text-sm font-semibold ' + t.heading}>
            Found
          </h3>
          <ul className="flex flex-col gap-2">
            {found.map((row) => (
              <li
                key={row.placeKey}
                className="flex flex-col gap-y-0.5 rounded-xl bg-black/20 px-3 py-2"
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-xs text-stone-400">
                    {row.familyLabel}
                    {row.here
                      ? row.detail
                        ? ` · ${row.detail}`
                        : ''
                      : row.dimensionLabel
                        ? ` · ${row.dimensionLabel}`
                        : ''}
                  </span>
                </span>
                <span className="text-xs text-stone-400">
                  Found on day {row.dayFound}
                  {row.carrierNote ? ` · ${row.carrierNote}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {places ? (
        <div>
          <h3 className={'mb-2 text-sm font-semibold ' + t.heading}>
            Named
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
          {bases && bases.length > 0 ? (
            <ul className="mb-2 flex flex-col gap-2">
              {bases.map((row) => {
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
                        {row.detail ?? ''}
                        {selected ? ' · Selected' : ''}
                      </span>
                    </button>
                    {selected && onScryTarget ? (
                      <span className="mt-1 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onScryTarget()}
                          className={btn + t.button}
                        >
                          Scry
                        </button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {places.length === 0 ? (
            bases && bases.length > 0 ? null : (
              <p className="text-sm text-stone-300">
                No places named yet. The names you give will be kept
                here.
              </p>
            )
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
                      (onRenamePlace || onUnnamePlace || onScryTarget) ? (
                      <span className="mt-1 flex flex-wrap gap-2">
                        {onScryTarget ? (
                          <button
                            type="button"
                            onClick={() => onScryTarget()}
                            className={btn + t.button}
                          >
                            Scry
                          </button>
                        ) : null}
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
        </div>
      ) : null}
      {chapter === 'charms' ? (
        <div role="tabpanel" aria-label="Charms">
      {charms && charms.length > 0 ? (
        <div>
          <ul className="flex flex-col gap-2">
            {charms.map((row) => (
              <li
                key={row.kind}
                className="flex flex-col gap-y-0.5 rounded-xl bg-black/20 px-3 py-2"
              >
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-xs text-stone-400">
                    Tier {row.tier}
                    {row.enabled ? '' : ' — its effect is off'}
                  </span>
                </span>
                <span className="text-xs text-stone-400">{row.note}</span>
                {onToggleCharm ? (
                  <span className="mt-1">
                    <button
                      type="button"
                      onClick={() => onToggleCharm(row.kind)}
                      aria-pressed={row.enabled}
                      aria-label={`Turn ${row.enabled ? 'off' : 'on'} ${row.name}`}
                      className={btn + t.button}
                    >
                      {row.enabled ? 'Turn off' : 'Turn on'}
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-stone-300">
          No charms awakened yet. What wakes will be kept here.
        </p>
      )}
        </div>
      ) : null}
      {chapter === 'companions' ? (
        <div role="tabpanel" aria-label="Companions">
      {companions !== undefined && companions !== null ? (
        <div>
          {companions}
        </div>
      ) : null}
        </div>
      ) : null}
      {chapter === 'miniquests' ? (
        <div role="tabpanel" aria-label="Miniquests">
          {miniquests ?? (
            <p className="text-sm text-stone-300">
              No small undertakings yet. What opens will be kept here.
            </p>
          )}
        </div>
      ) : null}
      {chapter === 'quests' ? (
        <div role="tabpanel" aria-label="Quests">
      {quests ? (
        <div>
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
        </div>
      ) : null}
      </div>
    </section>
  );
}
