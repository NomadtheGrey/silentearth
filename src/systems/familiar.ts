/**
 * THE FAMILIAR'S NAMES AND GIFTS (Adam, 2026-11-02 — the
 * familiar road). Systems state for what the altar rite
 * teaches her and what the bond lets her borrow.
 *
 * THE NAME: every kind has a TRUE NAME (the table below —
 * all wording DRAFT, Adam's pin pass owns the voice). A
 * kind's name is not learned by looking: it ARRIVES WITH
 * THE AWAKENING — when a Waking's rite makes the kind's
 * animal her familiar (CompanionState.obtainByRite), the
 * shell teaches this state the kind (learnName), and the
 * name stands written in her journal from then on. The
 * bone is an abstraction of the kind, so the name is the
 * KIND's name: one per kind, learned once, kept forever.
 *
 * THE GIFT: the familiar's difference is its kind's use
 * (Adam: "A bat can see in the dark, a mole can sneak by
 * undetected... for instance"). The gift is not a standing
 * passive — "once in a while she can borrow the familiar's
 * ability for a bit." Borrowing is an act with a span and
 * a rest after (both DRAFT numbers below). The door is
 * the RECITE: she speaks the true name from her journal,
 * and the borrowing answers (flagged reading, Adam's
 * session, 2026-11-02).
 *
 * WORKING GIFTS: the registry names every kind's gift;
 * a gift with a giftId is one the game can actually do
 * today (v1: the bat's dark-sight, the mole's undetected
 * — Adam's two instances). The rest are REGISTERED
 * DRAFTS in the bone-notes' own posture: the phrase
 * stands, the effect lands with its consuming build, and
 * no Recite is offered for a gift that is not working.
 * Phrases grow from the awakened-bone effect notes
 * (charms.ts BONE_EFFECT_NOTES) — one gift, two forms is
 * the design pass's open seam, not settled here.
 *
 * TIME: this module keeps no clock — the shell passes
 * seconds (its own now), the same posture as
 * CompanionState's day parameter. Borrow spans do NOT
 * ride the save (a borrowing ends with the session);
 * the rest deadline does not ride it either — loading is
 * a kindness, the rest resets. Only the NAMES persist.
 */

/** Borrow span, seconds (DRAFT — Adam's pin pass). */
export const BORROW_SECONDS = 180;
/** Rest before she can borrow again, seconds (DRAFT). */
export const BORROW_REST_SECONDS = 1800;

/**
 * Each kind's true name (DRAFT — Adam's pin pass owns
 * every word). Keyed by animal kind; kinds without an
 * entry have no name on this road.
 */
export const TRUE_NAMES: Readonly<Record<string, string>> = {
  cat: 'Hearthshadow',
  wolf: 'Greyhowl',
  bear: 'Oldroot',
  fox: 'Embertail',
  deer: 'Softbrow',
  beaver: 'Damborn',
  raccoon: 'Maskhand',
  groundhog: 'Earthbelly',
  crow: 'Ashwing',
  owl: 'Moonwatch',
  bat: 'Duskwing',
  rabbit: 'Quickthistle',
  squirrel: 'Acornkeep',
  muskrat: 'Reedswim',
  mouse: 'Grainwhisker',
  vole: 'Furrowkin',
  opossum: 'Paleback',
  turtle: 'Stoneshell',
  pigeon: 'Dustfeather',
  snake: 'Siltcoil',
  frog: 'Pondcall',
  mole: 'Blinddelver',
  shrew: 'Sharpnose',
};

/** A kind's gift: the phrase, and the working effect id when one exists. */
export interface KindGift {
  /** The working effect's id, or null while the gift is a registered draft. */
  giftId: 'dark-sight' | 'undetected' | null;
  /** What the gift is, in a few words (DRAFT). */
  phrase: string;
}

/**
 * Each kind's gift (DRAFT phrases). Working in v1: the
 * bat's dark-sight and the mole's undetected — Adam's
 * two named instances. The cat's gift is its hunt (the
 * provisioning system is its own machinery; no Recite).
 */
export const KIND_GIFTS: Readonly<Record<string, KindGift>> = {
  bat: { giftId: 'dark-sight', phrase: 'See in the dark' },
  mole: { giftId: 'undetected', phrase: 'Pass unseen' },
  cat: { giftId: null, phrase: 'The hunt — fish and small things' },
  wolf: { giftId: null, phrase: 'Tracking' },
  bear: { giftId: null, phrase: 'Strength' },
  fox: { giftId: null, phrase: 'A swift step' },
  deer: { giftId: null, phrase: 'A sense of coming weather' },
  crow: { giftId: null, phrase: 'Remembers where things lie' },
  owl: { giftId: null, phrase: 'Night sight' },
  raccoon: { giftId: null, phrase: 'A scavenger’s nose' },
  beaver: { giftId: null, phrase: 'Shelter warmth' },
  groundhog: { giftId: null, phrase: 'Deep sleep' },
  snake: { giftId: null, phrase: 'Needing less' },
  turtle: { giftId: null, phrase: 'Shell protection' },
  rabbit: { giftId: null, phrase: 'Calm' },
  squirrel: { giftId: null, phrase: 'A leaper’s spring' },
  mouse: { giftId: null, phrase: 'A hoarder’s store' },
  vole: { giftId: null, phrase: 'An eye for small finds' },
  muskrat: { giftId: null, phrase: 'Easy wading' },
  frog: { giftId: null, phrase: 'A sense of water' },
  pigeon: { giftId: null, phrase: 'The way home' },
  opossum: { giftId: null, phrase: 'Stillness, overlooked' },
  shrew: { giftId: null, phrase: 'Stirs when hunger falls' },
};

/** The true name of a kind, or null when the road has none for it. */
export function trueNameFor(kind: string): string | null {
  return TRUE_NAMES[kind] ?? null;
}

/** The gift of a kind, or null when the road has none for it. */
export function giftFor(kind: string): KindGift | null {
  return KIND_GIFTS[kind] ?? null;
}

export type BorrowRefusalCode = 'no-gift' | 'borrowed' | 'resting';
export type BorrowResult =
  | { ok: true; until: number }
  | { ok: false; code: BorrowRefusalCode };

/** The live borrowing, when one stands. */
export interface ActiveBorrow {
  kind: string;
  giftId: string;
  until: number;
}

/**
 * Names known by rite + the borrowing's state. Pure but
 * for its own fields; every query takes the shell's now
 * (seconds), and expiry settles lazily inside the queries
 * (an expired borrow becomes its rest the first time
 * anything looks after it ends).
 */
export class FamiliarState {
  private readonly names = new Set<string>();
  private borrow: ActiveBorrow | null = null;
  private restUntil = 0;

  constructor(savedNames?: readonly string[]) {
    if (savedNames) {
      for (const kind of savedNames) {
        if (typeof kind === 'string' && kind !== '') {
          this.names.add(kind);
        }
      }
    }
  }

  /** Teach her a kind's name (the rite's yield). True when it is new. */
  learnName(kind: string): boolean {
    if (this.names.has(kind)) return false;
    this.names.add(kind);
    return true;
  }

  /** Whether she holds a kind's true name. */
  knowsName(kind: string): boolean {
    return this.names.has(kind);
  }

  /** The kinds whose names she knows, in the order learned (the save reads this). */
  knownKinds(): string[] {
    return [...this.names];
  }

  /** Settle an expired borrow into its rest; returns the live borrow, if any. */
  private settle(now: number): ActiveBorrow | null {
    if (this.borrow && now >= this.borrow.until) {
      this.restUntil = this.borrow.until + BORROW_REST_SECONDS;
      this.borrow = null;
    }
    return this.borrow;
  }

  /** The live borrowing at `now`, or null. */
  activeBorrow(now: number): ActiveBorrow | null {
    const live = this.settle(now);
    return live ? { ...live } : null;
  }

  /** Whether the borrowing is resting at `now` (spent, not yet ready again). */
  isResting(now: number): boolean {
    this.settle(now);
    return !this.borrow && now < this.restUntil;
  }

  /**
   * RECITE: borrow the standing familiar's gift for a
   * bit. The caller (shell) vouches that `kind` is the
   * standing familiar and that she knows its name; this
   * state owns the gift's working-ness and the span/rest
   * arithmetic. On success the caller applies the gift's
   * effect (by giftId) until `until`.
   */
  tryBorrow(kind: string, now: number): BorrowResult {
    const gift = giftFor(kind);
    if (!gift || gift.giftId === null) {
      return { ok: false, code: 'no-gift' };
    }
    if (this.settle(now)) {
      return { ok: false, code: 'borrowed' };
    }
    if (now < this.restUntil) {
      return { ok: false, code: 'resting' };
    }
    const until = now + BORROW_SECONDS;
    this.borrow = { kind, giftId: gift.giftId, until };
    return { ok: true, until };
  }
}
