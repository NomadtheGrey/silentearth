/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Three.js scene manager for Silent Earth landing 1: chunk streaming,
 * placeholder scatter rendering, switchable cameras, and a placeholder
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
import {
  CHUNK_SIZE,
  GROUND_SEGMENTS,
  STREAM_RADIUS_CHUNKS,
  PLAYER_EYE_HEIGHT,
  THIRD_PERSON_OFFSET,
} from '../constants';
import type { ScatterKind } from '../types';

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

/** Placeholder primitives. Colors are stand-ins, not final art direction. */
const KIND_RENDER: Record<ScatterKind, KindRender> = {
  vine: {
    geometry: (() => {
      const g = new THREE.CylinderGeometry(0.03, 0.05, 1.4, 5);
      g.rotateZ(0.35);
      return g;
    })(),
    material: lambert(0x4a6b2f),
    baseY: 0.7,
  },
  bush: {
    geometry: new THREE.IcosahedronGeometry(0.7, 0),
    material: lambert(0x3f5a2c),
    baseY: 0.45,
  },
  log: {
    geometry: lyingCylinder(0.22, 0.26, 2.2),
    material: lambert(0x5a4028),
    baseY: 0.24,
  },
  bogPatch: {
    geometry: flatDisc(1.4),
    material: lambert(0x241d16),
    baseY: 0,
  },
  standingWater: {
    geometry: flatDisc(1.2),
    material: lambert(0x2a4a5a, 0.75),
    baseY: 0,
  },
  tree: {
    geometry: new THREE.CylinderGeometry(0.18, 0.28, 1.6, 6),
    material: lambert(0x4a2e18),
    baseY: 0.8,
    extra: {
      geometry: new THREE.ConeGeometry(1.3, 2.2, 7),
      material: lambert(0x2f4a26),
      y: 2.4,
    },
  },
  snapWood: {
    geometry: (() => {
      const g = new THREE.CylinderGeometry(0.05, 0.07, 1.1, 5);
      g.rotateZ(0.3);
      return g;
    })(),
    material: lambert(0x7a5a34),
    baseY: 0.55,
  },
  tenderVines: {
    geometry: (() => {
      const g = new THREE.CylinderGeometry(0.02, 0.03, 1.0, 4);
      g.rotateZ(-0.4);
      return g;
    })(),
    material: lambert(0x6a8a3a),
    baseY: 0.5,
  },
  peatMoss: {
    geometry: flatDisc(0.9, 10),
    material: lambert(0x4a6b2f),
    baseY: 0,
  },
  riverSilt: {
    geometry: flatDisc(1.0, 10),
    material: lambert(0x6b5b43),
    baseY: 0,
  },
  riverStone: {
    geometry: new THREE.DodecahedronGeometry(0.28, 0),
    material: lambert(0x8a8a86),
    baseY: 0.15,
  },
  bone: {
    geometry: new THREE.BoxGeometry(0.5, 0.12, 0.12),
    material: lambert(0xe8e0cc),
    baseY: 0.08,
  },
  saltCrystal: {
    geometry: new THREE.OctahedronGeometry(0.3, 0),
    material: lambert(0xd8e8e8),
    baseY: 0.2,
  },
  downedOak: {
    geometry: lyingCylinder(0.35, 0.4, 3.0),
    material: lambert(0x3a2818),
    baseY: 0.38,
  },
};

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
  private disposed = false;

  constructor(
    container: HTMLElement,
    gen: WorldGen,
    player: PlayerController,
  ) {
    this.gen = gen;
    this.player = player;
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

  /** Swap the world generator (seed change): drop all chunks, re-stream. */
  setWorldGen(gen: WorldGen): void {
    this.gen = gen;
    for (const [key, loaded] of this.chunks) {
      this.disposeLoaded(loaded);
      this.chunks.delete(key);
    }
  }

  get loadedChunkCount(): number {
    return this.chunks.size;
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.setWorldGen(this.gen); // clears chunks (also disposes meshes)
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
      new THREE.MeshLambertMaterial({ vertexColors: true }),
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
    for (const [kind, objs] of byKind) {
      const render = KIND_RENDER[kind];
      const mesh = new THREE.InstancedMesh(render.geometry, render.material, objs.length);
      objs.forEach((obj, i) => {
        dummy.position.set(obj.x, obj.y + render.baseY * obj.scale, obj.z);
        dummy.rotation.set(0, obj.rotY, 0);
        dummy.scale.setScalar(obj.scale);
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
          dummy.position.set(obj.x, obj.y + render.extra!.y * obj.scale, obj.z);
          dummy.rotation.set(0, obj.rotY, 0);
          dummy.scale.setScalar(obj.scale);
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

  private loop = (): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.player.update(dt);
    this.stream();

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
