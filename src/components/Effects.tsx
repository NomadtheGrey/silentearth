/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const GrittyFilter = () => (
  <svg style={{ position: 'absolute', width: 0, height: 0 }}>
    <defs>
      <filter id="ink-stipple">
        {/* Displacement creates the wobbly pen look */}
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
        
        {/* Simple Grain Texture */}
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" result="grain" />
        <feComposite in="SourceGraphic" in2="grain" operator="arithmetic" k1="0.4" k2="0.6" k3="0" k4="0" />
      </filter>

      <filter id="rough-edge">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="1" result="edge-noise" />
        <feDisplacementMap in="SourceGraphic" in2="edge-noise" scale="4" />
      </filter>
      
      <pattern id="stipple-pattern" width="4" height="4" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.5" fill="black" opacity="0.4" />
        <circle cx="3" cy="2" r="0.4" fill="black" opacity="0.2" />
        <circle cx="2" cy="3" r="0.6" fill="black" opacity="0.3" />
      </pattern>

      <filter id="tile-fusing">
        <feMorphology operator="dilate" radius="1.5" in="SourceGraphic" result="expanded" />
        <feGaussianBlur stdDeviation="2" in="expanded" result="soft" />
        <feComposite in="SourceGraphic" in2="soft" operator="over" />
      </filter>

      <filter id="bone-relief">
        <feSpecularLighting surfaceScale="2" specularConstant="0.8" specularExponent="20" lightingColor="#f5f1e8" in="SourceGraphic" result="specOut">
          <fePointLight x="-50" y="-50" z="100" />
        </feSpecularLighting>
        <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
      </filter>
    </defs>
  </svg>
);

export const GlobalNoise = () => (
  <>
    <div className="fixed inset-0 pointer-events-none opacity-[0.06] z-[100] mix-blend-multiply">
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
    <div className="fixed inset-0 pointer-events-none z-[99]" style={{ background: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.7) 100%)' }} />
  </>
);
