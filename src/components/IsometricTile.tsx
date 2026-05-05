/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TILE_WIDTH, TILE_HEIGHT, THEME, TileType } from '../constants';

interface TileProps {
  type: TileType;
  q: number;
  r: number;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const IsometricTile: React.FC<TileProps> = ({ 
  type, q, r, isSelected, isHovered, onClick, onMouseEnter, onMouseLeave 
}) => {
  const x = (q - r) * (TILE_WIDTH / 2);
  const y = (q + r) * (TILE_HEIGHT / 2);

  const colors = {
    [TileType.ROTTED_WOOD]: THEME.colors.moss,
    [TileType.DAMP_MUD]: THEME.colors.mud,
    [TileType.OVERGROWTH]: '#141a0f',
  };

  return (
    <g 
      transform={`translate(${x}, ${y})`}
      className="cursor-pointer transition-transform duration-200"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ filter: 'url(#ink-stipple)' }}
    >
      {/* Base Diamond - No stroke, slight overlap for seamlessness */}
      <polygon
        points={`-1,${TILE_HEIGHT / 2} ${TILE_WIDTH / 2},-1 ${TILE_WIDTH + 1},${TILE_HEIGHT / 2} ${TILE_WIDTH / 2},${TILE_HEIGHT + 1}`}
        fill={colors[type]}
        className={isSelected || isHovered ? 'fill-[#6a1a1a]/40' : ''}
        stroke={isHovered ? THEME.colors.ink : 'none'}
        strokeWidth={isHovered ? "0.5" : "0"}
      />
      
      {/* Organic "Fringe" - Varied by coordinate for hand-drawn feel */}
      <path 
        d={((q+r) % 2 === 0) 
          ? `M 0,${TILE_HEIGHT/2} Q ${TILE_WIDTH/4},${TILE_HEIGHT/6} ${TILE_WIDTH/2},0` 
          : `M 0,${TILE_HEIGHT/2} Q ${TILE_WIDTH/8},${TILE_HEIGHT/3} ${TILE_WIDTH/2},0`}
        fill="none" 
        stroke={THEME.colors.ink} 
        strokeWidth="0.5" 
        opacity="0.15" 
      />
      
      {/* Texture Details - Coordinate based variations */}
      {(q * r) % 7 === 0 && (
        <path d={`M ${TILE_WIDTH/2},${TILE_HEIGHT/2} l 4,-4 m -2,0 l 0,6`} fill="none" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.2" />
      )}
      
      {type === TileType.OVERGROWTH && (
        <path 
          d={`M ${TILE_WIDTH/3},${TILE_HEIGHT/2} q 2,-8 4,0 m 6,-2 q 2,-8 4,0`} 
          fill="none" 
          stroke={THEME.colors.moss} 
          strokeWidth="1" 
          opacity="0.4" 
        />
      )}
    </g>
  );
};
