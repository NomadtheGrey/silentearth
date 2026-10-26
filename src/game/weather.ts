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
 * - Shelter modifier (lean-to and up — the housing system does not
 *   exist yet) and clothes modifier (garment types TBD) are
 *   DOCUMENTED INPUTS to exposureAt, defaulting to unsheltered /
 *   unclothed (multiplier 1 = no protection) until those systems
 *   land and supply real values. No shelter or clothes mechanics
 *   are invented here — only the socket they will plug into.
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
 * Future exposure inputs — HOOKS, not mechanics. Housing will
 * supply shelter (lean-to and up) and garments will supply
 * clothing; each is a 0..1 protection multiplier (1 = no
 * protection, 0 = fully protected). Until those systems land,
 * callers omit them and exposure reads as unsheltered/unclothed.
 */
export interface ExposureModifiers {
  /** Housing protection multiplier, 0..1. Omitted = unsheltered (1). */
  shelter?: number;
  /** Clothing protection multiplier, 0..1. Omitted = unclothed (1). */
  clothing?: number;
}

/**
 * Effective exposure harshness: weather harshness reduced by
 * whatever protection the (future) shelter and clothing systems
 * report. Today both default to 1, so exposure == harshness.
 * Systems' survival math should read exposureAt, not raw
 * harshness, so shelter/clothes land without a call-site change.
 */
export function exposureAt(
  weather: WeatherProfile,
  modifiers: ExposureModifiers = {},
): number {
  const shelter = modifiers.shelter ?? 1;
  const clothing = modifiers.clothing ?? 1;
  return weather.harshness * shelter * clothing;
}
