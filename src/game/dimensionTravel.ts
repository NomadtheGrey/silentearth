/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DIMENSION TRAVEL (Adam, 2026-10-30 — the cave
 * machinery). The validated position write, as code.
 *
 * THE RULE (the stuck-in-ruin lesson, pinned after
 * Clarissa's BioForge soft-lock): any code that WRITES
 * the player's position validates the destination against
 * real collision FIRST. Every travel here checks the
 * destination anchor against the target's shipped wall
 * boxes (pushOutOfWalls must leave it untouched at the
 * player's wall radius); a failed check refuses the whole
 * travel — no generator swap, no state change, no partial
 * move. The swap itself is one step: renderer dimension
 * gen, position, facing, dimension state, in that order,
 * after validation has passed for the destination.
 *
 * The shell (UI) composes these from faced targets: Enter
 * at a mouth -> enterCave; the exit interaction ->
 * exitCave (returns her to the mouth she entered by);
 * Descend/Climb at shaft anchors -> descend/ascend
 * (position writes inside the one cave generator — no gen
 * swap, layers are regions of the same dimension).
 *
 * The surface generator is captured at entry (module
 * session state) so exit needs nothing from the shell
 * beyond the call. Boot always starts on the surface, so
 * the capture can never go stale across a reload.
 *
 * UPSTAIRS (2026-11-01 — the travel wiring, joint with
 * UI): the same validated machinery carries the upstairs
 * zones (attics.ts). enterUpstairs validates BOTH writes
 * before the swap — the zone's entry anchor against the
 * zone's walls, the surface stair head against the
 * surface house's walls — because exit is a second
 * position write and the rule covers it too; the return
 * anchor (the stair head, facing down the flight) is
 * captured beside the surface generator. The zone's
 * footprint + light spots ride the swap as the
 * renderer's DimensionSeat, since an upstairs layout
 * derives from the surface house and a dimension
 * generator cannot carry that context itself.
 */

import { bus } from './events';
import { CHUNK_SIZE } from '../constants';
import { pushOutOfWalls, type SiteWallBox } from './sites';
import {
  caveInstanceForKey,
  caveLayoutForKey,
  caveMouths,
  createCaveGen,
  CAVE_DIMENSION_KEY,
  type CaveAnchor,
  type CaveMouthRef,
} from './caves';
import {
  atticLayoutForKey,
  createAtticGen,
  isUpstairsKey,
  upstairsMouthFor,
  UPSTAIRS_LIGHT_COLOR,
} from './attics';
import { farmhouseInstanceForKey } from './farmhouses';
import { farmhouseSite } from './sites';
import { dimensionState } from './dimensionState';
import type { WorldGen } from './worldgen';
import type { BiomeWeights } from '../types';
import type { WorldRenderer } from './renderer';
import type { PlayerController } from './player';

/** The player's wall radius (mirrors player.ts's own —
 *  validation must use the same body the resolver uses). */
export const TRAVEL_WALL_RADIUS_M = 0.3;

export type TravelOutcome =
  | { ok: true }
  | { ok: false; reason: 'anchor-blocked' | 'wrong-dimension' | 'no-deeper-layer' | 'already-deepest' | 'unknown-mouth' | 'unknown-house' };

/** The surface generator captured at entry, for exit. */
let capturedSurfaceGen: WorldGen | null = null;

/**
 * True when a destination is safe to write: the wall
 * resolver leaves it exactly where it is.
 */
export function anchorClear(anchor: { x: number; z: number }, walls: SiteWallBox[]): boolean {
  const resolved = pushOutOfWalls(anchor.x, anchor.z, walls, TRAVEL_WALL_RADIUS_M);
  return Math.hypot(resolved.x - anchor.x, resolved.z - anchor.z) < 1e-9;
}

function placeAt(player: PlayerController, anchor: CaveAnchor): void {
  player.x = anchor.x;
  player.z = anchor.z;
  player.restoreFacing({ yaw: anchor.yaw, pitch: 0 });
  // A travel IS a move (DEV ruling, 2026-11-01): the
  // walking emitter never sees a teleport, so anything
  // listening for her position — the LocationChip first
  // among them — lagged until her next step after every
  // dimension travel, caves and upstairs alike. Every
  // successful travel path seats her through here, so
  // the emit lives here: one seam, every travel.
  bus.emit('player:moved', {
    x: player.x,
    z: player.z,
    chunkX: Math.floor(player.x / CHUNK_SIZE),
    chunkZ: Math.floor(player.z / CHUNK_SIZE),
  });
}

/**
 * Resolve a mouth id to its mouth + owning dimension
 * key: the debut cave's mouths ('mouth' | 'cellar')
 * own 'cave:main'; a distributed instance's mouth id IS
 * its key ('cave:<cell>') and owns that cave.
 */
function resolveMouth(
  seed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  mouthId: string,
): { mouth: CaveMouthRef; key: string } | null {
  const v1 = caveMouths(seed, spawn, weightsAtPos).find((m) => m.id === mouthId);
  if (v1) return { mouth: v1, key: CAVE_DIMENSION_KEY };
  const inst = caveInstanceForKey(seed, spawn, weightsAtPos, mouthId);
  if (!inst) return null;
  return {
    mouth: { id: inst.key, spot: inst.mouthSpot, exitYaw: inst.exitYaw, walls: inst.walls },
    key: inst.key,
  };
}

/**
 * Enter a cave dimension through a surface mouth: the
 * debut cave's 'mouth' | 'cellar', or a distributed
 * instance's mouth id (its key). Refuses cleanly when
 * the entry anchor is blocked (it never should be — the
 * probes check it) or the mouth id is unknown.
 */
export function enterCave(
  renderer: WorldRenderer,
  player: PlayerController,
  surfaceGen: WorldGen,
  mouthId: string,
): TravelOutcome {
  const seed = String(surfaceGen.seed);
  const spawn = surfaceGen.findSpawn();
  const resolved = resolveMouth(seed, spawn, (x, z) => surfaceGen.weightsAt(x, z), mouthId);
  if (!resolved) return { ok: false, reason: 'unknown-mouth' };
  const layout = caveLayoutForKey(seed, resolved.key);
  const anchor = layout.entryAnchor;
  if (!anchorClear(anchor, layout.footprint.walls)) {
    return { ok: false, reason: 'anchor-blocked' };
  }
  capturedSurfaceGen = surfaceGen;
  capturedUpstairsReturn = null;
  renderer.setDimensionGen(createCaveGen(seed, resolved.key));
  placeAt(player, anchor);
  dimensionState.enter(resolved.key, mouthId);
  return { ok: true };
}

/**
 * Exit the cave dimension back to the surface mouth she
 * entered by. The mouth spot is validated against its own
 * site's walls before anything moves.
 */
export function exitCave(renderer: WorldRenderer, player: PlayerController): TravelOutcome {
  if (!dimensionState.isUnderground() || !capturedSurfaceGen) {
    return { ok: false, reason: 'wrong-dimension' };
  }
  const surfaceGen = capturedSurfaceGen;
  const seed = String(surfaceGen.seed);
  const spawn = surfaceGen.findSpawn();
  const mouthId = dimensionState.enteredBy();
  const resolved = mouthId
    ? resolveMouth(seed, spawn, (x, z) => surfaceGen.weightsAt(x, z), mouthId)
    : null;
  if (!resolved) return { ok: false, reason: 'unknown-mouth' };
  const mouth = resolved.mouth;
  if (!anchorClear(mouth.spot, mouth.walls)) {
    return { ok: false, reason: 'anchor-blocked' };
  }
  renderer.setDimensionGen(surfaceGen);
  placeAt(player, { x: mouth.spot.x, z: mouth.spot.z, yaw: mouth.exitYaw });
  dimensionState.exit();
  capturedSurfaceGen = null;
  return { ok: true };
}

/**
 * Descend the shaft: layer 1's shaft anchor -> layer 2's
 * entry anchor. A position write inside the cave
 * generator; no gen swap.
 */
export function descend(player: PlayerController): TravelOutcome {
  if (!dimensionState.isUnderground()) return { ok: false, reason: 'wrong-dimension' };
  if (dimensionState.currentLayer() !== 1) return { ok: false, reason: 'already-deepest' };
  const seed = dimensionStateSeed();
  if (seed === null) return { ok: false, reason: 'wrong-dimension' };
  const layout = caveLayoutForKey(seed, dimensionState.activeKey());
  const layer2 = layout.layers[1];
  if (!layer2) return { ok: false, reason: 'no-deeper-layer' };
  if (!anchorClear(layer2.entryAnchor, layout.footprint.walls)) {
    return { ok: false, reason: 'anchor-blocked' };
  }
  placeAt(player, layer2.entryAnchor);
  dimensionState.setLayer(2);
  return { ok: true };
}

/** Climb the shaft back: layer 2 -> layer 1's shaft anchor. */
export function ascend(player: PlayerController): TravelOutcome {
  if (!dimensionState.isUnderground()) return { ok: false, reason: 'wrong-dimension' };
  if (dimensionState.currentLayer() !== 2) return { ok: false, reason: 'wrong-dimension' };
  const seed = dimensionStateSeed();
  if (seed === null) return { ok: false, reason: 'wrong-dimension' };
  const layout = caveLayoutForKey(seed, dimensionState.activeKey());
  const shaft = layout.layers[0].shaftAnchor;
  if (!shaft) return { ok: false, reason: 'anchor-blocked' };
  if (!anchorClear(shaft, layout.footprint.walls)) {
    return { ok: false, reason: 'anchor-blocked' };
  }
  placeAt(player, shaft);
  dimensionState.setLayer(1);
  return { ok: true };
}

/** The surface stair head she returns to from upstairs,
 *  captured at entry (position + the down-flight facing),
 *  exactly as the surface generator is captured. */
let capturedUpstairsReturn: CaveAnchor | null = null;

/** The surface wall boxes of a house record — the return
 *  validation's collision truth for the stair head. */
function surfaceWallsForHouse(
  seed: string,
  spawn: { x: number; z: number },
  weightsAtPos: (x: number, z: number) => BiomeWeights,
  houseKey: string,
): SiteWallBox[] | null {
  if (houseKey === 'farmhouse') {
    return farmhouseSite(seed, spawn, weightsAtPos).walls;
  }
  const inst = farmhouseInstanceForKey(seed, spawn, weightsAtPos, houseKey);
  return inst ? inst.walls : null;
}

/**
 * Go upstairs: enter a house's upstairs zone (attics.ts)
 * at its stair-head door, seating her just inside it.
 * Both position writes validate first (the travel rule):
 * the zone's entry anchor against the zone's own walls,
 * and the surface stair head she will return to against
 * the surface house's walls. Refuses cleanly on an
 * unknown house key or a blocked anchor — no swap, no
 * state change.
 */
export function enterUpstairs(
  renderer: WorldRenderer,
  player: PlayerController,
  surfaceGen: WorldGen,
  houseKey: string,
): TravelOutcome {
  const seed = String(surfaceGen.seed);
  const spawn = surfaceGen.findSpawn();
  const weightsAtPos = (x: number, z: number) => surfaceGen.weightsAt(x, z);
  const mouth = upstairsMouthFor(seed, spawn, weightsAtPos, houseKey);
  if (!mouth) return { ok: false, reason: 'unknown-house' };
  const layout = atticLayoutForKey(seed, spawn, weightsAtPos, mouth.zoneKey);
  if (!layout) return { ok: false, reason: 'unknown-house' };
  if (!anchorClear(layout.entryAnchor, layout.walls)) {
    return { ok: false, reason: 'anchor-blocked' };
  }
  const surfaceWalls = surfaceWallsForHouse(seed, spawn, weightsAtPos, houseKey);
  if (!surfaceWalls || !anchorClear(mouth.stairHead, surfaceWalls)) {
    return { ok: false, reason: 'anchor-blocked' };
  }
  const gen = createAtticGen(seed, spawn, weightsAtPos, mouth.zoneKey);
  if (!gen) return { ok: false, reason: 'unknown-house' };
  // The return anchor: the stair head itself, facing DOWN
  // the flight (the reverse of her climb).
  const climbX = mouth.stairHead.x - mouth.stairBase.x;
  const climbZ = mouth.stairHead.z - mouth.stairBase.z;
  const returnAnchor: CaveAnchor = {
    x: mouth.stairHead.x,
    z: mouth.stairHead.z,
    yaw: Math.atan2(climbX, climbZ),
  };
  capturedSurfaceGen = surfaceGen;
  capturedUpstairsReturn = returnAnchor;
  renderer.setDimensionGen(gen, {
    footprint: layout.footprint,
    lightSpots: layout.lightSpots,
    lightColor: UPSTAIRS_LIGHT_COLOR,
    lightY: 1.6,
  });
  placeAt(player, layout.entryAnchor);
  dimensionState.enter(mouth.zoneKey, houseKey);
  return { ok: true };
}

/**
 * Come back down: exit the upstairs zone to the surface
 * stair head she entered by. The return is validated
 * again at write time against the surface house's walls.
 */
export function exitUpstairs(renderer: WorldRenderer, player: PlayerController): TravelOutcome {
  if (
    !isUpstairsKey(dimensionState.activeKey()) ||
    !capturedSurfaceGen ||
    !capturedUpstairsReturn
  ) {
    return { ok: false, reason: 'wrong-dimension' };
  }
  const surfaceGen = capturedSurfaceGen;
  const seed = String(surfaceGen.seed);
  const spawn = surfaceGen.findSpawn();
  const weightsAtPos = (x: number, z: number) => surfaceGen.weightsAt(x, z);
  const houseKey = dimensionState.enteredBy();
  const surfaceWalls = houseKey
    ? surfaceWallsForHouse(seed, spawn, weightsAtPos, houseKey)
    : null;
  if (!surfaceWalls || !anchorClear(capturedUpstairsReturn, surfaceWalls)) {
    return { ok: false, reason: 'anchor-blocked' };
  }
  const anchor = capturedUpstairsReturn;
  renderer.setDimensionGen(surfaceGen);
  placeAt(player, anchor);
  dimensionState.exit();
  capturedSurfaceGen = null;
  capturedUpstairsReturn = null;
  return { ok: true };
}

/** The world seed of the active cave dimension, from the
 *  captured surface generator (null on the surface). */
function dimensionStateSeed(): string | null {
  return capturedSurfaceGen ? String(capturedSurfaceGen.seed) : null;
}
