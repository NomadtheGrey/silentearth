import React, { useEffect, useRef, useState } from 'react';

export const AmbientAudio: React.FC<{ resonance: number }> = ({ resonance }) => {
  const [isActive, setIsActive] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const windNodeRef = useRef<BiquadFilterNode | null>(null);
  const droneNodeRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const initAudio = () => {
    if (audioCtxRef.current) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;

    // Wind Sound (Procedural White Noise + Filtering)
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
    windGain.connect(ctx.destination);
    whiteNoise.start();

    // Resonance Drone
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55; // Low A
    
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.05;
    
    drone.connect(droneGain);
    droneGain.connect(ctx.destination);
    drone.start();
    
    droneNodeRef.current = drone;
    gainNodeRef.current = droneGain;

    setIsActive(true);
  };

  // React to resonance changes
  useEffect(() => {
    if (!audioCtxRef.current || !windNodeRef.current || !droneNodeRef.current || !gainNodeRef.current) return;

    const ctx = audioCtxRef.current;
    
    // Wind gets "wilder" with higher resonance
    windNodeRef.current.frequency.setTargetAtTime(
      400 + (resonance * 10), 
      ctx.currentTime, 
      1.0
    );

    // Drone gets louder and slightly unstable
    droneNodeRef.current.frequency.setTargetAtTime(
      55 + (resonance * 0.1), 
      ctx.currentTime, 
      0.5
    );
    
    gainNodeRef.current.gain.setTargetAtTime(
      0.05 + (resonance * 0.001), 
      ctx.currentTime, 
      0.5
    );
  }, [resonance]);

  // Occasional "scrap" or "drip" clicks
  useEffect(() => {
    if (!isActive || !audioCtxRef.current) return;

    const triggerScrap = () => {
      if (!audioCtxRef.current) return;
      
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      const isDrip = Math.random() > 0.6;

      if (isDrip) {
        // Wet, resonant drip
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400 + Math.random() * 600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      } else {
        // Metallic scrap/click
        osc.type = 'square';
        osc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      }
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      
      setTimeout(triggerScrap, 4000 + Math.random() * 12000);
    };

    const timeout = setTimeout(triggerScrap, 2000);
    return () => clearTimeout(timeout);
  }, [isActive]);

  return (
    <div className="fixed top-6 right-10 z-50">
      {!isActive ? (
        <button 
          onClick={initAudio}
          className="bg-[#6a1a1a]/20 hover:bg-[#6a1a1a]/40 border border-[#6a1a1a]/40 px-3 py-1 text-[8px] uppercase tracking-[0.2em] text-[#f0ead6] backdrop-blur-md transition-all cursor-pointer pointer-events-auto"
        >
          Initialize Resonance
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <div className="w-16 h-1 bg-[#f0ead6]/10 relative overflow-hidden">
             <div 
               className="absolute inset-0 bg-[#6a1a1a] opacity-50"
               style={{ width: `${resonance}%`, transition: 'width 2s ease' }}
             />
          </div>
          <span className="text-[7px] uppercase tracking-widest opacity-40">Audio Active</span>
        </div>
      )}
    </div>
  );
};
