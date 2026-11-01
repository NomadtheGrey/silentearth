/**
 * SETTLE / DART — the Clarissa movement (Companions Build 2,
 * Background claim 2026-10-31, named for how Clarissa's cat
 * actually travels: it follows some thirty feet behind, or
 * scampers bush to bush). NOT follower trailing math: the
 * actor SETTLES at a watching point — cover-biased when the
 * world offers cover — holds while she stays within a
 * rolled gap, then DARTS to the next watching point when
 * the gap grows past it. Two customers: the hearth cat
 * (always, once attending) and any companion the shell has
 * marked familiar (companionRuntime movement-mode flip).
 * The settle hosts the pose beats (the cat's sit / curl,
 * read by the renderer off DartState.pose; poseless kinds
 * simply run the cycle) and, from landing B, the
 * provisioning excursion launches from settles only.
 *
 * All numbers DRAFT for Adam's pin pass.
 */
import { stepAnimalAnimation } from './animals';
import type { AnimalInstance } from './animals';

/** The gap band (m to her) that ends a settle — rolled per settle. */
export const DART_GAP_MIN_M = 9;
export const DART_GAP_MAX_M = 15;
/** The scamper itself: ~2x her 5 m/s walk — fast is the point. */
export const DART_SPEED_MPS = 10;
/** A settle longer than this curls (the cat's long pose). */
export const SETTLE_CURL_S = 20;
/** A dart aims to end about this far from her (a watching distance). */
export const DART_END_GAP_M = 5;
/** How far around the ideal point to look for cover. */
export const COVER_SNAP_M = 6;

export type DartPhase = 'settle' | 'dart';
export type DartPose = 'stand' | 'sit' | 'curl';

export interface DartState {
  phase: DartPhase;
  /** The gap (m) that ends the current settle. Rolled per settle. */
  triggerM: number;
  /** Seconds in the current settle. */
  settleT: number;
  /** Dart destination (the next watching point). */
  targetX: number;
  targetZ: number;
  /** The renderer's pose read (the cat; other kinds ignore it). */
  pose: DartPose;
}

export function rollDartTrigger(): number {
  return DART_GAP_MIN_M + Math.random() * (DART_GAP_MAX_M - DART_GAP_MIN_M);
}

export function makeDartState(): DartState {
  return {
    phase: 'settle',
    triggerM: rollDartTrigger(),
    settleT: 0,
    targetX: 0,
    targetZ: 0,
    pose: 'sit',
  };
}

export interface DartContext {
  playerX: number;
  playerZ: number;
  /** Nearest cover point (tree / bush) to a spot, or null. */
  coverNear?: (x: number, z: number, r: number) => { x: number; z: number } | null;
  /** Terrain speed factor (the bog/wading composition). */
  speedAt?: (x: number, z: number) => number;
  /** Wall ejection, the shared walls truth. */
  pushWalls?: (x: number, z: number) => { x: number; z: number };
}

/** Turn an instance's heading toward a point, rate-limited. */
export function faceToward(inst: AnimalInstance, tx: number, tz: number, maxTurn: number): void {
  const want = Math.atan2(tx - inst.x, tz - inst.z);
  let d = want - inst.heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const step = Math.max(-maxTurn, Math.min(maxTurn, d));
  inst.heading += step;
}

/**
 * One settle/dart step. The caller owns the edges this
 * stepper deliberately does not: dimension holds, sleep /
 * death re-seats, stance overrides (a STAY is an anchor,
 * not a cycle), and teleport snaps.
 */
export function stepSettleDart(
  inst: AnimalInstance,
  dart: DartState,
  dt: number,
  ctx: DartContext,
): void {
  const dxP = ctx.playerX - inst.x;
  const dzP = ctx.playerZ - inst.z;
  const gap = Math.hypot(dxP, dzP);

  if (dart.phase === 'settle') {
    dart.settleT += dt;
    dart.pose = dart.settleT > SETTLE_CURL_S ? 'curl' : 'sit';
    faceToward(inst, ctx.playerX, ctx.playerZ, dt * 2.5);
    stepAnimalAnimation(inst, dt, false);
    if (gap > dart.triggerM) {
      // The next watching point: advanced toward her,
      // ending a watching-distance short of her, snapped
      // to cover when the world offers it nearby.
      const advance = Math.max(0, gap - DART_END_GAP_M);
      const ux = gap > 0.001 ? dxP / gap : 0;
      const uz = gap > 0.001 ? dzP / gap : 1;
      let tx = inst.x + ux * advance;
      let tz = inst.z + uz * advance;
      const cover = ctx.coverNear ? ctx.coverNear(tx, tz, COVER_SNAP_M) : null;
      if (cover) {
        tx = cover.x;
        tz = cover.z;
      } else {
        // No cover: a slight lateral offset, so the point
        // is a place, not a spot on her heels' line.
        const side = Math.random() < 0.5 ? -1 : 1;
        tx += -uz * side * 1.5;
        tz += ux * side * 1.5;
      }
      dart.targetX = tx;
      dart.targetZ = tz;
      dart.phase = 'dart';
      dart.pose = 'stand';
    }
    return;
  }

  // Dart: the scamper, cover to cover.
  const dx = dart.targetX - inst.x;
  const dz = dart.targetZ - inst.z;
  const dist = Math.hypot(dx, dz);
  const arrived = dist < 0.5 || gap < 3;
  if (arrived) {
    dart.phase = 'settle';
    dart.settleT = 0;
    dart.triggerM = rollDartTrigger();
    dart.pose = 'sit';
    stepAnimalAnimation(inst, dt, false);
    return;
  }
  const speed = DART_SPEED_MPS * (ctx.speedAt ? ctx.speedAt(inst.x, inst.z) : 1);
  const step = Math.min(dist, speed * dt);
  inst.heading = Math.atan2(dx, dz);
  inst.x += (dx / dist) * step;
  inst.z += (dz / dist) * step;
  if (ctx.pushWalls) {
    const p = ctx.pushWalls(inst.x, inst.z);
    inst.x = p.x;
    inst.z = p.z;
  }
  stepAnimalAnimation(inst, dt, true);
}
