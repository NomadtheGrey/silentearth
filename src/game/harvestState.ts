/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * WORLD HARVEST STATE (shrink + regrow model, Adam 2026-10-26).
 *
 * This module is deliberately dependency-free (it imports only the
 * WorldGen TYPE): the tracker, the outcome listener, and the
 * renderer all read it, and none of them may import each other for
 * it, so it cannot participate in an import cycle.
 *
 * PINNED MODEL (Adam, 2026-10-26 — supersedes the earlier
 * vanish-on-harvest depletion model):
 * - Harvested plants/bushes/etc. SHRINK (rendered at SHRINK_SCALE)
 *   and REGROW after REGROW_MS, for more harvesting. While
 *   regrowing they are not harvest targets.
 * - Ground (dirt/mud/grass) NEVER depletes, shrinks, or regrows —
 *   it is everywhere, always scoopable.
 * - LOGS are the exception: a harvested log is TAKEN (gone from
 *   that spot, permanently — it goes in the removed set, not the
 *   shrunk set) and fresh logs SPAWN NEAR TREES over time
 *   (LOG_SPAWN_MS after the harvest, lane-decided starting value).
 * - REMOVE (Adam, 2026-10-26): a plant totally removed by the
 *   remove action is gone permanently — the removed set, never
 *   regrown. See harvest.ts for the remove action itself.
 *
 * TIMING CONSTANTS (lane-decided starting values, NOT pinned —
 * flagged for Adam's tuning pass):
 * - REGROW_MS = 120_000 (2 minutes): a shrunk plant regrows.
 * - LOG_SPAWN_MS = 180_000 (3 minutes): a fresh log spawns near
 *   trees after a log is taken.
 * - SHRINK_SCALE = 0.35: a shrunk plant renders at about a third
 *   of its size. Purely visual; yields are unaffected.
 * - REMOVE_YIELD_MULTIPLIER = 3: a removed plant pays 3x its
 *   primary base (see harvest.ts).
 *
 * TIME: wall-clock milliseconds (Date.now()). Callers that need
 * deterministic tests pass `now` explicitly; the live game passes
 * nothing and gets Date.now(). Harvest luck and spawn timing are
 * gameplay state, not worldgen — the world-seed reproducibility
 * rule covers generated chunk contents, which this state never
 * rewrites (it only filters or scales at render/target time).
 */

import { CHUNK_SIZE } from '../constants';
import { hashSeed } from './seed';
import type { WorldGen } from './worldgen';
import type { ScatterObject } from '../types';

/** Lane-decided starting values — see the header. Not pinned. */
export const REGROW_MS = 120_000;
export const LOG_SPAWN_MS = 180_000;
export const SHRINK_SCALE = 0.35;
export const REMOVE_YIELD_MULTIPLIER = 3;
/** A felled tree's sapling grows into a full tree over this long. */
export const SAPLING_GROWTH_MS = 300_000;
/** Intentionally cleared ground suppresses saplings within this far. */
export const CLEARED_SPOT_RADIUS = 3.0;

/**
 * Stable scatter target id, shared by the tracker, the outcome
 * listener, and the renderer: the same id must be computed from a
 * generated object and from a button press, or state could never
 * match its target. Format:
 * 'scatter:<cx>,<cz>:<kind>:<x.toFixed(2)>,<z.toFixed(2)>'.
 */
export function scatterTargetId(
  cx: number,
  cz: number,
  obj: { kind: string; x: number; z: number },
): string {
  return `scatter:${cx},${cz}:${obj.kind}:${obj.x.toFixed(2)},${obj.z.toFixed(2)}`;
}

/** A log spawned near trees after a log harvest (not a worldgen object). */
export interface SpawnedLog {
  /** 'spawned-log:<x.toFixed(2)>,<z.toFixed(2)>' — never collides
   *  with a scatter id, so spawned logs and worldgen logs are
   *  distinct targets even at the same spot. */
  id: string;
  x: number;
  z: number;
  cx: number;
  cz: number;
}

interface ShrunkEntry {
  harvestedAt: number;
  cx: number;
  cz: number;
}

interface PendingLogSpawn {
  dueAt: number;
  nearX: number;
  nearZ: number;
  seed: number;
}

/** A felled tree: its stump stands at the felling spot, permanently. */
interface FelledEntry {
  x: number;
  z: number;
  cx: number;
  cz: number;
}

/** A sapling planted near a felled tree, growing into a full tree. */
export interface Sapling {
  /** 'spawned-tree:<x.toFixed(2)>,<z.toFixed(2)>' — never collides
   *  with a scatter id, like spawned logs. */
  id: string;
  x: number;
  z: number;
  cx: number;
  cz: number;
  plantedAt: number;
}

interface ClearedSpot {
  x: number;
  z: number;
}

/**
 * Serializable harvest-state snapshot (save seam, Adam 2026-10-27).
 * Covers depletion/regrow (shrunk + removed), cleared-ground marks,
 * sapling/log renewal (saplings + spawnedLogs + pendingSpawns +
 * felled + counters), and multi-step progress. All times are
 * wall-clock instants (Date.now()): harvestedAt + REGROW_MS,
 * pending dueAt, sapling plantedAt + SAPLING_GROWTH_MS. A save
 * loaded after a long absence therefore finds elapsed regrows,
 * spawns, and growths complete — refresh itself (seconds later)
 * is unaffected, which is the brief's case. If Adam wants
 * away-time frozen, that is a second rule (shift-on-load), not
 * built here. Counters preserve the deterministic spawn/plant
 * sequences exactly (same history = same picks).
 */
export interface HarvestStateSnapshot {
  shrunk: Array<{ id: string; harvestedAt: number; cx: number; cz: number }>;
  removed: string[];
  progress: Array<{ id: string; progress: number }>;
  spawnedLogs: SpawnedLog[];
  pendingSpawns: Array<{ dueAt: number; nearX: number; nearZ: number; seed: number }>;
  spawnCounter: number;
  felled: Array<{ id: string; x: number; z: number; cx: number; cz: number }>;
  saplings: Sapling[];
  saplingCounter: number;
  clearedSpots: Array<{ x: number; z: number }>;
}

/** World harvest state: shrink/regrow + removed + spawned logs +
 *  felled trees (stumps) + saplings + cleared spots. */
export class HarvestState {
  private shrunk = new Map<string, ShrunkEntry>();
  private removed = new Set<string>();
  private progress = new Map<string, number>();
  private spawnedLogs = new Map<string, SpawnedLog>();
  private pendingSpawns: PendingLogSpawn[] = [];
  private spawnCounter = 0;
  private felled = new Map<string, FelledEntry>();
  private saplings = new Map<string, Sapling>();
  private saplingCounter = 0;
  private clearedSpots: ClearedSpot[] = [];
  private _version = 0;

  /** Bumped on every state change the renderer must redraw for
   *  (shrink, remove, spawn, regrow prune). The renderer polls it
   *  on its world tick rather than subscribing per change. */
  get version(): number {
    return this._version;
  }

  // --- Shrink / regrow ---

  /** Mark a target harvested: it shrinks now, regrows at +REGROW_MS. */
  shrink(targetId: string, cx: number, cz: number, now: number): void {
    this.shrunk.set(targetId, { harvestedAt: now, cx, cz });
    this.progress.delete(targetId);
    this._version++;
  }

  /** Still regrowing (shrunk and regrow time not yet reached)? */
  isRegrowing(targetId: string, now: number): boolean {
    const entry = this.shrunk.get(targetId);
    return entry !== undefined && now < entry.harvestedAt + REGROW_MS;
  }

  /** Milliseconds until regrow (0 when fully grown / never shrunk). */
  regrowRemainingMs(targetId: string, now: number): number {
    const entry = this.shrunk.get(targetId);
    if (!entry) return 0;
    return Math.max(0, entry.harvestedAt + REGROW_MS - now);
  }

  /**
   * Drop expired shrunk entries and return their chunk keys, so the
   * renderer can rebuild just those chunks (full-size meshes). Call
   * on the renderer's world tick; entries are only pruned here, so
   * a regrown plant stays full-size even if no tick runs.
   */
  pruneExpiredRegrows(now: number): string[] {
    const chunks: string[] = [];
    for (const [id, entry] of this.shrunk) {
      if (now >= entry.harvestedAt + REGROW_MS) {
        this.shrunk.delete(id);
        const key = `${entry.cx},${entry.cz}`;
        if (!chunks.includes(key)) chunks.push(key);
      }
    }
    if (chunks.length > 0) this._version++;
    return chunks;
  }

  // --- Removed (permanent) ---

  /** Mark a target gone permanently (remove action, or a taken log). */
  remove(targetId: string): void {
    this.removed.add(targetId);
    this.shrunk.delete(targetId);
    this.progress.delete(targetId);
    this._version++;
  }

  isRemoved(targetId: string): boolean {
    return this.removed.has(targetId);
  }

  // --- Multi-step progress (prototype TUG/STOMP) ---

  progressFor(targetId: string): number {
    return this.progress.get(targetId) ?? 0;
  }

  setProgress(targetId: string, progress: number): void {
    this.progress.set(targetId, progress);
  }

  clearProgress(targetId: string): void {
    this.progress.delete(targetId);
  }

  // --- Spawned logs ---

  /** Schedule a fresh log near (nearX, nearZ) after LOG_SPAWN_MS. */
  scheduleLogSpawn(nearX: number, nearZ: number, seed: string, now: number): void {
    this.pendingSpawns.push({
      dueAt: now + LOG_SPAWN_MS,
      nearX,
      nearZ,
      seed: hashSeed(seed),
    });
  }

  spawnedLog(id: string): SpawnedLog | undefined {
    return this.spawnedLogs.get(id);
  }

  /** All spawned logs, for the renderer. */
  spawnedLogsSnapshot(): SpawnedLog[] {
    return [...this.spawnedLogs.values()];
  }

  /** Spawned logs within range of (x, z), for the tracker. */
  spawnedLogsInRange(x: number, z: number, range: number): SpawnedLog[] {
    const out: SpawnedLog[] = [];
    for (const log of this.spawnedLogs.values()) {
      if (Math.hypot(log.x - x, log.z - z) <= range) out.push(log);
    }
    return out;
  }

  /** Take a spawned log (harvested): it leaves the spawned set and
   *  schedules its own replacement near trees, like a worldgen log. */
  takeSpawnedLog(id: string, now: number, seed: string): void {
    const log = this.spawnedLogs.get(id);
    if (!log) return;
    this.spawnedLogs.delete(id);
    this.scheduleLogSpawn(log.x, log.z, seed, now);
    this._version++;
  }

  /**
   * Create due spawned logs. Trees are found by scanning worldgen
   * chunks around the harvest spot (up to 5 chunks out) for
   * standing trees ('tree' kind — the harvestable trees, not the
   * 'tallTree' scenery). The tree and the offset are derived from
   * (seed, spot, spawnCounter) via a small hash, so a spawn is
   * deterministic given the same harvest history — no Math.random
   * in spawn placement. If no tree is found in range (trees are
   * common, so this is an edge case), the spawn is dropped, not
   * placed somewhere treeless. Returns the logs created.
   */
  processDueSpawns(now: number, gen: WorldGen): SpawnedLog[] {
    const due = this.pendingSpawns.filter((s) => now >= s.dueAt);
    if (due.length === 0) return [];
    this.pendingSpawns = this.pendingSpawns.filter((s) => now < s.dueAt);
    const created: SpawnedLog[] = [];
    for (const spawn of due) {
      const log = this.spawnLogNearTree(spawn, gen);
      if (log) {
        this.spawnedLogs.set(log.id, log);
        created.push(log);
      }
    }
    if (created.length > 0) this._version++;
    return created;
  }

  private spawnLogNearTree(spawn: PendingLogSpawn, gen: WorldGen): SpawnedLog | null {
    const trees: { x: number; z: number }[] = [];
    const chunkOf = (v: number): number => Math.floor(v / CHUNK_SIZE);
    const baseCx = chunkOf(spawn.nearX);
    const baseCz = chunkOf(spawn.nearZ);
    for (let radius = 0; radius <= 5 && trees.length === 0; radius++) {
      for (let cz = baseCz - radius; cz <= baseCz + radius; cz++) {
        for (let cx = baseCx - radius; cx <= baseCx + radius; cx++) {
          for (const obj of gen.generateChunk(cx, cz).objects) {
            if (obj.kind === 'tree') trees.push({ x: obj.x, z: obj.z });
          }
        }
      }
    }
    if (trees.length === 0) return null;
    // Deterministic pick + offset from (seed, spot, counter).
    const hash = hashParts(spawn.seed, spawn.nearX, spawn.nearZ, this.spawnCounter++);
    const tree = trees[hash % trees.length];
    const angle = ((hash >> 8) % 360) * (Math.PI / 180);
    const dist = 1.5 + ((hash >> 16) % 150) / 100;
    const x = tree.x + Math.cos(angle) * dist;
    const z = tree.z + Math.sin(angle) * dist;
    return {
      id: `spawned-log:${x.toFixed(2)},${z.toFixed(2)}`,
      x,
      z,
      cx: chunkOf(x),
      cz: chunkOf(z),
    };
  }

  // --- Felled trees, saplings, cleared ground (Adam, 2026-10-26) ---

  /**
   * Fell a tree: its stump stands at (x, z) permanently (a
   * workstation anchor like any other stump — same reading as
   * Adam's parenthetical), and a sapling is planted in a nearby
   * clear spot. Returns the sapling, or null when no clear spot
   * was found. The felled entry is keyed by the harvested target
   * id (worldgen tree id, or sapling id for a felled sapling-tree),
   * so a stale button for the felled tree reads as felled.
   */
  fellTree(
    targetId: string,
    x: number,
    z: number,
    cx: number,
    cz: number,
    gen: WorldGen,
    now: number,
  ): Sapling | null {
    this.felled.set(targetId, { x, z, cx, cz });
    this.progress.delete(targetId);
    this._version++;
    return this.plantSaplingNear(x, z, gen, now);
  }

  isFelled(targetId: string): boolean {
    return this.felled.has(targetId);
  }

  /** Felled stumps in a chunk, as stump scatter objects. */
  felledStumpsInChunk(cx: number, cz: number): ScatterObject[] {
    const out: ScatterObject[] = [];
    for (const entry of this.felled.values()) {
      if (entry.cx === cx && entry.cz === cz) {
        out.push({ kind: 'stump', x: entry.x, z: entry.z, y: 0, scale: 1, rotY: 0 });
      }
    }
    return out;
  }

  /** Any felled stump within range of (x, z)? (station presence.) */
  felledStumpsInRange(x: number, z: number, range: number): boolean {
    for (const entry of this.felled.values()) {
      if (Math.hypot(entry.x - x, entry.z - z) <= range) return true;
    }
    return false;
  }

  spawnedTree(id: string): Sapling | undefined {
    return this.saplings.get(id);
  }

  /** All saplings (immature + mature), for the renderer. */
  spawnedTreesSnapshot(): Sapling[] {
    return [...this.saplings.values()];
  }

  /** Mature saplings (grown into full trees) within range, for the tracker. */
  matureSaplingsInRange(x: number, z: number, range: number, now: number): Sapling[] {
    const out: Sapling[] = [];
    for (const sapling of this.saplings.values()) {
      if (now < sapling.plantedAt + SAPLING_GROWTH_MS) continue;
      if (Math.hypot(sapling.x - x, sapling.z - z) <= range) out.push(sapling);
    }
    return out;
  }

  /** Growth fraction of a sapling, 0 (just planted) to 1 (full tree). */
  saplingGrowth(sapling: Sapling, now: number): number {
    return Math.min(1, Math.max(0, (now - sapling.plantedAt) / SAPLING_GROWTH_MS));
  }

  /** Remove a sapling-tree from the saplings map (felled or removed). */
  removeSpawnedTree(id: string): void {
    if (this.saplings.delete(id)) this._version++;
  }

  /**
   * Plant a sapling in a nearby clear spot: 3–9 m from (x, z) on
   * golden-angle candidates, deterministic from (seed, spot,
   * counter). A spot is clear when no worldgen object, felled
   * stump, sapling, or spawned log sits within 1.5 m of it, and no
   * intentionally cleared spot sits within CLEARED_SPOT_RADIUS.
   * The felled stump itself is added before planting, so the
   * sapling never lands on it. Returns null when all 16
   * candidates are blocked (dense ground, or cleared ground).
   */
  plantSaplingNear(x: number, z: number, gen: WorldGen, now: number): Sapling | null {
    const hash = hashSeed(`${gen.seed}|sapling:${x.toFixed(2)},${z.toFixed(2)}:${this.saplingCounter++}`);
    for (let i = 0; i < 16; i++) {
      const angle = (((hash + i * 137.5) % 360) * Math.PI) / 180;
      const dist = 3 + (i % 6) * 1.2;
      const sx = x + Math.cos(angle) * dist;
      const sz = z + Math.sin(angle) * dist;
      if (!this.isClearForSapling(sx, sz, gen)) continue;
      const sapling: Sapling = {
        id: `spawned-tree:${sx.toFixed(2)},${sz.toFixed(2)}`,
        x: sx,
        z: sz,
        cx: Math.floor(sx / CHUNK_SIZE),
        cz: Math.floor(sz / CHUNK_SIZE),
        plantedAt: now,
      };
      this.saplings.set(sapling.id, sapling);
      this._version++;
      return sapling;
    }
    return null;
  }

  private isClearForSapling(sx: number, sz: number, gen: WorldGen): boolean {
    for (const spot of this.clearedSpots) {
      // Epsilon: the first candidate ring sits at exactly 3.0 m,
      // and float error in cos/sin can read as 3.0000000000000004
      // — just past the radius. Suppression is inclusive of the
      // boundary, so the epsilon keeps the boundary blocked.
      if (Math.hypot(spot.x - sx, spot.z - sz) <= CLEARED_SPOT_RADIUS + 1e-9) {
        return false;
      }
    }
    for (const entry of this.felled.values()) {
      if (Math.hypot(entry.x - sx, entry.z - sz) <= 1.5) return false;
    }
    for (const sapling of this.saplings.values()) {
      if (Math.hypot(sapling.x - sx, sapling.z - sz) <= 1.5) return false;
    }
    for (const log of this.spawnedLogs.values()) {
      if (Math.hypot(log.x - sx, log.z - sz) <= 1.5) return false;
    }
    const minCx = Math.floor((sx - 1.5) / CHUNK_SIZE);
    const maxCx = Math.floor((sx + 1.5) / CHUNK_SIZE);
    const minCz = Math.floor((sz - 1.5) / CHUNK_SIZE);
    const maxCz = Math.floor((sz + 1.5) / CHUNK_SIZE);
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        for (const obj of gen.generateChunk(cx, cz).objects) {
          if (Math.hypot(obj.x - sx, obj.z - sz) <= 1.5) return false;
        }
      }
    }
    return true;
  }

  /**
   * Mark ground intentionally cleared (a successful remove action):
   * no saplings return within CLEARED_SPOT_RADIUS of (x, z).
   * Cleared ground stays cleared — this is the house-plot case.
   * (Removed plants themselves never regrow, as already pinned.)
   */
  markCleared(x: number, z: number): void {
    this.clearedSpots.push({ x, z });
  }

  /** Save seam: serializable COPY of all harvest state (never live refs). */
  snapshot(): HarvestStateSnapshot {
    return {
      shrunk: [...this.shrunk.entries()].map(([id, e]) => ({
        id,
        harvestedAt: e.harvestedAt,
        cx: e.cx,
        cz: e.cz,
      })),
      removed: [...this.removed],
      progress: [...this.progress.entries()].map(([id, progress]) => ({ id, progress })),
      spawnedLogs: [...this.spawnedLogs.values()].map((l) => ({ ...l })),
      pendingSpawns: this.pendingSpawns.map((s) => ({ ...s })),
      spawnCounter: this.spawnCounter,
      felled: [...this.felled.entries()].map(([id, e]) => ({
        id,
        x: e.x,
        z: e.z,
        cx: e.cx,
        cz: e.cz,
      })),
      saplings: [...this.saplings.values()].map((s) => ({ ...s })),
      saplingCounter: this.saplingCounter,
      clearedSpots: this.clearedSpots.map((s) => ({ ...s })),
    };
  }

  /**
   * Silent bulk restore (save boot path): REPLACES state, drops
   * invalid entries, bumps version via clear() so the renderer
   * redraws. A null/non-object snapshot is ignored entirely (state
   * untouched — a corrupt save must not wipe a live world); a
   * partial snapshot clears the missing sections (replace, not
   * merge — merging would double-count). Progress restores at
   * 0..1 (a 1.0 progress would already have granted and cleared).
   * Cleared spots restore verbatim (markCleared already exists —
   * this seam only persists the marks, it does not invent them).
   */
  restore(snap: HarvestStateSnapshot): void {
    if (!snap || typeof snap !== 'object') return;
    this.clear();
    if (Array.isArray(snap.shrunk)) {
      for (const e of snap.shrunk) {
        if (
          !e ||
          typeof e.id !== 'string' ||
          e.id === '' ||
          !Number.isFinite(e.harvestedAt) ||
          !Number.isInteger(e.cx) ||
          !Number.isInteger(e.cz)
        ) {
          continue;
        }
        this.shrunk.set(e.id, { harvestedAt: e.harvestedAt, cx: e.cx, cz: e.cz });
      }
    }
    if (Array.isArray(snap.removed)) {
      for (const id of snap.removed) {
        if (typeof id === 'string' && id !== '') this.removed.add(id);
      }
    }
    if (Array.isArray(snap.progress)) {
      for (const e of snap.progress) {
        if (
          !e ||
          typeof e.id !== 'string' ||
          e.id === '' ||
          !Number.isFinite(e.progress) ||
          e.progress < 0 ||
          e.progress > 1
        ) {
          continue;
        }
        this.progress.set(e.id, e.progress);
      }
    }
    if (Array.isArray(snap.spawnedLogs)) {
      for (const l of snap.spawnedLogs) {
        if (
          !l ||
          typeof l.id !== 'string' ||
          l.id === '' ||
          !Number.isFinite(l.x) ||
          !Number.isFinite(l.z) ||
          !Number.isInteger(l.cx) ||
          !Number.isInteger(l.cz)
        ) {
          continue;
        }
        this.spawnedLogs.set(l.id, { id: l.id, x: l.x, z: l.z, cx: l.cx, cz: l.cz });
      }
    }
    if (Array.isArray(snap.pendingSpawns)) {
      for (const s of snap.pendingSpawns) {
        if (
          !s ||
          !Number.isFinite(s.dueAt) ||
          !Number.isFinite(s.nearX) ||
          !Number.isFinite(s.nearZ) ||
          !Number.isFinite(s.seed)
        ) {
          continue;
        }
        this.pendingSpawns.push({ dueAt: s.dueAt, nearX: s.nearX, nearZ: s.nearZ, seed: s.seed });
      }
    }
    this.spawnCounter =
      Number.isInteger(snap.spawnCounter) && snap.spawnCounter >= 0 ? snap.spawnCounter : 0;
    if (Array.isArray(snap.felled)) {
      for (const e of snap.felled) {
        if (
          !e ||
          typeof e.id !== 'string' ||
          e.id === '' ||
          !Number.isFinite(e.x) ||
          !Number.isFinite(e.z) ||
          !Number.isInteger(e.cx) ||
          !Number.isInteger(e.cz)
        ) {
          continue;
        }
        this.felled.set(e.id, { x: e.x, z: e.z, cx: e.cx, cz: e.cz });
      }
    }
    if (Array.isArray(snap.saplings)) {
      for (const s of snap.saplings) {
        if (
          !s ||
          typeof s.id !== 'string' ||
          s.id === '' ||
          !Number.isFinite(s.x) ||
          !Number.isFinite(s.z) ||
          !Number.isInteger(s.cx) ||
          !Number.isInteger(s.cz) ||
          !Number.isFinite(s.plantedAt)
        ) {
          continue;
        }
        this.saplings.set(s.id, {
          id: s.id,
          x: s.x,
          z: s.z,
          cx: s.cx,
          cz: s.cz,
          plantedAt: s.plantedAt,
        });
      }
    }
    this.saplingCounter =
      Number.isInteger(snap.saplingCounter) && snap.saplingCounter >= 0
        ? snap.saplingCounter
        : 0;
    if (Array.isArray(snap.clearedSpots)) {
      for (const s of snap.clearedSpots) {
        if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.z)) continue;
        this.clearedSpots.push({ x: s.x, z: s.z });
      }
    }
  }

  /** Seed change / world reset: shrink, removed, progress, spawned
   *  logs, pending spawns, felled stumps, saplings, and cleared
   *  spots all go. */
  clear(): void {
    this.shrunk.clear();
    this.removed.clear();
    this.progress.clear();
    this.spawnedLogs.clear();
    this.pendingSpawns = [];
    this.spawnCounter = 0;
    this.felled.clear();
    this.saplings.clear();
    this.saplingCounter = 0;
    this.clearedSpots = [];
    this._version++;
  }
}

/** Shared singleton. Import this; do not construct a second state. */
export const harvestState = new HarvestState();

/**
 * A WorldGen view that applies harvest state to generated chunks:
 * permanently-removed objects are filtered out, felled trees are
 * filtered out (their stump stands instead — appended below), and
 * felled stumps are appended as stump objects. Shrunk objects are
 * NOT filtered (they still render, at SHRINK_SCALE) and regrowing
 * objects are NOT filtered here either — the tracker excludes
 * regrowing targets, and the renderer scales them. All other
 * methods delegate untouched.
 */
export function wrapGenWithState(
  base: WorldGen,
  state: HarvestState = harvestState,
): WorldGen {
  return {
    ...base,
    generateChunk: (cx: number, cz: number) => {
      const chunk = base.generateChunk(cx, cz);
      const objects = chunk.objects.filter((obj) => {
        const id = scatterTargetId(cx, cz, obj);
        return !state.isRemoved(id) && !state.isFelled(id);
      });
      objects.push(...state.felledStumpsInChunk(cx, cz));
      return { ...chunk, objects };
    },
  };
}

/** Small deterministic hash of seed + coords + counter (FNV-1a style). */
function hashParts(seed: number, x: number, z: number, counter: number): number {
  let h = 2166136261 ^ seed;
  for (const part of [Math.round(x * 100), Math.round(z * 100), counter]) {
    h ^= part;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
