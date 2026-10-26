/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Weather, v1 (Adam, 2026-10-26 — weather + hunger build, engine half).
 *
 * Adam's direction: each biome is more or less harsh, with wind,
 * rain, etc. varying BY BIOME — and Deep Bog's harshness comes from
 * its weather, not just its looks. Adam's rates delegation ("I trust
 * you or background to come up with rates") covers every number
 * below: all profiles are LANE-DECIDED starting tunables, flagged
 * for Adam's pin pass, NOT pinned.
 *
 * SHAPE (pinned by Adam's direction; numbers are not):
 * - One profile per biome: wind (m/s, sustained), rain (0..1
 *   intensity), harshness (0..1, the exposure weight Systems' and
 *   UI's survival math reads).
 * - Weather at her position derives from the biome MIX there
 *   (gen.weightsAt), not a hard zone label — biomes blend, so
 *   weather blends. Same weights, same weather: weatherAt is a
 *   pure function of (seed, x, z), so seed reproducibility holds.
 * - Time variation now exists as an INPUT axis (see SEASON AXIS
 *   below): seasonalWeatherAt adds the time-of-year trend +
 *   fronts on top of the biome profiles. No clock advances it
 *   yet — the progression rate is Adam's open call (below).
 *
 * CONSUMERS (Systems + UI):
 * - Query: weatherAt(gen, x, z) — call it on 'player:moved' or
 *   your own tick; it is cheap (one fieldsAt + one weightsAt).
 * - Event: 'weather:changed' — emitted by the proximity tracker
 *   when the DOMINANT biome at her position changes (see
 *   proximity.ts). Continuous wind/rain/harshness values come from
 *   the query, not the event: the event says "the weather regime
 *   changed", the query says "to what, exactly".
 *
 * SEASON AXIS (Adam, 2026-10-26 — model update, two axes
 * combined, not either/or): weather is SEMI-REALISTIC, biome-
 * based AND time-of-year based. The per-biome profiles below
 * stand as one axis; seasonalWeatherAt adds the time axis on
 * top. The game STARTS in September-ish (mild), and cold BUILDS
 * toward a November equivalent — the same biome in November is
 * worse than the same biome in September. Patterns read as
 * plausible weather (seasonal trend + moving fronts + cold
 * snaps), not random or arcade: everything below is
 * deterministic from (seed, position, month), never Math.random.
 * OPEN QUESTION — FLAGGED, NOT INVENTED (Adam's call): season
 * progression rate — how fast in-game time moves September
 * toward November. The axis takes month as an INPUT and never
 * advances it; no clock exists yet, and none is smuggled in
 * here. The hunger→health gate tied to this axis lives in
 * hunger.ts.
 *
 * CLIMATE (Adam, 2026-10-26, PINNED confirmation): TEMPERATE —
 * not tropical, not frigid, explicitly NOT Alaska and NOT the
 * Philippines. This confirms the semi-realistic patterns above
 * stay temperate: the profile ranges already are (no monsoon,
 * no deep-freeze mechanics anywhere), so this ruling changes
 * NO numbers — it pins the frame future values must stay in.
 * PLACE (Adam, 2026-10-26, PINNED): GREAT LAKES / UPPER
 * MIDWEST — Michigan, Wisconsin, northern Indiana/Ohio.
 * The exact place is NOT named on the map — location is
 * conveyed LATER via clues/background details, not a map
 * label or named place. Do NOT build named-place content in
 * this round; clue/background details are future content.
 * No exact spot is named here either, per that rule.
 *
 * HOOKS, NOT BUILT (Adam's brief, explicit):
 * - Shelter modifier: the housing system does not exist yet, but
 *   its HOOK SHAPE is now set (Adam, 2026-10-26, PINNED):
 *   placement is free (no zones/plots), so shelter keys on the
 *   placed house's position via ShelterQuery + exposureAtPosition
 *   — see there. Until housing lands, shelter defaults to
 *   unsheltered (multiplier 1).
 * - Clothes modifier: the INPUT SHAPE is now specified (garment
 *   table + multiplicative stacking, Marlowe-decided values in
 *   GARMENT_PROTECTION), but the clothes system itself is not
 *   built — no worn list exists yet, so callers default to no
 *   clothes (0%) until Systems' clothes work lands and the shell
 *   passes what she wears. No garment items, recipes, or wardrobe
 *   mechanics are invented here — only the table + socket.
 */

import type { WorldGen } from './worldgen';
import type { BiomeId } from '../types';
import { hashSeed } from './seed';

/** Wind in m/s, rain as 0..1 intensity, harshness as 0..1 exposure weight. */
export interface WeatherProfile {
  wind: number;
  rain: number;
  harshness: number;
}

/**
 * Per-biome weather profiles — LANE-DECIDED starting values
 * (Adam's pin pass still applies). Rationale, so the pass has
 * something to argue with:
 * - deepBog is harshest (0.90): outright swamp, driving rain —
 *   this is the weather-harshness Adam pointed at.
 * - oldfieldRise is mildest (0.25): higher, drier, the pleasant
 *   neighbor — shelter comes from the land itself.
 * - saltFlat is harsh through exposure, not wet (wind 14, rain
 *   0.05): open ground, no cover, drying wind.
 * - mirewood (spawn) sits mid-pack (0.45): sloppy-wet, but not
 *   the outright swamp — survivable, not comfortable.
 * - forest/tanglewood winds stay low (canopy breaks the wind)
 *   while rain stays middling (damp under trees).
 */
export const BIOME_WEATHER: Record<BiomeId, WeatherProfile> = {
  mirewood: { wind: 6, rain: 0.45, harshness: 0.45 },
  deepBog: { wind: 8, rain: 0.8, harshness: 0.9 },
  oldfieldRise: { wind: 5, rain: 0.25, harshness: 0.25 },
  creekBottom: { wind: 4, rain: 0.55, harshness: 0.5 },
  tanglewood: { wind: 3, rain: 0.5, harshness: 0.5 },
  saltFlat: { wind: 14, rain: 0.05, harshness: 0.65 },
  meadow: { wind: 7, rain: 0.3, harshness: 0.3 },
  forest: { wind: 3, rain: 0.4, harshness: 0.4 },
};

/** Weather at a position: the biome-mix blend + its dominant biome. */
export interface CurrentWeather extends WeatherProfile {
  dominant: BiomeId;
  /** The biome weights this blend came from (sums to 1). */
  weights: Record<BiomeId, number>;
}

/**
 * Weather at (x, z): each profile field is the weights-weighted
 * average of the per-biome profiles. Pure function of the world
 * generator — same seed, same position, same weather.
 */
export function weatherAt(gen: WorldGen, x: number, z: number): CurrentWeather {
  const { weights, dominant } = gen.weightsAt(x, z);
  let wind = 0;
  let rain = 0;
  let harshness = 0;
  for (const biomeId of Object.keys(weights) as BiomeId[]) {
    const w = weights[biomeId];
    if (w === 0) continue;
    const profile = BIOME_WEATHER[biomeId];
    wind += w * profile.wind;
    rain += w * profile.rain;
    harshness += w * profile.harshness;
  }
  return { wind, rain, harshness, dominant, weights };
}

/**
 * TIME-OF-YEAR AXIS (Adam, 2026-10-26 — model update; all
 * numbers below LANE-DECIDED starting tunables for Adam's pin
 * pass, NOT pinned). Month is continuous (9.0 = Sep 1, 9.5 =
 * mid-Sep, 11.0 = Nov 1). Two pattern layers, both deterministic:
 *
 * 1. SEASONAL TREND (cold builds Sep → Nov): cold(month) runs
 *    0 at September to 1 at November and stays 1 past it
 *    (deeper winter past November is future work, not invented
 *    here — the ruling covers Sep → Nov). At full cold, harshness
 *    moves COLD_HARSHNESS_BLEND of the way toward 1.0, wind rises
 *    by COLD_WIND_GAIN, and rain moves COLD_RAIN_BLEND of the way
 *    toward 1.0. So November's REGIME is worse everywhere — but
 *    see layer 2 for why a single November day can still read
 *    milder than a stormy September day (that is weather, not a
 *    dial).
 * 2. FRONTS (moving weather, not noise): a slow traveling sine
 *    wave over (position, month), phased per world seed, so
 *    fronts sweep across the map over weeks and read as broad
 *    systems, not per-spot dice. Wave ±1 shifts harshness by
 *    FRONT_HARSHNESS, wind by FRONT_WIND, rain by FRONT_RAIN —
 *    small against the trend, so fronts texture the season
 *    without overturning it on average. Cold snaps are the
 *    wave's peaks landing on high cold: trend + peak together.
 *
 * DETERMINISM: same seed + same position + same month = same
 * weather, always. No Math.random anywhere here, same rule as
 * worldgen. The biome mix (dominant, weights) does NOT change
 * with season — only wind/rain/harshness do.
 */
export const SEASON_START_MONTH = 9;
export const SEASON_COLD_MONTH = 11;
export const COLD_HARSHNESS_BLEND = 0.4;
export const COLD_WIND_GAIN = 0.25;
export const COLD_RAIN_BLEND = 0.3;
export const FRONT_HARSHNESS = 0.08;
export const FRONT_WIND = 1.5;
export const FRONT_RAIN = 0.08;
export const FRONT_X = 0.004;
export const FRONT_Z = 0.003;
export const FRONT_TIME = 1.7;

/** Seasonal cold at a month: 0 in September, 1 by November. */
export function seasonCold(month: number): number {
  return Math.min(1, Math.max(0, (month - SEASON_START_MONTH) / (SEASON_COLD_MONTH - SEASON_START_MONTH)));
}

/** Seasonal weather: biome blend + time-of-year trend + fronts. */
export interface SeasonalWeather extends CurrentWeather {
  /** The month input this reading came from. */
  month: number;
  /** Seasonal cold factor at that month (0..1). */
  cold: number;
  /** Front wave value at (position, month) (-1..1). */
  front: number;
}

export function seasonalWeatherAt(
  gen: WorldGen,
  x: number,
  z: number,
  month: number = SEASON_START_MONTH,
): SeasonalWeather {
  const base = weatherAt(gen, x, z);
  const cold = seasonCold(month);
  // String() is load-bearing: WorldGen.seed is typed string, but
  // createWorldGen stores the caller's value verbatim, and probes
  // + callers pass numbers (12345) — hashSeed on a number would
  // loop zero times (no .length) and return the same basis for
  // every seed, collapsing all fronts to one phase. Coercing
  // keeps the phase genuinely per-seed either way.
  const phase = ((hashSeed(String(gen.seed)) % 1000) / 1000) * Math.PI * 2;
  const front = Math.sin(x * FRONT_X + z * FRONT_Z + month * FRONT_TIME + phase);
  const harshness = Math.min(
    1,
    Math.max(0, base.harshness + (1 - base.harshness) * cold * COLD_HARSHNESS_BLEND + front * FRONT_HARSHNESS),
  );
  const wind = Math.max(0, base.wind * (1 + cold * COLD_WIND_GAIN) + front * FRONT_WIND);
  const rain = Math.min(
    1,
    Math.max(0, base.rain + (1 - base.rain) * cold * COLD_RAIN_BLEND + front * FRONT_RAIN),
  );
  return { ...base, wind, rain, harshness, month, cold, front };
}

/**
 * SEASONAL DAY/NIGHT SPLIT (Adam, 2026-10-26 — refinement of
 * the light direction noted in fire.ts; sits with the
 * time-of-year axis above). The cycle is SEMI-REALISTIC: the
 * TOTAL stays ~10 minutes, but the day/night split varies by
 * season — nights LONGER in winter, SHORTER in summer, even
 * splits at the equinoxes. This is a pure function of month
 * for the future clock to read; no clock, cycle, or darkness
 * mechanic is built here (same open progression question as
 * the season axis: nothing advances month yet).
 *
 * Ratios are LANE-DECIDED starting tunables for Adam's pin
 * pass, NOT pinned: day fraction runs 0.65 at the summer
 * solstice (June) down to 0.35 at the winter solstice
 * (December), a smooth cosine between them. At the game's
 * September start the split is even (0.5/0.5); by November
 * the night is already ~63% of the cycle — longer nights
 * arriving WITH the cold, which is the point: winter darkness
 * and winter weather deepen together.
 */
export const DAY_NIGHT_CYCLE_MINUTES = 10;
export const SUMMER_SOLSTICE_MONTH = 6;
export const DAY_FRACTION_AMPLITUDE = 0.15;

/** Fraction of the ~10-minute cycle that is day at a month. */
export function dayFraction(month: number): number {
  return 0.5 + DAY_FRACTION_AMPLITUDE * Math.cos(((month - SUMMER_SOLSTICE_MONTH) / 12) * Math.PI * 2);
}

/** Fraction of the ~10-minute cycle that is night at a month. */
export function nightFraction(month: number): number {
  return 1 - dayFraction(month);
}

/**
 * Exposure elements: the axes clothing protects against. Rain,
 * wind, and cold come from the weather; wet is ground water
 * (marsh/bog) soaking through. v1 weather profiles carry wind +
 * rain + a single harshness, so the elements below are the
 * CLOTHING axes — the per-element split lives in the garment
 * table, not in the biome profiles.
 */
export type ExposureElement = 'rain' | 'wind' | 'cold' | 'wet';

/** Per-element protection percentages, 0..1 (fraction blocked). */
export type ElementPercentages = Partial<Record<ExposureElement, number>>;

/** Per-element remaining exposure, 0..1 (1 = unprotected). */
export type ElementRemaining = Record<ExposureElement, number>;

/** Garment ids for the clothes-modifier input. */
export type GarmentId =
  | 'cloak'
  | 'shawl'
  | 'pointyHat'
  | 'mossyMittens'
  | 'bogBoots';

/**
 * Garment protection table — MARLOWE-DECIDED starting values
 * (Adam, 2026-10-26, via the weather brief update; for Adam's pin
 * pass, NOT Adam-pinned). Percentages are per garment, per
 * element, as fractions blocked:
 * - Cloak: rain 40%, wind 30%.
 * - Shawl: cold 30%.
 * - Pointy Hat: rain 15%.
 * - Mossy Mittens: cold 15%.
 * - Bog boots: wet 40% — PLUS the less-slow travel effect in
 *   movement.ts (the two effects are separate: wet protection
 *   here, speed mitigation there).
 * Full kit combined (multiplicative, see clothingRemaining):
 * rain ~49%, wind 30%, cold ~41%, wet 40%.
 */
export const GARMENT_PROTECTION: Record<GarmentId, ElementPercentages> = {
  cloak: { rain: 0.4, wind: 0.3 },
  shawl: { cold: 0.3 },
  pointyHat: { rain: 0.15 },
  mossyMittens: { cold: 0.15 },
  bogBoots: { wet: 0.4 },
};

/**
 * Remaining exposure per element for a worn set. STACKING
 * (Marlowe-decided): multiplicative per element — each worn
 * garment reduces the REMAINING exposure by its percentage, so
 * returns diminish and protection never reaches 100% (every
 * factor stays above 0). Duplicates are ignored: a garment is
 * worn or it is not, wearing it twice is not wearing two.
 * No clothes worn → every element remains 1 (0% protection).
 */
export function clothingRemaining(worn: readonly GarmentId[]): ElementRemaining {
  const remaining: ElementRemaining = { rain: 1, wind: 1, cold: 1, wet: 1 };
  for (const garment of new Set(worn)) {
    const protection = GARMENT_PROTECTION[garment];
    for (const element of Object.keys(protection) as ExposureElement[]) {
      remaining[element] *= 1 - (protection[element] ?? 0);
    }
  }
  return remaining;
}

/**
 * Single clothing multiplier for a worn set: the MEAN of the four
 * element remainings. Combination rule (lane-decided, flagged):
 * v1 harshness is a single number, so a single multiplier is
 * needed, and the mean keeps every element's voice without
 * letting four multiplied axes over-count one harshness (a
 * product would credit a lone cloak with ~58% off). Systems
 * needing element-specific logic later (wetness/cold meters)
 * read clothingRemaining directly instead of this mean.
 */
export function clothingMultiplier(worn: readonly GarmentId[]): number {
  const remaining = clothingRemaining(worn);
  return (remaining.rain + remaining.wind + remaining.cold + remaining.wet) / 4;
}

/**
 * Exposure modifiers. Shelter is the separate STATIONARY
 * modifier (housing system, values TBD — housing is not built).
 * Clothing is the TRAVELING modifier, as either a worn garment
 * list (table-driven, preferred) or a direct 0..1 multiplier
 * (kept for callers that already computed one). Until Systems'
 * clothes system lands and the shell passes a worn list, callers
 * omit clothing and exposure reads as unclothed (0%).
 */
export interface ExposureModifiers {
  /** Housing protection multiplier, 0..1. Omitted = unsheltered (1). */
  shelter?: number;
  /** Worn garments, or a direct multiplier. Omitted = unclothed (1). */
  clothing?: number | readonly GarmentId[];
}

/**
 * SHELTER HOOK SHAPE (Adam, 2026-10-26, PINNED placement rule):
 * housing placement is FREE — no zones, no plots. She places a
 * house/hut anywhere she likes, and since biomes are continuous
 * fields, nothing gates placement. So shelter keys on the PLACED
 * HOUSE'S POSITION, never on a zone or plot: the housing system
 * (not built yet) will supply a query closing over the placed
 * house's coordinates, returning the shelter multiplier at any
 * (x, z). Radius, falloff, and protection values are the housing
 * system's decisions (TBD) — this hook names the key only.
 * PACING NOTE (same brief): shelter conquers the environment
 * SOON — it is the early-game answer to weather, not a
 * late-game reward — so the hook shape is set now, ahead of the
 * housing build, with no values invented in the meantime.
 */
export type ShelterQuery = (x: number, z: number) => number;

/** Position-aware exposure inputs: shelter as a query, not a scalar. */
export interface PositionExposureModifiers {
  /** Housing query (see ShelterQuery). Omitted = unsheltered (1). */
  shelterQuery?: ShelterQuery;
  /** Worn garments, or a direct multiplier. Omitted = unclothed (1). */
  clothing?: number | readonly GarmentId[];
  /**
   * Time-of-year month for the seasonal axis (default: the start
   * month, September). Omitted = game-start weather. The future
   * clock system passes the live month here; nothing advances
   * it in the meantime (progression rate is Adam's open call).
   */
  month?: number;
}

/**
 * Effective exposure harshness: weather harshness reduced by
 * shelter (stationary) and clothing (traveling). Today both
 * default to 1, so exposure == harshness. Systems' survival math
 * should read exposureAt, not raw harshness, so shelter/clothes
 * land without a call-site change.
 */
export function exposureAt(
  weather: WeatherProfile,
  modifiers: ExposureModifiers = {},
): number {
  const shelter = modifiers.shelter ?? 1;
  const clothingValue = modifiers.clothing;
  const clothing =
    clothingValue === undefined
      ? 1
      : typeof clothingValue === 'number'
        ? clothingValue
        : clothingMultiplier(clothingValue);
  return weather.harshness * shelter * clothing;
}

/**
 * Position-aware exposure: weather at (x, z) reduced by the
 * shelter query at that same position plus clothing. This is
 * the call Systems' survival math should use once housing
 * lands: it evaluates shelter where she STANDS against the
 * placed house's position, not against any zone or plot (there
 * are none). Until housing supplies a query, shelter reads 1
 * and this equals exposureAt(weatherAt(gen, x, z), { clothing }).
 */
export function exposureAtPosition(
  gen: WorldGen,
  x: number,
  z: number,
  modifiers: PositionExposureModifiers = {},
): number {
  const weather = seasonalWeatherAt(gen, x, z, modifiers.month ?? SEASON_START_MONTH);
  const shelter = modifiers.shelterQuery?.(x, z) ?? 1;
  return exposureAt(weather, { shelter, clothing: modifiers.clothing });
}
