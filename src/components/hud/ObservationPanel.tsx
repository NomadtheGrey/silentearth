/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WorldData, GridPos } from '../../types';

interface ObservationPanelProps {
  hoveredPos: GridPos | null;
  hoveredInfo: any;
  worldData: WorldData;
}

export const ObservationPanel: React.FC<ObservationPanelProps> = ({ hoveredPos, hoveredInfo, worldData }) => {
  return (
    <div className="bg-[#121212]/95 backdrop-blur-xl p-6 border-l-2 border-[#f0ead6]/30 shadow-2xl">
      <h1 className="text-2xl font-bold uppercase tracking-[0.3em] text-[#f0ead6] leading-none mb-1">Silent Earth</h1>
      <p className="text-[8px] uppercase tracking-[0.4em] opacity-40">Protocol: Cycle 04</p>
      
      <div className="h-16 mt-4 pt-4 border-t border-[#f0ead6]/10 flex flex-col justify-start">
        <AnimatePresence mode="wait">
          {hoveredInfo ? (
            <motion.div 
              key="observation"
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.1 }}
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
  );
};
