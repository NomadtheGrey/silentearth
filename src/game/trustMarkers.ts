/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TRUST MARKERS — the world marker over an individual
 * she holds trust with (Adam, 2026-11-01: 'a marker over
 * animals we have fed, to let us know if we've fed them
 * yet or not — and how much'). Two facts, readable at a
 * glance: (1) fed-or-not TODAY — the day's trust-feeding
 * spent or still open; (2) HOW MUCH — her progress along
 * the road to the bond (several feedings, several days).
 *
 * THE FACTS ARE SYSTEMS' (their SavedCompanion records);
 * this module is the SEAM + the derivation. The shell
 * installs a resolver (the installCatPreyAccess idiom)
 * backed by Systems' CompanionState.factsFor — derived
 * where the refusals live, so the marker and the 'sated'
 * refusal can never disagree. Untouched animals have no
 * record and resolve null: no marker, ever. FERALS GET
 * NO MARKER (Adam's ruling, 2026-11-01): a feral record
 * exists but the road is closed to it, and this marker's
 * whole promise is the road — the shell-side resolver
 * returns null for feral ids (their isFeral is the one
 * source for that too). THE CAT is not queried by the
 * renderer layer in v1: it stands outside the feeding
 * road (its bond is the rite, its familiar read is its
 * glow) — named, not forgotten.
 *
 * THE DERIVATION (pure; the probe asserts the table):
 * - bond 'familiar' -> the familiar's mark.
 * - bond 'companion' -> the companion's mark.
 * - bond-ready (trust at the road's length — the
 *   projection as landed carries trust itself, so the
 *   row's own length is the threshold the marker reads;
 *   a bondReady field, if Systems ever adds one, is
 *   honored ahead of it) -> the full row, ready register.
 * - otherwise the pips: one filled per banked feeding,
 *   and today's state as the row's register — OPEN
 *   (today's feeding still hers to give: the next pip
 *   stands bright) or SPENT (fed today: the row rests
 *   dim). At the road's length the ready state speaks
 *   first (feed() lets trust run past it; the row does
 *   not grow).
 */

import type { AnimalKind } from './animals';

/** Systems' bond states, structurally (game never
 *  imports systems; the strings are theirs). */
export type TrustBond = 'none' | 'companion' | 'familiar';

/** The projection the seam carries (Systems'
 *  CompanionFacts, as landed: trust / fedToday / bond). */
export interface TrustFacts {
  trust: number;
  fedToday: boolean;
  bond: TrustBond;
  /** Systems does not carry this today — honored when
   *  present; readiness otherwise derives from trust
   *  against the road's length (see markerStateFor). */
  bondReady?: boolean;
}

/** The shell-installed facts source. */
export type TrustFactsResolver = (creatureId: string) => TrustFacts | null;

let resolver: TrustFactsResolver | null = null;

/** Shell install: the trust-facts resolver (once, at
 *  boot; null uninstalls — no markers without facts). */
export function installTrustFacts(next: TrustFactsResolver | null): void {
  resolver = next;
}

/** The facts for one individual, or null (no record,
 *  feral, or no resolver installed). */
export function trustFactsFor(creatureId: string): TrustFacts | null {
  return resolver ? resolver(creatureId) : null;
}

/** What the renderer paints over one individual. */
export type MarkerState =
  | { kind: 'pips'; filled: number; open: boolean }
  | { kind: 'ready' }
  | { kind: 'companion' }
  | { kind: 'familiar' };

/** Pips on the road (the row's slots; Systems' road
 *  length reaches the marker only through bondReady —
 *  this is the DRAWN row, three slots as Adam specced
 *  the road: 'the road is 3 feedings'). */
export const MARKER_PIP_SLOTS = 3;

/** Derive the painted state from the facts (null in,
 *  null out — no record, no marker). */
export function markerStateFor(facts: TrustFacts | null): MarkerState | null {
  if (!facts) return null;
  if (facts.bond === 'familiar') return { kind: 'familiar' };
  if (facts.bond === 'companion') return { kind: 'companion' };
  if (facts.bondReady ?? facts.trust >= MARKER_PIP_SLOTS) return { kind: 'ready' };
  const filled = Math.max(0, Math.min(MARKER_PIP_SLOTS - 1, Math.floor(facts.trust)));
  return { kind: 'pips', filled, open: !facts.fedToday };
}

/** A stable key per painted state (the texture cache). */
export function markerStateKey(state: MarkerState): string {
  return state.kind === 'pips'
    ? `pips:${state.filled}:${state.open ? 'open' : 'spent'}`
    : state.kind;
}

/** The marker's range country (the tag's 32 m; DRAFT). */
export const TRUST_MARKER_RANGE_M = 32;
/** Past this the row starts fading (DRAFT). */
export const TRUST_MARKER_FADE_START_M = 24;
/** The row's seat above the animal's own height (DRAFT). */
export const TRUST_MARKER_LIFT_M = 0.35;

/** Kinds whose facts the layer may query — a typing
 *  anchor for the renderer's call sites. */
export type TrustMarkedKind = AnimalKind;
