/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * THE HOME DEAL (Adam's ruling, 2026-11-05): the Home
 * carriers no longer mint the family 'home' tally. Each
 * one DEALS one fragment of a specific Home-pillar mark
 * — Returning, Hedge, HearthHome, or Naming — decided
 * by the carrier's own hash, so the same hearthstone
 * shows the same fragment in every telling of the
 * world. No carrier specializes; no mark has a private
 * hunting ground: the whole Home carrier set (the
 * farmhouse great stone, every village hearthstone,
 * the Burnt Village) deals across the whole pillar.
 *
 * THE STREAM: the deal draws on a SIBLING stream
 * ('carrier:<key>:deal') of the carrier's mint stream
 * ('carrier:<key>'), never the mint stream itself — so
 * every carrier's mint roll (the arc deal since Adam's
 * mint, 2026-11-07) stays exactly what it was before
 * the deal existed. Only the mark is new.
 *
 * A leaf (seed.ts only) so both minting sites — the
 * singulars in carriers.ts and the village instances in
 * villages.ts — draw from ONE table with no import
 * cycle between them.
 */

import { deriveSeed, mulberry32 } from './seed';

/**
 * The Home-pillar marks a Home carrier can deal, in
 * Systems' registered ids (their wiring slice,
 * 2026-11-05).
 */
export const HOME_DEAL_MARKS: readonly string[] = [
  'returning',
  'hedge',
  'hearthhome',
  'naming',
];

/**
 * Each mark's share of the deal, cumulative-read in
 * HOME_DEAL_MARKS' order. DRAFT pricing (Background,
 * 2026-11-05): UNIFORM QUARTERS — no mark is rarer at
 * the deal; their hunting differs by how many carriers
 * a world grows, not by a weighted table. For Adam's
 * pin pass.
 */
export const HOME_DEAL_SHARES: readonly number[] = [0.25, 0.25, 0.25, 0.25];

/**
 * THE DEAL SHARE (Adam via DEV, 2026-11-07 — the cheap
 * supply fix for the starving pillars, measured by the
 * mint census): homesteads deal HOME alongside Travel.
 * A carrying homestead's mark is read off a THIRD
 * sibling stream ('carrier:<key>:share', virgin — the
 * mint stream and the deal stream both stand): under
 * the share it deals a pillar by the table above, over
 * it Travel, its founding mark. THE SHARE IS DRAFT:
 * at the census radii a half share roughly doubles the
 * pillars' journey-range supply while Travel — dealt
 * nowhere else — keeps a multiple of its need at
 * journey range and thins inside it; Adam's pin sets
 * the number.
 */
export const HOMESTEAD_HOME_SHARE = 0.5;

/** The mark a carrying homestead deals: a Home pillar
 * under the share, Travel over it. */
export function dealHomesteadMark(worldSeed: string, carrierKey: string): string {
  const rand = mulberry32(deriveSeed(worldSeed, `carrier:${carrierKey}:share`));
  return rand() < HOMESTEAD_HOME_SHARE ? dealHomeMark(worldSeed, carrierKey) : 'travel';
}

/** The mark the carrier with this key deals in this world. */
export function dealHomeMark(worldSeed: string, carrierKey: string): string {
  const rand = mulberry32(deriveSeed(worldSeed, `carrier:${carrierKey}:deal`));
  const draw = rand();
  let acc = 0;
  for (let i = 0; i < HOME_DEAL_MARKS.length; i++) {
    acc += HOME_DEAL_SHARES[i];
    if (draw < acc) return HOME_DEAL_MARKS[i];
  }
  return HOME_DEAL_MARKS[HOME_DEAL_MARKS.length - 1];
}
