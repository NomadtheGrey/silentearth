/**
 * THE CAT — Companions Build 2, Background's engine half
 * (claim approved 2026-10-31). The world's ONE cat: a
 * singular persistent actor resident at the burnt
 * village's hearthHouse, staged there by the seed itself —
 * no save record carries its existence; Systems' found
 * record (keyed 'cat:hearth', DEV-ruled) carries its bond.
 *
 * The cat NEVER enters the companion registry: it takes
 * no stances, ever (Adam: commands for a cat — 'I don't
 * see that working'), and that exemption stays structural
 * — this module is its whole runtime. Movement is the
 * settle/dart cycle (settleDart.ts) once it attends her;
 * at the hearth it ambles its own small parish. As
 * FAMILIAR (fork (a), built as the recommended DRAFT
 * default, flagged for Adam's formal ruling): it gains
 * the faint fungus-register glow and it CROSSES — cave
 * mouths and dimension edges where ordinary companions
 * wait, the familiar re-seats at her side in the new
 * space.
 *
 * Bond state is Systems'; the shell drives it in through
 * setCatBond. The engine reads no bond records.
 */
import { bus } from './events';
import { stepAnimalAnimation } from './animals';
import type { AnimalInstance } from './animals';
import { makeCompanionInstance } from './companionRuntime';
import { makeDartState, stepSettleDart, faceToward } from './settleDart';
import type { DartState, DartPose } from './settleDart';

/** The cat's stable id — singular by construction (DEV-ruled). */
export const CAT_ID = 'cat:hearth';
/** First meeting: she comes this close and the cat acknowledges her. */
export const CAT_MEET_RANGE_M = 8;
/** The hearth parish: pre-bond, the cat wanders this far from its spot. */
export const CAT_HEARTH_ROAM_M = 4;
/** Hearth amble pace. */
export const CAT_AMBLE_MPS = 1.0;

/**
 * The bond ladder as the ENGINE needs it: 'hearth' (no
 * bond — resident), 'attending' (a companion bond — it
 * follows, by settle/dart, and waits at dimension edges
 * like every companion), 'familiar' (attends + glows +
 * crosses).
 */
export type CatBondLevel = 'hearth' | 'attending' | 'familiar';

export interface CatActor {
  instance: AnimalInstance;
  dart: DartState;
  bond: CatBondLevel;
  /** The first-meeting latch (fires once, ever, per world). */
  met: boolean;
  /** Hearth anchor (the village hearthSpot). */
  homeX: number;
  homeZ: number;
  /** The renderer's pose read. */
  pose: DartPose;
  /** Hearth amble bookkeeping (pre-bond life). */
  ambleT: number;
  ambleX: number;
  ambleZ: number;
  ambleMoving: boolean;
  /** Dimension-edge tracking for the familiar crossing. */
  wasDimension: boolean;
  /**
   * The carried catch (provisioning, landing B): a
   * structural item id string — game code imports no
   * systems. Null = empty mouth.
   */
  carrying: string | null;
}

let cat: CatActor | null = null;

/**
 * Stage the cat at a hearth spot. Idempotent: an existing
 * cat keeps its life (a chunk stream or a dimension swap
 * must never reset it). A new world clears via the
 * seedSet listener below and the renderer re-stages from
 * the new village.
 */
export function ensureCat(hearthX: number, hearthZ: number): CatActor {
  if (cat) return cat;
  const instance = makeCompanionInstance(CAT_ID, 'cat', hearthX, hearthZ);
  cat = {
    instance,
    dart: makeDartState(),
    bond: 'hearth',
    met: false,
    homeX: hearthX,
    homeZ: hearthZ,
    pose: 'sit',
    ambleT: 2 + Math.random() * 4,
    ambleX: hearthX,
    ambleZ: hearthZ,
    ambleMoving: false,
    wasDimension: false,
    carrying: null,
  };
  return cat;
}

export function catActor(): CatActor | null {
  return cat;
}

export function clearCat(): void {
  cat = null;
}

/** The shell drives the bond in from Systems' record. */
export function setCatBond(level: CatBondLevel): void {
  if (!cat) return;
  if (cat.bond === level) return;
  cat.bond = level;
  // A new relationship resets the cycle honestly: the cat
  // settles wherever it stands and re-reads its anchor.
  cat.dart.phase = 'settle';
  cat.dart.settleT = 0;
  cat.pose = 'sit';
}

/** The glow's fact (the renderer mounts the light on it). */
export function catGlowOn(): boolean {
  return cat !== null && cat.bond === 'familiar';
}

export type CatSignal = { type: 'met' };

export interface CatStepContext {
  playerX: number;
  playerZ: number;
  night: boolean;
  dimensionActive: boolean;
  speedAt?: (x: number, z: number) => number;
  pushWalls?: (x: number, z: number) => { x: number; z: number };
  coverNear?: (x: number, z: number, r: number) => { x: number; z: number } | null;
}

/** Seat an instance at her side (ring offset, wall-resolved). */
function seatNearPlayer(inst: AnimalInstance, ctx: CatStepContext): void {
  inst.x = ctx.playerX + 1.6;
  inst.z = ctx.playerZ + 1.6;
  if (ctx.pushWalls) {
    const p = ctx.pushWalls(inst.x, inst.z);
    inst.x = p.x;
    inst.z = p.z;
  }
}

/**
 * The hearth life: long settles (sit, then curl) broken by
 * short ambles around the parish — cover-biased when a
 * bush or tree stands in reach, the same taste its
 * travelling cycle has.
 */
function stepHearthLife(c: CatActor, dt: number, ctx: CatStepContext): void {
  const inst = c.instance;
  if (c.ambleMoving) {
    const dx = c.ambleX - inst.x;
    const dz = c.ambleZ - inst.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.3) {
      c.ambleMoving = false;
      c.ambleT = 4 + Math.random() * 10;
      c.dart.settleT = 0;
      c.pose = 'sit';
      stepAnimalAnimation(inst, dt, false);
      return;
    }
    inst.heading = Math.atan2(dx, dz);
    const step = Math.min(dist, CAT_AMBLE_MPS * dt);
    inst.x += (dx / dist) * step;
    inst.z += (dz / dist) * step;
    if (ctx.pushWalls) {
      const p = ctx.pushWalls(inst.x, inst.z);
      inst.x = p.x;
      inst.z = p.z;
    }
    c.pose = 'stand';
    stepAnimalAnimation(inst, dt, true);
    return;
  }
  c.dart.settleT += dt;
  c.pose = c.dart.settleT > 20 ? 'curl' : 'sit';
  c.ambleT -= dt;
  stepAnimalAnimation(inst, dt, false);
  if (c.ambleT <= 0) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 1 + Math.random() * (CAT_HEARTH_ROAM_M - 1);
    let tx = c.homeX + Math.cos(ang) * rad;
    let tz = c.homeZ + Math.sin(ang) * rad;
    const cover = ctx.coverNear ? ctx.coverNear(tx, tz, 3) : null;
    if (cover) {
      tx = cover.x;
      tz = cover.z;
    }
    c.ambleX = tx;
    c.ambleZ = tz;
    c.ambleMoving = true;
  }
}

/**
 * Step the cat one frame. Returns signals (the first
 * meeting, once). The dimension rules: a non-familiar cat
 * WAITS while she is inside (its layer hides; its life
 * holds); the familiar CROSSES — on the edge it re-seats
 * at her side in the new space and travels there.
 */
export function stepCat(dt: number, ctx: CatStepContext): CatSignal[] {
  if (!cat) return [];
  const signals: CatSignal[] = [];
  const c = cat;
  const inst = c.instance;

  if (ctx.dimensionActive !== c.wasDimension) {
    c.wasDimension = ctx.dimensionActive;
    if (c.bond === 'familiar') {
      seatNearPlayer(inst, ctx);
      c.dart.phase = 'settle';
      c.dart.settleT = 0;
      c.pose = 'sit';
    }
  }
  if (ctx.dimensionActive && c.bond !== 'familiar') {
    stepAnimalAnimation(inst, dt, false);
    return signals;
  }

  // The first meeting (once): she enters its range at the
  // hearth and it stands to look at her.
  if (!c.met && c.bond === 'hearth') {
    const d = Math.hypot(ctx.playerX - inst.x, ctx.playerZ - inst.z);
    if (d < CAT_MEET_RANGE_M) {
      c.met = true;
      c.pose = 'stand';
      c.ambleMoving = false;
      faceToward(inst, ctx.playerX, ctx.playerZ, Math.PI);
      signals.push({ type: 'met' });
      return signals;
    }
  }

  if (c.bond === 'hearth') {
    stepHearthLife(c, dt, ctx);
  } else {
    stepSettleDart(inst, c.dart, dt, ctx);
    c.pose = c.dart.pose;
  }
  return signals;
}

// The cat's existence is the seed's, never a save's: a new
// world clears the actor and the renderer re-stages it at
// the new village's hearth.
bus.on('world:seedSet', () => {
  clearCat();
});
