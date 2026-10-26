# Silent Earth — Priority List

Written 2026-10-25. Source of truth for what happens in what order. Pins stay pinned; this list changes only on Adam's word.

## Settled rulings (2026-10-20, do not re-debate)

- **Redesign, rebuild in place** on NomadtheGrey/silentearth. Isometric presentation is dropped; what survives: the folk-horror vision/identity, data-driven content, world gen, harvest/craft/build systems. What goes: the iso rendering layer (IsometricTile / NatureAsset depth-sort presentation).
- **Camera is a player choice**: first-person OR third-person overhead, switchable. Presentation is 3D (Three.js, the BioForge-proven stack); third-person means the witch needs a visible character.
- **Identity vs BioForge**: it's on Earth, it uses magic, different goals, different feel.
- **Multiplayer eventually**: P2P co-op, invite-and-join like BioForge (room code / invite link, host authority, Cloudflare-relay pattern). Not at first — but the single-player loop is built event-driven / host-authority-shaped from the start so P2P is a transport job later, not a rewrite.
- **Threat (answered 2026-10-20)**: the FIRST enemy is weather/survival — chilly October wind, wet swampy terrain. Forest creatures later, maybe.
- **Survival meters (proposed, not pinned)**: warmth + dryness, compounding — wet and cold together is what kills. Fire, shelter, dry clothes push back. Magic is her edge as WARDS against weather (drying charms, a fire that won't gutter), not a weapon.

## The order

1. **WIP branch + freeze tag on silentearth.** Same pattern as BioForge/Mass Rattle: WIP for staging, main stays the untouched prototype until a merge. The iso prototype gets a freeze tag in the same setup step, so nothing is lost when the cutting starts. DONE 2026-10-25: WIP branch + iso-prototype tag both at a5b762a, verified at origin.
2. **Survival needs list, then whittle the harvestables against it.** Needs: fuel, food, warmth, dry, medicine, magic. Keep the best one or two harvestables per need; cut or demote the rest to scenery. Trim against the weather design, not by count — a sole medicine source must not be cut by accident. (See `harvestables-check-2026-10-25.md` for the first pass.)
3. **Redesign build.** 3D, switchable camera, event-driven from the start.
4. **Upgrades and progression — after the redesign, never before.** No tuning progression on systems about to be cut or rebuilt.

## Still open

- **The goal.** What is she working toward — or is outlasting the season the point? Survival-as-the-game vs survival-as-pressure-under-a-purpose. This can run in parallel with steps 1–2; it does not block them.
- **Forest creatures.** Later, maybe, as a second pressure once the weather loop is proven. No redesign needed to add them.

## Tone

- **A touch of absurdity (Adam, 2026-10-25):** a touch of absurdity is what the witch needs — folk horror with a touch of absurdity, not full comedy. Already showing up: dolly/sledge hauling, maybe moving a hearth. The absurdity is a seasoning, not the dish.

## Setting

- **~60 years post-apocalypse (Adam, 2026-10-25):** "something like" 60 years — approximate, not exact. Consequence: flint lies around wherever (cities were post-flint-dependent, so nobody scrounged for it even before the fall; 60 years on, nobody digging for it lately). 1970s FOLK HORROR LABEL DISCARDED (Adam, 2026-10-25): the prototype's "1970s folk horror" tag is Gemini/AI Studio's generic stamp (it puts that on ALL his games), not Adam's setting — AI Studio built the prototype. The game's own shape will emerge sooner or later; don't force it now.
