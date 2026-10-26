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
 */

import * as THREE from 'three';
import { bus } from './events';
import type { WorldGen } from './worldgen';
import { PlayerController } from './player';
import { marshWeight } from './biomes';
import { SOURCE_FOR_KIND } from './objects';
import type { MeshShape } from './objects';
import { ProximityTracker } from './proximity';
import {
  harvestState,
  SHRINK_SCALE,
  scatterTargetId,
  wrapGenWithRemoved,
} from './harvestState';
import { createBiomeTexture, TEXTURE_REPEAT } from './terrain';
import {
  CHUNK_SIZE,
  GROUND_SEGMENTS,
  STREAM_RADIUS_CHUNKS,
  PLAYER_EYE_HEIGHT,
  THIRD_PERSON_OFFSET,
} from '../constants';
import type { BiomeId, ScatterKind } from '../types';

interface KindRender {
  /** Shared geometry (baked orientation: logs lie along X, discs lie flat). */
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** Extra instances for composite kinds (tree = trunk + canopy). */
  extra?: { geometry: THREE.BufferGeometry; material: THREE.Material; y: number };
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

function flatDisc(radius: number, segments = 12): THREE.CircleGeometry {
  const geo = new THREE.CircleGeometry(radius, segments);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function lyingCylinder(
  radiusTop: number,
  radiusBottom: number,
  length: number,
  lean = 0,
): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 7);
  geo.rotateZ(Math.PI / 2 + lean);
  return geo;
}

/** Ground-cover disc radii per kind (disc-shaped sources only). */
const DISC_RADIUS: Partial<Record<ScatterKind, number>> = {
  bogPatch: 1.4,
  standingWater: 1.2,
  peatMoss: 0.9,
  riverSilt: 1.0,
};

/** One shared geometry per mesh shape, built from the source descriptors
 *  in src/game/objects.ts (fill-in landing, 2026-10-25). Landing 1's
 *  placeholder primitives are replaced by these: distinct silhouettes
 *  per source (stump, reed, bog tuft, oak log, ...) with source colors. */
function geometryForShape(shape: MeshShape, kind: ScatterKind): THREE.BufferGeometry {
  switch (shape) {
    case 'bush':
      return new THREE.IcosahedronGeometry(0.7, 1);
    case 'stick': {
      const g = new THREE.CylinderGeometry(0.05, 0.07, 1.1, 5);
      g.rotateZ(0.3);
      return g;
    }
    case 'vine': {
      const g = new THREE.CylinderGeometry(0.03, 0.05, 1.2, 5);
      g.rotateZ(0.35);
      return g;
    }
    case 'log':
      return lyingCylinder(0.22, 0.26, 2.2);
    case 'oakLog':
      return lyingCylinder(0.35, 0.4, 3.0);
    case 'tree':
      return new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6);
    case 'stump':
      return new THREE.CylinderGeometry(0.45, 0.55, 0.6, 8);
    case 'reed':
      return new THREE.CylinderGeometry(0.02, 0.05, 1.3, 4);
    case 'grassTuft':
      return new THREE.ConeGeometry(0.6, 0.7, 5);
    case 'bogTuft': {
      const g = new THREE.SphereGeometry(0.7, 8, 6);
      g.scale(1, 0.4, 1);
      return g;
    }
    case 'disc':
      return flatDisc(DISC_RADIUS[kind] ?? 1.0, 12);
    case 'stone':
      return new THREE.DodecahedronGeometry(0.28, 0);
    case 'crystal':
      return new THREE.OctahedronGeometry(0.3, 0);
    case 'bone':
      return new THREE.BoxGeometry(0.5, 0.12, 0.12);
    case 'flower':
      return new THREE.SphereGeometry(0.18, 6, 5);
    case 'tallTree':
      return new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6);
  }
}

/** Extra primitive geometry for composite shapes (canopy / stump top /
 *  reed seed-head), keyed by shape. */
function extraGeometryForShape(shape: MeshShape): THREE.BufferGeometry | null {
  switch (shape) {
    case 'tree':
      return new THREE.ConeGeometry(1.3, 2.2, 7);
    case 'stump':
      return flatDisc(0.42, 8);
    case 'reed':
      return new THREE.ConeGeometry(0.12, 0.4, 5);
    case 'tallTree':
      return new THREE.ConeGeometry(1.8, 3.0, 7);
    default:
      return null;
  }
}

/** Render table derived from the harvest-source definitions, so mesh and
 *  data can never drift apart: change a source in objects.ts and its
 *  in-world shape follows. One geometry + material per kind, shared by
 *  all instances (the InstancedMesh perf model is unchanged). */
const KIND_RENDER: Record<ScatterKind, KindRender> = (() => {
  const table = {} as Record<ScatterKind, KindRender>;
  for (const [kind, source] of Object.entries(SOURCE_FOR_KIND) as [
    ScatterKind,
    (typeof SOURCE_FOR_KIND)[ScatterKind],
  ][]) {
    const extraGeo = extraGeometryForShape(source.mesh.shape);
    table[kind] = {
      geometry: geometryForShape(source.mesh.shape, kind),
      material: lambert(source.mesh.color, kind === 'standingWater' ? 0.75 : 1),
      baseY: source.mesh.baseY,
      ...(extraGeo && source.mesh.extraColor !== undefined && source.mesh.extraY !== undefined
        ? {
            extra: {
              geometry: extraGeo,
              material: lambert(source.mesh.extraColor),
              y: source.mesh.extraY,
            },
          }
        : {}),
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
  /** Spawned-log meshes (log-renewal system): rebuilt on the world
   *  tick when harvest state changed, only for loaded chunks. */
  private spawnedGroup: THREE.Group | null = null;
  private lastHarvestVersion = -1;
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
    // Removed filtering lives on the generator the renderer (and its
    // proximity tracker) actually use: permanently-removed objects
    // (remove action, taken logs) leave freshly generated chunks, so
    // they stop rendering AND stop appearing as targets. Shrunk
    // objects are NOT filtered — they render at SHRINK_SCALE (see
    // loadChunk). The outcome listener (shell-owned, see
    // harvest.ts) marks state in the shared harvestState.
    this.gen = wrapGenWithRemoved(gen);
    this.player = player;
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
    this.scene.add(new THREE.HemisphereLight(0x9aa88a, 0x2a2018, 0.9));
    const sun = new THREE.DirectionalLight(0xd8d0b0, 0.8);
    sun.position.set(40, 60, 20);
    this.scene.add(sun);

    // Placeholder witch: capsule body + cone hat + head. Visible in
    // third-person, hidden in first-person (you are the witch there).
    this.witch = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x5a3a5a }),
    );
    body.position.y = 0.95;
    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.7, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a1a2a }),
    );
    hat.position.y = 1.85;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshLambertMaterial({ color: 0xd8c0a0 }),
    );
    head.position.y = 1.5;
    this.witch.add(body, hat, head);
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
    // state does not carry over.
    harvestState.clear();
    this.gen = wrapGenWithRemoved(gen);
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
    this.proximity.dispose();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.setWorldGen(this.gen); // clears chunks (also disposes meshes)
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
      if (render.extra) {
        const extra = new THREE.InstancedMesh(
          render.extra.geometry,
          render.extra.material,
          objs.length,
        );
        objs.forEach((obj, i) => {
          const s =
            obj.scale *
            (harvestState.isRegrowing(scatterTargetId(cx, cz, obj), now)
              ? SHRINK_SCALE
              : 1);
          dummy.position.set(obj.x, obj.y + render.extra!.y * s, obj.z);
          dummy.rotation.set(0, obj.rotY, 0);
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          extra.setMatrixAt(i, dummy.matrix);
        });
        extra.instanceMatrix.needsUpdate = true;
        group.add(extra);
        meshes.push(extra);
      }
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
   * due log spawns are created near trees; spawned-log meshes
   * rebuild when harvest state changed. The 2 s cadence is a
   * rendering cadence, not a gameplay timer — regrow/spawn times
   * themselves live in harvestState.ts, and a regrown plant is
   * harvestable the moment its time passes even before its chunk
   * reloads (the tracker checks state, not meshes).
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
    if (harvestState.version !== this.lastHarvestVersion) {
      this.rebuildSpawnedGroup();
    }
  }

  /** Rebuild the spawned-log meshes for currently loaded chunks. */
  private rebuildSpawnedGroup(): void {
    this.lastHarvestVersion = harvestState.version;
    if (this.spawnedGroup) {
      this.scene.remove(this.spawnedGroup);
      for (const child of this.spawnedGroup.children) {
        if (child instanceof THREE.InstancedMesh) child.dispose();
      }
      this.spawnedGroup = null;
    }
    const group = new THREE.Group();
    const render = KIND_RENDER['log'];
    const logs = harvestState
      .spawnedLogsSnapshot()
      .filter((log) => this.chunks.has(this.chunkKey(log.cx, log.cz)));
    if (logs.length > 0) {
      const mesh = new THREE.InstancedMesh(render.geometry, render.material, logs.length);
      const dummy = new THREE.Object3D();
      logs.forEach((log, i) => {
        dummy.position.set(log.x, render.baseY, log.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }
    this.scene.add(group);
    this.spawnedGroup = group;
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.player.update(dt);
    this.stream();
    this.worldTickAcc += dt;
    if (this.worldTickAcc >= 2) {
      this.worldTickAcc = 0;
      this.worldTick();
    }

    // Witch mesh follows the player; hidden in first-person.
    this.witch.position.set(this.player.x, 0, this.player.z);
    this.witch.rotation.y = this.player.facing;
    this.witch.visible = this.player.mode === 'third';

    if (this.player.mode === 'first') {
      this.camera.position.set(
        this.player.x,
        PLAYER_EYE_HEIGHT,
        this.player.z,
      );
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(this.player.pitch, this.player.yaw, 0);
    } else {
      this.camera.position.set(
        this.player.x + THIRD_PERSON_OFFSET.x,
        THIRD_PERSON_OFFSET.y,
        this.player.z + THIRD_PERSON_OFFSET.z,
      );
      this.camera.lookAt(this.player.x, 0, this.player.z);
    }

    this.renderer.render(this.scene, this.camera);
  };
}
