/**
 * THE RAVEN GUIDE — discovery clue for the Grove
 * (Background claim approved 2026-10-31; Adam's seed: the
 * singular places get discovery clues, the Grove's is a
 * bird). NAMING, carried open: Adam's word is 'raven';
 * the roster kind — and so this engine — is 'crow'. The
 * name she reads on the shell's surfaces is Adam's to
 * settle; nothing here picks it.
 *
 * A singular guide individual (the cat's singleton
 * pattern — never ambient, never offerable, never in
 * getVisibleAnimals). It exists only inside the dawn and
 * dusk windows (Adam-settled; ~2 game-hours each, DRAFT),
 * repeating daily until the Grove is discovered. Inside a
 * window it stages perched on a tree within sight of her,
 * calls, and — when she follows — leads perch to perch
 * toward the Grove: settle, call, fly on, at HER pace. If
 * she loses it, it waits at its next perch calling. A
 * window closing mid-route dismisses it; the next window
 * re-stages near wherever she then is (the route is
 * computed from her position — no route state exists to
 * lose). At the Grove's edge it perches finally; when
 * Systems' discovery fact lands, it retires for good.
 *
 * The discovery fact is Systems'; the shell installs it
 * (installGuideProbes). The Grove's point is staged by
 * the renderer from groveSite. All numbers DRAFT.
 */
import { bus } from './events';
import { stepAnimalAnimation, PERCH_HEIGHT_M } from './animals';
import type { AnimalInstance } from './animals';
import { makeCompanionInstance } from './companionRuntime';

/** The guide's stable id (singular by construction). */
export const GUIDE_ID = 'guide:grove';
/** She must close within this (m) of the perch before the next hop. */
export const GUIDE_FOLLOW_RANGE_M = 25;
/** One hop's length (m) toward the Grove. */
export const GUIDE_HOP_M = 40;
/** How far around a hop's ideal end to look for a real tree. */
export const GUIDE_PERCH_SNAP_M = 12;
/** Flight speed and cruise height. */
export const GUIDE_FLY_MPS = 8;
export const GUIDE_CRUISE_Y_M = 7;
/** The final perch ring: this close (m) to the Grove's centre is 'arrived'. */
export const GUIDE_LEAD_RING_M = 35;
/** The waiting call repeats on this cadence (s). */
export const GUIDE_CALL_REPEAT_S = 20;
/** A perch's minimum dwell before a hop can trigger — the
 * staging beat: she SEES it perched and calling first. */
export const GUIDE_PERCH_DWELL_S = 2.5;
/** Stage on a tree about this far ahead of her (m). */
export const GUIDE_STAGE_AHEAD_M = 30;

export type GuideState = 'absent' | 'perched' | 'flying' | 'retired';

export interface GuideActor {
  instance: AnimalInstance;
  state: GuideState;
  /** Flight target (perch point) while flying. */
  targetX: number;
  targetZ: number;
  /** Seconds since the last call. */
  callT: number;
  /** Seconds on the current perch. */
  perchT: number;
  /** The final perch reached (the Grove's edge). */
  atFinalPerch: boolean;
}

let guide: GuideActor | null = null;
let grovePoint: { x: number; z: number } | null = null;
let discoveredProbe: () => boolean = () => false;

/** Shell install: Systems' grove-discovery fact. */
export function installGuideProbes(probes: { groveDiscovered: () => boolean }): void {
  discoveredProbe = probes.groveDiscovered;
}

/**
 * Stage the guide's world (the renderer, per surface
 * gen). Idempotent; re-seating to a new world is the
 * renderer's explicit clearGuide + stageGuide.
 */
export function stageGuide(x: number, z: number): void {
  grovePoint = { x, z };
  if (guide) return;
  const instance = makeCompanionInstance(GUIDE_ID, 'crow', x, z);
  instance.y = PERCH_HEIGHT_M;
  guide = {
    instance,
    state: 'absent',
    targetX: x,
    targetZ: z,
    callT: 0,
    perchT: 0,
    atFinalPerch: false,
  };
}

export function guideActor(): GuideActor | null {
  return guide;
}

/** The renderer shows the bird exactly in these states. */
export function guideVisible(): boolean {
  return guide !== null && (guide.state === 'perched' || guide.state === 'flying');
}

export function clearGuide(): void {
  guide = null;
  grovePoint = null;
}

export interface GuideStepContext {
  playerX: number;
  playerZ: number;
  /** Inside a dawn/dusk window (renderer, from the sky clock). */
  windowOpen: boolean;
  /** A dimension is active: the guide holds, never stages. */
  dimensionActive: boolean;
  /** Nearest real tree point to a spot, or null (renderer ground truth). */
  perchNear: (x: number, z: number, r: number) => { x: number; z: number } | null;
}

function call(g: GuideActor): void {
  g.callT = 0;
  bus.emit('guide:call', { x: g.instance.x, z: g.instance.z });
}

function retire(g: GuideActor): void {
  call(g); // one last call at the Grove
  g.state = 'retired';
  g.instance.flying = false;
}

/** Perch the instance on a tree point. */
function perchAt(g: GuideActor, p: { x: number; z: number }): void {
  g.instance.x = p.x;
  g.instance.z = p.z;
  g.instance.y = PERCH_HEIGHT_M;
  g.instance.flying = false;
  g.perchT = 0;
}

/**
 * Step the guide one frame. Discovery is checked first
 * (she may find the Grove alone — the guide retires
 * unseen), then the window gates existence itself.
 */
export function stepGuide(dt: number, ctx: GuideStepContext): void {
  if (!guide || !grovePoint) return;
  const g = guide;
  const inst = g.instance;

  if (g.state === 'retired') return;
  if (discoveredProbe()) {
    retire(g);
    return;
  }
  if (ctx.dimensionActive) {
    stepAnimalAnimation(inst, dt, false);
    return;
  }
  if (!ctx.windowOpen) {
    g.state = 'absent';
    inst.flying = false;
    return;
  }

  const dxG = grovePoint.x - ctx.playerX;
  const dzG = grovePoint.z - ctx.playerZ;
  const distGrovePlayer = Math.hypot(dxG, dzG);

  if (g.state === 'absent') {
    // Stage: a tree ahead of her, toward the Grove, in
    // sight — or the nearest tree to her if the line
    // offers none.
    const ux = distGrovePlayer > 0.001 ? dxG / distGrovePlayer : 0;
    const uz = distGrovePlayer > 0.001 ? dzG / distGrovePlayer : 1;
    const ahead = ctx.perchNear(
      ctx.playerX + ux * GUIDE_STAGE_AHEAD_M,
      ctx.playerZ + uz * GUIDE_STAGE_AHEAD_M,
      15,
    );
    const perch = ahead ?? ctx.perchNear(ctx.playerX, ctx.playerZ, 40);
    if (!perch) return; // no tree to haunt — tries again next frame
    perchAt(g, perch);
    g.state = 'perched';
    g.atFinalPerch = Math.hypot(perch.x - grovePoint.x, perch.z - grovePoint.z) <= GUIDE_LEAD_RING_M;
    call(g);
    stepAnimalAnimation(inst, dt, false);
    return;
  }

  if (g.state === 'perched') {
    g.callT += dt;
    g.perchT += dt;
    if (g.callT >= GUIDE_CALL_REPEAT_S) call(g);
    stepAnimalAnimation(inst, dt, false);
    if (g.atFinalPerch) return; // the edge perch: it waits for her discovery
    const distP = Math.hypot(ctx.playerX - inst.x, ctx.playerZ - inst.z);
    if (distP > GUIDE_FOLLOW_RANGE_M) return; // she hasn't followed yet
    if (g.perchT < GUIDE_PERCH_DWELL_S) return; // the staging beat
    // The next hop: toward the Grove, onto a real tree —
    // clamped so the flight ends AT the lead ring, never
    // deep inside it: the final perch is the Grove's edge.
    const dx = grovePoint.x - inst.x;
    const dz = grovePoint.z - inst.z;
    const distG = Math.hypot(dx, dz);
    if (distG <= GUIDE_LEAD_RING_M + GUIDE_PERCH_SNAP_M) {
      g.atFinalPerch = true;
      return;
    }
    const hop = Math.min(GUIDE_HOP_M, distG - GUIDE_LEAD_RING_M);
    const hx = inst.x + (dx / distG) * hop;
    const hz = inst.z + (dz / distG) * hop;
    let perch = ctx.perchNear(hx, hz, GUIDE_PERCH_SNAP_M);
    if (!perch) {
      // Shorten the hop to the farthest tree on the line.
      for (const frac of [0.7, 0.45, 0.25]) {
        perch = ctx.perchNear(
          inst.x + (dx / distG) * hop * frac,
          inst.z + (dz / distG) * hop * frac,
          GUIDE_PERCH_SNAP_M,
        );
        if (perch) break;
      }
    }
    if (!perch) return; // treeless stretch — waits and calls
    g.targetX = perch.x;
    g.targetZ = perch.z;
    g.atFinalPerch = Math.hypot(perch.x - grovePoint.x, perch.z - grovePoint.z) <= GUIDE_LEAD_RING_M;
    g.state = 'flying';
    inst.flying = true;
    return;
  }

  // Flying: rise to cruise, cross, settle onto the perch.
  const dx = g.targetX - inst.x;
  const dz = g.targetZ - inst.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.6) {
    perchAt(g, { x: g.targetX, z: g.targetZ });
    g.state = 'perched';
    call(g);
    stepAnimalAnimation(inst, dt, false);
    return;
  }
  const step = Math.min(dist, GUIDE_FLY_MPS * dt);
  inst.heading = Math.atan2(dx, dz);
  inst.x += (dx / dist) * step;
  inst.z += (dz / dist) * step;
  const wantY = dist > 6 ? GUIDE_CRUISE_Y_M : PERCH_HEIGHT_M;
  const dy = wantY - inst.y;
  inst.y += Math.max(-dt * 4, Math.min(dt * 4, dy));
  stepAnimalAnimation(inst, dt, true);
}

// No bus clear here (the cat's lesson, 2026-10-31): the
// shell emits 'world:seedSet' AFTER the renderer installs
// and stages, so a seedSet listener clears what staging
// just built. The RENDERER owns re-seating explicitly —
// clearGuide + stageGuide on every surface-gen install.
