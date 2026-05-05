/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export enum TileType {
  ROTTED_WOOD = 'rotted_wood',
  DAMP_MUD = 'damp_mud',
  OVERGROWTH = 'overgrowth',
}

export type ItemType = string;
export type StructureType = string;

export const THEME = {
  colors: {
    ink: '#0a0a0a',
    moss: '#2d3822',
    nicotine: '#cbb06d',
    blood: '#4a0e0e',
    mud: '#2b1e16',
    parchment: '#dfd3b6',
    bone: '#f0ead6',
    coal: '#1a1a1a',
  }
};
