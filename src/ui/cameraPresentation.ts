/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — camera presentation spec (UI lane).
 *
 * How each switchable perspective looks, feels, and frames — this
 * lane's presentation ownership, written as data so the wording and
 * the numbers live in one place. The values below are grounded in
 * the controllers as they stand (src/game/player.ts, renderer.ts);
 * where this spec proposes something the controllers do not do yet,
 * it says so plainly.
 *
 * AS THE CONTROLLERS STAND (read, not changed):
 * - One perspective camera, FOV 60, near 0.1, far 1000, in all modes.
 * - First-person: camera at the player's position at eye height 1.7 m,
 *   rotation YXZ from yaw (mouse look, pointer-locked, 0.0025/px) and
 *   pitch clamped to ±1.45 rad. Movement is relative to view yaw.
 *   The witch mesh is hidden — you are the witch.
 * - Third-person overhead: camera at player + offset (0, 16, 10),
 *   looking at the player on the ground. Movement is world-aligned
 *   (W = -z). The witch mesh is visible and faces movement.
 * - Behind: camera 3.5 m behind her facing at 2.4 m height, looking
 *   4 m ahead at 1.2 m. Movement is yaw-relative (facing-relative,
 *   since look-drag syncs facing to view direction in this mode).
 *   The witch mesh is visible from behind.
 * - Switching is instant in the engine (V / C, pointer lock entered
 *   on first-person entry, released on exit). The transition treatment
 *   below is an overlay that masks that snap — it does not move the
 *   camera, and no camera-path animation is claimed.
 *
 * PROPOSALS (for the wiring step, not current behaviour):
 * - Ease the third-person facing turn instead of snapping it to the
 *   movement direction (see motionPresentation.ts).
 * - No FOV change between modes: the same 60 keeps the world
 *   recognisable across the switch, which is the point of a
 *   player-chosen perspective.
 */

import type { CameraPerspective } from './types';

export interface CameraFraming {
  mode: CameraPerspective;
  /** Plain-words title for the view. */
  title: string;
  /** How the view should feel to the player. */
  feel: string;
  /** Framing facts, in plain words, for display. */
  facts: string[];
  /** Where the witch herself is in this view. */
  witchInView: string;
}

export const CAMERA_FRAMING: Record<CameraPerspective, CameraFraming> = {
  first: {
    mode: 'first',
    title: 'First-person',
    feel: 'You are the witch. Eye-level, close to the ground character — mud, vines, and standing water fill the view, and the October fog closes in at the edges. Looking is the interaction: mouse look is how you read the world.',
    facts: [
      'Eye height 1.7 m, FOV 60',
      'Mouse look, pitch clamped so the view never flips',
      'Movement follows where you look',
    ],
    witchInView: 'Hidden — you are the witch, so there is no body to see.',
  },
  third: {
    mode: 'third',
    title: 'Third-person overhead',
    feel: 'Watch the witch. A high tableau — the bell dress, the bone face, the candle — reads against the ground at a glance, and the world around her stays in frame. This is the view for placing her in the mire and seeing what surrounds her.',
    facts: [
      'Camera above and behind: offset (0, 16, 10) from the player',
      'Looking down at the player on the ground, FOV 60',
      'Movement is world-aligned (W is always north, -z)',
    ],
    witchInView: 'Visible, facing the direction she moves.',
  },
  behind: {
    mode: 'behind',
    title: 'Behind (over-shoulder)',
    feel: 'Walk with the witch. The camera rides just behind her at over-shoulder height, her back in frame low, and the ground and world ahead open out in front of her — the view for adventuring, for going somewhere rather than looking down at a map.',
    facts: [
      'Camera 3.5 m behind her facing at 2.4 m height, looking 4 m ahead at 1.2 m, FOV 60',
      'Movement follows facing; look-drag turns facing, so the camera follows her turns',
      'Not the overhead map view, not ground level where she would block the view',
    ],
    witchInView: 'Visible from behind — her back, dress, and candle lead the frame.',
  },
};

/**
 * How a perspective switch is treated on screen. The engine switch
 * itself is instant; this overlay fades through black so the snap
 * reads as a deliberate cut, not a glitch. Durations are presentation
 * values for CameraTransition.
 */
export const CAMERA_TRANSITION = {
  /** Fade duration in milliseconds, each way. */
  fadeMs: 300,
  /** Vignette strength at rest (0–1), deepening while switching. */
  vignetteRest: 0.35,
  vignetteSwitching: 0.9,
} as const;
