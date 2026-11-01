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
import type { AnimalInstance, AnimalKind } from './animals';
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

// ---- Provisioning (landing B; Adam's overnight ruling
// (B) with his presentation, 2026-10-31) ----------------
/** One game-hour in real seconds at the DRAFT 10-minute day. */
export const PROVISION_GAME_HOUR_S = 25;
/** Excursions look for real prey in this ring (m). */
export const HUNT_MIN_R_M = 15;
export const HUNT_MAX_R_M = 30;
/** The stalk closes to this before the catch lands. */
export const HUNT_CATCH_R_M = 1.3;
/** A stalk abandoned after this long, or past this range. */
export const HUNT_GIVE_UP_S = 20;
export const HUNT_FLED_M = 45;
/** No homed house at all: the cat eats a carried catch after ~this (3 game-hours DRAFT). */
export const CARRY_EAT_S = 3 * PROVISION_GAME_HOUR_S;

/** The catch-set table's shape (Systems' data, shell-installed). */
export interface CatCatchTable {
  /** The prey kinds the cat hunts. */
  kinds: readonly AnimalKind[];
  /** Prey kind -> the existing carcass item it yields. */
  itemFor: (kind: AnimalKind) => string | null;
  /** Prey kind -> Models' mouth-prop kind. */
  propFor: (kind: AnimalKind) => 'mouse' | 'rabbit' | 'fish' | null;
}

/** Live-prey access (renderer-installed; it owns the chunk animals). */
export interface CatPreyAccess {
  nearestPrey: (
    x: number,
    z: number,
    minR: number,
    maxR: number,
    kinds: readonly AnimalKind[],
  ) => { id: string; kind: AnimalKind; x: number; z: number } | null;
  preyPos: (id: string) => { x: number; z: number } | null;
  consumePrey: (id: string) => boolean;
}

/** World facts the shell owns (probes; dormant defaults). */
export interface CatProbes {
  /** The homed house's point, or null when she has none. */
  homeBase: () => { x: number; z: number } | null;
  /** She is asleep at home (the sleep-hunt window). */
  sleepingAtHome: () => boolean;
}

let catchTable: CatCatchTable | null = null;
let preyAccess: CatPreyAccess | null = null;
let probes: CatProbes = { homeBase: () => null, sleepingAtHome: () => false };

/** Shell install: Systems' catch-set table (the data authority). */
export function installCatCatchTable(table: CatCatchTable | null): void {
  catchTable = table;
}
/** Renderer install: live-prey access over the chunk animals. */
export function installCatPreyAccess(access: CatPreyAccess | null): void {
  preyAccess = access;
}
/** Shell install: the home / sleep facts. */
export function installCatProbes(next: CatProbes): void {
  probes = next;
}

export type HuntPhase = 'none' | 'stalk' | 'return';
export type HuntMode = 'travel' | 'sleep' | 'hearth';
export interface HuntState {
  phase: HuntPhase;
  /** The delivery reading, fixed at launch. */
  mode: HuntMode;
  preyId: string | null;
  /** The prey's kind, fixed at launch (the table's key). */
  preyKind: AnimalKind | null;
  stalkT: number;
}

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
  /** The carried catch's mouth-prop kind (Models' props). */
  propKind: 'mouse' | 'rabbit' | 'fish' | null;
  /** Provisioning state (landing B). */
  hunt: HuntState;
  /** Seconds carried (the no-home eat clock). */
  carryT: number;
  /** Seconds until the next excursion attempt is due. */
  nextHuntT: number;
}

let cat: CatActor | null = null;

/**
 * Stage the cat at a hearth spot. Idempotent: an existing
 * cat keeps its life (a chunk stream or a dimension swap
 * must never reset it). Re-seating to a NEW world is the
 * renderer's explicit clearCat + ensureCat (stageCat).
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
    propKind: null,
    hunt: { phase: 'none', mode: 'travel', preyId: null, preyKind: null, stalkT: 0 },
    carryT: 0,
    nextHuntT: 5,
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

export type CatSignal =
  | { type: 'met' }
  | { type: 'delivered'; item: string }
  | { type: 'present'; item: string; x: number; z: number }
  | { type: 'gift'; item: string; x: number; z: number }
  | { type: 'ate'; item: string };

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

/** Dart-speed movement toward a point (the hunt's legs). */
function huntMove(c: CatActor, tx: number, tz: number, dt: number, ctx: CatStepContext): boolean {
  const inst = c.instance;
  const dx = tx - inst.x;
  const dz = tz - inst.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) {
    stepAnimalAnimation(inst, dt, false);
    return false;
  }
  const speed = 10 * (ctx.speedAt ? ctx.speedAt(inst.x, inst.z) : 1);
  const step = Math.min(dist, speed * dt);
  inst.heading = Math.atan2(dx, dz);
  inst.x += (dx / dist) * step;
  inst.z += (dz / dist) * step;
  if (ctx.pushWalls) {
    const p = ctx.pushWalls(inst.x, inst.z);
    inst.x = p.x;
    inst.z = p.z;
  }
  c.pose = 'stand';
  stepAnimalAnimation(inst, dt, true);
  return true;
}

function rollCadence(): number {
  // One attempt per 1–2 game-hours (DRAFT cadence).
  return PROVISION_GAME_HOUR_S * (1 + Math.random());
}

function endHunt(c: CatActor): void {
  c.hunt.phase = 'none';
  c.hunt.preyId = null;
  c.hunt.preyKind = null;
  c.hunt.stalkT = 0;
  c.dart.phase = 'settle';
  c.dart.settleT = 0;
}

/** Deliver the carried catch per its launch mode; the shell answers the event. */
function deliverCatch(c: CatActor, signals: CatSignal[]): void {
  const item = c.carrying;
  if (!item) return;
  c.carrying = null;
  c.propKind = null;
  c.carryT = 0;
  if (c.hunt.mode === 'sleep') {
    const home = probes.homeBase();
    const x = home ? home.x : c.instance.x;
    const z = home ? home.z : c.instance.z;
    signals.push({ type: 'present', item, x, z });
    bus.emit('cat:present', { item, x, z });
  } else if (c.hunt.mode === 'hearth') {
    signals.push({ type: 'gift', item, x: c.homeX, z: c.homeZ });
    bus.emit('cat:gift', { item, x: c.homeX, z: c.homeZ });
  } else {
    signals.push({ type: 'delivered', item });
    bus.emit('cat:delivered', { item });
  }
}

/**
 * The hunt itself. Excursions launch only with the full
 * machinery installed (Systems' catch table + the
 * renderer's prey access) — without a table the cat
 * simply never hunts; dormant machinery mints nothing.
 * A catch consumes a REAL ambient individual; flight is
 * the miss (a stalk outrun or outlasted is abandoned with
 * nothing taken).
 */
function stepHunt(c: CatActor, dt: number, ctx: CatStepContext, signals: CatSignal[]): void {
  const inst = c.instance;
  if (c.hunt.phase === 'stalk') {
    const pos = preyAccess && c.hunt.preyId ? preyAccess.preyPos(c.hunt.preyId) : null;
    c.hunt.stalkT += dt;
    if (!pos || c.hunt.stalkT > HUNT_GIVE_UP_S || Math.hypot(pos.x - inst.x, pos.z - inst.z) > HUNT_FLED_M) {
      endHunt(c); // escaped — nothing consumed
      c.nextHuntT = rollCadence() * 0.5;
      return;
    }
    if (Math.hypot(pos.x - inst.x, pos.z - inst.z) <= HUNT_CATCH_R_M) {
      const id = c.hunt.preyId;
      const kind = c.hunt.preyKind;
      const taken = id && preyAccess ? preyAccess.consumePrey(id) : false;
      if (taken && kind && catchTable) {
        const item = catchTable.itemFor(kind);
        if (item) {
          c.carrying = item;
          c.propKind = catchTable.propFor(kind);
          c.carryT = 0;
          c.hunt.phase = 'return';
          return;
        }
      }
      endHunt(c);
      return;
    }
    huntMove(c, pos.x, pos.z, dt, ctx);
    return;
  }
  if (c.hunt.phase === 'return') {
    // Anchor by launch mode: sleep and hearth hunts go
    // home; a travel hunt takes the catch to the homed
    // house when she has one, else back to her heel.
    let ax = ctx.playerX;
    let az = ctx.playerZ;
    if (c.hunt.mode === 'hearth') {
      ax = c.homeX;
      az = c.homeZ;
    } else if (c.hunt.mode === 'sleep') {
      const home = probes.homeBase();
      if (home) {
        ax = home.x;
        az = home.z;
      }
    } else {
      const home = probes.homeBase();
      if (home) {
        ax = home.x;
        az = home.z;
      }
    }
    const d = Math.hypot(ax - inst.x, az - inst.z);
    if (d < 1.5) {
      // A travel catch arriving at HER (no home) is not a
      // delivery — it rides at heel until home or hunger.
      if (c.hunt.mode === 'travel' && !probes.homeBase()) {
        endHunt(c);
        return;
      }
      deliverCatch(c, signals);
      endHunt(c);
      return;
    }
    huntMove(c, ax, az, dt, ctx);
  }
}

/** Maybe launch an excursion; contexts per the claim + Adam's ruling. */
function maybeLaunchHunt(c: CatActor, ctx: CatStepContext): void {
  if (!catchTable || !preyAccess || catchTable.kinds.length === 0) return;
  if (c.carrying || c.hunt.phase !== 'none') return;
  let mode: HuntMode;
  let ax = c.instance.x;
  let az = c.instance.z;
  if (c.bond === 'hearth') {
    mode = 'hearth';
    ax = c.homeX;
    az = c.homeZ;
  } else if (probes.sleepingAtHome() && probes.homeBase()) {
    mode = 'sleep';
    const home = probes.homeBase();
    if (home) {
      ax = home.x;
      az = home.z;
    }
  } else if (c.dart.phase === 'settle') {
    mode = 'travel'; // excursions launch from settles only
  } else {
    return;
  }
  const prey = preyAccess.nearestPrey(ax, az, HUNT_MIN_R_M, HUNT_MAX_R_M, catchTable.kinds);
  if (!prey) {
    c.nextHuntT = rollCadence() * 0.5;
    return;
  }
  c.hunt.phase = 'stalk';
  c.hunt.mode = mode;
  c.hunt.preyId = prey.id;
  c.hunt.preyKind = prey.kind;
  c.hunt.stalkT = 0;
  c.nextHuntT = rollCadence();
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
      bus.emit('cat:met', { id: CAT_ID });
      return signals;
    }
  }

  // Provisioning (landing B): a hunt in flight owns the
  // step; a carried catch watches for home (deliver) or
  // the no-home hunger (eat); an idle cat rolls its
  // cadence toward the next excursion.
  if (c.hunt.phase !== 'none') {
    stepHunt(c, dt, ctx, signals);
    return signals;
  }
  if (c.carrying) {
    c.carryT += dt;
    const home = probes.homeBase();
    if (home && c.bond !== 'hearth' && Math.hypot(home.x - inst.x, home.z - inst.z) < 5) {
      deliverCatch(c, signals);
    } else if (!home && c.carryT > CARRY_EAT_S) {
      const item = c.carrying;
      c.carrying = null;
      c.propKind = null;
      c.carryT = 0;
      signals.push({ type: 'ate', item });
    }
  } else {
    c.nextHuntT -= dt;
    if (c.nextHuntT <= 0) {
      maybeLaunchHunt(c, ctx);
      if (c.hunt.phase !== 'none') {
        stepHunt(c, dt, ctx, signals);
        return signals;
      }
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

// The cat's existence is the seed's, never a save's. The
// RENDERER owns re-seating: its stageCat clears and
// re-stages on every surface-gen install. (No bus clear
// here — the shell emits 'world:seedSet' AFTER the
// renderer installs, so a listener on it staged-then-
// cleared on every boot: the composition defect UI found
// 2026-10-31. Fix shape (a), DEV-approved.)
