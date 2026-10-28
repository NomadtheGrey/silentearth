// CHARM RECORDS + FIRST CHARM (Adam, DEV chat 2026-10-27:
// tier-1 Waking build order — first charm still owed
// ALONGSIDE, separate piece, not replaced by rituals).
//
// DESIGN (brief's pieces, decided here):
// - A charm IS the bone, awakened — SAME item id. Tier
//   and effect-live live on the AWAKENING RECORD below
//   (the brief's "tier field"), NOT on a second id. (The
//   torch two-id shape exists because stacks carry item +
//   quantity only; here the state has a proper home — a
//   record — so no id explosion for tiers.)
// - Kind keys are shape slugs as displayed after
//   "Primal Bone - " (e.g. 'shrew-skull', 'owl-talon',
//   'pigeon-wing-bone'). Item mapping rule, documented:
//   'primal-bone-<kind>'. Only the first charm's id is
//   REGISTERED here (recipes.ts ITEMS) — other bone ids
//   land with the bone build, not this one.
// - The first charm is granted OUTRIGHT, tier 1 (Adam,
//   pinned). Grant shape (lane's call, flagged):
//   FIRST-BOOT grant — the shell calls grantFirstCharm
//   once for a fresh save (starting-inventory alternative
//   considered: a boot grant keeps the default inventory
//   generic and stays idempotent). App wiring is UI's
//   follow-up (torch precedent) — the function lands
//   here; the boot call follows.
//
// EFFECT NUMBERS (DRAFT, flagged for Adam's pin pass —
// DATA, not machinery):
// - warnAt 45: the bone stirs (warning signal) when hunger
//   falls to 45 — 5 points ABOVE the hungry threshold 40,
//   i.e. "warning before the slowdown" (UI's draft note
//   shape). The warning SIGNAL mechanism (latch, display)
//   is NOT built here — numbers only.
// - drainMultiplier 0.9 while carried: hunger drains
//   10% slower (1 point per ~33.3 s instead of 30 s) —
//   the "small hunger bonus while carried" as an ongoing
//   effect (not a one-shot). HungerState support for a
//   multiplier is a FOLLOW-UP (not built here).
// - Effect MACHINERY (warning latch/display, drain
//   modification) rides a later charm-effects build.
//   Nothing here wires effects into hunger or UI.
//
// SAVE (trap-save pattern: format now, App wiring later):
// CharmState.snapshot() / restore() carry awakenings
// (boot-only, clears + rebuilds, bad entries dropped).
// SaveData.awakenings (save.ts) carries the snapshot.
//

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';

/** First charm's bone kind (shape slug). */
export const FIRST_CHARM_KIND = 'shrew-skull';

/** First charm's item id (registered in recipes.ts ITEMS). */
export const FIRST_CHARM_ITEM = ITEMS.primalBoneShrewSkull;

/**
 * First charm's effect numbers (DRAFT, flagged — see
 * header: data only, machinery follows).
 */
export interface FirstCharmEffect {
  /** Hunger value at/below which the bone stirs (warns). */
  warnAt: number;
  /** Hunger drain multiplier while carried (1 = normal). */
  drainMultiplier: number;
}

export const FIRST_CHARM_EFFECT: FirstCharmEffect = {
  warnAt: 45,
  drainMultiplier: 0.9,
};

/** One awakening's saved shape (see CharmState.snapshot). */
export interface SavedAwakening {
  kind: string;
  tier: number;
}

/**
 * Awakening records: bone kind -> tier (0 = unawakened,
 * absent = never recorded). Awaken never downgrades
 * (tier-up safe: awakening at a lower tier than held
 * keeps the higher tier).
 */
export class CharmState {
  private tiers = new Map<string, number>();

  /** Tier held for a kind (0 when unawakened). */
  tierOf(kind: string): number {
    return this.tiers.get(kind) ?? 0;
  }

  /** Is this kind awakened at any tier? */
  isAwakened(kind: string): boolean {
    return this.tierOf(kind) > 0;
  }

  /** Record an awakening (never downgrades). */
  awaken(kind: string, tier: number): void {
    if (tier <= 0) return;
    this.tiers.set(kind, Math.max(this.tierOf(kind), tier));
  }

  /** Snapshot for save (insertion order, copies). */
  snapshot(): SavedAwakening[] {
    return [...this.tiers.entries()].map(([kind, tier]) => ({ kind, tier }));
  }

  /**
   * Boot restore only: clears and rebuilds from valid
   * entries (non-empty kind + positive-int tier; bad
   * entries dropped). Never call mid-game over live
   * awakenings.
   */
  restore(entries: readonly SavedAwakening[]): void {
    this.tiers.clear();
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.kind !== 'string' || entry.kind === '') continue;
      if (!Number.isInteger(entry.tier) || entry.tier <= 0) continue;
      this.tiers.set(entry.kind, entry.tier);
    }
  }
}

/**
 * Outright first-charm grant (first-boot grant — see
 * header). Idempotent: an already-awakened shrew grants
 * nothing (no duplicate bone). A full pack grants
 * nothing AND awakens nothing (no bone, no charm —
 * defensive; a fresh save is never full).
 */
export function grantFirstCharm(
  inventory: PersonalInventory,
  charms: CharmState,
): { granted: number; already: boolean } {
  if (charms.isAwakened(FIRST_CHARM_KIND)) {
    return { granted: 0, already: true };
  }
  const grant = inventory.addPartial(FIRST_CHARM_ITEM, 1);
  if (grant.granted <= 0) {
    return { granted: 0, already: false };
  }
  charms.awaken(FIRST_CHARM_KIND, 1);
  return { granted: 1, already: false };
}
