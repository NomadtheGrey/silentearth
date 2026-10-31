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
  | 'shrew'
  | 'cat';

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
  /**
   * Nearest-hop water travel (fish, eels, crayfish):
   * pickWanderTarget hops the kind to the NEAREST water point
   * in its pool instead of a random one, so its straight-line
   * travel hugs the water-point chain instead of cutting
   * across banks. This flag is TRAVEL ONLY — it says nothing
   * about how the kind rides: fish + eels also swim submerged,
   * but that pose is kind-keyed geometry in models.ts, while
   * the crayfish rides ON the water line like every other
   * surface swimmer. (The flag was named 'subsurface' when
   * only the two submerged kinds had it; the crayfish split
   * the concerns, 2026-10-29.) Surface kinds that are
   * legitimately bank-going (beaver, turtle, frog, muskrat)
   * omit it and keep the random pool hop.
   */
  nearestHop?: boolean;
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
  crayfish: { biomes: ['creekBottom', 'mirewood'], temperament: 'indifferent', movement: 'water', anim: 'swim', active: 'day', flee: 'straight', wanderRange: 8, nearestHop: true },
  muskrat: { biomes: ['creekBottom', 'mirewood', 'deepBog'], temperament: 'wary', movement: 'water', anim: 'swim', active: 'day', flee: 'cover', wanderRange: 8 },
  mice: { biomes: ['meadow', 'oldfieldRise'], temperament: 'skittish', movement: 'ground', anim: 'hop', active: 'day', flee: 'zigzag', wanderRange: 3 },
  voles: { biomes: ['meadow', 'creekBottom'], temperament: 'skittish', movement: 'ground', anim: 'hop', active: 'day', flee: 'zigzag', wanderRange: 3 },
  fish: { biomes: ['creekBottom', 'mirewood'], temperament: 'skittish', movement: 'water', anim: 'swim', active: 'day', flee: 'straight', wanderRange: 8, nearestHop: true },
  eels: { biomes: ['creekBottom', 'mirewood'], temperament: 'skittish', movement: 'water', anim: 'swim', active: 'day', flee: 'straight', wanderRange: 8, nearestHop: true },
  opossum: { biomes: ['forest', 'oldfieldRise', 'tanglewood'], temperament: 'skittish', movement: 'ground', anim: 'bob', active: 'day', flee: 'freeze', wanderRange: 8 },
  shrew: { biomes: ['forest', 'meadow'], temperament: 'skittish', movement: 'ground', anim: 'hop', active: 'day', flee: 'zigzag', wanderRange: 3 },
  // The cat is SINGULAR (Adam, 2026-10-31): the found
  // familiar at the burnt village's hearthHouse, not an
  // ambient population. This entry exists only because the
  // Record is exhaustive over AnimalKind — it is NOT a
  // roster entry: 'cat' is absent from ANIMAL_KINDS (the
  // list every spawn/eligibility filter iterates) and its
  // biomes are empty, so no filter can ever select it.
  // Build 2 owns its spawn, record, and behavior; the
  // values below are inert placeholders in its shape.
  cat: { biomes: [], temperament: 'curious', movement: 'ground', anim: 'bob', active: 'day', flee: 'straight', wanderRange: 3 },
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
/** Hand-snatch (Adam 2026-10-31: no rod ever, the weir is law — this is her hand). All DRAFT. */
export const SNATCH_RANGE_M = 2.5;
export const SNATCH_CHANCE = 0.35;
/** A missed snatch spooks the target and every fish within this radius of it. */
export const SPOOK_RADIUS_M = 6;
/** How long a spooked fish holds its dart (seconds). */
export const SPOOK_DURATION_S = 1.2;
/** Burst speed multiplier while a spook-dart runs. */
export const SPOOK_BURST_FACTOR = 3;
/** Feral snap (Companions Build 1, DRAFT): the lunge phase's length and reach. */
export const SNAP_LUNGE_S = 0.28;
export const SNAP_LUNGE_SPEED_MPS = 5;
export const SNAP_STOP_SHORT_M = 0.8;
/** Squirrel climb (2026-10-31, all DRAFT): refuge reach, rise speed, perch height, coast-clear range + delay. */
export const SQUIRREL_TREE_REACH_M = 12;
export const SQUIRREL_CLIMB_SPEED_MPS = 1.4;
export const SQUIRREL_PERCH_Y_M = 2.6;
export const SQUIRREL_COAST_CLEAR_M = 10;
export const SQUIRREL_DESCENT_DELAY_S = 3;

export interface AnimalPoint {
  x: number;
  z: number;
}

export type AnimalMode = 'wander' | 'idle' | 'flee' | 'perched' | 'fly';

/**
 * Squirrel climb states (2026-10-31 — squirrels climb
 * trees): 'none' is every other kind, always, and a
 * squirrel on the ground. The cycle: toTree (run for the
 * trunk) → climbing (rise) → perched (canopy refuge) →
 * descending (coast clear, come down) → none.
 */
export type ClimbState = 'none' | 'toTree' | 'climbing' | 'perched' | 'descending';

export interface AnimalInstance {
  /**
   * Stable per-individual id, minted at spawn as
   * `animal:<cx>,<cz>:<spawnIndex>`. The spawn is
   * deterministic, so the id names the same individual across
   * chunk reloads and save/load — the key Systems'
   * companions.ts records and isFeral() reads (Companions
   * Build 1, 2026-10-31). Ambient instances carry it unused
   * until one is touched; promotion keeps the id.
   */
  id: string;
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
  /**
   * Seconds of spook-dart remaining (the hand-snatch's
   * failure, 2026-10-31): while > 0 the animal holds the
   * dart target attemptSnatch set (its far anchor point)
   * at burst speed and the ordinary flee re-target stands
   * down. Zero for every unspooked animal.
   */
  spookT: number;
  /**
   * Seconds of feral-snap lunge remaining (Companions
   * Build 1): while > 0 the animal lunges toward the snap
   * target triggerSnap set (a point just short of her hand)
   * at lunge speed; when the timer lapses the bolt fires —
   * the spook-dart away. Zero for every unprovoked animal.
   */
  snapT: number;
  /** Squirrel climb state (see ClimbState); 'none' for every other kind. */
  climbState: ClimbState;
  /** Seconds she has stayed beyond coast-clear range of a perched squirrel. */
  clearT: number;
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
    if (def.nearestHop) {
      // Nearest-hop kinds (fish, eels, crayfish) hop to the
      // NEAREST pool point instead of a random one: short hops
      // hug the water-point chain, so straight-line travel
      // stays in the water instead of cutting across banks
      // (v1 containment — there is no water mask to test
      // against). Points within 0.6 m of her are excluded so
      // she actually moves; if that empties the pool (a lone
      // point), she holds at the pool's first point. The hop
      // target's y is the water line for every kind here —
      // submerged or surface is the model's business, not
      // the target's.
      let best: AnimalPoint | null = null;
      let bestDist = Infinity;
      for (const p of pool) {
        const d = Math.hypot(p.x - a.x, p.z - a.z);
        if (d > 0.6 && d < bestDist) {
          best = p;
          bestDist = d;
        }
      }
      const p = best ?? pool[0];
      return { x: p.x, z: p.z, y: WATER_Y };
    }
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
      id: `animal:${cx},${cz}:${i}`,
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
      spookT: 0,
      snapT: 0,
      climbState: 'none',
      clearT: 0,
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
      if (kind === 'squirrel') {
        // Squirrels climb (2026-10-31): their refuge pool
        // is the chunk's trees — the same anchor list the
        // flyers perch from — and their perch height is the
        // climb's ceiling.
        base.anchors = input.treePoints;
        base.perchY = SQUIRREL_PERCH_Y_M;
      }
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
 * THE SQUIRREL CLIMB (Adam 2026-10-31: "squirrels know how
 * to climb trees"). Returns true when the climb machinery
 * handled this step (the generic body stands down);
 * false leaves the squirrel to ordinary ground life.
 *
 * The shape: startled (she inside the flee radius) with a
 * tree within SQUIRREL_TREE_REACH_M, the flee becomes a
 * climb — run to the trunk at flee speed, rise pinned to
 * the bark at climb speed, perch at SQUIRREL_PERCH_Y_M
 * while she stays within SQUIRREL_COAST_CLEAR_M, descend
 * after SQUIRREL_DESCENT_DELAY_S of clear coast. No tree
 * in reach: the ordinary zigzag flee, untouched. A
 * startle mid-descent sends it back up from where it
 * hangs. Canopy tree-to-tree travel ("the highway") is a
 * named follow-up, deliberately not here — v1 is refuge.
 *
 * A PROMOTED squirrel never reaches this code (companions
 * step in companionRuntime, not updateAnimal), and a
 * perched squirrel is out of offer reach by height — the
 * shell's feed reads y for that gate; this module only
 * makes the height true.
 */
function stepSquirrelClimb(
  a: AnimalInstance,
  dt: number,
  input: AnimalUpdateInput,
  distP: number,
): boolean {
  if (a.climbState === 'none') {
    if (distP >= FLEE_RADIUS_M) return false;
    // Nearest tree in refuge reach of the squirrel.
    let best: AnimalPoint | null = null;
    let bestDist = Infinity;
    for (const p of a.anchors) {
      const d = Math.hypot(p.x - a.x, p.z - a.z);
      if (d <= SQUIRREL_TREE_REACH_M && d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    if (!best) return false;
    a.targetX = best.x;
    a.targetZ = best.z;
    a.climbState = 'toTree';
  }
  let moving = false;
  if (a.climbState === 'toTree') {
    const dx = a.targetX - a.x;
    const dz = a.targetZ - a.z;
    const dist = Math.hypot(dx, dz);
    const step = FLEE_SPEED_MPS * dt;
    if (dist <= Math.max(step, 0.15)) {
      // At the trunk: take the bark offset on the approach
      // side and face outward, away from the trunk centre.
      const ox = dist > 0.001 ? -dx / dist : 1;
      const oz = dist > 0.001 ? -dz / dist : 0;
      a.x = a.targetX + ox * 0.25;
      a.z = a.targetZ + oz * 0.25;
      a.heading = Math.atan2(ox, oz);
      a.climbState = 'climbing';
    } else {
      a.x += (dx / dist) * step;
      a.z += (dz / dist) * step;
      a.heading = Math.atan2(dx, dz);
      moving = true;
    }
    a.mode = 'flee';
    a.flying = false;
  } else if (a.climbState === 'climbing') {
    a.y = Math.min(a.perchY, a.y + SQUIRREL_CLIMB_SPEED_MPS * dt);
    moving = true;
    a.mode = 'flee';
    if (a.y >= a.perchY) {
      a.climbState = 'perched';
      a.clearT = 0;
      a.mode = 'perched';
      moving = false;
    }
  } else if (a.climbState === 'perched') {
    a.y = a.perchY;
    a.mode = 'perched';
    if (distP <= SQUIRREL_COAST_CLEAR_M) {
      a.clearT = 0;
    } else {
      a.clearT += dt;
      if (a.clearT >= SQUIRREL_DESCENT_DELAY_S) a.climbState = 'descending';
    }
  } else if (a.climbState === 'descending') {
    if (distP < FLEE_RADIUS_M) {
      // Startled on the way down: back up from here.
      a.climbState = 'climbing';
      a.mode = 'flee';
      moving = true;
    } else {
      a.y = Math.max(0, a.y - SQUIRREL_CLIMB_SPEED_MPS * dt);
      a.mode = 'flee';
      moving = true;
      if (a.y <= 0) {
        a.y = 0;
        a.climbState = 'none';
        a.mode = 'idle';
        a.timer = 2 + Math.random() * 2;
      }
    }
  }
  stepAnimalAnimation(a, dt, moving);
  return true;
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
  // Squirrels climb (2026-10-31): the climb machinery
  // handles the whole step when it takes it (including a
  // ground squirrel resting at night — 'none' + inactive
  // falls through to the generic rest below).
  if (a.kind === 'squirrel') {
    if (a.climbState === undefined) a.climbState = 'none';
    if (a.climbState !== 'none' || active) {
      if (stepSquirrelClimb(a, dt, input, distP)) return;
    }
  }
  // Spook-dart (hand-snatch failure): the dart target stands
  // while the timer runs — the ordinary flee re-target below
  // would overwrite it every frame and scatter the dart.
  if (a.spookT > 0) a.spookT = Math.max(0, a.spookT - dt);
  // Feral snap: the lunge target stands while its timer
  // runs; when the lunge lapses, the bolt fires (the
  // spook-dart away, same machinery as a missed snatch).
  if (a.snapT > 0) {
    a.snapT = Math.max(0, a.snapT - dt);
    if (a.snapT <= 0) spookFish(a, input.playerX, input.playerZ);
  }
  if (distP < fleeRadius && !(a.spookT > 0) && !(a.snapT > 0)) {
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
    const speed = a.snapT > 0
      ? SNAP_LUNGE_SPEED_MPS
      : (a.mode === 'flee' ? FLEE_SPEED_MPS : WANDER_SPEED_MPS)
        * (a.spookT > 0 ? SPOOK_BURST_FACTOR : 1);
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
  stepAnimalAnimation(a, dt, moving);
}

/**
 * Animation phase + vertical offset (oscillation only, no
 * rigs) — extracted from updateAnimal's tail so the companion
 * runtime steps the same poses for promoted actors, which
 * updateAnimal never touches (a companion does not flee its
 * own person).
 */
export function stepAnimalAnimation(a: AnimalInstance, dt: number, moving: boolean): void {
  const def = ANIMAL_DEFS[a.kind];
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

/**
 * THE FERAL SNAP (Companions Build 1; DEV-reconciled feral
 * design, 2026-10-31): a feral individual's answer to an
 * offering. Arms the lunge: a target point SNAP_STOP_SHORT_M
 * short of her hand — the snap lands on the OFFERING, never
 * on her body (costs land on goods, not her) — at lunge
 * speed; when the lunge timer lapses inside updateAnimal,
 * the bolt fires (the spook-dart away). It never softens:
 * the trigger carries no trust input, first offering or
 * fiftieth, the answer is the same animal.
 */
export function triggerSnap(a: AnimalInstance, playerX: number, playerZ: number): void {
  const dx = playerX - a.x;
  const dz = playerZ - a.z;
  const d = Math.hypot(dx, dz);
  const reach = Math.max(0, d - SNAP_STOP_SHORT_M);
  const ux = d > 0.001 ? dx / d : 1;
  const uz = d > 0.001 ? dz / d : 0;
  a.targetX = a.x + ux * reach;
  a.targetZ = a.z + uz * reach;
  a.targetY = a.y;
  a.mode = 'flee';
  a.flying = false;
  a.snapT = SNAP_LUNGE_S;
}

export interface SnatchInput {
  playerX: number;
  playerZ: number;
  /** Success probability (default SNATCH_CHANCE). */
  chance?: number;
  /** Injectable roll in [0, 1) for probes; default Math.random(). */
  roll?: number;
}

export interface SnatchOutcome {
  outcome: 'caught' | 'missed';
  instance: AnimalInstance;
}

/** Set one fish darting: its far anchor point from the player, spook timer armed. */
function spookFish(f: AnimalInstance, playerX: number, playerZ: number): void {
  let tx = f.x + (f.x - playerX) * 4;
  let tz = f.z + (f.z - playerZ) * 4;
  let best = -1;
  for (const p of f.anchors) {
    const d = Math.hypot(p.x - playerX, p.z - playerZ);
    if (d > best) {
      best = d;
      tx = p.x;
      tz = p.z;
    }
  }
  f.targetX = tx;
  f.targetZ = tz;
  f.targetY = WATER_Y;
  f.mode = 'flee';
  f.flying = false;
  f.spookT = SPOOK_DURATION_S;
}

/**
 * The snatch's TARGET: the NEAREST 'fish' instance within
 * SNATCH_RANGE_M of her, or null when no fish is in reach
 * (the press was not a snatch at all). A fish in reach of
 * a wading / bank-side stance is a shallow fish by
 * construction — deep-centre river fish are simply never
 * in reach.
 */
export function pickSnatchTarget(
  candidates: readonly AnimalInstance[],
  playerX: number,
  playerZ: number,
): AnimalInstance | null {
  let target: AnimalInstance | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c.kind !== 'fish') continue;
    const d = Math.hypot(c.x - playerX, c.z - playerZ);
    if (d <= SNATCH_RANGE_M && d < bestDist) {
      target = c;
      bestDist = d;
    }
  }
  return target;
}

/**
 * The snatch's FAILURE made visible: the target and every
 * fish within SPOOK_RADIUS_M of it spook — a dart along
 * their own water-point chains (spookFish). Position is
 * the cooldown: a spooked reach holds no target until the
 * fish drift back, no timer gates anything.
 */
export function applySnatchSpook(
  candidates: readonly AnimalInstance[],
  target: AnimalInstance,
  playerX: number,
  playerZ: number,
): void {
  for (const c of candidates) {
    if (c.kind !== 'fish') continue;
    if (Math.hypot(c.x - target.x, c.z - target.z) <= SPOOK_RADIUS_M) {
      spookFish(c, playerX, playerZ);
    }
  }
}

/**
 * HER HAND-SNATCH at a faced fish in the shallows (Adam
 * 2026-10-31: E at a faced fish, chance-gated, spook on
 * failure; no rod ever — the weir stays the law for traps).
 * The composed convenience over pickSnatchTarget +
 * applySnatchSpook with this module's own chance — the
 * LIVE game path composes differently: Systems'
 * snatchFish owns the roll, the hunger gate, and the
 * grant (its SNATCH_CHANCE 0.25 is the dial the shell
 * plays; this module's 0.35 stands only for standalone
 * callers, and the pin pass settles the number). On
 * 'caught' the caller consumes the instance (renderer
 * despawn).
 */
export function attemptSnatch(
  candidates: readonly AnimalInstance[],
  input: SnatchInput,
): SnatchOutcome | null {
  const target = pickSnatchTarget(candidates, input.playerX, input.playerZ);
  if (!target) return null;
  const chance = input.chance ?? SNATCH_CHANCE;
  const roll = input.roll ?? Math.random();
  if (roll < chance) return { outcome: 'caught', instance: target };
  applySnatchSpook(candidates, target, input.playerX, input.playerZ);
  return { outcome: 'missed', instance: target };
}
