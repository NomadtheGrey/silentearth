/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Player movement controller. Landing 1 scope: walk movement (WASD)
 * + mouse look in first-person, world-aligned movement in third-person.
 * Terrain speed modifier: marsh/bog slow IS implemented (Adam,
 * 2026-10-26, PINNED — see movement.ts); the renderer wires the
 * terrain query, and bog boots arrive via a worn-state query until
 * the clothes system lands.
 *
 * SPRINT + JUMP (Adam, 2026-10-29 — numbers DRAFT, his pin pass):
 * double-tap W (or double-push the thumbstick) engages sprint
 * while forward stays held — SPRINT_MULTIPLIER on top of the
 * composing terrain/hunger/charm factors; Space hops her
 * (JUMP_VELOCITY against JUMP_GRAVITY, flat ground = y 0, the
 * renderer adds the public yOffset to the witch + cameras).
 * Sprint state is exposed as the `sprinting` getter plus the
 * 'player:sprint-changed' bus event (transitions only) for the
 * shell's hunger wiring; pressJump() is the touch entry, in the
 * pressUse idiom. Both are momentary — no saved state.
 *
 * RESUME RE-LOCK (Adam, 2026-10-29): requestResumeLock() is the
 * resume-gesture seam — App calls it as the pause clears, so the
 * veil click that resumes also captures the mouse in first-person
 * instead of leaving the cursor free for a second, otherwise-dead
 * canvas click. Deliberately NOT routed through onCanvasClick:
 * that path is pause-gated (the lock trap), and this call rides
 * the explicit resume gesture as the gate opens.
 *
 * Position changes flow out through the event bus (player:moved, throttled
 * to ~10 Hz); nothing reads this controller's fields directly except the
 * renderer, which positions the cameras and the witch mesh each frame.
 *
 * TOUCH INPUT (engine half, Adam 2026-10-26 — phone playtest: WASD +
 * pointer-lock mouse look left the live build unplayable on a phone).
 * The engine exposes input METHODS; DOM gesture handling lives in
 * UI's TouchControls (pointer capture, dead zone, tap-vs-drag
 * disambiguation) and calls these. No DOM touch listeners are added
 * here, so dispose() is unchanged and desktop behavior is unchanged
 * by construction when no touch input is present:
 * - setThumbstick(x, z): left-stick vector merged into the SAME
 *   movement path as the keys (same speeds, same terrain/hunger
 *   slowdowns). A partial push walks proportionally slower; a
 *   double-push (two full-forward deflections inside the tap
 *   window, then held) engages sprint, the double-tap W mirror.
 * - addLookDelta(dx, dy): drag-look that rotates the camera
 *   WITHOUT pointer lock (a phone has none). It shares the mouse
 *   look math and emits 'player:looked' on the same throttle, so
 *   the proximity tracker recomputes look-down/ground state even
 *   when she stands still — without this, FP ground targets would
 *   never update on a phone (the BioForge audit catch, same shape).
 * - pressUse(press?): tap / USE press that fires the EXISTING
 *   'harvest:requested' bus event — no new harvest logic, no new
 *   harvest rules; the outcome listener re-validates range +
 *   permit at outcome time, so a stale press fails safely.
 * - pressJump(): tap entry for the Space hop (UI's Jump button);
 *   starts the hop when grounded, no-ops mid-air.
 */

import { bus } from './events';
import { pauseState } from './pause';
import { CAMERA_TOGGLE_KEYS, MOVE_KEYS, PLAYER_SPEED, CHUNK_SIZE, SPRINT_MULTIPLIER, SPRINT_TAP_WINDOW_S, JUMP_VELOCITY, JUMP_GRAVITY } from '../constants';
import type { CameraMode } from '../types';
import { HUNGRY_SPEED_MULTIPLIER, type HungerStageQuery } from './hunger';
import {
  applyBogBoots,
  type BogBootsQuery,
  type TerrainSpeedQuery,
} from './movement';

/** Mouse-look sensitivity (radians per pixel), shared by mouse + touch. */
const LOOK_SENSITIVITY = 0.0025;

/**
 * Thumbstick sprint edges (DRAFT, 2026-10-29): forward deflection
 * at or above PUSH counts as a push; at or below RELEASE counts as
 * released. The band between is hysteresis, so an analog stick
 * hovering near a threshold cannot flap the sprint state.
 */
const STICK_SPRINT_PUSH = 0.85;
const STICK_SPRINT_RELEASE = 0.5;

/**
 * A harvest press for pressUse: exactly the 'harvest:requested' bus
 * payload minus `action` (omitted = 'harvest'). The shell builds it
 * with UI's harvestRequestFor (which maps a displayed target's id to
 * targetId) or wires a query returning one; the engine never imports
 * either HarvestTarget shape (game-side x/z vs UI-side worldX/worldZ)
 * and stays coupled only to the bus contract.
 */
export interface UsePress {
  targetId: string;
  sourceId: string;
  kind: 'scatter' | 'ground';
  x: number;
  z: number;
}

/** Shell-wired query: the nearest in-range harvest press, or null. */
export type UseTargetQuery = () => UsePress | null;

/** Saved looking direction: yaw + pitch (position saves separately). */
export interface FacingSnapshot {
  yaw: number;
  pitch: number;
}

/**
 * Fox femur — swift step (tier-1 charm, DRAFT +10%):
 * movement speed factor while carried + awakened.
 * Additive-points seam: future speed charms ADD their
 * points to one bonus sum here, not multiply — with a
 * single speed charm the factor is 1.10.
 */
export function swiftStepFactor(swiftActive: boolean): number {
  return swiftActive ? 1.1 : 1;
}

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
  /**
   * Jump height above the ground right now, meters (0 = grounded).
   * The renderer adds it to the witch + camera heights each frame.
   * Momentary physics state — never saved.
   */
  yOffset = 0;

  private keys = new Set<string>();

  // Sprint + jump state (2026-10-29, all momentary, none saved).
  // Tap timing reads timeS, an accumulated update() clock — the
  // renderer's frame cadence — so a tap is judged on game time,
  // not wall time (a paused gap cannot fake or eat a double-tap).
  private vy = 0;
  private timeS = 0;
  private kbSprint = false;
  private lastForwardReleaseS = -Infinity;
  private stickPushed = false;
  private stickSprint = false;
  private lastStickReleaseS = -Infinity;
  private sprintEmitted = false;

  /** Sprinting right now (either input source). The shell's
   *  hunger wiring can also ride 'player:sprint-changed'. */
  get sprinting(): boolean {
    return this.kbSprint || this.stickSprint;
  }

  /** Emit 'player:sprint-changed' when the effective state flips. */
  private syncSprint(): void {
    const s = this.sprinting;
    if (s !== this.sprintEmitted) {
      this.sprintEmitted = s;
      bus.emit('player:sprint-changed', { sprinting: s });
    }
  }

  /**
   * Hunger stage query (Systems owns hunger state — same pattern
   * as the owned-tool tier query in harvest.ts). The shell wires
   * it via setHungerStageQuery once Systems lands the meter;
   * until then it stays unset and movement runs full speed.
   */
  private hungerStageQuery: HungerStageQuery | null = null;

  /** Wire Systems' hunger stage query (shell-owned wiring). */
  setHungerStageQuery(query: HungerStageQuery): void {
    this.hungerStageQuery = query;
  }

  /**
   * Terrain speed query (renderer-owned wiring — the renderer
   * owns the generator and the player, so it wires this itself in
   * its constructor; the shell never touches it). Defaults to
   * firm ground (multiplier 1) when unwired.
   */
  private terrainSpeedQuery: TerrainSpeedQuery | null = null;

  /** Renderer wiring for the terrain query (see above). */
  setTerrainSpeedQuery(query: TerrainSpeedQuery): void {
    this.terrainSpeedQuery = query;
  }

  /**
   * Bog-boots worn-state query (clothes system, future — same
   * pattern as the hunger query). The shell wires it once
   * Systems' clothes work lands; until then it stays unset and
   * travel runs at the full terrain slow (no boots).
   */
  private bogBootsQuery: BogBootsQuery | null = null;

  /** Wire Systems' bog-boots worn query (shell-owned wiring). */
  setBogBootsQuery(query: BogBootsQuery): void {
    this.bogBootsQuery = query;
  }

  /**
   * Fox femur — swift step (tier-1 charm): shell-supplied
   * carried + awakened boolean (UI wiring follows).
   */
  private swiftStep = false;

  /** Shell setter for swift step (see swiftStepFactor). */
  setSwiftStep(active: boolean): void {
    this.swiftStep = active;
  }
  private canvas: HTMLCanvasElement | null = null;
  private emitTimer = 0;
  private lastLookEmit = 0;
  private disposed = false;

  /**
   * Thumbstick vector (touch half): x = right, z = back, matching
   * the keys convention (W = fz -1, i.e. push UP = (0, -1)).
   * Magnitude is clamped to 1 on set; the dead zone lives in UI's
   * TouchControls (gesture layer), not here.
   */
  private stickX = 0;
  private stickZ = 0;

  /** Touch half: set the current thumbstick vector (UI's TouchControls). */
  setThumbstick(x: number, z: number): void {
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    this.stickX = x;
    this.stickZ = z;
    // Double-push sprint (the double-tap W mirror): a fresh
    // full-forward push inside the tap window of the last
    // release engages sprint; the sprint holds while the stick
    // stays pushed and ends when it falls to the release edge.
    const fwd = -z;
    if (!this.stickPushed && fwd >= STICK_SPRINT_PUSH) {
      this.stickPushed = true;
      if (this.timeS - this.lastStickReleaseS <= SPRINT_TAP_WINDOW_S) {
        this.stickSprint = true;
        this.syncSprint();
      }
    } else if (this.stickPushed && fwd <= STICK_SPRINT_RELEASE) {
      this.stickPushed = false;
      this.lastStickReleaseS = this.timeS;
      if (this.stickSprint) {
        this.stickSprint = false;
        this.syncSprint();
      }
    }
  }

  /** Shell-wired nearest-target query for zero-arg pressUse (see below). */
  private useTargetQuery: UseTargetQuery | null = null;

  /** Wire the shell's nearest in-range press query (shell-owned wiring). */
  setUseTargetQuery(query: UseTargetQuery): void {
    this.useTargetQuery = query;
  }

  /**
   * Touch half: tap / USE press. Fires the EXISTING
   * 'harvest:requested' event for the given press, or for the wired
   * query's press when none is passed. Nearest-target SELECTION
   * stays with the shell/UI (it owns the proximity target set);
   * the engine owns press → bus emission only. Returns true when
   * a press was emitted, false when there was no target (nothing
   * is emitted then — never a malformed request). 'remove' stays
   * a separate UI affordance; a tap always means 'harvest'.
   */
  pressUse(press?: UsePress): boolean {
    const resolved = press ?? this.useTargetQuery?.() ?? null;
    if (!resolved) return false;
    bus.emit('harvest:requested', {
      targetId: resolved.targetId,
      sourceId: resolved.sourceId,
      kind: resolved.kind,
      x: resolved.x,
      z: resolved.z,
    });
    return true;
  }

  /**
   * Jump press (Space, or UI's touch Jump button — same entry):
   * starts the hop when grounded; mid-air presses no-op (no
   * double jump). The arc itself integrates in update(); the
   * renderer reads yOffset. Returns true when the hop started.
   */
  pressJump(): boolean {
    if (this.yOffset > 0 || this.vy !== 0) return false;
    this.vy = JUMP_VELOCITY;
    return true;
  }

  /**
   * Resume re-lock (Adam, 2026-10-29): App calls this on the
   * resume gesture (the veil click), as the pause clears, so
   * resuming in first-person captures the mouse in the same click
   * that unpauses. Before this seam, the veil click unpaused but
   * left the cursor free, and a second canvas click was needed to
   * play. First-person only, and only when no lock is held; any
   * other state no-ops. NOT routed through onCanvasClick: that
   * path is pause-gated on purpose (the lock trap), and this call
   * is the explicit resume gesture itself, fired as the gate
   * opens. Refusal is swallowed silently — Chrome refuses re-lock
   * for ~1.25 s after an Esc-caused unlock, surfacing as a
   * rejected promise rather than a throw — and the fallback is
   * the pre-seam behavior: the next canvas click captures.
   * Alt-tab pauses carry no cooldown and are the common case.
   */
  requestResumeLock(): void {
    if (this.mode !== 'first' || !this.canvas) return;
    if (document.pointerLockElement === this.canvas) return;
    try {
      const pending = this.canvas.requestPointerLock() as unknown as
        | Promise<void>
        | undefined;
      pending?.catch(() => {
        // Refused (the post-Esc cooldown is the known case) —
        // silent by design; see the doc comment above.
      });
    } catch {
      // Synchronous refusal on older engines — same silent fallback.
    }
  }

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
    // Typing yield (2026-10-29): a keystroke aimed at a text
    // field belongs to the field — the same target test App's
    // key handlers use, plus contentEditable. Without this,
    // WASD moved her and V/C flipped the camera while typing
    // a world name, a seed, or cloud words, and the move
    // branch's preventDefault swallowed the letters. Yield =
    // no key add, no camera toggle, no preventDefault, so the
    // letters type normally.
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target?.isContentEditable
    ) {
      return;
    }
    const key = e.key.toLowerCase();
    if (CAMERA_TOGGLE_KEYS.includes(key)) {
      this.toggleCamera();
      return;
    }
    if (MOVE_KEYS.includes(key)) {
      if (key === 'w' && !e.repeat && !this.keys.has('w')) {
        // Fresh W press (a held key's auto-repeat is not a tap):
        // a release inside the tap window makes this the second
        // tap — sprint engages and holds while W stays down.
        if (this.timeS - this.lastForwardReleaseS <= SPRINT_TAP_WINDOW_S) {
          this.kbSprint = true;
          this.syncSprint();
        }
      }
      this.keys.add(key);
      e.preventDefault();
    }
    if (key === ' ' || key === 'spacebar') {
      // Space = jump. A focused button or link keeps its Space
      // (it clicks — menus free the mouse now, so a clicked
      // button can hold the focus; jumping AND re-triggering it
      // would double-act). Any other target: the game takes the
      // key, and preventDefault keeps the page from scrolling.
      if (tag === 'BUTTON' || tag === 'A') return;
      e.preventDefault();
      this.pressJump();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.keys.delete(key);
    if (key === 'w') {
      // The release starts the double-tap window and ends any
      // keyboard sprint (sprint lives only while W is held).
      this.lastForwardReleaseS = this.timeS;
      if (this.kbSprint) {
        this.kbSprint = false;
        this.syncSprint();
      }
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    // Mouse look only while the pointer is captured in first-person.
    if (this.mode !== 'first') return;
    if (document.pointerLockElement !== this.canvas) return;
    this.applyLook(e.movementX, e.movementY);
  };

  /**
   * Shared look math (mouse + touch): same sensitivity, same pitch
   * clamp, same throttled 'player:looked' emission. Look-down
   * gating needs the emission even when she stands still: throttle
   * to ~10 Hz like 'player:moved' so look spam stays off the bus.
   */
  private applyLook(dx: number, dy: number): void {
    this.yaw -= dx * LOOK_SENSITIVITY;
    this.pitch = Math.max(
      -1.45,
      Math.min(1.45, this.pitch - dy * LOOK_SENSITIVITY),
    );
    // Behind view: look-drag rotates FACING, not just the
    // view — the behind camera sits behind facing, so without
    // this a standing-still look would change nothing on
    // screen. Facing = yaw + PI keeps the existing convention
    // (yaw = 0 faces -z; forward from facing is (sin facing,
    // cos facing); forward-walking in first-person already
    // yields facing = yaw + PI). Movement keeps setting
    // facing from travel direction, as in every mode.
    if (this.mode === 'behind') {
      this.facing = this.yaw + Math.PI;
    }
    const now = performance.now();
    if (now - this.lastLookEmit >= 100) {
      this.lastLookEmit = now;
      bus.emit('player:looked', { pitch: this.pitch, mode: this.mode });
    }
  }

  /**
   * Touch half: drag-look deltas (pixels, same units as mouse
   * movement). Unlike mouse look, there is NO mode gate and NO
   * pointer-lock gate — a phone has no pointer lock, and gating
   * here would make touch look dead. The pitch state stays
   * consistent across mode switches; third-person ground gating
   * ignores pitch by its own rule, so applying it there is harmless.
   */
  addLookDelta(dx: number, dy: number): void {
    this.applyLook(dx, dy);
  }

  private onCanvasClick = (): void => {
    // First-person mouse look needs pointer lock; a click is the gesture
    // that grants it. Failure is non-fatal (keyboard movement still works).
    // Pause gate (Adam 2026-10-29): NEVER request the lock while paused —
    // a click on the frozen canvas (missing the resume button) locked
    // him inside a paused game with no cursor and no way to move, Esc
    // the only way out. The render loop already reads this same
    // pauseState singleton; the click path now does too.
    if (pauseState.isPaused()) return;
    if (this.mode === 'first' && document.pointerLockElement !== this.canvas) {
      this.canvas?.requestPointerLock();
    }
  };

  /**
   * Pitch default (sky-trap fix, Adam 2026-10-26): reset pitch to
   * horizontal (0). Called when entering first-person (inside
   * toggleCamera) and on world regenerate/new seed (App's
   * regenerate) — pitch otherwise persists across mode switches
   * and regenerations, so a witch left staring at the sky would
   * stay staring at the sky in first-person. Only pitch moves:
   * yaw, facing, and position are untouched. Emits 'player:looked'
   * directly (not throttled — a discrete state change, like
   * 'camera:switched') so proximity's look-down gate drops stale
   * pitch immediately instead of waiting for the next mouse move.
   * Third-person and behind views are unaffected in behavior —
   * neither reads pitch for framing.
   */
  resetLook(): void {
    this.pitch = 0;
    bus.emit('player:looked', { pitch: 0, mode: this.mode });
  }

  /** Save seam: looking direction (position is saved separately). */
  snapshotFacing(): FacingSnapshot {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  /**
   * Save-boot restore: yaw + pitch. Pitch clamps to ±1.45
   * (applyLook's clamp); behind mode re-syncs facing = yaw + PI
   * (applyLook's rule — third/first facing re-derives on first
   * move, as on any fresh boot); emits 'player:looked' directly
   * like resetLook (discrete change, so the tracker's look-down
   * gate drops stale pitch at once). Call AFTER mode is set from
   * save — the behind sync reads current mode. Returns false (no
   * change) for non-finite input.
   */
  restoreFacing(snap: FacingSnapshot): boolean {
    if (!snap || !Number.isFinite(snap.yaw) || !Number.isFinite(snap.pitch)) {
      return false;
    }
    this.yaw = snap.yaw;
    this.pitch = Math.max(-1.45, Math.min(1.45, snap.pitch));
    if (this.mode === 'behind') {
      this.facing = this.yaw + Math.PI;
    }
    bus.emit('player:looked', { pitch: this.pitch, mode: this.mode });
    return true;
  }

  toggleCamera(): void {
    this.mode =
      this.mode === 'first'
        ? 'third'
        : this.mode === 'third'
          ? 'behind'
          : 'first';
    if (this.mode === 'first') {
      // Entering first-person re-defaults pitch to horizontal
      // (sky-trap fix — see resetLook).
      this.resetLook();
      // Best effort: a keydown counts as a user gesture for pointer lock.
      // Same pause gate as onCanvasClick (2026-10-29): V/C reach this
      // handler while paused (nothing consumes them — the loop is
      // frozen, the listeners are not), so entering first-person from
      // 'behind' while paused would spring the same lock trap by
      // keyboard. The mode switch itself still happens; only the
      // lock request waits for an unpaused click.
      if (!pauseState.isPaused()) {
        try {
          this.canvas?.requestPointerLock();
        } catch {
          // Non-fatal; the next canvas click will capture instead.
        }
      }
    } else if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    bus.emit('camera:switched', { mode: this.mode });
  }

  /** Advance movement by dt seconds. Called once per frame by the renderer. */
  update(dt: number): void {
    // Game-time clock first: double-tap windows are judged on
    // accumulated frame time (see the sprint state block).
    this.timeS += dt;
    // Jump arc: integrates even with no movement input, so a
    // hop started standing still still rises and lands.
    if (this.vy !== 0 || this.yOffset > 0) {
      this.yOffset += this.vy * dt;
      this.vy -= JUMP_GRAVITY * dt;
      if (this.yOffset <= 0) {
        this.yOffset = 0;
        this.vy = 0;
      }
    }
    // One movement path for keys + thumbstick: the stick vector is
    // the base, keys add on top, and the combined vector is
    // direction-normalized with magnitude kept as the speed factor.
    // Desktop is unchanged by construction: keys-only vectors have
    // magnitude 1 (single key) or sqrt(2) (diagonal, clamped to 1),
    // exactly as the old normalize-then-move. A partial stick push
    // walks proportionally slower (analog magnitude < 1); sprint,
    // when engaged, multiplies the composed speed below.
    let fx = this.stickX;
    let fz = this.stickZ;
    if (this.keys.has('w')) fz -= 1;
    if (this.keys.has('s')) fz += 1;
    if (this.keys.has('a')) fx -= 1;
    if (this.keys.has('d')) fx += 1;
    if (fx === 0 && fz === 0) return;

    const len = Math.hypot(fx, fz);
    fx /= len;
    fz /= len;
    const magnitude = Math.min(1, len);

    // Speed modifiers compose as separate multipliers (Adam,
    // 2026-10-26 — bog boots brief): terrain slow × hunger slow,
    // with boots mitigation reducing ONLY the terrain part.
    // Terrain: raw terrain multiplier at her position (firm = 1,
    // full bog = BOGGY_SLOW_MIN), mitigated by boots when worn.
    const rawTerrain = this.terrainSpeedQuery?.(this.x, this.z) ?? 1;
    const bootsWorn = this.bogBootsQuery?.() ?? false;
    const terrain = applyBogBoots(rawTerrain, bootsWorn);
    // Hunger slowdown (Adam, 2026-10-26 — weather + hunger build):
    // a hungry witch moves at HUNGRY_SPEED_MULTIPLIER of base
    // speed. Applies at 'hungry' AND 'too-hungry' (too-hungry is
    // hungry or worse). Unrecognized stages read as fed (see hunger.ts),
    // and an unwired query means full speed.
    const stage = this.hungerStageQuery?.() ?? null;
    const hunger =
      stage === 'hungry' || stage === 'too-hungry' ? HUNGRY_SPEED_MULTIPLIER : 1;
    // Sprint (2026-10-29, DRAFT x1.6) composes as one more
    // multiplier on the same line — terrain, hunger, charm and
    // sprint all multiply together, none replaces another.
    const sprint = this.sprinting ? SPRINT_MULTIPLIER : 1;
    const speed = PLAYER_SPEED * terrain * hunger * swiftStepFactor(this.swiftStep) * sprint * magnitude;

    if (this.mode === 'first' || this.mode === 'behind') {
      // Movement relative to view yaw (yaw = 0 faces -z). Rotate the local
      // input (fx = right, fz = back) by yaw around Y into world space.
      // Behind view shares this branch: yaw-relative movement IS
      // facing-relative there, because applyLook syncs facing to
      // view direction in behind mode (see below).
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const wx = fx * cos + fz * sin;
      const wz = -fx * sin + fz * cos;
      this.x += wx * speed * dt;
      this.z += wz * speed * dt;
      this.facing = Math.atan2(wx, wz);
    } else {
      // Third-person overhead: world-aligned movement (W = -z).
      this.x += fx * speed * dt;
      this.z += fz * speed * dt;
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
