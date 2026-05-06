/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TILE_WIDTH, TILE_HEIGHT, THEME } from '../constants';
import { Structure } from '../types';
import { gridToScreen } from '../utils/isoMath';

interface StructureAssetProps {
  q: number;
  r: number;
  structure: Structure;
}

export const StructureAsset: React.FC<StructureAssetProps> = ({ q, r, structure: s }) => {
  const { x, y } = gridToScreen(q, r);

  return (
    <g transform={`translate(${x + TILE_WIDTH/4}, ${y - TILE_HEIGHT/2})`}>
       {/* Structure Shadow */}
       <ellipse cx="16" cy="35" rx="12" ry="4" fill="black" opacity="0.2" style={{ filter: 'blur(4px)' }} />

       {s.type === 'LEAN_TO' ? (
         <g opacity="0.9">
           <path d="M 0,32 L 16,0 L 32,32 Z" fill="url(#stipple-pattern)" opacity="0.2" />
           <path d="M 0,32 L 16,0 L 32,32" fill="none" stroke={THEME.colors.ink} strokeWidth="3" />
           <path d="M 4,32 L 16,8 L 28,32" fill="none" stroke={THEME.colors.nicotine} strokeWidth="1" opacity="0.4" />
         </g>
       ) : s.type === 'WATTLE_HUT' ? (
         <g opacity="1">
           <path d="M 0,32 Q 0,0 16,0 Q 32,0 32,32 Z" fill={THEME.colors.mud} stroke={THEME.colors.ink} strokeWidth="2" />
           <path d="M 0,32 Q 0,0 16,0 Q 32,0 32,32 Z" fill="url(#stipple-pattern)" opacity="0.3" style={{ mixBlendMode: 'multiply' }} />
           <path d="M 6,32 Q 6,10 16,10 Q 26,10 26,32" fill="none" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.3" />
           <rect x="12" y="22" width="8" height="10" fill={THEME.colors.coal} />
         </g>
       ) : s.type === 'WOVEN_COTTAGE' ? (
          <g opacity="1">
            <rect x="2" y="10" width="28" height="22" fill={THEME.colors.coal} stroke={THEME.colors.ink} strokeWidth="2" />
            <path d="M -2,12 L 16,-4 L 34,12" fill={THEME.colors.moss} stroke={THEME.colors.ink} strokeWidth="2" />
            <rect x="12" y="20" width="8" height="12" fill={THEME.colors.ink} />
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
};
