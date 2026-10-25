/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign shell (landing 1). The isometric App is gone.
 * This mounts the Three.js world: a seeded biome world, a switchable
 * camera (V or C: first-person / third-person overhead), and walk
 * movement. No survival systems, no harvest/craft, no health/threat yet
 * — those are later landings. The overlay is a scaffold readout, not
 * game UI: seed, camera mode, position, dominant biome at the player,
 * and loaded chunk count.
 */

import React, { useEffect, useRef, useState } from 'react';
import { createWorldGen } from './game/worldgen';
import { WorldRenderer } from './game/renderer';
import { PlayerController } from './game/player';
import { bus } from './game/events';
import { BIOME_BY_ID } from './game/biomes';
import { DEFAULT_SEED } from './constants';
import type { CameraMode, BiomeWeights } from './types';

function formatWeights(weights: BiomeWeights): string {
  const entries = Object.entries(weights.weights)
    .filter(([, w]) => w > 0.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return entries
    .map(([id, w]) => `${BIOME_BY_ID[id as keyof typeof BIOME_BY_ID].name} ${Math.round(w * 100)}%`)
    .join(' · ');
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const playerRef = useRef<PlayerController | null>(null);
  const genRef = useRef(createWorldGen(DEFAULT_SEED));

  const [seedInput, setSeedInput] = useState(DEFAULT_SEED);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [cameraMode, setCameraMode] = useState<CameraMode>('third');
  const [position, setPosition] = useState({ x: 0, z: 0 });
  const [biomeText, setBiomeText] = useState('—');
  const [chunkCount, setChunkCount] = useState(0);

  // Boot the world once. StrictMode double-mounts in dev only; the
  // cleanup below disposes the first instance, and the production build
  // mounts exactly once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const gen = genRef.current;
    const player = new PlayerController(gen.findSpawn());
    const renderer = new WorldRenderer(container, gen, player);
    player.attach(renderer.domElement);
    rendererRef.current = renderer;
    playerRef.current = player;
    setPosition({ x: player.x, z: player.z });
    setBiomeText(formatWeights(gen.weightsAt(player.x, player.z)));
    bus.emit('world:seedSet', { seed: gen.seed });

    const offCamera = bus.on('camera:switched', ({ mode }) => setCameraMode(mode));
    const offMoved = bus.on('player:moved', ({ x, z }) => {
      setPosition({ x, z });
      setBiomeText(formatWeights(genRef.current.weightsAt(x, z)));
    });
    const offLoaded = bus.on('world:chunkLoaded', () =>
      setChunkCount(renderer.loadedChunkCount),
    );
    const offUnloaded = bus.on('world:chunkUnloaded', () =>
      setChunkCount(renderer.loadedChunkCount),
    );
    // First stream happens on the renderer's first frame; the count lands
    // via chunkLoaded events. Seed the display after a tick as a fallback.
    const timer = window.setTimeout(
      () => setChunkCount(renderer.loadedChunkCount),
      500,
    );

    return () => {
      window.clearTimeout(timer);
      offCamera();
      offMoved();
      offLoaded();
      offUnloaded();
      player.dispose();
      renderer.dispose();
      rendererRef.current = null;
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerate = () => {
    const nextSeed = seedInput.trim() || DEFAULT_SEED;
    const gen = createWorldGen(nextSeed);
    genRef.current = gen;
    const renderer = rendererRef.current;
    const player = playerRef.current;
    if (!renderer || !player) return;
    const spawn = gen.findSpawn();
    player.x = spawn.x;
    player.z = spawn.z;
    renderer.setWorldGen(gen);
    setSeed(nextSeed);
    setPosition({ x: spawn.x, z: spawn.z });
    setBiomeText(formatWeights(gen.weightsAt(spawn.x, spawn.z)));
    bus.emit('world:seedSet', { seed: nextSeed });
  };

  return (
    <div className="relative w-full h-screen bg-[#121612] overflow-hidden font-mono text-[#f0ead6]">
      {/* 3D viewport */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Scaffold overlay */}
      <div className="absolute top-0 left-0 p-4 pointer-events-none">
        <h1 className="text-lg tracking-widest">SILENT EARTH</h1>
        <p className="text-xs opacity-70">
          Redesign scaffold — placeholder art. No survival systems yet.
        </p>
        <div className="mt-3 text-xs space-y-1">
          <p>
            Camera:{' '}
            {cameraMode === 'first' ? 'First-person' : 'Third-person overhead'}{' '}
            <span className="opacity-60">(press V or C)</span>
          </p>
          <p>
            Position: {position.x.toFixed(1)}, {position.z.toFixed(1)}
          </p>
          <p>Ground here: {biomeText}</p>
          <p>Chunks loaded: {chunkCount}</p>
        </div>
      </div>

      {/* Seed controls */}
      <div className="absolute bottom-0 left-0 p-4 flex items-center gap-2">
        <label htmlFor="seed-input" className="text-xs opacity-70">
          World seed:
        </label>
        <input
          id="seed-input"
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') regenerate();
          }}
          className="bg-[#1e241c] border border-[#3a4436] px-2 py-1 text-xs w-48 outline-none"
        />
        <button
          onClick={regenerate}
          className="bg-[#3a4436] hover:bg-[#4a5546] px-3 py-1 text-xs"
        >
          Regenerate
        </button>
        <span className="text-xs opacity-60">Current: {seed}</span>
      </div>

      {/* Controls help */}
      <div className="absolute bottom-0 right-0 p-4 text-right text-xs opacity-70 pointer-events-none">
        <p>WASD to walk</p>
        <p>V / C to switch camera</p>
        {cameraMode === 'first' && <p>Click the world to capture the mouse</p>}
      </div>
    </div>
  );
}
