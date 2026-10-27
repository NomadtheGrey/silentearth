/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Three.js scene manager for Silent Earth landing 1: chunk streaming,
 * harvest-source scatter rendering (shapes from src/game/objects.ts),
 * procedural per-biome ground textures, switchable cameras, and a placeholder
 * witch character mesh (capsule + hat — NOT art, a stand-in so the
 * third-person camera has something to follow).
 *
 * Streaming: every frame, chunks within STREAM_RADIUS_CHUNKS of the
 * player's chunk are present; anything farther is disposed. Because chunk
 * contents are pure functions of (seed, cx, cz), streaming never changes
 * the world — it only changes which part is resident.
 *
 * Rendering cost is kept low with InstancedMesh: one instanced mesh per
 * scatter kind per chunk, sharing one geometry + material per kind.
 * Scatter geometry is built in src/game/models.ts (detailed merged
 * procedural models, vertex-colored): composite kinds that used to
 * need a second instanced mesh for their extra primitive now render
 * as ONE merged mesh, so draw calls per chunk stay flat or fall.
 */

import * as THREE from 'three';
import { bus } from './events';
import type { WorldGen } from './worldgen';
import { PlayerController } from './player';
import { marshWeight } from './biomes';
import { SOURCE_FOR_KIND } from './objects';
import { buildCandle, buildKindGeometry, buildUmbrella, buildWitch, CANDLE_FLAME_Y, vertexLambert } from './models';
import { ProximityTracker } from './proximity';
import {
  harvestState,
  SHRINK_SCALE,
  SAPLING_GROWTH_MS,
  scatterTargetId,
  wrapGenWithState,
} from './harvestState';
import { terrainSpeedAt } from './movement';
import { fireState } from './fireState';
import { FIRE_DEFS } from './fire';
import { shelterState, HOUSE_DEFS } from './shelter';
import { loomState } from './loomState';
import { pileState } from './pileState';
import { trapState } from './trapState';
import type { TrapType } from './traps';
import { pauseState } from './pause';
import { SkyRig } from './sky';
import { SEASON_START_MONTH, seasonalWeatherAt } from './weather';
import { createBiomeTexture, TEXTURE_REPEAT } from './terrain';
import {
  CHUNK_SIZE,
  GROUND_SEGMENTS,
  STREAM_RADIUS_CHUNKS,
  PLAYER_EYE_HEIGHT,
  THIRD_PERSON_OFFSET,
  BEHIND_CAMERA_DISTANCE,
  BEHIND_CAMERA_HEIGHT,
  BEHIND_LOOK_AHEAD,
  BEHIND_LOOK_HEIGHT,
} from '../constants';
import type { BiomeId, ScatterKind } from '../types';

interface KindRender {
  /**
   * Shared merged geometry (baked orientation: logs lie along X,
   * discs lie flat; former extra primitives — canopy, stump top,
   * seed-head — are merged in at (extraY - baseY), so the old
   * `obj.y + baseY * s` placement still lands them correctly).
   */
  geometry: THREE.BufferGeometry;
  /** Shared vertex-colored material (white; geometry carries color). */
  material: THREE.Material;
  /** Base height of the instance above ground (before scatter y). */
  baseY: number;
}

function lambert(color: number, opacity = 1): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ color });
  if (opacity < 1) {
    mat.transparent = true;
    mat.opacity = opacity;
  }
  return mat;
}

/** One shared geometry per mesh shape, built from the source descriptors
 *  in src/game/objects.ts (fill-in landing, 2026-10-25). Landing 1's
 *  placeholder primitives are replaced by these: distinct silhouettes
 *  per source (stump, reed, bog tuft, oak log, ...) with source colors. */
/** Render table derived from the harvest-source definitions, so mesh and
 *  data can never drift apart: change a source color in objects.ts
 *  and its detailed model follows (models.ts builds from those
 *  colors). One merged geometry + vertex-colored material per kind,
 *  shared by all instances — the InstancedMesh perf model is
 *  unchanged, and former extra primitives now ride inside the one
 *  geometry instead of a second instanced mesh. */
const KIND_RENDER: Record<ScatterKind, KindRender> = (() => {
  const table = {} as Record<ScatterKind, KindRender>;
  for (const [kind, source] of Object.entries(SOURCE_FOR_KIND) as [
    ScatterKind,
    (typeof SOURCE_FOR_KIND)[ScatterKind],
  ][]) {
    table[kind] = {
      geometry: buildKindGeometry(source.mesh, kind),
      material: vertexLambert(kind === 'standingWater' ? 0.75 : 1),
      baseY: source.mesh.baseY,
    };
  }
  return table;
})();

interface LoadedChunk {
  group: THREE.Group;
  meshes: THREE.InstancedMesh[];
  ground: THREE.Mesh;
}

/**
 * Carried-candle light tunables (Adam 2026-10-26 — lane-decided
 * starting values for his pin pass; three 0.186 uses physical
 * point-light units, so intensity reads in candela with decay 2:
 * ~2.5 at 2 m, ~0.6 at 4 m, ~0.16 at 8 m — a warm pool around
 * her, not a floodlight. Err toward useful: night foraging is
 * near-impossible without this. Always lit, both views.
 */
export const CANDLE_LIGHT_COLOR = 0xffb45e;
export const CANDLE_LIGHT_INTENSITY = 10;
export const CANDLE_LIGHT_DISTANCE = 16;
export const CANDLE_LIGHT_DECAY = 2;
export const CANDLE_FLICKER_AMPLITUDE = 0.12;
/**
 * Placed-fire light tunables (Adam 2026-10-26 — lane-decided
 * starting values for his pin pass; same physical units as the
 * candle: a lit fire is a camp light, stronger and wider than
 * the candle's hand pool. One PointLight per lit fire with
 * flameWhenLit; unlit fires cast nothing. Flicker is stronger
 * than the candle's (±22% vs ±12%) — fires dance more.
 */
export const FIRE_LIGHT_COLOR = 0xff9a40;
export const FIRE_LIGHT_INTENSITY = 40;
export const FIRE_LIGHT_DISTANCE = 24;
export const FIRE_LIGHT_DECAY = 2;
export const FIRE_LIGHT_FLICKER_AMPLITUDE = 0.22;
/** Flame color-breathing endpoints (outer cone deep-orange ↔ bright gold). */
const FLAME_OUTER_A = new THREE.Color(0xff6a00);
const FLAME_OUTER_B = new THREE.Color(0xffb020);
/** Flame color-breathing endpoints (inner core yellow ↔ pale gold). */
const FLAME_INNER_A = new THREE.Color(0xffd23f);
const FLAME_INNER_B = new THREE.Color(0xfff0a0);
/**
 * Position-hash phase for a flame or fire light at (x, z) — the
 * same hash flame meshes use, so a fire's light flickers in
 * phase with its flame. Pure and deterministic.
 */
export function flamePhase(x: number, z: number): number {
  return Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * Math.PI * 2;
}
/**
 * Mixed-sine flicker factor in [-1, 1] for a fire light (the
 * candle's mixed sines, phase-shifted per fire so fires don't
 * sync). Pure and deterministic.
 */
export function fireLightFlicker(flameTime: number, phase: number): number {
  return (Math.sin(flameTime * 10 + phase) + Math.sin(flameTime * 23 + phase + 1.7)) / 2;
}
/** Witch-local hand position of the candle group (left hand). */
export const CANDLE_HAND: Readonly<{ x: number; y: number; z: number }> = {
  x: -0.55,
  y: 1.02,
  z: 0.05,
};

/**
 * Rotate a witch-local (x, z) offset by a Y-rotation (facing)
 * into world space: the same transform the witch group's
 * rotation.y applies (local +z maps to (sin facing, cos facing)
 * — see the behind-camera comment in the loop). Pure, probed.
 */
export function rotateOffsetY(lx: number, lz: number, facing: number): [number, number] {
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  return [lx * c + lz * s, -lx * s + lz * c];
}

export class WorldRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private chunks = new Map<string, LoadedChunk>();
  private witch: THREE.Group;
  /** Carried umbrella graphic (models.ts), attached to the witch. */
  private umbrella: THREE.Group;
  /** Carried-candle point light (scene-level — see below). */
  private candleLight: THREE.PointLight;
  /** Placed-fire point lights (scene-level, rebuilt with the placed group). */
  private fireLights: THREE.PointLight[] = [];
  private gen: WorldGen;
  private player: PlayerController;
  /** Proximity tracker: engine-owned, subscribes to 'player:moved' and
   *  emits 'harvest:inRange' for the UI lane's harvest buttons. It is
   *  mechanics, not presentation — the renderer only hosts it so no
   *  App.tsx wiring (and no claim) is needed to get it running. */
  private proximity: ProximityTracker;
  /** Unsubscribe for the harvest:completed chunk reload (below). */
  private unsubHarvestCompleted: (() => void) | null = null;
  /** Spawned-object meshes (spawned logs + growing saplings):
   *  rebuilt on every world tick, only for loaded chunks. */
  private spawnedGroup: THREE.Group | null = null;
  /**
   * Player-placed meshes (fires + houses): rebuilt on placement
   * and lighting events, NOT chunk-filtered — placed entities
   * are few and free-placed anywhere, so they all render.
   * Flame meshes carry userData.flame + userData.phase and pulse
   * in the loop (see flameTime).
   */
  private placedGroup: THREE.Group | null = null;
  /** Unsubscribes for the placed-group rebuild events (below). */
  private unsubPlaced: (() => void)[] = [];
  /**
   * Dropped-pile meshes (harvest overflow, Adam 2026-10-26): one
   * small heap + marker flag per pile, NOT chunk-filtered — piles
   * are few, and a pile must stay visible wherever it lies. Shares
   * the placed-group unsubscribe list (same dispose path).
   */
  private pileGroup: THREE.Group | null = null;
  /** Placed-trap markers, rebuilt on 'trap:placed' (below). */
  private trapGroup: THREE.Group | null = null;
  /**
   * Sky rig (Adam 2026-10-26): dome + sun + moon + stars + clouds
   * + the lights they drive. Owns the day/night time driver (see
   * sky.ts) — the renderer just feeds it dt + seasonal weather.
   */
  private sky: SkyRig | null = null;
  /** Stored so the sky rig can drive them (were anonymous before). */
  private sunLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  /** Accumulated time for flame flicker (loop-driven). */
  private flameTime = 0;
  private worldTickAcc = 0;
  private disposed = false;
  /** One shared procedural ground texture per biome (+ marsh), built from
   *  the current world seed. Cached, never per-chunk, so texture cost
   *  stays flat no matter how many chunks stream in. */
  private groundTextures = new Map<string, THREE.DataTexture>();

  constructor(
    container: HTMLElement,
    gen: WorldGen,
    player: PlayerController,
  ) {
    // Harvest-state filtering lives on the generator the renderer
    // (and its proximity tracker) actually use: permanently-removed
    // objects (remove action, taken logs) and felled trees leave
    // freshly generated chunks, so they stop rendering AND stop
    // appearing as targets, while felled stumps are appended. Shrunk
    // objects are NOT filtered — they render at SHRINK_SCALE (see
    // loadChunk). The outcome listener (shell-owned, see
    // harvest.ts) marks state in the shared harvestState.
    this.gen = wrapGenWithState(gen);
    this.player = player;
    // Terrain slow wiring (Adam, 2026-10-26, PINNED): the
    // renderer owns both the generator and the player, so it
    // wires the terrain query itself — no App.tsx change needed.
    // The closure reads this.gen dynamically, so seed changes
    // (setWorldGen) flow through without re-wiring. The wrapped
    // generator delegates fieldsAt/weightsAt untouched, so the
    // slow reads true world data, not harvest state.
    this.player.setTerrainSpeedQuery((x, z) => terrainSpeedAt(this.gen, x, z));
    this.proximity = new ProximityTracker(this.gen);
    // Chunk reload on harvest completion: the harvested chunk is
    // rebuilt, so the object visibly shrinks (or leaves, on remove
    // or a taken log) instead of lingering until the player walks
    // away and the chunk streams out.
    this.unsubHarvestCompleted = bus.on('harvest:completed', (p) => {
      if (p.kind !== 'scatter') return;
      const key = this.chunkKey(p.cx, p.cz);
      if (!this.chunks.has(key)) return;
      this.unloadChunk(p.cx, p.cz);
      this.loadChunk(p.cx, p.cz);
    });
    // Placed-group rebuild on placement + lighting: a new fire,
    // house, or loom appears, and a lit fire gains its flame.
    // Lighting PROGRESS needs no rebuild (only lit state
    // changes meshes).
    const rebuild = (): void => this.rebuildPlacedGroup();
    this.unsubPlaced.push(
      bus.on('fire:placed', rebuild),
      bus.on('fire:lit', rebuild),
      bus.on('shelter:placed', rebuild),
      bus.on('loom:placed', rebuild),
    );
    this.rebuildPlacedGroup();
    // Dropped piles rebuild on their own events (a pile dropped
    // at her feet must appear without a chunk reload).
    const rebuildPiles = (): void => this.rebuildPileGroup();
    this.unsubPlaced.push(
      bus.on('pile:dropped', rebuildPiles),
      bus.on('pile:changed', rebuildPiles),
      bus.on('pile:removed', rebuildPiles),
    );
    this.rebuildPileGroup();
    // Placed traps rebuild on their own event, like piles.
    const rebuildTraps = (): void => this.rebuildTrapGroup();
    this.unsubPlaced.push(bus.on('trap:placed', rebuildTraps));
    this.rebuildTrapGroup();
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );

    // Dim October light: the woods are watching, not sunbathing.
    this.scene.fog = new THREE.FogExp2(0x1a2018, 0.008);
    this.scene.background = new THREE.Color(0x1a2018);
    this.hemiLight = new THREE.HemisphereLight(0x9aa88a, 0x2a2018, 0.9);
    this.scene.add(this.hemiLight);
    this.sunLight = new THREE.DirectionalLight(0xd8d0b0, 0.8);
    this.sunLight.position.set(40, 60, 20);
    this.scene.add(this.sunLight);
    // Sky with content (Adam 2026-10-26): replaces the flat
    // background color as the visible sky (the background color
    // stays only as a fallback behind the dome). The rig drives
    // these same lights from the sun/moon, so light follows the
    // bodies by construction.
    this.sky = new SkyRig(this.scene, this.camera, this.sunLight, this.hemiLight, String(gen.seed));

    // The witch herself: detailed procedural figure (dress, bodice,
    // shawl, head, brimmed hat, arms, boots — models.ts), still
    // placeholder-grade-plus, NOT final art. Visible in
    // third-person, hidden in first-person (you are the witch there).
    this.witch = buildWitch();
    this.scene.add(this.witch);
    // Carried umbrella (Adam 2026-10-26): held in her right hand,
    // canopy beside the hat, slight outward tilt. Attached to the
    // witch group, so it inherits third-person-only visibility
    // (hidden in first-person, where you are the witch). Default
    // hidden — the shell drives it via setCarriesUmbrella (below).
    this.umbrella = buildUmbrella();
    this.umbrella.visible = false;
    this.umbrella.position.set(0.58, 1.08, 0.05);
    this.umbrella.rotation.z = -0.12;
    this.witch.add(this.umbrella);
    // Carried candle (Adam 2026-10-26 — light settled, starter
    // still open): model in her left hand (umbrella holds the
    // right), witch-group child, so third-person-only visibility
    // is free — hidden in first-person, where you are the witch.
    // The LIGHT is scene-level, not a witch child: a child of an
    // invisible group renders nothing, and first-person needs
    // the light even though the model is hidden. Always lit —
    // no day/night gate invented, no setter (unconditional: no
    // item, toggle, or inventory state drives it).
    const candle = buildCandle();
    candle.position.set(CANDLE_HAND.x, CANDLE_HAND.y, CANDLE_HAND.z);
    this.witch.add(candle);
    this.candleLight = new THREE.PointLight(
      CANDLE_LIGHT_COLOR,
      CANDLE_LIGHT_INTENSITY,
      CANDLE_LIGHT_DISTANCE,
      CANDLE_LIGHT_DECAY,
    );
    this.scene.add(this.candleLight);

    window.addEventListener('resize', this.onResize);
    this.loop();
  }

  /**
   * Carried-umbrella visibility (Adam 2026-10-26). The shell calls
   * this when the inventory changes, passing Systems'
   * carriesUmbrella(inventory): the graphic shows exactly when an
   * umbrella is carried — no equip step, and duplicates do not
   * stack, so the shell passes a plain boolean and one graphic is
   * all there ever is. App-side driving is UI's follow-up; until
   * the shell calls this, the umbrella stays hidden (default).
   */
  setCarriesUmbrella(carried: boolean): void {
    if (this.umbrella) this.umbrella.visible = carried;
  }

  /** Ground detail texture for a chunk: the dominant biome's procedural
   *  texture, or the marsh texture when marsh ground character dominates
   *  the chunk center. The vertex-color blend underneath still carries
   *  the continuous biome transition; this is the detail layer on top. */
  private groundTextureFor(cx: number, cz: number): THREE.DataTexture {
    const centerX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
    const centerZ = cz * CHUNK_SIZE + CHUNK_SIZE / 2;
    const fields = this.gen.fieldsAt(centerX, centerZ);
    const id: BiomeId | 'marsh' =
      marshWeight(fields) > 0.5 ? 'marsh' : this.gen.weightsAt(centerX, centerZ).dominant;
    const cached = this.groundTextures.get(id);
    if (cached) return cached;
    const tex = createBiomeTexture(id, this.gen.seed);
    const dataTex = new THREE.DataTexture(
      tex.data,
      tex.width,
      tex.height,
      THREE.RGBAFormat,
    );
    dataTex.wrapS = THREE.RepeatWrapping;
    dataTex.wrapT = THREE.RepeatWrapping;
    dataTex.repeat.set(TEXTURE_REPEAT, TEXTURE_REPEAT);
    dataTex.colorSpace = THREE.SRGBColorSpace;
    dataTex.needsUpdate = true;
    this.groundTextures.set(id, dataTex);
    return dataTex;
  }

  private disposeGroundTextures(): void {
    for (const tex of this.groundTextures.values()) tex.dispose();
    this.groundTextures.clear();
  }

  /** Swap the world generator (seed change): drop all chunks, re-stream. */
  setWorldGen(gen: WorldGen): void {
    // A new seed is a new world: shrink/removed/progress/spawned
    // state (and felled stumps, saplings, cleared spots) does not
    // carry over.
    harvestState.clear();
    // A new seed is a new world: placed fires + houses + looms
    // do not carry over either (they belong to the old world's
    // map).
    fireState.clear();
    shelterState.clear();
    loomState.clear();
    this.rebuildPlacedGroup();
    // Dropped piles belong to the old world's map too.
    pileState.clear();
    this.rebuildPileGroup();
    // Placed traps belong to the old world's map too.
    trapState.clear();
    this.rebuildTrapGroup();
    this.gen = wrapGenWithState(gen);
    // A new world gets a new sky: fresh stars for the seed + the
    // cycle restarts at dawn. Skipped on the dispose path
    // (disposed is already true there) — dispose() removes the
    // rig itself below instead of rebuilding it.
    if (!this.disposed) this.sky?.setSeed(String(gen.seed));
    this.proximity.setGen(this.gen);
    this.disposeGroundTextures();
    for (const [key, loaded] of this.chunks) {
      this.disposeLoaded(loaded);
      this.chunks.delete(key);
    }
    this.rebuildSpawnedGroup();
  }

  get loadedChunkCount(): number {
    return this.chunks.size;
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  dispose(): void {
    this.disposed = true;
    this.unsubHarvestCompleted?.();
    this.unsubHarvestCompleted = null;
    for (const unsub of this.unsubPlaced) unsub();
    this.unsubPlaced = [];
    this.proximity.dispose();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.setWorldGen(this.gen); // clears chunks (also disposes meshes)
    this.sky?.dispose();
    this.sky = null;
    this.disposeGroundTextures();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private onResize = (): void => {
    const container = this.renderer.domElement.parentElement;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private loadChunk(cx: number, cz: number): void {
    const key = this.chunkKey(cx, cz);
    if (this.chunks.has(key)) return;
    const data = this.gen.generateChunk(cx, cz);
    const group = new THREE.Group();

    // Ground: vertex-colored plane. Colors are sampled from the continuous
    // blend function at each vertex's WORLD position, so adjacent chunks
    // agree exactly at their shared edge — no seams by construction.
    const groundGeo = new THREE.PlaneGeometry(
      CHUNK_SIZE,
      CHUNK_SIZE,
      GROUND_SEGMENTS,
      GROUND_SEGMENTS,
    );
    groundGeo.rotateX(-Math.PI / 2);
    const posAttr = groundGeo.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(posAttr.count * 3);
    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;
    for (let i = 0; i < posAttr.count; i++) {
      const wx = originX + posAttr.getX(i) + CHUNK_SIZE / 2;
      const wz = originZ + posAttr.getZ(i) + CHUNK_SIZE / 2;
      const c = this.gen.groundColorAt(wx, wz);
      colors[i * 3] = ((c >> 16) & 0xff) / 255;
      colors[i * 3 + 1] = ((c >> 8) & 0xff) / 255;
      colors[i * 3 + 2] = (c & 0xff) / 255;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ground = new THREE.Mesh(
      groundGeo,
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        map: this.groundTextureFor(cx, cz),
      }),
    );
    ground.position.set(originX + CHUNK_SIZE / 2, 0, originZ + CHUNK_SIZE / 2);
    group.add(ground);

    // Scatter: one InstancedMesh per kind present in this chunk.
    const meshes: THREE.InstancedMesh[] = [];
    const byKind = new Map<ScatterKind, typeof data.objects>();
    for (const obj of data.objects) {
      const list = byKind.get(obj.kind) ?? [];
      list.push(obj);
      byKind.set(obj.kind, list);
    }
    const dummy = new THREE.Object3D();
    const now = Date.now();
    for (const [kind, objs] of byKind) {
      const render = KIND_RENDER[kind];
      const mesh = new THREE.InstancedMesh(render.geometry, render.material, objs.length);
      objs.forEach((obj, i) => {
        // Shrink model (Adam, 2026-10-26): a regrowing object
        // renders at SHRINK_SCALE; fully regrown objects render
        // full-size. The scale applies to the base height too, so a
        // shrunk tree's canopy sits at shrunk height, not floating.
        const s =
          obj.scale *
          (harvestState.isRegrowing(scatterTargetId(cx, cz, obj), now)
            ? SHRINK_SCALE
            : 1);
        dummy.position.set(obj.x, obj.y + render.baseY * s, obj.z);
        dummy.rotation.set(0, obj.rotY, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
      meshes.push(mesh);
      // No extra branch: former extra primitives (canopy, stump
      // top, seed-head) are merged into the one kind geometry
      // (models.ts), so one instanced mesh carries the whole model.
    }

    this.scene.add(group);
    this.chunks.set(key, { group, meshes, ground });
    bus.emit('world:chunkLoaded', { cx, cz, objectCount: data.objects.length });
  }

  /** Remove a chunk's meshes and free per-chunk GPU resources. Shared kind
   *  geometries/materials are NOT disposed — InstancedMesh.dispose() only
   *  frees instance buffers. The ground mesh owns its geometry + material
   *  (vertex colors are per-chunk), so those are disposed. */
  private disposeLoaded(loaded: LoadedChunk): void {
    this.scene.remove(loaded.group);
    for (const mesh of loaded.meshes) mesh.dispose();
    loaded.ground.geometry.dispose();
    (loaded.ground.material as THREE.Material).dispose();
  }

  private unloadChunk(cx: number, cz: number): void {
    const key = this.chunkKey(cx, cz);
    const loaded = this.chunks.get(key);
    if (!loaded) return;
    this.disposeLoaded(loaded);
    this.chunks.delete(key);
    bus.emit('world:chunkUnloaded', { cx, cz });
  }

  /** Keep resident chunks = the square around the player's chunk. */
  private stream(): void {
    const { cx, cz } = this.player.chunk;
    const wanted = new Set<string>();
    for (let dz = -STREAM_RADIUS_CHUNKS; dz <= STREAM_RADIUS_CHUNKS; dz++) {
      for (let dx = -STREAM_RADIUS_CHUNKS; dx <= STREAM_RADIUS_CHUNKS; dx++) {
        wanted.add(this.chunkKey(cx + dx, cz + dz));
      }
    }
    for (const key of [...this.chunks.keys()]) {
      if (!wanted.has(key)) {
        const [ux, uz] = key.split(',').map(Number);
        this.unloadChunk(ux, uz);
      }
    }
    for (const key of wanted) {
      const [lx, lz] = key.split(',').map(Number);
      this.loadChunk(lx, lz);
    }
  }

  /**
   * World tick (every ~2 s, not every frame): regrow + log-spawn
   * bookkeeping. Regrown chunks reload (full-size meshes return);
   * due log spawns are created near trees; spawned-object meshes
   * rebuild (so growing saplings visibly grow). The 2 s cadence is
   * a rendering cadence, not a gameplay timer — regrow/spawn/
   * growth times themselves live in harvestState.ts, and a regrown
   * plant or mature sapling is harvestable the moment its time
   * passes even before its chunk reloads (the tracker checks
   * state, not meshes).
   */
  private worldTick(): void {
    const now = Date.now();
    for (const key of harvestState.pruneExpiredRegrows(now)) {
      const [cx, cz] = key.split(',').map(Number);
      if (this.chunks.has(key)) {
        this.unloadChunk(cx, cz);
        this.loadChunk(cx, cz);
      }
    }
    harvestState.processDueSpawns(now, this.gen);
    this.rebuildSpawnedGroup();
    // Friction lighting display: waits that elapsed become 'ready'
    // (the rub itself checks the clock, so this is display only).
    fireState.advanceLighting(now);
  }

  /**
   * Flame mesh for a lit fire: outer orange cone + inner yellow
   * core, flickering in the loop via userData.flame/phase. Phase
   * is a position hash (no Math.random — render-only, but the
   * habit keeps seeded determinism arguments clean).
   */
  private flameMesh(x: number, z: number, baseY: number, scale: number): THREE.Group {
    const flame = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(0.28 * scale, 0.8 * scale, 7),
      new THREE.MeshBasicMaterial({ color: 0xff6a00 }),
    );
    outer.position.y = 0.4 * scale;
    const inner = new THREE.Mesh(
      new THREE.ConeGeometry(0.15 * scale, 0.45 * scale, 7),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    );
    inner.position.y = 0.22 * scale;
    flame.add(outer, inner);
    flame.position.y = baseY;
    flame.userData.flame = true;
    flame.userData.phase = flamePhase(x, z);
    return flame;
  }

  /** One scene-level point light for a lit fire, at its flame's heart. */
  private addFireLight(x: number, z: number, baseY: number, scale: number): void {
    const light = new THREE.PointLight(
      FIRE_LIGHT_COLOR,
      FIRE_LIGHT_INTENSITY,
      FIRE_LIGHT_DISTANCE,
      FIRE_LIGHT_DECAY,
    );
    light.position.set(x, baseY + 0.5 * scale, z);
    light.userData.phase = flamePhase(x, z);
    this.scene.add(light);
    this.fireLights.push(light);
  }

  /** Rebuild all player-placed meshes (fires + houses + looms). */
  private rebuildPlacedGroup(): void {
    if (this.placedGroup) {
      this.scene.remove(this.placedGroup);
      this.placedGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      this.placedGroup = null;
    }
    // Fire lights rebuild with the placed group: a lit fire's light
    // lives and dies with its flame mesh (unlit = no light).
    // Dispose is safe through this path too — dispose() routes
    // through setWorldGen, which rebuilds from cleared state.
    for (const light of this.fireLights) this.scene.remove(light);
    this.fireLights = [];
    const group = new THREE.Group();
    const box = (
      w: number,
      h: number,
      d: number,
      color: number,
      px: number,
      py: number,
      pz: number,
      ry = 0,
      rx = 0,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
      mesh.position.set(px, py, pz);
      mesh.rotation.y = ry;
      mesh.rotation.x = rx;
      return mesh;
    };
    const cyl = (
      rt: number,
      rb: number,
      h: number,
      color: number,
      px: number,
      py: number,
      pz: number,
      seg = 10,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), lambert(color));
      mesh.position.set(px, py, pz);
      return mesh;
    };
    for (const fire of fireState.snapshot()) {
      const fg = new THREE.Group();
      fg.position.set(fire.x, 0, fire.z);
      const lit = fire.lit && FIRE_DEFS[fire.type].flameWhenLit;
      if (fire.type === 'campfire') {
        // Stone ring (7 stones, not 5), ash bed, three crossed logs.
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          fg.add(box(0.22, 0.18, 0.22, 0x8a8a86, Math.cos(a) * 0.55, 0.09, Math.sin(a) * 0.55, a));
        }
        fg.add(box(0.9, 0.05, 0.9, 0x2b2b2b, 0, 0.03, 0));
        const log1 = cyl(0.06, 0.06, 1.1, 0x6b4a2f, 0, 0.16, 0);
        log1.rotation.z = Math.PI / 2;
        log1.rotation.y = 0.5;
        const log2 = cyl(0.06, 0.06, 1.1, 0x6b4a2f, 0, 0.16, 0);
        log2.rotation.z = Math.PI / 2;
        log2.rotation.y = -0.5;
        const log3 = cyl(0.05, 0.05, 1.0, 0x5a4028, 0, 0.26, 0);
        log3.rotation.z = Math.PI / 2;
        log3.rotation.y = 1.1;
        fg.add(log1, log2, log3);
        if (lit) { fg.add(this.flameMesh(fire.x, fire.z, 0.25, 1)); this.addFireLight(fire.x, fire.z, 0.25, 1); }
      } else if (fire.type === 'hearth') {
        // Stone base, side pillars, mantel, dark firebox opening,
        // inner logs — a hearth, not a slab.
        fg.add(box(1.3, 0.5, 1.3, 0x8a8a86, 0, 0.25, 0));
        fg.add(box(0.25, 0.9, 1.3, 0x7a7a76, -0.55, 0.95, 0));
        fg.add(box(0.25, 0.9, 1.3, 0x7a7a76, 0.55, 0.95, 0));
        fg.add(box(1.4, 0.15, 1.4, 0x7a7a76, 0, 1.45, 0));
        fg.add(box(0.9, 0.7, 0.1, 0x1a1a1a, 0, 0.85, 0.61));
        const hlog = cyl(0.06, 0.06, 0.8, 0x6b4a2f, 0, 0.6, 0.3);
        hlog.rotation.z = Math.PI / 2;
        fg.add(hlog);
        if (lit) { fg.add(this.flameMesh(fire.x, fire.z, 0.6, 1.1)); this.addFireLight(fire.x, fire.z, 0.6, 1.1); }
      } else if (fire.type === 'kiln') {
        // Firing chamber: base slab, body, dome, stoke-hole opening,
        // brick band around the middle.
        fg.add(cyl(0.85, 0.9, 0.15, 0x8a8a86, 0, 0.08, 0));
        fg.add(cyl(0.7, 0.8, 1.2, 0xb08968, 0, 0.6, 0));
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xb08968));
        dome.position.y = 1.2;
        fg.add(dome);
        fg.add(cyl(0.78, 0.78, 0.12, 0x9a7a5a, 0, 0.6, 0));
        fg.add(box(0.4, 0.5, 0.1, 0x1a1a1a, 0, 0.35, 0.78));
        if (lit) { fg.add(this.flameMesh(fire.x, fire.z, 1.9, 0.7)); this.addFireLight(fire.x, fire.z, 1.9, 0.7); }
      } else {
        // Bloomery: stone base, tapering shaft, top rim, stoke-hole,
        // slag pile at the foot.
        fg.add(cyl(0.85, 0.95, 0.4, 0x6e6e6a, 0, 0.2, 0));
        fg.add(cyl(0.55, 0.65, 2.2, 0x5a5a58, 0, 1.5, 0));
        fg.add(cyl(0.6, 0.6, 0.12, 0x4a4a48, 0, 2.6, 0));
        fg.add(box(0.35, 0.45, 0.1, 0x1a1a1a, 0, 0.5, 0.62));
        const slag = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.25, 7), lambert(0x3a3a38));
        slag.position.set(0.7, 0.12, 0.4);
        fg.add(slag);
        if (lit) { fg.add(this.flameMesh(fire.x, fire.z, 2.6, 0.8)); this.addFireLight(fire.x, fire.z, 2.6, 0.8); }
      }
      group.add(fg);
    }
    for (const house of shelterState.snapshot()) {
      const def = HOUSE_DEFS[house.type];
      const f = def.footprint;
      const hg = new THREE.Group();
      hg.position.set(house.x, 0, house.z);
      if (house.type === 'leanTo') {
        hg.add(cyl(0.07, 0.07, 2.2, 0x6b4a2f, -f / 2, 1.1, 0));
        hg.add(cyl(0.07, 0.07, 2.2, 0x6b4a2f, f / 2, 1.1, 0));
        hg.add(box(f + 0.4, 0.12, 1.6, 0x8a7a4a, 0, 1.9, 0, 0, -0.5));
        // Bedroll under the roof + stick back wall.
        const bed = cyl(0.14, 0.14, 1.2, 0x6a5a3a, 0, 0.14, 0.3);
        bed.rotation.z = Math.PI / 2;
        hg.add(bed);
        for (let i = -1; i <= 1; i++) {
          hg.add(cyl(0.04, 0.04, 1.7, 0x6b4a2f, i * (f / 3), 0.85, -0.7));
        }
      } else if (house.type === 'thatchHut') {
        hg.add(cyl(f / 2, f / 2, 1.6, 0xcbb59a, 0, 0.8, 0, 12));
        const roof = new THREE.Mesh(new THREE.ConeGeometry(f / 2 + 0.3, 1.5, 12), lambert(0x8a7a4a));
        roof.position.y = 2.35;
        hg.add(roof);
        hg.add(box(0.7, 1.3, 0.1, 0x3a2812, 0, 0.65, f / 2 + 0.01));
        hg.add(box(0.9, 0.1, 0.5, 0x8a8a86, 0, 0.05, f / 2 + 0.25));
        hg.add(cyl(0.09, 0.09, 0.3, 0x1a1a1a, 0, 3.1, 0));
      } else if (house.type === 'wovenCottage') {
        hg.add(box(f, 2.2, f * 0.8, 0xd8c9a8, 0, 1.1, 0));
        const roof = new THREE.Mesh(new THREE.ConeGeometry(f * 0.75, 1.4, 4), lambert(0x8a7a4a));
        roof.position.y = 2.9;
        roof.rotation.y = Math.PI / 4;
        hg.add(roof);
        hg.add(box(0.8, 1.6, 0.1, 0x4a3220, 0, 0.8, (f * 0.8) / 2 + 0.01));
        // Windows + wattle bands around the wall.
        hg.add(box(0.5, 0.5, 0.06, 0x2a2018, -f / 4, 1.3, (f * 0.8) / 2 + 0.01));
        hg.add(box(0.5, 0.5, 0.06, 0x2a2018, f / 4, 1.3, (f * 0.8) / 2 + 0.01));
        hg.add(box(f + 0.06, 0.08, f * 0.8 + 0.06, 0xb09a6a, 0, 0.6, 0));
        hg.add(box(f + 0.06, 0.08, f * 0.8 + 0.06, 0xb09a6a, 0, 1.7, 0));
      } else {
        hg.add(box(f, 2.6, f * 0.85, 0x7a5a38, 0, 1.3, 0));
        const roof = new THREE.Mesh(new THREE.ConeGeometry(f * 0.72, 1.6, 4), lambert(0x5a3d24));
        roof.position.y = 3.4;
        roof.rotation.y = Math.PI / 4;
        hg.add(roof);
        hg.add(box(0.9, 1.8, 0.1, 0x3a2812, 0, 0.9, (f * 0.85) / 2 + 0.01));
        // Windows, porch posts, chimney.
        hg.add(box(0.5, 0.5, 0.06, 0x2a2018, -f / 4, 1.5, (f * 0.85) / 2 + 0.01));
        hg.add(box(0.5, 0.5, 0.06, 0x2a2018, f / 4, 1.5, (f * 0.85) / 2 + 0.01));
        hg.add(cyl(0.07, 0.07, 2.2, 0x6b4a2f, -f / 3, 1.1, (f * 0.85) / 2 + 0.4));
        hg.add(cyl(0.07, 0.07, 2.2, 0x6b4a2f, f / 3, 1.1, (f * 0.85) / 2 + 0.4));
        hg.add(box(0.5, 1.0, 0.5, 0x8a8a86, f / 3, 3.6, -f / 4));
      }
      group.add(hg);
    }
    for (const loom of loomState.snapshot()) {
      // Upright weaving frame: two posts, a top beam, warp
      // threads, a half-woven band, a shuttle on the band, a
      // diagonal brace, and a cloth roll at the foot.
      const lg = new THREE.Group();
      lg.position.set(loom.x, 0, loom.z);
      lg.add(cyl(0.06, 0.06, 1.6, 0x6b4a2f, -0.7, 0.8, 0));
      lg.add(cyl(0.06, 0.06, 1.6, 0x6b4a2f, 0.7, 0.8, 0));
      lg.add(box(1.6, 0.1, 0.1, 0x6b4a2f, 0, 1.6, 0));
      for (let i = 0; i < 7; i++) {
        lg.add(box(0.02, 1.1, 0.02, 0xd8c9a8, -0.6 + i * 0.2, 1.05, 0));
      }
      lg.add(box(1.3, 0.5, 0.05, 0x8a7a5a, 0, 0.75, 0));
      lg.add(box(0.3, 0.08, 0.08, 0x4a3220, 0.2, 0.75, 0.06));
      const brace = cyl(0.04, 0.04, 1.4, 0x6b4a2f, 0.7, 0.7, -0.3);
      brace.rotation.x = 0.6;
      lg.add(brace);
      const roll = cyl(0.12, 0.12, 1.0, 0x8a7a5a, 0, 0.12, 0.35);
      roll.rotation.z = Math.PI / 2;
      lg.add(roll);
      group.add(lg);
    }
    this.scene.add(group);
    this.placedGroup = group;
  }

  /**
   * Rebuild the dropped-pile meshes (harvest overflow, Adam
   * 2026-10-26): one heap + marker flag per pile, phone-cheap
   * (3 meshes per pile, piles are few). The heap is a flattened
   * burlap mound; the flag is a small warm-yellow pennant on a
   * stick so a pile reads at a glance against marsh ground — the
   * quantity lives on the proximity channel (piles:inRange), not
   * in the mesh, so size stays constant and no per-pile scaling
   * logic can drift from state. NOT chunk-filtered, like the
   * placed group: a pile dropped anywhere must render.
   */
  private rebuildPileGroup(): void {
    if (this.pileGroup) {
      this.scene.remove(this.pileGroup);
      this.pileGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      this.pileGroup = null;
    }
    const group = new THREE.Group();
    for (const pile of pileState.snapshot()) {
      const pg = new THREE.Group();
      const heap = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), lambert(0x8a7a5a));
      heap.scale.y = 0.45;
      heap.position.y = 0.16;
      pg.add(heap);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 5), lambert(0x6b4a2f));
      pole.position.set(0.25, 0.45, 0);
      pg.add(pole);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.02), lambert(0xd8b040));
      flag.position.set(0.39, 0.82, 0);
      pg.add(flag);
      pg.position.set(pile.x, 0, pile.z);
      group.add(pg);
    }
    this.scene.add(group);
    this.pileGroup = group;
  }

  /**
   * One trap's ground marker (lane-decided, flagged for Adam's
   * pin pass — simple, readable at a glance, no behavior):
   * snare = flat loop + 2 stakes; weir = woven basket + rim;
   * pot = terracotta pot; pitfall = dark disc + moss ring;
   * deadfall = log + stone weight.
   */
  private trapMarker(type: TrapType): THREE.Group {
    const g = new THREE.Group();
    const add = (mesh: THREE.Mesh, x = 0, y = 0, z = 0): void => {
      mesh.position.set(x, y, z);
      g.add(mesh);
    };
    if (type === 'snare') {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 12), lambert(0x6a6a3a));
      loop.rotation.x = -Math.PI / 2;
      add(loop, 0, 0.05, 0);
      const stakeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5);
      const s1 = new THREE.Mesh(stakeGeo, lambert(0x6b4a2f));
      s1.rotation.z = 0.15;
      add(s1, -0.2, 0.2, 0);
      const s2 = new THREE.Mesh(stakeGeo, lambert(0x6b4a2f));
      s2.rotation.z = -0.15;
      add(s2, 0.2, 0.2, 0);
    } else if (type === 'fish-weir-trap') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.35, 10), lambert(0x8a7a4a)), 0, 0.18, 0);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 12), lambert(0x8a7a4a));
      rim.rotation.x = -Math.PI / 2;
      add(rim, 0, 0.35, 0);
    } else if (type === 'pot-trap') {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.3, 10), lambert(0xb06a3a)), 0, 0.15, 0);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 12), lambert(0xb06a3a));
      rim.rotation.x = -Math.PI / 2;
      add(rim, 0, 0.3, 0);
    } else if (type === 'pitfall') {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.45, 14), lambert(0x140e06));
      disc.rotation.x = -Math.PI / 2;
      add(disc, 0, 0.02, 0);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 6, 14), lambert(0x4a5a2a));
      ring.rotation.x = -Math.PI / 2;
      add(ring, 0, 0.03, 0);
    } else {
      // deadfall
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8), lambert(0x6b4a2f));
      log.rotation.z = Math.PI / 2;
      add(log, 0, 0.12, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), lambert(0x78716c)), 0, 0.39, 0);
    }
    return g;
  }

  /** Rebuild the placed-trap markers from live trapState (pile-group pattern). */
  private rebuildTrapGroup(): void {
    if (this.trapGroup) {
      this.scene.remove(this.trapGroup);
      this.trapGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      this.trapGroup = null;
    }
    const group = new THREE.Group();
    for (const trap of trapState.snapshot()) {
      const marker = this.trapMarker(trap.type);
      marker.position.set(trap.x, 0, trap.z);
      group.add(marker);
    }
    this.scene.add(group);
    this.trapGroup = group;
  }

  /** Rebuild the spawned-object meshes for currently loaded chunks:
   *  spawned logs (full-size) and saplings (tree mesh + canopy,
   *  scaled 0.3 → 1.0 by growth over SAPLING_GROWTH_MS). */
  private rebuildSpawnedGroup(): void {
    if (this.spawnedGroup) {
      this.scene.remove(this.spawnedGroup);
      for (const child of this.spawnedGroup.children) {
        if (child instanceof THREE.InstancedMesh) child.dispose();
      }
      this.spawnedGroup = null;
    }
    const group = new THREE.Group();
    const dummy = new THREE.Object3D();
    const logRender = KIND_RENDER['log'];
    const logs = harvestState
      .spawnedLogsSnapshot()
      .filter((log) => this.chunks.has(this.chunkKey(log.cx, log.cz)));
    if (logs.length > 0) {
      const mesh = new THREE.InstancedMesh(logRender.geometry, logRender.material, logs.length);
      logs.forEach((log, i) => {
        dummy.position.set(log.x, logRender.baseY, log.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }
    const now = Date.now();
    const saplings = harvestState
      .spawnedTreesSnapshot()
      .filter((sapling) => this.chunks.has(this.chunkKey(sapling.cx, sapling.cz)));
    if (saplings.length > 0) {
      const treeRender = KIND_RENDER['tree'];
      const mesh = new THREE.InstancedMesh(treeRender.geometry, treeRender.material, saplings.length);
      saplings.forEach((sapling, i) => {
        const s = 0.3 + 0.7 * harvestState.saplingGrowth(sapling, now);
        dummy.position.set(sapling.x, treeRender.baseY * s, sapling.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
      // No extra branch: the sapling canopy rides inside the merged
      // tree geometry (models.ts), scaled with the trunk.
    }
    this.scene.add(group);
    this.spawnedGroup = group;
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    // PAUSE GATE (Adam 2026-10-26 — see pause.ts): while paused
    // the loop schedules its next frame but simulates nothing —
    // no player update, no sky advance, no world tick, no render.
    // The canvas keeps its last frame, so the view reads frozen.
    // getDelta is still consumed above so resume sees no spike
    // (the 0.1 clamp would cap it anyway). NOTHING here sets or
    // clears the flag — the trigger (visibilitychange and/or
    // blur) is Adam's open choice and plugs into
    // pauseState.setPaused + the 'game:pause-changed' event.
    if (pauseState.isPaused()) return;
    this.player.update(dt);
    this.stream();
    this.worldTickAcc += dt;
    if (this.worldTickAcc >= 2) {
      this.worldTickAcc = 0;
      this.worldTick();
    }

    // Flame flicker: every flame mesh pulses around its base
    // scale, leans from its base, and breathes color — each cycle
    // on its own frequency and phase so fires never read as a
    // metronome. Fire lights flicker with their flames (same
    // flameTime, so pause freezes both together).
    this.flameTime += dt;
    if (this.placedGroup) {
      this.placedGroup.traverse((obj) => {
        if (obj.userData.flame) {
          const phase = obj.userData.phase as number;
          const s = 1 + 0.18 * Math.sin(this.flameTime * 13 + phase);
          obj.scale.set(s, 1 + 0.25 * Math.sin(this.flameTime * 17 + phase), s);
          // Lean: the flame sways from its base, out of phase
          // with its size pulse.
          obj.rotation.z = 0.05 * Math.sin(this.flameTime * 9 + phase);
          // Color breathes between deep orange and bright gold;
          // the inner core runs a faster, offset cycle so the two
          // cones never shift in lockstep. Materials are per-flame
          // (flameMesh builds fresh ones), so this touches only
          // this flame.
          const outer = obj.children[0];
          const inner = obj.children[1];
          if (outer instanceof THREE.Mesh && outer.material instanceof THREE.MeshBasicMaterial) {
            outer.material.color.lerpColors(FLAME_OUTER_A, FLAME_OUTER_B, 0.5 + 0.5 * Math.sin(this.flameTime * 11 + phase * 1.3 + 0.9));
          }
          if (inner instanceof THREE.Mesh && inner.material instanceof THREE.MeshBasicMaterial) {
            inner.material.color.lerpColors(FLAME_INNER_A, FLAME_INNER_B, 0.5 + 0.5 * Math.sin(this.flameTime * 14 + phase + 2.1));
          }
          // Inner core counter-pulses against the group scale.
          if (inner) {
            inner.scale.set(
              1 + 0.15 * Math.sin(this.flameTime * 19 + phase + 1.3),
              1 + 0.2 * Math.sin(this.flameTime * 15 + phase + 0.7),
              1 + 0.15 * Math.sin(this.flameTime * 19 + phase + 1.3),
            );
          }
        }
      });
    }
    for (const light of this.fireLights) {
      light.intensity =
        FIRE_LIGHT_INTENSITY *
        (1 + FIRE_LIGHT_FLICKER_AMPLITUDE * fireLightFlicker(this.flameTime, light.userData.phase as number));
    }

    // Witch mesh follows the player; hidden in first-person.
    this.witch.position.set(this.player.x, 0, this.player.z);
    this.witch.rotation.y = this.player.facing;
    this.witch.visible = this.player.mode !== 'first';

    // Carried-candle light follows the flame's world position:
    // the hand offset rotated by facing (same Y-rotation the
    // witch group itself uses), at flame height. Flicker is a
    // small mixed-sine wobble on flameTime — deterministic,
    // never random — in the same spirit as the fire flames.
    {
      const [ox, oz] = rotateOffsetY(CANDLE_HAND.x, CANDLE_HAND.z, this.player.facing);
      this.candleLight.position.set(
        this.player.x + ox,
        CANDLE_HAND.y + CANDLE_FLAME_Y,
        this.player.z + oz,
      );
      const flick = (Math.sin(this.flameTime * 10) + Math.sin(this.flameTime * 23 + 1.7)) / 2;
      this.candleLight.intensity = CANDLE_LIGHT_INTENSITY * (1 + CANDLE_FLICKER_AMPLITUDE * flick);
    }

    if (this.player.mode === 'first') {
      this.camera.position.set(
        this.player.x,
        PLAYER_EYE_HEIGHT,
        this.player.z,
      );
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(this.player.pitch, this.player.yaw, 0);
    } else if (this.player.mode === 'behind') {
      // Behind-the-witch follow (over-shoulder height): the
      // camera sits behind her facing, looking past her at
      // the ground ahead — her back in frame low, the view
      // ahead dominating. Forward from facing is (sin facing,
      // cos facing); distances/heights are the BEHIND_*
      // tunables in constants (starting values for Adam's
      // pin pass). Not the overhead map view, not ground
      // level where she would block the view.
      const fx = Math.sin(this.player.facing);
      const fz = Math.cos(this.player.facing);
      this.camera.position.set(
        this.player.x - fx * BEHIND_CAMERA_DISTANCE,
        BEHIND_CAMERA_HEIGHT,
        this.player.z - fz * BEHIND_CAMERA_DISTANCE,
      );
      this.camera.lookAt(
        this.player.x + fx * BEHIND_LOOK_AHEAD,
        BEHIND_LOOK_HEIGHT,
        this.player.z + fz * BEHIND_LOOK_AHEAD,
      );
    } else {
      this.camera.position.set(
        this.player.x + THIRD_PERSON_OFFSET.x,
        THIRD_PERSON_OFFSET.y,
        this.player.z + THIRD_PERSON_OFFSET.z,
      );
      this.camera.lookAt(this.player.x, 0, this.player.z);
    }

    // Sky: day/night driver + sun/moon/stars/clouds + lights.
    // Month stays the season-start input (no calendar yet — see
    // sky.ts); weather is the seasonal query at her position.
    this.sky?.update(dt, {
      month: SEASON_START_MONTH,
      weather: seasonalWeatherAt(this.gen, this.player.x, this.player.z, SEASON_START_MONTH),
      playerX: this.player.x,
      playerZ: this.player.z,
    });

    this.renderer.render(this.scene, this.camera);
  };
}
