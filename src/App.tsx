/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TILE_WIDTH, 
  TILE_HEIGHT, 
  TileType
} from './constants';
import { WorldTile, WorldItem, Structure, GameState, GridPos, Point, WorldData } from './types';
import { useAtmosphere } from './hooks/useAtmosphere';
import { gridToScreen, calculateDepth } from './utils/isoMath';
import { GrittyFilter, GlobalNoise } from './components/Effects';
import { IsometricTile } from './components/IsometricTile';
import { NatureAsset } from './components/NatureAsset';
import { StructureAsset } from './components/StructureAsset';
import { CharacterAvatar } from './components/CharacterAvatar';
import { HUD } from './components/hud';
import { generateWorld } from './services/worldGenerator';
import worldDataRaw from './data/world_data.json';

const worldData = worldDataRaw as WorldData;

// Virtual viewport dimensions for the SVG
const VIEWPORT_W = 860;
const VIEWPORT_H = 480;

export default function App() {
  const [zoom, setZoom] = useState(1);
  const [hoveredPos, setHoveredPos] = useState<GridPos | null>(null);

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

  const { init: initAudio } = useAtmosphere();

  useEffect(() => {
    const timer = setInterval(() => {
      setResonance(prev => Math.max(5, Math.min(100, prev + (Math.random() - 0.5) * 6)));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleTileClick = (q: number, r: number) => {
    if (isAudioEnabled && !audioStarted) {
      initAudio();
      setAudioStarted(true);
    }
    setSelectedPos({ q, r });
    setGameState(prev => ({ ...prev, playerPos: { q, r } }));
    setHarvestProgress(null);
    setStatusMessage(`Scrambling through the mud to ${q}, ${r}...`);
  };

  const isPlayerAtSelected = useCallback(() => {
    return selectedPos?.q === gameState.playerPos.q && selectedPos?.r === gameState.playerPos.r;
  }, [selectedPos, gameState.playerPos]);

  const isNearWorkstation = useCallback((pos: GridPos) => {
    return gameState.items.some(i => 
      worldData.items[i.type]?.isWorkstation && 
      Math.abs(i.pos.q - pos.q) <= 1 && 
      Math.abs(i.pos.r - pos.r) <= 1
    );
  }, [gameState.items]);

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
            transition={{ type: "spring", stiffness: 450, damping: 45, mass: 0.5 }}
            style={{ transformOrigin: `${VIEWPORT_W/2}px ${VIEWPORT_H/2}px`, pointerEvents: 'auto' }}
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
              const tileElements = (
                <g id="tiles-layer" style={{ filter: 'url(#ink-stipple)' }}>
                  {gameState.tiles.map(tile => (
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
                  ))}
                </g>
              );

              // Render occupants (nature, structures, avatar) with depth sorting
              const occupantList = [
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
                  <g id="occupants-layer" style={{ filter: 'url(#ink-stipple)' }}>
                    {occupantList.map(occ => {
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
                      return <CharacterAvatar key="avatar" q={occ.q} r={occ.r} character={occ.data} />;
                    })}
                  </g>
                </>
              );
            }, [gameState, hoveredPos, selectedPos, zoom, harvest])}
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
                    r={resonance * 1.5 + 80}
                    fill="none"
                    stroke="#f0ead6"
                    strokeWidth="0.5"
                    strokeDasharray="2 4"
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

      {/* UI - Minimal Floating Overlay - MOVED TO HUD */}
      <HUD 
        gameState={gameState}
        worldData={worldData}
        hoveredPos={hoveredPos}
        hoveredInfo={hoveredInfo}
        selectedPos={selectedPos}
        statusMessage={statusMessage}
        resonance={resonance}
        zoom={zoom}
        isAudioEnabled={isAudioEnabled}
        audioStarted={audioStarted}
        onAudioToggle={() => {
          if (!audioStarted) {
            initAudio();
            setAudioStarted(true);
          }
          setIsAudioEnabled(!isAudioEnabled);
        }}
        onCraft={craftHand}
        onBuild={build}
        isPlayerAtSelected={isPlayerAtSelected()}
        isNearWorkstation={isNearWorkstation}
      />
    </div>
  );
}

