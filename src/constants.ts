/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const THEME = {
  colors: {
    ink: '#0a0a0a',
    moss: '#4a6833',
    leaf: '#5c823d',
    leafLight: '#86ae53',
    leafDark: '#2d451e',
    wood: '#734b29',
    bark: '#4a2e18',
    nicotine: '#d4b768',
    blood: '#a82424',
    mud: '#3a281c',
    parchment: '#e8ddc1',
    bone: '#f5efe0',
    coal: '#1f1f1f',
    sprout: '#96c257',
  },
};

/** World chunk edge length in meters. */
export const CHUNK_SIZE = 32;
/** Ground plane subdivisions per chunk edge (vertex-color resolution). */
export const GROUND_SEGMENTS = 16;
/**
 * Streaming radius in chunks (Chebyshev distance). Radius 3 = a 7x7 grid,
 * ~224 m across — neighboring zones are already generated and blending in
 * long before the player reaches them.
 */
export const STREAM_RADIUS_CHUNKS = 3;
/** Scatter placement attempts per chunk (kept by local biome density). */
export const BASE_SCATTER_PER_CHUNK = 40;
/** Walk speed, meters per second. No terrain speed modifier in landing 1:
 *  swamp navigation difficulty is undecided and must not be invented. */
export const PLAYER_SPEED = 5;
/** First-person eye height in meters. */
export const PLAYER_EYE_HEIGHT = 1.7;
/** Third-person overhead follow offset (above + behind the witch). */
export const THIRD_PERSON_OFFSET = { x: 0, y: 16, z: 10 };
/**
 * Behind-the-witch follow framing (Adam, 2026-10-26 — starting
 * tunables for his pin pass, NOT pinned): the camera sits this
 * far behind her facing at this height, looking at a point this
 * far ahead of her at this height — her back in frame low, the
 * view ahead dominating. Forward from facing is (sin facing,
 * cos facing); see player.ts. Shared by the renderer and the
 * UI projection helper so both place from the same numbers.
 */
export const BEHIND_CAMERA_DISTANCE = 3.5;
export const BEHIND_CAMERA_HEIGHT = 2.4;
export const BEHIND_LOOK_AHEAD = 4;
export const BEHIND_LOOK_HEIGHT = 1.2;
/** Default world seed (a string; any string is a valid seed). */
export const DEFAULT_SEED = 'silent-earth-001';
/** Keys that toggle the camera. Both work; V is the documented one. */
export const CAMERA_TOGGLE_KEYS = ['v', 'c'];
/** Movement keys (WASD). */
export const MOVE_KEYS = ['w', 'a', 's', 'd'];
