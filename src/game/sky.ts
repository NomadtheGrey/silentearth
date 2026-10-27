/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SKY WITH CONTENT (Adam, 2026-10-26 — the sky-trap fix's second
 * half: NO perspective view is ever a solid color). One sun on a
 * day arc, one moon on a night path, stars on a fixed sphere
 * (visible when the weather is clear enough — overcast hides
 * them), and clouds whose density follows the current weather.
 * This is EARTH's sky, not BioForge's: a single sun, a single
 * moon, no binary suns, no ringed giant — BioForge's sky is
 * BioForge's and nothing of it is carried over.
 *
 * ASTRONOMY (plausible for the Great Lakes + in-game season,
 * never random decoration):
 * - COMPASS (lane-decided — no compass existed in game code):
 *   East = +x, North = −z. Yaw 0 faces −z (player.ts), so facing
 *   −z IS facing north. The sun rises in the east (+x), crosses
 *   SOUTH (+z) at noon, sets in the west (−x); the moon rides
 *   the same arc at night.
 * - LATITUDE (lane-decided starting value, flagged for Adam's
 *   pin pass): 42° — central Great Lakes (Fort Wayne 41.1°,
 *   Chicago 41.9°, upper Michigan ~46°).
 * - DECLINATION by month (mid-month day, standard approx):
 *   δ = −23.44°·cos(2π·(midDay + 10)/365). Noon altitude =
 *   90° − latitude + δ: September ~50°, November ~29° — the sun
 *   sinks WITH the cold, which is the point.
 * - MOON PHASE is computed per world (moonPhase(seed)) and
 *   ADVANCES PER DAWN (see below) — the crescent IS rendered
 *   now, via a phase shader on the moon disc (no canvas, no
 *   document — headless-safe like the rest of the rig).
 * - MOONLIGHT is phase-varying (see MOONLIGHT_FULL below):
 *   full moon at culmination = just about see by it; new moon
 *   = essentially none. Moon-phase POWER (sky magic) is NOT
 *   wired here — visible side only, never a magic effect.
 *
 * PHASE CYCLE (lane-decided, flagged for Adam's pin pass —
 * NO full calendar is built): one game-day per dawn. The rig
 * counts its own dawns (daysElapsed): each natural cycle
 * wrap + each sleep-to-dawn restore (a backward cycleT jump)
 * advances it by one, and the phase is
 * (moonPhase(seed) + daysElapsed / SYNODIC_DAYS) mod 1 with
 * SYNODIC_DAYS = 29.5 (the real synodic month, in game-days
 * — a full cycle takes ~5 real hours of play at the 10-min
 * day, so phases visibly change night to night without
 * rushing). A new world starts at day 0. PERSISTENCE GAP
 * (flagged, Systems follow-up): save.ts picks cycleT ONLY
 * from the sky snapshot, so daysElapsed resets to 0 on load
 * until save.ts carries it too (one field, same pattern) —
 * until then a refresh rewinds the phase toward the seed
 * base. The counter itself is session-true (wraps + sleeps).
 *
 * MINIMAL TIME DRIVER (the brief's flag, decided here — Adam's
 * pin pass applies; no full calendar is invented):
 * - Cycle position t ∈ [0,1) advances by dt over
 *   DAY_NIGHT_CYCLE_MINUTES (10 min, the existing starting value
 *   in weather.ts, NOT pinned). The day/night split comes from
 *   dayFraction(month): t < f is day (progress p = t/f), else
 *   night (progress q = (t−f)/(1−f)).
 * - The cycle STARTS AT DAWN (t = 0) on construction and on
 *   setSeed (a new world starts at dawn — lane-decided).
 * - MONTH stays an input (default SEASON_START_MONTH): nothing
 *   advances it. Season progression rate is still Adam's open
 *   question, same as the weather axis — this driver never
 *   smuggles a calendar in.
 *
 * WEATHER COUPLING (reads the seasonal state the renderer
 * passes in — rain + wind only):
 * - Clarity: rain < 0.30 clear, > 0.70 overcast, linear between.
 *   Stars need clear sky (opacity ∝ clarity); the moon glows
 *   through haze (opacity floor 0.35).
 * - Cloud cover: rain 0.15 → 0, 0.70 → 1, linear between. Cover
 *   ramps how many of the 14 puffs show + shared opacity.
 * - Wind is a SCALAR in weatherAt (m/s, no direction), so clouds
 *   drift eastward (+x) at wind × 0.5 and wrap around the player
 *   (flagged: a wind direction is unmodeled until weather gains
 *   one).
 *
 * PERFORMANCE (phone): per frame the rig updates ~20 uniforms /
 * positions + 14 cloud drifts + 2 lookAts. No geometry is rebuilt
 * per frame — dome, discs, stars, and cloud meshes are built once
 * (stars rebuild only on setSeed, a rare event). All sky materials
 * carry fog: false — CRITICAL: the scene's FogExp2 at sky
 * distances would otherwise fog the sun/moon/stars to invisible
 * (exp2 density 0.008 at 440 m ≈ 0). The dome shader has no fog.
 * The sky group follows the player (positioned at her x/z each
 * update) so the dome reads as infinitely far wherever she walks.
 */

import * as THREE from 'three';
import { DAY_NIGHT_CYCLE_MINUTES, dayFraction, SEASON_START_MONTH } from './weather';
import { deriveSeed, mulberry32 } from './seed';

/** Great Lakes latitude, degrees (lane-decided, flagged). */
export const SKY_LATITUDE_DEG = 42;
/** Moon's maximum altitude, degrees (lane-decided, flagged). */
export const MOON_MAX_ALT_DEG = 40;
/** Game-days per full phase cycle (real synodic month, lane-decided, flagged). */
export const SYNODIC_DAYS = 29.5;
/**
 * Full-moon moonlight at culmination, clear sky (lane-decided,
 * flagged): 0.25 — dim but usable, "just about see by it",
 * and BELOW torch light in practice (a directional 0.25
 * against a torch's 80/decay-2 point light, ~2.2 at 6 m —
 * the torch still dominates everywhere near her).
 */
export const MOONLIGHT_FULL = 0.25;
/** Dark-side earthshine as a fraction of moon color (faintly visible new moon). */
export const MOON_EARTHSHINE = 0.08;
/** Terminator softness in disc units (penumbra band, lane-decided). */
export const MOON_TERMINATOR_SOFT = 0.03;
/** Sky dome radius (camera far is 1000; dome + bodies sit inside). */
export const SKY_DOME_RADIUS = 480;
/** Sun/moon disc distance (inside the dome so the dome backs them). */
export const SKY_BODY_RADIUS = 440;
/** Star sphere radius (inside the dome, outside the bodies). */
export const SKY_STAR_RADIUS = 460;
/** Star count (one Points cloud — a single draw call). */
export const STAR_COUNT = 400;
/** Cloud puff count (shared geometry + material — cheap). */
export const CLOUD_COUNT = 14;
/** Rain below this reads as clear sky (lane-decided). */
export const CLEAR_RAIN = 0.3;
/** Rain above this reads as overcast (lane-decided). */
export const OVERCAST_RAIN = 0.7;
/** Rain below this means no clouds (lane-decided). */
export const CLOUD_RAIN_MIN = 0.15;
/** Rain at/above this means full cover (lane-decided). */
export const CLOUD_RAIN_MAX = 0.7;
/** Cloud drift speed as a fraction of wind m/s (lane-decided). */
export const CLOUD_DRIFT_SCALE = 0.5;
/** Cloud wrap half-extent around the player (local coords). */
export const CLOUD_WRAP = 400;

/** Mid-month day-of-year per month (1 = January), for declination. */
const MID_MONTH_DAY = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 318, 349];

/** Solar declination in degrees for a month (1–12, clamped). */
export function declinationDeg(month: number): number {
  const m = Math.min(12, Math.max(1, Math.round(month)));
  return -23.44 * Math.cos((2 * Math.PI * (MID_MONTH_DAY[m - 1] + 10)) / 365);
}

/** Sun's noon altitude in degrees for a month at SKY_LATITUDE_DEG. */
export function sunNoonAltitudeDeg(month: number): number {
  return 90 - SKY_LATITUDE_DEG + declinationDeg(month);
}

/** Sun elevation (radians) at day progress p ∈ [0,1]. */
export function sunElevationRad(dayProgress: number, month: number): number {
  return Math.sin(Math.PI * dayProgress) * ((sunNoonAltitudeDeg(month) * Math.PI) / 180);
}

/**
 * Sun direction at day progress p ∈ [0,1] for a month: east (+x)
 * at p = 0, south (+z) at noon (p = 0.5), west (−x) at p = 1.
 * Returns a unit vector (x east, y up, z south).
 */
export function sunDirection(dayProgress: number, month: number): THREE.Vector3 {
  const phi = Math.PI * dayProgress;
  const elev = sunElevationRad(dayProgress, month);
  const cosElev = Math.cos(elev);
  return new THREE.Vector3(Math.cos(phi) * cosElev, Math.sin(elev), Math.sin(phi) * cosElev);
}

/** Moon direction at night progress q ∈ [0,1]: same east→south→west arc. */
export function moonDirection(nightProgress: number): THREE.Vector3 {
  const phi = Math.PI * nightProgress;
  const elev = Math.sin(Math.PI * nightProgress) * ((MOON_MAX_ALT_DEG * Math.PI) / 180);
  const cosElev = Math.cos(elev);
  return new THREE.Vector3(Math.cos(phi) * cosElev, Math.sin(elev), Math.sin(phi) * cosElev);
}

/**
 * Sun elevation (radians) at ANY cycle position t ∈ [0,1): positive
 * in the day arc, mirrored negative at night (so dawn/dusk glow
 * lingers just past the horizon instead of cutting off).
 */
export function sunElevationAtCycle(cycleT: number, month: number): number {
  const f = dayFraction(month);
  if (cycleT < f) return sunElevationRad(cycleT / f, month);
  return -Math.sin(Math.PI * ((cycleT - f) / (1 - f))) * ((sunNoonAltitudeDeg(month) * Math.PI) / 180);
}

/** Cycle split: which half of the cycle t is in + progress within it. */
export function cycleSplit(
  cycleT: number,
  month: number,
): { isDay: boolean; dayProgress: number; nightProgress: number } {
  const f = dayFraction(month);
  if (cycleT < f) return { isDay: true, dayProgress: cycleT / f, nightProgress: 0 };
  return { isDay: false, dayProgress: 0, nightProgress: (cycleT - f) / (1 - f) };
}

/** Sky clarity from rain: 1 below CLEAR_RAIN, 0 above OVERCAST_RAIN. */
export function clarityFromRain(rain: number): number {
  return 1 - Math.min(1, Math.max(0, (rain - CLEAR_RAIN) / (OVERCAST_RAIN - CLEAR_RAIN)));
}

/** Cloud cover from rain: 0 below CLOUD_RAIN_MIN, 1 above CLOUD_RAIN_MAX. */
export function cloudCoverFromRain(rain: number): number {
  return Math.min(1, Math.max(0, (rain - CLOUD_RAIN_MIN) / (CLOUD_RAIN_MAX - CLOUD_RAIN_MIN)));
}

/** Moon phase for a world seed, 0..1 (the cycle's base; 0 = new, 0.5 = full). */
export function moonPhase(seed: string): number {
  return ((deriveSeed(String(seed), 'moon') % 1000) / 1000 + 1) % 1;
}

/** Illuminated fraction for a phase: 0 at new, 0.5 at quarters, 1 at full. */
export function moonIllumination(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** Current phase for a world seed + dawns elapsed (per-dawn cycle, no calendar). */
export function currentMoonPhase(seed: string, daysElapsed: number): number {
  return (((moonPhase(seed) + daysElapsed / SYNODIC_DAYS) % 1) + 1) % 1;
}

/**
 * Terminator terms for a phase (the shader's inputs + the
 * probe's oracle — the GLSL mirrors moonLitAt, keep in sync).
 * Waxing (phase < 0.5): lit limb on the right; waning: left.
 */
export function moonPhaseTerms(phase: number): { waxing: boolean; cosTheta: number; illumination: number } {
  const p = ((phase % 1) + 1) % 1;
  const theta = 2 * Math.PI * p;
  return { waxing: p < 0.5, cosTheta: Math.cos(theta), illumination: (1 - Math.cos(theta)) / 2 };
}

const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Lit factor at disc coords (u, v) ∈ [-1,1]² for a phase (0
 * outside the disc, 0..1 inside with a soft terminator). The
 * terminator is a half-ellipse: at the horizontal chord it
 * crosses at ±cos θ, tapering to the poles — the 8 octants
 * (new / crescents / quarters / gibbous / full) all fall out
 * of the one rule. The moon shader mirrors this exactly.
 */
export function moonLitAt(phase: number, u: number, v: number): number {
  if (u * u + v * v > 1) return 0;
  const { waxing, cosTheta } = moonPhaseTerms(phase);
  const s = Math.sqrt(Math.max(0, 1 - v * v));
  const termU = (waxing ? cosTheta : -cosTheta) * s;
  const eps = MOON_TERMINATOR_SOFT;
  return waxing
    ? smoothstep(termU - eps, termU + eps, u)
    : 1 - smoothstep(termU - eps, termU + eps, u);
}

/** Phase name by octant (for reports + future UI; not wired anywhere yet). */
export function moonPhaseName(phase: number): string {
  const names = [
    'new moon',
    'waxing crescent',
    'first quarter',
    'waxing gibbous',
    'full moon',
    'waning gibbous',
    'last quarter',
    'waning crescent',
  ];
  const p = ((phase % 1) + 1) % 1;
  return names[Math.floor(((p + 1 / 16) % 1) * 8)];
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const DAY_TOP = new THREE.Color(0x6fa8d0);
const DAY_HORIZON = new THREE.Color(0xcfe5ef);
const NIGHT_TOP = new THREE.Color(0x05070f);
const NIGHT_HORIZON = new THREE.Color(0x0e1626);
const SUNSET_HORIZON = new THREE.Color(0xe8905a);
const DAY_CLOUD = new THREE.Color(0xf2f2f0);
const NIGHT_CLOUD = new THREE.Color(0x2a2f3a);
const SUN_COLOR = new THREE.Color(0xffd970);
const MOON_COLOR = new THREE.Color(0xe8e8d8);

export interface SkyUpdateInput {
  month?: number;
  /** Seasonal weather at the player (rain + wind drive the sky). */
  weather: { rain: number; wind: number };
  playerX: number;
  playerZ: number;
}

/**
 * The sky rig: dome + sun + moon + stars + clouds + the lights
 * they drive. Built once; update() per frame is uniform/position
 * writes only. Headless-safe (no renderer, window, or document
 * use) — probes construct it with bare three objects.
 */

/** Saved sky state: cycle position t ∈ [0,1) + dawns elapsed (month is an input, not state). */
export interface SkySnapshot {
  cycleT: number;
  /** Dawn count for the phase cycle; absent on old saves (loads as current, i.e. 0 on a fresh rig). */
  daysElapsed?: number;
}

export class SkyRig {
  /** Cycle position t ∈ [0,1); 0 = dawn. */
  cycleT = 0;
  /** Dawns elapsed in this world (natural wraps + sleep-to-dawn restores). */
  daysElapsed = 0;
  private group = new THREE.Group();
  private domeUniforms: {
    topColor: { value: THREE.Color };
    horizonColor: { value: THREE.Color };
    sunDirection: { value: THREE.Vector3 };
    sunGlow: { value: number };
    moonDirection: { value: THREE.Vector3 };
    moonGlow: { value: number };
  };
  private sunMesh: THREE.Mesh;
  private moonMesh: THREE.Mesh;
  private starMaterial: THREE.PointsMaterial;
  private starGeometry: THREE.BufferGeometry | null = null;
  private cloudMaterial: THREE.MeshLambertMaterial;
  private clouds: THREE.Mesh[] = [];
  private cloudGeometry: THREE.BufferGeometry;
  private seed: string;

  constructor(
    scene: THREE.Scene,
    private camera: THREE.Camera,
    private sunLight: THREE.DirectionalLight,
    private hemiLight: THREE.HemisphereLight,
    seed: string,
  ) {
    this.seed = String(seed);
    this.domeUniforms = {
      topColor: { value: NIGHT_TOP.clone() },
      horizonColor: { value: NIGHT_HORIZON.clone() },
      sunDirection: { value: new THREE.Vector3(0, 1, 0) },
      sunGlow: { value: 0 },
      moonDirection: { value: new THREE.Vector3(0, 1, 0) },
      moonGlow: { value: 0 },
    };
    const domeMaterial = new THREE.ShaderMaterial({
      uniforms: this.domeUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDirection;
        uniform float sunGlow;
        uniform vec3 moonDirection;
        uniform float moonGlow;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
          float dSun = max(dot(dir, normalize(sunDirection)), 0.0);
          col += vec3(1.0, 0.85, 0.45) * pow(dSun, 64.0) * sunGlow;
          col += vec3(1.0, 0.85, 0.45) * pow(dSun, 8.0) * sunGlow * 0.15;
          float dMoon = max(dot(dir, normalize(moonDirection)), 0.0);
          col += vec3(0.85, 0.88, 1.0) * pow(dMoon, 64.0) * moonGlow * 0.5;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_DOME_RADIUS, 24, 16), domeMaterial);
    dome.renderOrder = -1;
    this.group.add(dome);

    this.sunMesh = new THREE.Mesh(
      new THREE.CircleGeometry(20, 32),
      new THREE.MeshBasicMaterial({ color: SUN_COLOR, fog: false }),
    );
    this.group.add(this.sunMesh);
    // Moon disc with a PHASE SHADER (no canvas, no document):
    // the fragment shader shades the disc by the terminator
    // rule in moonLitAt (mirrored in GLSL below — the TS
    // function is the probed oracle). Uniforms uWaxing/uCos
    // come from moonPhaseTerms each frame; uOpacity follows
    // the old clarity rule (0.35 haze floor, 1.0 clear).
    this.moonMesh = new THREE.Mesh(
      new THREE.CircleGeometry(13, 32),
      new THREE.ShaderMaterial({
        uniforms: {
          uWaxing: { value: 1 },
          uCos: { value: 1 },
          uColor: { value: MOON_COLOR.clone() },
          uOpacity: { value: 1 },
        },
        transparent: true,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uWaxing;
          uniform float uCos;
          uniform vec3 uColor;
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv * 2.0 - 1.0;
            float r2 = dot(p, p);
            if (r2 > 1.0) discard;
            float s = sqrt(max(0.0, 1.0 - p.y * p.y));
            float termU = (uWaxing > 0.5 ? uCos : -uCos) * s;
            float eps = ${MOON_TERMINATOR_SOFT.toFixed(2)};
            float lit = uWaxing > 0.5
              ? smoothstep(termU - eps, termU + eps, p.x)
              : 1.0 - smoothstep(termU - eps, termU + eps, p.x);
            vec3 col = uColor * mix(${MOON_EARTHSHINE.toFixed(2)}, 1.0, lit);
            gl_FragColor = vec4(col, uOpacity);
          }
        `,
      }),
    );
    this.group.add(this.moonMesh);

    this.starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    this.group.add(new THREE.Points(this.buildStarGeometry(), this.starMaterial));

    this.cloudGeometry = new THREE.SphereGeometry(1, 10, 8);
    this.cloudMaterial = new THREE.MeshLambertMaterial({
      color: DAY_CLOUD.clone(),
      transparent: true,
      opacity: 0.25,
      fog: false,
    });
    const rng = mulberry32(deriveSeed(this.seed, 'clouds'));
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const puff = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);
      puff.scale.set(18 + rng() * 12, 4 + rng() * 2, 12 + rng() * 6);
      puff.position.set((rng() * 2 - 1) * CLOUD_WRAP, 60 + rng() * 35, (rng() * 2 - 1) * CLOUD_WRAP);
      this.clouds.push(puff);
      this.group.add(puff);
    }

    scene.add(this.group);
  }

  /** Star positions for a seed: upper hemisphere only (never below the horizon). */
  private buildStarGeometry(): THREE.BufferGeometry {
    if (this.starGeometry) this.starGeometry.dispose();
    const rng = mulberry32(deriveSeed(this.seed, 'stars'));
    const positions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      // Rejection-sample a direction with y >= 0.12 (above the horizon).
      let x = 0;
      let y = 0;
      let z = 0;
      do {
        x = rng() * 2 - 1;
        y = rng() * 2 - 1;
        z = rng() * 2 - 1;
      } while (x * x + y * y + z * z > 1 || y < 0.12);
      const len = Math.hypot(x, y, z);
      positions[i * 3] = (x / len) * SKY_STAR_RADIUS;
      positions[i * 3 + 1] = (y / len) * SKY_STAR_RADIUS;
      positions[i * 3 + 2] = (z / len) * SKY_STAR_RADIUS;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starGeometry = geo;
    return geo;
  }

  /** New world: fresh stars for the seed + cycle restarts at dawn, day 0. */
  setSeed(seed: string): void {
    this.seed = String(seed);
    const old = this.group.children.find(
      (c): c is THREE.Points => c instanceof THREE.Points,
    );
    if (old) {
      this.group.remove(old);
      old.geometry.dispose();
    }
    this.group.add(new THREE.Points(this.buildStarGeometry(), this.starMaterial));
    this.cycleT = 0;
    this.daysElapsed = 0;
  }

  /** Save seam: cycle position + dawn count (month stays an input — see header). */
  snapshot(): SkySnapshot {
    return { cycleT: this.cycleT, daysElapsed: this.daysElapsed };
  }

  /**
   * Save-boot restore: cycle position + dawn count. Wraps
   * into [0,1); call AFTER setSeed (setSeed resets to dawn).
   * The next update() recomputes sun/moon/lights from the
   * restored t — no other state to restore (stars/clouds are
   * seeded, not time). Non-finite input is ignored (cycle
   * keeps its current t). DAWN RULE: when daysElapsed is
   * ABSENT (old saves + the sleep path's { cycleT: 0 }),
   * a BACKWARD jump counts as a dawn (sleep-to-dawn) —
   * boot restores from a fresh rig (t = 0) never jump
   * backward, so they never trigger it. When daysElapsed IS
   * present it wins absolutely (no increment).
   */
  restore(snap: SkySnapshot): void {
    if (!snap || !Number.isFinite(snap.cycleT)) return;
    // Wrap without a +1 round trip: ((t % 1) + 1) % 1 would turn an
    // already-exact in-range t (e.g. 0.42) into 0.41999999999999993
    // via 1.42's inexact double — a save/load round trip must be exact.
    let t = snap.cycleT % 1;
    if (t < 0) t += 1;
    if (Number.isFinite(snap.daysElapsed)) {
      this.daysElapsed = Math.max(0, Math.floor(snap.daysElapsed as number));
    } else if (t < this.cycleT) {
      this.daysElapsed += 1;
    }
    this.cycleT = t;
  }

  update(dt: number, input: SkyUpdateInput): void {
    const month = input.month ?? SEASON_START_MONTH;
    const prevT = this.cycleT;
    this.cycleT = (this.cycleT + dt / (DAY_NIGHT_CYCLE_MINUTES * 60)) % 1;
    // A wrap is a dawn: the phase cycle advances one game-day.
    // (Sleep-to-dawn jumps count via restore()'s dawn rule.)
    if (this.cycleT < prevT) this.daysElapsed += 1;
    const split = cycleSplit(this.cycleT, month);
    const sunElev = sunElevationAtCycle(this.cycleT, month);
    const dayFactor = clamp01((sunElev + 0.05) / 0.3);
    const nightFactor = 1 - dayFactor;
    const clarity = clarityFromRain(input.weather.rain);
    const cover = cloudCoverFromRain(input.weather.rain);

    // Sky group follows the player: the dome reads as infinitely far.
    this.group.position.set(input.playerX, 0, input.playerZ);

    // Dome colors: night ↔ day by sun elevation, sunset tint near the horizon.
    const top = NIGHT_TOP.clone().lerp(DAY_TOP, dayFactor);
    const horizon = NIGHT_HORIZON.clone().lerp(DAY_HORIZON, dayFactor);
    const dusk = clamp01(1 - Math.abs(sunElev) / 0.35);
    horizon.lerp(SUNSET_HORIZON, dusk * 0.7);
    this.domeUniforms.topColor.value.copy(top);
    this.domeUniforms.horizonColor.value.copy(horizon);

    // Sun (day) / moon (night): position, visibility, glow.
    if (split.isDay) {
      const dir = sunDirection(split.dayProgress, month);
      this.sunMesh.position.copy(dir).multiplyScalar(SKY_BODY_RADIUS);
      this.sunMesh.lookAt(this.camera.position);
      this.sunMesh.visible = true;
      this.moonMesh.visible = false;
      this.domeUniforms.sunDirection.value.copy(dir);
      this.domeUniforms.sunGlow.value = 0.6 + 0.4 * Math.sin(Math.PI * split.dayProgress);
      this.domeUniforms.moonGlow.value = 0;
      this.sunLight.position.copy(dir).multiplyScalar(100);
      this.sunLight.color.set(0xd8d0b0);
      this.sunLight.intensity = 0.25 + 0.55 * Math.sin(Math.PI * split.dayProgress);
    } else {
      const dir = moonDirection(split.nightProgress);
      this.moonMesh.position.copy(dir).multiplyScalar(SKY_BODY_RADIUS);
      this.moonMesh.lookAt(this.camera.position);
      this.moonMesh.visible = true;
      this.sunMesh.visible = false;
      // Phase: the disc shader + the light share one phase —
      // per-dawn cycle from the seed base + dawns elapsed.
      const phase = currentMoonPhase(this.seed, this.daysElapsed);
      const terms = moonPhaseTerms(phase);
      const moonUniforms = (this.moonMesh.material as THREE.ShaderMaterial).uniforms;
      moonUniforms.uWaxing.value = terms.waxing ? 1 : 0;
      moonUniforms.uCos.value = terms.cosTheta;
      moonUniforms.uOpacity.value = 0.35 + 0.65 * clarity;
      this.domeUniforms.moonDirection.value.copy(dir);
      // Halo follows the phase too (new moon barely glows).
      this.domeUniforms.moonGlow.value = 0.5 * clarity * (0.2 + 0.8 * terms.illumination);
      this.domeUniforms.sunGlow.value = 0;
      this.sunLight.position.copy(dir).multiplyScalar(100);
      this.sunLight.color.set(0x8a9ac0);
      // MOONLIGHT: full moon at culmination, clear sky, is
      // MOONLIGHT_FULL ("just about see by it"); it scales
      // down with phase, with moon altitude (rise/set give
      // nothing), and through haze (0.35 floor, like the disc).
      // New moon = 0: essentially no moonlight, dark as now.
      const altFactor = clamp01(dir.y / Math.sin((MOON_MAX_ALT_DEG * Math.PI) / 180));
      this.sunLight.intensity =
        MOONLIGHT_FULL * terms.illumination * altFactor * (0.35 + 0.65 * clarity);
    }
    this.hemiLight.intensity = 0.45 + 0.45 * dayFactor;

    // Stars: night only, and only when clear enough.
    this.starMaterial.opacity = nightFactor * clarity * 0.9;

    // Clouds: cover ramps count + shared opacity; drift east with wind, wrap.
    this.cloudMaterial.color.copy(NIGHT_CLOUD).lerp(DAY_CLOUD, dayFactor);
    this.cloudMaterial.opacity = 0.25 + 0.45 * cover;
    for (let i = 0; i < this.clouds.length; i++) {
      const puff = this.clouds[i];
      puff.visible = i / CLOUD_COUNT < cover;
      if (!puff.visible) continue;
      puff.position.x += input.weather.wind * CLOUD_DRIFT_SCALE * dt;
      if (puff.position.x > CLOUD_WRAP) puff.position.x -= CLOUD_WRAP * 2;
    }
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        // Shared cloud geometry disposed once below; guard double-dispose
        // by skipping it here (traverse hits it per puff).
        if (obj.geometry !== this.cloudGeometry) obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
    this.cloudGeometry.dispose();
  }
}
