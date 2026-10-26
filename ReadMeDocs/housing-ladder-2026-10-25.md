# Silent Earth — Housing Ladder (Adam, 2026-10-25)

## The ladder

1. **Lean-to** — the start.
2. **Thatch hut** — new (not in the prototype).
3. **Woven Cottage** — wattle-and-daub construction (MERGED, Adam, 2026-10-25: the prototype's wattle-and-daub and woven cottage are one stage — in-game name "Woven Cottage", description carries "Wattle and Daub").
4. **Small wooden hut** — new (not in the prototype).

**Upgradable with more resources** (Adam, 2026-10-25): stages improve with additional resources invested. Details TBD.

## Home function + size rule (Adam, 2026-10-25)

- **Homes hold supplies safe from the elements.** Each home type stores supplies protected from weather — storage capacity grows with tier. (This makes homes do two jobs: shelter for her AND a vault for supplies, both scaling up the ladder.) STORAGE NUMBERS (Adam, 2026-10-25): lean-to holds 50, increasing per house upgrade (per-upgrade amounts TBD).
- **Each home type is progressively larger.** Size scales up the ladder — this supersedes the prototype's same-footprint art, where the cottage and hut share one tile's width. In the redesign, lean-to < thatch hut < woven cottage < small wooden hut in size.
- **Open mechanics question:** what do the elements do to supplies left OUTSIDE — spoil, soak, scatter? The "safe from the elements" rule implies outside supplies are at risk; the consequence is undecided.

## Workstation rule (Adam, 2026-10-25)

- **No home requires a workstation next to it.** The prototype cottage's `requiresWorkstation` is removed — homes place freely, where the ground is good, with no adjacency tax to a stump.
- **The workstation can be anywhere.** Its jobs (Adam, 2026-10-25): creating the RAW INGREDIENTS that don't require fire (e.g. woven cordage), MAKING THE TOOL, PROCESSING ingredients for things, for products, and UPGRADING THE TOOL, etc. Fire handles the rest (firing pottery, smelting, improved cooking). This splits crafting into two stations: workstation (tools + no-fire processing + tool upgrades) vs fire (fire-required work).
- **First-tool question RESOLVED (Adam, 2026-10-25):** yes, the workstation makes the tool — the garden trowel is made at a workstation (find a stump first), not hand-made.
- **Workstation is CRAFTABLE (Adam, 2026-10-25):** she can make her own workstation with enough ingredients (cost TBD) — finding a stump is not the only way to get one.
- **The stump is the "starter" workstation (Adam, 2026-10-25).** Found stump = starter tier; crafted workstation = the real one.
- **Wheel and loom are FORKED upgrades to a (crafted) workstation (Adam, 2026-10-25).** Branching upgrades off the crafted workstation: wheel fork (pottery), loom fork (weaving). SEPARATE, not combined (Adam, 2026-10-25): each its own upgrade, not one merged wheel-loom device — both obtainable independently is the natural reading. This answers the workstation-upgrade-benefit question: the "upgrades" are the forks. Open: whether a found stump can take forks.
- **Stump upgrade — IDEAS ADOPTED (Adam, 2026-10-25):** "I like those options, let's implement them" — adopted as DESIGN decisions (code waits for the WIP setup per the agreed sequence; "implement" read as design adoption, Adam to correct if code-now was meant). Specified: Stump upgrades into the **"Stumpy Workstation"**; the Stumpy Workstation is MOVEABLE using the Trundle-Tool (Adam, 2026-10-25: stumps upgrade to a workstation, moveable with the trundle); splitting wood HERE yields MORE LUMBER than splitting out in the field (location bonus: workstation splitting > field splitting). Storage-shelf and ritual-shrine options liked, details TBD.
- **CARRYING RULE, CORRECTED (Adam, 2026-10-25):** slow + NO INTERACT while carrying stands — Marlowe misread the previous message as withdrawing the interact lock; it stands. Moving a stump is FICTIONAL (acknowledged conceit — fine, it's a game). With the UPGRADED TOOL, give her SOME SLACK on the penalty — CLARIFIED (Adam, 2026-10-25): the slack is NOT faster movement (slow stays). The slack is CAPABILITY: with her AXE-TROWEL she can uproot/cut enough off a stump to pick it up at all. PICKUP RULE, SUPERSEDED (Adam, 2026-10-25): the axe-trowel pickup requirement is WITHDRAWN — moving is the Dolly upgrade's job alone (see DOLLY FUNCTION). The axe-trowel does its thing on logs and such (wood work), not moving. The axe-trowel's dual function explains the name: it uproots (trowel side) and cuts (axe side). DOLLY UPGRADE (Adam, 2026-10-25): a dolly upgrade to the tool, for fun — a little wheeled dolly for hauling stations (exact benefit TBD; natural reading: it eases/overcomes the carrying penalty — the "overcome later" beat, made fun). HAULING DEVICE, TERRAIN RULE (Adam, 2026-10-25): dolly OR sledge, whichever makes sense on the terrain (wheels for firm ground/grass, sledge runners for soft, wet, swampy ground — wheels bog down in mud) — exact form (one adaptive device vs two variants) TBD. DOLLY FUNCTION, RESOLVED (Adam, 2026-10-25): she moves stations with the Dolly upgrade alone ("let her get away with moving it with the Dolly upgrade") — workstation, loom, etc., maybe even a HEARTH (maybe, not pinned). The axe-trowel keeps to logs and such. The earlier axe-trowel pickup requirement is withdrawn. NOTE: the Dolly upgrade is the Spade-Axe's wheeled form (the tool itself, wheeled), not a separate item — one-tool rule holds. DISTINCTION (Adam, 2026-10-25): moving BASES is one thing; moving UPGRADED STUMPS closer to the house is another (distinct, more routine — the house is the anchor and the stump migrates toward it as camp develops). Open: does the slow/no-interact rule apply equally to stump-shuffling, or is that a lighter move than base relocation?
- **DISCOVERABILITY (Adam, 2026-10-25):** it must be made OBVIOUS to the player that she can move the stump (method TBD — interaction prompt, visual cue, tutorial beat, description, etc.). Presumably the same obviousness treatment covers the other moveables (loom, pottery wheel) — Adam named the stump.
- **Stump upgrade — IDEAS OFFERED (Marlowe, 2026-10-25; now adopted, see above):** (1) the crafted workstation itself — feed the stump wood and cordage and it BECOMES the proper workbench that takes wheel/loom forks (two paths, one destination: build new or upgrade the stump); (2) a chopping block — splitting wood into more kindling/planks (ties to axe + fire/building); (3) a workbench with storage — a shelf/drawer for tools and ingredients; (4) later, a ritual stump/shrine — when the magic layer opens, the first workstation becomes a magic focus (folk-horror payoff).
- **More stations (Adam, 2026-10-25):** a POTTER'S WHEEL is needed (for pottery — shaped on the wheel, fired in the kiln); a LOOM is a maybe (weaving — exact products TBD).

## Prototype mapping

- **Lean-to** — LEAN_TO already exists: Snap-Wood 6, Tender-Vines 3, Peat Moss 2.
- **Thatch hut** — new stage. THATCH COMPOSITION PINNED (Adam, 2026-10-25): thatch = Snap-Wood + Tender-Vines + River Silt (quantities draft — see recipes doc; moss provisional withdrawn).
- **Dirt + grass roofing (Adam, 2026-10-26):** dirt and grass serve as roofing for certain house types that would need that (sod/turf roofs — Viking turf-house precedent). Exact house types + recipes TBD; thatch hut composition unchanged. Mud's sink still open.
- **Woven Cottage (wattle-and-daub construction)** — MERGED (Adam, 2026-10-25): the prototype's WATTLE_HUT (oak 4, silt 12, vines 8) and WOVEN_COTTAGE (oak 10, cordage 6, moss 15, stone 4, requires workstation) are almost identical, so they become ONE stage — in-game name "Woven Cottage", description carries "Wattle and Daub". Merged recipe TBD (which costs survive, and whether the workstation requirement survives, are open).
- **Small wooden hut** — new stage, above the woven cottage.
- **Wooden Cottage — PROPOSED then SET ASIDE, CONFIRMED (Adam, 2026-10-25):** the next house upgrade after the woven cottage could be a wooden cottage built from actual cut logs. Adam then noted small wooden hut already exists in the ladder ("Oh ya, small wooden hut we have that. Sorry"), and confirmed the mixup ("No, i just forgot about the hut") — the cottage idea was just him forgetting the hut. Set aside, not a stage.
- **Raised Hut / Stilts Upgrade — LIKED (Adam, 2026-10-25):** upgrade of the small wooden hut — has stilts and a HUGE storage bonus (number TBD; recipe TBD). Reminds Adam of Baba Yaga (the hut on legs — folk-horror touchstone, not a chicken-legs pin).
- **Moss Cradle** — not housing; a garden plot, parked until crops exist.

## Mechanics link (proposed, not pinned)

Better shelter should mean better protection from the survival loop's two drains: each stage up the ladder shields more wind and rain, so warmth and dryness drain slower inside. Shelter quality becomes the long-term answer to weather, the way fire is the short-term one.
