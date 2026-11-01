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
 *  The rest (bush, log, bogPatch, standingWater, tree, reed,
 *  marshGrass, bogGrowth) are sources or ground character whose yields are
 *  defined in src/game/objects.ts; standingWater and bogPatch yield
 *  nothing — they are ground character, not harvest sources.
 *  Fill-in landing (2026-10-25) added stump, reed, marshGrass, bogGrowth.
 *  Meadow/forest landing (2026-10-26) added flower + tallTree: SCENERY
 *  ONLY, no harvestable item — they yield nothing. */
export type ScatterKind =
  | 'bush'
  | 'log'
  | 'bogPatch'
  | 'standingWater'
  | 'tree'
  | 'oakTree'
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
  | 'yarrow'
  | 'coneflower'
  | 'clover'
  | 'dandelion'
  | 'milkweed'
  | 'poppy'
  | 'sunflower'
  | 'aster'
  | 'trillium'
  | 'violet'
  | 'ladySlipper'
  | 'iris'
  | 'waterLily'
  | 'tallTree'
  | 'edibleMushroom'
  | 'poisonMushroom'
  | 'groundAcorns'
  | 'appleTree'
  | 'flint'
  | 'pond'
  | 'beehive'
  // Sites landing (2026-10-30): the Grove's kinds — emitted ONLY
  // by worldgen's site pass from sites.ts, never in biome mixes.
  // groveOak is the protected old tree (its own older look);
  // standingStone / carvedStone / hedgeWall / hoardMound are
  // non-harvestable scenery (the ring, the fragment stone, the
  // maze walls, the crow's hoard).
  | 'groveOak'
  | 'standingStone'
  | 'carvedStone'
  | 'hedgeWall'
  | 'hoardMound'
  // Site-pass kinds (the Schoolhouse, sites.ts — same rule:
  // emitted only by the site pass): the ruined wall ring
  // (standing + broken-stub segments), the bell tower, the
  // desks, the blackboard, the flagpole, rubble.
  | 'ruinWall'
  | 'ruinWallStub'
  | 'bellTower'
  | 'schoolDesk'
  | 'blackboard'
  | 'flagpole'
  | 'rubble'
  // Site-pass kinds (the Burnt Village, sites.ts — same rule):
  // house wall segments (sound + charred), gable roofs
  // (standing + fallen), the village well, ash ground.
  | 'villageWall'
  | 'villageWallCharred'
  | 'villageRoof'
  | 'villageRoofFallen'
  | 'villageWell'
  | 'ashPatch'
  // Site-pass kinds (the Homesteads, sites.ts — same rule):
  // the recurring raided-homestead family at
  // HOMESTEAD_SEGMENT_M — wall segments (sound + charred),
  // gable roofs (standing, charred-standing, fallen).
  // Fragment-carrying homesteads are always burnt (Adam):
  // the charred set is the fragment face of the family.
  | 'homesteadWall'
  | 'homesteadWallCharred'
  | 'homesteadRoof'
  | 'homesteadRoofCharred'
  | 'homesteadRoofFallen'
  // Placement-pass kind (the village beats build, pre-built
  // 2026-10-31): weathered human remains — emitted ONLY by
  // the beats build's boneSpots placement, never in biome
  // mixes (its source def carries no biomes). Scenery: there
  // is nothing to harvest from the dead.
  | 'humanRemains'
  // Site-pass kinds (the Farmhouse, sites.ts — same rule):
  // wall segments, the gable roof, the composed porch, and
  // the hearth stone (hearth block + the Great Stone).
  | 'farmWall'
  | 'farmRoof'
  | 'farmPorch'
  | 'hearthStone'
  // Site-pass kinds (the Farmhouse FAMILY, 2026-10-31 —
  // same rule; the two-story variant-kind kit: upper-story
  // wall segments in two window rhythms, an interior stair
  // run, and the second-floor slab tile. The landed farm
  // set above is untouched — the family builds beside it.)
  | 'farmWallUpper'
  | 'farmWallUpperB'
  | 'farmStairs'
  | 'farmFloorSlab'
  // Site-pass kinds (the Farmhouse FAMILY, second wave —
  // the slot pieces the table landing fills in): the
  // ground story's rhythm twin, the gable width family,
  // the seatable chimney brick, the cellar bulkhead.
  | 'farmWallB'
  | 'farmGableEnd'
  | 'farmGableEndWide'
  | 'farmChimney'
  | 'farmCellarDoor'
  // Site-pass kinds (the Chapel, sites.ts — same rule):
  // tall wall segments, the steep roof, the steeple, and
  // the graveyard's two stone shapes.
  | 'chapelWall'
  | 'chapelRoof'
  | 'steeple'
  | 'gravestone'
  | 'gravestoneCross'
  // Site-pass kind (the Cave Mouth, sites.ts — same rule):
  // the facade's dark opening, and its rock surround.
  | 'caveMouth'
  | 'caveBoulder'
  // Dimension kinds (caves.ts — emitted by the cave
  // generator only, never by the surface worldgen):
  // chamber walls, ceiling slabs, stalactites, pools, and
  // the entrance's twilight fungus.
  | 'caveRock'
  | 'caveCeiling'
  | 'stalactite'
  | 'cavePool'
  | 'twilightFungus'
  // Site-pass kinds (the General Store, sites.ts — same
  // rule): walls, the false front, roof, boardwalk porch,
  // and the interior fixtures (counter, shelves).
  | 'storeWall'
  | 'storeFront'
  | 'storeRoof'
  | 'storePorch'
  | 'storeCounter'
  | 'storeShelf'
  // Site-pass kinds (the Drowned Mill, sites.ts — same
  // rule): stone walls, the standing roof slope, the
  // fallen slope, the wheel, and the race.
  | 'millWall'
  | 'millWallFallen'
  | 'millRoof'
  | 'millRoofFallen'
  | 'millWheel'
  | 'millRace'
  // Site-pass kinds (the Sunken Road, sites.ts — same
  // rule): pavement slabs (sound and sunken), shoulder
  // posts, and the one signed post.
  | 'roadSlab'
  | 'roadSlabSunk'
  | 'roadPost'
  | 'roadSign'
  // Site-pass kinds (the Rail Siding, sites.ts — same
  // rule): the bed with its ties, the rails, the boxcar,
  // the loading platform, the buffer stop.
  | 'sidingBed'
  | 'sidingRail'
  | 'boxcarBody'
  | 'sidingPlatform'
  | 'sidingBuffer'
  // Site-pass kinds (the Barn, sites.ts — same rule):
  // segment walls (sound and patched), fallen walls,
  // roof bays (plain and gabled), the fallen roof, the
  // big door, the loft, the lean-to, hay bales.
  | 'barnWall'
  | 'barnWallPatch'
  | 'barnWallFallen'
  | 'barnRoofBay'
  | 'barnRoofEnd'
  | 'barnRoofFallen'
  | 'barnDoor'
  | 'barnLoft'
  | 'barnLeanTo'
  | 'hayBale'
  // Site-pass kinds (the Grain Silo, sites.ts):
  // the standing body, the breached body, the fallen
  // body, and the companion grain bin.
  | 'siloBody'
  | 'siloBreached'
  | 'siloFallen'
  | 'grainBin'
  // Site-pass kinds (the Water Tower, sites.ts):
  // the standing legs and tank, the fallen tank and
  // legs, and the pump shed companion.
  | 'waterTowerLegs'
  | 'waterTowerTank'
  | 'waterTowerTankDown'
  | 'waterTowerLegsDown'
  | 'pumpShed';

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
