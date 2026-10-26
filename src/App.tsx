/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign shell — UI wired (wiring round, 2026-10-26).
 * This mounts the Three.js world and the staged UI on top of it:
 * HudShell (needs row awaiting survival systems), the scaffold
 * readout folded into the HUD (camera, position, ground here,
 * chunks, seed), WitchHealth unwired (awaiting health system),
 * InventoryPanel on the real PersonalInventory, CraftingMenu on
 * the real Systems recipes + canCraft + executeCraft (the helper
 * App wiring is meant to call, which also moves the held tool),
 * ProximityHarvestButtons subscribed to 'harvest:inRange' with
 * world-to-screen projection, and the CameraTransition overlay on
 * 'camera:switched'.
 *
 * WHAT IS DELIBERATELY NOT HERE (read before extending):
 * - Harvest outcome feedback: the bus carries NO 'harvest:completed'
 *   or failure event yet, and no Systems listener consumes
 *   'harvest:requested' (the bus comment says outcome is the next
 *   step). The feedback display path IS in place below (feedbacks
 *   state rendered through WorldAnchor + ObjectFeedback, positioned
 *   by the same projection), but it stays empty until Background
 *   registers those events and Systems consumes the request — this
 *   file invents no yields and shows no fake "you got X". Pressing
 *   a harvest button emits 'harvest:requested' and nothing else.
 * - Station presence: no station-presence source exists (stumps are
 *   anchors, not proximity targets), so crafting runs with station
 *   context null. Recipes with an unstated or 'hand' station pass
 *   anywhere, as the engine defines; recipes requiring a specific
 *   station correctly report a station mismatch until a presence
 *   source lands. Nothing here pretends she stands at a station.
 * - Inventory capacity mode: PersonalInventory requires a
 *   largeBasketMode, and replace-vs-stack is still Adam's open
 *   question. Systems solved the wiring side of it explicitly:
 *   this shell constructs through createTemporaryWiringInventory()
 *   (TEMPORARY-WIRING-PLACEHOLDER, 'replace' as the placeholder,
 *   not a ruling — see crafting-execution.ts). When Adam rules,
 *   that call is replaced with a PersonalInventory built with the
 *   ruled mode and the placeholder function is deleted; the
 *   placeholder must never simply be kept as the answer. It
 *   changes nothing until a large basket is held alongside a
 *   small one (a lone small basket always gives +25 either way),
 *   and the upgrade normally consumes the small basket, so the
 *   modes coincide right after the upgrade in normal play.
 * - Held tool: HeldToolState starts at hands (deliberate — ground
 *   is hand-permitted, clay needs a trowel). Crafting a ladder
 *   tool equips it via executeCraft, atomically after success;
 *   anything else leaves the held tool unchanged, and a failed
 *   craft touches neither inventory nor held tool. The HUD shows
 *   the held tool from that state, not from an invented slot.
 * - Controllers untouched: no renderer/player edits in this round
 *   (facing ease and any controller change need a separate claim).
 *   The camera geometry below replicates the renderer from player
 *   state because the renderer keeps its camera private; see
 *   src/ui/worldProjection.ts — a future renderer accessor would
 *   replace that replication.
 * - Health and ambience: WitchHealth stays unwired (no value, so it
 *   renders its awaiting note); Effects.tsx / useAtmosphere.ts stay
 *   unimported.
 *
 * POINTER DISCIPLINE: overlays are pointer-events-none except the
 * small interactive pieces (HUD buttons, panels, harvest buttons),
 * so world clicks — including the first-person mouse-capture click
 * — still reach the canvas. HudShell's content area was fixed to
 * pointer-events-none for exactly this reason.
 */

import React, { Fragment, useEffect, useRef, useState } from 'react';
import { createWorldGen } from './game/worldgen';
import { WorldRenderer } from './game/renderer';
import { PlayerController } from './game/player';
import { bus, type EventMap } from './game/events';
import { BIOME_BY_ID } from './game/biomes';
import {
  DEFAULT_SEED,
  PLAYER_EYE_HEIGHT,
  THIRD_PERSON_OFFSET,
} from './constants';
import type { CameraMode, BiomeWeights } from './types';
import { HudShell } from './ui/HudShell';
import { WitchHealth } from './ui/WitchHealth';
import { CameraToggle } from './ui/CameraToggle';
import { InventoryPanel } from './ui/InventoryPanel';
import { CraftingMenu } from './ui/CraftingMenu';
import { ProximityHarvestButtons } from './ui/ProximityHarvestButtons';
import { ObjectFeedback } from './ui/ObjectFeedback';
import { WorldAnchor } from './ui/WorldAnchor';
import { CameraTransition } from './ui/CameraTransition';
import { CAMERA_TRANSITION } from './ui/cameraPresentation';
import { projectWorldToScreen } from './ui/worldProjection';
import type { HarvestTarget, HarvestRequest } from './ui/proximityHarvest';
import type {
  InventoryItem,
  CraftingRecipe,
  FeedbackTone,
} from './ui/types';
import type { PersonalInventory } from './systems/inventory';
import {
  createTemporaryWiringInventory,
  executeCraft,
} from './systems/crafting-execution';
import { HeldToolState, type HeldToolItem } from './systems/held-tool';
import { canCraft, type StationContext } from './systems/crafting';
import { RECIPES } from './systems/recipes';

type BusHarvestTarget = EventMap['harvest:inRange']['targets'][number];

/** One feedback chip, positioned by the same projection as buttons. */
interface FeedbackItem {
  id: string;
  text: string;
  tone: FeedbackTone;
  x: number;
  y: number;
}

function formatWeights(weights: BiomeWeights): string {
  const entries = Object.entries(weights.weights)
    .filter(([, w]) => w > 0.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return entries
    .map(([id, w]) => `${BIOME_BY_ID[id as keyof typeof BIOME_BY_ID].name} ${Math.round(w * 100)}%`)
    .join(' · ');
}

/** Clamp a screen percentage so a ground-at-feet button stays visible. */
function clampPercent(value: number): number {
  return Math.min(98, Math.max(2, value));
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const playerRef = useRef<PlayerController | null>(null);
  const genRef = useRef(createWorldGen(DEFAULT_SEED));

  // The shell owns the one personal inventory, built through
  // Systems' temporary wiring helper (see the header — placeholder
  // mode until Adam rules on replace-vs-stack), and the one held
  // tool state (starts at hands).
  const inventoryRef = useRef<PersonalInventory | null>(null);
  if (inventoryRef.current === null) {
    inventoryRef.current = createTemporaryWiringInventory();
  }
  const inventory = inventoryRef.current;
  const heldToolRef = useRef<HeldToolState | null>(null);
  if (heldToolRef.current === null) {
    heldToolRef.current = new HeldToolState();
  }
  const heldTool = heldToolRef.current;

  const [seedInput, setSeedInput] = useState(DEFAULT_SEED);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [cameraMode, setCameraMode] = useState<CameraMode>('third');
  const [position, setPosition] = useState({ x: 0, z: 0 });
  const [biomeText, setBiomeText] = useState('—');
  const [chunkCount, setChunkCount] = useState(0);
  const [switching, setSwitching] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(
    undefined,
  );
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | undefined>(
    undefined,
  );
  const [craftNote, setCraftNote] = useState<string | null>(null);
  const [heldItem, setHeldItem] = useState<HeldToolItem>(() =>
    heldTool.current(),
  );
  const [harvestTargets, setHarvestTargets] = useState<HarvestTarget[]>([]);
  // Harvest outcome feedback. Empty until 'harvest:completed' /
  // failure events exist on the bus (see the header) — rendered
  // through WorldAnchor + ObjectFeedback the moment they do.
  const [feedbacks] = useState<FeedbackItem[]>([]);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() =>
    inventory
      .stacksSnapshot()
      .map((stack) => ({
        id: stack.item,
        name: stack.item,
        quantityText: String(stack.quantity),
      })),
  );
  const [capacityText, setCapacityText] = useState(
    () => `Carrying ${inventory.used()} / ${inventory.capacity()}`,
  );

  const busTargetsRef = useRef<BusHarvestTarget[]>([]);
  const transitionTimerRef = useRef<number | undefined>(undefined);

  const refreshInventory = () => {
    setInventoryItems(
      inventory
        .stacksSnapshot()
        .map((stack) => ({
          id: stack.item,
          name: stack.item,
          quantityText: String(stack.quantity),
        })),
    );
    setCapacityText(
      `Carrying ${inventory.used()} / ${inventory.capacity()}`,
    );
  };

  // Re-project the last in-range targets from current player state.
  // Reads refs only, so the boot effect's first-render copy stays
  // valid: every camera change (move, look, switch, resize) flows
  // through an event that calls this.
  const recomputeAnchors = () => {
    const player = playerRef.current;
    const container = containerRef.current;
    if (!player || !container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    const projected: HarvestTarget[] = [];
    for (const target of busTargetsRef.current) {
      const isGround = target.kind === 'ground';
      const point = projectWorldToScreen({
        // Scatter buttons float ~1 m above the object's feet so the
        // chip sits on the thing, not under it; ground anchors at
        // the ground itself. Presentation offsets, not game facts.
        worldX: target.x,
        worldY: isGround ? 0 : 1,
        worldZ: target.z,
        playerX: player.x,
        playerZ: player.z,
        pitch: player.pitch,
        yaw: player.yaw,
        mode: player.mode,
        aspect: width / height,
        eyeHeight: PLAYER_EYE_HEIGHT,
        thirdOffset: THIRD_PERSON_OFFSET,
      });
      if (!point) continue;
      let anchorX = point.x;
      let anchorY = point.y;
      if (isGround) {
        // Ground at her feet is a direction, not a distant object:
        // clamp to the screen edge (bottom-centre in first-person
        // when looking down) instead of dropping it.
        anchorX = clampPercent(anchorX);
        anchorY = clampPercent(anchorY);
      } else if (
        anchorX < 0 ||
        anchorX > 100 ||
        anchorY < 0 ||
        anchorY > 100
      ) {
        // Off-screen scatter: drop the button rather than clamping
        // it onto the wrong object.
        continue;
      }
      projected.push({
        id: target.id,
        sourceId: target.sourceId,
        name: target.name,
        kind: target.kind,
        anchorX,
        anchorY,
        worldX: target.x,
        worldZ: target.z,
      });
    }
    setHarvestTargets(projected);
  };

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

    const offCamera = bus.on('camera:switched', ({ mode }) => {
      setCameraMode(mode);
      setSwitching(true);
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = window.setTimeout(
        () => setSwitching(false),
        CAMERA_TRANSITION.fadeMs,
      );
      recomputeAnchors();
    });
    const offMoved = bus.on('player:moved', ({ x, z }) => {
      setPosition({ x, z });
      setBiomeText(formatWeights(genRef.current.weightsAt(x, z)));
      recomputeAnchors();
    });
    const offLooked = bus.on('player:looked', () => {
      recomputeAnchors();
    });
    const offInRange = bus.on('harvest:inRange', ({ targets }) => {
      busTargetsRef.current = targets;
      recomputeAnchors();
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
    const onResize = () => {
      recomputeAnchors();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(transitionTimerRef.current);
      window.removeEventListener('resize', onResize);
      offCamera();
      offMoved();
      offLooked();
      offInRange();
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
    recomputeAnchors();
  };

  // Station context: null — no station-presence source exists yet
  // (see the header). Unstated/'hand' recipes pass; station recipes
  // report their mismatch until presence lands.
  const station: StationContext = null;

  const craftingRecipes: CraftingRecipe[] = RECIPES.map((recipe) => {
    const check = canCraft(recipe, inventory, station);
    let availabilityNote: string | undefined;
    if (check.stationMismatch) {
      availabilityNote = `Needs a ${check.requiredStation} station.`;
    } else if (check.missingIngredients.length > 0) {
      const first = check.missingIngredients[0];
      availabilityNote = `Missing ${first.item} (${first.held} / ${first.quantity}).`;
    } else if (check.missingUpgradeFrom.length > 0) {
      availabilityNote = `Needs one of ${check.missingUpgradeFrom.join(' or ')} to upgrade from.`;
    } else if (check.missingRequirements.length > 0) {
      const first = check.missingRequirements[0];
      availabilityNote = `Requires ${first.item} present (${first.held} / ${first.quantity}).`;
    }
    return {
      id: recipe.id,
      name: recipe.name,
      description: `Makes ${recipe.output.quantity} × ${recipe.output.item}.`,
      ingredients: recipe.ingredients.map((ingredient) => ({
        name: ingredient.item,
        amountText: `${inventory.count(ingredient.item)} / ${ingredient.quantity}`,
      })),
      canCraft: check.ok,
      availabilityNote,
    };
  });

  const handleCraft = (recipeId: string) => {
    const recipe = RECIPES.find((candidate) => candidate.id === recipeId);
    if (!recipe) return;
    const heldBefore = heldTool.current();
    try {
      const result = executeCraft(recipe, inventory, heldTool, station);
      setHeldItem(result.held);
      setCraftNote(
        `Crafted ${result.output.item} × ${result.output.quantity}.` +
          (result.held !== heldBefore
            ? ` Now holding ${result.held}.`
            : ''),
      );
    } catch (error) {
      setCraftNote(
        error instanceof Error ? error.message : 'Crafting failed.',
      );
    }
    refreshInventory();
  };

  const handleHarvest = (request: HarvestRequest) => {
    // The press is the whole UI-side action: the bus comment says
    // no listener grants items yet, so nothing here grants, counts,
    // or previews an outcome. Outcome feedback arrives with the
    // harvest outcome events (see the header).
    bus.emit('harvest:requested', request);
  };

  return (
    <div className="relative w-full h-screen bg-[#121612] overflow-hidden font-mono text-[#f0ead6]">
      {/* 3D viewport */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* World-anchored overlay: harvest buttons + outcome feedback. */}
      <div className="pointer-events-none absolute inset-0 z-30">
        <ProximityHarvestButtons
          targets={harvestTargets}
          onHarvest={handleHarvest}
        />
        {feedbacks.map((feedback) => (
          <Fragment key={feedback.id}>
            <WorldAnchor x={feedback.x} y={feedback.y}>
              <ObjectFeedback text={feedback.text} tone={feedback.tone} />
            </WorldAnchor>
          </Fragment>
        ))}
      </div>

      {/* HUD shell: needs row (awaiting survival systems) + HUD block. */}
      <HudShell>
        <div className="pointer-events-auto m-2 max-w-sm">
          <h1 className="text-lg tracking-widest">SILENT EARTH</h1>
          <div className="mt-2 text-xs space-y-1">
            <p>
              Camera:{' '}
              {cameraMode === 'first'
                ? 'First-person'
                : 'Third-person overhead'}{' '}
              <span className="opacity-60">(press V or C)</span>
            </p>
            <p>
              Position: {position.x.toFixed(1)}, {position.z.toFixed(1)}
            </p>
            <p>Ground here: {biomeText}</p>
            <p>Chunks loaded: {chunkCount}</p>
            <p>Seed: {seed}</p>
            <p>Tool: {heldItem}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setInventoryOpen((open) => !open)}
              aria-pressed={inventoryOpen}
              className="rounded bg-[#3a4436] px-3 py-1 text-xs hover:bg-[#4a5546]"
            >
              Inventory
            </button>
            <button
              type="button"
              onClick={() => setCraftingOpen((open) => !open)}
              aria-pressed={craftingOpen}
              className="rounded bg-[#3a4436] px-3 py-1 text-xs hover:bg-[#4a5546]"
            >
              Crafting
            </button>
            <CameraToggle
              perspective={cameraMode}
              onChange={(picked) => {
                if (picked !== cameraMode) {
                  playerRef.current?.toggleCamera();
                }
              }}
            />
          </div>
          <div className="mt-3">
            <WitchHealth />
          </div>
        </div>
      </HudShell>

      {/* Panels column (right side). */}
      <div className="pointer-events-auto absolute right-2 top-20 z-30 flex max-h-[calc(100vh-6rem)] w-80 max-w-[calc(100vw-1rem)] flex-col gap-2 overflow-y-auto">
        {inventoryOpen ? (
          <InventoryPanel
            items={inventoryItems}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            capacityText={capacityText}
            onClose={() => setInventoryOpen(false)}
          />
        ) : null}
        {craftingOpen ? (
          <CraftingMenu
            recipes={craftingRecipes}
            selectedRecipeId={selectedRecipeId}
            onSelectRecipe={setSelectedRecipeId}
            onCraft={handleCraft}
            onClose={() => setCraftingOpen(false)}
          />
        ) : null}
        {craftNote ? (
          <p className="rounded bg-black/50 px-2 py-1 text-xs text-stone-200">
            {craftNote}
          </p>
        ) : null}
      </div>

      {/* Seed controls */}
      <div className="absolute bottom-0 left-0 z-30 flex items-center gap-2 p-4">
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
      <div className="absolute bottom-0 right-0 z-30 p-4 text-right text-xs opacity-70 pointer-events-none">
        <p>WASD to walk</p>
        <p>V / C to switch camera</p>
        {cameraMode === 'first' && <p>Click the world to capture the mouse</p>}
      </div>

      {/* Camera transition overlay (vignette at rest, fade on switch). */}
      <CameraTransition switching={switching} />
    </div>
  );
}
