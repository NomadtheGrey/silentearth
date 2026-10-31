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
//   it from its own carried boolean (UI syncShrewEffect
//   — shell-supplied, list-ready). shrewEffectActive
//   below is UNUSED pending its signature change (see
//   its note) — do not wire from it.
// - Effect WIRING into hunger/UI shells (shell calls
//   update + setDrainMultiplier) is the shell's
//   follow-up — nothing here calls it unprompted.
//
// SAVE (trap-save pattern: format now, App wiring later):
// CharmState.snapshot() / restore() carry awakenings
// (boot-only, clears + rebuilds, bad entries dropped).
// SaveData.awakenings (save.ts) carries the snapshot.
//
// CHARM LIST (2026-10-28, playable charm system):
// The list is a VIEW over CharmState — awakened kinds
// ARE the list (no separate container, no save-shape
// change). listCharms(charms) is the examination
// contract: { kind, tier, note }[] in awakening order.
// Carried for effect purposes = list membership once
// the list lands (Adam CONFIRMED: functional from the
// list, no wearing gate); interim main-inventory
// carried is shell-side (UI syncShrewEffect). The
// first-charm grant records the awakening ONLY (no
// inventory item — the shrew's 0.5 lb frees by
// construction; list records weigh nothing).
// Existing saves migrate in save.ts deserialize
// (shrew item + awakening → item removed, record kept).
//

import { ITEMS } from './recipes';
import type { PersonalInventory } from './inventory';
import type { NameSight, LookResult } from './name-sight';

/**
 * SOURCES (current 2026-10-28): world sources now yield
 * individual kind items (Background boneKind — kind
 * derives from position; shrew EXCLUDED, the grant is
 * its sole source). Generic 'bone' survives only as a
 * sinkless secondary fragment (silt/stone secondaries).
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
  'squirrel-tail-bone': 'A leaper’s spring',
  'owl-talon': 'Night sight',
  'bat-wing-bone': 'Night way-finding',
  'mouse-spine': 'A hoarder’s store',
  'raccoon-tooth': 'A scavenger’s nose',
  'groundhog-tooth': 'Deep sleep',
  'opossum-crest': 'Stillness, overlooked',
  'fox-femur': 'A swift step',
  'deer-antler-tip': 'A sense of coming weather',
  'muskrat-tail': 'Easy wading',
  'wolf-tooth': 'Tracking',
  'frog-pelvis': 'A sense of water',
  'mole-paw': 'Earth sense',
  'bear-claw': 'Strength',
  'rabbit-jaw': 'Calm',
  'beaver-incisor': 'Shelter warmth',
  'vole-skull': 'An eye for small finds',
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

/**
 * Tier-1 effect factors (Track B Systems-buildable,
 * 2026-10-28). All DRAFT, flagged for Adam's pin pass.
 * Every factor helper gates on CHARM-LIST MEMBERSHIP +
 * awakened: `carried` is a SHELL-SUPPLIED boolean (list
 * membership once the list lands) — never a main-
 * inventory read (shrew lesson; shrewEffectActive's
 * direct read stays unused for exactly this reason).
 * The shell multiplies drain factors (shrew × snake);
 * storage/capacity bonuses add to their own bases.
 */
export const SNAKE_EFFECT = { drainMultiplier: 0.9 };
export const MOUSE_EFFECT = { storageBonus: 25 };
export const BEAR_EFFECT = { capacityBonusLb: 10 };
export const RABBIT_EFFECT = { fleeFactor: 0.8 };
export const RACCOON_EFFECT = { bonusPoints: 25 };
export const WOLF_EFFECT = { signRangeFactor: 2 };
export const GROUNDHOG_EFFECT = { drainMultiplier: 0.9, wakeBonus: 10 };

/** Snake drain factor: 0.9 when carried + awakened, else 1. */
export function snakeDrainFactor(
  carried: boolean,
  charms: CharmState,
): number {
  return carried && charms.isAwakened('snake-vertebra')
    ? SNAKE_EFFECT.drainMultiplier
    : 1;
}

/** Mouse home-storage bonus in counts: 25 when carried + awakened, else 0. */
export function mouseStorageBonus(
  carried: boolean,
  charms: CharmState,
): number {
  return carried && charms.isAwakened('mouse-spine')
    ? MOUSE_EFFECT.storageBonus
    : 0;
}

/** Bear pack-capacity bonus in pounds: 10 when carried + awakened, else 0. */
export function bearCapacityBonusLb(
  carried: boolean,
  charms: CharmState,
): number {
  return carried && charms.isAwakened('bear-claw')
    ? BEAR_EFFECT.capacityBonusLb
    : 0;
}

/**
 * Rabbit flee factor (remaining charms, 2026-10-28):
 * 0.8 when carried + awakened, else 1. Helper only —
 * no trapping system exists; trapping multiplies
 * flee radius by it when trapping lands.
 */
export function rabbitFleeFactor(
  carried: boolean,
  charms: CharmState,
): number {
  return carried && charms.isAwakened('rabbit-jaw')
    ? RABBIT_EFFECT.fleeFactor
    : 1;
}

/**
 * Raccoon loot bonus in percentage points (remaining
 * charms, 2026-10-28): 25 when carried + awakened,
 * else 0. Helper only — loot adds it when the loot
 * system lands.
 */
export function raccoonBonusPoints(
  carried: boolean,
  charms: CharmState,
): number {
  return carried && charms.isAwakened('raccoon-tooth')
    ? RACCOON_EFFECT.bonusPoints
    : 0;
}

/**
 * Wolf sign-range factor (remaining charms,
 * 2026-10-28): 2 when carried + awakened, else 1.
 * Helper only — signs multiply range by it when the
 * signs system lands.
 */
export function wolfSignRangeFactor(
  carried: boolean,
  charms: CharmState,
): number {
  return carried && charms.isAwakened('wolf-tooth')
    ? WOLF_EFFECT.signRangeFactor
    : 1;
}

/**
 * Groundhog waking-refresh bonus in hunger points
 * (groundhog tier-1, 2026-10-28): 10 when carried +
 * awakened, else 0. The shell applies it at wake via
 * HungerState.restore (clamped at 100) — no new
 * hunger method needed.
 */
export function groundhogWakeBonus(
  carried: boolean,
  charms: CharmState,
): number {
  return carried && charms.isAwakened('groundhog-tooth')
    ? GROUNDHOG_EFFECT.wakeBonus
    : 0;
}

/**
 * Crow pile-glow tier (crow glow, 2026-10-28): the
 * FACT only, no display. Returns the crow charm's
 * list tier verbatim when carried + awakened, else 0
 * — tier read from the existing tier field (tierOf),
 * no new tier system, no clamp invented (tiers above
 * 3 don't exist; display interpretation is
 * Background/UI's). Display contract: 0 = base slight
 * memory-glow; 1 = bright glow; 2 = bright glow +
 * arrows (couple of zones, ~2 draft); 3 = arrows from
 * any distance + range (meters draft, frog pattern).
 * Background owns marker glow/range/culling, UI owns
 * arrow display — this fact feeds both, renders
 * neither.
 */
export function crowGlowTier(
  carried: boolean,
  charms: CharmState,
): number {
  return carried && charms.isAwakened('crow-beak')
    ? charms.tierOf('crow-beak')
    : 0;
}

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

/** One entry of the charm list (examination contract). */
export interface ListedCharm {
  /** Bone kind (shape slug, e.g. 'shrew-skull'). */
  kind: string;
  /** Tier held (≥ 1 — the list holds awakened kinds only). */
  tier: number;
  /** Display line: boneNote's awakened branch. */
  note: string;
}

/**
 * The charm list — a VIEW over CharmState, not a
 * container: awakened kinds ARE the list, in awakening
 * (snapshot insertion) order. UI's examination panel
 * reads this; nothing here renders. Unawakened kinds
 * never appear (snapshot holds awakened records only).
 */
export function listCharms(charms: CharmState): ListedCharm[] {
  return charms.snapshot().map(({ kind, tier }) => ({
    kind,
    tier,
    note: boneNote(kind, charms),
  }));
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
 * Storm-warning latch (deer tier-1 effect machinery,
 * Track B 2026-10-28). Mirrors HungerWarning exactly:
 * same entry-fire / hold / re-arm / not-carried-reset
 * semantics, with a BOOLEAN fact in place of a meter
 * threshold (no threshold param — the fact IS the
 * signal). update(stormApproaching, carried): fires
 * ONCE on entry into storm-approaching while carried;
 * stays active while the signal holds; re-arms when
 * it clears; not carried → inactive + reset. Returns
 * { active, fired } (fired = entry edge for UI's
 * display pulse; active = steady state). Session UI
 * state only: nothing is saved. Fact input =
 * Background's stormApproaching rising-front signal,
 * shell-supplied — NOT a countdown (the 30-min draft
 * window is Background's signal definition, not a
 * Systems countdown).
 */
export class WeatherWarning {
  private active = false;

  /** Is the warning currently active (steady state for UI)? */
  isActive(): boolean {
    return this.active;
  }

  update(
    stormApproaching: boolean,
    carried: boolean,
  ): { active: boolean; fired: boolean } {
    if (!carried) {
      this.active = false;
      return { active: false, fired: false };
    }
    if (stormApproaching && !this.active) {
      this.active = true;
      return { active: true, fired: true };
    }
    if (!stormApproaching) {
      this.active = false;
      return { active: false, fired: false };
    }
    return { active: true, fired: false };
  }
}

/**
 * Groundhog rested day (tier-1, 2026-10-28): session
 * state in the warning-latch pattern. wake() sets
 * rested iff carried + awakened at wake; sleepStart()
 * clears it unconditionally, so the bonus lasts from
 * one wake until the next sleep-start. The shell
 * multiplies restedDrainFactor() into the drain
 * product (shrew x snake x rested). No home check
 * anywhere: rested applies on ANY sleep while
 * carried (anywhere-as-home folds in — sleep
 * anywhere counts as home). Session state like the
 * warning latch: a save/load mid-rested-day resets
 * it until next sleep; persistence rides a later
 * change if Adam wants it, not this landing.
 */
export class GroundhogRest {
  private rested = false;

  /** Is the rested-day drain bonus currently active? */
  isRested(): boolean {
    return this.rested;
  }

  /** Wake: rested iff carried + awakened at wake. */
  wake(carried: boolean, charms: CharmState): void {
    this.rested = carried && charms.isAwakened('groundhog-tooth');
  }

  /** Sleep-start: the rested day ends. */
  sleepStart(): void {
    this.rested = false;
  }

  /** Rested drain factor: 0.9 while rested, else 1. */
  restedDrainFactor(): number {
    return this.rested ? GROUNDHOG_EFFECT.drainMultiplier : 1;
  }
}

/**
 * UNUSED — pending a signature change to a shell-
 * supplied carried boolean (header note, charm-list
 * build 2026-10-28). Do NOT call: it reads main
 * inventory directly, which goes wrong once the list
 * lands (list charms are not inventory stacks). The
 * shell path is correct and stays: UI syncShrewEffect
 * computes carried (interim main-inventory count,
 * list membership when the list lands) && awakened,
 * then setDrainMultiplier(0.9 or 1) — snake multiplies
 * its factor into the same product (snakeDrainFactor
 * below; drain multipliers combine multiplicatively).
 * Switch /
 * retirement rides UI's panel landing (the carried
 * switch), not this one.
 * (Kept, not deleted: the formula lives here until
 * the switch — deletion without a replacement reader
 * would strand the reference.)
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
 * Outright first-charm grant — now GRANT-TO-LIST
 * (charm-list build 2026-10-28): records the shrew
 * awakening ONLY, no main-inventory item (the charm
 * lives in the list — listCharms view — and its 0.5 lb
 * frees by construction; list records weigh nothing).
 * Idempotent: an already-awakened shrew grants
 * nothing. No full-pack failure mode (no item
 * involved — awakening always records; the old
 * addPartial gate is gone with the item).
 * `inventory` is a LEGACY param, IGNORED — kept so
 * App's call site keeps compiling until UI's panel
 * landing updates the call (panel + carried switch +
 * call update + row adjustment in ONE UI landing);
 * removal rides that landing, not this one.
 */
export function grantFirstCharm(
  inventory: PersonalInventory,
  charms: CharmState,
): { granted: number; already: boolean } {
  void inventory;
  if (charms.isAwakened(FIRST_CHARM_KIND)) {
    return { granted: 0, already: true };
  }
  charms.awaken(FIRST_CHARM_KIND, 1);
  return { granted: 1, already: false };
}
