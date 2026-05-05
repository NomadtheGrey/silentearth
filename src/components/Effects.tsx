/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const GrittyFilter = () => (
  <svg className="hidden" aria-hidden="true">
    <defs>
      <filter id="ink-stipple">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" result="noise" />
        <feColorMatrix type="saturate" values="0" result="destat" />
        <feComponentTransfer result="stipple">
          <feFuncR type="discrete" tableValues="0 1" />
          <feFuncG type="discrete" tableValues="0 1" />
          <feFuncB type="discrete" tableValues="0 1" />
        </feComponentTransfer>
        <feComposite in="stipple" in2="SourceGraphic" operator="in" result="masked-stipple" />
        <feBlend in="SourceGraphic" in2="masked-stipple" mode="multiply" />
      </filter>
      
      <filter id="bone-relief">
        <feSpecularLighting surfaceScale="2" specularConstant="0.5" specularExponent="10" lightingColor="#fff">
          <feDistantLight azimuth="45" elevation="45" />
        </feSpecularLighting>
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      
      <filter id="parchment-texture">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise" />
        <feDiffuseLighting in="noise" lightingColor="#e6d5b0" surfaceScale="2">
          <feDistantLight azimuth="45" elevation="60" />
        </feDiffuseLighting>
      </filter>

      <filter id="tile-blend">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.4" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>

      <filter id="rough-edge">
        <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" result="noise" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.1" />
        </feComponentTransfer>
      </filter>
    </defs>
  </svg>
);

export const GlobalNoise = () => (
  <div className="fixed inset-0 pointer-events-none z-[9999]" style={{ filter: 'url(#grain)', background: 'transparent' }}></div>
);
