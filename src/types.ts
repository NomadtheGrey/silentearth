/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TileType, ItemType, StructureType } from './constants';

export interface Point {
  x: number;
  y: number;
}

export interface GridPos {
  q: number; // Column
  r: number; // Row
}

export interface WorldTile {
  id: string;
  pos: GridPos;
  type: TileType;
}

export interface WorldItem {
  id: string;
  pos: GridPos;
  type: string; // ID from world_data.json
  offset: Point; // Visual jitter
}

export interface Structure {
  id: string;
  pos: GridPos;
  type: string; // ID from world_data.json
  progress: number; // 0 to 1
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: number;
  icon?: string;
}

export interface StructureDef {
  id: string;
  name: string;
  costs: Record<string, number>;
  description: string;
}

export interface WorldData {
  items: Record<string, ItemDef>;
  structures: Record<string, StructureDef>;
}

export interface GameState {
  tiles: WorldTile[];
  items: WorldItem[];
  structures: Structure[];
  inventory: Record<string, number>;
  cameraOffset: Point;
  playerPos: GridPos;
}
