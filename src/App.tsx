/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Skull, Pickaxe, Map as MapIcon, Hammer, Axe, Trees as Wood, Package, Tent, ChevronRight, Music } from 'lucide-react';
import { 
  TILE_WIDTH, 
  TILE_HEIGHT, 
  TileType, 
  ItemType, 
  StructureType, 
  THEME,
  WORLD_SIZE,
  INITIAL_RESOURCES
} from './constants';
import { WorldTile, WorldItem, Structure, GameState, GridPos, Point, WorldData } from './types';
import { GrittyFilter, GlobalNoise } from './components/Effects';
import { IsometricTile } from './components/IsometricTile';
import { AmbientAudio } from './components/AmbientAudio';
import { NatureAsset } from './components/NatureAsset';
import { StructureAsset } from './components/StructureAsset';
import { CharacterAvatar } from './components/CharacterAvatar';
import { generateWorld } from './services/worldGenerator';
import worldDataRaw from './data/world_data.json';

const worldData = worldDataRaw as WorldData;

// Virtual viewport dimensions for the SVG
const VIEWPORT_W = 860;
const VIEWPORT_H = 480;

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

  const initialGameState = useMemo<GameState>(() => generateWorld(worldData), []);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  
  const [harvestProgress, setHarvestProgress] = useState<{ id: string; val: number } | null>(null);
  const [selectedPos, setSelectedPos] = useState<GridPos | null>(null);
  const [resonance, setResonance] = useState(15);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [audioStarted, setAudioStarted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("The woods are watching. Tread lightly.");

  const audioRef = React.useRef<{ init: () => void }>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setResonance(prev => Math.max(5, Math.min(100, prev + (Math.random() - 0.5) * 6)));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleTileClick = (q: number, r: number) => {
    if (isAudioEnabled && !audioStarted) {
      if ((window as any).initGameAudio) {
        (window as any).initGameAudio();
        setAudioStarted(true);
      }
    }
    setSelectedPos({ q, r });
    setGameState(prev => ({ ...prev, playerPos: { q, r } }));
    setHarvestProgress(null);
    setStatusMessage(`Scrambling through the mud to ${q}, ${r}...`);
  };

  const isPlayerAtSelected = () => {
    return selectedPos?.q === gameState.playerPos.q && selectedPos?.r === gameState.playerPos.r;
  };

  const isNearWorkstation = (pos: GridPos) => {
    return gameState.items.some(i => 
      worldData.items[i.type]?.isWorkstation && 
      Math.abs(i.pos.q - pos.q) <= 1 && 
      Math.abs(i.pos.r - pos.r) <= 1
    );
  };

  const craftHand = (recipeId: string) => {
    const costs: Record<string, number> = recipeId === 'TWINED_CORDAGE' ? { 'TENDER_VINES': 2 } : { 'SNAP_WOOD': 2 };
    const name = recipeId === 'TWINED_CORDAGE' ? 'Twined Cordage' : 'Dry Kindling';

    setGameState(prev => {
      for (const [resId, amt] of Object.entries(costs)) {
        if ((prev.inventory[resId] || 0) < amt) {
          setStatusMessage(`Need more materials to hand-craft ${name}.`);
          return prev;
        }
      }
      const newInventory = { ...prev.inventory };
      for (const [resId, amt] of Object.entries(costs)) {
        newInventory[resId] -= amt;
      }
      newInventory[recipeId] = (newInventory[recipeId] || 0) + 1;
      setStatusMessage(`You sit for a moment, weaving ${name.toLowerCase()} by the candle's glow.`);
      return { ...prev, inventory: newInventory };
    });
  };

  const harvest = useCallback((itemToHarvest?: WorldItem) => {
    const item = itemToHarvest || gameState.items.find(i => i.pos.q === (selectedPos?.q ?? gameState.playerPos.q) && i.pos.r === (selectedPos?.r ?? gameState.playerPos.r));
    
    if (!item) {
      setStatusMessage("Nothing left to harvest from the rotted earth here.");
      return;
    }

    const itemDef = worldData.items[item.type];
    if (!itemDef) return;

    if (itemDef.isWorkstation && itemDef.successMessage) {
      setStatusMessage(itemDef.successMessage);
      return;
    }

    if (itemDef.harvestStep) {
      const currentProgress = harvestProgress?.id === item.id ? harvestProgress.val : 0;
      if (currentProgress < 0.9) {
        setStatusMessage(itemDef.struggleMessage || `Harvesting ${itemDef.name}...`);
        setHarvestProgress({ id: item.id, val: currentProgress + itemDef.harvestStep });
        return;
      }
    }

    setGameState(prev => {
      const newInventory = { ...prev.inventory };
      newInventory[item.type] = (newInventory[item.type] || 0) + 1;

      let secondaryMessage = "";
      if (itemDef.secondaryDrops) {
        itemDef.secondaryDrops.forEach(drop => {
          if (Math.random() < drop.chance) {
            newInventory[drop.type] = (newInventory[drop.type] || 0) + 1;
            secondaryMessage += ` ${drop.message}`;
          }
        });
      }

      const successMsg = itemDef.successMessage || `Extracted ${itemDef.name}.`;
      setStatusMessage(`${successMsg}${secondaryMessage}`);
      setHarvestProgress(null);

      return {
        ...prev,
        items: prev.items.filter(i => i.id !== item.id),
        inventory: newInventory
      };
    });
  }, [gameState.items, gameState.playerPos, selectedPos, harvestProgress]);

  const cameraTransform = useMemo(() => {
    const px = (gameState.playerPos.q - gameState.playerPos.r) * (TILE_WIDTH / 2);
    const py = (gameState.playerPos.q + gameState.playerPos.r) * (TILE_HEIGHT / 2);
    return { 
      x: -px + (VIEWPORT_W / 2) - (TILE_WIDTH / 2), 
      y: -py + (VIEWPORT_H / 2) - (TILE_HEIGHT / 2) 
    };
  }, [gameState.playerPos]);

  const hoveredInfo = useMemo(() => {
    if (!hoveredPos) return null;
    const tile = gameState.tiles.find(t => t.pos.q === hoveredPos.q && t.pos.r === hoveredPos.r);
    const item = gameState.items.find(i => i.pos.q === hoveredPos.q && i.pos.r === hoveredPos.r);
    return { tile, item };
  }, [hoveredPos, gameState.tiles, gameState.items]);

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

    const tileAtPos = gameState.tiles.find(t => t.pos.q === selectedPos.q && t.pos.r === selectedPos.r);
    if (tileAtPos?.type === TileType.SHALLOW_CREEK) {
      setStatusMessage("The ground is too water-logged here to support this structure.");
      return;
    }

    if (structDef.requiresWorkstation && !isNearWorkstation(selectedPos)) {
      setStatusMessage(`Constructing a ${structDef.name} requires the stability of a nearby workstation.`);
      return;
    }

    setGameState(prev => {
      for (const [resId, amt] of Object.entries(structDef.costs)) {
        if ((prev.inventory[resId] || 0) < amt) {
          setStatusMessage(`Missing resources for ${structDef.name}.`);
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

      let newTiles = prev.tiles;
      if (type === 'MOSS_CRADLE') {
        newTiles = prev.tiles.map(t => 
          (t.pos.q === selectedPos.q && t.pos.r === selectedPos.r) 
          ? { ...t, type: TileType.TANGLED_DEEPWOOD } 
          : t
        );
        setStatusMessage("The cradle hums. Green life surges through the forest.");
      } else {
        setStatusMessage(`${structDef.name} complete.`);
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
    <div className="relative w-full h-screen bg-[#121612] overflow-hidden font-mono text-[#f0ead6]" onWheel={handleWheel}>
      <GrittyFilter />
      <GlobalNoise />
      <AmbientAudio resonance={resonance} isEnabled={isAudioEnabled} onInit={() => setAudioStarted(true)} />
      
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #2d3822, transparent)' }}></div>

      {/* Isometric Canvas */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-auto">
        <svg 
          id="world-map-svg"
          viewBox={`0 0 ${VIEWPORT_W} ${VIEWPORT_H}`} 
          className="w-full h-full drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-default"
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
                          worldData={worldData}
                        />
                      );
                    }
                    if (occ.type === 'structure') {
                       return (
                        <StructureAsset 
                          key={occ.id} 
                          q={occ.q} 
                          r={occ.r} 
                          structure={occ.data as Structure} 
                        />
                      );
                    }
                    return <CharacterAvatar key="avatar" pos={occ.data} />;
                  })}
                </>
              );
            }, [gameState, hoveredPos, selectedPos, zoom])}
          </motion.g>
        </svg>

        {/* Candle Light Overlay - Fixed Position Layer */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${VIEWPORT_W} ${VIEWPORT_H}`}>
            {(() => {
              const px = (gameState.playerPos.q - gameState.playerPos.r) * (TILE_WIDTH / 2);
              const py = (gameState.playerPos.q + gameState.playerPos.r) * (TILE_HEIGHT / 2);
              const screenX = px + cameraTransform.x + TILE_WIDTH / 2;
              const screenY = py + cameraTransform.y;

              return (
                <g>
                  <defs>
                    <mask id="light-mask">
                      <rect width={VIEWPORT_W} height={VIEWPORT_H} fill="white" />
                      {/* Inner circle of mask (the hole) - expanded radius for better visibility */}
                      <circle cx={screenX} cy={screenY} r="400" fill="black" style={{ filter: 'blur(120px)' }} />
                    </mask>
                  </defs>
                  <rect 
                    width={VIEWPORT_W} 
                    height={VIEWPORT_H} 
                    fill="#000" 
                    fillOpacity="0.05" 
                    mask="url(#light-mask)"
                  />
                  {/* Resonance Halo Ring - made even more subtle */}
                  <circle 
                    cx={screenX} 
                    cy={screenY} 
                    r="320" 
                    fill="none"
                    stroke="#f0ead6"
                    strokeWidth="1"
                    strokeDasharray="2 12"
                    opacity="0.1"
                  />
                  {/* Warm center glow */}
                  <circle 
                    cx={screenX} 
                    cy={screenY} 
                    r="180" 
                    fill="url(#candle-radial)" 
                    opacity="0.5"
                    style={{ mixBlendMode: 'screen' }}
                  />
                  <defs>
                    <radialGradient id="candle-radial">
                      <stop offset="0%" stopColor="#f0ead6" stopOpacity="0.5" />
                      <stop offset="60%" stopColor="#f0ead6" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* UI - Minimal Floating Overlay */}
      <div className="absolute inset-0 pointer-events-none p-10 z-40 overflow-hidden">
        {/* TOP ROW: Identity & Observation (Left), Inventory (Center), System (Right) */}
        <div className="flex justify-between items-start w-full">
          {/* Identity & Observation */}
          <div className="pointer-events-auto flex flex-col gap-4 w-[240px]">
            <div className="bg-[#121212]/95 backdrop-blur-xl p-6 border-l-2 border-[#f0ead6]/30 shadow-2xl">
              <h1 className="text-2xl font-bold uppercase tracking-[0.3em] text-[#f0ead6] leading-none mb-1">Silent Earth</h1>
              <p className="text-[8px] uppercase tracking-[0.4em] opacity-40">Protocol: Cycle 04</p>
              
              {/* Reserved slot for Observation to prevent jumping */}
              <div className="h-16 mt-4 pt-4 border-t border-[#f0ead6]/10 flex flex-col justify-start">
                <AnimatePresence mode="wait">
                  {hoveredInfo ? (
                    <motion.div 
                      key="observation"
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                    >
                      <p className="text-[7px] uppercase tracking-widest opacity-40 font-bold mb-1">Observation</p>
                      <p className="text-[10px] font-black uppercase text-[#f0ead6] truncate">
                         {hoveredInfo.item ? worldData.items[hoveredInfo.item.type]?.name : worldData.tiles[hoveredInfo.tile?.type || '']?.name || 'Unknown'}
                      </p>
                      <p className="text-[7px] opacity-40 mt-1 uppercase font-bold">
                         Sector {hoveredPos?.q}, {hoveredPos?.r}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.p 
                      key="no-obs"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.2 }}
                      className="text-[7px] uppercase tracking-[0.2em] italic self-center mt-2"
                    >
                      Scanning Terrain...
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Field Guide - Stable positioning below fixed Observation slot */}
            <div className="bg-[#121212]/90 backdrop-blur-md p-5 border border-[#f0ead6]/05 border-l-2 border-[#f0ead6]/20">
              <p className="text-[7px] uppercase tracking-widest opacity-30 font-bold mb-3">Field Guide: Terrain Classifications</p>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(worldData.tiles).map(([id, tile]) => (
                  <div key={id} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 border border-white/10" style={{ backgroundColor: tile.color }} />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase leading-none text-[#f0ead6]/80">{tile.name}</span>
                      <span className="text-[6px] uppercase opacity-40 mt-0.5">{tile.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center: Inventory Panel */}
          <div className="pointer-events-auto flex flex-col items-center pt-2">
            <div className="bg-[#121212]/95 backdrop-blur-xl px-1 py-1 border border-[#f0ead6]/10 flex items-center shadow-2xl">
               <div className="flex bg-[#121212] border border-[#f0ead6]/05 p-3 gap-6 shadow-inner">
                  {Object.entries(gameState.inventory).filter(([_, amt]) => (amt as number) > 0).length === 0 && (
                    <span className="text-[7px] uppercase tracking-[0.3em] opacity-20 px-10 py-1 font-bold">Cargo Hold Empty</span>
                  )}
                  {Object.entries(gameState.inventory).map(([id, amt]) => {
                    if (amt === 0) return null;
                    const item = worldData.items[id];
                    return (
                      <div key={id} className="flex flex-col items-center min-w-[50px] border-r last:border-0 border-[#f0ead6]/05 px-4 last:pr-2 first:pl-2">
                        <span className="text-[10px] font-black text-[#f0ead6]">{amt}</span>
                        <span className="text-[6px] opacity-30 uppercase tracking-widest mt-1 font-bold">{item?.name || id}</span>
                      </div>
                    );
                  })}
               </div>
            </div>
          </div>

          {/* System Control & Current Ops (Right) */}
          <div className="pointer-events-auto flex flex-col items-end gap-4 w-[240px]">
             {/* Protocols / Objectives - Moved here to prevent overlap */}
             <div className="bg-[#121212]/95 backdrop-blur-xl p-5 border-r-2 border-[#f0ead6]/30 shadow-2xl w-full">
                <h3 className="text-[9px] font-black text-[#f0ead6] mb-3 uppercase tracking-widest flex items-center justify-end gap-2">
                   Current Ops <Package size={10} className="text-[#6a1a1a]" />
                </h3>
                <ul className="text-[8px] space-y-2 opacity-50 uppercase tracking-tighter text-right">
                   <li>Harvest heavy oak & vines for refined structures</li>
                   <li>Locate an Old Stump for stable construction</li>
                </ul>
             </div>

             <div className="bg-[#121212]/95 backdrop-blur-xl p-4 border-r-2 border-[#6a1a1a]/50 shadow-2xl flex flex-col items-end w-full">
                <div className="flex justify-between w-full items-center mb-2">
                  <span className="text-[8px] uppercase text-[#6a1a1a] font-black tracking-[0.1em]">Signal Resonance</span>
                  <span className="text-[11px] font-black text-[#f0ead6]">{Math.round(resonance)}%</span>
                </div>
                <div className="w-full h-1 bg-[#121212] border border-[#f0ead6]/10 overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-transparent to-[#6a1a1a]"
                    animate={{ width: `${resonance}%`, opacity: [0.3, 0.8, 0.3] }}
                    transition={{ opacity: { duration: 2, repeat: Infinity } }}
                  />
                </div>
                <div className="mt-3 flex gap-2 w-full">
                  <button 
                    onClick={() => {
                      if (!audioStarted && (window as any).initGameAudio) {
                        (window as any).initGameAudio();
                        setAudioStarted(true);
                      }
                      setIsAudioEnabled(!isAudioEnabled);
                    }}
                    className={`flex-1 py-1.5 text-[8px] uppercase font-black tracking-[0.1em] flex items-center justify-center gap-2 border transition-all ${
                      isAudioEnabled ? "bg-[#f0ead6] text-[#121212] border-[#f0ead6]" : "bg-[#121212]/80 text-[#f0ead6]/40 border-[#f0ead6]/10"
                    }`}
                  >
                    <Music size={10} /> {isAudioEnabled ? "Audio ON" : "Audio OFF"}
                  </button>
                  <div className="bg-[#f0ead6]/05 border border-[#f0ead6]/10 px-2 py-1 flex items-center justify-center">
                    <span className="text-[6px] uppercase opacity-30 font-bold">x{Math.floor(zoom * 10) / 10}</span>
                  </div>
                </div>
             </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end">
          {/* Controls & Intent */}
          <div className="flex flex-col gap-4 w-[280px]">
             {/* Manual */}
             <div className="bg-[#121212]/40 backdrop-blur-sm p-4 border border-[#f0ead6]/05 pointer-events-auto">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[7px] uppercase opacity-40 font-bold">
                   <span>[L-Click]</span> <span className="text-right">Move</span>
                   <span>[H-Key]</span> <span className="text-right">Harvest</span>
                   <span>[Wheel]</span> <span className="text-right">Zoom</span>
                </div>
             </div>
          </div>

          {/* Cinematic Comms Feed - Centered Overlay */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 mb-8 pointer-events-none w-full max-w-xl text-center">
             <AnimatePresence mode="wait">
                <motion.p 
                  key={statusMessage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 0.8, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-[12px] text-[#f0ead6] font-medium leading-relaxed italic tracking-wide"
                  style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}
                >
                  "{statusMessage}"
                </motion.p>
             </AnimatePresence>
          </div>

          {/* Action Context Menu */}
          <div className="w-[320px]">
            {selectedPos && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="pointer-events-auto bg-[#121212]/95 backdrop-blur-xl border border-[#f0ead6]/10 p-6 shadow-2xl relative"
              >
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#f0ead6]/20 to-transparent" />
                
                <div className="flex items-center justify-between mb-5">
                  <div className="flex flex-col">
                    <span className="text-[7px] uppercase font-bold opacity-30">Coordinate</span>
                    <span className="text-xs font-black text-[#f0ead6]">{selectedPos.q} : {selectedPos.r}</span>
                  </div>
                  {isPlayerAtSelected() ? (
                    <div className="flex items-center gap-2 px-2 py-1 bg-[#6a1a1a]/20 border border-[#6a1a1a]/40">
                      <div className="w-1.5 h-1.5 bg-[#6a1a1a] animate-pulse" />
                      <span className="text-[8px] font-black text-[#6a1a1a] uppercase">Stationed</span>
                    </div>
                  ) : (
                    <span className="text-[8px] opacity-40 italic tracking-widest uppercase animate-pulse">Relocating...</span>
                  )}
                </div>
                
                <div className="flex flex-col gap-3">
                  {/* Quick Refine */}
                  <div className="grid grid-cols-2 gap-2 pb-3 border-b border-[#f0ead6]/05">
                    <button 
                      onClick={() => craftHand('TWINED_CORDAGE')}
                      disabled={!isPlayerAtSelected() || (gameState.inventory['TENDER_VINES'] || 0) < 2}
                      className="group flex flex-col items-center border border-[#f0ead6]/10 bg-[#f0ead6]/05 p-2 hover:bg-[#f0ead6]/10 disabled:opacity-20 transition-all"
                    >
                      <span className="text-[8px] font-black uppercase text-[#f0ead6]">Twine Cord</span>
                      <span className="text-[6px] opacity-30 mt-1 uppercase">2x Vines</span>
                    </button>
                    <button 
                      onClick={() => craftHand('DRY_KINDLING')}
                      disabled={!isPlayerAtSelected() || (gameState.inventory['SNAP_WOOD'] || 0) < 2}
                      className="group flex flex-col items-center border border-[#f0ead6]/10 bg-[#f0ead6]/05 p-2 hover:bg-[#f0ead6]/10 disabled:opacity-20 transition-all"
                    >
                      <span className="text-[8px] font-black uppercase text-[#f0ead6]">Refine Wood</span>
                      <span className="text-[6px] opacity-30 mt-1 uppercase">2x Snap</span>
                    </button>
                  </div>

                  {/* Structural Build */}
                  <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                    {Object.values(worldData.structures).map(struct => {
                       const isCreekTile = gameState.tiles.find(t => t.pos.q === selectedPos.q && t.pos.r === selectedPos.r)?.type === TileType.SHALLOW_CREEK;
                       const needsStump = struct.requiresWorkstation && !isNearWorkstation(selectedPos);
                       const isBlocked = isCreekTile || needsStump;

                       return (
                        <button 
                          key={struct.id}
                          disabled={!isPlayerAtSelected() || isBlocked}
                          onClick={() => build(struct.id)}
                          className="flex flex-col items-start border border-[#f0ead6]/20 bg-transparent px-4 py-3 hover:bg-[#f0ead6]/05 active:bg-[#f0ead6]/10 disabled:opacity-20 transition-all group"
                        >
                          <div className="flex items-center gap-3 w-full">
                            <Hammer size={12} className="opacity-40 group-hover:opacity-100" />
                            <span className="text-[10px] font-black uppercase tracking-wider">{struct.name}</span>
                            {isBlocked && (
                               <span className="ml-auto text-[7px] text-[#6a1a1a] font-bold uppercase">
                                 {isCreekTile ? "Waterlogged" : "Need Stump"}
                               </span>
                            )}
                          </div>
                          <div className="text-[7px] uppercase mt-2 font-bold flex gap-2 flex-wrap">
                            {Object.entries(struct.costs).map(([rid, amt]) => (
                               <span key={rid} className={`flex items-center gap-1 ${(gameState.inventory[rid] || 0) >= amt ? "text-[#f0ead6]/40" : "text-[#6a1a1a]"}`}>
                                 {amt} {worldData.items[rid]?.name || rid}
                               </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

