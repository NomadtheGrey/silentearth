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
 * window closing mid-route dismisses it by a departure
 * flight home — unless the follow is live (attending),
 * in which case the close is deferred and the road runs
 * on; the next window re-stages near wherever she then
 * is (the route is computed from her position — no route
 * state exists to lose). At the Grove's edge it perches
 * finally; when Systems' discovery fact lands, it
 * retires for good.
 *
 * The discovery fact is Systems'; the shell installs it
 * (installGuideProbes). The Grove's point is staged by
 * the renderer from groveSite. All numbers DRAFT.
 *
 * FINDABILITY (Adam's playtest, 2026-11-01 — the bird
 * was seated yet invisible): staging's fallback order is
 * by SIGHT, not distance (the grove-shifted bias before
 * her own ring); the guide perches at its own height
 * (3.75 m, above the ambient birds' 2.0); at a window's
 * opening she FLIES IN visibly and calls on landing; and
 * every call carries the bearing from her to the bird
 * (bearingDeg + compass on 'guide:call') so the shell's
 * lines can say where 'faintly' is.
 *
 * BEHAVIOR (Adam's spec, 2026-11-01): she is a performer
 * working an audience of one. The distances are
 * twilight distances (short legs, a close lead ring —
 * if she can't see it at dusk it isn't guiding); every
 * flight bows across her view; on the perch she turns
 * to watch her, fidgets and hop-flaps; and when she
 * dawdles the bird escalates 'over here' — call, flap
 * display, a display arc back to the same perch — and
 * never leaves. Her pace sets its tempo.
 */
import { bus } from './events';
import { stepAnimalAnimation } from './animals';
import type { AnimalInstance } from './animals';
import { makeCompanionInstance } from './companionRuntime';

/** The guide's stable id (singular by construction). */
export const GUIDE_ID = 'guide:grove';
/** She must close within this (m) of the perch before the next hop.
 *  DRAFT (2026-11-01, Adam: 30-40 m is hard to see at dusk —
 *  the distances came IN to twilight-visible range). */
export const GUIDE_FOLLOW_RANGE_M = 14;
/** One hop's length (m) toward the Grove — SHORT legs (DRAFT). */
export const GUIDE_HOP_M = 18;
/** How far around a hop's ideal end to look for a real tree. */
export const GUIDE_PERCH_SNAP_M = 10;
/** Flight speed and cruise height. */
export const GUIDE_FLY_MPS = 8;
export const GUIDE_CRUISE_Y_M = 7;
/** The final perch ring: this close (m) to the Grove's centre is 'arrived' (DRAFT — in from 35). */
export const GUIDE_LEAD_RING_M = 20;
/** The waiting call repeats on this cadence (s). */
export const GUIDE_CALL_REPEAT_S = 14;
/** A perch's minimum dwell before a hop can trigger — the
 * staging beat: she SEES it perched and calling first. */
export const GUIDE_PERCH_DWELL_S = 2.5;
/** Stage on a tree about this far ahead of her (m) (DRAFT — in from 30). */
export const GUIDE_STAGE_AHEAD_M = 18;
/** The dawdle ladder (DRAFT, s of no closing): she turns
 *  and calls, then FLAPS in place, then flies a display
 *  arc back to the same perch. Escalating 'over here' —
 *  a dawdle never makes her leave. */
export const GUIDE_DAWDLE_CALL_S = 10;
export const GUIDE_DAWDLE_FLAP_S = 22;
export const GUIDE_DAWDLE_ARC_S = 40;
/** Closing this much (m) counts as following: the ladder resets. */
export const GUIDE_CLOSING_RESET_M = 2;
/** ENGAGEMENT (Adam's sentence, 2026-11-01: 'the raven
 *  should be moving right along — he shouldn't hover
 *  over this tree staring at me'). ATTENDING is the one
 *  read both new laws share: she is inside this range
 *  (m, DRAFT) and the follow is live — inside follow
 *  range outright, or improving on her best distance
 *  since the perch. The latch holds for a dawdle-scale
 *  span (GUIDE_DAWDLE_ARC_S) after the last evidence.
 *  While attending: road perches ADVANCE after the
 *  dwell without waiting for follow range, and the
 *  twilight window's close is DEFERRED — the road runs
 *  past the window's edge. On genuine disengagement
 *  with the window closed she leaves by a DEPARTURE
 *  FLIGHT home, never a blink. */
export const GUIDE_ATTEND_RANGE_M = 60;
/** Improving on the best distance by this much (m)
 *  counts as fresh evidence of attending. */
export const GUIDE_ATTEND_EVIDENCE_M = 0.5;
/** Perch fidgets: a hop along the branch on this
 *  cadence (s, DRAFT band), this far (m), GLIDED over
 *  this long (s) — a scoot, not a teleport: Adam's
 *  acceptance (2026-11-01) saw a statue that swivels
 *  because the old instant hop + 0.25 s flick did not
 *  read as movement at range — with a wing-flick of
 *  this length (s) riding the glide. */
export const GUIDE_FIDGET_MIN_S = 5;
export const GUIDE_FIDGET_SPAN_S = 4;
export const GUIDE_FIDGET_HOP_M = 0.35;
export const GUIDE_FIDGET_GLIDE_S = 0.28;
export const GUIDE_FLAP_FLICK_S = 0.4;
/** The flap display's length (s) at the ladder's second rung. */
export const GUIDE_FLAP_DISPLAY_S = 1.2;
/** Flights BOW toward her side by this fraction of the
 *  leg — the arc crosses her view instead of beelining
 *  away from it. */
export const GUIDE_BOW_FRACTION = 0.3;
/** The FALLBACK perch height (m) — used only when a
 *  perch point carries no crown (the staging stub, a
 *  treeless seat). The real seat comes from the TREE
 *  she picks (Adam's acceptance, 2026-11-01: the flat
 *  3.75 floated her above half the crowns near his
 *  dusk spot and buried her in the rest — crowns there
 *  run 2.49–4.64 m): perchNear returns the crown, and
 *  she seats ON it (the seat law below). */
export const GUIDE_PERCH_HEIGHT_M = 3.75;

/** A perch point's seat height: the crown's own top,
 *  or the fallback when no crown is known. THE SEAT
 *  LAW IS VISIBILITY (Adam, 2026-11-01): he is not
 *  concerned about perch height — the float never
 *  bothered him; the failure he names is the opposite,
 *  'if the raven is buried in the tree, can't see it
 *  there, that's no good.' So she perches ON TOP of
 *  her crown, feet at its top surface, her whole body
 *  proud of the foliage — a touch high beats hidden.
 *  (The 0.35 sit-in this replaces risked exactly the
 *  burial on fuller crowns.) */
export function seatYFor(perch: { crownY?: number }): number {
  return perch.crownY != null ? perch.crownY : GUIDE_PERCH_HEIGHT_M;
}
/** The biased fallback's search centre sits this far
 *  (m) toward the Grove from her, with this radius —
 *  the nearest tree to a grove-shifted centre is a
 *  grove-side tree by construction (the half-plane bias;
 *  the direction-blind player-centred ring is the LAST
 *  resort, never the second). Radii DRAFT with the
 *  twilight distances. */
export const GUIDE_BIAS_AHEAD_M = 14;
export const GUIDE_BIAS_RADIUS_M = 22;
/** At a window's opening she FLIES IN from this far (m)
 *  out at cruise height and calls on landing — she is
 *  never seated invisibly between frames. */
export const GUIDE_FLY_IN_M = 10;

/** The eight winds, index 0 = north, clockwise. */
export const GUIDE_COMPASS_WINDS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/**
 * The bearing from her to a point, on the world's
 * compass (north = −z, east = +x): degrees 0=N, 90=E,
 * plus the eight-wind name. The call lines carry it so
 * 'faintly' can finally say WHERE (the findability
 * fix's text half is the shell's; the fact is here).
 */
export function guideBearing(dx: number, dz: number): { bearingDeg: number; compass: string } {
  const bearingDeg = (Math.atan2(dx, -dz) * (180 / Math.PI) + 360) % 360;
  const compass = GUIDE_COMPASS_WINDS[Math.round(bearingDeg / 45) % 8];
  return { bearingDeg, compass };
}

export type GuideState = 'absent' | 'perched' | 'flying' | 'departing' | 'retired';

export interface GuideActor {
  instance: AnimalInstance;
  state: GuideState;
  /** Flight target (perch point) while flying. */
  targetX: number;
  targetZ: number;
  /** The bow waypoint the current flight crosses first (her-side arc). */
  viaX: number;
  viaZ: number;
  hasVia: boolean;
  /** Seconds since the last call. */
  callT: number;
  /** Seconds on the current perch. */
  perchT: number;
  /** The final perch reached (the Grove's edge). */
  atFinalPerch: boolean;
  /** The perch point she is seated on (fidgets wander
   *  around it; the display arc returns to it). */
  homeX: number;
  homeZ: number;
  /** The seated height of the home perch / of the
   *  current flight's target (the tree's own seat). */
  homeY: number;
  targetY: number;
  /** The fidget glide in flight: from/to + time left. */
  glideT: number;
  glideFromX: number;
  glideFromZ: number;
  glideToX: number;
  glideToZ: number;
  /** Seconds since she last closed on the perch (the dawdle clock). */
  waitT: number;
  /** The dawdle ladder's current rung (0 none, 1 called, 2 flapped, 3 arced). */
  dawdleStage: number;
  /** Her distance at the last perched step (closing detection). */
  lastDistP: number;
  /** ENGAGEMENT: the attending latch + its age (s since
   *  the last evidence), the player's distance when the
   *  current perch was taken, and the best (smallest)
   *  distance since — the advance gate and the window
   *  hold both read these. Anchored lazily on the first
   *  perched step after a perch is taken (Infinity
   *  until then, the lastDistP idiom). */
  attending: boolean;
  attendAgeS: number;
  perchDistP: number;
  bestDistP: number;
  /** Seconds to the next perch fidget hop. */
  fidgetT: number;
  /** Wing-flick / flap-display time remaining (drives instance.flying's pose). */
  flapT: number;
  /** Which way along the branch the next fidget hop goes (+1 / -1). */
  fidgetSign: number;
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
export function stageGuide(x: number, z: number, seatY?: number): void {
  grovePoint = { x, z };
  if (guide) return;
  const instance = makeCompanionInstance(GUIDE_ID, 'crow', x, z);
  instance.y = seatY ?? GUIDE_PERCH_HEIGHT_M;
  guide = {
    instance,
    state: 'absent',
    targetX: x,
    targetZ: z,
    viaX: x,
    viaZ: z,
    hasVia: false,
    callT: 0,
    perchT: 0,
    atFinalPerch: false,
    homeX: x,
    homeZ: z,
    homeY: seatY ?? GUIDE_PERCH_HEIGHT_M,
    targetY: seatY ?? GUIDE_PERCH_HEIGHT_M,
    glideT: 0,
    glideFromX: x,
    glideFromZ: z,
    glideToX: x,
    glideToZ: z,
    waitT: 0,
    dawdleStage: 0,
    lastDistP: Number.POSITIVE_INFINITY,
    attending: false,
    attendAgeS: 0,
    perchDistP: Number.POSITIVE_INFINITY,
    bestDistP: Number.POSITIVE_INFINITY,
    fidgetT: GUIDE_FIDGET_MIN_S,
    flapT: 0,
    fidgetSign: 1,
  };
}

export function guideActor(): GuideActor | null {
  return guide;
}

/** The renderer shows the bird exactly in these states. */
export function guideVisible(): boolean {
  return guide !== null && (guide.state === 'perched' || guide.state === 'flying' || guide.state === 'departing');
}

/** Whether the latest step ran inside a dimension (a
 *  cave, an upstairs) — remembered from the step
 *  context so the tag read below can compose the
 *  dimension gate in THIS layer, where the law lives,
 *  instead of the shell re-deriving it (UI's ask,
 *  2026-11-01: a shell-side twin reading is exactly
 *  the kind that drifts — the frozen-mid-state bird
 *  would be the tag's ghost). */
let lastStepDimensionActive = false;

/** The guide's tag seat (UI's tag claim, 2026-11-01):
 *  an immutable snapshot for the shell's nearest-faced
 *  derivation — a fresh object per call, never the
 *  live actor (that stays the renderer's). Null
 *  whenever the bird is not present in the world the
 *  player sees: unstaged, in no visible state, or the
 *  player inside a dimension. State rides along for
 *  the perch/flight distinction; the tag reads 'Raven'
 *  either way in v1. */
export interface GuideTagSeat {
  x: number;
  z: number;
  state: 'perched' | 'flying' | 'departing';
}

export function guideTagSeat(): GuideTagSeat | null {
  if (!guide || lastStepDimensionActive) return null;
  const s = guide.state;
  if (s !== 'perched' && s !== 'flying' && s !== 'departing') return null;
  return { x: guide.instance.x, z: guide.instance.z, state: s };
}

export function clearGuide(): void {
  guide = null;
  grovePoint = null;
  lastStepDimensionActive = false;
}

export interface GuideStepContext {
  playerX: number;
  playerZ: number;
  /** Inside a dawn/dusk window (renderer, from the sky clock). */
  windowOpen: boolean;
  /** A dimension is active: the guide holds, never stages. */
  dimensionActive: boolean;
  /** Nearest real tree point to a spot, or null (renderer ground truth). */
  perchNear: (x: number, z: number, r: number) => { x: number; z: number; crownY?: number } | null;
}

function call(g: GuideActor, playerX: number, playerZ: number): void {
  g.callT = 0;
  const { bearingDeg, compass } = guideBearing(g.instance.x - playerX, g.instance.z - playerZ);
  bus.emit('guide:call', { x: g.instance.x, z: g.instance.z, bearingDeg, compass });
}

function retire(g: GuideActor, playerX: number, playerZ: number): void {
  call(g, playerX, playerZ); // one last call at the Grove
  g.state = 'retired';
  g.instance.flying = false;
}

/** Perch the instance on a tree point — at the tree's
 *  own seat (its crown less the sit-in), or at an
 *  explicitly given seat (a flight's targetY). */
function perchAt(
  g: GuideActor,
  p: { x: number; z: number; crownY?: number },
  seatY?: number,
): void {
  const seat = seatY ?? seatYFor(p);
  g.instance.x = p.x;
  g.instance.z = p.z;
  g.instance.y = seat;
  g.instance.flying = false;
  g.perchT = 0;
  g.homeX = p.x;
  g.homeZ = p.z;
  g.homeY = seat;
  g.glideT = 0;
  g.hasVia = false;
  g.waitT = 0;
  g.dawdleStage = 0;
  g.flapT = 0;
  g.lastDistP = Number.POSITIVE_INFINITY;
  // Engagement re-anchors at every perch: her distance
  // then, and the best since, are the new perch's own.
  g.perchDistP = Number.POSITIVE_INFINITY;
  g.bestDistP = Number.POSITIVE_INFINITY;
  g.fidgetT = GUIDE_FIDGET_MIN_S + Math.random() * GUIDE_FIDGET_SPAN_S;
}

/**
 * ENGAGEMENT bookkeeping (the attending read both new
 * laws share): anchor the perch distances on the first
 * step after a perch is taken; refresh the latch on
 * evidence (follow range outright, or an improvement
 * on the best distance within attend range); age it
 * otherwise, lapsing at the dawdle ladder's full span.
 */
function noteAttending(g: GuideActor, dt: number, distP: number): void {
  if (!Number.isFinite(g.perchDistP)) {
    g.perchDistP = distP;
    g.bestDistP = distP;
  }
  if (distP <= GUIDE_FOLLOW_RANGE_M) {
    g.attending = true;
    g.attendAgeS = 0;
    if (distP < g.bestDistP) g.bestDistP = distP;
  } else if (
    distP <= GUIDE_ATTEND_RANGE_M &&
    distP <= g.bestDistP - GUIDE_ATTEND_EVIDENCE_M
  ) {
    g.attending = true;
    g.attendAgeS = 0;
    g.bestDistP = distP;
  } else {
    g.attendAgeS += dt;
    if (g.attendAgeS >= GUIDE_DAWDLE_ARC_S) g.attending = false;
  }
}

/**
 * Begin a flight to a perch point, BOWED toward her
 * side: the via waypoint sits at the leg's midpoint,
 * offset by GUIDE_BOW_FRACTION of the leg toward the
 * side she stands on — the arc crosses her view
 * instead of beelining away from it (Adam's spec: the
 * bird performs for an audience of one).
 */
function beginFlight(
  g: GuideActor,
  tx: number,
  tz: number,
  playerX: number,
  playerZ: number,
  targetY?: number,
): void {
  const sx = g.instance.x;
  const sz = g.instance.z;
  const dx = tx - sx;
  const dz = tz - sz;
  const dist = Math.hypot(dx, dz);
  g.targetX = tx;
  g.targetZ = tz;
  g.targetY = targetY ?? g.instance.y;
  if (dist > 2) {
    const mx = (sx + tx) / 2;
    const mz = (sz + tz) / 2;
    // Perpendicular of the leg; sign chosen so the bow
    // leans toward her position.
    let px = -dz / dist;
    let pz = dx / dist;
    if (px * (playerX - mx) + pz * (playerZ - mz) < 0) {
      px = -px;
      pz = -pz;
    }
    g.viaX = mx + px * dist * GUIDE_BOW_FRACTION;
    g.viaZ = mz + pz * dist * GUIDE_BOW_FRACTION;
    g.hasVia = true;
  } else {
    g.hasVia = false;
  }
  g.state = 'flying';
  g.instance.flying = true;
}

/**
 * Step the guide one frame. Discovery is checked first
 * (she may find the Grove alone — the guide retires
 * unseen), then the window: it gates STAGING, holds
 * for an attending follow, and dismisses the rest by
 * a departure flight home — existence never blinks.
 */
export function stepGuide(dt: number, ctx: GuideStepContext): void {
  if (!guide || !grovePoint) return;
  lastStepDimensionActive = ctx.dimensionActive;
  const g = guide;
  const inst = g.instance;

  if (g.state === 'retired') return;
  if (discoveredProbe()) {
    retire(g, ctx.playerX, ctx.playerZ);
    return;
  }
  if (ctx.dimensionActive) {
    stepAnimalAnimation(inst, dt, false);
    return;
  }
  if (!ctx.windowOpen) {
    if (g.state === 'departing') {
      // A departure already begun commits — fall
      // through and fly it home.
    } else if ((g.state === 'perched' || g.state === 'flying') && g.attending) {
      // ENGAGEMENT HOLD: the window's close is deferred
      // while the follow is live — the road runs past
      // the twilight's edge. Fall through and step on.
    } else if (g.state === 'perched' || g.state === 'flying') {
      // Genuine disengagement at the close: she leaves
      // by a DEPARTURE FLIGHT home, never a blink. The
      // departure commits — re-engagement mid-flight
      // does not recall her; the next window re-stages.
      beginFlight(g, grovePoint.x, grovePoint.z, ctx.playerX, ctx.playerZ, GUIDE_PERCH_HEIGHT_M);
      g.state = 'departing';
      g.attending = false;
      // Fall through to the flying step below.
    } else {
      g.state = 'absent';
      inst.flying = false;
      return;
    }
  }

  const dxG = grovePoint.x - ctx.playerX;
  const dzG = grovePoint.z - ctx.playerZ;
  const distGrovePlayer = Math.hypot(dxG, dzG);

  if (g.state === 'absent') {
    // Stage: a tree ahead of her, toward the Grove, in
    // sight. The fallbacks are ORDERED BY SIGHT, not by
    // distance (the playtest lesson, 2026-11-01: the old
    // player-centred ring seated her behind-left, low,
    // and 'faintly' said nothing) — first the grove-
    // shifted centre, whose nearest tree is grove-side
    // by construction; only then her own ring.
    const ux = distGrovePlayer > 0.001 ? dxG / distGrovePlayer : 0;
    const uz = distGrovePlayer > 0.001 ? dzG / distGrovePlayer : 1;
    const ahead = ctx.perchNear(
      ctx.playerX + ux * GUIDE_STAGE_AHEAD_M,
      ctx.playerZ + uz * GUIDE_STAGE_AHEAD_M,
      12,
    );
    const biased =
      ahead ??
      ctx.perchNear(
        ctx.playerX + ux * GUIDE_BIAS_AHEAD_M,
        ctx.playerZ + uz * GUIDE_BIAS_AHEAD_M,
        GUIDE_BIAS_RADIUS_M,
      );
    const perch = biased ?? ctx.perchNear(ctx.playerX, ctx.playerZ, 30);
    if (!perch) return; // no tree to haunt — tries again next frame
    g.atFinalPerch = Math.hypot(perch.x - grovePoint.x, perch.z - grovePoint.z) <= GUIDE_LEAD_RING_M;
    // The visible arrival: she starts FLYING, a short
    // way off at cruise height on the line from her to
    // the perch, and the flight step lands + calls her.
    // Never seated invisibly between frames.
    const sx = perch.x - ctx.playerX;
    const sz = perch.z - ctx.playerZ;
    const sDist = Math.hypot(sx, sz);
    const back = sDist > 0.001 ? Math.min(GUIDE_FLY_IN_M, sDist * 0.6) / sDist : 0;
    inst.x = perch.x - sx * back;
    inst.z = perch.z - sz * back;
    inst.y = GUIDE_CRUISE_Y_M;
    beginFlight(g, perch.x, perch.z, ctx.playerX, ctx.playerZ, seatYFor(perch));
    stepAnimalAnimation(inst, dt, true);
    return;
  }

  if (g.state === 'perched') {
    g.callT += dt;
    g.perchT += dt;
    // She watches her audience: the perch heading tracks
    // the player (the turn-to-look is continuous, so the
    // ladder's first rung never needs a snap).
    inst.heading = Math.atan2(ctx.playerX - inst.x, ctx.playerZ - inst.z);
    // Wing pose: a flap burst or fidget flick reads as
    // instance.flying to the pose, while the STATE stays
    // perched (she has not left).
    if (g.flapT > 0) {
      g.flapT -= dt;
      inst.flying = g.flapT > 0;
    } else {
      inst.flying = false;
    }
    // Fidgets: little hops along the branch around the
    // home point (out, back, out the other way) — GLIDED
    // since the acceptance fix (2026-11-01): the scoot
    // itself is the visible motion; the wing-flick
    // rides it.
    g.fidgetT -= dt;
    if (g.fidgetT <= 0 && g.glideT <= 0) {
      g.fidgetT = GUIDE_FIDGET_MIN_S + Math.random() * GUIDE_FIDGET_SPAN_S;
      const axisX = Math.cos(inst.heading);
      const axisZ = -Math.sin(inst.heading);
      const offHome = Math.hypot(inst.x - g.homeX, inst.z - g.homeZ) > 0.01;
      g.glideFromX = inst.x;
      g.glideFromZ = inst.z;
      if (offHome) {
        g.glideToX = g.homeX;
        g.glideToZ = g.homeZ;
      } else {
        g.glideToX = g.homeX + axisX * GUIDE_FIDGET_HOP_M * g.fidgetSign;
        g.glideToZ = g.homeZ + axisZ * GUIDE_FIDGET_HOP_M * g.fidgetSign;
        g.fidgetSign = -g.fidgetSign;
      }
      g.glideT = GUIDE_FIDGET_GLIDE_S;
      g.flapT = Math.max(g.flapT, GUIDE_FLAP_FLICK_S);
    }
    if (g.glideT > 0) {
      g.glideT = Math.max(0, g.glideT - dt);
      const t = 1 - g.glideT / GUIDE_FIDGET_GLIDE_S;
      const smooth = t * t * (3 - 2 * t);
      inst.x = g.glideFromX + (g.glideToX - g.glideFromX) * smooth;
      inst.z = g.glideFromZ + (g.glideToZ - g.glideFromZ) * smooth;
    }
    if (g.callT >= GUIDE_CALL_REPEAT_S) call(g, ctx.playerX, ctx.playerZ);
    const distP = Math.hypot(ctx.playerX - inst.x, ctx.playerZ - inst.z);
    // Her pace sets the tempo: real closing resets the
    // dawdle ladder; standing in range holds it at zero.
    if (distP < g.lastDistP - GUIDE_CLOSING_RESET_M || distP <= GUIDE_FOLLOW_RANGE_M) {
      g.waitT = 0;
      g.dawdleStage = 0;
    }
    g.lastDistP = distP;
    noteAttending(g, dt, distP);
    stepAnimalAnimation(inst, dt, g.flapT > 0);
    if (distP > GUIDE_FOLLOW_RANGE_M) {
      if (g.attending) {
        // Attention is proven: the ladder's premise is
        // its absence, so the dawdle clock holds at zero
        // and she falls through to the advance gate.
        g.waitT = 0;
        g.dawdleStage = 0;
      } else {
        // THE DAWDLE LADDER — she escalates 'over here',
        // she never leaves. (Runs at the final perch too:
        // the audience is still owed a performance.)
        g.waitT += dt;
        if (g.dawdleStage < 1 && g.waitT >= GUIDE_DAWDLE_CALL_S) {
          g.dawdleStage = 1;
          call(g, ctx.playerX, ctx.playerZ);
        } else if (g.dawdleStage < 2 && g.waitT >= GUIDE_DAWDLE_FLAP_S) {
          g.dawdleStage = 2;
          g.flapT = GUIDE_FLAP_DISPLAY_S;
          call(g, ctx.playerX, ctx.playerZ);
        } else if (g.dawdleStage < 3 && g.waitT >= GUIDE_DAWDLE_ARC_S) {
          g.dawdleStage = 3;
          // The display arc: up, across her view on the
          // bow, and back to THIS perch; the landing calls.
          beginFlight(g, g.homeX, g.homeZ, ctx.playerX, ctx.playerZ, g.homeY);
          if (!g.hasVia) {
            // Seated exactly on the target — force a loop:
            // out toward her side, across, and back.
            const toX = ctx.playerX - inst.x;
            const toZ = ctx.playerZ - inst.z;
            const toD = Math.hypot(toX, toZ) || 1;
            g.viaX = inst.x + (toX / toD) * 3 - (toZ / toD) * 4;
            g.viaZ = inst.z + (toZ / toD) * 3 + (toX / toD) * 4;
            g.hasVia = true;
          }
        }
        return; // inattention: she waits at this perch
      }
    }
    if (g.atFinalPerch) return; // the edge perch: it waits for her discovery
    if (g.perchT < GUIDE_PERCH_DWELL_S) return; // the staging beat
    if (distP > GUIDE_FOLLOW_RANGE_M) {
      // THE ADVANCE GATE (engagement): beyond follow
      // range an attended follow still moves right
      // along — she must be within attend range and
      // have been closed on by the closing measure
      // since this perch was taken. (Within follow
      // range the hop below is the standing law.)
      if (!g.attending) return;
      if (distP > GUIDE_ATTEND_RANGE_M) return;
      if (g.perchDistP - distP < GUIDE_CLOSING_RESET_M) return;
    }
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
    g.atFinalPerch = Math.hypot(perch.x - grovePoint.x, perch.z - grovePoint.z) <= GUIDE_LEAD_RING_M;
    beginFlight(g, perch.x, perch.z, ctx.playerX, ctx.playerZ, seatYFor(perch));
    return;
  }

  // Flying: cross the bow waypoint first (the arc that
  // crosses her view), then settle onto the perch.
  if (g.hasVia) {
    const vdx = g.viaX - inst.x;
    const vdz = g.viaZ - inst.z;
    if (Math.hypot(vdx, vdz) < Math.max(0.8, GUIDE_FLY_MPS * dt)) {
      g.hasVia = false;
    }
  }
  const aimX = g.hasVia ? g.viaX : g.targetX;
  const aimZ = g.hasVia ? g.viaZ : g.targetZ;
  const dx = aimX - inst.x;
  const dz = aimZ - inst.z;
  const dist = Math.hypot(dx, dz);
  const distTarget = Math.hypot(g.targetX - inst.x, g.targetZ - inst.z);
  if (g.state === 'flying') {
    // The follow stays live mid-flight too — the
    // window hold reads this latch at the close.
    noteAttending(g, dt, Math.hypot(ctx.playerX - inst.x, ctx.playerZ - inst.z));
  }
  if (!g.hasVia && distTarget < 0.6) {
    if (g.state === 'departing') {
      // Home. Only NOW does she leave the world — the
      // absence is an arrival, not a blink.
      g.state = 'absent';
      g.attending = false;
      inst.flying = false;
      stepAnimalAnimation(inst, dt, false);
      return;
    }
    perchAt(g, { x: g.targetX, z: g.targetZ }, g.targetY);
    g.state = 'perched';
    call(g, ctx.playerX, ctx.playerZ);
    stepAnimalAnimation(inst, dt, false);
    return;
  }
  const step = Math.min(dist, GUIDE_FLY_MPS * dt);
  inst.heading = Math.atan2(dx, dz);
  inst.x += (dx / dist) * step;
  inst.z += (dz / dist) * step;
  const wantY = distTarget > 6 || g.hasVia ? GUIDE_CRUISE_Y_M : g.targetY;
  const dy = wantY - inst.y;
  inst.y += Math.max(-dt * 4, Math.min(dt * 4, dy));
  stepAnimalAnimation(inst, dt, true);
}

// No bus clear here (the cat's lesson, 2026-10-31): the
// shell emits 'world:seedSet' AFTER the renderer installs
// and stages, so a seedSet listener clears what staging
// just built. The RENDERER owns re-seating explicitly —
// clearGuide + stageGuide on every surface-gen install.
