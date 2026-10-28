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
//   shape). The warning LATCH is built (HungerWarning
//   below); the warning DISPLAY is UI's (built after
//   the latch lands).
// - drainMultiplier 0.9 while carried: hunger drains
//   10% slower (1 point per ~33.3 s instead of 30 s) —
//   the "small hunger bonus while carried" as an ongoing
//   effect (not a one-shot). HungerState multiplier
//   support BUILT (Track A 2026-10-28); the shell sets
//   it from shrewEffectActive (below).
// - Effect WIRING into hunger/UI shells (shell calls
//   update + setDrainMultiplier) is the shell's
//   follow-up — nothing here calls it unprompted.
//
// SAVE (trap-save pattern: format now, App wiring later):
// CharmState.snapshot() / restore() carry awakenings
// (boot-only, clears + rebuilds, bad entries dropped).
// SaveData.awakenings (save.ts) carries the snapshot.
//

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';
import type { NameSight, LookResult } from './name-sight';

/**
 * SOURCES (flagged, not this build): no world source
 * yields individual kinds yet — Bone Scatter yields
 * generic 'bone' (prototype, hand-pickable). Per-kind
 * sources, or a generic→individual mapping, are a
 * Background/content follow-up. This build registers
 * the ITEMS, not the sources.
 *
 * Kind <-> item mapping (single source for the rule):
 * kind = shape slug as displayed after "Primal Bone - "
 * (e.g. 'shrew-skull', 'owl-talon', 'pigeon-wing-bone');
 * item = 'primal-bone-<kind>'. The derivation matches
 * the ITEMS registry by construction (probe-guarded:
 * boneItemFor(kind) === ITEMS value for all 18 kinds).
 * boneKindFor returns null for non-bone ids.
 */
export function boneItemFor(kind: string): string {
  return `primal-bone-${kind}`;
}

export function boneKindFor(item: string): string | null {
  const prefix = 'primal-bone-';
  if (!item.startsWith(prefix)) return null;
  const kind = item.slice(prefix.length);
  return kind === '' ? null : kind;
}

/** Is this inventory id a primal bone? */
export function isBoneItem(item: string): boolean {
  return boneKindFor(item) !== null;
}

/**
 * Effect phrases for awakened bones (DRAFT, flagged —
 * phrases drafted from the bone-charms doc's effects,
 * not pins; shrew's phrase is UI's draft note shape).
 * Tier flows from the awakening record (see boneNote).
 */
export const BONE_EFFECT_NOTES: Readonly<Record<string, string>> = {
  'shrew-skull':
    'Stirs when hunger falls, warning before the slowdown; small hunger bonus while carried',
  'pigeon-wing-bone': 'A sense of the way home',
  'snake-vertebra': 'Needing less',
  'turtle-shell-fragment': 'Shell protection',
  'crow-beak': 'Remembers where things lie',
  'owl-talon': 'Night sight',
  'bat-wing-bone': 'Night way-finding',
  'mouse-spine': 'A hoarder’s store',
  'raccoon-tooth': 'A scavenger’s nose',
  'groundhog-tooth': 'Deep sleep',
  'fox-femur': 'A swift step',
  'deer-antler-tip': 'A sense of coming weather',
  'wolf-tooth': 'Tracking',
  'frog-pelvis': 'A sense of water',
  'mole-paw': 'Earth sense',
  'bear-claw': 'Strength',
  'rabbit-jaw': 'Calm',
  'beaver-incisor': 'Shelter warmth',
};

/**
 * PICKUP COUNTS AS A LOOK (Adam, DEV chat 2026-10-28,
 * RULED: "picking it up is sufficient, counts as a
 * look" — closes the pickup-vs-LOOK flag): a bone pickup
 * records 1 LOOK at that bone kind in NameSight, so
 * pickup ALONE satisfies speakName's minLooks 1 (family
 * known) — no separate world LOOK required before
 * speaking. recordBonePickupLook is the shell path:
 * the shell calls it AFTER every successful bone pickup
 * grant (harvest grant, pile pickup/take, any grant
 * path; granted > 0 only — a failed/full-pack grant
 * records no look); per granted kind on multi-kind
 * grants. Portions come from UI's bone portions table
 * (shell supplies per kind; passed through — no portion
 * content invented here). SIDE EFFECT (flagged,
 * honest): the pickup look increments like any look
 * (looks +1, practice +1) — NameSight has no set-to-1
 * and look() is the only mutating query; re-pickups
 * (a dropped bone picked up again) record another look,
 * harmlessly (looks only grow; minLooks already
 * satisfied). Shape ≠ true name is SUPERSEDED by this
 * ruling for the minLooks gate (pickup now counts) —
 * the shape/name distinction survives only as: pickup
 * identifies shape in the row note (below), LOOK
 * deepens name portions.
 *
 * PICKUP IDENTIFICATION (Adam, DEV chat 2026-10-28:
 * "the description can change once picked up" — world
 * description is partial (LOOK portions), a picked-up
 * bone's description is IDENTIFIED):
 * - Unawakened: 'Needs a ritual site' (the brief's raw
 *   note, verbatim — no period added).
 * - Awakened: 'Tier <n> · <effect>' (tier from the
 *   record, so tier-ups flow through; phrase fallback
 *   'Awakened' for a kind without a drafted phrase).
 * World description needs NO new code (NameSight
 * already returns partial portions); bone-kind portion
 * CONTENT (family/shape/deeper) is a content follow-up.
 * Row wiring is UI's (InventoryItem.note already
 * renders).
 */
export function boneNote(kind: string, charms: CharmState): string {
  const tier = charms.tierOf(kind);
  if (tier <= 0) return 'Needs a ritual site';
  const phrase = BONE_EFFECT_NOTES[kind] ?? 'Awakened';
  return `Tier ${tier} · ${phrase}`;
}

/** First charm's bone kind (shape slug). */
export const FIRST_CHARM_KIND = 'shrew-skull';

/** First charm's item id (registered in recipes.ts ITEMS). */
export const FIRST_CHARM_ITEM = ITEMS.primalBoneShrewSkull;

/**
 * First charm's effect numbers (DRAFT, flagged).
 * MACHINERY STATUS (2026-10-28, Track A): the latch
 * (HungerWarning below) + HungerState drain-multiplier
 * support are BUILT; the warning DISPLAY is UI's
 * (built after the latch lands — the latch exposes
 * state/API only, no display invented here).
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
 * Hunger-warning latch (shrew tier-1 effect machinery,
 * Track A 2026-10-28). Generic threshold param —
 * construct with FIRST_CHARM_EFFECT.warnAt (45).
 * update(hunger, carried): fires ONCE on entry into
 * ≤ warnAt while carried (including starting below
 * threshold on boot — she IS in the warning zone, so
 * warn); stays active while ≤ warnAt; re-arms when
 * hunger rises above warnAt; not carried → inactive +
 * reset (carrying again while ≤ warnAt fires fresh).
 * Returns { active, fired } (fired = the entry edge —
 * UI's display pulses on it, reads active for the
 * steady state). Session UI state only: nothing is
 * saved — first update below threshold after boot
 * fires fresh, which is the correct behavior.
 */
export class HungerWarning {
  private active = false;

  constructor(private readonly warnAt: number) {
    if (!Number.isFinite(warnAt)) {
      throw new Error('Warning threshold must be a finite number.');
    }
  }

  /** Is the warning currently active (steady state for UI)? */
  isActive(): boolean {
    return this.active;
  }

  update(
    hunger: number,
    carried: boolean,
  ): { active: boolean; fired: boolean } {
    if (!Number.isFinite(hunger)) {
      throw new Error('Hunger value must be a finite number.');
    }
    if (!carried) {
      this.active = false;
      return { active: false, fired: false };
    }
    if (hunger <= this.warnAt && !this.active) {
      this.active = true;
      return { active: true, fired: true };
    }
    if (hunger > this.warnAt) {
      this.active = false;
      return { active: false, fired: false };
    }
    return { active: true, fired: false };
  }
}

/**
 * Is the shrew tier-1 drain effect live? Carried +
 * awakened (the granted first charm satisfies both;
 * a merely carried unawakened bone does not — the
 * effect follows awakening, not possession alone).
 * Shell formula: setDrainMultiplier(shrewEffectActive
 * ? FIRST_CHARM_EFFECT.drainMultiplier : 1) — snake
 * later multiplies its factor into the same product
 * (drain multipliers combine multiplicatively).
 */
export function shrewEffectActive(
  inventory: PersonalInventory,
  charms: CharmState,
): boolean {
  return (
    inventory.count(FIRST_CHARM_ITEM) > 0 &&
    charms.isAwakened(FIRST_CHARM_KIND)
  );
}

/**
 * Record a bone pickup as a LOOK (Adam's ruling — see
 * header). Returns the look result, or null when the
 * item is not a primal bone (no look recorded).
 * Portions are the shell's (UI's bone portions table
 * for this kind); the helper passes them through.
 */
export function recordBonePickupLook(
  item: string,
  nameSight: NameSight,
  portions: readonly string[],
): LookResult | null {
  const kind = boneKindFor(item);
  if (kind === null) return null;
  return nameSight.look(kind, portions);
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
