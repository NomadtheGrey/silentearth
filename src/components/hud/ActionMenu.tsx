/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Hammer } from 'lucide-react';
import { GameState, GridPos, WorldData, StructureDef } from '../../types';
import { TileType } from '../../constants';

interface ActionMenuProps {
  selectedPos: GridPos;
  gameState: GameState;
  worldData: WorldData;
  isPlayerAtSelected: boolean;
  isNearWorkstation: (pos: GridPos) => boolean;
  onCraft: (recipeId: string) => void;
  onBuild: (typeId: string) => void;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  selectedPos,
  gameState,
  worldData,
  isPlayerAtSelected,
  isNearWorkstation,
  onCraft,
  onBuild
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className="pointer-events-auto bg-[#121212]/95 backdrop-blur-xl border border-[#f0ead6]/10 p-6 shadow-2xl relative"
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#f0ead6]/20 to-transparent" />
      
      <div className="flex items-center justify-between mb-5">
        <div className="flex flex-col">
          <span className="text-[7px] uppercase font-bold opacity-30">Coordinate</span>
          <span className="text-xs font-black text-[#f0ead6]">{selectedPos.q} : {selectedPos.r}</span>
        </div>
        {isPlayerAtSelected ? (
          <div className="flex items-center gap-2 px-2 py-1 bg-[#6a1a1a]/20 border border-[#6a1a1a]/40">
            <div className="w-1.5 h-1.5 bg-[#6a1a1a] animate-pulse" />
            <span className="text-[8px] font-black text-[#6a1a1a] uppercase">Stationed</span>
          </div>
        ) : (
          <span className="text-[8px] opacity-40 italic tracking-widest uppercase animate-pulse">Relocating...</span>
        )}
      </div>
      
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 pb-3 border-b border-[#f0ead6]/05">
          <button 
            onClick={() => onCraft('TWINED_CORDAGE')}
            disabled={!isPlayerAtSelected || (gameState.inventory['TENDER_VINES'] || 0) < 2}
            className="group flex flex-col items-center border border-[#f0ead6]/10 bg-[#f0ead6]/05 p-2 hover:bg-[#f0ead6]/10 disabled:opacity-20 transition-all"
          >
            <span className="text-[8px] font-black uppercase text-[#f0ead6]">Twine Cord</span>
            <span className="text-[6px] opacity-30 mt-1 uppercase">2x Vines</span>
          </button>
          <button 
            onClick={() => onCraft('DRY_KINDLING')}
            disabled={!isPlayerAtSelected || (gameState.inventory['SNAP_WOOD'] || 0) < 2}
            className="group flex flex-col items-center border border-[#f0ead6]/10 bg-[#f0ead6]/05 p-2 hover:bg-[#f0ead6]/10 disabled:opacity-20 transition-all"
          >
            <span className="text-[8px] font-black uppercase text-[#f0ead6]">Refine Wood</span>
            <span className="text-[6px] opacity-30 mt-1 uppercase">2x Snap</span>
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
          {(Object.values(worldData.structures) as StructureDef[]).map(struct => {
             const tileAtPos = gameState.tiles.find(t => t.pos.q === selectedPos.q && t.pos.r === selectedPos.r);
             const isCreekTile = tileAtPos?.type === TileType.SHALLOW_CREEK;
             const needsStump = struct.requiresWorkstation && !isNearWorkstation(selectedPos);
             const isBlocked = isCreekTile || needsStump;
             const canAfford = Object.entries(struct.costs).every(([rid, amt]) => (gameState.inventory[rid] || 0) >= (amt as number));
             const isConstructible = isPlayerAtSelected && !isBlocked && canAfford;

             return (
              <button 
                key={struct.id}
                disabled={!isConstructible}
                onClick={() => onBuild(struct.id)}
                className="flex flex-col items-start border border-[#f0ead6]/20 bg-transparent px-3 py-2.5 hover:bg-[#f0ead6]/05 active:bg-[#f0ead6]/10 disabled:opacity-30 transition-all group w-full text-left"
              >
                <div className="flex items-center gap-2 w-full">
                  <Hammer size={12} className={isConstructible ? "text-[#f0ead6] opacity-80 group-hover:opacity-100" : "opacity-30"} />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#f0ead6]">{struct.name}</span>
                  {isBlocked ? (
                     <span className="ml-auto text-[7px] text-[#a82424] font-bold uppercase tracking-wider">
                       {isCreekTile ? "Waterlogged" : "Need Workstation"}
                     </span>
                  ) : !canAfford ? (
                     <span className="ml-auto text-[7px] text-[#d4b768] font-bold uppercase tracking-wider opacity-80">
                       Need Materials
                     </span>
                  ) : (
                     <span className="ml-auto text-[7px] text-[#86ae53] font-black uppercase tracking-wider animate-pulse">
                       Erect Shelter [Build]
                     </span>
                  )}
                </div>

                {/* Structure Description */}
                <p className="text-[7px] text-[#f0ead6]/60 mt-1 leading-snug font-medium">
                  {struct.description}
                </p>

                {/* Costs */}
                <div className="text-[7px] uppercase mt-2 font-bold flex gap-2 flex-wrap">
                  {Object.entries(struct.costs).map(([rid, amt]) => {
                     const has = gameState.inventory[rid] || 0;
                     const req = amt as number;
                     const isEnough = has >= req;
                     return (
                       <span key={rid} className={`flex items-center gap-1 ${isEnough ? "text-[#86ae53]" : "text-[#a82424]"}`}>
                         {has}/{req} {worldData.items[rid]?.name || rid}
                       </span>
                     );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};
