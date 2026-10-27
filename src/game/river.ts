/**
 * RIVER — the world's one winding water band (Adam, 2026-10-27:
 * "let's get water bodies too", visibility only).
 *
 * The river is a PURE function of the world seed + spawn: no
 * scatter slot, no harvest, no mechanics — the renderer draws it
 * as a flat ribbon per chunk, and she can see it and walk to it.
 * Flat world (terrain pin, same day: flat for now, uneven later
 * to a point) — the band lies on the plane, it does not carve.
 *
 * COURSE (lane-decided, flagged for pin pass): an analytic
 * meander — a straight course with two summed sine offsets — so
 * it is defined for every t, infinitely, with no precomputed
 * polyline and no edge where the river ends. It is routed NEAR
 * SPAWN (seeded offset ≤ 60 m) so it is findable, and it crosses
 * biomes the way real rivers cross country: gating the ribbon
 * to creekBottom weight would break it into disconnected pieces,
 * so it is NOT gated — creekBottom's silt + stones + standing
 * water already mark creek country along its course.
 *
 * CHUNK RULE: a ribbon quad belongs to exactly the chunk holding
 * its midpoint (half-open bounds), so adjacent chunks never
 * double-draw a quad and never leave a gap. y sits just above
 * the ground discs (0.02) so the band never z-fights a pond or
 * standing-water pool it crosses.
 */
import { deriveSeed, mulberry32 } from './seed';
import { CHUNK_SIZE } from '../constants';

/** Ribbon width in metres (lane-decided, flagged). */
export const RIVER_WIDTH = 5;
/** Ribbon height above the ground plane (discs sit at 0.02). */
export const RIVER_Y = 0.03;
/** Sample step along the course in metres. */
export const RIVER_STEP = 4;
/** Meander amplitudes / wavelengths (lane-decided, flagged). */
export const RIVER_MEANDER_A1 = 28;
export const RIVER_MEANDER_L1 = 340;
export const RIVER_MEANDER_A2 = 12;
export const RIVER_MEANDER_L2 = 130;
/** Seeded spawn offset bound (the river passes near spawn). */
export const RIVER_SPAWN_OFFSET = 60;

export interface RiverParams {
  /** A point on the course (near spawn). */
  ox: number;
  oz: number;
  /** Unit course direction. */
  dx: number;
  dz: number;
  /** Unit perpendicular (left of course). */
  px: number;
  pz: number;
  /** Meander phases. */
  p1: number;
  p2: number;
}

/** Deterministic river parameters for a world seed + spawn point. */
export function riverParamsFor(seed: string, spawn: { x: number; z: number }): RiverParams {
  const rand = mulberry32(deriveSeed(seed, 'river'));
  const angle = rand() * Math.PI * 2;
  const ox = spawn.x + (rand() * 2 - 1) * RIVER_SPAWN_OFFSET;
  const oz = spawn.z + (rand() * 2 - 1) * RIVER_SPAWN_OFFSET;
  return {
    ox,
    oz,
    dx: Math.cos(angle),
    dz: Math.sin(angle),
    px: -Math.sin(angle),
    pz: Math.cos(angle),
    p1: rand() * Math.PI * 2,
    p2: rand() * Math.PI * 2,
  };
}

/** The river's centre point at course distance t (metres). */
export function riverCenterAt(params: RiverParams, t: number): { x: number; z: number } {
  const m =
    RIVER_MEANDER_A1 * Math.sin((2 * Math.PI * t) / RIVER_MEANDER_L1 + params.p1) +
    RIVER_MEANDER_A2 * Math.sin((2 * Math.PI * t) / RIVER_MEANDER_L2 + params.p2);
  return {
    x: params.ox + params.dx * t + params.px * m,
    z: params.oz + params.dz * t + params.pz * m,
  };
}

export interface RiverRibbon {
  /** Flat xyz triples, y always RIVER_Y. */
  positions: number[];
  /** Triangle indices into positions. */
  indices: number[];
}

/**
 * The ribbon segment for one chunk, or null when the river does
 * not cross it. Quad ownership is by midpoint (half-open chunk
 * bounds), so the union over chunks covers the course exactly
 * once — no overlaps, no gaps.
 */
export function riverRibbonForChunk(
  params: RiverParams,
  cx: number,
  cz: number,
): RiverRibbon | null {
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  const x1 = x0 + CHUNK_SIZE;
  const z1 = z0 + CHUNK_SIZE;
  // Corner projections onto the course axis give the exact
  // centre-line t-range for this chunk (the perpendicular
  // meander has zero course-axis component); one step of margin
  // covers quads whose midpoint sits just inside the edge.
  const corners = [
    { x: x0, z: z0 },
    { x: x1, z: z0 },
    { x: x0, z: z1 },
    { x: x1, z: z1 },
  ];
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const c of corners) {
    const t = (c.x - params.ox) * params.dx + (c.z - params.oz) * params.dz;
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
  }
  tMin -= RIVER_STEP;
  tMax += RIVER_STEP;
  const half = RIVER_WIDTH / 2;
  const positions: number[] = [];
  const indices: number[] = [];
  const startT = Math.floor(tMin / RIVER_STEP) * RIVER_STEP;
  for (let t = startT; t < tMax; t += RIVER_STEP) {
    const c0 = riverCenterAt(params, t);
    const c1 = riverCenterAt(params, t + RIVER_STEP);
    const mx = (c0.x + c1.x) / 2;
    const mz = (c0.z + c1.z) / 2;
    if (mx < x0 || mx >= x1 || mz < z0 || mz >= z1) continue;
    const base = positions.length / 3;
    positions.push(
      c0.x - params.px * half, RIVER_Y, c0.z - params.pz * half,
      c0.x + params.px * half, RIVER_Y, c0.z + params.pz * half,
      c1.x - params.px * half, RIVER_Y, c1.z - params.pz * half,
      c1.x + params.px * half, RIVER_Y, c1.z + params.pz * half,
    );
    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  if (indices.length === 0) return null;
  return { positions, indices };
}
