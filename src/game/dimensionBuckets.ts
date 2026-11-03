/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DIMENSION BUCKETS — THE STORE SWAP (Background, 2026-11-03;
 * Systems' 2026-10-31 design, their save seat bad814c). The
 * piles store and the harvest store are SINGLETONS: before
 * this module they were the surface's stores no matter where
 * she stood, so a take in a cave wrote the surface's book and
 * a pile dropped in a cave sat in the surface's list at
 * cave-frame coordinates — visible nowhere, reachable from
 * nowhere (the crawl-back fall pile was the live stranding).
 *
 * The swap: this module parks the live stores under the key
 * of the dimension they belong to and loads the entered
 * dimension's parked stores, as one step of the travel swap
 * (dimensionTravel calls swapActiveStores between the
 * generator swap and the position write). The SURFACE is a
 * park slot like any other ('surface', dimensionState's own
 * key) but is NEVER serialized as a bucket: Systems' save
 * keeps the surface in the document's top-level piles +
 * harvestState byte-for-byte, and "no bucket" IS the
 * surface. Bucket contents stay in the dimension's own
 * coordinates (cave-local, attic-local) — the stores never
 * translate; the active dimension's frame is the frame.
 *
 * SHELL SEATS (UI wires these; the module is game-layer and
 * speaks game shapes — the shell converts to Systems' saved
 * shapes exactly as it already does for the top level):
 * - saveNow: draft.dimensionStates <= snapshotBuckets(),
 *   each value mapped { piles: .map(stacks/x/z), harvest }
 *   with the same expressions as the top-level fields.
 * - boot restore (beside the surface restores, BEFORE any
 *   travel): restoreBuckets(bootSaved.dimensionStates
 *   converted back — piles ride pileState.restore's input
 *   shape as-is; a saved harvest carries the five saved
 *   sections, the rest default empty, the same tolerance
 *   the surface boot restore relies on), then the two
 *   relocation passes below, in this order: cave takes,
 *   then piles.
 * - new world / regenerate: clearBuckets() beside the
 *   existing store clears.
 *
 * THE RELOCATION PASSES are the migration for saves written
 * before buckets existed (and for any stray the old single
 * store stranded): they run ONCE at boot, on the surface
 * stores, before the stores first activate. Cave take ids
 * do NOT embed their cave (a take id is chunk + kind +
 * position in the cave frame), so the takes pass rebuilds
 * each cave's id set from its own derivation — layer-1
 * fungus features map one-to-one to take ids — and moves
 * SHRUNK + REMOVED entries (the pair DEV priced; progress
 * is a display residue and stays wherever it sits). The
 * piles pass moves a surface-store pile whose point falls
 * inside a cave layout's footprint bounds into that cave's
 * bucket (first containing footprint wins — cave:main
 * first, then instances in enumeration order; cave frames
 * are distinct enough in practice, and a point inside two
 * footprints is genuinely ambiguous in the old record).
 * Attic-frame piles are positionally UNDECIDABLE (every
 * attic shares one origin) and stay in the surface store —
 * the named, accepted cost; no lost-and-found bucket.
 */

import { bus } from './events';
import { CHUNK_SIZE } from '../constants';
import type { BiomeWeights } from '../types';
import { pileState, type Pile } from './pileState';
import {
  harvestState,
  scatterTargetId,
  type HarvestStateSnapshot,
} from './harvestState';
import { SURFACE_DIMENSION_KEY } from './dimensionState';
import {
  caveInstancesInRect,
  caveLayoutForKey,
  CAVE_DIMENSION_KEY,
} from './caves';

/** One dimension's parked stores, in game shapes. */
export interface DimensionBucketStores {
  piles: Pile[];
  harvest: HarvestStateSnapshot;
}

/** The saved-bucket input shape the shell hands back at
 *  boot: piles in pileState.restore's input shape, harvest
 *  carrying the saved sections (the rest default empty). */
export interface DimensionBucketInput {
  piles: ReadonlyArray<Pile>;
  harvest: Partial<HarvestStateSnapshot>;
}

/** A whole empty harvest snapshot (every section empty). */
export function emptyHarvestSnapshot(): HarvestStateSnapshot {
  return {
    shrunk: [],
    removed: [],
    progress: [],
    spawnedLogs: [],
    pendingSpawns: [],
    spawnCounter: 0,
    felled: [],
    saplings: [],
    saplingCounter: 0,
    clearedSpots: [],
  };
}

function emptyStores(): DimensionBucketStores {
  return { piles: [], harvest: emptyHarvestSnapshot() };
}

/** How far around spawn the relocation passes enumerate
 *  distributed caves. A legacy take or pile can only exist
 *  where she has actually been; ±3200 m is the standing
 *  census reach and covers any plausible pre-bucket play. */
const RELOCATION_REACH_M = 3200;

class DimensionBuckets {
  /** Parked stores by dimension key, INCLUDING the surface
   *  slot while she is inside a dimension. */
  private parked = new Map<string, DimensionBucketStores>();
  /** The key the LIVE stores currently belong to. */
  private activeKey: string = SURFACE_DIMENSION_KEY;

  /** The dimension key the live stores belong to. */
  activeStoresKey(): string {
    return this.activeKey;
  }

  /**
   * The travel step: park the live stores under their own
   * key, load the target dimension's parked stores (empty
   * on a first entry). Called by dimensionTravel inside the
   * swap, after validation, beside the generator swap. A
   * same-key call is a no-op (descend/ascend never call it —
   * layers are one dimension). Emits 'dimension:stores-
   * swapped' so the renderer rebuilds the pile group even
   * when the incoming bucket is empty (a non-empty restore
   * also rebuilds per pile via pileState's own events).
   */
  swapActiveStores(toKey: string): void {
    if (toKey === this.activeKey) return;
    this.parked.set(this.activeKey, {
      piles: pileState.snapshot(),
      harvest: harvestState.snapshot(),
    });
    const next = this.parked.get(toKey) ?? emptyStores();
    pileState.clear();
    pileState.restore(next.piles);
    harvestState.restore(next.harvest);
    this.activeKey = toKey;
    bus.emit('dimension:stores-swapped', { key: toKey });
  }

  /**
   * Every bucket the save should carry: all parked
   * non-surface buckets, with the ACTIVE dimension (when it
   * is not the surface) read from the live stores rather
   * than its stale parked copy. The surface never appears.
   */
  snapshotBuckets(): Record<string, DimensionBucketStores> {
    const out: Record<string, DimensionBucketStores> = {};
    for (const [key, stores] of this.parked) {
      if (key === SURFACE_DIMENSION_KEY) continue;
      out[key] = {
        piles: stores.piles.map((p) => ({
          ...p,
          stacks: p.stacks.map((s) => ({ ...s })),
        })),
        harvest: stores.harvest,
      };
    }
    if (this.activeKey !== SURFACE_DIMENSION_KEY) {
      out[this.activeKey] = {
        piles: pileState.snapshot(),
        harvest: harvestState.snapshot(),
      };
    }
    return out;
  }

  /**
   * Boot: replace the whole parked mirror from the save.
   * The live stores are the surface's at boot and are NOT
   * touched here (the shell restores those on the top-level
   * path); the active key stays the surface.
   */
  restoreBuckets(
    buckets: Record<string, DimensionBucketInput> | null | undefined,
  ): void {
    this.parked.clear();
    if (!buckets) return;
    for (const [key, bucket] of Object.entries(buckets)) {
      if (!key || key === SURFACE_DIMENSION_KEY) continue;
      this.parked.set(key, {
        piles: (bucket.piles ?? []).map((p) => ({
          ...p,
          stacks: (p.stacks ?? []).map((s) => ({ ...s })),
        })),
        harvest: { ...emptyHarvestSnapshot(), ...(bucket.harvest ?? {}) },
      });
    }
  }

  /** New world: the mirror empties with the world. The live
   *  stores are cleared by the existing world-change path. */
  clearBuckets(): void {
    this.parked.clear();
    this.activeKey = SURFACE_DIMENSION_KEY;
  }

  /** The parked bucket for a key, created empty on first
   *  touch (relocation passes only). */
  private bucketFor(key: string): DimensionBucketStores {
    let bucket = this.parked.get(key);
    if (!bucket) {
      bucket = emptyStores();
      this.parked.set(key, bucket);
    }
    return bucket;
  }

  /** Every cave key the relocation passes consider: the
   *  debut cave first, then the distributed instances
   *  around spawn in enumeration order. */
  private caveKeys(
    seed: string,
    spawn: { x: number; z: number },
    weightsAtPos: (x: number, z: number) => BiomeWeights,
  ): string[] {
    const rect = {
      minX: spawn.x - RELOCATION_REACH_M,
      maxX: spawn.x + RELOCATION_REACH_M,
      minZ: spawn.z - RELOCATION_REACH_M,
      maxZ: spawn.z + RELOCATION_REACH_M,
    };
    return [
      CAVE_DIMENSION_KEY,
      ...caveInstancesInRect(seed, spawn, weightsAtPos, rect).map(
        (inst) => inst.key,
      ),
    ];
  }

  /**
   * BOOT PASS 1 — legacy cave takes. Before buckets, a
   * fungus take in any cave wrote the SURFACE harvest store.
   * Move each surface SHRUNK / REMOVED entry whose id is one
   * of a cave's layer-1 fungus take ids into that cave's
   * bucket. Surface-store and surface-active only; a second
   * run finds nothing left to move. Returns what moved.
   */
  relocateLegacyCaveTakes(
    seed: string,
    spawn: { x: number; z: number },
    weightsAtPos: (x: number, z: number) => BiomeWeights,
  ): { shrunk: number; removed: number } {
    const none = { shrunk: 0, removed: 0 };
    if (this.activeKey !== SURFACE_DIMENSION_KEY) return none;
    const snap = harvestState.snapshot();
    if (snap.shrunk.length === 0 && snap.removed.length === 0) return none;
    let movedShrunk = 0;
    let movedRemoved = 0;
    for (const key of this.caveKeys(seed, spawn, weightsAtPos)) {
      const layout = caveLayoutForKey(seed, key);
      const ids = new Set<string>();
      for (const feature of layout.layers[0]?.features ?? []) {
        if (feature.kind !== 'twilightFungus') continue;
        ids.add(
          scatterTargetId(
            Math.floor(feature.x / CHUNK_SIZE),
            Math.floor(feature.z / CHUNK_SIZE),
            feature,
          ),
        );
      }
      if (ids.size === 0) continue;
      const bucket = this.bucketFor(key);
      const heldShrunk = new Set(bucket.harvest.shrunk.map((e) => e.id));
      const heldRemoved = new Set(bucket.harvest.removed);
      const shrunkHere = snap.shrunk.filter(
        (e) => ids.has(e.id) && !heldShrunk.has(e.id),
      );
      const removedHere = snap.removed.filter(
        (id) => ids.has(id) && !heldRemoved.has(id),
      );
      if (shrunkHere.length === 0 && removedHere.length === 0) continue;
      bucket.harvest.shrunk.push(...shrunkHere);
      bucket.harvest.removed.push(...removedHere);
      const gone = new Set([
        ...shrunkHere.map((e) => e.id),
        ...removedHere,
      ]);
      snap.shrunk = snap.shrunk.filter((e) => !gone.has(e.id));
      snap.removed = snap.removed.filter((id) => !gone.has(id));
      movedShrunk += shrunkHere.length;
      movedRemoved += removedHere.length;
    }
    if (movedShrunk > 0 || movedRemoved > 0) {
      harvestState.restore(snap);
    }
    return { shrunk: movedShrunk, removed: movedRemoved };
  }

  /**
   * BOOT PASS 2 — surface piles that belong to a cave.
   * Before buckets, a pile dropped in a cave (the crawl-
   * back fall pile is the live case) sat in the surface
   * store at cave-frame coordinates. Move each surface
   * pile whose point falls inside a cave layout's
   * footprint bounds into that cave's bucket — first
   * containing footprint wins, cave:main first. Attic-
   * frame piles are undecidable and stay. Returns the
   * number of piles moved.
   */
  relocateSurfacePilesToCaves(
    seed: string,
    spawn: { x: number; z: number },
    weightsAtPos: (x: number, z: number) => BiomeWeights,
  ): number {
    if (this.activeKey !== SURFACE_DIMENSION_KEY) return 0;
    const piles = pileState.snapshot();
    if (piles.length === 0) return 0;
    const layouts = this.caveKeys(seed, spawn, weightsAtPos).map((key) => ({
      key,
      bounds: caveLayoutForKey(seed, key).footprint.bounds,
    }));
    const staying: Pile[] = [];
    let moved = 0;
    for (const pile of piles) {
      const hit = layouts.find(
        (l) =>
          pile.x >= l.bounds.minX &&
          pile.x <= l.bounds.maxX &&
          pile.z >= l.bounds.minZ &&
          pile.z <= l.bounds.maxZ,
      );
      if (hit) {
        this.bucketFor(hit.key).piles.push({
          ...pile,
          stacks: pile.stacks.map((s) => ({ ...s })),
        });
        moved += 1;
      } else {
        staying.push(pile);
      }
    }
    if (moved > 0) {
      pileState.clear();
      pileState.restore(staying);
    }
    return moved;
  }
}

export const dimensionBuckets = new DimensionBuckets();
