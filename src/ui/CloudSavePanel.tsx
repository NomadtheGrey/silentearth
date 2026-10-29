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
 * remove disclosure. Words screen wording is PROPOSED
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
  onRefreshList: () => void;
  onBringHere: (slot: string) => void;
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
  onRefreshList,
  onBringHere,
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

          <p className="text-xs opacity-70">{syncLine}</p>

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
