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

/** Lane-decided starting values — see the header. Not pinned. */
export const REGROW_MS = 120_000;
export const LOG_SPAWN_MS = 180_000;
export const SHRINK_SCALE = 0.35;
export const REMOVE_YIELD_MULTIPLIER = 3;

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

/** World harvest state: shrink/regrow + removed + spawned logs. */
export class HarvestState {
  private shrunk = new Map<string, ShrunkEntry>();
  private removed = new Set<string>();
  private progress = new Map<string, number>();
  private spawnedLogs = new Map<string, SpawnedLog>();
  private pendingSpawns: PendingLogSpawn[] = [];
  private spawnCounter = 0;
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

  /** Seed change / world reset: shrink, removed, progress, spawned
   *  logs, and pending spawns all go. */
  clear(): void {
    this.shrunk.clear();
    this.removed.clear();
    this.progress.clear();
    this.spawnedLogs.clear();
    this.pendingSpawns = [];
    this.spawnCounter = 0;
    this._version++;
  }
}

/** Shared singleton. Import this; do not construct a second state. */
export const harvestState = new HarvestState();

/**
 * A WorldGen view that filters permanently-removed objects out of
 * generated chunks. Shrunk objects are NOT filtered (they still
 * render, at SHRINK_SCALE) and regrowing objects are NOT filtered
 * here either — the tracker excludes regrowing targets, and the
 * renderer scales them. All other methods delegate untouched.
 */
export function wrapGenWithRemoved(
  base: WorldGen,
  state: HarvestState = harvestState,
): WorldGen {
  return {
    ...base,
    generateChunk: (cx: number, cz: number) => {
      const chunk = base.generateChunk(cx, cz);
      return {
        ...chunk,
        objects: chunk.objects.filter(
          (obj) => !state.isRemoved(scatterTargetId(cx, cz, obj)),
        ),
      };
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
