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
import { buildKindGeometry, buildWitch, vertexLambert } from './models';
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

export class WorldRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private raf = 0;
  private chunks = new Map<string, LoadedChunk>();
  private witch: THREE.Group;
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

    window.addEventListener('resize', this.onResize);
    this.loop();
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
    flame.userData.phase = Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * Math.PI * 2;
    return flame;
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
        if (lit) fg.add(this.flameMesh(fire.x, fire.z, 0.25, 1));
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
        if (lit) fg.add(this.flameMesh(fire.x, fire.z, 0.6, 1.1));
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
        if (lit) fg.add(this.flameMesh(fire.x, fire.z, 1.9, 0.7));
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
        if (lit) fg.add(this.flameMesh(fire.x, fire.z, 2.6, 0.8));
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
    // scale, out of phase by position so fires don't sync.
    this.flameTime += dt;
    if (this.placedGroup) {
      this.placedGroup.traverse((obj) => {
        if (obj.userData.flame) {
          const s = 1 + 0.18 * Math.sin(this.flameTime * 13 + (obj.userData.phase as number));
          obj.scale.set(s, 1 + 0.25 * Math.sin(this.flameTime * 17 + (obj.userData.phase as number)), s);
        }
      });
    }

    // Witch mesh follows the player; hidden in first-person.
    this.witch.position.set(this.player.x, 0, this.player.z);
    this.witch.rotation.y = this.player.facing;
    this.witch.visible = this.player.mode !== 'first';

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
