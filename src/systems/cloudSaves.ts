/**
 * Cloud saves (Systems, 2026-10-29 — game-side module behind
 * UI's Settings-tab fields). Mirrors BioForge's proven shape
 * (KV + three-word secret), adapted to Silent Earth's one save.
 *
 * LAWS (not re-debated): opt-in only forever; local stays
 * master, cloud is mirror; the words are never stored in
 * chat, files, or memory — only on the player's machine, via
 * the keys below; the mirror never throws and never rolls
 * back a local save.
 *
 * LIVE BOX SPEC (FINAL, 2026-10-29 — module matches exactly;
 * any deviation needs DEV approval first): baseUrl
 * https://silentearth-saves.nomadthegrey71.workers.dev,
 * header x-silentearth-secret carrying the joined words,
 * routes GET /index + GET /save?slot= + PUT /save +
 * DELETE /save?slot=, KV silentearth-saves, 2 MB cap → 413,
 * :prev parking on overwrite, ~18-month expiry refreshed per
 * write, throttle 20/IP/hr + 500 global/hr + residents'
 * exemption (a fingerprint with an index is never refused).
 * Identity is the server-side SHA-256 fingerprint of the
 * presented secret; the words are never stored server-side,
 * and a leaked fingerprint can't be presented back.
 * Default baseUrl below IS the live box; callers may pass a
 * different baseUrl (probes, tests) — the default is the
 * production route, not a placeholder.
 *
 * DISCLOSED, NOT HIDDEN: KV index reads can lag writes
 * ~60 s (BioForge proof) — the index is converging, not
 * instant truth. list() mapping a 404 to an empty list is
 * deliberate: the box gives one 404 shape for wrong secret /
 * unknown route / missing slot, so "no saves yet" and "wrong
 * words" read the same from the index by design (wrong
 * guesses 'succeed' against an empty index — that is what
 * makes failure-counting unworkable as a throttle signal).
 *
 * SLOT + ENVELOPE (v1): single save → single slot 'main'.
 * Envelope { v: 1, slot: 'main', name?: worldName when set
 * (omitted otherwise — SaveData.worldName, landed via merge
 * #20), seed: SaveData.seed, updatedAt: ISO at mirror time,
 * record: SaveData VERBATIM } — the builder takes the save
 * object as given (no copy, no re-serialize); JSON.stringify
 * at send time is the only transformation.
 *
 * KEYS (module-owned; UI never touches keys directly):
 * words blob 'silentearth.cloudWords.v1' { words, enabled },
 * sync note 'silentearth.cloudLastSync.v1' { at, ok, reason? },
 * park 'silentearth.savePark.v1' (displaced local on
 * bring-down, single slot, overwritten each bring-down —
 * the :prev analog). All storage access is guarded and
 * never throws; a missing or corrupt blob reads as off.
 *
 * BOUNDARIES (read before wiring): this module NEVER writes
 * the local save key — mirrorSave only PUTs; bringHere only
 * fetches + validates and returns the SaveData; App/UI
 * performs confirm, park, and the restore-path write. The
 * restore-parked door SWAPS current ↔ parked (UI/App's
 * door, using parkLocal + readParked here) — so restore
 * never deletes; but a NEW bring-down still overwrites the
 * park (prior parked then gone — :prev semantics, stated
 * plainly). Removing the cloud copy does NOT turn mirroring
 * off (next saveNow re-mirrors — UI must say so). Turning
 * on with NEW words abandons the old fingerprint's copies
 * (they persist server-side under the old secret until
 * expiry/removal — UI's turn-on wording should say so).
 * Confirm screens, the no-recovery warning, and the remove
 * disclosure are UI's screens, not this module's. The
 * saveNow mirror call itself rides UI's App wiring
 * (DEV-routed follow-up) — this landing is module-only.
 * TS NOTE (repo quirk, verified 2026-10-27 and again here):
 * boolean-discriminant unions do NOT narrow on truthiness,
 * negation, or ternary in this repo's TS config — this file
 * uses `=== true` / `=== false` checks throughout; do not
 * 'simplify' them back to truthiness.
 *
 * No-recovery note: the module supplies the words via
 * getWords(); the warning lives on UI's screen.
 */

import { deserializeSave } from './save';
import type { SaveData } from './save';
import { CLOUD_WORD_SET, CLOUD_WORDS } from './cloudWords';

/** Live box base URL (FINAL spec — see header). */
export const CLOUD_BASE_URL =
  'https://silentearth-saves.nomadthegrey71.workers.dev';

/** Secret header (FINAL spec — carries the joined words). */
export const CLOUD_SECRET_HEADER = 'x-silentearth-secret';

/** Single cloud slot, v1 (one save → one slot). */
export const CLOUD_SLOT = 'main';

/** Box cap: envelopes over this are refused before sending. */
export const CLOUD_MAX_BYTES = 2 * 1024 * 1024;

/** Three cloud words, in order. */
export type CloudWords = readonly [string, string, string];

/** Canonicalize outcome. Reasons never contain the words. */
export type CanonicalizeResult =
  | { ok: true; words: [string, string, string]; joined: string }
  | { ok: false; reason: string };

/** Never-throw API outcome (value on success, reason on failure). */
export type ApiResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

/** Simple action outcome (no value). */
export type CloudAction = { ok: boolean; reason?: string };

/** Cloud envelope, stored verbatim by the box. */
export interface CloudEnvelope {
  v: 1;
  slot: string;
  name?: string;
  seed: string;
  updatedAt: string;
  record: SaveData;
}

/** One mirror attempt, for the sync-state note. */
export interface CloudSyncNote {
  at: number;
  ok: boolean;
  reason?: string;
}

/** Sync state for UI's Settings display. */
export interface CloudSyncState {
  enabled: boolean;
  wordsStored: boolean;
  lastMirror: CloudSyncNote | null;
}

/**
 * Mirror outcome. mirrored:false + ok:true = no PUT was
 * needed/performed by this call and nothing failed: cloud
 * off, the record already mirrored identically, or the
 * record coalesced into the pending flush (see the
 * coalescing note at mirrorSave).
 */
export interface MirrorResult {
  mirrored: boolean;
  ok: boolean;
  reason?: string;
}

/**
 * Minimal fetch shape (structural, not DOM Response): the
 * module never touches global fetch directly except through
 * the default adapter below, so probes pass a stub.
 */
export type CloudFetch = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    /** Set on PUTs so a pagehide flush survives unload. */
    keepalive?: boolean;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

const CLOUD_WORDS_KEY = 'silentearth.cloudWords.v1';
const CLOUD_SYNC_KEY = 'silentearth.cloudLastSync.v1';
const CLOUD_PARK_KEY = 'silentearth.savePark.v1';

interface CloudWordsBlob {
  words: [string, string, string] | null;
  enabled: boolean;
}

function defaultFetch(
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    keepalive?: boolean;
  },
): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> {
  return globalThis
    .fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      ...(init.keepalive ? { keepalive: true } : {}),
    })
    .then((res) => ({
      ok: res.ok,
      status: res.status,
      text: () => res.text(),
    }));
}

function readWordsBlob(): CloudWordsBlob | null {
  try {
    const raw = globalThis.localStorage?.getItem(CLOUD_WORDS_KEY);
    if (raw === null || raw === undefined) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const words = record['words'];
    if (words !== null) {
      if (
        !Array.isArray(words) ||
        words.length !== 3 ||
        words.some((w) => typeof w !== 'string')
      ) {
        return null;
      }
    }
    return {
      words: words as [string, string, string] | null,
      enabled: record['enabled'] === true,
    };
  } catch {
    return null;
  }
}

function writeWordsBlob(blob: CloudWordsBlob): boolean {
  try {
    globalThis.localStorage?.setItem(CLOUD_WORDS_KEY, JSON.stringify(blob));
    return true;
  } catch {
    return false;
  }
}

function readSyncNote(): CloudSyncNote | null {
  try {
    const raw = globalThis.localStorage?.getItem(CLOUD_SYNC_KEY);
    if (raw === null || raw === undefined) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record['at'] !== 'number' || typeof record['ok'] !== 'boolean') {
      return null;
    }
    return {
      at: record['at'] as number,
      ok: record['ok'] as boolean,
      ...(typeof record['reason'] === 'string'
        ? { reason: record['reason'] as string }
        : {}),
    };
  } catch {
    return null;
  }
}

function noteCloudSync(note: CloudSyncNote): void {
  try {
    globalThis.localStorage?.setItem(CLOUD_SYNC_KEY, JSON.stringify(note));
  } catch {
    // A failed note never fails the mirror it records.
  }
}

/**
 * Draw three words at random (crypto draw — no Math.random
 * for secrets; modulo bias negligible at this range).
 * Throws only when no secure random source exists.
 */
export function generateWords(): [string, string, string] {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj === undefined || cryptoObj.getRandomValues === undefined) {
    throw new Error('Secure random numbers are unavailable in this browser.');
  }
  const draws = cryptoObj.getRandomValues(new Uint32Array(3));
  return [
    CLOUD_WORDS[draws[0] % CLOUD_WORDS.length],
    CLOUD_WORDS[draws[1] % CLOUD_WORDS.length],
    CLOUD_WORDS[draws[2] % CLOUD_WORDS.length],
  ];
}

/**
 * Canonicalize a typed phrase: lowercase, single spaces,
 * exactly three words, each in the list (membership catches
 * typos; any generated phrase passes). Forgiving of case
 * and spacing. Reasons never contain the words.
 */
export function canonicalizeWords(input: string): CanonicalizeResult {
  const parts = input
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length !== 3) {
    return { ok: false, reason: 'Enter exactly three words.' };
  }
  for (const part of parts) {
    if (!CLOUD_WORD_SET.has(part)) {
      return { ok: false, reason: 'One of the words is not a cloud word.' };
    }
  }
  return {
    ok: true,
    words: [parts[0], parts[1], parts[2]],
    joined: parts.join(' '),
  };
}

/**
 * Turn cloud on with already-canonical words (from generate
 * or enterWords). Stores words + enabled; does NOT itself
 * PUT — the first mirror rides the next saveNow (one funnel,
 * no second write path).
 */
export function turnOn(words: CloudWords): CloudAction {
  if (
    words.length !== 3 ||
    words.some((w) => typeof w !== 'string' || !CLOUD_WORD_SET.has(w))
  ) {
    return { ok: false, reason: 'Those words are not a cloud phrase.' };
  }
  const stored = writeWordsBlob({
    words: [words[0], words[1], words[2]],
    enabled: true,
  });
  return stored
    ? { ok: true }
    : { ok: false, reason: 'Could not store the words on this device.' };
}

/**
 * Turn cloud off: clears words + enabled + sync note. Local
 * save untouched; cloud copy stays (remove is separate).
 */
export function turnOff(): CloudAction {
  // A pending coalesced mirror dies with the opt-in: it
  // must not PUT after the player turned cloud off.
  cancelPendingMirror();
  const cleared = writeWordsBlob({ words: null, enabled: false });
  try {
    globalThis.localStorage?.removeItem(CLOUD_SYNC_KEY);
  } catch {
    // Clearing the note is best-effort; the off state is what matters.
  }
  return cleared
    ? { ok: true }
    : { ok: false, reason: 'Could not clear the words on this device.' };
}

/** Stored words, or null (the show-words source for UI). */
export function getWords(): [string, string, string] | null {
  return readWordsBlob()?.words ?? null;
}

/**
 * Cloud on = enabled AND words present (enabled without
 * words — corrupt blob — reads as off; nothing can mirror
 * without words).
 */
export function isCloudEnabled(): boolean {
  const blob = readWordsBlob();
  return blob !== null && blob.enabled && blob.words !== null;
}

/**
 * Enter a typed phrase: canonicalize → store + enable.
 * No PUT — the next saveNow mirrors.
 */
export function enterWords(input: string): CloudAction {
  const canonical = canonicalizeWords(input);
  if (canonical.ok === false) return { ok: false, reason: canonical.reason };
  return turnOn(canonical.words);
}

/** Sync state for UI's Settings display. */
export function syncState(): CloudSyncState {
  return {
    enabled: isCloudEnabled(),
    wordsStored: getWords() !== null,
    lastMirror: readSyncNote(),
  };
}

/**
 * Build the envelope for a save: slot 'main', name from
 * saveData.worldName when set (omitted otherwise), seed
 * from the save, updatedAt now, record VERBATIM (same
 * reference — no copy, no re-serialize).
 */
export function buildCloudEnvelope(saveData: SaveData): CloudEnvelope {
  return {
    v: 1,
    slot: CLOUD_SLOT,
    ...(saveData.worldName
      ? { name: saveData.worldName }
      : {}),
    seed: saveData.seed,
    updatedAt: new Date().toISOString(),
    record: saveData,
  };
}

function envelopeByteLength(envelope: CloudEnvelope): number {
  return new TextEncoder().encode(JSON.stringify(envelope)).length;
}

type RequestOutcome =
  | { ok: true; status: number; json: unknown }
  | { ok: false; status: number | null; reason: string };

async function requestJson(
  baseUrl: string,
  path: string,
  secret: string,
  method: string,
  body: string | undefined,
  fetchFn: CloudFetch,
): Promise<RequestOutcome> {
  const url = baseUrl.replace(/\/+$/, '') + path;
  let res: { ok: boolean; status: number; text: () => Promise<string> };
  try {
    res = await fetchFn(url, {
      method,
      headers: { [CLOUD_SECRET_HEADER]: secret },
      ...(body !== undefined ? { body } : {}),
      // PUTs ride keepalive so a mirror flush fired on
      // pagehide can still land while the page unloads.
      ...(method === 'PUT' ? { keepalive: true } : {}),
    });
  } catch {
    return { ok: false, status: null, reason: 'Could not reach the cloud box.' };
  }
  let text: string;
  try {
    text = await res.text();
  } catch {
    return {
      ok: false,
      status: res.status,
      reason: 'Cloud reply could not be read.',
    };
  }
  if (!res.ok) {
    if (res.status === 404) {
      return { ok: false, status: 404, reason: 'Cloud save not found.' };
    }
    if (res.status === 413) {
      return {
        ok: false,
        status: 413,
        reason: 'Save too large for cloud (2 MB limit).',
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        status: 429,
        reason: 'Too many cloud requests — try again later.',
      };
    }
    return { ok: false, status: res.status, reason: `Cloud error (${res.status}).` };
  }
  if (text === '') return { ok: true, status: res.status, json: null };
  try {
    return { ok: true, status: res.status, json: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      status: res.status,
      reason: 'Cloud reply was not understood.',
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * List cloud slots (GET /index). The box answers with its
 * index DOCUMENT — { v: 1, saves: [ { slot, name, seed,
 * updatedAt, size }, ... ] }, the EMPTY_INDEX shape when
 * the player has none (Worker: silentearth-saves/src/
 * index.js, readIndex + the PUT handler's entry) — so the
 * slot names come from the entries' `slot` fields. Plain-
 * string entries and a bare string array are also accepted
 * (tolerance for simpler shapes); anything else is not
 * understood. NOTE (2026-10-29, the seam bug Adam found
 * live): the first version of this parser accepted only a
 * bare array and an invented { slots } record — neither is
 * a shape the box ever sends, so every real list call
 * failed 'not understood' and Bring was unreachable. The
 * { slots } branch was REMOVED, not kept: dead tolerance
 * for invented shapes is what left the seam untested. The
 * probe fixtures now transcribe the Worker's own response
 * shapes. A 404 still reads as an empty list (unknown
 * route shape, see header). Never throws.
 */
export async function listCloudSaves(
  baseUrl: string = CLOUD_BASE_URL,
  words: CloudWords,
  fetchFn: CloudFetch = defaultFetch,
): Promise<ApiResult<string[]>> {
  const res = await requestJson(
    baseUrl,
    '/index',
    words.join(' '),
    'GET',
    undefined,
    fetchFn,
  );
  if (res.ok === false) {
    if (res.status === 404) return { ok: true, value: [] };
    return { ok: false, reason: res.reason };
  }
  if (Array.isArray(res.json)) {
    return {
      ok: true,
      value: res.json.filter((slot) => typeof slot === 'string'),
    };
  }
  if (isRecord(res.json) && Array.isArray(res.json['saves'])) {
    const slots: string[] = [];
    for (const entry of res.json['saves'] as unknown[]) {
      if (typeof entry === 'string') {
        slots.push(entry);
      } else if (isRecord(entry) && typeof entry['slot'] === 'string') {
        slots.push(entry['slot'] as string);
      }
    }
    return { ok: true, value: slots };
  }
  return { ok: false, reason: 'Cloud index was not understood.' };
}

/**
 * Fetch one cloud envelope (GET /save?slot=). Validates
 * v === 1, slot match, and a record object. Never throws.
 */
export async function getCloudSave(
  baseUrl: string = CLOUD_BASE_URL,
  words: CloudWords,
  slot: string,
  fetchFn: CloudFetch = defaultFetch,
): Promise<ApiResult<CloudEnvelope>> {
  const res = await requestJson(
    baseUrl,
    `/save?slot=${encodeURIComponent(slot)}`,
    words.join(' '),
    'GET',
    undefined,
    fetchFn,
  );
  if (res.ok === false) return { ok: false, reason: res.reason };
  if (
    isRecord(res.json) &&
    res.json['v'] === 1 &&
    res.json['slot'] === slot &&
    isRecord(res.json['record'])
  ) {
    return { ok: true, value: res.json as unknown as CloudEnvelope };
  }
  return { ok: false, reason: 'Cloud save was not understood.' };
}

/**
 * Store one envelope (PUT /save, slot inside the envelope).
 * Never throws.
 */
export async function putCloudSave(
  baseUrl: string = CLOUD_BASE_URL,
  words: CloudWords,
  envelope: CloudEnvelope,
  fetchFn: CloudFetch = defaultFetch,
): Promise<CloudAction> {
  const res = await requestJson(
    baseUrl,
    '/save',
    words.join(' '),
    'PUT',
    JSON.stringify(envelope),
    fetchFn,
  );
  return res.ok === true ? { ok: true } : { ok: false, reason: res.reason };
}

/**
 * Delete one cloud copy (DELETE /save?slot=). A 404 reads
 * as success (already gone = desired state). Cloud copy
 * only — words + enabled stay (next saveNow re-mirrors).
 * Never throws.
 */
export async function deleteCloudSave(
  baseUrl: string = CLOUD_BASE_URL,
  words: CloudWords,
  slot: string,
  fetchFn: CloudFetch = defaultFetch,
): Promise<CloudAction> {
  const res = await requestJson(
    baseUrl,
    `/save?slot=${encodeURIComponent(slot)}`,
    words.join(' '),
    'DELETE',
    undefined,
    fetchFn,
  );
  if (res.ok === true) return { ok: true };
  if (res.status === 404) return { ok: true };
  return { ok: false, reason: res.reason };
}

/**
 * Bring a cloud save down: fetch + validate the envelope
 * and its record through deserializeSave. Returns the
 * SaveData; NEVER writes the local save key (App/UI
 * performs confirm, park, and the restore-path write).
 * Invalid or damaged → refuse, local untouched.
 */
export async function bringHere(
  baseUrl: string = CLOUD_BASE_URL,
  words: CloudWords,
  slot: string = CLOUD_SLOT,
  fetchFn: CloudFetch = defaultFetch,
): Promise<ApiResult<SaveData>> {
  const fetched = await getCloudSave(baseUrl, words, slot, fetchFn);
  if (fetched.ok === false) return { ok: false, reason: fetched.reason };
  const save = deserializeSave(fetched.value.record);
  if (save === null) {
    return {
      ok: false,
      reason: 'Cloud save is damaged and was left untouched.',
    };
  }
  return { ok: true, value: save };
}

/**
 * Park a displaced local save (single park slot, overwritten
 * each bring-down — the :prev analog). Returns false only
 * when storage itself fails. Never throws.
 */
export function parkLocal(doc: SaveData): boolean {
  try {
    globalThis.localStorage?.setItem(CLOUD_PARK_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the parked save (validated through deserializeSave —
 * a corrupt park reads as empty). Null = nothing parked.
 */
export function readParked(): SaveData | null {
  try {
    const raw = globalThis.localStorage?.getItem(CLOUD_PARK_KEY);
    if (raw === null || raw === undefined) return null;
    return deserializeSave(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mirror coalescing (2026-10-29 — Adam, on the KV daily-limit
// alert: saveNow fires on every harvest/drop/etc., and a PUT
// per saveNow burned ~500 of the free tier's 1,000 daily
// writes by mid-afternoon; coalescing is the design fix, not
// the paid tier)
// ---------------------------------------------------------------------------
//
// At most one PUT per CLOUD_MIRROR_WINDOW_MS while changes
// keep coming. mirrorSave calls inside the window REPLACE
// the single pending record (latest wins — never a queue of
// stale records) and one timer flushes at the window's end;
// a call after an idle window PUTs immediately (leading
// edge). A pagehide / visibility-hidden flush (self-
// registered below, guarded, once) sends the pending record
// at the same moment the shell saves locally, so closing
// the tab loses nothing. A record identical to the last
// successfully mirrored one is skipped entirely. A failed
// PUT keeps the record pending and retries only at the
// next window/flush — no retry loop, and the failure note
// is the only surface (never a throw, never a crash).

/** Minimum spacing between mirror PUTs, in milliseconds. */
export const CLOUD_MIRROR_WINDOW_MS = 60_000;

/** Clock/timer seams (probes inject fakes; defaults are real). */
export interface MirrorTiming {
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

interface PendingMirror {
  baseUrl: string;
  words: CloudWords;
  saveData: SaveData;
  /** Identity key of saveData (see mirrorRecordKey). */
  key: string;
  fetchFn: CloudFetch;
  /** True when the caller passed words explicitly (manual sync / probes). */
  explicit: boolean;
  now: () => number;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

let pendingMirror: PendingMirror | null = null;
let lastMirrorPutAt: number | null = null;
let lastMirroredKey: string | null = null;
let mirrorTimer: unknown = null;
let mirrorTimerClear: ((handle: unknown) => void) | null = null;
let mirrorFlushInFlight = false;
let hideFlushRegistered = false;

const defaultSetTimer = (fn: () => void, ms: number): unknown =>
  setTimeout(fn, ms);
const defaultClearTimer = (handle: unknown): void => {
  clearTimeout(handle as ReturnType<typeof setTimeout>);
};

/**
 * Identity of a record for the identical-skip: the
 * serialized record WITHOUT its volatile savedAt stamp
 * (every saveNow re-stamps savedAt, and the envelope
 * re-stamps updatedAt — neither is a content change).
 */
function mirrorRecordKey(saveData: SaveData): string {
  const copy: Record<string, unknown> = {
    ...(saveData as unknown as Record<string, unknown>),
  };
  delete copy['savedAt'];
  return JSON.stringify(copy);
}

function clearMirrorTimer(): void {
  if (mirrorTimer !== null && mirrorTimerClear !== null) {
    try {
      mirrorTimerClear(mirrorTimer);
    } catch {
      // A timer that cannot be cleared still fires into a
      // guarded flush (no pending = no-op).
    }
  }
  mirrorTimer = null;
  mirrorTimerClear = null;
}

function scheduleMirrorFlush(ctx: PendingMirror, delayMs: number): void {
  clearMirrorTimer();
  mirrorTimerClear = ctx.clearTimer;
  mirrorTimer = ctx.setTimer(() => {
    mirrorTimer = null;
    mirrorTimerClear = null;
    void flushPendingMirror();
  }, Math.max(0, delayMs));
}

/** Drop any pending mirror + its timer (turnOff's hook). */
function cancelPendingMirror(): void {
  pendingMirror = null;
  clearMirrorTimer();
}

/**
 * Self-register the closing-time flush, once, in a browser:
 * pagehide and visibility-hidden fire at the same moment
 * the shell makes its final local save, so the pending
 * mirror rides along (PUTs carry keepalive — see
 * requestJson). No-op outside a browser (probes, tooling).
 */
function registerHideFlush(): void {
  if (hideFlushRegistered) return;
  hideFlushRegistered = true;
  try {
    const w = globalThis as unknown as {
      addEventListener?: (type: string, fn: () => void) => void;
      document?: {
        addEventListener?: (type: string, fn: () => void) => void;
        visibilityState?: string;
      };
    };
    if (typeof w.addEventListener !== 'function') return;
    const flush = () => {
      void flushPendingMirror();
    };
    w.addEventListener('pagehide', flush);
    w.document?.addEventListener?.('visibilitychange', () => {
      if (w.document?.visibilityState === 'hidden') flush();
    });
  } catch {
    // Registration is best-effort; the window timer still
    // flushes during normal play.
  }
}

/**
 * Send the pending coalesced mirror NOW, if one exists —
 * the pagehide/visibility flush calls this, and the shell
 * may too. Returns null when nothing was pending. Honors
 * the failure law: a failed PUT keeps the record pending
 * and schedules the next window's retry. A non-explicit
 * pending whose stored words changed (turned off, or a new
 * phrase entered) since it was queued is dropped silently
 * — mirroring under a phrase the player replaced would be
 * wrong. Never throws.
 */
export async function flushPendingMirror(): Promise<MirrorResult | null> {
  const pending = pendingMirror;
  if (pending === null || mirrorFlushInFlight) return null;
  if (!pending.explicit) {
    const stored = getWords();
    if (
      stored === null ||
      !isCloudEnabled() ||
      stored.join(' ') !== pending.words.join(' ')
    ) {
      if (pendingMirror === pending) pendingMirror = null;
      clearMirrorTimer();
      return null;
    }
  }
  if (pending.key === lastMirroredKey) {
    if (pendingMirror === pending) pendingMirror = null;
    clearMirrorTimer();
    return { mirrored: false, ok: true };
  }
  mirrorFlushInFlight = true;
  try {
    const put = await putCloudSave(
      pending.baseUrl,
      pending.words,
      buildCloudEnvelope(pending.saveData),
      pending.fetchFn,
    );
    lastMirrorPutAt = pending.now();
    if (put.ok === true) {
      lastMirroredKey = pending.key;
      if (pendingMirror === pending) pendingMirror = null;
      clearMirrorTimer();
      noteCloudSync({ at: pending.now(), ok: true });
      return { mirrored: true, ok: true };
    }
    noteCloudSync({ at: pending.now(), ok: false, reason: put.reason });
    // Failure: the record STAYS pending; the only retry is
    // the next window's flush — no loop, no burst.
    if (pendingMirror === pending) {
      scheduleMirrorFlush(pending, CLOUD_MIRROR_WINDOW_MS);
    }
    return { mirrored: true, ok: false, reason: put.reason };
  } catch {
    return { mirrored: true, ok: false, reason: 'Unexpected mirror error.' };
  } finally {
    mirrorFlushInFlight = false;
  }
}

/**
 * Mirror one save to the cloud — the SINGLE mirror
 * implementation, coalesced (see the section header).
 * saveNow calls it after the local write succeeds; UI may
 * call it for a manual sync. With explicit words, the
 * caller’s intent is explicit (live probes, manual sync);
 * without them, the stored words gate it and cloud-off is
 * a no-op (mirrored:false + ok:true, not an error).
 * Oversize envelopes are refused before sending (immediate,
 * never pended). Inside the 60 s window the call returns
 * mirrored:false + ok:true once the record is pended; the
 * PUT itself happens at the flush. Never throws, never
 * touches local.
 */
export async function mirrorSave(
  baseUrl: string = CLOUD_BASE_URL,
  saveData: SaveData,
  opts?: { words?: CloudWords; fetchFn?: CloudFetch } & MirrorTiming,
): Promise<MirrorResult> {
  try {
    const words = opts?.words ?? getWords();
    if (words === null || (opts?.words === undefined && !isCloudEnabled())) {
      return { mirrored: false, ok: true };
    }
    const fetchFn = opts?.fetchFn ?? defaultFetch;
    const envelope = buildCloudEnvelope(saveData);
    if (envelopeByteLength(envelope) > CLOUD_MAX_BYTES) {
      const reason = 'Save too large for cloud (2 MB limit).';
      noteCloudSync({ at: Date.now(), ok: false, reason });
      return { mirrored: true, ok: false, reason };
    }
    const key = mirrorRecordKey(saveData);
    if (key === lastMirroredKey) {
      // Already the mirrored record — nothing to send.
      // Any pending is superseded too: the player's latest
      // state IS what the cloud holds, so a queued older
      // change must never land after it.
      if (pendingMirror !== null) cancelPendingMirror();
      return { mirrored: true, ok: true };
    }
    const now = opts?.now ?? Date.now;
    const pending: PendingMirror = {
      baseUrl,
      words,
      saveData,
      key,
      fetchFn,
      explicit: opts?.words !== undefined,
      now,
      setTimer: opts?.setTimer ?? defaultSetTimer,
      clearTimer: opts?.clearTimer ?? defaultClearTimer,
    };
    pendingMirror = pending;
    registerHideFlush();
    const nowMs = now();
    if (lastMirrorPutAt === null || nowMs - lastMirrorPutAt >= CLOUD_MIRROR_WINDOW_MS) {
      // Leading edge: idle window — PUT now.
      return (await flushPendingMirror()) ?? { mirrored: false, ok: true };
    }
    scheduleMirrorFlush(pending, lastMirrorPutAt + CLOUD_MIRROR_WINDOW_MS - nowMs);
    return { mirrored: false, ok: true };
  } catch {
    return { mirrored: true, ok: false, reason: 'Unexpected mirror error.' };
  }
}
