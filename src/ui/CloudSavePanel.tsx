/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — cloud saves panel (UI lane,
 * presentation only).
 *
 * The Cloud Saves tab of the Options modal (Adam,
 * 2026-10-29). Props-driven only: every cloud fact and
 * every action arrives as props from App's wiring — this
 * file imports nothing from game/engine/systems code.
 * Sections, in order: opt-in toggle; words (create vs
 * enter, then the words screen); sync line; rename;
 * cloud list (Bring here / Remove); parked save;
 * remove disclosure; load-from-cloud door (ALWAYS
 * visible — typed-words lookup + Bring, 2026-10-29);
 * New Game. Words screen wording is PROPOSED
 * (Adam pins at sighting); no password gate (the
 * player's own machine holds the words, per approval).
 *
 * Opt-in flow (bug fix, 2026-10-29): the module reports
 * enabled only once words exist (turnOn/enterWords set
 * both), so a fresh user's toggle click can never flip
 * the module state by itself — the panel holds a LOCAL
 * reveal state instead: clicking ON checks the box and
 * reveals the words choice right there; completing the
 * words (create or enter) lands on the module's real
 * enabled state and the reveal clears; clicking OFF
 * from the revealed state just cancels the reveal (no
 * module call), and OFF from truly-on rides the
 * caller's turnOff path as before.
 * ADOPT (2026-10-31, Adam: "let's get the words
 * first"): a device that HAS words can switch identity
 * to words he already has (onAdoptWords — the module's
 * adoptWords; the wordless case already had the enter
 * door). The flow is form → confirm → call: the
 * confirm step shows both word sets with the honesty
 * block (saves under the old words stay on that shelf;
 * switching moves nothing; switching alone copies
 * nothing — all copy DRAFT for Adam's pin pass).
 * Adoption leaves mirroring HELD (sync.mirrorHeld):
 * the sync line then states it plainly beside the
 * deliberate arm button (onArmMirroring); a bring or
 * restore applied under the adopted identity arms
 * automatically on the caller's side. No generation
 * happens anywhere in this flow.
 * Sync mapping: enabled + mirrored ok → 'Synced';
 * enabled + never mirrored → 'Will sync on next save';
 * enabled + last mirror failed unreachable → 'Will sync
 * when back online' (the next saveNow retries); other
 * failures → 'Sync failed: <reason>'. No manual sync
 * in v1 (saveNow-only), no listener (open/action
 * refresh only, driven by App).
 */

import { useEffect, useState } from 'react';
import { UI_THEMES, type UiThemeName } from './themes';

export interface CloudSaveRow {
  slot: string;
  name?: string;
  seed: string;
  updatedAt: string;
}

export interface CloudParkedSave {
  name?: string;
  seed: string;
  savedAt?: number;
}

export interface CloudSyncDisplay {
  enabled: boolean;
  wordsStored: boolean;
  lastMirror: { at: number; ok: boolean; reason?: string } | null;
  /** Adoption hold (2026-10-31): true while mirroring
    is disarmed after adopting words, until a deliberate
    arm (button, or a bring/restore applied under the
    adopted identity on the caller's side). Optional —
    sync objects from before the field read as unheld. */
  mirrorHeld?: boolean;
}

export interface CloudSavePanelProps {
  sync: CloudSyncDisplay;
  words: readonly [string, string, string] | null;
  saves: CloudSaveRow[];
  parked: CloudParkedSave | null;
  /** Current local world name (rename field's value). */
  currentName?: string;
  busy: boolean;
  note: string | null;
  onToggle: (on: boolean) => void;
  onGenerateWords: () => void;
  onEnterWords: (input: string) => void;
  /** Adopt-existing-words (2026-10-31): switch this
    device's cloud identity to the entered words. The
    caller validates (a word off the list refuses
    plainly and changes nothing) and, on success,
    re-points the identity display + this list to the
    adopted shelf. */
  onAdoptWords: (input: string) => void;
  /** The deliberate arm (2026-10-31): start copying
    this device's world to the current shelf after an
    adoption hold. */
  onArmMirroring: () => void;
  onRefreshList: () => void;
  onBringHere: (slot: string) => void;
  /** Load-from-cloud door (2026-10-29): the typed-words
    lookup's rows — null = no lookup yet. Kept separate
    from `saves` (the device's own list) by design. */
  loadSaves: CloudSaveRow[] | null;
  /** The lookup's own note (invalid words' reason, or
    the no-saves line). */
  loadNote: string | null;
  onLoadLookup: (input: string) => void;
  onLoadBringHere: (slot: string) => void;
  onRemove: (slot: string) => void;
  onRestoreParked: () => void;
  onRename: (name: string) => void;
  onNewGame: () => void;
  theme?: UiThemeName;
  comfortable?: boolean;
}

function rowTitle(row: CloudSaveRow): string {
  if (row.name) return row.name;
  return row.slot === 'main' ? 'Main save' : row.slot;
}

export function CloudSavePanel({
  sync,
  words,
  saves,
  parked,
  currentName,
  busy,
  note,
  onToggle,
  onGenerateWords,
  onEnterWords,
  onAdoptWords,
  onArmMirroring,
  onRefreshList,
  onBringHere,
  loadSaves,
  loadNote,
  onLoadLookup,
  onLoadBringHere,
  onRemove,
  onRestoreParked,
  onRename,
  onNewGame,
  theme = 'mire',
  comfortable = false,
}: CloudSavePanelProps) {
  const t = UI_THEMES[theme];
  // Opt-in reveal (see the header): true while the
  // player has clicked the toggle ON but has not yet
  // completed the words. Clears the moment the module
  // reports truly enabled, so it can never mask a
  // later off.
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (sync.enabled) setReveal(false);
  }, [sync.enabled]);
  const shownOn = sync.enabled || reveal;
  const [showEnter, setShowEnter] = useState(false);
  const [enterInput, setEnterInput] = useState('');
  // Adopt flow (2026-10-31): form → confirm → call.
  // adoptPending holds the typed input between the
  // form's submit and the confirm's decision; the
  // caller is only called from the confirm.
  const [showAdopt, setShowAdopt] = useState(false);
  const [adoptInput, setAdoptInput] = useState('');
  const [adoptPending, setAdoptPending] = useState(false);
  const [loadInput, setLoadInput] = useState('');
  const [showWords, setShowWords] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [renameInput, setRenameInput] = useState(currentName ?? '');

  const buttonClass =
    'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70 ' +
    (comfortable ? 'min-h-[44px] px-3 py-2' : '');
  const inputClass =
    'bg-[#1e241c] border border-moss-deep px-2 py-1 text-sm text-stone-100 outline-none ' +
    (comfortable ? 'min-h-[44px]' : '');

  let syncLine = 'Cloud off';
  if (sync.enabled) {
    if (sync.lastMirror === null) {
      syncLine = 'Will sync on next save';
    } else if (sync.lastMirror.ok) {
      syncLine =
        'Synced ' + new Date(sync.lastMirror.at).toLocaleString();
    } else if (
      sync.lastMirror.reason === 'Could not reach the cloud box.'
    ) {
      syncLine = 'Will sync when back online';
    } else {
      syncLine =
        'Sync failed: ' + (sync.lastMirror.reason ?? 'unknown error');
    }
  }

  const copyWords = () => {
    if (words === null) return;
    try {
      const clipboard = globalThis.navigator?.clipboard;
      if (clipboard === undefined) throw new Error('no clipboard');
      void clipboard.writeText(words.join(' ')).then(
        () => {
          setCopied(true);
          setCopyFailed(false);
        },
        () => {
          setCopied(false);
          setCopyFailed(true);
        },
      );
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  return (
    <div className="flex flex-col gap-3 text-sm text-stone-200">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={shownOn}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.checked;
            if (next) {
              // Reveal: check the box locally + show the
              // words choice; the caller's toggle handler
              // is reveal-only on ON (no module call).
              setReveal(true);
              onToggle(true);
            } else if (sync.enabled) {
              // Truly on: the caller's turnOff path.
              setReveal(false);
              onToggle(false);
            } else {
              // Revealed but never on: cancel the reveal,
              // nothing else — no module call.
              setReveal(false);
            }
          }}
        />
        Cloud saves
      </label>

      {!shownOn ? (
        <p className="text-xs opacity-70">
          When cloud saves are on, each save also copies this world to
          your cloud box, so you can bring it down on another device
          with three words.
        </p>
      ) : null}

      {shownOn && words === null ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={onGenerateWords}
            >
              Create cloud save
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={() => setShowEnter(true)}
            >
              I already have words
            </button>
          </div>
          {showEnter ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onEnterWords(enterInput);
              }}
            >
              <input
                value={enterInput}
                onChange={(e) => setEnterInput(e.target.value)}
                placeholder="word word word"
                className={inputClass}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className={buttonClass}
                  disabled={busy}
                >
                  Use these words
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => setShowEnter(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {sync.enabled && words !== null ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={buttonClass + ' self-start'}
            disabled={busy}
            onClick={() => {
              setShowWords(!showWords);
              setCopied(false);
              setCopyFailed(false);
            }}
          >
            {showWords ? 'Hide my words' : 'Show my words'}
          </button>
          {showWords ? (
            <div className="flex flex-col gap-2">
              <p className="text-xl font-semibold tracking-wide">
                {words.join(' ')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy}
                  onClick={copyWords}
                >
                  Copy
                </button>
                {copied ? (
                  <span className="text-xs self-center">Copied!</span>
                ) : null}
                {copyFailed ? (
                  <span className="text-xs self-center">
                    Could not copy — write them down.
                  </span>
                ) : null}
              </div>
              <p className="text-xs opacity-80">
                Write these words down. If you lose them, your cloud
                saves are gone — no one can recover them, not even us.
              </p>
            </div>
          ) : null}

          {sync.mirrorHeld === true ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs opacity-70">
                This device isn&rsquo;t copying its world to this
                shelf yet.
              </p>
              <button
                type="button"
                className={buttonClass + ' self-start'}
                disabled={busy}
                onClick={onArmMirroring}
              >
                Start copying this device&rsquo;s world here
              </button>
            </div>
          ) : (
            <p className="text-xs opacity-70">{syncLine}</p>
          )}

          <div className="flex flex-col gap-2 border-t border-moss-deep pt-3">
            {!showAdopt ? (
              <button
                type="button"
                className={buttonClass + ' self-start'}
                disabled={busy}
                onClick={() => setShowAdopt(true)}
              >
                Use words I already have
              </button>
            ) : adoptPending ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">
                  Switch this device&rsquo;s cloud words?
                </p>
                <p className="text-xs opacity-80">
                  Now: {words.join(' ')}
                  <br />
                  To:{' '}
                  {adoptInput.trim().split(/\s+/).join(' ')}
                </p>
                <p className="text-xs opacity-80">
                  Saves copied under your current words stay on
                  that shelf — switching does not move them.
                  Switching alone doesn&rsquo;t copy this
                  device&rsquo;s world anywhere. You can switch
                  back any time by entering those words here.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => {
                      onAdoptWords(adoptInput);
                      setAdoptPending(false);
                      setShowAdopt(false);
                      setAdoptInput('');
                    }}
                  >
                    Switch to these words
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => setAdoptPending(false)}
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setAdoptPending(true);
                }}
              >
                <input
                  value={adoptInput}
                  onChange={(e) => setAdoptInput(e.target.value)}
                  placeholder="word word word"
                  aria-label="Three cloud words to switch to"
                  className={inputClass}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className={buttonClass}
                    disabled={busy}
                  >
                    Use these words
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => setShowAdopt(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs opacity-70">
              World name:
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="Name this world"
                className={inputClass}
              />
              <button
                type="button"
                className={buttonClass}
                disabled={busy}
                onClick={() => onRename(renameInput.trim())}
              >
                Save name
              </button>
            </div>
            <p className="text-xs opacity-70">
              Saved with your next save.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <h3 className={'text-sm font-semibold ' + t.heading}>
              Cloud saves
            </h3>
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={onRefreshList}
            >
              Refresh
            </button>
          </div>
          {saves.length === 0 && !busy ? (
            <p className="text-xs opacity-70">No cloud saves found.</p>
          ) : null}
          {saves.map((row) => (
            <div key={row.slot} className="flex flex-col gap-1">
              <p>
                {rowTitle(row)} ·{' '}
                {new Date(row.updatedAt).toLocaleString()}
              </p>
              <p className="text-xs opacity-70">Seed: {row.seed}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => onBringHere(row.slot)}
                >
                  Bring here
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => onRemove(row.slot)}
                >
                  Remove from cloud
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs opacity-70">
            Removing a cloud copy does not turn off mirroring — the
            next save copies this world to the cloud again. Turn
            cloud off to stop mirroring.
          </p>

          {parked !== null ? (
            <div className="flex flex-col gap-1">
              <p>
                Parked save: {parked.name ?? 'Main save'} ·{' '}
                {parked.seed}
                {parked.savedAt !== undefined
                  ? ' · ' + new Date(parked.savedAt).toLocaleString()
                  : ''}
              </p>
              <button
                type="button"
                className={buttonClass + ' self-start'}
                disabled={busy}
                onClick={onRestoreParked}
              >
                Restore parked save
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Load from cloud (Adam, 2026-10-29 — he ordered
        the door himself: with cloud ON the tab showed no
        place to type words at all): ALWAYS visible —
        cloud on, off, or wordless — because its whole
        point is reaching saves under words this device
        does not hold. The lookup validates in App
        (canonicalizeWords) before anything is fetched;
        Bring rides the caller's existing confirm + park +
        install path under the TYPED words. One-time fetch
        semantics, stated on the panel: the device's own
        words and its on/off switch never change here (if
        cloud is on, the brought world syncs under the
        device's own words from the next save). Copy is
        PROPOSED, like the words screen's — Adam pins at
        sighting. */}
      <div className="flex flex-col gap-2 border-t border-moss-deep pt-3">
        <h3 className={'text-sm font-semibold ' + t.heading}>
          Load from cloud
        </h3>
        <p className="text-xs opacity-70">
          Look up the worlds under any three words and bring one
          here. This is a one-time fetch — it does not change this
          device's own words or its cloud on/off switch.
        </p>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onLoadLookup(loadInput);
          }}
        >
          <input
            value={loadInput}
            onChange={(e) => setLoadInput(e.target.value)}
            placeholder="word word word"
            aria-label="Three cloud words to look up"
            className={inputClass}
          />
          <button
            type="submit"
            className={buttonClass}
            disabled={busy}
          >
            Look up
          </button>
        </form>
        {loadNote !== null ? (
          <p className="text-xs opacity-80">{loadNote}</p>
        ) : null}
        {(loadSaves ?? []).map((row) => (
          <div key={row.slot} className="flex flex-col gap-1">
            <p>
              {rowTitle(row)} ·{' '}
              {new Date(row.updatedAt).toLocaleString()}
            </p>
            <p className="text-xs opacity-70">Seed: {row.seed}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={buttonClass}
                disabled={busy}
                onClick={() => onLoadBringHere(row.slot)}
              >
                Bring here
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* New Game: a local action, not a cloud one — it
        sits at the panel's bottom, outside the cloud
        branches above, so it shows whether cloud is on,
        off, or wordless. The App handler owns the
        confirm + park; this button only asks. */}
      <div className="flex flex-col gap-1 border-t border-moss-deep pt-3">
        <button
          type="button"
          className={buttonClass + ' self-start'}
          disabled={busy}
          onClick={onNewGame}
        >
          New Game
        </button>
        <p className="text-xs opacity-70">
          Start a fresh world — your current save is parked, not
          deleted.
        </p>
      </div>

      {busy ? <p className="text-xs opacity-70">Working…</p> : null}
      {note !== null ? (
        <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
          {note}
        </p>
      ) : null}
    </div>
  );
}
