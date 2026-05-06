/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameState, GridPos, WorldData, TileDef } from '../../types';
import { ObservationPanel } from './ObservationPanel';
import { InventoryPanel } from './InventoryPanel';
import { SystemPanel } from './SystemPanel';
import { CommsFeed } from './CommsFeed';
import { ActionMenu } from './ActionMenu';

interface HUDProps {
  gameState: GameState;
  worldData: WorldData;
  hoveredPos: GridPos | null;
  hoveredInfo: any;
  selectedPos: GridPos | null;
  statusMessage: string;
  resonance: number;
  zoom: number;
  isAudioEnabled: boolean;
  audioStarted: boolean;
  onAudioToggle: () => void;
  onCraft: (recipeId: string) => void;
  onBuild: (typeId: string) => void;
  isPlayerAtSelected: boolean;
  isNearWorkstation: (pos: GridPos) => boolean;
}

export const HUD: React.FC<HUDProps> = (props) => {
  const {
    gameState,
    worldData,
    hoveredPos,
    hoveredInfo,
    selectedPos,
    statusMessage,
    resonance,
    zoom,
    isAudioEnabled,
    onAudioToggle,
    onCraft,
    onBuild,
    isPlayerAtSelected,
    isNearWorkstation
  } = props;

  return (
    <div className="absolute inset-0 pointer-events-none p-10 z-40 overflow-hidden">
      {/* TOP ROW */}
      <div className="flex justify-between items-start w-full">
        {/* Left: Identity & Observation */}
        <div className="pointer-events-auto flex flex-col gap-4 w-[240px]">
          <ObservationPanel 
            hoveredPos={hoveredPos} 
            hoveredInfo={hoveredInfo} 
            worldData={worldData} 
          />

          <div className="bg-[#121212]/90 backdrop-blur-md p-5 border border-[#f0ead6]/05 border-l-2 border-[#f0ead6]/20">
            <p className="text-[7px] uppercase tracking-widest opacity-30 font-bold mb-3">Field Guide: Terrain Classifications</p>
            <div className="grid grid-cols-1 gap-3">
              {Object.entries(worldData.tiles).map(([id, tile]) => {
                const t = tile as TileDef;
                return (
                  <div key={id} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 border border-white/10" style={{ backgroundColor: t.color }} />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase leading-none text-[#f0ead6]/80">{t.name}</span>
                      <span className="text-[6px] uppercase opacity-40 mt-0.5">{t.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center: Inventory */}
        <div className="pointer-events-auto flex flex-col items-center pt-2">
          <InventoryPanel gameState={gameState} worldData={worldData} />
        </div>

        {/* Right: System Control */}
        <SystemPanel 
          resonance={resonance} 
          zoom={zoom} 
          isAudioEnabled={isAudioEnabled} 
          onAudioToggle={onAudioToggle} 
        />
      </div>

      {/* BOTTOM ROW */}
      <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end">
        {/* Help / Controls */}
        <div className="flex flex-col gap-4 w-[280px]">
           <div className="bg-[#121212]/40 backdrop-blur-sm p-4 border border-[#f0ead6]/05 pointer-events-auto">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[7px] uppercase opacity-40 font-bold">
                 <span>[L-Click]</span> <span className="text-right">Move</span>
                 <span>[H-Key]</span> <span className="text-right">Harvest</span>
                 <span>[Wheel]</span> <span className="text-right">Zoom</span>
              </div>
           </div>
        </div>

        {/* Cinematic Comms Feed */}
        <CommsFeed message={statusMessage} />

        {/* Action Menu */}
        <div className="w-[320px]">
          {selectedPos && (
            <ActionMenu 
              selectedPos={selectedPos}
              gameState={gameState}
              worldData={worldData}
              isPlayerAtSelected={isPlayerAtSelected}
              isNearWorkstation={isNearWorkstation}
              onCraft={onCraft}
              onBuild={onBuild}
            />
          )}
        </div>
      </div>
    </div>
  );
};
