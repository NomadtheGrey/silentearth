// THE STUMPY ALTAR — TRANSFORMATION GRANTS + RITUAL
// GRADE + THE JOURNAL LINK (Adam's Stumpy Altar
// decision, 2026-10-30: a stump becomes a Stumpy
// Altar by STONE + GLYPH + CANDLE; commissioned on
// his nod the same day).
//
// THE THREE ACTS, in making order, at a plain base
// (a found stump or a placed altar — parity):
//   1. PLACE THE STONES — river stone x4, consumed.
//   2. DRAW THE GLYPH — a charcoal stick HELD, never
//      consumed (the whetstone precedent).
//   3. SET THE CANDLE — one candle consumed, placed
//      and lit as part of the act.
// The third act completes the STUMPY ALTAR
// (ritual grade two).
//
// PARITY (2026-11-01): the base may equally be a
// PLACED ALTAR — its entity carries the same
// additions list (save.ts SavedAltar.additions), and
// every act and reader below is base-blind: they
// take the additions, never the base.
//
// STATE HOME: the stump's ADDITIONS — the existing
// per-stump accumulating store (save.ts SavedStump
// already persists it; upgrades ACCUMULATE is pinned
// law, so a stump can be workstation AND altar). The
// acts add three step members — ALTAR_STONES /
// ALTAR_GLYPH / ALTAR_CANDLE_ADDITION — and the
// third act ALSO writes 'altar', the member
// Background's stumpState reserved for exactly this
// ("the ritual system writes it"). Ritual grade
// reads that single member. Background mirrors the
// step members into StumpAddition and owns the apply
// writers + the visuals (stones ring / glyph mark /
// candle); UI owns the menu acts and re-voices the
// refusal facts in her voice.
//
// GRANT IDIOM (desk / cauldron precedent): outcome
// records, validate before mutating, failure touches
// nothing, NO hunger gate (site acts, not builds).
// Progress arrives as INPUT from the shell's stump
// record — Systems keeps no world state. Refusal
// reasons name the missing fact plainly; the UI
// speaks them in her voice.
//
// RITUAL GRADE (the exposed fact): siteGrade below.
// ALTAR PARITY (Adam, 2026-11-01: 'Both types of
// altars should work the same... Just 2 flavors for
// the same thing... BOTH REQUIRE THE CONSECRATION'):
// a base is either a FOUND STUMP or a BUILT altar,
// and grade derives from the ADDITIONS for both —
// the made altar's born-grade-two by construction
// RETIRED (an unconsecrated made altar now stands at
// grade 1, the stump's unconsecrated grade; the
// consecration completes either base to 2). Basic
// Waking reads grade >= 1 (any ritual site, as
// built); grade-two workings read grade 2.
// rituals.ts is NOT rewired by this module —
// tier-two filtering consumes the fact when those
// workings are designed.
//
// FIRST CONSUMER — THE JOURNAL LINK: the journal's
// enchantment, worked at altar-grade ground (a
// Stumpy Altar or a made Altar). It sets a save flag
// (save.ts journalLinked); fragment inscription and
// true-name rites will read it later. The GRIMOIRE
// IS NOT REQUIRED IN HAND (DEV-confirmed reading of
// Adam's pin): the grimoire is desk-bound and too
// heavy to carry by design — the link joins the
// carried journal to the one grimoire wherever it
// sits. Nothing is consumed by the linking.

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';

/** Addition: the stones are placed (act 1 done). */
export const ALTAR_STONES_ADDITION = 'altar-stones';
/** Addition: the glyph is drawn (act 2 done). */
export const ALTAR_GLYPH_ADDITION = 'altar-glyph';
/** Addition: the candle is set (act 3 done). */
export const ALTAR_CANDLE_ADDITION = 'altar-candle';
/**
 * The completed-transformation member ('altar' —
 * Background's reserved StumpAddition). Ritual grade
 * reads this member alone.
 */
export const ALTAR_ADDITION = 'altar';

/** River stone consumed by act 1. DRAFT (pin pass). */
export const ALTAR_STONES_REQUIRED = 4;

/** How far one stump's transformation has gotten. */
export interface AltarProgress {
  stones: boolean;
  glyph: boolean;
  candle: boolean;
}

/** Read the progress out of a stump's additions. */
export function altarProgressFrom(
  additions: readonly string[],
): AltarProgress {
  return {
    stones: additions.includes(ALTAR_STONES_ADDITION),
    glyph: additions.includes(ALTAR_GLYPH_ADDITION),
    candle: additions.includes(ALTAR_CANDLE_ADDITION),
  };
}

/** True when a base's consecration is complete —
 * either flavor (altar parity, 2026-11-01). */
export function isConsecratedAltar(
  additions: readonly string[],
): boolean {
  return additions.includes(ALTAR_ADDITION);
}

/**
 * The stump-era name for the same reading, kept as
 * an alias while the shell's imports re-point
 * (App.tsx consumes it); it reads ONLY the additions,
 * never a stump. Retire it when the last import moves.
 */
export function isStumpyAltar(additions: readonly string[]): boolean {
  return isConsecratedAltar(additions);
}

/** Ritual grade: 1 = any ritual site; 2 = altar-grade ground. */
export type RitualGrade = 1 | 2;

/**
 * The grade of one ritual site. `kind` mirrors
 * Background's RitualSiteKind ('altar' | 'stump' |
 * 'boulder'); `additions` is the stump's addition
 * list when the site is a stump.
 */
export function siteGrade(
  kind: string,
  additions?: readonly string[],
): RitualGrade {
  if (kind === 'altar' || kind === 'stump') {
    return isConsecratedAltar(additions ?? []) ? 2 : 1;
  }
  return 1;
}

/**
 * An act's outcome. On success `additions` lists the
 * stump additions the shell applies (one for acts 1
 * and 2; two for act 3 — the candle step member plus
 * the completing 'altar'); `completed` is true only
 * on act 3. On failure `reason` names the missing
 * fact, plainly.
 */
export type AltarActOutcome =
  | { applied: true; additions: string[]; completed: boolean }
  | { applied: false; reason: string };

/** Act 1 — place the stones: river stone x4, consumed. */
export function placeStones(
  inventory: PersonalInventory,
  progress: AltarProgress,
): AltarActOutcome {
  if (progress.stones) {
    return { applied: false, reason: 'The stones are already placed.' };
  }
  if (inventory.count(ITEMS.riverStone) < ALTAR_STONES_REQUIRED) {
    return { applied: false, reason: 'Needs 4 river stone.' };
  }
  inventory.remove(ITEMS.riverStone, ALTAR_STONES_REQUIRED);
  return {
    applied: true,
    additions: [ALTAR_STONES_ADDITION],
    completed: false,
  };
}

/**
 * Act 2 — draw the glyph: a charcoal stick held,
 * NOT consumed (the whetstone precedent). Requires
 * the stones first (making order).
 */
export function drawGlyph(
  inventory: PersonalInventory,
  progress: AltarProgress,
): AltarActOutcome {
  if (!progress.stones) {
    return { applied: false, reason: 'The glyph comes after the stones.' };
  }
  if (progress.glyph) {
    return { applied: false, reason: 'The glyph is already drawn.' };
  }
  if (inventory.count(ITEMS.charcoalStick) <= 0) {
    return {
      applied: false,
      reason: 'Needs a charred stick to draw the glyph.',
    };
  }
  return {
    applied: true,
    additions: [ALTAR_GLYPH_ADDITION],
    completed: false,
  };
}

/**
 * Act 3 — set the candle: one candle consumed,
 * placed and lit as part of the act. Requires the
 * glyph first. Completes the Stumpy Altar: the
 * outcome carries the candle step member AND the
 * completing 'altar' member.
 */
export function setCandle(
  inventory: PersonalInventory,
  progress: AltarProgress,
): AltarActOutcome {
  if (!progress.glyph) {
    return { applied: false, reason: 'The candle comes after the glyph.' };
  }
  if (progress.candle) {
    return { applied: false, reason: 'The candle is already set.' };
  }
  if (inventory.count(ITEMS.candle) <= 0) {
    return { applied: false, reason: 'Needs a candle.' };
  }
  inventory.remove(ITEMS.candle, 1);
  return {
    applied: true,
    additions: [ALTAR_CANDLE_ADDITION, ALTAR_ADDITION],
    completed: true,
  };
}

/** The journal link's outcome; `reason` on failure only. */
export type LinkJournalOutcome =
  | { linked: true }
  | { linked: false; reason: string };

/**
 * The journal's enchantment: link the carried
 * journal to the one grimoire, worked at altar-grade
 * ground. Gates: grade two, journal carried, not
 * already linked. Nothing is consumed; the grimoire
 * is not required in hand (see header).
 */
export function linkJournal(
  inventory: PersonalInventory,
  grade: RitualGrade,
  alreadyLinked: boolean,
): LinkJournalOutcome {
  if (grade !== 2) {
    return {
      linked: false,
      reason: 'The books link only at altar-grade ground.',
    };
  }
  if (alreadyLinked) {
    return { linked: false, reason: 'The books are already linked.' };
  }
  if (inventory.count(ITEMS.journal) <= 0) {
    return { linked: false, reason: 'No journal carried.' };
  }
  return { linked: true };
}
