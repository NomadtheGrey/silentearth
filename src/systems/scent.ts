/**
 * Scent — the douse-ables (Systems, 2026-11-03; the
 * salves + moss batch's second half; Adam's pins
 * 2026-11-03).
 *
 * ONE SCENT SYSTEM, not three mechanisms: a douse
 * writes ONE applied scent on her — kind + clock —
 * and the behavior side reads it as facts.
 *
 * THE PINS:
 * - REPELLENT: ferals only (pinned). While it stands,
 *   ferals will not initiate around her — Background
 *   composes the suppression; this module only keeps
 *   the fact. It cancels no engagement already begun.
 * - ATTRACTOR: TWO brews ship, PREY and PREDATOR —
 *   the state carries the category; Background's
 *   ambient draw reads it. (Birds are OUT of the
 *   brews — Adam's correction: a sprinkle of seeds
 *   may do for birds, to-do list; bats likewise, a
 *   bat house, listed not built.)
 * - DURATION: one in-game day — SCENT_DURATION_S
 *   600 — pinned as the starting value, tunable at
 *   Adam's pass.
 * - THE WASH is the universal counter: using it
 *   strips the standing scent at once. Swimming
 *   strips it too — the shell calls clear() on the
 *   immersion fact (the cold-wet family already
 *   knows deep water); rain does not.
 *
 * LAWS: ONE AT A TIME — a fresh douse REPLACES the
 * standing scent (layering smells is one smell);
 * re-dousing the same kind refreshes the clock,
 * never stacks past full. The clock ticks in real
 * seconds while the world ticks (the hunger idiom);
 * sleep carries it down like any night.
 *
 * THE WASH'S MIXING is a grant (mixWash), not a
 * recipe: the jar must come back empty, and the
 * crafting engine has no container-return — so the
 * mix validates and swaps in the jar idiom
 * (clay-jar.ts's family). The wash therefore has no
 * Crafted line on its card (grant-made, like
 * gathered goods); its descriptor teaches the use.
 */

import { ITEMS, type ItemId } from './recipes';
import { weightOf, type PersonalInventory } from './inventory';
import { recordItemUse } from './knowledge-register';

/** One in-game day — pinned starting value (Adam). */
export const SCENT_DURATION_S = 600;

export type ScentKind = 'repellent' | 'attractor';

export interface ScentFacts {
  kind: ScentKind | null;
  /** The attractor's draw category ('prey' /
   * 'predator'); null unless kind is 'attractor'. */
  category: string | null;
  secondsLeft: number;
}

export interface ScentSnapshot {
  kind: ScentKind | null;
  category: string | null;
  secondsLeft: number;
}

const UNSCENTED: ScentSnapshot = {
  kind: null,
  category: null,
  secondsLeft: 0,
};

export class ScentState {
  private current: ScentSnapshot = { ...UNSCENTED };

  /** The facts read for the behavior side. */
  scent(): ScentFacts {
    return { ...this.current };
  }

  isActive(): boolean {
    return this.current.kind !== null && this.current.secondsLeft > 0;
  }

  /**
   * The repellent fact, as the shell's feral-facts
   * provider wraps it (Background's seam, via DEV
   * 2026-11-03): repelled reads kind === 'repellent'
   * WHILE THE CLOCK STANDS — an expired repellent
   * suppresses nothing. The provider ORs this into
   * FeralFacts.suppressed beside safe country
   * (ferals only, as pinned; the bond road never
   * sees the channel).
   */
  isRepelling(): boolean {
    return this.isActive() && this.current.kind === 'repellent';
  }

  /**
   * THE FLIP SIDE (Adam's law, 2026-11-07): each lure
   * is TWO-SIDED — the prey scent draws prey AND
   * repels predators; the predator scent draws
   * predators AND repels prey. (Otherwise there would
   * be four douse-ables; too unwieldy.) The effect of
   * the standing scent on ONE category, as a fact for
   * the field side: an active attractor DRAWS its own
   * category and REPELS the other; the repellent
   * REPELS both (its shipped feral suppression,
   * restated in this vocabulary); a kind-scent is
   * neither lure nor repellent here (its field is the
   * feed seat) and answers null, as do the unscented
   * and the expired. This read supersedes the v1
   * survey's 'an attractor never repels' — retired by
   * Adam's word.
   */
  scentEffectFor(category: 'prey' | 'predator'): 'draw' | 'repel' | null {
    if (!this.isActive()) return null;
    if (this.current.kind === 'repellent') return 'repel';
    if (this.current.kind === 'attractor') {
      return this.current.category === category ? 'draw' : 'repel';
    }
    return null;
  }

  /** Lay a scent: replaces whatever stood, full clock. */
  apply(kind: ScentKind, category: string | null): void {
    this.current = {
      kind,
      category: kind === 'attractor' ? category : null,
      secondsLeft: SCENT_DURATION_S,
    };
  }

  /** Strip the standing scent (the wash; swimming). */
  clear(): void {
    this.current = { ...UNSCENTED };
  }

  /** Tick the clock; expiry clears the scent. */
  tick(seconds: number): void {
    if (!this.isActive() || !(seconds > 0)) return;
    this.current.secondsLeft = Math.max(
      0,
      this.current.secondsLeft - seconds,
    );
    if (this.current.secondsLeft <= 0) this.clear();
  }

  snapshot(): ScentSnapshot {
    return { ...this.current };
  }

  /** Lenient: an unknown kind reads unscented. */
  restore(snapshot: ScentSnapshot | null | undefined): void {
    if (
      snapshot &&
      (snapshot.kind === 'repellent' || snapshot.kind === 'attractor') &&
      Number.isFinite(snapshot.secondsLeft) &&
      snapshot.secondsLeft > 0
    ) {
      this.current = {
        kind: snapshot.kind,
        category:
          snapshot.kind === 'attractor' &&
          typeof snapshot.category === 'string'
            ? snapshot.category
            : null,
        secondsLeft: snapshot.secondsLeft,
      };
    } else {
      this.current = { ...UNSCENTED };
    }
  }
}

// ---------------------------------------------------------------------------
// The douse-able goods + their acts
// ---------------------------------------------------------------------------

/** What each douse-able lays, by item. */
export const DOUSE_SCENTS: Readonly<
  Record<string, { kind: ScentKind; category: string | null }>
> = {
  [ITEMS.repellent]: { kind: 'repellent', category: null },
  [ITEMS.preyLure]: { kind: 'attractor', category: 'prey' },
  [ITEMS.predatorLure]: { kind: 'attractor', category: 'predator' },
};

export type DouseResult =
  | { ok: true }
  | { ok: false; code: 'not-carried' | 'not-a-douse' };

/**
 * Douse herself with a carried bottle: consumes one
 * and lays its scent (replacing whatever stood) —
 * the tend posture (checks before consuming, so a
 * refused douse costs nothing). The exercised door
 * fires on success (recordItemUse): dousing teaches
 * the bottle's line.
 */
export function applyDouse(
  inventory: PersonalInventory,
  scent: ScentState,
  item: ItemId,
): DouseResult {
  const lays = DOUSE_SCENTS[item];
  if (!lays) return { ok: false, code: 'not-a-douse' };
  if (inventory.count(item) <= 0) return { ok: false, code: 'not-carried' };
  inventory.remove(item, 1);
  scent.apply(lays.kind, lays.category);
  recordItemUse(item);
  return { ok: true };
}

export type MixWashResult =
  | { ok: true }
  | { ok: false; code: 'no-filled-jar' | 'no-flower' | 'pack-full' };

/**
 * Mix the wash: a filled jar + a meadow flower, at
 * hand — the jar returns EMPTY and one wash is
 * granted. A grant, not a recipe (the crafting
 * engine returns no containers; the jar idiom
 * validates before mutating, so a refusal swaps
 * nothing). The capacity check mirrors fillJar's
 * honesty: the swap is weight-negative overall
 * (a 2 lb water-jar leaves, a 1 lb jar + a light
 * wash return), but the check runs anyway so the
 * grant can never strand half-done.
 */
export function mixWash(inventory: PersonalInventory): MixWashResult {
  if (inventory.count(ITEMS.waterJar) <= 0) {
    return { ok: false, code: 'no-filled-jar' };
  }
  if (inventory.count(ITEMS.meadowFlower) <= 0) {
    return { ok: false, code: 'no-flower' };
  }
  // Validate before mutating, in fillJar's idiom:
  // the swap's net is weight-negative (a 2 lb filled
  // jar + a flower leave; a 1 lb jar + a light wash
  // return), but the grant proves it can complete
  // BEFORE anything changes hands — a refusal swaps
  // nothing, ever.
  const freed =
    weightOf(ITEMS.waterJar) + weightOf(ITEMS.meadowFlower);
  const taken = weightOf(ITEMS.clayJar) + weightOf(ITEMS.wash);
  if (inventory.free() + freed < taken) {
    return { ok: false, code: 'pack-full' };
  }
  inventory.remove(ITEMS.waterJar, 1);
  inventory.remove(ITEMS.meadowFlower, 1);
  inventory.add(ITEMS.clayJar, 1);
  inventory.add(ITEMS.wash, 1);
  return { ok: true };
}

export type UseWashResult =
  | { ok: true }
  | { ok: false; code: 'not-carried' | 'no-scent' };

/**
 * Wash the standing scent off: consumes the wash,
 * clears the scent. Refuses at no scent (the tend
 * posture — a wash spent on nothing is a waste the
 * game does not let her make by accident).
 */
export function useWash(
  inventory: PersonalInventory,
  scent: ScentState,
): UseWashResult {
  if (inventory.count(ITEMS.wash) <= 0) {
    return { ok: false, code: 'not-carried' };
  }
  if (!scent.isActive()) return { ok: false, code: 'no-scent' };
  inventory.remove(ITEMS.wash, 1);
  scent.clear();
  recordItemUse(ITEMS.wash);
  return { ok: true };
}
