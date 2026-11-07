// HER COLD / WET STATE (W2 of the weather build; Adam:
// 'let's get the weather going', 2026-11-02; design
// claimed by Systems, settled by DEV the same day).
//
// Two gauges, 0–100 — WET and COLD — on the HungerState
// pattern: this class holds the values and the stage
// queries; the DRIVERS arrive per tick as one composed
// facts record the SHELL builds (Background's W1 surface
// supplies the atmospheric half — rainIntensity / wind /
// harshness / cold / spell at her position — and the
// engine's situational queries supply immersion,
// shelterMultiplier, fireWarmth, and the worn set). This
// module imports nothing from game/: the facts are
// arguments, so the dependency direction stays clean by
// construction.
//
// THE COMPOUNDING LAW (Adam's design, 2026-10-20): wet +
// cold together is what bites — the cold rise is amplified
// by her wetness (soaked doubles it). Fire and shelter
// push back: shelter cuts the rain and the wind-cold by
// its multiplier (the engine's live table governs those
// numbers — the F1 decision; this module consumes the
// multiplier as a fact), fire dries and warms by
// proximity (fires stay lit, no fuel — pinned).
//
// EFFECTS: none direct in v1, deliberately. There is no
// health system yet; the standing law is the pinned gate
// in hunger.ts's header (hunger answers health only
// while cold), and this module's isCold() / coldStage()
// are the queries that gate will read. FREEZING is the
// named worst stage with NO invented consequence —
// can-she-die stays OPEN (Adam), the gauge clamps at 100.
//
// SLEEP: the gauges keep ticking while she sleeps —
// hunger pauses in sleep by its own rule, but a free
// night would unmake shelter; the shell's sleep loop
// ticks with the night's facts.
//
// ALL RATES ARE DRAFT for Adam's W4 pin pass.

import type { ItemId } from './recipes';

export type ColdStage = 'comfortable' | 'chilly' | 'cold' | 'freezing';
export type WetStage = 'dry' | 'damp' | 'wet' | 'soaked';
export type Immersion = 'none' | 'wading' | 'swimming';
export type WeatherSpell = 'dry' | 'wet' | 'inclement';

/**
 * One tick's composed facts (the shell builds this —
 * see the header). Intensities are 0..1; shelterMultiplier
 * is the fraction of harshness REMAINING (the engine's
 * best-of answer at her position); fireWarmth is 0..1 by
 * proximity to the nearest lit fire (draft: full within
 * 2.5 m, none past 5 m — the composer owns the curve).
 */
export interface ColdWetFacts {
  rainIntensity: number;
  wind: number;
  harshness: number;
  cold: number;
  spell: WeatherSpell;
  immersion: Immersion;
  shelterMultiplier: number;
  /**
   * The rain's OWN read of her cover (the drying fix
   * part 2, 2026-11-05): the fraction of rain that
   * REACHES her — 1 under open sky, 0 under an
   * enclosed roof (a placed house, a tent), a named
   * fraction at an open-sided lean-to (RAIN_SHELTER_
   * LEAN_TO, DRAFT). A roof is not a discount: the
   * shelterMultiplier stays the cold/wind factor it
   * was designed as, and rain gets the binary the
   * player can see. OPTIONAL while the composer
   * stages over: absent, the tick reads the
   * shelterMultiplier for rain exactly as before.
   */
  rainShelter?: number;
  fireWarmth: number;
  worn: readonly ItemId[];
  /**
   * The warmth unguent stands (the unguents landing,
   * 2026-11-07): shell-derived from WarmthUnguentState
   * .isActive(). OPTIONAL: absent reads unanointed.
   * While it stands, the cold rise is cut by
   * WARMTH_UNGUENT_COLD_CUT.
   */
  warmthUnguent?: boolean;
  /**
   * The garments whose rain-shed wax still stands
   * (the unguents landing, 2026-11-07): shell-derived
   * from WaxState.waxedGarments(). OPTIONAL: absent
   * reads nothing waxed. A waxed garment in
   * GARMENT_WEATHER sheds WAX_RAINSHED_BONUS more
   * rain; waxed bog boots cut the wading soak (they
   * are not rain garments — the boots answer the
   * water at her feet, not the rain on her back).
   */
  waxedGarments?: readonly string[];
}

/** Rain reaching her under a lean-to (open-sided; DRAFT). */
export const RAIN_SHELTER_LEAN_TO = 0.5;

// --- Draft rates (per minute, gauges 0–100) -------------

/** Wet rise in full rain, unsheltered, uncloaked. */
export const RAIN_SOAK_PER_MIN = 10;
/** Wet rise while wading. */
export const WADING_SOAK_PER_MIN = 25;
/** Wet rise while swimming — a plunge soaks her. */
export const SWIMMING_SOAK_PER_MIN = 60;
/** Drying with no fire and no exposure. */
export const DRY_AMBIENT_PER_MIN = 2;
/** Extra drying while sheltered from the rain. */
export const DRY_SHELTERED_PER_MIN = 2;
/** Drying at full fireWarmth. */
export const DRY_FIRE_PER_MIN = 8;
/** Cold rise at full atmospheric cold. */
export const COLD_RISE_PER_MIN = 6;
/** Warming at full fireWarmth. */
export const WARM_FIRE_PER_MIN = 6;
/** Warming while sheltered in mild air. */
export const WARM_SHELTERED_PER_MIN = 2;

/**
 * Garment answers (DRAFT): warmth = the fraction cut
 * from the cold rise; rainShed = the fraction of rain
 * kept off her. Keyed by garment item id; a garment not
 * listed answers nothing.
 */
/** The warmth unguent's cut of the cold rise (DRAFT). */
export const WARMTH_UNGUENT_COLD_CUT = 0.5;
/** Extra rain shed by a waxed garment (DRAFT). */
export const WAX_RAINSHED_BONUS = 0.35;
/** The waxed bog boots' cut of the wading soak (DRAFT). */
export const WAXED_BOOTS_WADING_CUT = 0.5;

export const GARMENT_WEATHER: Readonly<
  Record<string, { warmth: number; rainShed: number }>
> = {
  'hooded-cloak': { warmth: 0.3, rainShed: 0.25 },
  shawl: { warmth: 0.15, rainShed: 0 },
  'pointy-hat': { warmth: 0.05, rainShed: 0 },
};

/** Stage thresholds (DRAFT): a stage starts at its value. */
export const WET_DAMP_AT = 1;
export const WET_WET_AT = 40;
export const WET_SOAKED_AT = 75;
export const COLD_CHILLY_AT = 1;
export const COLD_COLD_AT = 40;
export const COLD_FREEZING_AT = 75;

export interface ColdWetSnapshot {
  cold: number;
  wet: number;
}

function clampGauge(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function unit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export class ColdWetState {
  private cold: number;
  private wet: number;

  /** Starts comfortable and dry unless wiring passes saved values. */
  constructor(initial: ColdWetSnapshot = { cold: 0, wet: 0 }) {
    this.cold = clampGauge(initial.cold);
    this.wet = clampGauge(initial.wet);
  }

  coldValue(): number {
    return this.cold;
  }

  wetValue(): number {
    return this.wet;
  }

  coldStage(): ColdStage {
    if (this.cold >= COLD_FREEZING_AT) return 'freezing';
    if (this.cold >= COLD_COLD_AT) return 'cold';
    if (this.cold >= COLD_CHILLY_AT) return 'chilly';
    return 'comfortable';
  }

  wetStage(): WetStage {
    if (this.wet >= WET_SOAKED_AT) return 'soaked';
    if (this.wet >= WET_WET_AT) return 'wet';
    if (this.wet >= WET_DAMP_AT) return 'damp';
    return 'dry';
  }

  /**
   * THE query the pinned hunger→health gate reads: she
   * counts as cold at the 'cold' stage or worse. Nothing
   * consumes it yet — health is unbuilt and the gate is
   * a rule about that future system, not a drain here.
   */
  isCold(): boolean {
    return this.cold >= COLD_COLD_AT;
  }

  snapshot(): ColdWetSnapshot {
    return { cold: this.cold, wet: this.wet };
  }

  /**
   * The witness's poll (W3, UI): both gauges as
   * { value, stage } in the hunger meter's idiom, read
   * on the shell's vitals cadence. A stage CHANGE is
   * observable as the stage string differing between
   * polls — the shell edge-detects from this alone and
   * never re-derives a threshold.
   */
  vitals(): {
    cold: { value: number; stage: ColdStage };
    wet: { value: number; stage: WetStage };
  } {
    return {
      cold: { value: this.cold, stage: this.coldStage() },
      wet: { value: this.wet, stage: this.wetStage() },
    };
  }

  /** Advance both gauges by dtSeconds under one facts record. */
  tick(dtSeconds: number, facts: ColdWetFacts): void {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    const minutes = dtSeconds / 60;
    const shelter = unit(facts.shelterMultiplier);
    const fire = unit(facts.fireWarmth);
    // Both gauges move from the state at the tick's
    // START (a simultaneous update): the cold rise reads
    // the wet she carried INTO the minute, not the wet
    // after this minute's own drying.
    const startWet = this.wet;

    let warmth = 0;
    let rainShed = 0;
    let waxedBoots = false;
    for (const item of facts.worn) {
      const waxed = facts.waxedGarments?.includes(item) === true;
      if (waxed && item === 'bog-boots') waxedBoots = true;
      const garment = GARMENT_WEATHER[item];
      if (garment !== undefined) {
        warmth += garment.warmth;
        rainShed += garment.rainShed + (waxed ? WAX_RAINSHED_BONUS : 0);
      }
    }
    warmth = Math.min(0.5, warmth);
    rainShed = Math.min(0.5, rainShed);

    // WET: rain lands through shelter (the rain's own
    // read — rainShelter, the roof fact) and clothing;
    // immersion soaks directly. DRYING follows Adam's
    // law (2026-11-05, his sentence: 'I would
    // understand staying wet even near a fire if it's
    // raining' — the objection was never the wet, it
    // was the RISE while sheltered / fireside):
    // - Rain REACHES her (rainReaching > 0): the fire
    //   CANCELS the soak — netted to zero, never below.
    //   At full fire warmth she HOLDS; a weaker fire
    //   holds what it can. No other drying answers.
    // - NO rain reaches her, but it IS raining (she
    //   is roofed in a storm): the fire alone dries;
    //   without a fire she HOLDS — no ambient term
    //   answers in a storm, even indoors.
    // - NO rain at all: drying as it always was —
    //   ambient + sheltered + fire.
    // Net law: she never gains wetness while
    // sheltered or fireside; drying always has a
    // road (roof + fire in a storm, anything once
    // the rain stops), but a fire in the open rain
    // only holds the line.
    const rainIntensity = unit(facts.rainIntensity);
    const rainReaching =
      rainIntensity * unit(facts.rainShelter ?? shelter) * (1 - rainShed);
    let wetDelta = RAIN_SOAK_PER_MIN * rainReaching;
    if (facts.immersion === 'wading') {
      wetDelta +=
        WADING_SOAK_PER_MIN * (waxedBoots ? 1 - WAXED_BOOTS_WADING_CUT : 1);
    } else if (facts.immersion === 'swimming') {
      wetDelta += SWIMMING_SOAK_PER_MIN;
    }
    if (facts.immersion === 'none') {
      const fireDry = DRY_FIRE_PER_MIN * fire;
      if (rainReaching > 0) {
        wetDelta = Math.max(wetDelta - fireDry, 0);
      } else if (rainIntensity > 0) {
        wetDelta = -fireDry;
      } else {
        wetDelta -=
          fireDry +
          DRY_AMBIENT_PER_MIN +
          (shelter < 1 ? DRY_SHELTERED_PER_MIN : 0);
      }
    }
    this.wet = clampGauge(this.wet + wetDelta * minutes);

    // COLD: the air and the wind, cut by shelter and
    // clothing, AMPLIFIED by the wet she already carries
    // (the compounding law — soaked doubles it). Fire
    // and sheltered mild air warm her back.
    const coldRise =
      COLD_RISE_PER_MIN *
      unit(facts.cold) *
      (0.5 + unit(facts.harshness)) *
      shelter *
      (1 + startWet / 100) *
      (1 - warmth) *
      (1 - (facts.warmthUnguent ? WARMTH_UNGUENT_COLD_CUT : 0));
    let coldDelta = coldRise;
    coldDelta -= WARM_FIRE_PER_MIN * fire;
    if (unit(facts.cold) < 0.25 && shelter < 1) {
      coldDelta -= WARM_SHELTERED_PER_MIN;
    }
    this.cold = clampGauge(this.cold + coldDelta * minutes);
  }
}
