/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TILE_WIDTH, TILE_HEIGHT } from '../constants';
import { GridPos, Point } from '../types';

/**
 * Converts grid coordinates (q, r) to isometric screen coordinates (x, y).
 */
export const gridToScreen = (q: number, r: number): Point => {
  return {
    x: (q - r) * (TILE_WIDTH / 2),
    y: (q + r) * (TILE_HEIGHT / 2)
  };
};

/**
 * Calculates the depth for sorting isometric entities.
 */
export const calculateDepth = (q: number, r: number): number => {
  return q + r;
};

/**
 * Guard clause for valid grid IDs.
 */
export const isValidId = (id: string): boolean => {
  return /^[a-zA-Z0-9_\-]+$/.test(id);
};
