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
 *
 * THE INVERSE (2026-10-31): screenCenterGroundPoint() runs the
 * same posed camera backwards — the center ray intersected with
 * the ground plane — for crosshair-aimed placement. Both
 * directions share poseCamera(), so aim and anchors can never
 * disagree about where the camera is.
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

/** The camera half of a projection input (everything but the point). */
export type CameraInput = Omit<
  ProjectionInput,
  'worldX' | 'worldY' | 'worldZ'
>;

/** Scratch camera, reused across calls — geometry only, no state. */
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

/**
 * Pose the scratch camera for a frame, exactly as the renderer
 * would. Shared by the forward projection and its inverse (the
 * screen-center ground ray, below) so the two can never drift:
 * one geometry source, both directions.
 */
function poseCamera(input: CameraInput): void {
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
}

/**
 * Project a world point to screen percentages. Returns null when the
 * point is behind the camera. Off-screen-but-in-front points return
 * percentages outside 0–100; callers decide whether to drop or clamp.
 */
export function projectWorldToScreen(
  input: ProjectionInput,
): ProjectedPoint | null {
  poseCamera(input);

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

/**
 * The inverse of the forward projection, for the screen CENTER:
 * cast the center ray from the posed camera and intersect the
 * ground plane (y = 0 — the renderer's ground is a flat plane,
 * and the forward projection anchors ground targets at y = 0,
 * so the two directions agree by construction). Returns the
 * world (x, z) the crosshair rests on, or null when the ray
 * never meets the ground (a level or upward gaze). This is
 * where an aimed placement lands (Adam's crosshair ruling,
 * 2026-10-31); reach and refusal policy live with the caller.
 */
export function screenCenterGroundPoint(
  input: CameraInput,
): { x: number; z: number } | null {
  poseCamera(input);
  const origin = camera.position;
  // A point on the center axis in front of the camera,
  // unprojected: the ray through NDC (0, 0).
  const axisPoint = new THREE.Vector3(0, 0, 0.5).unproject(camera);
  const dir = axisPoint.sub(origin).normalize();
  if (!Number.isFinite(dir.x) || !Number.isFinite(dir.y)) {
    return null;
  }
  // Level or up: parallel to (or away from) the plane.
  if (dir.y >= -1e-6) {
    return null;
  }
  const t = -origin.y / dir.y;
  if (!Number.isFinite(t) || t < 0) {
    return null;
  }
  return { x: origin.x + dir.x * t, z: origin.z + dir.z * t };
}
