# Silent Earth — Harvestables Check (2026-10-25)

Checked against the audit clone of NomadtheGrey/silentearth (`~/workspace/games-audit/silentearth`, tip a5b762a), file `src/data/world_data.json`. This is a design read, not a code change: what each item is FOR in the weather-survival loop.

## The list as it stands (12 items, 5 structures, 5 tiles)

| Item | Category | Survival job today |
|---|---|---|
| Snap-Wood | wood | Fuel + framing — keep |
| River Silt | minerals | RESTORED (Adam, 2026-10-25) — binder/daub; Wattle Hut 12, Moss Cradle 4 |
| Tender-Vines | fiber | Lashing for shelter — keep |
| Primal Bone | rare | Kept, with a job (Adam, 2026-10-25): its description strongly hints at magical reagents — the magic tease vehicle |
| Peat Moss | insulation | Insulation + "drinks up dampness" — the DRY answer — strong keep |
| River Stone | geology | Parked (Adam, 2026-10-25): reserved as a future ingredient for her "tool" — not active, not cut |
| Silt-Salt | minerals | "High potency" — magic ingredient — keep |
| Downed Oak | heavy wood | Shelter skeleton — keep |
| Luminous Spores | life | Magic currency ("potency") — keep, but see below |
| Old Stump | utility | Workstation anchor, not a harvest — keep as mechanic |
| Twined Cordage | refined | Crafted binding, refined tier — keep |
| Dry Kindling | refined | Fire-starting — scarce dry fuel in a wet world — strong keep |

Structures: Lean-to, Wattle-and-Daub Hut, Moss Cradle, Woven Cottage, Garden Trowel (a tool, not a structure).

## Adam's rulings on this check (2026-10-25)

- **Game arc: survival first, magic strongly hinted.** The game starts as survival; magical reagents are teased hard from the beginning rather than introduced later. This is how the magic layer enters — as a hint, not a system dump.
- **Primal Bone stays, and carries the hint.** Its description will strongly hint at magical reagents. Bone is the tease vehicle.
- **River Stone is parked, not cut.** It sits out until needed, reserved as an ingredient for her "tool" (tool itself still unspecified).
- **Clay → first receptacles, after fire (Adam, 2026-10-25).** Receptacles are for FOOD STORAGE and for primitive salves / medicine / restoratives / reagents — NOT for cooking. Cooking is open-fire: on a stick, or chucked into the fire and dug out (corrects the earlier pot-for-cooking assumption). Open: whether clay is a new item or river silt repurposed.
- **River Silt RESTORED (Adam, 2026-10-25).** The cut is withdrawn: Adam thought there were no recipes for silt, but there are — Wattle Hut spends 12, Moss Cradle spends 4. Silt is back as an item (binder/daub). REFINED PICTURE: silt ground (creek beds, damp hollows) yields silt when harvested AND clay when dug with the trowel — digging never yields useless things still holds (dig in silt → clay, no junk). The clay-as-daub proposal is withdrawn: daub stays silt's job.
- **Clay is NEW, and tool-gated (Adam, 2026-10-25).** Resolves the open question above: clay is its own findable item, not silt repurposed — dug from silt ground with the trowel, and digging yields clay only, never useless byproducts — but she must MAKE her tool to get it. CLAY RESERVED (Adam, 2026-10-25): clay's uses are pottery, bricks, maybe tools — not daub (silt keeps that).
- **ONE multi-purpose tool, not six (Adam, 2026-10-25).** A single tool with many jobs — no toolbelt sprawl. Candidate jobs (proposed, not pinned): dig clay, dig roots/food, grind medicine, work a garden plot.
- **FIRST TOOL = THE GARDEN TROWEL (Adam, 2026-10-25).** She CREATES it, and it UPGRADES as she goes (shape decided; numbers/tuning later, per the upgrades-after-redesign rule). The prototype already has this item: GARDEN_TROWEL costs Snap-Wood 4 + Twined Cordage 2 + River Stone 2 and requires a workstation — so the parked River Stone already sits in its recipe. UPGRADE SHAPE (Adam, 2026-10-25): "more of whatever it does" — upgrades raise yields across the trowel's jobs; the basic trowel suffices for harvesting clay, small amounts at first, more as she upgrades; the NEXT upgrade extends better harvest to OTHER things as well as more clay. Upgraded version's NAME still TBD (Adam, 2026-10-25) — do not invent one. Whether upgrades also add new verbs remains open, as does the workstation question (find a stump first, or craft the first trowel by hand?).
- **SHARPENING (Adam, 2026-10-25).** She can sharpen the trowel to gather more vines and such — sharpening is the mechanism for the "next upgrade" yield widening (better harvest of other things, not just clay). WHETSTONE PINNED (Adam, 2026-10-25): the river stone IS the whetstone — she sharpens the trowel on a river stone (this is the parked stone's job; whether a stone is consumed per sharpening or kept is open). Open: whether sharpening is permanent or upkeep (edge dulls with use?).
- **AXE UPGRADE = EVOLUTION (Adam, 2026-10-25).** The axe part is an evolution OF the trowel, not a second tool — the one-tool rule holds strictly. The next upgrade is some kind of axe evolution — harvest more wood, for fire and building (the two wood sinks). NAME PROVISIONAL (Adam, 2026-10-25): **"spade-axe"** — "fine for now" (provisional, changeable, not a hard pin). NAMING DOCTRINE (Adam, 2026-10-25): "witchy...whatever" names are SAVED until she enchants stuff — plain names now, witchy names at the enchantment tier (so "witch's trowel" is deferred, not discarded — it could return as an enchanted name). Earlier candidates (dig-axe, marsh mattock, grubber, muck axe, mattock, grub axe) remain unpicked.
- **TOOL ROUTES (Adam, 2026-10-25):** two upgrade routes to the same end — Trowel → Spade → Spade-Axe, OR Trowel → Axe-Trowel → Spade-Axe. Both liked names survive as middle stages on different routes; Spade-Axe is the convergence (his spelling wobbles Spade-Axe/SpadeAxe). The Spade-Axe then upgrades to the WHEELED form — the Dolly upgrade IS the tool, wheeled (the one-tool rule holds; the dolly is not a separate item). WHEELED-FORM NAME BRAINSTORM (Marlowe, 2026-10-25): barrow-axe, trundle-axe, spade-cart, the hauler, dolly-axe, bog cart. PICK (Adam, 2026-10-25): **"Trundle-Tool"** (adapted from trundle-axe — "Tool" fits because the wheeled form is the whole tool) — current endpoint, "final for now"; a further upgrade beyond it is possible, not ruled out. Sledge counterpart TBD (sledge-axe / bog sledge offered as mirrors). Sharp trowel's place within these routes: open.
- **"SHARP TROWEL" (Adam, 2026-10-25).** The upgraded (sharpened) trowel is called the "sharp trowel" — resolves the earlier name TBD. Its BENEFITS go in its DESCRIPTION (same technique as Primal Bone's reagent hint: descriptions carry design information).

## Findings

1. **No food item exists.** Nothing to eat — no berries, mushrooms-as-food, fish, nothing. A survival loop with no food source is a hole, not a trim candidate. The trim pass needs to ADD a food source (or two), not just cut.
2. **No medicine item exists.** Nothing treats sickness or injury. River Stone's "grinding" hints at a medicine chain (grind herb → remedy) but the herb isn't there.
3. **Bone and River Stone — RESOLVED by Adam's 2026-10-25 rulings (see above).** Bone stays as the magic-hint vehicle; River Stone is parked as a future tool ingredient. Neither is cut.
4. **Spores drop from nearly everything** (0.25 on snap-wood, vines, peat moss, oak; 0.40 on salt crystal). If magic's currency falls out of every harvest, magic feels free, not earned. Either narrow the spore sources or make spores a rarer, deliberate gather.
5. **The Moss Cradle is a dangling system.** It's a cultivated plot — a garden — but there are no seeds or crops to grow in it. It only makes sense once a food/medicine plant exists. Park it until then.
6. **The count isn't the problem.** 12 items is modest; the bloat is redundancy without jobs (two woods, two minerals, vague rares) plus two missing needs. Trim by job, not by count — per the priority list's trim test.

## Suggested shape after the trim (for Adam's call)

- Fuel: Snap-Wood + Dry Kindling (scarce)
- Shelter: Downed Oak + Tender-Vines/Twined Cordage + Peat Moss + River Silt as daub (restored — hut recipe stands)
- Clay (reserved): pottery, bricks, maybe tools — not daub
- Her tool: THE GARDEN TROWEL — she creates it, it upgrades as she goes (Adam, 2026-10-25); ONE tool, not six; tool-gated clay digging + more jobs TBD
- Dry/warmth: Peat Moss, fire, shelter
- Magic: Silt-Salt + Luminous Spores (narrowed sources)
- Food: ADD one or two (e.g. a bog berry, a mushroom)
- Medicine: ADD one (e.g. a herb; grinding chain TBD — River Stone is parked for her tool, so the grinder question stays open)
- Magic tease: Primal Bone's description strongly hints at reagents (survival first, magic hinted)
- Parked: River Stone (future tool ingredient)
