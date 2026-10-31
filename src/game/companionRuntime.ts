/**
 * Companion runtime (Companions Build 1, 2026-10-31 — the
 * friendship build; the familiar's altar rite is Build 2).
 *
 * THE PROBLEM this module solves: ambient animals are
 * chunk-bound and identity-less — seeded per chunk,
 * regenerated per load, culled when the chunk unloads.
 * Befriending PROMOTES one individual out of that regime:
 * it becomes a persistent actor, simulated and rendered
 * independently of chunks, carried across the session (its
 * RECORD — trust, bond, origin — is Systems' SaveData.
 * companions; this module owns only the living body: where
 * it stands, how it follows, when it leaves).
 *
 * Actors are AnimalInstance-shaped and stepped HERE, never
 * by updateAnimal — a companion does not flee its own
 * person, and its movement answers stances, not
 * temperament. The renderer owns the meshes (a persistent
 * companion layer beside the chunk animals) and calls
 * stepActors from its loop; Systems owns the records and
 * never calls game modules — the SHELL speaks for its
 * return values on the bus: 'companion:bonded' promotes,
 * 'companion:released' starts a departure, and the runtime
 * answers with 'companion:departed' / 'companion:stance'.
 *
 * DOORS AND DIMENSIONS (DEV-reconciled claim): companions
 * WAIT at cave mouths and house doors in v1 — while a cave
 * dimension is active the step does not move actors at all
 * (they hold at the surface where she went in; there is no
 * fauna underground for them to be). Sleep and respawn
 * re-seat FOLLOWING actors at her side via reseatAll;
 * STAYED actors are residents — their anchor is their home
 * and no re-seat moves them.
 *
 * RELEASE is a goodbye, not a pause (fork (d), reconciled):
 * the actor walks away at wander pace on a fixed bearing,
 * temperament suspended, uninterruptible (stance calls
 * refuse a departing actor), and dissolves past streaming
 * distance — it is never re-meetable. A found-origin actor
 * is Systems' record concern (its ending returns it to the
 * hearth staging in Build 2's terms); the runtime's
 * departure is the ordinary-animal ending.
 *
 * THE CAT is not here. Build 2's found familiar is exempt
 * from stances by construction (Adam: "commands for a cat,
 * I don't see that working") and gets its own machinery
 * then; nothing in this registry will hold it.
 *
 * All numbers DRAFT for Adam's pin pass.
 */

import {
  ANIMAL_DEFS,
  WANDER_SPEED_MPS,
  stepAnimalAnimation,
  triggerSnap,
} from './animals';
import type { AnimalInstance, AnimalKind } from './animals';
import { bus } from './events';
import { makeDartState, stepSettleDart } from './settleDart';
import type { DartState } from './settleDart';

/** Follow band: inside FOLLOW_IDLE_M she is close enough; beyond FOLLOW_HURRY_M the actor hurries. */
export const FOLLOW_IDLE_M = 2.5;
export const FOLLOW_HURRY_M = 8;
export const FOLLOW_PACE_MPS = 2.2;
export const HURRY_PACE_MPS = 3;
/** Recall run (COME HERE) speed; resolves into FOLLOW on arrival. */
export const COME_PACE_MPS = 3.5;
/** Past this distance a follower re-seats beside her (off-axis / behind-facing only, see stepActors). */
export const RESEAT_M = 40;
/** A stayed actor's local wander radius around its anchor. */
export const STAY_WANDER_M = 4;
/** A departing actor dissolves once it is this far from her (past the streamed chunks). */
export const DEPART_DISSOLVE_M = 100;

export type CompanionStance = 'stay' | 'follow';
export type CompanionMode = 'follow' | 'stay' | 'come' | 'depart';

export interface CompanionActor {
  instance: AnimalInstance;
  stance: CompanionStance;
  mode: CompanionMode;
  /** Stay anchor (the resident's home point). */
  anchorX: number;
  anchorZ: number;
  /** Departure bearing (unit vector), fixed at release. */
  departDx: number;
  departDz: number;
  /** Idle/wander timer for the stay and follow pauses. */
  timer: number;
  /**
   * Movement model (Build 2): 'trail' is the build-1 band
   * follow; 'settleDart' is the Clarissa cycle, for the
   * FAMILIAR — the shell flips it at elevation / demotion
   * (setMovementMode). STAY and COME override either.
   */
  moveMode: 'trail' | 'settleDart';
  /** Settle/dart state (live only in settleDart mode). */
  dart: DartState;
}

export interface CompanionStepContext {
  playerX: number;
  playerZ: number;
  /**
   * Her facing as a forward BEARING in atan2(x, z) form
   * (the direction she faces is (sin, cos) of it) — the
   * re-seat fires only for actors outside her facing
   * hemisphere.
   */
  playerHeading: number;
  night: boolean;
  /** True while a cave (or any non-surface) dimension is active: actors wait, unmoving. */
  dimensionActive: boolean;
  /** Terrain speed multiplier at a point (bog / wading), renderer-supplied; default flat 1. */
  speedAt?: (x: number, z: number) => number;
  /** Site-wall pushout, renderer-supplied: returns the corrected point. */
  pushWalls?: (x: number, z: number) => { x: number; z: number };
  /** Nearest cover point (settle/dart watch points), renderer-supplied. */
  coverNear?: (x: number, z: number, r: number) => { x: number; z: number } | null;
}

const actors = new Map<string, CompanionActor>();

/** Last step context (player position + heading) — the snap and release bearings read it. */
let lastPlayer = { x: 0, z: 0, heading: 0 };

/**
 * Resolvers the renderer installs: adopt removes a chunk
 * instance (promotion), peek returns a live chunk instance
 * without removing it (the feral snap answers on ambient
 * animals). Without a renderer (headless probes) both are
 * null and bus-driven promotion simply finds nothing.
 */
let adoptResolver: ((id: string) => AnimalInstance | null) | null = null;
let peekResolver: ((id: string) => AnimalInstance | null) | null = null;

export function installCompanionResolvers(resolvers: {
  adopt: (id: string) => AnimalInstance | null;
  peek: (id: string) => AnimalInstance | null;
}): void {
  adoptResolver = resolvers.adopt;
  peekResolver = resolvers.peek;
}

export function actorById(id: string): CompanionActor | null {
  return actors.get(id) ?? null;
}

export function allActors(): CompanionActor[] {
  return [...actors.values()];
}

/** A blank AnimalInstance for a companion rebuilt from a save record (not promoted this session). */
export function makeCompanionInstance(
  id: string,
  kind: AnimalKind,
  x: number,
  z: number,
): AnimalInstance {
  return {
    id,
    kind,
    x,
    z,
    y: 0,
    homeX: x,
    homeZ: z,
    heading: 0,
    mode: 'idle',
    flying: false,
    bob: 0,
    wingPhase: 0,
    phase: 0,
    targetX: x,
    targetZ: z,
    targetY: 0,
    timer: 1,
    perchY: 0,
    fleeTurn: false,
    spookT: 0,
    snapT: 0,
    climbState: 'none',
    clearT: 0,
    anchors: [],
  };
}

export type PromoteResult = 'promoted' | 'not-ground' | 'already' | 'missing';

/**
 * Promote a living ambient instance into a persistent
 * actor. GROUND-movement kinds only in v1 (the claim's
 * eligibility rule — water and flying kinds stay ambient
 * however friendly). The caller removes the instance from
 * its chunk first (the renderer's adopt seam, or the bus
 * path below which adopts through the installed resolver).
 */
export function promoteFromInstance(instance: AnimalInstance): PromoteResult {
  if (actors.has(instance.id)) return 'already';
  if (ANIMAL_DEFS[instance.kind].movement !== 'ground') return 'not-ground';
  instance.mode = 'idle';
  instance.flying = false;
  instance.spookT = 0;
  instance.snapT = 0;
  actors.set(instance.id, {
    instance,
    stance: 'follow',
    mode: 'follow',
    anchorX: instance.x,
    anchorZ: instance.z,
    departDx: 0,
    departDz: 0,
    timer: 0,
    moveMode: 'trail',
    dart: makeDartState(),
  });
  return 'promoted';
}

/**
 * Rebuild an actor from a save record at load (stance +
 * anchor carried by Systems' record). Systems' stance
 * vocabulary includes 'come' — a saved COME is a spent
 * command (the recall already happened or never will), so
 * it restores as FOLLOW, the stance a completed come
 * resolves into.
 */
export function restoreActor(
  instance: AnimalInstance,
  stance: CompanionStance | 'come',
  anchorX: number,
  anchorZ: number,
): void {
  const settled: CompanionStance = stance === 'stay' ? 'stay' : 'follow';
  actors.set(instance.id, {
    instance,
    stance: settled,
    mode: settled === 'stay' ? 'stay' : 'follow',
    anchorX,
    anchorZ,
    departDx: 0,
    departDz: 0,
    timer: 0,
    moveMode: 'trail',
    dart: makeDartState(),
  });
}

/**
 * Flip an actor's movement model (Build 2): elevation to
 * familiar sets 'settleDart' (the Clarissa cycle);
 * demotion restores 'trail'. The shell calls it off
 * Systems' bond transitions; a saved familiar restores as
 * 'trail' and the shell re-flips from the record at boot
 * (the record is the truth, this is only its motion).
 * Returns false for an unknown id.
 */
export function setMovementMode(id: string, mode: 'trail' | 'settleDart'): boolean {
  const actor = actors.get(id);
  if (!actor) return false;
  actor.moveMode = mode;
  actor.dart = makeDartState();
  return true;
}

/**
 * Set a standing stance. STAY anchors the actor where it
 * stands (a resident from this moment); FOLLOW recalls it
 * to her side by the ordinary follow step. A departing
 * actor refuses — release is uninterruptible. Emits
 * 'companion:stance' so Systems can persist the choice.
 * THE CAT never reaches this function (Build 2 keeps it
 * out of the registry entirely).
 */
export function setStance(id: string, stance: CompanionStance): boolean {
  const actor = actors.get(id);
  if (!actor || actor.mode === 'depart') return false;
  actor.stance = stance;
  actor.mode = stance === 'stay' ? 'stay' : 'follow';
  if (stance === 'stay') {
    actor.anchorX = actor.instance.x;
    actor.anchorZ = actor.instance.z;
  }
  bus.emit('companion:stance', { id, stance });
  return true;
}

/** COME HERE: a recall run; on arrival the actor is FOLLOWING (the command resolves into the stance). */
export function comeHere(id: string): boolean {
  const actor = actors.get(id);
  if (!actor || actor.mode === 'depart') return false;
  actor.mode = 'come';
  return true;
}

/**
 * RELEASE (the guarded verb's engine): the actor departs
 * on a bearing away from her current position, at wander
 * pace, and dissolves past DEPART_DISSOLVE_M. Returns
 * false for an unknown or already-departing actor.
 */
export function releaseActor(id: string): boolean {
  const actor = actors.get(id);
  if (!actor || actor.mode === 'depart') return false;
  const a = actor.instance;
  let dx = a.x - lastPlayer.x;
  let dz = a.z - lastPlayer.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.001) {
    const angle = Math.random() * Math.PI * 2;
    dx = Math.cos(angle);
    dz = Math.sin(angle);
  } else {
    dx /= d;
    dz /= d;
  }
  actor.departDx = dx;
  actor.departDz = dz;
  actor.mode = 'depart';
  return true;
}

/**
 * Re-seat FOLLOWING actors around a point (sleep wake,
 * respawn): each takes a ring seat a pace or two out, by
 * registry order. STAYED actors do not move — their anchor
 * is their home, and they were never away from it.
 * Departing actors are gone already in every way that
 * matters and are left to their road.
 */
export function reseatAll(x: number, z: number): void {
  let i = 0;
  for (const actor of actors.values()) {
    if (actor.mode === 'depart' || actor.stance === 'stay') continue;
    const angle = (i / 8) * Math.PI * 2 + 0.6;
    actor.instance.x = x + Math.cos(angle) * 2.2;
    actor.instance.z = z + Math.sin(angle) * 2.2;
    actor.instance.targetX = actor.instance.x;
    actor.instance.targetZ = actor.instance.z;
    actor.mode = 'follow';
    i++;
  }
}

/** Drop every actor (a new world / regenerate — the records belong to the old world's seed). */
export function clearActors(): void {
  actors.clear();
}

/** Move an actor toward a point; returns true while still travelling. */
function moveToward(
  actor: CompanionActor,
  tx: number,
  tz: number,
  speed: number,
  dt: number,
  ctx: CompanionStepContext,
): boolean {
  const a = actor.instance;
  const dx = tx - a.x;
  const dz = tz - a.z;
  const dist = Math.hypot(dx, dz);
  const terrain = ctx.speedAt ? ctx.speedAt(a.x, a.z) : 1;
  const step = speed * terrain * dt;
  a.targetX = tx;
  a.targetZ = tz;
  if (dist <= Math.max(step, 0.01)) {
    a.x = tx;
    a.z = tz;
    return false;
  }
  a.x += (dx / dist) * step;
  a.z += (dz / dist) * step;
  a.heading = Math.atan2(dx, dz);
  if (ctx.pushWalls) {
    const p = ctx.pushWalls(a.x, a.z);
    a.x = p.x;
    a.z = p.z;
  }
  return true;
}

/**
 * The companion step (renderer-called, once per frame).
 * While a dimension is active the actors WAIT — positions
 * hold at the surface, only the idle animation breathes.
 */
export function stepActors(dt: number, ctx: CompanionStepContext): void {
  lastPlayer = { x: ctx.playerX, z: ctx.playerZ, heading: ctx.playerHeading };
  for (const actor of [...actors.values()]) {
    const a = actor.instance;
    if (ctx.dimensionActive) {
      stepAnimalAnimation(a, dt, false);
      continue;
    }
    let moving = false;
    const distP = Math.hypot(a.x - ctx.playerX, a.z - ctx.playerZ);
    if (actor.mode === 'depart') {
      // The goodbye leg: fixed bearing, wander pace, no
      // interruptions — dissolves past streaming distance.
      moving = moveToward(
        actor,
        a.x + actor.departDx * 10,
        a.z + actor.departDz * 10,
        WANDER_SPEED_MPS,
        dt,
        ctx,
      );
      if (distP > DEPART_DISSOLVE_M) {
        actors.delete(a.id);
        bus.emit('companion:departed', { id: a.id });
        continue;
      }
    } else if (actor.mode === 'come') {
      moving = moveToward(actor, ctx.playerX, ctx.playerZ, COME_PACE_MPS, dt, ctx);
      if (!moving || distP <= FOLLOW_IDLE_M) {
        actor.mode = 'follow';
        actor.stance = 'follow';
        bus.emit('companion:stance', { id: a.id, stance: 'follow' });
      }
    } else if (actor.moveMode === 'settleDart' && actor.mode === 'follow') {
      // The familiar's cycle (Build 2): settle at a
      // watching point, dart cover to cover — replaces the
      // band follow wholesale while it lasts. STAY (above)
      // and COME and DEPART keep their build-1 meanings.
      stepSettleDart(a, actor.dart, dt, ctx);
      continue;
    } else if (actor.mode === 'stay') {
      // Resident life: a small local wander around the
      // anchor, long pauses — present, not frozen.
      actor.timer -= dt;
      const dAnchor = Math.hypot(a.x - actor.anchorX, a.z - actor.anchorZ);
      if (dAnchor > 0.4) {
        moving = moveToward(actor, a.targetX, a.targetZ, WANDER_SPEED_MPS, dt, ctx);
      } else if (actor.timer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * STAY_WANDER_M;
        a.targetX = actor.anchorX + Math.cos(angle) * r;
        a.targetZ = actor.anchorZ + Math.sin(angle) * r;
        actor.timer = 4 + Math.random() * 6;
      }
    } else {
      // FOLLOW: hold the band. Inside it, idle at her side;
      // beyond hurry distance, hurry; past the leash, an
      // off-axis re-seat (never a watched teleport: the
      // re-seat fires only when the actor is outside her
      // facing hemisphere or truly far past the stream).
      if (distP > RESEAT_M) {
        const facing = Math.atan2(a.x - ctx.playerX, a.z - ctx.playerZ);
        let delta = Math.abs(facing - ctx.playerHeading) % (Math.PI * 2);
        if (delta > Math.PI) delta = Math.PI * 2 - delta;
        if (delta > Math.PI / 2 || distP > RESEAT_M * 2.5) {
          a.x = ctx.playerX - Math.sin(ctx.playerHeading) * 2.2;
          a.z = ctx.playerZ - Math.cos(ctx.playerHeading) * 2.2;
          a.targetX = a.x;
          a.targetZ = a.z;
        } else {
          moving = moveToward(actor, ctx.playerX, ctx.playerZ, HURRY_PACE_MPS, dt, ctx);
        }
      } else if (distP > FOLLOW_IDLE_M) {
        const speed = distP > FOLLOW_HURRY_M ? HURRY_PACE_MPS : FOLLOW_PACE_MPS;
        moving = moveToward(actor, ctx.playerX, ctx.playerZ, speed, dt, ctx);
      }
    }
    stepAnimalAnimation(a, dt, moving);
  }
}

// Bus wiring (the cross-lane contract — Systems speaks,
// the engine answers; static import keeps one bus graph).
bus.on('companion:bonded', ({ id }) => {
  if (actors.has(id)) return;
  const instance = adoptResolver ? adoptResolver(id) : null;
  if (instance) promoteFromInstance(instance);
});
bus.on('companion:released', ({ id }) => {
  releaseActor(id);
});
bus.on('companion:feral-snap', ({ id }) => {
  const instance = peekResolver ? peekResolver(id) : null;
  if (instance) triggerSnap(instance, lastPlayer.x, lastPlayer.z);
});
bus.on('world:seedSet', () => {
  clearActors();
});
