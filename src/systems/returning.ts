// RETURNING — THE MARK OF RETURNING, SYSTEMS HALF
// (Adam's ladder, 2026-11-05; sequence: Returning
// before Hedge before HearthHome).
//
// The ladder, as Adam set it:
// - T1 POINTS THE WAY home, or out of a cave or
//   grove. The live water-Scry IS this tier's surface
//   form (still water -> the camp arrows point home);
//   what this module adds is the GATE FACT the Scry
//   door reads (canScry below) — a witch who has not
//   learned Returning T1 does not scry. The cave /
//   grove exit bearing is Background's half.
// - T2 BRINGS HER TO HER LAST KNOWN BASE. DEV's
//   leans, Adam's to countermand: cast anywhere (a
//   held invocation, no instrument) — one destination
//   needs no sight to choose it.
// - T3 BRINGS HER TO ANY BASE OR NAMED PLACE,
//   REQUIRING A MEDIUM: the crystal ball (carried) or
//   a water source (stood at) — choosing among many
//   places needs the sight. The destination is SEEN
//   THROUGH the medium (the Places-page scry v1 is
//   UI's surface on these acts).
//
// THE PRICE (DEV's lean, Adam's to countermand): the
// trip is ONE-WAY and costs nothing — she arrives;
// the road back is hers to walk. No hunger gate, no
// resource cost, at any tier.
//
// THE ACTS PLAN, THE SHELL MOVES HER: an act validates
// (tier, destination, medium) and hands the shell a
// destination record. It never writes her position —
// placement is the shell's, under the standing law
// (a written position is validated against real
// collision before she stands there; the stuck-in-
// ruin lesson). A cross-dimension destination (a
// named place inside a cave) hands its dimensionKey
// to the shell verbatim; the dimension swap is the
// shell / Background side, exactly as the naming
// register treats dimension keys: opaque, verbatim.
//
// THE GATES READ THE WIRING (fragments.ts, 05b1f7e):
// Returning learns from its OWN fragments, per-mark,
// under the clock law (fills, capped at 3) — knownTier
// is the one read every door below consults.
//
// NO STATE OF ITS OWN: nothing here persists. The
// fragment record is the learning; the destinations
// are caller facts (lastSleepSite + houses from the
// save, the naming register's records, the faced
// water fact) — systems never knows where she is or
// what she stands at (the piles precedent).

import { ITEMS } from './recipes';
import type { FragmentState } from './fragments';
import type { PersonalInventory } from './inventory';

/** The canonical mark string (fragments.ts registry). */
export const RETURNING_MARK = 'returning';

/**
 * The surface dimension key, as the naming register
 * spells it ('surface' — namedPlaces.ts owns the
 * constant; dimension keys are opaque to systems and
 * carried verbatim, the buckets law).
 */
const SURFACE_DIMENSION_KEY = 'surface';

/** The tier she knows Returning at (0 = not learned). */
export function returningTier(fragments: FragmentState): number {
  return fragments.knownTier(RETURNING_MARK);
}

/**
 * THE T1 GATE FACT the Scry door reads: water-scrying
 * is Returning T1's — the button seats for a witch
 * who has learned the tier, and not before.
 */
export function canScry(fragments: FragmentState): boolean {
  return returningTier(fragments) >= 1;
}

/** A travel destination, as handed to the shell. */
export interface ReturningDestination {
  x: number;
  z: number;
  /** Opaque, verbatim ('surface', 'cave:<id>', ...). */
  dimensionKey: string;
}

// ---------------------------------------------------------------------------
// T2 — to her last known base
// ---------------------------------------------------------------------------

/** Caller facts for the T2 resolution (the save's own records). */
export interface ReturningBaseFacts {
  /** Her last completed sleep site (save.ts lastSleepSite). */
  lastSleepSite: { x: number; z: number } | null;
  /** Her placed houses, in placement order (the camps). */
  houses: ReadonlyArray<{ x: number; z: number }>;
}

/**
 * One base, as the Places page lists it: an id the
 * selection carries, the position, and which fact
 * named it. Bases live on the surface by definition
 * (a sleep site and placed houses are surface facts).
 */
export interface ReturningBase {
  /** 'base:last-sleep', or 'base:house:<placement index>'. */
  id: string;
  x: number;
  z: number;
  dimensionKey: string;
  via: 'last-sleep' | 'placed-house';
}

/**
 * THE BASE ENUMERATION (the published shape for the
 * Places page's rows): her last completed sleep site
 * first — it is her last known base — then her placed
 * houses in placement order. The facts come from the
 * shell's own stores (the save's lastSleepSite; the
 * placed-house snapshot the camp arrows already
 * read); this helper is the one ordering + id shape
 * every consumer shares. A base's { x, z,
 * dimensionKey } feeds planReturnToPlace directly as
 * its target (T3), and the enumeration's FIRST entry
 * is planReturnHome's destination (T2) — one
 * definition, both doors.
 */
export function listBases(facts: ReturningBaseFacts): ReturningBase[] {
  const bases: ReturningBase[] = [];
  if (facts.lastSleepSite) {
    bases.push({
      id: 'base:last-sleep',
      x: facts.lastSleepSite.x,
      z: facts.lastSleepSite.z,
      dimensionKey: SURFACE_DIMENSION_KEY,
      via: 'last-sleep',
    });
  }
  facts.houses.forEach((house, index) => {
    bases.push({
      id: `base:house:${index}`,
      x: house.x,
      z: house.z,
      dimensionKey: SURFACE_DIMENSION_KEY,
      via: 'placed-house',
    });
  });
  return bases;
}

/** One enumerated base by its id, or null. */
export function baseById(
  facts: ReturningBaseFacts,
  id: string,
): ReturningBase | null {
  return listBases(facts).find((base) => base.id === id) ?? null;
}

export type PlanReturnHomeOutcome =
  | {
      ok: true;
      destination: ReturningDestination;
      /** Which fact named the base (the shell may voice it). */
      via: 'last-sleep' | 'placed-house';
    }
  | { ok: false; code: 'tier' | 'no-base' };

/**
 * Plan the T2 return: her LAST KNOWN BASE. The
 * precedence mirrors the crawl-back's encampment
 * chain (resolveEncampment: the last completed sleep
 * speaks first) — her last sleep site IS her last
 * known base; a placed house answers when she has
 * never completed a sleep; neither is 'no-base' (no
 * spawn fallback: Returning goes to a base, not to
 * the world's start). Tier-gated at 2. The held
 * invocation's timing is the shell's — this act is
 * the validation the completed hold calls.
 */
export function planReturnHome(
  fragments: FragmentState,
  facts: ReturningBaseFacts,
): PlanReturnHomeOutcome {
  if (returningTier(fragments) < 2) {
    return { ok: false, code: 'tier' };
  }
  const base = listBases(facts)[0];
  if (!base) {
    return { ok: false, code: 'no-base' };
  }
  return {
    ok: true,
    destination: { x: base.x, z: base.z, dimensionKey: base.dimensionKey },
    via: base.via,
  };
}

// ---------------------------------------------------------------------------
// T3 — to any base or named place, through a medium
// ---------------------------------------------------------------------------

/**
 * A chosen T3 target, structural on purpose: a naming
 * register record (NamedPlace) satisfies it directly;
 * a base passes its position with the surface key.
 */
export interface ReturningTarget {
  x: number;
  z: number;
  dimensionKey: string;
}

/** The lawful medium a T3 travel was seen through. */
export type ReturningMedium = 'crystal-ball' | 'water';

export type PlanReturnToPlaceOutcome =
  | {
      ok: true;
      destination: ReturningDestination;
      medium: ReturningMedium;
    }
  | { ok: false; code: 'tier' | 'no-medium' | 'bad-target' };

/**
 * Plan the T3 return to a chosen base or named
 * place. Tier-gated at 3, then the target must be a
 * real position, then THE MEDIUM — the two lawful
 * media (Adam, 2026-11-05; the magic map is retired,
 * the ball covers its seat): the crystal ball,
 * counted in her pack, first; standing at a water
 * source second (a caller fact — the shell knows her
 * ground, the fill-jar idiom). Neither is 'no-medium'.
 * The destination rides back verbatim, dimensionKey
 * included — the shell performs any swap and the
 * landing validation.
 */
export function planReturnToPlace(
  fragments: FragmentState,
  inventory: PersonalInventory,
  target: ReturningTarget,
  facts: { atWater: boolean },
): PlanReturnToPlaceOutcome {
  if (returningTier(fragments) < 3) {
    return { ok: false, code: 'tier' };
  }
  if (
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.z) ||
    typeof target.dimensionKey !== 'string' ||
    target.dimensionKey.length === 0
  ) {
    return { ok: false, code: 'bad-target' };
  }
  const destination: ReturningDestination = {
    x: target.x,
    z: target.z,
    dimensionKey: target.dimensionKey,
  };
  if (inventory.count(ITEMS.crystalBall) > 0) {
    return { ok: true, destination, medium: 'crystal-ball' };
  }
  if (facts.atWater) {
    return { ok: true, destination, medium: 'water' };
  }
  return { ok: false, code: 'no-medium' };
}
