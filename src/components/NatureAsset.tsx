/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TileType, TILE_WIDTH, TILE_HEIGHT, THEME } from '../constants';
import { WorldData } from '../types';
import { gridToScreen } from '../utils/isoMath';

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
  
  const { x: baseX, y: baseY } = gridToScreen(q, r);
  const x = baseX + TILE_WIDTH / 2;
  const y = baseY + TILE_HEIGHT / 2;
  
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
        <g transform={itemType === 'DOWNED_OAK' ? "translate(0, -10) scale(1.4)" : "translate(0, -35)"} className="opacity-100">
          {itemType === 'SALT_CRYSTAL' ? (
            <g transform="translate(0, 25)">
               <path d="M -8,5 L -4,-5 L 4,-8 L 8,3 L 0,8 Z" fill={THEME.colors.bone} stroke={THEME.colors.ink} strokeWidth="1" />
               <path d="M -2,-2 L 2,-4 M -4,2 L 0,1" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.4" />
               <circle cx="2" cy="-2" r="1.5" fill="#fff" opacity="0.9" className="animate-pulse" />
            </g>
          ) : (
            <>
              {variant === 0 && (
                <g>
                  {/* Branch / Wood Structure */}
                  <path 
                    d="M 0,35 Q -15,10 0,-20 M 0,5 L -12,-5 M 0,15 L 15,0 M -5,-10 L 0,-25" 
                    fill="none" 
                    stroke={itemType === 'DOWNED_OAK' ? THEME.colors.bark : THEME.colors.wood} 
                    strokeWidth={itemType === 'DOWNED_OAK' ? "4.5" : "3"} 
                    strokeLinecap="round" 
                  />
                  <path 
                    d="M 0,35 Q -15,10 0,-20 M 0,5 L -12,-5 M 0,15 L 15,0 M -5,-10 L 0,-25" 
                    fill="none" 
                    stroke={THEME.colors.ink} 
                    strokeWidth="0.75" 
                    strokeLinecap="round" 
                    opacity="0.6"
                  />
                  {/* Sprout Leaves on branches */}
                  <circle cx="-12" cy="-5" r="3.5" fill={THEME.colors.sprout} stroke={THEME.colors.ink} strokeWidth="0.5" />
                  <circle cx="15" cy="0" r="4" fill={THEME.colors.leafLight} stroke={THEME.colors.ink} strokeWidth="0.5" />
                  <circle cx="0" cy="-25" r="3" fill={THEME.colors.leaf} stroke={THEME.colors.ink} strokeWidth="0.5" />
                </g>
              )}
              {variant === 1 && (
                <g>
                  {/* Tree Trunk */}
                  <path 
                    d="M 0,35 L 0,0 M 0,0 L -8,-15 M 0,0 L 8,-15" 
                    fill="none" 
                    stroke={itemType === 'DOWNED_OAK' ? THEME.colors.bark : THEME.colors.wood} 
                    strokeWidth={itemType === 'DOWNED_OAK' ? "4" : "2.5"} 
                  />
                  <path 
                    d="M 0,35 L 0,0 M 0,0 L -8,-15 M 0,0 L 8,-15" 
                    fill="none" 
                    stroke={THEME.colors.ink} 
                    strokeWidth="0.75" 
                    opacity="0.7"
                  />
                  {/* Live Foliage Canopy - Layered contrast */}
                  {/* Base dark canopy shadow */}
                  <circle cx="0" cy="-12" r="15" fill={THEME.colors.leafDark} stroke={THEME.colors.ink} strokeWidth="0.75" />
                  {/* Mid canopy leaves */}
                  <circle cx="-9" cy="-8" r="11" fill={THEME.colors.leaf} stroke={THEME.colors.ink} strokeWidth="0.5" />
                  <circle cx="9" cy="-8" r="11" fill={THEME.colors.leaf} stroke={THEME.colors.ink} strokeWidth="0.5" />
                  {/* Top bright highlights */}
                  <circle cx="-3" cy="-17" r="9" fill={THEME.colors.leafLight} />
                  <circle cx="2" cy="-19" r="5" fill={THEME.colors.sprout} />
                  {/* Berry / Spore Accents */}
                  <circle cx="-11" cy="-12" r="1.5" fill={THEME.colors.blood} />
                  <circle cx="11" cy="-6" r="1.5" fill={THEME.colors.nicotine} />
                </g>
              )}
              {variant === 2 && (
                <g>
                  {/* Trunk */}
                  <path 
                    d="M 0,35 L -10,-5 M 0,15 L 12,0" 
                    fill="none" 
                    stroke={itemType === 'DOWNED_OAK' ? THEME.colors.bark : THEME.colors.wood} 
                    strokeWidth={itemType === 'DOWNED_OAK' ? "4.5" : "3"} 
                  />
                  <path 
                    d="M 0,35 L -10,-5 M 0,15 L 12,0" 
                    fill="none" 
                    stroke={THEME.colors.ink} 
                    strokeWidth="0.75" 
                    opacity="0.6"
                  />
                  {/* Leaf Canopy */}
                  <path 
                    d="M -15,-10 Q -10,-26 0,-16 Q 10,-26 15,-10 Z" 
                    fill={THEME.colors.leaf} 
                    stroke={THEME.colors.ink} 
                    strokeWidth="0.75" 
                  />
                  <path 
                    d="M -10,-12 Q -5,-22 0,-15 Q 5,-22 10,-12 Z" 
                    fill={THEME.colors.leafLight} 
                  />
                  <circle cx="-10" cy="-5" r="2.5" fill={THEME.colors.blood} stroke={THEME.colors.ink} strokeWidth="0.5" />
                  <circle cx="8" cy="-8" r="2" fill={THEME.colors.sprout} />
                </g>
              )}
            </>
          )}
          {itemType === 'DOWNED_OAK' && <path d="M -20,35 L 20,35" stroke={THEME.colors.wood} strokeWidth="2.5" strokeDasharray="3 2" />}
        </g>
      )}
      {itemType === 'STUMP' && (
        <g transform="translate(0, -10)" className="opacity-100">
          {/* Bark Base */}
          <path d="M -15,10 Q -15,0 -12,-5 L 12,-5 Q 15,0 15,10" fill={THEME.colors.bark} stroke={THEME.colors.ink} strokeWidth="1.5" />
          {/* Sawed Top Face */}
          <path d="M -12,-5 Q 0,-10 12,-5 Q 0,0 -12,-5" fill={THEME.colors.wood} stroke={THEME.colors.ink} strokeWidth="1.2" />
          {/* Ring Details */}
          <path d="M -7,-5 Q 0,-8 7,-5 Q 0,-2 -7,-5" fill="none" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.4" />
          {/* Growth on the stump */}
          <circle cx="-6" cy="-4" r="3.5" fill={THEME.colors.sprout} stroke={THEME.colors.ink} strokeWidth="0.5" />
          <circle cx="5" cy="-3" r="2.5" fill={THEME.colors.leafLight} />
          <path d="M -15,5 L -18,15 M 15,5 L 18,15" stroke={THEME.colors.bark} strokeWidth="1.5" />
        </g>
      )}
      {itemType === 'TENDER_VINES' && (
        <g transform="translate(-15, -12)" className="opacity-100">
          <path d="M 0,18 Q 15,-10 30,18" fill="none" stroke={THEME.colors.leaf} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 5,15 Q 15,0 25,15" fill="none" stroke={THEME.colors.leafLight} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 0,18 Q 15,-10 30,18 M 5,15 Q 15,0 25,15" fill="none" stroke={THEME.colors.ink} strokeWidth="0.5" opacity="0.6" />
          {/* Vine Leaf Nodes */}
          <circle cx="10" cy="0" r="3" fill={THEME.colors.sprout} stroke={THEME.colors.ink} strokeWidth="0.5" />
          <circle cx="20" cy="2" r="3" fill={THEME.colors.leafLight} stroke={THEME.colors.ink} strokeWidth="0.5" />
          <circle cx="27" cy="12" r="2.5" fill={THEME.colors.sprout} />
        </g>
      )}
      {itemType === 'RIVER_SLUDGE' && (
         <g transform="translate(-12, -4)" className="opacity-95">
             <path d="M 0,10 Q 12,0 24,10" fill={THEME.colors.mud} stroke={THEME.colors.ink} strokeWidth="1" opacity="0.9" />
             <circle cx="12" cy="6" r="2.5" fill={THEME.colors.leafLight} opacity="0.7" />
         </g>
      )}
      {itemType === 'RIVER_STONE' && (
         <g transform="translate(-15, 0)" className="opacity-95">
             <path d="M 0,8 L 10,0 L 25,2 L 22,10 L 4,12 Z" fill={THEME.colors.coal} stroke={THEME.colors.ink} strokeWidth="1.5" />
             <path d="M 5,5 L 18,7" stroke={THEME.colors.nicotine} strokeWidth="1" opacity="0.7" />
         </g>
      )}
      {itemType === 'PEAT_MOSS' && (
        <g transform="translate(0, 0)">
          <path d="M -10,10 Q 0,-6 10,10 Z" fill={THEME.colors.moss} stroke={THEME.colors.ink} strokeWidth="0.75" />
          <path d="M -6,8 Q 0,-3 6,8 Z" fill={THEME.colors.leafLight} />
          <circle cx="0" cy="2" r="3" fill={THEME.colors.sprout} />
          <path d="M -2,8 Q -2,4 2,4 Q 2,8 2,10 L -2,10 Z" fill={THEME.colors.bone} stroke={THEME.colors.ink} strokeWidth="0.5" />
        </g>
      )}

      {/* Environmental Fluff */}
      {isSmallRoot && (
        <path d="M -10,10 Q 0,0 10,5" fill="none" stroke={THEME.colors.wood} strokeWidth="2.5" strokeLinecap="round" />
      )}
      {isTallGrass && (
        <g transform="translate(0, 8)">
          <path d={`M 0,0 Q ${variant-1},-8 ${variant-1},-15`} fill="none" stroke={THEME.colors.leafLight} strokeWidth="1.5" strokeLinecap="round" />
          <path d={`M 3,0 Q ${variant},-6 ${variant},-12`} fill="none" stroke={THEME.colors.sprout} strokeWidth="1.2" strokeLinecap="round" />
          <path d={`M -3,0 Q ${variant-2},-7 ${variant-2},-13`} fill="none" stroke={THEME.colors.leaf} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )}
      {isTwistedVine && (
        <g>
          <path d="M -15,10 Q 0,-20 15,10" fill="none" stroke={THEME.colors.leaf} strokeWidth="1.5" />
          <circle cx="0" cy="-8" r="2" fill={THEME.colors.sprout} />
        </g>
      )}
      {isInkPuddle && (
        <ellipse cx="0" cy="8" rx="10" ry="4" fill={THEME.colors.ink} opacity="0.4" />
      )}
      {/* Dense Overgrowth Extras */}
      {isDenseOvergrowth && (
        <g transform="translate(0, 5)">
          <path d="M 0,8 Q -12,0 -8,-15 M 0,8 Q 12,0 8,-15" fill="none" stroke={THEME.colors.leaf} strokeWidth="2" strokeLinecap="round" />
          <path d="M 0,8 V -8" stroke={THEME.colors.sprout} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="-8" cy="-15" r="2" fill={THEME.colors.sprout} />
          <circle cx="8" cy="-15" r="2" fill={THEME.colors.leafLight} />
        </g>
      )}
      {isExtraBush && (
        <g transform="translate(-10, 0)">
           <circle cx="0" cy="5" r="8" fill={THEME.colors.leafDark} stroke={THEME.colors.ink} strokeWidth="0.5" />
           <circle cx="-2" cy="3" r="5" fill={THEME.colors.leaf} />
           <circle cx="1" cy="1" r="3" fill={THEME.colors.sprout} />
        </g>
      )}
      {isExtraVines && (
        <path d="M -12,12 L 12,2 M -15,5 L 10,15" stroke={THEME.colors.leaf} strokeWidth="1" strokeDasharray="2 2" />
      )}

      {/* Manual Harvest UI Logic */}
      {itemType && isHarvestingAllowed && (
        <g transform="translate(-22, -45)" style={{ pointerEvents: 'none' }}>
          <rect width="44" height="14" fill={THEME.colors.bone} stroke={THEME.colors.ink} rx="1" />
          <text x="22" y="10" textAnchor="middle" fill={THEME.colors.ink} fontSize="7" fontWeight="900">
            {worldData.items[itemType]?.harvestAction ? `${worldData.items[itemType].harvestAction} [H]` : 'HARVEST [H]'}
          </text>
        </g>
      )}
    </g>
  );
};
