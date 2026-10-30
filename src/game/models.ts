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
import { CHAPEL_SEGMENT_M, FARM_SEGMENT_M, GROVE_CELL_M, MILL_SEGMENT_M, SCHOOL_SEGMENT_M, STORE_SEGMENT_M, VILLAGE_SEGMENT_M } from './sites';
import { CAVE_CELL_M } from './caves';
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
  ashPatch: 1.6,
  cavePool: 2.2,
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
  // Kind override (oak tree shares the 'tree' shape slot with
  // the common tree, but an oak must READ differently in the
  // canopy — Adam, 2026-10-30): a stouter trunk and a broader,
  // rounder crown — four blobs spread wide where the common
  // tree's three sit close. Silhouette first, tint second (the
  // oak source's fuller green rides the same parts).
  if (kind === 'oakTree') {
    const branches: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      branches.push(
        part(cyl(0.05, 0.08, 1.1, 4), c, {
          p: [Math.cos(a) * 0.42, 0.6 + i * 0.1, Math.sin(a) * 0.42],
          r: [Math.sin(a) * 0.75, 0, -Math.cos(a) * 0.75],
        }),
      );
    }
    return merge([
      part(cyl(0.24, 0.36, 1.7, 7), c),
      ...branches,
      part(blob(1.3), e, { p: [0, extraDy + 0.1, 0] }),
      part(blob(0.95), shade(e, 0.9), { p: [0.7, extraDy + 0.5, 0.25] }),
      part(blob(0.8), shade(e, 1.05), { p: [-0.65, extraDy + 0.35, -0.3] }),
      part(blob(0.6), shade(e, 1.1), { p: [0.1, extraDy + 0.85, -0.5] }),
    ]);
  }
  // Kind override (the Grove's old trees share the 'tree' shape
  // slot, but they must read VISIBLY OLDER than a standing oak —
  // Adam, 2026-10-30, the age is the game's side of the pill
  // rule; amended the same day: the difference must read BEFORE
  // SHE'S CLOSE, at maze-approach distance). Distance carries
  // on silhouette + palette, so: a much thicker, greyer trunk
  // with a slight lean and a root flare gripping the ground;
  // five heavy branches that droop instead of reaching, plus
  // one pale DEAD limb standing out of the crown (bare wood
  // reads old from far off); a broader, lower crown in a
  // silvered moss-green (the def's extraColor — paler than any
  // wild canopy, so the grove's trees lift out of the forest's
  // deep greens); moss-dark masses hanging at the crown's edge
  // with thin moss strands below them.
  if (kind === 'groveOak') {
    const branches: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      branches.push(
        part(cyl(0.07, 0.11, 1.3, 4), c, {
          p: [Math.cos(a) * 0.5, 0.55 + i * 0.08, Math.sin(a) * 0.5],
          r: [Math.sin(a) * 0.95, 0, -Math.cos(a) * 0.95],
        }),
      );
    }
    const flare: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.8;
      flare.push(
        part(blob(0.42), shade(c, 0.9), {
          p: [Math.cos(a) * 0.36, -0.82, Math.sin(a) * 0.36],
          s: [1, 0.45, 1],
        }),
      );
    }
    const moss: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.55;
      moss.push(
        part(cyl(0.02, 0.032, 0.9, 4), shade(e, 0.6), {
          p: [Math.cos(a) * 1.12, extraDy - 0.35, Math.sin(a) * 1.12],
        }),
      );
    }
    return merge([
      part(cyl(0.34, 0.55, 2.0, 7), c, { r: [0, 0, 0.05] }),
      ...flare,
      ...branches,
      part(cyl(0.03, 0.05, 1.5, 4), shade(c, 1.55), {
        p: [0.3, extraDy + 0.55, 0.15],
        r: [0.25, 0, -0.35],
      }),
      part(blob(1.45), e, { p: [0, extraDy + 0.05, 0] }),
      part(blob(1.05), shade(e, 0.9), { p: [0.85, extraDy + 0.35, 0.3] }),
      part(blob(0.9), shade(e, 1.05), { p: [-0.8, extraDy + 0.2, -0.35] }),
      part(blob(0.7), shade(e, 1.1), { p: [0.15, extraDy + 0.75, -0.55] }),
      part(blob(0.65), shade(e, 0.75), { p: [1.05, extraDy - 0.45, -0.4] }),
      ...moss,
    ]);
  }
  // Kind override (standing stone, sites landing 2026-10-30): a
  // tall weathered slab on a darker plinth, the cap stone set a
  // touch askew — the ring reads as placed, not grown. The
  // scatter scale (0.9-1.35 from sites.ts) varies the heights.
  if (kind === 'standingStone') {
    return merge([
      part(box(1.1, 0.35, 0.68), shade(c, 0.72), { p: [0, -0.85, 0] }),
      part(box(0.95, 2.0, 0.5), c, { p: [0, 0.1, 0] }),
      part(box(0.8, 0.45, 0.44), shade(c, 1.08), { p: [0.05, 1.25, 0], r: [0, 0, 0.07] }),
    ]);
  }
  // Kind override (carved stone, sites landing 2026-10-30): a
  // shorter slab with a pale face plate proud of its +z face —
  // the surface the fragment's carving will live on (the carving
  // itself stages with the marks system). sites.ts rotates the
  // instance so the face meets the maze path.
  if (kind === 'carvedStone') {
    return merge([
      part(box(1.0, 0.3, 0.6), shade(c, 0.75), { p: [0, -0.62, 0] }),
      part(box(0.85, 1.25, 0.45), c, { p: [0, 0.1, 0] }),
      part(box(0.56, 0.82, 0.07), e, { p: [0, 0.12, 0.26] }),
    ]);
  }
  // Kind override (hedge wall, sites landing 2026-10-30): one
  // maze cell-edge of dense hedgerow — a woody core box with a
  // leafy top of flattened blobs, 2.2 m tall all told (over her
  // 1.7 eye: first-person reads a true maze). Length is the
  // maze's cell width from sites.ts, so geometry and collision
  // boxes can never drift apart. Instances rotate to their edge.
  if (kind === 'hedgeWall') {
    const top: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const x = -GROVE_CELL_M / 2 + (i + 0.5) * (GROVE_CELL_M / 4);
      top.push(
        part(blob(0.5), i % 2 === 0 ? e : shade(e, 0.9), {
          p: [x, 0.62, 0],
          s: [1.15, 0.85, 0.95],
        }),
      );
    }
    return merge([
      part(box(GROVE_CELL_M, 1.5, 0.62), c, { p: [0, -0.35, 0] }),
      ...top,
    ]);
  }
  // Kind override (the crow's hoard, sites landing 2026-10-30):
  // a low earthen mound scattered with gathered things — small
  // stones, sticks, a shard — all muted (what SHINES in it
  // stages with the contents systems; v1 is the mound itself).
  if (kind === 'hoardMound') {
    return merge([
      part(flatDisc(1.05, 14), shade(c, 0.7), { p: [0, -0.47, 0] }),
      part(sphere(0.85, 10, 7), c, { p: [0, -0.38, 0], s: [1, 0.38, 1] }),
      part(sphere(0.13, 6, 5), e, { p: [0.4, -0.12, 0.25] }),
      part(sphere(0.1, 6, 5), shade(e, 0.85), { p: [-0.3, -0.14, 0.4] }),
      part(box(0.34, 0.09, 0.22), shade(e, 1.05), { p: [-0.42, -0.12, -0.2], r: [0, 0.5, 0] }),
      part(lyingCyl(0.03, 0.035, 0.7), shade(c, 1.35), { p: [0.15, -0.1, -0.42], r: [0, 0.8, 0] }),
    ]);
  }
  // Kind overrides (the Schoolhouse set, sites.ts): the ruin's
  // fabric. Wall segments are built at SCHOOL_SEGMENT_M long so
  // shape and collision box describe the same stretch of wall.
  // Local ground is y = -baseY (see the grove overrides above).
  if (kind === 'ruinWall') {
    return merge([
      part(box(SCHOOL_SEGMENT_M, 2.6, 0.48), c),
      // Uneven remnants along the top — the broken skyline.
      part(box(1.1, 0.5, 0.5), shade(c, 0.92), { p: [0.8, 1.42, 0], r: [0, 0, 0.06] }),
      part(box(0.7, 0.34, 0.5), shade(e, 1.0), { p: [-1.0, 1.36, 0], r: [0, 0, -0.05] }),
    ]);
  }
  if (kind === 'ruinWallStub') {
    return merge([
      part(box(SCHOOL_SEGMENT_M, 1.16, 0.48), c),
      // A slumped chunk leaning off the break.
      part(box(0.9, 0.5, 0.5), shade(c, 0.9), { p: [-0.85, 0.72, 0.04], r: [0.1, 0.15, 0.22] }),
    ]);
  }
  if (kind === 'bellTower') {
    // Stone body to 4.2 m, then an open belfry: four posts, the
    // bell (extraColor bronze) hanging in the frame, and a
    // four-sided cap — the silhouette she navigates by.
    const posts: THREE.BufferGeometry[] = [];
    for (const sx of [-0.72, 0.72]) {
      for (const sz of [-0.72, 0.72]) {
        posts.push(part(box(0.14, 1.15, 0.14), shade(c, 0.95), { p: [sx, 2.68, sz] }));
      }
    }
    return merge([
      part(box(1.8, 4.2, 1.8), c),
      part(box(1.95, 0.18, 1.95), shade(c, 0.9), { p: [0, 2.12, 0] }),
      ...posts,
      part(box(1.7, 0.12, 0.16), shade(c, 0.9), { p: [0, 3.22, 0] }),
      part(sphere(0.34, 8, 6), e, { p: [0, 2.82, 0], s: [1, 1.15, 1] }),
      part(cone(1.45, 0.95, 4), shade(c, 0.7), { p: [0, 3.75, 0], r: [0, Math.PI / 4, 0] }),
    ]);
  }
  if (kind === 'schoolDesk') {
    // Top at local y 0 (= baseY in the world), two side panels,
    // a bench behind, one dark inkwell dot.
    return merge([
      part(box(1.0, 0.06, 0.55), c),
      part(box(0.05, 0.72, 0.5), shade(c, 0.8), { p: [-0.45, -0.36, 0] }),
      part(box(0.05, 0.72, 0.5), shade(c, 0.8), { p: [0.45, -0.36, 0] }),
      part(box(0.9, 0.05, 0.25), shade(c, 0.9), { p: [0, -0.27, 0.42] }),
      part(box(0.09, 0.03, 0.09), e, { p: [0.32, 0.045, -0.12] }),
    ]);
  }
  if (kind === 'blackboard') {
    // Wood frame (c) around the dark board (e), a pale chalk
    // smudge low on the board, two legs to the floor.
    return merge([
      part(box(3.4, 1.5, 0.08), c),
      part(box(3.1, 1.24, 0.1), e, { p: [0, 0.02, 0.01] }),
      part(box(1.6, 0.16, 0.11), 0xb9beb2, { p: [-0.4, -0.3, 0.01] }),
      part(box(0.09, 0.78, 0.09), shade(c, 0.8), { p: [-1.5, -1.12, 0] }),
      part(box(0.09, 0.78, 0.09), shade(c, 0.8), { p: [1.5, -1.12, 0] }),
    ]);
  }
  if (kind === 'flagpole') {
    // A 6 m pole (baseY 3.0), a finial ball, and the faded flag
    // (extraColor) hanging near-limp from the top.
    return merge([
      part(cyl(0.045, 0.065, 6.0, 6), c),
      part(sphere(0.09, 6, 5), shade(c, 1.2), { p: [0, 3.05, 0] }),
      part(box(1.05, 0.62, 0.03), e, { p: [0.56, 2.62, 0], r: [0, 0, -0.1] }),
    ]);
  }
  if (kind === 'rubble') {
    return merge([
      part(blob(0.55), c, { p: [0, -0.12, 0], s: [1, 0.55, 1] }),
      part(blob(0.38), shade(c, 0.9), { p: [0.5, -0.15, 0.2], s: [1, 0.6, 1] }),
      part(box(0.5, 0.3, 0.42), shade(e, 1.0), { p: [-0.45, -0.12, -0.15], r: [0.15, 0.4, 0.1] }),
    ]);
  }
  // Kind overrides (the Burnt Village set, sites.ts): house
  // fabric built at VILLAGE_SEGMENT_M so shape and collision
  // describe the same stretch of wall. Local ground is
  // y = -baseY (walls: baseY 1.3; roofs and the well carry
  // their height in the feature's y / their own baseY).
  if (kind === 'villageWall') {
    // Weathered plank wall: the run of boards, a top beam,
    // and one dark window opening (extraColor) on the face.
    return merge([
      part(box(VILLAGE_SEGMENT_M, 2.6, 0.3), c),
      part(box(VILLAGE_SEGMENT_M, 0.18, 0.36), shade(c, 1.12), { p: [0, 1.18, 0] }),
      part(box(0.72, 0.95, 0.34), e, { p: [0.85, 0.12, 0] }),
      part(box(0.14, 2.6, 0.34), shade(c, 0.88), { p: [-1.1, 0, 0] }),
    ]);
  }
  if (kind === 'villageWallCharred') {
    // The same wall, burned: a jagged top (two tilted
    // remnants), a fallen brace leaning at the base.
    return merge([
      part(box(VILLAGE_SEGMENT_M, 2.6, 0.3), c),
      part(box(1.0, 0.5, 0.32), shade(c, 1.15), { p: [0.9, 1.45, 0], r: [0, 0, 0.12] }),
      part(box(0.7, 0.38, 0.32), shade(c, 0.9), { p: [-1.05, 1.4, 0], r: [0, 0, -0.16] }),
      part(box(0.16, 1.9, 0.16), shade(e, 1.0), { p: [-0.5, -0.85, 0.3], r: [0.35, 0, 0.2] }),
    ]);
  }
  if (kind === 'villageRoof') {
    // Gable roof, origin at the wall top (the feature's y
    // carries the height): two sloped planes meeting at a
    // ridge beam that runs along local X, and a stone
    // chimney at +2.3 x — the hearth house's chimney is the
    // smoke anchor sites.ts names (every standing house
    // has one; only the hearth house's smokes).
    const slope = 0.68;
    return merge([
      part(box(7.6, 0.09, 4.3), c, { p: [0, 1.28, -1.78], r: [slope, 0, 0] }),
      part(box(7.6, 0.09, 4.3), c, { p: [0, 1.28, 1.78], r: [-slope, 0, 0] }),
      part(box(7.7, 0.15, 0.22), shade(c, 1.1), { p: [0, 2.42, 0] }),
      part(box(0.55, 1.15, 0.55), 0x7d7668, { p: [2.3, 2.2, 0] }),
      part(box(0.7, 0.12, 0.7), 0x6e6a5e, { p: [2.3, 2.8, 0] }),
    ]);
  }
  if (kind === 'villageRoofFallen') {
    // The roof, in: one plane tilted down into the house,
    // a broken second piece across it, charred throughout.
    return merge([
      part(box(7.2, 0.09, 4.0), c, { p: [0, 0.78, 0.4], r: [0.5, 0, 0.04] }),
      part(box(3.4, 0.09, 3.6), shade(c, 1.12), { p: [-1.2, 0.36, -0.8], r: [0.2, 0.4, 0.15] }),
      part(box(2.2, 0.3, 0.3), shade(e, 1.0), { p: [0.8, 0.5, 0.2], r: [0, 0.2, 0.3] }),
    ]);
  }
  if (kind === 'villageWell') {
    // Stone ring (local ground -0.9), a dark water disc at
    // the rim, two posts and a little gable cap (extraColor
    // wood). The village's unburned landmark.
    return merge([
      part(cyl(0.78, 0.88, 0.9, 9), c, { p: [0, -0.45, 0] }),
      part(flatDisc(0.68, 9), 0x14181c, { p: [0, 0.01, 0] }),
      part(box(0.12, 1.5, 0.12), e, { p: [-0.95, -0.15, 0] }),
      part(box(0.12, 1.5, 0.12), e, { p: [0.95, -0.15, 0] }),
      part(box(2.05, 0.1, 0.14), shade(e, 1.1), { p: [0, 0.52, 0] }),
      part(box(1.5, 0.07, 0.8), shade(e, 0.9), { p: [-0.36, 0.78, 0], r: [0, 0, 0.5] }),
      part(box(1.5, 0.07, 0.8), shade(e, 0.9), { p: [0.36, 0.78, 0], r: [0, 0, -0.5] }),
    ]);
  }
  // Kind overrides (the Farmhouse set, sites.ts): a mostly
  // intact house — boards, a whole mossy roof, the composed
  // porch, and the hearth's hewn stone. Local ground is
  // y = -baseY (walls 1.3, porch 1.15, stone 0.42; the roof
  // carries its height in the feature's y).
  if (kind === 'farmWall') {
    return merge([
      part(box(FARM_SEGMENT_M, 2.6, 0.3), c),
      part(box(FARM_SEGMENT_M, 0.18, 0.36), shade(c, 1.1), { p: [0, 1.18, 0] }),
      part(box(FARM_SEGMENT_M, 0.05, 0.33), shade(c, 0.85), { p: [0, -0.5, 0] }),
      part(box(0.62, 0.85, 0.34), e, { p: [-0.6, 0.1, 0] }),
    ]);
  }
  if (kind === 'farmRoof') {
    // Gable roof, origin at the wall top: two mossy planes,
    // a ridge beam, and the stone chimney (extraColor) over
    // the hearth end (local -X, where sites.ts puts it).
    const slope = 0.62;
    return merge([
      part(box(10.6, 0.09, 4.9), c, { p: [0, 1.42, -2.0], r: [slope, 0, 0] }),
      part(box(10.6, 0.09, 4.9), c, { p: [0, 1.42, 2.0], r: [-slope, 0, 0] }),
      part(box(10.7, 0.15, 0.22), shade(c, 1.12), { p: [0, 2.62, 0] }),
      part(box(0.55, 1.25, 0.55), e, { p: [-3.6, 2.35, 0] }),
      part(box(0.7, 0.12, 0.7), shade(e, 0.9), { p: [-3.6, 3.0, 0] }),
    ]);
  }
  if (kind === 'farmPorch') {
    // The composed porch, origin at the door's wall line,
    // local +Z pointing OUT of the house: two front posts
    // (their spots are the collision boxes sites.ts ships),
    // a near-flat roof slab on a back beam, a step stone.
    return merge([
      part(box(0.14, 2.3, 0.14), c, { p: [-1.65, 0, 2.05] }),
      part(box(0.14, 2.3, 0.14), c, { p: [1.65, 0, 2.05] }),
      part(box(3.9, 0.16, 0.12), shade(c, 1.05), { p: [0, 1.05, 0.06] }),
      part(box(3.9, 0.09, 2.5), shade(e, 1.0), { p: [0, 1.13, 1.12], r: [0.05, 0, 0] }),
      part(box(1.6, 0.12, 0.7), 0x8a8578, { p: [0, -1.09, 0.95] }),
    ]);
  }
  if (kind === 'hearthStone') {
    // One great hewn block with a cap slab — the hearth
    // block (scaled up by sites) and the Great Stone share
    // the build; the stone is the carrier.
    return merge([
      part(box(0.95, 0.8, 0.65), c, { p: [0, -0.02, 0] }),
      part(box(1.05, 0.12, 0.75), shade(e, 1.0), { p: [0, 0.44, 0] }),
    ]);
  }
  // Kind overrides (the Chapel set, sites.ts): a taller
  // shell, a steep roof, the steeple silhouette, and the
  // yard's two stones. Local ground is y = -baseY (walls
  // 1.7, steeple 3.1, stones 0.35 / 0.5; the roof carries
  // its height in the feature's y).
  if (kind === 'chapelWall') {
    return merge([
      part(box(CHAPEL_SEGMENT_M, 3.4, 0.32), c),
      part(box(CHAPEL_SEGMENT_M, 0.2, 0.38), shade(c, 1.08), { p: [0, 1.56, 0] }),
      part(box(0.5, 1.9, 0.36), e, { p: [-0.55, 0.25, 0] }),
      part(box(0.5, 1.9, 0.36), e, { p: [0.85, 0.25, 0] }),
    ]);
  }
  if (kind === 'chapelRoof') {
    // Steep gable, origin at the wall top: two slate
    // planes meeting high, a ridge beam. The gable ends
    // stay open (the farm/village precedent).
    const slope = 0.98;
    return merge([
      part(box(11.6, 0.09, 3.9), c, { p: [0, 1.55, -1.35], r: [slope, 0, 0] }),
      part(box(11.6, 0.09, 3.9), c, { p: [0, 1.55, 1.35], r: [-slope, 0, 0] }),
      part(box(11.7, 0.16, 0.2), shade(e, 1.0), { p: [0, 2.95, 0] }),
    ]);
  }
  if (kind === 'steeple') {
    // Tower from the ground (local -3.1) through the roof
    // line: stone shaft, a belfry with dark openings on
    // every face, a four-sided spire, and the cross.
    return merge([
      part(box(1.7, 4.6, 1.7), c, { p: [0, -0.8, 0] }),
      part(box(1.9, 1.1, 1.9), shade(c, 1.06), { p: [0, 1.95, 0] }),
      part(box(1.2, 0.7, 0.06), e, { p: [0, 1.95, 0.96] }),
      part(box(1.2, 0.7, 0.06), e, { p: [0, 1.95, -0.96] }),
      part(box(0.06, 0.7, 1.2), e, { p: [0.96, 1.95, 0] }),
      part(box(0.06, 0.7, 1.2), e, { p: [-0.96, 1.95, 0] }),
      part(cone(1.45, 2.6, 4), shade(e, 1.0), { p: [0, 3.75, 0], r: [0, Math.PI / 4, 0] }),
      part(box(0.08, 0.7, 0.08), e, { p: [0, 5.25, 0] }),
      part(box(0.44, 0.08, 0.08), e, { p: [0, 5.32, 0] }),
    ]);
  }
  if (kind === 'gravestone') {
    // A rounded slab: a box with a squashed-sphere cap.
    return merge([
      part(box(0.62, 0.7, 0.1), c, { p: [0, -0.02, 0] }),
      part(sphere(0.31, 10, 8), c, { p: [0, 0.3, 0], s: [1, 0.55, 0.32] }),
      part(box(0.7, 0.1, 0.22), shade(e, 1.0), { p: [0, -0.32, 0] }),
    ]);
  }
  if (kind === 'gravestoneCross') {
    return merge([
      part(box(0.16, 1.0, 0.12), c, { p: [0, 0, 0] }),
      part(box(0.55, 0.14, 0.12), c, { p: [0, 0.22, 0] }),
      part(box(0.5, 0.18, 0.3), shade(e, 1.0), { p: [0, -0.41, 0] }),
    ]);
  }
  // Kind overrides (the cave sets, caves.ts + sites.ts):
  // the mouth facade, its boulders, and the dimension's
  // rock — walls, ceiling, teeth, pools, and the entrance
  // fungus. Local ground is y = -baseY.
  if (kind === 'caveMouth') {
    // Two side rocks, a lintel, and the black inset
    // (extraColor) set into the face — the dark itself.
    return merge([
      part(box(0.9, 3.0, 0.8), c, { p: [-1.3, 0, 0] }),
      part(box(0.9, 3.0, 0.8), c, { p: [1.3, 0, 0] }),
      part(box(3.5, 1.0, 0.9), shade(c, 0.92), { p: [0, 1.7, 0] }),
      part(box(1.9, 2.7, 0.3), e, { p: [0, -0.15, -0.25] }),
      part(box(2.2, 0.25, 0.9), shade(c, 1.08), { p: [0, -1.42, 0.5] }),
    ]);
  }
  if (kind === 'caveBoulder') {
    return merge([
      part(blob(0.85), c, { p: [0, -0.12, 0], s: [1, 0.78, 1] }),
      part(blob(0.5), shade(e, 1.0), { p: [0.55, -0.3, 0.2], s: [1, 0.7, 1] }),
    ]);
  }
  if (kind === 'caveRock') {
    // A chamber wall segment: one cell long, ceiling
    // height, with an irregular brow along the top.
    return merge([
      part(box(CAVE_CELL_M, 3.2, 0.55), c),
      part(box(CAVE_CELL_M, 0.3, 0.72), shade(c, 0.9), { p: [0, 1.55, 0], r: [0, 0, 0.02] }),
      part(box(0.5, 0.8, 0.62), shade(c, 1.06), { p: [-1.1, -1.2, 0] }),
    ]);
  }
  if (kind === 'caveCeiling') {
    return merge([
      part(box(CAVE_CELL_M, 0.35, CAVE_CELL_M), c),
      part(box(0.5, 0.3, 0.5), shade(c, 0.88), { p: [0.4, -0.3, -0.3] }),
    ]);
  }
  if (kind === 'stalactite') {
    return merge([
      part(cone(0.34, 1.7, 6), c, { p: [0, 0.55, 0], r: [Math.PI, 0, 0] }),
      part(cone(0.2, 0.9, 5), shade(c, 1.08), { p: [0.32, 0.95, 0.1], r: [Math.PI, 0, 0] }),
    ]);
  }
  if (kind === 'twilightFungus') {
    // A small cluster of pale caps on short stems — the
    // bright color plus the renderer's dim light at these
    // spots is the entrance glow.
    return merge([
      part(cyl(0.03, 0.04, 0.22, 5), e, { p: [-0.18, -0.14, 0.04] }),
      part(sphere(0.16, 8, 6), c, { p: [-0.18, 0.0, 0.04], s: [1, 0.62, 1] }),
      part(cyl(0.025, 0.035, 0.16, 5), e, { p: [0.14, -0.17, -0.08] }),
      part(sphere(0.12, 8, 6), c, { p: [0.14, -0.05, -0.08], s: [1, 0.62, 1] }),
      part(sphere(0.09, 8, 6), shade(c, 0.9), { p: [0.02, -0.16, 0.16], s: [1, 0.6, 1] }),
    ]);
  }
  // Kind overrides (the General Store set, sites.ts):
  // walls, the false front, roof, boardwalk, and the
  // interior fixtures. Local ground is y = -baseY.
  if (kind === 'storeWall') {
    return merge([
      part(box(STORE_SEGMENT_M, 3.0, 0.3), c),
      part(box(0.7, 0.9, 0.34), e, { p: [0.45, 0.35, 0] }),
      part(box(STORE_SEGMENT_M, 0.18, 0.36), shade(c, 1.1), { p: [0, -1.42, 0] }),
    ]);
  }
  if (kind === 'storeFront') {
    // The false front: a 4.6 m board face — the wall body
    // below, the parapet above the roofline, a broad dark
    // shop window, and the blank sign board.
    return merge([
      part(box(STORE_SEGMENT_M, 4.6, 0.3), c),
      part(box(1.5, 1.1, 0.34), e, { p: [0, -0.75, 0] }),
      part(box(1.9, 0.5, 0.36), shade(e, 1.6), { p: [0, 1.15, 0] }),
      part(box(STORE_SEGMENT_M + 0.1, 0.22, 0.44), shade(c, 0.9), { p: [0, 2.38, 0] }),
    ]);
  }
  if (kind === 'storeRoof') {
    // Gabled pair (the farm roof's shape, the store's
    // span) + the stove's pipe toward the back.
    return merge([
      part(box(13.1, 0.09, 4.6), c, { p: [0, 1.35, -1.95], r: [0.6, 0, 0] }),
      part(box(13.1, 0.09, 4.6), c, { p: [0, 1.35, 1.95], r: [-0.6, 0, 0] }),
      part(cyl(0.09, 0.11, 0.9, 6), shade(e, 1.0), { p: [-1.5, 2.6, -0.9] }),
    ]);
  }
  if (kind === 'storePorch') {
    // One boardwalk segment: slab out from the wall line,
    // a lean-to roof above, posts at the outer corners
    // (inset 0.06 from the segment ends, so a run's joints
    // read as paired posts, never coincident).
    return merge([
      part(box(STORE_SEGMENT_M, 0.14, 1.9), c, { p: [0, -0.45, 0.9] }),
      part(box(STORE_SEGMENT_M, 0.08, 2.0), shade(c, 0.92), { p: [0, 1.55, 0.95], r: [0.08, 0, 0] }),
      part(box(0.11, 2.0, 0.11), shade(e, 1.0), { p: [-1.19, 0.55, 1.75] }),
      part(box(0.11, 2.0, 0.11), shade(e, 1.0), { p: [1.19, 0.55, 1.75] }),
    ]);
  }
  if (kind === 'storeCounter') {
    // A 2.4 m counter unit: slab top, front panel, end
    // legs, and the silhouettes of goods left on top.
    return merge([
      part(box(2.4, 0.08, 0.75), c, { p: [0, 0.5, 0] }),
      part(box(2.4, 1.0, 0.1), shade(c, 0.9), { p: [0, 0, 0.3] }),
      part(box(0.1, 1.0, 0.65), shade(c, 0.85), { p: [-1.1, 0, 0] }),
      part(box(0.1, 1.0, 0.65), shade(c, 0.85), { p: [1.1, 0, 0] }),
      part(box(0.3, 0.25, 0.3), e, { p: [-0.7, 0.67, 0] }),
      part(box(0.24, 0.2, 0.24), shade(e, 0.85), { p: [0.4, 0.64, -0.1] }),
    ]);
  }
  if (kind === 'storeShelf') {
    // A 2.2 m shelf unit: posts, three boards, and goods
    // silhouettes (extraColor blocks and a jar — shapes
    // only until the salvage claim).
    return merge([
      part(box(0.08, 2.2, 0.6), c, { p: [-1.06, 0, 0] }),
      part(box(0.08, 2.2, 0.6), c, { p: [1.06, 0, 0] }),
      part(box(2.2, 0.06, 0.55), shade(c, 1.08), { p: [0, -0.6, 0] }),
      part(box(2.2, 0.06, 0.55), shade(c, 1.08), { p: [0, 0.1, 0] }),
      part(box(2.2, 0.06, 0.55), shade(c, 1.08), { p: [0, 0.8, 0] }),
      part(box(0.3, 0.35, 0.4), e, { p: [-0.7, -0.4, 0] }),
      part(box(0.25, 0.5, 0.35), shade(e, 0.85), { p: [0.2, 0.38, 0] }),
      part(cyl(0.09, 0.09, 0.28, 6), e, { p: [0.75, 0.97, 0] }),
      part(box(0.4, 0.3, 0.4), shade(e, 1.15), { p: [-0.3, 0.98, 0] }),
    ]);
  }
  // Kind overrides (the Drowned Mill set, sites.ts):
  // stone walls with their tide band, the one standing
  // slope, the fallen slope, the wheel, and the race.
  // Local ground is y = -baseY.
  if (kind === 'millWall') {
    return merge([
      part(box(MILL_SEGMENT_M, 3.2, 0.36), c),
      part(box(MILL_SEGMENT_M, 0.9, 0.38), e, { p: [0, -1.15, 0] }),
      part(box(MILL_SEGMENT_M, 0.22, 0.3), shade(c, 0.8), { p: [0, 1.5, 0] }),
    ]);
  }
  if (kind === 'millWallFallen') {
    // A wall segment lying flat: length along X, the
    // wall's height fallen along Z, the tide band across
    // its up-face.
    return merge([
      part(box(MILL_SEGMENT_M, 0.32, 3.2), c),
      part(box(MILL_SEGMENT_M, 0.34, 0.9), e, { p: [0, 0.01, -1.0] }),
      part(box(MILL_SEGMENT_M, 0.36, 0.24), shade(c, 0.85), { p: [0, 0.01, 1.35] }),
    ]);
  }
  if (kind === 'millRoof') {
    // ONE slope (over local +Z) + the ridge beam — the
    // water slope is gone; the open side is the ruin.
    return merge([
      part(box(9.6, 0.09, 4.3), c, { p: [0, 1.32, 1.9], r: [-0.62, 0, 0] }),
      part(box(9.6, 0.16, 0.22), e, { p: [0, 2.4, 0] }),
    ]);
  }
  if (kind === 'millRoofFallen') {
    // The fallen slope, crumpled against its wall.
    return merge([
      part(box(9.6, 0.09, 4.2), c, { p: [0, -0.1, 0], r: [0.5, 0, 0] }),
      part(box(0.14, 0.14, 3.6), shade(e, 1.0), { p: [-2.2, 0.15, 0.3], r: [0.5, 0, 0.2] }),
      part(box(0.14, 0.14, 3.6), shade(e, 1.0), { p: [2.2, 0.15, 0.3], r: [0.5, 0, -0.2] }),
    ]);
  }
  if (kind === 'millWheel') {
    // The great wheel in its local XY plane (axle along
    // Z): hub, four spokes (eight arms), two rim rings of
    // segments, and radial paddles — with a BROKEN ARC:
    // segments 3 and 4 (rim + paddles) are simply gone.
    const parts: THREE.BufferGeometry[] = [
      part(cyl(0.26, 0.26, 0.55, 8), e, { r: [Math.PI / 2, 0, 0] }),
    ];
    for (let k = 0; k < 4; k++) {
      parts.push(part(box(3.3, 0.13, 0.1), c, { r: [0, 0, (k * Math.PI) / 4] }));
    }
    for (let k = 0; k < 8; k++) {
      if (k === 3 || k === 4) continue; // the broken arc
      const a = (k * Math.PI) / 4;
      const px = Math.cos(a) * 1.6;
      const py = Math.sin(a) * 1.6;
      parts.push(part(box(0.17, 1.25, 0.13), c, { p: [px, py, 0.3], r: [0, 0, a] }));
      parts.push(part(box(0.17, 1.25, 0.13), c, { p: [px, py, -0.3], r: [0, 0, a] }));
      parts.push(part(box(0.45, 0.07, 0.68), shade(e, 1.1), { p: [Math.cos(a) * 1.62, Math.sin(a) * 1.62, 0], r: [0, 0, a] }));
    }
    return merge(parts);
  }
  if (kind === 'millRace') {
    // A stone-cheeked channel: two cheeks, a dark water
    // strip between, cross boards at the ends.
    return merge([
      part(box(3.2, 0.5, 0.3), c, { p: [0, -0.05, 0.75] }),
      part(box(3.2, 0.5, 0.3), c, { p: [0, -0.05, -0.75] }),
      part(box(3.2, 0.06, 1.2), e, { p: [0, -0.2, 0] }),
      part(box(0.3, 0.08, 1.8), shade(c, 0.9), { p: [-1.2, 0.22, 0] }),
      part(box(0.3, 0.08, 1.8), shade(c, 0.9), { p: [1.2, 0.22, 0] }),
    ]);
  }
  // Kind overrides (the Sunken Road set, sites.ts):
  // pavement slabs (the sunken variant carries its tilt
  // in the mesh), shoulder posts, the signed post.
  // Local ground is y = -baseY.
  if (kind === 'roadSlab') {
    return merge([
      part(box(5, 0.12, 4.4), c),
      part(box(5, 0.13, 0.5), e, { p: [0, 0, 1.95] }),
      part(box(5, 0.13, 0.5), e, { p: [0, 0, -1.95] }),
      part(box(0.18, 0.13, 4.4), e, { p: [0.8, 0.005, 0] }),
      part(box(2.2, 0.13, 0.16), e, { p: [-1.2, 0.005, 0.9] }),
    ]);
  }
  if (kind === 'roadSlabSunk') {
    const tilt: [number, number, number] = [0.05, 0, 0.035];
    return merge([
      part(box(5, 0.12, 4.4), c, { r: tilt }),
      part(box(5, 0.13, 0.5), e, { p: [0, 0, 1.95], r: tilt }),
      part(box(5, 0.13, 0.5), e, { p: [0, 0, -1.95], r: tilt }),
      part(box(0.18, 0.13, 4.4), e, { p: [0.8, 0.005, 0], r: tilt }),
    ]);
  }
  if (kind === 'roadPost') {
    return merge([
      part(box(0.14, 1.1, 0.14), c),
      part(box(0.2, 0.08, 0.2), e, { p: [0, 0.58, 0] }),
    ]);
  }
  if (kind === 'roadSign') {
    return merge([
      part(box(0.14, 1.8, 0.14), c),
      part(box(1.1, 0.6, 0.06), e, { p: [0, 0.55, 0] }),
      part(box(0.08, 0.5, 0.08), shade(c, 0.9), { p: [0, 0.55, -0.07] }),
    ]);
  }
  // Kind overrides (the Rail Siding set, sites.ts): the
  // bed with ties composed in, rails, the boxcar (door on
  // its local +Z), platform, buffer. Ground = -baseY.
  if (kind === 'sidingBed') {
    const parts: THREE.BufferGeometry[] = [part(box(46, 0.1, 3.4), c)];
    for (let x = -22; x <= 22; x += 2.9) {
      parts.push(part(box(0.24, 0.06, 2.4), e, { p: [x, 0.07, 0] }));
    }
    return merge(parts);
  }
  if (kind === 'sidingRail') {
    return merge([
      part(box(92, 0.16, 0.09), c),
      part(box(92, 0.03, 0.11), e, { p: [0, 0.09, 0] }),
    ]);
  }
  if (kind === 'boxcarBody') {
    // The car whole: underframe + wheels, floor, ribbed
    // sides, roof — and on local +Z the sliding door,
    // standing open: dark opening, panel slid aside, the
    // shifted load right behind it, crates beyond.
    const parts: THREE.BufferGeometry[] = [
      part(box(9.5, 0.3, 2.6), e, { p: [0, -1.25, 0] }),
      part(box(9.5, 0.12, 2.9), shade(e, 1.4), { p: [0, -1.05, 0] }),
      part(box(9.5, 2.6, 0.12), c, { p: [0, 0.25, -1.39] }),
      // The +Z side is built AROUND the door opening
      // (x -1.55..0.35): two runs + a lintel.
      part(box(3.2, 2.6, 0.12), c, { p: [-3.15, 0.25, 1.39] }),
      part(box(4.4, 2.6, 0.12), c, { p: [2.55, 0.25, 1.39] }),
      part(box(1.9, 0.3, 0.12), c, { p: [-0.6, 1.4, 1.39] }),
      part(box(0.12, 2.6, 2.9), c, { p: [-4.69, 0.25, 0] }),
      part(box(0.12, 2.6, 2.9), c, { p: [4.69, 0.25, 0] }),
      part(box(9.7, 0.14, 3.1), shade(c, 0.9), { p: [0, 1.62, 0] }),
      // The opening (dark) + the slid panel beside it.
      part(box(1.9, 2.2, 0.06), e, { p: [-0.6, 0.15, 1.4] }),
      part(box(1.9, 2.2, 0.08), shade(c, 0.92), { p: [-2.6, 0.15, 1.48] }),
      // The shifted load, right behind the opening.
      part(box(1.1, 1.1, 1.0), shade(e, 1.25), { p: [-0.6, -0.5, 0.85], r: [0, 0.3, 0] }),
      // Dressing deeper in.
      part(box(0.8, 0.8, 0.8), shade(e, 1.1), { p: [1.8, -0.6, 0.6] }),
      part(box(0.8, 0.8, 0.8), shade(e, 0.95), { p: [2.7, -0.6, -0.5] }),
      part(cyl(0.32, 0.32, 0.9, 8), shade(e, 1.2), { p: [0.8, -0.6, -0.8] }),
    ];
    for (const wx of [-3.4, 3.4]) {
      for (const wz of [-0.75, 0.75]) {
        parts.push(part(cyl(0.42, 0.42, 0.12, 10), e, { p: [wx, -1.15, wz], r: [Math.PI / 2, 0, 0] }));
      }
    }
    for (const rx of [-3.5, -1.2, 1.2, 3.5]) {
      parts.push(part(box(0.18, 2.6, 0.16), shade(c, 0.88), { p: [rx, 0.25, 1.39] }));
      parts.push(part(box(0.18, 2.6, 0.16), shade(c, 0.88), { p: [rx, 0.25, -1.39] }));
    }
    return merge(parts);
  }
  if (kind === 'sidingPlatform') {
    return merge([
      part(box(8, 0.3, 2.2), c, { p: [0, 0.05, 0] }),
      part(box(0.18, 0.35, 0.18), shade(e, 1.0), { p: [-3.6, -0.25, 0.9] }),
      part(box(0.18, 0.35, 0.18), shade(e, 1.0), { p: [3.6, -0.25, 0.9] }),
      part(box(0.18, 0.35, 0.18), shade(e, 1.0), { p: [-3.6, -0.25, -0.9] }),
      part(box(0.18, 0.35, 0.18), shade(e, 1.0), { p: [3.6, -0.25, -0.9] }),
      part(box(0.9, 0.9, 0.9), e, { p: [2.4, 0.65, 0] }),
    ]);
  }
  if (kind === 'sidingBuffer') {
    return merge([
      part(box(0.3, 1.4, 0.3), e, { p: [0, 0, 1.1] }),
      part(box(0.3, 1.4, 0.3), e, { p: [0, 0, -1.1] }),
      part(box(0.35, 0.5, 2.6), c, { p: [0, 0.35, 0] }),
      part(box(0.16, 1.5, 0.16), shade(e, 1.0), { p: [-0.5, -0.1, 1.1], r: [0, 0, 0.6] }),
      part(box(0.16, 1.5, 0.16), shade(e, 1.0), { p: [-0.5, -0.1, -1.1], r: [0, 0, 0.6] }),
    ]);
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
// Cave brick variants (MODELS lane, claim approved by DEV
// 2026-10-30). ADDITIVE EXPORTS ONLY: buildKindGeometry and every
// existing kind above are untouched (the golden-probe rule — the
// landed cave kinds are the control set). These are brick FORMS
// the cave generators adopt later under their own claims;
// per-instance seasoning (position, rotY, scale) stays
// generation's job, exactly as for every other kind. Each builder
// is a pure function of its spec's colors, built from fixed part
// tables — no RNG, per this module's determinism law. Origins:
// - hanging forms (stalactites, drape): y = 0 is the ceiling /
//   wall-top attach plane, geometry extends DOWN (-y). Adopt
//   with baseY 0 and the feature y at the attach height.
// - floor forms (stalagmites, crystal, pool): y = 0 is the
//   floor, geometry rises (+y). Adopt with baseY 0.
// - fungus shelf: y = 0 is the lowest shelf's attach line on a
//   vertical face, shelves protrude toward +z; rotate the
//   instance to face the room. Adopt with baseY 0.
// ---------------------------------------------------------------------------

/** Stalactite cluster, sparse: 3 teeth, staggered lengths. */
export function buildStalactiteClusterSparseGeometry(spec: MeshSpec): THREE.BufferGeometry {
  const c = spec.color;
  const e = spec.extraColor ?? c;
  return merge([
    part(cone(0.3, 1.5, 6), c, { p: [0, -0.75, 0], r: [Math.PI, 0, 0] }),
    part(cone(0.18, 0.9, 5), shade(e, 1.08), { p: [0.42, -0.45, 0.12], r: [Math.PI, 0, 0] }),
    part(cone(0.14, 0.65, 5), shade(c, 0.92), { p: [-0.38, -0.33, -0.1], r: [Math.PI, 0, 0] }),
  ]);
}

/** Stalactite cluster, dense: a 7-tooth curtain. */
export function buildStalactiteClusterDenseGeometry(spec: MeshSpec): THREE.BufferGeometry {
  const c = spec.color;
  const e = spec.extraColor ?? c;
  // [x, z, radius, length] — fixed table, staggered curtain.
  const teeth: [number, number, number, number][] = [
    [0, 0, 0.26, 1.8],
    [0.35, 0.1, 0.18, 1.2],
    [-0.33, 0.14, 0.16, 1.05],
    [0.18, -0.28, 0.15, 0.9],
    [-0.2, -0.25, 0.19, 1.35],
    [0.52, -0.15, 0.12, 0.7],
    [-0.52, -0.05, 0.11, 0.6],
  ];
  const shades = [1.0, 1.08, 0.92];
  return merge(
    teeth.map(([x, z, r, h], i) =>
      part(cone(r, h, 5), shade(i % 2 === 0 ? c : e, shades[i % 3]), {
        p: [x, -h / 2, z],
        r: [Math.PI, 0, 0],
      }),
    ),
  );
}

/** Stalactite, giant: one massive tooth with two shoulders. */
export function buildStalactiteGiantGeometry(spec: MeshSpec): THREE.BufferGeometry {
  const c = spec.color;
  const e = spec.extraColor ?? c;
  return merge([
    part(cone(0.55, 2.6, 7), c, { p: [0, -1.3, 0], r: [Math.PI, 0, 0] }),
    part(cone(0.28, 1.3, 6), shade(e, 1.06), { p: [0.62, -0.65, 0.15], r: [Math.PI, 0, 0] }),
    part(cone(0.22, 1.0, 5), shade(c, 0.94), { p: [-0.58, -0.5, -0.12], r: [Math.PI, 0, 0] }),
  ]);
}

/** Stalagmite cluster, sparse: 3 upright teeth on a shared base.
 *  (NEW brick — no landed equivalent; the landed set has only the
 *  hanging stalactite.) */
export function buildStalagmiteClusterSparseGeometry(spec: MeshSpec): THREE.BufferGeometry {
  const c = spec.color;
  const e = spec.extraColor ?? c;
  return merge([
    part(blob(0.55), shade(e, 1.0), { p: [0, 0.02, 0], s: [1, 0.35, 1] }),
    part(cone(0.32, 1.1, 6), c, { p: [0, 0.55, 0] }),
    part(cone(0.2, 0.7, 5), shade(c, 1.08), { p: [0.45, 0.35, 0.1] }),
    part(cone(0.15, 0.5, 5), shade(e, 0.92), { p: [-0.4, 0.25, -0.12] }),
  ]);
}

/** Stalagmite cluster, dense: 6 upright teeth, varied heights. */
export function buildStalagmiteClusterDenseGeometry(spec: MeshSpec): THREE.BufferGeometry {
  const c = spec.color;
  const e = spec.extraColor ?? c;
  // [x, z, radius, height] — fixed table.
  const teeth: [number, number, number, number][] = [
    [0, 0, 0.3, 1.4],
    [0.42, 0.12, 0.2, 0.85],
    [-0.4, 0.16, 0.18, 0.7],
    [0.22, -0.3, 0.16, 0.6],
    [-0.24, -0.28, 0.21, 1.0],
    [0.55, -0.2, 0.13, 0.45],
  ];
  const shades = [1.0, 1.08, 0.92];
  return merge([
    part(blob(0.8), shade(e, 1.0), { p: [0, 0.02, 0], s: [1, 0.3, 1] }),
    ...teeth.map(([x, z, r, h], i) =>
      part(cone(r, h, 5), shade(i % 2 === 0 ? c : e, shades[i % 3]), { p: [x, h / 2, z] }),
    ),
  ]);
}

/** Stalagmite pillar: one thick broken-top column on a rock base —
 *  the floor tooth that nearly meets the ceiling. */
export function buildStalagmitePillarGeometry(spec: MeshSpec): THREE.BufferGeometry {
  const c = spec.color;
  const e = spec.extraColor ?? c;
  return merge([
    part(blob(0.75), shade(e, 1.0), { p: [0, 0.05, 0], s: [1, 0.4, 1] }),
    // Tapered cylinder, not a cone: the flat top is the break.
    part(cyl(0.18, 0.48, 2.3, 7), c, { p: [0, 1.2, 0] }),
    part(cone(0.2, 0.8, 5), shade(c, 1.08), { p: [0.62, 0.4, 0.2] }),
  ]);
}

/** Flowstone drape: layered rounded sheets descending a wall
 *  plane, each lower sheet stepping out (+z) and darkening. */
export function buildFlowstoneDrapeGeometry(spec: MeshSpec): THREE.BufferGeometry {
  const c = spec.color;
  const e = spec.extraColor ?? c;
  return merge([
    part(blob(0.55), shade(c, 1.05), { p: [0, -0.3, 0.05], s: [1.2, 0.8, 0.35] }),
    part(blob(0.5), shade(e, 1.0), { p: [0.05, -0.85, 0.12], s: [1.05, 0.75, 0.32] }),
    part(blob(0.44), shade(c, 0.95), { p: [-0.04, -1.35, 0.18], s: [0.9, 0.7, 0.3] }),
    part(blob(0.36), shade(e, 0.9), { p: [0.02, -1.8, 0.24], s: [0.75, 0.6, 0.28] }),
  ]);
}

/** Fungus shelf: 3 bracket shelves stacked up a vertical face,
 *  protruding +z — distinct from twilightFungus' ground spots;
 *  the adopting generator places it against a wall and the
 *  renderer's fungus light logic can key on it the same way. */
export function buildFungusShelfGeometry(spec: MeshSpec): THREE.BufferGeometry {
  const c = spec.color;
  const e = spec.extraColor ?? c;
  // [x, y, radius] shelf attach points, rising up the face.
  const shelves: [number, number, number][] = [
    [-0.15, 0.15, 0.34],
    [0.12, 0.6, 0.27],
    [-0.05, 1.05, 0.38],
  ];
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, y, r] of shelves) {
    // Squashed blobs, not spheres: a faceted bracket cap at a
    // third of the vert cost (spheres would triple this brick).
    parts.push(
      part(cyl(0.035, 0.05, 0.22, 5), e, { p: [x, y - 0.1, 0.08], r: [0.5, 0, 0] }),
      part(blob(r), c, { p: [x, y, 0.28], s: [1, 0.28, 0.75] }),
    );
  }
  return merge(parts);
}

/** Crystal cluster (quartz dressing): 5 tilted elongated prisms
 *  rising from a shared rock base. */
export function buildCrystalClusterGeometry(spec: MeshSpec): THREE.BufferGeometry {
  const c = spec.color;
  const e = spec.extraColor ?? c;
  // [x, z, radius, y-scale, tiltX, tiltZ] — fixed table.
  const prisms: [number, number, number, number, number, number][] = [
    [0, 0, 0.22, 2.6, 0, 0],
    [0.34, 0.1, 0.16, 1.9, 0.1, -0.35],
    [-0.3, 0.14, 0.14, 1.6, 0.15, 0.3],
    [0.14, -0.3, 0.13, 1.4, -0.3, -0.1],
    [-0.18, -0.26, 0.11, 1.15, -0.22, 0.18],
  ];
  return merge([
    part(blob(0.6), shade(e, 1.0), { p: [0, 0.05, 0], s: [1, 0.45, 1] }),
    ...prisms.map(([x, z, r, sy, tx, tz], i) =>
      part(new THREE.OctahedronGeometry(r, 0), shade(c, i === 0 ? 1.0 : 1.15), {
        p: [x, 0.28 + (r * sy) / 2, z],
        r: [tx, 0, tz],
        s: [1, sy, 1],
      }),
    ),
  ]);
}

/** Cave pool, rimmed: the landed pool's flat disc (same 2.2
 *  radius) ringed by a broken circle of rim rocks. */
export function buildCavePoolRimmedGeometry(spec: MeshSpec): THREE.BufferGeometry {
  const c = spec.color;
  const rim = shade(c, 1.7);
  // Rim rocks at fixed angles (a gap at angle index 3 — the
  // broken ring she can step through).
  const rocks: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    if (i === 3) continue;
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.28 : 0.2;
    rocks.push(
      part(blob(r), shade(rim, i % 2 === 0 ? 1.0 : 0.85), {
        p: [Math.cos(a) * 2.15, 0.02, Math.sin(a) * 2.15],
        s: [1, 0.55, 1],
      }),
    );
  }
  return merge([part(flatDisc(2.2, 16), c), ...rocks]);
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
 * World height of a stump's top disc (the stump build:
 * baseY 0.3 + trunk 0.6, with the top disc lifted 0.01
 * against z-fighting). The dressing's candle stands on
 * it; the renderer's candle light anchors off it too.
 */
export const STUMP_TOP_Y = 0.61;

/**
 * Where the altar candle stands on the stump top —
 * off-centre toward the rim (radial ~0.23, inside the
 * 0.42 top disc) so a bone staged at the centre (the
 * renderer's staged-bone spot) never shares its exact
 * spot. DRAFT (pin pass).
 */
export const ALTAR_CANDLE_X = 0.2;
export const ALTAR_CANDLE_Z = 0.12;

/** Radius of the placed-stones ring around the stump base. DRAFT. */
export const ALTAR_STONE_RING_R = 0.85;

/**
 * The DRESSED STUMP (Background, claim approved 2026-10-30
 * behind Systems' stumpy-altar shape): the altar
 * transformation's visuals, keyed off the stump's STEP
 * members — each element appears as its act completes, so
 * a half-made altar looks half-made. Presentation reads
 * the steps; ritual GRADE reads the 'altar' member
 * (stumpState.isAltar) — never the other way round.
 *
 * The group origin is the stump's ground point; the stump
 * itself stays in the instanced scatter (the workbench
 * overlay precedent). Elements, each in a named subgroup:
 *  - 'altar-stones': four river stones ringed at the base
 *    (radius ALTAR_STONE_RING_R, just outside the root
 *    flare; diagonal bearings, so the ring reads placed,
 *    not cardinal), rounded grey, shade-varied.
 *  - 'altar-glyph': a dark glyph on the stump's face —
 *    three charcoal strokes (a stem and two arms) at
 *    mid-trunk on the +Z facet. Heading-less like every
 *    placed overlay (the record carries no rotY; tents
 *    face +Z by the same law).
 *  - 'altar-candle': buildCandle() standing on the top
 *    disc at the offset above — flame included in the
 *    build, lit as the act leaves it; the renderer adds
 *    the candle-profile light beside it.
 * 'workstation' (and any non-step member) draws nothing
 * here — the workbench overlay is the renderer's own.
 */
export function buildStumpDressing(additions: readonly string[]): THREE.Group {
  const g = new THREE.Group();
  if (additions.includes('altar-stones')) {
    const stones = new THREE.Group();
    stones.name = 'altar-stones';
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const stone = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 8, 6),
        meshMat(shade(0x83878a, 0.9 + i * 0.07)),
      );
      stone.scale.set(1.15, 0.68, 0.95);
      stone.position.set(Math.cos(a) * ALTAR_STONE_RING_R, 0.1, Math.sin(a) * ALTAR_STONE_RING_R);
      stone.rotation.y = a;
      stones.add(stone);
    }
    g.add(stones);
  }
  if (additions.includes('altar-glyph')) {
    const glyph = new THREE.Group();
    glyph.name = 'altar-glyph';
    const charcoal = meshMat(0x14100c);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.02), charcoal);
    stem.position.set(0, 0.32, 0.5);
    glyph.add(stem);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.02), charcoal);
      arm.position.set(s * 0.055, 0.4, 0.495);
      arm.rotation.z = s * 0.6;
      glyph.add(arm);
    }
    g.add(glyph);
  }
  if (additions.includes('altar-candle')) {
    const holder = new THREE.Group();
    holder.name = 'altar-candle';
    const candle = buildCandle();
    candle.position.set(ALTAR_CANDLE_X, STUMP_TOP_Y, ALTAR_CANDLE_Z);
    holder.add(candle);
    g.add(holder);
  }
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
 * A placed writing desk (Adam 2026-10-30 — the grimoire's
 * site, placeable + visible only, no desk actions).
 * Primitives, all wood, so it reads as a desk where the
 * altar reads as a stone table: a wooden top, four legs,
 * an apron rail under the top's front edge, and a shallow
 * drawer front with a knob. NO candle: a candle on the
 * desk is Adam's parked design aside — none exists and
 * none is drawn. Sizes are lane-decided drafts for his
 * sighting (top 1.2 x 0.65 m, surface at 0.78 m).
 */
export function buildDeskGroup(): THREE.Group {
  const g = new THREE.Group();
  // Four legs at the top's corners, inset.
  const legGeo = new THREE.BoxGeometry(0.07, 0.72, 0.07);
  const legMat = meshMat(0x6b4a2f);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(sx * 0.52, 0.36, sz * 0.26);
      g.add(leg);
    }
  }
  // Apron rail under the top, front edge: the frame band
  // a desk shows between its legs and its top.
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.14, 0.04), meshMat(0x6b4a2f));
  rail.position.set(0, 0.65, 0.28);
  g.add(rail);
  // Drawer front, centred on the rail, a shade darker —
  // the writing-desk read — with a small knob.
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.13, 0.02), meshMat(0x5a4028));
  drawer.position.set(0, 0.65, 0.305);
  g.add(drawer);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.03), meshMat(0x3a2818));
  knob.position.set(0, 0.65, 0.325);
  g.add(knob);
  // Wooden top: 1.2 x 0.06 x 0.65, top surface at 0.78.
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.65), meshMat(0x7a5a38));
  top.position.set(0, 0.75, 0);
  g.add(top);
  return g;
}

/**
 * A placed cauldron (Adam 2026-10-30 — the clay pot that
 * goes ON a hearth; cauldronState binds it to its
 * hearth, the renderer sits it over the fire). CLAY
 * throughout (Adam's no-iron ruling — the cauldron item
 * is clay x8, kiln-fired): a lathe-profile pot (foot,
 * belly, shoulder, neck, rim — the altar-bowl
 * technique), dark-fired clay, with a rim ring and two
 * lug handles. No iron, no legs — it sits IN the
 * hearth, on the base slab. Sizes are lane-decided
 * drafts for his sighting (belly 0.6 m wide, 0.5 m
 * tall).
 */
export function buildCauldronGroup(): THREE.Group {
  const g = new THREE.Group();
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.02, 0),
    new THREE.Vector2(0.2, 0.01),
    new THREE.Vector2(0.28, 0.1),
    new THREE.Vector2(0.3, 0.22),
    new THREE.Vector2(0.24, 0.36),
    new THREE.Vector2(0.2, 0.42),
    new THREE.Vector2(0.23, 0.48),
    new THREE.Vector2(0.23, 0.5),
  ];
  const potMat = new THREE.MeshLambertMaterial({ color: 0x6e4a38, side: THREE.DoubleSide });
  const pot = new THREE.Mesh(new THREE.LatheGeometry(profile, 18), potMat);
  g.add(pot);
  // Rim ring, a shade darker — the pot's mouth reads
  // even before the hollow does.
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.04, 18), meshMat(0x54382a));
  rim.position.set(0, 0.48, 0);
  g.add(rim);
  // Two lug handles at the shoulders.
  const lugGeo = new THREE.BoxGeometry(0.05, 0.1, 0.04);
  const lugMat = meshMat(0x54382a);
  for (const sx of [-1, 1]) {
    const lug = new THREE.Mesh(lugGeo, lugMat);
    lug.position.set(sx * 0.27, 0.34, 0);
    g.add(lug);
  }
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
