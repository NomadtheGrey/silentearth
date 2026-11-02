/**
 * WEATHER SPELLS — the event layer over the climate field
 * (W1, Background, 2026-11-02; Adam: "let's get the weather
 * going"; design claim accepted by DEV as claimed).
 *
 * The census (2026-11-01) found a sound climate FIELD and
 * no weather: seasonalWeatherAt(x, z, month) is a static
 * biome blend whose only temporal input, the month, was
 * fed a constant by every consumer — nothing ever rained.
 * This module is the missing layer: a SPELL MACHINE with
 * persistence (Adam, 2026-10-28: weather runs in spells —
 * streaks, not independent daily rolls).
 *
 * THE MACHINE
 * - Kinds: dry / wet / inclement. A spell has a rolled
 *   length; when the world's day count passes its end,
 *   the next kind rolls from weights sampled from the
 *   FIELD AT HER POSITION at that moment — rates read
 *   the country she stands in (Adam's ruling). Weights
 *   (DRAFT shapes): dry ∝ (1 − rain), wet ∝ rain,
 *   inclement ∝ rain² — so the Deep Bog breeds inclement
 *   spells and Oldfield Rise mostly breeds dry ones.
 * - Intensity (the number every reader consumes): dry →
 *   0; wet → the field's local rain (biome character
 *   rides: a wet spell rains harder in the bog); inclement
 *   → max(field, INCLEMENT_FLOOR). Spell edges cross-fade
 *   over EDGE_DAYS so nothing pops.
 * - THE SEEDED WOBBLE (Adam, 2026-11-02; calibrated
 *   the same day by his reality check: "All day rains
 *   are not common"): inside a wet or inclement spell
 *   the intensity BREATHES — a slow seeded sine (period
 *   WOBBLE_PERIOD_DAYS) phased by the spell's own
 *   index, so the same spell wobbles identically on
 *   every device and a mid-spell reload is seamless.
 *   THE DEPTH IS PER-SPELL: a steadiness roll at the
 *   spell's birth decides its character — MOST wet
 *   spells wobble DEEP (lulls fall toward nothing: a
 *   wet day reads as showers passing, not a sheet),
 *   and a minority hold STEADY (the all-day rain, kept
 *   uncommon). Inclement rolls steadier and shallower
 *   — a storm day is the all-day rain's natural home.
 *   Dry spells never wobble (their target is 0, and 0
 *   modulated is 0). THE FLOOR IS PRE-WOBBLE (lane's
 *   call, named for the pin pass): the floor guarantees
 *   a spell's standing character; the wobble is
 *   texture over it, so an inclement spell may LULL
 *   below the floor but its standing strength always
 *   reaches it.
 * - FIRST WEEK PLEASANT (Adam, 2026-10-28): while the
 *   WORLD's day count is under FIRST_WEEK_DAYS, inclement
 *   cannot roll (a spell is judged by the day it BEGINS);
 *   a new world's opening spell is dry. The cap reads the
 *   world's days, never the session's.
 * - Border incoherence stands as Adam accepted it (the
 *   biome reconciliation pays it next): within a wet
 *   spell, intensity follows her position's field, so
 *   crossing a biome edge changes the rain's strength.
 *
 * THE CLOCK — there is no second clock. The sky rig
 * counts dawns (daysElapsed, save-carried) and owns
 * cycleT; the renderer feeds dayFloat = daysElapsed +
 * cycleT into stepWeather each frame, and the month
 * derives from it: month = SEASON_START_MONTH +
 * dayFloat / DAYS_PER_MONTH, with day 0 = September 1
 * (Adam's working start date). Fronts move because the
 * month term finally moves.
 *
 * PERSISTENCE — the sequence is position-dependent BY
 * DESIGN (weights sample where she stood), so it cannot
 * re-derive from the seed; the spell record persists:
 * { kind, startDay, lengthDays, index }. The record is
 * HOSTED state (Systems seats the save field in their
 * W2 pass, the facts pattern): the renderer seats it via
 * seatWeatherState at world install / save restore and
 * reads it back via weatherStateSnapshot. Rolls are
 * seeded per (world seed, spell index, purpose) so a
 * given transition's roll is stable whatever calls it.
 *
 * FACTS — currentWeatherFacts() is the hosted read for
 * Systems' W2 (cold/wet) and the render: the live
 * day/month, the spell, rain intensity, wind, harshness,
 * cold — computed at her position each step. Consumers
 * read facts; nobody imports the machine's internals.
 */
import { deriveSeed, mulberry32 } from './seed';
import { seasonalWeatherAt, SEASON_START_MONTH } from './weather';
import type { WorldGen } from './worldgen';

export type WeatherSpellKind = 'dry' | 'wet' | 'inclement';

/** The persisted spell record (Systems seats the field). */
export interface WeatherSpellRecord {
  kind: WeatherSpellKind;
  /** World day (float-day origin) the spell began on. */
  startDay: number;
  /** Rolled length in days. */
  lengthDays: number;
  /** Transition count (the roll stream's index). */
  index: number;
}

/** The live weather facts at her position (W2's read). */
export interface WeatherFacts {
  dayFloat: number;
  month: number;
  spell: WeatherSpellKind;
  /** 0..1 precipitation intensity (post edge-fade). */
  rainIntensity: number;
  wind: number;
  harshness: number;
  cold: number;
  front: number;
  isRaining: boolean;
}

/** Days per month on the season axis (DRAFT — W4 pin pass). */
export const DAYS_PER_MONTH = 30;
/** The pleasant first week, in world days (Adam-pinned shape; length DRAFT). */
export const FIRST_WEEK_DAYS = 7;
/** Inclement rain never falls softer than this (DRAFT). */
export const INCLEMENT_FLOOR = 0.75;
/** Spell-edge cross-fade span, in days (DRAFT). */
export const EDGE_DAYS = 0.05;
/** Harshness an inclement spell adds for W2's cold/wet (DRAFT). */
export const INCLEMENT_HARSHNESS_LIFT = 0.15;
/** Intensity above which rain reads as raining (the render's gate). */
export const RAIN_VISIBLE_INTENSITY = 0.05;
/** The wobble's period in days — 0.25 = six game-hours (DRAFT). */
export const WOBBLE_PERIOD_DAYS = 0.25;
/**
 * Per-spell wobble character (Adam's calibration: "All
 * day rains are not common" — ALL DRAFT). A spell rolls
 * STEADY with the kind's steady weight (its depth lands
 * in the shallow band: it rains more or less all day)
 * or DEEP otherwise (lulls fall toward nothing: showers
 * passing). Wet spells are mostly deep; inclement
 * spells roll steadier and breathe shallower.
 */
export const WOBBLE_SHAPES: Record<
  'wet' | 'inclement',
  { steadyWeight: number; steadyDepth: [number, number]; deepDepth: [number, number] }
> = {
  wet: { steadyWeight: 0.2, steadyDepth: [0.15, 0.3], deepDepth: [0.85, 1.0] },
  inclement: { steadyWeight: 0.55, steadyDepth: [0.2, 0.35], deepDepth: [0.55, 0.75] },
};

/** A spell's rolled wobble depth (deterministic per spell index). */
export function wobbleDepthFor(kind: 'wet' | 'inclement', worldSeed: string, index: number): number {
  const shape = WOBBLE_SHAPES[kind];
  const steady = roll01(worldSeed, index, 'steadiness') < shape.steadyWeight;
  const band = steady ? shape.steadyDepth : shape.deepDepth;
  return band[0] + roll01(worldSeed, index, 'depth') * (band[1] - band[0]);
}

/** Spell length ranges in days, by kind (ALL DRAFT). */
export const SPELL_LENGTH_DAYS: Record<WeatherSpellKind, [number, number]> = {
  dry: [2, 5],
  wet: [1, 3],
  inclement: [0.5, 2],
};

/** The month term at a world day: Sep 1 (day 0) is SEASON_START_MONTH. */
export function monthForDay(dayFloat: number): number {
  return SEASON_START_MONTH + dayFloat / DAYS_PER_MONTH;
}

function roll01(worldSeed: string, index: number, purpose: string): number {
  // deriveSeed already returns the hashed uint32 — do NOT
  // hashSeed it again: hashSeed on a NUMBER loops zero
  // times (no .length) and returns the same basis for
  // every input, collapsing every roll to one constant
  // (the trap weather.ts's phase comment documents; the
  // first probe run walked into it and read it back).
  return mulberry32(deriveSeed(worldSeed, `weather-spell:${index}:${purpose}`))();
}

function lengthFor(kind: WeatherSpellKind, worldSeed: string, index: number): number {
  const [lo, hi] = SPELL_LENGTH_DAYS[kind];
  return lo + roll01(worldSeed, index, 'length') * (hi - lo);
}

/**
 * The next kind at a boundary: weights from the field's
 * rain at her position (DRAFT shapes — dry ∝ 1 − rain,
 * wet ∝ rain, inclement ∝ rain²), the first-week cap
 * judged by the day the new spell BEGINS.
 */
function kindFor(fieldRain: number, worldSeed: string, index: number, beginsDay: number): WeatherSpellKind {
  const r = Math.min(1, Math.max(0, fieldRain));
  const wDry = 1 - r;
  const wWet = r;
  const wInc = beginsDay < FIRST_WEEK_DAYS ? 0 : r * r;
  const total = wDry + wWet + wInc;
  const roll = roll01(worldSeed, index, 'kind') * total;
  if (roll < wDry) return 'dry';
  if (roll < wDry + wWet) return 'wet';
  return 'inclement';
}

let record: WeatherSpellRecord | null = null;
let worldSeed = '';
let facts: WeatherFacts | null = null;
/** Intensity at the last transition + the day it happened (edge fade). */
let blendFrom = 0;
let blendDay = 0;

/**
 * Seat the machine: a restored record, or null for a new
 * world (whose opening spell is a rolled DRY spell —
 * the pleasant week starts fair). Called by the
 * renderer at world install and by the save restore.
 */
export function seatWeatherState(rec: WeatherSpellRecord | null, seed: string): void {
  worldSeed = seed;
  if (
    rec &&
    (rec.kind === 'dry' || rec.kind === 'wet' || rec.kind === 'inclement') &&
    Number.isFinite(rec.startDay) &&
    Number.isFinite(rec.lengthDays) &&
    rec.lengthDays > 0 &&
    Number.isFinite(rec.index)
  ) {
    record = { kind: rec.kind, startDay: rec.startDay, lengthDays: rec.lengthDays, index: rec.index };
  } else {
    record = { kind: 'dry', startDay: 0, lengthDays: lengthFor('dry', seed, 0), index: 0 };
  }
  blendFrom = 0;
  // No fade on seating: a restored spell stands at its
  // full intensity from the first step (a load is not a
  // transition). -Infinity keeps the fade window closed
  // until a real transition sets blendDay.
  blendDay = Number.NEGATIVE_INFINITY;
  facts = null;
}

/** The record to persist (a copy), or null before seating. */
export function weatherStateSnapshot(): WeatherSpellRecord | null {
  return record ? { ...record } : null;
}

export function clearWeatherState(): void {
  record = null;
  facts = null;
}

/** The hosted facts read: the last step's facts, or null. */
export function currentWeatherFacts(): WeatherFacts | null {
  return facts;
}

/**
 * Step the machine to the world's current day. Fires
 * any transitions the day count has passed (a sleep
 * jump can cross several; the guard bounds one step's
 * catch-up and the rest fire on later steps), then
 * computes the facts at her position.
 */
export function stepWeather(ctx: { gen: WorldGen; playerX: number; playerZ: number; dayFloat: number }): WeatherFacts {
  if (!record) seatWeatherState(null, String(ctx.gen.seed));
  let guard = 0;
  while (guard++ < 64) {
    const rec = record!;
    if (ctx.dayFloat < rec.startDay + rec.lengthDays) break;
    const boundary = rec.startDay + rec.lengthDays;
    blendFrom = facts ? facts.rainIntensity : 0;
    blendDay = boundary;
    const index = rec.index + 1;
    const field = seasonalWeatherAt(ctx.gen, ctx.playerX, ctx.playerZ, monthForDay(boundary));
    const kind = kindFor(field.rain, worldSeed, index, boundary);
    record = { kind, startDay: boundary, lengthDays: lengthFor(kind, worldSeed, index), index };
  }
  const cur = record!;
  const month = monthForDay(ctx.dayFloat);
  const field = seasonalWeatherAt(ctx.gen, ctx.playerX, ctx.playerZ, month);
  let target = 0;
  if (cur.kind === 'wet') target = field.rain;
  else if (cur.kind === 'inclement') target = Math.max(field.rain, INCLEMENT_FLOOR);
  if (cur.kind !== 'dry' && target > 0) {
    // The seeded wobble: showers and lulls within the
    // spell, at the spell's own rolled depth, phased by
    // its index (deterministic on every device; seam-
    // less across a reload — the record and the sky
    // clock are both persisted).
    const depth = wobbleDepthFor(cur.kind, worldSeed, cur.index);
    const phase = roll01(worldSeed, cur.index, 'wobble') * Math.PI * 2;
    const w = 0.5 + 0.5 * Math.sin((ctx.dayFloat / WOBBLE_PERIOD_DAYS) * Math.PI * 2 + phase);
    target *= 1 - depth * (1 - w);
  }
  let intensity = target;
  const sinceEdge = ctx.dayFloat - blendDay;
  if (sinceEdge >= 0 && sinceEdge < EDGE_DAYS) {
    // Mid-fade after a transition: cross from the old
    // spell's last intensity to the new target.
    intensity = blendFrom + (target - blendFrom) * (sinceEdge / EDGE_DAYS);
  }
  const harshness = Math.min(1, field.harshness + (cur.kind === 'inclement' ? INCLEMENT_HARSHNESS_LIFT : 0));
  facts = {
    dayFloat: ctx.dayFloat,
    month,
    spell: cur.kind,
    rainIntensity: Math.min(1, Math.max(0, intensity)),
    wind: field.wind,
    harshness,
    cold: field.cold,
    front: field.front,
    isRaining: intensity > RAIN_VISIBLE_INTENSITY,
  };
  return facts;
}
