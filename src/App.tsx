/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Skull, Pickaxe, Map as MapIcon, Hammer, Axe, Trees as Wood, Package, Tent, ChevronRight } from 'lucide-react';
import { 
  TILE_WIDTH, 
  TILE_HEIGHT, 
  TileType, 
  ItemType, 
  StructureType, 
  THEME 
} from './constants';
import { WorldTile, WorldItem, Structure, GameState, GridPos, Point, WorldData } from './types';
import { GrittyFilter, GlobalNoise } from './components/Effects';
import { IsometricTile } from './components/IsometricTile';
import { AmbientAudio } from './components/AmbientAudio';
import worldDataRaw from './data/world_data.json';

const worldData = worldDataRaw as WorldData;

export const INITIAL_RESOURCES = 180;
export const WORLD_SIZE = 24; 

// Virtual viewport dimensions for the SVG
const VIEWPORT_W = 860;
const VIEWPORT_H = 480;

const CharacterAvatar: React.FC<{ pos: GridPos }> = ({ pos }) => {
  const x = (pos.q - pos.r) * (TILE_WIDTH / 2);
  const y = (pos.q + pos.r) * (TILE_HEIGHT / 2);

  return (
    <motion.g 
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 120, damping: 20 }}
      className="pointer-events-none"
    >
      <g transform={`translate(${TILE_WIDTH / 2 - 10}, ${-36})`} style={{ filter: 'url(#ink-stipple)' }}>
        {/* Soft shadow */}
        <ellipse cx="10" cy="38" rx="8" ry="2.5" fill="rgba(0,0,0,0.4)" />
        
        {/* Survivor Body - Bell-shaped Dress */}
        <path 
          d="M 10,6 L 1,36 L 19,36 Z" 
          fill={THEME.colors.coal} 
          stroke={THEME.colors.ink}
          strokeWidth="1.5"
        />
        {/* Pleats/Folds */}
        <path d="M 10,12 L 5,36 M 10,12 L 15,36 M 10,12 L 10,36" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.4" />
        
        {/* Human Face/Head */}
        <g transform="translate(10, 8)">
          <path d="M -3.5,0 C -3.5,-5 3.5,-5 3.5,0 C 3.5,5 -3.5,5 -3.5,0" fill={THEME.colors.bone} stroke={THEME.colors.ink} strokeWidth="1" />
          <path d="M -1.5,-1 L -1,-1 M 1.5,-1 L 1,-1" stroke={THEME.colors.ink} strokeWidth="1" />
        </g>
        
        {/* Primitive Candle */}
        <g transform="translate(17, 22)">
          <rect x="-0.8" y="-4" width="1.6" height="5" fill={THEME.colors.bone} stroke={THEME.colors.ink} strokeWidth="0.5" />
          <circle cx="0" cy="-6" r="3" fill="#6a1a1a" opacity="0.4">
             <animate attributeName="r" values="2;4;2" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="-6" r="1.2" fill={THEME.colors.nicotine} />
        </g>
      </g>
    </motion.g>
  );
};

const NatureAsset: React.FC<{ 
  q: number; 
  r: number; 
  type: TileType; 
  itemType?: ItemType;
  isHarvestingAllowed?: boolean;
  onHarvest?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}> = ({ q, r, type, itemType, isHarvestingAllowed, onHarvest, onMouseEnter, onMouseLeave }) => {
  // Biome noise blending for consistent fluff density
  const nLow = (Math.sin(q * 0.2 + 1.2) * Math.cos(r * 0.2 + 2.3) + 1) / 2;
  const nMid = (Math.sin(q * 0.5 - 0.5) * Math.cos(r * 0.5 + 1.5) + 1) / 2;
  const noiseVal = nLow * 0.6 + nMid * 0.4;
  
  const detailNoise = (Math.sin(q * 1.5 + 3.4) * Math.cos(r * 1.5 + 4.5) + 1) / 2;
  const seed = (q * 17 + r * 23) % 100;
  
  const x = (q - r) * (TILE_WIDTH / 2) + TILE_WIDTH / 2;
  const y = (q + r) * (TILE_HEIGHT / 2) + TILE_HEIGHT / 2;
  
  const variant = seed % 3;
  const isTree = itemType === 'TIMBER';
  const isBush = itemType === 'ROOTS';
  const isMud = itemType === 'MUD';
  const isStone = itemType === 'STONE';
  const isMushroom = itemType === 'MUSHROOM';
  
  // Fluff assets
  const isNaturalDensity = type === TileType.OVERGROWTH ? noiseVal > 0.4 : noiseVal > 0.8;
  const hasFluff = !itemType && isNaturalDensity && detailNoise > 0.3;

  const isSmallRoot = hasFluff && detailNoise > 0.8;
  const isTallGrass = hasFluff && detailNoise > 0.5 && detailNoise <= 0.8;
  const isTwistedVine = hasFluff && detailNoise > 0.3 && detailNoise <= 0.5;
  const isInkPuddle = hasFluff && detailNoise <= 0.3;
 
  const isDenseOvergrowth = !itemType && type === TileType.OVERGROWTH && detailNoise < 0.7;
  const isExtraBush = isDenseOvergrowth && detailNoise < 0.3;
  const isExtraVines = isDenseOvergrowth && detailNoise >= 0.3;
 
  if (!itemType && !hasFluff && !isDenseOvergrowth) return null;
 

  return (
    <g 
      transform={`translate(${x}, ${y})`} 
      style={{ filter: 'url(#ink-stipple)' }} 
      className={itemType ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        if (itemType && isHarvestingAllowed) {
          e.stopPropagation();
          onHarvest?.();
        }
      }}
    >
      {isTree && (
        <g transform="translate(0, -35)" className="opacity-90">
          {variant === 0 && <path d="M 0,35 Q -15,10 0,-20 M 0,5 L -12,-5 M 0,15 L 15,0 M -5,-10 L 0,-25" fill="none" stroke={THEME.colors.ink} strokeWidth="2.5" strokeLinecap="round" />}
          {variant === 1 && (
            <g>
              <path d="M 0,35 L 0,0 M 0,0 L -8,-15 M 0,0 L 8,-15" fill="none" stroke={THEME.colors.ink} strokeWidth="2" />
              {/* Live Foliage */}
              <circle cx="0" cy="-10" r="14" fill={THEME.colors.moss} opacity="0.6" style={{ filter: 'url(#ink-stipple)' }} />
              <circle cx="-10" cy="-5" r="10" fill={THEME.colors.moss} opacity="0.4" />
              <circle cx="10" cy="-5" r="10" fill={THEME.colors.moss} opacity="0.4" />
              <path d="M -5,10 Q 0,0 5,10" fill="none" stroke={THEME.colors.moss} strokeWidth="4" opacity="0.4" />
            </g>
          )}
          {variant === 2 && (
            <g>
              <path d="M 0,35 L -10,-5 M 0,15 L 12,0" fill="none" stroke={THEME.colors.ink} strokeWidth="2.5" />
              <path d="M -15,-10 Q -10,-25 0,-15 Q 10,-25 15,-10 Z" fill={THEME.colors.moss} opacity="0.7" />
              <circle cx="-10" cy="-5" r="2" fill={THEME.colors.blood} opacity="0.6" />
            </g>
          )}
        </g>
      )}
      {isBush && (
        <g transform="translate(-15, -12)" className="opacity-90">
          {/* Main tangled mass */}
          <path d="M 0,18 Q 15,-10 30,18 M 5,15 Q 15,0 25,15" fill="none" stroke={THEME.colors.moss} strokeWidth="4" opacity="0.5" />
          <path d="M 2,18 L 15,2 L 28,18" fill="none" stroke={THEME.colors.ink} strokeWidth="1" opacity="0.3" />
          <path d="M 5,18 Q 15,5 25,18" fill="none" stroke={THEME.colors.ink} strokeWidth="0.8" opacity="0.2" />
          {variant === 0 && <circle cx="15" cy="5" r="1.5" fill={THEME.colors.blood} opacity="0.6" />}
        </g>
      )}
      {isMud && (
         <g transform="translate(-12, -4)" className="opacity-90">
             <path d="M 0,10 Q 12,0 24,10" fill={THEME.colors.mud} stroke={THEME.colors.ink} strokeWidth="1" opacity="0.8" />
             <circle cx="12" cy="6" r="2" fill={THEME.colors.ink} opacity="0.2" />
         </g>
      )}
      {isStone && (
         <g transform="translate(-8, -4)" className="opacity-90">
             <path d="M 0,8 L 6,0 L 14,2 L 12,10 L 2,12 Z" fill={THEME.colors.coal} stroke={THEME.colors.ink} strokeWidth="1" />
             <path d="M 4,4 L 10,6" stroke={THEME.colors.nicotine} strokeWidth="0.5" opacity="0.5" />
         </g>
      )}
      {isMushroom && (
        <g transform="translate(0, 0)">
          <path d="M -2,8 Q -2,4 2,4 Q 2,8 2,10 L -2,10 Z" fill={THEME.colors.bone} />
          <path d="M -6,5 Q 0,-5 6,5 L 4,7 L -4,7 Z" fill={THEME.colors.blood} stroke={THEME.colors.ink} strokeWidth="0.5" />
          <circle cx="-1.5" cy="2" r="0.8" fill={THEME.colors.bone} opacity="0.6" />
          <circle cx="2" cy="3.5" r="0.8" fill={THEME.colors.bone} opacity="0.6" />
        </g>
      )}

      {/* Environmental Fluff */}
      {isSmallRoot && (
        <path d="M -10,10 Q 0,0 10,5" fill="none" stroke={THEME.colors.mud} strokeWidth="2" opacity="0.5" />
      )}
      {isTallGrass && (
        <g transform="translate(0, 8)">
          <path d={`M 0,0 Q ${variant-1},-8 ${variant-1},-15`} fill="none" stroke={THEME.colors.moss} strokeWidth="1.2" opacity="0.6" />
          <path d={`M 2,0 Q ${variant},-6 ${variant},-12`} fill="none" stroke={THEME.colors.moss} strokeWidth="1" opacity="0.4" />
          <path d={`M -2,0 Q ${variant-2},-7 ${variant-2},-13`} fill="none" stroke={THEME.colors.moss} strokeWidth="1" opacity="0.5" />
        </g>
      )}
      {isTwistedVine && (
        <path d="M -15,10 Q 0,-20 15,10" fill="none" stroke={THEME.colors.ink} strokeWidth="1.2" strokeDasharray="2 2" opacity="0.4" />
      )}
      {isInkPuddle && (
        <ellipse cx="0" cy="8" rx="10" ry="4" fill={THEME.colors.ink} opacity="0.3" />
      )}
      {/* Dense Overgrowth Extras */}
      {isDenseOvergrowth && (
        <g transform="translate(0, 5)">
          <path d="M 0,8 Q -12,0 -8,-15 M 0,8 Q 12,0 8,-15" fill="none" stroke={THEME.colors.moss} strokeWidth="2" opacity="0.5" />
          <path d="M 0,8 V -8" stroke={THEME.colors.moss} strokeWidth="1.2" opacity="0.3" />
          <circle cx="-6" cy="4" r="4" fill={THEME.colors.ink} opacity="0.1" />
        </g>
      )}
      {isExtraBush && (
        <g transform="translate(-10, 0)">
           <circle cx="0" cy="5" r="8" fill={THEME.colors.moss} opacity="0.3" />
           <path d="M -5,5 Q 0,-5 5,5" fill="none" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.3" />
        </g>
      )}
      {isExtraVines && (
        <path d="M -12,12 L 12,2 M -15,5 L 10,15" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.4" strokeDasharray="1 3" />
      )}

      {/* Manual Harvest UI Logic */}
      {itemType && isHarvestingAllowed && (
        <g transform="translate(-22, -45)" style={{ pointerEvents: 'none' }}>
          <rect width="44" height="14" fill={THEME.colors.bone} stroke={THEME.colors.ink} rx="1" style={{ filter: 'url(#rough-edge)' }} />
          <text x="22" y="10" textAnchor="middle" fill={THEME.colors.ink} fontSize="7" fontWeight="900">HARVEST [H]</text>
        </g>
      )}
    </g>
  );
};

export default function App() {
  const [zoom, setZoom] = useState(1);
  const [hoveredPos, setHoveredPos] = useState<GridPos | null>(null);

  const [isObjectivesOpen, setIsObjectivesOpen] = useState(true);

  const handleWheel = (e: React.WheelEvent) => {
    setZoom(prev => {
      const next = prev - e.deltaY * 0.002;
      return Math.max(0.4, Math.min(2.5, next));
    });
  };

  const [gameState, setGameState] = useState<GameState>(() => {
    const tiles: WorldTile[] = [];
    const seedValue = Math.random();

    // Multi-octave noise helper for natural veins
    const getNoiseVal = (q: number, r: number, freq: number, seedOffset: number) => {
      const s = seedValue * 10 + seedOffset;
      return (Math.sin(q * freq + s) * Math.cos(r * freq + s * 0.7) + 1) / 2;
    };

    const getBiomeNoise = (q: number, r: number) => {
      const low = getNoiseVal(q, r, 0.15, 0);   // Broad patches
      const mid = getNoiseVal(q, r, 0.5, 5);     // Veins/Bridges
      const warp = getNoiseVal(q, r, 2.0, 10);   // Tiny interruptions
      return (low * 0.6 + mid * 0.35 + warp * 0.05);
    };

    for (let q = 0; q < WORLD_SIZE; q++) {
      for (let r = 0; r < WORLD_SIZE; r++) {
        const n = getBiomeNoise(q, r);
        let type = TileType.ROTTED_WOOD;
        
        // Thresholds for "Veins"
        if (n > 0.72) type = TileType.DAMP_MUD;      // Thick silt veins
        else if (n < 0.3) type = TileType.OVERGROWTH; // Clustered overgrowth
        // Barren scars are implicit in the gaps

        tiles.push({
          id: `tile-${q}-${r}`,
          pos: { q, r },
          type,
        });
      }
    }

    const items: WorldItem[] = [];
    const occupied = new Set<string>();

    for (let i = 0; i < INITIAL_RESOURCES * 1.8; i++) {
      const q = Math.floor(Math.random() * WORLD_SIZE);
      const r = Math.floor(Math.random() * WORLD_SIZE);
      const key = `${q}-${r}`;
      
      if (occupied.has(key)) continue;

      const tile = tiles.find(t => t.pos.q === q && t.pos.r === r);
      if (!tile) continue;

      // Item distribution based on biome density
      const n = getBiomeNoise(q, r);
      const clusterN = (Math.sin(q * 0.8 + seedValue) * Math.cos(r * 0.8) + 1) / 2;
      let type = 'TIMBER';
      
      if (tile.type === TileType.DAMP_MUD) {
        // Deep mud clusters
        if (clusterN > 0.6) type = 'MUD';
        else if (clusterN < 0.2) type = 'STONE';
        else type = 'ROOTS';
      } else if (tile.type === TileType.OVERGROWTH) {
        // Thick brush clusters
        if (clusterN > 0.5) type = 'ROOTS';
        else if (clusterN < 0.3) type = 'MUSHROOM';
        else type = 'TIMBER';
      } else {
        // Exposed ridges
        if (clusterN > 0.75) type = 'STONE';
        else if (clusterN < 0.15) type = 'MUSHROOM';
        else type = 'TIMBER';
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
    initialInventory['TIMBER'] = 6;

    return {
      tiles,
      items,
      structures: [],
      inventory: initialInventory,
      cameraOffset: { x: 0, y: 0 },
      playerPos: { q: 12, r: 12 }
    };
  });

  const [selectedPos, setSelectedPos] = useState<GridPos | null>(null);
  const [resonance, setResonance] = useState(15);
  const [statusMessage, setStatusMessage] = useState("The woods are watching. Tread lightly.");

  const resonanceDelta = Math.max(5, Math.min(100, (resonance + (Math.random() - 0.5) * 6))); // For effect

  useEffect(() => {
    const timer = setInterval(() => {
      setResonance(prev => Math.max(5, Math.min(100, prev + (Math.random() - 0.5) * 6)));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleTileClick = (q: number, r: number) => {
    setSelectedPos({ q, r });
    setGameState(prev => ({ ...prev, playerPos: { q, r } }));
    setStatusMessage(`Scrambling through the mud to ${q}, ${r}...`);
  };

  const isPlayerAtSelected = () => {
    return selectedPos?.q === gameState.playerPos.q && selectedPos?.r === gameState.playerPos.r;
  };

  const cameraTransform = useMemo(() => {
    // Current player position in screen space
    const px = (gameState.playerPos.q - gameState.playerPos.r) * (TILE_WIDTH / 2);
    const py = (gameState.playerPos.q + gameState.playerPos.r) * (TILE_HEIGHT / 2);
    // Offset to center of virtual viewport
    return { 
      x: -px + (VIEWPORT_W / 2) - (TILE_WIDTH / 2), 
      y: -py + (VIEWPORT_H / 2) - (TILE_HEIGHT / 2) 
    };
  }, [gameState.playerPos]);

  const harvest = (itemToHarvest?: WorldItem) => {
    const item = itemToHarvest || gameState.items.find(i => i.pos.q === (selectedPos?.q ?? gameState.playerPos.q) && i.pos.r === (selectedPos?.r ?? gameState.playerPos.r));
    
    if (!item) {
      setStatusMessage("Nothing left to harvest from the rotted earth here.");
      return;
    }

    const itemDef = worldData.items[item.type];

    setGameState(prev => {
      const newInventory = { ...prev.inventory };
      newInventory[item.type] = (newInventory[item.type] || 0) + 1;

      // Special chance to find bone/spores
      let secondaryMessage = "";
      if (item.type === 'MUD' && Math.random() < 0.15) {
        newInventory['BONE'] = (newInventory['BONE'] || 0) + 1;
        secondaryMessage = " Your fingers brush against something cold and hard in the silt... A Primal Bone.";
      }
      
      const isPlantMatter = item.type === 'MUSHROOM' || item.type === 'ROOTS' || item.type === 'TIMBER';
      if (isPlantMatter && Math.random() < 0.25) {
        newInventory['SPORES'] = (newInventory['SPORES'] || 0) + 1;
        secondaryMessage = " A cloud of luminescent spores clings to your sleeves. Potency gathered.";
      }

      setStatusMessage(`Extracted ${itemDef.name}.${secondaryMessage}`);

      return {
        ...prev,
        items: prev.items.filter(i => i.id !== item.id),
        inventory: newInventory
      };
    });
  };

  const getHoveredInfo = () => {
    if (!hoveredPos) return null;
    const tile = gameState.tiles.find(t => t.pos.q === hoveredPos.q && t.pos.r === hoveredPos.r);
    const item = gameState.items.find(i => i.pos.q === hoveredPos.q && i.pos.r === hoveredPos.r);
    return { tile, item };
  };

  const hoveredInfo = getHoveredInfo();

  // Floating motes that react to resonance
  const motes = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: 10 + Math.random() * 20
    }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h' && hoveredInfo?.item) {
        const isCloseEnough = Math.abs(gameState.playerPos.q - hoveredInfo.item.pos.q) <= 1 && 
                            Math.abs(gameState.playerPos.r - hoveredInfo.item.pos.r) <= 1;
        if (isCloseEnough) {
          harvest(hoveredInfo.item);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hoveredInfo, gameState.playerPos, harvest]);

  const build = (type: string) => {
    if (!selectedPos || !isPlayerAtSelected()) return;
    
    const structDef = worldData.structures[type];
    if (!structDef) return;

    setGameState(prev => {
      for (const [resId, amt] of Object.entries(structDef.costs)) {
        if ((prev.inventory[resId] || 0) < amt) {
          setStatusMessage(`Missing resources for ${structDef.name}. Need more ${worldData.items[resId].name}.`);
          return prev;
        }
      }

      const newInventory = { ...prev.inventory };
      for (const [resId, amt] of Object.entries(structDef.costs)) {
        newInventory[resId] -= amt;
      }

      const newStructure: Structure = {
        id: `struct-${Date.now()}`,
        pos: { ...selectedPos },
        type,
        progress: 1
      };

      // Special structure effect: Transforming the land
      let newTiles = prev.tiles;
      if (type === 'MOSS_CRADLE') {
        newTiles = prev.tiles.map(t => 
          (t.pos.q === selectedPos.q && t.pos.r === selectedPos.r) 
          ? { ...t, type: TileType.OVERGROWTH } 
          : t
        );
        setStatusMessage("The cradle hums. Green life surges through the silt from your planted spores.");
      } else {
        setStatusMessage(`${structDef.name} complete. The warmth is faint but real.`);
      }

      return {
        ...prev,
        inventory: newInventory,
        structures: [...prev.structures, newStructure],
        tiles: newTiles
      };
    });
  };

  return (
    <div className="relative w-full h-screen bg-[#0a0a0a] overflow-hidden font-mono text-[#f0ead6]" onWheel={handleWheel}>
      <GrittyFilter />
      <GlobalNoise />
      <AmbientAudio resonance={resonance} />
      
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #2d3822, transparent)' }}></div>

      {/* Isometric Canvas */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-auto">
        <svg 
          id="world-map-svg"
          viewBox={`0 0 ${VIEWPORT_W} ${VIEWPORT_H}`} 
          className="w-full h-full drop-shadow-[0_40px_100px_rgba(0,0,0,1)] cursor-default"
          style={{ overflow: 'visible', pointerEvents: 'auto' }}
        >
          <motion.g 
            id="camera-group"
            animate={{ 
              x: cameraTransform.x, 
              y: cameraTransform.y,
              scale: zoom
            }}
            transition={{ type: "spring", stiffness: 300, damping: 35, mass: 0.5 }}
            style={{ filter: 'url(#tile-blend)', transformOrigin: `${VIEWPORT_W/2}px ${VIEWPORT_H/2}px`, pointerEvents: 'auto' }}
          >
            {/* Unified Render Pipeline with Depth Sorting */}
            {useMemo(() => {
              const itemsByPos: Record<string, WorldItem> = {};
              gameState.items.forEach(item => {
                itemsByPos[`${item.pos.q}-${item.pos.r}`] = item;
              });

              const structuresByPos: Record<string, Structure> = {};
              gameState.structures.forEach(s => {
                structuresByPos[`${s.pos.q}-${s.pos.r}`] = s;
              });

              // Pre-render tiles independently first for background stability
              const tileElements = gameState.tiles.map(tile => (
                 <IsometricTile 
                  key={tile.id}
                  q={tile.pos.q}
                  r={tile.pos.r}
                  type={tile.type}
                  isSelected={selectedPos?.q === tile.pos.q && selectedPos?.r === tile.pos.r}
                  isHovered={hoveredPos?.q === tile.pos.q && hoveredPos?.r === tile.pos.r}
                  onClick={() => handleTileClick(tile.pos.q, tile.pos.r)}
                  onMouseEnter={() => setHoveredPos(tile.pos)}
                  onMouseLeave={() => setHoveredPos(prev => prev?.q === tile.pos.q && prev?.r === tile.pos.r ? null : prev)}
                />
              ));

              // Render occupants (nature, structures, avatar) with depth sorting
              const occupants = [
                ...gameState.tiles.map(tile => ({
                  type: 'nature',
                  id: `nature-${tile.id}`,
                  q: tile.pos.q,
                  r: tile.pos.r,
                  data: tile,
                  sortKey: tile.pos.q + tile.pos.r + 0.1
                })),
                ...gameState.structures.map(s => ({
                  type: 'structure',
                  id: `struct-${s.id}`,
                  q: s.pos.q,
                  r: s.pos.r,
                  data: s,
                  sortKey: s.pos.q + s.pos.r + 0.5
                })),
                {
                  type: 'avatar',
                  id: 'avatar',
                  q: gameState.playerPos.q,
                  r: gameState.playerPos.r,
                  data: gameState.playerPos,
                  sortKey: gameState.playerPos.q + gameState.playerPos.r + 0.9
                }
              ].sort((a, b) => a.sortKey - b.sortKey);

              return (
                <>
                  {tileElements}
                  {occupants.map(occ => {
                    if (occ.type === 'nature') {
                      const item = itemsByPos[`${occ.q}-${occ.r}`];
                      const isHovered = hoveredPos?.q === occ.q && hoveredPos?.r === occ.r;
                      const isCloseEnough = Math.abs(gameState.playerPos.q - occ.q) <= 1 && Math.abs(gameState.playerPos.r - occ.r) <= 1;
                      
                      return (
                        <NatureAsset 
                          key={occ.id} 
                          q={occ.q} 
                          r={occ.r} 
                          type={occ.data.type} 
                          itemType={item?.type}
                          isHarvestingAllowed={isHovered && isCloseEnough}
                          onHarvest={() => harvest(item)}
                          onMouseEnter={() => setHoveredPos(occ.data.pos)}
                          onMouseLeave={() => setHoveredPos(prev => prev?.q === occ.q && prev?.r === occ.r ? null : prev)}
                        />
                      );
                    }
                    if (occ.type === 'structure') {
                      const x = (occ.q - occ.r) * (TILE_WIDTH / 2);
                      const y = (occ.q + occ.r) * (TILE_HEIGHT / 2);
                      const s = occ.data as Structure;
                       return (
                        <g key={occ.id} transform={`translate(${x + TILE_WIDTH/4}, ${y - TILE_HEIGHT/2})`} style={{ filter: 'url(#ink-stipple)' }}>
                           {s.type === 'LEAN_TO' ? (
                             <g opacity="0.9">
                               <path d="M 0,32 L 16,0 L 32,32" fill="none" stroke={THEME.colors.ink} strokeWidth="3" />
                               <path d="M 4,32 L 16,8 L 28,32" fill="none" stroke={THEME.colors.nicotine} strokeWidth="1" opacity="0.4" />
                             </g>
                           ) : s.type === 'WATTLE_HUT' ? (
                             <g opacity="1">
                               <path d="M 0,32 Q 0,0 16,0 Q 32,0 32,32 Z" fill={THEME.colors.mud} stroke={THEME.colors.ink} strokeWidth="2" />
                               <path d="M 6,32 Q 6,10 16,10 Q 26,10 26,32" fill="none" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.3" />
                               <rect x="12" y="22" width="8" height="10" fill={THEME.colors.coal} />
                             </g>
                           ) : (
                             <g opacity="0.8">
                               {/* Moss Cradle visual */}
                               <ellipse cx="16" cy="24" rx="14" ry="8" fill={THEME.colors.moss} />
                               <path d="M 8,24 Q 16,10 24,24" fill="none" stroke={THEME.colors.nicotine} strokeWidth="1.5" strokeDasharray="2 2" className="animate-pulse" />
                               <circle cx="16" cy="18" r="1.5" fill="#fff" opacity="0.6">
                                 <animate attributeName="opacity" values="0.2;0.8;0.2" dur="3s" repeatCount="indefinite" />
                               </circle>
                             </g>
                           )}
                        </g>
                      );
                    }
                    return <CharacterAvatar key="avatar" pos={occ.data} />;
                  })}
                </>
              );
            }, [gameState, hoveredPos, selectedPos, zoom])}
          </motion.g>
        </svg>
      </div>

      {/* UI - Minimal Floating Overlay */}
      <div className="absolute inset-0 pointer-events-none p-10 flex flex-col justify-between">
        {/* Top Header */}
        <div className="flex justify-between items-start">
          <div className="pointer-events-auto bg-[#121212]/40 backdrop-blur-md p-4 border border-[#f0ead6]/10 rounded-sm min-w-[180px]">
            <h1 className="text-2xl font-bold uppercase tracking-[0.3em] text-[#f0ead6] leading-none mb-1">Silent Earth</h1>
            <p className="text-[8px] uppercase tracking-[0.4em] opacity-40">Protocol: Cycle 04</p>

            {hoveredInfo && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="mt-4 pt-4 border-t border-[#f0ead6]/10"
              >
                <p className="text-[7px] uppercase tracking-widest opacity-40 font-bold mb-1">Observation</p>
                <p className="text-[10px] font-black uppercase text-[#f0ead6]">
                   {hoveredInfo.item ? `Resource: ${worldData.items[hoveredInfo.item.type].name}` : `Terra: ${hoveredInfo.tile?.type}`}
                </p>
                <p className="text-[7px] opacity-40 mt-1 uppercase font-bold">
                   Sector {hoveredPos?.q}, {hoveredPos?.r}
                </p>
              </motion.div>
            )}

            {/* Legend - Detailed Field Guide */}
            <div className="mt-6">
              <p className="text-[7px] uppercase tracking-widest opacity-30 font-bold mb-3">Field Guide: Biomes</p>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 border border-white/10" style={{ backgroundColor: THEME.colors.moss }} />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase leading-none text-[#f0ead6]/80">The Bramble-Wall</span>
                    <span className="text-[6px] uppercase opacity-40 mt-1">Dense overgrowth. Rich in roots and fungal caps.</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 border border-white/10" style={{ backgroundColor: THEME.colors.mud }} />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase leading-none text-[#f0ead6]/80">Silt-Flows</span>
                    <span className="text-[6px] uppercase opacity-40 mt-1">Damp mud. May contain shards of primal bone.</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 border border-white/10" style={{ backgroundColor: '#141414' }} />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase leading-none text-[#f0ead6]/80">Barren Scars</span>
                    <span className="text-[6px] uppercase opacity-40 mt-1">Dead earth where quartz stones cluster.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-auto flex gap-4">
             <div className="bg-[#121212]/40 backdrop-blur-md p-3 border border-[#f0ead6]/10 flex items-center gap-4">
                {Object.entries(gameState.inventory).map(([id, amt]) => {
                  if (amt === 0) return null;
                  return (
                    <div key={id} className="flex flex-col items-center border-r last:border-0 border-[#f0ead6]/10 px-4 first:pl-0 last:pr-0">
                      <span className="text-[7px] opacity-40 uppercase tracking-widest mb-1">{worldData.items[id].name.split(' ')[1] || worldData.items[id].name}</span>
                      <span className="text-sm font-bold">{amt}</span>
                    </div>
                  );
                })}
             </div>
             
             <div className="bg-[#4a0e0e]/20 backdrop-blur-md p-3 border border-[#6a1a1a]/40 flex flex-col items-end min-w-[120px]" title="The shifting frequency of the Inked Woods. High resonance obscures the path.">
                <div className="flex justify-between w-full items-center mb-1">
                  <span className="text-[8px] uppercase text-[#6a1a1a] font-bold">Resonance</span>
                  <span className="text-[10px] font-bold text-[#f0ead6]">{Math.round(resonance)}%</span>
                </div>
                <div className="w-full h-0.5 bg-[#f0ead6]/10 bg-opacity-20">
                  <motion.div 
                    className="h-full bg-[#6a1a1a]"
                    animate={{ width: `${resonance}%` }}
                  />
                </div>
                <span className="text-[6px] uppercase opacity-30 mt-1">Mousewheel to Zoom</span>
             </div>
          </div>
        </div>

        {/* Bottom Interactive Zone */}
        <div className="flex justify-between items-end">
          {/* Controls & Intent */}
          <div className="flex flex-col gap-4">
             {/* Objectives */}
             <div className="bg-[#121212]/80 backdrop-blur-md p-4 border border-[#f0ead6]/10 max-w-[200px]">
                <h3 className="text-[10px] font-bold text-[#f0ead6] mb-3 uppercase tracking-widest border-b border-[#f0ead6]/10 pb-1">Protocols</h3>
                <ul className="text-[8px] space-y-2 opacity-60 uppercase tracking-tighter">
                   <li className="flex items-center gap-2"><div className="w-1 h-1 bg-[#6a1a1a]" /> Scavenge roots and mud from the silt</li>
                   <li className="flex items-center gap-2"><div className="w-1 h-1 bg-[#6a1a1a]" /> Build a Lean-to to anchor your presence</li>
                   <li className="flex items-center gap-2"><div className="w-1 h-1 bg-[#6a1a1a]" /> Upgrade to a Wattle Hut for stability</li>
                </ul>
             </div>

             {/* Feed */}
             <div className="max-w-xs bg-[#121212]/60 backdrop-blur-sm border-l-2 border-[#6a1a1a] p-4 pointer-events-auto">
                <p className="text-[10px] text-[#f0ead6] opacity-70 italic leading-snug">{statusMessage}</p>
             </div>

             {/* Manual */}
             <div className="bg-[#121212]/40 backdrop-blur-sm p-4 border border-[#f0ead6]/05 pointer-events-auto">
                <h3 className="text-[9px] font-bold text-[#f0ead6]/40 mb-2 uppercase tracking-widest">Manual</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[7px] uppercase opacity-40 font-bold">
                   <span>L-Click</span> <span className="text-right">Traverse</span>
                   <span>H-Key</span> <span className="text-right">Harvest</span>
                   <span>Hover</span> <span className="text-right">Inspect</span>
                   <span>Wheel</span> <span className="text-right">Magnify</span>
                </div>
             </div>
          </div>

          {/* Action Context */}
          {selectedPos && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pointer-events-auto bg-[#121212]/80 border border-[#f0ead6]/10 p-4 rounded-sm shadow-2xl"
              style={{ filter: 'url(#rough-edge)' }}
            >
              <div className="flex items-center justify-between mb-4 gap-8">
                <span className="text-[9px] uppercase font-bold opacity-30">Pos: {selectedPos.q},{selectedPos.r}</span>
                {isPlayerAtSelected() ? (
                   <span className="text-[8px] bg-[#6a1a1a] px-2 py-0.5 font-bold">STATIONED</span>
                ) : (
                   <span className="text-[8px] opacity-40 italic">TRAVERSING...</span>
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                {Object.values(worldData.structures).map(struct => (
                  <button 
                    key={struct.id}
                    disabled={!isPlayerAtSelected()}
                    onClick={() => build(struct.id)}
                    className="flex flex-col border border-[#f0ead6]/30 text-[#f0ead6] px-4 py-2 text-[10px] uppercase font-black hover:bg-[#f0ead6]/10 active:scale-95 disabled:opacity-20 group"
                  >
                    <div className="flex items-center gap-2">
                      <Hammer size={12} /> {struct.name}
                    </div>
                    <div className="text-[6px] opacity-0 group-hover:opacity-40 transition-opacity mt-1">
                      Cost: {Object.entries(struct.costs).map(([rid, amt]) => `${amt} ${worldData.items[rid].name}`).join(', ')}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

