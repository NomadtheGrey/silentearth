/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { TILE_WIDTH, TILE_HEIGHT, THEME, TileType } from '../constants';
import { WorldData } from '../types';
import worldDataRaw from '../data/world_data.json';

const worldData = worldDataRaw as WorldData;

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

  const tileDef = worldData.tiles[type];
  const baseColor = tileDef?.color || THEME.colors.coal;

  return (
    <g 
      transform={`translate(${x}, ${y})`}
      className="cursor-pointer transition-opacity duration-300"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ filter: 'url(#ink-stipple)' }}
    >
      {/* Base Organic Shape - Replaces rigid polygon with a wobbly diamond */}
      <path
        d={`
          M -1,${TILE_HEIGHT / 2} 
          Q ${TILE_WIDTH / 4},${-2} ${TILE_WIDTH / 2},-1 
          Q ${TILE_WIDTH * 0.75},${-2} ${TILE_WIDTH + 1},${TILE_HEIGHT / 2} 
          Q ${TILE_WIDTH * 0.75},${TILE_HEIGHT + 2} ${TILE_WIDTH / 2},${TILE_HEIGHT + 1} 
          Q ${TILE_WIDTH / 4},${TILE_HEIGHT + 2} -1,${TILE_HEIGHT / 2}
          Z
        `}
        fill={baseColor}
        className={isSelected || isHovered ? 'fill-[#6a1a1a]/40' : ''}
        stroke={isHovered ? THEME.colors.ink : 'none'}
        strokeWidth={isHovered ? "0.5" : "0"}
      />
      
      {/* Edge Blending Light/Shadow Layer */}
      <path
        d={`M 0,${TILE_HEIGHT / 2} L ${TILE_WIDTH / 2},0 L ${TILE_WIDTH},${TILE_HEIGHT / 2} L ${TILE_WIDTH / 2},${TILE_HEIGHT} Z`}
        fill="none"
        stroke="black"
        strokeWidth="2"
        opacity="0.1"
        style={{ filter: 'blur(2px)' }}
      />

      {/* Surface Variety - "Blotches" that bridge tile boundaries */}
      {(q + r) % 3 === 0 && (
         <circle cx={TILE_WIDTH/2 + (q % 5)} cy={TILE_HEIGHT/2 + (r % 3)} r={4 + (q % 3)} fill="black" opacity="0.05" />
      )}

      {/* Water Effect for Shallow Creek */}
      {type === TileType.SHALLOW_CREEK && (
        <g opacity="0.4">
          <motion.path 
            d={`M 10,${TILE_HEIGHT/2} h ${TILE_WIDTH-20}`}
            stroke="white"
            strokeWidth="0.5"
            animate={{ x: [-2, 2, -2], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path 
            d={`M 15,${TILE_HEIGHT/2 + 4} h ${TILE_WIDTH-30}`}
            stroke="white"
            strokeWidth="0.5"
            animate={{ x: [2, -2, 2], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
        </g>
      )}
      
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
      
      {type === TileType.TANGLED_DEEPWOOD && (
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
