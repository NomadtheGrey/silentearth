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
 * - No time-varying weather yet (no fronts, gusts, or day/night
 *   cycle): v1 weather is spatial, not temporal. Time variation is
 *   a later landing, not smuggled in here.
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
  const weather = weatherAt(gen, x, z);
  const shelter = modifiers.shelterQuery?.(x, z) ?? 1;
  return exposureAt(weather, { shelter, clothing: modifiers.clothing });
}
