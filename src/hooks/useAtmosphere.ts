/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useCallback } from 'react';

export const useAtmosphere = () => {
  const audioCtx = useRef<AudioContext | null>(null);
  
  const init = useCallback(() => {
    if (audioCtx.current) return;
    
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtx.current = ctx;

    // Procedural Wind (Brown Noise)
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    
    for (let i = 0; i < bufferSize; i++) {
       const white = Math.random() * 2 - 1;
       data[i] = (lastOut + (0.02 * white)) / 1.02;
       lastOut = data[i];
       data[i] *= 3.5; // Gain
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = ctx.createGain();
    gain.gain.value = 0.15;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();

    // Constant Resonance Drone
    const osc = ctx.createOscillator();
    const droneGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    droneGain.gain.value = 0.05;
    
    osc.connect(droneGain);
    droneGain.connect(ctx.destination);
    osc.start();
  }, []);

  return { init };
};
