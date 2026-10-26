/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign shell — UI wired (wiring round, 2026-10-26).
 * This mounts the Three.js world and the staged UI on top of it:
 * HudShell (needs row awaiting survival systems), the scaffold
 * readout folded into the HUD (camera, position, ground here,
 * chunks, seed), WitchHealth unwired (awaiting health system),
 * HungerIndicator live on the real Systems stage (see the hunger
 * note below), WornList + ShelteredIndicator in the HUD,
 * FireState + PlacementPreview staged unmounted (see the MVP
 * notes below),
 * InventoryPanel on the real PersonalInventory, CraftingMenu on
 * the real Systems recipes + canCraft + executeCraft (the helper
 * App wiring is meant to call, which also reports the owned tool),
 * ProximityHarvestButtons subscribed to 'harvest:inRange' with
 * world-to-screen projection, and the CameraTransition overlay on
 * 'camera:switched'.
 *
 * WHAT IS DELIBERATELY NOT HERE (read before extending):
 * - Harvest outcome: the shell owns exactly ONE outcome listener
 *   (createHarvestOutcomeListener, boot effect, disposed on
 *   unmount — a second one would double-grant). It is fed the
 *   shell's inventory and the owned-tool tier query, so presses
 *   resolve through Background's outcome order (range re-check,
 *   permit, multi-step progress, yields, capacity, depletion).
 *   Feedback below renders ONLY what those events carry:
 *   'harvest:completed' yields as carried, 'harvest:failed'
 *   reasons as carried (with attempted yields named on
 *   'inventory-full' only, as the event defines), and
 *   'harvest:progress' fractions as carried. Nothing here
 *   invents a yield, a reason, or a progress value.
 * - Station presence: crafting checks the real presence query
 *   (stationPresence on the current generator at her position,
 *   mapped through stationContextForPresence). A stump within
 *   harvest range means 'workstation'; anything else reads as
 *   unavailable — no placeholder stations are invented, and other
 *   stations (wheel, loom, kiln, hearth) correctly stay
 *   unavailable until they exist. The raw generator is used
 *   because stumps are never depleted, so it gives the same
 *   stump set as the renderer's depletion-wrapped generator.
 * - Inventory capacity mode: PINNED by Adam 2026-10-26 — a large
 *   basket REPLACES a small basket (full kit: pockets 10 + apron
 *   10 + large 50 = 70). The shell constructs PersonalInventory
 *   directly with largeBasketMode 'replace' — the ruled mode, not
 *   Systems' temporary wiring placeholder, which this shell no
 *   longer references (Systems deletes the placeholder function
 *   separately). The modes coincide right after the upgrade in
 *   normal play (the upgrade consumes the small basket); they
 *   diverge only if she later holds both baskets at once.
 * - Remove option (Adam, 2026-10-26): alongside normal harvest,
 *   she may TOTALLY REMOVE a plant — more resources at once, but
 *   the plant is gone permanently (no regrow), for clearing
 *   ground for a house. Wired to Background's documented shape
 *   (2003619): a remove press is 'harvest:requested' with action
 *   'remove' — same event, not a second channel. The outcome
 *   grants primary base x 3 + bonus roll + all secondaries, and
 *   marks the plant removed permanently. The button renders on
 *   every scatter target (removability is outcome-time: plant-
 *   like sources only, so a remove press on a log, stone, bone,
 *   salt, silt, or anchor returns an honest 'not-removable'
 *   failure through the existing feedback path); ground targets
 *   never get one. The "Remove" label is the lane's pick,
 *   flagged, not pinned. Feedback for a remove completion shows
 *   the yields exactly as carried, like any harvest.
 * - Owned tool (Adam correction, 2026-10-26 — owning is
 *   sufficient, no equipping): there is no held/equipped slot.
 *   The owned tool is the highest-stage ladder tool present in
 *   inventory ('none' when none), read fresh via owned-tool.ts.
 *   Crafting a ladder tool owns it by putting it in inventory;
 *   upgrading advances the owned tier by consuming its
 *   predecessor. A failed craft touches neither inventory nor
 *   owned tier. The HUD shows the owned tool from inventory,
 *   not from an invented slot.
 * - Controllers untouched: no renderer/player edits in this round
 *   (facing ease and any controller change need a separate claim).
 *   The camera geometry below replicates the renderer from player
 *   state because the renderer keeps its camera private; see
 *   src/ui/worldProjection.ts — a future renderer accessor would
 *   replace that replication.
 * - Health and ambience: WitchHealth stays unwired (no value, so it
 *   renders its awaiting note); Effects.tsx / useAtmosphere.ts stay
 *   unimported.
 * - Hunger indicator, LIVE (Adam, 2026-10-26): the shell owns
 *   one HungerState (starts fully fed) and ticks it in real
 *   seconds (1 s interval, disposed on unmount). The stage
 *   feeds three places from the one meter: HungerIndicator
 *   (stage prop, so the awaiting note is gone and the
 *   too-hungry hint line shows only on a real too-hungry
 *   stage), the player's hunger-stage query (movement
 *   slowdown), and the harvest outcome listener's hunger
 *   query (too-hungry harvest lockout except exempt sources).
 *   Crafts pass the meter to executeCraft, so the too-hungry
 *   crafting lockout bites (a blocked craft reports hunger in
 *   the craft note; the menu itself does not pre-block, since
 *   canCraft carries no hunger gate — pressing Craft while
 *   too-hungry yields the honest error, not a silent no-op).
 *   No eat button is built in this round (stage wiring only,
 *   per the brief); Systems' eat() is the follow-up surface.
 *   Hunger is not health: WitchHealth is untouched.
 * - FIRE UI (Adam, 2026-10-26): campfire / hearth / kiln /
 *   bloomery are craftable TODAY through the existing
 *   CraftingMenu (draft recipes, unstated stations), and they
 *   land in inventory as items. What does NOT exist yet is
 *   placement, fire state, or cooking execution — the fire
 *   system is explicitly not yet built — so FireState (lit /
 *   unlit / cooking chip at the object) and PlacementPreview
 *   (shared ghost preview for fire + shelter placement) are
 *   staged UNMOUNTED in src/ui/, verified, awaiting fire
 *   objects and their state. No fire state is invented, no
 *   flame mesh is duplicated (3D flames are Background's
 *   renderer), and cooking stays open-fire in the docs (stick
 *   or fire-buried, never pot cooking). Fire actions, when
 *   fire objects land, ride the existing ContextMenu with
 *   caller-supplied actions. CANDLE NOTE: the avatar /
 *   portrait candle is untouched, and nothing here assumes
 *   the candle lights fires — that relation is flagged open
 *   for Adam's call.
 * - SHELTER UI (Adam, 2026-10-26): house recipes (lean-to,
 *   thatch hut, woven cottage, small wooden hut) are craftable
 *   TODAY through CraftingMenu, but placement does not exist
 *   yet — no house positions, no placed-house state — so the
 *   sheltered indicator mounts with sheltered=false (the
 *   weather module's current default: unsheltered until
 *   housing supplies positions) and reads "Unsheltered". The
 *   moment housing supplies placed positions, App passes the
 *   real value and the "Sheltered" pill appears at home.
 *   Placement is free (no zones/plots) when it lands, and the
 *   staged PlacementPreview carries no plot frame. HOME
 *   STORAGE, FLAGGED: no home inventory exists yet, so
 *   nothing is surfaced; when one lands it rides the EXISTING
 *   InventoryPanel pattern (items + capacity text), which
 *   already fits — no separate storage panel is invented.
 * - CLOTHES UI (Adam, 2026-10-26): the loom itself is
 *   craftable TODAY through CraftingMenu (draft recipe), but
 *   its products are TBD and NO garment items or garment
 *   recipes exist yet — so no garment can be crafted or worn
 *   today. WornList mounts with the factual empty set
 *   ("Wearing: none", "Protection: none", computed from the
 *   engine's own garment table via clothingRemaining, not a
 *   UI-side table). BONUS DIVERGENCE, FLAGGED NOT SMOOTHED:
 *   the brief lists hat +1, shawl +3, cloak +6, but those
 *   numbers match no table in the repo or docs, and list no
 *   bonus for mittens or boots; the engine's only garment
 *   numbers are the weather module's per-element percentages
 *   (lane-decided, flagged for pin pass: cloak rain 40% /
 *   wind 30%, shawl cold 30%, Pointy Hat rain 15%, Mossy
 *   Mittens cold 15%, bog boots wet 40% + bog-travel
 *   mitigation). Until Adam reconciles the two scales, the
 *   UI shows the engine's percentages (the protection the
 *   player actually experiences), and the +1/+3/+6 scale is
 *   flagged here for his call, not rendered as engine truth.
 *
 * POINTER DISCIPLINE: overlays are pointer-events-none except the
 * small interactive pieces (HUD buttons, panels, harvest buttons),
 * so world clicks — including the first-person mouse-capture click
 * — still reach the canvas. HudShell's content area was fixed to
 * pointer-events-none for exactly this reason.
 */

import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createWorldGen } from './game/worldgen';
import { WorldRenderer } from './game/renderer';
import { PlayerController } from './game/player';
import { bus, type EventMap } from './game/events';
import {
  createHarvestOutcomeListener,
  stationContextForPresence,
  stationPresence,
} from './game/harvest';
import { BIOME_BY_ID } from './game/biomes';
import {
  DEFAULT_SEED,
  PLAYER_EYE_HEIGHT,
  THIRD_PERSON_OFFSET,
} from './constants';
import type { CameraMode, BiomeWeights } from './types';
import { HudShell } from './ui/HudShell';
import { WitchHealth } from './ui/WitchHealth';
import { HungerIndicator } from './ui/HungerIndicator';
import { ShelteredIndicator } from './ui/ShelteredIndicator';
import { WornList, type WornGarment } from './ui/WornList';
import { CameraToggle } from './ui/CameraToggle';
import { InventoryPanel } from './ui/InventoryPanel';
import { CraftingMenu } from './ui/CraftingMenu';
import { ProximityHarvestButtons } from './ui/ProximityHarvestButtons';
import { InteractionProgress } from './ui/InteractionProgress';
import { ObjectFeedback } from './ui/ObjectFeedback';
import { WorldAnchor } from './ui/WorldAnchor';
import { CameraTransition } from './ui/CameraTransition';
import { CAMERA_TRANSITION } from './ui/cameraPresentation';
import { projectWorldToScreen } from './ui/worldProjection';
import type { HarvestTarget, HarvestRequest } from './ui/proximityHarvest';
import { removeRequestFor } from './ui/proximityHarvest';
import type {
  InventoryItem,
  CraftingRecipe,
  FeedbackTone,
} from './ui/types';
import { PersonalInventory } from './systems/inventory';
import { executeCraft } from './systems/crafting-execution';
import { HungerState, type HungerStage } from './systems/hunger';
import { clothingRemaining } from './game/weather';
import {
  ownedTier,
  ownedToolItem,
  type OwnedToolItem,
} from './systems/owned-tool';
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

/** One in-progress multi-step harvest, anchored at its object. */
interface ProgressItem {
  targetId: string;
  fraction: number;
  label: string;
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

  // The shell owns the one personal inventory, built directly
  // with the ruled large-basket mode (see the header — 'replace',
  // pinned by Adam 2026-10-26, total 70).
  const inventoryRef = useRef<PersonalInventory | null>(null);
  if (inventoryRef.current === null) {
    inventoryRef.current = new PersonalInventory({
      largeBasketMode: 'replace',
    });
  }
  const inventory = inventoryRef.current;

  // The shell owns the one hunger meter, built directly (starts
  // fully fed). Systems owns the meter's shape; the shell owns
  // the instance, ticks it, and hands its stage query to the
  // engine consumers (see the boot effect). One meter, read
  // everywhere — no second hunger value lives in this file.
  const hungerRef = useRef<HungerState | null>(null);
  if (hungerRef.current === null) {
    hungerRef.current = new HungerState();
  }
  const hunger = hungerRef.current;
  const [hungerStage, setHungerStage] = useState<HungerStage>(
    hunger.stage(),
  );

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
  const [ownedItem, setOwnedItem] = useState<OwnedToolItem>(() =>
    ownedToolItem(inventory),
  );
  const [harvestTargets, setHarvestTargets] = useState<HarvestTarget[]>([]);
  // Harvest outcome feedback + multi-step progress, rendered
  // through WorldAnchor + ObjectFeedback / InteractionProgress.
  // Populated only by the outcome events (see the header) — never
  // by invented yields or progress.
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);

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
  const feedbackCounterRef = useRef(0);
  const feedbackTimersRef = useRef<Map<string, number>>(new Map());

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

  // Project one world point to a screen anchor. Reads refs only, so
  // the boot effect's first-render copy stays valid. Ground points
  // clamp to the screen edge (the ground at her feet is a direction,
  // not a distant object); off-screen or behind-camera scatter
  // points return null (dropping beats clamping onto the wrong
  // object). Scatter anchors float ~1 m above the object's feet so
  // the chip sits on the thing, not under it — a presentation
  // offset, not a game fact.
  const projectAnchor = (
    x: number,
    z: number,
    kind: 'scatter' | 'ground',
  ): { x: number; y: number } | null => {
    const player = playerRef.current;
    const container = containerRef.current;
    if (!player || !container) return null;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return null;
    const point = projectWorldToScreen({
      worldX: x,
      worldY: kind === 'ground' ? 0 : 1,
      worldZ: z,
      playerX: player.x,
      playerZ: player.z,
      pitch: player.pitch,
      yaw: player.yaw,
      mode: player.mode,
      aspect: width / height,
      eyeHeight: PLAYER_EYE_HEIGHT,
      thirdOffset: THIRD_PERSON_OFFSET,
    });
    if (!point) return null;
    if (kind === 'ground') {
      return { x: clampPercent(point.x), y: clampPercent(point.y) };
    }
    if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) {
      return null;
    }
    return point;
  };

  // Re-project the last in-range targets from current player state.
  // Every camera change (move, look, switch, resize) flows through
  // an event that calls this.
  const recomputeAnchors = () => {
    const projected: HarvestTarget[] = [];
    for (const target of busTargetsRef.current) {
      const anchor = projectAnchor(target.x, target.z, target.kind);
      if (!anchor) continue;
      projected.push({
        id: target.id,
        sourceId: target.sourceId,
        name: target.name,
        kind: target.kind,
        anchorX: anchor.x,
        anchorY: anchor.y,
        worldX: target.x,
        worldZ: target.z,
      });
    }
    setHarvestTargets(projected);
  };

  // Show a feedback chip for 4 seconds, then remove it. Caller-timed,
  // as ObjectFeedback requires — the chip itself owns no timer.
  const showFeedback = (text: string, tone: FeedbackTone, x: number, y: number) => {
    const id = `fb-${feedbackCounterRef.current++}`;
    setFeedbacks((current) => [...current, { id, text, tone, x, y }]);
    const timer = window.setTimeout(() => {
      setFeedbacks((current) => current.filter((item) => item.id !== id));
      feedbackTimersRef.current.delete(id);
    }, 4000);
    feedbackTimersRef.current.set(id, timer);
  };

  // Anchor for an outcome event: the target's last known position
  // when it is still in range, else her own position (e.g. a failed
  // press on a target that already left range).
  const anchorForOutcome = (
    targetId: string,
    kind: 'scatter' | 'ground',
  ): { x: number; y: number } | null => {
    const target = busTargetsRef.current.find((t) => t.id === targetId);
    if (target) {
      return projectAnchor(target.x, target.z, target.kind);
    }
    const player = playerRef.current;
    if (!player) return null;
    return projectAnchor(player.x, player.z, kind);
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
    // Hunger wiring (see the header): the engine reads the stage
    // through this query — movement slowdown + harvest lockout.
    player.setHungerStageQuery(() => hunger.stage());
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
    // The shell's one harvest outcome listener (see the header):
    // presses resolve through it into the shell's inventory, and
    // its completed/failed/progress events drive the feedback below.
    const unsubHarvestOutcome = createHarvestOutcomeListener({
      gen: () => genRef.current,
      inventory,
      getToolTier: () => ownedTier(inventory),
      getHungerStage: () => hunger.stage(),
    });
    // Hunger clock: drain in real seconds and refresh the HUD
    // stage. setHungerStage with an unchanged stage bails out
    // in React, so steady-state ticks cost no re-render.
    const hungerTimer = window.setInterval(() => {
      hunger.tick(1);
      setHungerStage(hunger.stage());
    }, 1000);
    const offCompleted = bus.on('harvest:completed', (p) => {
      refreshInventory();
      setProgressItems((current) =>
        current.filter((item) => item.targetId !== p.targetId),
      );
      const anchor = anchorForOutcome(p.targetId, p.kind);
      if (anchor) {
        showFeedback(
          p.yields.map((y) => `${y.item} × ${y.quantity}`).join(', '),
          'gain',
          anchor.x,
          anchor.y,
        );
      }
    });
    const offFailed = bus.on('harvest:failed', (p) => {
      setProgressItems((current) =>
        current.filter((item) => item.targetId !== p.targetId),
      );
      const anchor = anchorForOutcome(p.targetId, p.kind);
      if (!anchor) return;
      const text =
        p.reason === 'inventory-full' && p.yields.length > 0
          ? `Pack full — ${p.yields.map((y) => `${y.item} × ${y.quantity}`).join(', ')} didn't fit.`
          : `Harvest failed: ${p.reason}.`;
      showFeedback(text, 'blocked', anchor.x, anchor.y);
    });
    const offProgress = bus.on('harvest:progress', (p) => {
      const target = busTargetsRef.current.find(
        (t) => t.id === p.targetId,
      );
      const anchor = target
        ? projectAnchor(target.x, target.z, target.kind)
        : null;
      if (!anchor) return;
      setProgressItems((current) => {
        const rest = current.filter(
          (item) => item.targetId !== p.targetId,
        );
        return [
          ...rest,
          {
            targetId: p.targetId,
            fraction: p.progress,
            label: target.name,
            x: anchor.x,
            y: anchor.y,
          },
        ];
      });
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
      window.clearInterval(hungerTimer);
      window.clearTimeout(transitionTimerRef.current);
      for (const timeout of feedbackTimersRef.current.values()) {
        window.clearTimeout(timeout);
      }
      feedbackTimersRef.current.clear();
      window.removeEventListener('resize', onResize);
      offCamera();
      offMoved();
      offLooked();
      offInRange();
      offCompleted();
      offFailed();
      offProgress();
      unsubHarvestOutcome();
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

  // Station context from the real presence query at her position
  // (see the header): a stump within harvest range means
  // 'workstation', otherwise null. Recomputed when she moves or
  // the world regenerates; stumps are never depleted, so the raw
  // generator gives the same stump set as the wrapped one.
  const station: StationContext = useMemo(() => {
    return stationContextForPresence(
      stationPresence(genRef.current, position.x, position.z),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.x, position.z, seed]);

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
    const ownedBefore = ownedToolItem(inventory);
    try {
      const result = executeCraft(recipe, inventory, station, hunger);
      setOwnedItem(result.owned);
      setCraftNote(
        `Crafted ${result.output.item} × ${result.output.quantity}.` +
          (result.owned !== ownedBefore
            ? ` Owned tool is now ${result.owned}.`
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
    // The press is the whole UI-side action: the outcome listener
    // (boot effect) resolves it into items, failure, or progress,
    // and the completed/failed/progress subscriptions above render
    // the feedback. Nothing here grants, counts, or previews an
    // outcome ahead of those events.
    bus.emit('harvest:requested', request);
  };

  const handleRemove = (target: HarvestTarget) => {
    // Same shape as a harvest press, action 'remove' (Background's
    // documented shape, 2003619): the outcome listener resolves
    // it into the bigger one-time yield or an honest failure
    // ('not-removable' for logs, stones, and the like). Nothing
    // here pre-judges removability or previews a yield.
    bus.emit('harvest:requested', removeRequestFor(target));
  };

  // Wardrobe + shelter hooks (see the header): no wardrobe
  // system and no housing state exist yet, so the worn set is
  // empty and sheltered is false — the engine's current truth,
  // not guesses. The protection note comes from the engine's
  // own garment table via clothingRemaining.
  const wornGarments: WornGarment[] = [];
  const sheltered = false;
  const wornRemaining = clothingRemaining(wornGarments);
  const protectionNote =
    wornGarments.length === 0
      ? 'Protection: none'
      : `Protection: rain ${Math.round((1 - wornRemaining.rain) * 100)}% · wind ${Math.round((1 - wornRemaining.wind) * 100)}% · cold ${Math.round((1 - wornRemaining.cold) * 100)}% · wet ${Math.round((1 - wornRemaining.wet) * 100)}%`;

  return (
    <div className="relative w-full h-screen bg-[#121612] overflow-hidden font-mono text-[#f0ead6]">
      {/* 3D viewport */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* World-anchored overlay: harvest buttons + outcome feedback. */}
      <div className="pointer-events-none absolute inset-0 z-30">
        <ProximityHarvestButtons
          targets={harvestTargets}
          onHarvest={handleHarvest}
          onRemove={handleRemove}
        />
        {feedbacks.map((feedback) => (
          <Fragment key={feedback.id}>
            <WorldAnchor x={feedback.x} y={feedback.y}>
              <ObjectFeedback text={feedback.text} tone={feedback.tone} />
            </WorldAnchor>
          </Fragment>
        ))}
        {progressItems.map((item) => (
          <Fragment key={item.targetId}>
            <WorldAnchor x={item.x} y={item.y}>
              <InteractionProgress
                fraction={item.fraction}
                label={item.label}
              />
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
            <p>Owned tool: {ownedItem}</p>
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
          <div className="mt-2">
            <HungerIndicator stage={hungerStage} />
          </div>
          <div className="mt-2">
            <WornList worn={wornGarments} protectionNote={protectionNote} />
          </div>
          <div className="mt-2">
            <ShelteredIndicator sheltered={sheltered} />
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
