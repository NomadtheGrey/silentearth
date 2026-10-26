# Silent Earth — World Topology (2026-10-25)

Adam's rulings from the 2026-10-25 build-go stream. The biome set at the
bottom is Marlowe's draft (Adam delegated: "feel free to make several
realistic biomes and blends") — NOT pinned. Names, membership, and blend
widths await Adam's pin pass.

## Direction (Adam, pinned by his fork answer)
- Ditch iso entirely. The redesign is 3D, with OPTIONAL perspective —
  the camera is a player choice (first-person OR third-person overhead,
  switchable), as pinned 2026-10-20.
- This answers the landing-1 fork: fresh shell, not 3D-alongside-iso.
  The iso files (IsometricTile, NatureAsset, StructureAsset, isoMath)
  go away with the shell.

## Tile types are gone (Adam)
- The prototype's notion of tile types (Dense Thicket, Damp Hollow,
  Tangled Deepwood, Shallow Creek, Mineral Crust) is REMOVED, not
  renamed. The world is not classified into tile labels.
- Replacement: the world is made of OBJECTS and ground character —
  vines, bushes, logs, bog patches, and whatever else is here (the
  existing content vocabulary: snap-wood, tender-vines, peat moss,
  river silt, river stone, bone, salt crystal, downed oak, dry
  kindling, spores).
- A biome, in this game, is a MIX of objects + ground character
  (wetness, mud depth, vegetation density) — not a tile label and
  not a zone identity.

## Topology rules (Adam)
- Biomes exist, but they BLEND into their neighbors. No hard borders.
- Zones flow together freely in gameplay: no gates, no loads, no
  hard edges between zones.
- Neighboring zones appear when needed on camera — streaming by
  camera proximity — and they arrive blending in, biome-wise, not
  abruptly (no pop-in of a different-looking zone).
- Blending is DYNAMIC: computed at runtime from position (continuous
  fields), not pre-baked borders or painted maps.
- HARD RULE: the world is reproducible via the world seed. Same seed
  = same world: same biome layout, same blends, same scatter. Any
  blending or streaming scheme that breaks seed reproducibility is
  wrong, however pretty.

## NOT BioForge's model (do not import it)
- BioForge biomes are per-zone identities in a family matrix with
  hybrid cells. Silent Earth is the opposite shape: continuous fields,
  object mixes, dynamic weights, no zone identities, no matrix.
  Keep the two games' world models separate.

## Starting biome (Adam)
- The starting biome is sloppy and wet but NOT outright swamp —
  kinda halfway between dry ground and swamp. Sort of a hybrid.
- Real swamp is a harsher neighbor: very hard to navigate, boggy,
  gross. That's WHY the start stops halfway — full swamp would
  punish movement from minute one.
- A neighboring biome is more pleasant (drier, easier). Contrast is
  part of the topology: the start is uncomfortable, relief is
  nearby, worse is nearby too.

## Biome set — DRAFT (Marlowe, for Adam's pin pass)
Each biome = an object mix + ground character. Blends are the
in-between mixes, computed dynamically wherever two fields overlap.

- Mirewood (START): sloppy-wet hybrid woodland. Standing-water
  patches, mud, thick vines, bushes, downed logs, bog patches just
  starting to form. Wet, cluttered, slow-ish — but navigable.
- Deep Bog (harsher neighbor): outright swamp. Deep mud, sucking
  bog, standing water everywhere, sparse stunted growth. Very hard
  to navigate, gross. The place Mirewood deepens into.
- Oldfield Rise (pleasant neighbor): higher, drier old-field ground.
  Open bushes, scattered trees, firm footing. Relief after the mire.
- Creek Bottom: silt beds and shallow water. Clay digs here, plus
  creek life (crayfish, frogs). Muddy banks blend into Mirewood.
- Tanglewood: vine- and bush-choked dense growth. Cordage country
  (vines everywhere), low visibility, tangled footing.
- Salt Flat: dry mineral crust, salt crystals, bone. The odd dry
  one — a reminder the world isn't all wet.
- Meadow (ADDED by Adam, 2026-10-26): farther out from spawn, PRETTY.
  Open grass, flowers, light. Scenery details lane-decided; no new
  harvestable items.
- Forest (ADDED by Adam, 2026-10-26): farther out from spawn, PRETTY.
  Tall trees, dappled light. Scenery details lane-decided; no new
  harvestable items.

Blends (draft, all dynamic): Mirewood↔Deep Bog (deepening mire),
Mirewood↔Oldfield Rise (drying rise), Mirewood↔Creek Bottom (muddy
banks), Mirewood↔Tanglewood (thickening growth), Creek Bottom↔Salt
Flat (drying mineral bank), and so on for every adjacent pair —
blends are what the fields produce, not a list to hand-place.

## Implementation shape (for landing 1)
- Seeded noise fields (the repo already depends on fast-simplex-noise)
  drive wetness + density; per-position biome weights are normalized
  from those fields, so blends are continuous by construction and
  chunk borders can't seam.
- Chunks/zones generate deterministically from the seed on demand
  around the camera; the same seed regenerates the same chunk.
- Camera: switchable first-person / third-person overhead ("optional
  perspective"). A visible witch character in third-person.
- Event-driven from day one (host-authority-shaped for later P2P).

## Open (nothing here is decided)
- Biome names, membership, and blend widths (draft above).
- Which neighbor is "the pleasant one" in a given seed (Oldfield Rise
  is the draft candidate).
- Exact streaming radius / fade treatment for appearing zones.
- How swamp navigation difficulty is expressed mechanically
  (slow? stuck risk? — NOT decided; do not invent a mechanic).
