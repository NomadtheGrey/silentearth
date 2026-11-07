/**
 * THE UNGUENTS — her applied treatments (Systems,
 * 2026-11-07; DEV's ideas at Adam's invitation, GO'd
 * on Systems' survey): the WARMTH UNGUENT (a rendered
 * salve that slows the cold gauge's rise while its
 * clock stands) and the RAIN-SHED WAX (beeswax worked
 * into a garment, shedding rain and wading wet while
 * the wax lasts — the clothing thread's Waxing seed
 * and this item are ONE thing, by Adam's unification).
 *
 * Both states follow the scent idiom: a small state,
 * a clock, apply refreshes and never stacks, snapshot
 * / restore lenient, the shell ticks. The EFFECTS read
 * in cold-wet.ts from facts the shell composes —
 * warmthUnguent (a boolean) and waxedGarments (the
 * waxed set) — so this module owns the clocks and the
 * acts, never the gauges.
 */

import { ITEMS, type ItemId } from './recipes';
import { type PersonalInventory } from './inventory';
import { recordItemUse } from './knowledge-register';

// ---------------------------------------------------------------------------
// The warmth unguent
// ---------------------------------------------------------------------------

/** One in-game day — the scent precedent (DRAFT). */
export const WARMTH_UNGUENT_DURATION_S = 600;

export interface WarmthUnguentSnapshot {
  secondsLeft: number;
}

export class WarmthUnguentState {
  private secondsLeft = 0;

  /** Lay the unguent: full clock, replacing any remnant. */
  apply(): void {
    this.secondsLeft = WARMTH_UNGUENT_DURATION_S;
  }

  isActive(): boolean {
    return this.secondsLeft > 0;
  }

  /** Tick the clock; expiry simply ends it. */
  tick(seconds: number): void {
    if (!this.isActive() || !(seconds > 0)) return;
    this.secondsLeft = Math.max(0, this.secondsLeft - seconds);
  }

  snapshot(): WarmthUnguentSnapshot {
    return { secondsLeft: this.secondsLeft };
  }

  /** Lenient: a bad or spent clock reads unanointed. */
  restore(snapshot: WarmthUnguentSnapshot | null | undefined): void {
    this.secondsLeft =
      snapshot &&
      Number.isFinite(snapshot.secondsLeft) &&
      snapshot.secondsLeft > 0
        ? snapshot.secondsLeft
        : 0;
  }
}

export type ApplyUnguentResult =
  | { ok: true }
  | { ok: false; code: 'not-carried' };

/**
 * Rub the warmth unguent on: consumes one jar and
 * lays its clock (the tend posture — checks before
 * consuming). The exercised door fires on success.
 */
export function applyWarmthUnguent(
  inventory: PersonalInventory,
  unguent: WarmthUnguentState,
): ApplyUnguentResult {
  if (inventory.count(ITEMS.warmthUnguent) <= 0) {
    return { ok: false, code: 'not-carried' };
  }
  inventory.remove(ITEMS.warmthUnguent, 1);
  unguent.apply();
  recordItemUse(ITEMS.warmthUnguent);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The rain-shed wax
// ---------------------------------------------------------------------------

/**
 * Exposure-seconds of protection per application
 * (DRAFT): the wax wears ONLY while rain or wading
 * reaches the garment — the shell ticks exposure for
 * the waxed garments she wears, in the weather that
 * wears it.
 */
export const WAX_PROTECTION_S = 1800;

/** garment item id -> exposure-seconds of wax left. */
export type WaxSnapshot = Record<string, number>;

export class WaxState {
  private readonly waxed = new Map<string, number>();

  /** Work wax into a garment: full protection, refreshing any remnant. */
  applyTo(garment: string): void {
    this.waxed.set(garment, WAX_PROTECTION_S);
  }

  /** Does this garment's wax still stand? */
  isWaxed(garment: string): boolean {
    return (this.waxed.get(garment) ?? 0) > 0;
  }

  /** The waxed garments, for the cold-wet facts composition. */
  waxedGarments(): string[] {
    return [...this.waxed.entries()]
      .filter(([, left]) => left > 0)
      .map(([garment]) => garment);
  }

  /**
   * Wear the wax: `seconds` of exposure against the
   * listed garments only (the shell passes the waxed
   * ones she is wearing, in reaching weather).
   */
  tickExposure(seconds: number, garments: readonly string[]): void {
    if (!(seconds > 0)) return;
    for (const garment of garments) {
      const left = this.waxed.get(garment);
      if (left === undefined) continue;
      const next = left - seconds;
      if (next <= 0) this.waxed.delete(garment);
      else this.waxed.set(garment, next);
    }
  }

  snapshot(): WaxSnapshot {
    return Object.fromEntries(this.waxed);
  }

  /** Lenient: bad entries drop alone; spent wax reads unwaxed. */
  restore(snapshot: WaxSnapshot | null | undefined): void {
    this.waxed.clear();
    if (!snapshot || typeof snapshot !== 'object') return;
    for (const [garment, left] of Object.entries(snapshot)) {
      if (garment !== '' && Number.isFinite(left) && left > 0) {
        this.waxed.set(garment, left);
      }
    }
  }
}

export type ApplyWaxResult =
  | { ok: true }
  | { ok: false; code: 'not-carried' | 'no-garment' };

/**
 * Work rain-shed wax into a garment she carries or
 * wears: consumes one wax and stamps the garment's
 * protection (the tend posture — checks first).
 */
export function applyWax(
  inventory: PersonalInventory,
  wax: WaxState,
  garment: ItemId,
): ApplyWaxResult {
  if (inventory.count(ITEMS.rainShedWax) <= 0) {
    return { ok: false, code: 'not-carried' };
  }
  if (inventory.count(garment) <= 0 && !inventory.wornItems().includes(garment)) {
    return { ok: false, code: 'no-garment' };
  }
  inventory.remove(ITEMS.rainShedWax, 1);
  wax.applyTo(garment);
  recordItemUse(ITEMS.rainShedWax);
  return { ok: true };
}
