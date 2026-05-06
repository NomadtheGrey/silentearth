/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Package, Music } from 'lucide-react';

interface SystemPanelProps {
  resonance: number;
  zoom: number;
  isAudioEnabled: boolean;
  onAudioToggle: () => void;
}

export const SystemPanel: React.FC<SystemPanelProps> = ({
  resonance,
  zoom,
  isAudioEnabled,
  onAudioToggle
}) => {
  return (
    <div className="pointer-events-auto flex flex-col items-end gap-4 w-[240px]">
      <div className="bg-[#121212]/95 backdrop-blur-xl p-5 border-r-2 border-[#f0ead6]/30 shadow-2xl w-full text-right">
        <h3 className="text-[9px] font-black text-[#f0ead6] mb-3 uppercase tracking-widest flex items-center justify-end gap-2">
          Current Ops <Package size={10} className="text-[#6a1a1a]" />
        </h3>
        <ul className="text-[8px] space-y-2 opacity-50 uppercase tracking-tighter">
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
            onClick={onAudioToggle}
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
  );
};
