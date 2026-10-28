/**
 * Ambient animals (Adam 2026-10-28 — "build out the animals,
 * behaviors, simple animations, likely locations, etc").
 *
 * AMBIENT FIRST, NOT COMBAT: the first threat stays
 * weather/survival. Bear and wolf are ambient here (wander,
 * avoid/flee) — no threat, no hostility, no hunting (hunting
 * is NOT v1 — no weapons system). Traps stay abstract (the
 * 5%/hour rolls) — world animals do not feed traps. Bone
 * scatters stay as they are — living animals drop nothing v1.
 *
 * ROSTER (26, exactly as briefed — no new kinds, no cuts):
 * the 17 bone kinds + the trap set's new kinds + shrew.
 * Mouse AND mice are both on the roster as briefed (bone vs
 * trap) — two entries here; the pin pass may merge them (25).
 * Deer is ambient only — its trap assignment stays open and
 * is NOT settled here. No HUD/panel — animals are visible in
 * the world, nothing more.
 *
 * SPAWN IS WORLDGEN (seeded, no Math.random): chunk animals
 * derive from the world seed via deriveSeed + mulberry32, the
 * same pattern as scatter. Gameplay-time behavior (target
 * re-picks, phase timers) uses Math.random — that is gameplay
 * randomness, not worldgen, and is allowed.
 *
 * PERSISTENCE: none. Deterministic respawn from seed on chunk
 * load IS the v1 continuity — the same chunk always spawns the
 * same animals at the same home centers; a wandered animal
 * resets to its spawn on chunk reload. Wandered-position
 * persistence would be a save change, not this landing.
 *
 * This module is pure state math (no THREE, no DOM) so the
 * probe can drive it headlessly. The renderer owns meshes
 * (models.buildAnimal) and poses groups from instance state.
 */

import { deriveSeed, mulberry32 } from './seed';
import type { BiomeId } from '../types';

export type AnimalKind =
  | 'owl'
  | 'bat'
  | 'pigeon'
  | 'beaver'
  | 'turtle'
  | 'deer'
  | 'fox'
  | 'mole'
  | 'snake'
  | 'mouse'
  | 'bear'
  | 'rabbit'
  | 'raccoon'
  | 'wolf'
  | 'crow'
  | 'frog'
  | 'groundhog'
  | 'squirrel'
  | 'crayfish'
  | 'muskrat'
  | 'mice'
  | 'voles'
  | 'fish'
  | 'eels'
  | 'opossum'
  | 'shrew';

export const ANIMAL_KINDS: AnimalKind[] = [
  'owl', 'bat', 'pigeon', 'beaver', 'turtle', 'deer', 'fox', 'mole',
  'snake', 'mouse', 'bear', 'rabbit', 'raccoon', 'wolf', 'crow', 'frog',
  'groundhog', 'squirrel', 'crayfish', 'muskrat', 'mice', 'voles',
  'fish', 'eels', 'opossum', 'shrew',
];

export type Temperament = 'skittish' | 'indifferent' | 'curious' | 'wary';
export type AnimalMovement = 'ground' | 'water' | 'fly';
export type AnimalAnim = 'bob' | 'hop' | 'swim' | 'flutter';
/**
 * How a kind flees (DRAFT for Adam's pin pass — proposed here,
 * shaped by him, not baked silently): 'straight' runs directly
 * away; 'zigzag' weaves ±ZIGZAG_ANGLE_RAD around the away line,
 * alternating each re-target; 'cover' runs for home (burrow /
 * lodge) and holds there while the player stays close; 'freeze'
 * holds still instead of fleeing (opossum playing dead, turtle
 * pulled in). Flyers carry 'straight' — their perch-height
 * handling is separate and unchanged.
 */
export type FleeStyle = 'straight' | 'zigzag' | 'cover' | 'freeze';

export interface AnimalDef {
  /** Biomes the kind lives in (lane-decided DRAFT for Adam's pin pass). */
  biomes: BiomeId[];
  temperament: Temperament;
  movement: AnimalMovement;
  anim: AnimalAnim;
  flee: FleeStyle;
  /**
   * Ground-wander radius in meters (DRAFT for Adam's pin pass).
   * Read ONLY by the ground branch of pickWanderTarget — water
   * and fly kinds wander by anchor picks, not by this number.
   */
  wanderRange: number;
  /** Owl + bat fly at night; everything else is active by day. */
  active: 'night' | 'day';
}

export const ANIMAL_DEFS: Record<AnimalKind, AnimalDef> = {
  owl: { biomes: ['forest', 'tanglewood'], temperament: 'wary', movement: 'fly', anim: 'flutter', active: 'night', flee: 'straight', wanderRange: 8 },
  bat: { biomes: ['forest', 'tanglewood'], temperament: 'skittish', movement: 'fly', anim: 'flutter', active: 'night', flee: 'straight', wanderRange: 8 },
  pigeon: { biomes: ['meadow', 'oldfieldRise', 'forest'], temperament: 'skittish', movement: 'fly', anim: 'flutter', active: 'day', flee: 'straight', wanderRange: 8 },
  beaver: { biomes: ['creekBottom', 'mirewood'], temperament: 'wary', movement: 'water', anim: 'swim', active: 'day', flee: 'cover', wanderRange: 8 },
  turtle: { biomes: ['creekBottom', 'mirewood'], temperament: 'indifferent', movement: 'water', anim: 'swim', active: 'day', flee: 'freeze', wanderRange: 8 },
  deer: { biomes: ['meadow', 'forest', 'oldfieldRise'], temperament: 'wary', movement: 'ground', anim: 'bob', active: 'day', flee: 'straight', wanderRange: 12 },
  fox: { biomes: ['forest', 'oldfieldRise', 'meadow'], temperament: 'wary', movement: 'ground', anim: 'bob', active: 'day', flee: 'straight', wanderRange: 10 },
  mole: { biomes: ['meadow', 'oldfieldRise', 'forest'], temperament: 'indifferent', movement: 'ground', anim: 'bob', active: 'day', flee: 'straight', wanderRange: 3 },
  snake: { biomes: ['meadow', 'creekBottom', 'oldfieldRise'], temperament: 'skittish', movement: 'ground', anim: 'bob', active: 'day', flee: 'straight', wanderRange: 8 },
  mouse: { biomes: ['meadow', 'oldfieldRise', 'forest'], temperament: 'skittish', movement: 'ground', anim: 'hop', active: 'day', flee: 'zigzag', wanderRange: 3 },
  bear: { biomes: ['forest', 'tanglewood'], temperament: 'wary', movement: 'ground', anim: 'bob', active: 'day', flee: 'straight', wanderRange: 10 },
  rabbit: { biomes: ['meadow', 'oldfieldRise', 'forest'], temperament: 'skittish', movement: 'ground', anim: 'hop', active: 'day', flee: 'zigzag', wanderRange: 8 },
  raccoon: { biomes: ['forest', 'creekBottom', 'mirewood'], temperament: 'curious', movement: 'ground', anim: 'bob', active: 'day', flee: 'straight', wanderRange: 8 },
  wolf: { biomes: ['forest', 'tanglewood', 'meadow'], temperament: 'wary', movement: 'ground', anim: 'bob', active: 'day', flee: 'straight', wanderRange: 12 },
  crow: { biomes: ['meadow', 'oldfieldRise', 'forest'], temperament: 'curious', movement: 'fly', anim: 'flutter', active: 'day', flee: 'straight', wanderRange: 8 },
  frog: { biomes: ['creekBottom', 'mirewood', 'deepBog'], temperament: 'indifferent', movement: 'water', anim: 'hop', active: 'day', flee: 'straight', wanderRange: 8 },
  groundhog: { biomes: ['meadow', 'oldfieldRise'], temperament: 'wary', movement: 'ground', anim: 'bob', active: 'day', flee: 'cover', wanderRange: 3 },
  squirrel: { biomes: ['forest', 'tanglewood', 'oldfieldRise'], temperament: 'skittish', movement: 'ground', anim: 'hop', active: 'day', flee: 'zigzag', wanderRange: 8 },
  crayfish: { biomes: ['creekBottom', 'mirewood'], temperament: 'indifferent', movement: 'water', anim: 'swim', active: 'day', flee: 'straight', wanderRange: 8 },
  muskrat: { biomes: ['creekBottom', 'mirewood', 'deepBog'], temperament: 'wary', movement: 'water', anim: 'swim', active: 'day', flee: 'cover', wanderRange: 8 },
  mice: { biomes: ['meadow', 'oldfieldRise'], temperament: 'skittish', movement: 'ground', anim: 'hop', active: 'day', flee: 'zigzag', wanderRange: 3 },
  voles: { biomes: ['meadow', 'creekBottom'], temperament: 'skittish', movement: 'ground', anim: 'hop', active: 'day', flee: 'zigzag', wanderRange: 3 },
  fish: { biomes: ['creekBottom', 'mirewood'], temperament: 'skittish', movement: 'water', anim: 'swim', active: 'day', flee: 'straight', wanderRange: 8 },
  eels: { biomes: ['creekBottom', 'mirewood'], temperament: 'skittish', movement: 'water', anim: 'swim', active: 'day', flee: 'straight', wanderRange: 8 },
  opossum: { biomes: ['forest', 'oldfieldRise', 'tanglewood'], temperament: 'skittish', movement: 'ground', anim: 'bob', active: 'day', flee: 'freeze', wanderRange: 8 },
  shrew: { biomes: ['forest', 'meadow'], temperament: 'skittish', movement: 'ground', anim: 'hop', active: 'day', flee: 'zigzag', wanderRange: 3 },
};

/** Draft tunables (all flagged for Adam's pin pass). */
/** Default ground-wander radius; per-kind wanderRange in ANIMAL_DEFS now governs ground wander. */
export const HOME_RANGE_M = 8;
export const FLEE_RADIUS_M = 4;
export const WARY_FLEE_RADIUS_M = 8;
export const WANDER_SPEED_MPS = 1;
export const FLEE_SPEED_MPS = 1.5;
/** Zigzag half-angle off the away line, radians (DRAFT, ~34°). */
export const ZIGZAG_ANGLE_RAD = 0.6;
/** A cover animal this close to home counts as home and holds. */
export const COVER_HOME_EPSILON_M = 0.5;
export const MAX_PER_CHUNK = 3;
/** A biome counts as present in a chunk at this blended weight or more. */
export const BIOME_WEIGHT_MIN = 0.15;
export const PERCH_HEIGHT_M = 2.0;
export const WATER_Y = 0.05;

export interface AnimalPoint {
  x: number;
  z: number;
}

export type AnimalMode = 'wander' | 'idle' | 'flee' | 'perched' | 'fly';

export interface AnimalInstance {
  kind: AnimalKind;
  x: number;
  z: number;
  /** Height above ground (perch height for perched flyers, WATER_Y for swimmers). */
  y: number;
  homeX: number;
  homeZ: number;
  /** Facing, radians — renderer sets group rotation.y from this. */
  heading: number;
  mode: AnimalMode;
  /** True while a flying kind is in transit (wings flutter; folded when perched). */
  flying: boolean;
  /** Vertical animation offset — renderer adds it to group.position.y. */
  bob: number;
  wingPhase: number;
  phase: number;
  targetX: number;
  targetZ: number;
  targetY: number;
  timer: number;
  perchY: number;
  /** Zigzag side flag — toggled on each flee re-target (zigzag kinds only). */
  fleeTurn: boolean;
  /** Water points (water kinds) / perch points (flying kinds) in this chunk. */
  anchors: AnimalPoint[];
}

export interface SpawnAnimalsInput {
  seed: string;
  cx: number;
  cz: number;
  weightsAt: (x: number, z: number) => { weights: Record<BiomeId, number> };
  riverPoints: AnimalPoint[];
  pondPoints: AnimalPoint[];
  treePoints: AnimalPoint[];
}

function pickWanderTarget(
  a: AnimalInstance,
  def: AnimalDef,
): { x: number; z: number; y: number } {
  if (def.movement === 'water' && a.anchors.length > 0) {
    const near = a.anchors.filter(
      (p) => Math.hypot(p.x - a.homeX, p.z - a.homeZ) <= 15,
    );
    const pool = near.length > 0 ? near : a.anchors;
    const p = pool[Math.floor(Math.random() * pool.length)];
    return { x: p.x, z: p.z, y: WATER_Y };
  }
  if (def.movement === 'fly' && a.anchors.length > 0) {
    const near = a.anchors.filter(
      (p) => Math.hypot(p.x - a.homeX, p.z - a.homeZ) <= 15,
    );
    const pool = near.length > 0 ? near : a.anchors;
    const p = pool[Math.floor(Math.random() * pool.length)];
    return { x: p.x, z: p.z, y: a.perchY };
  }
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * def.wanderRange;
  return {
    x: a.homeX + Math.cos(angle) * dist,
    z: a.homeZ + Math.sin(angle) * dist,
    y: def.movement === 'fly' ? a.perchY : a.y,
  };
}

/**
 * Deterministic chunk spawn (worldgen — seeded, no Math.random).
 * Eligible kinds = kinds whose biomes appear at ≥ BIOME_WEIGHT_MIN
 * in any of 5 samples (chunk center + 4 quadrant centers), with
 * water kinds additionally requiring a water point in the chunk.
 * Count = 0..MAX_PER_CHUNK, kinds drawn without replacement —
 * sparse ambient, not herds.
 */
export function spawnAnimalsForChunk(input: SpawnAnimalsInput): AnimalInstance[] {
  const { seed, cx, cz } = input;
  const rng = mulberry32(deriveSeed(seed, `animals:${cx},${cz}`));
  const x0 = cx * 32;
  const z0 = cz * 32;
  const present = new Set<BiomeId>();
  const samples: AnimalPoint[] = [
    { x: x0 + 16, z: z0 + 16 },
    { x: x0 + 8, z: z0 + 8 },
    { x: x0 + 24, z: z0 + 8 },
    { x: x0 + 8, z: z0 + 24 },
    { x: x0 + 24, z: z0 + 24 },
  ];
  for (const s of samples) {
    const { weights } = input.weightsAt(s.x, s.z);
    for (const id of Object.keys(weights) as BiomeId[]) {
      if (weights[id] >= BIOME_WEIGHT_MIN) present.add(id);
    }
  }
  const waterPoints = [...input.riverPoints, ...input.pondPoints];
  const eligible = ANIMAL_KINDS.filter((kind) => {
    const def = ANIMAL_DEFS[kind];
    if (!def.biomes.some((b) => present.has(b))) return false;
    if (def.movement === 'water' && waterPoints.length === 0) return false;
    return true;
  });
  // Fisher-Yates with the chunk rng (seeded) — draw without replacement.
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }
  const count = Math.min(eligible.length, Math.floor(rng() * (MAX_PER_CHUNK + 1)));
  const out: AnimalInstance[] = [];
  for (let i = 0; i < count; i++) {
    const kind = eligible[i];
    const def = ANIMAL_DEFS[kind];
    const base: AnimalInstance = {
      kind,
      x: 0,
      z: 0,
      y: 0,
      homeX: 0,
      homeZ: 0,
      heading: rng() * Math.PI * 2,
      mode: 'idle',
      flying: false,
      bob: 0,
      wingPhase: rng() * Math.PI * 2,
      phase: rng() * Math.PI * 2,
      targetX: 0,
      targetZ: 0,
      targetY: 0,
      timer: 1 + rng() * 3,
      perchY: 0,
      fleeTurn: false,
      anchors: [],
    };
    if (def.movement === 'water') {
      const p = waterPoints[Math.floor(rng() * waterPoints.length)];
      base.x = p.x + (rng() * 2 - 1) * 0.5;
      base.z = p.z + (rng() * 2 - 1) * 0.5;
      base.y = WATER_Y;
      base.homeX = p.x;
      base.homeZ = p.z;
      base.anchors = waterPoints;
    } else if (def.movement === 'fly') {
      base.anchors = input.treePoints;
      if (input.treePoints.length > 0) {
        const p = input.treePoints[Math.floor(rng() * input.treePoints.length)];
        base.x = p.x;
        base.z = p.z;
        base.perchY = PERCH_HEIGHT_M;
      } else {
        // No trees in this chunk — low perch (ground point), still perched.
        base.x = x0 + rng() * 32;
        base.z = z0 + rng() * 32;
        base.perchY = 0.4;
      }
      base.y = base.perchY;
      base.homeX = base.x;
      base.homeZ = base.z;
      base.mode = 'perched';
    } else {
      base.x = x0 + rng() * 32;
      base.z = z0 + rng() * 32;
      base.y = 0;
      base.homeX = base.x;
      base.homeZ = base.z;
    }
    base.targetX = base.x;
    base.targetZ = base.z;
    base.targetY = base.y;
    out.push(base);
  }
  return out;
}

/**
 * Trap presence at ONE point (the trap's position): kinds whose
 * ANIMAL_DEFS biomes appear at ≥ BIOME_WEIGHT_MIN (0.15, the decided
 * threshold — one presence rule everywhere) in weightsAt(x, z).
 * Single-point variant of the spawn rule above (which samples 5
 * points per chunk); NO water-point refinement in v1 (trap sets
 * already encode water plausibility) and no shrew special-casing
 * (shrew is in no trap set, so the shell's intersection drops it).
 * The shell feeds this list to Systems' eligibleKindsFor.
 */
export function biomePresentKinds(
  weightsAt: (x: number, z: number) => { weights: Record<BiomeId, number> },
  x: number,
  z: number,
): string[] {
  const { weights } = weightsAt(x, z);
  const present = new Set<BiomeId>();
  for (const id of Object.keys(weights) as BiomeId[]) {
    if (weights[id] >= BIOME_WEIGHT_MIN) present.add(id);
  }
  return ANIMAL_KINDS.filter((kind) =>
    ANIMAL_DEFS[kind].biomes.some((b) => present.has(b)),
  );
}

export interface AnimalUpdateInput {
  playerX: number;
  playerZ: number;
  night: boolean;
}

/**
 * Gameplay-time behavior step (Math.random allowed here — this is
 * gameplay, not worldgen). Wander within the kind's range, idle/feed
 * pauses, per-kind flee styles from a close player, perch + short flights for
 * flyers, water patrol for swimmers. Night kinds (owl, bat) fly
 * at night and perch by day; day kinds rest at night.
 */
export function updateAnimal(a: AnimalInstance, dt: number, input: AnimalUpdateInput): void {
  const def = ANIMAL_DEFS[a.kind];
  const active = def.active === 'night' ? input.night : !input.night;
  const fleeRadius = def.temperament === 'wary' ? WARY_FLEE_RADIUS_M : FLEE_RADIUS_M;
  const dxP = a.x - input.playerX;
  const dzP = a.z - input.playerZ;
  const distP = Math.hypot(dxP, dzP);
  if (distP < fleeRadius) {
    // Per-kind flee style (DRAFT values — see ANIMAL_DEFS).
    // Temperament still sets WHEN (the radius above); style sets HOW.
    if (def.flee === 'freeze') {
      // Hold still instead of fleeing. Timer refreshed each frame
      // so the hold never expires into a wander step while the
      // player stays close; it counts down once the player leaves.
      a.mode = 'idle';
      a.flying = false;
      a.targetX = a.x;
      a.targetZ = a.z;
      a.timer = 1;
    } else if (def.flee === 'cover') {
      const distHome = Math.hypot(a.x - a.homeX, a.z - a.homeZ);
      if (distHome < COVER_HOME_EPSILON_M) {
        // Home (burrow / lodge): hold while the player stays close.
        a.mode = 'idle';
        a.flying = false;
        a.targetX = a.x;
        a.targetZ = a.z;
        a.timer = 1;
      } else {
        a.targetX = a.homeX;
        a.targetZ = a.homeZ;
        a.targetY = def.movement === 'fly' ? a.perchY : a.y;
        a.mode = 'flee';
        a.flying = def.movement === 'fly';
      }
    } else {
      // Straight + zigzag: re-targeted every frame while the player
      // is close, so a chased animal keeps running instead of
      // stalling at its first flee point. Zigzag alternates sides
      // of the away line on each re-target.
      const away = distP > 0.001 ? Math.atan2(dzP, dxP) : Math.random() * Math.PI * 2;
      const angle = def.flee === 'zigzag'
        ? away + (a.fleeTurn ? ZIGZAG_ANGLE_RAD : -ZIGZAG_ANGLE_RAD)
        : away;
      if (def.flee === 'zigzag') a.fleeTurn = !a.fleeTurn;
      a.targetX = a.x + Math.cos(angle) * 6;
      a.targetZ = a.z + Math.sin(angle) * 6;
      a.targetY = def.movement === 'fly' ? a.perchY : a.y;
      a.mode = 'flee';
      a.flying = def.movement === 'fly';
    }
  }
  const moving = a.mode === 'wander' || a.mode === 'fly' || a.mode === 'flee';
  if (!moving) {
    if (!active) {
      // Resting: flyers perch, everyone else idles in place.
      a.mode = def.movement === 'fly' ? 'perched' : 'idle';
      a.flying = false;
    } else {
      a.timer -= dt;
      if (a.timer <= 0) {
        const t = pickWanderTarget(a, def);
        a.targetX = t.x;
        a.targetZ = t.z;
        a.targetY = t.y;
        a.mode = def.movement === 'fly' ? 'fly' : 'wander';
        a.flying = def.movement === 'fly';
      }
    }
  }
  if (a.mode === 'wander' || a.mode === 'fly' || a.mode === 'flee') {
    const speed = a.mode === 'flee' ? FLEE_SPEED_MPS : WANDER_SPEED_MPS;
    const dx = a.targetX - a.x;
    const dz = a.targetZ - a.z;
    const dist = Math.hypot(dx, dz);
    const step = speed * dt;
    if (dist <= step) {
      a.x = a.targetX;
      a.z = a.targetZ;
      if (a.mode === 'flee' && distP >= fleeRadius) {
        a.mode = def.movement === 'fly' ? 'perched' : 'idle';
        a.flying = false;
        a.timer = 3 + Math.random() * 3;
      } else if (a.mode !== 'flee') {
        a.mode = def.movement === 'fly' ? 'perched' : 'idle';
        a.flying = false;
        a.timer = 3 + Math.random() * 3;
      }
      // Still fleeing with the player close: re-target away next frame.
    } else {
      a.x += (dx / dist) * step;
      a.z += (dz / dist) * step;
      a.heading = Math.atan2(dx, dz);
    }
    // Flying height: cruise above the perch line, descending as the
    // target closes (no extra state — distance does the blending).
    if (def.movement === 'fly') {
      const remaining = Math.hypot(a.targetX - a.x, a.targetZ - a.z);
      a.y = a.targetY + 0.6 * Math.min(1, remaining / 4);
    }
  } else {
    // Settled: height is the perch / ground / water line.
    a.y = def.movement === 'fly' ? a.perchY : a.y;
  }
  // Animation phase + vertical offset (oscillation only, no rigs).
  a.phase += dt * (moving ? 6 : 2);
  a.wingPhase += dt * (a.flying ? 18 : 2);
  if (def.anim === 'hop') {
    a.bob = moving ? Math.abs(Math.sin(a.phase * 3)) * 0.25 : 0;
  } else if (def.anim === 'swim') {
    a.bob = 0.03 * Math.sin(a.phase);
  } else {
    a.bob = 0.05 * Math.sin(a.phase);
  }
}
