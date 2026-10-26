/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DETAILED PROCEDURAL MODELS (visuals-only landing, Adam 2026-10-26).
 * Replaces the renderer's single-primitive-per-kind shapes with
 * composed procedural geometry — trunk + branches + canopy, crossed
 * sticks, stalk clusters, end discs, root flares — still code-built,
 * no external files, no .glb imports, no AI-generated model files,
 * no new asset pipeline (deploys stay text-only and reviewable).
 *
 * HARD CONSTRAINTS, HOW EACH IS KEPT:
 * - PROCEDURAL ONLY: every part is a three.js primitive, merged in
 *   code. No asset loads anywhere in this module.
 * - PERFORMANCE (Adam's phone is the playtest device): scatter
 *   keeps the InstancedMesh model — ONE instanced mesh per kind per
 *   chunk, exactly as before. Composite kinds previously needed a
 *   second instanced mesh for their extra primitive (tree canopy,
 *   stump top, reed seed-head); merging base + extra into ONE
 *   geometry DROPS those second meshes, so draw calls per chunk
 *   stay flat or fall. Polygon counts stay low (low-segment
 *   primitives, detail-0 polyhedra); the probe prints per-kind
 *   vertex counts so a future detail pass has numbers, not vibes.
 * - DETERMINISM: geometry is STATIC per kind — built once from the
 *   source colors in objects.ts, with no per-instance variation in
 *   the geometry itself. All per-instance variation still comes
 *   from worldgen (position, rotY, scale), which is seeded. No
 *   Math.random anywhere in this module, or in worldgen at all.
 * - GAMEPLAY UNCHANGED: this module only shapes pixels. Positions,
 *   scales, harvest ranges, hitboxes, placement rules, and every
 *   mechanic are untouched; instance placement in the renderer
 *   (obj.y + baseY * s, scale s) is preserved exactly, so merged
 *   parts are baked at (partWorldY - baseY) relative to the old
 *   base center. The witch figure, fires, houses, and loom in
 *   buildWitch / the placed builders are likewise visual only.
 *
 * COLORS still come from objects.ts (source.mesh.color /
 * extraColor), so mesh and data cannot drift apart: change a
 * source color and its detailed model follows. Accent shades are
 * computed from those colors (shade()), except two fixed food
 * accents: bog-berry dots on bog growth, and the flower center.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ScatterKind } from '../types';
import type { MeshSpec } from './objects';
import { hashSeed, mulberry32 } from './seed';

/** Ground-cover disc radii per kind (disc-shaped sources only). */
const DISC_RADIUS: Partial<Record<ScatterKind, number>> = {
  bogPatch: 1.4,
  standingWater: 1.2,
  peatMoss: 0.9,
  riverSilt: 1.0,
};

/** Fixed food accents (not source colors): bog berries, flower center. */
const BERRY_COLOR = 0x7a2a3a;
const FLOWER_CENTER_COLOR = 0xf0d060;

/** Lighten (>1) or darken (<1) a packed color, clamped to white. */
function shade(hex: number, factor: number): number {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  c.r = Math.min(1, c.r);
  c.g = Math.min(1, c.g);
  c.b = Math.min(1, c.b);
  return c.getHex();
}

type Vec3 = [number, number, number];

interface PartOpts {
  /** Translation in instance space (y=0 = old base center). */
  p?: Vec3;
  /** Euler rotation (radians). */
  r?: Vec3;
  /** Scale. */
  s?: Vec3;
}

/**
 * One painted part: transform, de-index (polyhedra are non-indexed
 * while cylinders/spheres are indexed — mergeGeometries needs all
 * parts the same), then fill a per-vertex color attribute.
 */
function part(
  geo: THREE.BufferGeometry,
  hex: number,
  opts: PartOpts = {},
): THREE.BufferGeometry {
  const { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = opts;
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
    new THREE.Vector3(...s),
  );
  geo.applyMatrix4(m);
  // Polyhedra arrive non-indexed; toNonIndexed() only warns on
  // those, so guard it and keep the browser console clean.
  const g = geo.index ? geo.toNonIndexed() : geo;
  const count = g.getAttribute('position').count;
  const c = new THREE.Color(hex);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('models: failed to merge parts');
  for (const g of parts) g.dispose();
  return merged;
}

const cyl = (
  rt: number,
  rb: number,
  h: number,
  seg: number,
): THREE.CylinderGeometry => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r: number, h: number, seg: number): THREE.ConeGeometry =>
  new THREE.ConeGeometry(r, h, seg);
const sphere = (r: number, w: number, h: number): THREE.SphereGeometry =>
  new THREE.SphereGeometry(r, w, h);
const blob = (r: number): THREE.IcosahedronGeometry =>
  new THREE.IcosahedronGeometry(r, 0);
const box = (w: number, h: number, d: number): THREE.BoxGeometry =>
  new THREE.BoxGeometry(w, h, d);
const flatDisc = (radius: number, segments = 12): THREE.CircleGeometry => {
  const geo = new THREE.CircleGeometry(radius, segments);
  geo.rotateX(-Math.PI / 2);
  return geo;
};
const lyingCyl = (
  rt: number,
  rb: number,
  length: number,
): THREE.CylinderGeometry => {
  const geo = new THREE.CylinderGeometry(rt, rb, length, 7);
  geo.rotateZ(Math.PI / 2);
  return geo;
};

/**
 * Detailed merged geometry for one scatter kind, built from its
 * source mesh spec. `baseY`/`extraY` are the OLD placement values:
 * parts that used to be the extra primitive sit at
 * (extraY - baseY) in geometry space, so the renderer's
 * `obj.y + baseY * s` placement (with scale s) lands them at
 * exactly the old world heights, shrunk or full.
 */
export function buildKindGeometry(spec: MeshSpec, kind: ScatterKind): THREE.BufferGeometry {
  const c = spec.color;
  const e = spec.extraColor ?? c;
  const extraDy = (spec.extraY ?? spec.baseY) - spec.baseY;
  // Kind override (peat moss shares the 'disc' shape with bog patch,
  // standing water, and river silt, but is the one ground cover that
  // reads as mounds, not flat ground): disc + moss mounds.
  if (kind === 'peatMoss') {
    const mounds: THREE.BufferGeometry[] = [];
    const spots: [Vec3, number][] = [
      [[0.3, 0.05, 0.2], 0.25],
      [[-0.35, 0.05, -0.1], 0.2],
      [[0.05, 0.05, -0.35], 0.18],
    ];
    for (const [p, r] of spots) {
      mounds.push(part(sphere(r, 8, 6), shade(c, 1.15), { p, s: [1, 0.35, 1] }));
    }
    return merge([part(flatDisc(DISC_RADIUS[kind] ?? 1.0, 12), c), ...mounds]);
  }
  switch (spec.shape) {
    case 'tree': {
      const branches: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        branches.push(
          part(cyl(0.04, 0.07, 0.9, 4), c, {
            p: [Math.cos(a) * 0.35, 0.55 + i * 0.12, Math.sin(a) * 0.35],
            r: [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7],
          }),
        );
      }
      return merge([
        part(cyl(0.18, 0.28, 1.6, 6), c),
        ...branches,
        part(blob(0.95), e, { p: [0, extraDy, 0] }),
        part(blob(0.7), shade(e, 0.9), { p: [0.45, extraDy + 0.55, 0.2] }),
        part(blob(0.55), shade(e, 1.1), { p: [-0.4, extraDy - 0.5, -0.25] }),
      ]);
    }
    case 'tallTree': {
      const branches: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        branches.push(
          part(cyl(0.05, 0.08, 1.2, 4), c, {
            p: [Math.cos(a) * 0.45, 1.0 + i * 0.2, Math.sin(a) * 0.45],
            r: [Math.sin(a) * 0.65, 0, -Math.cos(a) * 0.65],
          }),
        );
      }
      return merge([
        part(cyl(0.22, 0.34, 3.2, 6), c),
        ...branches,
        part(blob(1.4), e, { p: [0, extraDy, 0] }),
        part(blob(1.0), shade(e, 0.9), { p: [0.6, extraDy + 0.8, 0.3] }),
        part(blob(0.7), shade(e, 1.1), { p: [-0.55, extraDy - 0.7, -0.3] }),
      ]);
    }
    case 'bush':
      return merge([
        part(blob(0.7), c),
        part(blob(0.5), shade(c, 0.9), { p: [0.45, 0.15, 0.2] }),
        part(blob(0.45), shade(c, 1.1), { p: [-0.4, 0.1, -0.25] }),
        part(cyl(0.03, 0.04, 0.7, 4), shade(c, 0.7), { p: [0.2, 0.3, 0], r: [0, 0, 0.5] }),
        part(cyl(0.03, 0.04, 0.7, 4), shade(c, 0.7), { p: [-0.25, 0.25, 0.1], r: [0.3, 0, -0.4] }),
      ]);
    case 'stick': {
      const sticks: THREE.BufferGeometry[] = [];
      const leans: [Vec3, Vec3][] = [
        [[0, 0, 0], [0, 0, 0.3]],
        [[0.15, 0, 0.1], [0, 0.6, -0.35]],
        [[-0.12, 0, -0.08], [0.4, 0, 0.2]],
        [[0.05, 0, 0.12], [-0.3, 0.5, -0.2]],
      ];
      for (const [p, r] of leans) sticks.push(part(cyl(0.05, 0.07, 1.1, 5), c, { p, r }));
      return merge(sticks);
    }
    case 'vine': {
      const strands: THREE.BufferGeometry[] = [];
      const leans: [Vec3, Vec3][] = [
        [[0, 0, 0], [0, 0, 0.35]],
        [[0.18, 0, 0.08], [0, 0, -0.3]],
        [[-0.15, 0, -0.1], [0.15, 0, 0.2]],
      ];
      for (const [p, r] of leans) strands.push(part(cyl(0.03, 0.05, 1.2, 4), c, { p, r }));
      return merge([
        ...strands,
        part(blob(0.16), shade(c, 1.25), { p: [0.12, 0.45, 0.05] }),
        part(blob(0.14), shade(c, 1.25), { p: [-0.28, 0.2, -0.05] }),
        part(blob(0.15), shade(c, 1.25), { p: [0.05, -0.35, 0.12] }),
      ]);
    }
    case 'log':
    case 'oakLog': {
      const big = spec.shape === 'oakLog';
      const r = big ? 0.35 : 0.22;
      const rb = big ? 0.4 : 0.26;
      const len = big ? 3.0 : 2.2;
      const end = (x: number): THREE.BufferGeometry => {
        const g = new THREE.CircleGeometry(r, 10);
        g.rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2);
        return part(g, shade(c, 1.5), { p: [x, 0, 0] });
      };
      return merge([
        part(lyingCyl(r, rb, len), c),
        end(len / 2),
        end(-len / 2),
        part(cyl(0.06, 0.08, 0.5, 4), shade(c, 0.85), {
          p: [len * 0.15, 0.2, 0.1],
          r: [0.4, 0, -0.5],
        }),
      ]);
    }
    case 'stump': {
      const roots: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        roots.push(
          part(box(0.5, 0.15, 0.18), shade(c, 0.85), {
            p: [Math.cos(a) * 0.5, -0.25, Math.sin(a) * 0.5],
            r: [0, -a, 0],
          }),
        );
      }
      return merge([
        part(cyl(0.45, 0.55, 0.6, 8), c),
        part(flatDisc(0.42, 8), e, { p: [0, extraDy, 0] }),
        ...roots,
      ]);
    }
    case 'reed': {
      const stalks: THREE.BufferGeometry[] = [];
      const heads: THREE.BufferGeometry[] = [];
      const xs = [-0.15, 0, 0.15];
      const leans = [0.12, -0.06, 0.18];
      const scales = [1, 0.85, 1.1];
      for (let i = 0; i < 3; i++) {
        stalks.push(
          part(cyl(0.02, 0.05, 1.3, 4), c, {
            p: [xs[i], 0, 0],
            r: [0, 0, leans[i]],
            s: [1, scales[i], 1],
          }),
        );
        if (i !== 1) {
          heads.push(
            part(cone(0.12, 0.4, 5), e, {
              p: [xs[i] + leans[i] * -0.65, 0.65 * scales[i] + 0.15, 0],
            }),
          );
        }
      }
      return merge([...stalks, ...heads]);
    }
    case 'grassTuft': {
      const blades: THREE.BufferGeometry[] = [];
      const leans: [Vec3, Vec3, number][] = [
        [[0, 0, 0], [0, 0, 0.15], 0.9],
        [[0.2, 0, 0.1], [0, 0, -0.3], 0.7],
        [[-0.2, 0, -0.05], [0.25, 0, 0.2], 0.7],
        [[0.05, 0, -0.18], [-0.2, 0, -0.25], 0.6],
      ];
      for (const [p, r, h] of leans) {
        blades.push(part(cone(0.5, 0.7, 5), shade(c, 0.95 + h * 0.1), { p, r, s: [1, h, 1] }));
      }
      return merge(blades);
    }
    case 'bogTuft': {
      const berries: THREE.BufferGeometry[] = [];
      const spots: Vec3[] = [
        [0.2, 0.28, 0.1],
        [-0.15, 0.3, -0.05],
        [0.05, 0.32, -0.2],
        [-0.3, 0.22, 0.2],
      ];
      for (const p of spots) berries.push(part(sphere(0.07, 6, 5), BERRY_COLOR, { p }));
      return merge([
        part(sphere(0.7, 8, 6), c, { s: [1, 0.4, 1] }),
        part(sphere(0.45, 8, 6), shade(c, 1.1), { p: [0.4, 0.1, 0.2], s: [1, 0.4, 1] }),
        ...berries,
      ]);
    }
    case 'disc':
      return merge([part(flatDisc(DISC_RADIUS[kind] ?? 1.0, 12), c)]);
    case 'stone':
      return merge([
        part(new THREE.DodecahedronGeometry(0.28, 0), c),
        part(new THREE.DodecahedronGeometry(0.16, 0), shade(c, 0.9), { p: [0.3, 0, 0.15] }),
      ]);
    case 'crystal':
      return merge([
        part(new THREE.OctahedronGeometry(0.3, 0), c),
        part(new THREE.OctahedronGeometry(0.15, 0), shade(c, 1.15), { p: [0.28, 0.05, 0.1] }),
        part(new THREE.OctahedronGeometry(0.12, 0), shade(c, 1.15), { p: [-0.25, 0.02, -0.12] }),
      ]);
    case 'bone':
      return merge([
        part(box(0.5, 0.12, 0.12), c),
        part(sphere(0.11, 6, 5), shade(c, 0.95), { p: [0.28, 0, 0] }),
        part(sphere(0.11, 6, 5), shade(c, 0.95), { p: [-0.28, 0, 0] }),
      ]);
    case 'flower':
      return merge([
        part(cyl(0.02, 0.03, 0.35, 4), shade(c, 0.5), { p: [0, -0.05, 0] }),
        part(sphere(0.18, 6, 5), c, { p: [0, 0.2, 0] }),
        part(sphere(0.07, 6, 5), FLOWER_CENTER_COLOR, { p: [0, 0.38, 0] }),
      ]);
  }
}

/** Shared vertex-colored material for merged kind geometry. */
export function vertexLambert(opacity = 1): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  if (opacity < 1) {
    mat.transparent = true;
    mat.opacity = opacity;
  }
  return mat;
}

function meshMat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

/**
 * The witch herself, placeholder-grade-plus: dress shape, bodice,
 * shawl, head, brimmed hat, and arms — still procedural, NOT final
 * art. Height ~2.6 m (was ~2.2 m for the capsule trio); the figure
 * is visual only, so the height change moves no gameplay. The
 * renderer positions/rotates this group exactly as before.
 */
export function buildWitch(): THREE.Group {
  const g = new THREE.Group();
  const add = (
    geo: THREE.BufferGeometry,
    color: number,
    p: Vec3,
    r: Vec3 = [0, 0, 0],
  ): void => {
    const m = new THREE.Mesh(geo, meshMat(color));
    m.position.set(...p);
    m.rotation.set(...r);
    g.add(m);
  };
  // Dress: flared cone to the ground, then bodice above it.
  add(new THREE.ConeGeometry(0.62, 1.4, 10), 0x5a3a5a, [0, 0.7, 0]);
  add(new THREE.CylinderGeometry(0.22, 0.32, 0.55, 8), 0x4a2a4a, [0, 1.55, 0]);
  // Shawl over the shoulders, mossy green.
  add(new THREE.ConeGeometry(0.38, 0.45, 8), 0x3a4a2a, [0, 1.72, 0]);
  // Head + hair + brimmed hat.
  add(new THREE.SphereGeometry(0.22, 8, 8), 0xd8c0a0, [0, 1.95, 0]);
  add(new THREE.SphereGeometry(0.23, 8, 8), 0x2a2018, [0, 1.98, -0.06]);
  add(new THREE.CylinderGeometry(0.52, 0.52, 0.05, 12), 0x2a1a2a, [0, 2.12, 0]);
  add(new THREE.ConeGeometry(0.42, 0.7, 8), 0x2a1a2a, [0, 2.45, 0]);
  // Arms: thin cylinders angled down and out from the shoulders.
  add(new THREE.CylinderGeometry(0.05, 0.04, 0.7, 6), 0x4a2a4a, [0.38, 1.45, 0], [0, 0, -0.5]);
  add(new THREE.CylinderGeometry(0.05, 0.04, 0.7, 6), 0x4a2a4a, [-0.38, 1.45, 0], [0, 0, 0.5]);
  // Boots peeking under the hem.
  add(new THREE.BoxGeometry(0.16, 0.12, 0.28), 0x2a1a12, [0.14, 0.06, 0.1]);
  add(new THREE.BoxGeometry(0.16, 0.12, 0.28), 0x2a1a12, [-0.14, 0.06, 0.1]);
  return g;
}

/**
 * The witch's carried umbrella (Adam 2026-10-26 — the last umbrella
 * piece; Systems' recipe + UI's icon already landed). Ragged/witchy,
 * NOT pristine, and it matches the UI icon's read: a scalloped moss
 * canopy (#5c823d) over a stone-grey (#78716c) shaft with a hooked
 * handle. The edge is ragged by construction: 12 panels whose rim
 * radii/droops jitter from a FIXED seed (same umbrella in every
 * world — a personal item, not worldgen), plus one torn panel whose
 * two rim points pull in short and droop low, and one faded-brown
 * patch panel among the moss tones.
 *
 * Group-local coords, grip at the origin: shaft 0 → 1.25, canopy
 * dome above it (apex 1.57), hook curving below the grip. The
 * renderer places the group at her right hand and owns visibility
 * (setCarriesUmbrella): the graphic shows exactly when an umbrella
 * is in inventory (Systems' rule — no equip state, duplicates do
 * not stack, so one graphic regardless of count). Attached to the
 * witch group, it inherits third-person-only visibility: hidden in
 * first-person, where you are the witch. Visual only — no mechanic,
 * no hitbox, no gameplay field.
 */
export function buildUmbrella(): THREE.Group {
  const g = new THREE.Group();
  const rng = mulberry32(hashSeed('silent-earth-umbrella'));

  const PANELS = 12;
  const SHAFT_TOP = 1.25;
  const APEX_Y = 1.57;
  const MID_Y = 1.47;
  const MOSS = [0x5c823d, 0x4a6b31, 0x6b9448];
  const PATCH = 0x6b5a3a;

  // One rim point per panel boundary (shared between neighbors, so
  // no cracks between panels); raggedness lives in the radii/droops.
  const rimR: number[] = [];
  const rimDroop: number[] = [];
  const torn = Math.floor(rng() * PANELS);
  const patch = Math.floor(rng() * PANELS);
  for (let j = 0; j < PANELS; j++) {
    rimR.push(0.55 * (0.92 + rng() * 0.16));
    rimDroop.push(rng() * 0.05);
  }
  // The tear: one panel's two rim points pull in short and droop low.
  rimR[torn] *= 0.8;
  rimR[(torn + 1) % PANELS] *= 0.8;
  rimDroop[torn] += 0.1;
  rimDroop[(torn + 1) % PANELS] += 0.1;

  const positions: number[] = [];
  const colors: number[] = [];
  const push = (p: Vec3, color: number): void => {
    positions.push(...p);
    const c = new THREE.Color(color);
    colors.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < PANELS; i++) {
    const a0 = (i / PANELS) * Math.PI * 2;
    const a1 = ((i + 1) / PANELS) * Math.PI * 2;
    const j0 = i;
    const j1 = (i + 1) % PANELS;
    const color = i === patch ? PATCH : MOSS[Math.floor(rng() * MOSS.length)];
    const apex: Vec3 = [0, APEX_Y, 0];
    const midL: Vec3 = [Math.cos(a0) * rimR[j0] * 0.62, MID_Y, Math.sin(a0) * rimR[j0] * 0.62];
    const midR: Vec3 = [Math.cos(a1) * rimR[j1] * 0.62, MID_Y, Math.sin(a1) * rimR[j1] * 0.62];
    const rimL: Vec3 = [Math.cos(a0) * rimR[j0], SHAFT_TOP - rimDroop[j0], Math.sin(a0) * rimR[j0]];
    const rimRr: Vec3 = [Math.cos(a1) * rimR[j1], SHAFT_TOP - rimDroop[j1], Math.sin(a1) * rimR[j1]];
    // Dome curve: apex fan, then the skirt quad as two triangles.
    push(apex, color);
    push(midL, color);
    push(midR, color);
    push(midL, color);
    push(rimL, color);
    push(rimRr, color);
    push(midL, color);
    push(rimRr, color);
    push(midR, color);
  }
  const canopyGeo = new THREE.BufferGeometry();
  canopyGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  canopyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const canopy = new THREE.Mesh(
    canopyGeo,
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
  g.add(canopy);

  // Shaft + hooked handle + finial tip, stone grey like the icon.
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, SHAFT_TOP, 6),
    meshMat(0x78716c),
  );
  shaft.position.set(0, SHAFT_TOP / 2, 0);
  g.add(shaft);
  const hookCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0.02, 0),
    new THREE.Vector3(0, -0.26, 0),
    new THREE.Vector3(0.13, -0.15, 0),
  );
  g.add(new THREE.Mesh(new THREE.TubeGeometry(hookCurve, 8, 0.016, 6), meshMat(0x78716c)));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), meshMat(0x78716c));
  tip.position.set(0, APEX_Y + 0.03, 0);
  g.add(tip);
  return g;
}
