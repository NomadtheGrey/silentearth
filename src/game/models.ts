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
import type { AnimalKind } from './animals';
import { hashSeed, mulberry32 } from './seed';
import { sunDirection, sunElevationAtCycle } from './sky';
import { dayFraction } from './weather';

/** Ground-cover disc radii per kind (disc-shaped sources only). */
/** Ground-disc radii by scatter kind (shared with waterProximity's pond edge). */
export const DISC_RADIUS: Partial<Record<ScatterKind, number>> = {
  bogPatch: 1.4,
  standingWater: 1.2,
  pond: 4.5,
  peatMoss: 0.9,
  riverSilt: 1.0,
};

/** Fixed food accents (not source colors): bog berries, flower center, apples. */
const BERRY_COLOR = 0x7a2a3a;
const FLOWER_CENTER_COLOR = 0xf0d060;
const APPLE_COLOR = 0xc82828;
/** Fixed stem green for the new flower cases (flowers landing, 2026-10-28). */
const STEM_GREEN = 0x3a5a2a;

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
    case 'acornCluster': {
      // Ground acorns: a small cluster of nuts on the ground —
      // hand-picked, not a bush or a disc. Static positions.
      const nuts: THREE.BufferGeometry[] = [];
      const spots: [Vec3, number][] = [
        [[0, 0.05, 0], 0.07],
        [[0.12, 0.04, 0.06], 0.06],
        [[-0.1, 0.04, 0.08], 0.06],
        [[0.05, 0.04, -0.11], 0.055],
        [[-0.06, 0.03, -0.05], 0.05],
      ];
      spots.forEach(([p, r], i) => {
        nuts.push(part(sphere(r, 6, 5), i % 2 === 0 ? c : e, { p, s: [1, 0.7, 1] }));
      });
      return merge(nuts);
    }
    case 'mushroom': {
      // Toadstool: cream stem + dome cap in the spec color.
      // The poison kind wears pale cap spots — the close-look
      // tell against the plain edible cap (same silhouette).
      const parts: THREE.BufferGeometry[] = [
        part(cyl(0.045, 0.06, 0.3, 6), e, { p: [0, 0.15, 0] }),
        part(sphere(0.22, 8, 6), c, { p: [0, 0.26, 0], s: [1, 0.6, 1] }),
      ];
      if (kind === 'poisonMushroom') {
        const spots: [Vec3, number][] = [
          [[0.12, 0.36, 0.08], 0.035],
          [[-0.1, 0.38, -0.05], 0.03],
          [[0.02, 0.4, -0.12], 0.04],
          [[-0.14, 0.35, 0.1], 0.03],
        ];
        for (const [p, r] of spots) {
          parts.push(part(sphere(r, 6, 5), 0xe8e0c8, { p, s: [1, 0.4, 1] }));
        }
      }
      return merge(parts);
    }
    case 'appleTree': {
      // Orchard apple tree: trunk + canopy blobs + red apple dots.
      // Static dot positions, each centered ~on the main canopy
      // sphere's surface (r 1.0 @ y 2.0) so the red reads half-proud
      // against green at a glance — the mushroom-cap clarity rule.
      // baseY 0, so parts sit at absolute heights (trunk 0–1.4,
      // canopy to ~3.0); shrink scales the whole tree toward the
      // ground, like any other kind.
      const apples: THREE.BufferGeometry[] = [];
      const dots: Vec3[] = [
        [1.0, 2.0, 0], [-1.0, 2.0, 0], [0, 2.0, 1.0], [0, 2.0, -1.0],
        [0.8, 2.6, 0], [-0.8, 2.6, 0], [0, 2.6, 0.8], [0, 2.6, -0.8],
        [0.85, 1.5, 0], [-0.85, 1.5, 0],
      ];
      for (const p of dots) {
        apples.push(part(sphere(0.1, 6, 5), APPLE_COLOR, { p }));
      }
      return merge([
        part(cyl(0.14, 0.2, 1.4, 6), c, { p: [0, 0.7, 0] }),
        part(blob(1.0), e, { p: [0, 2.0, 0] }),
        part(blob(0.65), shade(e, 0.9), { p: [0.6, 1.7, 0.2] }),
        part(blob(0.6), shade(e, 1.1), { p: [-0.55, 1.75, -0.2] }),
        ...apples,
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
        // Top disc lifted 0.01 above the trunk cap plane: the
        // disc at extraDy sat EXACTLY on the trunk's top cap
        // (both at local 0.30), z-fighting across the stump's
        // top face. The 1 cm lift kills the coplanar pair
        // without changing the top color or the silhouette.
        part(flatDisc(0.42, 8), e, { p: [0, extraDy + 0.01, 0] }),
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
      if (kind === 'flint') {
        // Knapped shard: flat, elongated, angular — reads distinct
        // from river stone's rounded pair at a glance, before the
        // charcoal color even registers.
        return merge([
          part(new THREE.OctahedronGeometry(0.32, 0), c, { s: [1.5, 0.35, 0.8] }),
          part(new THREE.OctahedronGeometry(0.14, 0), shade(c, 0.85), { p: [0.3, 0.02, 0.1], s: [1.2, 0.4, 0.7] }),
        ]);
      }
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
    // Flowers landing (2026-10-28): per-kind flower shapes, all
    // stacked from y=0 up (defs carry baseY 0). c = petal color,
    // e = accent from the def (centre, cone, leaves, pad). Stems
    // are fixed green, unlike the generic flower case above.
    case 'flowerDisc':
      // Yarrow / dandelion / aster / violet: stem + flat disc head
      // + centre dot. (Yarrow's blob cluster reads as a white disc
      // at phone scale.)
      return merge([
        part(cyl(0.02, 0.03, 0.35, 4), STEM_GREEN, { p: [0, 0.175, 0] }),
        part(cyl(0.16, 0.16, 0.03, 8), c, { p: [0, 0.37, 0] }),
        part(sphere(0.05, 6, 5), e, { p: [0, 0.4, 0] }),
      ]);
    case 'flowerCone':
      // Gold coneflower: stem + yellow disc rays + brown cone centre.
      return merge([
        part(cyl(0.02, 0.03, 0.35, 4), STEM_GREEN, { p: [0, 0.175, 0] }),
        part(cyl(0.19, 0.19, 0.03, 8), c, { p: [0, 0.37, 0] }),
        part(cone(0.12, 0.2, 8), e, { p: [0, 0.48, 0] }),
      ]);
    case 'flowerCup':
      // Red poppy: stem + open red cup + dark centre disc.
      return merge([
        part(cyl(0.02, 0.03, 0.35, 4), STEM_GREEN, { p: [0, 0.175, 0] }),
        part(cyl(0.15, 0.08, 0.12, 8), c, { p: [0, 0.41, 0] }),
        part(cyl(0.06, 0.06, 0.02, 8), e, { p: [0, 0.48, 0] }),
      ]);
    case 'flowerTallDisc':
      // Tall sunflower STEM ONLY (Adam, 2026-10-29, pinned): the
      // stem stands 2.0 m and the head is a separate pivot
      // geometry the renderer aims at the sun — see
      // buildSunflowerHeadGeometry below. (Before: a 1.0 m stem
      // with the disc baked horizontal at the top, a plate
      // facing the sky.)
      return merge([
        part(cyl(0.035, 0.05, SUNFLOWER_STEM_HEIGHT_M, 5), STEM_GREEN, { p: [0, SUNFLOWER_STEM_HEIGHT_M / 2, 0] }),
      ]);
    case 'flowerTrillium':
      // White trillium: low stem + 3 white petal discs in a triangle
      // over 3 green leaf discs (the unmistakable shape).
      return merge([
        part(cyl(0.02, 0.03, 0.25, 4), STEM_GREEN, { p: [0, 0.125, 0] }),
        part(cyl(0.09, 0.09, 0.02, 6), c, { p: [0.09, 0.27, 0] }),
        part(cyl(0.09, 0.09, 0.02, 6), c, { p: [-0.045, 0.27, 0.078] }),
        part(cyl(0.09, 0.09, 0.02, 6), c, { p: [-0.045, 0.27, -0.078] }),
        part(cyl(0.1, 0.1, 0.02, 6), e, { p: [0.11, 0.22, 0] }),
        part(cyl(0.1, 0.1, 0.02, 6), e, { p: [-0.055, 0.22, 0.095] }),
        part(cyl(0.1, 0.1, 0.02, 6), e, { p: [-0.055, 0.22, -0.095] }),
      ]);
    case 'flowerPouch':
      // Pink lady slipper: stem + pink pouch (scaled sphere) +
      // petal discs behind it.
      return merge([
        part(cyl(0.02, 0.03, 0.3, 4), STEM_GREEN, { p: [0, 0.15, 0] }),
        part(sphere(0.14, 8, 6), c, { p: [0, 0.36, 0], s: [1, 1.2, 1] }),
        part(cyl(0.08, 0.08, 0.02, 6), shade(c, 0.7), { p: [0.08, 0.32, -0.06] }),
        part(cyl(0.08, 0.08, 0.02, 6), shade(c, 0.7), { p: [-0.08, 0.32, -0.06] }),
      ]);
    case 'flowerIris':
      // Creek iris: tall stem + 3 tilted blade cones (fixed green —
      // e is spent on the yellow centre) + purple disc + centre.
      return merge([
        part(cyl(0.02, 0.03, 0.8, 4), STEM_GREEN, { p: [0, 0.4, 0] }),
        part(cone(0.05, 0.7, 4), STEM_GREEN, { p: [0.09, 0.35, 0], r: [0, 0, -0.25] }),
        part(cone(0.05, 0.7, 4), STEM_GREEN, { p: [-0.09, 0.35, 0], r: [0, 0, 0.25] }),
        part(cone(0.05, 0.7, 4), STEM_GREEN, { p: [0, 0.35, 0.09], r: [0.25, 0, 0] }),
        part(cyl(0.14, 0.14, 0.03, 8), c, { p: [0, 0.82, 0] }),
        part(sphere(0.05, 6, 5), e, { p: [0, 0.85, 0] }),
      ]);
    case 'flowerPad':
      // White water lily: wide green pad disc + white flower disc
      // + pale centre. Flat by design (pond-edge ground scatter v1).
      return merge([
        part(cyl(0.32, 0.32, 0.03, 10), e, { p: [0, 0.02, 0] }),
        part(cyl(0.14, 0.14, 0.03, 8), c, { p: [0, 0.06, 0] }),
        part(sphere(0.04, 6, 5), FLOWER_CENTER_COLOR, { p: [0, 0.09, 0] }),
      ]);
    case 'beehive': {
      // Tree-hung skep (beehive landing, 2026-10-28 — Adam:
      // wild hives go ON TREES): cylindrical straw body +
      // domed top + dark entrance slot, ~0.76 m wide, ~0.85 m
      // tall, plus a 0.5 m rope from the dome top upward into
      // the canopy. Worldgen hangs it beside a trunk at base
      // height 1.8 m, so the geometry spans base..~1.35 m here.
      // Small-tree artifact (accepted v1): on small trees the
      // rope tip may rise above the canopy top.
      return merge([
        part(cyl(0.35, 0.38, 0.5, 10), c, { p: [0, 0.25, 0] }),
        part(new THREE.SphereGeometry(0.35, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), shade(c, 1.1), { p: [0, 0.5, 0] }),
        part(box(0.14, 0.09, 0.03), 0x1a1a12, { p: [0, 0.12, 0.38] }),
        part(cyl(0.015, 0.015, 0.5, 4), shade(c, 0.6), { p: [0, 1.1, 0] }),
      ]);
    }
  }
}

// ---------------------------------------------------------------------------
// Tall sunflower head (Adam, 2026-10-29, pinned Option A): the stem
// above is ordinary static scatter; the HEAD is a separate pivot
// geometry, instanced per chunk by the renderer and re-aimed at the
// sun on the renderer's 2 s world tick. Everything here is a pure
// function of the worldgen object + the sky cycle — deterministic,
// no RNG, no saved state.
// ---------------------------------------------------------------------------

/** Stem height in metres (Adam PINNED 2.0, 2026-10-29): the head
 *  centre rides at this height x instance scale — above her 1.7 m
 *  eye line at scale 1.0, up to 2.8 m at the top of the scale range. */
export const SUNFLOWER_STEM_HEIGHT_M = 2.0;

/** Head pitch clamp (DRAFT radians, 55°): a face tilts toward the
 *  sun but never past flower-plausible, and never nods below
 *  upright — it reads as trying, not as a radar dish. */
const SUNFLOWER_MAX_PITCH_RAD = (55 * Math.PI) / 180;
/** Night rest pitch (DRAFT, 5°): near-upright, facing east. */
const SUNFLOWER_NIGHT_PITCH_RAD = (5 * Math.PI) / 180;

/**
 * The sunflower head, built around its own pivot (the origin),
 * facing local +z: petal disc (r 0.3, the size it always was)
 * standing in the facing plane, the dark centre dome proud of the
 * face, and a short neck stub behind meeting the stem top.
 * Colours ride the source spec, like every other kind geometry.
 */
export function buildSunflowerHeadGeometry(spec: MeshSpec): THREE.BufferGeometry {
  const c = spec.color;
  const e = spec.extraColor ?? c;
  return merge([
    part(cyl(0.3, 0.3, 0.04, 12), c, { r: [Math.PI / 2, 0, 0] }),
    part(sphere(0.13, 8, 6), e, { p: [0, 0, 0.02], s: [1, 1, 0.45] }),
    part(cyl(0.028, 0.028, 0.1, 5), STEM_GREEN, { r: [Math.PI / 2, 0, 0], p: [0, 0, -0.06] }),
  ]);
}

/**
 * Where every sunflower head aims at a sky-cycle position:
 * yaw follows the sun's azimuth (the codebase facing convention,
 * atan2(x, z)); pitch is the sun's elevation clamped to
 * [0, SUNFLOWER_MAX_PITCH_RAD]. At night (sun below the horizon)
 * the target RESTS facing east, near-upright — young sunflowers
 * re-face east overnight; there is nothing to face in the dark.
 */
export function sunflowerHeadOrientation(
  cycleT: number,
  month: number,
): { yaw: number; pitch: number } {
  const elev = sunElevationAtCycle(cycleT, month);
  if (elev <= 0) {
    return { yaw: Math.PI / 2, pitch: SUNFLOWER_NIGHT_PITCH_RAD };
  }
  const dir = sunDirection(cycleT / dayFraction(month), month);
  return {
    yaw: Math.atan2(dir.x, dir.z),
    pitch: Math.min(elev, SUNFLOWER_MAX_PITCH_RAD),
  };
}

/**
 * Compose one head's instance matrix: position at the stem top
 * (obj.y + STEM_HEIGHT x effective scale), orientation from
 * sunflowerHeadOrientation plus a small deterministic per-head
 * yaw jitter (from the object's own rotY) so a field reads grown,
 * not cloned. effectiveScale is the renderer's composed instance
 * scale (obj.scale, x SHRINK_SCALE while regrowing) — the same
 * scale its stem renders at, so a regrowing sunflower's head
 * rides its shrunk stem instead of floating.
 */
export function sunflowerHeadMatrix(
  obj: { x: number; y: number; z: number; rotY: number },
  effectiveScale: number,
  orientation: { yaw: number; pitch: number },
  out: THREE.Matrix4,
): THREE.Matrix4 {
  const jitter = Math.sin(obj.rotY * 12.9898) * 0.08;
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-orientation.pitch, orientation.yaw + jitter, 0, 'YXZ'),
  );
  out.compose(
    new THREE.Vector3(
      obj.x,
      obj.y + SUNFLOWER_STEM_HEIGHT_M * effectiveScale,
      obj.z,
    ),
    q,
    new THREE.Vector3(effectiveScale, effectiveScale, effectiveScale),
  );
  return out;
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

/** Flame-center height inside a buildCandle() group (holder bottom = 0). */
export const CANDLE_FLAME_Y = 0.31;

/**
 * The witch's carried candle (Adam 2026-10-26 — light settled,
 * starter still open; see fire.ts). Primitive, held upright in
 * her left hand (the umbrella holds the right): brass holder
 * dish, cream stick, dark wick, and a two-part flame in
 * MeshBasicMaterial — unlit on purpose, so the flame reads as
 * lit even in darkness, where a Lambert flame would go black
 * without the point light reaching it. Group origin at the
 * holder bottom; the renderer places the group at the hand and
 * positions the scene-level point light at the flame height.
 * Visual + light-anchor only — no mechanic, no starter path.
 */
export function buildCandle(): THREE.Group {
  const g = new THREE.Group();
  const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.02, 10), meshMat(0x8a6a30));
  holder.position.set(0, 0.01, 0);
  g.add(holder);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 8), meshMat(0xe8dcc0));
  stick.position.set(0, 0.13, 0);
  g.add(stick);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 4), meshMat(0x1a1208));
  wick.position.set(0, 0.255, 0);
  g.add(wick);
  const flameOuter = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffa030 }),
  );
  flameOuter.scale.set(1, 1.8, 1);
  flameOuter.position.set(0, CANDLE_FLAME_Y, 0);
  g.add(flameOuter);
  const flameInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe080 }),
  );
  flameInner.scale.set(1, 1.6, 1);
  flameInner.position.set(0, 0.3, 0);
  g.add(flameInner);
  return g;
}

/** Flame-center height inside a buildTorch() group (stick bottom = 0). */
export const TORCH_FLAME_Y = 0.8;

/**
 * Downward camp arrow (Adam 2026-10-27 — BIG, OBNOXIOUS,
 * pointing DOWN from ABOVE): a 5 m arrow — 3.2 m shaft +
 * 1.8 m head, apex down — in unlit vivid yellow, fog-free,
 * drawn on top of everything (depthTest off, renderOrder
 * 999): a divination marker, not a physical object, so trees
 * and terrain never hide it. Group origin = shaft center;
 * the renderer hangs it above a house at CAMP_ARROW_CENTER_Y.
 */
export function buildCampArrow(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe600, fog: false, depthTest: false });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.2, 8), mat);
  shaft.renderOrder = 999;
  g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 12), mat);
  head.rotation.x = Math.PI; // apex down
  head.position.y = -2.5;
  head.renderOrder = 999;
  g.add(head);
  return g;
}

/**
 * Screen-edge camp arrow: a flat arrow in the camera's XY
 * plane, pointing +Y by default — the renderer rotates it
 * (rotation.z) toward the off-screen camp. Same unmissable
 * yellow, fog-free, depthless, on top.
 */
export function buildEdgeArrow(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe600, fog: false, depthTest: false });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.2, 0.05), mat);
  shaft.renderOrder = 999;
  g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 12), mat);
  head.position.y = 1.05;
  head.renderOrder = 999;
  g.add(head);
  return g;
}

/**
 * Carried torch (Adam 2026-10-27 — Systems torch item + batch
 * lighting landed first): dark stick + twine binding + charred
 * head + two-part basic-material flame (amber outer, pale
 * core — basic on purpose so the flame reads lit in darkness,
 * like the candle's). Bigger flame than the candle's: this is
 * the brighter light. Held in the left hand (the light hand);
 * the renderer supersedes the candle with it while a lit
 * torch is carried.
 */
export function buildTorch(): THREE.Group {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.65, 8), meshMat(0x4a3220));
  stick.position.set(0, 0.325, 0);
  g.add(stick);
  const binding = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), meshMat(0x8a7a50));
  binding.position.set(0, 0.6, 0);
  g.add(binding);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.1, 8), meshMat(0x1a1208));
  head.position.set(0, 0.68, 0);
  g.add(head);
  const flameOuter = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffa030 }),
  );
  flameOuter.scale.set(1, 1.8, 1);
  flameOuter.position.set(0, TORCH_FLAME_Y, 0);
  g.add(flameOuter);
  const flameInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe080 }),
  );
  flameInner.scale.set(1, 1.6, 1);
  flameInner.position.set(0, 0.78, 0);
  g.add(flameInner);
  return g;
}

/**
 * A made ritual altar (Adam 2026-10-27 — placeable + visible
 * ONLY, no ritual actions). The read-at-a-glance shape, my
 * design on the draft suggestion (flagged): a flat stone
 * TABLE on four wooden legs, with a clay bowl atop the
 * centre. Deliberately NOT a house (no walls, no roof) and
 * NOT a fire (no logs, no flame, no light — an altar is
 * not a light source until a ritual says so). Symmetric, so
 * it needs no facing. Overall ~1.4 m wide, ~1.0 m tall:
 * person-scale, unmistakable at a glance, smaller than any
 * house. Lambert materials throughout (lit by sun/moon
 * like the houses — dark at night, like everything unlit).
 */
export function buildAltarGroup(): THREE.Group {
  const g = new THREE.Group();
  // Four wooden legs (frame) at the slab corners, inset.
  const legGeo = new THREE.BoxGeometry(0.1, 0.72, 0.1);
  const legMat = meshMat(0x6b4a2f);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(sx * 0.55, 0.36, sz * 0.3);
      g.add(leg);
    }
  }
  // Flat stone slab (base/table): 1.4 x 0.12 x 0.9, top at 0.84.
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.9), meshMat(0x8a8a86));
  slab.position.set(0, 0.78, 0);
  g.add(slab);
  // Clay bowl atop the centre: a lathe bowl (profile from
  // foot to rim), terracotta, double-sided so the hollow
  // reads from above instead of capping shut.
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.02, 0),
    new THREE.Vector2(0.12, 0.01),
    new THREE.Vector2(0.22, 0.06),
    new THREE.Vector2(0.28, 0.14),
    new THREE.Vector2(0.3, 0.2),
  ];
  const bowlMat = new THREE.MeshLambertMaterial({ color: 0xb5654a, side: THREE.DoubleSide });
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), bowlMat);
  bowl.position.set(0, 0.84, 0);
  g.add(bowl);
  return g;
}

/**
 * A staged ritual bone (Adam 2026-10-27 — tier-1 Waking,
 * site side). The read-at-a-glance shape, my design
 * (flagged): a small pale bone LYING FLAT — shaft with a
 * knob at each end, bone-white, ~0.5 m long, ~0.1 m thick.
 * It lies on the site (altar slab beside the bowl, stump
 * top), never upright, never glowing — a staged bone is
 * waiting, not awakened. The renderer positions it per
 * site kind; this builder only shapes it, lying along X
 * with its centre at the origin.
 */
export function buildStagedBone(): THREE.Group {
  const g = new THREE.Group();
  const mat = meshMat(0xe8e0cc);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), mat);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  for (const sx of [-1, 1]) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat);
    knob.position.set(sx * 0.2, 0, 0);
    g.add(knob);
  }
  return g;
}

/**
 * One low-poly model per animal kind (Adam 2026-10-28 — ambient
 * animals, simple-geometry style, no rigs). Visual drafts for
 * Adam's pin pass: body length/height + a single color per
 * kind, head at the front (+z), optional tail, optional wing
 * planes for flying kinds. Group-local coords, front = +z,
 * feet at y = 0 — the renderer positions/rotates the group
 * from animals.ts instance state.
 *
 * Geometries + materials are cached per kind and SHARED
 * across instances (like the scatter kind materials) — chunk
 * unload disposes nothing for animals. Wings (flying kinds)
 * are flat side planes whose inner edge sits at the body, so
 * rotation.z flaps them around the body edge; the two wing
 * meshes are stored in group.userData.wings as [left, right]
 * for the renderer's flutter pose (left = -x, right = +x).
 */
interface AnimalModelParams {
  length: number;
  height: number;
  color: number;
  long?: boolean;
  head?: boolean;
  wings?: boolean;
  tail?: boolean;
}

const ANIMAL_MODEL_PARAMS: Record<AnimalKind, AnimalModelParams> = {
  owl: { length: 0.45, height: 0.3, color: 0x8a7a5a, head: true, wings: true, tail: true },
  bat: { length: 0.3, height: 0.18, color: 0x3a2a3a, head: true, wings: true },
  pigeon: { length: 0.35, height: 0.22, color: 0x7a7a8a, head: true, wings: true, tail: true },
  beaver: { length: 0.7, height: 0.35, color: 0x6a4a2a, head: true, tail: true },
  turtle: { length: 0.4, height: 0.2, color: 0x4a5a3a, head: true },
  deer: { length: 1.1, height: 0.7, color: 0x8a6a4a, head: true, tail: true },
  fox: { length: 0.7, height: 0.4, color: 0xa05a2a, head: true, tail: true },
  mole: { length: 0.25, height: 0.15, color: 0x4a3a3a, head: true },
  snake: { length: 0.8, height: 0.1, color: 0x3a5a2a, long: true, head: true },
  mouse: { length: 0.2, height: 0.12, color: 0x8a7a6a, head: true, tail: true },
  bear: { length: 1.2, height: 0.8, color: 0x4a3520, head: true, tail: true },
  rabbit: { length: 0.4, height: 0.25, color: 0x9a8a7a, head: true, tail: true },
  raccoon: { length: 0.6, height: 0.35, color: 0x6a6a6a, head: true, tail: true },
  wolf: { length: 1.0, height: 0.65, color: 0x7a7a7a, head: true, tail: true },
  crow: { length: 0.4, height: 0.25, color: 0x1a1a1a, head: true, wings: true, tail: true },
  frog: { length: 0.25, height: 0.15, color: 0x4a7a3a, head: true },
  groundhog: { length: 0.5, height: 0.3, color: 0x7a6a4a, head: true, tail: true },
  squirrel: { length: 0.35, height: 0.2, color: 0x8a5a3a, head: true, tail: true },
  crayfish: { length: 0.3, height: 0.15, color: 0xa04a2a, head: true, tail: true },
  muskrat: { length: 0.5, height: 0.3, color: 0x5a4632, head: true, tail: true },
  mice: { length: 0.2, height: 0.12, color: 0x8a7a6a, head: true, tail: true },
  voles: { length: 0.2, height: 0.12, color: 0x6a5a4a, head: true, tail: true },
  fish: { length: 0.4, height: 0.2, color: 0x6a8a9a, head: true, tail: true },
  eels: { length: 0.6, height: 0.12, color: 0x4a4a3a, long: true, head: true },
  opossum: { length: 0.6, height: 0.35, color: 0x9a9a9a, head: true, tail: true },
  shrew: { length: 0.15, height: 0.09, color: 0x5a4a3a, head: true, tail: true },
};

interface AnimalModelParts {
  body: THREE.BufferGeometry;
  head?: THREE.BufferGeometry;
  wingL?: THREE.BufferGeometry;
  wingR?: THREE.BufferGeometry;
  tail?: THREE.BufferGeometry;
}

const animalPartsCache = new Map<AnimalKind, AnimalModelParts>();
const animalMatCache = new Map<AnimalKind, THREE.MeshLambertMaterial>();

/**
 * Raccoon detail (Adam 2026-10-29 — a live raccoon read as a
 * generic grey animal): the two markings that make a raccoon
 * a raccoon — a RINGED tail (alternating light/dark bands)
 * and the dark FACE MASK across the eye band. Raccoon only:
 * every other kind keeps the shared generic parts untouched.
 * Geometries + materials are cached once, like the generic
 * parts. The kind's sizes stay (length 0.6 / height 0.35 in
 * ANIMAL_MODEL_PARAMS); band count/colors and the mask span
 * are visual drafts for Adam's sighting.
 */
const RACCOON_DARK = 0x33302b;
const RACCOON_LIGHT = 0x8f8f8f;
const RACCOON_TAIL_BANDS = 6;

interface RaccoonDetail {
  tailSegs: THREE.BufferGeometry[];
  mask: THREE.BufferGeometry;
  darkMat: THREE.MeshLambertMaterial;
  lightMat: THREE.MeshLambertMaterial;
}

let raccoonDetailCache: RaccoonDetail | null = null;

function raccoonDetail(p: AnimalModelParams): RaccoonDetail {
  if (raccoonDetailCache) return raccoonDetailCache;
  // Ringed tail: band boxes laid along -z from the body's
  // rear, alternating light/dark with a dark tip. Each band's
  // offset is baked into its geometry (the wing idiom), so
  // assembly places every segment at the one tail origin.
  const segLen = p.length * 0.09;
  const tailSegs: THREE.BufferGeometry[] = [];
  for (let i = 0; i < RACCOON_TAIL_BANDS; i++) {
    const seg = new THREE.BoxGeometry(p.length * 0.24, p.height * 0.36, segLen);
    seg.translate(0, 0, -p.length / 2 - segLen * (i + 0.5));
    tailSegs.push(seg);
  }
  // Face mask: a sphere patch hugging the head (same centre,
  // r x 1.04 so it sits proud of the fur), spanning the eye
  // band across the front (+z). The muzzle below the band
  // stays body-grey and readable.
  const headR = p.height * 0.45;
  const mask = new THREE.SphereGeometry(
    headR * 1.04,
    8,
    4,
    Math.PI / 2 - 0.75,
    1.5,
    Math.PI / 2 - 0.42,
    0.62,
  );
  raccoonDetailCache = {
    tailSegs,
    mask,
    darkMat: meshMat(RACCOON_DARK),
    lightMat: meshMat(RACCOON_LIGHT),
  };
  return raccoonDetailCache;
}

/**
 * Opossum detail (Adam 2026-10-29 — a live opossum read as a
 * tan box with a ball head and cube snout; his words: opossums
 * have "long skinny tails and a pointy face and ears"): a
 * tapered PALE face (a smaller head sphere + cone snout), two
 * small dark upright EARS, and a LONG SKINNY TAIL — a tapered
 * cylinder, roughly body-length, trailing behind with its tip
 * raised, in naked-tail pinkish grey. Opossum only: every
 * other kind keeps the shared generic parts untouched. The
 * kind's sizes stay (length 0.6 / height 0.35 in
 * ANIMAL_MODEL_PARAMS) and the body tint stays 0x9a9a9a —
 * already a grizzled grey; the read comes from the face /
 * ear / tail contrast. Colours and proportions are visual
 * drafts for Adam's sighting.
 */
const OPOSSUM_FACE = 0xe9e3d7;
const OPOSSUM_EAR = 0x2e2a26;
const OPOSSUM_TAIL = 0xc9a49c;
const OPOSSUM_TAIL_RAISE_RAD = 0.35;

interface OpossumDetail {
  head: THREE.BufferGeometry;
  snout: THREE.BufferGeometry;
  earL: THREE.BufferGeometry;
  earR: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  faceMat: THREE.MeshLambertMaterial;
  earMat: THREE.MeshLambertMaterial;
  tailMat: THREE.MeshLambertMaterial;
}

let opossumDetailCache: OpossumDetail | null = null;

function opossumDetail(p: AnimalModelParams): OpossumDetail {
  if (opossumDetailCache) return opossumDetailCache;
  const headR = p.height * 0.45;
  // Smaller head sphere than the generic ball (0.8x) — the
  // taper comes from the snout cone in front of it.
  const head = new THREE.SphereGeometry(headR * 0.8, 8, 8);
  // Pointy snout: cone apex forward (+z); its base embeds in
  // the head sphere (the sphere's cross-section there is
  // wider than the cone's base), so the join never gaps.
  const snout = new THREE.ConeGeometry(headR * 0.55, p.length * 0.34, 6);
  snout.rotateX(Math.PI / 2);
  snout.translate(0, 0, headR * 0.85);
  // Ears: small upright cones straddling the crown, bases
  // sunk into the head sphere, tips proud.
  const earL = new THREE.ConeGeometry(0.032, 0.075, 5);
  earL.translate(-headR * 0.46, headR * 0.78, -headR * 0.12);
  const earR = new THREE.ConeGeometry(0.032, 0.075, 5);
  earR.translate(headR * 0.46, headR * 0.78, -headR * 0.12);
  // Long skinny tail: tapered cylinder (thin tip at the far
  // end), rotated to trail behind (-z) with the tip raised
  // by OPOSSUM_TAIL_RAISE_RAD, root at the body's rear —
  // offsets baked, the raccoon tail's idiom.
  const tailLen = p.length * 0.95;
  const tail = new THREE.CylinderGeometry(0.007, 0.016, tailLen, 5);
  tail.rotateX(OPOSSUM_TAIL_RAISE_RAD - Math.PI / 2);
  tail.translate(
    0,
    Math.sin(OPOSSUM_TAIL_RAISE_RAD) * (tailLen / 2),
    -Math.cos(OPOSSUM_TAIL_RAISE_RAD) * (tailLen / 2) - p.length / 2,
  );
  opossumDetailCache = {
    head,
    snout,
    earL,
    earR,
    tail,
    faceMat: meshMat(OPOSSUM_FACE),
    earMat: meshMat(OPOSSUM_EAR),
    tailMat: meshMat(OPOSSUM_TAIL),
  };
  return opossumDetailCache;
}

/**
 * Subsurface swimmers (Adam 2026-10-29 — a fish read as a
 * crate standing ON the water): fish and eels are built
 * around the group origin as the WATER LINE — the body rides
 * below it and only the back / dorsal / tail tip break it.
 * The renderer poses the group at the instance's WATER_Y, so
 * the submergence lives entirely in these shapes; instance
 * data is untouched. Surface swimmers (frog, turtle,
 * muskrat, beaver, crayfish) keep the generic on-the-line
 * build exactly as before.
 *
 * Fish: an ellipsoid body — flattened, elongated, the snout
 * is the body's tapered front (NO sphere head) — plus a
 * vertical tail fin and a dorsal fin a shade darker than the
 * body. Eels: the shared long-cylinder body sunk below the
 * line, no head sphere, and a low dorsal ridge along the
 * back. Geometries + the fin material are cached once, like
 * the generic parts; sizes derive from the kind params
 * (unchanged). Proportions are visual drafts for Adam's
 * sighting.
 */
interface FishDetail {
  body: THREE.BufferGeometry;
  tailFin: THREE.BufferGeometry;
  dorsalFin: THREE.BufferGeometry;
  finMat: THREE.MeshLambertMaterial;
}

let fishDetailCache: FishDetail | null = null;

function fishDetail(p: AnimalModelParams): FishDetail {
  if (fishDetailCache) return fishDetailCache;
  // Ellipsoid body: unit sphere scaled flat + long, centred
  // below the line so only the back breaks it.
  const body = new THREE.SphereGeometry(1, 10, 8);
  body.scale(p.length * 0.16, p.height * 0.42, p.length * 0.52);
  body.translate(0, -p.height * 0.25, 0);
  // Vertical tail fin at the rear, swept back a touch; its
  // tip breaks the line.
  const tailFin = new THREE.BoxGeometry(0.014, p.height * 0.85, p.length * 0.2);
  tailFin.rotateX(-0.25);
  tailFin.translate(0, -p.height * 0.22, -p.length * 0.6);
  // Dorsal fin amidships, swept back; the part that reads
  // above the surface.
  const dorsalFin = new THREE.BoxGeometry(0.012, p.height * 0.24, p.length * 0.32);
  dorsalFin.rotateX(0.35);
  dorsalFin.translate(0, p.height * 0.15, -p.length * 0.05);
  fishDetailCache = {
    body,
    tailFin,
    dorsalFin,
    finMat: meshMat(shade(p.color, 0.75)),
  };
  return fishDetailCache;
}

let eelRidgeCache: THREE.BufferGeometry | null = null;

function eelRidge(p: AnimalModelParams): THREE.BufferGeometry {
  if (eelRidgeCache) return eelRidgeCache;
  // Low ridge along the sunk cylinder's back; its offset is
  // baked so it sits on the body (body centre rides at
  // -0.375 x height in buildAnimal) and just breaks the line.
  const ridge = new THREE.BoxGeometry(0.012, p.height * 0.25, p.length * 0.8);
  ridge.translate(0, p.height * 0.17, 0);
  eelRidgeCache = ridge;
  return eelRidgeCache;
}

export function buildAnimal(kind: AnimalKind): THREE.Group {
  const p = ANIMAL_MODEL_PARAMS[kind];
  let parts = animalPartsCache.get(kind);
  if (!parts) {
    const width = p.length * 0.55;
    let body: THREE.BufferGeometry;
    if (p.long) {
      body = new THREE.CylinderGeometry(p.height / 2, p.height / 2, p.length, 6);
      body.rotateX(Math.PI / 2);
    } else {
      body = new THREE.BoxGeometry(width, p.height, p.length);
    }
    const head = p.head ? new THREE.SphereGeometry(p.height * 0.45, 8, 8) : undefined;
    let wingL: THREE.BufferGeometry | undefined;
    let wingR: THREE.BufferGeometry | undefined;
    if (p.wings) {
      wingL = new THREE.BoxGeometry(p.length * 0.6, 0.03, p.length * 0.4);
      wingL.translate(-p.length * 0.3, 0, 0);
      wingR = new THREE.BoxGeometry(p.length * 0.6, 0.03, p.length * 0.4);
      wingR.translate(p.length * 0.3, 0, 0);
    }
    const tail = p.tail
      ? new THREE.BoxGeometry(width * 0.5, p.height * 0.4, p.length * 0.25)
      : undefined;
    parts = { body, head, wingL, wingR, tail };
    animalPartsCache.set(kind, parts);
  }
  let mat = animalMatCache.get(kind);
  if (!mat) {
    mat = meshMat(p.color);
    animalMatCache.set(kind, mat);
  }
  const g = new THREE.Group();
  const width = p.length * 0.55;
  if (kind !== 'fish') {
    const body = new THREE.Mesh(parts.body, mat);
    // Eels ride submerged: the shared long cylinder sinks so
    // its centre is below the water line (see eelRidge).
    body.position.set(0, kind === 'eels' ? -p.height * 0.375 : p.height / 2, 0);
    g.add(body);
  }
  if (parts.head && kind !== 'fish' && kind !== 'eels' && kind !== 'opossum') {
    const head = new THREE.Mesh(parts.head, mat);
    head.position.set(0, p.height * 0.7, p.length / 2);
    g.add(head);
  }
  const wings: THREE.Mesh[] = [];
  if (parts.wingL && parts.wingR) {
    const wingL = new THREE.Mesh(parts.wingL, mat);
    wingL.position.set(-width / 2, p.height * 0.7, 0);
    g.add(wingL);
    const wingR = new THREE.Mesh(parts.wingR, mat);
    wingR.position.set(width / 2, p.height * 0.7, 0);
    g.add(wingR);
    wings.push(wingL, wingR);
  }
  if (parts.tail && kind !== 'raccoon' && kind !== 'fish' && kind !== 'opossum') {
    const tail = new THREE.Mesh(parts.tail, mat);
    tail.position.set(0, p.height * 0.5, -p.length / 2 - p.length * 0.1);
    g.add(tail);
  }
  if (kind === 'raccoon') {
    // Ringed tail + face mask replace the generic tail box
    // (see raccoonDetail). Segments alternate light/dark from
    // the body out, dark at the tip; the mask rides at the
    // head's own position so it tracks the head exactly.
    const detail = raccoonDetail(p);
    detail.tailSegs.forEach((seg, i) => {
      const band = new THREE.Mesh(
        seg,
        i % 2 === 0 ? detail.lightMat : detail.darkMat,
      );
      band.position.set(0, p.height * 0.5, 0);
      g.add(band);
    });
    const mask = new THREE.Mesh(detail.mask, detail.darkMat);
    mask.position.set(0, p.height * 0.7, p.length / 2);
    g.add(mask);
  }
  if (kind === 'opossum') {
    // Pointy pale face + dark ears + long naked tail replace
    // the generic head sphere and tail box (see opossumDetail).
    // Every offset is baked; the face parts ride at the
    // generic head's own position and the tail at the generic
    // tail's height, so the pose math never learns about them.
    const detail = opossumDetail(p);
    const headPos = new THREE.Vector3(0, p.height * 0.7, p.length / 2);
    const head = new THREE.Mesh(detail.head, detail.faceMat);
    head.position.copy(headPos);
    g.add(head);
    const snout = new THREE.Mesh(detail.snout, detail.faceMat);
    snout.position.copy(headPos);
    g.add(snout);
    for (const earGeo of [detail.earL, detail.earR]) {
      const ear = new THREE.Mesh(earGeo, detail.earMat);
      ear.position.copy(headPos);
      g.add(ear);
    }
    const tail = new THREE.Mesh(detail.tail, detail.tailMat);
    tail.position.set(0, p.height * 0.5, 0);
    g.add(tail);
  }
  if (kind === 'fish') {
    // Subsurface build (see fishDetail): ellipsoid body +
    // two fins, all offsets baked — every mesh sits at the
    // group origin, which the renderer poses at WATER_Y.
    const detail = fishDetail(p);
    g.add(new THREE.Mesh(detail.body, mat));
    g.add(new THREE.Mesh(detail.tailFin, detail.finMat));
    g.add(new THREE.Mesh(detail.dorsalFin, detail.finMat));
  }
  if (kind === 'eels') {
    // The sunk long-cylinder body was added above; the
    // dorsal ridge completes the eel read.
    g.add(new THREE.Mesh(eelRidge(p), mat));
  }
  if (wings.length === 2) g.userData.wings = wings;
  return g;
}
