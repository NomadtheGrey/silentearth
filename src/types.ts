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

export interface SecondaryDrop {
  type: string;
  chance: number;
  message: string;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: number;
  icon?: string;
  isWorkstation?: boolean;
  harvestAction?: string;
  harvestStep?: number;
  struggleMessage?: string;
  successMessage?: string;
  secondaryDrops?: SecondaryDrop[];
}

export interface TileDef {
  id: string;
  name: string;
  description: string;
  color: string;
  spawnRates: Record<string, number>; // ItemType -> Weight
}

export interface StructureDef {
  id: string;
  name: string;
  costs: Record<string, number>;
  description: string;
  requiresWorkstation?: boolean;
}

export interface WorldData {
  items: Record<string, ItemDef>;
  structures: Record<string, StructureDef>;
  tiles: Record<string, TileDef>;
}

export interface GameState {
  tiles: WorldTile[];
  items: WorldItem[];
  structures: Structure[];
  inventory: Record<string, number>;
  cameraOffset: Point;
  playerPos: GridPos;
}
