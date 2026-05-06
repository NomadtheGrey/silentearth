/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameState, WorldData } from '../../types';

interface InventoryPanelProps {
  gameState: GameState;
  worldData: WorldData;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({ gameState, worldData }) => {
  return (
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
              <span className="text-[10px] font-black text-[#f0ead6]">{amt as number}</span>
              <span className="text-[6px] opacity-30 uppercase tracking-widest mt-1 font-bold">{item?.name || id}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
