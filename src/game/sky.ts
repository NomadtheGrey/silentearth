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
 * - MOON PHASE is computed per world (moonPhase(seed)) but NOT
 *   rendered as a crescent yet: with no calendar, a phase cannot
 *   honestly advance, so the disc renders full and the phase
 *   number waits for the calendar. Flagged, not faked.
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

/** Moon phase for a world seed, 0..1 (computed, not yet rendered — see header). */
export function moonPhase(seed: string): number {
  return ((deriveSeed(String(seed), 'moon') % 1000) / 1000 + 1) % 1;
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
export class SkyRig {
  /** Cycle position t ∈ [0,1); 0 = dawn. */
  cycleT = 0;
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
    this.moonMesh = new THREE.Mesh(
      new THREE.CircleGeometry(13, 32),
      new THREE.MeshBasicMaterial({ color: MOON_COLOR, fog: false, transparent: true }),
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

  /** New world: fresh stars for the seed + cycle restarts at dawn. */
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
  }

  update(dt: number, input: SkyUpdateInput): void {
    const month = input.month ?? SEASON_START_MONTH;
    this.cycleT = (this.cycleT + dt / (DAY_NIGHT_CYCLE_MINUTES * 60)) % 1;
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
      (this.moonMesh.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.65 * clarity;
      this.domeUniforms.moonDirection.value.copy(dir);
      this.domeUniforms.moonGlow.value = 0.5 * clarity;
      this.domeUniforms.sunGlow.value = 0;
      this.sunLight.position.copy(dir).multiplyScalar(100);
      this.sunLight.color.set(0x8a9ac0);
      this.sunLight.intensity = 0.15;
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
