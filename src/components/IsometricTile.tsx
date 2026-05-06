/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { TILE_WIDTH, TILE_HEIGHT, THEME, TileType } from '../constants';
import { WorldData } from '../types';
import { gridToScreen } from '../utils/isoMath';
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
  const { x, y } = gridToScreen(q, r);

  const tileDef = worldData.tiles[type];
  const baseColor = tileDef?.color || THEME.colors.coal;

  return (
    <g 
      transform={`translate(${x}, ${y})`}
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Base Organic Shape - Consistent overlap for all tiles to allow blending */}
      <path
        d={`
          M ${type === TileType.SHALLOW_CREEK ? -3 : -2},${TILE_HEIGHT / 2} 
          L ${TILE_WIDTH / 2},${type === TileType.SHALLOW_CREEK ? -3 : -2} 
          L ${TILE_WIDTH + (type === TileType.SHALLOW_CREEK ? 3 : 2)},${TILE_HEIGHT / 2} 
          L ${TILE_WIDTH / 2},${TILE_HEIGHT + (type === TileType.SHALLOW_CREEK ? 3 : 2)}
          Z
        `}
        fill={baseColor}
        className={isSelected || isHovered ? 'fill-[#6a1a1a]/40' : ''}
        style={{ vectorEffect: 'non-scaling-stroke' }}
      />

      {/* Stipple Grain Layer - Adds texture to the flat color */}
      <path
        d={`M 0,${TILE_HEIGHT / 2} L ${TILE_WIDTH / 2},0 L ${TILE_WIDTH},${TILE_HEIGHT / 2} L ${TILE_WIDTH / 2},${TILE_HEIGHT} Z`}
        fill="url(#stipple-pattern)"
        opacity="0.15"
        style={{ mixBlendMode: 'multiply' }}
      />

      {/* Ink Wash Gradient - Simulates uneven ink application */}
      <radialGradient id={`ink-wash-${q}-${r}`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="black" stopOpacity="0.05" />
        <stop offset="100%" stopColor="black" stopOpacity="0" />
      </radialGradient>
      <path
        d={`M 0,${TILE_HEIGHT / 2} L ${TILE_WIDTH / 2},0 L ${TILE_WIDTH},${TILE_HEIGHT / 2} L ${TILE_WIDTH / 2},${TILE_HEIGHT} Z`}
        fill={`url(#ink-wash-${q}-${r})`}
        style={{ mixBlendMode: 'multiply' }}
      />
      
      {/* Hand-Drawn Outline - Flattened lines instead of curves to remove bubbly look */}
      {type !== TileType.SHALLOW_CREEK && (
        <path
          d={`
            M 0,${TILE_HEIGHT / 2} L ${TILE_WIDTH / 2},0
            M ${TILE_WIDTH / 2},0 L ${TILE_WIDTH},${TILE_HEIGHT / 2}
            M ${TILE_WIDTH},${TILE_HEIGHT / 2} L ${TILE_WIDTH / 2},${TILE_HEIGHT}
            M ${TILE_WIDTH / 2},${TILE_HEIGHT} L 0,${TILE_HEIGHT / 2}
          `}
          fill="none"
          stroke={THEME.colors.ink}
          strokeWidth="0.75"
          opacity={isHovered ? "0.6" : "0.2"}
          strokeDasharray={isSelected ? "none" : "2,1,4,2"}
        />
      )}

      {/* Surface Variety - "Blotches" that bridge tile boundaries */}
      {(q + r) % 3 === 0 && (
         <circle cx={TILE_WIDTH/2 + (q % 5)} cy={TILE_HEIGHT/2 + (r % 3)} r={4 + (q % 3)} fill="black" opacity="0.04" />
      )}

      {/* Water Effect for Shallow Creek - Re-styled as flat etched lines */}
      {type === TileType.SHALLOW_CREEK && (
        <g opacity="0.3">
          {[...Array(3)].map((_, i) => (
            <motion.path 
              key={i}
              d={`M ${15 + i*2},${TILE_HEIGHT/2 + (i-1)*4} l ${TILE_WIDTH - 30 - i*4},0`}
              stroke="white"
              strokeWidth="0.5"
              fill="none"
              animate={{ x: [-1, 1, -1], opacity: [0.1, 0.4, 0.1] }}
              transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
            />
          ))}
        </g>
      )}
      
      {/* Ink Hatching Details - Coordinate based variations, replaced organic fringe */}
      {(q + r) % 2 === 0 && (
        <path 
          d={`M ${TILE_WIDTH * 0.2},${TILE_HEIGHT * 0.4} l 5,-2 M ${TILE_WIDTH * 0.25},${TILE_HEIGHT * 0.45} l 5,-2`}
          stroke={THEME.colors.ink} 
          strokeWidth="0.5" 
          opacity="0.1" 
        />
      )}
      
      {/* Texture Details - Coordinate based variations */}
      {(q * r) % 5 === 0 && (
        <path d={`M ${TILE_WIDTH/2},${TILE_HEIGHT/2} l 4,2 m -6,0 l 4,2`} fill="none" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.15" />
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
