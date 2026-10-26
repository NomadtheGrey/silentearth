/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Player movement controller. Landing 1 scope only: walk movement (WASD)
 * + mouse look in first-person, world-aligned movement in third-person.
 * No sprint, no jump, no terrain speed modifier — swamp navigation
 * difficulty is undecided and must not be invented here.
 *
 * Position changes flow out through the event bus (player:moved, throttled
 * to ~10 Hz); nothing reads this controller's fields directly except the
 * renderer, which positions the cameras and the witch mesh each frame.
 */

import { bus } from './events';
import { CAMERA_TOGGLE_KEYS, MOVE_KEYS, PLAYER_SPEED, CHUNK_SIZE } from '../constants';
import type { CameraMode } from '../types';

export class PlayerController {
  x = 0;
  z = 0;
  /** Yaw in radians. First-person view direction; third-person faces movement. */
  yaw = 0;
  /** Pitch in radians (first-person only), clamped to avoid flipping. */
  pitch = 0;
  mode: CameraMode = 'third';
  /** Facing for the witch mesh in third-person (radians). */
  facing = 0;

  private keys = new Set<string>();
  private canvas: HTMLCanvasElement | null = null;
  private emitTimer = 0;
  private lastLookEmit = 0;
  private disposed = false;

  constructor(spawn: { x: number; z: number }) {
    this.x = spawn.x;
    this.z = spawn.z;
  }

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('click', this.onCanvasClick);
  }

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.canvas?.removeEventListener('click', this.onCanvasClick);
    this.canvas = null;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    if (CAMERA_TOGGLE_KEYS.includes(key)) {
      this.toggleCamera();
      return;
    }
    if (MOVE_KEYS.includes(key)) {
      this.keys.add(key);
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  private onMouseMove = (e: MouseEvent): void => {
    // Mouse look only while the pointer is captured in first-person.
    if (this.mode !== 'first') return;
    if (document.pointerLockElement !== this.canvas) return;
    this.yaw -= e.movementX * 0.0025;
    this.pitch = Math.max(
      -1.45,
      Math.min(1.45, this.pitch - e.movementY * 0.0025),
    );
    // Look-down gating needs this even when she stands still: throttle
    // to ~10 Hz like 'player:moved' so mouse-move spam stays off the bus.
    const now = performance.now();
    if (now - this.lastLookEmit >= 100) {
      this.lastLookEmit = now;
      bus.emit('player:looked', { pitch: this.pitch, mode: this.mode });
    }
  };

  private onCanvasClick = (): void => {
    // First-person mouse look needs pointer lock; a click is the gesture
    // that grants it. Failure is non-fatal (keyboard movement still works).
    if (this.mode === 'first' && document.pointerLockElement !== this.canvas) {
      this.canvas?.requestPointerLock();
    }
  };

  toggleCamera(): void {
    this.mode = this.mode === 'first' ? 'third' : 'first';
    if (this.mode === 'first') {
      // Best effort: a keydown counts as a user gesture for pointer lock.
      try {
        this.canvas?.requestPointerLock();
      } catch {
        // Non-fatal; the next canvas click will capture instead.
      }
    } else if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    bus.emit('camera:switched', { mode: this.mode });
  }

  /** Advance movement by dt seconds. Called once per frame by the renderer. */
  update(dt: number): void {
    let fx = 0;
    let fz = 0;
    if (this.keys.has('w')) fz -= 1;
    if (this.keys.has('s')) fz += 1;
    if (this.keys.has('a')) fx -= 1;
    if (this.keys.has('d')) fx += 1;
    if (fx === 0 && fz === 0) return;

    const len = Math.hypot(fx, fz);
    fx /= len;
    fz /= len;

    if (this.mode === 'first') {
      // Movement relative to view yaw (yaw = 0 faces -z). Rotate the local
      // input (fx = right, fz = back) by yaw around Y into world space.
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const wx = fx * cos + fz * sin;
      const wz = -fx * sin + fz * cos;
      this.x += wx * PLAYER_SPEED * dt;
      this.z += wz * PLAYER_SPEED * dt;
      this.facing = Math.atan2(wx, wz);
    } else {
      // Third-person overhead: world-aligned movement (W = -z).
      this.x += fx * PLAYER_SPEED * dt;
      this.z += fz * PLAYER_SPEED * dt;
      this.facing = Math.atan2(fx, fz);
    }

    this.emitTimer += dt;
    if (this.emitTimer >= 0.1) {
      this.emitTimer = 0;
      this.emitMoved();
    }
  }

  private emitMoved(): void {
    bus.emit('player:moved', {
      x: this.x,
      z: this.z,
      chunkX: Math.floor(this.x / CHUNK_SIZE),
      chunkZ: Math.floor(this.z / CHUNK_SIZE),
    });
  }

  get chunk(): { cx: number; cz: number } {
    return {
      cx: Math.floor(this.x / CHUNK_SIZE),
      cz: Math.floor(this.z / CHUNK_SIZE),
    };
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}
