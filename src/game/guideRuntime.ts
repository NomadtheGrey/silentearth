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
 * window it flies in, takes up its station, and leads her
 * toward the Grove — or toward a lesser grove the
 * renderer lends it (the retarget: nearest ungleamed
 * within GUIDE_LESSER_RANGE_M). A window closing
 * mid-route dismisses it by a departure flight home —
 * unless the follow is live (she is within the leash),
 * in which case the close is deferred and the road runs
 * on; the next window re-stages near wherever she then
 * is (the route is computed from her position — no route
 * state exists to lose). At the target's edge it hovers
 * over the door itself; when Systems' discovery fact
 * lands, it retires for good.
 *
 * The discovery fact is Systems'; the shell installs it
 * (installGuideProbes). The Grove's point is staged by
 * the renderer from groveSite. All numbers DRAFT.
 *
 * THE HOVER RE-CUT (Adam's redesign, 2026-11-06 — his
 * field report + the perch-island diagnosis killed the
 * tree-hop model): the guide's locomotion is HOVERING.
 * No perches, no hop search, no staging rings, no recede
 * anchor — the whole island failure family died with
 * perching. The bird is airborne as its working state:
 *
 *  - STATION: it hovers at a standoff (~18 m) from her,
 *    on the target's bearing — between her and the door.
 *    She closes in (inside the ~9 m trigger) and it
 *    moves off to the standoff again, grove-side: she is
 *    led by pursuit, each approach stepping it — and
 *    her — toward the grove. As she walks the bearing,
 *    the station travels with her and it re-glides
 *    whenever the station drifts.
 *  - SHUTTLE: she walks AWAY — her distance to the
 *    target grows past her best progress by the loss
 *    measure — and it leaves station to win her back:
 *    out to her (an attention point ~9 m off, a call),
 *    then out toward the grove the shuttle leg (~25 m),
 *    then back to her, the direction traced repeatedly
 *    until she takes it. Regained progress ends the
 *    shuttle; station resumes.
 *  - ARRIVAL: when she closes within the lead ring of
 *    the target, it hovers over the door itself and
 *    waits there.
 *
 * Calls are the attention voice throughout (every
 * arrival, every shuttle leg, the standing repeat), and
 * every call carries the bearing from her to the bird
 * (bearingDeg + compass on 'guide:call') so the shell's
 * lines can say where 'faintly' is. THE GAZE carries
 * over from the old law: close or just-called, she faces
 * her audience; the rest of the time she faces along her
 * route.
 */
import { bus } from './events';
import { stepAnimalAnimation } from './animals';
import type { AnimalInstance } from './animals';
import { makeCompanionInstance } from './companionRuntime';

/** The guide's stable id (singular by construction). */
export const GUIDE_ID = 'guide:grove';
/** Close company (m): inside this she faces her, and
 *  standing inside it holds the call cadence familiar —
 *  the old follow range, kept for the gaze. DRAFT. */
export const GUIDE_FOLLOW_RANGE_M = 20;
/** The standoff (m): her station distance from the
 *  player, on the target's bearing (DEV DRAFT for
 *  Adam's pin pass, 2026-11-06). */
export const GUIDE_STANDOFF_M = 18;
/** The close trigger (m): she closes inside this and
 *  the bird moves off to the standoff (DEV DRAFT). */
export const GUIDE_CLOSE_TRIGGER_M = 9;
/** The shuttle leg (m): how far out toward the target
 *  the shuttle's far point stands from her (DEV DRAFT). */
export const GUIDE_SHUTTLE_LEG_M = 25;
/** The shuttle's near point (m from her): the attention
 *  pass — close enough to demand a look, priced at the
 *  close trigger so she can nearly reach it. DRAFT. */
export const GUIDE_SHUTTLE_NEAR_M = 9;
/** The hover height (m): her working altitude while
 *  holding a point (DEV DRAFT). */
export const GUIDE_HOVER_Y_M = 6;
/** Flight speed and cruise height (transit runs a metre
 *  above the hover so a move reads as travel). */
export const GUIDE_FLY_MPS = 8;
export const GUIDE_CRUISE_Y_M = 7;
/** Station drift (m): the station point may wander this
 *  far from the bird (as she moves) before it re-glides
 *  — hysteresis so a slow walk is a glide, not a jitter.
 *  DRAFT. */
export const GUIDE_REPOSITION_EPS_M = 6;
/** The shuttle's dwell (s) at each leg end before the
 *  next leg — the beat that lets her read the trace.
 *  DRAFT. */
export const GUIDE_SHUTTLE_DWELL_S = 1.2;
/** Progress lost (m): her distance to the target may
 *  grow this far past her best before the shuttle reads
 *  her as walking away (the closing measure's heir).
 *  DRAFT. */
export const GUIDE_PROGRESS_LOSS_M = 2;
/** The hover bob (m / s): a slow rise and fall at the
 *  station so a held point still reads alive. DRAFT. */
export const GUIDE_HOVER_BOB_M = 0.35;
export const GUIDE_HOVER_BOB_PERIOD_S = 4.5;
/** The final hover ring: this close (m) to the target
 *  point, she has arrived (DRAFT — carried from the
 *  perch model's lead ring). */
export const GUIDE_LEAD_RING_M = 20;
/**
 * The lesser-grove lead's reach (Adam's correction,
 * 2026-11-05 — 'if we get close-ish, the raven should
 * try to lead the player there also'): a lesser grove
 * within this (m) of her can call the bird over. Priced
 * at the bat exodus's clue scale. DRAFT.
 */
export const GUIDE_LESSER_RANGE_M = 250;
/** The waiting call repeats on this cadence (s). */
export const GUIDE_CALL_REPEAT_S = 14;
/** The gaze's call beat (DRAFT, s): for this long after
 *  a call she faces her audience; otherwise, off follow
 *  range, she faces along her route (the gaze law in
 *  the hover step). */
export const GUIDE_GAZE_CALL_S = 1.2;
/** THE LEASH (m, DRAFT): she within this of the bird is
 *  a live follow — the twilight window's close is
 *  deferred while she stands inside it, and a departure
 *  is owed only beyond it. (The perch model's attending
 *  latch, simplified to the one read the hover needs:
 *  distance, no anchor — anchors are what parked her.) */
export const GUIDE_LEASH_M = 60;
/** Flights BOW toward her side by this fraction of the
 *  leg — the arc crosses her view instead of beelining
 *  away from it (Adam's spec: the bird performs for an
 *  audience of one). */
export const GUIDE_BOW_FRACTION = 0.3;
/** At a window's opening she FLIES IN from this far (m)
 *  beyond her station at cruise height and calls on
 *  landing — she is never seated invisibly between
 *  frames. */
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

export type GuideState = 'absent' | 'hovering' | 'flying' | 'departing' | 'retired';

/** What a flight is FOR — its arrival reads its kind. */
export type GuideFlightKind = 'stage' | 'move' | 'shuttle' | 'final' | 'depart';

export interface GuideActor {
  instance: AnimalInstance;
  state: GuideState;
  /** Flight target while flying. */
  targetX: number;
  targetZ: number;
  /** The flight target's height (the hover, usually). */
  targetY: number;
  /** The current flight's purpose (see GuideFlightKind). */
  flightKind: GuideFlightKind;
  /** The bow waypoint the current flight crosses first (her-side arc). */
  viaX: number;
  viaZ: number;
  hasVia: boolean;
  /** Seconds since the last call. */
  callT: number;
  /** The lead mode: holding station, or shuttling for her attention. */
  mode: 'station' | 'shuttle';
  /** The shuttle's next leg to fly ('near' = to her, 'far' = out the bearing). */
  shuttleLeg: 'near' | 'far';
  /** Seconds left dwelling at a shuttle leg's end. */
  dwellT: number;
  /** Her best (smallest) distance to the target on this
   *  road — the progress mark the shuttle reads against.
   *  Re-anchored when the target changes. */
  progressBest: number;
  /** The target point the progress mark belongs to. */
  progressTpX: number;
  progressTpZ: number;
  /** She has arrived: the bird hovers over the target itself. */
  atFinal: boolean;
  /** The hover bob's clock (s). */
  hoverT: number;
  /** She stands within the leash — a live follow (the
   *  window hold reads it; refreshed every stepped
   *  frame from the plain distance, no anchor). */
  attending: boolean;
}

let guide: GuideActor | null = null;
let grovePoint: { x: number; z: number } | null = null;
let discoveredProbe: () => boolean = () => false;
let lesserGleamedProbe: (fragmentId: string) => boolean = () => false;

/** Shell install: Systems' grove-discovery fact. */
export function installGuideProbes(probes: {
  groveDiscovered: () => boolean;
  /**
   * Whether she has gleamed (copied) a lesser grove's
   * fragment, by fragment id (Adam's correction,
   * 2026-11-05 — the raven leads to UNGLEAMED groves).
   * Optional: uninstalled reads ungleamed, the standing
   * probe contract (the shell installs at boot).
   */
  lesserGroveGleamed?: (fragmentId: string) => boolean;
}): void {
  discoveredProbe = probes.groveDiscovered;
  if (probes.lesserGroveGleamed) lesserGleamedProbe = probes.lesserGroveGleamed;
}

/** The renderer's read of the lesser-gleam probe. */
export function isLesserGroveGleamed(fragmentId: string): boolean {
  return lesserGleamedProbe(fragmentId);
}

/**
 * The lesser-grove retarget (Adam's correction,
 * 2026-11-05): while a retarget stands, the lead
 * machine runs against IT — a lesser grove's entrance
 * seat — instead of The Grove's point. The bird's home
 * (its actor home seat) never moves; clearing the
 * retarget hands it back to its standing job. The
 * renderer decides per frame (range, gleam, arrival).
 */
let retargetPoint: { x: number; z: number } | null = null;

export function retargetGuide(x: number, z: number): void {
  retargetPoint = { x, z };
}

export function clearRetarget(): void {
  retargetPoint = null;
}

/** The point the lead machine currently serves. */
export function guideTargetPoint(): { x: number; z: number } | null {
  return retargetPoint ?? grovePoint;
}

/**
 * Stage the guide's world (the renderer, per surface
 * gen). Idempotent; re-seating to a new world is the
 * renderer's explicit clearGuide + stageGuide.
 */
export function stageGuide(x: number, z: number): void {
  grovePoint = { x, z };
  retargetPoint = null;
  if (guide) return;
  const instance = makeCompanionInstance(GUIDE_ID, 'crow', x, z);
  instance.y = GUIDE_HOVER_Y_M;
  guide = {
    instance,
    state: 'absent',
    targetX: x,
    targetZ: z,
    targetY: GUIDE_HOVER_Y_M,
    flightKind: 'stage',
    viaX: x,
    viaZ: z,
    hasVia: false,
    callT: 0,
    mode: 'station',
    shuttleLeg: 'near',
    dwellT: 0,
    progressBest: Number.POSITIVE_INFINITY,
    progressTpX: x,
    progressTpZ: z,
    atFinal: false,
    hoverT: 0,
    attending: false,
  };
}

export function guideActor(): GuideActor | null {
  return guide;
}

/** The renderer shows the bird exactly in these states. */
export function guideVisible(): boolean {
  return guide !== null && (guide.state === 'hovering' || guide.state === 'flying' || guide.state === 'departing');
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
 *  the hover/flight distinction; the tag reads 'Raven'
 *  either way in v1. */
export interface GuideTagSeat {
  x: number;
  z: number;
  /** The bird's live height (m) — its hover, carried
   *  since 2026-11-03 (the tag diagnosis: the shell
   *  projected every tag at 1 m, so 'Raven' rendered
   *  at the trunk, metres under the bird — she flies
   *  now, and the seat carries her true height still).
   *  Consumers project at it when present. */
  y: number;
  state: 'hovering' | 'flying' | 'departing';
}

export function guideTagSeat(): GuideTagSeat | null {
  if (!guide || lastStepDimensionActive) return null;
  const s = guide.state;
  if (s !== 'hovering' && s !== 'flying' && s !== 'departing') return null;
  return { x: guide.instance.x, z: guide.instance.z, y: guide.instance.y, state: s };
}

export function clearGuide(): void {
  guide = null;
  grovePoint = null;
  retargetPoint = null;
  lastStepDimensionActive = false;
}

export interface GuideStepContext {
  playerX: number;
  playerZ: number;
  /** Inside a dawn/dusk window (renderer, from the sky clock). */
  windowOpen: boolean;
  /** A dimension is active: the guide holds, never stages. */
  dimensionActive: boolean;
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

/**
 * Begin a flight to a point, BOWED toward her side: the
 * via waypoint sits at the leg's midpoint, offset by
 * GUIDE_BOW_FRACTION of the leg toward the side she
 * stands on — the arc crosses her view instead of
 * beelining away from it (Adam's spec: the bird
 * performs for an audience of one).
 */
function beginFlight(
  g: GuideActor,
  kind: GuideFlightKind,
  tx: number,
  tz: number,
  playerX: number,
  playerZ: number,
  targetY: number = GUIDE_HOVER_Y_M,
): void {
  const sx = g.instance.x;
  const sz = g.instance.z;
  const dx = tx - sx;
  const dz = tz - sz;
  const dist = Math.hypot(dx, dz);
  g.targetX = tx;
  g.targetZ = tz;
  g.targetY = targetY;
  g.flightKind = kind;
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
  g.state = kind === 'depart' ? 'departing' : 'flying';
  g.instance.flying = true;
}

/** The station point: the standoff from her, on the target's bearing. */
function stationPoint(
  tp: { x: number; z: number },
  playerX: number,
  playerZ: number,
): { x: number; z: number } {
  const dx = tp.x - playerX;
  const dz = tp.z - playerZ;
  const d = Math.hypot(dx, dz);
  const ux = d > 0.001 ? dx / d : 0;
  const uz = d > 0.001 ? dz / d : 1;
  return { x: playerX + ux * GUIDE_STANDOFF_M, z: playerZ + uz * GUIDE_STANDOFF_M };
}

/** A point this far from her, on the target's bearing (the shuttle's legs). */
function bearingPoint(
  tp: { x: number; z: number },
  playerX: number,
  playerZ: number,
  distM: number,
): { x: number; z: number } {
  const dx = tp.x - playerX;
  const dz = tp.z - playerZ;
  const d = Math.hypot(dx, dz);
  const ux = d > 0.001 ? dx / d : 0;
  const uz = d > 0.001 ? dz / d : 1;
  return { x: playerX + ux * distM, z: playerZ + uz * distM };
}

/**
 * Step the guide one frame. Discovery is checked first
 * (she may find the Grove alone — the guide retires
 * unseen), then the window: it gates STAGING, holds
 * for a live follow, and dismisses the rest by a
 * departure flight home — existence never blinks.
 */
export function stepGuide(dt: number, ctx: GuideStepContext): void {
  if (!guide || !grovePoint) return;
  lastStepDimensionActive = ctx.dimensionActive;
  const g = guide;
  const inst = g.instance;
  // The point this step serves: a standing lesser-grove
  // retarget, else The Grove's own point. (Discovery
  // still retires the bird outright below — the lesser
  // lead lives inside the guide's active season, and a
  // retarget standing over a retired bird is inert.)
  const tp = retargetPoint ?? grovePoint;

  if (g.state === 'retired') return;
  if (discoveredProbe()) {
    retire(g, ctx.playerX, ctx.playerZ);
    return;
  }
  if (ctx.dimensionActive) {
    stepAnimalAnimation(inst, dt, false);
    return;
  }

  const distP = Math.hypot(ctx.playerX - inst.x, ctx.playerZ - inst.z);
  const distTp = Math.hypot(tp.x - ctx.playerX, tp.z - ctx.playerZ);
  // The follow is a plain distance read (the leash) —
  // refreshed wherever she is stepped, perch anchors
  // having died with perching.
  g.attending = distP <= GUIDE_LEASH_M;

  if (!ctx.windowOpen) {
    if (g.state === 'departing') {
      // A departure already begun commits — fall
      // through and fly it home.
    } else if ((g.state === 'hovering' || g.state === 'flying') && g.attending) {
      // THE HOLD: the window's close is deferred while
      // the follow is live — the road runs past the
      // twilight's edge. Fall through and step on.
    } else if (g.state === 'hovering' || g.state === 'flying') {
      // Genuine disengagement at the close: she leaves
      // by a DEPARTURE FLIGHT home, never a blink. The
      // departure commits — re-engagement mid-flight
      // does not recall her; the next window re-stages.
      beginFlight(g, 'depart', tp.x, tp.z, ctx.playerX, ctx.playerZ, GUIDE_HOVER_Y_M);
      g.attending = false;
      // Fall through to the flying step below.
    } else {
      g.state = 'absent';
      inst.flying = false;
      return;
    }
  }

  // PROGRESS (the shuttle's read): her best distance to
  // the target on this road. A fresh target re-anchors
  // the mark — progress is per-target, never carried
  // across a retarget.
  if (tp.x !== g.progressTpX || tp.z !== g.progressTpZ) {
    g.progressTpX = tp.x;
    g.progressTpZ = tp.z;
    g.progressBest = distTp;
    g.mode = 'station';
    g.atFinal = false;
  } else if (distTp < g.progressBest) {
    g.progressBest = distTp;
  }
  const offRoad = distTp > g.progressBest + GUIDE_PROGRESS_LOSS_M;

  if (g.state === 'absent') {
    // Stage: she appears at cruise height a short way
    // BEYOND her station (on the target's bearing, in
    // her line of sight to the door) and flies in to it,
    // calling on arrival — never placed invisibly
    // between frames. No tree is consulted; there is
    // no country this cannot stage in.
    const s = stationPoint(tp, ctx.playerX, ctx.playerZ);
    const ux = s.x - ctx.playerX;
    const uz = s.z - ctx.playerZ;
    const sd = Math.hypot(ux, uz);
    const back = sd > 0.001 ? Math.min(GUIDE_FLY_IN_M, sd * 0.6) / sd : 0;
    inst.x = s.x + ux * back;
    inst.z = s.z + uz * back;
    inst.y = GUIDE_CRUISE_Y_M;
    g.progressBest = distTp;
    g.progressTpX = tp.x;
    g.progressTpZ = tp.z;
    g.mode = 'station';
    g.atFinal = false;
    beginFlight(g, 'stage', s.x, s.z, ctx.playerX, ctx.playerZ);
    stepAnimalAnimation(inst, dt, true);
    return;
  }

  if (g.state === 'hovering') {
    g.callT += dt;
    g.hoverT += dt;
    // The held point breathes: a slow bob around the
    // hover height, so a station reads alive, not hung.
    inst.y = GUIDE_HOVER_Y_M + Math.sin((g.hoverT / GUIDE_HOVER_BOB_PERIOD_S) * Math.PI * 2) * GUIDE_HOVER_BOB_M;
    inst.flying = true;
    // THE GAZE (carried from the perch law, rebalanced
    // 2026-11-03 under Adam's trial): she faces her
    // audience while it is CLOSE (inside follow range)
    // and in the beat after a call; the rest of the
    // time she faces ALONG HER ROUTE, toward the target
    // — her body says where she is going.
    const faceHer = distP <= GUIDE_FOLLOW_RANGE_M || g.callT < GUIDE_GAZE_CALL_S;
    inst.heading = faceHer
      ? Math.atan2(ctx.playerX - inst.x, ctx.playerZ - inst.z)
      : Math.atan2(tp.x - inst.x, tp.z - inst.z);
    if (g.callT >= GUIDE_CALL_REPEAT_S) call(g, ctx.playerX, ctx.playerZ);
    stepAnimalAnimation(inst, dt, true);

    // ARRIVAL: she closes within the lead ring of the
    // target — the bird goes to the door itself and
    // hovers over it, waiting. Leaving the ring's
    // margin hands the road back to station/shuttle.
    if (!g.atFinal && distTp <= GUIDE_LEAD_RING_M) {
      beginFlight(g, 'final', tp.x, tp.z, ctx.playerX, ctx.playerZ);
      return;
    }
    if (g.atFinal) {
      if (distTp > GUIDE_LEAD_RING_M + 10) {
        g.atFinal = false; // fall through: the road resumes
      } else {
        // Hold over the door: keep the hover centred on
        // it as she moves about the place.
        if (Math.hypot(tp.x - inst.x, tp.z - inst.z) > GUIDE_REPOSITION_EPS_M) {
          beginFlight(g, 'final', tp.x, tp.z, ctx.playerX, ctx.playerZ);
        }
        return;
      }
    }

    // THE SHUTTLE'S SWITCH: lost progress turns station
    // into shuttle; regained progress (she has taken
    // the road again — back at her mark) ends it.
    if (g.mode === 'station' && offRoad) {
      g.mode = 'shuttle';
      g.shuttleLeg = 'near';
      g.dwellT = 0;
    } else if (g.mode === 'shuttle' && !offRoad) {
      g.mode = 'station';
    }

    if (g.mode === 'shuttle') {
      // Trace the direction: to her (the near point, a
      // call on arrival), dwell a beat, out the bearing
      // (the far point, a call), dwell, back to her —
      // until she takes it. Each leg is priced from her
      // LIVE position, so the trace follows her as she
      // walks away.
      if (g.dwellT > 0) {
        g.dwellT -= dt;
        return;
      }
      const legDist = g.shuttleLeg === 'near' ? GUIDE_SHUTTLE_NEAR_M : GUIDE_SHUTTLE_LEG_M;
      const p = bearingPoint(tp, ctx.playerX, ctx.playerZ, legDist);
      beginFlight(g, 'shuttle', p.x, p.z, ctx.playerX, ctx.playerZ);
      return;
    }

    // STATION: hover at the standoff, on the bearing.
    // She closes inside the trigger — it moves off to
    // the standoff at once (led by pursuit). Her walk
    // drags the station; drift past the eps re-glides.
    const s = stationPoint(tp, ctx.playerX, ctx.playerZ);
    if (distP < GUIDE_CLOSE_TRIGGER_M) {
      beginFlight(g, 'move', s.x, s.z, ctx.playerX, ctx.playerZ);
      return;
    }
    if (Math.hypot(s.x - inst.x, s.z - inst.z) > GUIDE_REPOSITION_EPS_M) {
      beginFlight(g, 'move', s.x, s.z, ctx.playerX, ctx.playerZ);
      return;
    }
    return;
  }

  // Flying: cross the bow waypoint first (the arc that
  // crosses her view), then settle onto the point.
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
    // Arrival: settle into the hover. What the arrival
    // MEANS rides the flight's kind: a staging or a
    // shuttle leg calls (the attention voice); a
    // shuttle arrival also flips the next leg and
    // starts its dwell; the final flight sets the
    // arrival flag; a plain move is silent (she is
    // watching it happen ten metres off).
    const kind = g.flightKind;
    g.state = 'hovering';
    g.hoverT = 0;
    inst.y = g.targetY;
    if (kind === 'stage') {
      call(g, ctx.playerX, ctx.playerZ);
    } else if (kind === 'shuttle') {
      call(g, ctx.playerX, ctx.playerZ);
      g.shuttleLeg = g.shuttleLeg === 'near' ? 'far' : 'near';
      g.dwellT = GUIDE_SHUTTLE_DWELL_S;
    } else if (kind === 'final') {
      g.atFinal = true;
      call(g, ctx.playerX, ctx.playerZ);
    }
    stepAnimalAnimation(inst, dt, true);
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
