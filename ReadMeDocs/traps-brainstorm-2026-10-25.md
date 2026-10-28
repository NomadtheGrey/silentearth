# Silent Earth — Primitive Traps (brainstorm, 2026-10-25)

NOT pins except where marked — Adam opened the thread ("maybe we can figure out"); Deadfall PICKED 2026-10-26 (see below), rest still brainstorm. Traps are made from the stuff she already harvests, and they answer the food need with a set-and-wait mechanic instead of active hunting.

## Candidates, by material

- **Snare (vines/cordage + snap-wood stakes)** — thicket edges. Small game: rabbit, squirrel, waterfowl, muskrat (the classic swamp animal — meat + fur). The cordage skill she already needs for shelter becomes the trap skill.
- **Fish/weir trap (vines + snap-wood, woven funnel)** — shallow creek. Crayfish, fish, eels. A woven funnel trap is real-world tech and very witch: the same weaving hands that make cordage make the trap.
- **Pot trap (clay receptacle, sunk in the creek)** — crayfish crawl in, can't easily crawl out. Ties pottery to food: a pot is not just storage, it's a trap.
- **Pitfall (trowel-dug pit + vine/moss cover)** — the trowel's dig verb becomes a trap verb. Catches small game wandering the thicket. Cover with peat moss for camouflage.
- **Deadfall (downed oak + vines + river stone weight)** — the heavy option. Bigger prey, or a defensive trap. The stone finally has a second job (weight), and oak has a job beyond shelter. PICKED (Adam, 2026-10-26): a log on a couple lengths of rope + a tripwire/rope trigger — this construction is the picked deadfall; traps system itself NOT built yet. Stones allowed as counterweight (Adam, 2026-10-26): if counterweights are part of the construction, river stones fill that role — the stone holds the set, the log drops. She'll need a bunch of stones for this (per-trap count TBD) — deadfall counterweights make river stones a stockpile item.

## Mechanics questions (resolved 2026-10-28, Adam's calls; decay still open)

- **Set-and-wait loop:** she sets traps, then checks them on rounds (mornings?). Checking traps is a daily loop that gets her out into the cold — pairs with fire tending. Collection shape still to plan (simple, per Adam 2026-10-28 — collection design stays SIMPLE when briefed).
- **Bait (RESOLVED, Adam 2026-10-28):** OPTIONAL, not required — traps catch without bait at the base 5% per placed trap per game hour. Baited traps catch faster: bait gives a bonus to catching, maybe another 5% per day (DRAFT number — "maybe" is Adam's word; unit per-day vs per-hour is open for pin pass, since catch rolls are hourly). Bait item itself TBD (what counts as bait — food scraps were the brainstorm candidate, not pinned).
- **Weather effects (RESOLVED, Adam 2026-10-28):** IRRELEVANT to creatures and traps — whatever the weather is, the creatures there are used to their biome. No rain washing bait away, no cold slowing prey, no storms wrecking traps. Weather still matters to the PLAYER (exposure, survival), not to creatures, their presence, their behavior, or trap catches.
- **Decay/loss:** do traps wear out, get stolen, get sprung empty? Folk-horror flavor (open, not proposed as a pin): something in the woods taking the catch — or leaving something in return. STILL OPEN (not decided 2026-10-28).
- **Made where (RESOLVED in code, confirmed 2026-10-28):** BY HAND, not workstation-dependent — all five trap recipes carry station 'hand' (recipes.ts: snare, fish-weir-trap, pot-trap, pitfall, deadfall), craftable by hand anywhere, no workstation needed. The brainstorm's open question is closed by the shipped code (traps end-to-end, merge #7).
