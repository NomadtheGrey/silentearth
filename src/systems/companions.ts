/**
 * Companions — trust, feeding, and the bond
 * (Adam, 2026-10-31; build 1: friendship).
 *
 * Adam's shape: "feed them what they eat to earn their
 * trust, then their friendship. A familiar would be
 * more, requiring a ritual at the altar." Build 1 was
 * the friendship: diets, trust, the faced OFFER, and
 * the bond. Build 2 (2026-10-31) adds the rite on the
 * same record shape — ELEVATE / RELINQUISH / SUPERSEDE
 * at altar-grade ground — the cat's diet row and found
 * record, and the provisioning catch set the cat's
 * hunts read. No migration: build 1 carried the bond
 * and origin fields from day one for exactly this.
 *
 * The laws this module keeps:
 * - Trust is PER-INDIVIDUAL (this crow, not crows) and
 *   volatile until bonded: an unbonded record is the
 *   courtship; the BOND is the persistent fact.
 * - The bond's lever is the TRUE NAME: full trust plus
 *   the kind's awakened name, spoken from the journal
 *   (the landed name chain; this module takes the
 *   name-known fact as a context parameter and never
 *   reads the awakening state itself).
 * - A smaller fraction of individuals are FERAL —
 *   untamable, fixed by identity, never rolled in the
 *   moment (see isFeral).
 * - Costs sit on GOODS: feeding spends a carried food
 *   item, and only when the animal accepts it. Nothing
 *   here ever costs her body.
 * - Diets are keyed to the ANIMAL's digestion, not
 *   hers: her cook-required rule for raw acorns binds
 *   her eat(), never this table.
 * - The cat takes no stance and no commands (Adam:
 *   "by ruling and nature"). Its stance is null — an
 *   inapplicability, not a default — and stance orders
 *   refuse it with a typed code the panel turns into
 *   theater.
 *
 * Bodies, movement, home ranges, and the services
 * (warning / deterrence / intervention / provisioning)
 * are Background's engine half; this module owns the
 * data and the transitions. All numbers are DRAFT for
 * Adam's pin pass.
 */

import { ITEMS, type ItemId } from './recipes';
import { normalizeItemId, type PersonalInventory } from './inventory';
import type { CraftingInventory } from './crafting';
import type { HungerState } from './hunger';

// ---------------------------------------------------------------------------
// Diets — what each kind eats (DRAFT, authored per kind)
// ---------------------------------------------------------------------------
//
// Every entry is an item she can carry and give up.
// Kinds with NO row are unfeedable by design, for
// stated reasons, not by omission:
// - Insect-eaters with no insect item in the world:
//   frog, bat, mole, shrew.
// - Aquatic kinds a faced offer cannot reach:
//   fish, eel, crayfish (fish meet her hand as prey —
//   see the snatch rider below — not as companions).
// The cat's row arrived with build 2 and its found
// record (seedFoundCat below): prey-shaped, like the
// cat — fish and the small carcasses.

export const DIETS: Readonly<Record<string, readonly ItemId[]>> = {
  cat: ['fish-carcass', 'mouse-carcass', 'vole-carcass'],
  rabbit: ['grass', 'tender-vines', 'yellow-dandelion'],
  squirrel: ['acorns', 'edible-mushroom', 'tall-sunflower'],
  muskrat: ['grass', 'tender-vines', 'white-water-lily'],
  mouse: ['grass', 'acorns', 'bog-berries'],
  vole: ['grass', 'tender-vines', 'bog-berries'],
  groundhog: ['grass', 'yellow-dandelion', 'purple-clover', 'apple'],
  opossum: ['apple', 'elderberries', 'edible-mushroom', 'bog-berries'],
  raccoon: ['bog-berries', 'elderberries', 'acorns', 'apple'],
  beaver: ['snap-wood', 'tender-vines', 'grass'],
  deer: ['grass', 'acorns', 'apple', 'yellow-dandelion'],
  fox: ['rabbit-carcass', 'mouse-carcass', 'vole-carcass', 'bog-berries'],
  wolf: ['rabbit-carcass', 'groundhog-carcass', 'muskrat-carcass'],
  bear: ['honey', 'bog-berries', 'elderberries', 'apple', 'fish-carcass', 'rabbit-carcass'],
  crow: ['bog-berries', 'elderberries', 'acorns', 'mouse-carcass'],
  owl: ['mouse-carcass', 'vole-carcass'],
  snake: ['mouse-carcass', 'vole-carcass', 'frog-carcass'],
  turtle: ['grass', 'bog-berries', 'white-water-lily', 'wood-violet'],
  pigeon: ['grass', 'tall-sunflower', 'acorns'],
};

/** The foods a kind eats (empty for unfeedable / unknown kinds). */
export function dietFor(kind: string): readonly ItemId[] {
  return DIETS[kind] ?? [];
}

/** True when the kind can be fed at all in build 1. */
export function isFeedable(kind: string): boolean {
  return (DIETS[kind]?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Feral — fixed by identity, never rolled in the moment
// ---------------------------------------------------------------------------

/**
 * The feral fraction (DRAFT dial for the pin pass —
 * one constant, read by every lane; Background's 0.15
 * proposal rides the same pass).
 */
export const FERAL_FRACTION = 0.2;

/**
 * FNV-1a over the id plus an avalanche finalizer —
 * small, stable, seed-law clean. The finalizer is
 * load-bearing, not decoration: spawn ids share long
 * prefixes and differ in their last characters
 * (animal:<cx>,<cz>:<spawnIndex>), and plain FNV-1a
 * leaves neighbours correlated — measured before the
 * fix, 17% of chunks rolled ALL-feral, which breaks
 * the per-individual ruling in play. With the
 * finalizer the same census reads independent.
 */
function idHash(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0x100000000;
}

export type CompanionOrigin = 'wild' | 'found';

/**
 * Is this individual feral — untamable, forever? A
 * pure function of its stable id (Background's
 * creature id): same id, same answer, across saves
 * and sessions. The FOUND origin reads false — and
 * for the cat that is not an exemption: the feral
 * distinction does not reach the cat at all (Adam:
 * "They're already like that — both wild and tame,
 * yet neither"). The category is a wild-road fact,
 * and the cat was never on that road.
 */
export function isFeral(creatureId: string, origin: CompanionOrigin = 'wild'): boolean {
  if (origin === 'found') {
    return false;
  }
  return idHash(creatureId) < FERAL_FRACTION;
}

// ---------------------------------------------------------------------------
// Records — the persisted shape
// ---------------------------------------------------------------------------

/** Bond depth. Build 1 wrote 'none' | 'companion'; the rite adds 'familiar'. */
export type CompanionBond = 'none' | 'companion' | 'familiar';

export type CompanionStance = 'stay' | 'follow' | 'come';

/**
 * One touched individual. Untouched animals have no
 * record — worldgen stays sovereign over them, and the
 * save stays lean. The record IS the bond's memory:
 * releasing clears it, and the individual is gone
 * (Background's departure), never re-meetable.
 */
export interface SavedCompanion {
  creatureId: string;
  kind: string;
  trust: number;
  bond: CompanionBond;
  origin: CompanionOrigin;
  /** Null for the cat — inapplicable, not a default. */
  stance: CompanionStance | null;
  /** The day trust last grew (one feeding per day feeds trust). */
  lastFedDay: number | null;
}

/** Trust one accepted feeding earns (DRAFT). */
export const TRUST_PER_FEEDING = 1;
/** Trust the bond wants (DRAFT: several feedings, several days). */
export const TRUST_FOR_BOND = 3;

// ---------------------------------------------------------------------------
// Outcomes — typed codes, never prose (the rename lesson:
// a code cannot be orphaned by a wording pass)
// ---------------------------------------------------------------------------

export type FeedRefusalCode =
  | 'feral' // the ANIMAL is the refusal — final, not retryable
  | 'not-food' // wrong offering; the animal might take something else
  | 'not-held' // she doesn't carry the offered item
  | 'sated' // already fed today; trust grows once a day
  | 'bonded'; // the offer is a courtship act; a friend is past it

export type FeedResult =
  | { ok: true; trust: number; bondReady: boolean }
  | { ok: false; code: FeedRefusalCode };

export type BondRefusalCode =
  | 'unknown' // no record — she has never fed this one
  | 'feral'
  | 'already'
  | 'trust' // not yet enough
  | 'name'; // the kind's true name is not hers to speak

export type BondResult = { ok: true } | { ok: false; code: BondRefusalCode };

export type StanceRefusalCode = 'unknown' | 'unbonded' | 'cat';

export type StanceResult = { ok: true } | { ok: false; code: StanceRefusalCode };

export type ElevateRefusalCode =
  | 'unknown' // no record — she has never fed this one
  | 'unbonded' // courtship only; the rite wants a companion
  | 'already-familiar' // this one already stands as the familiar
  | 'ground' // the rite wants altar-grade ground (siteGrade 2)
  | 'one-standing'; // another familiar stands — relinquish or supersede

export type ElevateResult =
  | { ok: true }
  // On 'one-standing', `standing` names the standing
  // familiar's creatureId, so the shell's refusal can
  // point at Relinquish / Supersede by name.
  | { ok: false; code: ElevateRefusalCode; standing?: string };

export type RelinquishRefusalCode =
  | 'unknown'
  | 'not-familiar' // only a standing familiar can step down
  | 'ground';

export type RelinquishResult = { ok: true } | { ok: false; code: RelinquishRefusalCode };

export type SupersedeRefusalCode =
  | 'unknown'
  | 'unbonded'
  | 'already-familiar' // the target IS the standing familiar
  | 'ground'
  | 'no-standing'; // nothing stands to be superseded — plain elevate's job

export type SupersedeResult = { ok: true } | { ok: false; code: SupersedeRefusalCode };

// ---------------------------------------------------------------------------
// The state — records by creature id
// ---------------------------------------------------------------------------

export class CompanionState {
  private readonly records = new Map<string, SavedCompanion>();

  constructor(saved?: readonly SavedCompanion[]) {
    if (saved) {
      for (const record of saved) {
        if (!this.records.has(record.creatureId)) {
          this.records.set(record.creatureId, { ...record });
        }
      }
    }
  }

  /** The record for an individual, if she has touched it. */
  recordFor(creatureId: string): SavedCompanion | undefined {
    const record = this.records.get(creatureId);
    return record ? { ...record } : undefined;
  }

  /** Every record (the save snapshot reads this). */
  snapshot(): SavedCompanion[] {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  /** The standing familiar, if one stands (the rite reads this). */
  familiar(): SavedCompanion | undefined {
    const standing = this.standingFamiliarRecord();
    return standing ? { ...standing } : undefined;
  }

  /** The STORED standing-familiar record (transitions mutate it). */
  private standingFamiliarRecord(): SavedCompanion | undefined {
    for (const record of this.records.values()) {
      if (record.bond === 'familiar') {
        return record;
      }
    }
    return undefined;
  }

  /**
   * Seed the FOUND cat's record (build 2): the
   * hearthHouse resident, met through its seat, not
   * the wild road. Idempotent — an existing record
   * (whatever its trust or bond) is returned
   * unchanged. The found origin carries its laws with
   * it: outside the feral distinction entirely
   * (isFeral), and stance null — the cat takes no
   * commands.
   */
  seedFoundCat(creatureId: string): SavedCompanion {
    const existing = this.records.get(creatureId);
    if (existing) {
      return { ...existing };
    }
    const record: SavedCompanion = {
      creatureId,
      kind: 'cat',
      trust: 0,
      bond: 'none',
      origin: 'found',
      stance: null,
      lastFedDay: null,
    };
    this.records.set(creatureId, record);
    return { ...record };
  }

  /**
   * The faced OFFER: feed one carried food to one
   * individual. Checks before consuming anything, in
   * an order that teaches: feral first (the animal
   * itself), then the offering (held? in its diet?),
   * then the day (trust grows once a day). Only an
   * accepted feeding spends the item and moves trust.
   * `day` is the caller's day count (this module keeps
   * no clock).
   */
  feed(
    creatureId: string,
    kind: string,
    item: ItemId,
    inventory: CraftingInventory,
    day: number,
  ): FeedResult {
    const existing = this.records.get(creatureId);
    const origin = existing?.origin ?? (kind === 'cat' ? 'found' : 'wild');
    if (isFeral(creatureId, origin)) {
      return { ok: false, code: 'feral' };
    }
    if (existing && existing.bond !== 'none') {
      return { ok: false, code: 'bonded' };
    }
    const offered = normalizeItemId(item);
    const diet = dietFor(kind);
    if (!diet.some((food) => normalizeItemId(food) === offered)) {
      return { ok: false, code: 'not-food' };
    }
    if (inventory.count(offered) < 1) {
      return { ok: false, code: 'not-held' };
    }
    if (existing && existing.lastFedDay === day) {
      return { ok: false, code: 'sated' };
    }
    inventory.remove(offered, 1);
    const record: SavedCompanion = existing ?? {
      creatureId,
      kind,
      trust: 0,
      bond: 'none',
      // The cat is singular — the hearth resident — so
      // even a record born at the feeding hand carries
      // the found origin (seedFoundCat is the usual
      // door; this keeps the law if she feeds first).
      origin: kind === 'cat' ? 'found' : 'wild',
      stance: kind === 'cat' ? null : 'follow',
      lastFedDay: null,
    };
    record.trust += TRUST_PER_FEEDING;
    record.lastFedDay = day;
    this.records.set(creatureId, record);
    return { ok: true, trust: record.trust, bondReady: record.trust >= TRUST_FOR_BOND };
  }

  /**
   * The bond: full trust + the kind's true name,
   * spoken. `nameKnown` is the caller's fact (the
   * awakening state is not read here). Success makes a
   * companion; the familiar's rite is build 2's
   * transition on this same record.
   */
  bondWith(creatureId: string, nameKnown: boolean): BondResult {
    const record = this.records.get(creatureId);
    if (!record) {
      return { ok: false, code: 'unknown' };
    }
    if (isFeral(creatureId, record.origin)) {
      return { ok: false, code: 'feral' };
    }
    if (record.bond !== 'none') {
      return { ok: false, code: 'already' };
    }
    if (record.trust < TRUST_FOR_BOND) {
      return { ok: false, code: 'trust' };
    }
    // The name gate guards the WILD road: a stranger's
    // name must be awakened and spoken. The found road
    // never passes that gate — acquaintance is the
    // cat's road (Adam, ratifying build 2: "We don't
    // need a cat bone. Cats domesticated themselves.").
    // No cat Waking exists or will be invented; she
    // knows the resident the way you know what lives
    // at your hearth.
    if (!nameKnown && record.origin !== 'found') {
      return { ok: false, code: 'name' };
    }
    record.bond = 'companion';
    return { ok: true };
  }

  /**
   * RELEASE (Adam's verb): end the whole bond — courtship
   * or companion. The record clears whole; the caller
   * runs the departure off the returned record (a wild
   * individual dissolves into Background's world; a
   * found one returns to its hearth seat). Null when
   * there was nothing to release.
   */
  release(creatureId: string): SavedCompanion | null {
    const record = this.records.get(creatureId);
    if (!record) {
      return null;
    }
    this.records.delete(creatureId);
    return { ...record };
  }

  /**
   * Set a bonded companion's stance. The cat refuses
   * with its own code — the panel's theater runs on it.
   */
  setStance(creatureId: string, stance: CompanionStance): StanceResult {
    const record = this.records.get(creatureId);
    if (!record) {
      return { ok: false, code: 'unknown' };
    }
    if (record.kind === 'cat') {
      return { ok: false, code: 'cat' };
    }
    if (record.bond === 'none') {
      return { ok: false, code: 'unbonded' };
    }
    record.stance = stance;
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // The rite (build 2) — familiar transitions at altar-grade ground.
  // `grade` is the caller's fact (stumpy-altar's siteGrade: the rite
  // wants 2). One familiar stands at a time; the transitions are the
  // only doors between 'companion' and 'familiar', and supersede is
  // the atomic pair of the other two.
  // -------------------------------------------------------------------------

  /**
   * ELEVATE: companion -> familiar, at altar-grade
   * ground, while no other familiar stands. The
   * one-standing refusal names the standing familiar,
   * so the shell can point at Relinquish / Supersede.
   */
  elevate(creatureId: string, grade: number): ElevateResult {
    const record = this.records.get(creatureId);
    if (!record) {
      return { ok: false, code: 'unknown' };
    }
    if (record.bond === 'familiar') {
      return { ok: false, code: 'already-familiar' };
    }
    if (record.bond !== 'companion') {
      return { ok: false, code: 'unbonded' };
    }
    if (grade < 2) {
      return { ok: false, code: 'ground' };
    }
    const standing = this.standingFamiliarRecord();
    if (standing) {
      return { ok: false, code: 'one-standing', standing: standing.creatureId };
    }
    record.bond = 'familiar';
    return { ok: true };
  }

  /**
   * RELINQUISH: familiar -> companion, at altar-grade
   * ground (Adam's guarded verb). The friendship
   * survives whole — trust and stance untouched; only
   * the glow dies — and the familiar slot frees as
   * this lands.
   */
  relinquish(creatureId: string, grade: number): RelinquishResult {
    const record = this.records.get(creatureId);
    if (!record) {
      return { ok: false, code: 'unknown' };
    }
    if (record.bond !== 'familiar') {
      return { ok: false, code: 'not-familiar' };
    }
    if (grade < 2) {
      return { ok: false, code: 'ground' };
    }
    record.bond = 'companion';
    return { ok: true };
  }

  /**
   * SUPERSEDE: the standing familiar steps down to
   * companion and the target rises, as ONE act. Every
   * check runs before either record moves — a refused
   * rite leaves both bonds exactly as they stood. (The
   * step-down itself is the DRAFT default; Adam's pin
   * pass owns step-down-vs-departs.)
   */
  supersede(creatureId: string, grade: number): SupersedeResult {
    const record = this.records.get(creatureId);
    if (!record) {
      return { ok: false, code: 'unknown' };
    }
    if (record.bond === 'familiar') {
      return { ok: false, code: 'already-familiar' };
    }
    if (record.bond !== 'companion') {
      return { ok: false, code: 'unbonded' };
    }
    if (grade < 2) {
      return { ok: false, code: 'ground' };
    }
    const standing = this.standingFamiliarRecord();
    if (!standing) {
      return { ok: false, code: 'no-standing' };
    }
    standing.bond = 'companion';
    record.bond = 'familiar';
    return { ok: true };
  }
}

// ---------------------------------------------------------------------------
// Provisioning — the catch set (build 2 rider)
// ---------------------------------------------------------------------------
//
// Provisioning is the CAT's service alone (the settled
// reconciliation: every other kind's catch set folds
// to empty). This table is the data authority for WHAT
// a hunting familiar may hunt — named as PREY KINDS
// (the roster's own words, colony kinds included:
// 'mice', 'voles'), because the hunt speaks kinds, not
// carcasses. The carcass a catch arrives as derives
// from the prey kind through the ONE kind->carcass
// authority (trap-catch's catchItemFor, which already
// maps the colony kinds) — this table never names an
// item, so no shell adapter inverts or aliases it.
// Catches are delivered to home storage by Background's
// engine. The hunt's cadence, the travelling-together
// condition, and the real-prey consumption are the
// engine's; the guard trade-off (an excursioning hunter
// is not guarding) is the panel's to voice.

export const PROVISIONING_CATCHES: Readonly<Record<string, readonly string[]>> = {
  cat: ['fish', 'mouse', 'mice', 'voles'],
};

/** The prey kinds a kind may hunt (empty for non-provisioners). */
export function provisioningCatchesFor(kind: string): readonly string[] {
  return PROVISIONING_CATCHES[kind] ?? [];
}

// ---------------------------------------------------------------------------
// Rider — her own hand: the fish snatch (Adam, 2026-10-31)
// ---------------------------------------------------------------------------

/**
 * The snatch chance (DRAFT dial for the pin pass): a
 * hand is worse than a weir, and failure's price is
 * the attempt itself — the fish spooks.
 */
export const SNATCH_CHANCE = 0.25;

export type SnatchOutcome = 'caught' | 'spooked' | 'slipped' | 'too-hungry';

/**
 * Snatch at a faced living fish. `roll` is the
 * caller's runtime roll in [0, 1) (the trap precedent:
 * the seed law governs worldgen, not the moment).
 * Success grants fish-carcass by the harvest idiom —
 * addPartial — and a full pack grants nothing:
 * 'slipped' means the lunge connected but her hands
 * could not hold it, and NOTHING is consumed — the
 * fish escapes and spooks, per the standing harvest
 * law that capacity failure never consumes the world
 * (DEV ruling, 2026-10-31). Too-hungry refuses
 * (hand-harvest work, not trap collection — DRAFT
 * lean, the pin pass settles).
 */
export function snatchFish(
  inventory: PersonalInventory,
  roll: number,
  hunger: HungerState | null = null,
): SnatchOutcome {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error('Snatch roll must be in [0, 1).');
  }
  if (hunger !== null && hunger.isTooHungry()) {
    return 'too-hungry';
  }
  if (roll >= SNATCH_CHANCE) {
    return 'spooked';
  }
  const grant = inventory.addPartial(ITEMS.fishCarcass, 1);
  return grant.granted > 0 ? 'caught' : 'slipped';
}
