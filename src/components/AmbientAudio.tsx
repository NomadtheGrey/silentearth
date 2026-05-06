import React, { useEffect, useRef, useState } from 'react';

export const AmbientAudio: React.FC<{ resonance: number; isEnabled: boolean; onInit?: () => void }> = ({ resonance, isEnabled, onInit }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const windNodeRef = useRef<BiquadFilterNode | null>(null);
  const droneNodeRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  const initAudio = () => {
    if (audioCtxRef.current) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    // Wind Sound
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 400;
    windFilter.Q.value = 5;
    windNodeRef.current = windFilter;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.15;

    whiteNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    whiteNoise.start();

    // Resonance Drone
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    
    drone.connect(droneGain);
    droneGain.connect(masterGain);
    drone.start();
    
    droneNodeRef.current = drone;
    gainNodeRef.current = droneGain;

    if (onInit) onInit();
  };

  useEffect(() => {
    if (isEnabled && !audioCtxRef.current) {
        // We can't auto-init without interaction, so we wait for handleTileClick in App
    }
    if (masterGainRef.current && audioCtxRef.current) {
        masterGainRef.current.gain.setTargetAtTime(isEnabled ? 1 : 0, audioCtxRef.current.currentTime, 0.1);
    }
  }, [isEnabled]);

  // Use exposure for manual init
  (window as any).initGameAudio = initAudio;

  // React to resonance changes
  useEffect(() => {
    if (!audioCtxRef.current || !windNodeRef.current || !droneNodeRef.current || !gainNodeRef.current) return;
    const ctx = audioCtxRef.current;
    windNodeRef.current.frequency.setTargetAtTime(400 + (resonance * 10), ctx.currentTime, 1.0);
    droneNodeRef.current.frequency.setTargetAtTime(55 + (resonance * 0.1), ctx.currentTime, 0.5);
    gainNodeRef.current.gain.setTargetAtTime(0.05 + (resonance * 0.001), ctx.currentTime, 0.5);
  }, [resonance]);

  // Occasional "scrap" or "drip" clicks
  useEffect(() => {
    if (!isEnabled || !audioCtxRef.current) return;

    const triggerScrap = () => {
      if (!audioCtxRef.current || !isEnabled) return;
      
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      const isDrip = Math.random() > 0.6;

      if (isDrip) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400 + Math.random() * 600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      }
      
      if (masterGainRef.current) {
          osc.connect(gain);
          gain.connect(masterGainRef.current);
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
      }
      
      setTimeout(triggerScrap, 4000 + Math.random() * 12000);
    };

    const timeout = setTimeout(triggerScrap, 2000);
    return () => clearTimeout(timeout);
  }, [isEnabled]);

  return null;
};
