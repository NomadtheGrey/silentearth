/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TileType, ItemType, TILE_WIDTH, TILE_HEIGHT, THEME } from '../constants';
import { WorldData } from '../types';

interface NatureAssetProps {
  q: number;
  r: number;
  type: TileType;
  itemType?: string;
  isHarvestingAllowed?: boolean;
  onHarvest?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  worldData: WorldData;
}

export const NatureAsset: React.FC<NatureAssetProps> = ({ 
  q, r, type, itemType, isHarvestingAllowed, onHarvest, onMouseEnter, onMouseLeave, worldData 
}) => {
  // Biome noise blending for consistent fluff density
  const nLow = (Math.sin(q * 0.2 + 1.2) * Math.cos(r * 0.2 + 2.3) + 1) / 2;
  const nMid = (Math.sin(q * 0.5 - 0.5) * Math.cos(r * 0.5 + 1.5) + 1) / 2;
  const noiseVal = nLow * 0.6 + nMid * 0.4;
  
  const detailNoise = (Math.sin(q * 1.5 + 3.4) * Math.cos(r * 1.5 + 4.5) + 1) / 2;
  const seed = (q * 17 + r * 23) % 100;
  
  const x = (q - r) * (TILE_WIDTH / 2) + TILE_WIDTH / 2;
  const y = (q + r) * (TILE_HEIGHT / 2) + TILE_HEIGHT / 2;
  
  const variant = seed % 3;
  
  // Fluff assets
  const isNaturalDensity = type === TileType.TANGLED_DEEPWOOD ? noiseVal > 0.4 : noiseVal > 0.8;
  const hasFluff = !itemType && isNaturalDensity && detailNoise > 0.3;

  const isSmallRoot = hasFluff && detailNoise > 0.8;
  const isTallGrass = hasFluff && detailNoise > 0.5 && detailNoise <= 0.8;
  const isTwistedVine = hasFluff && detailNoise > 0.3 && detailNoise <= 0.5;
  const isInkPuddle = hasFluff && detailNoise <= 0.3;

  const isDenseOvergrowth = !itemType && type === TileType.TANGLED_DEEPWOOD && detailNoise < 0.7;
  const isExtraBush = isDenseOvergrowth && detailNoise < 0.3;
  const isExtraVines = isDenseOvergrowth && detailNoise >= 0.3;

  if (!itemType && !hasFluff && !isDenseOvergrowth) return null;

  return (
    <g 
      transform={`translate(${x}, ${y})`} 
      style={{ filter: 'url(#ink-stipple)' }} 
      className={itemType ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => {
        if (itemType && isHarvestingAllowed) {
          e.stopPropagation();
          onHarvest?.();
        }
      }}
    >
      {(itemType === 'SNAP_WOOD' || itemType === 'DOWNED_OAK' || itemType === 'SALT_CRYSTAL') && (
        <g transform={itemType === 'DOWNED_OAK' ? "translate(0, -10) scale(1.4)" : "translate(0, -35)"} className="opacity-90">
          {itemType === 'SALT_CRYSTAL' ? (
            <g transform="translate(0, 25)">
               <path d="M -8,5 L -4,-5 L 4,-8 L 8,3 L 0,8 Z" fill={THEME.colors.bone} stroke={THEME.colors.ink} strokeWidth="1" />
               <path d="M -2,-2 L 2,-4 M -4,2 L 0,1" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.4" />
               <circle cx="2" cy="-2" r="1" fill="#fff" opacity="0.6" className="animate-pulse" />
            </g>
          ) : (
            <>
              {variant === 0 && <path d="M 0,35 Q -15,10 0,-20 M 0,5 L -12,-5 M 0,15 L 15,0 M -5,-10 L 0,-25" fill="none" stroke={itemType === 'DOWNED_OAK' ? THEME.colors.coal : THEME.colors.ink} strokeWidth={itemType === 'DOWNED_OAK' ? "4" : "2.5"} strokeLinecap="round" />}
              {variant === 1 && (
                <g>
                  <path d="M 0,35 L 0,0 M 0,0 L -8,-15 M 0,0 L 8,-15" fill="none" stroke={itemType === 'DOWNED_OAK' ? THEME.colors.coal : THEME.colors.ink} strokeWidth={itemType === 'DOWNED_OAK' ? "3.5" : "2"} />
                  {/* Live Foliage */}
                  <circle cx="0" cy="-10" r="14" fill={THEME.colors.moss} opacity="0.6" style={{ filter: 'url(#ink-stipple)' }} />
                  <circle cx="-10" cy="-5" r="10" fill={THEME.colors.moss} opacity="0.4" />
                  <circle cx="10" cy="-5" r="10" fill={THEME.colors.moss} opacity="0.4" />
                  <path d="M -5,10 Q 0,0 5,10" fill="none" stroke={THEME.colors.moss} strokeWidth="4" opacity="0.4" />
                </g>
              )}
              {variant === 2 && (
                <g>
                  <path d="M 0,35 L -10,-5 M 0,15 L 12,0" fill="none" stroke={itemType === 'DOWNED_OAK' ? THEME.colors.coal : THEME.colors.ink} strokeWidth={itemType === 'DOWNED_OAK' ? "4" : "2.5"} />
                  <path d="M -15,-10 Q -10,-25 0,-15 Q 10,-25 15,-10 Z" fill={THEME.colors.moss} opacity="0.7" />
                  <circle cx="-10" cy="-5" r="2" fill={THEME.colors.blood} opacity="0.6" />
                </g>
              )}
            </>
          )}
          {itemType === 'DOWNED_OAK' && <path d="M -20,35 L 20,35" stroke={THEME.colors.ink} strokeWidth="2" opacity="0.3" />}
        </g>
      )}
      {itemType === 'STUMP' && (
        <g transform="translate(0, -10)" className="opacity-95">
          <path d="M -15,10 Q -15,0 -12,-5 L 12,-5 Q 15,0 15,10" fill={THEME.colors.coal} stroke={THEME.colors.ink} strokeWidth="2" />
          <path d="M -12,-5 Q 0,-10 12,-5 Q 0,0 -12,-5" fill={THEME.colors.mud} stroke={THEME.colors.ink} strokeWidth="1.5" />
          {/* Growth on the stump */}
          <circle cx="-6" cy="-4" r="3" fill={THEME.colors.moss} opacity="0.8" />
          <path d="M -15,5 L -18,15 M 15,5 L 18,15" stroke={THEME.colors.ink} strokeWidth="1" opacity="0.4" />
        </g>
      )}
      {itemType === 'TENDER_VINES' && (
        <g transform="translate(-15, -12)" className="opacity-90">
          <path d="M 0,18 Q 15,-10 30,18 M 5,15 Q 15,0 25,15" fill="none" stroke={THEME.colors.moss} strokeWidth="4" opacity="0.5" />
          <path d="M 2,18 L 15,2 L 28,18" fill="none" stroke={THEME.colors.ink} strokeWidth="1" opacity="0.3" />
          <path d="M 5,18 Q 15,5 25,18" fill="none" stroke={THEME.colors.ink} strokeWidth="0.8" opacity="0.2" />
        </g>
      )}
      {itemType === 'RIVER_SLUDGE' && (
         <g transform="translate(-12, -4)" className="opacity-90">
             <path d="M 0,10 Q 12,0 24,10" fill={THEME.colors.mud} stroke={THEME.colors.ink} strokeWidth="1" opacity="0.8" />
             <circle cx="12" cy="6" r="2" fill={THEME.colors.ink} opacity="0.2" />
         </g>
      )}
      {itemType === 'RIVER_STONE' && (
         <g transform="translate(-15, 0)" className="opacity-90">
             <path d="M 0,8 L 10,0 L 25,2 L 22,10 L 4,12 Z" fill={THEME.colors.coal} stroke={THEME.colors.ink} strokeWidth="1.5" />
             <path d="M 5,5 L 18,7" stroke={THEME.colors.nicotine} strokeWidth="0.5" opacity="0.5" />
         </g>
      )}
      {itemType === 'PEAT_MOSS' && (
        <g transform="translate(0, 0)">
          <path d="M -8,10 Q 0,-5 8,10 Z" fill={THEME.colors.moss} opacity="0.8" />
          <circle cx="0" cy="5" r="4" fill={THEME.colors.moss} opacity="0.4" />
          <path d="M -2,8 Q -2,4 2,4 Q 2,8 2,10 L -2,10 Z" fill={THEME.colors.bone} opacity="0.3" />
        </g>
      )}

      {/* Environmental Fluff */}
      {isSmallRoot && (
        <path d="M -10,10 Q 0,0 10,5" fill="none" stroke={THEME.colors.mud} strokeWidth="2" opacity="0.5" />
      )}
      {isTallGrass && (
        <g transform="translate(0, 8)">
          <path d={`M 0,0 Q ${variant-1},-8 ${variant-1},-15`} fill="none" stroke={THEME.colors.moss} strokeWidth="1.2" opacity="0.6" />
          <path d={`M 2,0 Q ${variant},-6 ${variant},-12`} fill="none" stroke={THEME.colors.moss} strokeWidth="1" opacity="0.4" />
          <path d={`M -2,0 Q ${variant-2},-7 ${variant-2},-13`} fill="none" stroke={THEME.colors.moss} strokeWidth="1" opacity="0.5" />
        </g>
      )}
      {isTwistedVine && (
        <path d="M -15,10 Q 0,-20 15,10" fill="none" stroke={THEME.colors.ink} strokeWidth="1.2" strokeDasharray="2 2" opacity="0.4" />
      )}
      {isInkPuddle && (
        <ellipse cx="0" cy="8" rx="10" ry="4" fill={THEME.colors.ink} opacity="0.3" />
      )}
      {/* Dense Overgrowth Extras */}
      {isDenseOvergrowth && (
        <g transform="translate(0, 5)">
          <path d="M 0,8 Q -12,0 -8,-15 M 0,8 Q 12,0 8,-15" fill="none" stroke={THEME.colors.moss} strokeWidth="2" opacity="0.5" />
          <path d="M 0,8 V -8" stroke={THEME.colors.moss} strokeWidth="1.2" opacity="0.3" />
          <circle cx="-6" cy="4" r="4" fill={THEME.colors.ink} opacity="0.1" />
        </g>
      )}
      {isExtraBush && (
        <g transform="translate(-10, 0)">
           <circle cx="0" cy="5" r="8" fill={THEME.colors.moss} opacity="0.3" />
           <path d="M -5,5 Q 0,-5 5,5" fill="none" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.3" />
        </g>
      )}
      {isExtraVines && (
        <path d="M -12,12 L 12,2 M -15,5 L 10,15" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.4" strokeDasharray="1 3" />
      )}

      {/* Manual Harvest UI Logic */}
      {itemType && isHarvestingAllowed && (
        <g transform="translate(-22, -45)" style={{ pointerEvents: 'none' }}>
          <rect width="44" height="14" fill={THEME.colors.bone} stroke={THEME.colors.ink} rx="1" style={{ filter: 'url(#rough-edge)' }} />
          <text x="22" y="10" textAnchor="middle" fill={THEME.colors.ink} fontSize="7" fontWeight="900">
            {worldData.items[itemType]?.harvestAction ? `${worldData.items[itemType].harvestAction} [H]` : 'HARVEST [H]'}
          </text>
        </g>
      )}
    </g>
  );
};
