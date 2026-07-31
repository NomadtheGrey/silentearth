/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const WORLD_SIZE = 24;
export const INITIAL_RESOURCES = 180;

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export enum TileType {
  DENSE_THICKET = 'dense_thicket',
  DAMP_HOLLOW = 'damp_hollow',
  TANGLED_DEEPWOOD = 'tangled_deepwood',
  SHALLOW_CREEK = 'shallow_creek',
  MINERAL_CRUST = 'mineral_crust'
}

export type ItemType = string;
export type StructureType = string;

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
  }
};
