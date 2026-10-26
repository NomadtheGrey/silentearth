/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Redesign types (landing 1). The isometric model is gone: no GridPos, no
 * WorldTile, no tile enum. The world is continuous positions, biome
 * weights, and scatter objects.
 *
 * The item vocabulary interfaces below still describe src/data/world_data.json
 * (kept as the item vocabulary). NOTE: that JSON's legacy `tiles` table —
 * the prototype's tile-keyed spawn table — is SUPERSEDED by the biome
 * object mixes in src/game/biomes.ts and is intentionally untyped here.
 * The table stays in the JSON file until a later cleanup landing removes it.
 */

/** Player camera: first-person, third-person overhead follow, or behind-the-witch follow. */
export type CameraMode = 'first' | 'third' | 'behind';

/** Biome ids (DRAFT set, 2026-10-25 — names await Adam's pin pass;
 *  meadow + forest added 2026-10-26, Adam's existence/placement/pretty
 *  ruling, lane-decided falloff in src/game/biomes.ts). */
export type BiomeId =
  | 'mirewood'
  | 'deepBog'
  | 'oldfieldRise'
  | 'creekBottom'
  | 'tanglewood'
  | 'saltFlat'
  | 'meadow'
  | 'forest';

/** Normalized biome weights at a position; weights sum to 1. */
export interface BiomeWeights {
  weights: Record<BiomeId, number>;
  dominant: BiomeId;
}

/** Scatter object kinds. Kinds with an item-vocabulary counterpart map:
 *  snapWood -> SNAP_WOOD, tenderVines -> TENDER_VINES, peatMoss -> PEAT_MOSS,
 *  riverSilt -> RIVER_SLUDGE, riverStone -> RIVER_STONE, bone -> BONE,
 *  saltCrystal -> SALT_CRYSTAL, downedOak -> DOWNED_OAK, stump -> STUMP.
 *  The rest (vine, bush, log, bogPatch, standingWater, tree, reed,
 *  marshGrass, bogGrowth) are sources or ground character whose yields are
 *  defined in src/game/objects.ts; standingWater and bogPatch yield
 *  nothing — they are ground character, not harvest sources.
 *  Fill-in landing (2026-10-25) added stump, reed, marshGrass, bogGrowth.
 *  Meadow/forest landing (2026-10-26) added flower + tallTree: SCENERY
 *  ONLY, no harvestable item — they yield nothing. */
export type ScatterKind =
  | 'vine'
  | 'bush'
  | 'log'
  | 'bogPatch'
  | 'standingWater'
  | 'tree'
  | 'snapWood'
  | 'tenderVines'
  | 'peatMoss'
  | 'riverSilt'
  | 'riverStone'
  | 'bone'
  | 'saltCrystal'
  | 'downedOak'
  | 'stump'
  | 'reed'
  | 'marshGrass'
  | 'bogGrowth'
  | 'flower'
  | 'tallTree';

/** One placed scatter object in a chunk. y is its base height above ground. */
export interface ScatterObject {
  kind: ScatterKind;
  x: number;
  z: number;
  y: number;
  scale: number;
  rotY: number;
}

/** A generated chunk: its coords + its deterministic scatter. */
export interface ChunkData {
  cx: number;
  cz: number;
  objects: ScatterObject[];
}

/** Item definition from world_data.json (vocabulary for later landings). */
export interface SecondaryDrop {
  type: string;
  chance: number;
  message: string;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: number;
  icon?: string;
  isWorkstation?: boolean;
  harvestAction?: string;
  harvestStep?: number;
  struggleMessage?: string;
  successMessage?: string;
  secondaryDrops?: SecondaryDrop[];
}

export interface StructureDef {
  id: string;
  name: string;
  costs: Record<string, number>;
  description: string;
  requiresWorkstation?: boolean;
}

export interface WorldData {
  items: Record<string, ItemDef>;
  structures: Record<string, StructureDef>;
}
