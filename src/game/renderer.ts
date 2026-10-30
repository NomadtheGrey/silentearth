/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Three.js scene manager for Silent Earth landing 1: chunk streaming,
 * harvest-source scatter rendering (shapes from src/game/objects.ts),
 * procedural per-biome ground textures, switchable cameras, and a placeholder
 * witch character mesh (capsule + hat — NOT art, a stand-in so the
 * third-person camera has something to follow).
 *
 * Streaming: every frame, chunks within STREAM_RADIUS_CHUNKS of the
 * player's chunk are present; anything farther is disposed. Because chunk
 * contents are pure functions of (seed, cx, cz), streaming never changes
 * the world — it only changes which part is resident.
 *
 * Rendering cost is kept low with InstancedMesh: one instanced mesh per
 * scatter kind per chunk, sharing one geometry + material per kind.
 * Scatter geometry is built in src/game/models.ts (detailed merged
 * procedural models, vertex-colored): composite kinds that used to
 * need a second instanced mesh for their extra primitive now render
 * as ONE merged mesh, so draw calls per chunk stay flat or fall.
 */

import * as THREE from 'three';
import { bus } from './events';
import type { WorldGen } from './worldgen';
import { PlayerController } from './player';
import { marshWeight } from './biomes';
import { SOURCE_FOR_KIND } from './objects';
import { buildAltarGroup, buildAnimal, buildCampArrow, buildCandle, buildCauldronGroup, buildDeskGroup, buildEdgeArrow, buildKindGeometry, buildStagedBone, buildStumpDressing, buildSunflowerHeadGeometry, buildTorch, buildUmbrella, buildWitch, ALTAR_CANDLE_X, ALTAR_CANDLE_Z, CANDLE_FLAME_Y, DISC_RADIUS, STUMP_TOP_Y, sunflowerHeadMatrix, sunflowerHeadOrientation, TORCH_FLAME_Y, vertexLambert } from './models';
import { spawnAnimalsForChunk, updateAnimal } from './animals';
import type { AnimalInstance, AnimalKind } from './animals';
import { crowGlowIntensity, CROW_GLOW_EMISSIVE } from './crow';
import type { CrowTier } from './crow';
import { ProximityTracker } from './proximity';
import {
  harvestState,
  SHRINK_SCALE,
  SAPLING_GROWTH_MS,
  scatterTargetId,
  wrapGenWithState,
} from './harvestState';
import { standingInWater, terrainSpeedAt, type WaterDisc } from './movement';
import { treeKindAt } from './treeKind';
import { riverParamsFor, riverRibbonForChunk } from './river';
import { caveMouthSite, chapelSite, drownedMillSite, farmhouseSite, generalStoreSite, groveSite, schoolhouseSite, villageSite, wallsNearSites, type SiteFootprint } from './sites';
import { caveFootprintFor, caveLayoutFor } from './caves';
import type { RiverParams } from './river';
import { fireState } from './fireState';
import { torchState } from './torchState';
import { altarState } from './altarState';
import { cauldronState } from './cauldronState';
import { deskState } from './deskState';
import { ritualSiteState } from './ritualSite';
import type { PlacedHouse, TentPosition } from './shelter';
import { FIRE_DEFS } from './fire';
import { shelterState, HOUSE_DEFS } from './shelter';
import { loomState } from './loomState';
import { pileState } from './pileState';
import { trapState } from './trapState';
import { stumpState } from './stumpState';
import type { TrapType } from './traps';
import { pauseState } from './pause';
import { SkyRig } from './sky';
import type { SkySnapshot } from './sky';
import { SEASON_START_MONTH, seasonalWeatherAt } from './weather';
import { createBiomeTexture, TEXTURE_REPEAT } from './terrain';
import {
  CHUNK_SIZE,
  GROUND_SEGMENTS,
  STREAM_RADIUS_CHUNKS,
  PLAYER_EYE_HEIGHT,
  THIRD_PERSON_OFFSET,
  BEHIND_CAMERA_DISTANCE,
  BEHIND_CAMERA_HEIGHT,
  BEHIND_LOOK_AHEAD,
  BEHIND_LOOK_HEIGHT,
} from '../constants';
import type { BiomeId, ScatterKind } from '../types';

interface KindRender {
  /**
   * Shared merged geometry (baked orientation: logs lie along X,
   * discs lie flat; former extra primitives — canopy, stump top,
   * seed-head — are merged in at (extraY - baseY), so the old
   * `obj.y + baseY * s` placement still lands them correctly).
   */
  geometry: THREE.BufferGeometry;
  /** Shared vertex-colored material (white; geometry carries color). */
  material: THREE.Material;
  /** Base height of the instance above ground (before scatter y). */
  baseY: number;
}

/**
 * The registered sites for a world generator (sites.ts): the
 * Grove + the Schoolhouse + the Burnt Village. All three
 * derivations are memoized pure functions of the seed, so
 * this is cheap to recompute on world change; the wall
 * query reads the list, and the smoke system reads the
 * village's anchor off the same derivation.
 */
function computeSites(gen: WorldGen): SiteFootprint[] {
  // A non-surface dimension's only "site" is its own
  // layout footprint (the cave's chambers); the surface
  // registry never derives underground.
  if (gen.dimensionKey) return [caveFootprintFor(String(gen.seed))];
  const spawn = gen.findSpawn();
  return [
    groveSite(String(gen.seed), spawn, (x, z) => gen.weightsAt(x, z).dominant),
    schoolhouseSite(String(gen.seed), spawn, (x, z) => gen.weightsAt(x, z)),
    villageSite(String(gen.seed), spawn, (x, z) => gen.weightsAt(x, z)),
    farmhouseSite(String(gen.seed), spawn, (x, z) => gen.weightsAt(x, z)),
    chapelSite(String(gen.seed), spawn, (x, z) => gen.weightsAt(x, z)),
    caveMouthSite(String(gen.seed), spawn, (x, z) => gen.weightsAt(x, z)),
    generalStoreSite(String(gen.seed), spawn, (x, z) => gen.weightsAt(x, z)),
    drownedMillSite(String(gen.seed), spawn, (x, z) => gen.weightsAt(x, z)),
  ];
}

/**
 * THE SMOKE COLUMN (Adam's avenue — DEV-ruled option (a),
 * 2026-10-30): the Burnt Village's pull is SEEING its smoke
 * from a hefty distance, so the column is a stack of soft
 * billboards on a fog-EXEMPT material (the camp-arrow
 * precedent — FogExp2 at 0.008 would leave ~2% of a fogged
 * material at 500 m). One shared radial-gradient texture,
 * one material per sprite (their opacities differ), the
 * rise looped in the render loop off flameTime so pause
 * freezes it with the flames. All numbers DRAFT.
 */
const SMOKE_SPRITE_COUNT = 11;
const SMOKE_HEIGHT_M = 45;
const SMOKE_RISE_PERIOD_S = 26;
const SMOKE_PEAK_OPACITY = 0.3;

let smokeTextureCache: THREE.Texture | null = null;
function smokeTexture(): THREE.Texture {
  if (smokeTextureCache) return smokeTextureCache;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.38)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  smokeTextureCache = new THREE.CanvasTexture(canvas);
  return smokeTextureCache;
}

/**
 * The water discs (ponds + standing-water pools) in the 3x3
 * chunks around (x, z), as wading-test circles — radius is the
 * disc the renderer draws (DISC_RADIUS x instance scale), the
 * same ground truth waterProximity.ts reads for ponds. The
 * caller memoizes by chunk; generateChunk is pure, so the set
 * is exact for the neighborhood.
 */
function collectWaterDiscs(gen: WorldGen, x: number, z: number): WaterDisc[] {
  const discs: WaterDisc[] = [];
  const pcx = Math.floor(x / CHUNK_SIZE);
  const pcz = Math.floor(z / CHUNK_SIZE);
  for (let cx = pcx - 1; cx <= pcx + 1; cx++) {
    for (let cz = pcz - 1; cz <= pcz + 1; cz++) {
      for (const obj of gen.generateChunk(cx, cz).objects) {
        if (obj.kind !== 'pond' && obj.kind !== 'standingWater') continue;
        discs.push({ x: obj.x, z: obj.z, r: (DISC_RADIUS[obj.kind] ?? 1.0) * obj.scale });
      }
    }
  }
  return discs;
}

function lambert(color: number, opacity = 1): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ color });
  if (opacity < 1) {
    mat.transparent = true;
    mat.opacity = opacity;
  }
  return mat;
}

/**
 * Unlit campfire height (Adam 2026-10-27 — "a pile of sticks
 * would be fine"): the old campfire topped out at ~0.32 m (flat
 * crossed logs), which read as nothing on a phone screen from
 * overhead or first-person. The pile now rises to this height
 * so the unlit fire reads at a glance. The lit flame's base
 * sits just under it (see the campfire branch in
 * rebuildPlacedGroup).
 */
export const CAMPFIRE_PILE_TOP_Y = 0.85;

/** Stick colors for the tipi pile (warm browns, varied). */
const CAMPFIRE_STICK_COLORS = [0x6b4a2f, 0x7a5a35, 0x5a4028];

/**
 * The unlit campfire mesh: stone ring + ash bed + crossed base
 * logs + a tipi pile of six sticks leaning to CAMPFIRE_PILE_TOP_Y.
 * Exported (not a rebuildPlacedGroup local) so a headless probe
 * can measure it: 16 meshes, ~1.3 m wide, 0.85 m tall.
 * Deterministic — no randomness, fixed angles and colors.
 */
export function buildCampfireGroup(): THREE.Group {
  const g = new THREE.Group();
  // Stone ring (7 stones) + ash bed, unchanged from the old fire.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), lambert(0x8a8a86));
    stone.position.set(Math.cos(a) * 0.55, 0.09, Math.sin(a) * 0.55);
    stone.rotation.y = a;
    g.add(stone);
  }
  const ash = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), lambert(0x2b2b2b));
  ash.position.set(0, 0.03, 0);
  g.add(ash);
  // Crossed base logs — the pile's foot.
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), lambert(0x6b4a2f));
  base1.position.set(0, 0.12, 0);
  base1.rotation.z = Math.PI / 2;
  base1.rotation.y = 0.5;
  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8), lambert(0x6b4a2f));
  base2.position.set(0, 0.12, 0);
  base2.rotation.z = Math.PI / 2;
  base2.rotation.y = -0.5;
  g.add(base1, base2);
  // Tipi pile: six sticks leaning from the ring to the apex.
  const up = new THREE.Vector3(0, 1, 0);
  const apex = new THREE.Vector3(0, CAMPFIRE_PILE_TOP_Y, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const base = new THREE.Vector3(Math.cos(a) * 0.42, 0.05, Math.sin(a) * 0.42);
    const dir = apex.clone().sub(base);
    const len = dir.length();
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.055, len, 6),
      lambert(CAMPFIRE_STICK_COLORS[i % CAMPFIRE_STICK_COLORS.length]),
    );
    stick.position.copy(base).addScaledVector(dir, 0.5);
    stick.quaternion.setFromUnitVectors(up, dir.normalize());
    g.add(stick);
  }
  return g;
}

/** One shared geometry per mesh shape, built from the source descriptors
 *  in src/game/objects.ts (fill-in landing, 2026-10-25). Landing 1's
 *  placeholder primitives are replaced by these: distinct silhouettes
 *  per source (stump, reed, bog tuft, oak log, ...) with source colors. */
/** Render table derived from the harvest-source definitions, so mesh and
 *  data can never drift apart: change a source color in objects.ts
 *  and its detailed model follows (models.ts builds from those
 *  colors). One merged geometry + vertex-colored material per kind,
 *  shared by all instances — the InstancedMesh perf model is
 *  unchanged, and former extra primitives now ride inside the one
 *  geometry instead of a second instanced mesh. */
const KIND_RENDER: Record<ScatterKind, KindRender> = (() => {
  const table = {} as Record<ScatterKind, KindRender>;
  for (const [kind, source] of Object.entries(SOURCE_FOR_KIND) as [
    ScatterKind,
    (typeof SOURCE_FOR_KIND)[ScatterKind],
  ][]) {
    table[kind] = {
      geometry: buildKindGeometry(source.mesh, kind),
      material: vertexLambert(kind === 'standingWater' || kind === 'pond' ? 0.75 : 1),
      baseY: source.mesh.baseY,
    };
  }
  return table;
})();

/** Tall-sunflower head geometry, built once and shared by every
 *  chunk's head InstancedMesh (the KIND_RENDER perf model). */
let sunflowerHeadGeometryCache: THREE.BufferGeometry | null = null;
function sunflowerHeadGeometry(): THREE.BufferGeometry {
  sunflowerHeadGeometryCache ??= buildSunflowerHeadGeometry(SOURCE_FOR_KIND.sunflower.mesh);
  return sunflowerHeadGeometryCache;
}

/** Shared river water material (one band, translucent like standing water). */
const RIVER_MATERIAL = new THREE.MeshLambertMaterial({
  color: 0x35708c,
  transparent: true,
  opacity: 0.75,
  side: THREE.DoubleSide,
});

interface LoadedChunk {
  group: THREE.Group;
  meshes: THREE.InstancedMesh[];
  ground: THREE.Mesh;
  river: THREE.Mesh | null;
  /** Ambient animals: instance state (animals.ts) + its group. */
  animals: { instance: AnimalInstance; group: THREE.Group }[];
  /**
   * Tall-sunflower heads (Adam, 2026-10-29): a second InstancedMesh
   * carrying only the pivot heads, re-aimed at the sun on the world
   * tick (see aimSunflowerHeads). The mesh also sits in `meshes`,
   * so unload disposal is the ordinary path, and this record is
   * the whole registry — it dies with the chunk.
   */
  sunflowerHeads: {
    mesh: THREE.InstancedMesh;
    objs: { kind: string; x: number; y: number; z: number; scale: number; rotY: number }[];
    cx: number;
    cz: number;
  } | null;
}

/**
 * Carried-candle light tunables (Adam 2026-10-26 — lane-decided
 * starting values for his pin pass; three 0.186 uses physical
 * point-light units, so intensity reads in candela with decay 2.
 * RAISED 2026-10-27 (Adam: "fairly useless now" — the starting
 * light goes up until genuinely useful): ~7.5 at 2 m, ~1.9 at
 * 4 m, ~0.8 at 6 m — a real working pool around her, not a hint.
 * Headroom reserved for the torch (Adam 2026-10-27: torch stays
 * brighter — well-lit at 6 m, dim to ≥12 m — so the candle stops
 * here; the torch profile is tuned above these numbers when its
 * item lands). Always lit, both views.
 */
export const CANDLE_LIGHT_COLOR = 0xffb45e;
export const CANDLE_LIGHT_INTENSITY = 30;
export const CANDLE_LIGHT_DISTANCE = 22;
export const CANDLE_LIGHT_DECAY = 2;
export const CANDLE_FLICKER_AMPLITUDE = 0.12;
/**
 * Carried-torch light tunables (Adam 2026-10-27 — Systems torch
 * item + batch lighting landed first; torch profile pinned:
 * well-lit at 6 m, dim to ≥12 m, brighter than the candle
 * overall — against the MOVED candle bar 30/22, not the old
 * 10/16). Intensity 80, distance 30, decay 2: ~2.2 at 6 m (vs
 * candle ~0.8 — well-lit, ~2.7×), ~0.6 at 12 m (dim but
 * present), cutoff 30 > candle 22. Flicker ±15%: a torch
 * flame dances more than a candle's ±12%, less than a
 * campfire's ±22%. Flagged for pin pass.
 */
export const TORCH_LIGHT_COLOR = 0xffa050;
export const TORCH_LIGHT_INTENSITY = 80;
export const TORCH_LIGHT_DISTANCE = 30;
export const TORCH_LIGHT_DECAY = 2;
export const TORCH_FLICKER_AMPLITUDE = 0.15;
/**
 * Placed-fire light tunables (Adam 2026-10-26 — lane-decided
 * starting values for his pin pass; same physical units as the
 * candle: a lit fire is a camp light, stronger and wider than
 * the candle's hand pool. One PointLight per lit fire with
 * flameWhenLit; unlit fires cast nothing. Flicker is stronger
 * than the candle's (±22% vs ±12%) — fires dance more.
 */
export const FIRE_LIGHT_COLOR = 0xff9a40;
export const FIRE_LIGHT_INTENSITY = 40;
export const FIRE_LIGHT_DISTANCE = 24;
export const FIRE_LIGHT_DECAY = 2;
export const FIRE_LIGHT_FLICKER_AMPLITUDE = 0.22;
/** Flame color-breathing endpoints (outer cone deep-orange ↔ bright gold). */
const FLAME_OUTER_A = new THREE.Color(0xff6a00);
const FLAME_OUTER_B = new THREE.Color(0xffb020);
/** Flame color-breathing endpoints (inner core yellow ↔ pale gold). */
const FLAME_INNER_A = new THREE.Color(0xffd23f);
const FLAME_INNER_B = new THREE.Color(0xfff0a0);
/**
 * Position-hash phase for a flame or fire light at (x, z) — the
 * same hash flame meshes use, so a fire's light flickers in
 * phase with its flame. Pure and deterministic.
 */
export function flamePhase(x: number, z: number): number {
  return Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * Math.PI * 2;
}
/**
 * Mixed-sine flicker factor in [-1, 1] for a fire light (the
 * candle's mixed sines, phase-shifted per fire so fires don't
 * sync). Pure and deterministic.
 */
export function fireLightFlicker(flameTime: number, phase: number): number {
  return (Math.sin(flameTime * 10 + phase) + Math.sin(flameTime * 23 + phase + 1.7)) / 2;
}
/**
 * Camp-arrow center height above a house: tip at 4.1 m (clears
 * every house roof) and top at 9.1 m — BIG, as Adam ordered.
 * Bob amplitude (metres, on flameTime — catches the eye).
 * Screen-edge arrow depth in front of the camera (camera
 * space) + NDC clamp (arrows sit just inside the frame).
 */
export const CAMP_ARROW_CENTER_Y = 7.5;
export const CAMP_ARROW_BOB = 0.5;
export const CAMP_EDGE_DEPTH = 8;
/** Base exponential fog density (the woods' murk, lane-decided). */
export const FOG_DENSITY = 0.008;
/** Cave fog (dimensions, 2026-10-30): thick and near, so
 *  the dark closes in a few chambers out. */
export const CAVE_FOG_DENSITY = 0.05;
/** Twilight-fungus light profile (dimensions): a dim,
 *  cool glow — intensity/distance/decay. */
export const FUNGUS_LIGHT_COLOR = 0x9fd8c8;
export const FUNGUS_LIGHT_INTENSITY = 12;
export const FUNGUS_LIGHT_DISTANCE = 9;
export const FUNGUS_LIGHT_DECAY = 2;
/**
 * Bat wing bone — night way-finding (tier-1 charm, DRAFT
 * flagged): fog density factor at full night while carried
 * + awakened (0.008 → 0.0056). Scaled by nightFactor in
 * the loop, so twilight thins partially, full night fully.
 */
export const BAT_FOG_FACTOR = 0.7;
export const CAMP_EDGE_CLAMP = 0.88;

/**
 * Screen-edge arrow placement for an off-screen camp (pure,
 * probed). Input: the camp anchor's NDC (x, y) + whether it
 * is behind the camera. Behind camps flip (project() mirrors
 * behind-camera points) and are forced off-screen: a behind
 * camp is never "in view", and its flipped NDC is pushed past
 * the edge so the arrow lands on the frame pointing the turn
 * direction instead of mid-screen. Returns the clamped edge
 * position + the screen-space angle the arrow must point
 * (rotation.z for a +Y arrow) + whether the camp is off-screen.
 */
export function edgeArrowTransform(ndcX: number, ndcY: number, behind: boolean): { x: number; y: number; angle: number; offScreen: boolean } {
  let x = ndcX;
  let y = ndcY;
  if (behind) {
    x = -x;
    y = -y;
    const m = Math.max(Math.abs(x), Math.abs(y));
    if (m > 0 && m < 1.2) { x = (x / m) * 1.2; y = (y / m) * 1.2; }
    else if (m === 0) { x = 0; y = 1.2; }
  }
  const offScreen = behind || Math.abs(x) > 1 || Math.abs(y) > 1;
  const cx = Math.max(-CAMP_EDGE_CLAMP, Math.min(CAMP_EDGE_CLAMP, x));
  const cy = Math.max(-CAMP_EDGE_CLAMP, Math.min(CAMP_EDGE_CLAMP, y));
  const dx = x - cx;
  const dy = y - cy;
  const angle = dx === 0 && dy === 0 ? 0 : Math.atan2(-dx, dy);
  return { x: cx, y: cy, angle, offScreen };
}

/** Witch-local hand position of the candle group (left hand). */
export const CANDLE_HAND: Readonly<{ x: number; y: number; z: number }> = {
  x: -0.55,
  y: 1.02,
  z: 0.05,
};
/**
 * Witch-local hand position of the torch group — the SAME left
 * hand as the candle, by design: one light hand, and the torch
 * supersedes the candle in it while a lit torch is carried
 * (light replaces light, not rain-cover — the umbrella keeps
 * the right hand throughout).
 */
export const TORCH_HAND: Readonly<{ x: number; y: number; z: number }> = {
  x: -0.55,
  y: 1.02,
  z: 0.05,
};
/**
 * How far a placed torch's stick sinks into the ground (the
 * planting look, my call, flagged): the stick base sits 5 cm
 * under the surface, so a placed torch reads as stuck in the
 * ground, not floating on it. The placed light sits at
 * TORCH_FLAME_Y - PLACED_TORCH_SINK.
 */
export const PLACED_TORCH_SINK = 0.05;

/**
 * Rotate a witch-local (x, z) offset by a Y-rotation (facing)
 * into world space: the same transform the witch group's
 * rotation.y applies (local +z maps to (sin facing, cos facing)
 * — see the behind-camera comment in the loop). Pure, probed.
 */
export function rotateOffsetY(lx: number, lz: number, facing: number): [number, number] {
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  return [lx * c + lz * s, -lx * s + lz * c];
}

export class WorldRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private chunks = new Map<string, LoadedChunk>();
  /** River course for the current world (seed + spawn); null until set. */
  private riverParams: RiverParams | null = null;
  /** The registered sites for the current world (sites.ts —
   *  pure functions of the seed, recomputed beside the river on
   *  world change): the Grove + the Schoolhouse today. */
  private sites: SiteFootprint[] = [];
  private witch: THREE.Group;
  /** Carried umbrella graphic (models.ts), attached to the witch. */
  private umbrella: THREE.Group;
  /** Carried-candle graphic (models.ts), attached to the witch. */
  private candle: THREE.Group;
  /** Carried-candle point light (scene-level — see below). */
  private candleLight: THREE.PointLight;
  /** Carried-torch graphic (models.ts), attached to the witch. */
  private torch: THREE.Group;
  /** Carried-torch point light (scene-level, like the candle's). */
  private torchLight: THREE.PointLight;
  /** True while a lit torch is carried (shell-driven setter). */
  private carriesLitTorch = false;
  /** Placed-fire point lights (scene-level, rebuilt with the placed group). */
  private fireLights: THREE.PointLight[] = [];
  /** Placed-torch point lights (scene-level, rebuilt with the placed group). */
  private torchLights: THREE.PointLight[] = [];
  /** Altar-candle point lights (scene-level, rebuilt with the placed group). */
  private altarCandleLights: THREE.PointLight[] = [];
  /** Twilight-fungus point lights (scene-level; exist only
   *  while the cave dimension is active — dimensions,
   *  2026-10-30). */
  private fungusLights: THREE.PointLight[] = [];
  /** The village smoke column (scene-level billboards, rebuilt on world change). */
  private smokeGroup: THREE.Group | null = null;
  private smokeSprites: THREE.Sprite[] = [];
  /** Camp-arrow world group (one downward arrow per placed house). */
  private campArrowGroup: THREE.Group | null = null;
  /** Camp-arrow screen-edge arrows (camera children, one per placed house). */
  private campEdgeArrows: { mesh: THREE.Group; house: PlacedHouse }[] = [];
  /** True while a water scry has revealed the camp arrows (shell-driven setter). */
  private campArrowsVisible = false;
  /** Tent positions for the placed group (shell-driven via setTents — no game tent state exists; camping state is systems-side). */
  private tents: TentPosition[] = [];
  /** Pigeon wing bone — way-home sense (tier-1 charm): arrows show without water while carried + awakened. */
  private pigeonWayHome = false;
  /** Bat wing bone — night way-finding (tier-1 charm): fog thins at night while carried + awakened. */
  private batNightWayfinding = false;
  /** Crow beak — pile glow tier (Systems owns the tier fact; this setter only reads it). Default 0 = base slight memory-glow, no arrows. */
  private crowTier: CrowTier = 0;
  /** Scratch vectors for the per-frame edge-arrow update (no per-frame allocation). */
  private edgeAnchor = new THREE.Vector3();
  private edgeToCamp = new THREE.Vector3();
  private edgeForward = new THREE.Vector3();
  private gen: WorldGen;
  private player: PlayerController;
  /** Proximity tracker: engine-owned, subscribes to 'player:moved' and
   *  emits 'harvest:inRange' for the UI lane's harvest buttons. It is
   *  mechanics, not presentation — the renderer only hosts it so no
   *  App.tsx wiring (and no claim) is needed to get it running. */
  private proximity: ProximityTracker;
  /** Unsubscribe for the harvest:completed chunk reload (below). */
  private unsubHarvestCompleted: (() => void) | null = null;
  /** Spawned-object meshes (spawned logs + growing saplings):
   *  rebuilt on every world tick, only for loaded chunks. */
  private spawnedGroup: THREE.Group | null = null;
  /**
   * Player-placed meshes (fires + houses): rebuilt on placement
   * and lighting events, NOT chunk-filtered — placed entities
   * are few and free-placed anywhere, so they all render.
   * Flame meshes carry userData.flame + userData.phase and pulse
   * in the loop (see flameTime).
   */
  private placedGroup: THREE.Group | null = null;
  /** Unsubscribes for the placed-group rebuild events (below). */
  private unsubPlaced: (() => void)[] = [];
  /**
   * Dropped-pile meshes (harvest overflow, Adam 2026-10-26): one
   * small heap + marker flag per pile, NOT chunk-filtered — piles
   * are few, and a pile must stay visible wherever it lies. Shares
   * the placed-group unsubscribe list (same dispose path).
   */
  private pileGroup: THREE.Group | null = null;
  /** Placed-trap markers, rebuilt on 'trap:placed' (below). */
  private trapGroup: THREE.Group | null = null;
  /**
   * Staged-bone meshes (Adam 2026-10-27 — tier-1 Waking,
   * site side): one pale bone per staged site, NOT
   * chunk-filtered — a staged bone must stay visible
   * wherever it lies. Own lifecycle (staging events +
   * constructor + setWorldGen clear), separate from the
   * placed group: staging is rarer than placement, and
   * the two rebuild for different reasons.
   */
  private stagedBoneGroup: THREE.Group | null = null;
  /**
   * Sky rig (Adam 2026-10-26): dome + sun + moon + stars + clouds
   * + the lights they drive. Owns the day/night time driver (see
   * sky.ts) — the renderer just feeds it dt + seasonal weather.
   */
  private sky: SkyRig | null = null;
  /** Stored so the sky rig can drive them (were anonymous before). */
  private sunLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  /** Accumulated time for flame flicker (loop-driven). */
  private flameTime = 0;
  private worldTickAcc = 0;
  private disposed = false;
  /** One shared procedural ground texture per biome (+ marsh), built from
   *  the current world seed. Cached, never per-chunk, so texture cost
   *  stays flat no matter how many chunks stream in. */
  private groundTextures = new Map<string, THREE.DataTexture>();

  constructor(
    container: HTMLElement,
    gen: WorldGen,
    player: PlayerController,
  ) {
    // Harvest-state filtering lives on the generator the renderer
    // (and its proximity tracker) actually use: permanently-removed
    // objects (remove action, taken logs) and felled trees leave
    // freshly generated chunks, so they stop rendering AND stop
    // appearing as targets, while felled stumps are appended. Shrunk
    // objects are NOT filtered — they render at SHRINK_SCALE (see
    // loadChunk). The outcome listener (shell-owned, see
    // harvest.ts) marks state in the shared harvestState.
    this.gen = wrapGenWithState(gen);
    // The river course is a pure function of seed + spawn, so it
    // is computed once per world (here and in setWorldGen) rather
    // than per chunk.
    this.riverParams = riverParamsFor(String(gen.seed), gen.findSpawn());
    this.player = player;
    // Terrain slow wiring (Adam, 2026-10-26, PINNED): the
    // renderer owns both the generator and the player, so it
    // wires the terrain query itself — no App.tsx change needed.
    // The closure reads this.gen dynamically, so seed changes
    // (setWorldGen) flow through without re-wiring. The wrapped
    // generator delegates fieldsAt/weightsAt untouched, so the
    // slow reads true world data, not harvest state.
    this.player.setTerrainSpeedQuery((x, z) => terrainSpeedAt(this.gen, x, z));
    // Water query (ground resistance, 2026-10-30): the wading
    // half of the terrain story, wired beside the terrain query.
    // The pond / standing-water discs around her chunk are
    // memoized by chunk (generateChunk is pure; the set rebuilds
    // at most once per chunk crossing, never per frame) and the
    // river reads this.riverParams dynamically, so world changes
    // flow through without re-wiring. The composition itself —
    // wading floors the boots-mitigated terrain factor — lives
    // in player.ts + movement.ts (applyWading).
    {
      let discMemoKey = '';
      let discMemo: WaterDisc[] = [];
      this.player.setWaterQuery((x, z) => {
        const key = `${Math.floor(x / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}`;
        if (key !== discMemoKey) {
          discMemoKey = key;
          discMemo = collectWaterDiscs(this.gen, x, z);
        }
        return standingInWater(this.riverParams, discMemo, x, z);
      });
    }
    // Site walls (sites landing, 2026-10-30; generalized to the
    // registered sites with the Schoolhouse): the renderer owns
    // the generator and the player, so it wires the sites'
    // collision itself, same as the terrain query. The closure
    // reads this.sites dynamically, so world changes (setWorldGen
    // recomputes it) flow through without re-wiring. Away from
    // every site the query returns null and movement pays one
    // bounds test per site.
    this.sites = computeSites(gen);
    this.rebuildSmoke(gen);
    this.player.setSiteWallsQuery((x, z) => wallsNearSites(this.sites, x, z, 2));
    this.proximity = new ProximityTracker(this.gen, true, () => this.tents);
    // Chunk reload on harvest completion: the harvested chunk is
    // rebuilt, so the object visibly shrinks (or leaves, on remove
    // or a taken log) instead of lingering until the player walks
    // away and the chunk streams out.
    this.unsubHarvestCompleted = bus.on('harvest:completed', (p) => {
      if (p.kind !== 'scatter') return;
      const key = this.chunkKey(p.cx, p.cz);
      if (!this.chunks.has(key)) return;
      this.unloadChunk(p.cx, p.cz);
      this.loadChunk(p.cx, p.cz);
    });
    // Placed-group rebuild on placement + lighting: a new fire,
    // house, or loom appears, and a lit fire gains its flame.
    // Lighting PROGRESS needs no rebuild (only lit state
    // changes meshes).
    const rebuild = (): void => this.rebuildPlacedGroup();
    this.unsubPlaced.push(
      bus.on('fire:placed', rebuild),
      bus.on('fire:lit', rebuild),
      bus.on('shelter:placed', rebuild),
      bus.on('shelter:upgraded', rebuild),
      bus.on('loom:placed', rebuild),
      bus.on('torch:placed', rebuild),
      bus.on('torch:removed', rebuild),
      bus.on('altar:placed', rebuild),
      bus.on('altar:removed', rebuild),
      bus.on('desk:placed', rebuild),
      bus.on('desk:removed', rebuild),
      bus.on('cauldron:placed', rebuild),
      bus.on('cauldron:removed', rebuild),
      bus.on('stump:upgraded', rebuild),
      bus.on('stump:altar-stepped', rebuild),
    );
    // Staged bones rebuild on staging events only (separate
    // group, separate lifecycle — see the field comment).
    const rebuildStaged = (): void => this.rebuildStagedBones();
    this.unsubPlaced.push(
      bus.on('ritual:staged', rebuildStaged),
      bus.on('ritual:unstaged', rebuildStaged),
    );
    this.rebuildStagedBones();
    this.rebuildPlacedGroup();
    // Camp arrows rebuild on house placement (houses restore
    // by re-placing, which emits shelter:placed — no silent
    // restore path to miss) + once here for restored houses
    // placed before construction.
    const rebuildCamps = (): void => this.rebuildCampArrows();
    this.unsubPlaced.push(bus.on('shelter:placed', rebuildCamps));
    this.rebuildCampArrows();
    // Dropped piles rebuild on their own events (a pile dropped
    // at her feet must appear without a chunk reload).
    const rebuildPiles = (): void => this.rebuildPileGroup();
    this.unsubPlaced.push(
      bus.on('pile:dropped', rebuildPiles),
      bus.on('pile:changed', rebuildPiles),
      bus.on('pile:removed', rebuildPiles),
    );
    this.rebuildPileGroup();
    // Placed traps rebuild on their own event, like piles.
    const rebuildTraps = (): void => this.rebuildTrapGroup();
    this.unsubPlaced.push(bus.on('trap:placed', rebuildTraps));
    this.rebuildTrapGroup();
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    // The camera joins the scene graph so its children render:
    // screen-edge camp arrows are camera children (HUD-like,
    // always in front). The camera itself is never drawn.
    this.scene.add(this.camera);

    // Dim October light: the woods are watching, not sunbathing.
    this.scene.fog = new THREE.FogExp2(0x1a2018, FOG_DENSITY);
    this.scene.background = new THREE.Color(0x1a2018);
    this.hemiLight = new THREE.HemisphereLight(0x9aa88a, 0x2a2018, 0.9);
    this.scene.add(this.hemiLight);
    this.sunLight = new THREE.DirectionalLight(0xd8d0b0, 0.8);
    this.sunLight.position.set(40, 60, 20);
    this.scene.add(this.sunLight);
    // Sky with content (Adam 2026-10-26): replaces the flat
    // background color as the visible sky (the background color
    // stays only as a fallback behind the dome). The rig drives
    // these same lights from the sun/moon, so light follows the
    // bodies by construction.
    this.sky = new SkyRig(this.scene, this.camera, this.sunLight, this.hemiLight, String(gen.seed));

    // The witch herself: detailed procedural figure (dress, bodice,
    // shawl, head, brimmed hat, arms, boots — models.ts), still
    // placeholder-grade-plus, NOT final art. Visible in
    // third-person, hidden in first-person (you are the witch there).
    this.witch = buildWitch();
    this.scene.add(this.witch);
    // Carried umbrella (Adam 2026-10-26): held in her right hand,
    // canopy beside the hat, slight outward tilt. Attached to the
    // witch group, so it inherits third-person-only visibility
    // (hidden in first-person, where you are the witch). Default
    // hidden — the shell drives it via setCarriesUmbrella (below).
    this.umbrella = buildUmbrella();
    this.umbrella.visible = false;
    this.umbrella.position.set(0.58, 1.08, 0.05);
    this.umbrella.rotation.z = -0.12;
    this.witch.add(this.umbrella);
    // Carried candle (Adam 2026-10-26 — light settled, starter
    // still open): model in her left hand (umbrella holds the
    // right), witch-group child, so third-person-only visibility
    // is free — hidden in first-person, where you are the witch.
    // The LIGHT is scene-level, not a witch child: a child of an
    // invisible group renders nothing, and first-person needs
    // the light even though the model is hidden. Always lit —
    // no day/night gate invented, no setter (unconditional: no
    // item, toggle, or inventory state drives it).
    const candle = buildCandle();
    candle.position.set(CANDLE_HAND.x, CANDLE_HAND.y, CANDLE_HAND.z);
    this.witch.add(candle);
    this.candle = candle;
    this.candleLight = new THREE.PointLight(
      CANDLE_LIGHT_COLOR,
      CANDLE_LIGHT_INTENSITY,
      CANDLE_LIGHT_DISTANCE,
      CANDLE_LIGHT_DECAY,
    );
    this.scene.add(this.candleLight);
    // Carried lit-torch (Adam 2026-10-27 — Systems item
    // 'lit-torch' landed first): model in the SAME left hand
    // as the candle (the light hand), witch-group child, so
    // third-person-only visibility is free. Default hidden —
    // the shell drives it via setCarriesLitTorch (below).
    // While carried, the torch SUPERSEDES the candle: one
    // hand light at a time — torch model + light on, candle
    // model + light off. The umbrella (right hand) is
    // untouched: light and rain-cover coexist.
    this.torch = buildTorch();
    this.torch.visible = false;
    this.torch.position.set(TORCH_HAND.x, TORCH_HAND.y, TORCH_HAND.z);
    this.witch.add(this.torch);
    this.torchLight = new THREE.PointLight(
      TORCH_LIGHT_COLOR,
      TORCH_LIGHT_INTENSITY,
      TORCH_LIGHT_DISTANCE,
      TORCH_LIGHT_DECAY,
    );
    this.scene.add(this.torchLight);

    window.addEventListener('resize', this.onResize);
    this.loop();
  }

  /**
   * Carried-umbrella visibility (Adam 2026-10-26). The shell calls
   * this when the inventory changes, passing Systems'
   * carriesUmbrella(inventory): the graphic shows exactly when an
   * umbrella is carried — no equip step, and duplicates do not
   * stack, so the shell passes a plain boolean and one graphic is
   * all there ever is. App-side driving is UI's follow-up; until
   * the shell calls this, the umbrella stays hidden (default).
   */
  setCarriesUmbrella(carried: boolean): void {
    if (this.umbrella) this.umbrella.visible = carried;
  }

  /**
   * Carried-lit-torch visibility + hand-light supersede (Adam
   * 2026-10-27). The shell calls this when the inventory
   * changes, passing whether a 'lit-torch' is carried
   * (inventory.count(ITEMS.litTorch) > 0): the torch graphic
   * shows exactly when a lit torch is carried, and while it
   * does, the candle model + light hide — one hand light at
   * a time, torch over candle. App-side driving is UI's
   * follow-up; until the shell calls this, the torch stays
   * hidden and the candle carries the light (default).
   */
  setCarriesLitTorch(carried: boolean): void {
    this.carriesLitTorch = carried;
    if (this.torch) this.torch.visible = carried;
    if (this.candle) this.candle.visible = !carried;
  }

  /**
   * Camp-arrow visibility (Adam 2026-10-27 — water scrying
   * reveals the arrows; SCRY BUTTON RULING, superseding the
   * no-button amendment: approach still water → Scry button
   * appears → press → arrows). The shell (Systems'
   * CampDivination state via App/UI) calls this on Scry press
   * (true) and on arrival/dismiss (false); default hidden —
   * arrows are the scry reward, not a permanent HUD. Reveal
   * persists until arrival or dismiss per Systems' state —
   * this setter only follows the shell, it holds whatever it
   * was last told until called again. The button itself is
   * UI's build, not this setter's.
   */
  setCampArrowsVisible(visible: boolean): void {
    this.campArrowsVisible = visible;
    this.refreshArrowVisibility();
  }

  /**
   * Set the tent list for the placed group (shell-driven: the
   * shell maps Systems' tents to TentPosition {x, z} and calls
   * this on place / pickup / boot restore). Rebuilds the placed
   * group immediately, and nudges the proximity tracker so the
   * shelter signal updates at once — placing a tent at her feet
   * must shelter her without waiting for her next step (the
   * house path's direct-recompute precedent). No bus event:
   * pickup needs no event, the rebuild + recompute carry it.
   * No heading: tents face +Z.
   */
  setTents(positions: TentPosition[]): void {
    this.tents = [...positions];
    this.rebuildPlacedGroup();
    this.proximity.recompute();
  }

  /**
   * Camp arrows show while scry OR pigeon holds (pigeon wing
   * bone — way-home sense, tier-1 charm: the same arrows,
   * ungated by water, while carried + awakened). The shell
   * drives both setters; either one showing keeps the
   * arrows up — so a scry dismiss (arrival) does NOT hide
   * pigeon arrows. Whether arrival should dismiss pigeon
   * arrows too is the shell/UI's call (always-on vs
   * dismiss-on-arrival), not this condition's.
   */
  private arrowsVisible(): boolean {
    return this.campArrowsVisible || this.pigeonWayHome;
  }

  /** Refresh world + edge arrow visibility from the OR condition above. */
  private refreshArrowVisibility(): void {
    const show = this.arrowsVisible();
    if (this.campArrowGroup) this.campArrowGroup.visible = show;
    if (!show) for (const edge of this.campEdgeArrows) edge.mesh.visible = false;
  }

  /**
   * Pigeon wing bone — way-home sense (tier-1 charm):
   * shell-supplied carried + awakened boolean. Arrows show
   * without water while true (UI wiring follows separately).
   */
  setPigeonWayHome(active: boolean): void {
    this.pigeonWayHome = active;
    this.refreshArrowVisibility();
  }

  /**
   * Bat wing bone — night way-finding (tier-1 charm):
   * shell-supplied carried + awakened boolean. Fog thins
   * at night while true (applied per frame in the loop).
   */
  setBatNightWayfinding(active: boolean): void {
    this.batNightWayfinding = active;
  }

  /**
   * Crow beak — pile glow (tier-1 charm): shell-supplied tier
   * (Systems owns the tier fact; this setter only reads it).
   * Tier 0 = base slight memory-glow; tier ≥ 1 = bright glow
   * (bright persists at tiers 2/3, which add arrows — the
   * arrows themselves are UI's display, gated by crowPileArrow).
   * Applies in place — no pile rebuild on tier change.
   */
  setCrowTier(tier: CrowTier): void {
    this.crowTier = tier;
    const intensity = crowGlowIntensity(tier);
    this.pileGroup?.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.isPileFlag) {
        const mat = obj.material;
        if (mat instanceof THREE.MeshLambertMaterial) mat.emissiveIntensity = intensity;
      }
    });
  }

  /**
   * Owl talon — night sight (tier-1 charm): pass-through
   * to the sky rig (shell-supplied carried + awakened
   * boolean).
   */
  setOwlNightSight(active: boolean): void {
    this.sky?.setOwlNightSight(active);
  }

  /**
   * Sky save seam (Adam 2026-10-27, follow-up to the persistence
   * round). SkyRig is renderer-owned and `sky` stays private — the
   * shell must NOT reach through to the rig (no public accessor, by
   * choice: an accessor would let the shell call setSeed/dispose/
   * update on the rig and break the constructor/setWorldGen/
   * dispose ownership). These two methods are the whole seam:
   * saveNow calls snapshotSky() and stores the result as the save's
   * sky field; boot calls restoreSky(saved) AFTER constructing the
   * renderer (the rig does not exist before construction, and
   * setWorldGen resets it to dawn — so a restore must come after
   * BOTH, never before). Next update() continues the cycle from
   * the restored position; month stays an input, not state.
   * snapshotSky() returns null only when the rig is gone
   * (disposed renderer) — the shell stores nothing in that case.
   * restoreSky() is a no-op on null/undefined (old saves carry no
   * sky field) and on a disposed renderer; SkyRig.restore itself
   * ignores a non-finite cycleT.
   */
  snapshotSky(): SkySnapshot | null {
    return this.sky?.snapshot() ?? null;
  }

  /**
   * Live feed of loaded-chunk animals for the shell (creature-tag
   * consumption, UI lane): one { kind, x, z } snapshot per ambient
   * animal instance in a currently loaded chunk. Fresh array +
   * fresh objects each call, so the shell's 250 ms poll reads
   * current positions (instances move every frame via
   * updateAnimal) without ever mutating renderer state.
   * Instance x/z equal rendered x/z (pose adds bob to y only).
   * ALL loaded-chunk animals, no cap, no nearest filter —
   * nearest-only + range cap are the tag's job, UI-side. Kind is
   * the AnimalKind id (UI capitalizes for display — no name
   * field exists in ANIMAL_DEFS). No y: tags project x/z.
   * No App.tsx touch: the shell polls this getter and renders
   * its own tag.
   */
  getVisibleAnimals(): { kind: AnimalKind; x: number; z: number }[] {
    const out: { kind: AnimalKind; x: number; z: number }[] = [];
    for (const loaded of this.chunks.values()) {
      for (const pair of loaded.animals) {
        out.push({ kind: pair.instance.kind, x: pair.instance.x, z: pair.instance.z });
      }
    }
    return out;
  }

  restoreSky(snap: SkySnapshot | null | undefined): void {
    if (!snap) return;
    this.sky?.restore(snap);
  }

  /** Ground detail texture for a chunk: the dominant biome's procedural
   *  texture, or the marsh texture when marsh ground character dominates
   *  the chunk center. The vertex-color blend underneath still carries
   *  the continuous biome transition; this is the detail layer on top. */
  private groundTextureFor(cx: number, cz: number): THREE.DataTexture {
    const centerX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
    const centerZ = cz * CHUNK_SIZE + CHUNK_SIZE / 2;
    const fields = this.gen.fieldsAt(centerX, centerZ);
    const id: BiomeId | 'marsh' =
      marshWeight(fields) > 0.5 ? 'marsh' : this.gen.weightsAt(centerX, centerZ).dominant;
    const cached = this.groundTextures.get(id);
    if (cached) return cached;
    const tex = createBiomeTexture(id, this.gen.seed);
    const dataTex = new THREE.DataTexture(
      tex.data,
      tex.width,
      tex.height,
      THREE.RGBAFormat,
    );
    dataTex.wrapS = THREE.RepeatWrapping;
    dataTex.wrapT = THREE.RepeatWrapping;
    dataTex.repeat.set(TEXTURE_REPEAT, TEXTURE_REPEAT);
    dataTex.colorSpace = THREE.SRGBColorSpace;
    dataTex.needsUpdate = true;
    this.groundTextures.set(id, dataTex);
    return dataTex;
  }

  private disposeGroundTextures(): void {
    for (const tex of this.groundTextures.values()) tex.dispose();
    this.groundTextures.clear();
  }

  /** Swap the world generator (seed change): drop all chunks, re-stream. */
  setWorldGen(gen: WorldGen): void {
    // A new seed is a new world: shrink/removed/progress/spawned
    // state (and felled stumps, saplings, cleared spots) does not
    // carry over.
    harvestState.clear();
    // A new seed is a new world: placed fires + houses + looms
    // do not carry over either (they belong to the old world's
    // map).
    fireState.clear();
    shelterState.clear();
    loomState.clear();
    // Placed torches belong to the old world's map too.
    torchState.clear();
    // Placed altars belong to the old world's map too.
    altarState.clear();
    // Placed desks belong to the old world's map too.
    deskState.clear();
    // Placed cauldrons belong to the old world's map too
    // (their hearths are cleared with the fires above).
    cauldronState.clear();
    // Placed tents belong to the old world's map too (the shell
    // re-supplies them via setTents on boot restore).
    this.tents = [];
    this.rebuildPlacedGroup();
    // Staged bones belong to the old world's sites too.
    ritualSiteState.clear();
    this.rebuildStagedBones();
    // Camp arrows belong to the old world's houses too.
    this.rebuildCampArrows();
    // Dropped piles belong to the old world's map too.
    pileState.clear();
    this.rebuildPileGroup();
    // Placed traps belong to the old world's map too.
    trapState.clear();
    this.rebuildTrapGroup();
    this.gen = wrapGenWithState(gen);
    this.riverParams = riverParamsFor(String(gen.seed), gen.findSpawn());
    // The new world's sites (sites.ts) — the site-wall query the
    // constructor wired reads this field dynamically.
    this.sites = computeSites(gen);
    if (!this.disposed) this.rebuildSmoke(gen);
    // A new world gets a new sky: fresh stars for the seed + the
    // cycle restarts at dawn. Skipped on the dispose path
    // (disposed is already true there) — dispose() removes the
    // rig itself below instead of rebuilding it.
    if (!this.disposed) this.sky?.setSeed(String(gen.seed));
    this.proximity.setGen(this.gen);
    this.disposeGroundTextures();
    for (const [key, loaded] of this.chunks) {
      this.disposeLoaded(loaded);
      this.chunks.delete(key);
    }
    this.rebuildSpawnedGroup();
  }

  /**
   * Swap the generator for a DIMENSION change (Adam
   * 2026-10-30 — the cave machinery). Unlike setWorldGen
   * (a new world: state cleared), a dimension swap keeps
   * every state module untouched: the surface world's
   * placed things are simply not part of the dimension —
   * their groups and lights hide while she is away and
   * return as they were. The river, the sky, and the fog
   * all gate off the generator's dimensionKey.
   */
  setDimensionGen(gen: WorldGen): void {
    const underground = !!gen.dimensionKey;
    this.gen = wrapGenWithState(gen);
    this.riverParams = underground ? null : riverParamsFor(String(gen.seed), gen.findSpawn());
    this.sites = computeSites(gen);
    const showPlaced = !underground;
    if (this.placedGroup) this.placedGroup.visible = showPlaced;
    if (this.pileGroup) this.pileGroup.visible = showPlaced;
    if (this.trapGroup) this.trapGroup.visible = showPlaced;
    if (this.stagedBoneGroup) this.stagedBoneGroup.visible = showPlaced;
    if (this.campArrowGroup) this.campArrowGroup.visible = showPlaced;
    if (this.smokeGroup) this.smokeGroup.visible = showPlaced;
    for (const light of [...this.fireLights, ...this.torchLights, ...this.altarCandleLights]) {
      light.visible = showPlaced;
    }
    if (!this.disposed) this.sky?.setCaveMode(underground);
    (this.scene.background as THREE.Color).set(underground ? 0x030303 : 0x1a2018);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(underground ? 0x030303 : 0x1a2018);
    }
    this.rebuildFungusLights(underground ? String(gen.seed) : null);
    this.proximity.setGen(this.gen);
    this.disposeGroundTextures();
    for (const [key, loaded] of this.chunks) {
      this.disposeLoaded(loaded);
      this.chunks.delete(key);
    }
    this.rebuildSpawnedGroup();
  }

  /**
   * (Re)build the twilight-fungus lights for the cave
   * dimension (null seed = none, on the surface). Dim cool
   * points at the layout's fungus spots — the entrance
   * glow Adam allowed, and nothing deeper.
   */
  private rebuildFungusLights(seed: string | null): void {
    for (const light of this.fungusLights) this.scene.remove(light);
    this.fungusLights = [];
    if (!seed) return;
    for (const spot of caveLayoutFor(seed).fungusLights) {
      const light = new THREE.PointLight(
        FUNGUS_LIGHT_COLOR,
        FUNGUS_LIGHT_INTENSITY,
        FUNGUS_LIGHT_DISTANCE,
        FUNGUS_LIGHT_DECAY,
      );
      light.position.set(spot.x, 0.6, spot.z);
      light.userData.phase = flamePhase(spot.x, spot.z);
      this.scene.add(light);
      this.fungusLights.push(light);
    }
  }

  get loadedChunkCount(): number {
    return this.chunks.size;
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  dispose(): void {
    this.disposed = true;
    this.unsubHarvestCompleted?.();
    this.unsubHarvestCompleted = null;
    for (const unsub of this.unsubPlaced) unsub();
    this.unsubPlaced = [];
    this.proximity.dispose();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.setWorldGen(this.gen); // clears chunks (also disposes meshes)
    this.sky?.dispose();
    this.sky = null;
    this.disposeGroundTextures();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private onResize = (): void => {
    const container = this.renderer.domElement.parentElement;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private loadChunk(cx: number, cz: number): void {
    const key = this.chunkKey(cx, cz);
    if (this.chunks.has(key)) return;
    const data = this.gen.generateChunk(cx, cz);
    const group = new THREE.Group();

    // Ground: vertex-colored plane. Colors are sampled from the continuous
    // blend function at each vertex's WORLD position, so adjacent chunks
    // agree exactly at their shared edge — no seams by construction.
    const groundGeo = new THREE.PlaneGeometry(
      CHUNK_SIZE,
      CHUNK_SIZE,
      GROUND_SEGMENTS,
      GROUND_SEGMENTS,
    );
    groundGeo.rotateX(-Math.PI / 2);
    const posAttr = groundGeo.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(posAttr.count * 3);
    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;
    for (let i = 0; i < posAttr.count; i++) {
      const wx = originX + posAttr.getX(i) + CHUNK_SIZE / 2;
      const wz = originZ + posAttr.getZ(i) + CHUNK_SIZE / 2;
      const c = this.gen.groundColorAt(wx, wz);
      colors[i * 3] = ((c >> 16) & 0xff) / 255;
      colors[i * 3 + 1] = ((c >> 8) & 0xff) / 255;
      colors[i * 3 + 2] = (c & 0xff) / 255;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        map: this.groundTextureFor(cx, cz),
      }),
    );
    ground.position.set(originX + CHUNK_SIZE / 2, 0, originZ + CHUNK_SIZE / 2);
    group.add(ground);

    // Scatter: one InstancedMesh per kind present in this chunk.
    const meshes: THREE.InstancedMesh[] = [];
    const byKind = new Map<ScatterKind, typeof data.objects>();
    for (const obj of data.objects) {
      const list = byKind.get(obj.kind) ?? [];
      list.push(obj);
      byKind.set(obj.kind, list);
    }
    const dummy = new THREE.Object3D();
    const now = Date.now();
    for (const [kind, objs] of byKind) {
      const render = KIND_RENDER[kind];
      const mesh = new THREE.InstancedMesh(render.geometry, render.material, objs.length);
      objs.forEach((obj, i) => {
        // Shrink model (Adam, 2026-10-26): a regrowing object
        // renders at SHRINK_SCALE; fully regrown objects render
        // full-size. The scale applies to the base height too, so a
        // shrunk tree's canopy sits at shrunk height, not floating.
        const s =
          obj.scale *
          (harvestState.isRegrowing(scatterTargetId(cx, cz, obj), now)
            ? SHRINK_SCALE
            : 1);
        dummy.position.set(obj.x, obj.y + render.baseY * s, obj.z);
        dummy.rotation.set(0, obj.rotY, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
      meshes.push(mesh);
      // No extra branch: former extra primitives (canopy, stump
      // top, seed-head) are merged into the one kind geometry
      // (models.ts), so one instanced mesh carries the whole model.
    }

    // Tall-sunflower heads (Adam, 2026-10-29): the ONE exception
    // to the merged-geometry rule above — a head must TURN, so it
    // rides its own InstancedMesh (same shared-material model),
    // aimed by aimSunflowerHeads at build and on every world
    // tick. The stem above is the ordinary static kind mesh.
    let sunflowerHeads: LoadedChunk['sunflowerHeads'] = null;
    const sunflowerObjs = byKind.get('sunflower');
    if (sunflowerObjs && sunflowerObjs.length > 0) {
      const headMesh = new THREE.InstancedMesh(
        sunflowerHeadGeometry(),
        KIND_RENDER.sunflower.material,
        sunflowerObjs.length,
      );
      group.add(headMesh);
      meshes.push(headMesh);
      sunflowerHeads = { mesh: headMesh, objs: sunflowerObjs, cx, cz };
    }

    // River: the world's winding water band (Adam 2026-10-27,
    // visibility only). One ribbon segment per chunk, quads
    // owned by midpoint — no overlaps, no gaps at borders.
    let river: THREE.Mesh | null = null;
    if (this.riverParams) {
      const ribbon = riverRibbonForChunk(this.riverParams, cx, cz);
      if (ribbon) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(ribbon.positions, 3));
        geo.setIndex(ribbon.indices);
        geo.computeVertexNormals();
        river = new THREE.Mesh(geo, RIVER_MATERIAL);
        group.add(river);
      }
    }

    // Animals: ambient creatures, seeded per chunk (animals.ts).
    // Water anchors come from this chunk's own water (river ribbon
    // vertices + pond objects); perch anchors from its trees. The
    // animal groups join the chunk group, so chunk unload and
    // setWorldGen remove them with it; their geometries and
    // materials are shared per kind (models.ts) and are NOT
    // disposed here, like the scatter kind materials.
    const pondPoints = data.objects
      .filter((o) => o.kind === 'pond')
      .map((o) => ({ x: o.x, z: o.z }));
    const treePoints = data.objects
      .filter((o) => o.kind === 'tree')
      .map((o) => ({ x: o.x, z: o.z }));
    const riverPoints: { x: number; z: number }[] = [];
    if (this.riverParams) {
      const ribbon = riverRibbonForChunk(this.riverParams, cx, cz);
      if (ribbon) {
        for (let i = 0; i < ribbon.positions.length; i += 3) {
          riverPoints.push({ x: ribbon.positions[i], z: ribbon.positions[i + 2] });
        }
      }
    }
    const animals: { instance: AnimalInstance; group: THREE.Group }[] = [];
    for (const instance of spawnAnimalsForChunk({
      seed: String(this.gen.seed),
      cx,
      cz,
      weightsAt: (x, z) => this.gen.weightsAt(x, z),
      riverPoints,
      pondPoints,
      treePoints,
    })) {
      const animalGroup = buildAnimal(instance.kind);
      animalGroup.position.set(instance.x, instance.y, instance.z);
      animalGroup.rotation.set(0, instance.heading, 0);
      group.add(animalGroup);
      animals.push({ instance, group: animalGroup });
    }

    this.scene.add(group);
    this.chunks.set(key, { group, meshes, ground, river, animals, sunflowerHeads });
    this.aimSunflowerHeads();
    bus.emit('world:chunkLoaded', { cx, cz, objectCount: data.objects.length });
  }

  /** Remove a chunk's meshes and free per-chunk GPU resources. Shared kind
   *  geometries/materials are NOT disposed — InstancedMesh.dispose() only
   *  frees instance buffers. The ground mesh owns its geometry + material
   *  (vertex colors are per-chunk), so those are disposed. */
  private disposeLoaded(loaded: LoadedChunk): void {
    this.scene.remove(loaded.group);
    for (const mesh of loaded.meshes) mesh.dispose();
    // The river ribbon owns its geometry (the material is shared,
    // like the kind materials, and is NOT disposed).
    loaded.river?.geometry.dispose();
    loaded.ground.geometry.dispose();
    (loaded.ground.material as THREE.Material).dispose();
  }

  private unloadChunk(cx: number, cz: number): void {
    const key = this.chunkKey(cx, cz);
    const loaded = this.chunks.get(key);
    if (!loaded) return;
    this.disposeLoaded(loaded);
    this.chunks.delete(key);
    bus.emit('world:chunkUnloaded', { cx, cz });
  }

  /** Keep resident chunks = the square around the player's chunk. */
  private stream(): void {
    const { cx, cz } = this.player.chunk;
    const wanted = new Set<string>();
    for (let dz = -STREAM_RADIUS_CHUNKS; dz <= STREAM_RADIUS_CHUNKS; dz++) {
      for (let dx = -STREAM_RADIUS_CHUNKS; dx <= STREAM_RADIUS_CHUNKS; dx++) {
        wanted.add(this.chunkKey(cx + dx, cz + dz));
      }
    }
    for (const key of [...this.chunks.keys()]) {
      if (!wanted.has(key)) {
        const [ux, uz] = key.split(',').map(Number);
        this.unloadChunk(ux, uz);
      }
    }
    for (const key of wanted) {
      const [lx, lz] = key.split(',').map(Number);
      this.loadChunk(lx, lz);
    }
  }

  /**
   * World tick (every ~2 s, not every frame): regrow + log-spawn
   * bookkeeping. Regrown chunks reload (full-size meshes return);
   * due log spawns are created near trees; spawned-object meshes
   * rebuild (so growing saplings visibly grow). The 2 s cadence is
   * a rendering cadence, not a gameplay timer — regrow/spawn/
   * growth times themselves live in harvestState.ts, and a regrown
   * plant or mature sapling is harvestable the moment its time
   * passes even before its chunk reloads (the tracker checks
   * state, not meshes).
   */
  private worldTick(): void {
    const now = Date.now();
    for (const key of harvestState.pruneExpiredRegrows(now)) {
      const [cx, cz] = key.split(',').map(Number);
      if (this.chunks.has(key)) {
        this.unloadChunk(cx, cz);
        this.loadChunk(cx, cz);
      }
    }
    harvestState.processDueSpawns(now, this.gen);
    this.rebuildSpawnedGroup();
    // Friction lighting display: waits that elapsed become 'ready'
    // (the rub itself checks the clock, so this is display only).
    fireState.advanceLighting(now);
    // Trap hour trigger: the 2 s tick is the boundary clock —
    // checkHour emits 'trap:hour' only when the game hour changes
    // (null sky = rig gone, skip; unchanged hour = no-op, so this
    // is pause-safe by construction).
    const sky = this.snapshotSky();
    if (sky) trapState.checkHour(sky.cycleT);
    // Sunflower heads re-aim on the same 2 s boundary (below).
    this.aimSunflowerHeads();
  }

  /**
   * Aim every loaded sunflower head at the sun (Adam, 2026-10-29):
   * recompose each head instance's matrix from the sky cycle —
   * called at chunk load and on every world tick (2 s), never per
   * frame, and never while paused (the tick halts with the loop).
   * Each head's effective scale recomputes exactly as chunk build
   * composes it, shrink included, so heads and stems never part.
   */
  private aimSunflowerHeads(): void {
    let any = false;
    for (const loaded of this.chunks.values()) {
      if (loaded.sunflowerHeads) { any = true; break; }
    }
    if (!any) return;
    const orientation = sunflowerHeadOrientation(this.sky?.cycleT ?? 0, SEASON_START_MONTH);
    const now = Date.now();
    const m = new THREE.Matrix4();
    for (const loaded of this.chunks.values()) {
      const heads = loaded.sunflowerHeads;
      if (!heads) continue;
      heads.objs.forEach((obj, i) => {
        const s =
          obj.scale *
          (harvestState.isRegrowing(scatterTargetId(heads.cx, heads.cz, obj), now)
            ? SHRINK_SCALE
            : 1);
        sunflowerHeadMatrix(obj, s, orientation, m);
        heads.mesh.setMatrixAt(i, m);
      });
      heads.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Flame mesh for a lit fire: outer orange cone + inner yellow
   * core, flickering in the loop via userData.flame/phase. Phase
   * is a position hash (no Math.random — render-only, but the
   * habit keeps seeded determinism arguments clean).
   */
  private flameMesh(x: number, z: number, baseY: number, scale: number): THREE.Group {
    const flame = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(0.28 * scale, 0.8 * scale, 7),
      new THREE.MeshBasicMaterial({ color: 0xff6a00 }),
    );
    outer.position.y = 0.4 * scale;
    const inner = new THREE.Mesh(
      new THREE.ConeGeometry(0.15 * scale, 0.45 * scale, 7),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    );
    inner.position.y = 0.22 * scale;
    flame.add(outer, inner);
    flame.position.y = baseY;
    flame.userData.flame = true;
    flame.userData.phase = flamePhase(x, z);
    return flame;
  }

  /** One scene-level point light for a lit fire, at its flame's heart. */
  private addFireLight(x: number, z: number, baseY: number, scale: number): void {
    const light = new THREE.PointLight(
      FIRE_LIGHT_COLOR,
      FIRE_LIGHT_INTENSITY,
      FIRE_LIGHT_DISTANCE,
      FIRE_LIGHT_DECAY,
    );
    light.position.set(x, baseY + 0.5 * scale, z);
    light.userData.phase = flamePhase(x, z);
    this.scene.add(light);
    this.fireLights.push(light);
  }

  /**
   * One scene-level point light for a placed torch, at its
   * flame: the SAME torch profile as the carried light
   * (80/30/2, flicker ±15%), now at a fixed position — it
   * lights an area or path instead of following her.
   */
  private addTorchLight(x: number, z: number): void {
    const light = new THREE.PointLight(
      TORCH_LIGHT_COLOR,
      TORCH_LIGHT_INTENSITY,
      TORCH_LIGHT_DISTANCE,
      TORCH_LIGHT_DECAY,
    );
    light.position.set(x, TORCH_FLAME_Y - PLACED_TORCH_SINK, z);
    light.userData.phase = flamePhase(x, z);
    this.scene.add(light);
    this.torchLights.push(light);
  }

  /**
   * One scene-level point light for a dressed stump's altar
   * candle, at its flame: the CANDLE profile (30/22/2,
   * flicker ±12%) — the transformation sets the candle lit
   * and it stays lit, so the light lives and dies with the
   * dressing mesh. Anchored off the same models constants
   * the dressing build uses, so light and flame can't drift.
   */
  private addAltarCandleLight(x: number, z: number): void {
    const light = new THREE.PointLight(
      CANDLE_LIGHT_COLOR,
      CANDLE_LIGHT_INTENSITY,
      CANDLE_LIGHT_DISTANCE,
      CANDLE_LIGHT_DECAY,
    );
    light.position.set(x + ALTAR_CANDLE_X, STUMP_TOP_Y + CANDLE_FLAME_Y, z + ALTAR_CANDLE_Z);
    light.userData.phase = flamePhase(x + ALTAR_CANDLE_X, z + ALTAR_CANDLE_Z);
    this.scene.add(light);
    this.altarCandleLights.push(light);
  }

  /**
   * (Re)build the smoke column over the village's smoke
   * anchor (the hearth house's chimney). Called wherever
   * the sites are (re)derived. Sprites start invisible —
   * the render loop's smoke update phases them in.
   */
  private rebuildSmoke(gen: WorldGen): void {
    if (this.smokeGroup) {
      this.scene.remove(this.smokeGroup);
      for (const s of this.smokeSprites) (s.material as THREE.Material).dispose();
      this.smokeGroup = null;
      this.smokeSprites = [];
    }
    const village = villageSite(String(gen.seed), gen.findSpawn(), (x, z) => gen.weightsAt(x, z));
    const anchor = village.hearthHouse.smokeAnchor;
    const group = new THREE.Group();
    group.position.set(anchor.x, anchor.y, anchor.z);
    const map = smokeTexture();
    for (let i = 0; i < SMOKE_SPRITE_COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map,
        color: 0x3d3d42,
        transparent: true,
        opacity: 0,
        fog: false,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      group.add(sprite);
      this.smokeSprites.push(sprite);
    }
    this.scene.add(group);
    this.smokeGroup = group;
  }

  /** Rebuild all player-placed meshes (fires + houses + looms). */
  private rebuildPlacedGroup(): void {
    if (this.placedGroup) {
      this.scene.remove(this.placedGroup);
      this.placedGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      this.placedGroup = null;
    }
    // Fire lights rebuild with the placed group: a lit fire's light
    // lives and dies with its flame mesh (unlit = no light).
    // Dispose is safe through this path too — dispose() routes
    // through setWorldGen, which rebuilds from cleared state.
    for (const light of this.fireLights) this.scene.remove(light);
    this.fireLights = [];
    // Placed-torch lights rebuild the same way: a placed torch
    // is always lit, so its light lives and dies with its mesh.
    for (const light of this.torchLights) this.scene.remove(light);
    this.torchLights = [];
    // Altar-candle lights likewise: the transformation's
    // candle is set lit and stays lit.
    for (const light of this.altarCandleLights) this.scene.remove(light);
    this.altarCandleLights = [];
    const group = new THREE.Group();
    const box = (
      w: number,
      h: number,
      d: number,
      color: number,
      px: number,
      py: number,
      pz: number,
      ry = 0,
      rx = 0,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
      mesh.position.set(px, py, pz);
      mesh.rotation.y = ry;
      mesh.rotation.x = rx;
      return mesh;
    };
    const cyl = (
      rt: number,
      rb: number,
      h: number,
      color: number,
      px: number,
      py: number,
      pz: number,
      seg = 10,
      openEnded = false,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, openEnded), lambert(color));
      mesh.position.set(px, py, pz);
      return mesh;
    };
    // House meshes are DOUBLE-SIDED (Adam 2026-10-28 — inside
    // a hut the FrontSide walls/roof culled to nothing, leaving
    // the flat ground plane + outside world showing through):
    // lambert() mints a fresh material per mesh, so setting
    // .side here touches only house meshes. Shared box()/cyl()
    // stay FrontSide — scatter, fires, looms read unchanged —
    // and DoubleSide renders outward faces identically, so
    // exteriors read exactly as before.
    const houseBox = (...args: Parameters<typeof box>): THREE.Mesh => {
      const mesh = box(...args);
      (mesh.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;
      return mesh;
    };
    const houseCyl = (...args: Parameters<typeof cyl>): THREE.Mesh => {
      const mesh = cyl(...args);
      (mesh.material as THREE.MeshLambertMaterial).side = THREE.DoubleSide;
      return mesh;
    };
    const houseRoof = (geo: THREE.BufferGeometry, color: number): THREE.Mesh => {
      const mat = lambert(color);
      mat.side = THREE.DoubleSide;
      return new THREE.Mesh(geo, mat);
    };
    // Packed-earth floor disc (Adam, 2026-10-29, Floor
    // Option A): vertex-colour mottling gives the flat disc
    // real detail for the eye to hold (the scatter idiom —
    // a vertexColors Lambert), and the rim shades darker
    // so a raised edge reads as a step. The mottle is a
    // pure function of local position + the house's world
    // position — deterministic, no RNG state, identical on
    // every rebuild. houseCyl's flat colour can't carry
    // this, hence its own builder.
    const houseFloorDisc = (
      radius: number,
      height: number,
      color: number,
      px: number,
      py: number,
      pz: number,
      worldX: number,
      worldZ: number,
    ): THREE.Mesh => {
      const geo = new THREE.CylinderGeometry(radius, radius, height, 12);
      const posAttr = geo.getAttribute('position');
      const norAttr = geo.getAttribute('normal');
      const colors = new Float32Array(posAttr.count * 3);
      const base = new THREE.Color(color);
      for (let i = 0; i < posAttr.count; i++) {
        const lx = posAttr.getX(i);
        const lz = posAttr.getZ(i);
        const ny = norAttr.getY(i);
        const s = Math.sin((lx + worldX) * 12.9898 + (lz + worldZ) * 78.233) * 43758.5453;
        const h = s - Math.floor(s);
        // Draft bands: top face mottles 0.86–1.08, the rim
        // sits at 0.78 (the step read), underside 0.70
        // (never seen, kept consistent).
        const f = ny > 0.5 ? 0.86 + h * 0.22 : ny < -0.5 ? 0.7 : 0.78;
        colors[i * 3] = base.r * f;
        colors[i * 3 + 1] = base.g * f;
        colors[i * 3 + 2] = base.b * f;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      mat.side = THREE.DoubleSide;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      return mesh;
    };
    for (const fire of fireState.snapshot()) {
      const fg = new THREE.Group();
      fg.position.set(fire.x, 0, fire.z);
      const lit = fire.lit && FIRE_DEFS[fire.type].flameWhenLit;
      if (fire.type === 'campfire') {
        // Visible pile of sticks (Adam 2026-10-27 — the old flat
        // 0.32 m campfire read as nothing on a phone screen):
        // stone ring + ash bed + crossed base logs + a tipi pile
        // rising to CAMPFIRE_PILE_TOP_Y. The lit flame's base
        // sits well inside the tipi (baseY 0.45) so the lower
        // flame body hides among the sticks and only the tongue
        // clears the pile top — a flame emerging FROM the pile,
        // not balanced on it (Adam 2026-10-28, screenshot).
        fg.add(buildCampfireGroup());
        if (lit) { fg.add(this.flameMesh(fire.x, fire.z, 0.45, 1)); this.addFireLight(fire.x, fire.z, 0.45, 1); }
      } else if (fire.type === 'hearth') {
        // Stone base, side pillars, mantel, dark firebox opening,
        // inner logs — a hearth, not a slab.
        fg.add(box(1.3, 0.5, 1.3, 0x8a8a86, 0, 0.25, 0));
        fg.add(box(0.25, 0.9, 1.3, 0x7a7a76, -0.55, 0.95, 0));
        fg.add(box(0.25, 0.9, 1.3, 0x7a7a76, 0.55, 0.95, 0));
        fg.add(box(1.4, 0.15, 1.4, 0x7a7a76, 0, 1.45, 0));
        fg.add(box(0.9, 0.7, 0.1, 0x1a1a1a, 0, 0.85, 0.61));
        const hlog = cyl(0.06, 0.06, 0.8, 0x6b4a2f, 0, 0.6, 0.3);
        hlog.rotation.z = Math.PI / 2;
        fg.add(hlog);
        if (lit) { fg.add(this.flameMesh(fire.x, fire.z, 0.6, 1.1)); this.addFireLight(fire.x, fire.z, 0.6, 1.1); }
        // The cauldron, when this hearth bears one (Adam
        // 2026-10-30 — its own target, distinct from the
        // fire): the clay pot sits on the base slab over
        // the logs, belly above the flame. Riding the
        // hearth's own group binds the pot's life to its
        // hearth's — it can never float hearth-less.
        if (cauldronState.cauldronForHearth(fire.id)) {
          const pot = buildCauldronGroup();
          pot.position.set(0, 0.5, 0.1);
          fg.add(pot);
        }
      } else if (fire.type === 'kiln') {
        // Firing chamber: base slab, body, dome, stoke-hole opening,
        // brick band around the middle.
        fg.add(cyl(0.85, 0.9, 0.15, 0x8a8a86, 0, 0.08, 0));
        fg.add(cyl(0.7, 0.8, 1.2, 0xb08968, 0, 0.6, 0));
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xb08968));
        dome.position.y = 1.2;
        fg.add(dome);
        fg.add(cyl(0.78, 0.78, 0.12, 0x9a7a5a, 0, 0.6, 0));
        fg.add(box(0.4, 0.5, 0.1, 0x1a1a1a, 0, 0.35, 0.78));
        if (lit) { fg.add(this.flameMesh(fire.x, fire.z, 1.9, 0.7)); this.addFireLight(fire.x, fire.z, 1.9, 0.7); }
      } else {
        // Bloomery: stone base, tapering shaft, top rim, stoke-hole,
        // slag pile at the foot.
        fg.add(cyl(0.85, 0.95, 0.4, 0x6e6e6a, 0, 0.2, 0));
        fg.add(cyl(0.55, 0.65, 2.2, 0x5a5a58, 0, 1.5, 0));
        fg.add(cyl(0.6, 0.6, 0.12, 0x4a4a48, 0, 2.6, 0));
        fg.add(box(0.35, 0.45, 0.1, 0x1a1a1a, 0, 0.5, 0.62));
        const slag = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.25, 7), lambert(0x3a3a38));
        slag.position.set(0.7, 0.12, 0.4);
        fg.add(slag);
        if (lit) { fg.add(this.flameMesh(fire.x, fire.z, 2.6, 0.8)); this.addFireLight(fire.x, fire.z, 2.6, 0.8); }
      }
      group.add(fg);
    }
    for (const house of shelterState.snapshot()) {
      const def = HOUSE_DEFS[house.type];
      const f = def.footprint;
      const hg = new THREE.Group();
      hg.position.set(house.x, 0, house.z);
      if (house.type === 'leanTo') {
        hg.add(houseCyl(0.07, 0.07, 2.2, 0x6b4a2f, -f / 2, 1.1, 0));
        hg.add(houseCyl(0.07, 0.07, 2.2, 0x6b4a2f, f / 2, 1.1, 0));
        // Roof underside only — open shelter, NO floor: the
        // ground IS the floor (stated exclusion, approved).
        hg.add(houseBox(f + 0.4, 0.12, 1.6, 0x8a7a4a, 0, 1.9, 0, 0, -0.5));
        // Bedroll under the roof + stick back wall.
        const bed = houseCyl(0.14, 0.14, 1.2, 0x6a5a3a, 0, 0.14, 0.3);
        bed.rotation.z = Math.PI / 2;
        hg.add(bed);
        for (let i = -1; i <= 1; i++) {
          hg.add(houseCyl(0.04, 0.04, 1.7, 0x6b4a2f, i * (f / 3), 0.85, -0.7));
        }
      } else if (house.type === 'thatchHut') {
        // Wall OPEN-ENDED (Adam, 2026-10-29): a capped cylinder's
        // top cap at y 1.6 rendered from inside (DoubleSide) as a
        // fan-seamed false ceiling, sealing off the roof cone's
        // underside — the cone IS the ceiling. No bottom cap
        // either (the floor disc below is its own mesh; its top
        // cap is the floor). Outside, the cone's base radius
        // (f/2 + 0.3) overhangs the wall (f/2) at the same 1.6,
        // so the open rim is covered from above.
        hg.add(houseCyl(f / 2, f / 2, 1.6, 0xcbb59a, 0, 0.8, 0, 12, true));
        // Roof cone OPEN-ENDED (Adam, 2026-10-29, his order on
        // the re-sight: "Just remove the cone cap."): a cone's
        // default base cap was a SECOND flat fan at the same
        // 1.6 plane the wall cap had masked — probe-proved to
        // be the ceiling he kept seeing after the wall fix.
        // Open-ended, the cone's sloped underside (DoubleSide
        // via houseRoof) is the ceiling; from above, the slope
        // itself covers the wall's open rim as before.
        const roof = houseRoof(new THREE.ConeGeometry(f / 2 + 0.3, 1.5, 12, 1, true), 0x8a7a4a);
        roof.position.y = 2.35;
        hg.add(roof);
        hg.add(houseBox(0.7, 1.3, 0.1, 0x3a2812, 0, 0.65, f / 2 + 0.01));
        hg.add(houseBox(0.9, 0.1, 0.5, 0x8a8a86, 0, 0.05, f / 2 + 0.25));
        hg.add(houseCyl(0.09, 0.09, 0.3, 0x1a1a1a, 0, 3.1, 0));
        // Floor (Adam, 2026-10-29, Floor Option A — presence):
        // the radius runs OUT to the wall and 0.02 past it,
        // closing the old inset ring gap (bare ground showing
        // below floor level between disc edge and wall); the
        // top sits at 0.10 with its rim as the step in (the
        // stoop outside already tops at 0.10 — they meet
        // level), and the slab sinks 0.02 below ground so no
        // cap lies coplanar with the terrain. Packed-earth
        // tone, draft; the mottle lives in houseFloorDisc.
        hg.add(houseFloorDisc(f / 2 + 0.02, 0.12, 0x8a7355, 0, 0.04, 0, house.x, house.z));
      } else if (house.type === 'wovenCottage') {
        hg.add(houseBox(f, 2.2, f * 0.8, 0xd8c9a8, 0, 1.1, 0));
        // Roof cone OPEN-ENDED (Adam, 2026-10-29 — the
        // thatch treatment, 349db1b, extended on his order):
        // the cone's default base cap was a flat fan ceiling
        // at 2.2; open, the sloped underside (DoubleSide via
        // houseRoof) is the ceiling.
        const roof = houseRoof(new THREE.ConeGeometry(f * 0.75, 1.4, 4, 1, true), 0x8a7a4a);
        roof.position.y = 2.9;
        roof.rotation.y = Math.PI / 4;
        hg.add(roof);
        hg.add(houseBox(0.8, 1.6, 0.1, 0x4a3220, 0, 0.8, (f * 0.8) / 2 + 0.01));
        // Windows + wattle bands around the wall.
        hg.add(houseBox(0.5, 0.5, 0.06, 0x2a2018, -f / 4, 1.3, (f * 0.8) / 2 + 0.01));
        hg.add(houseBox(0.5, 0.5, 0.06, 0x2a2018, f / 4, 1.3, (f * 0.8) / 2 + 0.01));
        hg.add(houseBox(f + 0.06, 0.08, f * 0.8 + 0.06, 0xb09a6a, 0, 0.6, 0));
        hg.add(houseBox(f + 0.06, 0.08, f * 0.8 + 0.06, 0xb09a6a, 0, 1.7, 0));
        // Woven texture (Adam 2026-10-28 — texture pass before
        // the merge goes live): vertical wattle strands on all
        // four exterior faces, interlaced with the horizontal
        // bands above. Strands sit 0.02 proud of the wall face
        // (box depth 0.06 centered 0.01 inside the face), so
        // the bands (0.03 proud) pass OVER them at crossings
        // — no coplanar faces, reads as weave from every
        // outside angle. Front-face strands skip the door
        // x-range (±0.4) and the window x-ranges (±f/4 ±
        // 0.25); the openings interrupt the weave. Strands
        // use the shared FrontSide box(): exterior-only by
        // wall occlusion, so nothing shows inside — the
        // interior (ff44e00) is untouched.
        const frontFace = (f * 0.8) / 2;
        for (let x = -f / 2 + 0.25; x < f / 2; x += 0.5) {
          const inDoor = Math.abs(x) <= 0.4;
          const inWindow = Math.abs(Math.abs(x) - f / 4) <= 0.25;
          if (!inDoor && !inWindow) {
            hg.add(box(0.06, 2.2, 0.06, 0xb09a6a, x, 1.1, frontFace - 0.01));
          }
          hg.add(box(0.06, 2.2, 0.06, 0xb09a6a, x, 1.1, -frontFace + 0.01));
        }
        const sideDepth = f * 0.8;
        for (let z = -sideDepth / 2 + 0.25; z < sideDepth / 2; z += 0.5) {
          hg.add(box(0.06, 2.2, 0.06, 0xb09a6a, f / 2 - 0.01, 1.1, z));
          hg.add(box(0.06, 2.2, 0.06, 0xb09a6a, -f / 2 + 0.01, 1.1, z));
        }
        // Floor plane, inset within the wall footprint.
        hg.add(houseBox(f - 0.2, 0.04, f * 0.8 - 0.2, 0x8a7a5a, 0, 0.02, 0));
      } else {
        hg.add(houseBox(f, 2.6, f * 0.85, 0x7a5a38, 0, 1.3, 0));
        // Roof cone OPEN-ENDED (Adam, 2026-10-29 — the
        // thatch treatment, 349db1b, extended on his order):
        // the cone's default base cap was a flat fan ceiling
        // at 2.6; open, the sloped underside (DoubleSide via
        // houseRoof) is the ceiling.
        const roof = houseRoof(new THREE.ConeGeometry(f * 0.72, 1.6, 4, 1, true), 0x5a3d24);
        roof.position.y = 3.4;
        roof.rotation.y = Math.PI / 4;
        hg.add(roof);
        hg.add(houseBox(0.9, 1.8, 0.1, 0x3a2812, 0, 0.9, (f * 0.85) / 2 + 0.01));
        // Windows, porch posts, chimney.
        hg.add(houseBox(0.5, 0.5, 0.06, 0x2a2018, -f / 4, 1.5, (f * 0.85) / 2 + 0.01));
        hg.add(houseBox(0.5, 0.5, 0.06, 0x2a2018, f / 4, 1.5, (f * 0.85) / 2 + 0.01));
        hg.add(houseCyl(0.07, 0.07, 2.2, 0x6b4a2f, -f / 3, 1.1, (f * 0.85) / 2 + 0.4));
        hg.add(houseCyl(0.07, 0.07, 2.2, 0x6b4a2f, f / 3, 1.1, (f * 0.85) / 2 + 0.4));
        hg.add(houseBox(0.5, 1.0, 0.5, 0x8a8a86, f / 3, 3.6, -f / 4));
        // Floor plane, inset within the wall footprint.
        hg.add(houseBox(f - 0.2, 0.04, f * 0.85 - 0.2, 0x5a4028, 0, 0.02, 0));
      }
      group.add(hg);
    }
    for (const loom of loomState.snapshot()) {
      // Upright weaving frame: two posts, a top beam, warp
      // threads, a half-woven band, a shuttle on the band, a
      // diagonal brace, and a cloth roll at the foot.
      const lg = new THREE.Group();
      lg.position.set(loom.x, 0, loom.z);
      lg.add(cyl(0.06, 0.06, 1.6, 0x6b4a2f, -0.7, 0.8, 0));
      lg.add(cyl(0.06, 0.06, 1.6, 0x6b4a2f, 0.7, 0.8, 0));
      lg.add(box(1.6, 0.1, 0.1, 0x6b4a2f, 0, 1.6, 0));
      for (let i = 0; i < 7; i++) {
        lg.add(box(0.02, 1.1, 0.02, 0xd8c9a8, -0.6 + i * 0.2, 1.05, 0));
      }
      lg.add(box(1.3, 0.5, 0.05, 0x8a7a5a, 0, 0.75, 0));
      lg.add(box(0.3, 0.08, 0.08, 0x4a3220, 0.2, 0.75, 0.06));
      const brace = cyl(0.04, 0.04, 1.4, 0x6b4a2f, 0.7, 0.7, -0.3);
      brace.rotation.x = 0.6;
      lg.add(brace);
      const roll = cyl(0.12, 0.12, 1.0, 0x8a7a5a, 0, 0.12, 0.35);
      roll.rotation.z = Math.PI / 2;
      lg.add(roll);
      group.add(lg);
    }
    for (const torch of torchState.snapshot()) {
      // Planted torch (Adam 2026-10-27 — light an area or
      // path): the carried torch model, stuck upright in the
      // ground (planting look, my call — upright planted, not
      // leaning: a path light needs no wall to lean on), sunk
      // by PLACED_TORCH_SINK so it reads planted. Always lit:
      // the flame meshes are basic-material (read lit in
      // darkness) and the light below is always on. Scene-level
      // like all placed entities — chunk reload never touches
      // it, and save restore rebuilds it via the constructor's
      // initial rebuildPlacedGroup (torchState.restore first).
      const tg = new THREE.Group();
      tg.position.set(torch.x, -PLACED_TORCH_SINK, torch.z);
      tg.add(buildTorch());
      group.add(tg);
      this.addTorchLight(torch.x, torch.z);
    }
    for (const altar of altarState.snapshot()) {
      // Made ritual altar (Adam 2026-10-27 — placeable +
      // visible ONLY, no ritual actions): the stone-table +
      // clay-bowl graphic, sitting on the ground at the
      // placed position. Scene-level like all placed
      // entities — chunk reload never touches it, and save
      // restore rebuilds it via the constructor's initial
      // rebuildPlacedGroup (altarState.restore first). No
      // light: an altar is not a light source.
      const ag = new THREE.Group();
      ag.position.set(altar.x, 0, altar.z);
      ag.add(buildAltarGroup());
      group.add(ag);
    }
    for (const desk of deskState.snapshot()) {
      // Placed writing desk (Adam 2026-10-30 — placeable +
      // visible ONLY, no desk actions; the grimoire's
      // site): the all-wood desk graphic at the placed
      // position. Scene-level like all placed entities —
      // chunk reload never touches it, and save restore
      // rebuilds it via the constructor's initial
      // rebuildPlacedGroup (deskState.restore first). No
      // light: a desk is not a light source — the candle
      // that belongs on it someday is Adam's parked
      // design aside, not built, and no candle is drawn.
      const dg = new THREE.Group();
      dg.position.set(desk.x, 0, desk.z);
      dg.add(buildDeskGroup());
      group.add(dg);
    }
    for (const record of stumpState.snapshot()) {
      // Workbench overlay (Adam 2026-10-28 — stumpy
      // workstation upgrade): the stump base is RETAINED
      // (it stays in the instanced scatter, untouched —
      // one InstancedMesh per kind cannot carry a
      // per-stump overlay), and the workbench addition
      // draws ON TOP of it in the placed group: bench
      // slab + vise block, wood tones from the existing
      // palette. Slab bottom 0.62 clears the stump-top
      // disc (world 0.61) with no coplanar face.
      //
      // Altar dressing (2026-10-30): the transformation's
      // step members draw beside the workbench via
      // buildStumpDressing — stones ring / glyph / lit
      // candle, each appearing as its act completes. The
      // two coexist on one stump (additions accumulate);
      // the candle also gains its scene light here.
      const hasWorkbench = record.additions.includes('workstation');
      const dressing = buildStumpDressing(record.additions);
      if (!hasWorkbench && dressing.children.length === 0) continue;
      if (hasWorkbench) {
        const wg = new THREE.Group();
        wg.position.set(record.x, 0, record.z);
        wg.add(box(1.1, 0.08, 0.8, 0x7a5a38, 0, 0.66, 0));
        wg.add(box(0.25, 0.15, 0.2, 0x3a2818, 0.35, 0.775, 0));
        group.add(wg);
      }
      if (dressing.children.length > 0) {
        dressing.position.set(record.x, 0, record.z);
        group.add(dressing);
        if (record.additions.includes('altar-candle')) {
          this.addAltarCandleLight(record.x, record.z);
        }
      }
    }
    for (const tent of this.tents) {
      // A-frame tent (camping branch): triangular prism
      // (3-segment cylinder, axis rotated horizontal) in canvas,
      // dark door triangle on the +Z end, ground sheet under.
      // Prism radius 0.8 → 1.2 m tall (vertex-up after
      // rotation.x = -PI/2), 2 m long, ~1.39 m wide; centre
      // y 0.4 puts the flat side on the ground (triangle
      // vertices span -0.4..+0.8 rel. centre). No heading:
      // every tent faces +Z.
      const tg = new THREE.Group();
      tg.position.set(tent.x, 0, tent.z);
      const prism = cyl(0.8, 0.8, 2, 0x8a7a5a, 0, 0.4, 0, 3);
      prism.rotation.x = -Math.PI / 2;
      tg.add(prism);
      const doorShape = new THREE.Shape();
      doorShape.moveTo(-0.45, 0);
      doorShape.lineTo(0.45, 0);
      doorShape.lineTo(0, 0.9);
      doorShape.closePath();
      const door = new THREE.Mesh(new THREE.ShapeGeometry(doorShape), lambert(0x2a2018));
      door.position.set(0, 0.05, 1.01);
      tg.add(door);
      tg.add(box(1.6, 0.02, 2.2, 0x6a5a3a, 0, 0.01, 0));
      group.add(tg);
    }
    this.scene.add(group);
    this.placedGroup = group;
  }

  /**
   * Rebuild staged bones from the staging state (Adam
   * 2026-10-27 — tier-1 Waking, site side): one pale bone
   * per staged site, lying flat. Placement, measured at
   * build (flagged constants, not magic): made altar →
   * slab top 0.84 + bone half-height 0.05 = 0.89, offset
   * z +0.37 so the bone lies beside the bowl (bowl radius
   * 0.3, bone half-width 0.05 → clears by 0.02, inside the
   * 0.45 slab edge); stump → stump top 0.6 (baseY 0.3 +
   * geometry top 0.3) + 0.05 = 0.65, centred on the stump.
   * Boulder stagings draw NOTHING (no boulder objects
   * exist yet) — the state still holds them, and Systems'
   * completion logic reads state, not this group. Own
   * dispose pattern (same traverse as the placed group);
   * dispose() routes through setWorldGen, which clears
   * the state and rebuilds this group empty.
   */
  private rebuildStagedBones(): void {
    if (this.stagedBoneGroup) {
      this.scene.remove(this.stagedBoneGroup);
      this.stagedBoneGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      this.stagedBoneGroup = null;
    }
    const group = new THREE.Group();
    for (const staged of ritualSiteState.snapshot()) {
      if (staged.site.kind === 'boulder') continue;
      const bone = buildStagedBone();
      if (staged.site.kind === 'altar') {
        bone.position.set(staged.site.x, 0.89, staged.site.z + 0.37);
      } else {
        bone.position.set(staged.site.x, 0.65, staged.site.z);
      }
      group.add(bone);
    }
    this.scene.add(group);
    this.stagedBoneGroup = group;
  }

  /**
   * Rebuild camp arrows from the placed-house list (Adam
   * 2026-10-27 — big, obnoxious, pointing down from above):
   * one world arrow above EACH placed house (her camps,
   * plural — every house type is a camp), plus one
   * screen-edge arrow per house as a camera child (hidden
   * until its camp leaves the view). World arrows bob on
   * flameTime in the loop; edge arrows are repositioned
   * there per frame. Rebuilt on shelter:placed + setter
   * toggle paths; setWorldGen clears via the empty snapshot.
   */
  private rebuildCampArrows(): void {
    if (this.campArrowGroup) {
      this.scene.remove(this.campArrowGroup);
      this.campArrowGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      this.campArrowGroup = null;
    }
    for (const edge of this.campEdgeArrows) this.camera.remove(edge.mesh);
    this.campEdgeArrows = [];
    const group = new THREE.Group();
    for (const house of shelterState.snapshot()) {
      const arrow = buildCampArrow();
      arrow.position.set(house.x, CAMP_ARROW_CENTER_Y, house.z);
      arrow.userData.phase = flamePhase(house.x, house.z);
      arrow.userData.baseY = CAMP_ARROW_CENTER_Y;
      group.add(arrow);
      const edge = buildEdgeArrow();
      edge.visible = false;
      this.camera.add(edge);
      this.campEdgeArrows.push({ mesh: edge, house });
    }
    group.visible = this.arrowsVisible();
    this.scene.add(group);
    this.campArrowGroup = group;
  }

  /**
   * Rebuild the dropped-pile meshes (harvest overflow, Adam
   * 2026-10-26): one heap + marker flag per pile, phone-cheap
   * (3 meshes per pile, piles are few). The heap is a flattened
   * burlap mound; the flag is a small warm-yellow pennant on a
   * stick so a pile reads at a glance against marsh ground — the
   * quantity lives on the proximity channel (piles:inRange), not
   * in the mesh, so size stays constant and no per-pile scaling
   * logic can drift from state. NOT chunk-filtered, like the
   * placed group: a pile dropped anywhere must render.
   */
  private rebuildPileGroup(): void {
    if (this.pileGroup) {
      this.scene.remove(this.pileGroup);
      this.pileGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      this.pileGroup = null;
    }
    const group = new THREE.Group();
    for (const pile of pileState.snapshot()) {
      const pg = new THREE.Group();
      const heap = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), lambert(0x8a7a5a));
      heap.scale.y = 0.45;
      heap.position.y = 0.16;
      pg.add(heap);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), lambert(0x6b4a2f));
      pole.position.set(0.25, 0.45, 0);
      pg.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.02), lambert(0xd8b040));
      flag.position.set(0.39, 0.82, 0);
      // Crow pile-glow: the flag carries the glow (heap/pole
      // unchanged). Emissive in the flag's own warm yellow, at
      // the current tier's intensity (base slight at tier 0,
      // bright at tier ≥ 1 — see crow.ts; setCrowTier updates
      // existing flags in place, rebuild applies it to new ones).
      flag.userData.isPileFlag = true;
      const flagMat = flag.material as THREE.MeshLambertMaterial;
      flagMat.emissive.set(CROW_GLOW_EMISSIVE);
      flagMat.emissiveIntensity = crowGlowIntensity(this.crowTier);
      pg.add(flag);
      pg.position.set(pile.x, 0, pile.z);
      group.add(pg);
    }
    this.scene.add(group);
    this.pileGroup = group;
  }

  /**
   * One trap's ground marker (lane-decided, flagged for Adam's
   * pin pass — simple, readable at a glance, no behavior):
   * snare = flat loop + 2 stakes; weir = woven basket + rim;
   * pot = terracotta pot; pitfall = dark disc + moss ring;
   * deadfall = log + stone weight.
   */
  private trapMarker(type: TrapType): THREE.Group {
    const g = new THREE.Group();
    const add = (mesh: THREE.Mesh, x = 0, y = 0, z = 0): void => {
      mesh.position.set(x, y, z);
      g.add(mesh);
    };
    if (type === 'snare') {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 12), lambert(0x6a6a3a));
      loop.rotation.x = -Math.PI / 2;
      add(loop, 0, 0.05, 0);
      const stakeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5);
      const s1 = new THREE.Mesh(stakeGeo, lambert(0x6b4a2f));
      s1.rotation.z = 0.15;
      add(s1, -0.2, 0.2, 0);
      const s2 = new THREE.Mesh(stakeGeo, lambert(0x6b4a2f));
      s2.rotation.z = -0.15;
      add(s2, 0.2, 0.2, 0);
    } else if (type === 'fish-weir-trap') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.35, 10), lambert(0x8a7a4a)), 0, 0.18, 0);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 12), lambert(0x8a7a4a));
      rim.rotation.x = -Math.PI / 2;
      add(rim, 0, 0.35, 0);
    } else if (type === 'pot-trap') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.3, 10), lambert(0xb06a3a)), 0, 0.15, 0);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 12), lambert(0xb06a3a));
      rim.rotation.x = -Math.PI / 2;
      add(rim, 0, 0.3, 0);
    } else if (type === 'pitfall') {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.45, 14), lambert(0x140e06));
      disc.rotation.x = -Math.PI / 2;
      add(disc, 0, 0.02, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 6, 14), lambert(0x4a5a2a));
      ring.rotation.x = -Math.PI / 2;
      add(ring, 0, 0.03, 0);
    } else {
      // deadfall
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), lambert(0x6b4a2f));
      log.rotation.z = Math.PI / 2;
      add(log, 0, 0.12, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), lambert(0x78716c)), 0, 0.39, 0);
    }
    return g;
  }

  /** Rebuild the placed-trap markers from live trapState (pile-group pattern). */
  private rebuildTrapGroup(): void {
    if (this.trapGroup) {
      this.scene.remove(this.trapGroup);
      this.trapGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      this.trapGroup = null;
    }
    const group = new THREE.Group();
    for (const trap of trapState.snapshot()) {
      const marker = this.trapMarker(trap.type);
      marker.position.set(trap.x, 0, trap.z);
      group.add(marker);
    }
    this.scene.add(group);
    this.trapGroup = group;
  }

  /** Rebuild the spawned-object meshes for currently loaded chunks:
   *  spawned logs (full-size) and saplings (tree mesh + canopy,
   *  scaled 0.3 → 1.0 by growth over SAPLING_GROWTH_MS). */
  private rebuildSpawnedGroup(): void {
    if (this.spawnedGroup) {
      this.scene.remove(this.spawnedGroup);
      for (const child of this.spawnedGroup.children) {
        if (child instanceof THREE.InstancedMesh) child.dispose();
      }
      this.spawnedGroup = null;
    }
    const group = new THREE.Group();
    const dummy = new THREE.Object3D();
    const logRender = KIND_RENDER['log'];
    const logs = harvestState
      .spawnedLogsSnapshot()
      .filter((log) => this.chunks.has(this.chunkKey(log.cx, log.cz)));
    if (logs.length > 0) {
      const mesh = new THREE.InstancedMesh(logRender.geometry, logRender.material, logs.length);
      logs.forEach((log, i) => {
        dummy.position.set(log.x, logRender.baseY, log.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }
    const now = Date.now();
    const saplings = harvestState
      .spawnedTreesSnapshot()
      .filter((sapling) => this.chunks.has(this.chunkKey(sapling.cx, sapling.cz)));
    if (saplings.length > 0) {
      // Saplings draw in their spot's kind (Adam, 2026-10-30 —
      // kind belongs to the ground): oak-spot saplings grow up
      // in the oak's broader shape, the rest in the common
      // tree's, one instanced mesh per kind.
      const byKind: { tree: typeof saplings; oakTree: typeof saplings } = { tree: [], oakTree: [] };
      for (const sapling of saplings) {
        byKind[treeKindAt(this.gen.seed, sapling.x, sapling.z) === 'oak' ? 'oakTree' : 'tree'].push(sapling);
      }
      for (const kind of ['tree', 'oakTree'] as const) {
        const list = byKind[kind];
        if (list.length === 0) continue;
        const kindRender = KIND_RENDER[kind];
        const mesh = new THREE.InstancedMesh(kindRender.geometry, kindRender.material, list.length);
        list.forEach((sapling, i) => {
          const s = 0.3 + 0.7 * harvestState.saplingGrowth(sapling, now);
          dummy.position.set(sapling.x, kindRender.baseY * s, sapling.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
      }
      // No extra branch: the sapling canopy rides inside the merged
      // tree geometry (models.ts), scaled with the trunk.
    }
    this.scene.add(group);
    this.spawnedGroup = group;
  }

  /**
   * Pose an animal group from its instance state (animals.ts):
   * position + bob height + facing, wings fluttering while
   * flying and folded while perched (userData.wings = [left,
   * right], inner edge at the body, so rotation.z flaps them
   * around the body edge — left negative, right positive).
   */
  private poseAnimal(instance: AnimalInstance, group: THREE.Group): void {
    group.position.set(instance.x, instance.y + instance.bob, instance.z);
    group.rotation.set(0, instance.heading, 0);
    const wings = group.userData.wings as THREE.Mesh[] | undefined;
    if (wings && wings.length === 2) {
      const flutter = instance.flying ? 0.15 + 0.6 * Math.sin(instance.wingPhase) : 0;
      wings[0].rotation.z = -flutter;
      wings[1].rotation.z = flutter;
    }
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    // PAUSE GATE (Adam 2026-10-26 — see pause.ts): while paused
    // the loop schedules its next frame but simulates nothing —
    // no player update, no sky advance, no world tick, no render.
    // The canvas keeps its last frame, so the view reads frozen.
    // getDelta is still consumed above so resume sees no spike
    // (the 0.1 clamp would cap it anyway). NOTHING here sets or
    // clears the flag — the trigger (visibilitychange and/or
    // blur) is Adam's open choice and plugs into
    // pauseState.setPaused + the 'game:pause-changed' event.
    if (pauseState.isPaused()) return;
    this.player.update(dt);
    // Animals: behavior step + pose, right after the player
    // moves (flee reads the fresh player position). Pause-safe:
    // the pause gate above already returns before this line.
    // Night reads last frame's sky factor (sky updates later in
    // this loop) — a one-frame lag, invisible in practice.
    const night = (this.sky?.nightFactor ?? 0) >= 0.5;
    for (const loaded of this.chunks.values()) {
      for (const pair of loaded.animals) {
        updateAnimal(pair.instance, dt, {
          playerX: this.player.x,
          playerZ: this.player.z,
          night,
        });
        this.poseAnimal(pair.instance, pair.group);
      }
    }
    this.stream();
    this.worldTickAcc += dt;
    if (this.worldTickAcc >= 2) {
      this.worldTickAcc = 0;
      this.worldTick();
    }

    // Flame flicker: every flame mesh pulses around its base
    // scale, leans from its base, and breathes color — each cycle
    // on its own frequency and phase so fires never read as a
    // metronome. Fire lights flicker with their flames (same
    // flameTime, so pause freezes both together).
    this.flameTime += dt;
    // Smoke column: each billboard loops a slow rise off the
    // same clock — swelling and fading as it climbs, leaning
    // with a light wind. Eleven sprites, no allocation.
    for (let i = 0; i < this.smokeSprites.length; i++) {
      const sprite = this.smokeSprites[i];
      const phase = (this.flameTime / SMOKE_RISE_PERIOD_S + i / SMOKE_SPRITE_COUNT) % 1;
      const size = 7 + phase * 16;
      sprite.scale.set(size, size, 1);
      sprite.position.set(
        Math.sin(phase * 4.5 + i * 1.7) * 1.2 + phase * 7,
        phase * SMOKE_HEIGHT_M,
        phase * 2.5,
      );
      (sprite.material as THREE.SpriteMaterial).opacity =
        SMOKE_PEAK_OPACITY * Math.sin(Math.PI * phase);
    }
    if (this.placedGroup) {
      this.placedGroup.traverse((obj) => {
        if (obj.userData.flame) {
          const phase = obj.userData.phase as number;
          const s = 1 + 0.18 * Math.sin(this.flameTime * 13 + phase);
          obj.scale.set(s, 1 + 0.25 * Math.sin(this.flameTime * 17 + phase), s);
          // Lean: the flame sways from its base, out of phase
          // with its size pulse.
          obj.rotation.z = 0.05 * Math.sin(this.flameTime * 9 + phase);
          // Color breathes between deep orange and bright gold;
          // the inner core runs a faster, offset cycle so the two
          // cones never shift in lockstep. Materials are per-flame
          // (flameMesh builds fresh ones), so this touches only
          // this flame.
          const outer = obj.children[0];
          const inner = obj.children[1];
          if (outer instanceof THREE.Mesh && outer.material instanceof THREE.MeshBasicMaterial) {
            outer.material.color.lerpColors(FLAME_OUTER_A, FLAME_OUTER_B, 0.5 + 0.5 * Math.sin(this.flameTime * 11 + phase * 1.3 + 0.9));
          }
          if (inner instanceof THREE.Mesh && inner.material instanceof THREE.MeshBasicMaterial) {
            inner.material.color.lerpColors(FLAME_INNER_A, FLAME_INNER_B, 0.5 + 0.5 * Math.sin(this.flameTime * 14 + phase + 2.1));
          }
          // Inner core counter-pulses against the group scale.
          if (inner) {
            inner.scale.set(
              1 + 0.15 * Math.sin(this.flameTime * 19 + phase + 1.3),
              1 + 0.2 * Math.sin(this.flameTime * 15 + phase + 0.7),
              1 + 0.15 * Math.sin(this.flameTime * 19 + phase + 1.3),
            );
          }
        }
      });
    }
    for (const light of this.fireLights) {
      light.intensity =
        FIRE_LIGHT_INTENSITY *
        (1 + FIRE_LIGHT_FLICKER_AMPLITUDE * fireLightFlicker(this.flameTime, light.userData.phase as number));
    }
    // Placed-torch lights flicker the same way, at the torch
    // amplitude, each with its own position-hash phase so a
    // path of torches does not sync.
    for (const light of this.torchLights) {
      light.intensity =
        TORCH_LIGHT_INTENSITY *
        (1 + TORCH_FLICKER_AMPLITUDE * fireLightFlicker(this.flameTime, light.userData.phase as number));
    }
    // Altar-candle lights flicker at the candle amplitude —
    // a set candle dances least of all.
    for (const light of this.altarCandleLights) {
      light.intensity =
        CANDLE_LIGHT_INTENSITY *
        (1 + CANDLE_FLICKER_AMPLITUDE * fireLightFlicker(this.flameTime, light.userData.phase as number));
    }

    // Witch mesh follows the player; hidden in first-person.
    // yOffset is the jump arc (player.ts, 2026-10-29): the witch
    // and every camera height below ride it, so a hop reads in
    // all three views. It is 0 whenever she is grounded.
    this.witch.position.set(this.player.x, this.player.yOffset, this.player.z);
    this.witch.rotation.y = this.player.facing;
    this.witch.visible = this.player.mode !== 'first';

    // Hand light: exactly one shines — torch while a lit
    // torch is carried (superseding the candle), else the
    // candle. Each light follows its own flame's world
    // position; the dark one sits at intensity 0.
    if (this.carriesLitTorch) {
      this.candleLight.intensity = 0;
      const [ox, oz] = rotateOffsetY(TORCH_HAND.x, TORCH_HAND.z, this.player.facing);
      this.torchLight.position.set(
        this.player.x + ox,
        TORCH_HAND.y + TORCH_FLAME_Y,
        this.player.z + oz,
      );
      const flick = (Math.sin(this.flameTime * 10) + Math.sin(this.flameTime * 23 + 1.7)) / 2;
      this.torchLight.intensity = TORCH_LIGHT_INTENSITY * (1 + TORCH_FLICKER_AMPLITUDE * flick);
    } else {
      this.torchLight.intensity = 0;
      // Carried-candle light follows the flame's world position:
      // the hand offset rotated by facing (same Y-rotation the
      // witch group itself uses), at flame height. Flicker is a
      // small mixed-sine wobble on flameTime — deterministic,
      // never random — in the same spirit as the fire flames.
      {
        const [ox, oz] = rotateOffsetY(CANDLE_HAND.x, CANDLE_HAND.z, this.player.facing);
        this.candleLight.position.set(
          this.player.x + ox,
          CANDLE_HAND.y + CANDLE_FLAME_Y,
          this.player.z + oz,
        );
        const flick = (Math.sin(this.flameTime * 10) + Math.sin(this.flameTime * 23 + 1.7)) / 2;
        this.candleLight.intensity = CANDLE_LIGHT_INTENSITY * (1 + CANDLE_FLICKER_AMPLITUDE * flick);
      }
    }

    if (this.player.mode === 'first') {
      this.camera.position.set(
        this.player.x,
        PLAYER_EYE_HEIGHT + this.player.yOffset,
        this.player.z,
      );
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(this.player.pitch, this.player.yaw, 0);
    } else if (this.player.mode === 'behind') {
      // Behind-the-witch follow (over-shoulder height): the
      // camera sits behind her facing, looking past her at
      // the ground ahead — her back in frame low, the view
      // ahead dominating. Forward from facing is (sin facing,
      // cos facing); distances/heights are the BEHIND_*
      // tunables in constants (starting values for Adam's
      // pin pass). Not the overhead map view, not ground
      // level where she would block the view.
      const fx = Math.sin(this.player.facing);
      const fz = Math.cos(this.player.facing);
      this.camera.position.set(
        this.player.x - fx * BEHIND_CAMERA_DISTANCE,
        BEHIND_CAMERA_HEIGHT + this.player.yOffset,
        this.player.z - fz * BEHIND_CAMERA_DISTANCE,
      );
      this.camera.lookAt(
        this.player.x + fx * BEHIND_LOOK_AHEAD,
        BEHIND_LOOK_HEIGHT + this.player.yOffset,
        this.player.z + fz * BEHIND_LOOK_AHEAD,
      );
    } else {
      this.camera.position.set(
        this.player.x + THIRD_PERSON_OFFSET.x,
        THIRD_PERSON_OFFSET.y,
        this.player.z + THIRD_PERSON_OFFSET.z,
      );
      this.camera.lookAt(this.player.x, this.player.yOffset, this.player.z);
    }

    // Sky: day/night driver + sun/moon/stars/clouds + lights.
    // Month stays the season-start input (no calendar yet — see
    // sky.ts); weather is the seasonal query at her position.
    this.sky?.update(dt, {
      month: SEASON_START_MONTH,
      weather: seasonalWeatherAt(this.gen, this.player.x, this.player.z, SEASON_START_MONTH),
      playerX: this.player.x,
      playerZ: this.player.z,
    });

    // Bat wing bone — night way-finding (tier-1 charm,
    // DRAFT factor): fog thins at night while carried +
    // awakened, scaled by the sky's night factor (full
    // night −30%, twilight partial, day untouched).
    // Distinct from owl by construction: owl is light,
    // bat is fog.
    const fog = this.scene.fog;
    if (fog instanceof THREE.FogExp2) {
      if (this.gen.dimensionKey) {
        // Underground: the cave's own thick fog, whatever
        // the surface night is doing.
        fog.density = CAVE_FOG_DENSITY;
      } else {
        const night = this.sky?.nightFactor ?? 0;
        fog.density = this.batNightWayfinding
          ? FOG_DENSITY * (1 - (1 - BAT_FOG_FACTOR) * night)
          : FOG_DENSITY;
      }
    }

    // Camp arrows, after this frame's camera transform is set:
    // world arrows bob (visible while scry or pigeon is on); edge arrows track off-screen camps per frame
    // (camera children, so they ride every view). updateMatrix
    // World first — project() needs this frame's matrices, not
    // last frame's (render would refresh them too late).
    if (this.arrowsVisible() && this.campArrowGroup) {
      for (const arrow of this.campArrowGroup.children) {
        arrow.position.y =
          (arrow.userData.baseY as number) +
          CAMP_ARROW_BOB * Math.sin(this.flameTime * 2 + (arrow.userData.phase as number));
      }
      this.camera.updateMatrixWorld();
      const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * CAMP_EDGE_DEPTH;
      const halfW = halfH * this.camera.aspect;
      this.camera.getWorldDirection(this.edgeForward);
      for (const edge of this.campEdgeArrows) {
        this.edgeAnchor.set(edge.house.x, CAMP_ARROW_CENTER_Y, edge.house.z);
        this.edgeToCamp.copy(this.edgeAnchor).sub(this.camera.position);
        const behind = this.edgeToCamp.dot(this.edgeForward) < 0;
        this.edgeAnchor.project(this.camera);
        const t = edgeArrowTransform(this.edgeAnchor.x, this.edgeAnchor.y, behind);
        if (!t.offScreen) { edge.mesh.visible = false; continue; }
        edge.mesh.visible = true;
        edge.mesh.position.set(t.x * halfW, t.y * halfH, -CAMP_EDGE_DEPTH);
        edge.mesh.rotation.set(0, 0, t.angle);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };
}
