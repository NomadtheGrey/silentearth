/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — character motion presentation (UI lane).
 *
 * How the witch moves and reads on screen, in third-person especially.
 * This lane owns the presentation; the controller (src/game/player.ts)
 * owns the movement, and this spec does not change it.
 *
 * AS THE CONTROLLER STANDS (read, not changed):
 * - Walk only, WASD, flat 5 m/s everywhere. No sprint, no jump, no
 *   terrain speed modifier — swamp navigation difficulty is undecided
 *   and must not be invented here, so this spec has exactly two
 *   motion states: idle and walk.
 * - Third-person facing snaps to the movement direction
 *   (rotation.y = facing, set every frame). First-person has no
 *   visible body to animate.
 * - Position flows out on the event bus at ~10 Hz; the renderer
 *   positions the mesh every frame.
 *
 * PRESENTATION READING (this lane's proposal, for the wiring step):
 * - Idle is not frozen: a slow breathing sway, dress still, candle
 *   flame flickering. The witch is alive when she is not moving.
 * - Walk reads through the whole figure, not just translation: a
 *   gentle vertical bob, a side-to-side sway, and the bell dress
 *   flaring slightly with speed. Speed is normalised here (0 = idle,
 *   1 = full walk at 5 m/s) so the same presentation survives any
 *   later speed change without rewriting the animation.
 * - Turns should ease, not snap: when the facing direction changes,
 *   the figure should swing toward the new facing over a short
 *   interval instead of jumping to it in one frame. The controller
 *   currently snaps; easing is a wiring-step change to the renderer,
 *   proposed here, not claimed as current behaviour.
 */

export type MotionState = 'idle' | 'walk';

export interface MotionPresentation {
  state: MotionState;
  /** Plain-words reading of the state. */
  read: string;
  /** Bob amplitude for the 2D motion study, in pixels. */
  bobPx: number;
  /** One full bob cycle, in milliseconds, at full walk speed. */
  bobCycleMs: number;
  /** Sway (rotation) amplitude, in degrees. */
  swayDeg: number;
  /** Dress flare at full speed, as a horizontal scale factor. */
  flareScale: number;
}

export const MOTION_PRESENTATION: Record<MotionState, MotionPresentation> = {
  idle: {
    state: 'idle',
    read: 'Breathing, not frozen: a slow sway, dress settled, candle flame flickering. She is alive while she stands.',
    bobPx: 0,
    bobCycleMs: 0,
    swayDeg: 1.5,
    flareScale: 1,
  },
  walk: {
    state: 'walk',
    read: 'The whole figure walks: a gentle bob, a side sway, and the bell dress flaring slightly with speed. The candle stays lit through it all.',
    bobPx: 3,
    bobCycleMs: 600,
    swayDeg: 3,
    flareScale: 1.08,
  },
};

/** How long a facing turn should ease over, in milliseconds (proposal). */
export const FACING_EASE_MS = 180;
