/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — world-to-screen projection (UI lane).
 *
 * The piece App wiring was waiting on: turning a world position into
 * the screen percentages WorldAnchor needs. This replicates the
 * renderer's camera geometry from player state (the renderer keeps
 * its camera private, so App cannot ask it — a future renderer
 * accessor or project() method would replace this replication, and
 * this file should then be deleted in its favour; see the note at
 * the bottom). It reads no game state itself: every input arrives
 * as an argument, so it stays a pure helper, not a system.
 *
 * CAMERA GEOMETRY REPLICATED (from src/game/renderer.ts):
 * - PerspectiveCamera, FOV 60, near 0.1, far 1000, aspect from the
 *   viewport size at call time.
 * - First-person: position (player.x, eyeHeight, player.z), rotation
 *   order YXZ, rotation (pitch, yaw, 0).
 * - Third-person: position player + offset, lookAt (player.x, 0,
 *   player.z) — the overhead camera looks at the player on the
 *   ground.
 * - Behind: position player minus facing-forward x distance at
 *   behind height, lookAt player plus facing-forward x look-ahead
 *   at look height — the over-shoulder camera, mirroring the
 *   renderer branch exactly (same BEHIND_* constants, passed in
 *   as arguments like thirdOffset).
 *
 * BEHIND THE CAMERA: project() returns null when the point is
 * behind the camera (NDC z outside the visible range). Callers
 * drop such targets rather than clamping them — a clamped button
 * would point at the wrong object. The one exception is ground
 * targets at the player's feet in first-person, which App clamps
 * to the screen edge instead (the ground underfoot is a direction,
 * not a distant object, so an edge-anchored button still reads
 * true). That clamp lives in App, not here: this helper reports
 * the raw projection, including off-screen values, and lets the
 * caller decide.
 */

import * as THREE from 'three';

export interface ProjectionInput {
  /** World x of the point to anchor. */
  worldX: number;
  /** World y of the point to anchor (0 = ground, ~1 = above an object). */
  worldY: number;
  /** World z of the point to anchor. */
  worldZ: number;
  /** Player x (camera anchor in both perspectives). */
  playerX: number;
  /** Player z (camera anchor in both perspectives). */
  playerZ: number;
  /** First-person pitch in radians (negative = looking down). */
  pitch: number;
  /** First-person yaw in radians. */
  yaw: number;
  /** Current perspective. */
  mode: 'first' | 'third' | 'behind';
  /** Witch facing in radians (forward = (sin facing, cos facing)). */
  facing: number;
  /** Viewport aspect (width / height) at call time. */
  aspect: number;
  /** First-person eye height (PLAYER_EYE_HEIGHT in constants). */
  eyeHeight: number;
  /** Third-person camera offset (THIRD_PERSON_OFFSET in constants). */
  thirdOffset: { x: number; y: number; z: number };
  /** Behind camera framing (BEHIND_* in constants). */
  behindCamera: {
    distance: number;
    height: number;
    lookAhead: number;
    lookHeight: number;
  };
}

/** Screen position in percent (0–100), matching WorldAnchor's x/y. */
export interface ProjectedPoint {
  x: number;
  y: number;
}

/** Scratch camera, reused across calls — geometry only, no state. */
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

/**
 * Project a world point to screen percentages. Returns null when the
 * point is behind the camera. Off-screen-but-in-front points return
 * percentages outside 0–100; callers decide whether to drop or clamp.
 */
export function projectWorldToScreen(
  input: ProjectionInput,
): ProjectedPoint | null {
  camera.aspect = input.aspect;
  camera.updateProjectionMatrix();
  if (input.mode === 'first') {
    camera.position.set(input.playerX, input.eyeHeight, input.playerZ);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(input.pitch, input.yaw, 0);
  } else if (input.mode === 'behind') {
    const fx = Math.sin(input.facing);
    const fz = Math.cos(input.facing);
    camera.position.set(
      input.playerX - fx * input.behindCamera.distance,
      input.behindCamera.height,
      input.playerZ - fz * input.behindCamera.distance,
    );
    camera.lookAt(
      input.playerX + fx * input.behindCamera.lookAhead,
      input.behindCamera.lookHeight,
      input.playerZ + fz * input.behindCamera.lookAhead,
    );
  } else {
    camera.position.set(
      input.playerX + input.thirdOffset.x,
      input.thirdOffset.y,
      input.playerZ + input.thirdOffset.z,
    );
    camera.lookAt(input.playerX, 0, input.playerZ);
  }
  camera.updateMatrixWorld();

  const vector = new THREE.Vector3(
    input.worldX,
    input.worldY,
    input.worldZ,
  ).project(camera);
  if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y)) {
    return null;
  }
  if (vector.z > 1 || vector.z < -1) {
    return null;
  }
  return {
    x: ((vector.x + 1) / 2) * 100,
    y: ((1 - vector.y) / 2) * 100,
  };
}
