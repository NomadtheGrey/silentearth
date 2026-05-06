/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { GridPos } from '../types';
import { TILE_WIDTH, TILE_HEIGHT, THEME } from '../constants';

import { gridToScreen } from '../utils/isoMath';

interface CharacterAvatarProps {
  q: number;
  r: number;
  character: GridPos;
}

export const CharacterAvatar: React.FC<CharacterAvatarProps> = ({ q, r }) => {
  const { x, y } = gridToScreen(q, r);

  return (
    <motion.g 
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 600, damping: 45 }}
      className="pointer-events-none"
    >
      <g transform={`translate(${TILE_WIDTH / 2 - 10}, ${-36})`}>
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
