/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeNoise2D } from 'fast-simplex-noise';
import { TileType, WORLD_SIZE, INITIAL_RESOURCES } from '../constants';
import { WorldTile, WorldItem, GameState, WorldData } from '../types';

export function generateWorld(worldData: WorldData): GameState {
  const tiles: WorldTile[] = [];
  const seedValue = Math.random();
  
  // Noise generators with fixed seed
  const terrainNoise = makeNoise2D(() => seedValue);
  const moistureNoise = makeNoise2D(() => seedValue + 100);
  const riverNoise = makeNoise2D(() => seedValue + 200);
  const ruggedNoise = makeNoise2D(() => seedValue + 300);

  for (let q = 0; q < WORLD_SIZE; q++) {
    for (let r = 0; r < WORLD_SIZE; r++) {
      // Multi-frequency terrain noise
      const n = (terrainNoise(q * 0.1, r * 0.1) + 1) / 2;
      const m = (moistureNoise(q * 0.08, r * 0.08) + 1) / 2;
      const rugged = (ruggedNoise(q * 0.4, r * 0.4) + 1) / 2;
      
      // --- Option #1: Domain Warping for Rivers ---
      const warpX = riverNoise(q * 0.02, r * 0.02) * 10;
      const warpY = riverNoise(q * 0.02 + 5, r * 0.02 + 5) * 10;
      
      // River "Ridge" noise - thickened with rugged banks
      const rn = Math.abs(riverNoise((q + warpX) * 0.04, (r + warpY) * 0.04));
      
      // Topography Bias: Water prefers low-lying terrain (low n)
      const topoBias = Math.max(0.2, 1.4 - (n * 1.5)); 
      const adjustedRiverThreshold = (0.16 + (rugged * 0.06)) * topoBias;
      
      let type = TileType.DENSE_THICKET;
      
      // Priority 1: Creeks (The "Thickened Artery" logic)
      if (rn < adjustedRiverThreshold) {
        type = TileType.SHALLOW_CREEK;
      } 
      // Priority 2: Mineral Crust (Salt)
      else if (m > 0.6 && rugged > 0.8) {
        type = TileType.MINERAL_CRUST;
      }
      // Priority 3: Moisture-based (Damp Hollows vs Dry Deepwood)
      else if (m > 0.75) {
        type = TileType.DAMP_HOLLOW;
      }
      else if (n > 0.65) {
        type = TileType.TANGLED_DEEPWOOD;
      }
      
      tiles.push({
        id: `tile-${q}-${r}`,
        pos: { q, r },
        type,
      });
    }
  }

  const items: WorldItem[] = [];
  const occupied = new Set<string>();

  for (let i = 0; i < INITIAL_RESOURCES * 2.2; i++) {
    const q = Math.floor(Math.random() * WORLD_SIZE);
    const r = Math.floor(Math.random() * WORLD_SIZE);
    const key = `${q}-${r}`;
    
    if (occupied.has(key)) continue;

    const tile = tiles.find(t => t.pos.q === q && t.pos.r === r);
    if (!tile) continue;

    const tileDef = worldData.tiles[tile.type];
    const clusterN = (Math.sin(q * 0.8 + seedValue) * Math.cos(r * 0.8) + 1) / 2;
    let type = 'SNAP_WOOD';
    
    if (tileDef) {
      const candidates = Object.entries(tileDef.spawnRates);
      let currentWeight = 0;
      const totalWeight = candidates.reduce((acc, [_, w]) => acc + w, 0);
      const targetWeight = clusterN * totalWeight;
      
      for (const [cid, w] of candidates) {
        currentWeight += w;
        if (currentWeight >= targetWeight) {
          type = cid;
          break;
        }
      }
    }

    if (tile.type === TileType.DENSE_THICKET && Math.random() < 0.04) {
        type = 'STUMP';
    }

    items.push({
      id: `item-${i}`,
      pos: { q, r },
      type,
      offset: { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 6 }
    });
    occupied.add(key);
  }

  const initialInventory: Record<string, number> = {};
  Object.keys(worldData.items).forEach(id => {
    initialInventory[id] = 0;
  });
  initialInventory['SNAP_WOOD'] = 12;

  return {
    tiles,
    items,
    structures: [],
    inventory: initialInventory,
    cameraOffset: { x: 0, y: 0 },
    playerPos: { q: 12, r: 12 }
  };
}
