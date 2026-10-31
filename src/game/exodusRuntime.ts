/**
 * THE BAT EXODUS — the caves' discovery clue, spectacle
 * half (Background claim approved 2026-10-31; Adam:
 * 'Bats, i like that'). At dusk, cave mouths near her
 * POUR their bats: a staggered stream that climbs,
 * wheels wide over the mouth, and dives home when the
 * window closes. Weather with wings — no interaction
 * surface, nothing to catch or fight, and NO discovery
 * semantics (a 'cave known' fact, if one ever rides
 * this, is Systems' cousin, named in the claim and not
 * built here).
 *
 * Runtime-owned instances (the guide/cat pattern):
 * ambient chunk bats stay seeded and untouched. Mouths
 * are ctx-fed by the renderer (caveMouthsNear ground
 * truth). All numbers DRAFT.
 */
import { bus } from './events';
import { stepAnimalAnimation } from './animals';
import type { AnimalInstance } from './animals';
import { makeCompanionInstance } from './companionRuntime';

/** Mouths pour only within this (m) of her — a field away, a local landmark. */
export const EXODUS_RANGE_M = 250;
/** Bats per pouring mouth. */
export const EXODUS_COUNT = 16;
/** The pour builds over this span (s) rather than popping. */
export const EXODUS_SPAWN_SPAN_S = 15;
/** Circuit band around each mouth. */
export const EXODUS_WHEEL_MIN_M = 18;
export const EXODUS_WHEEL_MAX_M = 30;
export const EXODUS_ALT_MIN_M = 10;
export const EXODUS_ALT_MAX_M = 16;

export type ExodusPhase = 'emerge' | 'wheel' | 'return';

export interface ExodusBat {
  instance: AnimalInstance;
  phase: ExodusPhase;
  /** Its mouth (the blend's home end). */
  mx: number;
  mz: number;
  /** 0..1 blend along the current leg (mouth <-> circuit). */
  blend: number;
  /** Circuit parameters (seeded per bat at spawn). */
  cx: number;
  cz: number;
  radius: number;
  altitude: number;
  angle: number;
  angSpeed: number;
  bobPhase: number;
}

interface Emitter {
  mouthId: string;
  x: number;
  z: number;
  spawned: number;
  spawnT: number;
}

const emitters = new Map<string, Emitter>();
const bats = new Map<string, ExodusBat>();

export function exodusBats(): readonly ExodusBat[] {
  return [...bats.values()];
}

export function clearExodus(): void {
  emitters.clear();
  bats.clear();
}

export interface ExodusStepContext {
  playerX: number;
  playerZ: number;
  /** The dusk window (renderer, from the sky clock). */
  duskOpen: boolean;
  /** Cave mouths near a point (renderer ground truth). */
  mouthsNear: (x: number, z: number, r: number) => { id: string; x: number; z: number }[];
}

function spawnBat(e: Emitter, i: number): void {
  const id = `exodus:${e.mouthId}:${i}`;
  const instance = makeCompanionInstance(id, 'bat', e.x, e.z);
  instance.flying = true;
  const ang = Math.random() * Math.PI * 2;
  const cd = 8 + Math.random() * 10;
  bats.set(id, {
    instance,
    phase: 'emerge',
    mx: e.x,
    mz: e.z,
    blend: 0,
    cx: e.x + Math.cos(ang) * cd,
    cz: e.z + Math.sin(ang) * cd,
    radius: EXODUS_WHEEL_MIN_M + Math.random() * (EXODUS_WHEEL_MAX_M - EXODUS_WHEEL_MIN_M),
    altitude: EXODUS_ALT_MIN_M + Math.random() * (EXODUS_ALT_MAX_M - EXODUS_ALT_MIN_M),
    angle: Math.random() * Math.PI * 2,
    angSpeed: (0.25 + Math.random() * 0.2) * (Math.random() < 0.5 ? -1 : 1),
    bobPhase: Math.random() * Math.PI * 2,
  });
}

/** A bat's circuit position right now. */
function circuitPos(b: ExodusBat, t: number): { x: number; y: number; z: number } {
  return {
    x: b.cx + Math.cos(b.angle) * b.radius,
    y: b.altitude + Math.sin(t * 0.7 + b.bobPhase) * 1.5,
    z: b.cz + Math.sin(b.angle) * b.radius,
  };
}

let exodusT = 0;

/**
 * Step the exodus one frame. Emitters live only while
 * their mouth is in range AND the window is open; the
 * recall (window closed) flies every bat home before it
 * despawns, wherever its mouth went.
 */
export function stepExodus(dt: number, ctx: ExodusStepContext): void {
  exodusT += dt;

  if (ctx.duskOpen) {
    for (const m of ctx.mouthsNear(ctx.playerX, ctx.playerZ, EXODUS_RANGE_M)) {
      if (!emitters.has(m.id)) {
        emitters.set(m.id, { mouthId: m.id, x: m.x, z: m.z, spawned: 0, spawnT: 0 });
      }
    }
  }
  for (const [id, e] of [...emitters]) {
    const inRange = Math.hypot(e.x - ctx.playerX, e.z - ctx.playerZ) <= EXODUS_RANGE_M;
    if (!ctx.duskOpen || !inRange) {
      // Recall: this mouth's bats fly home; the emitter
      // dies when the last one lands.
      let any = false;
      for (const b of bats.values()) {
        if (b.instance.id.startsWith(`exodus:${id}:`)) {
          b.phase = 'return';
          any = true;
        }
      }
      if (!any) emitters.delete(id);
      continue;
    }
    if (e.spawned < EXODUS_COUNT) {
      e.spawnT += dt;
      const due = Math.floor((e.spawnT / EXODUS_SPAWN_SPAN_S) * EXODUS_COUNT);
      while (e.spawned < Math.min(EXODUS_COUNT, due + 1) && e.spawned < EXODUS_COUNT) {
        spawnBat(e, e.spawned);
        e.spawned++;
      }
    }
  }

  for (const [id, b] of [...bats]) {
    const inst = b.instance;
    b.angle += b.angSpeed * dt;
    const target = circuitPos(b, exodusT);
    if (b.phase === 'emerge') {
      b.blend = Math.min(1, b.blend + dt / 3);
      if (b.blend >= 1) b.phase = 'wheel';
    } else if (b.phase === 'return') {
      b.blend = Math.max(0, b.blend - dt / 2.5);
      if (b.blend <= 0) {
        bats.delete(id);
        continue;
      }
    }
    // Emerge/return blend between the mouth and the
    // circuit point.
    const nx = b.mx + (target.x - b.mx) * b.blend;
    const nz = b.mz + (target.z - b.mz) * b.blend;
    const ny = 0.5 + (target.y - 0.5) * b.blend;
    inst.heading = Math.atan2(nx - inst.x, nz - inst.z);
    inst.x = nx;
    inst.z = nz;
    inst.y = ny;
    stepAnimalAnimation(inst, dt, true);
  }
}

// A new world clears the spectacle; mouths re-derive
// from the new seed's caves.
bus.on('world:seedSet', () => {
  clearExodus();
});
