/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign shell — UI wired (wiring round, 2026-10-26).
 * This mounts the Three.js world and the staged UI on top of it:
 * HudShell (needs row awaiting survival systems), the scaffold
 * readout folded into the HUD (camera, position, ground here,
 * chunks, seed), WitchHealth unwired (awaiting health system),
 * HungerIndicator live on the real Systems stage (see the hunger
 * note below), interactive WornList + live ShelteredIndicator
 * in the HUD, placed-fire chips + lighting menus + placement
 * mode in the world overlay (see the MVP notes below),
 * InventoryPanel on the real PersonalInventory, CraftingMenu on
 * the real Systems recipes + canCraft + executeCraft (the helper
 * App wiring is meant to call, which also reports the owned tool),
 * ProximityHarvestButtons subscribed to 'harvest:inRange' with
 * world-to-screen projection, and the CameraTransition overlay on
 * 'camera:switched'.
 *
 * WHAT IS DELIBERATELY NOT HERE (read before extending):
 * - Harvest outcome: the shell owns exactly ONE outcome listener
 *   (createHarvestOutcomeListener, boot effect, disposed on
 *   unmount — a second one would double-grant). It is fed the
 *   shell's inventory and the owned-tool tier query, so presses
 *   resolve through Background's outcome order (range re-check,
 *   permit, multi-step progress, yields, capacity, depletion).
 *   Feedback below renders ONLY what those events carry:
 *   'harvest:completed' yields as carried, 'harvest:failed'
 *   reasons as carried (with attempted yields named on
 *   'inventory-full' only, as the event defines), and
 *   'harvest:progress' fractions, press counts, verbs, and
 *   struggle/success lines as carried. Nothing here
 *   invents a yield, a reason, or a progress value.
 * - Station presence: stationPresence (on the current
 *   generator at her position) carries TWO booleans —
 *   stump in range = workstation, placed loom in range =
 *   loom — and serves the station anchor (and, through
 *   the memo below, availableStations) now; its HUD
 *   presence card (StationPanel) retired 2026-10-31
 *   (dialog audit claim 2). Crafting's station feed is the
 *   FACED target (the USE winner), not presence: Adam's
 *   station law retired the radius feed whole (see the
 *   derivation's own comment). Background's presence
 *   cleanup (c5192c0) removed the litFire fact, the
 *   litFireInRange query, and the single-context mapper
 *   whole — no fire fact rides presence at all. The raw
 *   generator is used because stumps are never depleted,
 *   so it gives the same stump set as the renderer's
 *   depletion-wrapped generator.
 * - Inventory capacity (Adam, 2026-10-27): weights pinned —
 *   pockets base 10, apron +10, small basket +25, large
 *   basket 50, Trundle-Tool +50, additive. Large basket
 *   REPLACES the small basket's +25 — question CLOSED
 *   on Adam's 2026-10-27 "for simplicity" ruling (final
 *   state; provenance: 10-26 replace pin → 10-27 open
 *   note → 10-27 replace ruling): pockets 10 + apron 10
 *   + large 50 = 70 with the large basket (not 95);
 *   Trundle-Tool's +50 still adds on top (full kit 130
 *   lb with worn clothes). The shell constructs
 *   PersonalInventory with largeBasketMode 'replace' —
 *   the settled mode, matching Systems.
 * - Remove option (Adam, 2026-10-26): alongside normal harvest,
 *   she may TOTALLY REMOVE a plant — more resources at once, but
 *   the plant is gone permanently (no regrow), for clearing
 *   ground for a house. Wired to Background's documented shape
 *   (2003619): a remove press is 'harvest:requested' with action
 *   'remove' — same event, not a second channel. The outcome
 *   grants primary base x 3 + bonus roll + all secondaries, and
 *   marks the plant removed permanently. The offer is
 *   pre-judged at projection (the Remove offer's honesty,
 *   2026-10-31, superseding the 2026-10-26 outcome-time
 *   reading): HarvestTarget.removable is minted from
 *   SOURCE_BY_ID, and no Remove renders or arms (pill, R,
 *   Shift+E) for ground targets or ground-class scatter
 *   (logs, stones, bone, salt, silt, anchors). The engine's
 *   'not-removable' outcome stays as backstop and speaks
 *   one honest line if it ever lands. The "Remove" label
 *   is the lane's pick, flagged, not pinned. Feedback for
 *   a remove completion shows the yields exactly as
 *   carried, like any harvest.
 * - Owned tool (Adam correction, 2026-10-26 — owning is
 *   sufficient, no equipping): there is no held/equipped slot.
 *   The owned tool is the highest-stage ladder tool present in
 *   inventory ('none' when none), read fresh via owned-tool.ts.
 *   Crafting a ladder tool owns it by putting it in inventory;
 *   upgrading advances the owned tier by consuming its
 *   predecessor. A failed craft touches neither inventory nor
 *   owned tier. The HUD shows the owned tool from inventory,
 *   not from an invented slot.
 * - Controllers untouched: no renderer/player edits in this round
 *   (facing ease and any controller change need a separate claim).
 *   The camera geometry below replicates the renderer from player
 *   state because the renderer keeps its camera private; see
 *   src/ui/worldProjection.ts — a future renderer accessor would
 *   replace that replication.
 * - Health and ambience: WitchHealth stays unwired (no value, so it
 *   renders its awaiting note); Effects.tsx / useAtmosphere.ts stay
 *   unimported.
 * - Hunger indicator, LIVE (Adam, 2026-10-26): the shell owns
 *   one HungerState (starts fully fed) and ticks it in real
 *   seconds (1 s interval, disposed on unmount). The stage
 *   feeds three places from the one meter: HungerIndicator
 *   (stage prop, so the awaiting note is gone and the
 *   too-hungry hint line shows only on a real too-hungry
 *   stage), the player's hunger-stage query (movement
 *   slowdown), and the harvest outcome listener's hunger
 *   query (too-hungry harvest lockout except exempt sources).
 *   Crafts pass the meter to executeCraft, so the too-hungry
 *   crafting lockout bites (a blocked craft reports hunger in
 *   the craft note; the menu itself does not pre-block, since
 *   canCraft carries no hunger gate — pressing Craft while
 *   too-hungry yields the honest error, not a silent no-op).
 *   EAT BUTTON, LIVE (gap-closing round): inventory rows for
 *   foods gain an Eat button (same row-button pattern as
 *   Place). Berries and cooked acorns eat through Systems'
 *   eat() — one item, nutrition from its table (berries 15 /
 *   20, cooked acorns 25, Adam's 2026-10-27 +5 bump), stage
 *   refreshes at once. Raw acorns never reach eat(): their press shows
 *   the cook-first note and consumes nothing (eat() itself
 *   would refuse with a stale "future fire system" message —
 *   the fire system exists now, so the shell says so in its
 *   own words). Eating is never hunger-gated (it is the
 *   recovery action). Hunger is not health: WitchHealth is
 *   untouched.
 * - FIRE UI, LIVE (Adam, 2026-10-26): placement + lighting
 *   are wired to the engine's placed-fire machine. A carried
 *   fire item (campfire / hearth / kiln, crafted
 *   through CraftingMenu) gains a Place button in the
 *   inventory panel; pressing it opens placement mode with
 *   the PlacementPreview ghost at her feet (free placement,
 *   no zones/plots — she walks anywhere, places there), and
 *   Place here drops the fire at her position AND consumes
 *   the carried item (the engine primitives are cost-free,
 *   so UI-side consumption is the gating — placing without
 *   it would duplicate the item). Campfire is the exception:
 *   single-tap (Adam, 2026-10-28) — its Place press places
 *   instantly at her feet, no mode, no ghost, no panel;
 *   hearth/kiln keep the flow above. Every placed
 *   fire gets an
 *   anchored FireState chip (unlit / lighting / lit, with
 *   click count or friction phase); tapping an unlit fire
 *   opens its lighting menu (ContextMenu): flint (disabled
 *   without a carried flint — the engine leaves flint
 *   possession to the caller) or friction (rub, wait,
 *   rub — the 1 s game clock advances the wait to ready).
 *   No flame mesh is duplicated (3D flames are Background's
 *   renderer). COOK BUTTON, LIVE (gap-closing round, DEV
 *   bridge decision): a lit fire's chip opens a cooking
 *   menu — Cook acorns (stick) / Cook acorns (buried), one
 *   acorn per press, quantity preserved 1:1, disabled
 *   without carried acorns. THE BRIDGE (shell-owned, see
 *   getSystemsFire / ensureSystemsLit): one Systems
 *   FireState per placed fire; engine lit is the gate and
 *   the authority — the shell records the lighting path at
 *   the start, the vessel waits unlit, and a Cook/Char
 *   press at the lit fire syncs the vessel by ADOPTION
 *   (FireState.adoptLit: cost-free, never throws), so
 *   cook() never runs against a vessel the engine hasn't
 *   lit and a lit fire always serves. The priced light()
 *   is never called to mirror an engine fire — no second
 *   kindling is ever charged for a fire the world already
 *   lit (VESSEL SYNC, DEV ruling 2026-11-01; the pre-sync
 *   bridge completed vessels through the priced light()
 *   and refused Cook/Char at kindling-less friction
 *   fires). Cooking stays open-fire
 *   (stick or fire-buried, never pot cooking). CANDLE NOTE:
 *   the avatar / portrait candle is untouched, and nothing
 *   here assumes the candle lights fires — that relation
 *   is flagged open for Adam's call.
 * - TORCH, LIVE (Adam, 2026-10-27 — DEV brief, all three
 *   lanes): torch item + hand recipe (snap-wood 1 +
 *   twined cordage 1 + dry kindling 1, DRAFT quantities
 *   for the pin pass) + Systems batch lighting
 *   (systems/torch.ts lightTorches: ONE press lights
 *   EVERY carried unlit torch — at a lit fire, or with
 *   carried flint + river-stone, both kept; no burnout,
 *   no duration, no chain-lighting, all Adam-pinned).
 *   Inventory torch rows gain a Light button (the FLINT
 *   route only — no invented "nearby fire" range; the
 *   fire route is UI's lit-fire 'light torches' pill
 *   (TORCH PILL bullet below), whose host menu already
 *   opens in every state since UI's lit-menu fix fe7b304). Carried torch light
 *   itself is Background's (Adam: well-lit to 6 m, dim to
 *   at least 12 m, torch stays brighter than the candle —
 *   exact values theirs, above the candle's new 30/22
 *   from Fill-in 2766045; the starting candle already
 *   went brighter, tuned together). Placeable candles NOT
 *   in this order. App + InventoryPanel + systems only;
 *   no game edits.
 * - SHELTER UI, LIVE (Adam, 2026-10-26): house recipes
 *   (lean-to, thatch hut, woven cottage, small wooden hut)
 *   are craftable through CraftingMenu, and a carried house
 *   item gains the same Place button + preview + Place here
 *   flow as fires (merged cottage stage: both recipe items
 *   place a woven cottage). The sheltered indicator reads
 *   the engine's live shelter tracking: shelter:changed on
 *   movement, plus a direct recompute on placement (placing
 *   at her feet does not move her, so the movement tracker
 *   alone would lag) — "Sheltered at {house}" within 6 m
 *   of a placed house, "Unsheltered" otherwise. Placement
 *   is free (no zones/plots) and the preview carries no
 *   plot frame. HOME STORAGE TRANSFER, LIVE (gap-closing
 *   round): while sheltered at a placed house, the inventory
 *   panel gains a "Home storage — {house}" section (the SAME
 *   panel pattern, not a second panel) with the house's
 *   stored rows + Withdraw buttons, and Deposit buttons on
 *   the personal rows. One item per press; add-first
 *   ordering on both directions, so a full destination
 *   throws and the source keeps its item. One HomeStorage
 *   per placed house, created lazily; the shell tracks only
 *   the stored id universe (HomeStorage exposes counts,
 *   not a snapshot). Unsheltered = no section, no Deposit
 *   buttons — storage is reached at home, not from afar.
 * - UMBRELLA GRAPHIC (Adam, 2026-10-26): UmbrellaIcon is a
 *   scalloped moss-canopy glyph in the directory's inline-SVG
 *   pattern, rendered through caller-supplied icon slots —
 *   InventoryItem.icon, CraftingRecipe.icon, and
 *   RecipeIngredient.icon — so the umbrella shows its glyph
 *   in the inventory panel and the crafting menu (as a
 *   crafted output or an ingredient) wherever it appears.
 *   App maps Systems' item id (see UMBRELLA_ITEM_ID above)
 *   to the icon in both places. The worn/clothes display
 *   carries a permanent Umbrella row in the WornList
 *   (carried / not owned, no button — it is carried, not
 *   worn), and its precipitation effect folds into the
 *   Protection line's rain figure through Systems'
 *   applyUmbrellaToPrecipitationRemaining (the separate
 *   umbrella note line retired 2026-10-29 on Adam's word
 *   — one home per fact; the constant is 60%
 *   precipitation, a starting value for his pin pass,
 *   not pinned — revised from 35% rain-only) — the UI
 *   holds no rain table of its own.
 *   No separate umbrella panel is built, per the brief;
 *   the icon and the row ride existing surfaces.
 * - LOOM PLACE, LIVE (gap-closing round, presence b39f0aa):
 *   a carried loom item gains the same Place button +
 *   preview + Place here flow as fires and houses (free
 *   placement, consumes the carried item), dropping a
 *   loomState loom at her feet. Station presence: the memo
 *   reads both presence booleans directly (stump = workstation,
 *   placed loom within 2.5 m = loom) — so garment recipes
 *   (station 'loom') become craftable standing at a placed
 *   loom. WART RESOLVED (loom-wiring round): the
 *   old single context read 'loom' whenever a loom was
 *   near, so workstation recipes mismatched at a dual site
 *   — the shell now carries BOTH presence booleans, ORs
 *   craftability over every present station, passes the
 *   whole array to executeCraft (already set-based), and
 *   the menu names the nearby stations. The engine
 *   presence shape is unchanged.
 * - CLOTHES UI, LIVE (Adam, 2026-10-26): the shell owns one
 *   Wardrobe; the HUD wardrobe lists all five garments with
 *   Wear (carried) / Remove (worn) buttons, and both note
 *   lines from their own sources. CORRECTION to the earlier
 *   landing's divergence flag: the brief's hat +1, shawl +3,
 *   cloak +6 are PINNED worn CARRYING bonuses (Systems'
 *   Wardrobe.wornCapacityBonus; mittens +0, boots +0) —
 *   a separate axis from the engine's weather percentages
 *   (cloak rain 40% / wind 30%, shawl cold 30%, Pointy Hat
 *   rain 15%, Mossy Mittens cold 15%, bog boots wet 40% +
 *   bog-travel mitigation, lane-decided for pin pass). The
 *   UI shows both, each from its source, and holds no table
 *   itself. Wearing does not consume the garment; capacity
 *   follows via inventory.setWorn after every wear/remove.
 *   LOOM GAP, CLOSED (gap-closing round, presence b39f0aa):
 *   garment recipes carry station 'loom', and placed-loom
 *   presence now exists — a placed loom within 2.5 m reads
 *   as station 'loom' through the existing station memo, so
 *   garments are craftable standing at a placed loom (see
 *   the LOOM PLACE bullet; the stump+loom wart is resolved
 *   there).
 *
 * - TOUCH CONTROLS, LIVE (phone build, Adam 2026-10-26):
 *   coarse-pointer devices render TouchControls (visible MOVE
 *   ring + knob pulsing until first use, DRAG TO LOOK cue until
 *   the first look drag, 64 px USE button) under the z-30 HUD,
 *   so world buttons stay tappable over the look field. HUD
 *   starts COLLAPSED on touch (the game leads; one tap shows
 *   the panels, one tap hides them again) and the slim bar
 *   keeps Show HUD + Inventory + Crafting + camera tappable;
 *   panels become a bottom sheet (max 60vh, scrollable) and
 *   panel/HUD buttons go thumb-sized (44 px) — all keyed off
 *   touch detection only, so desktop rendering is unchanged.
 *   Portrait AND landscape both work (no landscape-only
 *   ruling imported). No sprint, no jump: the stick is walk
 *   only. USE / still-tap interacts with the nearest
 *   in-range object (scatter preferred over the ground the
 *   tracker emits first); a look drag never fires interact
 *   on release. ENGINE SEAM (Background's 50f5cd6, player.ts
 *   only, landed mid-round): the shell wires straight to
 *   setThumbstick(x, z) (same movement path as keys, analog
 *   magnitude = proportional walk, never sprint), addLookDelta
 *   (shared mouse-look math + throttled player:looked emit,
 *   no mode or pointer-lock gate by design), and pressUse
 *   (fires the existing harvest:requested event). No shell
 *   bridges remain: no key synthesis, no yaw/pitch writes
 *   from the shell, no game file touched by this lane.
 *   SQUISH + SCROLLBARS FOLLOW-UP (Adam 2026-10-26: "squish
 *   it for phone, put in scrollbars"): the touch stack
 *   reserves 18rem (needs row + thumbstick clearance) so an
 *   expanded tall stack never slides under the stick; both
 *   touch scroll containers carry a visible thin scrollbar
 *   (webkit styled thumb, firefox thin + colours — iOS
 *   Safari keeps overlay scrollbars, platform limit); and
 *   ContextMenu gains a 70vh bound + scroll (overflow-only,
 *   no change when it fits). Panel density is deliberately
 *   unchanged — thumb targets outrank density on phone.
 * - OPTIONS MODAL, LIVE (Adam, 2026-10-26): a tabbed modal
 *   (Settings first; the tab bar is a scaffold for later tabs,
 *   none invented here) holding exactly one setting — the UI
 *   font dropdown (IM Fell English by default, then Alegreya,
 *   EB Garamond). The choice persists in localStorage under
 *   its own settings key, never the Systems save file, and
 *   replaces font-mono on the App root, so it restyles the
 *   whole 2D UI with a serif fallback if a webfont fails; it
 *   never touches the 3D canvas. All three families load via
 *   Google Fonts (display=swap); browsers only download the
 *   family actually used. Opened by an Options button beside
 *   Inventory/Crafting in the stack and in the touch slim
 *   bar; closes via X, backdrop tap, or Escape. The panel is
 *   a bottom sheet on touch (bounded, scroll inside) and a
 *   centred card on desktop, per the phone-HUD rules.
 * - LOCATION CHIP, LIVE (Adam, 2026-10-26): a small
 *   translucent bottom-centre pill — dominant biome + percent,
 *   player position, zone coords (2026-10-28, below),
 *   and FPS — rendered outside the
 *   collapsible HUD stack, so it stays visible with the HUD
 *   collapsed on touch (collapse hides panels, never this
 *   chip). It hides only while a panel or the modal is open,
 *   where it would sit on the bottom sheet. Position reuses
 *   the shell's tracked coords; the biome is the engine's
 *   dominant id + its weight from the same ground weights
 *   the scaffold readout formats. FPS is shell-side rAF sampling (~1 update per
 *   second, never per frame; each window publishes its
 *   average AND its worst frame gap, hidden-tab windows
 *   marked interrupted rather than dropped),
 *   not a renderer instrument — the renderer is untouched.
 *   The pill is pointer-events-none and lives in the bottom
 *   ~36 px, clear of the stick and USE buttons (which end
 *   96 px up) and of the top HUD bars; desktop gets the same
 *   chip, small and unobtrusive, and is otherwise unchanged.
 * - TURNING FIX, LIVE (Adam, 2026-10-26): first-person
 *   turning could not happen on a portrait phone because the
 *   expanded touch stack (max-w-sm ≈ full phone width, z-30)
 *   sat over the look field (right half, z-20), and an open
 *   bottom sheet (60vh) plus the stack together covered the
 *   full height — no open world left to drag on. Two changes,
 *   both size/placement, no z-order hack, no panel behaviour
 *   change: (1) the expanded touch stack is capped at
 *   max-w-[46vw], so the right half stays open world in every
 *   touch state (desktop keeps max-w-sm); (2) Hide HUD —
 *   already a fixed top-right control outside the stack and
 *   the sheets (z-40, visible in every expanded state) — now
 *   also closes all panels, so one tap fully reclaims the
 *   look field. Panel taps and scrolling are untouched
 *   (pointer-events-auto + overflow-y throughout, 44 px
 *   targets kept). Per-state look geometry: collapsed, no
 *   panels — right half free except the slim bar + corners;
 *   collapsed + sheet — middle band free, sheet Close one
 *   tap; expanded, no panels — right half free; expanded +
 *   sheet — right half upper 40% free, Hide one tap; a
 *   perspective switch with panels open strands nothing
 *   because Hide stays visible above the sheet. The one
 *   exception is an open modal (z-50), which closes in one
 *   tap via its X or backdrop. Look deltas are direction-
 *   neutral (addLookDelta gateless both ways), so left and
 *   right turn symmetric once the field is uncovered.
 * - TURNING FIX, PART 2 — TOUCH SENSITIVITY (Adam, 2026-10-26):
 *   Adam's answers (no panels open, three worlds, fresh drag
 *   failing) killed panel coverage as the whole story, so the
 *   no-panels path was probed: handlers verified correct
 *   (start/move/end/cancel all guard the touch id, deltas
 *   fire every move, no bounds check, applyTouchLook gateless,
 *   engine yaw -= dx * 0.0025); collapsed/no-panels coverage
 *   audited (nothing over the right half — slim bar top strip
 *   only, HudShell needs div null when collapsed, empty panels
 *   column zero-height, chip + transition pointer-events-none,
 *   WorldAnchor pointer-events-none except small button rects);
 *   stuck-id cleared (end + cancel both clear on matching id,
 *   stick/look separated by id, no remount path). What
 *   reproduces is sensitivity + right-edge travel: 40 px =
 *   5.7°, 60 px = 8.6° at mouse sensitivity, and a right-drag
 *   from a natural thumb start caps at ~90 px (12.9°) where a
 *   left-drag reaches 300 px (43°). Fix: shell-side
 *   TOUCH_LOOK_SCALE = 3 (effective 0.0075 rad/px, engine
 *   mouse sensitivity untouched, pitch clamp still applies):
 *   40 px = 17°, 60 px = 26°, max-right 90 px = 39°.
 *   Lane-decided starting value for Adam's pin pass.
 * - BEHIND CAMERA, LIVE (Adam, 2026-10-26): a third player-chosen
 *   perspective — over-shoulder follow. The camera sits 3.5 m
 *   behind her facing at 2.4 m height, looking at a point 4 m
 *   ahead at 1.2 m (BEHIND_* tunables in constants, starting
 *   values for Adam's pin pass): her back in frame low, the
 *   view ahead dominating — not the +16 m overhead, not ground
 *   level. V/C cycles first → third → behind; the CameraToggle
 *   picks directly (the shell steps the engine toggle forward
 *   to the picked mode, since one toggle is one step). Facing
 *   rule (behind view only): movement is yaw-relative, which
 *   is facing-relative because look-drag syncs facing to view
 *   direction in behind mode (player.ts); the camera follows
 *   behind facing, so standing-still looks turn the view.
 *   Third-person overhead stays world-aligned; its ground
 *   fallback rule (ground only when no scatter in range)
 *   covers behind too via the tracker's non-first branch.
 *   Witch mesh visible in behind (and third), hidden in first.
 *   Desktop mouse-look stays first-person-only (pointer-lock
 *   gate untouched): desktop behind turning works via walking
 *   plus V/C. FLAG, pre-merge Systems follow-up (not this
 *   lane's file, deliberately untouched): save validation
 *   still accepts only first/third — a save made in behind
 *   mode reloads as a fresh start until Systems accepts
 *   'behind' in deserializeSave. Do not merge this view to
 *   main until that one-liner lands.
 * - TURN STICK, LIVE (Adam, 2026-10-26, his direct order after
 *   a playtest): a second joystick for turning, like the move
 *   stick. The x3 drag fix treated perception, but Adam's real
 *   problem was travel: his thumb rests near the right edge
 *   (~half an inch of right travel), and a center-started drag
 *   misses or clips the right-half look field. The stick is
 *   bounded by its own radius, not the screen edge, and it is
 *   rate-based: hold it deflected and the view keeps turning
 *   (full deflection 1200 drag-px/s = 3 rad/s, TURN_STICK_
 *   PX_PER_SEC, starting value for his pin pass) — no more
 *   re-sliding for a big turn. Placement: 128 px ring above
 *   USE, bottom-right (16 px gap), same pulse-until-first-use
 *   pattern as MOVE with a TURN label; rendered after the
 *   look field so its touches land on the stick. The shell
 *   holds the deflection in a frame loop feeding the existing
 *   addLookDelta — no engine change, no game/systems files.
 *   Drag-look, the move stick, and USE are unchanged; the
 *   stick and look track separate touches, so all three can
 *   run at once.
 * - SCREEN-FIXED HARVEST BUTTONS, LIVE (Adam, 2026-10-26):
 *   proximity buttons no longer ride WorldAnchor projection
 *   (they slid up behind screen UI as the camera moved).
 *   They now render as one column fixed just above screen
 *   middle (bottom edge at 52% of view height, growing
 *   upward, scrolling past 40vh), in passed order — ground
 *   first when eligible (at her feet, so nearest), then
 *   scatter by distance; no re-sort, and HarvestTarget
 *   carries no distance field. Each button already names
 *   its target (verb + name); buttons are now thumb-sized
 *   (min 44 px tall). Remove stays stacked under Harvest
 *   for scatter only, never for ground. LAYERING: the
 *   buttons live in their own z-40 overlay — above panels
 *   (z-30), below modals (z-50); a z-40 child inside the
 *   z-30 world overlay would still paint under the panels.
 *   STATION ANCHOR (Adam, 2026-10-28, reading (b)): at a
 *   station the column instead anchors above that station's
 *   projected center (same z-40 overlay, never z-30);
 *   away from stations it stays screen-fixed as above.
 *   Target data and harvest behavior are unchanged;
 *   position only. NOTE: the targets' anchorX/anchorY are
 *   no longer consumed by the buttons (the shared projection
 *   pass still computes them for fire/placement anchors);
 *   removing harvest projection is a follow-up cleanup.
 * - PILE PICKUP BY USE, LIVE (Adam, 2026-10-26): no new buttons,
 *   no new screen — the touch USE press picks the nearest
 *   in-range pile when no harvest target is nearer, emitting
 *   'pile:pickup-requested' { pileId } (the channel's pile
 *   field is 'item', not 'itemId' as the brief's shape said).
 *   The pile wins on a tie with the harvest candidate (none
 *   is NEARER then); ground sits at distance 0, so a pile at
 *   her feet ties ground and wins, a farther pile loses to
 *   it. Harvest behavior is otherwise unchanged — the same
 *   scatter-first candidate, the same pressUse path, and
 *   with no pile in range USE behaves exactly as before.
 *   Systems' listener owns the grant now (systems/piles.ts
 *   handlePilePickupRequest, landed on DEV's bridge-out
 *   signal): the WHOLE pile, kinds in stacks order,
 *   partial by weight (remainder stays), then refresh +
 *   save + feedback; missing pile grants nothing, full
 *   pack takes nothing + note. Touch USE and the desktop
 *   button emit the same event to that one listener, so
 *   the grant matches on both (desktop/phone parity,
 *   Adam 2026-10-27); if piles should outrank ground
 *   outright, that is a one-line priority change for
 *   Adam's call.
 * - PILE BRIDGE OUT (DEV sequencing plan, 2026-10-26): the
 *   shell's 'pile:pickup-requested' grant bridge is removed
 *   (App.tsx only). The touch USE handler STILL emits
 *   'pile:pickup-requested' { pileId } — the emit stays, only
 *   the shell granter goes. GAP CLOSED by Systems' listener
 *   landing the same day (DEV's bridge-out signal): the emit
 *   has a granter again. Two granters
 *   on one event would double-fire feedback and saves, so
 *   the listener must never land while the bridge lives.
 * - STUMP INDICATION, LIVE (Adam, 2026-10-26): a
 *   workstation-gated recipe that cannot be crafted for
 *   station reasons now reads "Needs a tree stump to work
 *   at." — retiring "Needs a workstation station.", which
 *   named no stump at all. Requirement display only, in the
 *   shell's availabilityNote (App); no game/systems file
 *   touched, no presence-kind plumbing added — presence is
 *   booleans only, so the shell cannot split stump from
 *   crafted workstation or Stumpy upgrade. Other stations
 *   keep the old template. HEADER FIX (2026-10-28, Adam-
 *   approved): the menu header now names the stump —
 *   "Nearby stations: tree stump, loom" — by mapping
 *   the workstation context to "tree stump" at the
 *   display step ONLY (availableStations keeps the
 *   'workstation' id for canCraft; presence comes
 *   solely from stumps today, so the name is truthful).
 *   FOLLOW-UP, NOT CHANGED: when presence learns kinds,
 *   the station naming follows the kind (the fold
 *   dialog's heading carries stump naming today).
 * - STATION UI V1, LIVE (Adam, 2026-10-26): when she is at a
 *   stump, a station panel appears in the HUD stack naming it
 *   ("Tree stump") with one action: Craft, which opens the
 *   crafting menu (already station-aware, so opening it at a
 *   stump IS opening it with the stump active; no filtering
 *   added, loom/hand recipes stay visible). The panel is a
 *   capability list (StationPanel takes stationKind + an
 *   actions array), so Move joins later as a second entry
 *   without restructuring — Move is NOT built here and
 *   nothing gates on tools she does not have yet. TRIGGER:
 *   presence, not USE — the panel renders when workstation
 *   presence is true and hides when she walks away, so
 *   harvest USE is untouched by construction and no press is
 *   swallowed. KIND NOTE: presence is booleans only and
 *   workstation presence comes solely from stumps today, so
 *   'stump' is the kind passed; the component maps all three
 *   brief-named kinds (stump / workstation / Stumpy) so the
 *   title follows from a prop when presence learns kinds.
 *   RETIRED 2026-10-31 (dialog audit claim 2): the fold
 *   (merge #41) gave the stump a better door — the dialog
 *   E/K and the chip open — and this presence card's one
 *   act duplicated it, so the card and StationPanel are
 *   deleted; the stump's one door is the dialog.
 * - INVENTORY DROP, LIVE (Adam, 2026-10-26 — "for next
 *   pass", arrows 2026-10-28): every personal inventory
 *   row gains ↓ drop-one + ↓↓ drop-all arrows (storage
 *   rows never get one), both dropped at her feet as a
 *   ground pile in the same pile system as overflow —
 *   merges by item at the same spot, pick-up-able later
 *   via the pile USE trigger. Shell wiring: Systems'
 *   dropFromInventory(item, quantity) validates + removes,
 *   then the shell hands the record to pileState.drop()
 *   (no pileState.spawn exists; drop() is the spawn
 *   equivalent and emits pile:dropped for tracker +
 *   renderer). A failed drop leaves the inventory exact
 *   (Systems builds the record before removing; remove()
 *   throws before mutating). Dropped piles ride the
 *   pending pile save wiring; no separate save handling
 *   invented. Worn-gear rows never reach the Drop arrows
 *   (worn-gear landing); carried-unworn garments drop
 *   without unwearing (mirroring deposit: bonus
 *   self-cancels at count 0, returns on pickup).
 * - BELOW-PERMIT WORDING, LIVE (Adam, 2026-10-26 — "below
 *   permit" too vague): a below-permit harvest failure now
 *   reads "Needs {Tool}." (e.g. downed oak → "Needs
 *   Axe-Trowel.") instead of "Harvest failed: below-permit."
 *   The failed event carries no permit info, so the shell
 *   reads the source's permitTier from SOURCE_BY_ID and maps
 *   the tier to its tool item for displayNameFor; a lookup
 *   miss falls back to the old wording. Other failure
 *   reasons untouched; 'permit-tbd' stays as-is (no tool
 *   decided there yet). App.tsx only.
 * - PERSPECTIVE IN OPTIONS, LIVE (Adam, 2026-10-26 — the
 *   toggle group obscured the harvest buttons): the
 *   CameraToggle group is OUT of the HUD stack row and OUT
 *   of the touch slim bar entirely, and lives as a
 *   "Perspective" section in the Options modal's Settings
 *   tab (a display preference beside the font — no new tab
 *   for one control; the existing toggle component is
 *   reused). App passes cameraMode + cycleToCamera through
 *   new optional modal props; the section hides if no
 *   perspective is passed. The toggle row wraps (flex-wrap)
 *   so the long "Third-person overhead" label fits the
 *   narrow touch bottom sheet. Slim bar is now Show HUD,
 *   Inventory, Crafting, Options; stack row is Inventory,
 *   Crafting, Options. The header readout still names the
 *   current view in text.
 * - DEPENDENCIES DISPLAY, LIVE (Adam, 2026-10-26 — "make sure all
 *   dependencies are listed in the crafting ingredients"): every
 *   recipe row now lists its dependencies after its ingredients —
 *   upgradeFrom as "Upgrades from: {name} {held} / 1" (either/or
 *   spade-axe: "Upgrades from: Spade or Axe-Trowel", held 1 if
 *   either held else 0) and requires as "Requires present:
 *   {name} {held} / {qty} (kept, not used up)". App mapping
 *   only — no CraftingMenu change (rows are data-driven), no
 *   recipe/execution change, and the predecessor is NOT added
 *   to recipe.ingredients (execution removes ingredients AND
 *   upgradeFrom separately — listing it there would consume
 *   it twice). Station is not an ingredient line.
 * - CRAFTING GROUPS, LIVE (Adam, 2026-10-26 — "group the
 *   crafted items on the crafting screen"): SECTIONS in one
 *   scroll, NOT tabs (the phone sheet already scrolls;
 *   sections keep everything visible). 45 recipes, 6 groups
 *   in this order — Tools, Homes, Fire & Workshop, Clothes,
 *   Materials & Carrying, Traps — order within a group is the
 *   current recipe order, empty groups never render.
 *   CraftingMenu gains an optional `sections` prop (flat list
 *   unchanged when absent; one shared row renderer, so
 *   grouping changes layout only); App owns the UI-side
 *   id→group map — no Systems file touch, no recipe field,
 *   canCraft/execution untouched. Unmapped recipes would
 *   trail under "Other" rather than vanish (none today).
 * - CRAFTING FILTER + FACED-TARGET STATION FEED, LIVE
 *   (Adam, 2026-10-30: "we need to filter our crafting
 *   recipes based on station. Hand crafting would always
 *   be available, but loom crafting would not be available
 *   at a workstation or cauldron, and vice versa"): the
 *   panel shows ONLY hand + unstated recipes and the
 *   recipes of stations currently fed — absent-station
 *   recipes do not appear at all (not greyed; gone), and
 *   sections render only for visible sets. The ownership
 *   sink partitions the VISIBLE set (filter first): a
 *   superseded recipe at an absent station hides with
 *   its station and stays out of the trailing 'Owned &
 *   Superseded' block until its station returns. FEED
 *   (final shape, Adam 2026-10-30): radius presence is
 *   retired for EVERY station — availableStations
 *   derives ENTIRELY from her FACED TARGET (the USE
 *   winner, one target at a time; his reason: radius
 *   "will simply cause gobs of action pills to appear"
 *   at camps with clustered stations). Faced stump ->
 *   'workstation' (stumps read in the winner as kind
 *   'site', siteId 'stump:<x>,<z>'); faced lit fire ->
 *   'fire' (any type — a faced lit kiln feeds
 *   charcoal), faced lit kiln -> 'kiln' as well; nothing
 *   faced -> hand only. 'Cauldron' keys on the placed-
 *   cauldron target (Adam: "Cauldron would go on the
 *   Hearth, not the kiln. And facing the Cauldron is
 *   different from facing the Hearth") — the pot is a
 *   winner target of its own (kind 'cauldron', identity
 *   = its hearthId, outranking its own hearth at the
 *   tie) and feeds 'cauldron' when its hearth is lit
 *   (placed-cauldron UI half, #30). The carried-pot
 *   composition is dead and built nowhere. The LOOM joined the
 *   winner race in the same landing (kind 'loom', the
 *   placed-object idiom; its pill reads WEAVE (Adam,
 *   2026-10-30: "What do we do at a loom? We weave,
 *   right?") and its
 *   press opens the Crafting panel — the pill is its
 *   door), so 'loom' feeds from its faced target like
 *   every other station: no station is dark.
 *   executeCraft receives
 *   the same list, so a recipe is craftable exactly
 *   when it is visible. The
 *   whole derivation sits BELOW the useWinner call in
 *   the component body (relocated 2026-10-30 — it reads
 *   the winner, and the winner's own dependency cluster
 *   lives below the derivation's original home).
 *   Grouping rider: the fire/cauldron recipes
 *   (charcoal-stick, render-tallow, the two candles)
 *   map to 'Fire & Workshop' — no "Other" tail for the
 *   set. Descriptors ride the rows, so the candle /
 *   charcoal blurbs read at the station where the
 *   recipe lives.
 * - PAUSE UI HALF, LIVE (Adam, 2026-10-26 — core 54e525c, DEV
 *   brief): the shell gates its timers on 'game:pause-changed'
 *   via a pausedRef (intervals/rAF close over the ref, never
 *   state) + a paused state driving a small "Paused" badge
 *   (new PausedIndicator, viewport-centred,
 *   pointer-events-none, badge only). Gated: the 1 s hunger
 *   timer (hunger.tick + advanceLighting + Systems fire ticks
 *   — the 25 s friction wait no longer flips to 'ready'
 *   mid-pause), the turn-stick rAF loop (still schedules, no
 *   delta applied, no dt jump on resume), and the FPS sampler
 *   (paused frames discarded, fresh sample on resume).
 *   Deliberately NOT gated: feedback-chip timeouts (transient
 *   UI, expiry mid-pause loses nothing). NO trigger wiring
 *   here — no visibilitychange/blur listener, no auto/tap
 *   resume; triggers plug into setPaused only after Adam
 *   answers. Until then the badge is dormant (nothing sets
 *   the flag yet) and the gates stand ready.
 * - PAUSE COMPLETION, LIVE (Adam, 2026-10-26 — both answers
 *   now pinned; SUPERSEDES the dormant note above): resume is
 *   TAP-TO-RESUME — the indicator is now a button reading
 *   "Paused — tap to resume" and tapping it calls
 *   pauseState.setPaused(false) (idempotent, so a stray second
 *   tap emits nothing). And the trigger is wired: window blur
 *   OR document hidden sets paused=true ("Switching Windows
 *   should pause the game. If it's not playable, it should
 *   pause"). NO auto-resume anywhere — focus/visible return
 *   deliberately clears nothing; only the button resumes.
 * - PILE SAVE WIRING, LIVE (Adam, 2026-10-26 — DEV brief,
 *   merge #5 on hold until everything is built; multi-kind
 *   2026-10-27): piles are no longer session-only. saveNow
 *   passes pileState.snapshot() (stacks + position, no id
 *   in the document) as draft.piles, so serializeSave
 *   writes them normalized, order preserved, never merged;
 *   boot restore, inside the saveRestoredRef guard after
 *   the renderer exists, drops each saved KIND back
 *   through pileState.drop() (merge-safe by coords, emits
 *   pile:dropped/pile:changed for tracker + renderer
 *   visuals; the 100 ms moved tick then surfaces in-range
 *   piles). The guard also protects against a double
 *   restore doubling quantities (drop merges by coords).
 *   Regenerate clears piles via setWorldGen and the next
 *   save snapshots the empty set — a new world is a new
 *   pile set, by design. Old single-kind saves migrate on
 *   read (grouped by rounded coords, kinds in saved order,
 *   nothing dropped); saves without piles load piles: [].
 * - DESKTOP PILE PICKUP, LIVE (Adam, 2026-10-26 — DEV brief,
 *   second of two; SUPERSEDES the desktop limit in PILE
 *   PICKUP BY USE above): desktop gets a visible button —
 *   the brief's preferred path over a key, for
 *   discoverability. It renders in the z-40 harvest overlay,
 *   just below the harvest column (top 54%, centre, min
 *   44 px, black/60 pill), only on desktop (touch keeps
 *   USE) and only when the nearest pile would win under
 *   the touch USE rules: piles are already tracker-sorted
 *   nearest first within 2.5 m, and the button shows only
 *   when pile.distance <= the harvest candidate's distance
 *   (bus distance, shell-computed fallback; ground at 0, so
 *   a pile at her feet ties ground and wins). Pressing it
 *   emits the same 'pile:pickup-requested' { pileId } the
 *   touch USE press emits — Systems' listener is still the
 *   sole granter, and its existing refresh + save +
 *   feedback subscriber handles the outcome. No new grant
 *   logic, no key binding, no touch change. App.tsx only.
 * - UMBRELLA DRIVING, LIVE (Adam, 2026-10-26 — DEV brief,
 *   third App landing after the two pile briefs; Background's
 *   graphic 961cbac landed first, so the setter exists): the
 *   shell calls renderer.setCarriesUmbrella with Systems'
 *   carriesUmbrella(inventory) whenever inventory changes —
 *   in refreshInventory, which every inventory-changing
 *   handler already flows through (harvest, craft, eat,
 *   cook, place, wear, deposit, drop, pile pickup), plus a
 *   boot call after the renderer exists for a restored
 *   umbrella. No equip step, duplicates do not stack, one
 *   boolean; the graphic itself (third-person only, witch
 *   group child) stays renderer-owned and hidden by
 *   default until this call. App.tsx only; no game/systems
 *   change.
 * - TRAP CRAFT CONFIRM, LIVE (Adam, 2026-10-26 — DEV brief,
 *   first of two briefs): trap recipe Craft buttons ask first —
 *   "PLACE TRAP HERE?" in the staged Popup dialog shell, Yes
 *   runs the existing Systems trap-craft execution (consumes +
 *   places), No or Close aborts with nothing consumed and no
 *   trap. Trap rows only (Traps group); no other recipe
 *   changes. App.tsx only; no game/systems change.
 * - FORAGE HINTS, LIVE (Adam, 2026-10-26 — DEV brief,
 *   second of two briefs): when she is hungry or too-hungry,
 *   the HUD shows one short forage line — brush →
 *   elderberries, bog growth → bog berries, downed oak →
 *   acorns (cook first). Wording lane-decided, flagged;
 *   mushroom lines join when mushroom sources land.
 *   App.tsx + new ForageHint; no game/systems change.
 * - DEFAULT PERSPECTIVE FIRST-PERSON, LIVE (Adam, 2026-10-26
 *   — DEV brief, first of two briefs): both fresh-start
 *   defaults move from 'third' to 'first' (boot camera
 *   fallback + new-world meta default). Saved games keep
 *   their saved cameraMode; V/C cycling + Options
 *   perspective control untouched. App.tsx only.
 * - HUNGER BAR + NUMBER, LIVE (Adam, 2026-10-26 — DEV brief):
 *   the HUD hunger indicator now shows the meter itself — a
 *   bar filled to hunger.value() plus the rounded integer
 *   beside it, stage text as-is — via an optional value prop
 *   on the same indicator, refreshed on the existing 1 s tick
 *   and on eat. No second hunger value anywhere; the number
 *   is Math.round, never the raw drain float. App.tsx +
 *   HungerIndicator; no game/systems change.
 * - TOUCH ROW LEVEL, LIVE (Adam, 2026-10-26 — DEV brief,
 *   option A pick): TURN down to the bottom row, even with
 *   MOVE (TURN bottom-24 right-4), USE beside it at right-40
 *   (16 px gap to TURN). Geometry on Adam's 390 px phone:
 *   MOVE [16, 144], USE [166, 230], TURN [246, 374] — 22 px
 *   and 16 px gaps, no overlap. Labels, pulse-until-first-use,
 *   touch ids, and gesture ownership unchanged. App.tsx
 *   bullet + TouchControls positions only.
 * - USE CENTERED + PILE PICKUP FIX, LIVE (Adam, 2026-10-27
 *   — DEV brief, two touch items in one landing): (1) USE
 *   PLACEMENT — Adam: the USE button was awkwardly placed,
 *   it should read symmetrical/centered; the placement is
 *   the lane's judgment per his delegation. USE moves from
 *   right-40 to dead centre between MOVE and TURN, its
 *   vertical centre on the sticks' axis (bottom-32 lifts the
 *   64 px button to the 128 px rings' centre). Geometry on
 *   Adam's 390 px phone: MOVE [16, 144], USE [163, 227],
 *   TURN [246, 374] — 19 px clear each side, no overlap;
 *   the old row drooped (USE centre 32 px below the sticks'
 *   axis) and hugged TURN. (2) DROPPED-ITEM PICKUP ON TOUCH
 *   — BUG FIX, not just invisibility: investigation found
 *   touch USE genuinely failed to pick piles. Ground sits
 *   at distance 0 and is always eligible in third/behind
 *   (and whenever looking down in first-person), so any
 *   pile at a nonzero distance lost to ground and USE
 *   harvested dirt instead of picking up — exact-0 is
 *   essentially unreachable once she has moved off the
 *   drop spot. Fix (the previously-flagged piles-outrank-
 *   ground change, made inside this brief): the pile now
 *   competes against SCATTER targets only; ground never
 *   blocks a pickup. Scatter competition is unchanged, and
 *   ground harvest via USE still works when no pile wins.
 *   (3) DISCOVERABILITY: the USE button now reads "PICK
 *   UP" whenever a pile would win the press — one shared
 *   rule drives the label, the press, and the desktop
 *   button, so the label can never lie about the press.
 *   Label change flagged per the brief: the default "USE"
 *   label is unchanged when no pile wins. TouchControls +
 *   App.tsx only; gesture ownership, touch ids, and the
 *   pulse-until-first-use sticks unchanged.
 * - SLEEP BUTTON, LIVE (Adam, 2026-10-27 — DEV brief):
 *   a Sleep control in the shelter indicator area (the
 *   HUD stack, not the harvest column or the touch row).
 *   It renders only when BOTH gates hold: sheltered by a
 *   placed house (the engine's live sheltered state —
 *   lean-to first, the house she has; any placed house
 *   qualifies) AND night (the renderer's live sky cycle,
 *   split by the engine's own cycleSplit at the world's
 *   fixed SEASON_START_MONTH, read on the 1 s timer — no
 *   shell season logic). Daytime shows no Sleep control.
 *   The press emits 'sleep:requested' { x, z } — her
 *   position at press time — and App owns the ONE
 *   createSleepListener (Fill-in's sleep.ts, landed in
 *   parallel as 69f5393): it checks night, then shelter
 *   from the position, and jumps the sky to dawn,
 *   time-only, no restore. Outcomes: 'sleep:failed'
 *   needs no UI action (failures show nothing per the
 *   brief's no-invented-text rule), and 'sleep:completed'
 *   showed nothing until 2026-10-29, when Adam ordered
 *   the WAKE MESSAGE (the transient dawning notice —
 *   see handleSleep). REPAIR NOTE:
 *   the first push of this landing (cf5f813) was built
 *   from a stale base and its whole-file events.ts
 *   clobbered Fill-in's landed sleep contract (the three
 *   sleep entries + the sleep.ts import); the repair
 *   restores that contract byte-identical and corrects
 *   the emit to { x, z }. Label is the lane's pick,
 *   flagged: "Sleep until sunrise". No new panel, no
 *   other invented text. App + ShelteredIndicator +
 *   events.ts (restored, not re-authored).
 * - CAMPFIRE TAP FIX, LIVE (Adam, 2026-10-27 — DEV brief,
 *   live-phone UX break): Adam tapped a campfire's
 *   "Campfire" button and got a harvest failure instead of
 *   the lighting menu. MECHANISM CORRECTION, stated
 *   plainly: the brief's double-fire (a chip tap ALSO
 *   firing tap-to-harvest) does NOT reproduce in code —
 *   the chip button lives in a separate subtree from the
 *   look field, in a higher stacking context (z-30 world
 *   overlay above the z-20 touch controls), so a precise
 *   chip tap cannot reach the look-field handlers. What
 *   DOES reproduce: the chip's touch target was ~28 px
 *   tall (py-1 text-sm), below the 44 px touch rule, so
 *   a thumb tap aimed at the chip easily misses it — and
 *   a miss on the right half lands on the look field,
 *   which harvests ground (distance 0, always eligible)
 *   and at too-hungry reports "Harvest failed:
 *   too-hungry.", masking the lighting menu. FIX: the
 *   chip button is now min 44 px tall, and it stops
 *   touchstart propagation so a chip tap can never
 *   double as a look-field tap whatever the future DOM
 *   order (no preventDefault — that would swallow the
 *   click itself). LIGHTING PATH VERIFIED HUNGER-FREE
 *   end to end in code (not just at fed): chip onSelect
 *   → setSelectedFireId → ContextMenu → handleFireAction
 *   → engine startLighting/flintClick consults nothing
 *   about hunger; chips render regardless of hunger; menu
 *   actions gate only on flint possession and lighting
 *   phase. No change needed on that path. TAP PRIORITY
 *   PROPOSED, NOT BUILT (see the DEV report): a world
 *   tap near a fire should prefer the fire menu over
 *   ground harvest (scatter still first) — that changes
 *   what every world tap near a fire does, so it waits
 *   on DEV/Adam approval rather than shipping silently.
 *   FireState.tsx + this bullet only.
 * - LIT-FIRE MENU FIX, LIVE (Adam, 2026-10-27 — DEV brief,
 *   torch build: a lit fire's chip must actually OPEN its
 *   menu): the chip onSelect used to show "{name} lit."
 *   feedback for a lit fire and never open the menu, so
 *   the lit menu's cook actions were unreachable — the
 *   menu only opened while unlit or lighting. FIX: the
 *   chip now opens the menu in every state (unlit,
 *   lighting, lit); the lit menu itself already existed
 *   (Cook acorns stick/buried, disabled without carried
 *   acorns, + Close). The lit menu is also the torch
 *   pill's host: the additional "light torches" pill
 *   (ONLY when she carries >=1 unlit torch, one press
 *   lights ALL carried unlit torches) is BUILT in the
 *   TORCH PILL bullet below (API landed + DEV signal
 *   received — the hold is lifted, no guessed API).
 *   App.tsx only (chip onSelect + this bullet).
 * - TORCH PILL, LIVE (Adam, 2026-10-27 — DEV brief,
 *   hold lifted on Systems' batch API 3dd6999 + DEV
 *   signal): any lit fire's menu gains an additional
 *   "Light torches" pill (Adam's text; casing follows
 *   the menu convention — "Light with flint", "Cook
 *   acorns" — flagged, correct to lowercase if Adam
 *   wants it verbatim). The pill appears ONLY when she
 *   carries >=1 unlit torch (inventory.count(ITEMS.
 *   torch)) — no torches, no pill, no dead button — and
 *   sits FIRST in the lit menu (lane's pick). One press
 *   calls lightTorches(inventory, { litFirePresent:
 *   true }) — ALL carried unlit torches light in one
 *   batch, nothing consumed, fire wins when both routes
 *   are available; feedback names the count lit ("Lit N
 *   torch(es)."), failure shows the API's reason; the
 *   menu stays open and the pill is gone on re-render
 *   (count 0), leaving cook. The flint + river-stone
 *   route is NOT rebuilt here — the inventory torch
 *   rows' Light button already covers it (flint route
 *   only). App.tsx only.
 * - ESC OPENS OPTIONS + INDICATOR, LIVE (Adam, 2026-10-27
 *   — DEV brief, joining the Esc + [X] brief): one rule —
 *   topmost-close, else open-Options. With NO modal open,
 *   Esc opens the Options modal (one App-level listener);
 *   with a modal open, that modal's own Esc listener
 *   closes it and this handler stands aside (it returns
 *   early on optionsOpen/introOpen/pendingTrapRecipe) —
 *   so Esc on open Options closes Options, and a second
 *   Esc with nothing open re-opens it. The handler yields
 *   when focus sits in a text input, textarea, or select
 *   (the seed field): typing Esc there must not yank the
 *   player into Options — flagged. It acts on Escape
 *   alone and swallows nothing, so V/C and WASD are
 *   untouched. Panels (inventory/crafting) are not modals,
 *   so they do not block the toggle — flagged, not carved
 *   out (Esc-to-close-panels-first is a follow-up if Adam
 *   wants it). INDICATOR (retired 2026-10-29, legend
 *   consolidation): the floating "Esc — Options" pill
 *   that lived bottom-right is GONE — Adam ruled ONE
 *   key legend (the printed one), and the Esc line now
 *   lives in the printed legend block; the Options
 *   button itself carries an Esc badge beside I/K/L.
 *   App.tsx only.
 * - ESC + [X] OUT OF ANY MODAL, LIVE (Adam, 2026-10-27 —
 *   DEV brief): AUDITED every dialog surface (role="dialog"
 *   grep — exactly three true modals, no others): Options
 *   modal (already X + backdrop + Escape — untouched),
 *   intro modal (already X + backdrop + Escape — untouched),
 *   Popup (the trap-craft confirm, the ONLY Popup use) —
 *   which had only a "Close" text button: it gains a
 *   visible [X] beside Close (kept, not replaced) plus
 *   Escape while open. Popup's Escape listener mounts
 *   only while open (effect no-ops when closed), acts on
 *   Escape alone, and swallows nothing — V/C cycling and
 *   WASD untouched, and Esc never fires with no modal up.
 *   Topmost-only by construction: each modal's backdrop
 *   covers the screen, so a second modal cannot be
 *   user-opened beneath an open one, and Intro/Options
 *   are mutually exclusive by wiring — one Esc closes
 *   the one open modal. [X] is thumb-sized on touch
 *   (new comfortable prop, passed isTouch by the trap
 *   confirm), so phone is never left without a close
 *   path. AUDITED BUT NOT MODALS, unchanged: ContextMenu
 *   (world-anchored menus — Close action on every menu,
 *   no backdrop, no aria-modal; Esc-on-menus is a
 *   separate question if Adam wants it), InventoryPanel
 *   + CraftingMenu (panels/sheets with onClose buttons),
 *   placement banner (Cancel), PausedIndicator (a
 *   button). Popup.tsx + App wiring (comfortable pass).
 * - PLACED TORCHES, LIVE (Adam, 2026-10-27 — DEV brief,
 *   hold lifted on Background 57028f1 + Systems e80f848):
 *   a carried lit torch places and picks back up. PLACE:
 *   the lit-torch inventory row gains Place (same
 *   row-button pattern as house/fire Place + Eat + Light)
 *   and places INSTANTLY AT HER FEET — the settled lean,
 *   decided at build (the preview ghost is the house/fire
 *   pattern, heavy for a torch) [AMENDED 2026-10-31:
 *   Adam's crosshair ruling moved the landing to the
 *   screen-center aim — see placeCarriedLitTorch; the
 *   panel press still carries its result on the note];
 *   the panel stays open,
 *   the count drops, the note carries the result. Grant
 *   FIRST (Systems placeTorch consumes one lit-torch;
 *   failure touches nothing), then the entity place
 *   (Background primitive, emits torch:placed). CHIP:
 *   each placed torch gets a world-anchored TorchChip
 *   ("Lit Torch", fire-chip pattern, 44 px + touch
 *   stopPropagation), tap opens a ContextMenu with Pick
 *   up + Close. PICKUP: grant FIRST (Systems pickupTorch
 *   returns lit-torch; 0 = pack full, the torch stays
 *   placed and the menu stays open), then the entity
 *   removal (emits torch:removed); the menu closes
 *   explicitly on a grant. Placed torches stay lit
 *   (no-burnout pin extended) and PERSIST: saveNow rides
 *   torchState.snapshot() as-is, boot restores via
 *   torchState.restore() BEFORE renderer construction
 *   (fire pattern; id-less entries dropped — real saved
 *   torches always carry an id). No hunger gate on
 *   place/pickup (moves, like drop/pickup). Placeable
 *   candles still later, distinct. New TorchChip.tsx +
 *   App wiring (state, anchors, subscriptions, menu,
 *   save wiring).
 * - INTRO MODAL, LIVE (Adam, 2026-10-27 — DEV brief):
 *   a first-run modal that explains the game briefly, says
 *   who you're playing, then gives bullet points. Opens
 *   when no save exists at boot (a corrupt save reads as
 *   null, so it reads as fresh too); dismissing sets it
 *   false for the session, and a player who never saves
 *   sees it again next launch — the trigger working as
 *   briefed, not a bug. Re-openable any time from the new
 *   Introduction section in Options (Settings tab, after
 *   Perspective): "Show introduction" closes Options and
 *   opens the intro (Adam's re-open pin). Copy is DRAFT
 *   for Adam's pin pass: game in two sentences (sixty
 *   years on, Great Lakes wilds growing back wet and
 *   strange), who (a witch, alone in the wilds — NO
 *   invented name or origin story, none pinned), then
 *   bullets: Adam's five in his words (Harvest; Find
 *   food; Hunger is real; Discover your true abilities;
 *   Discover what happened) plus the other core loops
 *   ONLY as built (Build shelter; Craft tools; Light
 *   fires; Explore) — no promised unbuilt system, and
 *   ruins NOT listed as playable ("discover what
 *   happened" is a direction, not a built feature).
 *   Dismissal is X + backdrop tap + Escape, the same
 *   trio as OptionsModal, so the Esc/[X]-out-of-any-
 *   modal brief is met by construction here; the footer
 *   line teaches the Options re-open path. No pause
 *   wiring: the modal is read-and-dismiss, and the world
 *   ticking behind it on a first run is trivial
 *   (nothing placed, hunger 1 point per 30 seconds).
 *   The LocationChip hides while the intro is open, like
 *   any other modal. New IntroModal.tsx + OptionsModal
 *   section + App wiring.
 * - TORCH DRIVING, LIVE (Adam, 2026-10-27 — DEV brief,
 *   umbrella precedent): the shell calls renderer.
 *   setCarriesLitTorch(inventory.count(ITEMS.litTorch)
 *   > 0) in refreshInventory (every inventory change
 *   flows through it) plus a boot call after the
 *   renderer exists for a restored lit torch — one
 *   boolean, not per-platform (the renderer half is
 *   shared by construction). Background's torch model +
 *   light (44ead3d) stayed hidden by default until this
 *   call; with it, the torch piece is functionally
 *   complete (item + hand recipe + batch API + pill +
 *   driving; the light values themselves stay
 *   Background's). App.tsx only.
 * - WEIGHT DISPLAY, LIVE (Adam, 2026-10-27 — DEV brief,
 *   unheld on Systems' tool-exclusion fix 8d0aff2):
 *   personal capacity is pounds now. Panel header reads
 *   "X lb / Y lb" from Systems' usedLb()/capacityLb(),
 *   trimmed to at most 2 decimals with trailing zeros
 *   dropped (never a raw float). Rows show per-item
 *   weight, plus the stack total above one ("0.5 lb each
 *   · 1.5 lb"). Rows whose weight is NOT in the header
 *   total never show a counting number: the owned tool's
 *   row reads "carried free" (one unit free; a duplicate
 *   unit counts, shown as "N lb · 1 carried free"), and
 *   carrying gear + worn garments read "carried free"
 *   too — same rule, or the row would contradict the
 *   total. Worn carrying-bonus note reads "+N lb".
 *   Home-storage rows stay count-based (out of scope);
 *   pack-full notes carry no numbers, so nothing to
 *   convert there. Large replace-vs-stack is CLOSED
 *   (Adam, 2026-10-27, "for simplicity": large replaces
 *   small — 70 with the large basket, full kit 130 lb
 *   with worn clothes; final state after the 10-27 open
 *   note); the header still reads capacityLb only, so
 *   no computed total lives in the display.
 *   InventoryPanel + App + types only.
 * - PILE CHIP + MENU, LIVE (Adam, 2026-10-27 — DEV brief,
 *   on Systems' take-N + deposit 0e16c91; kind-scoped
 *   grant 2026-10-27, menu redesign still UI's turn):
 *   every in-range pile gets a world-anchored chip (item
 *   + ×count, fire-chip pattern, 44 px touch target); tap
 *   opens Take one / Take all / Deposit one / Deposit
 *   all, scoped to one kind (deposit disabled when she
 *   carries none of it). SUPERSEDED by the multi-kind
 *   menu below: the menu now lists every kind. Take calls
 *   handlePileTakeRequest directly (kind + 1 / kind
 *   quantity); deposit calls depositIntoPile + one
 *   pileState.drop with the pile's EXACT x/z verbatim — a
 *   deposit to a gone pile still lands at those coords,
 *   and the chip refreshes straight from pileState after
 *   every menu action. USE (touch) + desktop button keep
 *   take-all as the fast path (the WHOLE pile, via
 *   Systems' listener); exact-number picker not built.
 *   PileChip + App only.
 * - MULTI-KIND PILE MENU, LIVE (Adam, 2026-10-27 — DEV brief,
 *   on Systems' kind-scoped grant 509ee84; SUPERSEDES the
 *   interim first-kind menu above): one chip per PILE (the
 *   pile itself multi-kind — no spot grouping); a
 *   single-kind pile keeps "{name} × {qty}", a multi-kind
 *   pile reads "Pile × {total} ({n} kinds)". Tap opens a
 *   menu listing the pile's kinds LIVE in stacks order
 *   (first-dropped first), each with per-kind Take one /
 *   Take all, plus deposit of any carried kind (one / all;
 *   pile kinds with none carried show deposit disabled,
 *   "Needs carried {kind}"). The menu STAYS OPEN after a
 *   press (repeated one-by-one without reopening) and
 *   re-renders live — a kind at zero leaves the menu, an
 *   emptied pile closes it. Take passes the tapped kind
 *   (verbatim stack item — pileState matches verbatim);
 *   deposit passes the tapped kind + the pile's EXACT x/z
 *   verbatim. USE (touch) + desktop button emit
 *   pile:pickup-requested to Systems' WHOLE-pile listener
 *   (kinds in stacks order, partial by weight — Systems
 *   09c4658, restored in the repair bullet below); the
 *   menu's per-kind Take all is separate from that fast path. Exact-number picker not built. PileChip + App only.
 * - MULTI-KIND MENU REPAIR (2026-10-27, UI lane): the menu
 *   push landed on a moved parent (Systems' whole-pile
 *   listener 09c4658) and its whole-file App write
 *   reverted Systems' 5 App hunks (header wording ×2,
 *   listener comment, subscriber taken-list feedback,
 *   desktop whole-pile label) — owned clobber, caught by
 *   post-push parent + diff verification before any
 *   report, and the tip stood tsc-red on outcome.item
 *   until this repair. This repair restores all 5 hunks
 *   verbatim on top of the menu and corrects this
 *   bullet's USE/desktop sentence (the listener takes
 *   the WHOLE pile now, not the first kind). Menu code
 *   untouched by the repair. App only.
 * - TRAP SAVE WIRING, LIVE (Adam, 2026-10-27 — DEV brief,
 *   Systems format half 4f3fa69): placed traps survive a
 *   refresh — saveNow passes trapState.snapshot() as
 *   draft.traps, and boot restores via trapState.restore()
 *   BEFORE the renderer is constructed (restore is silent,
 *   and the constructor's initial trap build renders the
 *   restored markers; no new renderer API, no per-trap
 *   emits). Regenerate clears traps via setWorldGen, so a
 *   new world saves empty; old saves load traps: [].
 *   App.tsx only; no game/systems change.
 * - WORLD-STATE SAVE WIRING, LIVE (Adam, 2026-10-27 — DEV
 *   brief, Systems format dc803c7 + sky seam 466b7b7 + fire
 *   ids amendment 943f362): harvested scatter, lit fires,
 *   sky time, and facing survive a refresh — saveNow
 *   writes fires with id + lighting, harvestState, sky,
 *   and facing; boot restores fires + harvest + traps
 *   BEFORE construction, sky AFTER construction, facing
 *   after the mode-set (player.mode from the saved
 *   cameraMode, fixing the boot that left the engine in
 *   'third' for a saved first/behind game). Regenerate
 *   clears all four via the existing paths. App.tsx only.
 * - SCRY BUTTON, LIVE (Adam, 2026-10-27 — DEV brief,
 *   supersedes the no-button amendment: "We can have a
 *   scry button when she approaches water. This let's
 *   the player know there is magic."): approach still
 *   water and a Scry button appears; press reveals the
 *   camp arrows. SPLIT, NOT REWRITE (DEV): visibility =
 *   isNearStillWater on player:moved (Systems 9927ddab
 *   stands as the query, no rebuild); reveal = press
 *   calls evaluateCampReveal directly (no wrapper).
 *   The button shows only when near water AND at least
 *   one camp exists AND nothing is revealed (UI's call,
 *   flagged — no dead presses, no invented copy); it
 *   hides while revealed and reappears on arrival
 *   (dismiss) if she is still at water; re-press
 *   re-reveals. WATERS (shell-side derivation, flagged
 *   TEMPORARY + replaceable — deleted in CAMP ARROWS
 *   WIRING below, Background's adapter having landed
 *   08bd0d5): river centerline samples at
 *   RIVER_STEP, radius RIVER_WIDTH/2 (Systems'
 *   prescribed shape), sampled ±64 m around her
 *   along-course projection; ponds scanned from
 *   generateChunk scatter in the 3x3 chunks around her,
 *   radius 4.5 × scale (mirrors the renderer's pond
 *   disc). Placement: bottom-centre, the PausedIndicator's
 *   seat — the two never show together (Scry hides while
 *   paused); hidden with any panel/modal open, like the
 *   LocationChip. 44 px, same family as the pile
 *   button; touch + desktop identical (parity). The
 *   button IS the magic signal — no tutorial popup.
 *   ARROWS GATE (plain at landing): press set the
 *   CampDivination reveal state only — NO renderer arrow
 *   API existed yet; wired in CAMP ARROWS WIRING below.
 *   New ScryButton.tsx + App wiring (state, moved
 *   evaluation, press, regenerate dismiss).
 * - CAMP ARROWS WIRING, LIVE (Adam, 2026-10-27 — DEV
 *   signal, Background's arrows + adapter 08bd0d5):
 *   the Scry button's press now SHOWS the arrows, and
 *   arrival-dismiss + regenerate HIDE them again.
 *   handleScry calls renderer.setCampArrowsVisible(true)
 *   on a shown reveal; the moved handler calls it with
 *   false on arrival-dismiss; regenerate calls it with
 *   false alongside the reveal dismiss. The renderer
 *   rebuilds the arrows itself from placed houses
 *   (shelter:placed + setWorldGen) — the shell only
 *   toggles visibility, default hidden. The TEMPORARY
 *   shell-side waters derivation is DELETED on this pass
 *   (Background's game/waterProximity adapter is the
 *   keeper: ponds-as-circles + river samples, 2.5-edge
 *   aligned); visibility still evaluates on player:moved
 *   via isNearStillWater over the adapter's list.
 *   Off-screen camps get edge arrows from the renderer
 *   (no shell work). Feature testable now: approach
 *   water with a camp placed, press Scry, follow the
 *   arrows home; arriving hides them. App.tsx only.
 *   nearCreek wiring from the adapter is a follow-up,
 *   not this pass.
 * - LOOK ACTION, LIVE (Adam, 2026-10-27 — DEV-approved
 *   claim + target + content, Systems NameSight
 *   ccab7ff): a Look button beside the harvest actions
 *   (first row of the harvest column, above the nearest
 *   target's button) + a result line under it. Press
 *   looks closely at the NEAREST SCATTER target
 *   (kind-keyed; ground dirt/mud/grass is not a thing
 *   to look at — flagged: the brief's ground-first order
 *   is a harvest rule, and ground has no portions in
 *   DEV's table, so LOOK skips it rather than showing
 *   dead dirt names; DEV can redirect to verbatim
 *   ground-first in one line). The shell owns one
 *   NameSight; press records look(key, portions) and
 *   shows display (known prefix joined ' - ') or the
 *   plain name when nothing is known (unlisted kinds
 *   record an empty look and show the plain name, per
 *   DEV's null rule — flagged: empty looks count toward
 *   practice). Result hides when the target leaves
 *   range; regenerate clears the line (knowledge itself
 *   persists — it is hers, not the world's). Portions
 *   live in UI-owned src/ui/lookPortions.ts, DEV's
 *   DRAFT table verbatim (17 kinds × 3 portions,
 *   flagged draft for Adam's pin pass) — nothing
 *   beyond the table is invented. Owl hook: boot calls
 *   setOwlOwned(false) — the charm is later, its id
 *   not decided, never invented. Save: nameSight rides
 *   saveNow + boot restore (check-not-set block).
 *   No hunger gate (looking is observation). New
 *   LookButton.tsx + lookPortions.ts + App wiring +
 *   one optional lookNode prop on
 *   ProximityHarvestButtons (UI-owned file; claim
 *   surface grew by that prop — stated plainly).
 *   PARKED 2026-10-28 (Adam's word — see the PARK
 *   bullet below): the button hides behind
 *   LOOK_PARKED; the rest of this bullet still
 *   describes the dormant code, which stays.
 * - ALTAR PLACE + MARKER, LIVE (Adam, 2026-10-27 —
 *   DEV signal, Systems 508fcb7 + Background 8302cdc):
 *   the altar's inventory row gains Place (ITEMS.altar
 *   joins PLACEABLE_IDS for the BUTTON only) placing
 *   INSTANTLY AT HER FEET — the then-torch precedent,
 *   not the house/fire preview flow (the torch itself
 *   moved to the crosshair 2026-10-31; the altar keeps
 *   its feet until its own word). Grant FIRST (Systems
 *   placeAltar consumes one carried altar; failure
 *   touches nothing + shows the reason), then the
 *   entity place (Background primitive, emits
 *   altar:placed → refreshAltars). Panel stays open,
 *   count drops, altarNote carries the result ('Placed
 *   an altar.'). One world-anchored AltarChip per
 *   placed altar (label 'Altar', torch-chip styling) —
 *   LABEL-ONLY at landing (no menu — rituals were not
 *   in that order); the RITUAL WAKING UI build below
 *   makes the chip a button opening the ritual panel
 *   (still no Pick-up — removal is Adam's word later).
 *   No hunger
 *   gate (a move, like drop/pickup). Save: altars ride
 *   saveNow as-is + boot restore BEFORE construction
 *   (torch pattern; id-less dropped — real saved
 *   altars always carry an id). Regenerate staleness
 *   matches the fire/torch precedent (setWorldGen
 *   clears the entity; shell state re-reads on the
 *   next event). New AltarChip.tsx + App wiring.
 *   Parity: shared row button + label chip, touch +
 *   desktop. Placeable candles still later, distinct.
 * - WRITING DESK PLACE + MARKER, LIVE (Adam's grimoire
 *   design turn, 2026-10-30 — Systems 5e7bf06 +
 *   Background bcddb2d): the altar pattern end to end.
 *   The desk's inventory row gains Place (ITEMS.
 *   writingDesk joins PLACEABLE_IDS for the BUTTON
 *   only) placing INSTANTLY AT HER FEET. Grant FIRST
 *   (Systems placeDesk consumes one carried desk;
 *   failure touches nothing + shows the reason), then
 *   the entity place (Background deskState.placeDesk,
 *   emits desk:placed -> refreshDesks). Panel stays
 *   open, count drops, deskNote carries the result
 *   ('Placed a writing desk.'). One world-anchored
 *   chip per placed desk — the AltarChip with label
 *   'Writing Desk', LABEL-ONLY (no desk actions exist;
 *   the grimoire's workings arrive with its own design
 *   turn; no Pick-up — moving a placed desk is Adam's
 *   word later). No hunger gate (a move, like drop/
 *   pickup). Save: desks ride saveNow from the entity
 *   snapshot + boot restore BEFORE construction
 *   (Background pattern; the SavedDesk id is OPTIONAL
 *   — id-less entries are kept and minted ids by
 *   restore, never dropped). Crafting: writing-desk,
 *   journal, and grimoire group together under
 *   'Fire & Workshop' (the desk-and-books set, DEV
 *   2026-10-30; Adam can re-split at the pin pass).
 * - RITUAL WAKING UI, LIVE (Adam, 2026-10-27 — DEV
 *   signal, Systems 939e9b3 + Background 58537ef):
 *   tier-1 Waking, altar sites only (see flags). The
 *   altar chip is now a button opening a world-anchored
 *   RitualPanel (new RitualPanel.tsx, props-driven, no
 *   game/systems imports): unstaged site → kind list
 *   (17 Waking kinds, shrew excluded — outright — each
 *   hinted with its sky; awakened kinds filtered out,
 *   re-awakening is pointless since awaken never
 *   downgrades); staged site → required recipe as rows
 *   (bone placed, offering given, name spoken, in the
 *   crafting-row pattern) + TIME line ONLY when the
 *   ritual requires one (sky 'none' → no line) with
 *   window-open/closed state. Steps: Stage bone (shell
 *   checks the site snapshot FIRST — an occupied site
 *   REFUSES, flagged: no StagingBook entry-clear exists
 *   for the replace branch, and silently dropping a
 *   staged ritual is worse than refusing; no inventory
 *   move — bone items do not exist yet, Systems'
 *   contract), Give offering (one button per carried
 *   food kind; shell consumes iff giveOffering accepts
 *   — poison + raw acorns refused first), Speak name
 *   (looks from NameSight, minLooks enforced). No
 *   complete button: completion is state-based — the
 *   shell checks after every step + on the 1 s timer
 *   (window-arrival path), and a staged ritual whose
 *   window is open completes at once (mid-window
 *   staging completes immediately; missed → next
 *   window; 'none' → immediate on all-offered). On
 *   completion the shell records the awakening, frees
 *   the site (unstage), says 'The {bone} awakens.'
 *   ('gain') at the site, and saves. First-charm row:
 *   boot grantFirstCharm AFTER the CharmState restore
 *   (idempotent — fresh save gains the shrew charm
 *   in the LIST, loaded awakening gains nothing, no
 *   full-pack failure since Systems 9e9a9dd — the
 *   grant records no item) + row note from Systems'
 *   boneNote in the
 *   bone build below (SUPERSEDES the numbers note
 *   'Stirs at hunger 45; drains 10% slower' computed
 *   from the DRAFT constants — shrew's row now reads
 *   Systems' phrase; machinery BUILT in the
 *   shrew-effect bullet below (latch + multiplier
 *   wired, display live). RETIRED 2026-11-01: the
 *   boot grant above is gone (see the drop at the
 *   boot effect) — awakenings are rite-earned only.
 *   Save: stagings + awakenings ride saveNow as-is +
 *   boot restore BEFORE construction (ritualSite
 *   restore derives site positions from altarState /
 *   the stump key; boulders skipped — none exist).
 *   Regenerate clears stagings (sites gone) + closes
 *   the panel; awakenings persist (hers, like LOOK
 *   counts). FLAGGED GAPS, not hidden — ALL THREE
 *   CLOSED by the individual-bone build below (kept
 *   here as history): (1) speak-name was unreachable
 *   (bone kinds had nothing to LOOK at) — now a bone
 *   PICKUP records 1 LOOK at its kind (Adam's ruling),
 *   and world bone LOOK portions exist, so the gate
 *   reads satisfied at looks ≥ 1. (2) Stump staging
 *   was unreachable (presence booleans only) — now
 *   Background's stumpPositions surface feeds stump
 *   chips + panels. (3) Awakened charms beyond shrew
 *   had no inventory row — now every bone kind reads
 *   its note from Systems' boneNote. The completion
 *   feedback still names the awakening and claims no
 *   item (the bone was consumed at staging; the
 *   awakening record IS the charm). Bone display
 *   'Primal Bone - {shape}' with spaces is UI's
 *   presentation call (slugs are the
 *   shape names). Parity: shared panel + chip, touch +
 *   desktop. New RitualPanel.tsx + AltarChip button +
 *   App wiring.
 * - INDIVIDUAL BONE DISPLAY + PICKUP, LIVE (Adam,
 *   2026-10-28 — DEV signal, Systems 7402376 +
 *   Background 9bf91e4): the ritual build's three
 *   flagged gaps close here, plus the pickup ruling.
 *   (1) INVENTORY ROWS: every carried primal bone
 *   reads its note from Systems' boneNote — raw:
 *   'Needs a ritual site'; awakened: 'Tier <n> ·
 *   <effect phrase>' (tier from the awakening record;
 *   phrase fallback 'Awakened'). Bone graphic reuses
 *   the world bone look (Adam's direction — no
 *   per-kind inventory art; kind via name). The shrew
 *   row's numbers note is superseded by boneNote's
 *   phrase (Systems-canonical; phrases DRAFT from the
 *   bone-charms doc, flagged for Adam's pin pass).
 *   (2) WORLD BONE LOOK: bone scatter targets gain
 *   LOOK portions in lookPortions.ts — DEV-approved
 *   triple ['Bone', 'pale bone', 'long pale bone'],
 *   IDENTICAL for all 17 kinds (flagged: shape is
 *   pickup's gift, not LOOK's). The shell resolves
 *   the kind from the TARGET position (id-encoded
 *   x,z via boneKindAt) and looks under the KIND key;
 *   a malformed position looks at nothing. World
 *   description stays PARTIAL (family first); the
 *   picked-up description is the IDENTIFIED change
 *   (world partial → inventory identified).
 *   (3) PLACE-BONE CONSUMES: handleStageBone now
 *   stages via stageBoneFromInventory (possession
 *   check + consume 1 + record; refusals consume
 *   nothing) — raw placeBone is no longer called
 *   (it would leave the bone both carried and
 *   staged). The panel MUST switch: until this
 *   landing, staging left bones duplicated.
 *   (4) STUMP STAGING: stumpPositions at her feet
 *   feeds world-anchored 'Stump' chips (AltarChip
 *   with a label prop — one chip family, label
 *   naming the site) opening the same RitualPanel
 *   (siteLabel 'Stump', site id 'stump:x,z'); the
 *   selection + derivation generalized from altar
 *   ids to site ids. A stump now has two doors
 *   (Craft StationPanel + ritual chip) — flagged,
 *   same object, two interactions. Completion
 *   feedback anchors at the staged site's recorded
 *   position (both kinds; the old altarState-only
 *   lookup stranded stump completions at her feet).
 *   PICKUP COUNTS AS A LOOK (Adam's ruling,
 *   Systems 70f20b5): every successful bone pickup
 *   grant records 1 NameSight look at its kind via
 *   Systems' recordBonePickupLook (THE shell path —
 *   kind from the granted item id, portions from
 *   UI's bone table, one look per granted kind).
 *   Three grant paths wired: harvest:completed
 *   ('harvest' + 'remove' — a remove takes the bone
 *   too; carried yields only, overflow-dropped piles
 *   excluded), menu take-one/take-all, and whole-pile
 *   pickup (touch USE + desktop button). A
 *   failed/full-pack grant records nothing. The
 *   panel gate already reads looksAt and shows
 *   satisfied at ≥ 1 — no panel change. NOTE: an
 *   earlier DEV signal instructed position-derived
 *   kind resolution for pickups; Systems' helper
 *   (landed after that signal) derives kind from
 *   the item instead, and agrees with the position
 *   derivation by construction — the helper is the
 *   path used. Position derivation survives only
 *   for WORLD LOOK (no item yet). The old
 *   shaping-note divergence is RESOLVED by 70f20b5
 *   (rituals.ts header now records the ruling).
 *   LOOK NOTE: Adam's 'for now' became a PARK
 *   (2026-10-28, see the PARK bullet below) —
 *   portions built as approved, button hidden,
 *   LOOK not removed. Parity: shared panel +
 *   chips + rows, touch + desktop. New: lookPortions
 *   bone entries + AltarChip label + App wiring.
 * - LOOK PARKED, LIVE (Adam, 2026-10-28: "We'll
 *   park the look notion for now" — DEV signal):
 *   the world-LOOK button/entry hides behind a
 *   LOOK_PARKED flag (one line to unpark) — LOOK
 *   is dormant, NOT deleted. NameSight state +
 *   save wiring, the lookPortions table (incl. bone
 *   entries), handleLook, and the pickup-look wiring
 *   ALL STAY. The pickup-look helper stays ACTIVE
 *   (it is the tier-1 gate path, not the button);
 *   the speak-name gate stays pickup-look — parking
 *   drops no gate. The parked render still references
 *   lookTarget, so unparking restores the exact prior
 *   surface (button + result line). No other file
 *   touched. Parity: nothing visible changes except
 *   the hidden button, touch + desktop alike.
 * - SHREW EFFECT DISPLAY + WIRING, LIVE (DEV
 *   signal, Systems 5e0af26 — latch + multiplier):
 *   the tier-1 shrew effect is now LIVE end to end.
 *   DISPLAY: HungerIndicator gains an optional
 *   warning line — 'The shrew bone stirs.' under the
 *   bar while the latch is active (steady state),
 *   pulsing (animate-pulse) for a 2 s flash window
 *   on the entry edge (fired), then standing steady.
 *   The indicator holds no timers; the shell owns
 *   the flash window. WIRING: one shell sync,
 *   syncShrewEffect, called on every hunger change
 *   (1 s timer, eat via refreshInventory), every
 *   inventory change (refreshInventory), and boot
 *   (after restore + grant — covers the boot-grant
 *   path AND the loaded-save boot, since the
 *   multiplier is session state, never saved). The
 *   sync calls latch update(hunger, carried) +
 *   setDrainMultiplier(shrew × snake × rested —
 *   the drain product, groundhog wiring below).
 *   Carried
 *   is SHELL-SUPPLIED — LIST MEMBERSHIP since the
 *   charm-list build below (Systems 9e9a9dd): the
 *   list IS the awakened kinds, so carried =
 *   isAwakened, and the old carried && awakened
 *   formula collapses to it. The interim main-
 *   inventory count is gone (the shrew item no
 *   longer sits in main inventory). DEVIATION
 *   BLESSED (DEV 2026-10-28): the landed
 *   shrewEffectActive(inventory, charms) reads the
 *   main inventory directly and is NOT used — the
 *   shell path is the list-ready one and stays;
 *   Systems noted the helper UNUSED pending a
 *   signature change to a shell-supplied boolean.
 *   Latch edges honored: fires once on entry into
 *   ≤ 45 while listed (including a below-threshold
 *   boot), re-arms above 45, resets when not
 *   listed. Tier 1 only; LOOK parked. Parity: the
 *   meter + line are shared, touch + desktop alike.
 * - CHARM LIST PANEL, LIVE (DEV signal, Systems
 *   9e9a9dd — listCharms view, grant-to-list,
 *   shrew-only save migration): the playable charm
 *   system completes on the UI side. PANEL: new
 *   CharmsPanel (props-driven, InventoryPanel
 *   pattern) — list in awakening order (kind +
 *   tier, from listCharms) + detail per charm
 *   (display name, tier, Systems' note — no
 *   invented effect text). DOOR: a Charms button
 *   beside Inventory/Crafting in BOTH rows (HUD
 *   stack row + touch slim bar); opening selects
 *   the first charm when the current selection is
 *   not listed. The panel hides the LocationChip +
 *   Scry button like every other panel, closes via
 *   its X + the Hide HUD button, and reads the list
 *   live each render (no refresh plumbing — a
 *   ritual completion re-renders through the
 *   ritual version bump, and the panel opens fresh
 *   on the current list). SWITCH: syncShrewEffect's
 *   carried line moves to list membership (above)
 *   — this RESUMES the shrew effect, closing the
 *   interim window (no visible row + carried false
 *   since the list landed). CALL: the boot grant
 *   call updates to grant-to-list semantics (no
 *   item → no refreshInventory on grant; a grant
 *   saves the awakening; the legacy inventory
 *   param is still passed — its removal rides a
 *   Systems change, flagged to DEV). ROWS: no
 *   duplicate rows — the shrew item is gone from
 *   main inventory by migration (loaded saves) or
 *   never granted (fresh saves), and the charm
 *   shows in the list panel only; raw bones still
 *   show in main inventory via boneNote ('Needs a
 *   ritual site' / 'Tier n · phrase' for a second
 *   copy of an awakened kind). Parity: panel +
 *   door shared, touch + desktop alike.
 * - ZONE COORDS + CHARM-HOOK WIRING, LIVE (Adam,
 *   2026-10-28 — "squeeze in next build"; Background
 *   zones.ts 9dd1b36 + G1/G2/G3 hooks): two items,
 *   one push. ZONES: the LocationChip gains the zone
 *   readout — App calls zoneCoords(position) (the
 *   helper is the single source of truth: 32 m chunk
 *   zones, world origin, east +x, north-positive
 *   second axis, floor) and passes the NUMBERS; the
 *   chip formats [+10, 0] style ('+' on positives
 *   both axes, plain zero/negatives) beside the
 *   position, ticking as she walks. No size/sign/
 *   origin invented here. HOOKS: syncCharmHooks
 *   mirrors syncShrewEffect — five landed setters
 *   on list-membership + awakened booleans (never
 *   main-inventory count): renderer pigeon (arrows
 *   without water while listed), owl (night sight),
 *   bat (night way-finding); player fox (swift
 *   step); module mole (clay bonus). Call sites are
 *   the only list-change paths — boot (after
 *   restore + grant) + ritual completion (after
 *   awaken) — no timer. Pigeon always-on: the
 *   arrival-dismiss path is untouched (it clears
 *   only the scry flag; the OR keeps pigeon arrows
 *   up while listed). Scry stays the early
 *   water-gated path; frog hint display excluded
 *   (waits for Systems' frog fact). Parity: chip +
 *   hooks shared, touch + desktop alike.
 * - FROG WATER HINT, LIVE (Systems 126c9aa —
 *   nearestStillWater fact): the queue's last display
 *   piece. App derives the fact per render from
 *   position (waters via stillWatersNear, both ranges
 *   default — adapter 50 + fact 50 draft — no range
 *   or math invented); gate = frog listed (isAwakened
 *   'frog-pelvis') AND fact non-null; null = no hint
 *   (no waters, beyond range, already at water).
 *   New FrogHint (props-driven, text-only,
 *   pointer-events-none): "Still water 23 m NE" —
 *   8-point compass from the fact's unit vector
 *   under the compass pin (East +x, North −z),
 *   whole meters rounded for display only (the
 *   fact's float is the truth). Seat: bottom-centre,
 *   hidden with any panel/modal open or paused; when
 *   the scry button is also showing, the hint lifts above it so the two
 *   never stack on one seat. Parity: shared, touch +
 *   desktop alike.
 * - GROUNDHOG WIRING + SNAKE FACTOR, LIVE (Systems
 *   6d67cf6 groundhog + snake factor): rested day +
 *   waking refresh, shell-side. WAKE: a new
 *   bus.on('sleep:completed') listener in the boot
 *   effect (beside the sleep listener) does
 *   sleepStart → wake in order (sleep is
 *   instantaneous — dawn jump, then completed — so
 *   there is no separate start event); a failed
 *   press gets no calls (no sleep happened). The
 *   wake bonus (+10 iff carried + awakened) rides
 *   existing HungerState.restore (clamped at 100,
 *   no hunger.ts change), then HUD hunger refresh +
 *   drain re-sync + saveNow when the bonus applied
 *   (rested itself is session-only, never saved).
 *   DRAIN PRODUCT: syncShrewEffect's multiplier is
 *   now shrew × snake × rested (0.729 with all three
 *   — snake joins here, DEV-approved batching: its
 *   factor existed unwired, and the product is now
 *   true in one push). All gates list membership +
 *   awakened via isAwakened per kind (groundhog:
 *   'groundhog-tooth'; snake: 'snake-vertebra'),
 *   never main-inventory count. No rested indicator
 *   invented — the effect shows through slower drain
 *   + the wake bump. NOT here (separate follow-ups):
 *   mouse/bear shell wiring, deer warning display.
 *   Parity: nothing visible changes except the wake
 *   bump on the shared meter, touch + desktop alike.
 * - MOUSE/BEAR/DEER WIRING, LIVE (Systems Track B
 *   factors): the remaining Systems-effect shell
 *   wirings, closed in one landing. MOUSE: syncCharm-
 *   Bonuses sets +25/0 home-storage counts (gate
 *   'mouse-spine') on every placed house's store at
 *   boot + ritual completion, plus at getHomeStore
 *   creation (a house opened mid-game is not left
 *   stale); capacity() already adds it, so existing
 *   home-capacity displays pick it up. BEAR: the same
 *   sync sets +10/0 lb pack capacity (gate 'bear-
 *   claw') on the pack inventory; capacityLb() already
 *   feeds it, so the existing carrying line picks it
 *   up. DEER: syncDeerWarning feeds WeatherWarning
 *   Background's stormApproaching rising-front signal
 *   (NOT a countdown) + carried = isAwakened('deer-
 *   antler-tip'), at boot + ritual completion + the
 *   1 s timer tick (the fact moves with position, so
 *   boot + completion alone would go stale as she
 *   walks); StormWarning (new, props-driven, text-
 *   only, pointer-events-none) renders 'A storm
 *   approaches.' steady while active, pulsing on the
 *   fired edge, seated beside HungerIndicator sharing
 *   stack visibility. All gates list membership +
 *   awakened, never main-inventory count; all three
 *   bonuses/latches session-only, never saved. This
 *   closes the Systems-effect wirings (crow pile-glow
 *   rides its own glow landing). Parity: the deer line
 *   is shared, touch + desktop alike; mouse/bear show
 *   through existing lines, both alike.
 * - PILL / CAMERA / RESUME FIXES, LIVE (Adam's
 *   quibbles, 2026-10-28): PILL — harvest:completed
 *   now dismisses the target's Harvest button at once
 *   (harvestedIds set, scatter only; 'remove' drops
 *   the whole target; ground piles untouched) AND the
 *   pickup feedback moved last into the z-40 overlay
 *   (above the menu, below modals) — the pill used to
 *   sit in the z-30 overlay under the z-40 column.
 *   CAMERA — fresh boot defaults player.mode to
 *   'first' (was: 'third' field default survived when
 *   no save existed, while App state said 'first';
 *   the renderer follows player.mode). RESUME —
 *   PausedIndicator centered on both axes, bigger.
 *   SLEEP VERIFY (no code): the broadened sleep
 *   emits houseId null away from home; App's only
 *   sleep:completed consumer ignores the payload, so
 *   it is null-safe as-is. Parity: all three fixes
 *   shared, touch + desktop alike.
 * POINTER DISCIPLINE: overlays are pointer-events-none except the
 * small interactive pieces (HUD buttons, panels, harvest buttons),
 * so world clicks — including the first-person mouse-capture click
 * — still reach the canvas. HudShell's content area was fixed to
 * pointer-events-none for exactly this reason.
 */

import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createWorldGen } from './game/worldgen';
import { WorldRenderer } from './game/renderer';
import { PlayerController } from './game/player';
import { bus, type EventMap } from './game/events';
import { pauseState } from './game/pause';
import {
  createHarvestOutcomeListener,
  hivePositions,
  placedTorchNearHive,
  setMoleEarthSense,
  stationPresence,
  stumpPositions,
} from './game/harvest';
import { zoneCoords } from './game/zones';
import { FrogHint } from './ui/FrogHint';
import { BIOME_BY_ID } from './game/biomes';
import {
  fireState,
  type PlacedFire,
  type FireResult,
} from './game/fireState';
import { loomState } from './game/loomState';
import { pileState, pileIdFor, type PileTarget } from './game/pileState';
import {
  dimensionBuckets,
  type DimensionBucketInput,
} from './game/dimensionBuckets';
import { HARVEST_RANGE } from './game/proximity';
import { trapState, type PlacedTrap } from './game/trapState';
import { stumpState, type StumpAddition } from './game/stumpState';
import { TRAP_DEFS } from './game/traps';
import {
  applySnatchSpook,
  biomePresentKinds,
  FERAL_DANGEROUS_KINDS,
  pickSnatchTarget,
  setUndetected,
  type AnimalKind,
} from './game/animals';
import {
  comeHere as runtimeComeHere,
  makeCompanionInstance,
  restoreActor,
  setMovementMode,
  setStance as runtimeSetStance,
} from './game/companionRuntime';
import {
  CAT_ID,
  catActor,
  installCatCatchTable,
  installCatProbes,
  setCatBond,
  type CatCatchTable,
} from './game/catRuntime';
import { guideTagSeat, installGuideProbes } from './game/guideRuntime';
import { discFeaturesInRect } from './game/discs';
import { installTrustFacts } from './game/trustMarkers';
import {
  collectTrapCatch,
  catchItemFor,
  eligibleKindsFor,
  resolveTrapHour,
} from './systems/trap-catch';
import type { TrapType } from './game/traps';
import {
  CARRYABLE_TRAPS,
  dismantleTrap,
  isCarryableTrap,
  pickupTrap,
  placeCarriedTrap,
} from './systems/trap-place';
import { fillJar, dumpJar } from './systems/clay-jar';
import {
  placeBag,
  pickupBag,
  placeTent,
  pickupTent,
} from './systems/camping';
import { harvestHoney } from './systems/honey';
import { harvestState } from './game/harvestState';
import {
  SOURCE_BY_ID,
  SOURCE_FOR_KIND,
  harvestSourceLinesFor,
  type ToolTier,
} from './game/objects';
import type { FireType } from './game/fire';
import {
  CANDLE_WAIT_MS,
  FLINT_CLICKS,
  FRICTION_WAIT_MS,
} from './game/fire';
import {
  shelterState,
  shelterAt,
  HOUSE_DEFS,
  HOUSE_LADDER,
  SHELTER_RADIUS,
  type HouseType,
} from './game/shelter';
import { siteShelterAt } from './game/siteShelter';
import {
  evaluateCampReveal,
  isNearStillWater,
  nearestStillWater,
  findCamps,
  CampDivination,
} from './systems/divination';
import {
  isNearWater,
  siteWaterFacts,
  stillWatersNear,
} from './game/waterProximity';
import { NameSight } from './systems/name-sight';
import { portionsForKind, lookKeyForTarget } from './ui/lookPortions';
import { cycleSplit, cyclePhase, currentMoonPhase } from './game/sky';
import { createSleepListener } from './game/sleep';
import {
  CHUNK_SIZE,
  DEFAULT_SEED,
  PLAYER_EYE_HEIGHT,
  THIRD_PERSON_OFFSET,
  BEHIND_CAMERA_DISTANCE,
  BEHIND_CAMERA_HEIGHT,
  BEHIND_LOOK_AHEAD,
  BEHIND_LOOK_HEIGHT,
} from './constants';
import type { CameraMode, BiomeWeights } from './types';
import { Wardrobe, GARMENTS, WORN_CAPACITY_BONUS } from './systems/clothes';
import {
  carriesUmbrella,
  applyUmbrellaToPrecipitationRemaining,
} from './systems/umbrella';
import { HudShell } from './ui/HudShell';
import {
  HudElement,
  useHudLayout,
  HUD_ELEMENT_LABELS,
} from './ui/hudLayout';
import type { HudElementId } from './ui/hudLayout';
import { WitchHealth } from './ui/WitchHealth';
import { HungerIndicator, STAGE_WORD as HUNGER_STAGE_WORD } from './ui/HungerIndicator';
import { ForageHint } from './ui/ForageHint';
import { ShelteredIndicator } from './ui/ShelteredIndicator';

import { WornList, type WornGarment } from './ui/WornList';
import { UmbrellaIcon } from './ui/UmbrellaIcon';
import { FireState, type FireChipStatus } from './ui/FireState';
import { PlacementPreview } from './ui/PlacementPreview';
import { ContextMenu } from './ui/ContextMenu';
import { PileInventoryModal } from './ui/PileInventoryModal';
import { PileChip } from './ui/PileChip';
import { TorchChip } from './ui/TorchChip';
import { TentChip } from './ui/TentChip';
import { BagChip } from './ui/BagChip';
import { FirstRunDialog } from './ui/FirstRunDialog';
import { AnimalTag } from './ui/AnimalTag';
import { PlaceTag } from './ui/PlaceTag';
import { AltarChip } from './ui/AltarChip';
import type { ContextAction } from './ui/types';
import { TouchControls } from './ui/TouchControls';
import { LocationChip } from './ui/LocationChip';
import { ScryButton, FillJarButton } from './ui/ScryButton';
import { PickupButton } from './ui/PickupButton';
import { LookButton } from './ui/LookButton';
import { PausedIndicator } from './ui/PausedIndicator';
import { Popup } from './ui/Popup';
import {
  OptionsModal,
  fontClassFor,
  loadFontChoice,
  loadLookChoice,
  saveFontChoice,
  saveLookChoice,
  type FontId,
} from './ui/OptionsModal';
import { IntroModal } from './ui/IntroModal';

import {
  InventoryPanel,
  loadInventorySort,
  saveInventorySort,
  type InventorySortPreference,
} from './ui/InventoryPanel';
import type {
  ItemListVerb,
  ItemListVisibleVerb,
} from './ui/ItemListSurface';
import { CraftingMenu } from './ui/CraftingMenu';
import { ProximityHarvestButtons } from './ui/ProximityHarvestButtons';
import { ObjectFeedback } from './ui/ObjectFeedback';
import { WorldAnchor } from './ui/WorldAnchor';
import { KEY_BADGE_CLASS, LOOK_THEMES, UI_THEMES } from './ui/themes';
import { CameraTransition } from './ui/CameraTransition';
import { CAMERA_TRANSITION } from './ui/cameraPresentation';
import {
  projectWorldToScreen,
  screenCenterGroundPoint,
} from './ui/worldProjection';
import type { HarvestTarget, HarvestRequest } from './ui/proximityHarvest';
import { removeRequestFor } from './ui/proximityHarvest';
import type {
  InventoryItem,
  CraftingRecipe,
  FeedbackTone,
} from './ui/types';
import {
  ITEM_CATEGORY_ORDER,
  ITEM_ID_ALIASES,
  PersonalInventory,
  categoryFor,
  descriptionFor,
  displayNameFor,
  isCarryingGear,
  normalizeItemId,
  weightOf,
} from './systems/inventory';
import {
  depositIntoPile,
  dropFromInventory,
  handlePilePickupRequest,
  handlePileTakeRequest,
} from './systems/piles';
import {
  executeCraft,
  executeCraftChain,
  hasChainProducer,
} from './systems/crafting-execution';
import {
  HungerState,
  eat,
  needsCooking,
  FOOD_ACORNS,
  FOOD_ITEMS,
  COOK_REQUIRED_ITEMS,
  type HungerStage,
} from './systems/hunger';
import {
  FireState as SystemsFireState,
  charStick,
  CHAR_INPUT_ITEM,
  cook,
} from './systems/fire';
import {
  HomeStorage,
  consumeHomeUpgradePrice,
  nextHomeUpgrade,
} from './systems/shelter';
import {
  clearSave,
  loadSave,
  saveGame,
  serializeSave,
  type SaveData,
} from './systems/save';
import {
  CLOUD_BASE_URL,
  adoptWordSet,
  armMirror,
  bringHere,
  canonicalizeWords,
  deleteCloudSave,
  enterWords,
  generateWords,
  getCloudSave,
  getWords,
  isCloudEnabled,
  listCloudSaves,
  mirrorNow,
  mirrorSave,
  parkLocal,
  probeShelfFreshness,
  readParked,
  resolveMirrorConflictKeep,
  syncState,
  type MirrorConflict,
  type ShelfFresherFacts,
  turnOff,
  turnOn,
} from './systems/cloudSaves';
import {
  isItemMet,
  itemFactsFor,
  knowledgeSnapshot,
  recordItemUse,
  restoreKnowledge,
} from './systems/knowledge';
import {
  type CloudParkedSave,
  type CloudSaveRow,
} from './ui/CloudSavePanel';
import {
  clothingRemaining,
  stormApproaching,
  SEASON_START_MONTH,
  DAY_NIGHT_CYCLE_MINUTES,
} from './game/weather';
import {
  currentWeatherFacts,
} from './game/weatherSpells';
import {
  ColdWetState,
  type ColdWetFacts,
} from './systems/cold-wet';
import {
  COLD_WORD,
  INJURY_WORD,
  WET_WORD,
  WeatherWitness,
  scentWord,
  type ColdStageKey,
  type WetStageKey,
} from './ui/WeatherWitness';
import {
  InjuryState,
  SALVE_ITEM,
  tendWithSalve,
  type InjuryStage,
} from './systems/injury';
import { applyGlowDose } from './systems/glow-paint';
import {
  ScentState,
  applyDouse,
  mixWash,
  useWash,
} from './systems/scent';
import {
  planCrawlBack,
  resolveEncampment,
  WAKE_HUNGER,
} from './systems/crawl-back';
import {
  ownedStage,
  ownedTier,
  ownedToolItem,
  type OwnedToolItem,
} from './systems/owned-tool';
import {
  BONE_QUEST_KINDS,
  QUEST_ACTS,
  QUEST_THREADS,
  boneAcquisitionsFor,
  evaluateQuests,
  emptyQuestFlags,
  isQuestLive,
  newlyCompleted,
  questById,
  questComponentsFor,
  type QuestFacts,
  type QuestFlags,
} from './systems/quests';
import {
  emitJournalChange,
  subscribeJournalChanges,
  type JournalChange,
} from './systems/journalChanges';
import {
  canCraft,
  CRAFT_OWNERSHIP_LABELS,
  craftingSection,
} from './systems/crafting';
import {
  ITEMS,
  RECIPES,
  type CraftingStation,
  type ItemId,
} from './systems/recipes';
import { torchState, type PlacedTorch as PlacedTorchEntity } from './game/torchState';
import { lightTorches, placeTorch as grantPlaceTorch, pickupTorch as grantPickupTorch } from './systems/torch';
import { altarState, type PlacedAltar as PlacedAltarEntity } from './game/altarState';
import { jarPatchState } from './game/jarPatchState';
import { mossPaintState } from './game/mossPaintState';
import {
  NamedPlacesState,
  bearingDegrees,
  distanceM,
  NAME_MAX_CHARS,
  RENAME_RADIUS_M,
  setNamedPlacesJournalSink,
  type NamedPlace,
} from './game/namedPlaces';
import { placeAltar as grantPlaceAltar } from './systems/altar';
import {
  altarProgressFrom,
  drawGlyph,
  isStumpyAltar,
  linkJournal,
  placeStones,
  setCandle,
  siteGrade,
} from './systems/stumpy-altar';
import { deskState, type PlacedDesk as PlacedDeskEntity } from './game/deskState';
import {
  pickupDesk,
  placeDesk as grantPlaceDesk,
  seatGrimoire,
  takeGrimoire,
} from './systems/desk';
import {
  workstationState,
  type PlacedWorkstationBench as PlacedWorkstationEntity,
} from './game/workstationState';
import {
  pickupWorkstation,
  placeWorkstation as grantPlaceWorkstation,
} from './systems/workstation';
import { pickupLoom } from './systems/loom';
import { hearthItemFireLit, pickupHearth } from './systems/hearth';
import {
  cauldronState,
  type PlacedCauldron as PlacedCauldronEntity,
} from './game/cauldronState';
import {
  barnSite,
  caveMouthSite,
  chapelSite,
  drownedMillSite,
  farmhouseSite,
  generalStoreSite,
  groveContains,
  groveSite,
  railSidingSite,
  schoolhouseSite,
  siloSite,
  sunkenRoadSite,
  villageSite,
  waterTowerSite,
} from './game/sites';
import {
  HOMESTEAD_CLEAR_RADIUS_M,
  homesteadInstancesInRect,
} from './game/homesteads';
import {
  FARMHOUSE_CLEAR_RADIUS_M,
  farmhouseInstancesInRect,
} from './game/farmhouses';
import {
  caveCarrierForLayer,
  fragmentCarriersHere as carriersHere,
} from './game/carriers';
import {
  caveInstanceForKey,
  caveInstancesInRect,
  caveLayoutForKey,
  caveMouths,
  caveMouthsNear,
  CAVE_DIMENSION_KEY,
  CAVE_ENTER_RANGE_M,
  CAVE_EXIT_RANGE_M,
  createCaveGen,
} from './game/caves';
import { dimensionState } from './game/dimensionState';
import {
  anchorClear,
  ascend,
  descend,
  enterCave,
  enterUpstairs,
  exitCave,
  exitUpstairs,
  type TravelOutcome,
} from './game/dimensionTravel';
import {
  baseById,
  canScry,
  listBases,
  planReturnHome,
  planReturnToPlace,
  type ReturningBase,
  type ReturningBaseFacts,
} from './systems/returning';
import {
  atticLayoutForKey,
  isUpstairsKey,
  upstairsMouthFor,
} from './game/attics';
import {
  placeCauldron as grantPlaceCauldron,
  pickupCauldron as grantPickupCauldron,
} from './systems/cauldron';
import { ritualSiteState, stumpSiteId } from './game/ritualSite';
import { boneKindAt } from './game/boneKind';
import {
  RITUAL_RECIPES,
  ritualRecipeFor,
  windowOpen,
  stageBoneFromInventory,
  StagingBook,
  type SkyFacts,
} from './systems/rituals';
import {
  CompanionState,
  FeralEncounterState,
  TRUST_FOR_BOND,
  dietFor,
  guardsKind,
  isFeedable,
  isFeral,
  provisioningCatchesFor,
  snatchFish,
  type CompanionStance,
  type RosterRow as SystemsRosterRow,
  type SavedCompanion,
} from './systems/companions';
import {
  FamiliarState,
  giftFor,
  trueNameFor,
} from './systems/familiar';
import { DiscoveryState } from './systems/discovery';
import { FragmentState, markDisplayName } from './systems/fragments';
import {
  CUTTINGS_TO_LAY,
  HedgeState,
  hedgeRadiusM,
  hedgeTier,
  isRooted,
} from './systems/hedge';
import {
  HearthHomeState,
  hearthhomeFireWarmth,
  hearthhomeShelterMultiplier,
  hearthhomeTier,
} from './systems/hearthhome';
import {
  CharmState,
  GroundhogRest,
  WeatherWarning,
  bearCapacityBonusLb,
  groundhogWakeBonus,
  listCharms,
  mouseStorageBonus,
  snakeDrainFactor,
  boneNote,
  boneKindFor,
  boneItemFor,
  isBoneItem,
  recordBonePickupLook,
  HungerWarning,
  crowGlowTier,
  FIRST_CHARM_KIND,
  FIRST_CHARM_ITEM,
  FIRST_CHARM_EFFECT,
  wakeShrewFromBone,
} from './systems/charms';
import { crowPileArrow, type CrowTier } from './game/crow';
import { CrowArrows } from './ui/CrowArrows';
import { RitualPanel } from './ui/RitualPanel';
import { walkAwayShouldClose } from './ui/walkAway';
import { CharmsPanel } from './ui/CharmsPanel';
import {
  RosterPanel,
  type RosterKindGroup,
  type RosterRow,
} from './ui/RosterPanel';
import {
  JournalPanel,
  type JournalMarkRow,
  type JournalBaseRow,
  JournalPlaceRow,
} from './ui/JournalPanel';
import { QuestCard } from './ui/QuestCard';
import { StructureTag, STRUCTURE_TAG_NAMES, STRUCTURE_TAG_RANGE_M } from './ui/StructureTag';
import { StormWarning } from './ui/StormWarning';
import { WakeNotice } from './ui/WakeNotice';

type BusHarvestTarget = EventMap['harvest:inRange']['targets'][number];

/** One feedback chip, positioned by the same projection as buttons. */
interface FeedbackItem {
  id: string;
  text: string;
  tone: FeedbackTone;
  /** True in the line's last ~0.6 s: the row fades out. */
  fading: boolean;
  /**
   * When the line was seated (or last refreshed), wall
   * clock — the aging tick reads AGES from this stamp,
   * never from timer bookkeeping (the feed-HUD build:
   * a throttled timer queue in a backgrounded tab left
   * minutes-old lines hanging across the gauges; a
   * clock read cannot be throttled into a lie).
   */
  bornAt: number;
}

/**
 * One in-progress multi-step harvest, for the pill-fill
 * display (Adam, 2026-10-29): the target's Harvest pill
 * fills with this fraction and shows the verb + press
 * count. Every field arrives on the 'harvest:progress'
 * payload (the Systems rider — pressIndex / pressesTotal
 * / verb are computed at the emit site from the def,
 * never derived here). The world-anchored progress bar
 * it replaces is retired: one element per anchor.
 */
interface HarvestProgressState {
  targetId: string;
  fraction: number;
  pressIndex: number;
  pressesTotal: number;
  verb: string;
}

// BELOW-PERMIT WORDING (Adam, 2026-10-26 — "below permit" is too
// vague): a below-permit failure names the required tool instead
// of the code word. The failed event carries no permit info, so
// the shell reads the source's permitTier from SOURCE_BY_ID
// (keyed by the same sourceId the tracker puts on the target)
// and maps the tier to its tool item for displayNameFor. A
// lookup miss, a 'hand' permit, or 'TBD' falls back to the old
// wording rather than inventing a tool — 'hand' can never be
// below-permit in practice (it is the lowest stage) and 'TBD'
// fails as 'permit-tbd', not here. The wording names the tool
// with no verb, so it reads right for both Harvest and Remove
// presses, which share this handler.
const PERMIT_TIER_TO_ITEM: Record<ToolTier, string> = {
  trowel: ITEMS.gardenTrowel,
  sharpTrowel: ITEMS.sharpTrowel,
  spade: ITEMS.spade,
  axeTrowel: ITEMS.axeTrowel,
  spadeAxe: ITEMS.spadeAxe,
  trundleTool: ITEMS.trundleTool,
};

function belowPermitText(sourceId: string): string {
  const permit = SOURCE_BY_ID[sourceId]?.permitTier;
  if (permit && permit !== 'hand' && permit !== 'TBD') {
    return `Needs ${displayNameFor(PERMIT_TIER_TO_ITEM[permit])}.`;
  }
  return 'Harvest failed: below-permit.';
}

function formatWeights(weights: BiomeWeights): string {
  const entries = Object.entries(weights.weights)
    .filter(([, w]) => w > 0.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return entries
    .map(([id, w]) => `${BIOME_BY_ID[id as keyof typeof BIOME_BY_ID].name} ${Math.round(w * 100)}%`)
    .join(' · ');
}

/** Clamp a screen percentage so a ground-at-feet button stays visible. */
function clampPercent(value: number): number {
  return Math.min(98, Math.max(2, value));
}

/** Carried fire item id → engine fire type, for placement. */
const FIRE_ITEM_TO_TYPE: Record<string, FireType> = {
  [ITEMS.campfire]: 'campfire',
  [ITEMS.hearth]: 'hearth',
  // The lit hearth (the hearth pick-up's return trip):
  // a picked-up lit hearth carries its fire in the
  // item id; it places as a hearth and stands lit
  // (the confirm reads hearthItemFireLit).
  [ITEMS.litHearth]: 'hearth',
  [ITEMS.kiln]: 'kiln',
};

/**
 * Carried house item id → engine house type, for placement.
 * The merged cottage stage: both recipe items map to
 * wovenCottage (wattle-and-daub + woven cottage are one stage).
 */
const HOUSE_ITEM_TO_TYPE: Record<string, HouseType> = {
  [ITEMS.primitiveLeanTo]: 'leanTo',
  [ITEMS.thatchHut]: 'thatchHut',
  [ITEMS.wattleAndDaubHut]: 'wovenCottage',
  [ITEMS.wovenCottage]: 'wovenCottage',
  [ITEMS.smallWoodenHut]: 'smallWoodenHut',
};

/** Item ids the inventory panel offers a Place button for.
 * Lit torches, altars, writing desks, campfires, and
 * tents ride this set for the BUTTON only — their
 * handlers branch to instant placement (see
 * handlePlaceItem), never the preview-ghost flow the
 * other ids (hearth/kiln/houses/looms) use. Since the
 * crosshair fold-in (2026-10-31) the instant family
 * splits by landing: torch / campfire / tent land at
 * the crosshair aim; altar / desk still land at her
 * feet, each awaiting its own word. */
const PLACEABLE_IDS: ReadonlySet<string> = new Set([
  ...Object.keys(FIRE_ITEM_TO_TYPE),
  ...Object.keys(HOUSE_ITEM_TO_TYPE),
  ITEMS.loom,
  ITEMS.litTorch,
  ITEMS.altar,
  ITEMS.writingDesk,
  ITEMS.craftedWorkstation,
  ITEMS.cauldron,
  ITEMS.tent,
  ITEMS.sleepingBag,
  // THE CARRYABLE TRAPS (the trap chunk, 2026-11-01):
  // their pack rows carry the Place verb like every
  // other placeable — the press arms the trap flow in
  // handlePlaceItem, never the instant family.
  ...CARRYABLE_TRAPS,
]);

const FIRE_NAME: Record<FireType, string> = {
  campfire: 'Campfire',
  hearth: 'Hearth',
  kiln: 'Kiln',
};

// QUEST ACT TITLES (dialog #4 amendment): the journal's
// quest log renders grouped by act. The act itself is
// Systems' data now (each definition carries it, and
// QUEST_ACTS pins the display names — Act I — Survival,
// Act II — Witchery); the shell only stamps the pinned
// NAME onto each display row. (This replaced the
// shell-side QUEST_ACT_OVERRIDES table the same day the
// data landed — one source, Systems'.)

// QUEST HINTS (draft one-liners, Adam pins before merge):
// one hint per Systems quest id, in priority order. The
// Make Campfire hint says PLACE (the predicate completes on
// a placed campfire, not a crafted one); the Wake a Charm
// hint says ritual (the outright shrew grant is not one).
const QUEST_HINTS: Record<string, string> = {
  'collect-food': 'Gather something edible — berries, acorns, mushrooms, apples.',
  'eat-when-hungry': 'Eat when hunger drops below fed.',
  'make-campfire': 'Place a campfire.',
  'light-campfire': 'Light a placed campfire.',
  'make-lean-to': 'Build a lean-to.',
  rest: 'Sleep until sunrise.',
  'find-flint': 'Pick up flint.',
  'make-torch': 'Craft a torch.',
  'light-torch': 'Light a torch for carried light.',
  'use-stump': 'Craft something at a stump workstation.',
  'upgrade-tool': 'Sharpen or upgrade the trowel.',
  'gather-clay': 'Gather clay.',
  'better-house': 'Raise a thatch hut.',
  'find-bone': 'Find a bone.',
  'wake-charm': 'Complete a Waking ritual.',
  'one-of-every-bone': 'Gather one bone of every kind.',
  // ALTAR PARITY (the desk claim's rider, 2026-11-01):
  // the step wording names the BASE, never one base —
  // a found stump or a built altar both carry the
  // consecration. DRAFT for Adam's pin pass.
  'raise-an-altar':
    'Consecrate a stump or a built altar: ring the base with river stones, draw the glyph, set the candle.',
};

/**
 * CRAFTING SECTIONS — ONE SHELF SYSTEM (Adam, 2026-10-31):
 * the crafting book files its recipes on the SAME shelves
 * as the inventory panel, so the two panels can never
 * drift apart. A recipe's section is Systems'
 * craftingSection(recipe) — the category of its OUTPUT
 * item in the inventory taxonomy — and the shelf order is
 * ITEM_CATEGORY_ORDER, the inventory's own. The UI-side
 * hand map that used to live here (Tools / Homes /
 * Fire & Workshop / Clothes / Materials & Carrying /
 * Traps) is DELETED: there is one shelf system now, and
 * this file only reads it. Sections stay SECTIONS in one
 * scroll, not tabs (Adam, 2026-10-26 — tabs would hide
 * recipes behind extra taps); order within a shelf is
 * recipe order (the shell filters, never re-sorts); an
 * empty shelf never renders. A recipe whose output reads
 * 'Other' (none measured — Systems counted every recipe
 * onto a real shelf) trails under "Other" rather than
 * vanishing, and "Owned & Superseded" stays the trailing
 * STATE section (sunk rows are not shelved).
 */
const SYSTEMS_RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

/**
 * Type predicate for failed fire results. This repo's tsconfig
 * does not narrow a discriminated union on `.ok` (non-strict),
 * so failure branches go through this predicate — the settled
 * pattern for union results here.
 */
function isFireFailure(
  result: FireResult,
): result is { ok: false; reason: string } {
  return !result.ok;
}

/** One placement in progress: what, and what engine type it becomes. */
interface PlacementMode {
  itemId: string;
  label: string;
  fireType?: FireType;
  houseType?: HouseType;
  /** True for a loom placement (loomState takes x/z only). */
  loom?: boolean;
  /**
   * The trap chunk (2026-11-01): a carried trap's type
   * when the armed placement is a trap. The confirm runs
   * Systems' placeCarriedTrap grant (the single placement
   * gate) instead of the shell's own consume — the grant
   * validates the site and consumes, the shell then seats
   * via trapState.placeTrap.
   */
  trapType?: string;
}

/**
 * UMBRELLA COORDINATION (Systems, 026b793, REVISED 89bba82):
 * item id ITEMS.umbrella ('umbrella'), recipe id 'umbrella'
 * (workstation, draft cost: 4 snap-wood + 6 tender vines + 4
 * twined cordage). The mechanic lives in systems/umbrella.ts:
 * precipitation protection UMBRELLA_PRECIPITATION_PROTECTION
 * (60%, a STARTING value for Adam's pin pass, not pinned —
 * this revision supersedes the earlier 35% rain-only value),
 * applied when the umbrella is IN INVENTORY — no equip step,
 * no worn slot, duplicates do not stack, precipitation axis
 * only (rain is that axis in today's weather model; the
 * factor covers whatever falling forms that axis carries),
 * multiplicative with worn clothes, and it counts against
 * capacity like any ordinary item. App keys the icon and the
 * precipitation note off this one id and that one constant —
 * a pin-pass change to the number flows through untouched.
 */
const UMBRELLA_ITEM_ID = ITEMS.umbrella;

/**
 * Touch look scale (turning fix, Adam 2026-10-26): touch
 * travel is far shorter than mouse travel, so raw pixels
 * under-turn — a 40 px thumb slide is 5.7° at the mouse
 * 0.0025 rad/px, and a right-drag from a natural thumb start
 * caps at ~90 px (12.9°) where a left-drag reaches 300 px
 * (43°). x3 (effective 0.0075 rad/px): 40 px = 17°,
 * 60 px = 26°, max-right 90 px = 39°. Lane-decided starting
 * value for Adam's pin pass; the engine's mouse sensitivity
 * and pitch clamp are untouched.
 */
const TOUCH_LOOK_SCALE = 3;

/**
 * Turn-stick rate: full stick deflection feeds the engine's
 * addLookDelta this many drag-equivalent px per second — 3
 * rad/s at the engine's 0.0025 rad/px, so a 90° turn takes
 * ~0.5 s at full deflection, ~1 s at half. Lane-decided
 * starting value for Adam's pin pass; pitch uses the same
 * rate and the engine's ±1.45 clamp still applies. The dead
 * zone lives in TouchControls (0.25, same as the move stick).
 */
const TURN_STICK_PX_PER_SEC = 1200;

/**
 * Foods that gain an Eat button in the inventory panel:
 * directly-eatable foods plus cook-required ones (raw acorns),
 * whose press surfaces the cook-first note instead of a gain.
 * Both lists come from Systems' hunger module — the UI holds
 * no food table of its own.
 */
const FOOD_IDS: ReadonlySet<string> = new Set([
  ...FOOD_ITEMS,
  ...COOK_REQUIRED_ITEMS,
]);

/**
 * Items that gain a Light button in the inventory panel:
 * unlit torches only (a lit torch is already lit — no dead
 * button on it). The press is the FLINT route of Systems'
 * batch lighting (flint + river-stone carried, both kept);
 * the fire route arrives with UI's lit-fire 'light torches'
 * pill, whose host menu opens in every state since UI's
 * lit-menu fix fe7b304.
 */
const TORCH_IDS: ReadonlySet<string> = new Set([ITEMS.torch]);
/** The salve's row verb set (the feral build): the one tendable item. */
const TENDABLE_IDS: ReadonlySet<string> = new Set([SALVE_ITEM]);

/**
 * Her books (First-Fragment Presentation, 2026-10-31;
 * THE READ GATE, Adam, 2026-11-01): both rows carry
 * the Read verb, but the doors differ now — the JOURNAL
 * is the field reader (its row opens the tally panel
 * anywhere); the GRIMOIRE is read at its desk (seated +
 * faced, the camp act on the desk winner's R), and its
 * carried row's Read speaks that rule instead of
 * opening anything. Carried = transport only.
 */
// The jar build: the water-jar row carries the Dump
// verb (the pour's aim arm). The empty jar carries
// none — filling lives on the water's own pill.
const DUMPABLE_IDS: ReadonlySet<string> = new Set(['water-jar']);
/**
 * The glow-paint build (2026-11-03): the dose item's
 * id, named by Systems in their moss-parts report
 * (the clump is 'twilight-fungus'; the dose renders
 * from it, 0.1 lb, Materials).
 */
const GLOW_DOSE_ID = 'glow-dose';
const APPLIABLE_IDS: ReadonlySet<string> = new Set([GLOW_DOSE_ID]);

/**
 * The douse-ables' row sets (the douse build, 2026-11-03;
 * Systems' scent.ts): the three brews carry Douse; the
 * mixed wash carries Wash; the filled jar carries Mix
 * (mixing the wash out of it). Literal ids, Systems'
 * built values.
 */
const DOUSEABLE_IDS: ReadonlySet<string> = new Set([
  'repellent',
  'prey-lure',
  'predator-lure',
]);
const WASHABLE_IDS: ReadonlySet<string> = new Set(['wash']);
const MIXABLE_IDS: ReadonlySet<string> = new Set(['water-jar']);
/** How far her arm reaches with a dose (DRAFT). */
const PAINT_REACH_M = 3;
/** The apply aim's certification, read live by the card. */
type ApplyAim = {
  cert: 'not-underground' | 'nothing-faced' | 'already-painted' | 'clear';
  surface: 'wall' | 'floor' | null;
};
/** The full certification: the aim plus the faced spot, when one stands. */
type ApplyCert = ApplyAim & {
  spot: {
    x: number;
    y: number;
    z: number;
    surface: 'wall' | 'floor';
    nx: number;
    nz: number;
  } | null;
};

// The shrew's wake door: the found shrew skull's row
// carries the Wake verb — Systems' charm-path grant,
// surfaceless since the gift retired (c6ee842).
const WAKEABLE_IDS: ReadonlySet<string> = new Set([FIRST_CHARM_ITEM]);

const READABLE_BOOK_IDS: ReadonlySet<string> = new Set([
  ITEMS.journal,
  ITEMS.grimoire,
]);

/** Engine house type → Systems house item (for HomeStorage). */
const HOUSE_TYPE_TO_ITEM: Record<HouseType, string> = {
  leanTo: ITEMS.primitiveLeanTo,
  thatchHut: ITEMS.thatchHut,
  wovenCottage: ITEMS.wovenCottage,
  smallWoodenHut: ITEMS.smallWoodenHut,
};

/** Systems' home-ladder rungs (recipe ids) back to the
 * engine's house types — the home-screen Upgrade press
 * consumes the price in Systems' rung terms, then runs
 * the engine's in-place upgrade in its type terms. */
const HOME_RUNG_TO_TYPE: Record<string, HouseType> = {
  'primitive-lean-to': 'leanTo',
  'thatch-hut': 'thatchHut',
  'woven-cottage': 'wovenCottage',
  'small-wooden-hut': 'smallWoodenHut',
};

/**
 * Pounds, trimmed: at most 2 decimals, trailing zeros dropped
 * ("12.5 lb", never "12.50 lb" or a raw float). Weights step
 * in 0.05 lb, so 2 decimals are exact; toFixed absorbs binary
 * noise (3 × 0.1 prints "0.30" before the strip, never
 * "0.30000000000000004").
 */
function formatLb(pounds: number): string {
  return pounds.toFixed(2).replace(/\.?0+$/, '') || '0';
}

/**
 * The weight unit as printed in the title-row one-liner.
 * Adam typed the format with "#" and delegated the unit
 * call (2026-10-29: "whichever (or another idea) looks
 * better on phone and PC"); UI rendered "#", spelled
 * "lb", and a tightened "lb" at phone and PC panel
 * widths and picked spelled "lb" — "#" reads as a
 * number sign / hashtag in the game's typeface, while
 * "lb" is unambiguous and matches the header's units.
 * This constant stays the single point that decides it.
 */
const TITLE_WEIGHT_UNIT = 'lb';

// TAG RANGES (tag claim, 2026-11-01 — DRAFT for Adam's
// pin pass): the ground tag and the trap tag read at
// the creature tag's cap (AnimalTag's TAG_RANGE_M) —
// one reading distance for every name in the world.
const GROUND_TAG_RANGE_M = 32;
const TRAP_TAG_RANGE_M = 32;

/**
 * One inventory row's title-row meta (the one-liner that
 * rides the item name's line — FORMAT PIN, Adam,
 * 2026-10-29: "Elderberries - 2 @ 0.1# each - 0.2#", name
 * first, then this segment, dash-separated, on ONE line;
 * the descriptor and buttons take the rows below). The
 * rendered pick (Adam delegated the byte) drops his
 * "each" — the "@" already carries the per-item
 * meaning — and spells the unit: "- 2 @ 0.1 lb - 0.2 lb",
 * the shortest clear form at both panel widths. This
 * helper is the single formatting point for the segment.
 * Excluded rows never show a counting number, or the row
 * would contradict the header total (which already
 * excludes them): carrying gear and worn garments exclude
 * the whole stack, and the owned tool excludes exactly
 * one unit — Systems' usedLb rule, mirrored here for
 * display only (Systems owns the math; this never
 * recomputes the total). A single item prints just its
 * count @ its weight (the total would repeat the unit
 * weight); above one, the total follows after a dash.
 */
function titleMetaFor(
  item: string,
  quantity: number,
  inventory: PersonalInventory,
): string {
  const id = item as ItemId;
  if (isCarryingGear(id) || inventory.wornItems().includes(id)) {
    return '- carried free';
  }
  const owned = ownedToolItem(inventory);
  if (id === owned) {
    if (quantity <= 1) return '- carried free';
    return `- ${formatLb((quantity - 1) * weightOf(id))} ${TITLE_WEIGHT_UNIT} · 1 carried free`;
  }
  const each = weightOf(id);
  if (quantity <= 1) {
    return `- 1 @ ${formatLb(each)} ${TITLE_WEIGHT_UNIT}`;
  }
  return `- ${quantity} @ ${formatLb(each)} ${TITLE_WEIGHT_UNIT} - ${formatLb(quantity * each)} ${TITLE_WEIGHT_UNIT}`;
}

/**
 * The pile rows' titleMeta (PILE WEIGHTS, 2026-11-01 —
 * Adam: "I don't see weights in the piles dialog"): the
 * FORMAT PIN's typography over an explicit stack
 * quantity, from weightOf — the same arithmetic as
 * titleMetaFor WITHOUT its pack facts (carried-free and
 * the owned-tool rule are statements about her pack,
 * not about a pile). The caller appends the OTHER
 * count (carried for a pile row, the pile's zero for a
 * deposit row) as the appendix.
 */
function pileTitleMetaFor(item: string, quantity: number): string {
  const id = item as ItemId;
  const each = weightOf(id);
  if (quantity <= 1) {
    return `- 1 @ ${formatLb(each)} ${TITLE_WEIGHT_UNIT}`;
  }
  return `- ${quantity} @ ${formatLb(each)} ${TITLE_WEIGHT_UNIT} - ${formatLb(quantity * each)} ${TITLE_WEIGHT_UNIT}`;
}

/**
 * The one note rule for item rows (descriptor wiring,
 * 2026-10-29 — Adam ordered brief descriptors for pretty
 * much all items): a primal bone reads Systems' boneNote
 * (its canonical note — the descriptor table deliberately
 * omits bone ids); every other item reads its
 * ITEM_DESCRIPTIONS line via descriptionFor. Unknown id =
 * undefined = no note, as before. ONE helper for personal
 * rows and home-storage rows alike — the rule must not
 * fork. All descriptor lines are DRAFT (Systems' table,
 * Adam's pin pass).
 */
function itemNoteFor(item: string, charms: CharmState): string | undefined {
  const kind = boneKindFor(normalizeItemId(item));
  return kind === null ? descriptionFor(item) : boneNote(kind, charms);
}

/**
 * HOUSING LADDER LINES (Adam, 2026-10-29 — he didn't know
 * the feature existed: placing a higher house item facing
 * a lower placed house upgrades it in place, while facing
 * open ground places another house; BOTH paths stay, no
 * craft gate — the panel states the ladder truthfully,
 * display only, and never as a 'Requires:'). Keyed by the
 * house ITEM ids; the step order mirrors HOUSE_LADDER in
 * src/game/shelter.ts (leanTo → thatchHut → wovenCottage
 * → smallWoodenHut, item ids primitive-lean-to →
 * thatch-hut → woven-cottage → small-wooden-hut) — if
 * that order ever changes, these lines must change with
 * it. Copy is DRAFT for Adam's pin pass. Non-house items
 * are absent from the table = no line.
 */
const HOUSING_LADDER_LINES: Record<string, string> = {
  'primitive-lean-to':
    'House ladder, step 1 of 4 — the first house; bigger houses can upgrade it in place.',
  'thatch-hut':
    'House ladder, step 2 of 4 — place it facing a Lean-To to upgrade it in place, or place it on its own.',
  'woven-cottage':
    'House ladder, step 3 of 4 — upgrades a placed Lean-To or Thatch Hut in place, or place it on its own.',
  'small-wooden-hut':
    'House ladder, step 4 of 4 — upgrades any placed house below it in place, or place it on its own.',
};

function housingLadderLineFor(item: string): string | undefined {
  return HOUSING_LADDER_LINES[normalizeItemId(item)];
}

/** One inventory stack as a panel row, with the umbrella icon attached. */
function toInventoryItem(
  stack: {
    item: string;
    quantity: number;
  },
  inventory: PersonalInventory,
  charms: CharmState,
): InventoryItem {
  return {
    id: stack.item,
    // Display spelling, never the raw code id (Adam, 2026-10-26:
    // code spelling lives in code, display spelling lives in
    // the systems table). The id stays the key for actions.
    name: displayNameFor(stack.item),
    // Title-row one-liner via the single formatting point
    // (titleMetaFor, above — FORMAT PIN, Adam 2026-10-29).
    // Personal rows carry titleMeta INSTEAD of the old
    // quantityText/weightText pair; storage rows still
    // build their own quantityText rows elsewhere.
    titleMeta: titleMetaFor(stack.item, stack.quantity, inventory),
    // Sort category (inventory sorting, 2026-10-31):
    // Systems' table decides the Grouped bucket; the
    // panel only prints it.
    category: categoryFor(stack.item as ItemId),
    icon: stack.item === UMBRELLA_ITEM_ID ? <UmbrellaIcon /> : undefined,
    // Row note via the one rule (itemNoteFor, above):
    // primal bones read boneNote (raw: 'Needs a ritual
    // site'; awakened: 'Tier <n> · <effect phrase>' —
    // Systems' canonical note since the individual-bone
    // build; phrases DRAFT); every other stack reads its
    // descriptor (descriptor wiring, 2026-10-29). The
    // sleeping bag's old 'Bedding' category note is GONE:
    // its authored descriptor supersedes it.
    note: itemNoteFor(stack.item, charms),
  };

}



/** One-shot localStorage key for the folded new-game
 * flow (dialog audit claim 3, 2026-10-31): Begin in the
 * new-game dialog stashes the entered name/seed here
 * before the park + reload; the fresh boot consumes it
 * in place of the first-run dialog. */
const PENDING_NEW_WORLD_KEY = 'silent-earth-pending-new-world';

function readPendingNewWorld(): { name: string; seed: string } | null {
  try {
    const raw = window.localStorage.getItem(PENDING_NEW_WORLD_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { name?: unknown; seed?: unknown };
    if (typeof parsed.name !== 'string' || typeof parsed.seed !== 'string') {
      return null;
    }
    return { name: parsed.name, seed: parsed.seed };
  } catch {
    return null;
  }
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);
  const playerRef = useRef<PlayerController | null>(null);

  // Save boot-load (see ./systems/save.ts): read once, before any
  // state below is created, so seed / inventory / hunger / worn /
  // camera all start from the save, not from defaults. Null =
  // fresh start (no save, or a corrupt one — never a crash).
  // The ref-lazy pattern matches the inventory/hunger/wardrobe
  // blocks below; the value never changes after first render.
  const bootSaveRef = useRef<SaveData | null | undefined>(undefined);
  if (bootSaveRef.current === undefined) {
    bootSaveRef.current = loadSave();
  }
  const bootSave = bootSaveRef.current;

  // Pending new world (claim 3): read once, lazily like
  // bootSave. A non-null value means the folded new-game
  // dialog was already seen and begun before the reload
  // that produced this boot — its name/seed apply through
  // the first-run Begin path (effect below) and the
  // dialog never shows a second time.
  const pendingNewWorldRef = useRef<
    { name: string; seed: string } | null | undefined
  >(undefined);
  if (pendingNewWorldRef.current === undefined) {
    pendingNewWorldRef.current = readPendingNewWorld();
  }
  const pendingNewWorld = pendingNewWorldRef.current;

  const genRef = useRef(createWorldGen(bootSave?.seed ?? DEFAULT_SEED));

  // The shell owns the one personal inventory, built directly
  // with the ruled large-basket mode (see the header — 'replace',
  // pinned by Adam 2026-10-26, total 70).
  const inventoryRef = useRef<PersonalInventory | null>(null);
  if (inventoryRef.current === null) {
    inventoryRef.current = new PersonalInventory({
      largeBasketMode: 'replace',
      // Restored stacks arrive normalized (save.ts never persists
      // UPPER ids) and the constructor merges spelling duplicates.
      initial: bootSave?.inventory,
      // Acquisition order restored with the pack (inventory
      // sorting, 2026-10-31): the Recent sort's memory; the
      // constructor keeps only kinds actually held, so a
      // legacy save's absence (undefined) seeds empty and
      // gains rebuild it.
      acquisitionOrder: bootSave?.acquisitionOrder,
    });
  }
  const inventory = inventoryRef.current;

  // The shell owns the one hunger meter, built directly (starts
  // fully fed). Systems owns the meter's shape; the shell owns
  // the instance, ticks it, and hands its stage query to the
  // engine consumers (see the boot effect). One meter, read
  // everywhere — no second hunger value lives in this file.
  const hungerRef = useRef<HungerState | null>(null);
  if (hungerRef.current === null) {
    // Saved value when present; the constructor default (full)
    // applies when bootSave is null or its hunger is undefined.
    hungerRef.current = new HungerState(bootSave?.hunger);
  }
  const hunger = hungerRef.current;
  const [hungerStage, setHungerStage] = useState<HungerStage>(
    hunger.stage(),
  );
  // Render mirror of the same one meter (hunger.value(), 0–100)
  // — not a second value. Refreshed on the 1 s tick and on eat,
  // alongside the stage, so the indicator's bar + number move
  // with the meter.
  const [hungerValue, setHungerValue] = useState<number>(hunger.value());

  // The shell owns the one cold/wet meter pair, like the
  // one hunger meter (W2/W3 of the weather build, Systems'
  // ColdWetState; DEV's composition settlement 2026-11-02):
  // built here from the save's gauges, ticked on the 1 s
  // clock below with facts the shell composes, seated in
  // every save. The witness reads this state; nothing else
  // keeps a cold or wet value anywhere.
  const coldWetRef = useRef<ColdWetState | null>(null);
  if (coldWetRef.current === null) {
    coldWetRef.current = new ColdWetState(bootSave?.coldWet);
  }
  const coldWet = coldWetRef.current;
  const [coldWetUi, setColdWetUi] = useState<{
    cold: { value: number; stage: ColdStageKey };
    wet: { value: number; stage: WetStageKey };
  }>(() => coldWet.vitals());
  // THE FERAL SEATS (the feral build, 2026-11-03;
  // Systems' core a6f501f + 591b45f): the shell owns the
  // one InjuryState and the one FeralEncounterState, on
  // the coldWet pattern — built here from the save,
  // snapshotted into every save. The witness reads the
  // stage mirror; nothing else keeps an injury stage or
  // a warned-id anywhere. lastSleepSite is the
  // crawl-back's encampment record: stamped where a
  // sleep completes (the sleep:completed consumer),
  // read only when a down fires.
  const injuryRef = useRef<InjuryState | null>(null);
  if (injuryRef.current === null) {
    const seated = new InjuryState();
    seated.restore(bootSave?.injury);
    injuryRef.current = seated;
  }
  const injury = injuryRef.current;
  // THE SCENT SEAT (the douse build, 2026-11-03;
  // Systems' scent.ts): the shell owns the one
  // ScentState on the injury pattern — built here
  // from the save, snapshotted into every save,
  // ticked on the 1 s clock. The witness reads the
  // fact mirror; the feral facts provider reads
  // isRepelling() live.
  const scentRef = useRef<ScentState | null>(null);
  if (scentRef.current === null) {
    const seated = new ScentState();
    seated.restore(bootSave?.scent);
    scentRef.current = seated;
  }
  const scentState = scentRef.current;
  const feralRef = useRef<FeralEncounterState | null>(null);
  if (feralRef.current === null) {
    const seated = new FeralEncounterState();
    seated.restore(bootSave?.feralWarned);
    feralRef.current = seated;
  }
  const lastSleepSiteRef = useRef<{ x: number; z: number } | null>(
    bootSave?.lastSleepSite ?? null,
  );
  const [injuryUi, setInjuryUi] = useState<{ stage: InjuryStage }>(() => ({
    stage: injury.stage(),
  }));
  // The witness refresh is also the EFFECTS SYNC:
  // every stage-affecting path funnels through here —
  // strikes, tends, sleeps, wakes, and the 1 s tick —
  // so neither the inventory's capacity multiplier
  // (Systems' seat 9f8fd00) nor the renderer's injury
  // speed factor (Background's seat, DEV's engine-side
  // ruling) ever sits a stage behind the ladder.
  // Idempotent by design (the charm-bonus sync idiom).
  const refreshInjuryUi = () => {
    const effects = injury.effects();
    inventory.setCapacityMultiplier(effects.carryMultiplier);
    rendererRef.current?.setInjurySpeedFactor(effects.movementMultiplier);
    setInjuryUi({ stage: injury.stage() });
  };
  const [scentUi, setScentUi] = useState<{
    kind: 'repellent' | 'attractor' | null;
    category: string | null;
  }>(() => {
    const facts = scentState.scent();
    return { kind: facts.kind, category: facts.category };
  });
  // The scent mirror refresh: the witness shows
  // words, not seconds, so callers refresh on acts
  // (douse/wash) and the 1 s tick refreshes only
  // when the word could change (kind/category flip
  // or the clock running out).
  const refreshScentUi = () => {
    const facts = scentState.scent();
    setScentUi({ kind: facts.kind, category: facts.category });
  };
  // THE CRAWL-BACK BEAT (the staging, UI's under Adam's
  // trust, 2026-11-03): while a down's staging stands,
  // the world is covered and input waits — the executor
  // below performs the move inside the black, then the
  // beat clears onto the waking. Phase: 'fall' (fading
  // in, line not yet shown), 'line' (the held beat),
  // 'wake' (fading out over the encampment).
  const [crawlBeat, setCrawlBeat] = useState<{
    line: string;
    phase: 'fall' | 'line' | 'wake';
  } | null>(null);
  const crawlBeatRef = useRef(false);

  // THE STANDING DEFENDER (the feral build): a bonded
  // companion of a guarding kind, close enough to take
  // a strike's place (12 m, DRAFT). One composition,
  // two consumers: the renderer's facts provider (the
  // behavior prices the defender's body as the target)
  // and the strike door's resolveStrike facts.
  const standingDefender = (): { x: number; z: number } | null => {
    const renderer = rendererRef.current;
    const player = playerRef.current;
    if (!renderer || !player) return null;
    const bonded = new Map<string, SavedCompanion>();
    for (const record of companionStateRef.current?.snapshot() ?? []) {
      bonded.set(record.creatureId, record);
    }
    for (const animal of renderer.getVisibleAnimals()) {
      const record = bonded.get(animal.id);
      if (!record) continue;
      if (record.bond !== 'companion' && record.bond !== 'familiar') {
        continue;
      }
      if (!guardsKind(record.kind)) continue;
      if (Math.hypot(animal.x - player.x, animal.z - player.z) <= 12) {
        return { x: animal.x, z: animal.z };
      }
    }
    return null;
  };

  // THE FERAL FACTS PROVIDER (Background's contract,
  // renderer.setFeralFactsProvider): identity + the
  // defender's seat. Null for everything that is not a
  // feral of a dangerous kind — unregistered or
  // null-answering, no encounter can form. Installed
  // on the renderer at construction (below); the
  // closure reads live refs, so this one definition
  // serves the session.
  const feralFactsProvider = (animal: {
    id: string;
    kind: string;
  }): {
    defenderPos: { x: number; z: number } | null;
    repelled?: boolean;
  } | null => {
    if (!isFeral(animal.id)) return null;
    if (
      !(FERAL_DANGEROUS_KINDS as readonly string[]).includes(animal.kind)
    ) {
      return null;
    }
    return {
      defenderPos: standingDefender(),
      // THE REPELLENT rides the same channel
      // (Background's seam, the douse build): the
      // renderer ORs it into suppression beside
      // safe country — ferals only, the bond road
      // never sees this channel.
      repelled: scentState.isRepelling(),
    };
  };

  // THE FERAL DOOR (the feral build, 2026-11-03; the
  // bus contract is Background's, events.ts): the
  // world emits 'animal:feral-contact' when a strike
  // lunge completes in range; the shell answers — it
  // holds the ledger and the ladder, resolves through
  // Systems' resolveStrike in the pinned fairness
  // order, applies the outcome, and reports it back
  // on 'animal:feral-resolved' (on 'warning' the
  // renderer breaks the animal off and displaces
  // her). Registered once; everything it touches is
  // a ref-held instance or a module singleton, so the
  // first closure stays live (the harvest listeners'
  // pattern).
  useEffect(() => {
    refreshInjuryUi();

    // The waking, shared by every down path: dawn of
    // the next day, the hungry floor, hurt — never
    // sound (the crawl is the recovery's beginning).
    const finishWake = () => {
      const renderer = rendererRef.current;
      const sky = renderer?.snapshotSky();
      renderer?.restoreSky({
        cycleT: 0,
        daysElapsed: (sky?.daysElapsed ?? 0) + 1,
      });
      const delta = WAKE_HUNGER - hunger.value();
      if (delta > 0) hunger.restore(delta);
      else if (delta < 0) hunger.drain(-delta);
      setHungerStage(hunger.stage());
      setHungerValue(hunger.value());
      injury.wakeFromDown();
      refreshInjuryUi();
      refreshInventory();
      saveNow();
    };

    const executeCrawlBack = (fallX: number, fallZ: number) => {
      // The fallen pile: Systems' plan over the pack,
      // the exempt set composed here (the finalized
      // claim): the owned ladder tool, what she wears,
      // and awakened charms are never the toll.
      const exempt = new Set<string>();
      const tool = ownedToolItem(inventory);
      if (tool !== 'none') exempt.add(tool);
      for (const wornItem of inventory.wornItems()) exempt.add(wornItem);
      for (const stack of inventory.stacksSnapshot()) {
        if (charmStateRef.current?.isAwakened(stack.item)) {
          exempt.add(stack.item);
        }
      }
      const plan = planCrawlBack(inventory, exempt, Math.random);
      for (const stack of plan.dropped) {
        inventory.remove(stack.item as ItemId, stack.quantity);
        pileState.drop(stack.item, stack.quantity, fallX, fallZ);
      }
      // The move: out of any dimension first (the
      // encampment is a surface seat). If the way out
      // refuses, she wakes where she fell — the pile
      // is there, and no inconsistent state is made.
      const renderer = rendererRef.current;
      const player = playerRef.current;
      const gen = genRef.current;
      if (dimensionState.isUnderground() && renderer && player) {
        const out = exitCave(renderer, player);
        if (out.ok === false) {
          finishWake();
          return;
        }
      }
      if (player && gen) {
        const home = homedHouse();
        const firstHouse = shelterState.snapshot()[0];
        const boundHome = home
          ? { x: home.x, z: home.z }
          : firstHouse
            ? { x: firstHouse.x, z: firstHouse.z }
            : null;
        const target = resolveEncampment(
          lastSleepSiteRef.current,
          boundHome,
          gen.findSpawn(),
        );
        // The placeAt pattern (dimensionTravel): a
        // travel IS a move, so the emit rides along.
        player.x = target.x;
        player.z = target.z;
        bus.emit('player:moved', {
          x: player.x,
          z: player.z,
          chunkX: Math.floor(player.x / CHUNK_SIZE),
          chunkZ: Math.floor(player.z / CHUNK_SIZE),
        });
      }
      finishWake();
    };

    const WOUND_LINES: Record<string, string> = {
      hurt: 'teeth find her — she is hurt.',
      wounded: 'tears at her again — wounded.',
      critical: 'nearly has her — one more landing like that and she goes down.',
    };

    const offStrike = bus.on('animal:feral-contact', ({ id }) => {
      if (crawlBeatRef.current) return;
      const ledger = feralRef.current;
      if (!ledger) return;
      // The contact payload carries the id alone; the
      // kind is the feed's fact for that id (the animal
      // is at her feet, in the visible set by
      // construction).
      const kind =
        rendererRef.current
          ?.getVisibleAnimals()
          .find((animal) => animal.id === id)?.kind ?? 'beast';
      const outcome = ledger.resolveStrike(id, {
        defenderPresent: standingDefender() !== null,
        injuryStage: injury.stage(),
      });
      // The outcome goes back to the world at once —
      // on 'warning' the renderer breaks the animal
      // off and displaces her; the rest are the record.
      bus.emit('animal:feral-resolved', { id, outcome });
      if (outcome === 'warning') {
        showFeedback(
          `The ${kind} lunges — a warning. It will not warn her twice.`,
          'blocked',
        );
        saveNow();
        return;
      }
      if (outcome === 'intercepted') {
        showFeedback('Her defender takes the blow meant for her.', 'info');
        return;
      }
      if (outcome === 'wound') {
        injury.strike();
        refreshInjuryUi();
        const stage = injury.stage();
        showFeedback(
          `The ${kind} ${WOUND_LINES[stage] ?? 'strikes her.'}`,
          'blocked',
        );
        saveNow();
        return;
      }
      // THE DOWN: the staging covers the world, the
      // executor works inside the black, and the beat
      // clears onto the waking.
      const player = playerRef.current;
      const fallX = player?.x ?? 0;
      const fallZ = player?.z ?? 0;
      crawlBeatRef.current = true;
      const line =
        'The wild got the better of her. She crawls back to her last fire ' +
        'and wakes with the dawn — some of what she carried lies where she fell.';
      setCrawlBeat({ line, phase: 'fall' });
      window.setTimeout(() => setCrawlBeat({ line, phase: 'line' }), 750);
      window.setTimeout(() => executeCrawlBack(fallX, fallZ), 1500);
      window.setTimeout(() => setCrawlBeat({ line, phase: 'wake' }), 3600);
      window.setTimeout(() => {
        setCrawlBeat(null);
        crawlBeatRef.current = false;
      }, 4400);
    });
    return () => {
      offStrike();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The LocationChip's reserved second line (date +
  // weather word), composed on the same 1 s cadence from
  // W1's facts; null until the first facts land, so the
  // chip renders no second line before the world steps.
  const [chipLine, setChipLine] = useState<string | null>(null);
  // Edge memory for the witness's feed lines: the stages
  // and rain state the last tick saw. Null = unseated;
  // the first tick seats them silently.
  const coldWetEdgesRef = useRef<{
    cold: ColdStageKey;
    wet: WetStageKey;
    raining: boolean;
  } | null>(null);

  // The shell owns the one wardrobe, like the one inventory and
  // the one hunger meter. Wear/remove go through it; capacity
  // follows via inventory.setWorn (see the handlers below).
  const wardrobeRef = useRef<Wardrobe | null>(null);
  if (wardrobeRef.current === null) {
    wardrobeRef.current = new Wardrobe();
    // Restored worn list: inventory is already seeded above, so
    // wear()'s ownership check passes for saved garments. A
    // saved worn id no longer carried is skipped, not fatal —
    // capacity follows via setWorn, as in the wear handlers.
    if (bootSave?.worn) {
      for (const id of bootSave.worn) {
        try {
          wardrobeRef.current.wear(inventory, id);
        } catch {
          // Saved garment no longer carried — leave it unworn.
        }
      }
      inventory.setWorn(wardrobeRef.current.wornItemIds());
    }
  }
  const wardrobe = wardrobeRef.current;
  const [wornGarments, setWornGarments] = useState<WornGarment[]>(() =>
    wardrobe.wornGarments(),
  );

  // THE WEATHER COMPOSITION (W3; DEV's settlement: one
  // composition, shell-owned). One facts record per tick,
  // built from the live reads at her position: W1's
  // atmospheric half (currentWeatherFacts — stepped by
  // the renderer on the sky's own clock), the engine's
  // shelterAt (houses + tents, best-of), fire warmth from
  // fireState's lit fires on the module header's draft
  // curve (full within 2.5 m, none past 5 m, linear
  // between; torches are not PlacedFires and do not
  // count in v1), immersion from siteWaterFacts (wading
  // only — the engine has no swimming), and the
  // wardrobe's worn set. Null when the weather has not
  // stepped yet (no world) — the gauges simply don't
  // tick, they never tick on invented facts.
  const composeColdWetFacts = (
    x: number,
    z: number,
  ): ColdWetFacts | null => {
    const wf = currentWeatherFacts();
    if (!wf || !genRef.current) return null;
    const shelter = shelterAt(
      x,
      z,
      shelterState.snapshot(),
      placedTentsRef.current,
    );
    // RAINSHELTER (the amended drying law's shell half,
    // 2026-11-05): the fraction of the rain that REACHES
    // her through the roof overhead — the better of the
    // placed shelter's roof class and any found
    // structure's (the farmhouse roof, a village house),
    // priced enclosed/tent 0 (no rain reaches her),
    // lean-to 0.5 (DRAFT — it leaks), open sky 1.
    // Systems' soak reads this fact for its rain term
    // in place of the shelter multiplier; absent a roof
    // read the composition still answers 1, never a
    // guess at cover she does not have.
    const roofRain = (roof: string): number =>
      roof === 'enclosed' || roof === 'tent'
        ? 0
        : roof === 'leanTo'
          ? 0.5
          : 1;
    const rainShelter = Math.min(
      roofRain(shelter.roof),
      roofRain(siteShelterAt(genRef.current, x, z)?.roof ?? 'none'),
    );
    let fireWarmth = 0;
    for (const fire of fireState.snapshot()) {
      if (!fire.lit) continue;
      const d = Math.hypot(fire.x - x, fire.z - z);
      const w = d <= 2.5 ? 1 : d >= 5 ? 0 : (5 - d) / 2.5;
      if (w > fireWarmth) fireWarmth = w;
    }
    // THE HEARTHHOME COMPOSITION (the door build,
    // 2026-11-06): inside a seal, Systems' reads grade
    // the facts — the shelter multiplier steps one grade
    // better at T1 and reads perfect at T2
    // (hearthhomeShelterMultiplier over the placed
    // shelter's base), and a lit hearth OF THE PLACE (a
    // lit fire standing inside the same seal) warms the
    // whole footprint at T1 (hearthhomeFireWarmth over
    // the proximity base). Outside a seal, or under an
    // unlearned mark, both reads pass the base through.
    const hhState = hearthhomeStateRef.current;
    const herSeal = hhState.sealAt(x, z);
    const hearthLit =
      herSeal !== undefined &&
      fireState
        .snapshot()
        .some(
          (fire) =>
            fire.lit &&
            hhState.sealAt(fire.x, fire.z)?.placeId === herSeal.placeId,
        );
    fireWarmth = hearthhomeFireWarmth(
      hhState,
      fragmentStateRef.current,
      x,
      z,
      hearthLit,
      fireWarmth,
    );
    return {
      rainIntensity: wf.rainIntensity,
      wind: wf.wind,
      harshness: wf.harshness,
      cold: wf.cold,
      spell: wf.spell,
      immersion: siteWaterFacts(genRef.current, x, z).inWater
        ? 'wading'
        : 'none',
      shelterMultiplier: hearthhomeShelterMultiplier(
        hhState,
        fragmentStateRef.current,
        x,
        z,
        shelter.multiplier,
      ),
      rainShelter,
      fireWarmth,
      worn: wardrobe.wornItemIds(),
    };
  };

  // The chip's date line from W1's clock (DRAFT form —
  // the W4 pin pass settles weekday/year): the world
  // opened Sep 1 = Day 1, months run 30 days on the
  // spell machine's axis. The weather word names the
  // precipitation AT HER — read, never inferred.
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November',
    'December',
  ];
  const chipLineFor = (facts: {
    dayFloat: number;
    rainIntensity: number;
    isRaining: boolean;
  }): string => {
    const dayIndex = Math.floor(facts.dayFloat) + 1;
    const dayOfMonth = Math.floor(facts.dayFloat % 30) + 1;
    const monthIndex = 9 + Math.floor(facts.dayFloat / 30);
    const monthName = MONTH_NAMES[(monthIndex - 1) % 12];
    const word = facts.isRaining
      ? facts.rainIntensity < 0.35
        ? 'Rain, light'
        : facts.rainIntensity < 0.75
          ? 'Rain, steady'
          : 'Downpour'
      : 'Dry';
    return `Day ${dayIndex} · ${dayOfMonth} ${monthName} · ${word}`;
  };

  // FEED LINES for state changes (DRAFT copy — W4):
  // spoken on stage EDGES only, detected shell-side
  // against the edge memory, so Systems' module stays
  // presentation-free (the hunger pattern). Rising wet
  // speaks each rung; drying speaks only when she is
  // dry again (no damp/dry flicker chatter). Cold speaks
  // each worse rung; warming speaks when she lands back
  // at chilly or comfortable from a worse rung. Rain
  // edges speak their own lines. During sleep the same
  // function runs once on the net change (rain edges
  // excluded — the waking tick owns those).
  const speakColdWetEdges = (
    prev: { cold: ColdStageKey; wet: WetStageKey; raining: boolean },
    next: { cold: ColdStageKey; wet: WetStageKey; raining: boolean },
    includeRain: boolean,
  ): void => {
    if (includeRain && next.raining !== prev.raining) {
      showFeedback(
        next.raining ? 'Rain begins.' : 'The rain eases off.',
        'info',
      );
    }
    if (next.wet !== prev.wet) {
      if (next.wet === 'damp' && prev.wet === 'dry') {
        showFeedback('Your clothes are damp.', 'info');
      } else if (next.wet === 'wet') {
        showFeedback('The wet is soaking through.', 'info');
      } else if (next.wet === 'soaked') {
        showFeedback('You are soaked to the skin.', 'blocked');
      } else if (next.wet === 'dry') {
        showFeedback('You are drying off.', 'gain');
      }
    }
    if (next.cold !== prev.cold) {
      const rank: Record<ColdStageKey, number> = {
        comfortable: 0,
        chilly: 1,
        cold: 2,
        freezing: 3,
      };
      if (rank[next.cold] > rank[prev.cold]) {
        if (next.cold === 'chilly') {
          showFeedback('A chill is getting into you.', 'info');
        } else if (next.cold === 'cold') {
          showFeedback('The cold is biting now.', 'blocked');
        } else if (next.cold === 'freezing') {
          showFeedback('You are dangerously cold.', 'blocked');
        }
      } else if (next.cold === 'comfortable' || next.cold === 'chilly') {
        showFeedback('You are warming up.', 'gain');
      }
    }
  };

  // One cold/wet tick + witness refresh + edge speech,
  // shared by the 1 s clock and the sleep rider. Returns
  // false when no facts stand (the gauges hold).
  const tickColdWet = (dtSeconds: number, x: number, z: number): boolean => {
    const facts = composeColdWetFacts(x, z);
    if (!facts) return false;
    coldWet.tick(dtSeconds, facts);
    setColdWetUi(coldWet.vitals());
    refreshInjuryUi();
    const wf = currentWeatherFacts();
    if (wf) setChipLine(chipLineFor(wf));
    const next = {
      cold: coldWet.coldStage(),
      wet: coldWet.wetStage(),
      raining: wf?.isRaining ?? false,
    };
    const prev = coldWetEdgesRef.current;
    if (prev) speakColdWetEdges(prev, next, true);
    coldWetEdgesRef.current = next;
    return true;
  };
  const [wardrobeNote, setWardrobeNote] = useState<string | null>(null);

  // Live shelter state, from the engine's shelter tracking
  // (shelter:changed on movement, shelter:placed on placement).
  const [sheltered, setSheltered] = useState(false);
  const [shelterHouseName, setShelterHouseName] = useState<
    string | undefined
  >(undefined);
  const [shelterHouseId, setShelterHouseId] = useState<string | null>(null);

  /** Apply a sheltering house id (null = unsheltered) to HUD state. */
  const applyShelterHouse = (houseId: string | null) => {
    if (houseId === null) {
      setSheltered(false);
      setShelterHouseName(undefined);
      setShelterHouseId(null);
      return;
    }
    const house = shelterState.snapshot().find((h) => h.id === houseId);
    setSheltered(true);
    setShelterHouseName(house ? HOUSE_DEFS[house.type].name : undefined);
    setShelterHouseId(houseId);
    // THE STORE RESOLVES WHEN SHE SHELTERS (the upgrade
    // door's fix, 2026-11-02): the home menu's Upgrade
    // row and the storage section both READ the house's
    // HomeStorage through openHomeStore, which never
    // creates one — so a house placed this session,
    // whose store only a deposit (or the boot restore)
    // would have created, showed no Upgrade row at all:
    // Adam's 'there doesn't seem to be a way to upgrade
    // a lean-to' was a store that did not exist yet,
    // not a missing door. Creating it here — an event
    // path (proximity cadence, placement, boot), never
    // a render — seats the store from the moment she is
    // home, and every reader downstream finds it.
    getHomeStore(houseId);
  };

  // Night gate for the sleep button, read from the live sky
  // (see the 1 s timer): true when the engine's own cycle
  // split says night at the world's fixed start month.
  const [isNight, setIsNight] = useState(false);

  // SLEEP (Adam, 2026-10-28 — moved): Rest lives in the
  // home menu, not the shelter indicator (the indicator
  // button sat far left where it went unnoticed; the menu
  // is where Rest belongs). The menu's Rest row runs
  // handleSleep unchanged: it emits the sleep request
  // { x, z } — her position at press time — that the
  // engine's sleep listener acts on: it checks night,
  // then shelter (from the position), and jumps the sky
  // to dawn, time-only, no restore. The one listener lives
  // in the boot effect below (createSleepListener);
  // outcomes: 'sleep:failed' needs no UI action (failures
  // show nothing per the brief's no-invented-text rule);
  // 'sleep:completed' raises the WAKE MESSAGE since
  // 2026-10-29 (Adam's order — see the consumer beside
  // handleSleep); the dawn jump disables the row via the
  // night gate either way. Daytime shows the row disabled
  // with a "Night only" note; the menu stays open after
  // a Rest press.
  const handleSleep = (): void => {
    const player = playerRef.current;
    if (!player) return;
    bus.emit('sleep:requested', { x: player.x, z: player.z });
  };

  // WAKE MESSAGE (Adam, 2026-10-29: a completed sleep
  // showed NOTHING — the dawn jump was the only signal;
  // "We need a message indicating that we have done so,
  // and it's dawning"): a third consumer of
  // 'sleep:completed' (beside groundhog wake + the quest
  // flag, in the boot effect) — it sets a transient
  // screen-level notice that clears itself after a few
  // seconds. 'sleep:failed' has no consumer here:
  // failures stay silent, as before. Copy is DRAFT for
  // Adam's pin pass.
  const [wakeNote, setWakeNote] = useState<string | null>(null);
  useEffect(() => {
    const off = bus.on('sleep:completed', () => {
      setWakeNote("You slept through the night. It's dawning.");
    });
    return off;
  }, []);
  useEffect(() => {
    if (wakeNote === null) return;
    const timer = setTimeout(() => setWakeNote(null), 5000);
    return () => clearTimeout(timer);
  }, [wakeNote]);

  // SLEEP RIDER (W3; Systems' law, DEV's settlement):
  // the cold/wet gauges keep ticking while she sleeps —
  // a free night would unmake shelter. The request
  // stashes the night's composed facts + the sky
  // position the night starts from; the completion
  // ticks the skipped span (cycleT -> dawn on the
  // 10-minute day) in minute chunks on those facts, so
  // a night in the rain under a lean-to costs what the
  // same minutes awake would cost. Edge speech runs
  // once, on the net change, when she wakes.
  const sleepTickRef = useRef<{
    cycleT: number;
    facts: ColdWetFacts;
    x: number;
    z: number;
    site: 'bag' | 'tent' | null;
  } | null>(null);
  useEffect(() => {
    const offRequest = bus.on('sleep:requested', ({ x, z }) => {
      const cycleT = rendererRef.current?.snapshotSky()?.cycleT;
      const composed = composeColdWetFacts(x, z);
      // THE SITE OVERRIDE (the bag build): the facts
      // compose at HER position; a sleep taken through
      // a placed bag's or a tent's own door replaces
      // the shelter factor with the SITE's — Adam's
      // pin for the bag (2026-11-02: 'as warm as the
      // thatch hut, no storage') reads the thatch
      // factor from the live table at composition time,
      // never a copied number; the tent reads shelterAt
      // at its own seat, correct from any press
      // distance. Occupant-scoped by construction: the
      // awake composition never sees the mark, and a
      // bag she merely stands beside shelters nothing.
      const site = sleepSiteRef.current;
      sleepSiteRef.current = null;
      let facts = composed;
      if (facts && site?.kind === 'bag') {
        facts = {
          ...facts,
          shelterMultiplier: HOUSE_DEFS.thatchHut.shelterMultiplier,
        };
      } else if (facts && site?.kind === 'tent') {
        facts = {
          ...facts,
          shelterMultiplier: shelterAt(
            site.x,
            site.z,
            shelterState.snapshot(),
            placedTentsRef.current,
          ).multiplier,
        };
      }
      sleepTickRef.current =
        cycleT !== undefined && cycleT !== null && facts
          ? { cycleT, facts, x, z, site: site?.kind ?? null }
          : null;
    });
    const offDone = bus.on('sleep:completed', () => {
      const stash = sleepTickRef.current;
      sleepTickRef.current = null;
      if (!stash) return;
      // THE ENCAMPMENT RECORD (the feral build): a
      // COMPLETED sleep stamps its seat — the
      // crawl-back's first fallback rung. The stash's
      // x/z are her position when the sleep was
      // requested, which is the site she slept at.
      lastSleepSiteRef.current = { x: stash.x, z: stash.z };
      // REST EASES (injury.ts's own clause: a full
      // sleep's rest walks the ladder back one stage).
      if (injury.ease()) {
        refreshInjuryUi();
        showFeedback('She wakes steadier — rest has eased her hurt.', 'gain');
      }
      // THE LEARN (landed composed, 2026-11-03): the
      // first COMPLETED sleep in the placed bag — and
      // only there — records the bag's use, through
      // Systems' direct-use register door (recordItemUse,
      // the register's third set; derivation half
      // 9f94642). It must NOT ride recordCraftedUse:
      // executeCraft already writes that set at craft
      // time, so a derivation keyed to it would teach
      // the use at the loom and kill the first-sleep
      // learn (a crafted-but-unslept bag keeps its
      // hole). Placement writes nothing either. The
      // set makes the first sleep the one that records.
      if (stash.site === 'bag') {
        recordItemUse(ITEMS.sleepingBag);
      }
      const spanSeconds =
        (1 - stash.cycleT) * DAY_NIGHT_CYCLE_MINUTES * 60;
      if (!(spanSeconds > 0)) return;
      const before = {
        cold: coldWet.coldStage(),
        wet: coldWet.wetStage(),
        raining: false,
      };
      let remaining = spanSeconds;
      while (remaining > 0) {
        const step = Math.min(60, remaining);
        coldWet.tick(step, stash.facts);
        remaining -= step;
      }
      setColdWetUi(coldWet.vitals());
      const after = {
        cold: coldWet.coldStage(),
        wet: coldWet.wetStage(),
        raining: false,
      };
      speakColdWetEdges(before, after, false);
      if (coldWetEdgesRef.current) {
        coldWetEdgesRef.current = {
          ...coldWetEdgesRef.current,
          cold: after.cold,
          wet: after.wet,
        };
      }
    });
    return () => {
      offRequest();
      offDone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gap-closing state (see the header): one Systems FireState
  // per placed fire (the cooking vessel), the engine lighting
  // path per fire (for the bridge's method mapping), and one
  // HomeStorage per placed house, with the item ids it has ever
  // held (HomeStorage exposes counts, not a snapshot, so the
  // shell tracks the id universe; counts stay Systems').
  const systemsFiresRef = useRef(new Map<string, SystemsFireState>());
  const engineFirePathRef = useRef(
    new Map<string, 'flint' | 'friction' | 'candle'>(),
  );
  const homeStoresRef = useRef(new Map<string, HomeStorage>());
  const homeStoreItemsRef = useRef(new Map<string, Set<string>>());
  const [eatNote, setEatNote] = useState<string | null>(null);
  const [torchNote, setTorchNote] = useState<string | null>(null);
  const [tentNote, setTentNote] = useState<string | null>(null);
  const [bagNote, setBagNote] = useState<string | null>(null);
  const [altarNote, setAltarNote] = useState<string | null>(null);
  const [deskNote, setDeskNote] = useState<string | null>(null);
  const [workstationNote, setWorkstationNote] = useState<string | null>(null);
  const [cauldronNote, setCauldronNote] = useState<string | null>(null);
  const [fireNote, setFireNote] = useState<string | null>(null);
  const [dropNote, setDropNote] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState<string | null>(null);
  // Quest flags (Quest Log tab, 2026-10-28): shell-owned event
  // flags Systems predicates read but cannot derive (eat while
  // hungry, slept, ritual completed, crafted at stump). The
  // state drives the tab; the ref mirrors it for saveNow
  // (which reads refs + singletons). Boot init beside the
  // stagings/awakenings restore; setters ride the wiring
  // follow-up — the tab only reads, so all four read false
  // until that landing.
  const [questFlags, setQuestFlags] = useState<QuestFlags>(() =>
    emptyQuestFlags(),
  );
  const questFlagsRef = useRef<QuestFlags>(emptyQuestFlags());
  // Flag setter (wiring follow-up, 2026-10-28): idempotent —
  // already-true is a no-op (no extra save, no re-render).
  // Updates the ref (what saveNow persists) + the state
  // (what the tab renders). Call sites saveNow themselves
  // (or already save after the action). Safe in the boot
  // effect's first-render closure: it reads the ref, not
  // render-time state.
  const setQuestFlag = (key: keyof QuestFlags) => {
    if (questFlagsRef.current[key]) return;
    const next = { ...questFlagsRef.current, [key]: true };
    questFlagsRef.current = next;
    setQuestFlags(next);
  };

  // THE ACTIVE MARK (HUD-card chunk, 2026-11-01): the
  // one quest she has marked active — SavedQuestFlags'
  // `active`, Systems' data ("the mark is data, not a
  // gate"). Shell-owned state + ref on the setQuestFlag
  // pattern: the ref is what saveNow merges into the
  // quests record; the boot restore seats it from the
  // saved record (stripped out of the flags spread there
  // so the flags never carry a stale second copy). The
  // toggle is the journal log's mark control.
  const [activeQuestId, setActiveQuestId] = useState<string | null>(null);
  const activeQuestIdRef = useRef<string | null>(null);
  // THE LATCH (Systems' latch law, 03c9444; the lean-to
  // defect's fix): the ids of quests that have EVER read
  // complete. The predicates read the present tense —
  // build a lean-to, upgrade it, and 'leanTo' leaves the
  // houses list, so the completion must latch or it
  // un-reads. Boot seats the set from the saved quests
  // record (stripped out of the flags spread beside the
  // mark, same treatment); the facts site unions in
  // whatever reads complete NOW (newlyCompleted) before
  // evaluating, so the render that first sees a
  // completion is the render that latches it; saveNow
  // writes the set back on the quests record.
  const latchedCompletedRef = useRef<ReadonlySet<string>>(new Set());
  // THE BONE LATCH'S SAVED SET (one-of-every-bone,
  // LAW 2): the kinds SaveData.boneAcquisitions carried
  // at boot. saveNow's fold-in replaces it with the
  // folded union on every save, so the facts site's
  // bonesAcquired reads the latch as it stands, not as
  // it booted. The latch is HERS, like the awakenings
  // and the NameSight counts — regenerate does not
  // clear it (and the awakened arm of the union would
  // re-derive the woken kinds regardless).
  const savedBoneAcquisitionsRef = useRef<readonly string[]>(
    bootSave?.boneAcquisitions ?? [],
  );
  const toggleActiveQuestMark = (questId: string) => {
    const next = activeQuestIdRef.current === questId ? null : questId;
    activeQuestIdRef.current = next;
    setActiveQuestId(next);
    saveNow();
  };

  const [seedInput, setSeedInput] = useState(bootSave?.seed ?? DEFAULT_SEED);
  const [seed, setSeed] = useState(bootSave?.seed ?? DEFAULT_SEED);

  // World name (Adam, 2026-10-28 — first-run flow): the
  // name the player gives this world, or undefined when
  // unnamed (the cloud list falls back to 'Main save').
  // Saved via SaveDraft.worldName on saveNow (Systems
  // field); the ref mirror is the saveNow pattern
  // (saveNow reads refs, so a bare state would go stale
  // in captured listeners). Boot restores it from
  // bootSave; the first-run dialog + the cloud-tab
  // rename field (later landing) both set it.
  const [worldName, setWorldName] = useState<string | undefined>(
    bootSave?.worldName,
  );
  const worldNameRef = useRef(worldName);
  worldNameRef.current = worldName;
  const [cameraMode, setCameraMode] = useState<CameraMode>(
    bootSave?.cameraMode ?? 'first',
  );
  // Restored position is applied to the player in the boot effect
  // (which overwrites this state from the player); until then it
  // holds the saved point, not the spawn.
  const [position, setPosition] = useState(
    bootSave?.position ?? { x: 0, z: 0 },
  );
  const [biomeText, setBiomeText] = useState('—');
  const [chunkCount, setChunkCount] = useState(0);
  const [switching, setSwitching] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  // HUT STORAGE (the storage dialog's binding,
  // 2026-11-01): the house the storage-headed pack is
  // bound to, written ONLY at open (openInventoryPanel
  // — every pack door rides it, the home menu's
  // Storage row included, so the doors agree by
  // construction). Null = the plain pack.
  const [storageHouseId, setStorageHouseId] = useState<string | null>(null);
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [charmsOpen, setCharmsOpen] = useState(false);
  // COMPANIONS (build 1, 2026-10-31): the fourth panel —
  // a radio-family member like its siblings, with one
  // difference: its DOOR exists only while she has a
  // companion (see the button rows + hasBondedCompanion).
  const [companionsOpen, setCompanionsOpen] = useState(false);
  // JOURNAL (First-Fragment Presentation, 2026-10-31):
  // the tally panel — a radio-family member like its
  // siblings, opened by the Read verb on her journal
  // row and by the seated desk's Read (the grimoire's
  // camp act, the read gate 2026-11-01) — no HUD door
  // of its own.
  const [journalOpen, setJournalOpen] = useState(false);
  // THE JOURNAL'S ORDER (the Newest sort, 2026-11-06;
  // Adam asked for the option — 'at least a Newest' —
  // not a new default): 'standing' renders every page
  // in its recorded order, exactly as the book has
  // always read; 'newest' re-stamps the listing pages
  // freshest-first at their mapping sites below.
  // Session-only (DEV ruling): the book reopens on
  // standing order each sitting, never saved. The
  // quest log is EXCLUDED by ruling — its act/thread
  // grouping IS its order; bases likewise keep their
  // standing head (a travel enumeration, not entries).
  const [journalSortOrder, setJournalSortOrder] = useState<
    'standing' | 'newest'
  >('standing');
  // The panel's mirror of CompanionState (records are
  // ref-state; the mirror is what renders). Refreshed at
  // boot and after every companion act.
  const [companionRecords, setCompanionRecords] = useState<
    SavedCompanion[]
  >([]);
  // Per-row note lines keyed by creatureId — the cat's
  // theater lands here (RosterPanel renders them
  // under the row). The All-row's note is its own state.
  const [companionNotes, setCompanionNotes] = useState<
    Record<string, string>
  >({});
  const [companionAllNote, setCompanionAllNote] = useState<string | null>(
    null,
  );
  const [selectedCharmKind, setSelectedCharmKind] = useState<string | null>(
    null,
  );
  // CHARM TOGGLES (2026-11-06): charmEntries below is a
  // render-scope map over ref state (listCharms), so a
  // toggle flip needs a render to re-stamp the rows on
  // BOTH doors (panel + journal). The toggle act bumps
  // this version; the value itself is never read (the
  // ritualVersion pattern).
  const [, setCharmListVersion] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(
    undefined,
  );
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | undefined>(
    undefined,
  );
  const [craftNote, setCraftNote] = useState<string | null>(null);
  const [ownedItem, setOwnedItem] = useState<OwnedToolItem>(() =>
    ownedToolItem(inventory),
  );
  const [harvestTargets, setHarvestTargets] = useState<HarvestTarget[]>([]);
  // Targets harvested since the last projection (pill
  // fix): the column suppresses ONLY their Harvest
  // button (Remove stays) until the tracker stops
  // emitting them or the next projection prunes the
  // mark. Scatter ids only — the completion handler
  // never marks ground targets (a pile may still hold
  // items after a take).
  const [harvestedIds, setHarvestedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  // In-range dropped piles (harvest overflow), nearest first per
  // the tracker. Drives the touch USE fallback, the touch
  // PICK UP label, the desktop pickup button, and the pile
  // chips + menu (see handleUseInteract + the pile
  // computations before return + pileModalModel /
  // handlePileAction). Ref mirrors state so the
  // first-render recomputeAnchors closure sees piles fresh.
  const [piles, setPiles] = useState<PileTarget[]>([]);
  // TRAP ROW (Adam, 2026-10-28): live placed-trap
  // snapshot, re-read on trap events (placed / catch /
  // hour-roll) and on collection. The row derivation
  // below filters this by range per render.
  const [traps, setTraps] = useState<PlacedTrap[]>(() =>
    trapState.snapshot(),
  );
  const refreshTrapsFromState = () => {
    setTraps(trapState.snapshot());
  };
  const pilesRef = useRef<PileTarget[]>([]);
  // Harvest outcome feedback, rendered through WorldAnchor
  // + ObjectFeedback; multi-step progress rides the
  // target's pill (harvestProgress below), not a world bar.
  // Populated only by the outcome events (see the header) — never
  // by invented yields or progress.
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [harvestProgress, setHarvestProgress] =
    useState<HarvestProgressState | null>(null);

  // Placed fires (engine singleton, read fresh on every event),
  // their projected anchors, the fire whose menu is open, and
  // the placement in progress (ref mirrors state so the
  // first-render recomputeAnchors closure sees it fresh).
  const [placedFires, setPlacedFires] = useState<PlacedFire[]>(() =>
    fireState.snapshot(),
  );
  const [fireAnchors, setFireAnchors] = useState<
    { fire: PlacedFire; x: number; y: number }[]
  >([]);
  const [selectedFireId, setSelectedFireId] = useState<string | null>(null);
  // Furniture menus (the furniture-verbs build): the
  // faced piece whose ContextMenu stands open.
  const [selectedWorkstationId, setSelectedWorkstationId] =
    useState<string | null>(null);
  const [selectedDeskId, setSelectedDeskId] = useState<string | null>(null);
  const [selectedLoomId, setSelectedLoomId] = useState<string | null>(null);
  // The cauldron whose menu is open, keyed by its hearth's
  // id — the cauldron's whole identity (Background's
  // binding model).
  const [selectedCauldronHearthId, setSelectedCauldronHearthId] =
    useState<string | null>(null);
  // Campfire tap (Adam, 2026-10-28): the pending pointerdown
  // for tap-near-fire (touch-only, container handlers below).
  // A ref, not state — a tap must not re-render on press.
  const fireTapRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  // Placed torches (Background singleton, read fresh on every
  // event) and their projected anchors — the fire-chip
  // pattern, one torch per chip. NO selected-torch state
  // (Adam's torch completion, 2026-10-31): the chip tap IS
  // the pickup now, so the torch's little window and its
  // whole selection family retired — see handlePickupTorch.
  const [placedTorches, setPlacedTorches] = useState<PlacedTorchEntity[]>(
    () => torchState.snapshot(),
  );
  const [torchAnchors, setTorchAnchors] = useState<
    { torch: PlacedTorchEntity; x: number; y: number }[]
  >([]);
  // PLACED TENTS (tent shell, 2026-10-28 — interim
  // shell store, NOT Background's entity: Background's
  // placed-tent entity + renderer.setTents setter have
  // not landed yet, so the shell holds placed tents
  // itself until the follow-up wiring hands them over.
  // Records carry shell ids (tent:<n> scheme, trap
  // precedent: new places take max suffix + 1; restored
  // id-less entries take tent:boot-<index>, which
  // cannot collide with tent:<n>). Multiples allowed,
  // two tents at one spot are two entries (save.ts
  // rule). Lazy init from bootSave (finite coords
  // only); the ref mirror keeps recomputeAnchors fresh
  // (pilesRef pattern) — every mutation goes through
  // updatePlacedTents, never setPlacedTents alone.
  // NOT a HouseType: no storage, no upgrade pill, no
  // home chip, no FIND CAMP camp (camps = houses).
  // Shelter effect is NOT live here (0.85 DRAFT rides
  // Background's tent-aware shelter branch, still to
  // land) — the chip claims no shelter state.
  const [placedTents, setPlacedTents] = useState<
    { id: string; x: number; z: number }[]
  >(() =>
    (bootSave?.tents ?? [])
      .filter((tent) => Number.isFinite(tent.x) && Number.isFinite(tent.z))
      .map((tent, index) => ({
        id: tent.id ?? `tent:boot-${index}`,
        x: tent.x,
        z: tent.z,
      })),
  );
  const placedTentsRef = useRef(placedTents);
  const updatePlacedTents = (next: { id: string; x: number; z: number }[]) => {
    placedTentsRef.current = next;
    setPlacedTents(next);
    // RENDERER SYNC (setTents wiring, 2026-10-28): the
    // renderer holds no tent state — the shell is the
    // source of truth and pushes its list on every
    // mutation (place / pickup / regenerate-clear).
    // The push rebuilds the placed group immediately
    // and nudges the proximity tracker, so the shelter
    // signal updates at once. Null-safe: the renderer
    // does not exist before boot constructs it, and
    // mutations run only after boot.
    rendererRef.current?.setTents(next.map((tent) => ({ x: tent.x, z: tent.z })));
  };
  const [tentAnchors, setTentAnchors] = useState<
    { tent: { id: string; x: number; z: number }; x: number; y: number }[]
  >([]);
  const [selectedTentId, setSelectedTentId] = useState<string | null>(null);
  // PLACED SLEEPING BAGS (the portable hut, 2026-11-02;
  // Adam's ruling: the bag's card promise is true —
  // 'a bed wherever you stop'). The tent template end
  // to end: a shell store beside placedTents (bag:<n>
  // ids cannot collide with tent:<n>), lazy init from
  // bootSave, the ref mirror, and updatePlacedBags as
  // the only mutation door — which also pushes the
  // renderer's setBags (Background's seam: the bedroll
  // body, unrotated in v1, yaw 0 like the tents).
  // NOT a house: no store, no binding, no shelter
  // radius — the bag shelters only its sleeper, and
  // only through the sleep itself (the sleep-site
  // mark below), never by standing near it.
  const [placedBags, setPlacedBags] = useState<
    { id: string; x: number; z: number }[]
  >(() =>
    (bootSave?.bags ?? [])
      .filter((bag) => Number.isFinite(bag.x) && Number.isFinite(bag.z))
      .map((bag, index) => ({
        id: bag.id ?? `bag:boot-${index}`,
        x: bag.x,
        z: bag.z,
      })),
  );
  const placedBagsRef = useRef(placedBags);
  const updatePlacedBags = (next: { id: string; x: number; z: number }[]) => {
    placedBagsRef.current = next;
    setPlacedBags(next);
    // RENDERER SYNC (setBags, Background 9b79485): the
    // shell is the source of truth and pushes its list
    // on every mutation (place / pickup / regenerate-
    // clear / boot re-supply), the tent pattern.
    rendererRef.current?.setBags(next.map((bag) => ({ x: bag.x, z: bag.z })));
  };
  const [bagAnchors, setBagAnchors] = useState<
    { bag: { id: string; x: number; z: number }; x: number; y: number }[]
  >([]);
  const [selectedBagId, setSelectedBagId] = useState<string | null>(null);
  // THE SLEEP-SITE MARK (the bag build): set by a
  // placed bag's or a faced tent's own Sleep door in
  // the instant before it emits the sleep request, and
  // read + cleared by the sleep stash below. It is how
  // the stash knows WHERE she sleeps — exactly, not by
  // deriving from her position (a menu opens from
  // beyond a tent's radius, and a bag she stands
  // beside shelters nothing). The home menu's Rest
  // sets no mark: a house sleep composes at her
  // position as it always has.
  const sleepSiteRef = useRef<
    { kind: 'bag' } | { kind: 'tent'; x: number; z: number } | null
  >(null);
  // Placed altars (Background singleton, read fresh on every
  // event) and their projected anchors — the torch pattern
  // minus the menu: the altar chip is label-only (no ritual
  // actions exist yet, no Pick-up invented), so there is no
  // selected-altar state at all.
  const [placedAltars, setPlacedAltars] = useState<PlacedAltarEntity[]>(
    () => altarState.snapshot(),
  );
  const [altarAnchors, setAltarAnchors] = useState<
    { altar: PlacedAltarEntity; x: number; y: number }[]
  >([]);
  // Placed writing desks (Background singleton) and their
  // projected anchors — the altar pattern minus both the
  // menu and the placed-list state: the chip is label-only
  // (the desk's verbs ride its winner + the furniture
  // pick-up pill, furniture-moves wiring 2026-11-05), so
  // there is no selected-desk state, and no consumer needs
  // a placedDesks list — the anchors loop reads the
  // singleton directly, like the altars loop does.
  const [deskAnchors, setDeskAnchors] = useState<
    { desk: PlacedDeskEntity; x: number; y: number }[]
  >([]);
  // Placed crafted workstations (Background singleton):
  // the desk anchors pattern whole — label-only chip,
  // the placed list read live from the singleton.
  const [workstationAnchors, setWorkstationAnchors] = useState<
    { bench: PlacedWorkstationEntity; x: number; y: number }[]
  >([]);
  const [cauldronAnchors, setCauldronAnchors] = useState<
    { cauldron: PlacedCauldronEntity; x: number; y: number }[]
  >([]);
  // Ritual staging (tier-1 Waking build): the shell owns
  // one StagingBook (site + kind keyed stagings) and one
  // CharmState (awakening records). Both are refs — their
  // mutations do not render by themselves, so every
  // staging step + ritual event bumps ritualVersion to
  // re-render the panel. The panel derives its staged
  // display from ritualSiteState (the physical bone) +
  // the book (the steps), never from a snapshot.
  const stagingBookRef = useRef(new StagingBook());
  const charmStateRef = useRef(new CharmState());
  // COMPANION STATE (build 1, 2026-10-31): the shell owns
  // the one CompanionState (Systems' module), constructed
  // from the boot save's records — the ref-lazy pattern of
  // the inventory/hunger blocks. Mutations ride
  // companionRecords (the mirror) to the panel, and
  // snapshot() rides every saveNow.
  const companionStateRef = useRef<CompanionState | null>(null);
  if (companionStateRef.current === null) {
    companionStateRef.current = new CompanionState(
      bootSave?.companions ?? [],
    );
  }
  // FAMILIAR STATE (the familiar road, 2026-11-02): the
  // shell owns the one FamiliarState (Systems' module) —
  // the true names the rites teach and the borrowing's
  // span/rest. Same ref-lazy pattern; the names ride
  // every saveNow, the borrowing never does. The live
  // gift id rides borrowLiveRef so the 1 s settle can
  // take the effect back off when the span lapses.
  const familiarStateRef = useRef<FamiliarState | null>(null);
  if (familiarStateRef.current === null) {
    familiarStateRef.current = new FamiliarState(
      bootSave?.familiarNames ?? [],
    );
  }
  const borrowLiveRef = useRef<string | null>(null);
  // DISCOVERY STATE (the Raven Guide wiring, 2026-10-31):
  // the shell owns the one DiscoveryState (Systems'
  // module), constructed from the boot save's record —
  // the same ref-lazy pattern. The guide's probes read
  // it live, grove entry flips it, and snapshot() rides
  // every saveNow.
  const discoveryStateRef = useRef<DiscoveryState | null>(null);
  if (discoveryStateRef.current === null) {
    discoveryStateRef.current = new DiscoveryState(bootSave?.discovery);
  }
  // FRAGMENT STATE (First-Fragment Presentation,
  // 2026-10-31): the shell owns the one FragmentState
  // (Systems' module), constructed from the boot save's
  // records — the same ref-lazy pattern. Transcription
  // writes it, the JournalPanel reads it, and snapshot()
  // rides every saveNow.
  const fragmentStateRef = useRef<FragmentState | null>(null);
  if (fragmentStateRef.current === null) {
    fragmentStateRef.current = new FragmentState(bootSave?.fragments);
  }
  // NAMED PLACES (the naming build, 2026-11-05): the
  // shell owns the one NamedPlacesState (the register
  // is a leaf in game/namedPlaces) — the same ref-lazy
  // pattern, restored from the boot save's record;
  // snapshot() rides every saveNow. The journal's
  // Places page reads it; the naming acts write it.
  const namedPlacesRef = useRef<NamedPlacesState | null>(null);
  if (namedPlacesRef.current === null) {
    const seated = new NamedPlacesState();
    seated.restore(bootSave?.namedPlaces ?? []);
    namedPlacesRef.current = seated;
  }
  // THE HEDGES (the Hedge door build, 2026-11-05):
  // the shell owns the one HedgeState (Systems'
  // register) — the same ref-lazy pattern, restored
  // from the boot save's record; snapshot() rides
  // every saveNow. The renderer's ring views read it
  // through the facts provider seated at renderer
  // construction; the home menu's laying door writes
  // it through Systems' layHedge grant.
  const hedgeStateRef = useRef<HedgeState | null>(null);
  if (hedgeStateRef.current === null) {
    hedgeStateRef.current = new HedgeState(bootSave?.hedges ?? []);
  }
  // THE HEARTHHOME SEALS (the HearthHome door build,
  // 2026-11-06): the shell owns the one HearthHomeState
  // — the same ref-lazy pattern as the hedges, restored
  // from the boot save's record; snapshot() rides every
  // saveNow (SaveData.hearthhome, Systems' seat). The
  // faced places' menus lay through Systems' laySeal
  // grant; the cold-wet composition reads the seal's
  // grades (hearthhomeShelterMultiplier /
  // hearthhomeFireWarmth) at the facts seat.
  const hearthhomeStateRef = useRef<HearthHomeState | null>(null);
  if (hearthhomeStateRef.current === null) {
    hearthhomeStateRef.current = new HearthHomeState(
      bootSave?.hearthhome ?? [],
    );
  }
  // THE LAYING WORKING: a held working of a few
  // seconds at the faced home (the candle idiom) —
  // while it stands, the home menu shows its bar and
  // its one waiting row; completion calls the grant,
  // interruption (menu closed, home left) spends and
  // lays NOTHING. Progress accumulates per unpaused
  // tick, so a pause freezes the working like the
  // lighting bar. All DRAFT numbers for Adam's pass.
  const HEDGE_WORK_MS = 4000;
  const [hedgeWorking, setHedgeWorking] = useState<{
    homeId: string;
    progressMs: number;
  } | null>(null);
  const hedgeWorkingRef = useRef<{
    homeId: string;
    progressMs: number;
  } | null>(null);
  // THE SELECTED PLACE: her chosen named place — the
  // seat the future Returning scry door will read
  // (v1 seats the selection only; no scry act reads
  // it yet). State mirrors the ref for the journal's
  // highlight; the ref is the door's future read.
  const [selectedPlaceId, setSelectedPlaceId] =
    useState<string | null>(null);
  const selectedPlaceRef = useRef<string | null>(null);
  const selectPlace = (id: string | null) => {
    selectedPlaceRef.current = id;
    setSelectedPlaceId(id);
  };
  // A tick the naming acts bump so the render-composed
  // journal rows re-read the register after a write.
  const [, setPlacesVersion] = useState(0);
  const refreshPlaces = () =>
    setPlacesVersion((version) => version + 1);
  // The ritual site whose panel is open, by SITE ID
  // ('altar:<n>' or 'stump:x,z' — one selection for
  // both site kinds since the bone build; the panel +
  // derivation are site-kind-agnostic, only the label
  // and anchor source differ). Renamed from
  // selectedAltarId when stump sites gained panels.
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  // CRAFT CONTEXT — THE FOLD (Adam's design, approved
  // as claimed 2026-10-31): there is ONE crafting dialog.
  // When it opens while a stump — plain or made altar —
  // is her faced context, the dialog carries that stump's
  // doors inside itself (Craft | Upgrade | Ritual, Craft
  // default): E at a stump, K or the panel button while
  // facing one, touch USE, and the stump's name chip all
  // open the dialog WITH the context; any other opening
  // is the plain dialog exactly as before. The anchored
  // stump hub this replaces is retired (the altar sites
  // beyond the stump family keep their anchored panel).
  // The context is the stump she OPENED at — it does not
  // follow her facing afterwards (she can look around
  // freely; the look-up trap dies of its cause), while
  // the station feed inside Craft still follows the
  // faced winner as always. The context clears whenever
  // the dialog closes, however it closes (E, the radio
  // swap, Close, the walk-away leash) — the effect below
  // is the single guarantee, so no close site can leak it.
  const [craftContextSiteId, setCraftContextSiteId] =
    useState<string | null>(null);
  const [craftDoor, setCraftDoor] = useState<
    'craft' | 'upgrade' | 'ritual' | 'fire'
  >('craft');
  useEffect(() => {
    if (!craftingOpen) {
      setCraftContextSiteId(null);
      setCraftDoor('craft');
    }
  }, [craftingOpen]);
  // Stump ritual anchors (bone build): stumpPositions
  // at her feet, projected like altar anchors. State,
  // not memo — projection needs the live container +
  // camera, so it rides recomputeAnchors with the rest.
  const [stumpAnchors, setStumpAnchors] = useState<
    { siteId: string; x: number; y: number }[]
  >([]);
  // SHREW EFFECT SHELL (Systems 5e0af26 — latch +
  // drain multiplier built; display + wiring are UI's):
  // one latch, session-only (nothing saved — first
  // update below threshold after boot fires fresh,
  // which is the correct behavior per the latch
  // contract). syncShrewEffect is THE shell sync, called
  // on every hunger change (1 s timer, eat), every
  // inventory change (refreshInventory), and boot
  // (after restore + grant). It reads only refs + the
  // two stable singletons (inventory, hunger), so the
  // boot effect's first-render closure stays correct
  // (saveNow pattern).
  const warningRef = useRef(new HungerWarning(FIRST_CHARM_EFFECT.warnAt));
  // Groundhog rested-day flag (groundhog wiring): session
  // state like the warning latch — never saved (a load
  // mid-rested-day resets it until the next sleep).
  const groundhogRestRef = useRef(new GroundhogRest());
  // Deer storm-warning latch (mouse/bear/deer wiring):
  // session state like the shrew latch — never saved.
  const weatherWarningRef = useRef(new WeatherWarning());
  const [hungerWarningActive, setHungerWarningActive] = useState(false);
  const [hungerWarningFlash, setHungerWarningFlash] = useState(false);
  const warningFlashTimerRef = useRef<number | undefined>(undefined);
  // Deer warning display state (same shape as the shrew
  // line: steady active + 2 s flash on the fired edge).
  const [deerWarningActive, setDeerWarningActive] = useState(false);
  const [deerWarningFlash, setDeerWarningFlash] = useState(false);
  const deerWarningFlashTimerRef = useRef<number | undefined>(undefined);
  const syncShrewEffect = () => {
    // Carried source, SHELL-SIDE (DEV instruction):
    // LIST MEMBERSHIP since the charm-list landing
    // (Systems 9e9a9dd) — the list IS the awakened
    // kinds, so carried = isAwakened, and the drain
    // formula's carried && awakened collapses to it.
    // TOGGLES (2026-11-06): the read is now awakened
    // AND enabled — a turned-off shrew charm neither
    // warns nor slows the drain; the latch's not-carried
    // arm resets, so turning it back on while hungry
    // fires fresh, exactly like a re-carry.
    // This is the switch the shrew build staged: the
    // interim main-inventory count is gone (the shrew
    // item no longer sits in main inventory — the
    // save migration drops it on load, and the grant
    // records no item). Deliberately NOT the old
    // shrewEffectActive(inventory, charms): that helper
    // read the main inventory directly, which went
    // wrong once the list landed (list charms are not
    // inventory stacks). It stood UNUSED from the list
    // landing until the toggles build (2026-11-06)
    // retired it outright, on Systems' assignment in
    // 56eb46e — this shell read was always the true one.
    const shrewCarried =
      charmStateRef.current.isAwakened(FIRST_CHARM_KIND) &&
      charmStateRef.current.isEnabled(FIRST_CHARM_KIND);
    const result = warningRef.current.update(hunger.value(), shrewCarried);
    // Boolean setState bails out when unchanged, so
    // the steady state costs no re-render; fired is an
    // edge by construction (entry only), so the flash
    // needs no prev comparison either.
    setHungerWarningActive(result.active);
    if (result.fired) {
      setHungerWarningFlash(true);
      window.clearTimeout(warningFlashTimerRef.current);
      warningFlashTimerRef.current = window.setTimeout(() => {
        setHungerWarningFlash(false);
      }, 2000);
    }
    // Drain product (groundhog wiring + snake joining):
    // shrew × snake × rested, multiplicative — 0.729 with
    // all three (0.9 each). Snake joins here (DEV-approved
    // batching: its factor existed unwired; the product is
    // now true in one push instead of 0.81 with snake
    // still missing). Every factor gates on list
    // membership + awakened via isAwakened per kind,
    // never main-inventory count; every factor is 0.9 or
    // 1, so the product stays > 0 (never trips the
    // clamp's throw). Rested reads the session flag —
    // the completed-listener below is what moves it.
    hunger.setDrainMultiplier(
      (shrewCarried ? FIRST_CHARM_EFFECT.drainMultiplier : 1) *
        snakeDrainFactor(
          charmStateRef.current.isAwakened('snake-vertebra'),
          charmStateRef.current,
        ) *
        groundhogRestRef.current.restedDrainFactor() *
        // SPRINT FACTOR (UI half of Adam's sprint/jump
        // order, 2026-10-29): sprinting joins the same
        // product at DRAFT ×1.25 — the pinned base rate
        // (1 pt / 30 s) is untouched and there is no
        // second hunger value; the flag mirrors
        // Background's 'player:sprint-changed' event
        // (see the subscription below syncShrewEffect's
        // neighbours — sprintingRef).
        (sprintingRef.current ? 1.25 : 1),
    );
  };

  // SPRINT STATE MIRROR (2026-10-29): Background's player
  // emits 'player:sprint-changed' on transitions only;
  // the ref feeds the drain product above, and the
  // subscription re-syncs the rate the moment the state
  // flips (the 1 s tick's own re-sync would catch it
  // within a second regardless). The live getter
  // (player.sprinting) stays Background's; this mirror
  // exists so the shell never polls it.
  const sprintingRef = useRef(false);
  useEffect(() => {
    const off = bus.on('player:sprint-changed', (p) => {
      sprintingRef.current = p.sprinting;
      syncShrewEffect();
    });
    return off;
    // First-render closure by design (the established
    // pattern — syncShrewEffect reads only refs and
    // singletons, so the captured instance stays correct).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // CHARM-BONUS SYNC (mouse/bear wiring): the two
  // session-only bonuses, shell-synced on list change
  // (boot + ritual completion, beside syncCharmHooks).
  // Mouse +25 home-storage counts while carried +
  // awakened, else 0, applied to EVERY placed house's
  // store (the bonus is a charm effect, not per-house);
  // HomeStorage.capacity() already adds it, so existing
  // home-capacity displays pick it up with no display
  // work. Bear +10 lb pack capacity while carried +
  // awakened, else 0, on the pack inventory; capacityLb()
  // already feeds it, so the existing carrying line
  // picks it up with no display work. Gates are list
  // membership + awakened via isAwakened per kind,
  // never main-inventory count. The inventory ref is
  // nullable (not yet built at the earliest boot
  // reads), so the bear leg guards it.
  const syncCharmBonuses = () => {
    const charms = charmStateRef.current;
    const mouseBonus = mouseStorageBonus(
      charms.isAwakened('mouse-spine'),
      charms,
    );
    for (const store of homeStoresRef.current.values()) {
      store.setCharmBonus(mouseBonus);
    }
    const pack = inventoryRef.current;
    if (pack) {
      pack.setCharmCapacityBonusLb(
        bearCapacityBonusLb(charms.isAwakened('bear-claw'), charms),
      );
    }
  };
  // DEER WARNING SYNC (deer wiring): the storm latch,
  // fed Background's rising-front signal (NOT a
  // countdown) + carried = isAwakened('deer-antler-tip').
  // The fact moves with position (month does not advance
  // in-game yet), so this runs on the 1 s timer tick
  // beside syncShrewEffect as well as boot + ritual
  // completion — boot + completion alone would go stale
  // as she walks. No player yet → no fact, no update
  // (the latch holds its state until a fact exists).
  const syncDeerWarning = () => {
    const player = playerRef.current;
    if (!player) return;
    const fact = stormApproaching(genRef.current, player.x, player.z);
    const result = weatherWarningRef.current.update(
      fact,
      charmStateRef.current.isAwakened('deer-antler-tip') &&
        charmStateRef.current.isEnabled('deer-antler-tip'),
    );
    setDeerWarningActive(result.active);
    if (result.fired) {
      setDeerWarningFlash(true);
      window.clearTimeout(deerWarningFlashTimerRef.current);
      deerWarningFlashTimerRef.current = window.setTimeout(() => {
        setDeerWarningFlash(false);
      }, 2000);
    }
  };
  // CHARM-HOOK SYNC (zone + hooks build, Background G1/G2/G3):
  // the five landed charm hooks take shell-supplied
  // carried + awakened booleans — list membership via
  // isAwakened per kind, NEVER main-inventory count
  // (list charms are not inventory stacks, same rule
  // as syncShrewEffect). The setters are idempotent
  // booleans, so re-syncing is harmless. Call sites are
  // the list-change paths — boot (after restore +
  // grant), ritual completion (after awaken), and (the
  // toggles build, 2026-11-06) the toggle act — no
  // timer: hook booleans change only on awakening or
  // on a toggle flip.
  // Pigeon pointing: the renderer ORs scry + pigeon
  // (arrowsVisible), so the arrival-dismiss path clears
  // only the scry flag — pigeon arrows stay while the
  // charm is listed AND switched on. Adam's refinement
  // (2026-11-05) keeps the rest: the pigeon is the
  // early-game road home while Returning fragments are
  // hard to acquire, so its pointing is NOT gated on
  // the mark — only the scry-raised arrows are
  // (syncScryRevealGate below). The toggle is the
  // player's own switch, not a mark gate.
  // Fox reaches the player controller (nullable ref);
  // mole is a module-level setter; the three vision
  // hooks reach the renderer (nullable ref).
  // TOGGLES (2026-11-06): every read below is awakened
  // AND enabled — Systems' enabled fact beside
  // isAwakened (56eb46e). A turned-off charm's hook
  // reads false, exactly as an unawakened one does.
  const syncCharmHooks = () => {
    const charms = charmStateRef.current;
    rendererRef.current?.setPigeonWayHome(
      charms.isAwakened('pigeon-wing-bone') &&
        charms.isEnabled('pigeon-wing-bone'),
    );
    syncScryRevealGate();
    rendererRef.current?.setOwlNightSight(
      charms.isAwakened('owl-talon') && charms.isEnabled('owl-talon'),
    );
    rendererRef.current?.setBatNightWayfinding(
      charms.isAwakened('bat-wing-bone') &&
        charms.isEnabled('bat-wing-bone'),
    );
    playerRef.current?.setSwiftStep(
      charms.isAwakened('fox-femur') && charms.isEnabled('fox-femur'),
    );
    setMoleEarthSense(
      charms.isAwakened('mole-paw') && charms.isEnabled('mole-paw'),
    );
  };

  // THE SCRY-REVEAL GATE (Adam's ruling + refinement,
  // 2026-11-05 — his live #83 playtest): he stood at
  // water, the Scry gate refused in words ('You have
  // not learned the Returning mark'), and the home
  // arrow still stood over his house. His word, as
  // refined minutes later: the SCRY-raised camp
  // arrows gate on Returning T1 — and ONLY those.
  // The pigeon-wing charm stays an independent
  // early-game road home, ungated (its seat above).
  //
  // The camp arrows' only TRUE seat (handleScry's
  // reveal) already stands behind the gate at its
  // head; this sync is the structural half — a
  // standing reveal is dismissed and the arrows
  // cleared the moment the gate reads closed, so
  // the display can never outlive the right to it.
  // (The reveal is session-only state and fragments
  // are never lost, so in play this fires only as
  // the invariant's guard.) Mirror-guarded: it runs
  // on the gate's transitions (boot via
  // syncCharmHooks, and every player:moved). The
  // exit-arrow suppression composes untouched — it
  // reads the exit seat, not these drives.
  const scryGateRef = useRef<boolean | null>(null);
  const syncScryRevealGate = () => {
    const allowed = canScry(fragmentStateRef.current);
    if (scryGateRef.current === allowed) return;
    scryGateRef.current = allowed;
    if (!allowed && divinationRef.current.isRevealed) {
      divinationRef.current.dismiss();
      rendererRef.current?.setCampArrowsVisible(false);
    }
  };

  // Crow tier (glow landing, 2026-10-28): shell wiring
  // setCrowTier ← crowGlowTier, beside syncCharmHooks (boot
  // + ritual completion, same two call sites). Carried =
  // list membership per the pseudo-inventory ruling
  // (effects functional from the list). Clamped to the
  // setter's 0..3 domain at the call site only — a
  // type-domain clamp, not tier logic (the Systems fact
  // stays unclamped). The glow itself is Background's;
  // this setter only feeds it the tier.
  const syncCrowTier = () => {
    const charms = charmStateRef.current;
    const tier = crowGlowTier(charms.isAwakened('crow-beak'), charms);
    rendererRef.current?.setCrowTier(
      Math.min(3, Math.max(0, tier)) as CrowTier,
    );
  };
  const [ritualNote, setRitualNote] = useState<string | null>(null);
  // JOURNAL LINK FLAG (altar transformation, 2026-10-30):
  // the shell's one bit of the transformation story the
  // stump records don't carry — set by the Linking act
  // at altar-grade ground, saved + restored with the
  // world (Systems' save shape, serialize defaults it
  // false for old documents).
  const [journalLinked, setJournalLinked] = useState(false);
  // THE LINK FLAG'S REF (parity rider, 2026-11-01):
  // saveNow builds its document from render-scope state,
  // so the Linking act's own save — and any flush bound
  // to an older closure, the pagehide flush included —
  // wrote the flag's PREVIOUS value: the link read
  // linked in-session and was gone after every reload,
  // on stumps exactly as on placed altars. The ref is
  // the save's source (the questFlagsRef pattern); the
  // state still drives the renders.
  const journalLinkedRef = useRef(false);
  const [, setRitualVersion] = useState(0);
  const refreshRitual = () => {
    setRitualVersion((version) => version + 1);
  };
  // Scry button (Adam 2026-10-27 — DEV split, not a rewrite):
  // visibility = near still water on movement, reveal = press
  // only (Systems 9927ddab stands as the query). The shell
  // owns one CampDivination: press reveals, arrival dismisses
  // (persist-until-arrival, Systems' rule). The button shows
  // only when near water AND at least one camp exists AND
  // nothing is revealed (UI's call, flagged — no dead presses,
  // no invented copy); it hides while revealed and reappears
  // on arrival-dismiss if she is still at water. Waters come
  // from Background's adapter (game/waterProximity); arrows
  // show/hide through renderer.setCampArrowsVisible.
  const divinationRef = useRef(new CampDivination());
  // THE T1 EXIT POINTING's seat mirror: the last
  // target the shell handed Background's exit arrow
  // (null = none standing). The renderer rebuilds
  // the arrow on every setExitArrow call, so the
  // feed below calls it only when the seat CHANGES.
  const exitArrowSeatRef = useRef<{ x: number; z: number } | null>(null);
  const [scryVisible, setScryVisible] = useState(false);
  // JAR VERBS (the jar build's shell half): the FILL
  // offer — she stands in water by the composed facts
  // (siteWaterFacts at her feet: ponds, the creek, her
  // own hauled patch; mud never answers) with an empty
  // jar carried. State + ref on the scry idiom: the
  // moved listener and every inventory refresh recompute
  // it, the R handler reads the ref. Independent of the
  // scry conditions — filling must not require a camp.
  const [fillOffer, setFillOffer] = useState(false);
  const fillOfferRef = useRef(false);
  // The DUMP arm: armed from the water-jar row's Dump
  // verb; while armed, recomputeAnchors certifies the
  // crosshair's ground (patch first, then the composed
  // water fact) into dumpAim on the anchor cadence, and
  // the stack card + touch bar read it live.
  const [dumpArmed, setDumpArmed] = useState(false);
  const dumpArmedRef = useRef(false);
  const [applyArmed, setApplyArmed] = useState(false);
  const applyArmedRef = useRef(false);
  const [applyAim, setApplyAim] = useState<ApplyAim | null>(null);
  const [dumpAim, setDumpAim] = useState<{
    x: number;
    z: number;
    cert: 'dry' | 'mud' | 'water';
  } | null>(null);
  // LOOK action (Adam 2026-10-27 — DEV-approved claim +
  // target + content, Systems NameSight ccab7ff): the shell
  // owns one NameSight; a press looks closely at the
  // nearest SCATTER target (kind-keyed) and shows what is
  // known (or the plain name). Owl hook: boot sets
  // not-owned (the charm is later, its id not decided,
  // never invented). The result line belongs to one
  // target id and hides when that target leaves range.
  const nameSightRef = useRef(new NameSight());
  const [lookResult, setLookResult] = useState<{
    targetId: string;
    text: string;
  } | null>(null);
  // Pile chips (projected anchors, fire-chip pattern) and the
  // pile whose menu is open. The menu is LIVE, not a tap-time
  // snapshot: selectedPileId names the pile, and the menu
  // renders from the live pile in piles state — a kind taken
  // to zero leaves the menu, a deposit's new kind joins it,
  // and an emptied pile closes it (auto-close in
  // refreshPilesFromState / piles:inRange). Ref mirrors the
  // key so the first-render piles:inRange closure can
  // auto-close a vanished pile. The pile's x/z are its true
  // coords verbatim, which the deposit path reuses exactly.
  const [pileAnchors, setPileAnchors] = useState<
    { pile: PileTarget; x: number; y: number }[]
  >([]);
  const [selectedPileId, setSelectedPileId] = useState<string | null>(null);
  const [homeMenuOpen, setHomeMenuOpen] = useState(false);
  // Leave confirm (back-button trap, 2026-10-29): shown
  // when a back press arrives with nothing open. The
  // armed ref is the one-shot Leave pass: set by the
  // Leave button, read by the popstate handler, which
  // then lets history proceed for real instead of
  // re-arming the trap.
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const leaveArmedRef = useRef(false);
  const selectedPileIdRef = useRef<string | null>(null);
  // The pile modal's visible verb list, reported by its
  // ItemListSurface (Inventory Unification, 2026-10-31):
  // digit dispatch reads THIS — the verbs in the order
  // the player sees them, search/sort/fold applied — so
  // the badge numbers and the keys can never disagree.
  const pileVisibleVerbsRef = useRef<{
    pileId: string;
    verbs: ItemListVisibleVerb[];
  } | null>(null);
  const [placement, setPlacement] = useState<PlacementMode | null>(null);
  const [placementAnchor, setPlacementAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [placementNote, setPlacementNote] = useState<string | null>(null);
  const placementRef = useRef<PlacementMode | null>(null);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() =>
    inventory.stacksSnapshot().map((stack) =>
      toInventoryItem(stack, inventory, charmStateRef.current),
    ),
  );
  const [capacityText, setCapacityText] = useState(
    () =>
      `Carrying ${formatLb(inventory.usedLb())} lb / ${formatLb(inventory.capacityLb())} lb`,
  );

  // Inventory sort preference (Adam, 2026-10-31): a
  // per-device UI pref in the shared settings key (the
  // font/look pattern) — NEVER in the world save. The
  // FACTS it orders by are Systems' (acquisition order +
  // category table, read live at render below); the shell
  // owns only the preference and its persistence.
  const [inventorySort, setInventorySort] =
    useState<InventorySortPreference>(loadInventorySort);
  const handleInventorySortChange = (pref: InventorySortPreference) => {
    setInventorySort(pref);
    saveInventorySort(pref);
  };

  const busTargetsRef = useRef<BusHarvestTarget[]>([]);
  // THE ONE PICK (Adam's contract, 2026-10-31 — "we need
  // the pill and the 'E' to match"): the render's winner,
  // stored. The pill renders it; E, R, and the cauldron
  // placement read THIS — no press path re-derives a
  // winner of its own (the four derivations that used to
  // agree by care are one derivation now). Written every
  // render below, beside the useWinner computation; the
  // events that can change the pick (move, look, camera,
  // target-set, placed-state) all set state and so all
  // render — the stored pick is exactly as fresh as the
  // pill the player is looking at, by construction.
  const useWinnerRef = useRef<UseWinner | null>(null);
  const transitionTimerRef = useRef<number | undefined>(undefined);
  const feedbackCounterRef = useRef(0);

  // PAUSE (Adam, 2026-10-26 — core 54e525c): the engine pause
  // flag, mirrored for the shell. The ref is what the timers
  // read (intervals/rAF loops close over it, never over state);
  // the state drives the Paused indicator. The flag is SET by
  // the trigger effect below (blur / hidden) and CLEARED only
  // by the indicator's tap (tap-to-resume, pinned) — nothing
  // here auto-resumes on focus return.
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  // THE LOST-GRAPHICS NOTE (UI, 2026-11-03; pair to
  // Background's renderer context recovery, 7b2b94c):
  // while the WebGL context is lost the canvas is
  // white and reads as a dead game — this state
  // carries the plain line that says otherwise. The
  // bus pair is the whole contract (show on lost,
  // clear on restored); the game recovers with or
  // without the note.
  const [contextLost, setContextLost] = useState(false);
  useEffect(() => {
    const offLost = bus.on('renderer:context-lost', () =>
      setContextLost(true),
    );
    const offRestored = bus.on('renderer:context-restored', () =>
      setContextLost(false),
    );
    // Seed from the renderer's own fact in case the
    // loss predates this subscription.
    if (rendererRef.current?.isContextLost()) setContextLost(true);
    return () => {
      offLost();
      offRestored();
    };
  }, []);

  const refreshInventory = () => {
    refreshFillOffer();
    setInventoryItems(
      inventory.stacksSnapshot().map((stack) =>
        toInventoryItem(stack, inventory, charmStateRef.current),
      ),
    );
    // Every inventory change re-syncs the shrew effect
    // (carried may have flipped — grant, consume, take,
    // drop, eat). The 1 s timer below is the backstop
    // for any mutation path that skips this refresh.
    syncShrewEffect();
    setCapacityText(
      `Carrying ${formatLb(inventory.usedLb())} lb / ${formatLb(inventory.capacityLb())} lb`,
    );
    // UMBRELLA DRIVING: every inventory change flows through
    // here (harvest, craft, eat, cook, place, wear, deposit,
    // drop, pile pickup), so the carried-umbrella graphic
    // tracks the live inventory — no equip step, duplicates
    // do not stack, one boolean to the renderer. Guarded:
    // refreshInventory is never called before boot, but the
    // ?. keeps an early call from crashing.
    rendererRef.current?.setCarriesUmbrella(carriesUmbrella(inventory));
    // TORCH DRIVING (same pattern): the carried lit-torch
    // model + light tracks the live inventory — one
    // boolean, lit torch carried or not. The renderer owns
    // the model + light (left hand, supersedes the candle);
    // the shell only drives the boolean.
    rendererRef.current?.setCarriesLitTorch(
      inventory.count(ITEMS.litTorch) > 0,
    );
  };

  // The FILL offer recompute (the jar build): water
  // within reach + an empty jar carried.
  // THE FILL GATE WIDENED (Adam's commission, the
  // salves + moss batch, 2026-11-03): the offer stands
  // NEAR water, not only in it — an empty jar carried
  // and water within reach raises the option on the
  // bank as at the wade. The range is the water
  // module's own proximity read at the scry's reach
  // (FILL_WATER_RANGE, DRAFT — one range for both
  // water doors unless Adam splits them).
  const FILL_WATER_RANGE = 2.5;
  const refreshFillOffer = (): void => {
    const player = playerRef.current;
    const offer =
      player !== null &&
      isNearWater(genRef.current, player.x, player.z, FILL_WATER_RANGE) &&
      inventory.count('clay-jar') > 0;
    fillOfferRef.current = offer;
    setFillOffer(offer);
  };

  // FILL (Adam's door set: the water's own pill reads
  // 'Fill Jar [R]' beside Scry's E): the grant swaps
  // clay-jar -> water-jar with the extra pound checked
  // first; its refusals speak verbatim.
  const runFillJar = (): void => {
    const outcome = fillJar(inventory);
    if (outcome.filled === false) {
      showFeedback(outcome.reason, 'blocked');
      return;
    }
    refreshInventory();
    saveNow();
    showFeedback('The jar fills.', 'gain');
  };

  // The DUMP certification (the jar build's contract):
  // Background's patch disc at the point names the
  // ground first; no patch — the composed water fact
  // under the aim names real water; neither — dry.
  const certifyDumpTarget = (
    x: number,
    z: number,
  ): 'dry' | 'mud' | 'water' => {
    const patch = jarPatchState.patchAt(x, z);
    if (patch !== null) return patch.kind;
    return siteWaterFacts(genRef.current, x, z).inWater
      ? 'water'
      : 'dry';
  };

  // The DUMP arm (the water-jar row's Dump verb): the
  // pack closes, any placement arm yields (one armed
  // aim at a time), and the crosshair takes over.
  const handleDumpItem = (): void => {
    if (inventory.count('water-jar') <= 0) return;
    setInventoryOpen(false);
    if (placementRef.current !== null) handlePlaceCancel();
    dumpArmedRef.current = true;
    setDumpArmed(true);
    // The aim certifies NOW, not only on the next
    // anchor pass — a still player arming the pour
    // reads her ground immediately.
    const aim = aimedPlacementPoint();
    setDumpAim(
      aim
        ? { x: aim.x, z: aim.z, cert: certifyDumpTarget(aim.x, aim.z) }
        : null,
    );
  };

  const cancelDump = (): void => {
    dumpArmedRef.current = false;
    setDumpArmed(false);
    setDumpAim(null);
  };

  // The pour: certify at the crosshair's ground point,
  // run Systems' grant (a water certification refuses
  // inside the grant, its sentence speaks, the jar is
  // kept, and the arm STAYS up for a re-aim — the trap
  // arm's refusal discipline), then seat the world's
  // half: dry -> a mud patch at the point; mud -> that
  // patch rises to water.
  const confirmDump = (): void => {
    const aim = aimedPlacementPoint();
    if (aim === null) {
      showFeedback('Nowhere to pour it.', 'blocked');
      return;
    }
    const cert = certifyDumpTarget(aim.x, aim.z);
    const outcome = dumpJar(
      inventory,
      cert as Parameters<typeof dumpJar>[1],
    );
    if (outcome.dumped === false) {
      showFeedback(outcome.reason, 'blocked');
      return;
    }
    if (outcome.patch === 'mud') {
      jarPatchState.seat('mud', aim.x, aim.z);
      showFeedback('The pour makes mud.', 'gain');
    } else {
      const patch = jarPatchState.patchAt(aim.x, aim.z);
      if (patch !== null) jarPatchState.rise(patch.id);
      showFeedback('The mud rises to water.', 'gain');
    }
    cancelDump();
    refreshInventory();
    saveNow();
  };

  // THE APPLY DOOR (the glow-paint build, 2026-11-03;
  // Background's ratified claim, DEV's seam relay):
  // the dose row's Apply verb arms the application,
  // the dump arm's twin — the pack closes, the other
  // arms yield, and the crosshair takes over. The
  // certification is the claim's refusal ladder, read
  // shell-side: not underground (the paint holds only
  // in cave dark) / nothing faced (the renderer's
  // cave-surface raycast comes back empty) / already
  // painted (the register's pre-read holds the spot).
  // THE GRANT (Systems, revised contract, DEV relay
  // 2026-11-03): applyGlowDose wraps the consumption —
  // the register crosses into Systems as the shell's
  // bound seat callback, never an import. The
  // aim-side refusals (not underground, nothing
  // faced) stay the door's voice and precede the
  // seat; the grant owns the dose check ('no-dose'),
  // the occupied refusal (the seat's null), the one
  // consumption, and the exercised door — a refusal
  // consumes nothing and teaches nothing, in one
  // tested home.
  const certifyApplyTarget = (): ApplyCert => {
    if (!dimensionState.isUnderground()) {
      return { cert: 'not-underground', surface: null, spot: null };
    }
    const aim = rendererRef.current?.aimAtCaveSurface(PAINT_REACH_M) ?? null;
    if (aim === null) {
      return { cert: 'nothing-faced', surface: null, spot: null };
    }
    const patch = mossPaintState.patchAt(
      dimensionState.activeKey(),
      aim.x,
      aim.y,
      aim.z,
    );
    if (patch !== null) {
      return { cert: 'already-painted', surface: aim.surface, spot: null };
    }
    return {
      cert: 'clear',
      surface: aim.surface,
      spot: {
        x: aim.x,
        y: aim.y,
        z: aim.z,
        surface: aim.surface,
        nx: aim.nx,
        nz: aim.nz,
      },
    };
  };

  const handleApplyItem = (): void => {
    if (inventory.count(GLOW_DOSE_ID) <= 0) return;
    setInventoryOpen(false);
    if (placementRef.current !== null) handlePlaceCancel();
    if (dumpArmedRef.current) cancelDump();
    applyArmedRef.current = true;
    setApplyArmed(true);
    // The aim certifies NOW, not only on the next
    // anchor pass (the dump arm's discipline).
    const cert = certifyApplyTarget();
    setApplyAim({ cert: cert.cert, surface: cert.surface });
  };

  const cancelApply = (): void => {
    applyArmedRef.current = false;
    setApplyArmed(false);
    setApplyAim(null);
  };

  // The application: the aim-side refusals speak
  // first, in the door's voice (the arm STAYS up —
  // the dump arm's refusal discipline); then the
  // grant runs with the bound seat, and its two
  // codes voice the rest. The seat callback folds
  // the register's pre-read into the seat attempt:
  // a held spot returns null without seating, a
  // seat's own null is the same answer — the grant
  // reads both as 'occupied'.
  const confirmApply = (): void => {
    const cert = certifyApplyTarget();
    setApplyAim({ cert: cert.cert, surface: cert.surface });
    if (cert.cert === 'not-underground') {
      showFeedback(
        'Open sky drinks the glow — the paint holds only in cave dark.',
        'blocked',
      );
      return;
    }
    if (cert.cert === 'nothing-faced' || cert.spot === null) {
      showFeedback('Nothing faced to paint.', 'blocked');
      return;
    }
    const spot = cert.spot;
    const dimensionKey = dimensionState.activeKey();
    const outcome = applyGlowDose(inventory, () => {
      if (
        mossPaintState.patchAt(dimensionKey, spot.x, spot.y, spot.z) !== null
      ) {
        return null;
      }
      const patch = mossPaintState.seatPatch(dimensionKey, spot);
      return patch?.id ?? null;
    });
    if (outcome.ok === false) {
      showFeedback(
        outcome.code === 'no-dose'
          ? 'She carries no dose to paint with.'
          : 'That spot already glows.',
        'blocked',
      );
      return;
    }
    showFeedback('She paints the glow on — the light will stay.', 'gain');
    cancelApply();
    refreshInventory();
    saveNow();
  };


  // Save meta mirror: seed / camera / position as of the latest
  // render, so saveNow() stays correct even when called from a
  // first-render closure (the boot effect's listeners, pagehide).
  // Live instances (inventory, hunger, wardrobe) and the engine
  // singletons are read directly, never mirrored.
  const saveMetaRef = useRef({
    seed: DEFAULT_SEED,
    cameraMode: 'first' as CameraMode,
    position: { x: 0, z: 0 },
  });
  useEffect(() => {
    saveMetaRef.current = { seed, cameraMode, position };
  });

  // Write the current game to localStorage (see ./systems/save.ts).
  // Never throws and never blocks play: serialization + storage
  // failures are swallowed inside saveGame, and this wrapper adds
  // its own guard. Called after every meaningful change (harvest,
  // craft, eat, cook, place, wear/remove, deposit/withdraw) and on
  // pagehide — not on a timer, so a quiet session writes nothing.
  // UNLOAD-SAVE SUPPRESSION (hotfix, 2026-10-30 — Adam
  // hit it live: New Game resurrected the old save). The
  // swap/clear-then-reload routes (bring-here, restore,
  // New Game) deliberately write or clear the save key
  // and then reload — and the boot effect's pagehide
  // autosave fires DURING that unload and writes the
  // live session straight back over the deliberate
  // write. Each such route sets this mark immediately
  // before its reload; the pagehide writer checks it
  // and stands down. A ref, not state: the pagehide
  // closure is first-render and must read the live mark,
  // and no render should follow the mark anyway (the
  // page is leaving). Gameplay saves never set it.
  const unloadSaveSuppressedRef = useRef(false);

  const saveNow = () => {
    try {
      const meta = saveMetaRef.current;
      const player = playerRef.current;
      // THE BONE LATCH FOLD-IN (one-of-every-bone,
      // LAW 2): every save folds the acquisition union
      // (carried ∪ awakened ∪ saved) back into the
      // record through Systems' one helper, and the
      // shell's saved set becomes the folded result —
      // a kind once acquired counts forever, spent,
      // dropped, or woken.
      const boneAcquisitionsFold = boneAcquisitionsFor(
        inventory,
        charmStateRef.current
          .snapshot()
          .map((awakening) => awakening.kind),
        savedBoneAcquisitionsRef.current,
      );
      savedBoneAcquisitionsRef.current = boneAcquisitionsFold;
      // DIMENSION BUCKETS — THE SURFACE READ (Background's
      // snapshotSurface, 9d1d324): the save's top level
      // carries the SURFACE's stores byte-for-byte wherever
      // she stands. Underground the live pile/harvest
      // stores are the active dimension's, so the top-level
      // piles + harvestState below read from this one
      // surface snapshot (live on the surface, the parked
      // slot inside a dimension) — reading the live stores
      // underground would write the dimension's state at
      // both levels, and the boot relocation pass would
      // merge the stray copy into the bucket (a doubled
      // pile). One read, both expressions.
      const surfaceStores = dimensionBuckets.snapshotSurface();
      const data = serializeSave({
          seed: meta.seed,
          // World name rides saveNow (first-run dialog +
          // cloud-tab rename set it; undefined = unnamed,
          // omitted — the serialize spread drops it).
          ...(worldNameRef.current !== undefined
            ? { worldName: worldNameRef.current }
            : {}),
          cameraMode: meta.cameraMode,
          position: player
            ? { x: player.x, z: player.z }
            : meta.position,
          inventory: inventory.stacksSnapshot(),
          // ACQUISITION ORDER (inventory sorting,
          // 2026-10-31): the Recent sort's memory rides
          // every save (Systems' field; absent in legacy
          // documents, which load as []).
          acquisitionOrder: inventory.acquisitionOrder(),
          hunger: hunger.value(),
          worn: wardrobe.wornItemIds(),
          // WORLD-STATE SAVE WIRING: ids + lighting ride
          // every save (serialize fills a deterministic id
          // for any id-less entry; restore validates on load).
          fires: fireState.snapshot().map((fire) => ({
            id: fire.id,
            type: fire.type,
            x: fire.x,
            z: fire.z,
            rotY: fire.rotY ?? 0,
            lit: fire.lit,
            lighting: fire.lighting,
          })),
          houses: shelterState.snapshot().map((house) => {
            const store = homeStoresRef.current.get(house.id);
            const ids =
              homeStoreItemsRef.current.get(house.id) ?? new Set<string>();
            return {
              type: house.type,
              x: house.x,
              z: house.z,
              rotY: house.rotY ?? 0,
              contents: [...ids]
                .filter((id) => (store?.count(id) ?? 0) > 0)
                .map((id) => ({
                  item: id,
                  quantity: store?.count(id) ?? 0,
                })),
            };
          }),
          looms: loomState.snapshot().map((loom) => ({
            x: loom.x,
            z: loom.z,
            rotY: loom.rotY ?? 0,
          })),
          // PILE SAVE WIRING (multi-kind, 2026-10-27): the
          // The SURFACE pile set (the surfaceStores read
          // above) rides every save as stacks +
          // position (no id in the document — boot restore
          // derives it from coords; serializeSave writes
          // stacks normalized, order preserved, never
          // merged). The legacy first-kind-only map is
          // gone: it lost non-first kinds across a save.
          piles: surfaceStores.piles.map((pile) => ({
            stacks: pile.stacks.map((stack) => ({
              item: stack.item,
              quantity: stack.quantity,
            })),
            x: pile.x,
            z: pile.z,
          })),
          // DIMENSION BUCKETS (the store swap, cd1ef2e;
          // the shell seat, 2026-11-03): the non-surface
          // dimensions' parked piles + harvest ride as
          // Systems' dimensionStates — the surface never
          // appears (it keeps the top-level fields above,
          // byte-for-byte). The mapping mirrors the
          // top-level expressions exactly: piles as
          // stacks + position, the harvest snapshot
          // as-is (serialize deep-copies both).
          dimensionStates: Object.fromEntries(
            Object.entries(dimensionBuckets.snapshotBuckets()).map(
              ([key, bucket]) => [
                key,
                {
                  piles: bucket.piles.map((pile) => ({
                    stacks: pile.stacks.map((stack) => ({
                      item: stack.item,
                      quantity: stack.quantity,
                    })),
                    x: pile.x,
                    z: pile.z,
                  })),
                  harvest: bucket.harvest,
                },
              ],
            ),
          ),
          // TRAP SAVE WIRING: the live trap set rides every
          // save (snapshot as-is — ids + types verbatim, no
          // filtering; serializeSave writes them verbatim and
          // trapState.restore() validates on load).
          traps: trapState.snapshot(),
          // TENT SAVE WIRING (tent shell, 2026-10-28):
          // the shell's placed-tent set rides every save
          // (x + z + shell id verbatim; serializeSave
          // writes them verbatim and deserialize passes
          // them through — the shell validates finite
          // coords at boot). Without this, placed tents
          // vanish on reload.
          tents: placedTentsRef.current.map((tent) => ({
            x: tent.x,
            z: tent.z,
            id: tent.id,
          })),
          // BAG SAVE WIRING (the portable hut): the
          // shell's placed-bag set rides every save the
          // tents way (x + z + shell id verbatim).
          // Without this, placed bags vanish on reload.
          bags: placedBagsRef.current.map((bag) => ({
            x: bag.x,
            z: bag.z,
            id: bag.id,
          })),
          // STUMP SAVE WIRING (stumpy shell, 2026-10-28):
          // the live stump-addition set rides every save
          // (snapshot as-is — site ids + coords + additions
          // verbatim; serializeSave writes them verbatim
          // and stumpState.restore() validates on load).
          // Without this, upgrades vanish on reload.
          stumps: stumpState.snapshot(),
          // JOURNAL LINK FLAG rides every save (Systems'
          // shape; false until the Linking act sets it) —
          // read from the ref (see the flag's declaration):
          // a render-scope read here wrote the stale value.
          journalLinked: journalLinkedRef.current,
          // DIMENSION VISIT (cave close-out, 2026-10-30):
          // the visit a save is written in, from
          // dimensionState's snapshot — {key, mouthId}
          // while underground, null on the surface
          // (Systems' shape: null = a surface save). The
          // boot consumer places her at the mouth.
          dimensionVisit: (() => {
            if (!dimensionState.isUnderground()) return null;
            const snap = dimensionState.snapshot();
            return { key: snap.key, mouthId: snap.mouthId };
          })(),
          // PLACED-TORCH SAVE WIRING: the live placed-torch
          // set rides every save as-is (ids + positions
          // verbatim; serialize writes ids when present,
          // restore validates on load and drops id-less
          // entries). A path of torches survives refresh.
          torches: torchState.snapshot(),
          // PLACED-ALTAR SAVE WIRING: the live placed-altar
          // set rides every save as-is (ids + positions
          // verbatim; serialize writes ids when present,
          // restore validates on load and drops id-less
          // entries). Placed altars survive refresh.
          altars: altarState.snapshot(),
          // PLACED-DESK SAVE WIRING: the live placed-desk
          // set rides every save as-is (positions verbatim;
          // ids ride when the entity provides them — the
          // SavedDesk id is optional, and restore keeps
          // id-less entries and mints ids). Placed desks
          // survive refresh.
          desks: deskState.snapshot(),
          craftedWorkstations: workstationState.snapshot(),
          // PLACED-CAULDRON SAVE WIRING: the entity
          // snapshot rides as-is ({hearthId, x, z} —
          // Systems' widened SavedCauldron passthrough);
          // the hearthId is the only load-bearing field
          // (restore rebinds position from the fire).
          // Placed cauldrons survive refresh.
          cauldrons: cauldronState.snapshot(),
          // Jar-made ground patches (the jar build's
          // rider: the state landed with its save field
          // but no shell wiring — the snapshot joins the
          // draft here, beside its sibling states).
          patches: jarPatchState.snapshot(),
          // Glow-paint patches (the glow-paint build):
          // the register's snapshot rides every save
          // beside its sibling states, whole and opaque
          // (SaveData.mossPaint, Systems' seat — the
          // snapshot shape passes through unconverted).
          mossPaint: mossPaintState.snapshot(),
          // Named places (the naming build): the
          // register's snapshot rides every save beside
          // its sibling states, whole and opaque
          // (SaveData.namedPlaces, Systems' seat — the
          // snapshot shape passes through unconverted).
          namedPlaces: namedPlacesRef.current.snapshot(),
          // Hedges (the Hedge door build): the
          // register's snapshot rides every save
          // beside its sibling states (SaveData.
          // hedges, Systems' seat).
          hedges: hedgeStateRef.current.snapshot(),
          // HearthHome seals (the door build): the
          // register's snapshot rides every save beside
          // the hedges (SaveData.hearthhome, Systems'
          // seat).
          hearthhome: hearthhomeStateRef.current.snapshot(),
          // RITUAL SAVE WIRING: stagings + awakenings ride
          // every save as-is (StagingBook / CharmState
          // snapshots; serialize writes them verbatim,
          // restore validates on load and drops bad
          // entries). Staged rituals + awakenings survive
          // refresh.
          stagings: stagingBookRef.current.snapshot(),
          awakenings: charmStateRef.current.snapshot(),
          // COMPANIONS SAVE WIRING (build 1, 2026-10-31):
          // the touched individuals' records ride every
          // save as-is (Systems' SavedCompanion shape;
          // serialize writes them verbatim, load validates
          // and defaults []). Bonds survive refresh.
          companions: companionStateRef.current.snapshot(),
          // FAMILIAR NAMES SAVE WIRING (the familiar road,
          // 2026-11-02): the kinds whose true names she
          // knows ride every save (FamiliarState's list).
          familiarNames: familiarStateRef.current.knownKinds(),
          // DISCOVERY SAVE WIRING (the Raven Guide,
          // 2026-10-31): the grove fact rides every save
          // (the day she found it, or null while unfound).
          discovery: discoveryStateRef.current.snapshot(),
          // FRAGMENT SAVE WIRING (First-Fragment
          // Presentation, 2026-10-31): the journal's
          // mark progress rides every save as-is
          // (Systems' SavedMarkProgress shape; serialize
          // writes it verbatim, load validates).
          fragments: fragmentStateRef.current.snapshot(),
          // QUEST SAVE WIRING: the live quest flags ride every
          // save (all-false serializes as all-false; absent on
          // old saves reads as all-false on load). Flags are
          // set by the wiring follow-up; the tab only reads.
          quests: {
            ...questFlagsRef.current,
            ...(activeQuestIdRef.current
              ? { active: activeQuestIdRef.current }
              : {}),
            // THE LATCH (the latch law): the ever-completed
            // ids ride every save — the facts site keeps the
            // set current (newlyCompleted unions in at
            // render), saveNow only writes it back.
            completed: [...latchedCompletedRef.current],
          },
          // LOOK SAVE WIRING: the live look counts ride
          // every save (snapshot as-is, first-look order;
          // serialize writes them verbatim, restore
          // validates on load). Knowledge survives refresh.
          nameSight: nameSightRef.current.snapshot(),
          // KNOWN-FACTS SAVE WIRING (the info card's
          // amendment, 2026-11-01): the register rides
          // every save on the nameSight pattern, or the
          // card would read true in-session and empty
          // after a reload.
          knowledge: knowledgeSnapshot(),
          // THE BONE LATCH (one-of-every-bone, LAW 2):
          // the folded union rides every save as-is
          // (Systems' field; the seat kind-validates +
          // dedupes on read, old saves load []).
          boneAcquisitions: boneAcquisitionsFold,
          // WORLD-STATE SAVE WIRING: harvest state, sky
          // cycle, and facing ride every save (all three
          // draft fields optional — serialize defaults
          // missing ones; the sky reads the live renderer,
          // null when the rig is gone).
          harvestState: surfaceStores.harvest,
          sky: rendererRef.current?.snapshotSky() ?? undefined,
          // The weather spell record rides beside the sky
          // (W1 save plumbing; the field is Systems',
          // seated in save.ts — the record itself is the
          // machine's hosted state, read via the renderer
          // seam). Null until the machine seats one.
          weather: rendererRef.current?.weatherRecord() ?? null,
          coldWet: coldWetRef.current?.snapshot(),
          // THE FERAL SEATS ride every save (save.ts
          // hosts all three leniently): her injury
          // stage, the encounter ledger's warned ids,
          // and the last completed sleep's seat.
          injury: injuryRef.current?.snapshot(),
          feralWarned: feralRef.current?.snapshot(),
          lastSleepSite: lastSleepSiteRef.current,
          // THE SCENT rides every save on the same
          // pattern (save.ts hosts it leniently).
          scent: scentRef.current?.snapshot(),
          facing: player ? player.snapshotFacing() : undefined,
        });
      saveGame(data);
      // CLOUD MIRROR (Adam, 2026-10-29): after the local
      // write succeeds, mirror to the cloud. Fire-and-
      // forget: mirrorSave never throws and no-ops when
      // cloud is off, so a failed mirror never breaks
      // play (the sync note records it for the panel).
      // THE CONFLICT PASS (2026-11-01): when the mirror
      // settles, a conflict it raised is announced once
      // per episode (the write-guard dialog).
      void mirrorSave(CLOUD_BASE_URL, data).then(() => {
        announceCloudConflict(syncState().mirrorConflict);
      });
    } catch {
      // Saving must never break play.
    }
  };

  // CLOUD SAVES (Adam, 2026-10-29 — panel + wiring, one
  // landing with the panel). App owns every cloud fact
  // and action; the panel is props-only. No listener in
  // v1: state refreshes when Options opens + after each
  // action (open/action refresh only). saveNow mirrors
  // separately above (the one funnel). Confirm snapshots:
  // the bring/remove/restore Popups below name the world
  // as of press time; no saveNow can fire while the modal
  // is open (saves fire on gameplay actions + pagehide,
  // neither reachable behind the modal), so snapshot and
  // live state cannot diverge mid-confirm.
  const [cloudSync, setCloudSync] = useState(() => syncState());
  const [cloudWords, setCloudWords] = useState(() => getWords());
  const [cloudSaves, setCloudSaves] = useState<CloudSaveRow[]>([]);
  const [cloudParked, setCloudParked] = useState<CloudParkedSave | null>(
    () => {
      const parked = readParked();
      return parked === null
        ? null
        : {
            name: parked.worldName,
            seed: parked.seed,
            savedAt: parked.savedAt,
          };
    },
  );
  const [cloudNote, setCloudNote] = useState<string | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudPendingBring, setCloudPendingBring] = useState<{
    slot: string;
    local: SaveData;
    parked: SaveData | null;
    // The words the bring runs under: the device's own
    // for the stored list, or the TYPED words for the
    // load-from-cloud door (2026-10-29) — snapshotted at
    // press time like the rest of the pending state.
    words: [string, string, string] | null;
    // Incoming world's name, from whichever list the
    // row came from (the confirm names it).
    name?: string;
  } | null>(null);
  // LOAD-FROM-CLOUD DOOR state (Adam, 2026-10-29): the
  // typed-words lookup's own rows + note + canonical
  // words — kept separate from the stored-words list so
  // a lookup never clobbers it. null rows = no lookup
  // yet this session.
  const [cloudLoadRows, setCloudLoadRows] =
    useState<CloudSaveRow[] | null>(null);
  const [cloudLoadNote, setCloudLoadNote] = useState<string | null>(null);
  const [cloudLoadWords, setCloudLoadWords] =
    useState<[string, string, string] | null>(null);
  const [cloudPendingRemove, setCloudPendingRemove] = useState<{
    slot: string;
    row: CloudSaveRow;
  } | null>(null);
  // THE WRITE-GUARD DIALOG (the conflict pass,
  // 2026-11-01): the conflict episode currently being
  // asked about, or null. The latch remembers the
  // raise stamp of the last episode announced, so
  // the dialog opens ONCE PER EPISODE — never twice
  // for the same raise, however often state refreshes.
  const [cloudConflictPrompt, setCloudConflictPrompt] =
    useState<MirrorConflict | null>(null);
  const cloudConflictAnnouncedRef = useRef<string | null>(null);
  const announceCloudConflict = (conflict: MirrorConflict | null) => {
    if (conflict === null) return;
    // The latch keys on the episode AND its decision
    // state: a Save Now press REOPENS a decided
    // episode module-side (same raise stamp, decision
    // undone), and that return to undecided must ask
    // again — a latch on the stamp alone would leave
    // the reopening silent, and no decision may be a
    // trap (DEV, on the conflict claim).
    const key = `${conflict.at}:${conflict.resolvedKeep ? 'kept' : 'open'}`;
    if (cloudConflictAnnouncedRef.current === key) return;
    cloudConflictAnnouncedRef.current = key;
    if (!conflict.resolvedKeep) setCloudConflictPrompt(conflict);
  };
  // THE WAKE OFFER (the rework's third pass,
  // 2026-11-01): the probe's fresher finding,
  // offered once per shelf stamp per session. The
  // latch holds the stamp already offered; the
  // offer itself is a question, never an auto-load.
  const [cloudWakeOffer, setCloudWakeOffer] =
    useState<ShelfFresherFacts | null>(null);
  // ITEM INFO CARD (Adam's pin; claim 4ac343ed +
  // amendment 089f148d): the item whose detail card
  // stands, opened from any row of the unified surface
  // (pack / hut storage / piles / crafting). The shell
  // composes the card's facts at render from Systems'
  // register — the surface components render none.
  const [itemInfoId, setItemInfoId] = useState<string | null>(null);
  const openItemInfo = (id: string) => setItemInfoId(id);
  const cloudWakeOfferLatchedRef = useRef<string | null>(null);
  const [cloudPendingRestore, setCloudPendingRestore] =
    useState<SaveData | null>(null);
  const [cloudPendingNewGame, setCloudPendingNewGame] = useState<{
    local: SaveData;
    parked: SaveData | null;
  } | null>(null);
  // THE NEW WORLD → CLOUD SAVES DOOR (Adam's direct
  // request, 2026-11-03): the tab a pending Options
  // open should land on, set by the FirstRunDialog's
  // Cloud Saves button ('cloud') and cleared when
  // Options closes, so every ordinary open still
  // lands on Settings. Non-null also raises the
  // modal above the dialog family (stackAbove) —
  // the dialog renders later in the tree at the
  // same z-50 and would otherwise cover it.
  // Declared with the cloud state (not beside
  // optionsOpen, far below) because the folded
  // dialog's Esc effect above reads it as its
  // stand-aside guard.
  const [optionsTabRequest, setOptionsTabRequest] =
    useState<'cloud' | null>(null);

  const refreshCloudState = () => {
    const nextSync = syncState();
    setCloudSync(nextSync);
    announceCloudConflict(nextSync.mirrorConflict);
    setCloudWords(getWords());
    const parked = readParked();
    setCloudParked(
      parked === null
        ? null
        : {
            name: parked.worldName,
            seed: parked.seed,
            savedAt: parked.savedAt,
          },
    );
  };

  // Row-building for ANY words (load-door wiring,
  // 2026-10-29): list the fingerprint's slots, then read
  // each save's header for its row. The stored-words
  // refresh and the typed-words lookup share this — the
  // only difference is whose words and where the rows
  // land.
  const fetchCloudRows = async (
    words: [string, string, string],
  ): Promise<
    { ok: true; rows: CloudSaveRow[] } | { ok: false; reason: string }
  > => {
    const listed = await listCloudSaves(CLOUD_BASE_URL, words);
    if (listed.ok === false) {
      return { ok: false, reason: listed.reason };
    }
    const rows: CloudSaveRow[] = [];
    for (const slot of listed.value) {
      const fetched = await getCloudSave(CLOUD_BASE_URL, words, slot);
      if (fetched.ok) {
        rows.push({
          slot,
          name: fetched.value.name,
          seed: fetched.value.seed,
          updatedAt: fetched.value.updatedAt,
        });
      }
    }
    return { ok: true, rows };
  };

  const refreshCloudList = async () => {
    const words = getWords();
    if (!isCloudEnabled() || words === null) {
      setCloudSaves([]);
      return;
    }
    setCloudBusy(true);
    try {
      const res = await fetchCloudRows(words);
      if (res.ok === false) {
        setCloudNote(res.reason);
        setCloudSaves([]);
        return;
      }
      setCloudSaves(res.rows);
    } finally {
      setCloudBusy(false);
    }
  };

  // LOAD-FROM-CLOUD LOOKUP (Adam, 2026-10-29): validate
  // the typed words FIRST (canonicalizeWords — exactly
  // three, each a real cloud word; the typo catch), and
  // fetch only on success. Invalid input shows the
  // module's reason and fetches nothing. A valid lookup
  // with no saves shows the no-saves line (the #21 copy —
  // no oracle: unknown words and empty words read the
  // same).
  const handleCloudLoadLookup = async (input: string) => {
    const canon = canonicalizeWords(input);
    if (canon.ok === false) {
      setCloudLoadNote(canon.reason);
      setCloudLoadRows(null);
      setCloudLoadWords(null);
      return;
    }
    setCloudBusy(true);
    try {
      const res = await fetchCloudRows(canon.words);
      if (res.ok === false) {
        setCloudLoadNote(res.reason);
        setCloudLoadRows(null);
        setCloudLoadWords(null);
        return;
      }
      setCloudLoadWords(canon.words);
      setCloudLoadRows(res.rows);
      setCloudLoadNote(
        res.rows.length === 0
          ? 'No cloud saves found for those words.'
          : null,
      );
    } finally {
      setCloudBusy(false);
    }
  };

  // Refresh cloud state + list whenever Options opens.
  // (Placed here, not in the cloud block above: the deps
  // array reads optionsOpen at render time, so this
  // effect must sit AFTER its declaration — the #17
  // lesson. The cloud block's callbacks are plain
  // closures and read it safely from anywhere.)

  const handleCloudToggle = (on: boolean) => {
    if (!on) {
      const res = turnOff();
      if (!res.ok) {
        setCloudNote(res.reason ?? 'Could not turn cloud off.');
      } else {
        setCloudNote(null);
      }
      setCloudSaves([]);
      refreshCloudState();
      return;
    }
    // THE RE-ENABLE DOOR (the ungate pass, 2026-11-01):
    // a device HOLDING words turns truly back on here —
    // turnOn with the device's own stored words is the
    // module's only enable write, and without this call
    // the toggle was reveal-only forever (the
    // diagnosis's CRITICAL: the only road back in was a
    // cloud load's adoption side effect, wearing the
    // BROUGHT words). A wordless device stays
    // reveal-only: its opt-in completes via
    // turnOn/enterWords when words are chosen.
    const held = getWords();
    if (held !== null) {
      const res = turnOn(held);
      if (!res.ok) {
        setCloudNote(
          res.reason ?? 'Could not turn cloud back on.',
        );
        return;
      }
      setCloudNote(null);
      refreshCloudState();
      void refreshCloudList();
      return;
    }
    setCloudNote(null);
  };

  const handleCloudGenerateWords = () => {
    let words: [string, string, string];
    try {
      words = generateWords();
    } catch {
      setCloudNote(
        'Secure random numbers are unavailable in this browser.',
      );
      return;
    }
    const res = turnOn(words);
    if (!res.ok) {
      setCloudNote(
        res.reason ?? 'Could not store the words on this device.',
      );
      return;
    }
    setCloudNote(null);
    refreshCloudState();
  };

  const handleCloudEnterWords = (input: string) => {
    const res = enterWords(input);
    if (!res.ok) {
      setCloudNote(res.reason);
      return;
    }
    setCloudNote(null);
    refreshCloudState();
    void refreshCloudList();
  };

  // RETIRED (2026-11-01): handleCloudAdoptWords and
  // handleArmMirroring — the adopt door and the arm
  // button left the panel with Adam's rulings (word
  // changing is a future feature, designed separately;
  // the hold itself was retired for the timestamp
  // guard). armMirror still runs on the restore path
  // below, where a deliberate application arms copying.

  const runCloudBring = async (
    slot: string,
    words: [string, string, string] | null,
  ) => {
    if (words === null) {
      setCloudNote('No cloud words on this device.');
      return;
    }
    setCloudBusy(true);
    try {
      // LOAD ADOPTS (Adam's ruling, 2026-11-01: 'the words
      // I entered to get the save downloaded and loaded'
      // are this device's words): the identity flips
      // AHEAD of the fetch, so the bring lands under the
      // device's own identity — bringHere seats the basis
      // to the brought copy's stamp, and the brought
      // world mirrors under the words it was fetched
      // with. A stored-list bring passes the device's
      // own words (the module's same-identity arm is a
      // true no-op). If the fetch then fails, the guard
      // stands behind the flip: adoption reset the basis,
      // so this device's next write against that shelf
      // asks instead of overwriting.
      const adopt = adoptWordSet(words);
      if (adopt.ok === false) {
        setCloudNote(adopt.reason);
        return;
      }
      refreshCloudState();
      const brought = await bringHere(CLOUD_BASE_URL, words, slot);
      if (brought.ok === false) {
        setCloudNote(brought.reason);
        return;
      }
      const current = loadSave();
      if (current !== null && !parkLocal(current)) {
        setCloudNote(
          'Could not park the current save — bring-down cancelled, nothing changed.',
        );
        return;
      }
      saveGame(brought.value);
      // Install = write + fresh boot: the boot path is
      // the tested restore path; mid-session rehydration
      // is a far larger surface. Reload boots into the
      // brought save. The pagehide autosave stands down
      // (unloadSaveSuppressedRef) — it would overwrite
      // the brought save with this session's state
      // during the unload.
      unloadSaveSuppressedRef.current = true;
      window.location.reload();
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudBringHere = (slot: string) => {
    // Stored-words bring: snapshot the device's words +
    // the row's name for the confirm.
    const row = cloudSaves.find((candidate) => candidate.slot === slot);
    // Nothing displaced, nothing to confirm or park.
    const current = loadSave();
    if (current === null) {
      void runCloudBring(slot, getWords());
      return;
    }
    setCloudPendingBring({
      slot,
      local: current,
      parked: readParked(),
      words: getWords(),
      name: row?.name,
    });
  };

  // Load-door bring: the same confirm + park + install
  // path, under the TYPED words from the lookup — and
  // runCloudBring ADOPTS those words as this device's
  // identity ahead of the fetch (LOAD ADOPTS, Adam,
  // 2026-11-01), so the brought world lands as this
  // device's own world under its own words.
  const handleCloudLoadBringHere = (slot: string) => {
    const row = (cloudLoadRows ?? []).find(
      (candidate) => candidate.slot === slot,
    );
    const current = loadSave();
    if (current === null) {
      void runCloudBring(slot, cloudLoadWords);
      return;
    }
    setCloudPendingBring({
      slot,
      local: current,
      parked: readParked(),
      words: cloudLoadWords,
      name: row?.name,
    });
  };

  const confirmCloudBring = () => {
    const pending = cloudPendingBring;
    setCloudPendingBring(null);
    if (pending !== null) void runCloudBring(pending.slot, pending.words);
  };

  const confirmCloudRemove = async () => {
    const pending = cloudPendingRemove;
    setCloudPendingRemove(null);
    if (pending === null) return;
    const words = getWords();
    if (words === null) {
      setCloudNote('No cloud words on this device.');
      return;
    }
    setCloudBusy(true);
    try {
      const res = await deleteCloudSave(CLOUD_BASE_URL, words, pending.slot);
      if (res.ok) {
        setCloudNote(
          'Removed from cloud. Mirroring is still on — the next save will copy this world to the cloud again.',
        );
        await refreshCloudList();
      } else {
        setCloudNote(res.reason ?? 'Could not remove the cloud copy.');
      }
    } finally {
      setCloudBusy(false);
    }
  };

  // THE CONFLICT'S DOORS (the conflict pass,
  // 2026-11-01): KEEP is the module's decision write —
  // the episode is marked decided and mirroring stays
  // suppressed until a bring or a forced overwrite.
  // The dialog's dismiss (X / Escape / backdrop) IS
  // this door: focus and no-action default to KEEP.
  const handleCloudConflictKeep = () => {
    setCloudConflictPrompt(null);
    const res = resolveMirrorConflictKeep();
    if (!res.ok) {
      setCloudNote(res.reason ?? 'Could not record that choice.');
    }
    refreshCloudState();
    void probeCloudWakeOfferAfterCurrency();
  };

  // OVERWRITE: this device's CURRENT record writes
  // through, forced — saveNow first, so the shelf
  // receives the freshest local state, then the disk
  // record mirrors with force (a forced success
  // clears the episode module-side).
  const handleCloudConflictOverwrite = async () => {
    setCloudConflictPrompt(null);
    saveNow();
    const data = loadSave();
    if (data === null) {
      setCloudNote('Nothing saved on this device yet to copy up.');
      return;
    }
    setCloudBusy(true);
    try {
      const res = await mirrorSave(CLOUD_BASE_URL, data, { force: true });
      setCloudNote(
        res.ok
          ? "Copied this device's save over the shelf copy."
          : (res.reason ?? 'Could not copy over the shelf copy.'),
      );
    } finally {
      setCloudBusy(false);
    }
    refreshCloudState();
    void refreshCloudList();
  };

  // SAVE NOW (Adam's order — the diagnosis's State
  // 13; the rework's third pass): the deliberate
  // save. saveNow writes the local record through
  // the one funnel; mirrorNow then flushes at once
  // (the 60-second window bypassed, the freshness
  // check intact). The note is honest in every
  // state — a good local save under a failed cloud
  // copy says exactly that.
  const handleCloudSaveNow = async () => {
    saveNow();
    const data = loadSave();
    if (data === null) {
      setCloudNote('Nothing to save yet.');
      return;
    }
    if (getWords() === null || !isCloudEnabled()) {
      setCloudNote(
        getWords() === null
          ? 'Saved on this device. There are no cloud words here, so no copy went to a shelf.'
          : 'Saved on this device. Cloud is off, so no copy went to your shelf.',
      );
      refreshCloudState();
      return;
    }
    setCloudBusy(true);
    try {
      const res = await mirrorNow(CLOUD_BASE_URL, data);
      if (syncState().mirrorConflict !== null) {
        setCloudNote(
          'Saved on this device. A newer copy stands on the shelf, so nothing was copied over it.',
        );
      } else if (!res.ok) {
        setCloudNote(
          `Saved on this device. The cloud copy could not be made: ${res.reason ?? 'unknown error'}`,
        );
      } else if (res.mirrored) {
        setCloudNote('Saved — copied to your shelf just now.');
      } else {
        setCloudNote('Saved — this save is already on the shelf.');
      }
    } finally {
      setCloudBusy(false);
    }
    refreshCloudState();
    void refreshCloudList();
  };

  // THE WAKE OFFER probe: runs after boot and on
  // Options open (and again when a conflict is
  // resolved — keeping the newer copy makes loading
  // it the natural next question). A fresher finding
  // OFFERS the load; it never loads unasked. While
  // the write-guard dialog stands, the offer holds
  // (unlatched) for the next probe rather than
  // stacking a second question over the first.
  const probeCloudWakeOffer = async () => {
    const local = loadSave();
    const facts = await probeShelfFreshness(
      CLOUD_BASE_URL,
      local?.savedAt ?? null,
    );
    if (facts === null || !facts.fresher) return;
    if (cloudWakeOfferLatchedRef.current === facts.shelfUpdatedAt) return;
    if (
      cloudConflictPrompt !== null ||
      firstRunDialogOpen ||
      introOpen
    ) {
      return;
    }
    cloudWakeOfferLatchedRef.current = facts.shelfUpdatedAt;
    setCloudWakeOffer(facts);
  };

  const confirmCloudRestore = () => {
    const parked = cloudPendingRestore;
    setCloudPendingRestore(null);
    if (parked === null) {
      setCloudNote('Nothing parked.');
      return;
    }
    const current = loadSave();
    if (current !== null && !parkLocal(current)) {
      setCloudNote(
        'Could not park the current save — restore cancelled, nothing changed.',
      );
      return;
    }
    saveGame(parked);
    // A restore applied under the current identity is
    // the same deliberate application as a bring: it
    // arms copying if adoption left it held (DEV
    // ruling, 2026-10-31).
    armMirror();
    // Same install shape as bring-down: write + fresh boot.
    // The pagehide autosave stands down (see bring-down).
    unloadSaveSuppressedRef.current = true;
    window.location.reload();
  };

  const handleCloudRename = (name: string) => {
    setWorldName(name === '' ? undefined : name);
  };

  // New Game (Adam's pin: "it's a new game or it's not" —
  // FULLY FRESH, like first run). The mechanism is the
  // reload route, not regenerate: park the current save,
  // clearSave() (removes the save key ONLY — the park,
  // the cloud words/sync keys, and the settings key all
  // survive), then reload. A no-save boot is fully fresh
  // by construction (every default), and the existing
  // boot predicate opens the first-run dialog, whose
  // Begin (verbatim) re-opens the intro. A park failure
  // cancels BEFORE the clear: nothing changes.
  const runNewGame = () => {
    const current = loadSave();
    if (current !== null && !parkLocal(current)) {
      setCloudNote(
        'Could not park the current save — new game cancelled, nothing changed.',
      );
      return;
    }
    clearSave();
    // The pagehide autosave stands down: without the
    // mark it would write this session's save straight
    // back into the cleared key during the unload, and
    // the fresh boot would resurrect the old game
    // (Adam's live sighting, 2026-10-30).
    unloadSaveSuppressedRef.current = true;
    window.location.reload();
  };

  const handleNewGame = () => {
    // Nothing displaced, nothing to confirm or park —
    // run directly (mirrors bring-down's no-local case).
    const current = loadSave();
    if (current === null) {
      runNewGame();
      return;
    }
    setCloudPendingNewGame({ local: current, parked: readParked() });
  };

  // Folded new-game Begin (claim 3): the dialog already
  // collected the name + seed, so stash them for the
  // post-reload boot to consume, then run the ordinary
  // park + reload (runNewGame re-reads loadSave() at run
  // time, so what parks is the last saved state, not the
  // press-time snapshot). A failed stash degrades
  // honestly: the fresh boot shows the plain first-run
  // dialog and she enters the values again.
  const beginFoldedNewGame = (name: string, seed: string) => {
    try {
      window.localStorage.setItem(
        PENDING_NEW_WORLD_KEY,
        JSON.stringify({ name, seed }),
      );
    } catch {
      /* see above — the park + reload still run */
    }
    setCloudPendingNewGame(null);
    runNewGame();
  };

  // The folded dialog's Esc = its Back (the Popup shell
  // that used to carry this confirm mapped Esc to its
  // cancel; the fold keeps the key's meaning): close
  // parking nothing. It stands aside while the
  // dialog's own Cloud Saves door holds Options over
  // it (2026-11-03): that Esc belongs to Options,
  // and closing Options must return to this dialog,
  // not dismiss it. (The guard reads the door's
  // request state: no other path can open Options
  // over this dialog — it covers the screen, and
  // the central Esc ladder already stands aside
  // for it.)
  useEffect(() => {
    if (cloudPendingNewGame === null || optionsTabRequest !== null) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') setCloudPendingNewGame(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cloudPendingNewGame, optionsTabRequest]);

  const cloudPanelProps = {
    sync: cloudSync,
    words: cloudWords,
    saves: cloudSaves,
    parked: cloudParked,
    currentName: worldName,
    busy: cloudBusy,
    note: cloudNote,
    onToggle: handleCloudToggle,
    onGenerateWords: handleCloudGenerateWords,
    onEnterWords: handleCloudEnterWords,
    onRefreshList: () => {
      void refreshCloudList();
    },
    onBringHere: handleCloudBringHere,
    loadSaves: cloudLoadRows,
    loadNote: cloudLoadNote,
    onLoadLookup: (input: string) => {
      void handleCloudLoadLookup(input);
    },
    onLoadBringHere: handleCloudLoadBringHere,
    onRemove: (slot: string) => {
      const row = cloudSaves.find((candidate) => candidate.slot === slot);
      if (row !== undefined) setCloudPendingRemove({ slot, row });
    },
    onRestoreParked: () => {
      const parked = readParked();
      if (parked !== null) setCloudPendingRestore(parked);
    },
    onResolveConflictKeep: handleCloudConflictKeep,
    onResolveConflictOverwrite: () => {
      void handleCloudConflictOverwrite();
    },
    onSaveNow: () => {
      void handleCloudSaveNow();
    },
    onRename: handleCloudRename,
    onNewGame: handleNewGame,
  };

  // Project one world point to a screen anchor. Reads refs only, so
  // the boot effect's first-render copy stays valid. Ground points
  // clamp to the screen edge (the ground at her feet is a direction,
  // not a distant object); off-screen or behind-camera scatter
  // points return null (dropping beats clamping onto the wrong
  // object). Scatter anchors float ~1 m above the object's feet so
  // the chip sits on the thing, not under it — a presentation
  // offset, not a game fact.
  const projectAnchor = (
    x: number,
    z: number,
    kind: 'scatter' | 'ground',
    // A caller that knows the object's real height hands
    // it in (the guide's perch, from Background's seat);
    // scatter's ~1 m float stands otherwise.
    worldYOverride?: number,
  ): { x: number; y: number } | null => {
    const player = playerRef.current;
    const container = containerRef.current;
    if (!player || !container) return null;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return null;
    const point = projectWorldToScreen({
      worldX: x,
      worldY: kind === 'ground' ? 0 : worldYOverride ?? 1,
      worldZ: z,
      playerX: player.x,
      playerZ: player.z,
      pitch: player.pitch,
      yaw: player.yaw,
      mode: player.mode,
      facing: player.facing,
      aspect: width / height,
      eyeHeight: PLAYER_EYE_HEIGHT,
      thirdOffset: THIRD_PERSON_OFFSET,
      behindCamera: {
        distance: BEHIND_CAMERA_DISTANCE,
        height: BEHIND_CAMERA_HEIGHT,
        lookAhead: BEHIND_LOOK_AHEAD,
        lookHeight: BEHIND_LOOK_HEIGHT,
      },
    });
    if (!point) return null;
    if (kind === 'ground') {
      return { x: clampPercent(point.x), y: clampPercent(point.y) };
    }
    if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) {
      return null;
    }
    return point;
  };

  // The crosshair's ground point (Adam's crosshair ruling,
  // 2026-10-31): where the screen-center ray meets the
  // ground, through the same camera model projectAnchor
  // projects with — aim and anchors can never disagree.
  // Null when the gaze never meets the ground (level/up).
  const crosshairAimPoint = (): { x: number; z: number } | null => {
    const player = playerRef.current;
    const container = containerRef.current;
    if (!player || !container) return null;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return null;
    return screenCenterGroundPoint({
      playerX: player.x,
      playerZ: player.z,
      pitch: player.pitch,
      yaw: player.yaw,
      mode: player.mode,
      facing: player.facing,
      aspect: width / height,
      eyeHeight: PLAYER_EYE_HEIGHT,
      thirdOffset: THIRD_PERSON_OFFSET,
      behindCamera: {
        distance: BEHIND_CAMERA_DISTANCE,
        height: BEHIND_CAMERA_HEIGHT,
        lookAhead: BEHIND_LOOK_AHEAD,
        lookHeight: BEHIND_LOOK_HEIGHT,
      },
    });
  };

  // Re-project the last in-range targets from current player state.
  // Every camera change (move, look, switch, resize) flows through
  // an event that calls this. Placed fires re-project here too
  // (scatter rule: dropped when off-screen/behind), and the
  // placement preview — when a placement is in progress —
  // projects at her feet (ground rule: clamped, always visible).
  const recomputeAnchors = () => {
    const projected: HarvestTarget[] = [];
    for (const target of busTargetsRef.current) {
      const anchor = projectAnchor(target.x, target.z, target.kind);
      if (!anchor) continue;
      projected.push({
        id: target.id,
        sourceId: target.sourceId,
        name: target.name,
        kind: target.kind,
        // The Remove offer's honesty (2026-10-31):
        // removability is read from the source
        // definition here, at projection, so no Remove
        // is ever offered for ground-class scatter.
        removable: SOURCE_BY_ID[target.sourceId]?.removable === true,
        anchorX: anchor.x,
        anchorY: anchor.y,
        worldX: target.x,
        worldZ: target.z,
      });
    }
    setHarvestTargets(projected);
    // Pill fix: prune harvested marks to currently-
    // projected ids — a target that left range drops
    // its mark, so a later re-emit renders its button
    // fresh instead of suppressed.
    setHarvestedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (projected.some((t) => t.id === id)) next.add(id);
      }
      return next;
    });
    const fires: { fire: PlacedFire; x: number; y: number }[] = [];
    for (const fire of fireState.snapshot()) {
      const anchor = projectAnchor(fire.x, fire.z, 'scatter');
      if (!anchor) continue;
      fires.push({ fire, x: anchor.x, y: anchor.y });
    }
    setFireAnchors(fires);
    const torches: { torch: PlacedTorchEntity; x: number; y: number }[] = [];
    for (const torch of torchState.snapshot()) {
      const anchor = projectAnchor(torch.x, torch.z, 'scatter');
      if (!anchor) continue;
      torches.push({ torch, x: anchor.x, y: anchor.y });
    }
    setTorchAnchors(torches);
    // Placed tents (tent shell): the shell store, not
    // an entity — read from the ref mirror (fresh),
    // same skip-null rule as torches.
    const tents: {
      tent: { id: string; x: number; z: number };
      x: number;
      y: number;
    }[] = [];
    for (const tent of placedTentsRef.current) {
      const anchor = projectAnchor(tent.x, tent.z, 'scatter');
      if (!anchor) continue;
      tents.push({ tent, x: anchor.x, y: anchor.y });
    }
    setTentAnchors(tents);
    // Placed bags (the portable hut): the shell store,
    // read from the ref mirror, same skip-null rule.
    const bags: {
      bag: { id: string; x: number; z: number };
      x: number;
      y: number;
    }[] = [];
    for (const bag of placedBagsRef.current) {
      const anchor = projectAnchor(bag.x, bag.z, 'scatter');
      if (!anchor) continue;
      bags.push({ bag, x: anchor.x, y: anchor.y });
    }
    setBagAnchors(bags);
    const altars: { altar: PlacedAltarEntity; x: number; y: number }[] = [];
    for (const altar of altarState.snapshot()) {
      const anchor = projectAnchor(altar.x, altar.z, 'scatter');
      if (!anchor) continue;
      altars.push({ altar, x: anchor.x, y: anchor.y });
    }
    setAltarAnchors(altars);
    const desks: { desk: PlacedDeskEntity; x: number; y: number }[] = [];
    for (const desk of deskState.snapshot()) {
      const anchor = projectAnchor(desk.x, desk.z, 'scatter');
      if (!anchor) continue;
      desks.push({ desk, x: anchor.x, y: anchor.y });
    }
    setDeskAnchors(desks);
    const benches: { bench: PlacedWorkstationEntity; x: number; y: number }[] =
      [];
    for (const bench of workstationState.snapshot()) {
      const anchor = projectAnchor(bench.x, bench.z, 'scatter');
      if (!anchor) continue;
      benches.push({ bench, x: anchor.x, y: anchor.y });
    }
    setWorkstationAnchors(benches);
    const cauldrons: {
      cauldron: PlacedCauldronEntity;
      x: number;
      y: number;
    }[] = [];
    for (const cauldron of cauldronState.snapshot()) {
      const anchor = projectAnchor(cauldron.x, cauldron.z, 'scatter');
      if (!anchor) continue;
      cauldrons.push({ cauldron, x: anchor.x, y: anchor.y });
    }
    setCauldronAnchors(cauldrons);
    // Stump ritual anchors (bone build): stumps in
    // range at her feet (Background's stumpPositions —
    // felled + grown, deduped), projected 'scatter'
    // like altars. Same tick/event cadence as the rest
    // of this function (not per-frame); the scan cost
    // matches stationPresence's chunk scan on move.
    // A stump that leaves range drops its anchor, and
    // the live panel derivation closes its panel.
    const stumps: { siteId: string; x: number; y: number }[] = [];
    const player = playerRef.current;
    if (player) {
      for (const s of stumpPositions(genRef.current, player.x, player.z)) {
        const anchor = projectAnchor(s.x, s.z, 'scatter');
        if (!anchor) continue;
        stumps.push({
          siteId: stumpSiteId(s.x, s.z),
          x: anchor.x,
          y: anchor.y,
        });
      }
    }
    setStumpAnchors(stumps);
    const pileAnchorsNext: { pile: PileTarget; x: number; y: number }[] = [];
    for (const pile of pilesRef.current) {
      const anchor = projectAnchor(pile.x, pile.z, 'scatter');
      if (!anchor) continue;
      pileAnchorsNext.push({ pile, x: anchor.x, y: anchor.y });
    }
    setPileAnchors(pileAnchorsNext);
    // The FILL offer rides the anchor cadence too: the
    // boot's own recompute calls race the player's
    // creation (playerRef still null), so the moved
    // listener alone left a boot standing in water
    // offer-less until her first step. The cadence is
    // the standing recompute for exactly this class.
    refreshFillOffer();
    const mode = placementRef.current;
    if (mode) {
      // THE CROSSHAIR LAW GENERALIZED (Adam, 2026-11-01):
      // the ghost anchors at the AIMED point — the
      // crosshair's ground point inside the reach — for
      // every armed placement; feet anchoring retired
      // with feet placement. A groundless gaze carries
      // no anchor (the ghost and its label hide until
      // the gaze lands somewhere).
      const aim = aimedPlacementPoint();
      setPlacementAnchor(
        aim ? projectAnchor(aim.x, aim.z, 'ground') : null,
      );
      // THE TERRAIN PAINT (joint with Background,
      // 2026-11-01): Background's renderer paints the
      // armed thing's own footprint outline at the same
      // aimed point — the key is the placement's item id
      // (the footprint table resolves shape game-side;
      // house type spellings resolve there too). THE YAW
      // (2026-11-02, Adam's placement report): the payload
      // carries her view yaw — the renderer turns the
      // ghost with it ONLY for kinds whose placed side
      // takes a facing (the footprints yaw register), so
      // the outline never promises a rotation the station
      // will not land with. Tint NEUTRAL standing (no
      // real validity check exists for these placements
      // — a green would be a lie). A groundless gaze
      // clears the paint with the anchor.
      rendererRef.current?.setPlacementPreview(
        aim
          ? { key: mode.itemId, x: aim.x, z: aim.z, rotY: playerRef.current?.yaw ?? 0, tint: 'neutral' }
          : null,
      );
    } else {
      setPlacementAnchor(null);
      rendererRef.current?.setPlacementPreview(null);
    }
    // The DUMP aim (the jar build): while the pour is
    // armed, the same cadence certifies the crosshair's
    // ground point into dumpAim — the card reads it
    // live, the pour re-certifies at press time.
    if (dumpArmedRef.current) {
      const aim = aimedPlacementPoint();
      setDumpAim(
        aim
          ? { x: aim.x, z: aim.z, cert: certifyDumpTarget(aim.x, aim.z) }
          : null,
      );
    }
    // The APPLY aim (the glow-paint build): while the
    // application is armed, the same cadence re-reads
    // the certification at the faced cave surface.
    if (applyArmedRef.current) {
      const cert = certifyApplyTarget();
      setApplyAim({ cert: cert.cert, surface: cert.surface });
    }
  };

  // Re-derive the in-range pile list straight from pileState
  // (same range + nearest-first order as the tracker's
  // piles:inRange channel). Menu take/deposit call this after
  // acting, so the chip reflects the new pile state even when
  // the acted pile is gone: a deposit to a gone pile creates
  // a pile at those coords, and the chip must appear — never
  // assume the pile survived. It also auto-closes the live
  // menu when its pile is gone (the menu then has nothing
  // to render).
  const refreshPilesFromState = () => {
    const player = playerRef.current;
    if (!player) return;
    const inRange = pileState.pilesInRange(player.x, player.z, HARVEST_RANGE);
    pilesRef.current = inRange;
    setPiles(inRange);
    recomputeAnchors();
    const key = selectedPileIdRef.current;
    if (key && !inRange.some((pile) => pile.id === key)) {
      selectedPileIdRef.current = null;
      setSelectedPileId(null);
    }
  };

  // Show a feedback chip for 4 seconds, then remove it. Caller-timed,
  // as ObjectFeedback requires — the chip itself owns no timer.
  // Feedback chips are deliberately NOT pause-gated: their
  // timeouts are transient UI, and one expiring mid-pause
  // loses nothing (no stale chip on resume). Pausing them
  // would need remaining-time bookkeeping — out of scope for
  // this half; the gated clocks are hunger, lighting, and
  // friction above, plus the turn-stick and FPS loops.
  // THE MESSAGE FEED (Adam, 2026-10-31 — "make these
  // messages not overlap... put them into a list and let
  // them follow each other"): EVERY spoken line in the
  // game joins ONE list in ONE reserved seat (rendered at
  // the bottom-center stack below). Lines used to carry a
  // projected world anchor each, so two lines at one
  // target printed over each other and over the pill, and
  // a line whose anchor projected off-screen (the hive at
  // her feet) never rendered at all. Speech has no
  // geometry now: a line is text + tone, in arrival order.
  // Discipline: FIFO — arrival order is display order is
  // expiry order; the newest line sits at the stack's
  // bottom (the fixed seat) and older lines ride up; at
  // most FEED_MAX lines show (FEED_MAX_TOUCH on phone),
  // an arrival past the cap retires the oldest early; an
  // identical line already in the feed refreshes its life
  // and re-seats as newest instead of stacking a twin
  // (multi-press struggle narration). Life is the tuned
  // 4 s, the last ~0.6 s fading.
  //
  // AGING IS READ OFF THE CLOCK (the feed-HUD build,
  // 2026-11-05): every line carries its bornAt stamp,
  // and the aging tick below derives fading + expiry
  // from ages. The per-line setTimeout pair this
  // replaces could be throttled into uselessness by a
  // backgrounded tab — Adam's screenshot showed
  // minutes-old lines still hanging across his gauges
  // after he came back to the game. A clock read
  // cannot be throttled into a lie: the first tick
  // after the tab wakes retires every overdue line.
  const FEED_MAX = 4;
  const FEED_MAX_TOUCH = 3;
  const FEED_FADE_MS = 3400;
  const FEED_LIFE_MS = 4000;
  const showFeedback = (text: string, tone: FeedbackTone) => {
    const cap = isTouch ? FEED_MAX_TOUCH : FEED_MAX;
    setFeedbacks((current) => {
      const twin = current.find(
        (item) => item.text === text && item.tone === tone,
      );
      const id = twin ? twin.id : `fb-${feedbackCounterRef.current++}`;
      const rest = current.filter((item) => item.id !== id);
      const next = [
        ...rest,
        { id, text, tone, fading: false, bornAt: Date.now() },
      ];
      while (next.length > cap) next.shift();
      return next;
    });
  };

  // THE AGING TICK: while any line stands, a short
  // interval ages the stack off the clock — a line
  // fades once its age passes FEED_FADE_MS and leaves
  // past FEED_LIFE_MS. Returning the same list when
  // nothing changed keeps the tick render-free.
  const feedStanding = feedbacks.length > 0;
  useEffect(() => {
    if (!feedStanding) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setFeedbacks((list) => {
        let changed = false;
        const next: FeedbackItem[] = [];
        for (const item of list) {
          const age = now - item.bornAt;
          if (age > FEED_LIFE_MS) {
            changed = true;
            continue;
          }
          if (age > FEED_FADE_MS && !item.fading) {
            changed = true;
            next.push({ ...item, fading: true });
          } else {
            next.push(item);
          }
        }
        return changed ? next : list;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [feedStanding]);

  // THE JOURNAL TOAST (the journal bite's surface half,
  // 2026-11-07; Adam: 'whenever the Journal is updated,
  // we want a message to appear on screen'): the states
  // declare their changes into Systems' journalChanges
  // leaf (7ba39db); the shell subscribes ONCE here and
  // surfaces each burst as ONE feed line. Facts collect
  // in a short batch window (DRAFT) so a burst — a rite
  // completing: a name taught, a charm woken, a quest
  // done — earns a single line, never a queue; a lone
  // fact flushes on the same window, named. The feed's
  // own caps (4, 3 touch; drop-oldest; twin dedupe)
  // carry the rest of the never-spam care. Restores
  // emit nothing (the leaf's law), so boot is silent.
  // Copy DRAFT for Adam's pin pass.
  const JOURNAL_TOAST_WINDOW_MS = 600;
  const journalToastRef = useRef<{
    facts: JournalChange[];
    timer: number | null;
  }>({ facts: [], timer: null });
  useEffect(() => {
    const flushJournalToast = () => {
      const holder = journalToastRef.current;
      holder.timer = null;
      const facts = holder.facts;
      holder.facts = [];
      if (facts.length === 0) return;
      const fresh = facts.filter((fact) => !fact.deepen);
      const deepened = facts.filter((fact) => fact.deepen);
      let line: string;
      if (facts.length === 1) {
        const fact = facts[0];
        line = fact.deepen
          ? `Your journal deepens — ${fact.label}.`
          : `Your journal takes a new entry — ${fact.label}.`;
      } else if (deepened.length === 0) {
        line = `Your journal takes ${fresh.length} new entries.`;
      } else if (fresh.length === 0) {
        line = `Your journal deepens in ${deepened.length} places.`;
      } else {
        line = `Your journal grows — ${fresh.length} new ${
          fresh.length === 1 ? 'entry' : 'entries'
        }, ${deepened.length} deepened.`;
      }
      showFeedback(line, 'info');
    };
    const offJournal = subscribeJournalChanges((change) => {
      const holder = journalToastRef.current;
      holder.facts.push(change);
      if (holder.timer === null) {
        holder.timer = window.setTimeout(
          flushJournalToast,
          JOURNAL_TOAST_WINDOW_MS,
        );
      }
    });
    // THE PLACE SINK (the wiring contract, DEV relay
    // 2026-11-06): the naming register imports nothing
    // (its leaf law), so its facts reach the leaf
    // through this boot adapter, stamped kind 'place'.
    // A removal declares nothing (no removal kind
    // exists in the fact shape — Systems' call, DEV
    // accepted).
    setNamedPlacesJournalSink((fact) =>
      emitJournalChange({
        kind: 'place',
        label: fact.label,
        ...(fact.deepen ? { deepen: true } : {}),
      }),
    );
    return () => {
      offJournal();
      setNamedPlacesJournalSink(null);
      const holder = journalToastRef.current;
      if (holder.timer !== null) {
        window.clearTimeout(holder.timer);
        holder.timer = null;
      }
      holder.facts = [];
    };
    // showFeedback reads only the stable feed setter +
    // refs (its seat above); the boot subscription is
    // seated once, like its bus siblings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boot the world once. StrictMode double-mounts in dev only; the
  // cleanup below disposes the first instance, and the production build
  // mounts exactly once.
  //
  // Save restore lives here (guarded once per page load, so a dev
  // StrictMode double-effect cannot place everything twice):
  // singleton placements (houses / looms) are re-placed
  // from the save, fires + harvest + traps are restored
  // silently BEFORE construction (see below), the player is
  // moved to the saved point, and the HUD re-reads from the
  // restored singletons below. House contents ride by order
  // (placeHouse regenerates ids — see save.ts). Restored
  // fires come back lit + with lighting waits (fireState.
  // restore); their Systems vessels are still created
  // lazily, and ensureSystemsLit brings a vessel to lit at
  // Cook time for an engine-lit fire — consistent.
  const saveRestoredRef = useRef(false);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const gen = genRef.current;
    const player = new PlayerController(gen.findSpawn());
    // WORLD-STATE SAVE WIRING (mode-set, approved): the engine
    // defaults to 'third' and no boot code set player.mode
    // from the save before — a saved first/behind game booted
    // engine-third until the first cycle. Set it directly
    // from the saved cameraMode here, before the facing
    // restore below (restoreFacing's behind sync reads mode).
    // FRESH-BOOT DEFAULT (pill/camera/resume fixes): a
    // fresh boot has no saved mode, and skipping the set
    // left the 'third' field default in place while App
    // state said 'first' — the renderer follows
    // player.mode, so fresh boots showed third-person
    // while the UI thought first. Saved mode still wins
    // when present; 'first' otherwise, so App state and
    // player agree from the first frame.
    // Guarded check-not-set like the trap restore, so a
    // second boot-effect run cannot yank a cycled mode back
    // to the saved one.
    if (!saveRestoredRef.current) {
      const bootMode = bootSaveRef.current?.cameraMode;
      player.mode = bootMode ?? 'first';
    }
    // TRAP SAVE WIRING (restore-before-first-build): trapState.
    // restore() is silent — no 'trap:placed' emit — and the
    // renderer builds trap markers once at construction from
    // live trapState (plus on 'trap:placed' thereafter), so
    // restored traps must be in state BEFORE construction, or
    // they render nothing until the next placement. No new
    // renderer API, no per-trap emits. Guarded by the
    // saveRestoredRef check (checked, not set, here — the
    // block below sets it and restores the rest), so a second
    // boot-effect run cannot re-restore stale traps over
    // gameplay traps. SavedTrap.type is string where
    // PlacedTrap.type is TrapType, so the type rides a cast;
    // restore() drops anything that is not a real trap type.
    if (!saveRestoredRef.current) {
      const bootSaved = bootSaveRef.current;
      if (bootSaved) {
        trapState.restore(
          (bootSaved.traps ?? []).map((trap) => ({
            ...trap,
            type: trap.type as TrapType,
          })),
        );
        // RESTORED TRAPS ENTER THE ROW STATE (the trap
        // chunk's drive catch, 2026-11-01): the traps
        // useState initializer snapshotted trapState
        // BEFORE this restore ran, and the state comment's
        // re-read triggers are trap EVENTS — a trap
        // restored from the save fires none, so without
        // this refresh a reloaded set trap stood in the
        // world with no faced doors (Check / Collect /
        // Pick up / Dismantle) until the first hour roll.
        refreshTrapsFromState();
        // STUMP SAVE WIRING (stumpy shell, 2026-10-28):
        // same restore-before-first-build pattern as
        // traps — stumpState.restore() is silent and
        // validates (drops non-member additions), so a
        // bad stump record can never corrupt the
        // document. Old saves carry no stumps field and
        // load [] (fresh state is already empty, so the
        // clear inside restore() is a no-op there).
        stumpState.restore(
          (bootSaved.stumps ?? []).map((stump) => ({
            ...stump,
            additions: stump.additions as StumpAddition[],
          })),
        );
        // JOURNAL LINK FLAG restore (altar transformation,
        // 2026-10-30): old saves carry no flag and read
        // false — the Linking simply offers itself again.
        journalLinkedRef.current = bootSaved.journalLinked === true;
        setJournalLinked(journalLinkedRef.current);
        // WORLD-STATE SAVE WIRING (fires + harvest, same
        // restore-before-first-build pattern): fireState.
        // restore() is silent and REPLACES the old placeFire
        // re-place loop below (which booted everything
        // unlit) — restored fires come back lit + with
        // lighting waits, rendered by the constructor's
        // initial placed-group build. SavedFire.type is
        // string where PlacedFire.type is FireType, so the
        // type rides a cast; restore() drops anything that
        // is not a real fire type, and nulls bad lighting
        // instead of dropping the fire. harvestState.
        // restore() replaces + bumps version so the
        // renderer redraws; deserialize always hands a
        // snapshot shape (empty for old saves).
        fireState.restore(
          bootSaved.fires.map((fire) => ({
            ...fire,
            type: fire.type as FireType,
          })),
        );
        // PLACED-TORCH SAVE WIRING (same restore-before-
        // first-build pattern): torchState.restore() is
        // silent and the constructor's initial placed-group
        // build picks restored torches up. SavedTorch.id is
        // optional (Systems' shape) while PlacedTorch.id is
        // required — real saved torches always carry an id
        // (snapshot always has one); an id-less entry is
        // dropped here (restore drops it too), so nothing
        // real is lost.
        torchState.restore(
          bootSaved.torches
            .filter(
              (torch) => typeof torch.id === 'string' && torch.id !== '',
            )
            .map((torch) => ({
              id: torch.id as string,
              x: torch.x,
              z: torch.z,
            })),
        );
        harvestState.restore(bootSaved.harvestState);
        // PLACED-ALTAR SAVE WIRING (same restore-before-
        // first-build pattern): altarState.restore() is
        // silent and the constructor's initial placed-group
        // build picks restored altars up. SavedAltar.id is
        // optional (Systems' shape) while PlacedAltar.id is
        // required — real saved altars always carry an id
        // (snapshot always has one); an id-less entry is
        // dropped here (restore drops it too), so nothing
        // real is lost. Torch pattern, id nuance closed
        // the torch way (zero behavioral difference).
        altarState.restore(
          (bootSaved.altars ?? [])
            .filter(
              (altar) => typeof altar.id === 'string' && altar.id !== '',
            )
            .map((altar) => ({
              id: altar.id as string,
              x: altar.x,
              z: altar.z,
              // PARITY PERSISTENCE (2026-11-01): the
              // consecration additions ride the boot map
              // too — SavedAltar carries them and
              // altarState.restore validates them, but
              // this map dropped them, so a placed
              // altar's consecration evaporated on
              // reload while the save file kept it.
              ...(altar.additions
                ? { additions: [...altar.additions] }
                : {}),
            })),
        );
        // PLACED-DESK SAVE WIRING (same restore-before-
        // first-build pattern): deskState.restore() is
        // silent and the constructor's initial placed-group
        // build picks restored desks up. SavedDesk.id is
        // OPTIONAL (Systems' shape) while the entity's
        // PlacedDesk.id is required — restore owns that
        // gap: id-less entries are KEPT and minted ids,
        // provided ids preserved, entries with non-finite
        // positions dropped inside restore. The shell
        // therefore passes entries through with only the
        // id-when-present shaping (NOT the altar id filter
        // — dropping id-less desks here would lose real
        // desks the save deliberately kept).
        deskState.restore(
          (bootSaved.desks ?? []).map((desk) => ({
            x: desk.x,
            z: desk.z,
            rotY: desk.rotY ?? 0,
            ...(typeof desk.id === 'string' && desk.id !== ''
              ? { id: desk.id }
              : {}),
            // The grimoire seat rides too (the desk
            // build's fix, Systems-verified): the map
            // shaped only {x, z, id?}, so a seated book
            // evaporated at boot — not carried, not
            // seated, and uniqueness would have let a
            // second be crafted. Write-only-when-true,
            // the shape's own law.
            ...(desk.grimoire === true ? { grimoire: true } : {}),
          })),
        );
        // PLACED-CAULDRON SAVE WIRING (same restore-
        // before-first-build pattern): cauldronState.
        // restore MUST run after fireState.restore (it
        // binds each saved hearthId against the live
        // fires and drops what cannot bind — unknown id
        // or not a hearth). The boot order restores
        // fires earlier in this block, so riding the
        // desk block's tail is safe. Silent.
        cauldronState.restore(bootSaved.cauldrons ?? []);
        // PLACED-WORKSTATION SAVE WIRING (the fix's shell
        // seat, 2026-11-05 — the desk pattern whole):
        // restore BEFORE renderer construction, silent,
        // the id-when-present shaping (SavedCraftedWork-
        // station.id is optional, the entity's required —
        // restore owns that gap, minting ids for id-less
        // entries and keeping provided ones).
        workstationState.restore(
          (bootSaved.craftedWorkstations ?? []).map((bench) => ({
            x: bench.x,
            z: bench.z,
            rotY: bench.rotY ?? 0,
            ...(typeof bench.id === 'string' && bench.id !== ''
              ? { id: bench.id }
              : {}),
          })),
        );
        // Jar patches restore (the jar build's rider —
        // boot never called it; a poured patch died at
        // reload). Silent; unknown kinds drop inside.
        jarPatchState.restore(bootSaved.patches ?? []);
        // Glow-paint restore (the glow-paint build):
        // the register re-seats before construction,
        // the jar idiom. Silent; [] for old saves.
        mossPaintState.restore(bootSaved.mossPaint ?? []);
        // A boot standing in water with an empty jar
        // shows the Fill offer before the first step.
        refreshFillOffer();
        // RITUAL SAVE WIRING (same pre-construction pattern):
        // StagingBook + CharmState restore (pure systems,
        // boot-only, bad entries dropped). ritualSiteState
        // restores the PHYSICAL staged bones: a staging
        // with bonePlaced && !completed means a bone sits
        // on the site — the site position comes from
        // altarState (altar:<n>) or the stump key itself
        // (stump:x,z); boulder stagings have no position
        // source and are skipped (nothing stages on
        // boulders yet). Altar restore above runs first,
        // so altar positions are available here.
        stagingBookRef.current.restore(bootSaved.stagings ?? []);
        charmStateRef.current.restore(bootSaved.awakenings ?? []);
        // QUEST SAVE WIRING: flags restore (all-false when the
        // field is absent — old saves). Set by the wiring
        // follow-up; the tab only reads. The saved ACTIVE
        // MARK leaves the flags here — it seats in the
        // shell's mark state (one source), so the flags
        // record never carries a stale second copy. The
        // saved COMPLETED latch leaves with it (the latch
        // law): it seats in latchedCompletedRef, and the
        // flags spread never carries it either.
        const {
          active: savedActiveQuest,
          completed: savedCompletedQuests,
          ...savedQuestFlagFields
        } = bootSaved.quests ?? {};
        const questFlagsInit = {
          ...emptyQuestFlags(),
          ...savedQuestFlagFields,
        };
        questFlagsRef.current = questFlagsInit;
        setQuestFlags(questFlagsInit);
        latchedCompletedRef.current = new Set(savedCompletedQuests ?? []);
        if (savedActiveQuest && questById(savedActiveQuest)) {
          activeQuestIdRef.current = savedActiveQuest;
          setActiveQuestId(savedActiveQuest);
        }
        ritualSiteState.restore(
          (bootSaved.stagings ?? []).flatMap((entry) => {
            if (!entry.bonePlaced || entry.completed) return [];
            if (entry.siteKey.startsWith('altar:')) {
              const altar = altarState.get(entry.siteKey);
              if (!altar) return [];
              return [
                {
                  site: {
                    kind: 'altar' as const,
                    siteId: entry.siteKey,
                    x: altar.x,
                    z: altar.z,
                  },
                  bone: entry.boneKind,
                },
              ];
            }
            if (entry.siteKey.startsWith('stump:')) {
              const coords = entry.siteKey
                .slice('stump:'.length)
                .split(',');
              const x = Number(coords[0]);
              const z = Number(coords[1]);
              if (!Number.isFinite(x) || !Number.isFinite(z)) return [];
              return [
                {
                  site: {
                    kind: 'stump' as const,
                    siteId: entry.siteKey,
                    x,
                    z,
                  },
                  bone: entry.boneKind,
                },
              ];
            }
            return [];
          }),
        );
        // ONE STAGED-BONE FACT (rite pair landing, 2026-11-05):
        // the two stores restore from the same entries
        // under different filters — the book's is stricter
        // (every flag + extrasDone), the site's keeps any
        // bonePlaced entry — so an older save's entry can
        // restore the site's bone while the book drops its
        // record. The panel needs both readers and fell
        // back to the stage list over a staged bone, while
        // the staging refusal (the site's fact) said the
        // site already holds one — the panel contradicting
        // itself in Adam's screenshots. Heal at the seat:
        // any site-held bone with no book entry gets its
        // entry back with the placement set; the steps
        // past placement are unknowable and read as
        // not-yet (she simply redoes them), and staging
        // another bone still refuses on the site's fact.
        for (const record of ritualSiteState.snapshot()) {
          if (!stagingBookRef.current.get(record.site.siteId, record.bone)) {
            stagingBookRef.current.getOrCreate(
              record.site.siteId,
              record.bone,
            ).bonePlaced = true;
          }
        }
        // LOOK SAVE WIRING (same pre-construction pattern):
        // nameSight.restore() is silent and replaces; the
        // shell's NameSight starts empty, so a second
        // boot-effect run cannot re-restore over gameplay
        // looks (guarded by the same check as traps).
        nameSightRef.current.restore(bootSaved.nameSight ?? []);
        // KNOWN-FACTS BOOT WIRING: the register restores
        // beside nameSight (boot-only; clears + rebuilds).
        // The save's shape is readonly; the register's
        // snapshot wants plain arrays — spread, as
        // serializeSave itself does.
        restoreKnowledge(
          bootSaved.knowledge
            ? {
                metItems: [...(bootSaved.knowledge.metItems ?? [])],
                knownUseRecipes: [
                  ...(bootSaved.knowledge.knownUseRecipes ?? []),
                ],
              }
            : undefined,
        );
      }
    }
    const renderer = new WorldRenderer(container, gen, player);
    player.attach(renderer.domElement);
    rendererRef.current = renderer;
    // THE FERAL SEATS ON THE RENDERER (the feral
    // build): the facts provider (identity + defender
    // — unregistered, no encounter can form) and her
    // injury speed factor at her boot stage.
    renderer.setFeralFactsProvider(feralFactsProvider);
    // NAMED PLACES (the naming build): the renderer's
    // tag feed reads the shell's register through this
    // provider (Background's seat, the feral-facts
    // shape) — unregistered, the feed is empty. The
    // register itself is the shell's one instance.
    renderer.setNamedPlacesProvider(() => namedPlacesRef.current);
    // THE HEDGE RING VIEWS (the Hedge door build):
    // Background's seat, in the feral-facts shape —
    // the views derive shell-side from the state:
    // centre from the record, radius + tier from her
    // CURRENT fragment knowledge (a hedge laid at T1
    // grows when she learns T2), rooted from the
    // world day. Unregistered would mean no rings;
    // an unlearned mark yields no views.
    renderer.setHedgeFactsProvider(() => {
      const fragments = fragmentStateRef.current;
      const tier = hedgeTier(fragments);
      if (tier < 1) return [];
      const radiusM = hedgeRadiusM(fragments);
      const day = worldDayNow();
      return hedgeStateRef.current.list().map((hedge) => ({
        x: hedge.x,
        z: hedge.z,
        radiusM,
        tier,
        rooted: isRooted(hedge, day),
      }));
    });
    // THE HEARTHHOME SEAL VIEWS (the feral leg,
    // 2026-11-06): Background's seat, the hedge
    // provider's mirror — the views derive shell-side
    // from the state: centre + radius from the seal
    // record, the tier from her CURRENT HearthHome
    // knowledge (the same value on every view; seals
    // don't root, so no day read). The renderer binds
    // only views at tier >= 1 (Systems' sealAdmits
    // line) — passing the true tier through is all the
    // honesty it needs. Unregistered would mean no
    // refusals at a seal's edge.
    renderer.setHearthHomeFactsProvider(() => {
      const tier = hearthhomeTier(fragmentStateRef.current);
      return hearthhomeStateRef.current.snapshot().map((seal) => ({
        x: seal.x,
        z: seal.z,
        radiusM: seal.radiusM,
        tier,
      }));
    });
    renderer.setInjurySpeedFactor(injury.effects().movementMultiplier);
    // LOOK owl hook (hook only): the owl charm is a later
    // charm (fashioned/enchanted, id not decided), so the
    // shell wires not-owned until charm ownership lands.
    nameSightRef.current.setOwlOwned(false);
    playerRef.current = player;
    if (!saveRestoredRef.current) {
      saveRestoredRef.current = true;
      const saved = bootSaveRef.current;
      if (saved) {
        // WORLD-STATE SAVE WIRING (sky, after construction):
        // the sky rig is renderer-owned, so its restore runs
        // here, not in the pre-construction block — restoreSky
        // is a no-op on null/undefined, and old saves carry
        // dawn ({ cycleT: 0 }) from deserialize. SetWorldGen
        // is not called on this path, so after-construction
        // is after every sky reset that could wipe it.
        renderer.restoreSky(saved.sky);
        // The spell record re-seats with the sky (W1):
        // restoreWeather is a no-op on null (old saves),
        // and the machine validates the record's shape
        // itself at seating.
        renderer.restoreWeather(saved.weather);
        for (const house of saved.houses) {
          try {
            const placed = shelterState.placeHouse(
              house.type as HouseType,
              house.x,
              house.z,
              house.rotY ?? 0,
            );
            const store = new HomeStorage(
              HOUSE_TYPE_TO_ITEM[placed.type],
              house.contents,
            );
            homeStoresRef.current.set(placed.id, store);
            homeStoreItemsRef.current.set(
              placed.id,
              new Set(Object.keys(house.contents)),
            );
          } catch {
            // Same skip rule as fires.
          }
        }
        for (const loom of saved.looms) {
          try {
            loomState.placeLoom(loom.x, loom.z, loom.rotY ?? 0);
          } catch {
            // Same skip rule as fires.
          }
        }
        // PILE SAVE WIRING (multi-kind, 2026-10-27):
        // re-place each saved KIND through pileState.drop()
        // — merge-safe by coords, and it emits
        // pile:dropped/pile:changed, so the tracker and the
        // renderer pile group pick the restored piles up
        // (the tracker's 100 ms moved tick surfaces the
        // in-range set once the loop runs at the restored
        // position). Kinds drop in saved order, so a
        // restored pile's stacks match the saved order.
        // Saved piles are deserialize-validated (normalized
        // ids, positive quantities, finite coords); drop()
        // returns null for anything invalid instead of
        // throwing, so no skip rule is needed here. Inside
        // the saveRestoredRef guard, so a second boot-effect
        // run cannot double-drop (drop merges, which would
        // double quantities). Runs after the renderer
        // exists, so setWorldGen's pile clear cannot wipe
        // the restore.
        for (const pile of saved.piles) {
          for (const stack of pile.stacks) {
            pileState.drop(stack.item, stack.quantity, pile.x, pile.z);
          }
        }
        // DIMENSION BUCKETS — THE BOOT SEAT (the store
        // swap, cd1ef2e; the shell wiring, 2026-11-03):
        // the parked mirror restores from the save's
        // dimensionStates (the live stores are the
        // surface's and stay on the top-level path —
        // restoreBuckets never touches them), then the
        // two relocation passes run ONCE, in the
        // module's order (cave takes, then piles), on
        // the surface stores this effect and the
        // construction effect just restored — the
        // migration for saves written before buckets
        // existed. Saved piles re-key to their spot id
        // (pileIdFor — the same derivation restore
        // rekeys by). All of it lands before any
        // travel can swap the stores.
        const bucketsIn: Record<string, DimensionBucketInput> = {};
        if (saved.dimensionStates) {
          for (const key of Object.keys(saved.dimensionStates)) {
            const bucket = saved.dimensionStates[key];
            bucketsIn[key] = {
              piles: bucket.piles.map((pile) => ({
                id: pileIdFor(pile.x, pile.z),
                stacks: pile.stacks.map((stack) => ({
                  item: stack.item,
                  quantity: stack.quantity,
                })),
                x: pile.x,
                z: pile.z,
              })),
              harvest: bucket.harvest,
            };
          }
        }
        dimensionBuckets.restoreBuckets(bucketsIn);
        dimensionBuckets.relocateLegacyCaveTakes(
          saved.seed,
          gen.findSpawn(),
          (x, z) => gen.weightsAt(x, z),
        );
        dimensionBuckets.relocateSurfacePilesToCaves(
          saved.seed,
          gen.findSpawn(),
          (x, z) => gen.weightsAt(x, z),
        );
        // BOOT-AT-THE-MOUTH (cave close-out, 2026-10-30):
        // a save written underground carries its visit —
        // boot always starts on the surface, so she wakes
        // at the mouth she entered by: its spot, facing
        // outward (the mouth's exitYaw). Resolution runs
        // through the same caveMouths derivation the
        // winner arms use. An unresolvable record
        // (foreign key, unknown or null mouth) falls back
        // to the saved position whole and the record dies
        // with this save — the next save is a surface
        // save and writes null. A bad visit can never
        // strand a boot.
        const visit = saved.dimensionVisit ?? null;
        // PLURAL CAVES (2026-10-30): the resolution is by
        // the saved key + mouthId — the debut cave's
        // key reads its two mouths as before; any other
        // key names an instance, honored only when the
        // instance's mouthId equals the saved one (for
        // instances the mouth id IS the key).
        const visitMouth = (() => {
          if (visit === null || visit.mouthId === null) return undefined;
          const weights = (x: number, z: number) => gen.weightsAt(x, z);
          if (isUpstairsKey(visit.key)) {
            // UPSTAIRS BOOT (UI half, 2026-11-01): an
            // upstairs save's mouthId carries the HOUSE
            // KEY (dimensionState.enter's second seat). She
            // wakes on the surface at that house's STAIR
            // HEAD, facing DOWN the flight — the engine's
            // own return-anchor formula (enterUpstairs
            // seats the same seat + yaw on exit). An
            // unresolvable house falls back whole, like
            // the caves below.
            const mouth = upstairsMouthFor(
              String(gen.seed),
              gen.findSpawn(),
              weights,
              visit.mouthId,
            );
            return mouth
              ? {
                  spot: mouth.stairHead,
                  exitYaw: Math.atan2(
                    mouth.stairHead.x - mouth.stairBase.x,
                    mouth.stairHead.z - mouth.stairBase.z,
                  ),
                }
              : undefined;
          }
          if (visit.key === CAVE_DIMENSION_KEY) {
            return caveMouths(
              String(gen.seed),
              gen.findSpawn(),
              weights,
            ).find((m) => m.id === visit.mouthId);
          }
          const inst = caveInstanceForKey(
            String(gen.seed),
            gen.findSpawn(),
            weights,
            visit.key,
          );
          return inst !== null && inst.mouthId === visit.mouthId
            ? { spot: inst.mouthSpot, exitYaw: inst.exitYaw }
            : undefined;
        })();
        if (visitMouth) {
          player.x = visitMouth.spot.x;
          player.z = visitMouth.spot.z;
          player.restoreFacing({ yaw: visitMouth.exitYaw, pitch: 0 });
        } else {
          player.x = saved.position.x;
          player.z = saved.position.z;
          // WORLD-STATE SAVE WIRING (facing, after mode-set):
          // yaw + pitch from the save; restoreFacing clamps
          // pitch to ±1.45 and re-syncs facing = yaw + PI in
          // behind mode (mode was set from the save before
          // construction, above). Old saves carry the default
          // look ({ yaw: 0, pitch: 0 }) from deserialize.
          player.restoreFacing(saved.facing);
        }
      }
    }
    // UMBRELLA DRIVING: initial visibility from the boot
    // inventory — a restored umbrella shows, no umbrella
    // leaves the renderer's default hidden standing. Later
    // inventory changes drive it via refreshInventory above.
    renderer.setCarriesUmbrella(carriesUmbrella(inventory));
    // TORCH DRIVING: initial visibility from the boot
    // inventory — a restored lit torch shows, no lit torch
    // leaves the renderer's default hidden standing.
    renderer.setCarriesLitTorch(inventory.count(ITEMS.litTorch) > 0);
    // Hunger wiring (see the header): the engine reads the stage
    // through this query — movement slowdown + harvest lockout.
    player.setHungerStageQuery(() => hunger.stage());
    setPosition({ x: player.x, z: player.z });
    setBiomeText(formatWeights(gen.weightsAt(player.x, player.z)));
    bus.emit('world:seedSet', { seed: gen.seed });
    // HUD re-read after a restore (the placedFires initial state
    // was snapshotted before this effect re-placed anything).
    setPlacedFires(fireState.snapshot());
    setPlacedTorches(torchState.snapshot());
    setPlacedAltars(altarState.snapshot());
    // COMPANIONS boot re-read: the panel's mirror starts
    // from the constructed state's records.
    setCompanionRecords(companionStateRef.current.snapshot());
    // COMPANION RESTORE (Piece B, 2026-10-31): bonded
    // records get their living bodies back — Background's
    // restoreActor over a fresh instance, seated beside
    // her. This runs AFTER the seedSet emit above (the
    // runtime clears its registry on seedSet; restoring
    // before it would wipe the actors). Records carry no
    // position, so the seat — and a stayed companion's
    // anchor — is beside her on load in v1 (the anchor
    // simplification the claim flagged). The cat is
    // skipped: the registry never holds one (build 2's
    // machinery is its own).
    for (const record of companionStateRef.current.snapshot()) {
      if (record.bond === 'none' || record.kind === 'cat') continue;
      const seatX = player.x + 1;
      const seatZ = player.z;
      restoreActor(
        makeCompanionInstance(
          record.creatureId,
          record.kind as AnimalKind,
          seatX,
          seatZ,
        ),
        record.stance ?? 'follow',
        seatX,
        seatZ,
      );
      // A saved familiar restores as 'trail' and is
      // re-flipped from the record here (Build 2,
      // Piece 1 — Background's restore contract: the
      // record is the truth, the flip is only motion).
      if (record.bond === 'familiar') {
        setMovementMode(record.creatureId, 'settleDart');
      }
    }
    // THE CAT'S BOND SYNC (Piece 2): the engine's cat
    // reads its bond level from the record — 'hearth'
    // (no bond: the resident), 'attending' (a companion
    // bond), 'familiar' (the rite's). This runs after
    // the renderer's construction seated the cat at
    // the village hearth (same effect, above), so the
    // level lands on a living actor; setCatBond
    // no-ops harmlessly if the cat is somehow absent.
    const catRecord = companionStateRef.current
      .snapshot()
      .find((record) => record.creatureId === CAT_ID);
    setCatBond(
      catRecord?.bond === 'familiar'
        ? 'familiar'
        : catRecord?.bond === 'companion'
          ? 'attending'
          : 'hearth',
    );
    // CAT PROVISIONING INSTALLS (Piece 3): Systems'
    // catch table + the home/sleep probes. The probes
    // read refs and module singletons only, so this one
    // install stays live for the session.
    installCatCatchTable(buildCatCatchTable());
    installCatProbes({
      homeBase: () => {
        const home = homedHouse();
        return home ? { x: home.x, z: home.z } : null;
      },
      sleepingAtHome: catSleepingAtHome,
    });
    // GUIDE PROBES (Discovery wiring, 2026-10-31):
    // Background's raven reads the one discovery fact
    // through this seam and retires the moment it
    // flips. The closure reads the ref live, so this
    // one install stays live for the session (the cat
    // probes' pattern).
    installGuideProbes({
      groveDiscovered: () => discoveryStateRef.current.groveDiscovered(),
      // THE LESSER-GLEAM PROBE (Background's grove
      // family, 9238bbd; installed 2026-11-05): the
      // raven's lesser retarget skips groves she has
      // already gleamed — a lesser grove's carrier is
      // a Circle fragment (id '<grove key>:fragment'),
      // so gleamed = that id stands among her Circle
      // copies. Uninstalled, the probe defaulted
      // ungleamed forever and the bird would have led
      // her back to harvested groves.
      lesserGroveGleamed: (fragmentId) =>
        (
          fragmentStateRef.current.progressFor('circle')?.copies ?? []
        ).some((copy) => copy.fragmentId === fragmentId),
    });
    // TRUST MARKER INSTALL (Background's marker layer,
    // 2026-11-01): the renderer's trust sprites read
    // Systems' companion facts through this resolver.
    // The closure reads the live CompanionState and
    // the shell's own day source — the same
    // snapshotSky().daysElapsed the feed path writes
    // lastFedDay against — so the marker's fedToday
    // can never drift a day off the records. One
    // install, live for the session (the cat probes'
    // pattern); ferals hold no record, so factsFor
    // answers null for them by construction.
    installTrustFacts((creatureId) =>
      companionStateRef.current.factsFor(
        creatureId,
        rendererRef.current?.snapshotSky()?.daysElapsed ?? 0,
      ),
    );
    // FIRST-CHARM BOOT GRANT — RETIRED (2026-11-01):
    // the outright shrew grant is gone (Systems
    // retired grantFirstCharm in charms.ts; this call
    // site dropped in the same window so the batch
    // composes green). Awakenings are rite-earned
    // only now, and the quest facts' snapshot-length
    // awakenings count is honest by construction —
    // no origin re-point was needed after all.
    // Shrew effect boot sync (follow-up call path):
    // a loaded save with the shrew in its list needs
    // its 0.9 multiplier from boot (multiplier is
    // session state, never saved), and a boot hunger
    // below 45 while listed fires the latch fresh
    // (she IS in the warning zone).
    syncShrewEffect();
    // Charm-hook boot sync: a loaded save's listed
    // charms need their hooks from boot (all five
    // setters are session state, never saved) — same
    // reason as the shrew sync above.
    syncCharmHooks();
    syncCrowTier();
    syncCharmBonuses();
    syncDeerWarning();
    applyShelterHouse(
      shelterAt(player.x, player.z, shelterState.snapshot()).houseId,
    );
    recomputeAnchors();
    // TENT BOOT RE-SUPPLY (setTents wiring): the
    // renderer was just constructed with an empty tent
    // list, and setWorldGen is not called on boot — so
    // the shell pushes its restored tents now (the
    // renderer's own contract: setTents on boot
    // restore). Without this, reloaded tents would
    // have chips + save entries but no model and no
    // shelter signal.
    rendererRef.current?.setTents(
      placedTentsRef.current.map((tent) => ({ x: tent.x, z: tent.z })),
    );
    // BAG BOOT RE-SUPPLY (setBags): the same contract —
    // the renderer was constructed with an empty bag
    // list, so the shell pushes its restored bags now.
    rendererRef.current?.setBags(
      placedBagsRef.current.map((bag) => ({ x: bag.x, z: bag.z })),
    );

    const offCamera = bus.on('camera:switched', ({ mode }) => {
      setCameraMode(mode);
      setSwitching(true);
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = window.setTimeout(
        () => setSwitching(false),
        CAMERA_TRANSITION.fadeMs,
      );
      recomputeAnchors();
    });
    const offMoved = bus.on('player:moved', ({ x, z }) => {
      setPosition({ x, z });
      setBiomeText(formatWeights(genRef.current.weightsAt(x, z)));
      recomputeAnchors();
      // SCRY VISIBILITY (DEV split): near still water, on
      // movement — the button, not the reveal. While revealed,
      // arrival dismisses (the buttonless off-switch) and the
      // set refreshes (new houses count); otherwise the button
      // shows exactly when a press could reveal something.
      const gen = genRef.current;
      const waters = stillWatersNear(gen, x, z);
      const div = divinationRef.current;
      const houses = shelterState.snapshot();
      if (div.isRevealed) {
        if (div.arrivedAt(x, z)) {
          div.dismiss();
          rendererRef.current?.setCampArrowsVisible(false);
        } else {
          div.reveal(findCamps(houses));
        }
      }
      // THE SCRY-REVEAL GATE on the movement cadence:
      // the gate's transitions re-read here first.
      syncScryRevealGate();
      setScryVisible(
        !div.isRevealed &&
          houses.length > 0 &&
          isNearStillWater(x, z, waters),
      );
      // THE T1 EXIT POINTING (DEV's shape, 2026-11-05;
      // Background's seat 0252d41): while she stands
      // in a cave (either layer) or a grove maze's
      // square AND she knows Returning T1 (Systems'
      // canScry is THE gate, never the read), the
      // arrows point OUT — the renderer's exit read
      // names the seat (the layer's entry anchor; the
      // maze's entrance gap) and the camp arrows
      // suppress under it by the seat's own ruling.
      // The read returning null dismisses the state
      // itself (she stepped out; an attic, the open
      // surface) — no toggle, no new control. Called
      // only on a seat change: the seat rebuilds per
      // call. The surface 'way home' rides the camp
      // arrows under the same gate via the Scry above
      // — one pointing language for T1 on every
      // ground.
      {
        const renderer = rendererRef.current;
        if (renderer) {
          const exit = canScry(fragmentStateRef.current)
            ? renderer.getExitTarget()
            : null;
          const seat = exit ? { x: exit.x, z: exit.z } : null;
          const prev = exitArrowSeatRef.current;
          if (
            (seat === null) !== (prev === null) ||
            (seat !== null &&
              prev !== null &&
              (seat.x !== prev.x || seat.z !== prev.z))
          ) {
            exitArrowSeatRef.current = seat;
            renderer.setExitArrow(seat);
          }
        }
      }
      // The jar's FILL offer rides the same tick (its
      // own facts — the composed siteWaterFacts, not
      // the scry still-water reading).
      refreshFillOffer();
      // GROVE ENTRY DETECTION (Discovery wiring,
      // 2026-10-31): the surface only (a cave visit's
      // coordinates are not the world's), and only
      // while the fact is unfound — markGroveDiscovered
      // returns true ONLY on the flip, so the beat and
      // the save fire exactly once, on entry. The site
      // derives from the seed (memoized in sites.ts),
      // so the per-tick test is a cache read + a
      // distance check. DRAFT line.
      if (
        !dimensionState.isUnderground() &&
        !discoveryStateRef.current.groveDiscovered()
      ) {
        const grove = groveSite(gen.seed, gen.findSpawn(), (gx, gz) =>
          gen.weightsAt(gx, gz).dominant,
        );
        if (
          groveContains(grove, x, z) &&
          discoveryStateRef.current.markGroveDiscovered(
            rendererRef.current?.snapshotSky()?.daysElapsed ?? 0,
          )
        ) {
          showFeedback('The Grove — you have found it.', 'info');
          saveNow();
        }
      }
    });
    const offLooked = bus.on('player:looked', () => {
      recomputeAnchors();
    });
    const offInRange = bus.on('harvest:inRange', ({ targets }) => {
      busTargetsRef.current = targets;
      recomputeAnchors();
    });
    const offPiles = bus.on('piles:inRange', ({ piles: inRange }) => {
      pilesRef.current = inRange;
      setPiles(inRange);
      recomputeAnchors();
      // The selected pile's out-of-range close used to
      // live here (at this feed's 2.5 m). It is absorbed
      // into the walk-away leash (see the WALK-AWAY CLOSE
      // effect): the pile rides the same leash as every
      // faced window, and a vanished pile still closes
      // through the leash's missing-anchor case.
    });
    // Systems' 'pile:pickup-requested' listener (see the header
    // + systems/piles.ts): the SOLE granter on the event since
    // the shell bridge came out (b23a042) — touch USE and the
    // desktop button emit the same event, so one listener
    // grants both (desktop/phone parity by construction).
    // Behavior: missing pile: silent nothing; full pack:
    // Pack-full note, no take, no refresh/save; grant: the
    // WHOLE pile (kinds in stacks order, partial by weight,
    // remainder stays), then refresh + save + Picked-up
    // feedback listing every kind taken, anchored at the pile.
    const offSystemsPilePickup = bus.on(
      'pile:pickup-requested',
      ({ pileId }) => {
        const outcome = handlePilePickupRequest(
          pileId,
          pileState,
          inventory,
        );
        if (!outcome.found) return;
        if (outcome.granted <= 0) {
          showFeedback(`Pack full — no room.`, 'blocked');
          return;
        }
        // PICKUP COUNTS AS A LOOK (same ruling):
        // whole-pile pickup grants per kind (taken is
        // one entry per granted kind) — a granted bone
        // kind records 1 LOOK, before saveNow. Kinds
        // that granted 0 never reach `taken`.
        for (const t of outcome.taken) {
          const kind = isBoneItem(t.item) ? boneKindFor(t.item) : null;
          if (kind === null) continue;
          recordBonePickupLook(
            t.item,
            nameSightRef.current,
            portionsForKind(kind) ?? [],
          );
        }
        refreshInventory();
        saveNow();
        showFeedback(
          `Picked up ${outcome.taken
            .map((t) => `${t.granted} ${displayNameFor(t.item)}`)
            .join(', ')}.`,
          'gain',
        );
      },
    );
    // The shell's one harvest outcome listener (see the header):
    // presses resolve through it into the shell's inventory, and
    // its completed/failed/progress events drive the feedback below.
    const unsubHarvestOutcome = createHarvestOutcomeListener({
      gen: () => genRef.current,
      inventory,
      getToolTier: () => ownedTier(inventory),
      getHungerStage: () => hunger.stage(),
    });
    // Game clock: drain hunger in real seconds and refresh the
    // HUD stage + meter value, and advance friction lighting
    // waits (display: 'waiting' → 'ready' once the wait
    // passes). The value mirror changes every draining tick,
    // so the indicator's bar re-renders on the tick; the stage
    // setter alone bails out when the stage is unchanged.
    const hungerTimer = window.setInterval(() => {
      // PAUSE GATE: while the engine flag is set, the shell
      // clock freezes too — no hunger drain, no lighting
      // advance, no Systems fire tick (including the 25 s
      // friction wait, which must not flip to 'ready'
      // mid-pause). The interval keeps firing but does
      // nothing, so resume needs no restart.
      if (pausedRef.current) return;
      hunger.tick(1);
      setHungerStage(hunger.stage());
      setHungerValue(hunger.value());
      // Cold/wet on the same clock (W3): composed at the
      // player's live position; a null composition (no
      // world stepped yet) simply skips the tick.
      const cwPlayer = playerRef.current;
      if (cwPlayer) tickColdWet(1, cwPlayer.x, cwPlayer.z);
      // The scent clock on the same 1 s beat (the
      // douse build): Systems' ScentState owns the
      // duration; the shell ticks it. The mirror
      // refreshes only when the word could change —
      // the witness shows words, not seconds.
      if (scentState.isActive()) {
        const before = scentState.scent();
        scentState.tick(1);
        const after = scentState.scent();
        if (
          after.kind !== before.kind ||
          after.category !== before.category
        ) {
          refreshScentUi();
        }
      }
      // Hunger changed: latch update + drain multiplier
      // re-sync (the drain rate for the NEXT tick
      // follows the current carried/awakened state).
      syncShrewEffect();
      syncDeerWarning();
      fireState.advanceLighting(Date.now());
      // (No Systems-vessel tick here: the bridge no longer
      // mirrors lighting into the vessels — a vessel adopts
      // the engine's lit state whole, at the Cook/Char
      // press. See VESSEL SYNC at ensureSystemsLit.)
      // Night gate for the sleep button: the renderer's live
      // sky cycle, split by the engine's own cycleSplit at
      // the world's fixed start month (the renderer feeds
      // the sky SEASON_START_MONTH — see renderer.ts — so
      // this matches the rendered sky exactly, no shell
      // season logic). The sky does not advance while
      // paused, so freezing this read inside the pause gate
      // costs nothing.
      const sky = rendererRef.current?.snapshotSky();
      if (sky) {
        setIsNight(!cycleSplit(sky.cycleT, SEASON_START_MONTH).isDay);
      }
      // RITUAL WINDOWS (window-arrival path): a staged
      // ritual completes when its sky window arrives —
      // the timer is the arrival clock; step handlers
      // check immediately too (mid-window staging
      // completes at once). Pause-gated like the rest of
      // this timer (the sky does not advance while
      // paused, so no window can arrive then either).
      checkRitualCompletions();
      // The borrowing's end rides the same clock: when a
      // borrowed gift's span lapses, its effect comes off
      // and the feed says so (FamiliarState owns the
      // span/rest arithmetic; the settle only watches).
      settleBorrow();
    }, 1000);
    // Placed-fire + shelter subscriptions: fires re-read from
    // the engine singleton on every fire event; shelter applies
    // the live tracking event, or a direct recompute on
    // placement (placing at her feet does not move her, so the
    // movement-driven tracker would not fire on its own).
    const refreshFires = () => {
      setPlacedFires(fireState.snapshot());
      recomputeAnchors();
    };
    // Placed-torch subscriptions: torches re-read from the
    // Background singleton on every torch event, fire pattern.
    const refreshTorches = () => {
      setPlacedTorches(torchState.snapshot());
      recomputeAnchors();
    };
    // Placed-altar subscriptions: altars re-read from the
    // Background singleton on every altar event, torch pattern.
    const refreshAltars = () => {
      setPlacedAltars(altarState.snapshot());
      recomputeAnchors();
    };
    // Placed-desk subscriptions: anchors re-project from
    // the Background singleton on every desk event, altar
    // pattern (no placed-list state to re-read — see the
    // deskAnchors declaration).
    const refreshDesks = () => {
      recomputeAnchors();
    };
    // Placed-workstation subscriptions: the desk pattern
    // (anchors re-project from the Background singleton
    // on every bench event).
    const refreshWorkstations = () => {
      recomputeAnchors();
    };
    // Placed-cauldron subscriptions: anchors re-project
    // from the Background singleton on every cauldron
    // event, desk pattern.
    const refreshCauldrons = () => {
      recomputeAnchors();
    };
    // PAUSE SUBSCRIPTION (core 54e525c): the shell's half of the
    // flag. The ref gates the timers (below + the turn-stick and
    // FPS loops); the state drives the Paused indicator. Fires
    // on CHANGE only (setPaused is idempotent), so no spam.
    const offPause = bus.on('game:pause-changed', ({ paused: next }) => {
      pausedRef.current = next;
      setPaused(next);
    });
    const offFirePlaced = bus.on('fire:placed', refreshFires);
    const offFireLighting = bus.on('fire:lighting', refreshFires);
    // COMPANION ANSWERS (Piece B, 2026-10-31): the
    // runtime speaks, the shell persists. 'companion:
    // stance' — an actor's stance changed (a completed
    // come resolves to 'follow' there): persist through
    // Systems, mirror, save. 'companion:departed' — a
    // released actor dissolved past streaming distance:
    // Systems' release as the idempotent record clear
    // (the press already cleared it; null is expected).
    const offCompanionStance = bus.on(
      'companion:stance',
      ({ id, stance }) => {
        const result = companionStateRef.current.setStance(id, stance);
        if (result.ok === true) {
          setCompanionRecords(companionStateRef.current.snapshot());
          saveNow();
        }
      },
    );
    const offCompanionDeparted = bus.on('companion:departed', ({ id }) => {
      companionStateRef.current.release(id);
      setCompanionRecords(companionStateRef.current.snapshot());
      saveNow();
    });
    // THE FOUND CAT'S MEETING (Build 2, Piece 2): the
    // engine's first-meeting signal, once per world —
    // the shell seeds the found record (Systems' usual
    // door: acquaintance starts from the cat's own
    // staging), speaks the discovery, and saves. From
    // here the bond road is the ordinary faced
    // OFFER/SPEAK path; Systems waives the true-name
    // gate for found origin, so no cat bone is ever
    // needed. DRAFT line.
    const offCatMet = bus.on('cat:met', () => {
      companionStateRef.current.seedFoundCat(CAT_ID);
      setCompanionRecords(companionStateRef.current.snapshot());
      showFeedback(
        'Something watches from the hearth. A cat — alive, the one living thing the burning left.',
        'info',
      );
      saveNow();
    });
    // GUIDE CALLS (Discovery wiring, 2026-10-31):
    // feed-only for v1 — no audio engine, volume/mute
    // setting, or gesture-unlock path exists in the
    // tree, and a synthesized caw is a separate
    // subsystem for Adam's word. The line is judged by
    // her live distance to the bird (near / ahead /
    // faint), and past the last band the call goes
    // unvoiced; the engine's own cadence is the only
    // throttle. The shell says 'raven' (Adam's word);
    // the engine kind stays 'crow'. DRAFT lines.
    const offGuideCall = bus.on('guide:call', ({ x, z }) => {
      const player = playerRef.current;
      if (!player) return;
      const distance = Math.hypot(x - player.x, z - player.z);
      if (distance <= 15) {
        showFeedback('A raven calls from a nearby tree.', 'info');
      } else if (distance <= 35) {
        showFeedback('A raven calls ahead.', 'info');
      } else if (distance <= 60) {
        showFeedback('A raven calls, faintly.', 'info');
      }
    });
    // CAT PROVISIONING DELIVERIES (Piece 3): the hunt's
    // goods land three ways, and the shell answers each.
    // DELIVERED — a travel/sleep catch reaches the homed
    // house: into its store, the pound cap governing (a
    // full store leaves the catch as a pile at the
    // house, the line naming it). PRESENT — a sleep
    // catch left at the house point: a floor pile, the
    // wake-up present. GIFT — a pre-bond catch at the
    // hearth: a pile there always, but the discovery
    // line only when she is near enough to see it land
    // (~15 m, DRAFT) — no telepathy. All lines DRAFT.
    const offCatDelivered = bus.on('cat:delivered', ({ item }) => {
      const home = homedHouse();
      const name = displayNameFor(item);
      if (!home) {
        // A pathological race (the probes read the same
        // fact a step earlier): the goods land at her
        // feet rather than vanish.
        const player = playerRef.current;
        if (player) {
          pileState.spawnPile({ item, quantity: 1, x: player.x, z: player.z });
          showFeedback(`The cat brought you a ${name}.`, 'gain');
          saveNow();
        }
        return;
      }
      const store = getHomeStore(home.id);
      let stored = false;
      if (store) {
        try {
          store.add(item as ItemId, 1);
          homeStoreItemsRef.current.get(home.id)?.add(item);
          stored = true;
        } catch {
          stored = false;
        }
      }
      if (stored) {
        showFeedback(`The cat left a ${name} in your stores.`, 'gain');
      } else {
        pileState.spawnPile({ item, quantity: 1, x: home.x, z: home.z });
        showFeedback(
          `Your stores are full — the cat left a ${name} by the door.`,
          'info',
        );
      }
      saveNow();
    });
    const offCatPresent = bus.on('cat:present', ({ item, x, z }) => {
      pileState.spawnPile({ item, quantity: 1, x, z });
      showFeedback(`The cat left a ${displayNameFor(item)} for you.`, 'gain');
      saveNow();
    });
    const offCatGift = bus.on('cat:gift', ({ item, x, z }) => {
      pileState.spawnPile({ item, quantity: 1, x, z });
      const player = playerRef.current;
      if (player && Math.hypot(player.x - x, player.z - z) <= 15) {
        showFeedback(
          `The cat has left a ${displayNameFor(item)} at the hearth.`,
          'info',
        );
      }
      saveNow();
    });
    // TRAP ROW (Adam, 2026-10-28): the shell owns trap
    // rolls + row refresh. 'trap:catch' (emitted by
    // setCatch, the shell's only catch writer) re-reads
    // the snapshot + saves; 'trap:placed' re-reads for a
    // newly placed trap; 'trap:hour' rolls every
    // still-empty placed trap (uncaught-only, per emit —
    // a mid-burst catch skips later emits in the same
    // burst, since setCatch updates the trap at once).
    // Eligible kinds = the trap's set ∩ biome-present
    // kinds at the TRAP's position (the shell calls
    // eligibleKindsFor directly — no new Systems
    // function). Rolls use the trap's baited flag
    // (always false until a baiting landing adds one).
    // The catch write passes the clock (Systems' stamp,
    // 2026-11-06): the roll handler holds the sky, so
    // it stamps the absolute game hour the catch was
    // made — the steal beat below reads elapsed time
    // off that stamp.
    // TRAP STEAL (UI, 2026-11-06; Adam's fork: 'The
    // count should survive a reload on traps' — the
    // persisted stamp, not in-memory counting): the
    // SAME 'trap:hour' emit carries a second beat —
    // every trap whose catch STANDS rolls to be
    // robbed, priced by the hours since its stamp
    // (elapsed = 24 x daysElapsed + the emitted hour,
    // minus caughtAtHour; the payload's hour is
    // hour-of-day, and a sleep burst rolls its skipped
    // hours before dawn — the day count is read before
    // the jump, so a burst prices its early hours
    // against the night that spawned them, never
    // negative). An unstamped catch reads freshly
    // caught (elapsed 0 — Systems' leniency) and can
    // never be robbed until it has a stamp and hours
    // on it. Chance = min(1, RATE x hours), RATE
    // 0.04/h DRAFT (a full day standing = certainly
    // taken). A hit clears the catch (the stamp dies
    // with it) and voices ONE notice; 'trap:catch'
    // saves. The trap itself is never consumed. The
    // steal beat runs FIRST, on the catches standing
    // when the hour turned — a catch made this very
    // hour has no hours on it and is never priced.
    const TRAP_STEAL_RATE_PER_HOUR = 0.04;
    const offTrapCatch = bus.on('trap:catch', () => {
      refreshTrapsFromState();
      saveNow();
    });
    const offTrapPlaced = bus.on('trap:placed', () => {
      refreshTrapsFromState();
    });
    const offTrapHour = bus.on('trap:hour', ({ hour }) => {
      const gen = genRef.current;
      if (!gen) return;
      const sky = rendererRef.current?.snapshotSky();
      const nowAbsoluteHour = sky ? sky.daysElapsed * 24 + hour : null;
      if (nowAbsoluteHour !== null) {
        for (const trap of trapState.snapshot()) {
          if (trap.catch === null) continue;
          const stamp = trap.caughtAtHour;
          const elapsed =
            typeof stamp === 'number' && Number.isFinite(stamp)
              ? Math.max(0, nowAbsoluteHour - stamp)
              : 0;
          if (elapsed <= 0) continue;
          const vanishChance = Math.min(
            1,
            TRAP_STEAL_RATE_PER_HOUR * elapsed,
          );
          if (Math.random() < vanishChance) {
            trapState.setCatch(trap.id, null);
            showFeedback(
              'Something has been at your trap — the catch is gone.',
              'info',
            );
          }
        }
      }
      for (const trap of trapState.snapshot()) {
        if (trap.catch !== null) continue;
        const eligible = eligibleKindsFor(
          trap.type,
          biomePresentKinds((x, z) => gen.weightsAt(x, z), trap.x, trap.z),
        );
        const outcome = resolveTrapHour(eligible, trap.baited);
        if (outcome.caught) {
          trapState.setCatch(
            trap.id,
            outcome.kind,
            nowAbsoluteHour ?? undefined,
          );
        }
      }
    });
    const offFireLit = bus.on('fire:lit', refreshFires);
    const offTorchPlaced = bus.on('torch:placed', refreshTorches);
    const offTorchRemoved = bus.on('torch:removed', refreshTorches);
    const offAltarPlaced = bus.on('altar:placed', refreshAltars);
    const offAltarRemoved = bus.on('altar:removed', refreshAltars);
    const offDeskPlaced = bus.on('desk:placed', refreshDesks);
    const offDeskRemoved = bus.on('desk:removed', refreshDesks);
    const offWorkstationPlaced = bus.on(
      'workstation:placed',
      refreshWorkstations,
    );
    const offWorkstationRemoved = bus.on(
      'workstation:removed',
      refreshWorkstations,
    );
    const offCauldronPlaced = bus.on('cauldron:placed', refreshCauldrons);
    const offCauldronRemoved = bus.on('cauldron:removed', refreshCauldrons);
    // Ritual subscriptions: the panel re-renders on every
    // stage/unstage (the book + site state mutate without
    // rendering by themselves — ritualVersion is the
    // render signal, torch pattern minus anchors).
    const offRitualStaged = bus.on('ritual:staged', refreshRitual);
    const offRitualUnstaged = bus.on('ritual:unstaged', refreshRitual);
    const offShelterPlaced = bus.on('shelter:placed', () => {
      const p = playerRef.current;
      if (!p) return;
      const s = shelterAt(p.x, p.z, shelterState.snapshot());
      applyShelterHouse(s.houseId);
    });
    const offShelterChanged = bus.on('shelter:changed', ({ houseId }) => {
      applyShelterHouse(houseId);
    });
    // SLEEP LISTENER (Fill-in's sleep.ts, shell half): ONE
    // listener for the shell, created here after the
    // renderer exists. Deps are lazy closures over the
    // live rig: cycleT from snapshotSky, dawn jump via
    // restoreSky({ cycleT: 0 }). A second listener would
    // double-emit the outcome events, so this is created
    // exactly once in this effect and unsubscribed below.
    const offSleep = createSleepListener({
      getCycleT: () => rendererRef.current?.snapshotSky()?.cycleT ?? null,
      restoreDawn: () => rendererRef.current?.restoreSky({ cycleT: 0 }),
    });
    // GROUNDHOG WAKE (groundhog wiring): sleep is
    // instantaneous (dawn jump, then 'sleep:completed') —
    // there is no separate start event, so the completed
    // handler does sleepStart → wake in order: the old
    // rested day ends, the new one sets iff carried +
    // awakened at wake. A failed press gets NO calls
    // (no sleep happened — it must not clear a rested
    // day). The wake bonus rides existing restore
    // (clamped at 100, no hunger.ts change); the HUD
    // refresh + drain re-sync follow the restore, and
    // saveNow runs only when the bonus applied (hunger
    // changed — rested itself is session-only, never
    // saved). Unsubscribed with offSleep below.
    const offGroundhogWake = bus.on('sleep:completed', () => {
      const charms = charmStateRef.current;
      const carried = charms.isAwakened('groundhog-tooth');
      groundhogRestRef.current.sleepStart();
      groundhogRestRef.current.wake(carried, charms);
      const bonus = groundhogWakeBonus(carried, charms);
      if (bonus > 0) {
        hunger.restore(bonus);
        setHungerValue(hunger.value());
        setHungerStage(hunger.stage());
        saveNow();
      }
      syncShrewEffect();
    });
    // QUEST FLAG (wiring follow-up, 2026-10-28): slept sets
    // on ANY sleep completion, beside the groundhog listener
    // (not inside it — rested/wake is its concern, quests
    // are this one's). Groundhog's only saves on bonus, so
    // this listener saves itself. Unsubscribed with
    // offQuestSlept below.
    const offQuestSlept = bus.on('sleep:completed', () => {
      setQuestFlag('slept');
      saveNow();
    });
    // Autosave on pagehide: the last-chance write when she leaves
    // or refreshes. saveNow reads only refs + singletons (see its
    // note), so this first-render closure stays correct for the
    // life of the mount.
    const onPageHide = () => {
      // A deliberate swap/clear unload (bring / restore /
      // New Game) sets the suppression mark before its
      // reload — this writer must not overwrite the
      // deliberate write with the leaving session's state.
      if (unloadSaveSuppressedRef.current) return;
      saveNow();
    };
    window.addEventListener('pagehide', onPageHide);
    const offCompleted = bus.on('harvest:completed', (p) => {
      // PILL FIX: dismiss the harvested target's Harvest
      // button at once (no movement needed for the menu
      // to catch up — targets otherwise refresh only on
      // the next projection). 'remove' drops the whole
      // target (plant gone); 'harvest' marks it harvested
      // (the column suppresses Harvest, Remove stays
      // until the tracker stops emitting the regrowing
      // plant). Scatter only — ground targets (piles)
      // may still hold items after a take, so their
      // button stays.
      if (p.kind === 'scatter') {
        if (p.action === 'remove') {
          setHarvestTargets((current) =>
            current.filter((t) => t.id !== p.targetId),
          );
          setHarvestedIds((prev) => {
            const next = new Set(prev);
            next.delete(p.targetId);
            return next;
          });
        } else {
          setHarvestedIds((prev) => new Set(prev).add(p.targetId));
        }
      }
      // PICKUP COUNTS AS A LOOK (Adam, 2026-10-28,
      // RULED — Systems 70f20b5 records it in rituals.ts
      // + supplies charms.recordBonePickupLook as THE
      // shell path): a bone pickup records 1 LOOK at
      // that bone kind in NameSight — pickup ALONE
      // satisfies speakName's minLooks 1. The helper
      // derives the kind from the GRANTED ITEM id (what
      // she actually carries — agrees with the payload
      // position derivation by construction, since
      // harvest yields the kind item from the target
      // position; the helper is preferred because it
      // also covers pile takes uniformly, where no
      // harvest position exists). Yields are already
      // merged by item, so one call per bone yield
      // entry = one look per granted kind. Carried
      // yields only (overflow dropped as piles was not
      // picked up — a failed/full-pack grant records no
      // look, per the helper's contract). Both 'harvest'
      // and 'remove' completions count — a remove takes
      // the bone too (flagged reading of 'picking it
      // up'). Recorded BEFORE saveNow so the look
      // persists; the panel gate reads looksAt(kind)
      // and shows satisfied at ≥ 1.
      for (const y of p.yields) {
        const item = normalizeItemId(y.item);
        if (!isBoneItem(item)) continue;
        const kind = boneKindFor(item);
        if (kind === null) continue;
        recordBonePickupLook(
          item,
          nameSightRef.current,
          portionsForKind(kind) ?? [],
        );
      }
      refreshInventory();
      saveNow();
      setHarvestProgress((current) =>
        current?.targetId === p.targetId ? null : current,
      );
      // A multi-step finish carries the def's success
      // line (Systems rider): it IS the finish line —
      // shown INSTEAD of the yields line, because two
      // lines for one event would print over each other
      // in spirit even in the feed (Adam's standing
      // rule). The yields still land in inventory above;
      // single-press completions (no successMessage)
      // keep the yields line.
      if (p.successMessage) {
        showFeedback(p.successMessage, 'info');
      } else {
        showFeedback(
          p.yields.map((y) => `${y.item} × ${y.quantity}`).join(', '),
          'gain',
        );
      }
    });
    const offFailed = bus.on('harvest:failed', (p) => {
      setHarvestProgress((current) =>
        current?.targetId === p.targetId ? null : current,
      );
      const text =
        p.reason === 'inventory-full' && p.yields.length > 0
          ? `Pack full — ${p.yields.map((y) => `${y.item} × ${y.quantity}`).join(', ')} didn't fit.`
          : p.reason === 'below-permit'
            ? belowPermitText(p.sourceId)
            : p.reason === 'not-removable'
              ? // Backstop voice (2026-10-31): the offer
                // chain no longer renders Remove for
                // ground-class scatter, so this speaks
                // only if a remove somehow still lands —
                // in words, not the raw code. DRAFT line.
                "That is the ground itself — it can't be taken up"
              : `Harvest failed: ${p.reason}.`;
      showFeedback(text, 'blocked');
    });
    const offProgress = bus.on('harvest:progress', (p) => {
      // Pill-fill (Adam, 2026-10-29): the pill carries the
      // progress now — state from the payload verbatim
      // (fraction, press index/total, verb, all computed
      // at the emit site). The struggle line joins the
      // message feed like every spoken line.
      setHarvestProgress({
        targetId: p.targetId,
        fraction: p.progress,
        pressIndex: p.pressIndex,
        pressesTotal: p.pressesTotal,
        verb: p.verb,
      });
      showFeedback(p.struggleMessage, 'info');
    });
    const offLoaded = bus.on('world:chunkLoaded', () =>
      setChunkCount(renderer.loadedChunkCount),
    );
    const offUnloaded = bus.on('world:chunkUnloaded', () =>
      setChunkCount(renderer.loadedChunkCount),
    );
    // First stream happens on the renderer's first frame; the count lands
    // via chunkLoaded events. Seed the display after a tick as a fallback.
    const timer = window.setTimeout(
      () => setChunkCount(renderer.loadedChunkCount),
      500,
    );
    const onResize = () => {
      recomputeAnchors();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(hungerTimer);
      window.clearTimeout(warningFlashTimerRef.current);
      window.clearTimeout(transitionTimerRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pagehide', onPageHide);
      offCamera();
      offPause();
      offMoved();
      offLooked();
      offInRange();
      offPiles();
      offSystemsPilePickup();
      offCompleted();
      offFailed();
      offProgress();
      offFirePlaced();
      offFireLighting();
      offCompanionStance();
      offCompanionDeparted();
      offCatMet();
      offGuideCall();
      offCatDelivered();
      offCatPresent();
      offCatGift();
      offTrapCatch();
      offTrapPlaced();
      offTrapHour();
      offFireLit();
      offTorchPlaced();
      offTorchRemoved();
      offAltarPlaced();
      offAltarRemoved();
      offDeskPlaced();
      offDeskRemoved();
      offWorkstationPlaced();
      offWorkstationRemoved();
      offCauldronPlaced();
      offCauldronRemoved();
      offRitualStaged();
      offRitualUnstaged();
      offShelterPlaced();
      offShelterChanged();
      offSleep();
      offGroundhogWake();
      offQuestSlept();
      unsubHarvestOutcome();
      offLoaded();
      offUnloaded();
      player.dispose();
      renderer.dispose();
      rendererRef.current = null;
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PAUSE TRIGGER (Adam, 2026-10-26 — "Switching Windows should
  // pause the game. If it's not playable, it should pause"):
  // the game pauses whenever it stops being playable — the tab
  // is hidden OR the window loses focus (switching windows,
  // switching apps, anything that takes the game off-screen).
  // This SETS the flag only. It never clears it: resume is
  // tap-only (pinned), so focus/visible return does NOT
  // auto-resume — only the Paused button's tap calls
  // setPaused(false). setPaused is idempotent, so a repeated
  // blur/hidden event emits nothing.
  useEffect(() => {
    const pause = () => {
      pauseState.setPaused(true);
    };
    const onVisibility = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Regenerate the world from a seed. The optional
  // override is the first-run dialog's path: Begin passes
  // its trimmed seed (blank → DEFAULT_SEED via the same
  // fallback), while the Options callers pass nothing and
  // read seedInput as before. The override exists because
  // setSeedInput + regenerate() in one handler would read
  // the STALE seedInput (state updates batch) — the
  // dialog's seed must arrive as an argument, not via
  // state. Callers that pass nothing MUST call it as
  // () => regenerate(): a bare onClick={regenerate}
  // would land the click event as the override.
  const regenerate = (seedOverride?: string) => {
    const nextSeed = (seedOverride ?? seedInput).trim() || DEFAULT_SEED;
    const gen = createWorldGen(nextSeed);
    genRef.current = gen;
    const renderer = rendererRef.current;
    const player = playerRef.current;
    if (!renderer || !player) return;
    const spawn = gen.findSpawn();
    player.x = spawn.x;
    player.z = spawn.z;
    // Sky-trap fix (Adam 2026-10-26): regenerate does NOT recreate
    // the player, so pitch would otherwise survive a seed change —
    // re-default it to horizontal here (toggleCamera covers the
    // mode-switch half via resetLook).
    player.resetLook();
    renderer.setWorldGen(gen);
    setSeed(nextSeed);
    setPosition({ x: spawn.x, z: spawn.z });
    // A new world clears placed tents: setWorldGen
    // already cleared the renderer's list, and the
    // shell store clears with it — or chips + save
    // would keep old-world tents alive in the new
    // world. The clear syncs to the renderer via
    // updatePlacedTents (setTents([])); the next
    // saveNow persists the empty list.
    updatePlacedTents([]);
    // A new world clears placed bags with the tents
    // (the clear syncs via updatePlacedBags).
    updatePlacedBags([]);
    // A new world clears the dimension buckets with
    // the stores (the store swap's shell seat): the
    // parked mirror empties with the world.
    dimensionBuckets.clearBuckets();
    // A new world clears the named places with the
    // world (the naming build): her names were given
    // to the old world's spots; the register's clear
    // is its fresh-world door. The selection goes too.
    namedPlacesRef.current?.clear();
    selectPlace(null);
    // A new world clears the scry reveal (new camps, new water).
    divinationRef.current.dismiss();
    renderer.setCampArrowsVisible(false);
    setScryVisible(false);
    // A new world clears the shown LOOK line (its target is
    // gone); the NameSight counts persist — knowledge is
    // hers, not the world's.
    setLookResult(null);
    // A new world clears ritual stagings (their sites are
    // gone — setWorldGen already cleared the physical
    // staged bones) and closes the ritual panel; the
    // AWAKENINGS persist — what she has awakened is hers,
    // not the world's (same rule as NameSight counts).
    stagingBookRef.current.restore([]);
    setSelectedSiteId(null);
    setRitualNote(null);
    setBiomeText(formatWeights(gen.weightsAt(spawn.x, spawn.z)));
    bus.emit('world:seedSet', { seed: nextSeed });
    recomputeAnchors();
  };

  // First-run Begin (Adam, 2026-10-28): the dialog's
  // trimmed values arrive here. Name: blank → unnamed
  // (undefined — the cloud list falls back to 'Main
  // save'). Seed: blank → DEFAULT_SEED, via regenerate's
  // override path (the Options seed field syncs too, so
  // it shows the chosen seed). The full regenerate tail
  // runs — at first run its clears are no-ops (no tents,
  // stagings, or scry state yet) and its world-swap steps
  // (spawn, setWorldGen, anchors, seedSet bus) are exactly
  // what a new world needs. No saveNow here: the name +
  // seed persist at the first saveNow (state + ref +
  // meta sync), the same as any unsaved progress. Begin
  // ACTUALLY opens the intro (DEV correction) — it sets
  // introOpen true, it does not merely un-gate an
  // auto-open. (The regenerate guard returns early when
  // the renderer/player are missing; firstRunDone +
  // introOpen still set — Begin never strands the
  // player on the dialog.)
  const handleFirstRunBegin = (name: string, seed: string) => {
    setWorldName(name === '' ? undefined : name);
    setSeedInput(seed === '' ? DEFAULT_SEED : seed);
    regenerate(seed);
    setFirstRunDone(true);
    setIntroOpen(true);
  };

  // Consume the pending new world (claim 3): apply the
  // folded dialog's collected name + seed through the
  // ordinary Begin path. The stash clears FIRST, so no
  // later boot can re-consume it; a stash riding a boot
  // that somehow has a save is cleared and ignored (the
  // folded flow only ever writes it alongside the park +
  // clear + reload that guarantees a save-less boot).
  useEffect(() => {
    if (pendingNewWorld === null) return;
    try {
      window.localStorage.removeItem(PENDING_NEW_WORLD_KEY);
    } catch {
      /* a stuck stash is inert: firstRunDone already read it */
    }
    if (bootSave === null) {
      handleFirstRunBegin(pendingNewWorld.name, pendingNewWorld.seed);
    }
    // Mount-only: bootSave and pendingNewWorld are
    // first-render constants by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Station presence from the real query at her position
  // (see the header): stump in range = workstation, placed
  // loom in range = loom — BOTH booleans, not one context.
  // Its consumers are availableStations and the
  // stationAnchor derivation — NOTHING ELSE: the
  // crafting feed derives from the faced USE winner
  // (Adam's station law; see the derivation below
  // useWinner), and Background's presence cleanup
  // (c5192c0, #30) removed the litFire fact from this
  // shape whole, so no fire fact rides it at all.
  // Recomputed when she moves or the world regenerates.
  const stationPresenceValue = useMemo(() => {
    return stationPresence(genRef.current, position.x, position.z);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.x, position.z, seed]);
  // Station anchor (pill fix (b), Adam 2026-10-28): when
  // standing at a station, the harvest column anchors above
  // that station's projected center instead of sitting
  // screen-fixed; away from stations (or when the projection
  // is null, e.g. station behind the camera) the anchor is
  // null and the column stays as today. Position sources are
  // existing only: nearest stump from stumpPositions (it
  // mirrors stationPresence exactly, so a true workstation
  // presence guarantees a non-empty list), else nearest
  // placed loom within HARVEST_RANGE from loomState.
  // Projection reuses projectAnchor 'scatter' (the same
  // above-ground point the stump chips use); the column's
  // translate lifts it above the point like WorldAnchor's
  // above-point placement, but inside the z-40 overlay —
  // never the z-30 anchor overlay.
  const stationAnchor = (() => {
    if (!stationPresenceValue.workstation && !stationPresenceValue.loom) {
      return null;
    }
    let nearest: { x: number; z: number } | null = null;
    let nearestD = Infinity;
    if (stationPresenceValue.workstation) {
      for (const s of stumpPositions(genRef.current, position.x, position.z)) {
        const d = Math.hypot(s.x - position.x, s.z - position.z);
        if (d < nearestD) {
          nearestD = d;
          nearest = s;
        }
      }
    }
    if (!nearest && stationPresenceValue.loom) {
      for (const loom of loomState.snapshot()) {
        const d = Math.hypot(loom.x - position.x, loom.z - position.z);
        if (d <= HARVEST_RANGE && d < nearestD) {
          nearestD = d;
          nearest = loom;
        }
      }
    }
    if (!nearest) return null;
    return projectAnchor(nearest.x, nearest.z, 'scatter');
  })();
  // NEAREST STUMP (stumpy shell, 2026-10-28): the FACED
  // stump for the workstation upgrade — nearest record
  // from stumpPositions, UNPROJECTED, stump-only (no loom
  // fallback: a loom cannot be upgraded). NEAREST-ONLY,
  // no cone: the recipe gate is workstation PRESENCE,
  // not facing — standing at a plain stump facing away
  // must not refuse an upgrade the recipe allows. Shared
  // by the executeCraftNow branch, the mapping guard,
  // and the press-refuse backstop, so the three cannot
  // disagree. stumpPositions returns in-range records
  // (HARVEST_RANGE), so no extra range filter here.
  // Ties → first in stumpPositions order (strict <),
  // mirroring the stationAnchor loop above.
  const nearestStump = (() => {
    let nearest: { x: number; z: number } | null = null;
    let nearestD = Infinity;
    for (const s of stumpPositions(genRef.current, position.x, position.z)) {
      const d = Math.hypot(s.x - position.x, s.z - position.z);
      if (d < nearestD) {
        nearestD = d;
        nearest = s;
      }
    }
    return nearest;
  })();
  // Quest Log display (2026-10-28): derived on every render
  // from live state — no cached copy, no polling — so the tab
  // reads fresh on activation (the tab switch re-renders) and
  // on the 1 s tick, refreshInventory, and bus listeners like
  // everything else. Hints are draft one-liners for Adam's
  // pin pass; titles + completion come from Systems.
  // ONE FACTS OBJECT (HUD-card chunk): the predicates'
  // input, built once and read by both evaluateQuests
  // (the log) and questComponentsFor (the card) so the
  // two surfaces can never disagree about the world.
  // THE ALTAR BASES (parity, 2026-11-01 — Adam: 'Both
  // types of altars should work the same'): every base's
  // additions, stump or placed, read once for the facts
  // below. Progress between bases compares by step
  // count (the steps seat in order, so the longest
  // record is the furthest along).
  const altarBasesAdditions: readonly string[][] = [
    ...stumpState.snapshot().map((stump) => stump.additions),
    ...altarState.snapshot().map((altar) => altar.additions ?? []),
  ];
  const mostProgressedAltarAdditions = altarBasesAdditions.reduce<
    readonly string[]
  >(
    (best, additions) =>
      additions.length > best.length ? additions : best,
    [],
  );
  const anyAltarConsecrated = altarBasesAdditions.some((additions) =>
    isStumpyAltar(additions),
  );
  const questFacts: QuestFacts | undefined = inventory
    ? {
        inventory,
        ownedToolStage: ownedStage(inventory),
        fires: fireState.snapshot().map((fire) => ({
          type: fire.type,
          lit: fire.lit,
        })),
        houses: shelterState.snapshot().map((house) => ({
          type: house.type,
        })),
        placedTorches: torchState.snapshot().length,
        flags: questFlags,
        // THE ALTAR FACTS (parity): a raised altar of
        // EITHER base for wake-charm's road; the most-
        // progressed base's additions and the any-base
        // consecration for Raise an Altar, whose
        // predicate (Systems' altarComplete) reads the
        // additions through isConsecratedAltar or the
        // consecrated flag — pre-parity the shell fed
        // neither, so the quest could not complete
        // from the shell on any base.
        altarRaised: anyAltarConsecrated,
        altarAdditions: mostProgressedAltarAdditions,
        altarConsecrated: anyAltarConsecrated,
        // THE AWAKENINGS COUNT (Systems' latch chunk):
        // how many Wakings stand recorded — wake-charm
        // reads flag OR count, so a completed rite stays
        // complete in the log's reading too.
        awakenings: charmStateRef.current.snapshot().length,
        // THE LIVENESS BAND (Systems' 080ff60): the card
        // fallback consults isQuestLive, which reads the
        // hunger band for the quests that declare one —
        // fed from the same HungerState the witness reads.
        hungerStage: hungerRef.current?.stage(),
        // ONE OF EVERY BONE (Systems' halves, a71d984) —
        // MET kinds gate the quest's ROWS (LAW 1): the
        // bone kinds are the NameSight keys for bone
        // looks, and a pickup counts as a look by the
        // standing wiring, so a kind stands met when a
        // look stands recorded under its name.
        bonesMet: BONE_QUEST_KINDS.filter(
          (kind) => nameSightRef.current.looksAt(kind) > 0,
        ),
        // ACQUIRED kinds judge the quest's COMPLETION
        // (LAW 2): the latched union through Systems'
        // one helper — carried now ∪ awakened (the
        // CharmState snapshot's kinds stand in bone-kind
        // space) ∪ the saved latch's kinds.
        bonesAcquired: boneAcquisitionsFor(
          inventory,
          charmStateRef.current
            .snapshot()
            .map((awakening) => awakening.kind),
          savedBoneAcquisitionsRef.current,
        ),
      }
    : undefined;
  // THE LATCH UNION (the latch law): whatever reads
  // complete in THIS facts object and is not yet latched
  // joins the latch before anything evaluates — the
  // render that first sees a completion latches it, and
  // every later saveNow carries it on the quests record.
  if (questFacts) {
    const freshCompletions = newlyCompleted(
      questFacts,
      latchedCompletedRef.current,
    );
    if (freshCompletions.length > 0) {
      latchedCompletedRef.current = new Set([
        ...latchedCompletedRef.current,
        ...freshCompletions,
      ]);
      // THE QUEST EMIT SEAT (the journal bite; DEV's
      // ruling 2026-11-06): completions are derived
      // reads — no systems write exists to declare
      // them — so the shell declares them here, at its
      // own detection. An id reads fresh exactly once
      // per session (the latch check above is the
      // guard), and the render-scope seat cannot
      // double-fire. THE BOOT-RENDER GUARD: this facts
      // site runs on the boot render too — one render
      // BEFORE the boot effect seats
      // latchedCompletedRef from the save — where a
      // saved completion would read 'fresh' against
      // the still-empty latch. saveRestoredRef is the
      // shell's own restored flag: until it stands,
      // fresh ids latch silently (the pre-restore
      // render's union is exactly the boot seat's own
      // work); from the first post-restore render on,
      // a fresh read is a live completion and declares.
      if (saveRestoredRef.current) {
        for (const id of freshCompletions) {
          const title = questById(id)?.title;
          if (title) emitJournalChange({ kind: 'quest', label: title });
        }
      }
    }
  }
  const questDisplay = questFacts
    ? evaluateQuests(questFacts, latchedCompletedRef.current).map((quest) => ({
        ...quest,
        hint: QUEST_HINTS[quest.id] ?? '',
        act:
          QUEST_ACTS.find((act) => act.id === quest.act)?.name ??
          'Act I — Survival',
        thread: QUEST_THREADS.find((thread) => thread.id === quest.thread)
          ?.name,
        active: quest.id === activeQuestId,
      }))
    : undefined;
  // THE CARD'S QUEST (composition rule, DEV 2026-11-02,
  // on Adam's 'Eat When Hungry while fed' objection):
  // the MARKED quest while it stands incomplete,
  // UNCHANGED — a mark stands whatever its moment;
  // otherwise the first not-done quest in definition
  // order whose liveness holds (isQuestLive — a quest
  // whose moment is not live, like eating while fed,
  // never surfaces on the fallback). No live quest =
  // the card stands down: a card naming nothing she
  // can act on does not stand. All done = no card.
  const cardQuestRow =
    questDisplay?.find(
      (quest) => quest.id === activeQuestId && !quest.done,
    ) ??
    questDisplay?.find(
      (quest) =>
        !quest.done &&
        questFacts !== undefined &&
        isQuestLive(quest.id, questFacts),
    );
  const cardQuestComponents =
    cardQuestRow && questFacts
      ? questComponentsFor(cardQuestRow.id, questFacts)
      : [];
  // THE BONE COUNT (one-of-every-bone, LAW 1): the
  // card's count for the bone quest is the MET rows'
  // count and nothing else — the set's size prints
  // nowhere, on any surface. Other quests carry no
  // count line.
  const cardQuestCountLine =
    cardQuestRow?.id === 'one-of-every-bone'
      ? `Kinds met: ${cardQuestComponents.length}`
      : undefined;
  // CRAFTING DERIVATION RELOCATED (2026-10-30): the
  // availableStations -> craftingSections block lives
  // BELOW the useWinner call in this component — the
  // faced-target station feed reads the winner, whose
  // own dependency cluster sits below this point. Pure
  // derivations, unchanged inputs; its consumers (the
  // CraftingMenu JSX, the craft handlers) all sit below
  // the new home or read it at event time.


  // Trap-craft confirm (Adam, 2026-10-26): a trap recipe's Craft
  // button asks FIRST, in the staged Popup dialog shell — the
  // existing execution below runs only on Yes. No aborts with
  // nothing consumed and no trap, because execution never
  // starts. Trap rows are the Traps group, nothing else.
  const [pendingTrapRecipeId, setPendingTrapRecipeId] = useState<
    string | null
  >(null);
  const pendingTrapRecipe = pendingTrapRecipeId
    ? RECIPES.find((candidate) => candidate.id === pendingTrapRecipeId)
    : undefined;
  // THE CARRYABLE TRAPS' CRAFT CONFIRM (the trap chunk,
  // 2026-11-01): a carryable trap's craft EXECUTES first
  // (the trap lands in the pack — an ordinary grant), then
  // this state asks the pinned table's question: place it
  // right there, or keep it packed? Yes composes the
  // placement at the aim; No (or Close) leaves it in the
  // pack. Deliberately NOT the site-built pair's pre-craft
  // confirm above — their No means never craft, the
  // three's No means pack (Adam's trap table).
  const [pendingCarriedTrap, setPendingCarriedTrap] =
    useState<string | null>(null);
  const pendingCarriedTrapRecipe = pendingCarriedTrap
    ? RECIPES.find((candidate) => candidate.id === pendingCarriedTrap)
    : undefined;
  // PC-keys remove target (2026-10-28): the scatter target
  // Shift+E armed for the confirm dialog; null = no dialog.
  // The dialog owns its Enter/Esc; the App Esc listener
  // yields while it is open (single Esc path).
  // The place whose name she is asked to lift (the
  // naming build): the un-name confirm's target, by
  // the register's record.
  const [pendingUnnamePlace, setPendingUnnamePlace] =
    useState<NamedPlace | null>(null);
  const [pendingRemoveTarget, setPendingRemoveTarget] =
    useState<HarvestTarget | null>(null);
  // THE FAMILIAR'S RITE (Build 2, Piece 1): a rite act
  // pressed at an altar-grade seat waits here for its
  // confirm — the act, the animal, and the PRESS-TIME
  // grade (the seat's grade when she asked; Systems
  // re-checks it at execution). Null = no rite pending.
  const [pendingRite, setPendingRite] = useState<{
    act: 'elevate' | 'relinquish' | 'supersede';
    creatureId: string;
    grade: number;
  } | null>(null);
  // THE TEACHING BEAT (First-Fragment Presentation,
  // 2026-10-31): a mark's first transcription waits
  // here as a dismissible dialog (Popup family, no
  // confirm — the dismissal is the lesson's end).
  // First-ever and later-first carry different texts;
  // the handler composes both. Null = no beat standing.
  const [fragmentBeat, setFragmentBeat] = useState<{
    title: string;
    body: string;
  } | null>(null);

  const executeCraftNow = (recipeId: string) => {
    const recipe = RECIPES.find((candidate) => candidate.id === recipeId);
    if (!recipe) return;
    // THE INJURY WORK GATE (the feral build): at
    // critical, crafting — heavy work — is refused
    // before anything is consumed, in the stump
    // backstop's shape directly below (Systems'
    // isBadlyHurt() gate query; an honest note,
    // never a silent no-op).
    if (injury.isBadlyHurt()) {
      setCraftNote('She is too badly hurt for heavy work.');
      return;
    }
    const ownedBefore = ownedToolItem(inventory);
    // STUMPY PRESS-REFUSE BACKSTOP (shell-side guard):
    // an upgradesStump press at an already-workbench
    // stump refuses BEFORE executeCraft — consumption
    // lives inside executeCraft, so a branch-only guard
    // would be too late (materials already gone).
    // Nothing consumed, no refresh, no save: plain
    // return. Shares nearestStump with the mapping
    // guard, so the two cannot disagree.
    if (
      recipe.upgradesStump === true &&
      nearestStump !== null &&
      stumpState.isWorkbench(nearestStump.x, nearestStump.z)
    ) {
      setCraftNote('This stump is already a workbench.');
      return;
    }
    try {
      const result = executeCraft(
        recipe,
        inventory,
        availableStations.length > 0 ? availableStations : null,
        hunger,
        null,
        null,
        null,
        grimoireOutOfPack(),
      );
      // SINGLE-CALLER RULE (DEV correction, superseding the
      // emit half of the original brief): Systems never places
      // and never emits — on a placedTrap result the SHELL
      // places, here, via trapState.placeTrap (stores the trap
      // and emits 'trap:placed'; the renderer reads trapState).
      // This call is the one and only placer per craft. For
      // traps this runs only on the confirm's Yes — the Popup
      // above gates first, No/Close never reaches execution.
      if (result.placedTrap) {
        trapState.placeTrap(
          result.placedTrap.type as TrapType,
          position.x,
          position.z,
        );
      }
      // STUMPY BRANCH (same single-caller rule): Systems
      // reports upgradedStump {type} and never transforms
      // — the SHELL transforms, here, via Background's
      // anchor primitive on the FACED stump (nearestStump,
      // NOT the projected anchor, NOT the player position).
      // The output item is NOT granted (feedback naming
      // only). The renderer rebuilds on the
      // 'stump:upgraded' emit, so no shell refresh call
      // is needed. False = already a workbench (the
      // backstop above makes this unreachable in practice;
      // the note below stays honest if it ever fires).
      let stumpUpgraded = false;
      if (result.upgradedStump) {
        stumpUpgraded =
          nearestStump !== null &&
          stumpState.upgradeStump(nearestStump.x, nearestStump.z);
      }
      setOwnedItem(result.owned);
      setCraftNote(
        result.placedTrap
          ? `Placed ${displayNameFor(result.output.item)} here.`
          : result.upgradedStump
            ? stumpUpgraded
              ? 'This stump is now a workbench.'
              : 'This stump is already a workbench.'
            : `Crafted ${result.output.item} × ${result.output.quantity}.` +
              (result.owned !== ownedBefore
                ? ` Owned tool is now ${result.owned}.`
                : ''),
      );
      // SPOIL (the trap chunk, 2026-11-01 — the no-void
      // promise): a craft outcome carrying spoil has
      // already granted what fit in the pack; the
      // REMAINDER seats as a pile at her feet through
      // pileState.drop (merge-safe by coords) instead of
      // vanishing into a result nobody read. Today only
      // the pitfall's dug earth rides this; the seat is
      // the craft's own ground — the pit's edge.
      if (result.spoil && result.spoil.remainder > 0) {
        pileState.drop(
          result.spoil.item,
          result.spoil.remainder,
          position.x,
          position.z,
        );
        showFeedback(
          `The leftover ${displayNameFor(result.spoil.item).toLowerCase()} piles at your feet.`,
          'info',
        );
      }
      // QUEST FLAG (wiring follow-up, 2026-10-28): a craft
      // at a stump workstation sets craftedAtStump. The
      // 'workstation' id is the stump today (presence comes
      // solely from stumps); loom-only / station-less crafts
      // do not set it. saveNow below covers persistence.
      if (availableStations.includes('workstation')) {
        setQuestFlag('craftedAtStump');
      }
    } catch (error) {
      setCraftNote(
        error instanceof Error ? error.message : 'Crafting failed.',
      );
    }
    refreshInventory();
    saveNow();
  };

  const handleCraft = (recipeId: string) => {
    // THE CARRYABLE THREE (the trap chunk, 2026-11-01):
    // their craft EXECUTES (the trap lands in the pack),
    // then the confirm asks place-or-pack. Success is
    // read off the pack itself — the craft's own error
    // path (a thrown refusal) leaves the count unchanged
    // and no question is asked over a failed craft.
    if (isCarryableTrap(recipeId)) {
      const before = inventory.count(recipeId);
      executeCraftNow(recipeId);
      if (inventory.count(recipeId) > before) {
        setPendingCarriedTrap(recipeId);
      }
      return;
    }
    // Site-built trap crafts confirm first ("Place trap
    // here?") — keyed on the recipe's own placesTrap fact
    // (today: pitfall + deadfall only; the carryable
    // three were re-shaped as carried items and take the
    // branch above).
    if (SYSTEMS_RECIPE_BY_ID.get(recipeId)?.placesTrap) {
      setPendingTrapRecipeId(recipeId);
      return;
    }
    executeCraftNow(recipeId);
  };

  // PREREQUISITE CRAFTING (Adam, 2026-10-31): the button
  // on a CraftingMenu ingredient row — craft the missing
  // prerequisite (and ITS prerequisites) without leaving
  // the open recipe. Systems' executeCraftChain plans the
  // whole chain first (atomic: a refusal consumes NOTHING
  // and throws the blocker's reason, executeCraft idiom)
  // and crafts exactly the ingredient's shortfall; batch
  // surplus stays in her pack. The menu and the selection
  // never move — the note carries the outcome, and the
  // refresh re-reads every row's counts in place. Station
  // + hunger arguments mirror executeCraftNow exactly.
  const handleCraftPrerequisite = (recipeId: string, item: string) => {
    const recipe = RECIPES.find((candidate) => candidate.id === recipeId);
    if (!recipe) return;
    // THE INJURY WORK GATE (the feral build): the
    // chain door carries the same refusal as
    // executeCraftNow — a prerequisite craft is
    // heavy work too, and the two doors may not
    // disagree about whether she can work.
    if (injury.isBadlyHurt()) {
      setCraftNote('She is too badly hurt for heavy work.');
      return;
    }
    try {
      const result = executeCraftChain(
        recipe,
        item,
        inventory,
        availableStations.length > 0 ? availableStations : null,
        hunger,
        null,
        null,
        grimoireOutOfPack(),
      );
      setCraftNote(
        result.crafted.quantity > 0
          ? `Crafted ${result.crafted.item} × ${result.crafted.quantity}.`
          : `You already have enough ${result.crafted.item}.`,
      );
    } catch (error) {
      setCraftNote(
        error instanceof Error ? error.message : 'Crafting failed.',
      );
    }
    refreshInventory();
    saveNow();
  };

  const handleTrapConfirmYes = () => {
    const recipeId = pendingTrapRecipeId;
    setPendingTrapRecipeId(null);
    if (recipeId) executeCraftNow(recipeId);
  };

  const handleTrapConfirmNo = () => {
    setPendingTrapRecipeId(null);
  };

  const handleHarvest = (request: HarvestRequest) => {
    // The press is the whole UI-side action: the outcome listener
    // (boot effect) resolves it into items, failure, or progress,
    // and the completed/failed/progress subscriptions above render
    // the feedback. Nothing here grants, counts, or previews an
    // outcome ahead of those events.
    // THE INJURY WORK GATE (the feral build): at
    // critical, heavy work is refused — Systems'
    // isBadlyHurt() gate query, applied here in the
    // too-hungry gate's shape: an honest spoken
    // refusal before anything is emitted, never a
    // silent no-op.
    if (injury.isBadlyHurt()) {
      showFeedback('She is too badly hurt for heavy work.', 'blocked');
      return;
    }
    bus.emit('harvest:requested', request);
  };

  // TRAP COLLECT (Adam, 2026-10-28): ONE collect
  // request per press (trap id). Caught → Systems
  // grants the carcass (pack-full → catch STAYS,
  // pile-grant precedent) and the shell clears the
  // catch (setCatch emits 'trap:catch' → row re-reads
  // + saves; this handler refreshes the inventory +
  // pills the outcome + re-reads traps, covering the
  // no-emit edge). Empty → "Nothing caught yet."
  // (no Systems call — nothing to collect). The trap
  // stays placed and re-catches; the label flips on
  // the next render. Feedback copy is proposed, not
  // pinned ("Caught {kind}!" / "Nothing caught yet.");
  // the pack-full note is the established pile-take
  // wording, filling a gap the claim left unnamed.
  const handleCollectTrap = (trapId: string) => {
    const trap = trapState.get(trapId);
    if (!trap || trap.catch === null) {
      showFeedback('Nothing caught yet.',
        'info',
      );
      return;
    }
    const kind = trap.catch;
    const outcome = collectTrapCatch(inventory, kind);
    if (outcome.collected === false) {
      const carcass = catchItemFor(kind);
      showFeedback(outcome.reason === 'Pack full.'
          ? `Pack full — no room for ${carcass ? displayNameFor(carcass) : kind}.`
          : outcome.reason,
        'blocked',
      );
      return;
    }
    trapState.setCatch(trapId, null);
    refreshTrapsFromState();
    refreshInventory();
    showFeedback(`Caught ${kind}!`, 'gain');
  };

  // THE CARRIED TRAP'S PLACEMENT COMPOSITION (the trap
  // chunk, 2026-11-01): ONE composition for both doors
  // (the craft confirm's Yes and the armed placement's
  // confirm). The site facts are composed shell-side in
  // Systems' SiteFacts shape — her feet's water fact and
  // the AIM's water fact, both from Background's adapter;
  // the grant's own reading rule (effectiveInWater)
  // prefers the aim, per the placement ruling. Systems'
  // placeCarriedTrap is the SINGLE placement gate
  // (ruling (B)): it validates and consumes; only on its
  // success does the shell seat the trap via the plain
  // trapState.placeTrap. A refusal leaves the trap in her
  // pack and its reason is the caller's to speak.
  const composePlaceCarriedTrap = (
    trapType: string,
    target: { x: number; z: number },
  ): { ok: true } | { ok: false; reason: string } => {
    const player = playerRef.current;
    const gen = genRef.current;
    if (!player || !gen) return { ok: false, reason: 'Placement failed.' };
    const site = {
      inWater: siteWaterFacts(gen, player.x, player.z).inWater,
      aimedInWater: siteWaterFacts(gen, target.x, target.z).inWater,
    };
    const outcome = placeCarriedTrap(inventory, trapType, site);
    if (outcome.placed === false) {
      return { ok: false, reason: outcome.reason };
    }
    trapState.placeTrap(trapType as TrapType, target.x, target.z);
    return { ok: true };
  };

  // PICK UP A SET CARRYABLE (the trap chunk): Systems'
  // pickupTrap grants through addPartial — a pack that
  // cannot take the weight refuses and the trap STAYS
  // set; the shell removes it from trap state only on a
  // successful pick-up. Copy DRAFT.
  const handlePickupTrap = (trapId: string) => {
    const trap = trapState.get(trapId);
    if (!trap) return;
    const outcome = pickupTrap(inventory, trap.type);
    if (outcome.picked === false) {
      showFeedback(outcome.reason, 'blocked');
      return;
    }
    trapState.removeTrap(trapId);
    refreshTrapsFromState();
    refreshInventory();
    saveNow();
    showFeedback(
      `Picked up the ${TRAP_DEFS[trap.type].name}.`,
      'gain',
    );
  };

  // DISMANTLE A SET DEADFALL (the trap chunk; Adam's
  // rule — removed, yields NOTHING: the logs were never
  // hers to keep). Systems' dismantleTrap is the gate;
  // the shell removes via removeTrap on its success.
  // THE CATCH WAITS (DEV's ruling on the claim,
  // 2026-11-01 — the pitfall-fill precedent): a catch
  // is never destroyed as a side effect of a structural
  // verb, so while the deadfall holds one, Dismantle
  // refuses and Collect — its own standing door — goes
  // first. The player chooses the loss or takes the
  // catch; the verb never chooses for them. Copy DRAFT.
  const handleDismantleTrap = (trapId: string) => {
    const trap = trapState.get(trapId);
    if (!trap) return;
    if (trap.catch !== null) {
      showFeedback('Collect the catch first.', 'blocked');
      return;
    }
    const outcome = dismantleTrap(trap.type);
    if (outcome.dismantled === false) {
      showFeedback(outcome.reason, 'blocked');
      return;
    }
    trapState.removeTrap(trapId);
    refreshTrapsFromState();
    saveNow();
    showFeedback('Dismantled. Nothing to keep.', 'info');
  };

  // THE TRAP'S SECOND ACT (the trap chunk): the faced
  // trap's R door and its pill row's second button run
  // this one routing — a set carryable picks up, a set
  // deadfall dismantles, the pitfall gets neither (it
  // fills in; that lifecycle is its own piece).
  const handleTrapSecondAct = (trapId: string) => {
    const trap = trapState.get(trapId);
    if (!trap) return;
    if (isCarryableTrap(trap.type)) {
      handlePickupTrap(trapId);
    } else if (trap.type === ITEMS.deadfall) {
      handleDismantleTrap(trapId);
    }
  };

  // THE GRIMOIRE'S SEAT (the desk build, 2026-11-01):
  // Systems' grants decide against a DeskSeat view of
  // the entity; the shell flips the entity through
  // deskState.setGrimoire ONLY on a grant's success, so
  // the visible book can never lie about the seat.
  // Refusals speak verbatim; the success lines are
  // DRAFT for Adam's pin pass.
  const handleDeskAct = (deskId: string) => {
    const desk = deskState.get(deskId);
    if (!desk) return;
    if (desk.grimoire === true) {
      const outcome = takeGrimoire(inventory, { grimoire: true });
      if (outcome.taken === false) {
        showFeedback(outcome.reason, 'blocked');
        return;
      }
      deskState.setGrimoire(deskId, false);
      refreshInventory();
      saveNow();
      showFeedback('Took the grimoire back.', 'gain');
      return;
    }
    const outcome = seatGrimoire(inventory, {});
    if (outcome.seated === false) {
      showFeedback(outcome.reason, 'blocked');
      return;
    }
    deskState.setGrimoire(deskId, true);
    refreshInventory();
    saveNow();
    showFeedback('The grimoire rests on the desk.', 'info');
  };

  // The desk's second act (the read gate): Read at a
  // seated desk opens the tally panel — the linked-
  // books law's one door, now a camp act. A bare desk
  // has no second act.
  const handleDeskRead = (deskId: string) => {
    if (deskState.get(deskId)?.grimoire === true) {
      openJournalPanel();
    }
  };

  // THE SHREW'S WAKE DOOR (2026-11-01): the charm
  // path's shell surface. The verb stands on every
  // carried skull — the grant decides, and a spare
  // skull after the waking hears its refusal verbatim
  // ('The shrew already stands woken.'). On success
  // the shell runs the rite's own bookkeeping (the
  // completion check's sync set) and speaks the
  // rite's own line form; refreshInventory carries
  // syncShrewEffect, so the woken warning starts now.
  const handleWakeItem = (id: string) => {
    if (id !== FIRST_CHARM_ITEM) return;
    const outcome = wakeShrewFromBone(inventory, charmStateRef.current);
    if (outcome.woke === false) {
      showFeedback(outcome.reason, 'blocked');
      return;
    }
    syncCharmHooks();
    syncCrowTier();
    syncCharmBonuses();
    syncDeerWarning();
    refreshInventory();
    saveNow();
    showFeedback(`The ${boneDisplayFor(FIRST_CHARM_KIND)} awakens.`, 'gain');
  };

  // The pack rows' Read verb (the read gate): the
  // journal opens its panel anywhere; the grimoire
  // carried speaks the desk rule — transport only.
  const handleReadItem = (id: string) => {
    if (id === ITEMS.grimoire) {
      showFeedback('The grimoire is read at its desk.', 'blocked');
      return;
    }
    openJournalPanel();
  };

  // UNIQUENESS, OUT OF PACK (Systems' ask, the desk
  // build): the grimoire SEATED on any desk counts as
  // owned for the listed-single law, so its recipe
  // reads already-owned while the book rests — the
  // shell passes the set into canCraft / executeCraft
  // / executeCraftChain at every call.
  const grimoireOutOfPack = (): ReadonlySet<string> | null =>
    deskState.snapshot().some((desk) => desk.grimoire === true)
      ? new Set<string>([ITEMS.grimoire])
      : null;

  // THE CARRYABLE CONFIRM'S TWO DOORS (the trap chunk):
  // Yes places the just-crafted trap at the crosshair
  // aim (the placement law) through the one composition;
  // a refusal speaks and the trap stays in her pack,
  // where the craft put it. No keeps it packed — the
  // craft note already told her it was made.
  const handleCarriedTrapPlaceYes = () => {
    const trapType = pendingCarriedTrap;
    setPendingCarriedTrap(null);
    if (!trapType) return;
    const target = aimedPlacementPoint();
    if (target === null) {
      showFeedback('Nowhere to set it down.', 'blocked');
      return;
    }
    const outcome = composePlaceCarriedTrap(trapType, target);
    if (outcome.ok === false) {
      showFeedback(outcome.reason, 'blocked');
      return;
    }
    refreshTrapsFromState();
    refreshInventory();
    saveNow();
    showFeedback(
      `Set the ${TRAP_DEFS[trapType as TrapType].name}.`,
      'gain',
    );
  };

  const handleCarriedTrapKeep = () => {
    setPendingCarriedTrap(null);
  };

  // HIVE HARVEST (Adam, 2026-10-28): ONE harvest per
  // press (hive coords — hives carry no ids). Too-hungry
  // refuses at the interaction layer (Systems owns no
  // hunger gate in harvestHoney): the honest error,
  // not a silent no-op (the engine's own 'Harvest
  // failed: too-hungry.' wording), and NO Systems call.
  // Else Systems' harvestHoney decides: torch-first
  // refusal verbatim, pack-full expanded trap-style,
  // success grants + refreshes + saves. The hive stays
  // in both refusal cases (no depletion, repeatable) —
  // no hive state to re-read (world-gen, not state),
  // so a repeat press re-tries.
  const handleHarvestHive = (x: number, z: number) => {
    if (hungerStage === 'too-hungry') {
      showFeedback('Harvest failed: too-hungry.', 'blocked');
      return;
    }
    const outcome = harvestHoney(inventory, placedTorchNearHive(x, z));
    if (outcome.granted === 1) {
      refreshInventory();
      saveNow();
      showFeedback('Harvested honey!', 'gain');
      return;
    }
    showFeedback(outcome.reason === 'Pack full.'
        ? `Pack full — no room for ${displayNameFor(ITEMS.honey)}.`
        : (outcome.reason ?? 'Harvest failed.'),
      'blocked',
    );
  };

  const handleWear = (garment: WornGarment) => {
    const def = GARMENTS.find((g) => g.backgroundId === garment);
    if (!def) return;
    try {
      wardrobe.wear(inventory, def.item);
      inventory.setWorn(wardrobe.wornItemIds());
      setWornGarments(wardrobe.wornGarments());
      setWardrobeNote(null);
    } catch (error) {
      setWardrobeNote(
        error instanceof Error ? error.message : 'Could not wear that.',
      );
    }
    refreshInventory();
    saveNow();
  };

  const handleRemoveGarment = (garment: WornGarment) => {
    const def = GARMENTS.find((g) => g.backgroundId === garment);
    if (!def) return;
    wardrobe.remove(def.slot);
    inventory.setWorn(wardrobe.wornItemIds());
    setWornGarments(wardrobe.wornGarments());
    setWardrobeNote(null);
    refreshInventory();
    saveNow();
  };

  // PLACE REACH (Adam's crosshair ruling, 2026-10-31):
  // how far from her the crosshair may set a thing down.
  // A gaze landing past it CLAMPS to the circle along
  // the ray — the press is never wasted. DRAFT: 6 m,
  // the torch light's own plenty-bright distance; Adam's
  // pin pass settles it. One reach for the whole instant
  // family (torch, campfire, tent — the fold-in ruling,
  // 2026-10-31).
  const PLACE_REACH = 6;

  // The aimed placement point: the crosshair's ground
  // point, clamped to PLACE_REACH along the ray. Null
  // when the gaze never meets the ground — each act
  // voices its own refusal on its own surface, in the
  // family's one line ('Nowhere to set it down.').
  const aimedPlacementPoint = (): { x: number; z: number } | null => {
    const player = playerRef.current;
    if (!player) return null;
    const aim = crosshairAimPoint();
    if (aim === null) return null;
    const dx = aim.x - player.x;
    const dz = aim.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance > PLACE_REACH) {
      return {
        x: player.x + (dx / distance) * PLACE_REACH,
        z: player.z + (dz / distance) * PLACE_REACH,
      };
    }
    return aim;
  };

  /**
   * Placing a carried lit torch: INSTANT AT THE CROSSHAIR
   * (Adam, 2026-10-31: "the torch lands where she aims,
   * if it's not too far away" — nobody places anything
   * between their feet; this supersedes the at-feet
   * landing the torch completion shipped with). The aim
   * is the screen-center ray's ground point (the same
   * camera model the anchors project with). A ray that
   * never meets the ground refuses ('Nowhere to set it
   * down.', DRAFT) — but only when she actually carries a
   * torch; empty-handed, the grant's own refusal speaks
   * (the aim is not the truer refusal then). A landing
   * past PLACE_REACH clamps to the reach circle
   * along the ray. Grant FIRST (Systems placeTorch
   * consumes one carried lit-torch; failure touches
   * nothing), then the entity place (Background
   * primitive, emits torch:placed → refreshTorches).
   * ONE CORE, THREE HANDLES (Adam's torch completion,
   * 2026-10-31): the inventory panel's Place button (its
   * note carries the result — a panel action; she aims
   * before opening the pack), the desktop right-click in
   * the locked world, and the touch PLACE button (both
   * speak through the message feed). The act is identical
   * behind all three; only the result's surface differs,
   * as the pickup's does.
   */
  const placeCarriedLitTorch = ():
    | { placed: true }
    | { placed: false; reason: string }
    | null => {
    const player = playerRef.current;
    if (!player) return null;
    const target = aimedPlacementPoint();
    if (target === null && inventory.count(ITEMS.litTorch) > 0) {
      return { placed: false, reason: 'Nowhere to set it down.' };
    }
    // Aim null + empty-handed falls back to her feet as
    // the target — the grant refuses below and nothing
    // is consumed, so the fallback never lands.
    const outcome = grantPlaceTorch(
      inventory,
      target?.x ?? player.x,
      target?.z ?? player.z,
    );
    // Equality check, not truthiness: non-strict tsc does
    // not narrow this union's boolean discriminant on
    // truthiness (see the torch Light button handler).
    if (outcome.placed === false) {
      return { placed: false, reason: outcome.reason };
    }
    torchState.placeTorch(outcome.torch.x, outcome.torch.z);
    refreshInventory();
    saveNow();
    return { placed: true };
  };

  const handlePlaceLitTorch = () => {
    const result = placeCarriedLitTorch();
    if (!result) return;
    // Equality check, not truthiness (non-strict tsc does
    // not narrow the union on the ternary — house pattern).
    if (result.placed === false) {
      setTorchNote(result.reason);
      return;
    }
    setTorchNote('Placed a lit torch.');
  };

  // The world doors' press (right-click, touch PLACE):
  // same core, the feed carries the result — a world
  // press is never a silent no-op (the hive lesson).
  const handleWorldPlaceTorch = () => {
    const result = placeCarriedLitTorch();
    if (!result) return;
    if (result.placed === false) {
      showFeedback(result.reason, 'blocked');
      return;
    }
    showFeedback('Placed a lit torch.', 'gain');
  };

  // PLACED TENT (tent shell, 2026-10-28 — torch
  // mirror: one press places one tent, no placement
  // mode, no ghost). AT THE CROSSHAIR since Adam's
  // fold-in ruling (2026-10-31) — the aim point serves
  // tent as it serves the torch: a groundless gaze
  // refuses on the note when a tent is carried (the
  // grant's own refusal speaks when none is), a far
  // gaze clamps to the reach. Grant FIRST
  // (Systems placeTent consumes one carried tent;
  // failure touches nothing), then the shell record
  // (Background's placed-tent entity has not landed
  // yet — the record lives in the shell store until
  // the follow-up setTents wiring hands it over).
  // Panel action, not a world action: the panel stays
  // open, the count drops, the note carries the
  // result — the torch Place shape. No hunger gate
  // (a move, like drop/pickup). No paused guard
  // (torch place has none either).
  const handlePlaceTent = () => {
    const player = playerRef.current;
    if (!player) return;
    const target = aimedPlacementPoint();
    if (target === null && inventory.count(ITEMS.tent) > 0) {
      setTentNote('Nowhere to set it down.');
      return;
    }
    const outcome = placeTent(
      inventory,
      target?.x ?? player.x,
      target?.z ?? player.z,
    );
    // Equality check, not truthiness: non-strict tsc does
    // not narrow this union's boolean discriminant on
    // truthiness (see the torch Light button handler).
    if (outcome.placed === false) {
      setTentNote(outcome.reason);
      return;
    }
    // Shell id: max tent:<n> suffix + 1 (trap
    // precedent — recomputed, never a stored counter,
    // so restores cannot collide it).
    const maxSuffix = placedTentsRef.current.reduce((max, tent) => {
      const match = /^tent:(\d+)$/.exec(tent.id);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    updatePlacedTents([
      ...placedTentsRef.current,
      { id: `tent:${maxSuffix + 1}`, x: outcome.tent.x, z: outcome.tent.z },
    ]);
    refreshInventory();
    saveNow();
    recomputeAnchors();
    setTentNote('Placed a tent.');
  };

  // PLACED SLEEPING BAG (the portable hut, 2026-11-02):
  // the tent's twin, clause for clause — one press
  // places one bag at the crosshair, grant first
  // (Systems placeBag consumes one carried bag;
  // failure touches nothing), then the shell record.
  // Panel action: the panel stays open, the count
  // drops, the note carries the result. No hunger
  // gate (a move, like drop/pickup).
  const handlePlaceBag = () => {
    const player = playerRef.current;
    if (!player) return;
    const target = aimedPlacementPoint();
    if (target === null && inventory.count(ITEMS.sleepingBag) > 0) {
      setBagNote('Nowhere to set it down.');
      return;
    }
    const outcome = placeBag(
      inventory,
      target?.x ?? player.x,
      target?.z ?? player.z,
    );
    // Equality check, not truthiness (non-strict tsc
    // does not narrow this union on truthiness).
    if (outcome.placed === false) {
      setBagNote(outcome.reason);
      return;
    }
    const maxSuffix = placedBagsRef.current.reduce((max, bag) => {
      const match = /^bag:(\d+)$/.exec(bag.id);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    updatePlacedBags([
      ...placedBagsRef.current,
      { id: `bag:${maxSuffix + 1}`, x: outcome.bag.x, z: outcome.bag.z },
    ]);
    refreshInventory();
    saveNow();
    recomputeAnchors();
    setBagNote('Placed a sleeping bag.');
  };

  // PLACED ALTAR (settled lean — instant at her feet, the
  // torch precedent; the preview ghost is the house/fire
  // pattern, heavy for a site placed where she stands).
  // Grant FIRST (Systems placeAltar consumes one carried
  // altar; failure touches nothing), then the entity place
  // (Background primitive, emits altar:placed →
  // refreshAltars). Panel action, not a world action:
  // the panel stays open, the count drops, the note
  // carries the result — the torch Place shape. No
  // hunger gate (a move, like drop/pickup). No menu
  // behind the chip: rituals are not in this order.
  const handlePlaceAltar = () => {
    const player = playerRef.current;
    if (!player) return;
    // THE CROSSHAIR LAW (Adam, 2026-11-01): the instant
    // family places at the aim too — feet placement
    // retires everywhere. A groundless gaze speaks the
    // family's line, but only when she actually carries
    // an altar (the grant's own refusal is the truer one
    // for empty hands, the campfire pattern).
    const target = aimedPlacementPoint();
    if (target === null && inventory.count(ITEMS.altar) >= 1) {
      setAltarNote('Nowhere to set it down.');
      return;
    }
    const outcome = grantPlaceAltar(
      inventory,
      target?.x ?? player.x,
      target?.z ?? player.z,
    );
    // Equality check, not truthiness: non-strict tsc does
    // not narrow this union's boolean discriminant on
    // truthiness (see the torch Light button handler).
    if (outcome.placed === false) {
      setAltarNote(outcome.reason);
      return;
    }
    altarState.placeAltar(outcome.altar.x, outcome.altar.z);
    refreshInventory();
    saveNow();
    setAltarNote('Placed an altar.');
  };

  // Writing-desk placement (desk build, 2026-10-30): the
  // altar twin — Systems' placeDesk grant consumes one
  // carried desk (failure touches nothing and the reason
  // shows), then Background's deskState.placeDesk places
  // the entity at her feet (desk:placed -> refreshDesks
  // re-projects the chip anchors). No preview flow, no
  // hunger gate (a move, like drop/pickup).
  const handlePlaceDesk = () => {
    const player = playerRef.current;
    if (!player) return;
    // THE CROSSHAIR LAW (Adam, 2026-11-01): the desk
    // leaves her feet for the aim, like its altar twin —
    // same groundless composition (the grant's refusal
    // speaks for empty hands).
    const target = aimedPlacementPoint();
    if (target === null && inventory.count(ITEMS.writingDesk) >= 1) {
      setDeskNote('Nowhere to set it down.');
      return;
    }
    const outcome = grantPlaceDesk(
      inventory,
      target?.x ?? player.x,
      target?.z ?? player.z,
    );
    // Equality check, not truthiness: non-strict tsc does
    // not narrow this union's boolean discriminant on
    // truthiness (same note as handlePlaceAltar).
    if (outcome.placed === false) {
      setDeskNote(outcome.reason);
      return;
    }
    deskState.placeDesk(outcome.desk.x, outcome.desk.z, playerRef.current?.yaw ?? 0);
    refreshInventory();
    saveNow();
    setDeskNote('Placed a writing desk.');
  };

  // Crafted-workstation placement (the fix's door,
  // 2026-11-05): the desk twin whole — Systems'
  // placeWorkstation grant consumes one carried bench
  // (failure touches nothing and the reason shows),
  // then Background's workstationState.placeWorkstation
  // seats the entity at the crosshair aim (the desk's
  // crosshair law). No hunger gate (a move, like
  // drop/pickup). Panel stays open, workstationNote
  // carries the result.
  const handlePlaceWorkstation = () => {
    const player = playerRef.current;
    if (!player) return;
    const target = aimedPlacementPoint();
    if (target === null && inventory.count(ITEMS.craftedWorkstation) >= 1) {
      setWorkstationNote('Nowhere to set it down.');
      return;
    }
    const outcome = grantPlaceWorkstation(
      inventory,
      target?.x ?? player.x,
      target?.z ?? player.z,
    );
    // Equality check, not truthiness (the desk note).
    if (outcome.placed === false) {
      setWorkstationNote(outcome.reason);
      return;
    }
    workstationState.placeWorkstation(
      outcome.workstation.x,
      outcome.workstation.z,
      playerRef.current?.yaw ?? 0,
    );
    refreshInventory();
    saveNow();
    setWorkstationNote('Placed a crafted workstation.');
  };

  // THE FACED FURNITURE (furniture-moves wiring,
  // 2026-11-05): the nearest placed bench or writing
  // desk she faces within reach — the winner cone law
  // (distance < 1 is faced outright; else the forward
  // dot beats SQRT1_2), HARVEST_RANGE cap, nearest
  // faced wins across both kinds. Read live from the
  // two entity snapshots (the loom idiom — no shell
  // mirror). One derivation, two consumers: the
  // station feed's faced-bench branch (render) and
  // the pick-up pill (render + the press re-derives).
  const facedFurniture = (): {
    kind: 'bench' | 'desk' | 'loom';
    id: string;
    pieceName: string;
  } | null => {
    const player = playerRef.current;
    if (!player) return null;
    const forwardX = Math.sin(player.facing);
    const forwardZ = Math.cos(player.facing);
    let best: {
      kind: 'bench' | 'desk' | 'loom';
      id: string;
      pieceName: string;
    } | null = null;
    let bestDistance = Infinity;
    const consider = (
      kind: 'bench' | 'desk' | 'loom',
      id: string,
      pieceName: string,
      x: number,
      z: number,
    ) => {
      const dx = x - player.x;
      const dz = z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance > HARVEST_RANGE || distance >= bestDistance) return;
      const faced =
        distance < 1 ||
        (dx * forwardX + dz * forwardZ) / distance > Math.SQRT1_2;
      if (!faced) return;
      best = { kind, id, pieceName };
      bestDistance = distance;
    };
    for (const bench of workstationState.snapshot()) {
      consider('bench', bench.id, 'Crafted Workstation', bench.x, bench.z);
    }
    for (const desk of deskState.snapshot()) {
      consider('desk', desk.id, 'Writing Desk', desk.x, desk.z);
    }
    for (const loom of loomState.snapshot()) {
      consider('loom', loom.id, 'Loom', loom.x, loom.z);
    }
    return best;
  };

  // FURNITURE PICK-UP (Adam's ruling, 2026-11-05 —
  // the rearrangement verb): the grants decide, the
  // shell removes the placed record ONLY on success.
  // Bench: Systems' pickupWorkstation (the tent
  // Take-down idiom) grants 1 when the pack can hold
  // the bench's 4 lb; a 0 is the catch law and the
  // door voices it, the bench standing. Desk:
  // pickupDesk against the faced desk's own record —
  // its refusals (the grimoire guard, the catch law)
  // arrive as words and show verbatim. A world act —
  // the feedback line voices it, no panel is open.
  // THE ONE PICK-UP ACT (the furniture-verbs build,
  // 2026-11-05 — Adam's rule: a placed thing's verbs
  // live on the thing itself): every door — the
  // piece's E menu, the crafting panel at its station
  // (K parity), the bottom-center quick pill — runs
  // THIS act against a named piece. The grants
  // decide; the shell removes the placed record ONLY
  // on success; refusals voice identically at every
  // door (the desk guard, the catch laws). True =
  // picked up (menus close); false = refused in
  // words (menus stay — she can clear the blocker
  // from the same surface, e.g. take the grimoire,
  // then pick the desk up).
  const pickupFurniturePiece = (target: {
    kind: 'bench' | 'desk' | 'loom';
    id: string;
  }): boolean => {
    if (target.kind === 'bench') {
      const outcome = pickupWorkstation(inventory);
      if (outcome.granted !== 1) {
        showFeedback('No room in the pack for it.', 'blocked');
        return false;
      }
      workstationState.removeWorkstation(target.id);
      refreshInventory();
      saveNow();
      showFeedback('Picked up the crafted workstation.', 'gain');
      return true;
    }
    if (target.kind === 'loom') {
      const outcome = pickupLoom(inventory);
      if (outcome.granted !== 1) {
        showFeedback('No room in the pack for it.', 'blocked');
        return false;
      }
      loomState.removeLoom(target.id);
      refreshInventory();
      saveNow();
      showFeedback('Picked up the loom.', 'gain');
      return true;
    }
    const desk = deskState.get(target.id);
    if (!desk) return false;
    const outcome = pickupDesk(inventory, desk);
    // Equality check, not truthiness (the desk note).
    if (outcome.taken === false) {
      showFeedback(outcome.reason, 'blocked');
      return false;
    }
    deskState.removeDesk(target.id);
    refreshInventory();
    saveNow();
    showFeedback('Picked up the writing desk.', 'gain');
    return true;
  };

  const handlePickupFurniture = () => {
    const target = facedFurniture();
    if (!target) return;
    pickupFurniturePiece(target);
  };

  // Cauldron placement (placed-cauldron build, 2026-10-30):
  // the one placeable whose target is another placed
  // object — the pot goes ON a hearth. The target hearth
  // is the faced fire winner read as a hearth (facing the
  // pot itself reads its hearth too, so the grant's
  // occupied refusal answers there); not facing a hearth
  // passes '' and the grant's 'No hearth there.' is the
  // answer she sees. Grant FIRST (Systems placeCauldron
  // consumes one carried cauldron; failure touches
  // nothing), then Background's cauldronState binds the
  // entity to the hearth (no coordinates passed — the
  // binding resolves the position). No lit gate: she
  // sets the pot before she lights the hearth. Panel
  // stays open, cauldronNote carries the result.
  const handlePlaceCauldron = () => {
    const winner = useWinnerRef.current;
    let hearthId = '';
    if (winner?.kind === 'fire') {
      const fire = fireState.get(winner.id);
      if (fire?.type === 'hearth') hearthId = winner.id;
    } else if (winner?.kind === 'cauldron') {
      hearthId = winner.id;
    }
    const outcome = grantPlaceCauldron(
      inventory,
      hearthId,
      cauldronState.cauldronForHearth(hearthId) !== undefined,
    );
    if (outcome.placed === false) {
      setCauldronNote(outcome.reason);
      return;
    }
    cauldronState.placeCauldron(outcome.cauldron.hearthId);
    refreshInventory();
    saveNow();
    setCauldronNote('Placed a cauldron on the hearth.');
  };

  // RITUAL SKY FACTS (shell supplies, systems never imports
  // game): phase from cyclePhase at the world's fixed start
  // month (the renderer feeds the sky SEASON_START_MONTH,
  // so this matches the rendered sky exactly) + moonPhase
  // from currentMoonPhase at the live daysElapsed. Null
  // when no live sky exists (pre-boot) — the completion
  // check skips then; a full-moon window on an unknown sky
  // reads closed (Systems' safe default, null moonPhase).
  const skyFacts = (): SkyFacts | null => {
    const sky = rendererRef.current?.snapshotSky();
    if (!sky) return null;
    return {
      phase: cyclePhase(sky.cycleT, SEASON_START_MONTH),
      moonPhase: currentMoonPhase(genRef.current.seed, sky.daysElapsed ?? 0),
    };
  };

  // Bone display spelling: kind keys are shape slugs as
  // displayed after 'Primal Bone - ' (charms.ts rule) —
  // the slug with spaces is the display name, not a new
  // id (flagged presentation call, UI's).
  const boneDisplayFor = (kind: string): string =>
    `Primal Bone - ${kind.replace(/-/g, ' ')}`;

  // Companion kind label: the capitalized kind (the
  // AnimalTag precedent — no name table invented). One
  // helper: the panel rows and the rite's copy read the
  // same spelling.
  const companionKindLabel = (kind: string): string =>
    kind.length > 0 ? kind.charAt(0).toUpperCase() + kind.slice(1) : kind;

  // Charm-list rows for the examination panel (charm-list
  // build, Systems 9e9a9dd): listCharms is the examination
  // contract — kind + tier + note in awakening order;
  // App maps kind to its display name. Derived live each
  // render, so the panel always opens on the current list.
  // COMPANIONS DOOR RULE (build 1, 2026-10-31): the door
  // exists only while a bonded companion stands. The
  // panel's rows are the bonded records, shaped for the
  // component (kind label = the capitalized kind, the
  // AnimalTag precedent — no name table invented).
  const bondedCompanions = companionRecords.filter(
    (record) => record.bond !== 'none',
  );
  const hasBondedCompanion = bondedCompanions.length > 0;
  // THE JOURNAL'S DOOR FACT (dialog audit #4, Adam's
  // release 2026-11-01: 'Once she makes a journal, J for
  // journal, and a button'): the J key and the Journal
  // buttons exist only while she CARRIES the journal —
  // the same item fact the transcribe gate reads. No
  // journal, no door, nothing teased.
  const hasJournalItem = inventory.count(ITEMS.journal) >= 1;
  // THE ROSTER'S GROUPS (the roster dialog, 2026-11-07;
  // Adam's design of 2026-11-05): her company grouped by
  // KIND with counts, stamped from Systems' rosterList
  // (the composed read — the record's facts plus the
  // release ladder's effect per row). The shell keeps
  // the roster's STANDING door rule: the page lists the
  // BONDED company (an unbonded courtship speaks at the
  // animal, never in the book), so bond-'none' rows are
  // filtered here. Groups compose in record order
  // (first-met kind first), and within a kind THE
  // FAMILIAR LEADS (Build 2, Piece 4's law, kept): the
  // sort is stable, so the rest keep record order behind
  // it (at most one familiar can stand). One composition,
  // stamped once per render: the N door and the journal's
  // Companions page render the SAME groups through the
  // one RosterPanel — one row source, two doors. The
  // whereabouts projection is NOT supplied in this cut
  // (it rides the follow cut), so rows carry its null —
  // the record alone cannot say, and the panel shows
  // no whereabouts line for it.
  const rosterGroups: RosterKindGroup[] = [];
  {
    const byKind = new Map<string, RosterRow[]>();
    const rosterRows: SystemsRosterRow[] =
      companionStateRef.current.rosterList(
        rendererRef.current?.snapshotSky()?.daysElapsed ?? 0,
      );
    for (const record of rosterRows) {
      if (record.bond === 'none') continue;
      const row: RosterRow = {
        creatureId: record.creatureId,
        kindLabel: companionKindLabel(record.kind),
        bond: record.bond as 'companion' | 'familiar',
        stance: record.stance,
        trust: record.trust,
        releaseEffect: record.releaseEffect,
        isCat: record.kind === 'cat',
      };
      const rows = byKind.get(record.kind);
      if (rows) rows.push(row);
      else byKind.set(record.kind, [row]);
    }
    for (const [kind, rows] of byKind) {
      rows.sort(
        (a, b) =>
          (a.bond === 'familiar' ? 0 : 1) - (b.bond === 'familiar' ? 0 : 1),
      );
      rosterGroups.push({
        kind,
        kindLabel: companionKindLabel(kind),
        count: rows.length,
        rows,
      });
    }
  }
  // THE HUNT NOTE (Piece 3): while the cat is out, its
  // panel row says so — a live read of the engine actor
  // composed over the notes map (renders tick with her
  // movement, so the note keeps pace with the hunt). It
  // overrides a theater line on the same row: the fact
  // of the hunt outranks the joke until the cat is back.
  const catActorNow = catActor();
  const companionPanelNotes =
    catActorNow !== null && catActorNow.hunt.phase !== 'none'
      ? { ...companionNotes, [CAT_ID]: 'Out hunting' }
      : companionNotes;
  const charmEntries = listCharms(charmStateRef.current).map((charm) => ({
    ...charm,
    display: boneDisplayFor(charm.kind),
  }));
  // The journal's Charms rows — the SAME entries,
  // re-keyed to the book's row shape (display -> name).
  // One row source, two doors, by construction (the
  // toggles build, 2026-11-06): the panel and the book
  // can never disagree about a charm's switch.
  // NEWEST (charms): awakening order is all the book
  // records — no day — so Newest reverses it
  // (order-only, as priced). The Charms PANEL keeps
  // the standing order in both states: the sort is
  // the book's control, not the panel's.
  const journalCharmRows = (
    journalSortOrder === 'newest'
      ? [...charmEntries].reverse()
      : charmEntries
  ).map((charm) => ({
    kind: charm.kind,
    name: charm.display,
    tier: charm.tier,
    note: charm.note,
    enabled: charm.enabled,
  }));

  // PANEL FAMILY (Adam, 2026-10-29: the three HUD
  // panels SWAP — "switch out without any further
  // intervention"): Inventory / Crafting / Charms are
  // a radio family. Opening one closes the other two;
  // the toggles close the open one. Keys and both
  // button rows all ride these helpers, so the rule
  // holds however a panel is opened. Options is NOT
  // in the family — it overlays (its own door + the
  // modal guards), never swapped out, never swapped
  // in by a panel key.
  const openInventoryPanel = () => {
    // STORAGE BINDING (hut storage): the dialog binds
    // the house she is sheltered in AT OPEN — or no
    // house (the plain pack). Written here and nowhere
    // else, so every door (I, the touch button, the
    // doors row, the home menu's Storage row) opens
    // the same dialog on the same house.
    setStorageHouseId(
      sheltered && shelterHouseId !== null ? shelterHouseId : null,
    );
    setInventoryOpen(true);
    setCraftingOpen(false);
    setCharmsOpen(false);
    setCompanionsOpen(false);
    setJournalOpen(false);
  };
  // THE FIRE DIALOG (Adam's two-tab ruling, 2026-11-01):
  // the LIT KILN alone trades its anchored menu for the
  // dialog — Fire and Craft doors in one seat, context
  // fixed at open, leash-closed like every context. E
  // opens on the Fire door, K on the Craft door; every
  // other fire (and the unlit kiln) keeps today's menu.
  const isLitKiln = (fire: PlacedFire): boolean =>
    fire.type === 'kiln' && fire.lit;
  const openFireContext = (
    fire: PlacedFire,
    door: 'fire' | 'craft',
  ) => {
    setCraftContextSiteId(`fire:${fire.id}`);
    setCraftDoor(door);
    setCraftingOpen(true);
    setInventoryOpen(false);
    setCharmsOpen(false);
    setCompanionsOpen(false);
    setJournalOpen(false);
  };
  // E / the fire chip at any fire: the lit kiln goes to
  // its dialog; everything else selects the anchored
  // menu, exactly as before.
  const openFireDoor = (fire: PlacedFire) => {
    if (isLitKiln(fire)) openFireContext(fire, 'fire');
    else setSelectedFireId(fire.id);
  };
  const openCraftingPanel = () => {
    // THE FOLD: opening the dialog while a stump (plain
    // or made altar) is her faced winner attaches that
    // stump as the dialog's context, doors and all. The
    // press-specific openers (E at a stump, its chip)
    // set the same context directly. Any other opening
    // leaves the context null — the plain dialog.
    if (
      useWinner?.kind === 'site' &&
      useWinner.siteId.startsWith('stump:')
    ) {
      setCraftContextSiteId(useWinner.siteId);
      setCraftDoor('craft');
    }
    // K at the lit kiln: the same dialog, Craft door
    // first (the fire ruling's second tab).
    if (useWinner?.kind === 'fire') {
      const fire = placedFires.find((f) => f.id === useWinner.id);
      if (fire !== undefined && isLitKiln(fire)) {
        setCraftContextSiteId(`fire:${fire.id}`);
        setCraftDoor('craft');
      }
    }
    setCraftingOpen(true);
    setInventoryOpen(false);
    setCharmsOpen(false);
    setCompanionsOpen(false);
    setJournalOpen(false);
  };
  // E / touch USE / the name chip at a stump: open the
  // dialog on that stump's context, Craft door first.
  const openStumpContext = (siteId: string) => {
    setCraftContextSiteId(siteId);
    setCraftDoor('craft');
    openCraftingPanel();
  };
  const toggleInventoryPanel = () => {
    if (inventoryOpen) setInventoryOpen(false);
    else openInventoryPanel();
  };
  const toggleCraftingPanel = () => {
    if (craftingOpen) setCraftingOpen(false);
    else openCraftingPanel();
  };
  const toggleCharmsPanel = () => {
    if (charmsOpen) setCharmsOpen(false);
    else openCharmsPanel();
  };
  const toggleCompanionsPanel = () => {
    if (companionsOpen) setCompanionsOpen(false);
    // THE DOOR FACT, INHERITED BY THE KEY (2026-11-06):
    // closing is never gated; opening needs a bonded
    // companion — the panel's door exists only while
    // she has one (the button rows render on the same
    // fact). The gate lives here, read live off the
    // state ref, so every door — the buttons and the
    // N key alike — inherits it, the journal's
    // toggle pattern exactly.
    else if (
      companionStateRef.current
        .snapshot()
        .some((record) => record.bond !== 'none')
    ) {
      openCompanionsPanel();
    }
  };
  // The journal's toggle (dialog audit #4): closing is
  // never gated; opening needs the carried journal (the
  // gate lives here so every door — J, both button rows —
  // inherits it, and a journal dropped mid-session takes
  // its doors with it). The count is read live off the
  // inventory instance, so the key handler's closure can
  // never hold a stale gate.
  const toggleJournalPanel = () => {
    if (journalOpen) setJournalOpen(false);
    else if (inventory.count(ITEMS.journal) >= 1) openJournalPanel();
  };
  const openCompanionsPanel = () => {
    setCompanionsOpen(true);
    setInventoryOpen(false);
    setCraftingOpen(false);
    setCharmsOpen(false);
    setJournalOpen(false);
  };
  // The journal's door (First-Fragment Presentation):
  // the Read verb on her journal / grimoire rows — the
  // linked-books law makes them one door. A radio
  // member: opening it closes its siblings.
  const openJournalPanel = () => {
    setJournalOpen(true);
    setInventoryOpen(false);
    setCraftingOpen(false);
    setCharmsOpen(false);
    setCompanionsOpen(false);
  };

  // COMPANION ACTS (build 1, 2026-10-31): the panel's
  // three verbs against Systems' CompanionState. Every
  // act refreshes the mirror and saves — the state is
  // the record; the panel only ever reads the mirror.
  const refreshCompanions = () => {
    setCompanionRecords(companionStateRef.current.snapshot());
  };
  // CAT PROVISIONING (Build 2, Piece 3): the shell's
  // half of the hunt — Systems' catch data installed as
  // the engine's table, the home/sleep facts installed
  // as its probes (the boot effect installs both), and
  // the delivery events answered by the boot listeners.
  // Until the installs run the engine is armed but
  // dark, by design.
  //
  // THE HOMED HOUSE (the reading, named): the house she
  // is sheltered at when she is at one; else her sole
  // house when exactly one stands; else none. No homed
  // flag or last-slept record exists in the save — the
  // pin pass can settle a truer fact later; this
  // reading never invents one.
  const homedHouse = () => {
    const player = playerRef.current;
    if (!player) return null;
    const houses = shelterState.snapshot();
    const shelteredId = shelterAt(player.x, player.z, houses).houseId;
    if (shelteredId) {
      return houses.find((house) => house.id === shelteredId) ?? null;
    }
    return houses.length === 1 ? houses[0] : null;
  };
  // THE SLEEP WINDOW (the reading, named): sleep itself
  // is instant (request → dawn jump), so no asleep
  // state spans any steps for a probe to read. The
  // window reported here is the night she spends AT
  // her home house — sheltered there while the sky is
  // night — the only home-night the game has.
  const catSleepingAtHome = (): boolean => {
    const player = playerRef.current;
    const home = homedHouse();
    if (!player || !home) return false;
    if (
      shelterAt(player.x, player.z, shelterState.snapshot()).houseId !==
      home.id
    ) {
      return false;
    }
    const sky = rendererRef.current?.snapshotSky();
    if (!sky) return false;
    return cycleSplit(sky.cycleT, SEASON_START_MONTH).isDay === false;
  };
  // Systems' catch set is the authority, and since
  // Systems' cleanup (5c8143f) it names PREY KINDS
  // verbatim ('fish', 'mice', 'voles' — roster kinds,
  // colonies included), so this adapter is a
  // pass-through now: the kinds read directly, and
  // the carcass derives through trap-catch's
  // catchItemFor — the ONE kind->carcass authority,
  // whose colony mappings are already native. The
  // inversion + colony alias table this function used
  // to carry retired whole with the cleanup. The
  // cast stays as the seam: the kinds ride Systems'
  // strings, and a named kind the roster hasn't grown
  // yet simply never matches live prey until it does.
  const buildCatCatchTable = (): CatCatchTable => ({
    kinds: provisioningCatchesFor('cat') as AnimalKind[],
    itemFor: (kind) => catchItemFor(kind),
    // The mouth prop: a vole rides the mouse prop as
    // a DRAFT stand-in (DEV-approved; Models may add
    // a true vole).
    propFor: (kind) =>
      kind === 'fish'
        ? 'fish'
        : (kind as string) === 'mouse' ||
            (kind as string) === 'mice' ||
            (kind as string) === 'vole' ||
            (kind as string) === 'voles'
          ? 'mouse'
          : null,
  });
  // THE CAT'S LINES (Adam, 2026-10-31 — the theater):
  // a stance press at a cat comes back with Systems'
  // typed 'cat' refusal, and the panel plays one of
  // these, rolled per press. DRAFT wording.
  const CAT_NONCOMPLIANCE_LINES = [
    'The cat looks away.',
    'The cat grooms a paw.',
    'The cat saunters off, hunting.',
    'The cat slow-blinks.',
  ];
  const rollCatLine = (): string =>
    CAT_NONCOMPLIANCE_LINES[
      Math.floor(Math.random() * CAT_NONCOMPLIANCE_LINES.length)
    ];
  // RUNTIME DRIVING (Piece B, 2026-10-31): a stance the
  // record accepts also reaches the living body —
  // Background's companion runtime — directly (the
  // torchState precedent: the shell imports game
  // modules). 'come' is the runtime's one-shot recall;
  // 'stay'/'follow' set its standing stance. The cat
  // never reaches the runtime (Systems refuses first;
  // the registry never holds one). The runtime answers
  // its own changes on 'companion:stance', which the
  // boot listeners persist back through Systems — a
  // completed come lands in the record as 'follow'
  // there, not here.
  const driveCompanionRuntime = (
    creatureId: string,
    stance: CompanionStance,
  ) => {
    const record = companionStateRef.current.recordFor(creatureId);
    if (!record || record.kind === 'cat') return;
    if (stance === 'come') runtimeComeHere(creatureId);
    else runtimeSetStance(creatureId, stance);
  };
  const handleCompanionStance = (
    creatureId: string,
    stance: CompanionStance,
  ) => {
    const result = companionStateRef.current.setStance(creatureId, stance);
    if (result.ok === false && result.code === 'cat') {
      setCompanionNotes((current) => ({
        ...current,
        [creatureId]: rollCatLine(),
      }));
      return;
    }
    if (result.ok === true) {
      setCompanionNotes((current) => {
        const next = { ...current };
        delete next[creatureId];
        return next;
      });
      refreshCompanions();
      saveNow();
      driveCompanionRuntime(creatureId, stance);
    }
    // 'unknown' / 'unbonded' cannot arise from the
    // panel (its rows are bonded records) — no line is
    // invented for an impossible code.
  };
  const handleCompanionStanceAll = (stance: CompanionStance) => {
    let catPresent = false;
    for (const record of companionStateRef.current.snapshot()) {
      if (record.bond === 'none') continue;
      if (record.kind === 'cat') {
        catPresent = true;
        continue;
      }
      companionStateRef.current.setStance(record.creatureId, stance);
      driveCompanionRuntime(record.creatureId, stance);
    }
    setCompanionAllNote(catPresent ? rollCatLine() : null);
    refreshCompanions();
    saveNow();
  };
  const handleCompanionRelease = (creatureId: string) => {
    // THE RELEASE ACT (the roster build, 2026-11-07):
    // the panel's two-press AND the faced act route
    // through Systems' releaseFromRoster — the
    // STEP-DOWN LADDER (Adam's law: 'Releasing a
    // familiar makes it a companion. Releasing a
    // companion lets it loose.'). Raw release() keeps
    // its removal contract for its internal riders
    // (the departed-clear), never for this act.
    const result = companionStateRef.current.releaseFromRoster(creatureId);
    if (!result.ok) return;
    if (result.effect === 'demoted') {
      // A demote runs NO departure: the record stands,
      // the animal stays — a companion now, its trust
      // seated at the bond line by Systems' seat. THE
      // CAT is the one engine fact to sync: the found
      // familiar steps down to attending (its bond
      // follows the record, as at boot).
      if (result.record.kind === 'cat') setCatBond('attending');
      refreshCompanions();
      saveNow();
      return;
    }
    const removed = result.record;
    // The shell speaks for Systems' return on the bus
    // (the emitter-layering rule): the runtime hears
    // the release and starts the departure leg. Its
    // 'companion:departed' answer is met by the boot
    // listener with Systems' idempotent clear. THE CAT
    // is the exception (Piece 2): a found one does not
    // depart — it returns to its hearth seat (Systems'
    // law), the registry never held it, and no
    // departure leg exists for it, so no released emit;
    // its engine bond simply goes home.
    if (removed.kind === 'cat') {
      setCatBond('hearth');
    } else {
      bus.emit('companion:released', { id: creatureId });
    }
    refreshCompanions();
    saveNow();
    // The last bond going closes the panel — its door
    // is gone with the list it would show.
    const anyBonded = companionStateRef.current
      .snapshot()
      .some((record) => record.bond !== 'none');
    if (!anyBonded) setCompanionsOpen(false);
  };

  // THE NAME GATE (Piece B, 2026-10-31 — Adam's bones
  // ruling via DEV): SPEAK's predicate is the name
  // chain's own fact — the kind stands awakened, its
  // true name in her journal. Each entry is the kind's
  // own Waking bone (Systems' RITUAL_RECIPES set — 21
  // since the bones-for-the-boneless landings; squirrel
  // joined last on Adam's yes, keyed 'squirrel-tail-bone'
  // exactly as Systems registered it).
  const BONE_KIND_FOR_ANIMAL: Readonly<Record<string, string>> = {
    squirrel: 'squirrel-tail-bone',
    rabbit: 'rabbit-jaw',
    muskrat: 'muskrat-tail',
    mouse: 'mouse-spine',
    vole: 'vole-skull',
    groundhog: 'groundhog-tooth',
    opossum: 'opossum-crest',
    raccoon: 'raccoon-tooth',
    beaver: 'beaver-incisor',
    deer: 'deer-antler-tip',
    fox: 'fox-femur',
    wolf: 'wolf-tooth',
    bear: 'bear-claw',
    crow: 'crow-beak',
    owl: 'owl-talon',
    snake: 'snake-vertebra',
    turtle: 'turtle-shell-fragment',
    pigeon: 'pigeon-wing-bone',
  };
  const companionNameKnown = (kind: string): boolean => {
    const boneKind = BONE_KIND_FOR_ANIMAL[kind];
    return (
      boneKind !== undefined &&
      charmStateRef.current.isAwakened(boneKind)
    );
  };

  // THE FACED VERBS (Piece B, 2026-10-31): the winner
  // race's creature candidacy and the one act behind
  // both the pill and E. Candidacy is NARROW — a verb
  // must be live, or the animal is ambience and never
  // a target: a fish is SNATCH; a bond-ready record is
  // SPEAK; a feedable kind she carries food for is
  // OFFER (the first diet item she holds is the
  // offering — diet order is the pick order). A bonded
  // companion is the panel's, never the pill's.
  type CreatureVerb = 'offer' | 'speak' | 'snatch';
  // PERCH GATE (DEV, 2026-10-31): the height at which a
  // squirrel is up a trunk, out of hand's reach — above
  // it, no OFFER. DRAFT: 1.2 m, DEV's figure from
  // Background's climb landing (the feed now carries y).
  const PERCH_Y = 1.2;
  const creatureVerbFor = (animal: {
    id: string;
    kind: string;
    y?: number;
  }): { verb: CreatureVerb; item?: ItemId } | null => {
    if (animal.kind === 'fish') return { verb: 'snatch' };
    const record = companionStateRef.current.recordFor(animal.id);
    if (record && record.bond !== 'none') return null;
    if (record && record.trust >= TRUST_FOR_BOND) {
      return { verb: 'speak' };
    }
    // A perched squirrel cannot be handed food — the
    // gate is the offering's only: it still tags, can
    // be looked at, and SPEAK above is untouched.
    if (animal.kind === 'squirrel' && (animal.y ?? 0) >= PERCH_Y) {
      return null;
    }
    if (isFeedable(animal.kind)) {
      const offered = dietFor(animal.kind).find(
        (food) => inventory.count(food) > 0,
      );
      if (offered !== undefined) return { verb: 'offer', item: offered };
    }
    return null;
  };

  // The creature act. Every line DRAFT for Adam's pin
  // pass; refusals voice per typed code, distinctly
  // (the feral is the animal itself, final; not-food
  // is the offering). The shell speaks for Systems'
  // returns on the bus (emitter layering): 'feral'
  // emits the snap, a bond emits the promotion, a
  // caught fish emits its catch.
  const handleCreatureInteract = (winner: {
    id: string;
    animalKind: string;
    verb: CreatureVerb;
    item?: ItemId;
  }) => {
    const label =
      winner.animalKind.length > 0
        ? winner.animalKind.charAt(0).toUpperCase() +
          winner.animalKind.slice(1)
        : winner.animalKind;
    const state = companionStateRef.current;
    if (winner.verb === 'offer') {
      if (winner.item === undefined) return;
      const day =
        rendererRef.current?.snapshotSky()?.daysElapsed ?? 0;
      const result = state.feed(
        winner.id,
        winner.animalKind,
        winner.item,
        inventory,
        day,
      );
      if (result.ok === false) {
        if (result.code === 'feral') {
          bus.emit('companion:feral-snap', { id: winner.id });
          showFeedback('This one is feral — it will never tame.', 'blocked');
        } else if (result.code === 'sated') {
          showFeedback(`The ${label} has eaten today.`, 'info');
        } else if (result.code === 'not-food') {
          showFeedback(
            `The ${label} turns from the ${displayNameFor(winner.item)}.`,
            'info',
          );
        } else if (result.code === 'not-held') {
          showFeedback('Nothing to offer.', 'blocked');
        }
        // 'bonded' cannot arise — candidacy excludes
        // bonded records, and the race is the only door.
        return;
      }
      showFeedback(
        `The ${label} takes the ${displayNameFor(winner.item)}.`,
        'gain',
      );
      if (result.bondReady) {
        showFeedback(`The ${label} is ready to be spoken to.`, 'info');
      }
      refreshCompanions();
      refreshInventory();
      saveNow();
      return;
    }
    if (winner.verb === 'speak') {
      const result = state.bondWith(
        winner.id,
        companionNameKnown(winner.animalKind),
      );
      if (result.ok === false) {
        if (result.code === 'name') {
          showFeedback(
            'You do not know its true name — a Waking speaks it.',
            'blocked',
          );
        } else if (result.code === 'trust') {
          showFeedback(
            'Not yet — it does not know you well enough.',
            'blocked',
          );
        } else if (result.code === 'feral') {
          showFeedback('This one is feral — it will never tame.', 'blocked');
        }
        // 'unknown' / 'already' cannot arise from the
        // candidacy (a record stands, unbonded).
        return;
      }
      bus.emit('companion:bonded', { id: winner.id, kind: winner.animalKind });
      // The cat's bond arm (Piece 2): the registry
      // never holds the cat — its engine bond lives in
      // catRuntime, driven in from the record.
      if (winner.animalKind === 'cat') setCatBond('attending');
      showFeedback(`The ${label} walks with you now.`, 'gain');
      refreshCompanions();
      saveNow();
      return;
    }
    // SNATCH — the live composition (animals.ts' own
    // prescription): Systems' snatchFish owns the roll,
    // the hunger gate, and the grant; Background's
    // machinery owns the visible fish. 'caught' despawns
    // the instance; 'spooked' and 'slipped' spook it
    // like an escape (DEV-settled: slipped consumes
    // nothing, the fish is not despawned).
    const renderer = rendererRef.current;
    const player = playerRef.current;
    if (!renderer || !player) return;
    const instances = renderer.getLoadedAnimalInstances();
    const target =
      instances.find((instance) => instance.id === winner.id) ??
      pickSnatchTarget(instances, player.x, player.z);
    const outcome = snatchFish(inventory, Math.random(), hunger);
    if (outcome === 'caught') {
      if (target) renderer.despawnChunkAnimal(target.id);
      bus.emit('animal:snatch-caught', {
        id: winner.id,
        kind: winner.animalKind,
        x: target?.x ?? player.x,
        z: target?.z ?? player.z,
      });
      showFeedback('Caught a fish!', 'gain');
      refreshInventory();
      saveNow();
    } else if (outcome === 'spooked') {
      if (target) applySnatchSpook(instances, target, player.x, player.z);
      showFeedback('It darts away.', 'info');
    } else if (outcome === 'slipped') {
      if (target) applySnatchSpook(instances, target, player.x, player.z);
      showFeedback(
        'Caught it — but your pack is full, and it slips free.',
        'blocked',
      );
      refreshInventory();
      saveNow();
    } else {
      showFeedback('Too hungry for that work.', 'blocked');
    }
  };

  // Open the charms panel with a valid selection: keep
  // the current one if it is still listed (awakenings
  // never drop), else fall to the first charm. Radio
  // family: opening closes the other two.
  const openCharmsPanel = () => {
    setCharmsOpen(true);
    setInventoryOpen(false);
    setCraftingOpen(false);
    setCompanionsOpen(false);
    setJournalOpen(false);
    setSelectedCharmKind((current) =>
      charmEntries.some((charm) => charm.kind === current)
        ? current
        : (charmEntries[0]?.kind ?? null),
    );
  };

  // THE CHARM TOGGLE ACT (Adam's ruling 2026-11-05;
  // the toggles build, 2026-11-06): one act behind BOTH
  // switches — the Charms panel's detail seat and the
  // journal's Charms page call this and nothing else.
  // The flip is Systems' (setEnabled refuses an
  // unawakened kind; a refused flip changes nothing and
  // saves nothing). A landed flip re-runs the whole
  // sync family — THE NEW CALL SITE: the syncs' standing
  // sites are boot + ritual completion, and a toggle is
  // the third list-change path (the effect facts move
  // without an awakening). Then the entries mirror
  // re-stamps (version bump) and the save carries the
  // fact (snapshot writes enabled explicitly, so the
  // choice persists across reload).
  const handleToggleCharm = (kind: string) => {
    const charms = charmStateRef.current;
    if (!charms.setEnabled(kind, !charms.isEnabled(kind))) return;
    setCharmListVersion((version) => version + 1);
    syncShrewEffect();
    syncCharmHooks();
    syncCrowTier();
    syncCharmBonuses();
    syncDeerWarning();
    saveNow();
  };

  const skyLabelFor = (sky: string): string => {
    switch (sky) {
      case 'day':
        return 'Daylight';
      case 'night':
        return 'Night';
      case 'dawn':
        return 'Dawn';
      case 'dusk':
        return 'Dusk';
      case 'full-moon':
        return 'Full moon';
      default:
        return '';
    }
  };

  // RITUAL SITE POSITION (both site kinds): made
  // altars resolve through altarState; stumps resolve
  // from their own key ('stump:x,z' — the key IS the
  // position, Background's stumpSiteId format). Null
  // for anything else (boulders do not exist yet).
  const sitePositionFor = (
    siteId: string,
  ): { kind: 'altar' | 'stump' | 'fire'; x: number; z: number } | null => {
    if (siteId.startsWith('fire:')) {
      const fire = placedFires.find(
        (f) => f.id === siteId.slice('fire:'.length),
      );
      return fire ? { kind: 'fire', x: fire.x, z: fire.z } : null;
    }
    if (siteId.startsWith('altar:')) {
      const altar = altarState.get(siteId);
      return altar ? { kind: 'altar', x: altar.x, z: altar.z } : null;
    }
    if (siteId.startsWith('stump:')) {
      const coords = siteId.slice('stump:'.length).split(',');
      const x = Number(coords[0]);
      const z = Number(coords[1]);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
      return { kind: 'stump', x, z };
    }
    return null;
  };

  // RITUAL COMPLETION CHECK (state-based, idempotent):
  // every uncompleted staging whose window is open
  // completes at once — staged mid-window completes
  // immediately, a missed window waits for the next one,
  // sky 'none' completes the moment all is offered.
  // Runs after every staging step (immediate path) and on
  // the 1 s timer (window-arrival path). On completion
  // the shell records the awakening, frees the site
  // (unstage — the bone awakens and leaves the site),
  // says so at the site, and saves. The bone was
  // CONSUMED at staging, so completion grants no item:
  // the awakening record IS the charm, and the feedback
  // names the awakening and claims no item. (A second
  // bone of the kind, carried, shows its awakened note
  // in the inventory — that is how a charm is carried.)
  const checkRitualCompletions = () => {
    const facts = skyFacts();
    if (!facts) return;
    let changed = false;
    for (const entry of stagingBookRef.current.snapshot()) {
      if (entry.completed) continue;
      const staging = stagingBookRef.current.get(
        entry.siteKey,
        entry.boneKind,
      );
      const recipe = ritualRecipeFor(entry.boneKind);
      if (!staging || !recipe) continue;
      const result = staging.complete(recipe, facts);
      if (!result) continue;
      // QUEST FLAG (wiring follow-up, 2026-10-28): a
      // completed Waking sets ritualCompleted. The outright
      // shrew grant never calls complete(), so it cannot
      // set this by construction. The loop's if (changed)
      // saveNow covers persistence.
      setQuestFlag('ritualCompleted');
      charmStateRef.current.awaken(result.kind, result.tier);
      // Awakening is a list change: re-sync the charm
      // hooks at once (the newly listed kind's effect
      // starts now, not on the next boot).
      syncCharmHooks();
      syncCrowTier();
      syncCharmBonuses();
      syncDeerWarning();
      // THE FAMILIAR RITE (Adam, 2026-11-02 — the familiar
      // road): the same Waking that awakens the bone is
      // the altar ritual the familiar is obtained from —
      // "she needs the bone for the ritual." The state
      // decides (obtainByRite): her companion of the kind
      // is raised; or the animal APPEARS at the altar as a
      // rite-born familiar; a standing familiar of another
      // kind steps down to companion inside the making.
      // The shell's arms: a body for the appeared animal,
      // the movement flip for the raised/displaced, the
      // feed lines (all DRAFT, Adam's pin pass), the flag.
      {
        // The familiar's gate: the rite is worked at an
        // ALTAR (Adam: "the familiar is what she obtains
        // from the altar ritual") — grade-2 ground, the
        // same grade the staging gate already demands.
        // A Waking completing below grade (only a pre-rule
        // save's leftover staging can) awakens its charm
        // and yields no familiar.
        const riteSite = sitePositionFor(entry.siteKey);
        const riteAdditions =
          riteSite?.kind === 'stump'
            ? (stumpState
                .snapshot()
                .find((r) => r.x === riteSite.x && r.z === riteSite.z)
                ?.additions ?? [])
            : riteSite?.kind === 'altar'
              ? (altarState.get(entry.siteKey)?.additions ?? [])
              : [];
        const rite =
          riteSite && siteGrade(riteSite.kind, riteAdditions) >= 2
            ? companionStateRef.current.obtainByRite(
                result.kind,
                `rite:${result.kind}`,
              )
            : null;
        const kindLabel = companionKindLabel(result.kind);
        if (rite && rite.outcome === 'appeared') {
          const site = riteSite;
          if (site) {
            const seatX = site.x + 1.2;
            const seatZ = site.z;
            restoreActor(
              makeCompanionInstance(
                rite.record.creatureId,
                result.kind as AnimalKind,
                seatX,
                seatZ,
              ),
              rite.record.stance ?? 'follow',
              seatX,
              seatZ,
            );
            setMovementMode(rite.record.creatureId, 'settleDart');
          }
          showFeedback(
            rite.displaced
              ? `The ${kindLabel} comes to the rite — your familiar now. The ${companionKindLabel(rite.displaced.kind)} steps down, still your companion.`
              : `The ${kindLabel} comes to the rite — and stays. Your familiar.`,
            'gain',
          );
        } else if (rite && rite.outcome === 'raised') {
          applyBondEngineArms(rite.record.creatureId, 'familiar');
          showFeedback(
            rite.displaced
              ? `The ${kindLabel} rises — your familiar now. The ${companionKindLabel(rite.displaced.kind)} steps down, still your companion.`
              : `The ${kindLabel} rises — your familiar now.`,
            'gain',
          );
        } else if (rite) {
          showFeedback(
            `The ${kindLabel} already stands as your familiar.`,
            'info',
          );
        }
        if (rite?.displaced && rite.outcome !== 'already-familiar') {
          applyBondEngineArms(rite.displaced.creatureId, 'companion');
        }
        if (rite && rite.outcome !== 'already-familiar') {
          setQuestFlag('familiarObtained');
          bus.emit('familiar:elevated', { id: rite.record.creatureId });
          // The name arrives WITH the awakening (Adam):
          // the rite teaches her the kind's true name,
          // and the journal keeps it from then on.
          if (familiarStateRef.current.learnName(result.kind)) {
            const taught = trueNameFor(result.kind);
            if (taught) {
              showFeedback(
                `Its true name comes to her: ${taught}. It is written in the journal.`,
                'gain',
              );
            }
          }
        }
        setCompanionRecords(companionStateRef.current.snapshot());
      }
      // The awakening line joins the message feed (it
      // used to anchor at the site — the feed is every
      // line's seat now, so the site lookup is gone).
      ritualSiteState.unstageBone(entry.siteKey);
      // THE BOOK CLEARS BESIDE THE SITE (Systems' design,
      // wired 2026-11-05 with the rite pair landing): the
      // spent entry leaves the book in the same act, so
      // the save stops carrying it and the two stores
      // cannot split over a completion.
      stagingBookRef.current.clear(entry.siteKey, entry.boneKind);
      showFeedback(`The ${boneDisplayFor(result.kind)} awakens.`, 'gain');
      changed = true;
    }
    if (changed) {
      saveNow();
      refreshRitual();
    }
  };

  // THE ALTAR GATE LINE (Adam, 2026-10-31 — 'we
  // shouldn't be allowed to use a ritual until we place
  // our items'): one DRAFT line spoken by every surface
  // the grade gate touches — the hub's gated Ritual door
  // renders it as its body, and the staging guard below
  // sets it as the ritual note.
  const RITUAL_ALTAR_REFUSAL =
    "A ritual wants an altar, and this stump isn't one yet. The making — stones, glyph, candle — is under Upgrade.";
  // The same refusal at a placed altar (the altar fix,
  // 2026-11-05): the words name the thing she stands at.
  const RITUAL_ALTAR_REFUSAL_AT_ALTAR =
    "A ritual wants an altar, and this altar isn't one yet. The making — stones, glyph, candle — is under Upgrade.";

  // RITUAL STAGING, ALTAR + STUMP SITES (bone build):
  // made altars carry ids + chips + positions; stumps
  // carry chips from Background's stumpPositions
  // surface. Boulders do not exist yet.
  const handleStageBone = (siteId: string, kind: string) => {
    const site = sitePositionFor(siteId);
    if (!site || site.kind === 'fire') {
      // A fire context is never a ritual site (the
      // widened position type admits it; this door's
      // sites are stump/altar by construction).
      setRitualNote('No site there.');
      return;
    }
    // GRADE GATE (Adam, 2026-10-31, same ruling): staging
    // requires ALTAR-GRADE ground — siteGrade 2: an
    // altar by kind, or a stump carrying the completing
    // 'altar' addition (all three items placed). A plain
    // or part-made stump reads grade 1 and refuses HERE,
    // in the shell's one staging path, so no door (panel
    // rows, digit dispatch, any caller) can stage below
    // the altar. Offering and Speak act on an existing
    // staging and are not gated — a staging that exists
    // (a pre-rule save is the only way one can sit at
    // grade 1; additions never come off) can still be
    // completed, and the state-based completion check
    // fires regardless.
    // Each base reads its OWN record (the altar fix,
    // 2026-11-05, on the familiar rite's pattern at its
    // obtainByRite call): a placed altar's additions
    // live in altarState — reading [] for one graded a
    // fully-made altar as unconsecrated and refused
    // every staging there.
    const gateAdditions =
      site.kind === 'stump'
        ? (stumpState
            .snapshot()
            .find((r) => r.x === site.x && r.z === site.z)
            ?.additions ?? [])
        : site.kind === 'altar'
          ? (altarState.get(siteId)?.additions ?? [])
          : [];
    if (siteGrade(site.kind, gateAdditions) < 2) {
      setRitualNote(
        site.kind === 'altar' ? RITUAL_ALTAR_REFUSAL_AT_ALTAR : RITUAL_ALTAR_REFUSAL,
      );
      return;
    }
    // Composition contract (DEV): the shell checks the
    // ritualSite snapshot FIRST. One bone per site — an
    // occupied site REFUSES (the replace branch would
    // need a StagingBook entry-clear that does not exist,
    // and silently dropping a staged ritual is worse
    // than refusing). Flagged choice, stated plainly.
    if (ritualSiteState.getStaged(siteId)) {
      setRitualNote('This site already holds a bone.');
      return;
    }
    // PLACE-BONE CONSUMES (bone build — gap #3 CLOSED):
    // stageBoneFromInventory is THE shell path now —
    // possession check + consume 1 + record, refusals
    // consume nothing. Raw placeBone is a record-only
    // primitive; calling it here would leave the bone
    // both carried and staged (a shell bug, Systems'
    // words). No-recipe kinds refuse (shrew: no Waking
    // — found-bone stacking stays open, flagged).
    const staged = stageBoneFromInventory(
      inventory,
      stagingBookRef.current,
      siteId,
      kind,
    );
    if (!staged.staged) {
      setRitualNote(staged.reason ?? 'Could not stage that bone.');
      return;
    }
    ritualSiteState.stageBone(
      { kind: site.kind, siteId, x: site.x, z: site.z },
      kind,
    );
    refreshInventory();
    setRitualNote(null);
    saveNow();
    refreshRitual();
    checkRitualCompletions();
  };

  // HER VOICE for the transformation grants (Systems:
  // "refusal reasons name the missing fact plainly; the
  // UI speaks them in her voice"). Keyed by the grants'
  // pinned reason strings; an unmapped reason passes
  // through plain rather than ever being swallowed.
  // All lines DRAFT for Adam's pin pass.
  const altarActVoice = (reason: string): string =>
    ({
      'Needs 4 river stone.': 'She needs four river stones for the ring.',
      'The glyph comes after the stones.': 'The glyph wants the stones first.',
      'Needs a charred stick to draw the glyph.':
        'She needs a charred stick to draw with.',
      'The candle comes after the glyph.': 'The candle wants the glyph first.',
      'Needs a candle.': 'She has no candle to set.',
      'No journal carried.': 'She carries no journal to link.',
    })[reason] ?? reason;

  // ALTAR TRANSFORMATION ACTS (claim as approved
  // 2026-10-30): the three makings + the Linking, run
  // against Systems' stumpy-altar grants. Grant first —
  // a refusal consumes nothing and speaks in her voice;
  // on success the outcome's additions apply through
  // Background's applyAddition, one member per call in
  // the one handler (act 3's candle + 'altar' pair
  // lands in the same tick; restore keeps the record
  // whole). The Linking sets the shell flag and saves.
  const handleSiteAct = (siteId: string, actId: string) => {
    const site = sitePositionFor(siteId);
    if (!site) {
      setRitualNote('No site there.');
      return;
    }
    // BASE-BLIND (parity): the site's additions resolve
    // from whichever record holds the base — the stump's
    // by position, the placed altar's by its entity id.
    const additions: readonly string[] =
      site.kind === 'stump'
        ? (stumpState
            .snapshot()
            .find((record) => record.x === site.x && record.z === site.z)
            ?.additions ?? [])
        : (altarState.get(siteId)?.additions ?? []);
    if (actId === 'link-journal') {
      const outcome = linkJournal(
        inventory,
        siteGrade(site.kind, additions),
        journalLinked,
      );
      if (outcome.linked === false) {
        setRitualNote(altarActVoice(outcome.reason));
        return;
      }
      journalLinkedRef.current = true;
      setJournalLinked(true);
      setRitualNote('The books are linked.');
      saveNow();
      refreshRitual();
      return;
    }
    const grant =
      actId === 'place-stones'
        ? placeStones
        : actId === 'draw-glyph'
          ? drawGlyph
          : setCandle;
    const outcome = grant(inventory, altarProgressFrom(additions));
    if (outcome.applied === false) {
      setRitualNote(altarActVoice(outcome.reason));
      return;
    }
    // The grants return the shared step members
    // ('altar-stones' / 'altar-glyph' / 'altar-candle'),
    // which are exactly each base's own record dialect:
    // the stump applies them one by one; the placed
    // altar seats the widened record whole (altarState
    // validates the members at the setter).
    if (site.kind === 'stump') {
      for (const addition of outcome.additions) {
        stumpState.applyAddition(site.x, site.z, addition as StumpAddition);
      }
    } else {
      altarState.setAdditions(siteId, [
        ...additions,
        ...outcome.additions,
      ]);
    }
    // The feed lines name the base she worked on (the
    // altar's pair DRAFT for Adam's pin pass; the
    // candle line already read both ways).
    setRitualNote(
      actId === 'place-stones'
        ? site.kind === 'stump'
          ? 'The stones ring the stump.'
          : 'The stones ring the altar.'
        : actId === 'draw-glyph'
          ? site.kind === 'stump'
            ? 'The glyph darkens the bark.'
            : 'The glyph is cut into the slab.'
          : 'The candle stands lit. This is an altar now.',
    );
    refreshInventory();
    saveNow();
    refreshRitual();
  };

  // THE FAMILIAR'S RITE — PRESS + CONFIRM (Build 2,
  // Piece 1). A press only ASKS: the pending rite waits
  // for the Popup confirm (which names the animal, and
  // for supersede names the displacement too). No
  // presence gate in v1 (DEV ruling, 2026-10-31): she
  // is the celebrant — staging already works the same
  // way from her pack; Adam's playtest rules it later.
  const handleRiteAct = (actId: string, grade: number | null) => {
    const split = actId.indexOf(':');
    if (split < 0) return;
    const act = actId.slice(0, split);
    const creatureId = actId.slice(split + 1);
    if (act !== 'elevate' && act !== 'relinquish' && act !== 'supersede') {
      return;
    }
    if (grade === null || grade < 2) {
      // The seats never pass rows below grade; this is
      // the backstop voice if one somehow speaks.
      setRitualNote(RITUAL_ALTAR_REFUSAL);
      return;
    }
    setPendingRite({ act, creatureId, grade });
  };

  // The engine arms of a landed bond change: the cat
  // rides its own runtime's bond level; every other
  // animal rides the registry's movement model (the
  // familiar's settle-and-dart cycle vs the companion's
  // trail). The record is the truth; these are only
  // its motion and light.
  const applyBondEngineArms = (
    creatureId: string,
    level: 'familiar' | 'companion',
  ) => {
    const record = companionStateRef.current
      .snapshot()
      .find((r) => r.creatureId === creatureId);
    if (!record) return;
    if (record.kind === 'cat') {
      setCatBond(level === 'familiar' ? 'familiar' : 'attending');
    } else {
      setMovementMode(
        creatureId,
        level === 'familiar' ? 'settleDart' : 'trail',
      );
    }
  };

  // Rite refusal voices (all DRAFT, Adam's pin pass):
  // one honest line per code, spoken through the
  // ritual note like every altar refusal.
  const riteRefusalNote = (
    code: string,
    targetKind: string,
    standingKind?: string,
  ): string => {
    switch (code) {
      case 'ground':
        return RITUAL_ALTAR_REFUSAL;
      case 'one-standing':
        return `${standingKind ?? 'Another'} stands as your familiar — let them step down, or raise the ${targetKind} in their place.`;
      case 'already-familiar':
        return `The ${targetKind} already stands as your familiar.`;
      case 'not-familiar':
        return `The ${targetKind} does not stand as your familiar.`;
      case 'no-standing':
        return `No familiar stands — the ${targetKind} can simply be raised.`;
      default:
        return 'The rite wants a companion.';
    }
  };

  const confirmRite = () => {
    const rite = pendingRite;
    setPendingRite(null);
    if (!rite) return;
    const state = companionStateRef.current;
    const kindOf = (id: string): string => {
      const record = state.snapshot().find((r) => r.creatureId === id);
      return record ? companionKindLabel(record.kind) : 'animal';
    };
    const targetKind = kindOf(rite.creatureId);
    if (rite.act === 'elevate') {
      const result = state.elevate(rite.creatureId, rite.grade);
      if (result.ok === false) {
        setRitualNote(
          riteRefusalNote(
            result.code,
            targetKind,
            result.code === 'one-standing' && result.standing
              ? kindOf(result.standing)
              : undefined,
          ),
        );
        return;
      }
      applyBondEngineArms(rite.creatureId, 'familiar');
      bus.emit('familiar:elevated', { id: rite.creatureId });
      setRitualNote(`The ${targetKind} stands as your familiar now.`);
    } else if (rite.act === 'relinquish') {
      const result = state.relinquish(rite.creatureId, rite.grade);
      if (result.ok === false) {
        setRitualNote(riteRefusalNote(result.code, targetKind));
        return;
      }
      applyBondEngineArms(rite.creatureId, 'companion');
      bus.emit('familiar:relinquished', { id: rite.creatureId });
      setRitualNote(
        `The ${targetKind} steps down — still your companion, still your friend.`,
      );
    } else {
      const standingBefore = state.familiar();
      const result = state.supersede(rite.creatureId, rite.grade);
      if (result.ok === false) {
        setRitualNote(riteRefusalNote(result.code, targetKind));
        return;
      }
      if (standingBefore) {
        applyBondEngineArms(standingBefore.creatureId, 'companion');
      }
      applyBondEngineArms(rite.creatureId, 'familiar');
      bus.emit('familiar:superseded', {
        id: rite.creatureId,
        displaced: standingBefore?.creatureId ?? '',
      });
      setRitualNote(
        standingBefore
          ? `The ${targetKind} rises; the ${kindOf(standingBefore.creatureId)} steps down.`
          : `The ${targetKind} stands as your familiar now.`,
      );
    }
    setCompanionRecords(state.snapshot());
    saveNow();
  };

  // THE RECITE (the familiar road, 2026-11-02 — flagged
  // reading from Adam's design session: speaking the true
  // name from the journal is the borrowing's door). The
  // journal offers it for the standing familiar when its
  // gift is a working one; FamiliarState owns the span
  // and the rest; the shell applies the gift's effect —
  // dark-sight lights her sight in the renderer, and
  // undetected stills the wild animals' startle.
  const applyBorrowEffect = (giftId: string, on: boolean) => {
    if (giftId === 'dark-sight') {
      rendererRef.current?.setBorrowedSight(on);
    } else if (giftId === 'undetected') {
      setUndetected(on);
    }
  };

  // THE NAMING ACTS (the naming build, 2026-11-05):
  // the journal Places page's doors. The register owns
  // the rules (verbatim names, the 2 m rename-in-place,
  // per-dimension spots); the shell supplies where she
  // stands, the dimension she stands in, and the
  // world-day — and saves after every act. Copy DRAFT.
  const worldDayNow = (): number => {
    const sky = rendererRef.current?.snapshotSky();
    return sky ? Math.floor(sky.daysElapsed + sky.cycleT) + 1 : 1;
  };
  const handleNamePlace = (name: string) => {
    const player = playerRef.current;
    if (!player) return;
    const dimensionKey = dimensionState.activeKey();
    const near = namedPlacesRef.current.nearest(
      player.x,
      player.z,
      dimensionKey,
    );
    const renamed =
      near !== null && near.distanceM <= RENAME_RADIUS_M;
    const place = namedPlacesRef.current.nameHere({
      name,
      x: player.x,
      z: player.z,
      dimensionKey,
      day: worldDayNow(),
    });
    if (!place) return;
    selectPlace(place.id);
    showFeedback(
      renamed
        ? `This place is "${place.name}" now.`
        : `Named — "${place.name}".`,
      'gain',
    );
    refreshPlaces();
    saveNow();
  };
  const handleRenamePlace = (id: string, name: string) => {
    if (!namedPlacesRef.current.rename(id, name, worldDayNow())) {
      return;
    }
    const place = namedPlacesRef.current.get(id);
    showFeedback(`This place is "${place?.name ?? name}" now.`, 'gain');
    refreshPlaces();
    saveNow();
  };
  const handleUnnamePlace = () => {
    const target = pendingUnnamePlace;
    setPendingUnnamePlace(null);
    if (!target) return;
    if (!namedPlacesRef.current.unname(target.id)) return;
    if (selectedPlaceRef.current === target.id) selectPlace(null);
    showFeedback(`The name "${target.name}" is lifted.`, 'info');
    refreshPlaces();
    saveNow();
  };

  const handleRecite = (kind: string) => {
    const standing = companionStateRef.current.familiar();
    if (!standing || standing.kind !== kind) return;
    if (!familiarStateRef.current.knowsName(kind)) return;
    const result = familiarStateRef.current.tryBorrow(
      kind,
      Date.now() / 1000,
    );
    if (!result.ok) return;
    const gift = giftFor(kind);
    if (gift?.giftId) {
      applyBorrowEffect(gift.giftId, true);
      borrowLiveRef.current = gift.giftId;
    }
    showFeedback(
      `She speaks the name — ${gift?.phrase ?? 'the gift'} is hers for a while.`,
      'gain',
    );
  };

  // The borrowing's end (the 1 s timer rides this): when
  // the span lapses, the effect comes off and the feed
  // says so. Rest arithmetic lives in FamiliarState.
  const settleBorrow = () => {
    const was = borrowLiveRef.current;
    const live = familiarStateRef.current.activeBorrow(Date.now() / 1000);
    if (was && !live) {
      applyBorrowEffect(was, false);
      borrowLiveRef.current = null;
      showFeedback('The borrowing fades.', 'info');
    } else if (live) {
      borrowLiveRef.current = live.giftId;
    }
  };

  const handleGiveOffering = (
    siteId: string,
    kind: string,
    foodItem: string,
  ) => {
    const staging = stagingBookRef.current.get(siteId, kind);
    if (!staging) {
      setRitualNote('No staging here.');
      return;
    }
    const offered = staging.giveOffering(foodItem);
    if (!offered.ok) {
      setRitualNote(offered.reason ?? 'Could not give that offering.');
      return;
    }
    // Shell consumes iff the step accepts (Systems'
    // contract) — poison + raw acorns never reach here
    // (giveOffering refuses non-foods first).
    inventory.remove(foodItem, 1);
    refreshInventory();
    setRitualNote(null);
    saveNow();
    refreshRitual();
    checkRitualCompletions();
  };

  const handleSpeakName = (siteId: string, kind: string) => {
    const staging = stagingBookRef.current.get(siteId, kind);
    const recipe = ritualRecipeFor(kind);
    if (!staging || !recipe) {
      setRitualNote('No staging here.');
      return;
    }
    // Looks arrive as INPUT from NameSight (Systems'
    // contract); speakName enforces minLooks itself.
    // FLAGGED GAP: bone kinds have nothing to LOOK at
    // yet (no per-kind bone objects — the bone build),
    // so looksAt(kind) reads 0 and this step stays
    // locked until the bone build lands (or DEV rules a
    // looks source). The gate renders honestly; nothing
    // is faked (no generic-bone-look counting invented).
    const looks = nameSightRef.current.looksAt(kind);
    const spoken = staging.speakName(looks, recipe.spokenName.minLooks);
    if (!spoken.ok) {
      setRitualNote(spoken.reason ?? 'Could not speak its name.');
      return;
    }
    setRitualNote(null);
    saveNow();
    refreshRitual();
    checkRitualCompletions();
  };

  const handlePlaceItem = (itemId: string) => {
    // Placed torches never enter the preview flow — the
    // branch above places instantly at the crosshair.
    if (itemId === ITEMS.litTorch) {
      handlePlaceLitTorch();
      return;
    }
    // Placed altars never enter the preview flow either —
    // the branch above places instantly at her feet.
    if (itemId === ITEMS.altar) {
      handlePlaceAltar();
      return;
    }
    // Placed writing desks never enter the preview flow
    // either — the altar twin: one press places one desk
    // at her feet via the grant + entity pair above.
    if (itemId === ITEMS.writingDesk) {
      handlePlaceDesk();
      return;
    }
    // Placed crafted workstations never enter the
    // preview flow either — the desk twin (the fix's
    // door, 2026-11-05).
    if (itemId === ITEMS.craftedWorkstation) {
      handlePlaceWorkstation();
      return;
    }
    // Placed cauldrons never enter the preview flow
    // either — the press runs the hearth-targeted grant
    // above (the pot lands on the faced hearth, not at
    // her feet).
    if (itemId === ITEMS.cauldron) {
      handlePlaceCauldron();
      return;
    }
    // Placed tents never enter the preview flow either —
    // the torch mirror: one press places one tent at the
    // crosshair (camping.ts: "one press places one tent";
    // the landing moved with the fold-in ruling,
    // 2026-10-31). No placement mode (the preview ghost
    // is the house/fire pattern, heavy for a torch-class
    // act).
    if (itemId === ITEMS.tent) {
      handlePlaceTent();
      return;
    }
    // Placed sleeping bags ride the tent's instant
    // pattern whole (the bag build): one press places
    // one bag at the crosshair, no preview flow.
    if (itemId === ITEMS.sleepingBag) {
      handlePlaceBag();
      return;
    }
    // Single-tap campfire (Adam, 2026-10-28): Place places
    // immediately — no placement mode, no ghost, no
    // "Place here" panel. AT THE CROSSHAIR since Adam's
    // fold-in ruling (2026-10-31): the aim point serves
    // the campfire as it serves the torch — a groundless
    // gaze refuses on the fire note (after the carried
    // check, so an empty hand hears the truer refusal),
    // a far gaze clamps to the reach. Hearth/kiln keep
    // the two-step flow below; this branch is campfire only.
    if (itemId === ITEMS.campfire) {
      // Clear any armed placement mode first so no stale ghost
      // lingers after the tap.
      placementRef.current = null;
      setPlacement(null);
      setPlacementAnchor(null);
      setPlacementNote(null);
      const player = playerRef.current;
      if (!player) return;
      if (inventory.count(itemId) < 1) {
        setFireNote('Nothing to place — that item is no longer carried.');
        return;
      }
      const target = aimedPlacementPoint();
      if (target === null) {
        setFireNote('Nowhere to set it down.');
        return;
      }
      try {
        fireState.placeFire('campfire', target.x, target.z, playerRef.current?.yaw ?? 0);
        inventory.remove(itemId, 1);
      } catch (error) {
        setFireNote(
          error instanceof Error ? error.message : 'Placement failed.',
        );
        return;
      }
      setFireNote(null);
      refreshInventory();
      saveNow();
      setInventoryOpen(false);
      return;
    }
    // THE CARRYABLE TRAPS (the trap chunk, 2026-11-01):
    // the pack's Place verb arms the crosshair flow like
    // a house or hearth — chip + hoisted card confirm —
    // with the trap arm on the mode. No footprint key
    // exists for traps in Background's table, so no
    // terrain outline paints; the chip is the preview
    // and the card is the confirm of record.
    if (isCarryableTrap(itemId)) {
      const label =
        inventoryItems.find((i) => i.id === itemId)?.name ?? itemId;
      const mode: PlacementMode = {
        itemId,
        label,
        trapType: itemId,
      };
      placementRef.current = mode;
      setPlacement(mode);
      setPlacementNote(null);
      setInventoryOpen(false);
      recomputeAnchors();
      return;
    }
    const fireType = FIRE_ITEM_TO_TYPE[itemId];
    const houseType = HOUSE_ITEM_TO_TYPE[itemId];
    const loom = itemId === ITEMS.loom;
    if (!fireType && !houseType && !loom) return;
    const label =
      inventoryItems.find((i) => i.id === itemId)?.name ?? itemId;
    const mode: PlacementMode = {
      itemId,
      label,
      fireType,
      houseType,
      loom: loom ? true : undefined,
    };
    placementRef.current = mode;
    setPlacement(mode);
    setPlacementNote(null);
    setInventoryOpen(false);
    recomputeAnchors();
  };

  const handlePlaceConfirm = () => {
    const mode = placementRef.current;
    if (!mode) return;
    const player = playerRef.current;
    if (!player) return;
    // Cost gating lives with UI here: the engine primitives are
    // cost-free, so placing consumes the carried item — placing
    // without consuming would duplicate it.
    if (inventory.count(mode.itemId) < 1) {
      setPlacementNote(
        'Nothing to place — that item is no longer carried.',
      );
      placementRef.current = null;
      setPlacement(null);
      setPlacementAnchor(null);
      return;
    }
    // THE CROSSHAIR LAW (Adam, 2026-11-01): the confirm
    // places where the ghost stands — the aimed point at
    // the press. A groundless gaze refuses in the instant
    // family's line and the mode STAYS armed (she aims
    // again); standing on the station as it lands is over.
    const target = aimedPlacementPoint();
    if (target === null) {
      setPlacementNote('Nowhere to set it down.');
      return;
    }
    // THE TRAP ARM (the trap chunk): the grant is the
    // gate — it validates the site and consumes. A
    // refusal speaks on the placement note and the mode
    // STAYS armed (the groundless-gaze precedent: she
    // re-aims, e.g. at water for the weir). Success
    // seats through the one composition and disarms.
    if (mode.trapType) {
      const outcome = composePlaceCarriedTrap(mode.trapType, target);
      if (outcome.ok === false) {
        setPlacementNote(outcome.reason);
        return;
      }
      placementRef.current = null;
      setPlacement(null);
      setPlacementAnchor(null);
      setPlacementNote(null);
      refreshTrapsFromState();
      refreshInventory();
      saveNow();
      return;
    }
    try {
      if (mode.fireType) {
        fireState.placeFire(
          mode.fireType,
          target.x,
          target.z,
          playerRef.current?.yaw ?? 0,
          mode.fireType === 'hearth'
            ? hearthItemFireLit(mode.itemId as ItemId)
            : false,
        );
      } else if (mode.houseType) {
        shelterState.placeHouse(mode.houseType, target.x, target.z, playerRef.current?.yaw ?? 0);
      } else if (mode.loom) {
        loomState.placeLoom(target.x, target.z, playerRef.current?.yaw ?? 0);
      }
      inventory.remove(mode.itemId, 1);
    } catch (error) {
      setPlacementNote(
        error instanceof Error ? error.message : 'Placement failed.',
      );
      return;
    }
    placementRef.current = null;
    setPlacement(null);
    setPlacementAnchor(null);
    setPlacementNote(null);
    refreshInventory();
    saveNow();
  };

  const handlePlaceCancel = () => {
    placementRef.current = null;
    setPlacement(null);
    setPlacementAnchor(null);
    setPlacementNote(null);
  };

  // HOUSE UPGRADES ARE NOT PLACEMENTS (Adam, 2026-11-01):
  // the armed-placement upgrade press that lived here is
  // OUT — upgrading happens on the standing house where
  // it stands, through the home menu's Upgrade row
  // (handleHomeMenuAction's upgrade arm). A fresh
  // placement is a fresh placement, whatever it faces.

  const handleEatItem = (itemId: string) => {
    // Raw cook-required food never reaches eat(): the press
    // surfaces the cook-first note honestly instead of a gain
    // (eat() itself would refuse with a stale "future fire
    // system" message — the fire system exists now, so the
    // shell says so in its own words and consumes nothing).
    if (needsCooking(itemId)) {
      setEatNote('Acorns must be cooked first — cook them at a lit fire.');
      return;
    }
    // QUEST FLAG (wiring follow-up, 2026-10-28): capture
    // the PRE-eat stage — the try block overwrites it with
    // the after stage, and an eat lifting her out of hungry
    // must still count. Too-hungry eats do not set the flag
    // (hungry-band-only).
    const stageBeforeEat = hungerStage;
    try {
      const result = eat(hunger, inventory, itemId);
      setHungerStage(result.stage);
      setHungerValue(hunger.value());
      setEatNote(`Ate ${result.item} (+${result.nutrition} hunger).`);
      if (stageBeforeEat === 'hungry') {
        setQuestFlag('ateWhileHungry');
      }
    } catch (error) {
      setEatNote(
        error instanceof Error ? error.message : 'Could not eat that.',
      );
    }
    refreshInventory();
    saveNow();
  };

  /**
   * Inventory Tend press (the salve's row): Systems'
   * tendWithSalve in the eat() posture — checks before
   * removing anything, so a refused tend costs nothing.
   * A successful tend is the salve's exercised door:
   * recordItemUse teaches its use line (Systems' core
   * note names this as the shell's half). Refusals
   * speak in the panel's note, like eating's.
   */
  const handleTendSalve = (_itemId: string) => {
    const result = tendWithSalve(inventory, injury);
    // Equality check, not truthiness: this repo runs
    // tsc without strict mode, and truthiness does
    // not narrow the TendResult union.
    if (result.ok === false) {
      setEatNote(
        result.code === 'not-hurt'
          ? 'She is not hurt — the salve would be wasted.'
          : 'No salve to tend with.',
      );
      return;
    }
    recordItemUse(SALVE_ITEM);
    refreshInjuryUi();
    setEatNote('She tends her hurt with the salve.');
    refreshInventory();
    saveNow();
  };

  // THE DOUSE DOORS (the douse build, 2026-11-03;
  // Systems' scent.ts grants): Douse lays a brew's
  // scent (one at a time — a new douse replaces);
  // Wash spends the mixed wash to strip it early;
  // Mix turns a filled jar + a meadow flower into
  // the wash (the jar comes back empty). All copy
  // DRAFT for Adam's pin pass; the grants own the
  // consumption and the learn.
  const handleDouseItem = (itemId: string) => {
    const result = applyDouse(
      inventory,
      scentState,
      itemId as ItemId,
    );
    if (result.ok === false) {
      setEatNote(
        result.code === 'not-carried'
          ? 'She does not carry that brew.'
          : 'That is no scent brew.',
      );
      return;
    }
    refreshScentUi();
    setEatNote(
      itemId === 'repellent'
        ? 'She douses herself — the reek will keep the wild off.'
        : itemId === 'prey-lure'
          ? 'She douses herself — the smell of prey drifts out.'
          : 'She douses herself — the smell of a hunter drifts out.',
    );
    refreshInventory();
    saveNow();
  };

  const handleWashItem = (_itemId: string) => {
    const result = useWash(inventory, scentState);
    if (result.ok === false) {
      setEatNote(
        result.code === 'no-scent'
          ? 'No scent on her to wash off.'
          : 'She carries no wash.',
      );
      return;
    }
    refreshScentUi();
    setEatNote('She washes the scent off.');
    refreshInventory();
    saveNow();
  };

  const handleMixWashItem = (_itemId: string) => {
    const result = mixWash(inventory);
    if (result.ok === false) {
      setEatNote(
        result.code === 'no-filled-jar'
          ? 'No filled jar to mix with.'
          : result.code === 'no-flower'
            ? 'No meadow flower to mix in.'
            : 'Too full to take the wash.',
      );
      return;
    }
    setEatNote('She mixes the wash — jar water and meadow flower.');
    refreshInventory();
    saveNow();
  };

  /**
   * Inventory Light press (unlit torch rows only): the
   * CANDLE route of Systems' batch lighting (Adam's
   * on-demand ruling + DEV's wiring word, 2026-11-03)
   * — she lights them off her carried candle: always
   * available, nothing consumed, every carried unlit
   * torch lit in one press. The door names the route
   * explicitly (one behavior everywhere — the same
   * route as the fire menu's pill); the fire/flint
   * routes stay in the API unused by the doors. This
   * press was the flint route before (flint + river-
   * stone or a refusal — exactly the failure the
   * on-demand shape removes). Same refresh + save
   * shape as eating (panel action, not world action).
   */
  const handleLightTorchItem = (_itemId: string) => {
    const outcome = lightTorches(inventory, {
      litFirePresent: false,
      route: 'candle',
    });
    // Equality check, not truthiness: this repo runs tsc
    // without strict mode, and truthiness narrowing on
    // this union's boolean discriminant does not narrow
    // (verified: `if (outcome.lit)` else-branch keeps the
    // lit member, TS2339 on .reason; `=== false` narrows).
    if (outcome.lit === false) {
      setTorchNote(outcome.reason);
    } else {
      setTorchNote(
        `Lit ${outcome.count} torch${outcome.count === 1 ? '' : 'es'}.`,
      );
    }
    refreshInventory();
    saveNow();
  };

  /** Lazily open (or create) the HomeStorage for a placed house. */
  const getHomeStore = (houseId: string): HomeStorage | null => {
    const existing = homeStoresRef.current.get(houseId);
    if (existing) return existing;
    const placed = shelterState.snapshot().find((h) => h.id === houseId);
    if (!placed) return null;
    const store = new HomeStorage(HOUSE_TYPE_TO_ITEM[placed.type]);
    // Creation-time bonus (mouse wiring): a house opened
    // mid-game gets the current mouse bonus at once —
    // without this it would sit at 0 until the next
    // list-change sync.
    store.setCharmBonus(
      mouseStorageBonus(
        charmStateRef.current.isAwakened('mouse-spine'),
        charmStateRef.current,
      ),
    );
    homeStoresRef.current.set(houseId, store);
    homeStoreItemsRef.current.set(houseId, new Set());
    return store;
  };

  // The bound storage house, live only while she
  // stands sheltered at it — transfers never act
  // from afar, and the dialog's head stands only
  // while she is home at the bound house.
  const boundStorageHouseId = (): string | null =>
    storageHouseId !== null && shelterHouseId === storageHouseId
      ? storageHouseId
      : null;

  const handleDepositItem = (itemId: string) => {
    const houseId = boundStorageHouseId();
    if (!houseId) return;
    const store = getHomeStore(houseId);
    if (!store) {
      setStorageNote('No home storage here.');
      return;
    }
    try {
      // Add first: a full home store throws and the carried
      // item stays carried. Then remove (count >= 1, the row
      // exists only for carried stacks).
      store.add(itemId, 1);
      inventory.remove(itemId, 1);
      homeStoreItemsRef.current.get(houseId)?.add(itemId);
      inventory.setWorn(wardrobe.wornItemIds());
      setWornGarments(wardrobe.wornGarments());
      setStorageNote(null);
    } catch (error) {
      setStorageNote(
        error instanceof Error ? error.message : 'Could not store that.',
      );
    }
    refreshInventory();
    saveNow();
  };

  const handleWithdrawItem = (itemId: string) => {
    const houseId = boundStorageHouseId();
    if (!houseId) return;
    const store = getHomeStore(houseId);
    if (!store) {
      setStorageNote('No home storage here.');
      return;
    }
    try {
      // Add first: a full pack throws and the stored item
      // stays stored. Then remove (count >= 1, the row exists
      // only for stored stacks).
      inventory.add(itemId, 1);
      store.remove(itemId, 1);
      if (store.count(itemId) === 0) {
        homeStoreItemsRef.current.get(houseId)?.delete(itemId);
      }
      inventory.setWorn(wardrobe.wornItemIds());
      setWornGarments(wardrobe.wornGarments());
      setStorageNote(null);
    } catch (error) {
      setStorageNote(
        error instanceof Error ? error.message : 'Could not take that.',
      );
    }
    refreshInventory();
    saveNow();
  };

  // INVENTORY DROP (Adam, 2026-10-26 — "for next pass",
  // arrows 2026-10-28): ↓ drops one per press, ↓↓
  // (handleDropAllItem) drops the live carried count —
  // same feet destination, never retargeted into a pile.
  // One item per press was the V1 UI calling convention,
  // not a Systems limit: dropFromInventory takes quantity.
  // The rest of the shape is unchanged (ground pile in
  // the same pile system as overflow; Systems validates
  // + removes first, so a failed drop leaves the
  // inventory exactly as it was; then the shell hands
  // the record to pileState.drop()). Worn-gear rows never
  // reach the Drop arrows (worn-gear landing); a
  // carried-unworn garment drops without unwearing (the
  // worn bonus already self-cancels when the carried
  // count hits 0 via the setWorn re-sync, and returns if
  // the garment is picked back up).
  const handleDropItem = (itemId: string) => {
    const player = playerRef.current;
    if (!player) {
      setDropNote('Could not drop that.');
      return;
    }
    try {
      const pile = dropFromInventory(itemId, 1, inventory, player.x, player.z);
      pileState.drop(pile.item, pile.quantity, pile.x, pile.z);
      inventory.setWorn(wardrobe.wornItemIds());
      setWornGarments(wardrobe.wornGarments());
      setDropNote(`Dropped 1 ${displayNameFor(itemId)}.`);
    } catch (error) {
      setDropNote(
        error instanceof Error ? error.message : 'Could not drop that.',
      );
    }
    refreshInventory();
    saveNow();
  };

  // INVENTORY DROP ALL (Adam, 2026-10-28 — arrows in the
  // Inventory modal): the ↓↓ mate of handleDropItem —
  // same flow, quantity = the live carried count, same
  // feet destination (never retargeted into a pile).
  // Note "Dropped {N} {name}." mirrors the one-drop note.
  const handleDropAllItem = (itemId: string) => {
    const player = playerRef.current;
    if (!player) {
      setDropNote('Could not drop that.');
      return;
    }
    const quantity = inventory.count(itemId as ItemId);
    if (quantity <= 0) return;
    try {
      const pile = dropFromInventory(
        itemId,
        quantity,
        inventory,
        player.x,
        player.z,
      );
      pileState.drop(pile.item, pile.quantity, pile.x, pile.z);
      inventory.setWorn(wardrobe.wornItemIds());
      setWornGarments(wardrobe.wornGarments());
      setDropNote(`Dropped ${quantity} ${displayNameFor(itemId)}.`);
    } catch (error) {
      setDropNote(
        error instanceof Error ? error.message : 'Could not drop that.',
      );
    }
    refreshInventory();
    saveNow();
  };

  /**
   * COOKING BRIDGE (DEV decision, gap-closing round — see the
   * header): one Systems FireState per placed fire, created
   * lazily here. Engine lit is the gate and the authority.
   * VESSEL SYNC (DEV ruling, 2026-11-01): the shell never
   * lights a vessel to mirror an engine fire — mirroring is
   * bookkeeping, not a lighting act. The vessel waits unlit
   * while the engine fire lights; when a Cook/Char press
   * finds the engine fire lit, ensureSystemsLit ADOPTS that
   * state into the vessel (FireState.adoptLit — cost-free,
   * never throws), so cook()/charStick() never run against
   * a vessel the engine hasn't lit, and never refuse at an
   * honestly lit fire over a kindling the world never
   * charged. The priced FireState.light() belongs to
   * genuine lighting acts on the vessel itself, of which
   * the shell performs none.
   */
  const getSystemsFire = (fireId: string): SystemsFireState => {
    const existing = systemsFiresRef.current.get(fireId);
    if (existing) return existing;
    const created = new SystemsFireState();
    systemsFiresRef.current.set(fireId, created);
    return created;
  };

  /**
   * Bring a Systems vessel to lit for an engine-lit fire:
   * the vessel ADOPTS the engine's lit state (VESSEL SYNC —
   * see the bridge header). Adoption is cost-free and never
   * throws; the only callers are the Cook and Char handlers,
   * which sit in lit-fire menus, so the engine fire is lit
   * whenever this runs. (fireId names the fire for the
   * bridge's bookkeeping; the adoption itself needs nothing
   * but the vessel.)
   */
  const ensureSystemsLit = (
    fireId: string,
    systemsFire: SystemsFireState,
  ) => {
    void fireId;
    if (systemsFire.lit) return;
    systemsFire.adoptLit();
  };

  /**
   * Record how an engine lighting started. The vessel is
   * deliberately NOT lit here (VESSEL SYNC, DEV ruling
   * 2026-11-01): mirroring a start through the priced
   * light() charged a second kindling for a fire the world
   * was already lighting. The vessel waits unlit and adopts
   * the lit state at the first Cook/Char press
   * (ensureSystemsLit). Only the path record lives here.
   */
  const mirrorLightingStart = (
    fireId: string,
    method: 'flint' | 'friction' | 'candle',
  ) => {
    engineFirePathRef.current.set(fireId, method);
  };

  /** Lighting + cooking menu actions for one placed fire. */
  // Lighting progress bar (Adam, 2026-10-28): the fire menu's
  // header, shown only while a lighting process exists (no
  // process → null, no bar). Derived per render from
  // PlacedFire.lighting — no new state, no new timer: the
  // bar advances on the existing 1 s tick + fire:lighting
  // refreshes, and freezes on pause by construction
  // (waitUntil shifts on pause, so the waiting fraction
  // stops moving; clicks don't advance while paused because
  // lighting state doesn't change). Labels mirror the chip
  // detail + menu action words exactly, so the bar never
  // contradicts them. Menu-only — the chip keeps text.
  const lightingBarFor = (fire: PlacedFire) => {
    const lighting = fire.lighting;
    if (lighting === null) return null;
    const bar = (fraction: number, label: string) => (
      <div>
        <div className="h-2 w-full overflow-hidden rounded bg-black/40">
          <div
            className="h-full rounded bg-amber-400"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-stone-300">{label}</p>
      </div>
    );
    if (lighting.method === 'friction') {
      if (lighting.phase === 'ready') {
        return bar(1, 'Ready — rub again');
      }
      const fraction = Math.min(
        1,
        Math.max(
          0,
          1 - (lighting.waitUntil - Date.now()) / FRICTION_WAIT_MS,
        ),
      );
      return bar(fraction, `Waiting… ${Math.round(fraction * 100)}%`);
    }
    if (lighting.method === 'candle') {
      // The candle's wait (the salves + moss batch,
      // 2026-11-03): Background's engine rider made
      // the candle a waiting process on friction's
      // shape — the bar mirrors that shape over the
      // candle's own 2 s wait. Without this branch
      // the bar fell through to the flint clicks
      // reading (Systems' flag on the assembled
      // tree) and rendered a clicks count the
      // process does not carry.
      const fraction = Math.min(
        1,
        Math.max(
          0,
          1 - (lighting.waitUntil - Date.now()) / CANDLE_WAIT_MS,
        ),
      );
      return bar(fraction, `Waiting… ${Math.round(fraction * 100)}%`);
    }
    return bar(
      lighting.clicks / FLINT_CLICKS,
      `Clicks ${lighting.clicks} of ${FLINT_CLICKS}`,
    );
  };
  const fireMenuActions = (fire: PlacedFire): ContextAction[] => {
    // THE HEARTH-SIDE CAULDRON DOOR (the cauldron fix,
    // 2026-11-01): the pack's Place press worked whole,
    // but the hearth itself offered nothing — face an
    // unoccupied hearth with the cauldron carried and
    // its own menu now offers the setting. No lit gate
    // (the grant has none — she sets the pot before she
    // lights the hearth), so the row joins every list a
    // hearth can show. Label DRAFT for Adam's pin pass
    // ('Place cauldron' / 'Set cauldron' both ride).
    const cauldronActions: ContextAction[] =
      fire.type === 'hearth' &&
      inventory.count(ITEMS.cauldron) > 0 &&
      cauldronState.cauldronForHearth(fire.id) === undefined
        ? [{ id: 'place-cauldron', label: 'Place cauldron' }]
        : [];
    // THE HEARTH'S PICK-UP (the furniture pattern,
    // 2026-11-05 — Adam: the hearth is furniture,
    // heavy but movable): a hearth's own menu carries
    // its Pick up in EVERY list a hearth can show
    // (lit, lighting, unlit) — Systems' pickupHearth
    // guards (the cauldron speaks first) and catches
    // (20 lb) under it. Campfire + kiln stay
    // place-once: no row for them.
    const hearthActions: ContextAction[] =
      fire.type === 'hearth'
        ? [{ id: 'pick-up-hearth', label: 'Pick up Hearth' }]
        : [];
    if (fire.lit) {
      const hasAcorns = inventory.count(FOOD_ACORNS) > 0;
      const hasSnapWood = inventory.count(CHAR_INPUT_ITEM) > 0;
      const unlitTorches = inventory.count(ITEMS.torch);
      return [
        ...cauldronActions,
        ...(unlitTorches >= 1
          ? [
              {
                id: 'light-torches',
                label: 'Light torches',
                hint: `×${unlitTorches}`,
              },
            ]
          : []),
        {
          id: 'cook-stick',
          label: 'Cook acorns (stick)',
          disabled: !hasAcorns,
          disabledNote: hasAcorns ? undefined : 'Needs carried acorns',
        },
        {
          id: 'cook-buried',
          label: 'Cook acorns (buried)',
          disabled: !hasAcorns,
          disabledNote: hasAcorns ? undefined : 'Needs carried acorns',
        },
        {
          id: 'char-stick',
          label: 'Char a stick',
          disabled: !hasSnapWood,
          disabledNote: hasSnapWood
            ? undefined
            : 'Needs carried snap wood',
        },
        ...hearthActions,
        { id: 'close', label: 'Close [X]' },
      ];
    }
    if (fire.lighting?.method === 'flint') {
      return [
        ...cauldronActions,
        {
          id: 'click-flint',
          label: `Click flint (${fire.lighting.clicks} of 3)`,
        },
        ...hearthActions,
        { id: 'close', label: 'Close [X]' },
      ];
    }
    if (fire.lighting?.method === 'friction') {
      return [
        ...cauldronActions,
        {
          id: 'rub',
          label:
            fire.lighting.phase === 'ready' ? 'Rub — light it' : 'Rub',
          hint:
            fire.lighting.phase === 'ready'
              ? undefined
              : 'Wait for the wait to end, then rub',
        },
        ...hearthActions,
        { id: 'close', label: 'Close [X]' },
      ];
    }
    if (fire.lighting?.method === 'candle') {
      // The candle's process needs no second press —
      // the wait IS the lighting (the header bar
      // carries its progress). Rows: Close only.
      return [...cauldronActions, ...hearthActions,
        { id: 'close', label: 'Close [X]' }];
    }
    const hasFlint = inventory.count(ITEMS.flint) > 0;
    return [
      ...cauldronActions,
      {
        // THE CANDLE DOOR (UI, 2026-11-03; Adam's pin
        // via DEV — she walks around with a candle, so
        // she lights fires with that): offered
        // UNCONDITIONALLY. The carried light satisfies
        // the method; no candle item is required or
        // consumed (the crafted item keeps its altar
        // uses). The row was ABSENT from this list
        // until now — every layer beneath the door
        // (engine process, save mirror, the bar) was
        // wired in the salves + moss batch, and Adam's
        // campfire would not light by candle because
        // no door ever called startLighting with it.
        // Label + hint DRAFT for Adam's pin pass.
        id: 'light-candle',
        label: 'Light with candle',
        hint: 'From her carried candle',
      },
      {
        id: 'light-flint',
        label: 'Light with flint',
        disabled: !hasFlint,
        disabledNote: hasFlint ? undefined : 'Needs a carried flint',
      },
      {
        id: 'light-friction',
        label: 'Light with friction (slow)',
        hint: 'Rub, wait, rub',
      },
      ...hearthActions,
        { id: 'close', label: 'Close [X]' },
    ];
  };

  const handleFireAction = (fireId: string, actionId: string) => {
    const fire = fireState.get(fireId);
    if (!fire) return;
    const say = (text: string, tone: FeedbackTone) => {
      showFeedback(text, tone);
    };
    if (actionId === 'close') {
      setSelectedFireId(null);
      return;
    }
    if (actionId === 'place-cauldron') {
      // The EXISTING composition (the pack press's own):
      // the grant reads the faced winner, which is this
      // hearth while its menu stands open.
      handlePlaceCauldron();
      return;
    }
    if (actionId === 'pick-up-hearth') {
      // THE HEARTH PICK-UP (the furniture pattern):
      // Systems' grant judges the seat (a cauldron on
      // it refuses first, in its words; then the catch
      // law at 20 lb) — a refusal voices the reason and
      // the menu STAYS (she can lift the cauldron from
      // this same menu); success removes the fire
      // record through Background's seat and the
      // lit-ness rides the granted item id. A lighting
      // process in flight is not a lit fire and does
      // not ride (Systems' rule) — fire.lit is the
      // seat's fact, so it reads false mid-lighting.
      const outcome = pickupHearth(inventory, {
        cauldron: cauldronState.cauldronForHearth(fire.id) !== undefined,
        lit: fire.lit,
      });
      // Equality check, not truthiness (the desk note).
      if (outcome.taken === false) {
        say(outcome.reason, 'blocked');
        return;
      }
      fireState.removeFire(fire.id);
      setSelectedFireId(null);
      refreshInventory();
      saveNow();
      say('Picked up the hearth.', 'gain');
      recomputeAnchors();
      return;
    }
    if (actionId === 'light-candle') {
      // The candle door's act (see the row in
      // fireMenuActions): the engine seats the 2 s
      // waiting process and its tick lights the fire
      // — no item is consulted or consumed, here or
      // in the engine. The menu stays open on the
      // waiting rows (bar in the header) until the
      // fire lights.
      const result = fireState.startLighting(fireId, 'candle', Date.now());
      if (isFireFailure(result)) {
        say(`Cannot light: ${result.reason}.`, 'blocked');
        return;
      }
      mirrorLightingStart(fireId, 'candle');
      say('She lights it from her candle.', 'info');
    } else if (actionId === 'light-flint') {
      const result = fireState.startLighting(fireId, 'flint', Date.now());
      if (isFireFailure(result)) {
        say(`Cannot light: ${result.reason}.`, 'blocked');
        return;
      }
      mirrorLightingStart(fireId, 'flint');
      say('Flint ready — click flint 3 times.', 'info');
    } else if (actionId === 'click-flint') {
      const result = fireState.flintClick(fireId);
      if (isFireFailure(result)) {
        say(`Cannot click: ${result.reason}.`, 'blocked');
        return;
      }
      if (result.fire.lit) {
        say('Lit!', 'gain');
        setSelectedFireId(null);
      } else if (
        result.fire.lighting &&
        result.fire.lighting.method === 'flint'
      ) {
        say(`Click ${result.fire.lighting.clicks} of 3.`, 'info');
      }
    } else if (actionId === 'light-friction') {
      const result = fireState.startLighting(fireId, 'friction', Date.now());
      if (isFireFailure(result)) {
        say(`Cannot light: ${result.reason}.`, 'blocked');
        return;
      }
      mirrorLightingStart(fireId, 'friction');
      say('Rubbing… wait, then rub again.', 'info');
    } else if (actionId === 'light-torches') {
      // Candle route (Adam's on-demand ruling + DEV's
      // wiring word, 2026-11-03): one behavior
      // everywhere — she lights them off her carried
      // candle, even here beside a lit fire (the door
      // names the route; the fire/flint routes stay in
      // the API unused by the doors). Batch: ALL
      // carried unlit torches in one press, nothing
      // consumed. The menu stays open; the pill itself
      // is gone on re-render (count is 0), leaving cook.
      // Equality check, not truthiness: non-strict tsc
      // does not narrow this union's boolean discriminant
      // on truthiness (see the torch Light button handler).
      const outcome = lightTorches(inventory, {
        litFirePresent: true,
        route: 'candle',
      });
      if (outcome.lit === false) {
        say(outcome.reason, 'blocked');
      } else {
        say(
          `Lit ${outcome.count} torch${outcome.count === 1 ? '' : 'es'}.`,
          'gain',
        );
      }
      refreshInventory();
      saveNow();
    } else if (actionId === 'cook-stick' || actionId === 'cook-buried') {
      // Open-fire only: stick or fire-buried, never pot
      // cooking (cook() takes no pot method). One acorn per
      // press; quantity is preserved 1:1 by cook(). The menu
      // stays open so she can cook more.
      const systemsFire = getSystemsFire(fireId);
      try {
        ensureSystemsLit(fireId, systemsFire);
        const result = cook(
          systemsFire,
          inventory,
          FOOD_ACORNS,
          1,
          actionId === 'cook-buried' ? 'buried' : 'stick',
        );
        say(
          `Cooked ${result.count} acorns → ${result.cooked} (${result.method}).`,
          'gain',
        );
      } catch (error) {
        say(
          error instanceof Error ? error.message : 'Cooking failed.',
          'blocked',
        );
      }
      refreshInventory();
      saveNow();
    } else if (actionId === 'char-stick') {
      // CHAR A STICK (Adam, 2026-10-31 — asked for at his
      // lit campfire, for the sigil): the fire panel
      // carries Systems' charStick beside Cook — the
      // second door to the charred stick (the
      // 'fire'-station recipe stays; both doors stay per
      // DEV). One stick per press, 1:1 by charStick; the
      // menu stays open so she can char more. Refusals
      // throw and speak verbatim, the cook pattern.
      const systemsFire = getSystemsFire(fireId);
      try {
        ensureSystemsLit(fireId, systemsFire);
        const result = charStick(systemsFire, inventory, 1);
        say(
          `Charred ${result.count} stick${result.count === 1 ? '' : 's'} → ${displayNameFor(result.charred)}.`,
          'gain',
        );
      } catch (error) {
        say(
          error instanceof Error ? error.message : 'Charring failed.',
          'blocked',
        );
      }
      refreshInventory();
      saveNow();
    } else if (actionId === 'rub') {
      const result = fireState.frictionRub(fireId, Date.now());
      if (isFireFailure(result)) {
        say(
          result.reason === 'still-waiting'
            ? 'Still waiting — rub again when ready.'
            : `Cannot rub: ${result.reason}.`,
          'blocked',
        );
        return;
      }
      say('Lit!', 'gain');
      setSelectedFireId(null);
    }
    setPlacedFires(fireState.snapshot());
    recomputeAnchors();
  };

  // TORCH PICKUP (Adam's torch completion, 2026-10-31):
  // ONE act behind every door — E at a faced torch, R,
  // and a tap on the torch's chip (touching the torch
  // or its pill IS the pickup, Adam's ruling; the mouse
  // unified — one verb, every pointer). The chip's old
  // window held nothing but this act and Close, so the
  // window and its selection state retired whole.
  // Grant FIRST, then the entity removal — the
  // pile-pickup rule (take granted only): a full pack
  // grants 0 and the torch stays placed, the refusal
  // spoken in the feed; a grant of 1 removes the entity
  // (emits torch:removed → refreshTorches). Pickup
  // returns 'lit-torch', lit not unlit; no hunger gate
  // (a move, like drop/pickup, not a build).
  const handlePickupTorch = (torchId: string) => {
    const torch = torchState.get(torchId);
    if (!torch) return;
    const grant = grantPickupTorch(inventory);
    if (grant.granted === 0) {
      showFeedback('Pack full — no room.', 'blocked');
      return;
    }
    torchState.removeTorch(torchId);
    showFeedback('Picked up a lit torch.', 'gain');
    refreshInventory();
    saveNow();
    setPlacedTorches(torchState.snapshot());
    recomputeAnchors();
  };

  // TENT MENU ACTIONS (tent shell): Take down + Close —
  // the torch menu's shape, over the shell store.
  const tentMenuActions = (): ContextAction[] => [
    // TENT CLIMB-IN (the bag build): the faced tent's
    // menu gains Sleep — the home row's exact idiom
    // (night-gated, 'Night only'). Sleeping through
    // this door marks the tent as the sleep site, so
    // the night composes with the shelter AT THE
    // TENT, wherever she stood to press it.
    {
      id: 'sleep',
      label: 'Sleep until Sunrise',
      disabled: !isNight,
      disabledNote: isNight ? undefined : 'Night only',
    },
    { id: 'take-down', label: 'Take down' },
    { id: 'close', label: 'Close [X]' },
  ];

  const handleTentAction = (tentId: string, actionId: string) => {
    const tent = placedTentsRef.current.find((t) => t.id === tentId);
    if (!tent) return;
    const say = (text: string, tone: FeedbackTone) => {
      showFeedback(text, tone);
    };
    if (actionId === 'close') {
      setSelectedTentId(null);
      return;
    }
    if (actionId === 'sleep') {
      sleepSiteRef.current = { kind: 'tent', x: tent.x, z: tent.z };
      setSelectedTentId(null);
      handleSleep();
      recomputeAnchors();
      return;
    }
    if (actionId === 'take-down') {
      // Grant FIRST, then the record removal — the
      // pile-pickup rule (take granted only): a full
      // pack grants 0, the tent stays placed, the menu
      // stays open; a grant of 1 removes the record
      // and the menu closes explicitly. No hunger gate
      // (a move, like drop/pickup, not a build).
      const grant = pickupTent(inventory);
      if (grant.granted === 0) {
        say('Pack full — no room.', 'blocked');
        return;
      }
      updatePlacedTents(placedTentsRef.current.filter((t) => t.id !== tentId));
      setSelectedTentId(null);
      say('Took down the tent.', 'gain');
      refreshInventory();
      saveNow();
    }
    recomputeAnchors();
  };

  // BAG MENU ACTIONS (the portable hut): Sleep until
  // Sunrise + Pick up + Close. Sleep is the bag's
  // whole point — the home row's night-gate idiom;
  // Pick up is grant-first on the tent pattern (a
  // full pack leaves the bag placed, the menu open).
  const bagMenuActions = (): ContextAction[] => [
    {
      id: 'sleep',
      label: 'Sleep until Sunrise',
      disabled: !isNight,
      disabledNote: isNight ? undefined : 'Night only',
    },
    { id: 'pick-up', label: 'Pick up' },
    { id: 'close', label: 'Close [X]' },
  ];

  const handleBagAction = (bagId: string, actionId: string) => {
    const bag = placedBagsRef.current.find((b) => b.id === bagId);
    if (!bag) return;
    const say = (text: string, tone: FeedbackTone) => {
      showFeedback(text, tone);
    };
    if (actionId === 'close') {
      setSelectedBagId(null);
      return;
    }
    if (actionId === 'sleep') {
      // The mark is the signal: the sleep stash reads
      // it and composes the night with the thatch
      // factor (Adam's pin), wherever she stood.
      sleepSiteRef.current = { kind: 'bag' };
      setSelectedBagId(null);
      handleSleep();
      recomputeAnchors();
      return;
    }
    if (actionId === 'pick-up') {
      const grant = pickupBag(inventory);
      if (grant.granted === 0) {
        say('Pack full — no room.', 'blocked');
        return;
      }
      updatePlacedBags(placedBagsRef.current.filter((b) => b.id !== bagId));
      setSelectedBagId(null);
      say('Picked up the sleeping bag.', 'gain');
      refreshInventory();
      saveNow();
    }
    recomputeAnchors();
  };

  // CAULDRON MENU ACTIONS (placed-cauldron build): Pick
  // up + Close — the tent menu's shape.
  const cauldronMenuActions = (): ContextAction[] => [
    { id: 'pick-up', label: 'Pick up cauldron' },
    { id: 'close', label: 'Close [X]' },
  ];

  const handleCauldronAction = (hearthId: string, actionId: string) => {
    const say = (text: string, tone: FeedbackTone) => {
      showFeedback(text, tone);
    };
    if (actionId === 'close') {
      setSelectedCauldronHearthId(null);
      return;
    }
    if (actionId === 'pick-up') {
      // Grant FIRST, then the entity removal — the
      // tent rule (take granted only): a pack that
      // cannot take the pot refuses, the cauldron
      // STAYS placed and the menu stays open; a
      // granted pickup removes the entity and the
      // menu closes. No hunger gate (a move).
      const outcome = grantPickupCauldron(
        inventory,
        hearthId,
        cauldronState.cauldronForHearth(hearthId) !== undefined,
      );
      if (outcome.pickedUp === false) {
        say(outcome.reason, 'blocked');
        return;
      }
      cauldronState.removeCauldron(hearthId);
      setSelectedCauldronHearthId(null);
      say('Picked up the cauldron.', 'gain');
      refreshInventory();
      saveNow();
    }
    recomputeAnchors();
  };

  // FURNITURE MENUS (the furniture-verbs build,
  // 2026-11-05 — Adam's rule: a placed thing's verbs
  // live on the thing itself): each placed bench,
  // desk, and loom carries its WORK and its PICK UP
  // on its own ContextMenu (the fire/cauldron
  // pattern), and the same pick-up rides the crafting
  // panel at its station (K parity, below). One act
  // under every door (pickupFurniturePiece); a
  // refused pick-up leaves the menu standing (the
  // cauldron rule), a completed one closes it.
  // THE HEARTHHOME DOOR (the door build, 2026-11-06;
  // Adam's ruling: the seal is laid from the faced
  // place's own menu): one press, uncosted, through
  // Systems' laySeal grant — the row stands only where
  // the mark is known (tier >= 1) and the place wears
  // no seal yet (a sealed place reads as sealed: the
  // row's absence is the display, the Hedge law). The
  // refusal lines and the success line are DRAFT copy
  // for Adam's pin pass.
  const STATION_SEAL_RADIUS_M = 3;
  const laySealAt = (place: {
    placeId: string;
    x: number;
    z: number;
    radiusM: number;
  }): boolean => {
    const outcome = hearthhomeStateRef.current.laySeal(
      fragmentStateRef.current,
      place,
      worldDayNow(),
    );
    if (outcome.ok) {
      showFeedback('The HearthHome seal settles over this place.', 'gain');
      saveNow();
      return true;
    }
    if (outcome.code === 'tier') {
      showFeedback('You have not learned the HearthHome mark.', 'blocked');
    } else if (outcome.code === 'already-sealed') {
      showFeedback('This place already wears its seal.', 'blocked');
    } else {
      showFeedback('There is no bounded place here to seal.', 'blocked');
    }
    return false;
  };
  const sealDoorRow = (placeId: string): ContextAction | null =>
    hearthhomeTier(fragmentStateRef.current) >= 1 &&
    !hearthhomeStateRef.current.hasSeal(placeId)
      ? { id: 'lay-seal', label: 'Lay the HearthHome seal' }
      : null;
  // A station seals its GROUND (the UI lane's DRAFT,
  // claimed to DEV 2026-11-06): the place id keys to
  // the piece's seat (the stump-site idiom — stable
  // across saves, and the seal stays with the ground
  // when the piece is picked up and set down nearby);
  // the radius is a working ground around the piece.
  const stationSealPlace = (
    x: number,
    z: number,
  ): { placeId: string; x: number; z: number; radiusM: number } => ({
    placeId: `station:${x.toFixed(2)},${z.toFixed(2)}`,
    x,
    z,
    radiusM: STATION_SEAL_RADIUS_M,
  });

  const workstationMenuActions = (bench: {
    id: string;
    x: number;
    z: number;
  }): ContextAction[] => {
    const actions: ContextAction[] = [
      { id: 'craft', label: 'Craft' },
      { id: 'pick-up', label: 'Pick up Crafted Workstation' },
    ];
    const sealRow = sealDoorRow(stationSealPlace(bench.x, bench.z).placeId);
    if (sealRow) actions.push(sealRow);
    actions.push({ id: 'close', label: 'Close [X]' });
    return actions;
  };

  const handleWorkstationAction = (benchId: string, actionId: string) => {
    if (actionId === 'close') {
      setSelectedWorkstationId(null);
      return;
    }
    if (actionId === 'lay-seal') {
      const bench = workstationState.get(benchId);
      if (bench) laySealAt(stationSealPlace(bench.x, bench.z));
      return;
    }
    if (actionId === 'craft') {
      setSelectedWorkstationId(null);
      openCraftingPanel();
      return;
    }
    if (actionId === 'pick-up') {
      if (pickupFurniturePiece({ kind: 'bench', id: benchId })) {
        setSelectedWorkstationId(null);
      }
    }
  };

  const deskMenuActions = (desk: PlacedDeskEntity): ContextAction[] => {
    const actions: ContextAction[] =
      desk.grimoire === true
        ? [
            { id: 'act', label: 'Take grimoire' },
            { id: 'read', label: 'Read the grimoire' },
          ]
        : [{ id: 'act', label: 'Place grimoire' }];
    actions.push({ id: 'pick-up', label: 'Pick up Writing Desk' });
    const deskSealRow = sealDoorRow(
      stationSealPlace(desk.x, desk.z).placeId,
    );
    if (deskSealRow) actions.push(deskSealRow);
    actions.push({ id: 'close', label: 'Close [X]' });
    return actions;
  };

  const handleDeskMenuAction = (deskId: string, actionId: string) => {
    if (actionId === 'close') {
      setSelectedDeskId(null);
      return;
    }
    if (actionId === 'lay-seal') {
      const desk = deskState.get(deskId);
      if (desk) laySealAt(stationSealPlace(desk.x, desk.z));
      return;
    }
    if (actionId === 'act') {
      setSelectedDeskId(null);
      handleDeskAct(deskId);
      return;
    }
    if (actionId === 'read') {
      setSelectedDeskId(null);
      handleDeskRead(deskId);
      return;
    }
    if (actionId === 'pick-up') {
      if (pickupFurniturePiece({ kind: 'desk', id: deskId })) {
        setSelectedDeskId(null);
      }
    }
  };

  const loomMenuActions = (loom: {
    id: string;
    x: number;
    z: number;
  }): ContextAction[] => {
    const actions: ContextAction[] = [
      { id: 'weave', label: 'Weave' },
      { id: 'pick-up', label: 'Pick up Loom' },
    ];
    const sealRow = sealDoorRow(stationSealPlace(loom.x, loom.z).placeId);
    if (sealRow) actions.push(sealRow);
    actions.push({ id: 'close', label: 'Close [X]' });
    return actions;
  };

  const handleLoomAction = (loomId: string, actionId: string) => {
    if (actionId === 'close') {
      setSelectedLoomId(null);
      return;
    }
    if (actionId === 'lay-seal') {
      const loom = loomState.get(loomId);
      if (loom) laySealAt(stationSealPlace(loom.x, loom.z));
      return;
    }
    if (actionId === 'weave') {
      setSelectedLoomId(null);
      openCraftingPanel();
      return;
    }
    if (actionId === 'pick-up') {
      if (pickupFurniturePiece({ kind: 'loom', id: loomId })) {
        setSelectedLoomId(null);
      }
    }
  };

  // Scry press (DEV split): the press IS the reveal — call
  // Systems' evaluation directly (no wrapper, DEV declined
  // the trivial alias per no-rebuild). Shown + camps: reveal
  // the set, show the renderer arrows, and hide the button
  // (it reappears on arrival-dismiss if she is still at
  // water). Not shown (raced a move away from the water):
  // just hide the button — Systems' evaluation is silent by
  // design, no reasons, no popups. Arrows: the renderer
  // rebuilds them from placed houses itself (shelter:placed
  // + setWorldGen); the shell only toggles visibility.
  const handleScry = () => {
    const player = playerRef.current;
    if (!player) return;
    // THE SCRY GATE (the Returning build, 2026-11-05 —
    // Adam: the live water-Scry IS Returning T1's water
    // form): scrying at water requires knowing
    // Returning's first tier (Systems' canScry is the
    // one gate read). The offer stands — scryVisible
    // is untouched — and the press explains, in the
    // standing refusal voice (the candle-door shape;
    // the pill and the R/winner door run this same
    // handler, so parity is structural). Line DRAFT.
    if (!canScry(fragmentStateRef.current)) {
      showFeedback('You have not learned the Returning mark.', 'blocked');
      return;
    }
    const gen = genRef.current;
    const waters = stillWatersNear(gen, player.x, player.z);
    const result = evaluateCampReveal(
      { x: player.x, z: player.z },
      waters,
      shelterState.snapshot(),
    );
    if (result.shown) {
      divinationRef.current.reveal(result.camps);
      rendererRef.current?.setCampArrowsVisible(true);
    }
    setScryVisible(false);
  };

  // RETURNING — THE SHELL HALF (the Returning build,
  // 2026-11-05; Systems' acts in systems/returning.ts
  // PLAN, this shell MOVES her): the facts are the
  // shell's own stores — the save's lastSleepSite and
  // the placed-house snapshot the camp arrows read.
  const returningFacts = (): ReturningBaseFacts => ({
    lastSleepSite: lastSleepSiteRef.current,
    houses: shelterState
      .snapshot()
      .map((house) => ({ x: house.x, z: house.z })),
  });

  // The base rows' names (DRAFT): the enumeration's
  // via, in plain words. One naming, used by the
  // journal rows and the arrival lines alike.
  const returningBaseName = (base: ReturningBase): string =>
    base.via === 'last-sleep' ? 'Last sleep' : 'Placed house';

  // THE MOVE: seat her at a Returning destination,
  // under the standing law — a written position is
  // validated against real collision BEFORE she
  // stands there (the stuck-in-ruin lesson). The
  // landing validates in the TARGET dimension first
  // (the cave layout's walls, the attic layout's
  // walls; a surface record stands as she left it —
  // she slept / built / named it standing there).
  // Cross-dimension travel rides the LAWFUL doors
  // (enterCave by the mouth serving the key,
  // enterUpstairs by its house key, the matching
  // exits) and then seats at the destination inside
  // the dimension — dimensionTravel's private return
  // state stays honest, so the ordinary exit doors
  // still work after a scry arrival. False = the way
  // would not open; nothing has moved on a refusal
  // the validation caught, and the travel doors
  // refuse cleanly on their own.
  const seatAtReturningDestination = (dest: {
    x: number;
    z: number;
    dimensionKey: string;
  }): boolean => {
    const player = playerRef.current;
    const renderer = rendererRef.current;
    const gen = genRef.current;
    if (!player || !renderer || !gen) return false;
    const seed = String(gen.seed);
    const spawn = gen.findSpawn();
    const weightsAt = (x: number, z: number) => gen.weightsAt(x, z);
    if (dest.dimensionKey.startsWith('cave:')) {
      const layout = caveLayoutForKey(seed, dest.dimensionKey);
      if (
        !anchorClear({ x: dest.x, z: dest.z }, layout.footprint.walls)
      ) {
        return false;
      }
    } else if (dest.dimensionKey.startsWith('attic:')) {
      const layout = atticLayoutForKey(
        seed,
        spawn,
        weightsAt,
        dest.dimensionKey,
      );
      if (!layout || !anchorClear({ x: dest.x, z: dest.z }, layout.walls)) {
        return false;
      }
    }
    const active = dimensionState.activeKey();
    if (dest.dimensionKey !== active) {
      // Leave a non-surface dimension by its own door.
      if (dimensionState.isUnderground()) {
        if (exitCave(renderer, player).ok === false) return false;
      } else if (isUpstairsKey(active)) {
        if (exitUpstairs(renderer, player).ok === false) return false;
      }
      if (dest.dimensionKey.startsWith('cave:')) {
        const mouthId =
          dest.dimensionKey === CAVE_DIMENSION_KEY
            ? 'mouth'
            : dest.dimensionKey;
        if (enterCave(renderer, player, gen, mouthId).ok === false) {
          return false;
        }
      } else if (dest.dimensionKey.startsWith('attic:')) {
        const houseKey = dest.dimensionKey.slice('attic:'.length);
        if (enterUpstairs(renderer, player, gen, houseKey).ok === false) {
          return false;
        }
      } else if (dest.dimensionKey !== 'surface') {
        return false;
      }
    }
    // The placeAt pattern (dimensionTravel): a travel
    // IS a move, so the emit rides along.
    player.x = dest.x;
    player.z = dest.z;
    bus.emit('player:moved', {
      x: player.x,
      z: player.z,
      chunkX: Math.floor(player.x / CHUNK_SIZE),
      chunkZ: Math.floor(player.z / CHUNK_SIZE),
    });
    return true;
  };

  // A completed Returning travel's housekeeping: the
  // book closes (she is somewhere else now), the camp
  // arrows clear, the world saves as it stands.
  const finishReturningTravel = (line: string) => {
    setJournalOpen(false);
    rendererRef.current?.setCampArrowsVisible(false);
    setScryVisible(false);
    showFeedback(line, 'gain');
    saveNow();
  };

  // THE PLACES-PAGE SCRY (Returning v1, 2026-11-05):
  // the seated selection is the door. The FIRST base
  // row is the home destination — its Scry calls
  // planReturnHome (T2: no medium, the tier is the
  // price). Every other row — a later base, a named
  // place — calls planReturnToPlace (T3, through a
  // medium: the carried crystal ball, or the still
  // water she stands at). The acts judge; the shell
  // voices refusals in draft words and moves her on
  // theirs. All lines DRAFT.
  const handleScryTarget = () => {
    const id = selectedPlaceRef.current;
    if (!id) return;
    const fragments = fragmentStateRef.current;
    const facts = returningFacts();
    if (id.startsWith('base:')) {
      const bases = listBases(facts);
      if (bases.length > 0 && bases[0].id === id) {
        const outcome = planReturnHome(fragments, facts);
        if (outcome.ok === false) {
          showFeedback(
            outcome.code === 'no-base'
              ? 'You have no base to return to.'
              : "Returning's second tier is not yours yet.",
            'blocked',
          );
          return;
        }
        if (!seatAtReturningDestination(outcome.destination)) {
          showFeedback('The way will not open.', 'blocked');
          return;
        }
        finishReturningTravel(
          outcome.via === 'last-sleep'
            ? 'The mark brings you back to where you last slept.'
            : 'The mark brings you back to your house.',
        );
        return;
      }
      const base = baseById(facts, id);
      if (!base) return;
      runPlaceScry(
        { x: base.x, z: base.z, dimensionKey: base.dimensionKey },
        returningBaseName(base),
      );
      return;
    }
    const place = namedPlacesRef.current.get(id);
    if (!place) return;
    runPlaceScry(
      { x: place.x, z: place.z, dimensionKey: place.dimensionKey },
      place.name,
    );
  };

  const runPlaceScry = (
    target: { x: number; z: number; dimensionKey: string },
    label: string,
  ) => {
    const player = playerRef.current;
    const gen = genRef.current;
    if (!player || !gen) return;
    // The water fact is the FILL-JAR idiom (Systems'
    // published caller fact): standing AT a source —
    // the still-water EDGE within scry range (2.5 m),
    // the same fact the Scry offer reads. A body
    // merely within the 50 m adapter sweep is NOT
    // standing at water (the first drive's R5 caught
    // exactly that overreach: it travelled from dry
    // ground near a pond).
    const atWater = isNearStillWater(
      player.x,
      player.z,
      stillWatersNear(gen, player.x, player.z),
    );
    const outcome = planReturnToPlace(
      fragmentStateRef.current,
      inventory,
      target,
      { atWater },
    );
    if (outcome.ok === false) {
      showFeedback(
        outcome.code === 'tier'
          ? "Returning's third tier is not yours yet."
          : outcome.code === 'no-medium'
            ? 'No medium to see through — carry a crystal ball, or stand at still water.'
            : 'That place cannot be seen.',
        'blocked',
      );
      return;
    }
    if (!seatAtReturningDestination(outcome.destination)) {
      showFeedback('The way will not open.', 'blocked');
      return;
    }
    finishReturningTravel(
      outcome.medium === 'crystal-ball'
        ? `Seen in the crystal ball — you stand at "${label}".`
        : `Seen in the water — you stand at "${label}".`,
    );
  };

  // LOOK press (DEV-approved target: nearest in-range
  // harvest target, kind-keyed): the button targets the
  // nearest SCATTER target only. Ground (dirt/mud/grass)
  // is skipped by design, flagged: ground-first order is
  // a harvest rule, ground is not a thing to look closely
  // at, and DEV's table holds no ground portions — a
  // ground LOOK would only ever show a dead plain name
  // while counting toward practice. DEV can redirect to
  // verbatim ground-first in one line (drop the scatter
  // filter). Unlisted scatter kinds record an empty look
  // and show the plain name, per DEV's null rule (flagged:
  // empty looks count toward practice). No hunger gate:
  // looking is observation, not action.
  // LOOK PARKED (Adam, 2026-10-28: "We'll park the
  // look notion for now"): the world-LOOK button is
  // HIDDEN, not deleted — LOOK is dormant and
  // reversible. Everything behind it STAYS: NameSight
  // state + save wiring, the lookPortions table,
  // handleLook itself, and the pickup-look wiring
  // (recordBonePickupLook) — the pickup-look helper
  // is the tier-1 gate path, not the LOOK button, and
  // it stays ACTIVE; the speak-name gate stays
  // pickup-look. Unpark = set this false (one line).
  const LOOK_PARKED = true;

  const handleLook = () => {
    const target = harvestTargets.find((t) => t.kind === 'scatter');
    if (!target) return;
    const key = lookKeyForTarget(target);
    if (!key) return;
    // Bone scatter targets (bone build): the scatter
    // kind is generic 'bone', but knowledge is KIND
    // keyed — the kind resolves from the TARGET
    // position encoded in the id ('scatter:chunk:kind:
    // x,z', same rule as harvest yields), never the
    // player's. A malformed position looks at nothing
    // (no look recorded, no invented kind). Portions
    // come from the kind's table entry (DEV-approved
    // triple); first look shows 'Bone' (family), shape
    // arrives via pickup identification, not LOOK.
    let lookKey = key;
    if (key === 'bone') {
      const position = target.id.split(':')[3];
      const coords = position ? position.split(',') : [];
      const x = Number(coords[0]);
      const z = Number(coords[1]);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      lookKey = boneKindAt(genRef.current.seed, x, z);
    }
    const result = nameSightRef.current.look(
      lookKey,
      portionsForKind(lookKey) ?? [],
    );
    setLookResult({ targetId: target.id, text: result.display ?? target.name });
    saveNow();
  };

  // The LOOK button's target, derived for the overlay: the
  // nearest scatter target (first scatter in tracker order).
  const lookTarget = harvestTargets.find((t) => t.kind === 'scatter');

  // Pile menu actions (chip menu, Adam's full pile ruling):
  // selective take + deposit, scoped to the pile's item.
  // Deposit is disabled when she carries none of it (the
  // menu reads the live count at render, and the press
  // re-reads it — a stale enabled button can never
  // deposit what is not there).
  // Multi-kind pile menu actions. The menu lists the pile's
  // kinds LIVE in stacks order (first-dropped first), each
  // with per-kind Take one / Take all; then deposit rows
  // for every carried kind (one / all of a kind) — a
  // carried kind not yet in the pile deposits as a new
  // stack entry on drop merge. A kind in the pile she
  // carries none of shows its deposit rows disabled with a
  // "Needs carried" note, so deposit stays discoverable.
  // Labels carry the kind (ContextMenu has no section
  // headers) so a long menu stays scannable. Action ids
  // encode verb + kind (ids never contain ':').
  // Pile menu entries: ONE kind-entry per kind — pile kinds in
  // stacks order, then carried kinds not in the pile — each
  // carrying its arrow buttons under the SAME action ids the
  // text rows used (take-one/take-all/deposit-one/
  // deposit-all:kind), so handlePileAction below is untouched
  // and every verb/quantity behaves exactly as today. Only
  // the rendering changes (ContextMenu's kind-entry branch).
  // Take arrows render iff the pile holds the kind: a kind
  // taken to zero leaves the entry entirely when nothing is
  // carried, and stays deposit-only when carried. Deposit
  // arrows always render, disabled iff carried is 0 (with
  // the "Needs carried" note under the arrows row).
  // WORN GEAR (Adam, 2026-10-28): clothing, storage, and tools
  // move up beside the avatar portrait, out of the droppable
  // row list, and are NEVER droppable from the UI. The
  // portrait section lists worn ∩ carried garments (slot
  // order via wornItemIds), carried storage gear (small
  // basket, large basket), and the owned tool only
  // (ownedToolItem; 'none' when no tool). Carried-but-unworn
  // garments stay normal rows (loose until worn); the
  // umbrella is not gear (counts 1 lb) and stays a normal
  // row. Bonuses are the systems numbers: garments from
  // WORN_CAPACITY_BONUS (mittens/boots 0 → worn mark only;
  // the apron's +10 rides there too since it became a
  // garment, 2026-10-29);
  // large basket +50, small basket +25 — except
  // when large is also carried, small shows +0 ("large
  // basket carries": large REPLACES small, pinned). The
  // owned tool rides free; Trundle-Tool adds +50 lb.
  // wornGear.ids (normalized) drives both the panel row
  // filter (rows gone → Drop and home-Deposit gone with
  // them) and the pile-menu deposit filter below (deposit
  // arrows gone for worn-gear kinds; Take arrows stay as
  // recovery, and home Withdraw stays). Functions are
  // untouched (handleDropItem, handleDepositItem,
  // handlePileAction stay for loose items).
  const wornGear = (() => {
    const ids: string[] = [];
    const sections: { title: string; entries: string[] }[] = [];
    const clothing: string[] = [];
    for (const item of wardrobe.wornItemIds()) {
      if (inventory.count(item) < 1) {
        continue;
      }
      ids.push(item);
      const bonus = WORN_CAPACITY_BONUS[item] ?? 0;
      clothing.push(
        bonus > 0
          ? `${displayNameFor(item)} — worn, +${bonus} lb`
          : `${displayNameFor(item)} — worn`,
      );
    }
    if (clothing.length > 0) {
      sections.push({ title: 'Clothing', entries: clothing });
    }
    // POCKETS LINE (Adam, 2026-10-29: "include the
    // starting 10# for pockets"): the base capacity she
    // always has opens the Storage section as a TEXT-ONLY
    // first entry — pockets is not an item, so it never
    // enters ids or any gear logic; display string only.
    // The section therefore always renders (the readout
    // accounts for her full capacity). The 10 was already
    // in the total — capacity math is unchanged.
    const storage: string[] = ['Pockets — +10 lb'];
    const largeCarried = inventory.count(ITEMS.largeBasket) >= 1;
    // NO APRON BLOCK HERE (removed 2026-10-29, Adam's
    // overrule — "people wear aprons"): the apron is a
    // garment now, so a WORN apron lists under Clothing
    // above via wornItemIds + WORN_CAPACITY_BONUS, and an
    // unworn one is an ordinary row. The old block here
    // claimed "+10 lb" for merely carrying one and
    // double-listed a worn one.
    if (inventory.count(ITEMS.smallBasket) >= 1) {
      ids.push(ITEMS.smallBasket);
      storage.push(
        largeCarried
          ? `${displayNameFor(ITEMS.smallBasket)} — +0 — large basket carries`
          : `${displayNameFor(ITEMS.smallBasket)} — +25 lb`,
      );
    }
    if (largeCarried) {
      ids.push(ITEMS.largeBasket);
      storage.push(`${displayNameFor(ITEMS.largeBasket)} — +50 lb`);
    }
    sections.push({ title: 'Storage', entries: storage });
    const owned = ownedToolItem(inventory);
    if (owned !== 'none') {
      ids.push(owned);
      sections.push({
        title: 'Tools',
        entries: [
          owned === ITEMS.trundleTool
            ? `${displayNameFor(owned)} — +50 lb`
            : displayNameFor(owned),
        ],
      });
    }
    return {
      sections,
      ids: new Set(ids.map((item) => normalizeItemId(item as ItemId))),
    };
  })();

  // The pile modal's model, as unified item rows + verbs
  // (Inventory Unification, 2026-10-31 — this replaces the
  // ContextAction dialect pileMenuActions used to build;
  // the worn-gear and counts rules below are unchanged,
  // only the shape moved). Verb ids stay the standing
  // pile action ids ('take-one:<kind>' etc.) so
  // handlePileAction dispatches them verbatim.
  const pileModalModel = (
    pile: PileTarget,
  ): {
    items: InventoryItem[];
    verbsByItem: ReadonlyMap<string, ItemListVerb[]>;
  } => {
    const items: InventoryItem[] = [];
    const verbsByItem = new Map<string, ItemListVerb[]>();
    const pileKinds = new Set(
      pile.stacks.map((stack) => normalizeItemId(stack.item as ItemId)),
    );
    for (const stack of pile.stacks) {
      const name = displayNameFor(stack.item);
      const carried = inventory.count(stack.item as ItemId);
      const noCarried = carried <= 0;
      // Worn gear is never droppable: deposit verbs are
      // GONE for worn-gear kinds (not disabled), while Take
      // verbs stay as the recovery path.
      const isWornGear = wornGear.ids.has(
        normalizeItemId(stack.item as ItemId),
      );
      items.push({
        id: stack.item,
        name,
        section: 'pile',
        category: categoryFor(stack.item as ItemId),
        titleMeta: `${pileTitleMetaFor(stack.item, stack.quantity)} · carried ×${carried}`,
        note: noCarried ? `Needs carried ${name}` : undefined,
      });
      verbsByItem.set(stack.item, [
        {
          id: `take-one:${stack.item}`,
          glyph: '↑',
          ariaLabel: `Pick up one ${name}`,
        },
        {
          id: `take-all:${stack.item}`,
          glyph: '↑↑',
          ariaLabel: `Pick up all ${name}`,
        },
        ...(isWornGear
          ? []
          : [
              {
                id: `deposit-one:${stack.item}`,
                glyph: '↓',
                ariaLabel: `Drop one ${name} here`,
                disabled: noCarried,
              },
              {
                id: `deposit-all:${stack.item}`,
                glyph: '↓↓',
                ariaLabel: `Drop all ${name} here`,
                disabled: noCarried,
              },
            ]),
      ]);
    }
    for (const stack of inventory.stacksSnapshot()) {
      if (pileKinds.has(stack.item)) continue;
      // Worn-gear kinds carried but not in this pile get no
      // entry at all (no deposit path, nothing to take).
      if (wornGear.ids.has(normalizeItemId(stack.item as ItemId))) continue;
      const name = displayNameFor(stack.item);
      items.push({
        id: stack.item,
        name,
        section: 'pack',
        category: categoryFor(stack.item as ItemId),
        titleMeta: `${pileTitleMetaFor(stack.item, stack.quantity)} · pile ×0`,
      });
      verbsByItem.set(stack.item, [
        {
          id: `deposit-one:${stack.item}`,
          glyph: '↓',
          ariaLabel: `Drop one ${name} here`,
        },
        {
          id: `deposit-all:${stack.item}`,
          glyph: '↓↓',
          ariaLabel: `Drop all ${name} here`,
        },
      ]);
    }
    return { items, verbsByItem };
  };

  // Multi-kind pile menu press. The menu STAYS OPEN after a
  // press — "one by one" means repeated presses without
  // reopening — and re-renders from live piles: a kind
  // taken to zero leaves the menu, a deposit's new kind
  // joins it, an emptied pile closes it (auto-close in
  // refreshPilesFromState / piles:inRange). Only Close
  // closes it explicitly. Outcome handling mirrors the
  // take-all listener (missing pile/kind: silent; full
  // pack: Pack-full note, no refresh/save; grant: refresh
  // + save + feedback). Take calls Systems' menu handler
  // directly (no bus listener for it — the TAPPED kind,
  // verbatim stack item since pileState matches verbatim;
  // 1 for Take one, the kind's quantity for Take all; the
  // handler caps at the live kind quantity). Deposit calls
  // depositIntoPile + one pileState.drop with the pile's
  // EXACT x/z verbatim — never rounded, never recomputed
  // from her position — so a deposit to a gone pile still
  // lands at those coords (drop creates when nothing
  // matches). Both paths refresh the chip straight from
  // pileState after acting (see refreshPilesFromState).
  // Menu feedback (shared by the pile + home menus): the
  // object's anchor when visible, else her feet (ground
  // rule, always visible) — a menu action's result must
  // never vanish silently. Hoisted from handlePileAction
  // so the home handler shares it verbatim (moved, not
  // re-authored — same body, same call sites).
  const handlePileAction = (pile: PileTarget, actionId: string) => {
    if (actionId === 'close') {
      selectedPileIdRef.current = null;
      setSelectedPileId(null);
      return;
    }
    const sep = actionId.indexOf(':');
    if (sep < 0) return;
    const verb = actionId.slice(0, sep);
    const kind = actionId.slice(sep + 1);
    if (verb === 'take-one' || verb === 'take-all') {
      const stack = pile.stacks.find((entry) => entry.item === kind);
      const quantity = verb === 'take-one' ? 1 : (stack?.quantity ?? 0);
      if (quantity <= 0) return;
      const outcome = handlePileTakeRequest(
        pile.id,
        kind as ItemId,
        quantity,
        pileState,
        inventory,
      );
      if (!outcome.found) return;
      if (outcome.granted <= 0) {
        showFeedback(`Pack full — no room for ${displayNameFor(outcome.item)}.`,
          'blocked',
        );
        return;
      }
      // PICKUP COUNTS AS A LOOK (same ruling as the
      // harvest path): a menu take that grants a bone
      // records 1 LOOK at its kind, before saveNow.
      // A failed/full-pack take (granted 0) records
      // nothing — the return above already left.
      {
        const item = normalizeItemId(outcome.item);
        const kind = isBoneItem(item) ? boneKindFor(item) : null;
        if (kind !== null) {
          recordBonePickupLook(
            item,
            nameSightRef.current,
            portionsForKind(kind) ?? [],
          );
        }
      }
      refreshInventory();
      saveNow();
      refreshPilesFromState();
      showFeedback(outcome.granted === outcome.requested
          ? `Picked up ${outcome.granted} ${displayNameFor(outcome.item)}.`
          : `Picked up ${outcome.granted} of ${outcome.requested} ${displayNameFor(outcome.item)}.`,
        'gain',
      );
      return;
    }
    if (verb === 'deposit-one' || verb === 'deposit-all') {
      const carried = inventory.count(kind as ItemId);
      const quantity = verb === 'deposit-one' ? 1 : carried;
      if (quantity <= 0) return;
      try {
        const record = depositIntoPile(
          pile,
          kind as ItemId,
          quantity,
          inventory,
        );
        pileState.drop(record.item, record.quantity, record.x, record.z);
        refreshInventory();
        saveNow();
        refreshPilesFromState();
        showFeedback(`Deposited ${record.quantity} ${displayNameFor(record.item)}.`,
          'gain',
        );
      } catch (error) {
        showFeedback(error instanceof Error ? error.message : 'Could not deposit that.',
          'blocked',
        );
      }
    }
  };

  // Home menu press (Adam, 2026-10-28): the home menu's
  // Rest + Store + Take actions. Parse shape mirrors
  // handlePileAction (verb:kind); the menu STAYS OPEN
  // after every press except Close — entries re-render
  // from live inventory + store, so counts update in
  // place. Notes join the message feed (the panel's
  // storageNote is the panel's surface, not the menu's). Single transfers mirror the panel's
  // add-first atomicity per unit; all-transfers loop
  // singles until the source is exhausted or the
  // destination throws, and partial results stand. One
  // refresh + one save at the end of each press, never
  // per loop unit.
  // THE LAYING WORKING'S TICK: while a working
  // stands, a short interval accumulates its
  // progress (unpaused only), watches its
  // interruptions, and completes it into Systems'
  // grant. Interruption = the menu closed or the
  // faced home changed — the working clears and
  // voices its undoing ONCE; nothing was consumed,
  // nothing laid (the cost-at-completion law).
  useEffect(() => {
    if (hedgeWorking === null) return;
    const timer = setInterval(() => {
      const working = hedgeWorkingRef.current;
      if (working === null) return;
      const house = shelterState
        .snapshot()
        .find((h) => h.id === working.homeId);
      if (!homeMenuOpen || house === undefined) {
        hedgeWorkingRef.current = null;
        setHedgeWorking(null);
        showFeedback('The laying is undone — nothing was spent.', 'blocked');
        return;
      }
      if (!pausedRef.current) {
        working.progressMs += 250;
        setHedgeWorking({ ...working });
      }
      if (working.progressMs < HEDGE_WORK_MS) return;
      // COMPLETION — the grant judges everything
      // again (a state that changed under the
      // working refuses honestly, in its own code).
      hedgeWorkingRef.current = null;
      setHedgeWorking(null);
      const outcome = hedgeStateRef.current.layHedge(
        fragmentStateRef.current,
        inventory,
        { homeId: house.id, x: house.x, z: house.z },
        worldDayNow(),
      );
      if (outcome.ok === false) {
        showFeedback(
          outcome.code === 'already-hedged'
            ? 'This home already wears its hedge.'
            : outcome.code === 'no-cuttings'
              ? `The laying wants ${CUTTINGS_TO_LAY} cuttings — you carry ${inventory.count(ITEMS.cuttings)}.`
              : outcome.code === 'tier'
                ? 'You have not learned the Hedge mark.'
                : 'There is no home here to ring.',
          'blocked',
        );
        return;
      }
      refreshInventory();
      saveNow();
      showFeedback(
        'The hedge is laid around this home. It roots by tomorrow, and then it works.',
        'gain',
      );
    }, 250);
    return () => clearInterval(timer);
    // The deps re-arm the interval when the menu
    // opens/closes (the interruption read must see a
    // fresh homeMenuOpen; the progress itself lives
    // in the ref, so re-arming loses nothing).
    // HEDGE_WORK_MS is a component constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hedgeWorking === null, homeMenuOpen]);

  const handleHomeMenuAction = (actionId: string) => {
    if (actionId === 'close') {
      setHomeMenuOpen(false);
      return;
    }
    if (actionId === 'storage') {
      // The menu's storage door: close the menu, open
      // the pack — the opener binds this house (the
      // menu only stands while she shelters here).
      setHomeMenuOpen(false);
      openInventoryPanel();
      return;
    }
    if (actionId === 'rest') {
      handleSleep();
      refreshInventory();
      saveNow();
      return;
    }
    if (actionId === 'lay-hedge') {
      // THE HEDGE'S DOOR: the press STARTS the held
      // working — it does not lay. The menu stays
      // standing on its waiting row + bar; the tick
      // above completes or interrupts it. The grant
      // is never called from here (cost at
      // completion, never at the press).
      if (!shelterHouseId) return;
      hedgeWorkingRef.current = { homeId: shelterHouseId, progressMs: 0 };
      setHedgeWorking({ homeId: shelterHouseId, progressMs: 0 });
      return;
    }
    if (actionId === 'lay-seal') {
      // THE SEAL'S DOOR: the press LAYS (uncosted —
      // no working, no bar; Adam priced materials only
      // against the T3 interior). The footprint: the
      // ring's radius when this home wears its hedge,
      // else the house's shelter radius.
      if (!shelterHouseId) return;
      const house = shelterState
        .snapshot()
        .find((h) => h.id === shelterHouseId);
      if (!house) return;
      const radiusM = hedgeStateRef.current.hasHedge(shelterHouseId)
        ? hedgeRadiusM(fragmentStateRef.current)
        : SHELTER_RADIUS;
      laySealAt({
        placeId: shelterHouseId,
        x: house.x,
        z: house.z,
        radiusM,
      });
      return;
    }
    if (!shelterHouseId) return;
    const store = getHomeStore(shelterHouseId);
    const house = shelterState.snapshot().find((h) => h.id === shelterHouseId);
    const player = playerRef.current;
    const sayHouse = (text: string) =>
      showFeedback(text,
        'blocked',
      );
    if (!store) {
      sayHouse('No home storage here.');
      refreshInventory();
      saveNow();
      return;
    }
    if (actionId === 'upgrade') {
      // HOME-SCREEN UPGRADE (Adam's principle, 2026-10-31):
      // Systems' helper takes the price from her pack
      // (nothing consumed on a refusal); the engine's
      // in-place upgrade then climbs the standing house
      // — the same composition tail as the placement
      // pill's press, minus the carried house item.
      if (!house) return;
      const result = consumeHomeUpgradePrice(store.houseType(), inventory);
      if (result.ok === false) {
        if (result.code === 'missing' && result.missing) {
          sayHouse(
            `Not enough — ${result.missing
              .map(
                (m) => `${displayNameFor(m.item)} (${m.held}/${m.needed})`,
              )
              .join(' · ')}`,
          );
        }
        return;
      }
      const newType = HOME_RUNG_TO_TYPE[result.to];
      if (newType === undefined) return;
      if (!shelterState.upgradeHouse(house.id, newType)) return;
      store.setHouse(result.to as ItemId);
      applyShelterHouse(house.id);
      refreshInventory();
      saveNow();
      return;
    }
    // No transfer arms remain (landing 2, 2026-10-31):
    // the menu offers no Store/Take ids anymore, so
    // nothing dispatches past the upgrade arm. The
    // panel's Deposit/Withdraw handlers are the
    // transfers now, and they are separate functions.
  };

  const handleRemove = (target: HarvestTarget) => {
    // Same shape as a harvest press, action 'remove' (Background's
    // documented shape, 2003619): the outcome listener resolves
    // it into the bigger one-time yield or an honest failure.
    // The doors pre-judge removability now (the offer's
    // honesty, 2026-10-31) — this press is reachable only
    // for removable targets; the outcome stays the
    // backstop, and no yield is previewed here.
    bus.emit('harvest:requested', removeRequestFor(target));
  };

  // Wardrobe notes (see the header): the worn set is live
  // Wardrobe state; carried comes from inventory counts; both
  // notes come from their own sources (engine garment table
  // for protection, Wardrobe for the PINNED carrying bonus).
  const carriedGarments: WornGarment[] = GARMENTS.filter(
    (g) => inventory.count(g.item) > 0,
  ).map((g) => g.backgroundId);
  const wornRemaining = clothingRemaining(wornGarments);
  // UMBRELLA IN THE PROTECTION LINE (Adam, 2026-10-29 —
  // 'it would look nice there though, the umbrella'):
  // the rain figure composes the umbrella through
  // Systems' helper (multiplicative, precipitation axis
  // only — wind/cold/wet stay garment-only), so the
  // readout matches the exposure math, which already
  // composed it. 'Protection: none' now requires BOTH
  // no garments worn AND no umbrella carried; an
  // umbrella alone reads rain 60% · 0% · 0% · 0%. The
  // separate umbrella note line is retired — its number
  // lives here now (one home per fact).
  const rainRemaining = applyUmbrellaToPrecipitationRemaining(
    wornRemaining.rain,
    inventory,
  );
  const protectionNote =
    wornGarments.length === 0 && !carriesUmbrella(inventory)
      ? 'Protection: none'
      : `Protection: rain ${Math.round((1 - rainRemaining) * 100)}% · wind ${Math.round((1 - wornRemaining.wind) * 100)}% · cold ${Math.round((1 - wornRemaining.cold) * 100)}% · wet ${Math.round((1 - wornRemaining.wet) * 100)}%`;
  const capacityBonus = wardrobe.wornCapacityBonus();
  const capacityNote =
    capacityBonus > 0 ? `Carrying bonus +${capacityBonus} lb` : undefined;

  // Home-storage for the sheltering house: the store
  // the HOME MENU's upgrade row prices against (that
  // menu's own keying — the sheltering house, bound or
  // not). Rows come from the HomeStorage counts (the
  // shell tracks only the id universe, since
  // HomeStorage exposes counts, not a snapshot).
  const openHomeStore =
    shelterHouseId !== null
      ? (homeStoresRef.current.get(shelterHouseId) ?? null)
      : null;
  const openHomeIds =
    shelterHouseId !== null
      ? (homeStoreItemsRef.current.get(shelterHouseId) ?? new Set<string>())
      : new Set<string>();
  // THE STORAGE DIALOG'S CONTENT (hut storage,
  // 2026-11-01): derived from the BINDING, not from
  // proximity — standing sheltered no longer grows a
  // section in the pack by itself (the proximity
  // section is RETIRED). The bound house must still
  // be the sheltering house: she cannot reach into a
  // house she has walked away from, so leaving
  // un-heads the panel to the plain pack, and the
  // binding is re-read fresh at the next open.
  const boundStore =
    storageHouseId !== null && shelterHouseId === storageHouseId
      ? (homeStoresRef.current.get(storageHouseId) ?? null)
      : null;
  const boundIds =
    storageHouseId !== null && shelterHouseId === storageHouseId
      ? (homeStoreItemsRef.current.get(storageHouseId) ?? new Set<string>())
      : new Set<string>();
  const storageSection =
    storageHouseId !== null && shelterHouseId === storageHouseId
      ? {
          label: shelterHouseName ?? storageHouseId,
          items:
            boundStore === null
              ? []
              : [...boundIds]
                  .filter((id) => boundStore.count(id) > 0)
                  .map((id) => ({
                    id,
                    // Same display rule as panel rows above:
                    // storage rows are panel rows too.
                    name: displayNameFor(id),
                    // Category for the unified surface's
                    // grouped order (2026-10-31).
                    category: categoryFor(id as ItemId),
                    // Same note rule as personal rows (the
                    // one itemNoteFor helper — descriptor
                    // wiring, 2026-10-29).
                    note: itemNoteFor(id, charmStateRef.current),
                    quantityText: String(boundStore.count(id)),
                    // DEV rider (hut storage): the
                    // dialog's rows speak weights like
                    // the pack's — the FORMAT PIN's
                    // typography over the stored count.
                    titleMeta: pileTitleMetaFor(id, boundStore.count(id)),
                  })),
          capacityText:
            boundStore === null
              ? 'Home storage — empty until first deposit'
              : // POUNDS (Adam, 2026-10-28 — "pounds here
                // and going forward"): used()/capacity()
                // return pounds since Systems' rework, so
                // the header names the unit. Null-store
                // text unchanged; per-kind counts below
                // are item quantities, not pounds.
                `Stored ${boundStore.used()} lb / ${boundStore.capacity()} lb`,
          note: storageNote,
          onWithdrawItem: handleWithdrawItem,
        }
      : undefined;

  // Home menu actions (Adam, 2026-10-28; transfers
  // retired 2026-10-31, landing 2 — see the note at the
  // close push below): Sleep + Upgrade + Close for the
  // sheltering house. The Upgrade row derives per render
  // from the live store, so the menu re-renders in place
  // after a press and never auto-closes.
  const homeMenuActions = (): ContextAction[] => {
    if (!shelterHouseId) return [];
    const store = openHomeStore;
    const actions: ContextAction[] = [
      {
        id: 'rest',
        label: 'Sleep until Sunrise',
        disabled: !isNight,
        disabledNote: isNight ? undefined : 'Night only',
      },
    ];
    // UPGRADE (Adam's home-screen principle, 2026-10-31:
    // an upgrade needs no station, so its button lives
    // on the home screen, paying the next rung's recipe
    // price from her pack right there). Systems'
    // nextHomeUpgrade prices the row — null at the top
    // rung (no row: menus don't carry tombstones) — and
    // its ingredients, counted against her pack, are
    // the row's countsText and its disabled note.
    const upgrade = store ? nextHomeUpgrade(store.houseType()) : null;
    if (upgrade !== null) {
      const price = upgrade.recipe.ingredients.map((ingredient) => {
        const item = normalizeItemId(ingredient.item);
        return {
          name: displayNameFor(item),
          held: inventory.count(item),
          needed: ingredient.quantity,
        };
      });
      const short = price.filter((part) => part.held < part.needed);
      actions.push({
        id: 'upgrade',
        label: `Upgrade to ${upgrade.recipe.name}`,
        countsText: price
          .map((part) => `${part.name} ${part.held}/${part.needed}`)
          .join(' · '),
        disabled: short.length > 0,
        disabledNote:
          short.length > 0
            ? `Missing: ${short
                .map((part) => `${part.name} (${part.held}/${part.needed})`)
                .join(' · ')}`
            : undefined,
      });
    }
    // NO TRANSFER ROWS (Inventory Unification landing 2,
    // Adam's ruling 2026-10-31 — 'a good streamline'):
    // the Store/Take kind entries that used to derive
    // here are RETIRED; the home menu is Sleep /
    // Upgrade / Close, and transfers live only in the
    // unified surfaces (her pack panel's Deposit /
    // Withdraw, one tap away at home). Revisit only on
    // Adam's word.
    // STORAGE ROW (hut storage, 2026-11-01): the
    // menu's own door into the storage dialog — its
    // press closes the menu and calls the pack's one
    // opener, which binds this house at open, so the
    // menu door and the I key open the same dialog on
    // the same house by construction. The rows read
    // [1] Sleep, [2] Upgrade, [3] Storage, [4] Close.
    actions.push({ id: 'storage', label: 'Storage' });
    // THE HEDGE'S DOOR (Adam's Hedge design,
    // 2026-11-05): at a faced home of hers, knowing
    // the Hedge mark seats the laying — one hedge
    // per home, so a ringed home shows no row (menus
    // don't carry tombstones, the upgrade law). The
    // row prices itself in the counts idiom: the
    // cuttings ride the row's countsText (the one
    // rule — every ContextMenu row renders countsText
    // at its right, regular and arrows alike, since
    // the countsText fix 2026-11-05; the home upgrade
    // row's price was dead until that fix taught the
    // regular row), and a Missing note
    // names the want when she is short, before any
    // working starts. While the held
    // working stands, the menu's rows are its
    // waiting row + Close — the working is the
    // menu's whole business until it completes or
    // comes undone.
    if (hedgeWorking !== null && hedgeWorking.homeId === shelterHouseId) {
      return [
        {
          id: 'lay-hedge-working',
          label: 'Laying the hedge…',
          disabled: true,
        },
        { id: 'close', label: 'Close [X]' },
      ];
    }
    if (
      hedgeTier(fragmentStateRef.current) >= 1 &&
      !hedgeStateRef.current.hasHedge(shelterHouseId)
    ) {
      const held = inventory.count(ITEMS.cuttings);
      actions.push({
        id: 'lay-hedge',
        label: 'Lay the Hedge Mark',
        countsText: `Cuttings ${held}/${CUTTINGS_TO_LAY}`,
        disabled: held < CUTTINGS_TO_LAY,
        disabledNote:
          held < CUTTINGS_TO_LAY
            ? `Missing: Cuttings (${held}/${CUTTINGS_TO_LAY})`
            : undefined,
      });
    }
    // THE HEARTHHOME SEAL'S DOOR (Adam's ruling,
    // 2026-11-05; the door build 2026-11-06): at a faced
    // home of hers, knowing the HearthHome mark seats
    // the laying — one seal per place, so a sealed home
    // shows no row (the row's absence is the display).
    // The seal and the Hedge ring compose on the same
    // place id by design (Systems' two-records-one-place
    // shape): the footprint is the ring's radius when
    // the home is ringed, else the house's shelter
    // radius — the only footprint facts the place has.
    if (shelterHouseId) {
      const sealRow = sealDoorRow(shelterHouseId);
      if (sealRow) actions.push(sealRow);
    }
    actions.push({ id: 'close', label: 'Close [X]' });
    return actions;
  };

  // Home chip anchor, derived per render (pile/fire
  // precedent — stored anchors go stale on move): the
  // sheltering house's position, projected as a scatter
  // anchor. Null → no chip, no menu.
  const homeHouse =
    shelterHouseId !== null
      ? shelterState.snapshot().find((h) => h.id === shelterHouseId)
      : undefined;
  const homeChipAnchor =
    homeHouse !== undefined
      ? projectAnchor(homeHouse.x, homeHouse.z, 'scatter')
      : null;
  // WHOLE-HUT ANCHOR (Adam, 2026-10-29, same ruling): a
  // scatter anchor is null whenever the center sits
  // off-screen or behind her — inside a hut, most facings
  // (at 1 m the center projects below the screen's bottom
  // edge even faced squarely) — so the chip vanished with
  // a turn, and an OPEN menu unmounted on turning around
  // (its state stayed open; the render gate was the
  // anchor). The center's own projection cannot rescue
  // the behind-her case (the projection itself is null
  // there, any kind), so inside the footprint (same
  // radius rule as the USE race) the fallback anchor is
  // the GROUND projection of the point one meter ahead
  // of her: a ground point in front always projects (it
  // clamps to the screen's bottom edge rather than
  // dropping — her own feet do NOT work: at the camera's
  // exact xz the projection itself is null), so the chip
  // stays usable and the menu survives turning and
  // moving within the footprint, re-seating on the house
  // the moment the center projects again. Outside the
  // footprint the anchor is today's exactly; leaving the
  // shelter zone still ends both (homeHouse goes
  // undefined, and the chip also gates on sheltered).
  const insideHomeFootprintNow = (() => {
    const p = playerRef.current;
    if (homeHouse === undefined || !p) return false;
    return (
      Math.hypot(p.x - homeHouse.x, p.z - homeHouse.z) <=
      HOUSE_DEFS[homeHouse.type].footprint / 2
    );
  })();
  const homeFallbackAnchor =
    insideHomeFootprintNow && playerRef.current
      ? projectAnchor(
          playerRef.current.x + Math.sin(playerRef.current.facing),
          playerRef.current.z + Math.cos(playerRef.current.facing),
          'ground',
        )
      : null;
  const homeAnchor = homeChipAnchor ?? homeFallbackAnchor;
  const homeChipVisible = sheltered && homeAnchor !== null && !paused;

  // NO UPGRADE PILL (Adam, 2026-11-01): upgrades are not
  // placements — the faced-house upgrade derivation that
  // lived here is OUT. The home menu's Upgrade row is
  // the one upgrade door.

  // Nearby pile for the Inventory modal's pickup section
  // (Adam, 2026-10-28): the NEAREST pile in range from
  // App's existing piles state — pilesInRange +
  // HARVEST_RANGE 2.5 m, the pile menu/chips range
  // (verified at build: App 2971 + proximity 305, range
  // 2.5 at proximity 103 — no divergence). Nearest =
  // smallest PileTarget.distance, ties → first in state
  // order. Kinds in stacks order (pile-menu order), with
  // live carried counts. Worn-gear kinds are NOT
  // filtered here — pile Take is recovery. Undefined =
  // no pile in range → the section hides. The modal
  // STAYS OPEN when the pile empties (subject = pack):
  // the section re-renders away (or switches to the
  // next-nearest pile) as piles state updates.
  const nearestPile =
    piles.length === 0
      ? undefined
      : piles.reduce((best, pile) =>
          pile.distance < best.distance ? pile : best,
        );
  // The nearby-pile section's rows, AS ITEM ROWS (the
  // unified shape, 2026-10-31): the panel's surface
  // wants the same InventoryItem contract as every
  // other list — name, category, and the counts riding
  // the meta slot ('pile ×N · carried ×M', the text the
  // section has always shown).
  const nearbyPileItems =
    nearestPile === undefined
      ? undefined
      : nearestPile.stacks.map((stack) => ({
          id: stack.item,
          name: displayNameFor(stack.item),
          category: categoryFor(stack.item as ItemId),
          titleMeta: `pile ×${stack.quantity} · carried ×${inventory.count(stack.item as ItemId)}`,
        }));

  // The fire whose lighting menu is open, with its anchor.
  const selectedFire =
    selectedFireId === null
      ? undefined
      : placedFires.find((f) => f.id === selectedFireId);
  // ANCHOR RETENTION (Adam's look-up bug, hunted
  // 2026-10-31): an OPEN anchored window used to vanish
  // when its anchor's projection dropped — the 'scatter'
  // rule returns null off-screen, the anchors arrays skip
  // nulls, and the render gate unmounted the window
  // (looking up from a stump dropped its window off the
  // bottom edge). The SELECTION never closed; only the
  // projection did. So: while a window's entity exists,
  // its last projected anchor is RETAINED and the window
  // stays where it was until the entity projects again
  // or the selection closes (leash, E, Esc, a new
  // selection — unchanged). A vanished ENTITY (a picked-
  // up torch, an emptied pile's kin) still closes its
  // window: retention applies only while the entity
  // resolves. Prompts and chips for unselected things
  // keep the scatter rule — vanishing off-screen is
  // correct for them; only open windows freeze.
  const retainedAnchorsRef = useRef(
    new Map<string, { x: number; y: number }>(),
  );
  const retainAnchor = (
    key: string | null,
    live: { x: number; y: number } | null,
  ): { x: number; y: number } | null => {
    if (key === null) return null;
    if (live !== null) {
      retainedAnchorsRef.current.set(key, live);
      return live;
    }
    return retainedAnchorsRef.current.get(key) ?? null;
  };
  const selectedFireAnchor =
    selectedFire === undefined
      ? null
      : retainAnchor(
          `fire:${selectedFire.id}`,
          fireAnchors.find((a) => a.fire.id === selectedFire.id) ?? null,
        );

  // The cauldron whose menu is open, with its anchor —
  // the fire pattern, over Background's singleton: a
  // picked-up cauldron leaves the menu with nothing.
  const selectedCauldron =
    selectedCauldronHearthId === null
      ? undefined
      : cauldronState.cauldronForHearth(selectedCauldronHearthId);
  const selectedCauldronAnchor =
    selectedCauldron === undefined
      ? null
      : retainAnchor(
          `cauldron:${selectedCauldron.hearthId}`,
          cauldronAnchors.find(
            (a) => a.cauldron.hearthId === selectedCauldron.hearthId,
          ) ?? null,
        );

  // The furniture menus' selected pieces + anchors
  // (the furniture-verbs build — the fire pattern):
  // a picked-up piece resolves to undefined and its
  // menu leaves with it.
  const selectedWorkstation =
    selectedWorkstationId === null
      ? undefined
      : workstationState.get(selectedWorkstationId);
  const selectedWorkstationAnchor =
    selectedWorkstation === undefined
      ? null
      : retainAnchor(
          `workstation:${selectedWorkstation.id}`,
          workstationAnchors.find(
            (a) => a.bench.id === selectedWorkstation.id,
          ) ?? null,
        );
  const selectedDesk =
    selectedDeskId === null ? undefined : deskState.get(selectedDeskId);
  const selectedDeskAnchor =
    selectedDesk === undefined
      ? null
      : retainAnchor(
          `desk:${selectedDesk.id}`,
          deskAnchors.find((a) => a.desk.id === selectedDesk.id) ?? null,
        );
  const selectedLoom =
    selectedLoomId === null ? undefined : loomState.get(selectedLoomId);
  const selectedLoomAnchor =
    selectedLoom === undefined
      ? null
      : retainAnchor(
          `loom:${selectedLoom.id}`,
          projectAnchor(selectedLoom.x, selectedLoom.z, 'scatter'),
        );

  // The selected tent + its anchor — the torch pattern,
  // over the shell store (no entity yet).
  const selectedTent =
    selectedTentId === null
      ? undefined
      : placedTents.find((t) => t.id === selectedTentId);
  const selectedTentAnchor =
    selectedTent === undefined
      ? null
      : retainAnchor(
          `tent:${selectedTent.id}`,
          tentAnchors.find((a) => a.tent.id === selectedTent.id) ?? null,
        );

  // The selected bag + its anchor — the tent pattern.
  const selectedBag =
    selectedBagId === null
      ? undefined
      : placedBags.find((b) => b.id === selectedBagId);
  const selectedBagAnchor =
    selectedBag === undefined
      ? null
      : retainAnchor(
          `bag:${selectedBag.id}`,
          bagAnchors.find((a) => a.bag.id === selectedBag.id) ?? null,
        );

  // The ritual site whose panel is open, with its anchor —
  // the torch pattern, live: the panel renders from the
  // live site (placedAltars or stumpAnchors), so a
  // vanished site leaves the panel with nothing. The
  // staged bone + staging + recipe all derive live from
  // the site singletons + book (never a tap-time
  // snapshot), so step presses re-render the panel
  // through ritualVersion. Site-kind-agnostic: the
  // selection is a site id, the label follows its
  // prefix, and only the anchor source differs.
  // SITE FACTS (altar transformation, 2026-10-30): the
  // selected site's position, stump additions, making
  // progress, and ritual grade — one derivation the
  // label, the acts list, and the panel all read. The
  // grade is Systems' siteGrade over the same additions
  // the engine reads, so the label and the Linking's
  // gate can never disagree with the world.
  const selectedSitePosition =
    selectedSiteId === null ? null : sitePositionFor(selectedSiteId);
  const selectedSiteAdditions: readonly string[] =
    selectedSitePosition?.kind === 'stump'
      ? (stumpState
          .snapshot()
          .find(
            (record) =>
              record.x === selectedSitePosition.x &&
              record.z === selectedSitePosition.z,
          )?.additions ?? [])
      : selectedSitePosition?.kind === 'altar' &&
          selectedSiteId !== null
        ? (altarState.get(selectedSiteId)?.additions ?? [])
        : [];
  const selectedSiteProgress = altarProgressFrom(selectedSiteAdditions);
  const selectedSiteGrade =
    selectedSitePosition === null
      ? null
      : siteGrade(selectedSitePosition.kind, selectedSiteAdditions);
  const selectedSiteLabel =
    selectedSiteId === null
      ? null
      : selectedSiteId.startsWith('stump:')
        ? isStumpyAltar(selectedSiteAdditions)
          ? 'Stumpy Altar'
          : 'Stump'
        : 'Altar';
  const selectedSiteAnchor =
    selectedSiteId === null || selectedSitePosition === null
      ? null
      : retainAnchor(
          `site:${selectedSiteId}`,
          selectedSiteId.startsWith('stump:')
            ? (stumpAnchors.find((a) => a.siteId === selectedSiteId) ??
              null)
            : (altarAnchors.find((a) => a.altar.id === selectedSiteId) ??
              null),
        );
  const selectedSiteStaged =
    selectedSiteId === null
      ? null
      : (ritualSiteState.getStaged(selectedSiteId) ?? null);
  const selectedSiteStaging =
    selectedSiteStaged === null || selectedSiteId === null
      ? null
      : (stagingBookRef.current.get(
          selectedSiteId,
          selectedSiteStaged.bone,
        ) ?? null);
  const selectedSiteRecipe =
    selectedSiteStaged === null
      ? null
      : (ritualRecipeFor(selectedSiteStaged.bone) ?? null);

  // SKY PULSE (rite Landing B, 2026-11-05 — Adam's dusk
  // lag): the panel derives its sky line from the live sky
  // at render time, but renders stall while she stands
  // still with the panel up — the line read 'window
  // closed' through a whole dusk band it never saw open.
  // While a site panel stands with a staged rite, a 1 s
  // pulse re-renders so the line (and the completion
  // reading beside it) follows the sky's own cadence.
  const [, setSkyPulse] = useState(0);
  useEffect(() => {
    if (selectedSiteId === null || selectedSiteStaging === null) return;
    const pulse = window.setInterval(() => setSkyPulse((n) => n + 1), 1000);
    return () => window.clearInterval(pulse);
  }, [selectedSiteId, selectedSiteStaging]);

  // Ritual panel option lists, hoisted from the panel's
  // JSX so the PC-key digit dispatch (below) reads the
  // SAME lists the panel renders — one source, no
  // divergence. Computed only while a site is selected
  // (the panel's own condition); [] otherwise.
  // Panel honesty (Adam, 2026-10-29 — the list offered
  // every unawakened kind as a live button and pressing
  // one she doesn't carry answered 'No such bone
  // carried.'): each option now carries its CARRIED
  // COUNT (boneItemFor against inventory, the same
  // stacks read the food options below use), and the
  // panel renders uncarried kinds disabled-but-visible
  // — the list is the Waking collection; greyed rows
  // show what remains to find. Systems' stageBone
  // refusal stays as backstop.
  const selectedSiteKindOptions =
    selectedSiteId === null && craftContextSiteId === null
      ? []
      : (() => {
          const counts = new Map<string, number>();
          for (const stack of inventory.stacksSnapshot()) {
            const id = normalizeItemId(stack.item);
            counts.set(id, (counts.get(id) ?? 0) + stack.quantity);
          }
          return RITUAL_RECIPES.filter(
            (recipe) => charmStateRef.current.tierOf(recipe.boneKind) === 0,
          ).map((recipe) => ({
            kind: recipe.boneKind,
            display: boneDisplayFor(recipe.boneKind),
            skyLabel:
              recipe.sky === 'none' ? 'Any sky' : skyLabelFor(recipe.sky),
            carried:
              counts.get(normalizeItemId(boneItemFor(recipe.boneKind))) ?? 0,
          }));
        })();
  const selectedSiteFoodOptions =
    selectedSiteId === null && craftContextSiteId === null
      ? []
      : (() => {
          const byItem = new Map<string, number>();
          for (const stack of inventory.stacksSnapshot()) {
            const id = normalizeItemId(stack.item);
            if ((FOOD_ITEMS as readonly string[]).includes(id)) {
              byItem.set(id, (byItem.get(id) ?? 0) + stack.quantity);
            }
          }
          return [...byItem.entries()].map(([id, count]) => ({
            item: id,
            display: displayNameFor(id),
            count,
          }));
        })();

  // CRAFT CONTEXT FACTS (the fold): the same derivations
  // as the selected site's, run on the dialog's context
  // stump — position, additions, progress, grade, label,
  // acts, and the ritual reads. The context is always a
  // stump (plain or made altar), so the label is the
  // stump pair. The kind/food option lists above are
  // shared (they read the pack, not the site; their guard
  // opens for the context too).
  const contextSitePosition =
    craftContextSiteId === null
      ? null
      : sitePositionFor(craftContextSiteId);
  const contextSiteAdditions: readonly string[] =
    contextSitePosition?.kind === 'stump'
      ? (stumpState
          .snapshot()
          .find(
            (record) =>
              record.x === contextSitePosition.x &&
              record.z === contextSitePosition.z,
          )?.additions ?? [])
      : contextSitePosition?.kind === 'altar' &&
          craftContextSiteId !== null
        ? (altarState.get(craftContextSiteId)?.additions ?? [])
        : [];
  const contextSiteProgress = altarProgressFrom(contextSiteAdditions);
  const contextSiteGrade =
    contextSitePosition === null
      ? null
      : siteGrade(contextSitePosition.kind, contextSiteAdditions);
  const contextSiteLabel =
    craftContextSiteId === null
      ? null
      : craftContextSiteId.startsWith('fire:')
        ? 'Kiln'
        : isStumpyAltar(contextSiteAdditions)
          ? 'Stumpy Altar'
          : 'Stump';
  // The fire a fire-context names (the lit kiln the
  // dialog stands on), resolved live — the Fire door
  // renders its actions from the fire's current state.
  const craftContextFire =
    craftContextSiteId !== null &&
    craftContextSiteId.startsWith('fire:')
      ? placedFires.find(
          (f) => f.id === craftContextSiteId.slice('fire:'.length),
        )
      : undefined;
  const contextSiteActs: { id: string; label: string }[] = (() => {
    if (craftContextSiteId === null || contextSitePosition === null) {
      return [];
    }
    const acts: { id: string; label: string }[] = [];
    if (contextSitePosition.kind === 'stump') {
      if (!contextSiteProgress.stones) {
        acts.push({ id: 'place-stones', label: 'Place the Stones' });
      }
      if (!contextSiteProgress.glyph) {
        acts.push({ id: 'draw-glyph', label: 'Draw the Glyph' });
      }
      if (!contextSiteProgress.candle) {
        acts.push({ id: 'set-candle', label: 'Set the Candle' });
      }
    }
    if (contextSiteGrade === 2 && !journalLinked) {
      acts.push({ id: 'link-journal', label: 'Link the Journal' });
    }
    return acts;
  })();
  const contextSiteStaged =
    craftContextSiteId === null
      ? null
      : (ritualSiteState.getStaged(craftContextSiteId) ?? null);
  const contextSiteStaging =
    contextSiteStaged === null || craftContextSiteId === null
      ? null
      : (stagingBookRef.current.get(
          craftContextSiteId,
          contextSiteStaged.bone,
        ) ?? null);
  const contextSiteRecipe =
    contextSiteStaged === null
      ? null
      : (ritualRecipeFor(contextSiteStaged.bone) ?? null);

  // TRANSFORMATION ACTS for the selected site, hoisted
  // like the option lists below's neighbours so the
  // digit dispatch reads the SAME list the panel
  // renders. The makings at a stump live in the CONTEXT
  // acts list (the fold — stumps no longer select, so
  // this selected list never sees one); at a PLACED
  // altar they live HERE (parity, 2026-11-01): the
  // altar's own panel is its door, the same three steps
  // in the same order, off the same progress reading.
  // And at either altar at grade 2, while the books are
  // unlinked, the Linking.
  const selectedSiteActs: { id: string; label: string }[] = (() => {
    if (selectedSiteId === null || selectedSitePosition === null) {
      return [];
    }
    const acts: { id: string; label: string }[] = [];
    if (selectedSitePosition.kind === 'altar') {
      if (!selectedSiteProgress.stones) {
        acts.push({ id: 'place-stones', label: 'Place the Stones' });
      }
      if (!selectedSiteProgress.glyph) {
        acts.push({ id: 'draw-glyph', label: 'Draw the Glyph' });
      }
      if (!selectedSiteProgress.candle) {
        acts.push({ id: 'set-candle', label: 'Set the Candle' });
      }
    }
    if (selectedSiteGrade === 2 && !journalLinked) {
      acts.push({ id: 'link-journal', label: 'Link the Journal' });
    }
    return acts;
  })();

  // THE FAMILIAR'S RITE ROWS (Build 2, Piece 1): one
  // guarded act per bonded animal, derived from the
  // records — the standing familiar offers its step
  // down; a companion offers its raising, shaped by
  // whether the familiar's place stands empty (raise)
  // or filled (raise in their place). The seats pass
  // these only at altar-grade ground (grade 2); the
  // confirm + Systems' transitions re-check everything
  // at execution, so a row gone stale refuses honestly
  // through the note.
  const standingFamiliarRecord = bondedCompanions.find(
    (record) => record.bond === 'familiar',
  );
  // The pending rite's render facts (Piece 1): the
  // confirm names the animal from its live record —
  // and, for supersede, the standing familiar it would
  // displace.
  const pendingRiteRecord =
    pendingRite === null
      ? undefined
      : companionRecords.find(
          (record) => record.creatureId === pendingRite.creatureId,
        );
  // The familiar's rite acts (REWORKED, Adam 2026-11-02 —
  // the familiar road): raising no longer stands here as a
  // free-standing door. The familiar is what she obtains
  // from the altar ritual WORKED ON A BONE — a Waking's
  // completion raises her companion of the kind or brings
  // the animal to her (CompanionState.obtainByRite, called
  // from checkRitualCompletions), and displacement lives
  // inside that making. What remains at the altar is the
  // step-down: the standing familiar may be let go back to
  // companion here, bone-free, as it always was.
  const riteActs: { id: string; label: string }[] =
    standingFamiliarRecord
      ? [
          {
            id: `relinquish:${standingFamiliarRecord.creatureId}`,
            label: `Let the ${companionKindLabel(standingFamiliarRecord.kind)} step down`,
          },
        ]
      : [];

  // The pile whose menu is open, with its anchor.
  // Live menu pile: the menu renders from piles state, not a
  // tap-time snapshot (see the state comment above).
  const selectedPile =
    selectedPileId === null
      ? null
      : (piles.find((pile) => pile.id === selectedPileId) ?? null);

  const [optionsOpen, setOptionsOpen] = useState(false);
  // (optionsTabRequest — the New World → Cloud Saves
  // door's state — is declared with the cloud state
  // above; the folded dialog's Esc effect reads it.)

  // Refresh cloud state + list whenever Options opens.
  // (Placed here, not in the cloud block above: the deps
  // array reads optionsOpen at render time, so this
  // effect must sit AFTER its declaration — the #17
  // lesson. The cloud block's callbacks are plain
  // closures and read it safely from anywhere.)
  useEffect(() => {
    if (!optionsOpen) return;
    refreshCloudState();
    void refreshCloudList();
    void probeCloudWakeOfferAfterCurrency();
  }, [optionsOpen]);
  // BUILD CURRENCY (the cloud rework's final pass, 2026-11-01):
  // a device holding an old build plays it forever — the page is
  // cached at open and nothing ever compared the running bundle
  // against the served one, so fixed bugs read as still-broken on
  // a stale tab. A build names itself by its hashed bundle (the
  // module script in the served document); the running build
  // reads its own name from its own document. The check runs at
  // boot and on visibility wake — no timers, no polling — fetching
  // the page's own document no-store and comparing names. A
  // mismatch reloads ONCE per target (sessionStorage holds the
  // hash reloaded for; a still-mismatched boot under the recorded
  // target does not spin). Failure is silence: offline or
  // unparseable, play continues on the running build. The wake
  // offer's probes WAIT for the verdict (below) — per Adam's
  // order the save question only ever stands on a current build.
  const currencyCheckRef = useRef<Promise<void> | null>(null);
  const runBuildCurrencyCheck = (): Promise<void> => {
    const check = (async () => {
      try {
        const bundleOf = (text: string): string | null => {
          const m = text.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
          return m === null ? null : m[1];
        };
        const ownScript = document.querySelector(
          'script[type="module"][src]',
        );
        const running =
          ownScript === null
            ? null
            : bundleOf(ownScript.getAttribute('src') ?? '');
        if (running === null) return;
        const res = await fetch(window.location.href, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const served = bundleOf(await res.text());
        if (served === null || served === running) return;
        const GUARD_KEY = 'silentearth.buildReloadedFor';
        if (sessionStorage.getItem(GUARD_KEY) === served) return;
        sessionStorage.setItem(GUARD_KEY, served);
        window.location.reload();
      } catch {
        // Silence by design — see the note above.
      }
    })();
    currencyCheckRef.current = check;
    return check;
  };
  // The wake offer, gated on the currency verdict: probes await
  // the latest check before asking their question.
  const probeCloudWakeOfferAfterCurrency = async (): Promise<void> => {
    if (currencyCheckRef.current !== null) {
      await currencyCheckRef.current;
    }
    await probeCloudWakeOffer();
  };

  // THE WAKE OFFER at boot, behind the currency check:
  // one probe once the game stands and the build is
  // known current. The module answers null for
  // cloud-off / wordless / unreadable — unknown never
  // offers.
  useEffect(() => {
    void runBuildCurrencyCheck().then(() => probeCloudWakeOffer());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Wake: becoming visible again re-checks the build (a stale tab
  // restarts on the current build; a current one hears nothing).
  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) void runBuildCurrencyCheck();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () =>
      document.removeEventListener('visibilitychange', onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // FIRST-RUN DIALOG (Adam, 2026-10-28): on a no-save
  // boot the dialog comes FIRST and the intro second.
  // firstRunDone starts true when a save exists (the
  // dialog never shows), when a pending new world rides
  // the reload (the folded dialog was already begun),
  // and flips true on dialog Begin;
  // introOpen's init reads it, so the intro cannot open
  // under the dialog. Declared BEFORE introOpen — an
  // initializer reading a later-declared const is a TDZ
  // crash (the #17 lesson), and the dialog predicate
  // below reads both.
  const [firstRunDone, setFirstRunDone] = useState(
    bootSave !== null || pendingNewWorld !== null,
  );

  // Intro modal: open on first run — no save at boot (a corrupt
  // save reads as null, so it reads as fresh too). Gated by
  // the first-run dialog (firstRunDone): the dialog opens
  // first, Begin opens the intro. Dismissing
  // sets it false for the session; a player who never saves
  // sees it again next launch, which is the trigger working
  // as briefed, not a bug. Re-open any time from the
  // Introduction section in Options (Settings tab).
  const [introOpen, setIntroOpen] = useState(
    () => bootSave === null && firstRunDone,
  );

  // First-run dialog predicate (render-time, bootSave is
  // session-stable): no save at boot + dialog not yet
  // begun. Read by the dialog render, the Esc guard, the
  // PC-keys guard, and the Esc-hint condition below.
  const firstRunDialogOpen = bootSave === null && !firstRunDone;

  // ANY DIALOG OPEN (touch surfaces, 2026-11-01): the one
  // flag the mobile-dialog takeover and the collapsed
  // quest card's seat both read. The dialog family = the
  // five panels, Options, the intro/first-run dialogs,
  // the pile modal, the site windows (ritual/upgrade
  // ride selectedSiteId / craftingOpen), and the confirm
  // + trap popups. On touch, while any of these stands,
  // the dialog TAKES THE SCREEN (Adam: dialogs were
  // claustrophobic — the world chrome stood behind and
  // through them): TouchControls, the top door row, the
  // seed strip, and the structure tag stand down, and
  // the sheets rise (see the panels column). Desktop
  // never reads this flag.
  const anyDialogOpen =
    inventoryOpen ||
    craftingOpen ||
    charmsOpen ||
    companionsOpen ||
    journalOpen ||
    optionsOpen ||
    introOpen ||
    firstRunDialogOpen ||
    selectedPile !== null ||
    selectedSiteId !== null ||
    (pendingTrapRecipe ?? null) !== null ||
    pendingCarriedTrap !== null ||
    pendingRemoveTarget !== null;

  // TRAP ROW (Adam, 2026-10-28): the nearest placed
  // trap within HARVEST_RANGE (2.5 m, the harvest
  // range — piles/chips range, no divergence),
  // nearest = smallest distance, ties → snapshot
  // order. GATED: null with panels/modals open or
  // paused (the App passes null when gated; legacy
  // harvest rows stay ungated). Context menus do NOT
  // gate it (the row is harvest-column UI, not a
  // menu). Label follows the trap's catch: caught →
  // "Collect {kind}", empty → "Check {TRAP_DEFS
  // name}". Position: the row rides the existing
  // harvest column (screen-fixed, same z-40 seat) —
  // no projection, no column move (the stationAnchor
  // precedent is the nearest-within-range shape,
  // not a re-anchor).
  const trapRowTrap = (() => {
    const player = playerRef.current;
    if (!player) return null;
    if (
      inventoryOpen ||
      craftingOpen ||
      charmsOpen ||
      companionsOpen ||
      journalOpen ||
      placement !== null ||
      selectedSiteId !== null ||
      optionsOpen ||
      introOpen ||
      pendingTrapRecipe ||
      pendingCarriedTrap !== null ||
      pendingRemoveTarget !== null ||
      pendingRite !== null ||
      fragmentBeat !== null ||
      paused
    ) {
      return null;
    }
    let nearest: PlacedTrap | null = null;
    let nearestDistance = Infinity;
    for (const trap of traps) {
      const distance = Math.hypot(trap.x - player.x, trap.z - player.z);
      if (distance <= HARVEST_RANGE && distance < nearestDistance) {
        nearest = trap;
        nearestDistance = distance;
      }
    }
    if (!nearest) return null;
    return {
      id: nearest.id,
      x: nearest.x,
      z: nearest.z,
      label:
        nearest.catch !== null
          ? `Collect ${nearest.catch}`
          : `Check ${TRAP_DEFS[nearest.type].name}`,
      // THE SECOND ACT'S NAME (the trap chunk): the row
      // below Collect names what R (or a tap) will do —
      // a door is spoken, never hidden. The pitfall
      // carries none.
      secondLabel: isCarryableTrap(nearest.type)
        ? `Pick up ${TRAP_DEFS[nearest.type].name}`
        : nearest.type === ITEMS.deadfall
          ? `Dismantle ${TRAP_DEFS[nearest.type].name}`
          : undefined,
    };
  })();

  // HIVE RANGE (Adam, 2026-10-31 — the range rider):
  // the hive kind's targetable leash runs one metre
  // past the family HARVEST_RANGE. His night screenshot
  // is the reason: the hive hangs at ~1.8 m and her eye
  // sits at ~1.6, so the sightline to the hive is near
  // level while the smoking torch stands at the base,
  // ~1.6 m below eye height — at 2.5 m the downward
  // angle to the torch is ~33 degrees and it falls out
  // of frame while the hive is targeted; at 3.5 m it is
  // ~25 degrees and both fit. 'Targetable from a tad
  // farther away so we can see the torch on screen at
  // least.' This producer is the hive's ONLY range
  // gate (the winner race checks facing alone for the
  // hive; the handler re-checks nothing), so the wider
  // leash lives here whole: the positions scan and the
  // distance filter both take it. DRAFT — Adam tunes
  // at sighting. placedTorchNearHive keeps its own
  // radius (the torch still has to be UNDER the hive;
  // where she stands was never that rule's business).
  const HIVE_RANGE = 3.5;

  // HIVE ROW (Adam, 2026-10-28 — honey end-to-end):
  // nearest wild hive in range, trap-row precedent —
  // the caller owns gating (panels/modals/paused pass
  // null, same list as trapRowTrap verbatim, including
  // pendingTrapRecipe/pendingRemoveTarget — inherited,
  // harmless). Hives carry no ids — coords ARE the
  // identity (pile/stump precedent). Label is proposed,
  // not pinned ('Harvest honey', static — no catch
  // state to follow; torch state surfaces on press).
  const hiveRowHive = (() => {
    const player = playerRef.current;
    if (!player) return null;
    if (
      inventoryOpen ||
      craftingOpen ||
      charmsOpen ||
      companionsOpen ||
      journalOpen ||
      placement !== null ||
      selectedSiteId !== null ||
      optionsOpen ||
      introOpen ||
      pendingTrapRecipe ||
      pendingCarriedTrap !== null ||
      pendingRemoveTarget !== null ||
      pendingRite !== null ||
      fragmentBeat !== null ||
      paused
    ) {
      return null;
    }
    let nearest: { x: number; z: number } | null = null;
    let nearestDistance = Infinity;
    for (const hive of hivePositions(genRef.current, player.x, player.z, HIVE_RANGE)) {
      const distance = Math.hypot(hive.x - player.x, hive.z - player.z);
      if (distance <= HIVE_RANGE && distance < nearestDistance) {
        nearest = hive;
        nearestDistance = distance;
      }
    }
    if (!nearest) return null;
    return {
      x: nearest.x,
      z: nearest.z,
      label: 'Harvest honey',
    };
  })();

  // TOUCH CONTROLS (phone build — see the header): coarse-pointer
  // devices get the touch layer and the collapsible HUD; desktop
  // rendering is unchanged by construction (every touch branch
  // below keys off isTouch).
  const isTouch = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  }, []);
  // Collapsed by default on touch: Adam's portrait complaint was
  // the stacked panel burying the world, so the game leads and
  // the panels are one tap away. Desktop never collapses.
  const [hudCollapsed, setHudCollapsed] = useState(isTouch);
  // HUD LAYOUT (Adam, 2026-11-02): per-element offsets
  // and hidden flags, stored per pointer class on the
  // device (ui/hudLayout) — the diagram's seats are the
  // defaults; the player drags from there.
  const hudLayout = useHudLayout(isTouch ? 'coarse' : 'fine');
  // QUEST CARD DISMISSAL (Adam, 2026-11-01 — the task
  // chip gains its Close [X]): dismissal is keyed to
  // the quest the card is SHOWING. The press records
  // that quest's id and the card stays down while the
  // card would show that same quest; it returns when
  // what it would show changes — a different quest
  // marked, the mark cleared, or the current quest
  // advancing. No instant reappearance through the
  // unmarked fallback: the fallback is exactly what
  // the dismissal key holds down.
  const [dismissedCardQuestId, setDismissedCardQuestId] =
    useState<string | null>(null);

  // Options font (see the header): shell-owned UI setting,
  // persisted in its own localStorage key — never the Systems
  // save file. No stored choice reads as IM Fell English.
  const [font, setFont] = useState<FontId>(loadFontChoice);

  // Options look (beautification phase 2, Adam 2026-10-29:
  // switchable looks in Settings): shell-owned UI setting
  // in the SAME settings key as the font. The look names
  // the two theme slots (world / dialog) the shell passes
  // down to the themed surfaces. No stored choice reads
  // as the current look (mire + hearth).
  const [look, setLook] = useState(loadLookChoice);
  const lookThemes = LOOK_THEMES[look];

  // ESC TOGGLE (Adam, 2026-10-27 — Esc opens Options; extended
  // 2026-10-28 — Esc closes the topmost layer first): with
  // NO modal open, Esc closes the topmost open layer, one
  // per press, in fixed order — placement panel, pile
  // modal, context menus (torch, tent, fire — reverse render
  // order), ritual panel, panels (charms, crafting, inventory —
  // reverse render order) — and only with nothing open does
  // it open the Options modal. With a modal open, that
  // modal's own Esc listener closes it (previous brief
  // stands) and this handler stands aside — one rule,
  // topmost-close else open-Options. Esc on open Options
  // closes Options; a second Esc with nothing open re-opens
  // it. The handler yields when focus sits in a text input,
  // textarea, or select (the seed field): typing Esc there
  // must not yank the player into Options. It acts on
  // Escape alone and swallows nothing, so V/C and WASD are
  // untouched. It also yields while the remove-confirm
  // dialog is open (PC keys, 2026-10-28) — that dialog owns
  // its own Enter/Esc, the single Esc path.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      // X CLOSES (Adam, 2026-11-01): X joins Escape in
      // this handler — wherever Esc closes the topmost
      // dialog, X does the same act (one close, two
      // doors, never a close-all). X inherits the CLOSE
      // half only: with nothing open it does NOT take
      // Esc's open-Options act (see the fallthrough).
      // A modified X (Ctrl/Cmd/Alt) is a shortcut, not
      // the key — it never closes.
      const isEscape = e.key === 'Escape';
      const isX =
        (e.key === 'x' || e.key === 'X') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey;
      if (!isEscape && !isX) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // First-run dialog owns the screen: Esc neither
      // dismisses it nor opens Options over it (DEV
      // correction — the dialog is Begin-only).
      if (firstRunDialogOpen) return;
      if (
        optionsOpen ||
        introOpen ||
        pendingTrapRecipe ||
        pendingCarriedTrap !== null ||
        pendingRemoveTarget !== null ||
        pendingRite !== null ||
        fragmentBeat !== null ||
        leaveConfirmOpen
      ) {
        return;
      }
      if (placement !== null) {
        handlePlaceCancel();
        return;
      }
      if (homeMenuOpen) {
        setHomeMenuOpen(false);
        return;
      }
      if (selectedPileId !== null) {
        selectedPileIdRef.current = null;
        setSelectedPileId(null);
        return;
      }
      if (selectedTentId !== null) {
        setSelectedTentId(null);
        return;
      }
      if (selectedBagId !== null) {
        setSelectedBagId(null);
        return;
      }
      if (selectedCauldronHearthId !== null) {
        setSelectedCauldronHearthId(null);
        return;
      }
      if (selectedFireId !== null) {
        setSelectedFireId(null);
        return;
      }
      if (selectedWorkstationId !== null) {
        setSelectedWorkstationId(null);
        return;
      }
      if (selectedDeskId !== null) {
        setSelectedDeskId(null);
        return;
      }
      if (selectedLoomId !== null) {
        setSelectedLoomId(null);
        return;
      }
      if (selectedSiteId !== null) {
        setSelectedSiteId(null);
        setRitualNote(null);
        return;
      }
      if (journalOpen) {
        setJournalOpen(false);
        return;
      }
      if (companionsOpen) {
        setCompanionsOpen(false);
        return;
      }
      if (charmsOpen) {
        setCharmsOpen(false);
        return;
      }
      if (craftingOpen) {
        setCraftingOpen(false);
        return;
      }
      if (inventoryOpen) {
        setInventoryOpen(false);
        return;
      }
      // Nothing open: Escape opens Options (Adam's
      // pin); X does nothing — the close half only.
      if (isEscape) setOptionsOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    optionsOpen,
    introOpen,
    pendingTrapRecipe,
    pendingCarriedTrap,
    pendingRemoveTarget,
    pendingRite,
    fragmentBeat,
    placement,
    homeMenuOpen,
    selectedPileId,
    selectedTentId,
    selectedBagId,
    selectedFireId,
    selectedCauldronHearthId,
    selectedSiteId,
    charmsOpen,
    companionsOpen,
    journalOpen,
    craftingOpen,
    inventoryOpen,
    firstRunDone,
    leaveConfirmOpen,
  ]);

  // BACK-BUTTON TRAP + BEFOREUNLOAD GUARD (Adam,
  // 2026-10-29 — "protect the player against accidental
  // tab closing/refresh/back button on phone"). The data
  // side already exists: the boot effect saves locally on
  // pagehide and the cloud mirror flushes there too;
  // nothing here touches those handlers, and no handler
  // below blocks or delays them — a swipe-away close
  // cannot be intercepted on any browser, and the trap
  // never swallows a genuine pagehide.
  //
  // THE TRAP (the phone mechanism — mobile Chrome largely
  // ignores beforeunload): boot pushes ONE history entry.
  // A popstate then means "back pressed while in game":
  // the handler re-pushes the entry first (the trap stays
  // exactly one layer deep), then — if a layer is open —
  // closes the topmost one (Esc-chain parity); only with
  // nothing open does it show the leave confirm. Stay
  // just dismisses (the entry is already re-pushed).
  // Leave arms the one-shot pass and steps back for
  // real: the next popstate sees the arm, does not
  // re-push, and history proceeds — a second back exits
  // normally, never a loop. Reloads (cloud Bring) stack
  // further trap entries, so the armed pass burns
  // through any entries still carrying the trap marker
  // before disarming.
  //
  // Screens that own themselves stand aside, exactly as
  // the Esc chain treats them: the first-run dialog, the
  // intro, the trap-recipe chooser, and the remove
  // confirm swallow the back (re-push only). Options is
  // the one modal the back closes directly — it has no
  // key listener of its own for this, and closing it is
  // the phone player's expectation.
  const closeTopmostForBack = (): boolean => {
    if (
      firstRunDialogOpen ||
      introOpen ||
      pendingTrapRecipe ||
      pendingCarriedTrap !== null ||
      pendingRemoveTarget !== null
    ) {
      return true;
    }
    if (optionsOpen) {
      setOptionsOpen(false);
      return true;
    }
    if (placement !== null) {
      handlePlaceCancel();
      return true;
    }
    if (dumpArmed) {
      cancelDump();
      return true;
    }
    if (applyArmed) {
      cancelApply();
      return true;
    }
    if (homeMenuOpen) {
      setHomeMenuOpen(false);
      return true;
    }
    if (selectedPileId !== null) {
      selectedPileIdRef.current = null;
      setSelectedPileId(null);
      return true;
    }
    if (selectedTentId !== null) {
      setSelectedTentId(null);
      return true;
    }
    if (selectedBagId !== null) {
      setSelectedBagId(null);
      return true;
    }
    if (selectedFireId !== null) {
      setSelectedFireId(null);
      return true;
    }
    if (selectedWorkstationId !== null) {
      setSelectedWorkstationId(null);
      return true;
    }
    if (selectedDeskId !== null) {
      setSelectedDeskId(null);
      return true;
    }
    if (selectedLoomId !== null) {
      setSelectedLoomId(null);
      return true;
    }
    if (selectedSiteId !== null) {
      setSelectedSiteId(null);
      setRitualNote(null);
      return true;
    }
    if (companionsOpen) {
      setCompanionsOpen(false);
      return true;
    }
    if (charmsOpen) {
      setCharmsOpen(false);
      return true;
    }
    if (craftingOpen) {
      setCraftingOpen(false);
      return true;
    }
    if (inventoryOpen) {
      setInventoryOpen(false);
      return true;
    }
    return false;
  };
  const handleLeaveGame = (): void => {
    leaveArmedRef.current = true;
    setLeaveConfirmOpen(false);
    window.history.back();
  };
  // WALK-AWAY CLOSE (Adam, 2026-10-31 — the Campfire
  // window stayed open after he'd walked off; DEV's
  // call: the whole anchored family, one mechanism, not
  // a campfire special case; claim as approved). While
  // any anchored world window is open (fire, site, pile,
  // torch, tent, home menu), her moved ticks measure the
  // distance to the window's anchor; past the leash the
  // window closes WITH ITS OWN CLOSE SEMANTICS (the same
  // setters its close control runs). The leash is the
  // range that opened it + 2 m (DRAFT — Adam's sighting
  // tunes it): faced windows opened inside HARVEST_RANGE
  // ride 4.5 m; the home menu opened on hut presence
  // rides the footprint's half + 2 m from the house's
  // center. A window whose anchor stops resolving (a
  // pile emptied out of the world, the shelter zone left)
  // closes. PENDING DIALOGS OUTRANK: while a confirm is
  // up this effect does not even subscribe — the dialog
  // owns the moment and is never orphaned over a closed
  // window; the leash resumes the moment it resolves.
  // World state is never touched: a staged ritual stays
  // staged, a fire's lighting keeps running. The pile's
  // old 2.5 m feed-clear is absorbed into this rule.
  // THE FOLD'S ARM (2026-10-31): a crafting dialog opened
  // on a stump's context rides the same leash from that
  // stump — walking off closes the dialog (and the
  // context clears with it). A PLAIN dialog (no context)
  // is never leashed: K in the open field stays open
  // until she closes it, exactly as before.
  const WALK_AWAY_LEASH = HARVEST_RANGE + 2;
  // SITE WINDOW SEAT (Adam, 2026-10-31: 'lower that
  // window a smidge' — the anchored site window's top
  // crowded the screen edge): the altar panel drops
  // this far below its standard seat. DRAFT — tunable
  // at his sighting.
  const SITE_WINDOW_DROP_PX = 24;
  useEffect(() => {
    const anyOpen =
      selectedPileId !== null ||
      selectedFireId !== null ||
      selectedSiteId !== null ||
      selectedTentId !== null ||
      selectedBagId !== null ||
      homeMenuOpen ||
      (craftingOpen && craftContextSiteId !== null);
    if (!anyOpen) return;
    const dialogUp =
      pendingTrapRecipeId !== null ||
      pendingCarriedTrap !== null ||
      pendingRemoveTarget !== null ||
      pendingRite !== null ||
      fragmentBeat !== null ||
      leaveConfirmOpen ||
      cloudPendingBring !== null ||
      cloudPendingRemove !== null ||
      cloudPendingRestore !== null ||
      cloudPendingNewGame !== null ||
      cloudConflictPrompt !== null ||
      cloudWakeOffer !== null ||
      itemInfoId !== null ||
      itemInfoId !== null;
    if (dialogUp) return;
    const off = bus.on('player:moved', ({ x, z }) => {
      const p = { x, z };
      if (selectedPileId !== null) {
        const pile = pileState.get(selectedPileId);
        if (walkAwayShouldClose(pile, p, WALK_AWAY_LEASH)) {
          selectedPileIdRef.current = null;
          setSelectedPileId(null);
        }
      }
      if (selectedFireId !== null) {
        const fire = fireState.get(selectedFireId) ?? null;
        if (walkAwayShouldClose(fire, p, WALK_AWAY_LEASH)) {
          setSelectedFireId(null);
        }
      }
      if (selectedSiteId !== null) {
        const site = sitePositionFor(selectedSiteId);
        if (walkAwayShouldClose(site, p, WALK_AWAY_LEASH)) {
          setSelectedSiteId(null);
          setRitualNote(null);
        }
      }
      if (selectedTentId !== null) {
        const tent =
          placedTents.find((t) => t.id === selectedTentId) ?? null;
        if (walkAwayShouldClose(tent, p, WALK_AWAY_LEASH)) {
          setSelectedTentId(null);
        }
      }
      if (selectedWorkstationId !== null) {
        const bench = workstationState.get(selectedWorkstationId) ?? null;
        if (walkAwayShouldClose(bench, p, WALK_AWAY_LEASH)) {
          setSelectedWorkstationId(null);
        }
      }
      if (selectedDeskId !== null) {
        const desk = deskState.get(selectedDeskId) ?? null;
        if (walkAwayShouldClose(desk, p, WALK_AWAY_LEASH)) {
          setSelectedDeskId(null);
        }
      }
      if (selectedLoomId !== null) {
        const loom = loomState.get(selectedLoomId) ?? null;
        if (walkAwayShouldClose(loom, p, WALK_AWAY_LEASH)) {
          setSelectedLoomId(null);
        }
      }
      if (selectedBagId !== null) {
        const bag =
          placedBags.find((b) => b.id === selectedBagId) ?? null;
        if (walkAwayShouldClose(bag, p, WALK_AWAY_LEASH)) {
          setSelectedBagId(null);
        }
      }
      if (homeMenuOpen) {
        const leash =
          homeHouse === undefined
            ? 0
            : HOUSE_DEFS[homeHouse.type].footprint / 2 + 2;
        if (walkAwayShouldClose(homeHouse ?? null, p, leash)) {
          setHomeMenuOpen(false);
        }
      }
      if (craftingOpen && craftContextSiteId !== null) {
        const stump = sitePositionFor(craftContextSiteId);
        if (walkAwayShouldClose(stump, p, WALK_AWAY_LEASH)) {
          setCraftingOpen(false);
        }
      }
    });
    return off;
  }, [
    selectedPileId,
    selectedFireId,
    selectedSiteId,
    selectedTentId,
    selectedBagId,
    homeMenuOpen,
    craftingOpen,
    craftContextSiteId,
    pendingTrapRecipeId,
    pendingRemoveTarget,
    pendingRite,
    fragmentBeat,
    leaveConfirmOpen,
    cloudPendingBring,
    cloudPendingRemove,
    cloudPendingRestore,
    cloudPendingNewGame,
    // THE DIALOGUP MEMBERS BELOW WERE MISSING (the
    // silent-E fix, 2026-11-05): the body's dialogUp
    // gate reads every one of these, but with them
    // absent from the deps a dialog that ROSE while a
    // menu opened and FELL afterwards never re-ran the
    // effect — the leash stayed unsubscribed and the
    // selection outlived its menu invisibly, eating E
    // until an Escape cleared it (Adam's four dead
    // acts). With them seated, a dialog's fall resumes
    // the leash and no selection can outlive the
    // dialog's shadow.
    pendingCarriedTrap,
    cloudConflictPrompt,
    cloudWakeOffer,
    itemInfoId,
    placedTents,
    homeHouse,
  ]);
  useEffect(() => {
    window.history.pushState({ silentEarthBackTrap: true }, '');
    // BEFOREUNLOAD (desktop bonus only): browsers that
    // honor it (desktop Chrome) show their native leave
    // prompt for tab close / refresh. It is NOT the
    // phone mechanism and no prompt is claimed on mobile.
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
  useEffect(() => {
    const onPopState = (): void => {
      if (leaveArmedRef.current) {
        const landed = window.history.state as {
          silentEarthBackTrap?: boolean;
        } | null;
        if (landed?.silentEarthBackTrap === true) {
          // An older reload's trap entry: keep stepping.
          window.history.back();
          return;
        }
        leaveArmedRef.current = false;
        return;
      }
      window.history.pushState({ silentEarthBackTrap: true }, '');
      if (leaveConfirmOpen) {
        // A back press while the confirm is up = Stay.
        setLeaveConfirmOpen(false);
        return;
      }
      if (closeTopmostForBack()) return;
      setLeaveConfirmOpen(true);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [
    leaveConfirmOpen,
    optionsOpen,
    introOpen,
    pendingTrapRecipe,
    pendingCarriedTrap,
    pendingRemoveTarget,
    pendingRite,
    fragmentBeat,
    placement,
    homeMenuOpen,
    selectedPileId,
    selectedTentId,
    selectedBagId,
    selectedFireId,
    selectedSiteId,
    charmsOpen,
    companionsOpen,
    journalOpen,
    craftingOpen,
    inventoryOpen,
    firstRunDialogOpen,
  ]);
  const handleFontChange = (next: FontId): void => {
    setFont(next);
    saveFontChoice(next);
  };
  const handleLookChange = (next: typeof look): void => {
    setLook(next);
    saveLookChoice(next);
  };

  // Visible thin scrollbars on the touch scroll containers
  // (Adam: "put in scrollbars"): native mobile scrollbars are
  // overlay and fade, so a user who never swipes sees no
  // affordance that a panel scrolls. WebKit gets a styled
  // 8 px thumb, Firefox gets thin + thumb/track colours;
  // iOS Safari ignores webkit scrollbar styling (platform
  // limit — swipe scrolling still reaches everything there).
  const touchScrollbar =
    '[scrollbar-width:thin] [scrollbar-color:#f0ead666_transparent] ' +
    '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-black/20 ' +
    '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#f0ead6]/40';

  // Touch wiring (see the header): the engine half landed
  // on WIP as 50f5cd6 (player.ts only) while this round was
  // in flight, so the shell wires straight to it — no key
  // synthesis, no yaw/pitch writes from the shell.
  // Move: TouchControls reports y = forward positive; the
  // engine takes z = back positive (keys convention), so
  // y is negated. Analog magnitude survives: a partial push
  // walks proportionally slower — still walk only, never
  // sprint — and terrain/hunger/boots slowdowns apply in
  // update() exactly as for keys.
  const applyTouchMove = (x: number, y: number): void => {
    playerRef.current?.setThumbstick(x, -y);
  };

  // Look: the engine's addLookDelta shares the mouse-look
  // math and the throttled player:looked emit, with NO mode
  // gate and NO pointer-lock gate by design — pitch stays
  // consistent across mode switches, and third-person
  // ground gating ignores pitch by its own rule. Touch
  // deltas are scaled by TOUCH_LOOK_SCALE (see the const):
  // taps are unaffected, since they fire interact, not
  // look deltas.
  const applyTouchLook = (dx: number, dy: number): void => {
    playerRef.current?.addLookDelta(
      dx * TOUCH_LOOK_SCALE,
      dy * TOUCH_LOOK_SCALE,
    );
  };

  // Turn stick: TouchControls reports a deflection; the shell
  // holds it and turns continuously — a held stick keeps
  // turning without re-sliding, which is the whole point
  // (drag-look is displacement-based: no travel, no turn).
  // The loop feeds the engine's existing addLookDelta, so no
  // engine change: x right turns right, y up looks up (the
  // engine's dy is screen-down positive, so y is negated).
  // At zero deflection the loop idles; dt is clamped so a
  // backgrounded tab cannot jump the view on return.
  const turnDeflectionRef = useRef({ x: 0, y: 0 });
  const applyTurn = (x: number, y: number): void => {
    turnDeflectionRef.current = { x, y };
  };
  useEffect(() => {
    if (!isTouch) return undefined;
    let frame = 0;
    let last = performance.now();
    const step = (now: number): void => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const { x, y } = turnDeflectionRef.current;
      // PAUSE GATE: the loop keeps scheduling (and `last` keeps
      // updating, so no dt jump on resume), but no look delta
      // is applied while paused — the renderer is frozen, so a
      // turn applied now would only surface as a jump later.
      if (!pausedRef.current && (x !== 0 || y !== 0)) {
        playerRef.current?.addLookDelta(
          x * TURN_STICK_PX_PER_SEC * dt,
          -y * TURN_STICK_PX_PER_SEC * dt,
        );
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isTouch]);

  // Camera pick (toggle control): V/C cycles one step, but
  // the toggle control picks a perspective directly — with
  // three modes, picking is NOT one toggle. Step the engine
  // toggle forward until the picked mode is reached (at most
  // two steps; the engine's mode advances synchronously per
  // call, and camera:switched reports each step). Reads the
  // live engine mode, not React state, so a stale render
  // cannot double-step.
  const cycleToCamera = (picked: CameraMode): void => {
    const order: CameraMode[] = ['first', 'third', 'behind'];
    const player = playerRef.current;
    if (!player || player.mode === picked) return;
    let steps = order.indexOf(picked) - order.indexOf(player.mode);
    if (steps < 0) steps += order.length;
    for (let i = 0; i < steps; i += 1) {
      player.toggleCamera();
    }
  };

  // USE DISPATCH (Adam, 2026-10-29 — the common-action
  // principle, superseding the per-thing keys T/H/F/Q of
  // the earlier buttons landing): there are no per-thing
  // keys. USE — the touch USE button, the E key, and the
  // pointer-locked click, all through handleUseInteract —
  // activates the COMMON ACTION of the one target she is
  // more or less FACING: harvest for a plant, Collect for
  // a trap, Harvest honey for a hive, OPEN for the things
  // whose interaction is a screen (pile menu, ritual
  // panel, torch/tent/fire menus, home menu), Scry for
  // the scry button. R fires the SAME target's SECOND
  // action where one exists today (handleSecondInteract).
  //
  // TARGET SELECTION = FACING (Adam: "if we're more or
  // less facing one target, that's the one we should be
  // paying attention to, not the grass, not the loom
  // behind her"). Candidates are in range (per-kind caps
  // as the rows use: HARVEST_RANGE; home via
  // shelterHouseId) AND faced — the game's existing faced
  // definition (born with 46a617d's upgrade pill, retired
  // 2026-11-01 — the definition stands): forward =
  // (sin facing, cos facing) from player.facing — one
  // read in every camera mode (first-person facing
  // tracks the look, third is travel direction, behind
  // is look-synced, player.ts) — angle < 45 degrees (dot
  // > SQRT1_2); distance 0 faced, and < 1 m counts as
  // faced (hut interiors vs the house center, a pile at
  // her feet). Behind-her candidates are OUT even when
  // nearer. Winner = the nearest of the faced set, with
  // ONE preserved sub-rule: pile vs scatter inside the
  // set resolves by pileWouldWin (pile takes ties).
  // Ground is never a faced candidate (it has no
  // direction — it is where she stands): it stays the
  // categorical last fallback after scry, so the grass
  // at her feet can never steal a faced target (the
  // aa6e88b bug was exactly ground winning by distance).
  // TWO 2026-10-29 CORRECTIONS live inside: the scatter
  // candidate is the nearest of the FACED set (not the
  // nearest overall, facing-tested alone), and ground's
  // fallback is gated on NOTHING else being in range at
  // all (accidental mud/dirt scooping).
  // ONE derivation of the winner exists (this function,
  // called once per render); the press, the R press,
  // the touch USE label, and the desktop pile button
  // all consume the stored pick (useWinnerRef), so the
  // tell can never disagree with the act.
  const pileWouldWin = (
    pile: PileTarget | undefined,
    scatter: HarvestTarget | undefined,
    fromX: number,
    fromZ: number,
  ): boolean => {
    if (!pile) return false;
    if (!scatter) return true;
    const scatterDistance =
      busTargetsRef.current.find((t) => t.id === scatter.id)?.distance ??
      Math.hypot(scatter.worldX - fromX, scatter.worldZ - fromZ);
    return pile.distance <= scatterDistance;
  };

  type UseWinner =
    | { kind: 'scatter' | 'ground'; target: HarvestTarget; distance: number }
    | { kind: 'pile'; pile: PileTarget; distance: number }
    | { kind: 'trap'; id: string; distance: number }
    | { kind: 'hive'; x: number; z: number; distance: number }
    | { kind: 'site'; siteId: string; distance: number }
    | { kind: 'fire' | 'tent' | 'bag' | 'torch' | 'loom'; id: string; distance: number }
    | { kind: 'cauldron'; id: string; distance: number }
    | { kind: 'desk'; id: string; distance: number }
    | { kind: 'workstation'; id: string; distance: number }
    | {
        kind: 'cave-enter' | 'cave-exit' | 'cave-descend' | 'cave-climb';
        id: string;
        distance: number;
      }
    | {
        kind: 'upstairs-enter' | 'upstairs-exit';
        id: string;
        distance: number;
      }
    | { kind: 'home'; distance: number }
    | { kind: 'scry'; distance: number }
    | {
        kind: 'creature';
        id: string;
        animalKind: string;
        verb: 'offer' | 'speak' | 'snatch';
        item?: ItemId;
        distance: number;
      }
    | {
        kind: 'fragment';
        fragmentId: string;
        mark: string;
        completeness: number;
        distance: number;
      };

  // A fragment carrier as the winner consumes it: the
  // facts Background names on a faced inscription (its
  // stable id, its mark, its weathering).
  type FragmentCarrier = {
    fragmentId: string;
    mark: string;
    completeness: number;
    x: number;
    z: number;
  };

  // FRAGMENT CARRIERS — THE SEAM, FILLED (First-
  // Fragment Presentation, 2026-10-31; the fill rides
  // #44 as its final inclusion, 2026-11-01): the
  // carriers she can transcribe are Background's
  // facts, and this function is the one place the
  // shell reads them — Background's projection over
  // all five carrier classes (carriers.ts, 3191082),
  // asked for exactly the winner's own range; the
  // challenger loop below applies facing + range on
  // top, as it does for the trap and the hive. While
  // the facts were unlanded this returned an empty
  // list and the TRANSCRIBE verb stood armed but dark
  // (the raven guide's dormancy pattern); on this
  // fill the presentation goes live whole.
  const fragmentCarriersHere = (): FragmentCarrier[] => {
    const player = playerRef.current;
    const gen = genRef.current;
    if (!player || !gen) return [];
    // IN-CAVE CARRIER (UI, 2026-11-06; found by
    // Background's separation drive): the projection
    // below prices carriers by SURFACE geography —
    // cave instances enumerated in a rect around her
    // SURFACE position. Underground she stands in
    // cave coordinates, where no surface instance
    // stands, so a cave's own Circle stone could
    // never be offered in-cave. Underground, ask the
    // active cave directly (carriers.caveCarrier,
    // Background's exported per-instance read) and
    // price its stone in the cave frame she stands
    // in. The debut cave mints no carrier (its
    // layout reports no fragment spot — Adam,
    // 2026-11-01), so cave:main returns [] here,
    // unchanged; the surface path below is
    // untouched.
    // PER-LAYER READ (UI, 2026-11-06; Background's
    // cave depth + fragment core, bb00bf1): a cave
    // can now carry a stone on ANY floor — the
    // deepest guaranteed, each earlier floor by its
    // pay roll (Adam's fork: the entry floor counts
    // as the first intermediate) — so the question
    // is asked of the floor she STANDS on:
    // carriers.caveCarrierForLayer, fed her layer
    // (dimensionState.currentLayer(), 1-based). The
    // deepest floor's read IS caveCarrier (id and
    // completeness byte-stable), a paying earlier
    // floor mints '<key>:fragment:L<n>', and a floor
    // that rolled no stone reads null — the branch's
    // contract is unchanged ([carrier] within
    // HARVEST_RANGE, else []), and floor coordinates
    // keep the floors apart. The core also lifted
    // the cave:main exclusion (the debut deals and
    // mints like any cave); the branch is agnostic —
    // it asks, it does not mint.
    if (dimensionState.isUnderground()) {
      const carrier = caveCarrierForLayer(
        gen.seed,
        dimensionState.activeKey(),
        dimensionState.currentLayer(),
      );
      if (
        carrier &&
        Math.hypot(carrier.x - player.x, carrier.z - player.z) <=
          HARVEST_RANGE
      ) {
        return [carrier];
      }
      return [];
    }
    return carriersHere(
      gen.seed,
      gen.findSpawn(),
      (x, z) => gen.weightsAt(x, z),
      player.x,
      player.z,
      HARVEST_RANGE,
    );
  };

  // GROVE TREE FACT (Adam, 2026-10-30): a scatter target
  // is one of the Grove's own trees when its source fells
  // on harvest (the tree sources) and its position lies
  // inside the grove's clearing — the SAME fact the
  // engine's grove-protection backstop reads in
  // harvest.ts, derived from the same sites.ts surface,
  // so the name tag and the refusal can never disagree.
  // The site derives from the seed (memoized in
  // sites.ts), never from saved state. Her own planted
  // saplings carry a different source and never read as
  // grove trees here, matching the backstop.
  const isGroveTreeTarget = (target: HarvestTarget): boolean => {
    const source = SOURCE_BY_ID[target.sourceId];
    if (!source?.fellOnHarvest) return false;
    const gen = genRef.current;
    if (!gen) return false;
    const grove = groveSite(gen.seed, gen.findSpawn(), (x, z) =>
      gen.weightsAt(x, z).dominant,
    );
    return groveContains(grove, target.worldX, target.worldZ);
  };

  const computeUseWinner = (): UseWinner | null => {
    const player = playerRef.current;
    if (!player) return null;
    const forwardX = Math.sin(player.facing);
    const forwardZ = Math.cos(player.facing);
    const facingOf = (
      x: number,
      z: number,
    ): { isFaced: boolean; distance: number } => {
      const dx = x - player.x;
      const dz = z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 1) return { isFaced: true, distance };
      return {
        isFaced: (dx * forwardX + dz * forwardZ) / distance > Math.SQRT1_2,
        distance,
      };
    };
    // The harvest pair first: scatter + pile, resolved by
    // pileWouldWin inside the faced set.
    // FACED-SCATTER CORRECTION (2026-10-29): the scatter
    // candidate is the nearest of the FACED set — Adam's
    // pinned amendment, which the first version of this
    // function missed: it took the first scatter in
    // tracker order (nearest overall) and facing-tested
    // that one alone, so a plant behind her silently
    // vetoed every faced plant beyond it. Now every
    // in-range scatter is facing-tested and the nearest
    // faced one is the candidate (distance per candidate
    // from the bus targets when present, the facing
    // computation otherwise — the existing sources).
    let scatter: HarvestTarget | undefined;
    let scatterDistance: number | null = null;
    for (const candidate of harvestTargets) {
      if (candidate.kind !== 'scatter') continue;
      const f = facingOf(candidate.worldX, candidate.worldZ);
      if (!f.isFaced) continue;
      const d =
        busTargetsRef.current.find((t) => t.id === candidate.id)?.distance ??
        f.distance;
      if (scatterDistance === null || d < scatterDistance) {
        scatter = candidate;
        scatterDistance = d;
      }
    }
    const scatterFacing = scatter
      ? { isFaced: true, distance: scatterDistance! }
      : null;
    let pairWinner: UseWinner | null = null;
    const facedPile = piles.find(
      (pile) => facingOf(pile.x, pile.z).isFaced,
    );
    if (facedPile && scatter && scatterFacing!.isFaced) {
      pairWinner = pileWouldWin(facedPile, scatter, player.x, player.z)
        ? { kind: 'pile', pile: facedPile, distance: facedPile.distance }
        : { kind: 'scatter', target: scatter, distance: scatterDistance! };
    } else if (facedPile) {
      pairWinner = {
        kind: 'pile',
        pile: facedPile,
        distance: facedPile.distance,
      };
    } else if (scatter && scatterFacing!.isFaced) {
      pairWinner = {
        kind: 'scatter',
        target: scatter,
        distance: scatterDistance!,
      };
    }
    // GROUND GATE bookkeeping (see the fallback below):
    // whether ANY candidate is in range at all, faced or
    // not. Scatter, pile, trap, hive, and home are known
    // here; sites and placed kinds add themselves inside
    // their consider helpers as they range-check.
    let anyCandidateInRange =
      harvestTargets.some((t) => t.kind === 'scatter') ||
      piles.length > 0 ||
      !!trapRowTrap ||
      !!hiveRowHive ||
      homeHouse !== undefined;
    // The rest of the field, in tie order (the pair winner
    // keeps ties — challengers must be strictly nearer).
    const challengers: UseWinner[] = [];
    // THE DIRECTION-FREE DOORS (Adam's ruling, 2026-11-06:
    // 'the direction shouldn't have anything to do with
    // the exit... exit pill should appear for her wherever
    // she is in that circle'; extended the same day to the
    // Go deeper pill, and the climb with it): the cave-exit,
    // cave-climb and cave-descend arms seat HERE instead of
    // the challenger race — priced on zone alone (within
    // their reach of the anchor, no cone), and a seated zone
    // door WINS the race outright (see the return below): a
    // door under her feet outranks a faced harvestable; she
    // can step out of the circle to harvest. Two doors can
    // be live in one room (layer 1 seats the exit and the
    // descend): the NEAREST zone door holds the seat, and
    // the exit — seated first — keeps it on a tie (the way
    // out outranks the way down).
    let zoneExit: UseWinner | null = null;
    if (trapRowTrap) {
      const f = facingOf(trapRowTrap.x, trapRowTrap.z);
      if (f.isFaced) {
        challengers.push({
          kind: 'trap',
          id: trapRowTrap.id,
          distance: f.distance,
        });
      }
    }
    if (hiveRowHive) {
      const f = facingOf(hiveRowHive.x, hiveRowHive.z);
      if (f.isFaced) {
        challengers.push({
          kind: 'hive',
          x: hiveRowHive.x,
          z: hiveRowHive.z,
          distance: f.distance,
        });
      }
    }
    // FRAGMENT CARRIERS (First-Fragment Presentation):
    // a faced carrier in range challenges like the
    // trap and the hive (the seam above
    // computeUseWinner reads Background's facts).
    for (const carrier of fragmentCarriersHere()) {
      const f = facingOf(carrier.x, carrier.z);
      if (f.distance <= HARVEST_RANGE) anyCandidateInRange = true;
      if (f.isFaced && f.distance <= HARVEST_RANGE) {
        challengers.push({
          kind: 'fragment',
          fragmentId: carrier.fragmentId,
          mark: carrier.mark,
          completeness: carrier.completeness,
          distance: f.distance,
        });
      }
    }
    let siteBest: UseWinner | null = null;
    const considerSite = (siteId: string, x: number, z: number): void => {
      const f = facingOf(x, z);
      if (f.distance <= HARVEST_RANGE) anyCandidateInRange = true;
      if (
        f.isFaced &&
        f.distance <= HARVEST_RANGE &&
        (siteBest === null || f.distance < siteBest.distance)
      ) {
        siteBest = { kind: 'site', siteId, distance: f.distance };
      }
    };
    for (const pos of stumpPositions(genRef.current, player.x, player.z)) {
      considerSite(stumpSiteId(pos.x, pos.z), pos.x, pos.z);
    }
    for (const altar of placedAltars) {
      considerSite(altar.id, altar.x, altar.z);
    }
    if (siteBest !== null) challengers.push(siteBest);
    const considerPlaced = (
      kind:
      | 'fire'
      | 'tent'
      | 'bag'
      | 'torch'
      | 'loom'
      | 'cauldron'
      | 'workstation',
      id: string,
      x: number,
      z: number,
    ): void => {
      const f = facingOf(x, z);
      if (f.distance <= HARVEST_RANGE) anyCandidateInRange = true;
      if (f.isFaced && f.distance <= HARVEST_RANGE) {
        challengers.push({ kind, id, distance: f.distance });
      }
    };
    for (const fire of placedFires) {
      considerPlaced('fire', fire.id, fire.x, fire.z);
    }
    for (const tent of placedTents) {
      considerPlaced('tent', tent.id, tent.x, tent.z);
    }
    for (const bag of placedBags) {
      considerPlaced('bag', bag.id, bag.x, bag.z);
    }
    for (const torch of placedTorches) {
      considerPlaced('torch', torch.id, torch.x, torch.z);
    }
    // Placed looms (loom fold-in, 2026-10-30): looms join
    // the winner race in the same placed-object idiom —
    // Adam's completed station law needs the loom to be
    // a FACED target (it had no winner kind, so its
    // station could never feed). Read from the singleton
    // directly (no React mirror exists for looms; the
    // anchors loop reads snapshots the same way).
    for (const loom of loomState.snapshot()) {
      considerPlaced('loom', loom.id, loom.x, loom.z);
    }
    // Placed workstations (the furniture-verbs build):
    // the bench joins the race — its verbs (Craft +
    // Pick up, on its own menu) are always live, so
    // candidacy is the loom's plain shape.
    for (const bench of workstationState.snapshot()) {
      considerPlaced('workstation', bench.id, bench.x, bench.z);
    }
    // Placed cauldrons (placed-cauldron build): the pot
    // is its own target, keyed by its hearth's id — read
    // from Background's singleton like the looms.
    for (const cauldron of cauldronState.snapshot()) {
      considerPlaced('cauldron', cauldron.hearthId, cauldron.x, cauldron.z);
    }
    // PLACED DESKS (the grimoire's seat, 2026-11-01;
    // candidacy widened by the furniture-verbs build,
    // 2026-11-05): a desk used to join the race ONLY
    // when a book verb was live (seated, or bare with
    // the book in her pack) — a bare desk and empty
    // hands was silence. Adam's rule (a placed thing's
    // verbs live on the thing itself) gives every desk
    // a standing verb — Pick up, on its own menu — so
    // candidacy is now the plain faced shape, the loom
    // pattern. Read live from the singleton (no shell
    // mirror).
    for (const desk of deskState.snapshot()) {
      const f = facingOf(desk.x, desk.z);
      if (f.distance <= HARVEST_RANGE) anyCandidateInRange = true;
      if (f.isFaced && f.distance <= HARVEST_RANGE) {
        challengers.push({ kind: 'desk', id: desk.id, distance: f.distance });
      }
    }
    // COMPANIONS (Piece B, 2026-10-31): the faced
    // creature joins the race ONLY when a verb is live
    // (creatureVerbFor — narrow candidacy; ambience is
    // never a target). The derivation reads the
    // renderer's live animal feed at render — the same
    // surface AnimalTag polls, now carrying the stable
    // spawn ids Systems' records key on.
    const animalRenderer = rendererRef.current;
    if (animalRenderer) {
      for (const animal of animalRenderer.getVisibleAnimals()) {
        const live = creatureVerbFor(animal);
        if (live === null) continue;
        const f = facingOf(animal.x, animal.z);
        if (f.distance <= HARVEST_RANGE) anyCandidateInRange = true;
        if (f.isFaced && f.distance <= HARVEST_RANGE) {
          challengers.push({
            kind: 'creature',
            id: animal.id,
            animalKind: animal.kind,
            verb: live.verb,
            item: live.item,
            distance: f.distance,
          });
        }
      }
    }
    // CAVE TRAVEL (claim as approved 2026-10-30): the
    // dimension anchors join the same race — on the
    // surface, the cave dimension's mouths (the cave
    // mouth site + the farm's cellar door, one arm);
    // underground, the current layer's anchors (layer 1:
    // the entry anchor is the way OUT, its shaft anchor
    // the way DOWN; layer 2: the entry anchor she
    // arrived at is the way back UP). Read live from
    // Background's caves module, like the looms read
    // their singleton — no shell mirror.
    const considerCave = (
      kind:
        | 'cave-enter'
        | 'cave-exit'
        | 'cave-descend'
        | 'cave-climb'
        | 'upstairs-enter'
        | 'upstairs-exit',
      id: string,
      x: number,
      z: number,
      range: number = HARVEST_RANGE,
    ): void => {
      const f = facingOf(x, z);
      if (f.distance <= range) anyCandidateInRange = true;
      if (
        kind === 'cave-exit' ||
        kind === 'cave-climb' ||
        kind === 'cave-descend'
      ) {
        // Zone alone (Adam's ruling, above): no cone
        // test. The nearest zone door holds the seat.
        if (
          f.distance <= range &&
          (zoneExit === null || f.distance < zoneExit.distance)
        ) {
          zoneExit = { kind, id, distance: f.distance };
        }
        return;
      }
      if (f.isFaced && f.distance <= range) {
        challengers.push({ kind, id, distance: f.distance });
      }
    };
    // UPSTAIRS TRAVEL (UI half, 2026-11-01): the
    // farmhouses' stairs join the same race. dimensionState
    // reads ANY non-surface key as "underground", so the
    // upstairs arm must be read BEFORE the cave arms: inside
    // an upstairs zone the only travel candidate is the way
    // back DOWN — the zone layout's entry anchor (just
    // inside the stair-head door she arrived at). On the
    // surface, every farmhouse's STAIR HEAD is an entry
    // candidate — the singular plus each family instance in
    // reach — and the winner id is the HOUSE KEY, the id
    // enterUpstairs routes by. Read live from Background's
    // attics module, like the cave mouths read caves — no
    // shell mirror.
    const activeDimensionKey = dimensionState.activeKey();
    if (isUpstairsKey(activeDimensionKey)) {
      const gen = genRef.current;
      if (gen) {
        const layout = atticLayoutForKey(
          String(gen.seed),
          gen.findSpawn(),
          (x, z) => gen.weightsAt(x, z),
          activeDimensionKey,
        );
        if (layout) {
          considerCave(
            'upstairs-exit',
            '',
            layout.entryAnchor.x,
            layout.entryAnchor.z,
          );
        }
      }
    } else if (!dimensionState.isUnderground()) {
      const gen = genRef.current;
      if (gen) {
        // PLURAL CAVES (2026-10-30): mouths arrive in ONE
        // list — the debut cave's two plus every
        // registered instance near her (instances keyed
        // by their cave key as the winner id; travel
        // routes by it).
        // THE MOUTH'S OWN REACH (Adam's cave-mouth fix,
        // 2026-11-06): the entry offer prices at
        // CAVE_ENTER_RANGE_M around the reseated spot —
        // from his reported stand in front of the debut
        // mouth, the ENTER pill must stand. Other arms
        // keep HARVEST_RANGE.
        for (const mouth of caveMouthsNear(
          String(gen.seed),
          gen.findSpawn(),
          (x, z) => gen.weightsAt(x, z),
          player.x,
          player.z,
          CAVE_ENTER_RANGE_M,
        )) {
          considerCave('cave-enter', mouth.id, mouth.spot.x, mouth.spot.z, CAVE_ENTER_RANGE_M);
        }
        // UPSTAIRS ENTRY: the singular's key is the bare
        // 'farmhouse'; each family instance rides its own
        // key. The rect is padded well past the race range
        // (a stair head can be in range while its house's
        // center is not); considerCave re-gates on the
        // head's own facing + distance, exactly.
        const houseKeys: string[] = ['farmhouse'];
        const stairReach = HARVEST_RANGE + 16;
        for (const inst of farmhouseInstancesInRect(
          String(gen.seed),
          gen.findSpawn(),
          (x, z) => gen.weightsAt(x, z),
          {
            minX: player.x - stairReach,
            maxX: player.x + stairReach,
            minZ: player.z - stairReach,
            maxZ: player.z + stairReach,
          },
        )) {
          houseKeys.push(inst.key);
        }
        for (const houseKey of houseKeys) {
          const mouth = upstairsMouthFor(
            String(gen.seed),
            gen.findSpawn(),
            (x, z) => gen.weightsAt(x, z),
            houseKey,
          );
          if (mouth) {
            considerCave(
              'upstairs-enter',
              houseKey,
              mouth.stairHead.x,
              mouth.stairHead.z,
            );
          }
        }
      }
    } else {
      // The anchors of the cave she's actually in
      // (pluralization: the layout reads by active key).
      const layout = caveLayoutForKey(seed, dimensionState.activeKey());
      // THE DOORS PRICE PER FLOOR (the depth core,
      // 2026-11-06): the exit on the entry floor; the
      // climb at any deeper floor's own up hole; the
      // descend at any floor's shaft that has a floor
      // below it. Each is a direction-free zone act, as
      // ruled — inside its circle the pill stands at any
      // facing, and the nearest door holds the seat.
      const layerNow = dimensionState.currentLayer();
      const layerHere = layout.layers[layerNow - 1];
      if (layerNow === 1) {
        // THE EXIT'S OWN REACH (Adam's exit pin,
        // 2026-11-06): the offer prices off the entry
        // BLOCK (CAVE_EXIT_RANGE_M), not the bare anchor
        // point — and by his later ruling the same day
        // it prices on zone alone: anywhere inside the
        // reach, facing anywhere, the EXIT pill stands
        // (the direction-free seat in considerCave).
        considerCave(
          'cave-exit',
          '',
          layout.entryAnchor.x,
          layout.entryAnchor.z,
          CAVE_EXIT_RANGE_M,
        );
      }
      if (layerNow >= 2 && layerHere) {
        // THE UP HOLE (Adam's separation ruling,
        // 2026-11-06): the climb prices from the layer's
        // upAnchor — its own point, dealt clear of the
        // down landing (the entry anchor) she arrived at.
        const up = layerHere.upAnchor ?? layerHere.entryAnchor;
        if (up) considerCave('cave-climb', '', up.x, up.z, CAVE_EXIT_RANGE_M);
      }
      if (layerHere && layout.layers.length > layerNow) {
        // GO DEEPER IS A DOOR TOO (Adam's ruling extended,
        // 2026-11-06): the descend seats in the same
        // direction-free zone as the exit — its circle is
        // its own reach (the default: she stands at the
        // shaft mouth), and inside it the pill stands at
        // any facing. It seats only when a floor actually
        // lies below; a lone floor's shaft mouth offers
        // nothing (the travel refusal stays as backstop).
        const shaft = layerHere.shaftAnchor;
        if (shaft) considerCave('cave-descend', '', shaft.x, shaft.z);
      }
    }
    if (homeHouse !== undefined) {
      const f = facingOf(homeHouse.x, homeHouse.z);
      // WHOLE-HUT ZONE (Adam, 2026-10-29 — inside his hut
      // the menu 'appears only in a very small location';
      // the zone should be as large as the hut): inside
      // the sheltering house's footprint — center distance
      // ≤ footprint/2, read from the engine table, no new
      // constant — the home candidate joins the race on
      // PRESENCE alone, facing waived; she is standing in
      // the house, so the door is the house. Outside the
      // footprint the faced-center rule is exactly as
      // before, and the race distance stays the center
      // distance either way.
      const insideHomeFootprint =
        f.distance <= HOUSE_DEFS[homeHouse.type].footprint / 2;
      if (f.isFaced || insideHomeFootprint) {
        challengers.push({ kind: 'home', distance: f.distance });
      }
    }
    let winner = pairWinner;
    for (const challenger of challengers) {
      if (winner === null || challenger.distance < winner.distance) {
        winner = challenger;
      } else if (
        // CAULDRON TIE RULE (DEV, 2026-10-30): the pot
        // and its hearth share (x, z) exactly, so their
        // distances are always equal — at the tie the
        // CAULDRON outranks its own hearth (the smaller,
        // more specific target). Only its own hearth
        // yields; no other pairing is affected.
        challenger.kind === 'cauldron' &&
        winner.kind === 'fire' &&
        challenger.id === winner.id &&
        challenger.distance === winner.distance
      ) {
        winner = challenger;
      }
    }
    // A seated zone door outranks the whole race (Adam's
    // ruling, 2026-11-06 — see the zoneExit seat above).
    if (zoneExit !== null) return zoneExit;
    if (winner !== null) return winner;
    // Fallbacks: scry (visible; it has no world position,
    // so it never outranks a positioned target), then
    // ground, then nothing.
    if (scryVisible) return { kind: 'scry', distance: Infinity };
    const ground = harvestTargets.find(
      (candidate) => candidate.kind === 'ground',
    );
    // GROUND, NARROWED (Adam, 2026-10-29 — an unintended
    // 'Mud x 31' pile: "picking up Mud or Dirt [must be]
    // intentional"): ground wins ONLY when no other
    // candidate is in range at all. With anything near —
    // faced or not — a press that faces nothing is a
    // no-op, not a scoop. Bare ground with nothing else
    // near still scoops by E or pill: the scoop-anywhere
    // pin survives, narrowed to where it can't be an
    // accident.
    if (ground && !anyCandidateInRange) {
      return { kind: 'ground', target: ground, distance: 0 };
    }
    return null;
  };

  // CAVE TRAVEL REFUSALS (her register, DRAFT for
  // Adam's pin pass): Background's travel validates
  // before anything moves, so a refusal is whole — the
  // line is the whole surface. 'wrong-dimension' and
  // 'unknown-mouth' are unreachable from a correct
  // winner and share the blocked line as backstop.
  const CAVE_TRAVEL_REFUSALS: Record<string, string> = {
    'no-deeper-layer': 'The shaft goes no deeper.',
    'already-deepest': 'There is nowhere deeper here.',
    'anchor-blocked': 'The way is blocked.',
    'wrong-dimension': 'The way is blocked.',
    'unknown-mouth': 'The way is blocked.',
    // The upstairs arm's backstop (UI half, 2026-11-01):
    // unreachable from a correct winner, like its cave kin.
    'unknown-house': 'The way is blocked.',
  };

  // The travel press: compose Background's validated
  // travel functions from the faced winner. A refusal
  // joins the message feed like every spoken line.
  const handleCaveTravel = (winner: {
    kind: 'cave-enter' | 'cave-exit' | 'cave-descend' | 'cave-climb';
    id: string;
  }): void => {
    const player = playerRef.current;
    const renderer = rendererRef.current;
    const gen = genRef.current;
    if (!player || !renderer || !gen) return;
    let outcome: TravelOutcome;
    if (winner.kind === 'cave-enter') {
      outcome = enterCave(renderer, player, gen, winner.id);
    } else if (winner.kind === 'cave-exit') {
      outcome = exitCave(renderer, player);
    } else if (winner.kind === 'cave-descend') {
      outcome = descend(player);
    } else {
      outcome = ascend(player);
    }
    if (outcome.ok === false) {
      const line = CAVE_TRAVEL_REFUSALS[outcome.reason] ?? 'The way is blocked.';
      showFeedback(line, 'blocked');
    }
  };

  // THE PASSAGE'S CONSUMER (Adam's cave-mouth fix,
  // 2026-11-06): the renderer declares a threshold
  // crossing ('cave:threshold-crossed'); the travel
  // composition is the pill's own — enterCave by the
  // mouth id, refusals from the same table. The guard
  // mirrors the race's arms: the passage speaks only
  // from the surface (dimensionState reads any
  // non-surface key as underground, attics included).
  useEffect(() => {
    const off = bus.on('cave:threshold-crossed', ({ mouthId }) => {
      if (dimensionState.isUnderground()) return;
      if (isUpstairsKey(dimensionState.activeKey())) return;
      handleCaveTravel({ kind: 'cave-enter', id: mouthId });
    });
    return off;
  }, []);

  // The upstairs press (UI half, 2026-11-01): the cave
  // press's sibling — compose Background's validated
  // upstairs travel from the faced winner. Entry routes
  // by the winner's house key; exit needs no id (the
  // engine kept her return anchor at entry). Refusals
  // speak from the same table as the caves'.
  const handleUpstairsTravel = (winner: {
    kind: 'upstairs-enter' | 'upstairs-exit';
    id: string;
  }): void => {
    const player = playerRef.current;
    const renderer = rendererRef.current;
    const gen = genRef.current;
    if (!player || !renderer || !gen) return;
    const outcome =
      winner.kind === 'upstairs-enter'
        ? enterUpstairs(renderer, player, gen, winner.id)
        : exitUpstairs(renderer, player);
    if (outcome.ok === false) {
      const line = CAVE_TRAVEL_REFUSALS[outcome.reason] ?? 'The way is blocked.';
      showFeedback(line, 'blocked');
    }
  };

  // The USE press itself: fire the winner's common
  // action through the SAME handler its button, row, or
  // chip tap calls. Harvest presses go through the
  // engine's pressUse (the outcome listener re-validates
  // range + permit, so a stale press fails safely). The
  // zero-arg player.pressUse() path is NOT used (its
  // shell query has no callers).
  // TRANSCRIBE (First-Fragment Presentation,
  // 2026-10-31): the pill/E press at a faced carrier.
  // Systems' FragmentState judges (the journal gate,
  // the already-noted gate) and records; the shell
  // voices the outcome. A mark's FIRST copy raises the
  // teaching beat (a dialog, not a feed line — the
  // moment is the lesson); the threshold-reaching copy
  // adds its completion line to the feed. All lines
  // DRAFT. THE GATE IS THE JOURNAL ALONE (Adam,
  // 2026-11-05 — settled after a same-day two-book
  // ruling was countermanded on his reframing: the
  // grimoire LIVES ON ITS DESK, too heavy to field-
  // carry by design; the journal LINKS to it, so in
  // the field the journal does — hasJournal reads the
  // carried journal itself, and the no-journal refusal
  // speaks the reason in Adam's draft voice: 'You
  // have no journal to record it in.').
  const handleTranscribe = (winner: {
    fragmentId: string;
    mark: string;
    completeness: number;
  }): void => {
    const state = fragmentStateRef.current;
    const day = rendererRef.current?.snapshotSky()?.daysElapsed ?? 0;
    const result = state.inscribe(
      winner.fragmentId,
      winner.mark,
      winner.completeness,
      inventory.count(ITEMS.journal) >= 1,
      day,
    );
    if (result.ok === false) {
      if (result.code === 'no-journal') {
        showFeedback('You have no journal to record it in.', 'blocked');
      } else {
        showFeedback('Already in your journal.', 'info');
      }
      return;
    }
    const name = markDisplayName(winner.mark);
    const tally = state.tallyFor(winner.mark);
    showFeedback(
      `Copied into your journal — the ${name} mark, ${result.count} of ${tally.needed}.` +
        (result.bestImproved
          ? ' A cleaner copy than the one you kept.'
          : ''),
      'gain',
    );
    if (result.first) {
      // First-ever (the journal's only begun mark, at
      // its first copy) teaches the whole pursuit; a
      // later mark's first teaches the shorter form.
      const firstEver =
        state.snapshot().length === 1 && result.count === 1;
      setFragmentBeat(
        firstEver
          ? {
              title: `The ${name} mark`,
              body: `A carved mark, copied into your journal. It is one piece of the ${name} mark — three fragments make its first tier whole. From now on you are looking for the rest, and your journal keeps the tally.`,
            }
          : {
              title: `A new mark — ${name}`,
              body: `The first piece of the ${name} mark, copied into your journal. Three fragments make its first tier whole.`,
            },
      );
    } else if (result.tierComplete && result.count === tally.needed) {
      showFeedback(`The ${name} mark — its first tier is whole.`, 'gain');
    }
    saveNow();
  };

  const handleUseInteract = (): void => {
    const player = playerRef.current;
    if (!player) return;
    const winner = useWinnerRef.current;
    if (winner === null) return;
    switch (winner.kind) {
      case 'scatter':
      case 'ground':
        // GROVE TREES: nothing to press (Adam, 2026-10-30)
        // — the name tag is the whole surface; the press
        // offers no harvest at one of the grove's own
        // trees. (The Shift+E remove chord is not a
        // presented pill and rides the engine's refusal.)
        if (winner.kind === 'scatter' && isGroveTreeTarget(winner.target)) {
          break;
        }
        player.pressUse({
          targetId: winner.target.id,
          sourceId: winner.target.sourceId,
          kind: winner.target.kind,
          x: winner.target.worldX,
          z: winner.target.worldZ,
        });
        break;
      case 'pile':
        selectedPileIdRef.current = winner.pile.id;
        setSelectedPileId(winner.pile.id);
        break;
      case 'trap':
        handleCollectTrap(winner.id);
        break;
      case 'hive':
        handleHarvestHive(winner.x, winner.z);
        break;
      case 'site':
        // THE FOLD: a stump opens the crafting dialog on
        // its context (doors inside); an altar site keeps
        // its anchored panel. Stumps no longer select.
        if (winner.siteId.startsWith('stump:')) {
          openStumpContext(winner.siteId);
        } else {
          setSelectedSiteId(winner.siteId);
        }
        break;
      case 'fire': {
        const fire = placedFires.find((f) => f.id === winner.id);
        if (fire !== undefined) openFireDoor(fire);
        break;
      }
      case 'tent':
        setSelectedTentId(winner.id);
        break;
      case 'bag':
        setSelectedBagId(winner.id);
        break;
      case 'creature':
        // The faced creature's live verb (Piece B) —
        // the same act the creature pill runs.
        handleCreatureInteract(winner);
        break;
      case 'fragment':
        // The faced carrier's verb (First-Fragment
        // Presentation) — the same act the fragment
        // pill runs.
        handleTranscribe(winner);
        break;
      case 'torch':
        // TORCH PICKUP ON E (Adam, 2026-10-31): E at a
        // faced placed torch picks it up — the same
        // pickup the torch window's Pick up act runs
        // (grant-first; a full pack refuses at the torch
        // and the torch stays). This DISPLACES E's old
        // torch act (opening the window): the window
        // stays as the second door, behind the torch's
        // chip click. R already picked up and is
        // unchanged — E and R agree now.
        handlePickupTorch(winner.id);
        break;
      case 'loom':
        // The loom's E (the furniture-verbs build,
        // 2026-11-05 — Adam's rule: a placed thing's
        // verbs live on the thing itself): E selects
        // the loom and its own menu stands — Weave (the
        // Crafting panel, as before, one row deeper)
        // and Pick up. The panel opened at the loom
        // carries the pick-up too (K parity). Before
        // this build E opened the panel directly and
        // the loom had no pick-up anywhere.
        setSelectedLoomId(winner.id);
        break;
      case 'workstation':
        // The bench's E (the furniture-verbs build):
        // the bench joins the menu family — Craft (the
        // panel) and Pick up, on the piece itself.
        // Before this build the bench had no winner and
        // E at a bench did nothing at all.
        setSelectedWorkstationId(winner.id);
        break;
      case 'cauldron':
        setSelectedCauldronHearthId(winner.id);
        break;
      case 'desk':
        // The desk's E (the furniture-verbs build):
        // E selects the desk and its own menu stands —
        // the book acts (Place / Take / Read, as the
        // state allows) and Pick up. Before this build
        // E ran the seat/take act in one press; the act
        // itself is unchanged, one row deeper, and R
        // still reads a seated book directly.
        setSelectedDeskId(winner.id);
        break;
      case 'cave-enter':
      case 'cave-exit':
      case 'cave-descend':
      case 'cave-climb':
        handleCaveTravel(winner);
        break;
      case 'upstairs-enter':
      case 'upstairs-exit':
        handleUpstairsTravel(winner);
        break;
      case 'home':
        setHomeMenuOpen(true);
        break;
      case 'scry':
        handleScry();
        break;
    }
  };

  // R — the winner's SECOND action (Adam, 2026-10-29,
  // tentative made real for the seconds that exist
  // today): removable scatter → Remove (the SAME confirm
  // Shift+E arms — R sits ALONGSIDE Shift+E, which stays
  // as pinned; the difference is scope: Shift+E reaches
  // the nearest removable scatter whatever the winner is,
  // R acts on the winner); pile → pick up the WHOLE pile on
  // the existing pickup path (Adam pinned: "R can pick
  // up the whole pile if possible" — the grant's own
  // capacity behavior, no second rule); torch → Pick
  // up; tent → Take down; home → Rest (night-gated
  // exactly as its menu disables it). Trap, hive, fire,
  // site, scry, and ground have no second action today:
  // R is a no-op there (hive Relocate is an unbuilt
  // seed, named not built).
  const handleSecondInteract = (): void => {
    // The jar's FILL (Adam's door set): while the fill
    // offer stands (near water, an empty jar carried),
    // the water's own pill reads 'Fill Jar [R]' — R
    // belongs to the water while the offer stands,
    // ahead of the winner's second act. Stepping away
    // restores the winner's R.
    if (fillOfferRef.current) {
      runFillJar();
      return;
    }
    const winner = useWinnerRef.current;
    if (winner === null) return;
    switch (winner.kind) {
      case 'scatter':
        // The Remove offer's honesty (2026-10-31): R
        // arms the confirm only where Remove may be
        // offered — ground-class scatter gets nothing.
        if (winner.target.removable) {
          setPendingRemoveTarget(winner.target);
        }
        break;
      case 'pile':
        bus.emit('pile:pickup-requested', { pileId: winner.pile.id });
        break;
      case 'torch':
        handlePickupTorch(winner.id);
        break;
      case 'tent':
        handleTentAction(winner.id, 'take-down');
        break;
      case 'bag':
        handleBagAction(winner.id, 'pick-up');
        break;
      case 'trap':
        // The trap's second act (the trap chunk): pick
        // up a set carryable, dismantle a set deadfall —
        // the one routing the pill row's second button
        // also runs.
        handleTrapSecondAct(winner.id);
        break;
      case 'desk':
        // The desk's second act (the read gate): Read
        // the seated grimoire — the camp act that opens
        // the tally panel at its desk.
        handleDeskRead(winner.id);
        break;
      case 'home': {
        const rest = homeMenuActions().find((a) => a.id === 'rest');
        if (rest && rest.disabled !== true) handleHomeMenuAction('rest');
        break;
      }
      default:
        break;
    }
  };

  // MENU KEYS (carried from the buttons landing, as
  // amended): digits 1-9 fire an open world menu's
  // actions in render order; Enter confirms an armed
  // placement. Dispatch precedence among open menus
  // mirrors the Esc chain's topmost order (home → pile
  // → torch → tent → fire → site). The ritual panel's
  // digit dispatch reads the hoisted kind/food lists
  // below, so the panel and the keys can never disagree
  // about order. Panel-internal key navigation beyond
  // digits is OUT (the mouse layer, Adam's call if he
  // wants it); phone unchanged.
  const flattenMenuTargets = (
    actions: ContextAction[],
  ): { id: string; disabled: boolean }[] =>
    actions.flatMap((action) =>
      action.arrows
        ? action.arrows.map((arrow) => ({
            id: arrow.id,
            disabled: arrow.disabled === true,
          }))
        : [{ id: action.id, disabled: action.disabled === true }],
    );

  const dispatchWorldMenuDigit = (digit: number): void => {
    if (homeMenuOpen) {
      const target = flattenMenuTargets(homeMenuActions())[digit - 1];
      if (target && !target.disabled) handleHomeMenuAction(target.id);
      return;
    }
    if (selectedPile !== null) {
      // The pile modal's verbs come from its surface's
      // reported VISIBLE list (unification) — digits hit
      // what the badges show, in visible order.
      const visible = pileVisibleVerbsRef.current;
      const target =
        visible !== null && visible.pileId === selectedPile.id
          ? visible.verbs[digit - 1]
          : undefined;
      if (target && !target.disabled) {
        handlePileAction(selectedPile, target.verbId);
      }
      return;
    }
    if (selectedTent !== undefined) {
      const target = flattenMenuTargets(tentMenuActions())[digit - 1];
      if (target && !target.disabled) {
        handleTentAction(selectedTent.id, target.id);
      }
      return;
    }
    if (selectedBag !== undefined) {
      const target = flattenMenuTargets(bagMenuActions())[digit - 1];
      if (target && !target.disabled) {
        handleBagAction(selectedBag.id, target.id);
      }
      return;
    }
    if (selectedFire !== undefined) {
      const target = flattenMenuTargets(fireMenuActions(selectedFire))[
        digit - 1
      ];
      if (target && !target.disabled) {
        handleFireAction(selectedFire.id, target.id);
      }
      return;
    }
    if (selectedCauldron !== undefined) {
      const target = flattenMenuTargets(cauldronMenuActions())[digit - 1];
      if (target && !target.disabled) {
        handleCauldronAction(selectedCauldron.hearthId, target.id);
      }
      return;
    }
    if (selectedWorkstation !== undefined) {
      const target = flattenMenuTargets(
        workstationMenuActions(selectedWorkstation),
      )[digit - 1];
      if (target && !target.disabled) {
        handleWorkstationAction(selectedWorkstation.id, target.id);
      }
      return;
    }
    if (selectedDesk !== undefined) {
      const target = flattenMenuTargets(deskMenuActions(selectedDesk))[
        digit - 1
      ];
      if (target && !target.disabled) {
        handleDeskMenuAction(selectedDesk.id, target.id);
      }
      return;
    }
    if (selectedLoom !== undefined) {
      const target = flattenMenuTargets(loomMenuActions(selectedLoom))[
        digit - 1
      ];
      if (target && !target.disabled) {
        handleLoomAction(selectedLoom.id, target.id);
      }
      return;
    }
    if (selectedSiteId !== null) {
      // The ritual panel's buttons are panel-composed,
      // not ContextActions: unstaged = the kind list;
      // staged = offering foods, then Speak — the
      // panel's own render order, from the hoisted
      // lists the panel renders.
      const siteId = selectedSiteId;
      // TRANSFORMATION ACTS take the panel's first
      // digits (their render order — the panel badges
      // them first too); every later list shifts by the
      // acts count, from this one hoisted list. (Only
      // altar sites reach this dispatch now — the fold
      // retired the stump hub's digit arm whole: a
      // stump's acts and ritual rows are dialog doors,
      // click/touch-driven, with no digit keys. Named
      // consequence of the fold, DEV's report to Adam.)
      const actsInPanel = selectedSiteActs.length;
      if (digit <= actsInPanel) {
        const act = selectedSiteActs[digit - 1];
        if (act) handleSiteAct(siteId, act.id);
        return;
      }
      const panelDigit = digit - actsInPanel;
      if (selectedSiteStaged === null) {
        // Digits number the CARRIED rows only, in display
        // order — the panel badges by the same rule, so a
        // badge never sits on a row its digit can't stage
        // (uncarried rows are disabled; panel honesty,
        // 2026-10-29).
        const option = selectedSiteKindOptions.filter(
          (candidate) => candidate.carried > 0,
        )[panelDigit - 1];
        if (option) handleStageBone(siteId, option.kind);
        return;
      }
      if (
        selectedSiteStaging !== null &&
        !selectedSiteStaging.completed &&
        selectedSiteRecipe !== null
      ) {
        const bone = selectedSiteStaged.bone;
        const steps: (() => void)[] = [];
        if (!selectedSiteStaging.offeringGiven) {
          for (const food of selectedSiteFoodOptions) {
            steps.push(() => handleGiveOffering(siteId, bone, food.item));
          }
        }
        if (
          !selectedSiteStaging.nameSpoken &&
          nameSightRef.current.looksAt(bone) >=
            selectedSiteRecipe.spokenName.minLooks
        ) {
          steps.push(() => handleSpeakName(siteId, bone));
        }
        const step = steps[panelDigit - 1];
        if (step) step();
      }
      return;
    }
  };

  // Q: open the nearest chip menu/panel in reach. Every
  // candidate is range-gated like its row (HARVEST_RANGE)
  // except home — shelterHouseId is itself the proximity
  // read (shelter radius), so home competes on true
  // distance with no second gate. Ties keep the earlier
  // kind in the pinned order (site → home → pile → fire
  // → tent → torch): a candidate replaces the best only
  // when STRICTLY nearer.
  // MENUS RELEASE THE MOUSE (Adam, 2026-10-29, live
  // play: opening Crafting while pointer-locked left
  // the mouse trapped — Esc was doing the browser's
  // unlock by hand): ANY screen that takes mouse input
  // releases pointer lock when it opens. One effect
  // over the open-state set: the three panels, Options,
  // intro, the first-run dialog, the pile modal, the
  // ritual/site panel, the world menus (home / torch /
  // tent / fire selections — they take clicks as well
  // as digits, so they are IN), the confirms
  // (the remove confirm, trap-recipe, the four cloud
  // confirms), and the paused veil (its resume is a
  // click). Nothing re-locks on close — the standing
  // "Click the world to capture the mouse" legend line
  // is the re-entry, and the locked-click gate keeps
  // that click from also harvesting. player.ts is
  // untouched (it reads pointerLockElement per frame,
  // so an external exit simply stops mouse-look while
  // a screen is up — the point). Phone has no pointer
  // lock; the pointerLockElement check makes this a
  // no-op there. JUDGMENT CALL, stated: placement mode
  // is NOT in the set — it is a mode, not a screen,
  // and exiting the lock on arm would kill first-
  // person placement aiming (the banner's buttons are
  // the touch path; Enter confirms on desktop).
  useEffect(() => {
    const anyScreenOpen =
      inventoryOpen ||
      craftingOpen ||
      charmsOpen ||
      companionsOpen ||
      journalOpen ||
      optionsOpen ||
      introOpen ||
      firstRunDialogOpen ||
      homeMenuOpen ||
      selectedPileId !== null ||
      selectedTentId !== null ||
      selectedBagId !== null ||
      selectedFireId !== null ||
      selectedSiteId !== null ||
      pendingRemoveTarget !== null ||
      pendingRite !== null ||
      fragmentBeat !== null ||
      pendingTrapRecipe !== null ||
      pendingCarriedTrap !== null ||
      cloudPendingBring !== null ||
      cloudPendingRemove !== null ||
      cloudPendingRestore !== null ||
      cloudPendingNewGame !== null ||
      cloudConflictPrompt !== null ||
      cloudWakeOffer !== null ||
      paused;
    if (anyScreenOpen && document.pointerLockElement !== null) {
      document.exitPointerLock();
    }
  }, [
    inventoryOpen,
    craftingOpen,
    charmsOpen,
    companionsOpen,
    journalOpen,
    optionsOpen,
    introOpen,
    firstRunDialogOpen,
    homeMenuOpen,
    selectedPileId,
    selectedTentId,
    selectedBagId,
    selectedFireId,
    selectedSiteId,
    pendingRemoveTarget,
    pendingRite,
    fragmentBeat,
    pendingTrapRecipe,
    pendingCarriedTrap,
    cloudPendingBring,
    cloudPendingRemove,
    cloudPendingRestore,
    cloudPendingNewGame,
    cloudConflictPrompt,
    cloudWakeOffer,
    itemInfoId,
    paused,
  ]);

  // PC KEYS (Adam, 2026-10-28 — every frequent action without
  // Esc): E is USE (the shared dispatch above, same as the
  // touch USE button), Shift+E arms Remove on the nearest
  // scatter (confirm dialog), R fires the USE target's
  // second action, I/K/L toggle Inventory/Crafting/Charms,
  // P toggles pause. Digits fire an open world menu's
  // actions and Enter confirms an armed placement (the
  // helpers + dispatch sit directly above). Letter
  // keys fire with or without Shift (only E reads Shift,
  // for Remove).
  // Guards: typing (text input/textarea/select focus) swallows
  // everything; paused allows P only (resume); any modal open
  // (Options, intro, trap confirm, remove confirm, first-run
  // dialog) blocks all
  // keys; any menu open allows only that menu's own toggle key
  // to close it (anything else is ignored); Ctrl/Meta/Alt
  // combos are never hijacked; held-key repeats are ignored
  // (one press = one action). Separate listener beside the
  // Esc listener above, same typing yield. Phone unchanged
  // (no keyboard).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (pausedRef.current) {
        if (e.key.toLowerCase() === 'p') {
          pauseState.setPaused(!pausedRef.current);
        }
        return;
      }
      if (
        optionsOpen ||
        introOpen ||
        pendingTrapRecipe ||
        pendingCarriedTrap !== null ||
        pendingRemoveTarget !== null ||
        pendingRite !== null ||
        fragmentBeat !== null ||
        firstRunDialogOpen
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      // Placement armed: Enter confirms, every other
      // action key waits (Esc cancels, in the Esc
      // listener above).
      if (placement !== null) {
        if (key === 'enter') handlePlaceConfirm();
        return;
      }
      // The dump arm: Enter pours, every other action
      // key waits (Esc cancels, in the Esc listener).
      if (dumpArmed) {
        if (key === 'enter') confirmDump();
        return;
      }
      // The apply arm: Enter paints, on the same law.
      if (applyArmed) {
        if (key === 'enter') confirmApply();
        return;
      }
      // A world menu/panel is open: digits fire its
      // actions in render order, every other key waits
      // (Esc closes, in the Esc listener above). Above
      // the panel toggles, mirroring the Esc chain —
      // menus close before panels.
      if (
        homeMenuOpen ||
        selectedPileId !== null ||
          selectedTentId !== null ||
          selectedBagId !== null ||
        selectedFireId !== null ||
        selectedSiteId !== null
      ) {
        // E CLOSES SITE WINDOWS (Adam's crafting-window
        // ruling, extended uniformly by DEV, 2026-10-31):
        // E opened this window (the site's OPEN / KRAFT
        // press), so E closes it — the stump hub and the
        // made-altar alike, one rule to learn. The close
        // is the window's own (clear the selection + the
        // ritual note, exactly what its close buttons do;
        // the hub's view resets on the next selection).
        // Other world menus keep dead-E; digits dispatch
        // as before, below.
        if (key === 'e' && !e.shiftKey && selectedSiteId !== null) {
          setSelectedSiteId(null);
          setRitualNote(null);
        }
        if (/^[1-9]$/.test(key)) {
          dispatchWorldMenuDigit(Number(key));
        }
        return;
      }
      // Panel family (Adam, 2026-10-29: the panels
      // SWAP): with one panel open, another panel's
      // key replaces it in the same press; the open
      // panel's own key closes it; every other key
      // waits. (Before this, only the open panel's own
      // key did anything here — I then K was blocked
      // by the open Inventory. That was the bug.)
      if (inventoryOpen || craftingOpen || charmsOpen || companionsOpen || journalOpen) {
        if (key === 'i') toggleInventoryPanel();
        else if (key === 'k') toggleCraftingPanel();
        else if (key === 'l') toggleCharmsPanel();
        else if (key === 'j') toggleJournalPanel();
        else if (key === 'n') toggleCompanionsPanel();
        // E CLOSES THE CRAFTING WINDOW (Adam, 2026-10-31 —
        // the flint lesson: while crafting was up, E did
        // nothing at all). E is the window's own key now,
        // closing the modal exactly as K does. (Site
        // windows close from the world-menu branch above —
        // E closes the window it opened, as a class.)
        else if (key === 'e' && !e.shiftKey && craftingOpen) {
          toggleCraftingPanel();
        }
        // INVENTORY LEAVES THE MODAL SET FOR THE HARVEST
        // FAMILY (Adam, 2026-10-31): with the pack open,
        // E and Shift+E belong to the world again — she
        // harvests and watches the pickup land in the
        // list (the outcome refresh re-renders it in
        // place). The radio family is exclusive, so
        // inventoryOpen here means inventory is THE open
        // panel. R stays captured (DEV's call, 2026-10-31):
        // its second-actions (sleep, site acts) firing
        // past an open panel is a surprise class Adam
        // didn't ask for. Every other key still waits.
        else if (inventoryOpen && key === 'e' && !e.shiftKey) {
          handleUseInteract();
        } else if (inventoryOpen && key === 'e' && e.shiftKey) {
          const scatter = harvestTargets.find(
            (candidate) =>
              candidate.kind === 'scatter' && candidate.removable,
          );
          if (scatter) setPendingRemoveTarget(scatter);
        }
        return;
      }
      if (key === 'e' && !e.shiftKey) {
        handleUseInteract();
      } else if (key === 'e' && e.shiftKey) {
        const scatter = harvestTargets.find(
          (candidate) =>
            candidate.kind === 'scatter' && candidate.removable,
        );
        if (scatter) setPendingRemoveTarget(scatter);
      } else if (key === 'r') {
        handleSecondInteract();
      } else if (key === 'i') {
        toggleInventoryPanel();
      } else if (key === 'k') {
        toggleCraftingPanel();
      } else if (key === 'l') {
        toggleCharmsPanel();
      } else if (key === 'j') {
        toggleJournalPanel();
      } else if (key === 'n') {
        // THE COMPANIONS KEY (Adam's tap, 2026-11-06):
        // N joins the panel family — priced over O,
        // which sits one key from Inventory on the
        // crowded row. The toggle follows the
        // journal's pattern; the panel's buttons
        // carry the N chip on PC. Touch unchanged.
        toggleCompanionsPanel();
      } else if (key === 'p') {
        pauseState.setPaused(!pausedRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    optionsOpen,
    introOpen,
    pendingTrapRecipe,
    pendingCarriedTrap,
    pendingRemoveTarget,
    pendingRite,
    fragmentBeat,
    inventoryOpen,
    craftingOpen,
    charmsOpen,
    companionsOpen,
    journalOpen,
    handleUseInteract,
    handleSecondInteract,
    openCharmsPanel,
    toggleInventoryPanel,
    toggleCraftingPanel,
    toggleCharmsPanel,
    firstRunDone,
    placement,
    handlePlaceConfirm,
    applyArmed,
    confirmApply,
    homeMenuOpen,
    selectedPileId,
    selectedTentId,
    selectedBagId,
    selectedFireId,
    selectedSiteId,
    dispatchWorldMenuDigit,
  ]);
  // PC-KEYS CLICK (Adam, 2026-10-28): click-to-harvest while
  // pointer-locked — the same shared USE path as E. Gated on
  // a captured pointer (the locking click itself fires while
  // pointerLockElement is still null, so it never harvests),
  // left button only, not paused, no modal/panel open except
  // the pack (inventory left the modal set, 2026-10-31) (locked
  // clicks can't reach HUD buttons, but a keyboard-opened
  // Options while locked must still block harvest). No
  // conflict with player.onCanvasClick (unlocked →
  // requestPointerLock, locked → no-op there). Phone
  // unchanged (no pointer lock).
  // RIGHT BUTTON (Adam's torch completion, 2026-10-31):
  // in the same locked state, a right-click places a
  // carried lit torch at her feet — the shared place
  // core, the feed speaks the result. The gate set is
  // the left button's, shared verbatim, PLUS one of its
  // own: never while a placement preview is armed (no
  // torch planted behind a ghost). Unlocked, the game
  // claims nothing — the browser keeps its menu; the
  // platform suppresses that menu while locked, so no
  // contextmenu handling is needed or wanted. Event
  // route: 'click' fires only for the primary button,
  // so the right button arrives on 'auxclick' — one
  // handler registered for both; auxclick never fires
  // for button 0, so the left button can't double-fire,
  // and the button guard inside drops the middle (1).
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (e.button !== 0 && e.button !== 2) return;
      if (document.pointerLockElement === null) return;
      if (pausedRef.current) return;
      if (
        optionsOpen ||
        introOpen ||
        pendingTrapRecipe ||
        pendingCarriedTrap !== null ||
        pendingRemoveTarget !== null ||
        pendingRite !== null ||
        fragmentBeat !== null ||
        craftingOpen ||
        charmsOpen ||
        companionsOpen
      ) {
        return;
      }
      if (e.button === 2) {
        if (placement !== null) return;
        handleWorldPlaceTorch();
        return;
      }
      // PLACEMENT / DUMP PARITY (Adam's live-play bug,
      // 2026-11-02: the placement prompt promises click
      // or Enter; Enter confirmed and the click did
      // nothing): the action-KEY listener branches the
      // armed states first — Enter confirms an armed
      // placement, Enter pours an armed dump, every
      // other key waits — but this click path never got
      // the twin branches, so a locked click fell
      // through to USE at the aim (visibly nothing when
      // no winner stands there). The branches now stand
      // here in the key listener's order, calling the
      // same confirm functions Enter calls.
      if (placement !== null) {
        handlePlaceConfirm();
        return;
      }
      if (dumpArmed) {
        confirmDump();
        return;
      }
      if (applyArmed) {
        confirmApply();
        return;
      }
      // Inventory is NOT a gate here (Adam, 2026-10-31):
      // the pack left the modal set for world interaction
      // (see the keydown's panel-family branch), and this
      // click rides the same USE path as E — the two
      // inputs stay in parity.
      handleUseInteract();
    };
    window.addEventListener('click', onClick);
    window.addEventListener('auxclick', onClick);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('auxclick', onClick);
    };
  }, [
    optionsOpen,
    introOpen,
    pendingTrapRecipe,
    pendingCarriedTrap,
    pendingRemoveTarget,
    pendingRite,
    fragmentBeat,
    inventoryOpen,
    craftingOpen,
    charmsOpen,
    companionsOpen,
    journalOpen,
    placement,
    dumpArmed,
    applyArmed,
    handlePlaceConfirm,
    confirmDump,
    confirmApply,
    handleUseInteract,
    handleWorldPlaceTorch,
  ]);

  // LOCATION CHIP (see the header): dominant biome from the
  // same ground weights the scaffold readout formats — the
  // engine already computes the dominant id on the weights
  // object, so the shell reads it (and its weight) rather
  // than re-deriving a maximum. It follows position state,
  // so it moves with player:moved (~10 Hz) and with
  // regenerate (seed in the deps).
  const dominantBiome = useMemo((): {
    name: string;
    percent: number | null;
  } => {
    // UNDERGROUND (cave close-out, 2026-10-30): the chip
    // names the place — there is no surface weight to
    // read at cave coordinates, so the percent is null
    // and the chip renders the name alone. DRAFT copy.
    if (dimensionState.isUnderground()) {
      return { name: 'The Cave', percent: null };
    }
    const at = genRef.current.weightsAt(position.x, position.z);
    const def = BIOME_BY_ID[at.dominant];
    return {
      name: def?.name ?? at.dominant,
      percent: Math.round(at.weights[at.dominant] * 100),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.x, position.z, seed]);

  // Zone coords for the chip (zone display build):
  // zoneCoords is the single source of truth (Background
  // zones.ts — 32 m chunk zones, world origin, east +x,
  // north-positive second axis, floor). App passes the
  // NUMBERS; the chip formats them. Derived per render
  // from position, so the display ticks as she walks
  // (~6.4 s per zone at walk speed).
  const [zoneX, zoneZ] = zoneCoords(position.x, position.z);

  // Frog water hint (frog-hint build, Systems 126c9aa):
  // Systems' nearestStillWater fact, derived per render
  // from position so the hint follows her as she walks.
  // Waters come from App's existing stillWatersNear call
  // (waterProximity adapter); both ranges stay default
  // (adapter 50 + fact FROG_WATER_RANGE 50, draft) —
  // no range or math invented here. Gate: frog listed
  // (list membership + awakened) AND fact non-null;
  // null = no hint, exactly per the API (no waters, or
  // beyond range, or already at/in water). TOGGLES
  // (2026-11-06): the gate is awakened AND enabled —
  // the hint IS the frog charm's effect, so its switch
  // mutes it like every other effect read.
  const frogHint = (
    charmStateRef.current.isAwakened('frog-pelvis') &&
    charmStateRef.current.isEnabled('frog-pelvis')
  )
    ? nearestStillWater(
        position.x,
        position.z,
        stillWatersNear(genRef.current, position.x, position.z),
      )
    : null;

  // Nearest-target tag (Adam, 2026-10-28): display name only,
  // v1 — the nearest harvestable scatter target, world-anchored
  // so the name sits ON the thing (the column button alone
  // never links name to object). Derived per render, like
  // frogHint — no cache. First scatter = nearest (tracker
  // sorts scatter by distance, App never re-sorts; find, not
  // [0], so ground-first order never matters). Ground targets
  // (dirt/mud/grass) are skipped — ground-only shows no tag
  // (the Dirt button stays; the tag never labels dirt). Piles
  // are not harvestTargets and get no tag (PileChip + pile
  // menu already label them). Anchor projected fresh per
  // render (stored anchorX/anchorY are mapping-time and go
  // stale as she moves/turns — stationAnchor precedent);
  // null anchor (behind camera) shows no tag. Name verbatim
  // from the bus (Background's vine merge changes bus names
  // — the tag follows them automatically, no tag logic
  // change).
  const nearestScatter = harvestTargets.find(
    (target) => target.kind === 'scatter',
  );
  const tagAnchor =
    nearestScatter !== undefined
      ? projectAnchor(
          nearestScatter.worldX,
          nearestScatter.worldZ,
          'scatter',
        )
      : null;

  // Crow pile arrows (glow landing, 2026-10-28): derived per
  // render from live state, like frogHint — no cache. Tier
  // from the same Systems fact as syncCrowTier (UI never
  // computes tiers); visibility strictly via Background's
  // crowPileArrow per pile (tier 2 ≤ 64 m inclusive, tier 3
  // any distance, tier 0/1 never); distance recomputed fresh
  // from coords (the pile snapshot's distance field is
  // stale by the time it renders). Glyph rotation is
  // mode-aware, verified against the engine (not invented):
  // first/behind cameras look along facing, so the glyph
  // rotates by pile bearing minus facing bearing (facing
  // vector (sin facing, cos facing), player.ts); third
  // overhead sits at a fixed south offset (constants
  // THIRD_PERSON_OFFSET z +10), so screen-up is north and
  // the glyph rotates by compass bearing alone. Tier-2 rows
  // show direction only; tier-3 rows add range + compass.
  const crowArrows = (() => {
    const charms = charmStateRef.current;
    const rawTier = crowGlowTier(charms.isAwakened('crow-beak'), charms);
    const tier = Math.min(3, Math.max(0, rawTier)) as CrowTier;
    if (tier < 2) return [];
    const player = playerRef.current;
    const facing = player?.facing ?? 0;
    const facingAngle = Math.atan2(-Math.cos(facing), Math.sin(facing));
    const facingBearing =
      (90 - (facingAngle * 180) / Math.PI + 360) % 360;
    const mode = player?.mode ?? 'first';
    const rows = [];
    for (const pile of piles) {
      const { visible, distanceM } = crowPileArrow(
        tier,
        pile.x,
        pile.z,
        position.x,
        position.z,
      );
      if (!visible) continue;
      const dx = pile.x - position.x;
      const dz = pile.z - position.z;
      const len = Math.hypot(dx, dz) || 1;
      const angle = Math.atan2(-dz, dx);
      const bearing = (90 - (angle * 180) / Math.PI + 360) % 360;
      const rotation =
        mode === 'third'
          ? bearing
          : (bearing - facingBearing + 360) % 360;
      rows.push({
        id: pile.id,
        dx: dx / len,
        dz: dz / len,
        distanceM,
        rotationDeg: rotation,
        showRange: tier >= 3,
      });
    }
    return rows;
  })();

  // FPS, shell-side (see the header): a requestAnimationFrame
  // sampler, not a renderer instrument — the renderer is
  // untouched. State updates about once a second, never per
  // frame, so the chip does not churn the HUD. The window
  // publishes its AVERAGE and its WORST single frame gap
  // side by side (the FPS witness, 2026-11-01): the average
  // alone smoothed Adam's hitch away ('60 FPS while
  // hitching' — a per-frame throw aborts a frame, not the
  // average). A window spanning hidden-tab time (rAF
  // pauses when hidden, elapsed >= 2000) drops the
  // average but still publishes the worst, marked
  // interrupted — a stall shows as a stall, a hidden tab
  // as an interruption, neither as silence. The worst
  // resets per window: a fresh witness each second, not
  // a sticky old hitch.
  const [fps, setFps] = useState<{
    avg: number | null;
    worst: number;
    interrupted: boolean;
  } | null>(null);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let start = performance.now();
    let last = start;
    let worst = 0;
    const tick = (now: number): void => {
      // PAUSE GATE: discard paused frames instead of sampling
      // them, so the chip never reports a pause-inflated number
      // and resume starts a fresh sample window (the worst
      // resets too — the resume gap never pollutes it).
      if (pausedRef.current) {
        frames = 0;
        start = now;
        last = now;
        worst = 0;
        raf = requestAnimationFrame(tick);
        return;
      }
      frames += 1;
      if (now - last > worst) worst = now - last;
      last = now;
      const elapsed = now - start;
      if (elapsed >= 1000) {
        const interrupted = elapsed >= 2000;
        setFps({
          avg: interrupted
            ? null
            : Math.round((frames * 1000) / elapsed),
          worst: Math.round(worst),
          interrupted,
        });
        frames = 0;
        start = now;
        worst = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // THE SHARED WINNER, computed once per render: the
  // touch USE label and the desktop pile button read
  // it, so every tell agrees with what USE/R will do.
  // Position state (10 Hz tick) drives the re-renders,
  // so the tells appear and disappear as she moves
  // and turns. THE ONE PICK (Adam's contract): the same
  // object is stored to useWinnerRef — E, R, and the
  // cauldron placement act on the stored pick, never a
  // re-derivation, so the pill and the press cannot
  // disagree.
  const useWinner = computeUseWinner();
  useWinnerRef.current = useWinner;
// The faced furniture, derived once per render for
  // the feed branch below + the pick-up pill's seat
  // (the press re-derives — see handlePickupFurniture).
  const furnitureFacedNow = facedFurniture();
  const availableStations: CraftingStation[] = [];
  // FACED-TARGET STATION FEED (Adam, 2026-10-30, final
  // shape — radius presence is retired as the station
  // feed for EVERY station: "we want to be facing them
  // as well. The 'radius' thing will simply cause gobs
  // of action pills to appear when we're at a camp with
  // clusters of stations nearby."). The feed derives
  // ENTIRELY from her one faced target — the USE winner
  // for this render, the same target that produces the
  // Action pills:
  // - a faced STUMP feeds 'workstation'. Stumps read in
  //   the winner as kind 'site' with a 'stump:<x>,<z>'
  //   siteId (altar sites share the kind and feed
  //   nothing — an altar is not a station).
  // - a faced PLACED BENCH feeds 'workstation' too
  //   (the fix, 2026-11-05 — the branch below): the
  //   free-standing crafted workstation, derived off
  //   workstationState.snapshot() by facedFurniture
  //   (the feed keeps the ranges, the entity keeps
  //   the facts — Background's published split).
  // - a faced placed fire feeds 'fire' when lit (any
  //   type — a faced lit kiln is still a lit fire for
  //   charcoal), and 'kiln' when that fire is a lit
  //   kiln (both, for a kiln).
  // - a faced CAULDRON feeds 'cauldron' when its
  //   hearth is lit (winner kind 'cauldron', the
  //   placed-cauldron build's UI half) — the cauldron
  //   goes on the Hearth, and facing the Cauldron is
  //   different from facing the Hearth for the DOOR
  //   (E is the pot's). For the FEED the host still
  //   counts as what it is: 'fire' rides with
  //   'cauldron' (the charring ruling at the feed
  //   below). The carried-pot composition is dead;
  //   do not rebuild it.
  // - a faced LOOM feeds 'loom' (winner kind 'loom' —
  //   looms joined the winner race in this landing; the
  //   loom's pill opens the Crafting panel, so the door
  //   and the feed are the same target).
  // - nothing faced -> hand only.
  // stationPresenceValue is no longer read by this
  // feed at all (it still serves the station door and
  // the stump derivations elsewhere in the shell).
  if (
    useWinner?.kind === 'site' &&
    useWinner.siteId.startsWith('stump:')
  ) {
    availableStations.push('workstation');
  }
  // - a faced PLACED BENCH feeds 'workstation' too
  //   (the fix, 2026-11-05): the free-standing crafted
  //   workstation supplies the station where no stump
  //   stands — Background's entity keeps the facts
  //   (workstationState.snapshot), this branch keeps
  //   the facing law (facedFurniture above). The note
  //   mapping below names the kind that fed it.
  const workstationFromBench =
    furnitureFacedNow?.kind === 'bench' &&
    !availableStations.includes('workstation');
  if (
    furnitureFacedNow?.kind === 'bench' &&
    !availableStations.includes('workstation')
  ) {
    availableStations.push('workstation');
  }
  if (useWinner?.kind === 'loom') {
    availableStations.push('loom');
  }
  const facedFire =
    useWinner?.kind === 'fire'
      ? fireState.get(useWinner.id)
      : undefined;
  if (facedFire?.lit === true) {
    availableStations.push('fire');
    if (facedFire.type === 'kiln') {
      availableStations.push('kiln');
    }
  }
  if (useWinner?.kind === 'cauldron') {
    const hostFire = fireState.get(useWinner.id);
    if (hostFire?.lit === true) {
      availableStations.push('cauldron');
      // ANY LIT FIRE (Adam's charring ruling, via the
      // char-a-stick claim, 2026-11-01): the pot hangs
      // on its hearth — facing the cauldron IS facing
      // a lit fire, so the host feeds 'fire' too (fire-
      // presence is the charcoal-stick recipe's only
      // gate). The cauldron tie rule is untouched: the
      // pot still owns the winner and E; the feed
      // simply stops being blind to the fire under it.
      availableStations.push('fire');
    }
  }
  // Header display names (stump-header fix, Adam-approved
  // 2026-10-28): ONLY the displayed string maps — the
  // 'workstation' context keeps its id in availableStations
  // for the canCraft checks below. Presence learned kinds
  // with the placed bench (the fix, 2026-11-05): the
  // mapping follows the kind that fed it — a stump reads
  // "tree stump", the free-standing bench reads
  // "crafted workstation".
  const stationNote =
    availableStations.length === 0
      ? 'No station nearby'
      : `Nearby station${availableStations.length > 1 ? 's' : ''}: ${availableStations
          .map((station) =>
            station === 'workstation'
              ? workstationFromBench
                ? 'crafted workstation'
                : 'tree stump'
              : station,
          )
          .join(', ')}`;

  // STATION ROWS SPEAK (Adam, 2026-10-31 — supersedes
  // the 2026-10-30 FILTER BY STATION): absent-station
  // recipes used to not appear at all, which made their
  // station want invisible — "the player won't know he
  // needs a loom unless he goes poking around for it."
  // Now EVERY recipe maps: a station-gated row at an
  // absent station shows with its want named in the row
  // (the availabilityNote below) and a stationUnmet flag
  // the menu's 'Craftable here' filter reads. Everything
  // below (grouping, the ownership sink, the counts)
  // derives from this full set, so the sink partitions
  // all rows: a superseded recipe at an absent station
  // sinks visibly instead of hiding with its station.
  // THE PANEL'S PICK-UP DOOR (the furniture-verbs
  // build — K PARITY: the crafting panel opened at a
  // faced station IS that station's interface, so
  // the faced piece's pick-up rides in the panel
  // too: a player mid-crafting can move the bench
  // without closing, re-facing, and hunting a pill).
  // The faced fact is facedFurniture()'s — the same
  // derivation the quick pill reads (the winner is
  // the wrong seat: a scatter at her feet can outrank
  // the bench in the race while she plainly faces
  // the bench). The act is the one act.
  const craftingPickupDoor =
    craftingOpen && furnitureFacedNow !== null
      ? {
          label: `Pick up ${furnitureFacedNow.pieceName}`,
          onPickup: () => pickupFurniturePiece(furnitureFacedNow),
        }
      : null;
  const craftingRecipes: CraftingRecipe[] = RECIPES.map((recipe) => {
    // OR over every present station: a recipe is craftable
    // when ANY present station satisfies it. When none does,
    // prefer the check for a present station (ingredient /
    // requirement detail) over a mismatch note, so a dual
    // site never reports a present station as missing.
    const checks =
      availableStations.length > 0
        ? availableStations.map((s) =>
            canCraft(recipe, inventory, s, null, null, grimoireOutOfPack()),
          )
        : [canCraft(recipe, inventory, null, null, null, grimoireOutOfPack())];
    const check =
      checks.find((c) => c.ok) ??
      checks.find((c) => !c.stationMismatch) ??
      checks[0];
    let availabilityNote: string | undefined;
    if (check.stationMismatch) {
      // STUMP INDICATION (Adam, 2026-10-26): the starter
      // workstation IS a tree stump, but the old note read
      // "Needs a workstation station." — naming no stump at
      // all. Workstation-gated recipes now say so outright.
      // Presence is booleans only (workstation/loom), so the
      // shell cannot tell a stump from a crafted workstation
      // or a Stumpy upgrade — this names the starter case the
      // player actually meets, and no presence-kind plumbing
      // was added to game files to split the kinds. Other
      // stations keep the old template unchanged.
      availabilityNote =
        check.requiredStation === 'workstation'
          ? 'Needs a tree stump to work at.'
          : `Needs a ${check.requiredStation}.`;
    } else if (check.missingIngredients.length > 0) {
      const first = check.missingIngredients[0];
      availabilityNote = `Missing ${first.item} (${first.held} / ${first.quantity}).`;
    } else if (check.missingUpgradeFrom.length > 0) {
      availabilityNote = `Needs one of ${check.missingUpgradeFrom.join(' or ')} to upgrade from.`;
    } else if (check.missingRequirements.length > 0) {
      const first = check.missingRequirements[0];
      availabilityNote = `Requires ${first.item} present (${first.held} / ${first.quantity}).`;
    }
    // DEPENDENCIES DISPLAY (Adam, 2026-10-26): upgradeFrom and
    // requires are dependencies, not ingredients, and they must
    // NOT be folded into recipe.ingredients — execution removes
    // ingredients AND upgradeFrom separately, so listing the
    // predecessor there would consume it twice. They ride as
    // extra display rows after the ingredient rows instead:
    // upgradeFrom as "Upgrades from: {name} {held} / 1"
    // (either/or: "Spade or Axe-Trowel", held 1 if either held
    // else 0), requires as "Requires present: {name} {held} /
    // {qty} (kept, not used up)". Station is NOT a row —
    // context, not an ingredient; the header and mismatch
    // notes already cover it.
    const dependencyRows: { name: string; amountText: string }[] = [];
    if (recipe.upgradeFrom) {
      const predecessors = Array.isArray(recipe.upgradeFrom)
        ? recipe.upgradeFrom
        : [recipe.upgradeFrom];
      if (predecessors.length === 1) {
        dependencyRows.push({
          name: `Upgrades from: ${displayNameFor(predecessors[0])}`,
          amountText: `${inventory.count(predecessors[0])} / 1`,
        });
      } else {
        const held = predecessors.some((item) => inventory.count(item) > 0)
          ? 1
          : 0;
        dependencyRows.push({
          name: `Upgrades from: ${predecessors.map(displayNameFor).join(' or ')}`,
          amountText: `${held} / 1`,
        });
      }
    }
    for (const requirement of recipe.requires ?? []) {
      dependencyRows.push({
        name: `Requires present: ${displayNameFor(requirement.item)}`,
        amountText: `${inventory.count(requirement.item)} / ${requirement.quantity} (kept, not used up)`,
      });
    }
    // STUMPY DOUBLE-UPGRADE GUARD (shell-side, Adam
    // 2026-10-28 — Systems cannot read anchor state):
    // an upgradesStump recipe whose faced stump already
    // carries the workstation addition disables + labels,
    // overriding Systems' mapping. The label replaces
    // the availability note via the no-recraft render
    // (disabledLabel set → note not rendered). The
    // override needs a faced stump target, so it does
    // not fire without one.
    // Systems' canCraft is UNCHANGED — this is a shell
    // mapping override only.
    const stumpAlreadyWorkbench =
      recipe.upgradesStump === true &&
      nearestStump !== null &&
      stumpState.isWorkbench(nearestStump.x, nearestStump.z);
    // Row description (descriptor wiring, 2026-10-29):
    // the output's authored descriptor replaces the
    // generated 'Makes 1 × <raw id>' line; a multi-output
    // recipe appends ' (×N)'. The fallback (no recipe
    // output should miss the table) keeps the Makes shape
    // but with the DISPLAY name — never the raw id.
    const outputDescriptor = descriptionFor(recipe.output.item);
    return {
      id: recipe.id,
      name: recipe.name,
      description:
        outputDescriptor !== undefined
          ? recipe.output.quantity > 1
            ? `${outputDescriptor} (×${recipe.output.quantity})`
            : outputDescriptor
          : `Makes ${recipe.output.quantity} × ${displayNameFor(recipe.output.item)}.`,
      // Housing ladder line (2026-10-29): present only
      // on the four house recipes (see the table beside
      // itemNoteFor); display only — canCraft above is
      // untouched by it.
      ladderLine: housingLadderLineFor(recipe.output.item),
      ingredients: [
        ...recipe.ingredients.map((ingredient) => ({
          name: ingredient.item,
          amountText: `${inventory.count(ingredient.item)} / ${ingredient.quantity}`,
          // PREREQUISITE CRAFTING (Adam, 2026-10-31): the
          // row carries its item id + the caller-decided
          // chain flag — a chain producer exists for the
          // item (Systems' hasChainProducer; trap/stump
          // producers are excluded Systems-side, so the
          // candidacy is honest) AND she holds fewer than
          // this recipe needs. The button shows on the flag
          // alone: a press may still refuse in planning
          // (station, ingredients, weight) and the refusal
          // IS the feedback — the shell never pre-walks
          // the chain (exactly one chain-walk exists,
          // Systems'). Dependency rows below carry neither
          // field, so they never grow the button.
          itemId: ingredient.item,
          chainCraftable:
            hasChainProducer(ingredient.item) &&
            inventory.count(ingredient.item) < ingredient.quantity,
          icon:
            ingredient.item === UMBRELLA_ITEM_ID ? (
              <UmbrellaIcon />
            ) : undefined,
        })),
        ...dependencyRows,
      ],
      canCraft: stumpAlreadyWorkbench
        ? false
        : check.ok && check.ownership === 'available',
      // STATION UNMET (Adam, 2026-10-31): the caller-
      // decided flag the menu's 'Craftable here' filter
      // reads — the recipe wants a station (stated, not
      // hand) that is not among the stations at hand.
      // The want itself is spoken by availabilityNote
      // above; when the station IS present the row is
      // silent about it (the header's station note
      // already names what's nearby).
      stationUnmet:
        recipe.station !== undefined &&
        recipe.station !== 'hand' &&
        !availableStations.includes(recipe.station),
      // NO-RECRAFT BINDING (Adam, 2026-10-28 — Systems owns
      // the rule, the shell renders it): Systems' check.ok
      // already folds ownership in (ok is false when
      // ownership is not 'available'), so the && above is
      // belt-and-braces, behavior-identical today — it
      // makes the mapping literal: owned/superseded →
      // canCraft false. The label is Systems' pinned word,
      // rendered verbatim under the name; it replaces the
      // availability note. The direct-upgrade exception
      // lives in Systems' status (same-stage upgradeFrom
      // stays available), so garden → sharp never lands
      // here — if it ever did, the STATUS would be wrong,
      // not this render.
      disabledLabel: stumpAlreadyWorkbench
        ? 'Already a Workbench'
        : check.ownership === 'available'
          ? undefined
          : CRAFT_OWNERSHIP_LABELS[check.ownership],
      // ITEM INFO CARD: the row's affordance opens the
      // card for the item this recipe MAKES.
      outputItemId: recipe.output.item,
      outputItemName: displayNameFor(recipe.output.item),
      availabilityNote,
      icon:
        recipe.output.item === UMBRELLA_ITEM_ID ? (
          <UmbrellaIcon />
        ) : undefined,
    };
  });

  // NO-RECRAFT ORDER (Adam, 2026-10-28; STRENGTHENED
  // 2026-10-29 — "should move to the bottom of the
  // LIST if crafted and no longer craftable"): owned/
  // superseded recipes leave their sections entirely
  // and collect in ONE trailing block at the very
  // bottom of the whole list, after every section (and
  // after "Other" if it ever renders), keeping their
  // relative order and their per-row labels. The sink
  // keys on OWNERSHIP (the row's disabledLabel is one
  // of Systems' two pinned labels) — never on canCraft:
  // a merely unaffordable recipe (ownership available,
  // ingredients missing) stays in its section, and the
  // stump's "Already a Workbench" row is not an
  // ownership row and never sinks. Sections are built
  // from available recipes only; a section with no
  // available recipes does not render. Header counts
  // read the section's rows as before (canCraft among
  // them), so they stay honest under the new shape.
  // The flat menu prop rides the same global order:
  // available in order, then the sunk block. (The
  // 2026-10-28 within-section partition this replaces
  // left the trowels at the bottom of Tools — the
  // FIRST section, still high on screen.)
  const isSunkRecipe = (recipe: (typeof craftingRecipes)[number]) =>
    recipe.disabledLabel !== undefined &&
    Object.values(CRAFT_OWNERSHIP_LABELS).includes(recipe.disabledLabel);
  const orderedCraftingRecipes = [
    ...craftingRecipes.filter((recipe) => !isSunkRecipe(recipe)),
    ...craftingRecipes.filter(isSunkRecipe),
  ];
  const availableCraftingRecipes = orderedCraftingRecipes.filter(
    (recipe) => !isSunkRecipe(recipe),
  );
  const sunkCraftingRecipes = orderedCraftingRecipes.filter(isSunkRecipe);

  // CRAFTING SECTIONS (one shelf system, 2026-10-31):
  // shelves in ITEM_CATEGORY_ORDER, each filtered from
  // the AVAILABLE rows above by Systems' craftingSection
  // (never re-sorted); empty shelves dropped here, and
  // the menu drops them again defensively. A recipe whose
  // output shelves as 'Other' (none measured) trails
  // under "Other" instead of vanishing; the sunk block
  // ("Owned & Superseded", a state section, not a shelf)
  // closes the list after it.
  const sectionOfRecipe = (recipe: CraftingRecipe): string => {
    const systems = SYSTEMS_RECIPE_BY_ID.get(recipe.id);
    return systems ? craftingSection(systems) : 'Other';
  };
  const otherRecipes = availableCraftingRecipes.filter(
    (recipe) => sectionOfRecipe(recipe) === 'Other',
  );
  const craftingSections = [
    ...ITEM_CATEGORY_ORDER.map((title) => ({
      title,
      recipes: availableCraftingRecipes.filter(
        (recipe) => sectionOfRecipe(recipe) === title,
      ),
    })).filter((section) => section.recipes.length > 0),
    ...(otherRecipes.length > 0
      ? [{ title: 'Other', recipes: otherRecipes }]
      : []),
    ...(sunkCraftingRecipes.length > 0
      ? [{ title: 'Owned & Superseded', recipes: sunkCraftingRecipes }]
      : []),
  ];

  // ONE TARGET AT A TIME (Adam, 2026-10-29, screenshot:
  // the column offered two scatter targets at once —
  // "Another case of Dual Selection. One target should
  // be available at a time"): the proximity column
  // presents ONLY the current target — this same
  // winner. A scatter/ground winner contributes its
  // target row(s); a trap or hive winner contributes
  // its row; a pile or menu-kind winner (pile / site /
  // fire / tent / torch / home / scry) contributes
  // NOTHING to the column — its menu or modal is its
  // presentation. Presentation only: the tracker still
  // emits every in-range target (Shift+E's nearest-
  // scatter and the dispatch fallbacks keep their
  // inputs); the column just stops offering the rest.
  const presentedTargets =
    useWinner !== null &&
    (useWinner.kind === 'scatter' || useWinner.kind === 'ground')
      ? [useWinner.target]
      : [];
  const presentedTrap = useWinner?.kind === 'trap' ? trapRowTrap : null;
  const presentedHive = useWinner?.kind === 'hive' ? hiveRowHive : null;
  // THE LOOM'S PILL (Adam, 2026-10-31): the loom winner
  // presents its WEAVE row — the trap/hive shape — so a
  // faced loom finally shows its action on desktop too
  // (before this, the verb lived only in the touch USE
  // label and the path was folklore). The label is the
  // verb alone; the column seats above the loom itself
  // (stationAnchor), so the object is named by place.
  // THE LOOM'S PILL RETIRED (the furniture-verbs
  // build, 2026-11-05): the loom is a menu kind now —
  // its menu is its presentation (the fire/tent
  // pattern: menu kinds contribute nothing to this
  // column). Before this build a faced loom presented
  // a WEAVE row here (Adam, 2026-10-31) whose press
  // opened the panel; the menu's Weave row is that
  // same act, one level in.
  const presentedLoom = null;
  // THE CREATURE'S PILL (Piece B, 2026-10-31): the
  // creature winner presents its row — the loom shape —
  // with the live verb as its label (OFFER names its
  // item). The press runs the stored pick's act, the
  // very act E performs (the contract).
  const presentedCreature =
    useWinner?.kind === 'creature'
      ? {
          id: useWinner.id,
          label:
            useWinner.verb === 'offer'
              ? `Offer ${displayNameFor(useWinner.item as ItemId)}`
              : useWinner.verb === 'speak'
                ? 'Speak'
                : 'Snatch',
        }
      : null;
  // THE FRAGMENT'S PILL (First-Fragment Presentation,
  // 2026-10-31): the fragment winner presents its row —
  // the creature shape — with the transcribe verb as
  // its label (DRAFT). The press runs the stored
  // pick's act, the very act E performs (the contract).
  const presentedFragment =
    useWinner?.kind === 'fragment'
      ? { id: useWinner.fragmentId, label: 'Transcribe the mark' }
      : null;
  // THE DESK'S PILLS (the grimoire's seat, 2026-11-01):
  // the trap's two-row shape — E seats or takes (the
  // design's pinned pair), R reads a seated book (the
  // read gate's camp act). Labels DRAFT. The press runs
  // the stored pick's acts, the very acts E and R
  // perform (the contract).
  // THE DESK'S PILLS RETIRED (the furniture-verbs
  // build): the desk is a menu kind — Place / Take /
  // Read and Pick up live on its own menu now (the
  // fire pattern). The R quick door still reads a
  // seated book through the second-interact handler;
  // this column presents nothing for a desk.
  const presentedDesk = null;
  // THE STRUCTURE TAG (2026-10-31): the nearest FACED
  // singular within the tag range, derived per render
  // (structures are static; her position state rides
  // the movement tick, so the derivation never sits
  // stale — the scatter tag's shape; AnimalTag polls
  // only because animals move). Facing is the winner's
  // own rule (dot > √½; <1 m counts as faced). The
  // site derivations are memoized; the village
  // contributes its non-'gone' plots individually.
  // Surface only (site centers are surface facts).
  // Display only: no candidacy, no verb (a name is not
  // a door — the grove-tree law).
  const structureTag = ((): { name: string; x: number; y: number } | null => {
    const player = playerRef.current;
    if (!player || dimensionState.isUnderground()) return null;
    const gen = genRef.current;
    if (!gen) return null;
    const spawn = gen.findSpawn();
    const weights = (x: number, z: number) => gen.weightsAt(x, z);
    const candidates: { key: string; x: number; z: number }[] = [
      { key: 'schoolhouse', ...schoolhouseSite(gen.seed, spawn, weights).center },
      { key: 'farmhouse', ...farmhouseSite(gen.seed, spawn, weights).center },
      { key: 'chapel', ...chapelSite(gen.seed, spawn, weights).center },
      { key: 'general-store', ...generalStoreSite(gen.seed, spawn, weights).center },
      { key: 'drowned-mill', ...drownedMillSite(gen.seed, spawn, weights).center },
      { key: 'sunken-road', ...sunkenRoadSite(gen.seed, spawn, weights).center },
      { key: 'rail-siding', ...railSidingSite(gen.seed, spawn, weights).center },
      { key: 'barn', ...barnSite(gen.seed, spawn, weights).center },
      { key: 'silo', ...siloSite(gen.seed, spawn, weights).center },
      { key: 'water-tower', ...waterTowerSite(gen.seed, spawn, weights).center },
    ];
    for (const plot of villageSite(gen.seed, spawn, weights).plots) {
      if (plot.state !== 'gone') {
        candidates.push({ key: 'village-house', x: plot.x, z: plot.z });
      }
    }
    // DISTRIBUTED HOMESTEADS (structure-tags follow-up):
    // the recurring houses join as candidates at their
    // centers under the one generic name, standing or
    // burnt — a burnt homestead carries a fragment, and
    // the name must not mark its stone. The query rect
    // reaches the tag range plus a clearing radius so an
    // instance whose clearing reaches into range is not
    // lost at the rect's edge; the distance test below
    // still rules every candidate.
    const homesteadReach = STRUCTURE_TAG_RANGE_M + HOMESTEAD_CLEAR_RADIUS_M;
    for (const instance of homesteadInstancesInRect(
      gen.seed,
      spawn,
      weights,
      {
        minX: player.x - homesteadReach,
        maxX: player.x + homesteadReach,
        minZ: player.z - homesteadReach,
        maxZ: player.z + homesteadReach,
      },
    )) {
      candidates.push({
        key: 'homestead',
        x: instance.center.x,
        z: instance.center.z,
      });
    }
    // THE CAVE MOUTHS (Adam's cave-mouth fix, 2026-11-06):
    // the mouth joins the structure tags under the
    // standing grammar — the debut is 'The Cave Mouth',
    // dealt instances are 'Cave Mouth' — at the site
    // CENTRE, where the frame stands. (Before this the
    // mouth was in no tag feed at all: the place did not
    // name itself, and its door did not announce itself.)
    candidates.push({
      key: 'cave-mouth',
      ...caveMouthSite(gen.seed, spawn, weights).center,
    });
    const caveReach = STRUCTURE_TAG_RANGE_M + 14;
    for (const instance of caveInstancesInRect(gen.seed, spawn, weights, {
      minX: player.x - caveReach,
      maxX: player.x + caveReach,
      minZ: player.z - caveReach,
      maxZ: player.z + caveReach,
    })) {
      candidates.push({
        key: 'cave-mouth-instance',
        x: instance.center.x,
        z: instance.center.z,
      });
    }
    // DISTRIBUTED FARMHOUSES (the homestead treatment):
    // the recurring farmhouses join under the one
    // generic name, standing or ransacked — a
    // state-named tag would tell her the interior
    // before she opens the door; the generic name
    // keeps the discovery at the threshold. The
    // SINGULAR keeps 'The Farmhouse' above; these
    // ride their own candidate key.
    const farmhouseReach = STRUCTURE_TAG_RANGE_M + FARMHOUSE_CLEAR_RADIUS_M;
    for (const instance of farmhouseInstancesInRect(
      gen.seed,
      spawn,
      weights,
      {
        minX: player.x - farmhouseReach,
        maxX: player.x + farmhouseReach,
        minZ: player.z - farmhouseReach,
        maxZ: player.z + farmhouseReach,
      },
    )) {
      candidates.push({
        key: 'farmhouse-instance',
        x: instance.center.x,
        z: instance.center.z,
      });
    }
    const forwardX = Math.sin(player.facing);
    const forwardZ = Math.cos(player.facing);
    let best: { name: string; x: number; y: number } | null = null;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const name = STRUCTURE_TAG_NAMES[candidate.key];
      if (!name) continue;
      const dx = candidate.x - player.x;
      const dz = candidate.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance > STRUCTURE_TAG_RANGE_M || distance >= bestDistance) continue;
      const faced =
        distance < 1 ||
        (dx * forwardX + dz * forwardZ) / distance > Math.SQRT1_2;
      if (!faced) continue;
      const anchor = projectAnchor(candidate.x, candidate.z, 'scatter');
      if (!anchor) continue;
      best = { name, x: anchor.x, y: anchor.y };
      bestDistance = distance;
    }
    return best;
  })();

  // THE GROUND TAG (tag claim, 2026-11-01 — the TAG
  // LAW: anything visible names itself when faced;
  // mystery only where designed): the flat ground
  // discs name themselves. Derivation: Background's
  // disc query around her — FEET-IN-DISC FIRST (a
  // disc she stands in names itself regardless of
  // facing), else the nearest FACED disc centre
  // (winner cone) inside the range cap. The name is
  // the def's own (SOURCE_FOR_KIND — 'Ash', 'Pond',
  // 'Silt Bed'...), never a coined table; the plate
  // sits at the disc centre, painted by the same
  // StructureTag plate the singulars use. Underground
  // the query reads the dimension's own generator
  // (see the phantom fix inside — the surface gen's
  // discs at cave coordinates were the leak).
  const groundTag = ((): { name: string; x: number; y: number } | null => {
    const player = playerRef.current;
    if (!player) return null;
    // THE DIMENSION'S OWN DISCS (Background's phantom
    // fix, 2026-11-06): the shell's genRef is the
    // SURFACE generator in every dimension (it never
    // swaps — travel swaps the renderer's), so reading
    // it underground priced the surface's facts at cave
    // coordinates: a fen's peat carpet, pond, and silt
    // named themselves inside cave:main where none
    // exist (Adam's 'Peat Moss Carpet', standing 0.92 m
    // from the entry anchor with no exit in sight).
    // Underground, the query reads the dimension's own
    // generator — a cave gen's chunks are its layout's
    // features, so cave pools name themselves and
    // nothing else can. Other dimensions (attics) have
    // no disc facts: the tag stands down there.
    const activeKey = dimensionState.activeKey();
    const gen = dimensionState.isUnderground()
      ? activeKey.startsWith('cave:')
        ? createCaveGen(seed, activeKey)
        : null
      : genRef.current;
    if (!gen) return null;
    const features = discFeaturesInRect(gen, {
      minX: player.x - GROUND_TAG_RANGE_M,
      maxX: player.x + GROUND_TAG_RANGE_M,
      minZ: player.z - GROUND_TAG_RANGE_M,
      maxZ: player.z + GROUND_TAG_RANGE_M,
    });
    const forwardX = Math.sin(player.facing);
    const forwardZ = Math.cos(player.facing);
    let inDisc: { name: string; x: number; z: number } | null = null;
    let inDistance = Infinity;
    let facedBest: { name: string; x: number; z: number } | null = null;
    let facedDistance = Infinity;
    for (const feature of features) {
      const name = SOURCE_FOR_KIND[feature.kind]?.name;
      if (!name) continue;
      const dx = feature.x - player.x;
      const dz = feature.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= feature.r) {
        if (distance < inDistance) {
          inDisc = { name, x: feature.x, z: feature.z };
          inDistance = distance;
        }
        continue;
      }
      if (distance > GROUND_TAG_RANGE_M || distance >= facedDistance) continue;
      const faced =
        distance < 1 ||
        (dx * forwardX + dz * forwardZ) / distance > Math.SQRT1_2;
      if (!faced) continue;
      facedBest = { name, x: feature.x, z: feature.z };
      facedDistance = distance;
    }
    const pick = inDisc ?? facedBest;
    if (!pick) return null;
    const anchor = projectAnchor(pick.x, pick.z, 'scatter');
    if (!anchor) return null;
    return { name: pick.name, x: anchor.x, y: anchor.y };
  })();

  // THE TRAP TAG (tag claim): a placed trap names
  // itself when faced — TRAP_DEFS' own name, display
  // only — at reading distance, beyond the winner
  // row's leash. The trap the row already names is
  // suppressed here (one name per thing).
  const trapTag = ((): { name: string; x: number; y: number } | null => {
    const player = playerRef.current;
    if (!player) return null;
    const forwardX = Math.sin(player.facing);
    const forwardZ = Math.cos(player.facing);
    let best: { name: string; x: number; y: number } | null = null;
    let bestDistance = Infinity;
    for (const trap of traps) {
      if (presentedTrap?.id === trap.id) continue;
      const dx = trap.x - player.x;
      const dz = trap.z - player.z;
      const distance = Math.hypot(dx, dz);
      if (distance > TRAP_TAG_RANGE_M || distance >= bestDistance) continue;
      const faced =
        distance < 1 ||
        (dx * forwardX + dz * forwardZ) / distance > Math.SQRT1_2;
      if (!faced) continue;
      const anchor = projectAnchor(trap.x, trap.z, 'scatter');
      if (!anchor) continue;
      best = { name: TRAP_DEFS[trap.type].name, x: anchor.x, y: anchor.y };
      bestDistance = distance;
    }
    return best;
  })();
  // THE JOURNAL'S ROWS (First-Fragment Presentation):
  // one row per BEGUN mark (Systems' snapshot lists
  // begun marks only — the panel invents nothing),
  // composed from the tally; the kept-best weathering
  // reads as a word on a DRAFT scale.
  const fragmentBestWord = (best: number | null): string | null =>
    best === null ? null : best >= 0.75 ? 'clear' : best >= 0.4 ? 'worn' : 'faint';
  const journalRows: JournalMarkRow[] = (() => {
    const progresses = fragmentStateRef.current.snapshot();
    // NEWEST (marks): a mark's freshness is its LATEST
    // copy's recorded day — the day its tally last
    // moved (a begun mark with no copy yet falls back
    // to the day the pursuit began); ties settle by
    // reverse begun order.
    const ordered =
      journalSortOrder === 'newest'
        ? progresses
            .map((progress, index) => ({
              progress,
              index,
              freshDay:
                progress.copies.length > 0
                  ? Math.max(...progress.copies.map((copy) => copy.day))
                  : (progress.seekingSinceDay ?? 0),
            }))
            .sort((a, b) => b.freshDay - a.freshDay || b.index - a.index)
            .map((entry) => entry.progress)
        : progresses;
    return ordered.map((progress) => {
      const tally = fragmentStateRef.current.tallyFor(progress.mark);
      return {
        mark: progress.mark,
        name: markDisplayName(progress.mark),
        count: tally.count,
        needed: tally.needed,
        complete: tally.complete,
        bestWord: fragmentBestWord(tally.best),
        seekingSinceDay: progress.seekingSinceDay,
      };
    });
  })();

  // The journal's NAMES page (the familiar road,
  // 2026-11-02): one row per kind whose true name a rite
  // has taught her, in the order learned; the standing
  // familiar's row carries its borrow posture for the
  // Recite door (FamiliarState owns the arithmetic; this
  // only reads it at render).
  // NEWEST (names): no day is recorded for a learned
  // name — the snapshot's first-look order is all the
  // book honestly holds, so Newest reverses it
  // (order-only, as priced).
  const journalNameKinds = familiarStateRef.current.knownKinds();
  const journalNameRows = (
    journalSortOrder === 'newest'
      ? [...journalNameKinds].reverse()
      : journalNameKinds
  ).map((kind) => {
    const gift = giftFor(kind);
      const standingFamiliar = companionStateRef.current.familiar();
    const isFamiliar = standingFamiliar?.kind === kind;
    const nowSec = Date.now() / 1000;
    return {
      kind,
      label: companionKindLabel(kind),
      name: trueNameFor(kind) ?? kind,
      gift: gift?.phrase ?? '—',
      isFamiliar,
      giftWorking: gift?.giftId != null,
      borrowState: !isFamiliar
        ? undefined
        : familiarStateRef.current.activeBorrow(nowSec)
          ? ('borrowed' as const)
          : familiarStateRef.current.isResting(nowSec)
            ? ('resting' as const)
            : ('ready' as const),
    };
  });

  // The journal's PLACES page (the naming build,
  // 2026-11-05): one row per named place — her current
  // dimension's places first with distance + bearing
  // words read from where she stands, then the other
  // dimensions' places with their dimension label and
  // no distance. The register owns the records; this
  // only reads them at render.
  const COMPASS_WINDS = [
    'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW',
  ] as const;
  const dimensionLabelFor = (key: string): string =>
    key === 'surface'
      ? 'The surface'
      : key.startsWith('cave:')
        ? 'The Cave'
        : key.startsWith('attic:')
          ? 'The Attic'
          : key;
  const journalPlaceRows: JournalPlaceRow[] = (() => {
    const activeKey = dimensionState.activeKey();
    const all = namedPlacesRef.current.list();
    const toRow = (place: NamedPlace): JournalPlaceRow => {
      if (place.dimensionKey !== activeKey) {
        return {
          id: place.id,
          name: place.name,
          here: false,
          detail: null,
          dimensionLabel: dimensionLabelFor(place.dimensionKey),
          day: place.day,
        };
      }
      const d = distanceM(position, place);
      const wind =
        COMPASS_WINDS[
          Math.round(
            bearingDegrees(position.x, position.z, place) / 45,
          ) % 8
        ];
      return {
        id: place.id,
        name: place.name,
        here: true,
        detail: d < 1.5 ? 'Here' : `${Math.round(d)} m ${wind}`,
        dimensionLabel: null,
        day: place.day,
      };
    };
    // NEWEST (places): within each dimension group —
    // the current-dimension-first composition stands
    // in both orders; it is a reading aid, not an
    // entry order — the named places sort by their
    // recorded naming day, freshest first, register
    // order reversed for ties. (Bases are stamped
    // separately and keep their standing head under
    // both orders, by ruling.)
    const orderGroup = (group: NamedPlace[]): NamedPlace[] =>
      journalSortOrder === 'newest'
        ? group
            .map((place, index) => ({ place, index }))
            .sort(
              (a, b) => b.place.day - a.place.day || b.index - a.index,
            )
            .map((entry) => entry.place)
        : group;
    return [
      ...orderGroup(all.filter((pl) => pl.dimensionKey === activeKey)).map(toRow),
      ...orderGroup(all.filter((pl) => pl.dimensionKey !== activeKey)).map(toRow),
    ];
  })();
  // Her bases for the same page (the Returning
  // build): Systems' enumeration in its own order —
  // last sleep first (the home destination), then
  // placed houses. Bases stand on the surface: from
  // the surface they read as distance + bearing;
  // from below, the surface's label.
  const journalBaseRows: JournalBaseRow[] = (() => {
    const activeKey = dimensionState.activeKey();
    return listBases(returningFacts()).map((base) => {
      if (activeKey !== 'surface') {
        return {
          id: base.id,
          name: returningBaseName(base),
          detail: dimensionLabelFor('surface'),
        };
      }
      const d = distanceM(position, base);
      const wind =
        COMPASS_WINDS[
          Math.round(bearingDegrees(position.x, position.z, base) / 45) % 8
        ];
      return {
        id: base.id,
        name: returningBaseName(base),
        detail: d < 1.5 ? 'Here' : `${Math.round(d)} m ${wind}`,
      };
    });
  })();
  // Standing at an already-named spot, the naming
  // entry says so — naming here re-names that spot
  // (the register's radius rule).
  const nameHereHint = (() => {
    const near = namedPlacesRef.current.nearest(
      position.x,
      position.z,
      dimensionState.activeKey(),
    );
    return near !== null && near.distanceM <= RENAME_RADIUS_M
      ? `You stand at "${near.place.name}" — naming here renames it.`
      : null;
  })();

  // DESKTOP PILE PICKUP (see the header): the mouse twin
  // of R's pile second — shown only when the faced
  // winner IS a pile, so the button never contradicts
  // the dispatch. Pressing emits pile:pickup-requested
  // (the existing path); Systems' listener grants, the
  // existing subscriber refreshes, saves, and feeds
  // back. Label names the whole pile (total count) when
  // it holds many kinds — the grant takes everything,
  // so naming only the first kind would understate it.
  const desktopPilePickup =
    !isTouch && useWinner?.kind === 'pile' ? useWinner.pile : null;

  // TOUCH USE LABEL: names the winner's action family
  // (TouchControls interactLabel; undefined keeps the
  // plain "USE"). Scatter/ground stay unlabelled — plain
  // USE is the harvest read she already knows — with one
  // exception: a grove tree's tag ('Grove Tree'), a name
  // with no verb, the lit-hearth pattern.
  // FIRE-FAMILY VERBS (Adam, settled 2026-10-30): the pill
  // names the act the faced fire affords NOW. Unlit, every
  // type reads LIGHT (lighting is the only act its menu
  // offers). A lit CAMPFIRE reads COOK (its chip menu cooks
  // acorns, stick/buried). A lit KILN reads FIRE (firings
  // are its act). A lit HEARTH carries no verb at all —
  // the pill shows its name tag 'Hearth': in Adam's words
  // it has no activities of its own yet; it is warm and
  // heats the cauldron (its cooking rides the cauldron).
  // No FEED exists — the game has no fuel/feeding
  // mechanic. A fire the lookup cannot find keeps OPEN.
  const winnerFire =
    useWinner?.kind === 'fire'
      ? placedFires.find((f) => f.id === useWinner.id)
      : undefined;
  const fireWinnerLabel =
    winnerFire === undefined
      ? 'OPEN'
      : !winnerFire.lit
        ? 'LIGHT'
        : winnerFire.type === 'campfire'
          ? 'COOK'
          : winnerFire.type === 'kiln'
            ? 'FIRE'
            : 'Hearth';
  // GROVE TREE TAG (Adam, 2026-10-30): a grove-tree
  // winner's pill is its name tag — no act, so no verb
  // (the lit-hearth pattern).
  const groveTreeWinner =
    useWinner?.kind === 'scatter' && isGroveTreeTarget(useWinner.target);
  const useWinnerLabel =
    useWinner === null
      ? undefined
      : groveTreeWinner
        ? 'Grove Tree'
        : useWinner.kind === 'pile'
        ? 'OPEN'
        : useWinner.kind === 'trap'
          ? 'COLLECT'
          : useWinner.kind === 'hive'
            ? 'HARVEST'
            : useWinner.kind === 'loom'
              ? 'OPEN'
              : useWinner.kind === 'creature'
                ? useWinner.verb === 'offer'
                  ? 'OFFER'
                  : useWinner.verb === 'speak'
                    ? 'SPEAK'
                    : 'SNATCH'
                : useWinner.kind === 'fragment'
                  ? 'TRANSCRIBE'
                  : useWinner.kind === 'site' &&
                    useWinner.siteId.startsWith('stump:')
                  ? 'KRAFT'
                : useWinner.kind === 'cauldron'
                  ? 'RENDER'
                  : useWinner.kind === 'desk'
                    ? 'OPEN'
                    : useWinner.kind === 'workstation'
                      ? 'OPEN'
                  : useWinner.kind === 'fire'
                    ? fireWinnerLabel
                  : useWinner.kind === 'torch'
                ? 'PICK UP'
                : useWinner.kind === 'site' ||
                    useWinner.kind === 'tent' ||
                    useWinner.kind === 'bag' ||
                  useWinner.kind === 'home'
                ? 'OPEN'
              : useWinner.kind === 'cave-enter'
                ? 'ENTER'
                : useWinner.kind === 'cave-descend'
                  ? 'DESCEND'
                  : useWinner.kind === 'cave-climb'
                    ? 'CLIMB'
                    : useWinner.kind === 'cave-exit'
                      ? 'EXIT'
                      : useWinner.kind === 'upstairs-enter'
                        ? 'GO UP'
                        : useWinner.kind === 'upstairs-exit'
                          ? 'GO DOWN'
                          : useWinner.kind === 'scry'
                        ? 'SCRY'
                        : undefined;

  // THE STACK'S META BLOCK (DEFECT 3, 2026-11-01): one
  // JSX value with two seats in the expanded stack —
  // FIRST on desktop (its historic place), LAST on touch,
  // where the slice of visible column is short and the
  // HUD's working parts (doors, vitals, the quest card)
  // must lead. The '(press V or C)' hint is desktop-only
  // advice and does not render on touch.
  const stackMeta = (
    <>
      <h1 className="text-lg tracking-widest">SILENT EARTH</h1>
      <div className="mt-2 text-xs space-y-1">
        <p>
          Camera:{' '}
          {cameraMode === 'first'
            ? 'First-person'
            : cameraMode === 'behind'
              ? 'Behind (over-shoulder)'
              : 'Third-person overhead'}{' '}
          {!isTouch ? (
            <span className="opacity-60">(press V or C)</span>
          ) : null}
        </p>
        <p>
          Position: {position.x.toFixed(1)}, {position.z.toFixed(1)}
        </p>
        <p>Ground here: {biomeText}</p>
        <p>Chunks loaded: {chunkCount}</p>
        {/* FPS in the meta block too (Adam, 2026-11-02, from his SE
            Notes): shown in BOTH places for now — here and in the
            LocationChip — from the one fps sample, same wording. */}
        <p>
          FPS:{' '}
          {fps === null
            ? '—'
            : fps.interrupted
              ? `interrupted · worst ${fps.worst.toLocaleString('en-US')} ms`
              : `${fps.avg} · worst ${fps.worst.toLocaleString('en-US')} ms`}
        </p>
        <p>Seed: {seed}</p>
        <p>Owned tool: {ownedItem}</p>
      </div>
    </>
  );

  // HUD ELEMENT BLOCKS (Adam, 2026-11-02, his
  // hand-drawn diagram): the vitals and the chip as JSX
  // values with several seats, the stackMeta idiom. On
  // touch the vitals stand together in the DEFECT 3 row
  // (health and bars in the rail, the quest card beside
  // them) and the chip keeps the topReadout seat. On
  // desktop the seats split per the diagram: health up
  // the left column; the chip, the bars, and the quest
  // card in a new right-hand column — the center of the
  // screen stands clear. Every seat wraps its block in
  // a HudElement (drag grip + [X]) at the render.
  const healthBlock = (
    <div className="mt-3">
      <WitchHealth />
    </div>
  );
  const barsBlock = (
    <>
      <div className="mt-2">
        <HungerIndicator
          stage={hungerStage}
          value={hungerValue}
          warningActive={hungerWarningActive}
          warningFlash={hungerWarningFlash}
        />
      </div>
      <div className="mt-2">
        <WeatherWitness
          theme={lookThemes.world}
          cold={coldWetUi.cold}
          wet={coldWetUi.wet}
          injury={
            injuryUi.stage !== 'sound'
              ? { stage: injuryUi.stage }
              : undefined
          }
          scent={
            scentUi.kind !== null
              ? { kind: scentUi.kind, category: scentUi.category }
              : undefined
          }
        />
      </div>
      <div className="mt-2">
        <StormWarning
          active={deerWarningActive}
          flash={deerWarningFlash}
        />
      </div>
    </>
  );
  const questBlock =
    cardQuestRow && cardQuestRow.id !== dismissedCardQuestId ? (
      <div className="mt-2">
        <QuestCard
          title={cardQuestRow.title}
          hint={cardQuestRow.hint}
          countLine={cardQuestCountLine}
          components={cardQuestComponents}
          marked={cardQuestRow.id === activeQuestId}
          theme={lookThemes.world}
          onClose={() => setDismissedCardQuestId(cardQuestRow.id)}
        />
      </div>
    ) : null;
  // The chip hides while a panel or the modal is open
  // (the topReadout seat's standing rule, both seats).
  const chipGateOpen =
    !inventoryOpen &&
    !craftingOpen &&
    !charmsOpen &&
    !companionsOpen &&
    !optionsOpen &&
    !introOpen;
  const locationChip = (
    <LocationChip
      theme={lookThemes.world}
      x={position.x}
      z={position.z}
      biomeName={dominantBiome.name}
      biomePercent={dominantBiome.percent}
      fps={fps}
      zoneX={zoneX}
      zoneZ={zoneZ}
      timeDateMonth={chipLine}
    />
  );

  // THE PLACEMENT CARD, HOISTED (the kiln defect,
  // Adam + DEV, 2026-11-01): the card renders only while
  // a placement is armed, and while armed it is the one
  // live confirm in the game — so it takes the stack's
  // FIRST seat on every pointer, above the meta block
  // and the doors. The law: A CONFIRM NEVER SITS IN A
  // SCROLL FOLD. (Measured cause: seated last, the card
  // painted at y[753,805] on a desktop window — 'Place
  // here' off-screen at 768 and 600 tall alike, while
  // the armed ghost stood mute at her feet.) Unarmed,
  // the stack renders exactly as before.
  const placementCard = placement ? (
    <div className="rounded bg-black/45 px-2 py-1 text-sm">
      <p>Placing {placement.label} where you aim.</p>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={handlePlaceConfirm}
          className={
            isTouch
              ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
              : 'rounded bg-moss-deep px-2 py-0.5 text-xs hover:bg-moss'
          }
        >
          Place there
          {!isTouch ? (
            <span
              aria-hidden="true"
              className={'ml-1 ' + KEY_BADGE_CLASS}
            >
              Enter
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={handlePlaceCancel}
          className={
            isTouch
              ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
              : 'rounded bg-moss-deep px-2 py-0.5 text-xs hover:bg-moss'
          }
        >
          Cancel
        </button>
      </div>
      {placementNote ? (
        <p className="mt-1 text-xs text-red-300">{placementNote}</p>
      ) : null}
    </div>
  ) : null;

  // The DUMP card (the jar build): the placement card's
  // sibling — the live certification at the crosshair
  // reads in words, Pour confirms (or Enter), Cancel
  // stands the arm down (or Esc). A water reading is
  // not a dead end: Pour speaks the grant's refusal and
  // the arm stays up for a re-aim.
  const dumpCard = dumpArmed ? (
    <div className="rounded bg-black/45 px-2 py-1 text-sm">
      <p>
        {dumpAim === null
          ? 'Pour the water jar where you aim.'
          : dumpAim.cert === 'dry'
            ? 'Dry ground — the pour makes mud.'
            : dumpAim.cert === 'mud'
              ? 'Mud — the pour raises water.'
              : 'Water — the pour adds nothing.'}
      </p>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={confirmDump}
          className={
            isTouch
              ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
              : 'rounded bg-moss-deep px-2 py-0.5 text-xs hover:bg-moss'
          }
        >
          Pour there
          {!isTouch ? (
            <span
              aria-hidden="true"
              className={'ml-1 ' + KEY_BADGE_CLASS}
            >
              Enter
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={cancelDump}
          className={
            isTouch
              ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
              : 'rounded bg-moss-deep px-2 py-0.5 text-xs hover:bg-moss'
          }
        >
          Cancel
        </button>
      </div>
    </div>
  ) : null;

  // THE APPLY CARD (the glow-paint build): the dump
  // card's twin — the live certification reads in
  // plain lines, Paint there confirms, Cancel yields.
  // Copy DRAFT for Adam's pin pass.
  const applyCard = applyArmed ? (
    <div className="rounded bg-black/45 px-2 py-1 text-sm">
      <p>
        {applyAim === null
          ? 'Paint the glow where you aim.'
          : applyAim.cert === 'not-underground'
            ? 'Open air — the paint holds only in a cave.'
            : applyAim.cert === 'nothing-faced'
              ? 'Face a cave wall or floor, close.'
              : applyAim.cert === 'already-painted'
                ? 'That spot already glows.'
                : applyAim.surface === 'wall'
                  ? 'Bare wall — the paint will hold its light here.'
                  : 'Bare floor — the paint will hold its light here.'}
      </p>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={confirmApply}
          className={
            isTouch
              ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
              : 'rounded bg-moss-deep px-2 py-0.5 text-xs hover:bg-moss'
          }
        >
          Paint there
          {!isTouch ? (
            <span
              aria-hidden="true"
              className={'ml-1 ' + KEY_BADGE_CLASS}
            >
              Enter
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={cancelApply}
          className={
            isTouch
              ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
              : 'rounded bg-moss-deep px-2 py-0.5 text-xs hover:bg-moss'
          }
        >
          Cancel
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div
      className={
        'relative w-full h-screen bg-[#121612] overflow-hidden text-[#f0ead6] ' +
        fontClassFor(font)
      }
    >
      {/* 3D viewport: campfire tap (Adam, 2026-10-28,
        touch-only) — a tap (not a drag) on the world canvas
        within 64 px of a placed fire's projected anchor
        (fireAnchors, the SAME projection the chips use)
        selects that fire, opening the same ContextMenu as
        a chip tap. 64 px = 44 px chip + generous finger
        margin, phone-first; nearest anchor wins on overlap.
        Touch-only by design: an unlocked desktop tap would
        ALSO request pointer lock (player.onCanvasClick),
        leaving a locked pointer behind an unusable menu,
        and locked desktop taps keep harvesting — desktop
        keeps chip-click. Paused guard: PausedIndicator's
        wrapper is pointer-events-none, so taps outside its
        button DO reach the canvas — the guard is needed,
        not optional. HUD buttons are siblings of this div,
        never inside it, so their taps never reach here.
        Chip taps never double-open: chips are siblings in
        the z-30 overlay, not inside this div. */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        onPointerDown={(e) => {
          if (!isTouch || paused) return;
          fireTapRef.current = {
            x: e.clientX,
            y: e.clientY,
            time: Date.now(),
          };
        }}
        onPointerUp={(e) => {
          const down = fireTapRef.current;
          fireTapRef.current = null;
          if (!isTouch || paused || down === null) return;
          const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
          if (moved > 8 || Date.now() - down.time > 500) return;
          const container = containerRef.current;
          if (!container) return;
          const width = container.clientWidth;
          const height = container.clientHeight;
          if (width === 0 || height === 0) return;
          let best: { id: string; distance: number } | null = null;
          for (const anchor of fireAnchors) {
            const ax = (anchor.x / 100) * width;
            const ay = (anchor.y / 100) * height;
            const distance = Math.hypot(e.clientX - ax, e.clientY - ay);
            if (
              distance <= 64 &&
              (best === null || distance < best.distance)
            ) {
              best = { id: anchor.fire.id, distance };
            }
          }
          if (best !== null) setSelectedFireId(best.id);
        }}
        onPointerCancel={() => {
          fireTapRef.current = null;
        }}
      />

      {/* World-anchored overlay: fire chips, menus, feedback. */}
      <div className="pointer-events-none absolute inset-0 z-30">
        {fireAnchors.map(({ fire, x, y }) => {
          const status: FireChipStatus = fire.lit
            ? 'lit'
            : fire.lighting
              ? 'lighting'
              : 'unlit';
          const detail =
            fire.lighting?.method === 'flint'
              ? `Clicks ${fire.lighting.clicks} of 3`
              : fire.lighting?.method === 'friction'
                ? fire.lighting.phase === 'ready'
                  ? 'Ready — rub!'
                  : 'Waiting…'
                : fire.lighting?.method === 'candle'
                  ? 'Waiting…'
                  : undefined;
          return (
            <Fragment key={fire.id}>
              <WorldAnchor x={x} y={y} interactive>
                <FireState
                  kind={fire.type}
                  status={status}
                  lightingDetail={detail}
                  onSelect={() => openFireDoor(fire)}
                />
              </WorldAnchor>
            </Fragment>
          );
        })}
        {torchAnchors.map(({ torch, x, y }) => (
          <Fragment key={torch.id}>
            <WorldAnchor x={x} y={y} interactive>
              <TorchChip onSelect={() => handlePickupTorch(torch.id)} />
            </WorldAnchor>
          </Fragment>
        ))}
        {tentAnchors.map(({ tent, x, y }) => (
          <Fragment key={tent.id}>
            <WorldAnchor x={x} y={y} interactive>
              <TentChip onSelect={() => setSelectedTentId(tent.id)} />
            </WorldAnchor>
          </Fragment>
        ))}
        {bagAnchors.map(({ bag, x, y }) => (
          <Fragment key={bag.id}>
            <WorldAnchor x={x} y={y} interactive>
              <BagChip onSelect={() => setSelectedBagId(bag.id)} />
            </WorldAnchor>
          </Fragment>
        ))}
        {altarAnchors.map(({ altar, x, y }) => (
          <Fragment key={altar.id}>
            <WorldAnchor x={x} y={y} interactive>
              <AltarChip onSelect={() => setSelectedSiteId(altar.id)} />
            </WorldAnchor>
          </Fragment>
        ))}
        {deskAnchors.map(({ desk, x, y }) => (
          <Fragment key={desk.id}>
            <WorldAnchor x={x} y={y} interactive>
              <AltarChip
                label="Writing Desk"
                onSelect={() => setSelectedDeskId(desk.id)}
              />
            </WorldAnchor>
          </Fragment>
        ))}
        {workstationAnchors.map(({ bench, x, y }) => (
          <Fragment key={bench.id}>
            <WorldAnchor x={x} y={y} interactive>
              <AltarChip
                label="Crafted Workstation"
                onSelect={() => setSelectedWorkstationId(bench.id)}
              />
            </WorldAnchor>
          </Fragment>
        ))}
        {cauldronAnchors.map(({ cauldron, x, y }) => (
          <Fragment key={cauldron.hearthId}>
            <WorldAnchor x={x} y={y} interactive>
              <AltarChip
                label="Cauldron"
                onSelect={() =>
                  setSelectedCauldronHearthId(cauldron.hearthId)
                }
              />
            </WorldAnchor>
          </Fragment>
        ))}
        {(() => {
          // STUMP ROLE TAGS (Adam, 2026-11-01 — 'Tag
          // needs fixed'): the chip names the stump's
          // CURRENT role — a consecrated stump is
          // 'Stumpy Altar' (the context label's
          // altar-first precedence), a workstation
          // stump 'Stumpy Workstation', a plain stump
          // 'Stump'. Roles read live from stumpState
          // by site id at render.
          const stumpRecords = new Map(
            stumpState.snapshot().map((record) => [
              record.siteId,
              record.additions,
            ]),
          );
          return stumpAnchors.map(({ siteId, x, y }) => {
            const additions = stumpRecords.get(siteId) ?? [];
            const label = isStumpyAltar(additions)
              ? 'Stumpy Altar'
              : additions.includes('workstation')
                ? 'Stumpy Workstation'
                : 'Stump';
            return (
              <Fragment key={siteId}>
                <WorldAnchor x={x} y={y} interactive>
                  <AltarChip
                    label={label}
                    onSelect={() => openStumpContext(siteId)}
                  />
                </WorldAnchor>
              </Fragment>
            );
          });
        })()}
        {pileAnchors.map(({ pile, x, y }) => {
          const total = pile.stacks.reduce(
            (sum, stack) => sum + stack.quantity,
            0,
          );
          const single = pile.stacks.length === 1;
          return (
            <Fragment key={pile.id}>
              <WorldAnchor x={x} y={y} interactive>
                <PileChip
                  name={
                    single ? displayNameFor(pile.stacks[0].item) : 'Pile'
                  }
                  quantity={single ? pile.stacks[0].quantity : total}
                  kinds={pile.stacks.length}
                  onSelect={() => {
                    selectedPileIdRef.current = pile.id;
                    setSelectedPileId(pile.id);
                  }}
                />
              </WorldAnchor>
            </Fragment>
          );
        })}
        {selectedFire && selectedFireAnchor ? (
          <WorldAnchor
            x={selectedFireAnchor.x}
            y={selectedFireAnchor.y}
            interactive
          >
            <ContextMenu theme={lookThemes.world}
              objectName={FIRE_NAME[selectedFire.type]}
              header={lightingBarFor(selectedFire)}
              actions={fireMenuActions(selectedFire)}
              showKeyHints={!isTouch}
              onSelect={(id) => handleFireAction(selectedFire.id, id)}
              onClose={() => setSelectedFireId(null)}
            />
          </WorldAnchor>
        ) : null}
        {selectedTent && selectedTentAnchor ? (
          <WorldAnchor
            x={selectedTentAnchor.x}
            y={selectedTentAnchor.y}
            interactive
          >
            <ContextMenu theme={lookThemes.world}
              objectName="Tent"
              actions={tentMenuActions()}
              showKeyHints={!isTouch}
              onSelect={(id) => handleTentAction(selectedTent.id, id)}
              onClose={() => setSelectedTentId(null)}
            />
          </WorldAnchor>
        ) : null}
        {selectedBag && selectedBagAnchor ? (
          <WorldAnchor
            x={selectedBagAnchor.x}
            y={selectedBagAnchor.y}
            interactive
          >
            <ContextMenu theme={lookThemes.world}
              objectName="Sleeping Bag"
              actions={bagMenuActions()}
              showKeyHints={!isTouch}
              onSelect={(id) => handleBagAction(selectedBag.id, id)}
              onClose={() => setSelectedBagId(null)}
            />
          </WorldAnchor>
        ) : null}
        {selectedCauldron && selectedCauldronAnchor ? (
          <WorldAnchor
            x={selectedCauldronAnchor.x}
            y={selectedCauldronAnchor.y}
            interactive
          >
            <ContextMenu theme={lookThemes.world}
              objectName="Cauldron"
              actions={cauldronMenuActions()}
              showKeyHints={!isTouch}
              onSelect={(id) =>
                handleCauldronAction(selectedCauldron.hearthId, id)
              }
              onClose={() => setSelectedCauldronHearthId(null)}
            />
          </WorldAnchor>
        ) : null}
        {selectedWorkstation && selectedWorkstationAnchor ? (
          <WorldAnchor
            x={selectedWorkstationAnchor.x}
            y={selectedWorkstationAnchor.y}
            interactive
          >
            <ContextMenu theme={lookThemes.world}
              objectName="Crafted Workstation"
              actions={workstationMenuActions(selectedWorkstation)}
              showKeyHints={!isTouch}
              onSelect={(id) =>
                handleWorkstationAction(selectedWorkstation.id, id)
              }
              onClose={() => setSelectedWorkstationId(null)}
            />
          </WorldAnchor>
        ) : null}
        {selectedDesk && selectedDeskAnchor ? (
          <WorldAnchor
            x={selectedDeskAnchor.x}
            y={selectedDeskAnchor.y}
            interactive
          >
            <ContextMenu theme={lookThemes.world}
              objectName="Writing Desk"
              actions={deskMenuActions(selectedDesk)}
              showKeyHints={!isTouch}
              onSelect={(id) => handleDeskMenuAction(selectedDesk.id, id)}
              onClose={() => setSelectedDeskId(null)}
            />
          </WorldAnchor>
        ) : null}
        {selectedLoom && selectedLoomAnchor ? (
          <WorldAnchor
            x={selectedLoomAnchor.x}
            y={selectedLoomAnchor.y}
            interactive
          >
            <ContextMenu theme={lookThemes.world}
              objectName="Loom"
              actions={loomMenuActions(selectedLoom)}
              showKeyHints={!isTouch}
              onSelect={(id) => handleLoomAction(selectedLoom.id, id)}
              onClose={() => setSelectedLoomId(null)}
            />
          </WorldAnchor>
        ) : null}
        {homeChipVisible && homeAnchor ? (
          <WorldAnchor x={homeAnchor.x} y={homeAnchor.y} interactive>
            <button
              type="button"
              onClick={() => setHomeMenuOpen(true)}
              aria-label={`Open ${shelterHouseName ?? 'Home'} menu`}
              className="flex min-h-[44px] items-center rounded-full bg-black/60 px-2 py-1 text-sm text-stone-100"
            >
              {shelterHouseName ?? 'Home'}
            </button>
          </WorldAnchor>
        ) : null}
        {homeMenuOpen && homeHouse !== undefined && homeAnchor ? (
          <WorldAnchor x={homeAnchor.x} y={homeAnchor.y} interactive>
            <ContextMenu theme={lookThemes.world}
              objectName={shelterHouseName ?? 'Home'}
              header={
                <>
                  <p className="text-sm text-stone-300">
                    {openHomeStore === null
                      ? 'Home storage — empty until first deposit'
                      : // POUNDS (Adam, 2026-10-28): same
                        // unit as the panel header above.
                        // CARRIED rides along (Adam's
                        // amendment, 2026-10-31): storage
                        // decisions are pound decisions —
                        // both pans of the scale on the
                        // screen where she weighs them.
                        `Stored ${formatLb(openHomeStore.used())} of ${formatLb(openHomeStore.capacity())} lb · Carrying ${formatLb(inventory.usedLb())} lb`}
                  </p>
                  {hedgeWorking !== null &&
                  hedgeWorking.homeId === homeHouse.id ? (
                    // THE LAYING'S BAR: the lighting
                    // bar's markup, on the working's
                    // own progress — the menu header
                    // carries the wait, the rows below
                    // are the waiting row.
                    <div className="mt-2">
                      <div className="h-2 w-full overflow-hidden rounded bg-black/40">
                        <div
                          className="h-full rounded bg-amber-400"
                          style={{
                            width: `${Math.round(
                              Math.min(
                                1,
                                hedgeWorking.progressMs / HEDGE_WORK_MS,
                              ) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-stone-300">
                        Laying the hedge — the first cutting at her feet is
                        the mother shrub.
                      </p>
                    </div>
                  ) : null}
                </>
              }
              actions={homeMenuActions()}
              showKeyHints={!isTouch}
              onSelect={(id) => handleHomeMenuAction(id)}
              onClose={() => setHomeMenuOpen(false)}
            />
          </WorldAnchor>
        ) : null}
        {selectedSiteId !== null &&
        selectedSiteLabel !== null &&
        selectedSiteAnchor ? (
          <WorldAnchor
            x={selectedSiteAnchor.x}
            y={selectedSiteAnchor.y}
            interactive
            dropPx={SITE_WINDOW_DROP_PX}
          >
            <RitualPanel theme={lookThemes.world}
              siteLabel={selectedSiteLabel}
              staged={
                selectedSiteStaged !== null &&
                selectedSiteStaging !== null &&
                selectedSiteRecipe !== null
                  ? (() => {
                      const facts = skyFacts();
                      return {
                        boneDisplay: boneDisplayFor(
                          selectedSiteStaged.bone,
                        ),
                        bonePlaced: selectedSiteStaging.bonePlaced,
                        offeringGiven: selectedSiteStaging.offeringGiven,
                        nameSpoken: selectedSiteStaging.nameSpoken,
                        looks: nameSightRef.current.looksAt(
                          selectedSiteStaged.bone,
                        ),
                        minLooks: selectedSiteRecipe.spokenName.minLooks,
                        sky: selectedSiteRecipe.sky,
                        skyLabel: skyLabelFor(selectedSiteRecipe.sky),
                        windowOpen:
                          facts !== null &&
                          windowOpen(selectedSiteRecipe.sky, facts),
                        completed: selectedSiteStaging.completed,
                      };
                    })()
                  : null
              }
              kindOptions={selectedSiteKindOptions}
              foodOptions={selectedSiteFoodOptions}
              note={ritualNote}
              siteActs={selectedSiteActs}
              onSiteAct={(actId) =>
                selectedSiteId !== null && handleSiteAct(selectedSiteId, actId)
              }
              riteActs={selectedSiteGrade === 2 ? riteActs : undefined}
              onRiteAct={(actId) => handleRiteAct(actId, selectedSiteGrade)}
              showKeyHints={!isTouch}
              onStageBone={(kind) =>
                selectedSiteId !== null &&
                handleStageBone(selectedSiteId, kind)
              }
              onGiveOffering={(item) =>
                selectedSiteId !== null &&
                selectedSiteStaged !== null &&
                handleGiveOffering(
                  selectedSiteId,
                  selectedSiteStaged.bone,
                  item,
                )
              }
              onSpeakName={() =>
                selectedSiteId !== null &&
                selectedSiteStaged !== null &&
                handleSpeakName(selectedSiteId, selectedSiteStaged.bone)
              }
              onClose={() => {
                setSelectedSiteId(null);
                setRitualNote(null);
              }}
            />
          </WorldAnchor>
        ) : null}
        {placement && placementAnchor ? (
          <PlacementPreview
            x={placementAnchor.x}
            y={placementAnchor.y}
            label={placement.label}
            onConfirm={handlePlaceConfirm}
            hint={
              !isTouch
                ? 'Enter or click to place · Esc to cancel'
                : undefined
            }
          />
        ) : null}
        {/* The world-anchored harvest progress bar RETIRED
          here (Adam, 2026-10-29): its fill, verb, and count
          moved onto the target's pill (pill-fill), and its
          name label — the ghost duplicate that printed
          beside the pills — goes with it. One element per
          anchor: the pill is the target's one display. */}
      </div>

      {/* Screen-fixed harvest buttons: above panels (z-30), below
        modals (z-50). The buttons live in their own z-40 overlay
        because a z-40 child inside the z-30 overlay above would
        still paint under the z-30 panels (stacking contexts).
        The column itself positions just above screen middle,
        or above the station's projected center when
        stationAnchor is set; see ProximityHarvestButtons. */}
      <div className="pointer-events-none absolute inset-0 z-40">
        <ProximityHarvestButtons theme={lookThemes.world}
          targets={presentedTargets}
          harvestedIds={harvestedIds}
          progress={harvestProgress}
          onHarvest={handleHarvest}
          onRemove={handleRemove}
          stationAnchor={stationAnchor}
          trap={presentedTrap}
          onCollectTrap={handleCollectTrap}
          onSecondTrap={handleTrapSecondAct}
          hive={presentedHive}
          onHarvestHive={handleHarvestHive}
          loom={presentedLoom}
          onWeave={() => openCraftingPanel()}
          creature={presentedCreature}
          onCreature={() => {
            if (useWinner?.kind === 'creature') {
              handleCreatureInteract(useWinner);
            }
          }}
          fragment={presentedFragment}
          onTranscribe={() => {
            if (useWinner?.kind === 'fragment') {
              handleTranscribe(useWinner);
            }
          }}
          desk={presentedDesk}
          onDesk={() => {
            if (useWinner?.kind === 'desk') {
              handleDeskAct(useWinner.id);
            }
          }}
          onSecondDesk={() => {
            if (useWinner?.kind === 'desk') {
              handleDeskRead(useWinner.id);
            }
          }}
          showKeyHints={!isTouch}
          lookNode={
            !LOOK_PARKED && lookTarget ? (
              <div className="flex flex-col items-center gap-1">
                <LookButton onPress={handleLook} />
                {lookResult && lookResult.targetId === lookTarget.id ? (
                  <p className="max-w-[calc(100vw-1rem)] rounded-full bg-black/60 px-4 py-2 text-center text-sm font-medium text-[#f0ead6]">
                    {lookResult.text}
                  </p>
                ) : null}
              </div>
            ) : undefined
          }
        />
        {desktopPilePickup ? (
          <button
            type="button"
            onClick={() =>
              bus.emit('pile:pickup-requested', {
                pileId: desktopPilePickup.id,
              })
            }
            className="pointer-events-auto absolute left-1/2 top-[54%] min-h-[44px] -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-[#f0ead6]"
          >
            {desktopPilePickup.stacks.length > 1
              ? `Pick up pile × ${desktopPilePickup.stacks.reduce(
                  (n, s) => n + s.quantity,
                  0,
                )}`
              : `Pick up ${displayNameFor(desktopPilePickup.item)} × ${desktopPilePickup.quantity}`}
          </button>
        ) : null}
        {/* THE MESSAGE FEED (Adam, 2026-10-31; a REAL HUD
          ELEMENT since the feed-HUD build, 2026-11-05):
          the spoken lines' ONE seat — and now a citizen
          of the #69 HUD system whole: the stack lives in
          a HudElement ('feed'), so it is DRAGGABLE and
          CLOSABLE like every other piece, its offset and
          hidden flag persisting per pointer class in
          localStorage (never the save; the Options HUD
          tab lists it and brings it back). The seat stays
          in the same z-40 overlay (above the world
          buttons, below z-50 modals), bottom-center,
          clear of the pill column (upper-center), the
          HUD columns, the seed bar (bottom-left) and the
          controls hint (bottom-right) in the DEFAULT
          layout — and Adam can move it off whatever his
          own layout puts beneath. The stack is
          bottom-anchored, so it grows UPWARD: the newest
          line (last in the list) sits at the fixed bottom
          seat and older lines ride up, fading in their
          last ~0.6 s before they expire from the top.
          The element mounts only while lines stand (an
          empty feed is no furniture; the hidden flag in
          the layout store still governs it whenever it
          mounts). Speech never takes a tap: the stack is
          pointer-events-none; only the element's own
          grip / hide chrome takes pointer input. */}
        {feedbacks.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center px-2">
            <HudElement hud={hudLayout} id="feed">
              <div
                aria-live="polite"
                className="flex flex-col items-center justify-end gap-1.5"
              >
                {feedbacks.map((feedback) => (
                  <Fragment key={feedback.id}>
                    <ObjectFeedback
                      text={feedback.text}
                      tone={feedback.tone}
                      className={
                        feedback.fading
                          ? 'opacity-0 transition-opacity duration-500'
                          : 'transition-opacity duration-500'
                      }
                    />
                  </Fragment>
                ))}
              </div>
            </HudElement>
          </div>
        ) : null}
      </div>

      {/* HUD shell: needs row + HUD block. The needs row
          carries the real survival slots since the
          mobile reconciliation (2026-11-02) — the
          'awaiting survival systems' placeholder retired
          with the weather landing (#61): Hunger, Cold,
          Wet in the slot idiom, the same stage words the
          vitals witness shows, on both pointers. */}
      {/* Location chip: top row of the HUD (in-flow
        below the Needs row, via HudShell's topReadout
        slot — NOT the old absolute bottom-centre seat).
        Always visible, including with the HUD collapsed
        on touch (the slot is not gated by collapse).
        It hides only while a panel or the modal is open
        (rule unchanged by the move). */}
      <HudShell theme={lookThemes.world}
        needSlots={[
          {
            id: 'hunger',
            label: 'Hunger',
            detail: HUNGER_STAGE_WORD[hungerStage],
          },
          ...(coldWetUi.cold
            ? [
                {
                  id: 'cold',
                  label: 'Cold',
                  detail: COLD_WORD[coldWetUi.cold.stage],
                },
              ]
            : []),
          ...(coldWetUi.wet
            ? [
                {
                  id: 'wet',
                  label: 'Wet',
                  detail: WET_WORD[coldWetUi.wet.stage],
                },
              ]
            : []),
          ...(injuryUi.stage !== 'sound'
            ? [
                {
                  id: 'injury',
                  label: 'Injury',
                  detail: INJURY_WORD[injuryUi.stage],
                },
              ]
            : []),
          ...(scentUi.kind !== null
            ? [
                {
                  id: 'scent',
                  label: 'Scent',
                  detail: scentWord(scentUi.kind, scentUi.category),
                },
              ]
            : []),
        ]}
        hideNeeds={isTouch && hudCollapsed}
        topReadout={
          isTouch && chipGateOpen ? (
            <HudElement hud={hudLayout} id="chip">
              {locationChip}
            </HudElement>
          ) : null
        }
      >
        {(!isTouch || !hudCollapsed) ? (
        <div className={isTouch ? '' : 'flex items-start gap-2'}>
        <div
          className={
            isTouch
              // Reserve: needs row + thumbstick clearance
              // (bottom-24 offset + 128 px ring = 224 px),
              // so the expanded stack never slides under the
              // stick — 13rem did. The sticks dropped to the
              // corners in the mobile reconciliation
              // (2026-11-02; ring top now 148 px), so this
              // reserve stands with more air than it was
              // measured for — deliberately unshrunk: the
              // stack gains nothing Adam asked for by
              // growing, and the clearance only widens.
              // DEFECT 3 (2026-11-01,
              // measured at 915x412 + 844x360): the old
              // 18rem reserve forgot the LocationChip row
              // (~32 px of flow above the column), so the
              // column's box still painted 20 px into the
              // MOVE disc's top and its buttons died there.
              // Portrait reserve is now 19.75rem (the chip
              // row + 8 px of air, from the measured boxes).
              // LANDSCAPE: the column leaves the disc's
              // x-band entirely — it seats between the
              // sticks (ml 9.5rem, width to within 19.5rem
              // of the right edge, clear of the TURN disc
              // and the action row) and its cap leaves
              // 100 px at the bottom for the bottom-center
              // seat family (Scry's seat), so doors +
              // vitals + the quest card stand in the
              // visible slice instead of below its fold.
              // TURNING FIX stands: max-w-[46vw] portrait —
              // the look field is the right half (w-1/2) at
              // z-20 and the stack sits above it (z-30), so
              // a full-width stack on portrait swallowed the
              // look field and first-person drags could not
              // turn. 46vw keeps the stack left of half
              // width on any viewport, so the right half
              // stays open world; the stack still scrolls
              // (overflow-y) and its buttons keep 44 px
              // targets.
              ? 'pointer-events-auto m-2 max-w-[46vw] max-h-[calc(100vh-19.75rem)] overflow-y-auto pr-1 landscape:ml-[9.5rem] landscape:max-w-[calc(100vw-19.5rem)] landscape:max-h-[calc(100dvh-11.5rem)] ' +
                touchScrollbar
              : 'pointer-events-auto m-2 max-w-sm'
          }
        >
          {placementCard}
          {dumpCard}
          {applyCard}
          {/* SEAT (Adam, 2026-11-02, from his SE Notes): the
              status bars — health, hunger, cold, wet — stand at
              the TOP of the stack, directly under the transient
              cards, out of the way of the view. The row below is
              the DEFECT 3 unit, moved whole: its internal
              landscape rail arrangement is untouched. */}
          {/* VITALS + CARD (DEFECT 3 seats, re-seated by
              Adam's diagram, 2026-11-02): on touch the row
              stands as measured — landscape rail, health
              and bars in the column, the quest card beside
              them. On desktop only health stands here, up
              the left column; the bars and the quest card
              sit in the right-hand column rendered after
              this stack. */}
          {isTouch ? (
            <div className="landscape:flex landscape:items-start landscape:gap-3 landscape:-mt-1">
              <div className="landscape:w-[11rem] landscape:shrink-0">
                <HudElement hud={hudLayout} id="health">
                  {healthBlock}
                </HudElement>
                <HudElement hud={hudLayout} id="bars">
                  {barsBlock}
                </HudElement>
              </div>
              {questBlock !== null ? (
                <HudElement hud={hudLayout} id="quest">
                  {questBlock}
                </HudElement>
              ) : null}
            </div>
          ) : (
            <HudElement hud={hudLayout} id="health">
              {healthBlock}
            </HudElement>
          )}
          {!isTouch ? (
            <HudElement hud={hudLayout} id="meta">
              {stackMeta}
            </HudElement>
          ) : null}
          <HudElement hud={hudLayout} id="controls">
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleInventoryPanel}
              aria-pressed={inventoryOpen}
              className={
                isTouch
                  ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
                  : 'rounded bg-moss-deep px-3 py-1 text-xs hover:bg-moss'
              }
            >
              Inventory
              {!isTouch ? (
                <span
                  aria-hidden="true"
                  className={'ml-1 ' + KEY_BADGE_CLASS}
                >
                  I
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={toggleCraftingPanel}
              aria-pressed={craftingOpen}
              className={
                isTouch
                  ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
                  : 'rounded bg-moss-deep px-3 py-1 text-xs hover:bg-moss'
              }
            >
              Crafting
              {!isTouch ? (
                <span
                  aria-hidden="true"
                  className={'ml-1 ' + KEY_BADGE_CLASS}
                >
                  K
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={toggleCharmsPanel}
              aria-pressed={charmsOpen}
              className={
                isTouch
                  ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
                  : 'rounded bg-moss-deep px-3 py-1 text-xs hover:bg-moss'
              }
            >
              Charms
              {!isTouch ? (
                <span
                  aria-hidden="true"
                  className={'ml-1 ' + KEY_BADGE_CLASS}
                >
                  L
                </span>
              ) : null}
            </button>
            {hasBondedCompanion ? (
              <button
                type="button"
                onClick={toggleCompanionsPanel}
                aria-pressed={companionsOpen}
                className={
                  isTouch
                    ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
                    : 'rounded bg-moss-deep px-3 py-1 text-xs hover:bg-moss'
                }
              >
                Companions
                {!isTouch ? (
                  <span
                    aria-hidden="true"
                    className={'ml-1 ' + KEY_BADGE_CLASS}
                  >
                    N
                  </span>
                ) : null}
              </button>
            ) : null}
            {hasJournalItem ? (
              <button
                type="button"
                onClick={toggleJournalPanel}
                aria-pressed={journalOpen}
                className={
                  isTouch
                    ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
                    : 'rounded bg-moss-deep px-3 py-1 text-xs hover:bg-moss'
                }
              >
                Journal
                {!isTouch ? (
                  <span
                    aria-hidden="true"
                    className={'ml-1 ' + KEY_BADGE_CLASS}
                  >
                    J
                  </span>
                ) : null}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOptionsOpen(true)}
              className={
                isTouch
                  ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
                  : 'rounded bg-moss-deep px-3 py-1 text-xs hover:bg-moss'
              }
            >
              Options
              {!isTouch ? (
                <span
                  aria-hidden="true"
                  className={'ml-1 ' + KEY_BADGE_CLASS}
                >
                  Esc
                </span>
              ) : null}
            </button>
          </div>
          </HudElement>
          <ForageHint stage={hungerStage} />
          <HudElement hud={hudLayout} id="wardrobe">
          <div className="mt-2">
            <WornList
              worn={wornGarments}
              carried={carriedGarments}
              onWear={handleWear}
              onRemove={handleRemoveGarment}
              comfortable={isTouch}
              protectionNote={protectionNote}
              capacityNote={capacityNote}
              umbrellaCarried={carriesUmbrella(inventory)}
              note={wardrobeNote}
            />
          </div>
          </HudElement>
          <div className="mt-2">
            <ShelteredIndicator
              sheltered={sheltered}
              houseName={shelterHouseName}
            />
          </div>
          {/* THE STUMP'S ONE DOOR (dialog audit claim 2,
              2026-10-31): the StationPanel presence card
              that stood here is retired — its one act
              (Craft) opened the same fold dialog E/K and
              the stump chip already open through
              openCraftingPanel, so the stump keeps ONE
              door, the dialog, which names the stump in
              its own heading. StationPanel is deleted. */}
          {/* The placement card's old seat stood here,
              LAST in the stack — the kiln defect's fold
              (see placementCard's hoisting note above). */}
          {/* Touch seat for the meta block: LAST in the
              stack (DEFECT 3 — the working parts lead). */}
          {isTouch ? (
            <HudElement hud={hudLayout} id="meta">
              {stackMeta}
            </HudElement>
          ) : null}
          {/* Seed controls. THE STRIP FOLLOWS THE
              CONTENT (Adam's overlap defect + DEV's idiom,
              2026-11-01): this row used to sit in an
              absolute bottom-left seat outside the stack,
              and the stack — whose height is its content,
              unbounded on desktop — grew down into it: at
              full wardrobe the wardrobe's last rows flowed
              underneath the strip and it painted over them
              (measured: stack content bottom y=668 at both
              768 and 600 tall; the strip's top at 696 at
              768 — 28 px of clearance — and at 528 at 600,
              covering the stack's last ~140 px). Now the
              strip takes the stack's LAST seat in flow,
              after every working part on both pointers, so
              it follows the content by construction and
              can never overlap it at any window height.
              PHONE STRIP history (Adam's defect report,
              2026-11-01, preserved): the row wraps, the
              Current line takes its OWN row (it can no
              longer reach bottom-center at any width), the
              input is narrower, and the container is
              pointer-transparent except the real controls —
              the label and the Current line never take a
              tap. The label and the Current chip carry the
              notes' black backdrop (bare text let the armed
              ghost's poles paint straight across the
              words). On touch the strip stands down while
              a dialog is open (the takeover — its
              'Current:' line collided with the sheet's
              list headings in Adam's frame). */}
          {!(isTouch && anyDialogOpen) ? (
          <div className="pointer-events-none mt-3 flex max-w-[100vw] flex-wrap items-center gap-2">
            <label
              htmlFor="seed-input"
              className="rounded bg-black/45 px-2 py-1 text-xs opacity-70"
            >
              World seed:
            </label>
            <input
              id="seed-input"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') regenerate();
              }}
              className="pointer-events-auto bg-[#1e241c] border border-moss-deep px-2 py-1 text-xs w-40 outline-none"
            />
            <button
              onClick={() => regenerate()}
              className="pointer-events-auto bg-moss-deep hover:bg-moss px-3 py-1 text-xs"
            >
              Regenerate
            </button>
            <span className="w-full text-xs opacity-60">
              <span className="rounded bg-black/45 px-2 py-1">Current: {seed}</span>
            </span>
          </div>
          ) : null}
        </div>
        {!isTouch ? (
          <div className="pointer-events-none m-2 ml-auto flex w-full max-w-sm flex-col">
            {chipGateOpen ? (
              <HudElement
                hud={hudLayout}
                id="chip"
                className="pointer-events-auto self-end"
              >
                {locationChip}
              </HudElement>
            ) : null}
            <HudElement hud={hudLayout} id="bars">
              {barsBlock}
            </HudElement>
            {questBlock !== null ? (
              <HudElement
                hud={hudLayout}
                id="quest"
                className="pointer-events-auto"
              >
                {questBlock}
              </HudElement>
            ) : null}
          </div>
        ) : null}
        </div>
        ) : null}
      </HudShell>

      {/* QUEST CARD, COLLAPSED SEAT (Adam's touch defect,
          2026-11-01): the card's home is the HudShell stack,
          which unmounts while collapsed — so on the phone a
          quest she MARKED was invisible until Show HUD, the
          placement card's disease exactly. The cure is the
          placement bar's precedent: a second seat outside
          the collapsed gate, top-left under the door row
          (top-28 clears the row even when it wraps to two
          lines on a narrow screen), carrying the FULL card
          (the same component and
          props as the stack seat — title, hint, component
          progress; a mark she has to excavate defeats the
          feature). The seats are exclusive by hudCollapsed:
          exactly one card ever stands. It yields to an open
          dialog (the takeover) like the rest of the chrome.
          It sits at z-30, under the pause veil: a readout,
          not a trapped action — resume brings it forward.
          WIDTH (mobile reconciliation, 2026-11-02): capped
          at 15rem — at 20rem on a landscape phone the card
          spanned half the screen and its lower edge reached
          the MOVE stick; with the sticks dropped to the
          corners the card at top-28 now bottoms above the
          disc tops, drive-measured at 915×412. */}
      {hudCollapsed &&
      cardQuestRow &&
      cardQuestRow.id !== dismissedCardQuestId &&
      !anyDialogOpen ? (
        <div className="pointer-events-none absolute left-2 top-28 z-30 w-[calc(100vw-1rem)] max-w-[15rem]">
          <QuestCard
            title={cardQuestRow.title}
            hint={cardQuestRow.hint}
            countLine={cardQuestCountLine}
            components={cardQuestComponents}
            marked={cardQuestRow.id === activeQuestId}
            theme={lookThemes.world}
            onClose={() => setDismissedCardQuestId(cardQuestRow.id)}
          />
        </div>
      ) : null}

      {/* Touch HUD bar: collapsed = slim bar (Show HUD + the
        buttons that must stay tappable); expanded = a single
        Hide HUD button, since the stack carries the rest.
        Desktop renders neither. The whole row stands down
        while a dialog is open (the takeover — the dialog
        has its own Close and takes the screen). */}
      {isTouch && !anyDialogOpen ? (
        hudCollapsed ? (
          <div className="pointer-events-auto absolute left-2 right-2 top-2 z-40 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHudCollapsed(false)}
              className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
            >
              Show HUD
            </button>
            <button
              type="button"
              onClick={toggleInventoryPanel}
              aria-pressed={inventoryOpen}
              className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
            >
              Inventory
            </button>
            <button
              type="button"
              onClick={toggleCraftingPanel}
              aria-pressed={craftingOpen}
              className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
            >
              Crafting
            </button>
            <button
              type="button"
              onClick={toggleCharmsPanel}
              aria-pressed={charmsOpen}
              className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
            >
              Charms
            </button>
            {hasBondedCompanion ? (
              <button
                type="button"
                onClick={toggleCompanionsPanel}
                aria-pressed={companionsOpen}
                className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
              >
                Companions
                {!isTouch ? (
                  <span
                    aria-hidden="true"
                    className={'ml-1 ' + KEY_BADGE_CLASS}
                  >
                    N
                  </span>
                ) : null}
              </button>
            ) : null}
            {hasJournalItem ? (
              <button
                type="button"
                onClick={toggleJournalPanel}
                aria-pressed={journalOpen}
                className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
              >
                Journal
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOptionsOpen(true)}
              className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
            >
              Options
            </button>
          </div>
        ) : (
          <button
            type="button"
            // One tap reclaims the look field: collapsing the
            // stack alone would leave an open bottom sheet
            // (60vh) covering the look field's lower half,
            // so Hide also closes all panels. Panel state is
            // view-only — inventory, crafting, and wardrobe
            // state live on, reopening restores the same rows.
            onClick={() => {
              setHudCollapsed(true);
              setInventoryOpen(false);
              setCraftingOpen(false);
              setCharmsOpen(false);
              setCompanionsOpen(false);
              setJournalOpen(false);
            }}
            aria-label="Hide HUD panels to reveal the game"
            className="pointer-events-auto absolute right-2 top-2 z-40 min-h-[44px] rounded bg-black/60 px-3 py-2 text-sm"
          >
            Hide HUD
          </button>
        )
      ) : null}

      {/* Panels column (right side; bottom sheet on touch).
          TOUCH SHEET HEIGHT (Adam, 2026-11-01 — dialogs
          less claustrophobic): the sheet rises to 92dvh —
          with the world chrome stood down behind it (the
          anyDialogOpen takeover), the dialog takes the
          screen instead of squeezing into 60vh over the
          sticks. Inner self-caps rise with it (CraftingMenu,
          the site sections, OptionsModal) so nothing clips
          inside a taller sheet. Desktop unchanged. */}
      <div
        className={
          isTouch
            ? 'pointer-events-auto absolute left-2 right-2 bottom-2 z-30 flex max-h-[92dvh] flex-col gap-2 overflow-y-auto ' +
              touchScrollbar
            : 'pointer-events-auto absolute right-2 top-20 z-30 flex max-h-[calc(100vh-6rem)] w-80 max-w-[calc(100vw-1rem)] flex-col gap-2 overflow-y-auto'
        }
      >
        {selectedPile ? (
          (() => {
            const pileModel = pileModalModel(selectedPile);
            return (
              <PileInventoryModal theme={lookThemes.world}
                onInfoItem={(item) => openItemInfo(item.id)}
                title={
                  selectedPile.stacks.length === 1
                    ? `${displayNameFor(selectedPile.stacks[0].item)} × ${selectedPile.stacks[0].quantity}`
                    : `Pile × ${selectedPile.stacks.reduce((sum, stack) => sum + stack.quantity, 0)} (${selectedPile.stacks.length} kinds)`
                }
                totalText={`${formatLb(
                  selectedPile.stacks.reduce(
                    (sum, stack) =>
                      sum + weightOf(stack.item as ItemId) * stack.quantity,
                    0,
                  ),
                )} lb`}
                carryingText={capacityText}
                atHomeName={
                  shelterHouseId !== null &&
                  shelterAt(
                    selectedPile.x,
                    selectedPile.z,
                    shelterState.snapshot(),
                    placedTentsRef.current,
                  ).houseId === shelterHouseId
                    ? (shelterHouseName ?? undefined)
                    : undefined
                }
                onOpenStorage={() => {
                  selectedPileIdRef.current = null;
                  setSelectedPileId(null);
                  openInventoryPanel();
                }}
                items={pileModel.items}
                verbsFor={(item) => pileModel.verbsByItem.get(item.id) ?? []}
                onVerb={(_itemId, verbId) =>
                  handlePileAction(selectedPile, verbId)
                }
                onVisibleVerbs={(verbs) => {
                  pileVisibleVerbsRef.current = {
                    pileId: selectedPile.id,
                    verbs,
                  };
                }}
                showKeyHints={!isTouch}
                sortMode={inventorySort.mode}
                sortReversed={inventorySort.reversed}
                onSortChange={handleInventorySortChange}
                categoryOrder={ITEM_CATEGORY_ORDER}
                onClose={() => {
                  selectedPileIdRef.current = null;
                  setSelectedPileId(null);
                }}
              />
            );
          })()
        ) : null}
        {inventoryOpen ? (
          <InventoryPanel theme={lookThemes.world}
            onInfoItem={(item) => openItemInfo(item.id)}
            items={inventoryItems.filter(
              (item) => !wornGear.ids.has(normalizeItemId(item.id as ItemId)),
            )}
            worn={wornGear.sections}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            placeableIds={PLACEABLE_IDS}
            onPlaceItem={handlePlaceItem}
            foodIds={FOOD_IDS}
            onEatItem={handleEatItem}
            lightableIds={TORCH_IDS}
            onLightItem={handleLightTorchItem}
            readableIds={READABLE_BOOK_IDS}
            onReadItem={handleReadItem}
            dumpableIds={DUMPABLE_IDS}
            onDumpItem={() => handleDumpItem()}
            tendableIds={TENDABLE_IDS}
            onTendItem={handleTendSalve}
            appliableIds={APPLIABLE_IDS}
            onApplyItem={() => handleApplyItem()}
            douseableIds={DOUSEABLE_IDS}
            onDouseItem={handleDouseItem}
            washableIds={WASHABLE_IDS}
            onWashItem={handleWashItem}
            mixableIds={MIXABLE_IDS}
            onMixItem={handleMixWashItem}
            wakeableIds={WAKEABLE_IDS}
            onWakeItem={handleWakeItem}
            storage={storageSection}
            onDepositItem={handleDepositItem}
            onDropItem={handleDropItem}
            onDropAllItem={handleDropAllItem}
            nearbyPileItems={nearbyPileItems}
            onTakeItem={(kind, quantity) =>
              nearestPile !== undefined
                ? handlePileAction(
                    nearestPile,
                    quantity === 1 ? `take-one:${kind}` : `take-all:${kind}`,
                  )
                : undefined
            }
            capacityText={capacityText}
            sortMode={inventorySort.mode}
            sortReversed={inventorySort.reversed}
            onSortChange={handleInventorySortChange}
            recencyOrder={inventory.acquisitionOrder()}
            categoryOrder={ITEM_CATEGORY_ORDER}
            onClose={() => setInventoryOpen(false)}
            comfortable={isTouch}
          />
        ) : null}
        {craftingOpen ? (
          craftContextSiteId !== null ? (
            // THE FOLD: the dialog on a stump's context —
            // the door row rides on top of the active
            // door's body, all inside the one dialog seat.
            // Craft is the CraftingMenu itself; Upgrade
            // is the acts list (the hub's, verbatim in
            // behaviour — digit badges gone with the
            // hub's digit arm); Ritual is the panel
            // without site acts, the grade gate folded in.
            <div className="flex flex-col gap-2">
              <div
                className={
                  'flex items-center gap-1 rounded-2xl p-1.5 ' +
                  UI_THEMES[lookThemes.dialog].panel
                }
                role="group"
                aria-label={`${contextSiteLabel ?? 'Stump'} doors`}
              >
                {(craftContextSiteId.startsWith('fire:')
                  ? (['fire', 'craft'] as const)
                  : (['craft', 'upgrade', 'ritual'] as const)
                ).map((door) => (
                  <button
                    key={door}
                    type="button"
                    aria-pressed={craftDoor === door}
                    onClick={() => setCraftDoor(door)}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    className={
                      'min-h-[44px] flex-1 rounded-xl px-2 py-1.5 text-sm ' +
                      (craftDoor === door
                        ? UI_THEMES[lookThemes.dialog].button
                        : 'text-stone-300 hover:bg-white/10')
                    }
                  >
                    {door === 'fire'
                      ? 'Fire'
                      : door === 'craft'
                        ? 'Craft'
                        : door === 'upgrade'
                          ? 'Upgrade'
                          : 'Ritual'}
                  </button>
                ))}
              </div>
              {craftDoor === 'fire' &&
              craftContextFire !== undefined ? (
                <section
                  aria-label="Kiln fire"
                  className={
                    (isTouch ? 'max-h-[92dvh] ' : 'max-h-[70vh] ') +
                    'overflow-y-auto rounded-2xl p-2 ' +
                    UI_THEMES[lookThemes.dialog].panel
                  }
                >
                  <h3 className="text-sm font-medium">
                    {FIRE_NAME[craftContextFire.type]}
                  </h3>
                  <div className="mt-2 flex flex-col gap-1">
                    {fireMenuActions(craftContextFire).map(
                      (action) => (
                        <div key={action.id}>
                          <button
                            type="button"
                            disabled={action.disabled}
                            onClick={() => {
                              if (action.id === 'close') {
                                setCraftingOpen(false);
                              } else {
                                handleFireAction(
                                  craftContextFire.id,
                                  action.id,
                                );
                              }
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                            }}
                            className={
                              'min-h-[44px] w-full rounded-xl px-2 py-1.5 text-left text-sm ' +
                              UI_THEMES[lookThemes.dialog].button +
                              ' disabled:cursor-not-allowed disabled:opacity-40'
                            }
                          >
                            {action.label}
                            {action.hint ? (
                              <span className="ml-2 opacity-80">
                                {action.hint}
                              </span>
                            ) : null}
                          </button>
                          {action.disabled && action.disabledNote ? (
                            <p className="px-2 pt-0.5 text-xs opacity-80">
                              {action.disabledNote}
                            </p>
                          ) : null}
                        </div>
                      ),
                    )}
                  </div>
                </section>
              ) : craftDoor === 'craft' ? (
                <CraftingMenu theme={lookThemes.dialog}
                  onInfoItem={openItemInfo}
                  recipes={orderedCraftingRecipes}
                  sections={craftingSections}
                  stationNote={stationNote}
                  pickupDoor={craftingPickupDoor}
                  comfortable={isTouch}
                  selectedRecipeId={selectedRecipeId}
                  onSelectRecipe={setSelectedRecipeId}
                  onCraft={handleCraft}
                  onCraftPrerequisite={handleCraftPrerequisite}
                  onClose={() => setCraftingOpen(false)}
                />
              ) : craftDoor === 'upgrade' ? (
                <section
                  aria-label={`${contextSiteLabel ?? 'Stump'} upgrades`}
                  className={
                    (isTouch ? 'max-h-[92dvh] ' : 'max-h-[70vh] ') +
                    'overflow-y-auto rounded-2xl p-2 ' +
                    UI_THEMES[lookThemes.dialog].panel
                  }
                >
                  <h3 className="text-sm font-medium">
                    {contextSiteLabel}
                  </h3>
                  {contextSiteActs.length > 0 ? (
                    <div className="mt-2 flex flex-col gap-1">
                      {contextSiteActs.map((act) => (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() =>
                            handleSiteAct(craftContextSiteId, act.id)
                          }
                          onTouchStart={(e) => {
                            e.stopPropagation();
                          }}
                          className={
                            'min-h-[44px] rounded px-3 py-2 text-left text-sm ' +
                            UI_THEMES[lookThemes.dialog].button
                          }
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-stone-300">
                      Nothing to add here.
                    </p>
                  )}
                </section>
              ) : contextSiteGrade !== 2 ? (
                // GRADE GATE, folded in: the Ritual door
                // stays VISIBLE at a plain stump, gated —
                // its body is the refusal, pointing at the
                // Upgrade door. The staging handler guards
                // itself too (handleStageBone), so the gate
                // is not this rendering's word alone.
                <section
                  aria-label={`${contextSiteLabel ?? 'Stump'} ritual`}
                  className={
                    (isTouch ? 'max-h-[92dvh] ' : 'max-h-[70vh] ') +
                    'overflow-y-auto rounded-2xl p-2 ' +
                    UI_THEMES[lookThemes.dialog].panel
                  }
                >
                  <h3 className="text-sm font-medium">
                    {contextSiteLabel}
                  </h3>
                  <p className="mt-2 text-sm text-stone-200">
                    {RITUAL_ALTAR_REFUSAL}
                  </p>
                  {ritualNote !== null &&
                  ritualNote !== RITUAL_ALTAR_REFUSAL ? (
                    <p className="mt-1 text-xs text-stone-300">
                      {ritualNote}
                    </p>
                  ) : null}
                </section>
              ) : (
                <RitualPanel theme={lookThemes.dialog}
                  siteLabel={contextSiteLabel ?? 'Stump'}
                  staged={
                    contextSiteStaged !== null &&
                    contextSiteStaging !== null &&
                    contextSiteRecipe !== null
                      ? (() => {
                          const facts = skyFacts();
                          return {
                            boneDisplay: boneDisplayFor(
                              contextSiteStaged.bone,
                            ),
                            bonePlaced: contextSiteStaging.bonePlaced,
                            offeringGiven:
                              contextSiteStaging.offeringGiven,
                            nameSpoken: contextSiteStaging.nameSpoken,
                            looks: nameSightRef.current.looksAt(
                              contextSiteStaged.bone,
                            ),
                            minLooks: contextSiteRecipe.spokenName.minLooks,
                            sky: contextSiteRecipe.sky,
                            skyLabel: skyLabelFor(contextSiteRecipe.sky),
                            windowOpen:
                              facts !== null &&
                              windowOpen(contextSiteRecipe.sky, facts),
                            completed: contextSiteStaging.completed,
                          };
                        })()
                      : null
                  }
                  kindOptions={selectedSiteKindOptions}
                  foodOptions={selectedSiteFoodOptions}
                  note={ritualNote}
                  siteActs={undefined}
                  riteActs={contextSiteGrade === 2 ? riteActs : undefined}
                  onRiteAct={(actId) => handleRiteAct(actId, contextSiteGrade)}
                  showKeyHints={false}
                  onStageBone={(kind) =>
                    handleStageBone(craftContextSiteId, kind)
                  }
                  onGiveOffering={(item) =>
                    contextSiteStaged !== null &&
                    handleGiveOffering(
                      craftContextSiteId,
                      contextSiteStaged.bone,
                      item,
                    )
                  }
                  onSpeakName={() =>
                    contextSiteStaged !== null &&
                    handleSpeakName(
                      craftContextSiteId,
                      contextSiteStaged.bone,
                    )
                  }
                  onClose={() => {
                    setCraftingOpen(false);
                    setRitualNote(null);
                  }}
                />
              )}
            </div>
          ) : (
            <CraftingMenu theme={lookThemes.dialog}
              onInfoItem={openItemInfo}
              recipes={orderedCraftingRecipes}
              sections={craftingSections}
              stationNote={stationNote}
              pickupDoor={craftingPickupDoor}
              comfortable={isTouch}
              selectedRecipeId={selectedRecipeId}
              onSelectRecipe={setSelectedRecipeId}
              onCraft={handleCraft}
              onCraftPrerequisite={handleCraftPrerequisite}
              onClose={() => setCraftingOpen(false)}
            />
          )
        ) : null}
        {charmsOpen ? (
          <CharmsPanel theme={lookThemes.world}
            charms={charmEntries}
            selectedKind={selectedCharmKind}
            onSelectKind={setSelectedCharmKind}
            onToggleKind={handleToggleCharm}
            onClose={() => setCharmsOpen(false)}
            comfortable={isTouch}
          />
        ) : null}
        {companionsOpen ? (
          <RosterPanel theme={lookThemes.world}
            groups={rosterGroups}
            onStance={handleCompanionStance}
            onStanceAll={handleCompanionStanceAll}
            onRelease={handleCompanionRelease}
            notes={companionPanelNotes}
            allNote={companionAllNote ?? undefined}
            onClose={() => setCompanionsOpen(false)}
            comfortable={isTouch}
          />
        ) : null}
        {journalOpen ? (
          <JournalPanel theme={lookThemes.world}
            sortOrder={journalSortOrder}
            onSortChange={setJournalSortOrder}
            marks={journalRows}
            names={journalNameRows}
            onRecite={handleRecite}
            places={journalPlaceRows}
            bases={journalBaseRows}
            onScryTarget={handleScryTarget}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={selectPlace}
            nameHereHint={nameHereHint}
            onNamePlace={handleNamePlace}
            onRenamePlace={handleRenamePlace}
            onUnnamePlace={(id) =>
              setPendingUnnamePlace(
                namedPlacesRef.current.get(id) ?? null,
              )
            }
            nameMaxChars={NAME_MAX_CHARS}
            charms={journalCharmRows}
            onToggleCharm={handleToggleCharm}
            companions={
              <RosterPanel theme={lookThemes.world}
                embedded
                groups={rosterGroups}
                onStance={handleCompanionStance}
                onStanceAll={handleCompanionStanceAll}
                onRelease={handleCompanionRelease}
                notes={companionPanelNotes}
                allNote={companionAllNote ?? undefined}
                comfortable={isTouch}
              />
            }
            quests={questDisplay}
            onMarkQuest={toggleActiveQuestMark}
            onClose={() => setJournalOpen(false)}
            comfortable={isTouch}
          />
        ) : null}
        {craftNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {craftNote}
          </p>
        ) : null}
        {eatNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {eatNote}
          </p>
        ) : null}
        {torchNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {torchNote}
          </p>
        ) : null}
        {tentNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {tentNote}
          </p>
        ) : null}
        {bagNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {bagNote}
          </p>
        ) : null}
        {altarNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {altarNote}
          </p>
        ) : null}
        {deskNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {deskNote}
          </p>
        ) : null}
        {workstationNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {workstationNote}
          </p>
        ) : null}
        {cauldronNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {cauldronNote}
          </p>
        ) : null}
        {fireNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {fireNote}
          </p>
        ) : null}
        {dropNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {dropNote}
          </p>
        ) : null}
      </div>


      {/* Controls help (desktop only — touch devices get the TouchControls cues). */}
      {isTouch ? null : (
      <div className="absolute bottom-0 right-0 z-30 p-4 text-right text-xs opacity-70 pointer-events-none">
        <p>WASD to walk</p>
        <p>Double-tap W to sprint</p>
        <p>Space to jump</p>
        <p>V / C to switch camera</p>
        <p>E — Interact</p>
        <p>R — 2nd Interact</p>
        <p>RMB — Place lit torch</p>
        <p>Esc — Options</p>
        <p>X — Close dialog</p>
        {cameraMode === 'first' && <p>Click the world to capture the mouse</p>}
      </div>
      )}

      {/* Touch controls (coarse-pointer devices only). Rendered
        below the z-30 HUD/panels/world buttons, so taps on
        those still land on them; the look field only catches
        touches on open world. The layer stands down while
        a dialog is open (the takeover): no sticks or USE/
        JUMP buttons painting through a translucent sheet,
        and no look drags turning the camera behind it. */}
      {isTouch && !anyDialogOpen ? (
        <TouchControls
          onMove={applyTouchMove}
          onTurn={applyTurn}
          onLook={applyTouchLook}
          onInteract={handleUseInteract}
          interactLabel={useWinnerLabel}
          onPlaceTorch={
            inventoryItems.some((item) => item.id === ITEMS.litTorch)
              ? handleWorldPlaceTorch
              : undefined
          }
          onJump={() => {
            playerRef.current?.pressJump();
          }}
        />
      ) : null}

      {/* Options modal (tabbed; Settings first: font + perspective). */}
      {optionsOpen ? (
        <OptionsModal theme={lookThemes.world} look={look} onLookChange={handleLookChange}
          font={font}
          onFontChange={handleFontChange}
          perspective={cameraMode}
          onPerspectiveChange={(picked) => cycleToCamera(picked)}
          onShowIntro={() => {
            setOptionsOpen(false);
            setIntroOpen(true);
          }}
          quests={questDisplay}
          cloud={cloudPanelProps}
          hud={{
            items: (Object.keys(HUD_ELEMENT_LABELS) as HudElementId[]).map(
              (id) => ({
                id,
                label: HUD_ELEMENT_LABELS[id],
                hidden: hudLayout.slot(id).hidden,
              }),
            ),
            onToggle: (id, hidden) => hudLayout.setHidden(id, hidden),
            onReset: () => hudLayout.reset(),
          }}
          initialTab={optionsTabRequest ?? undefined}
          stackAbove={optionsTabRequest !== null}
          onClose={() => {
            setOptionsOpen(false);
            setOptionsTabRequest(null);
          }}
          comfortable={isTouch}
        />
      ) : null}

      {/* Remove confirm (PC keys, 2026-10-28): Shift+E arms
        a scatter target; Enter/Remove confirms (same
        handleRemove call as the button), Esc/backdrop/
        Cancel aborts with nothing consumed. Folded into
        Popup (the ONE confirm shell, dialog audit
        2026-10-31): the shell's own listener is the
        single key path — the App Esc listener yields
        while it is open, as it did for the standalone. */}
      <Popup theme={lookThemes.world}
        open={pendingRemoveTarget !== null}
        title={`Remove ${pendingRemoveTarget?.name ?? ''}?`}
        onClose={() => setPendingRemoveTarget(null)}
        onConfirm={() => {
          const target = pendingRemoveTarget;
          setPendingRemoveTarget(null);
          if (target) handleRemove(target);
        }}
        comfortable={isTouch}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>This removes it permanently — it will not regrow.</p>
          <div className="flex gap-2">
            <button
              type="button"
              className={
                'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                (isTouch ? 'min-h-[44px] px-3 py-2' : '')
              }
              onClick={() => {
                const target = pendingRemoveTarget;
                setPendingRemoveTarget(null);
                if (target) handleRemove(target);
              }}
            >
              Remove
            </button>
            <button
              type="button"
              className={
                'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                (isTouch ? 'min-h-[44px] px-3 py-2' : '')
              }
              onClick={() => setPendingRemoveTarget(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      </Popup>

      {/* THE UN-NAME CONFIRM (the naming build): lifting
        a name is the Places page's one destructive act, so
        it rides Popup (the ONE confirm shell) like the
        remove confirm above. Enter confirms (the shell's
        onConfirm), Esc/backdrop/Cancel aborts with the
        name standing. */}
      <Popup theme={lookThemes.world}
        open={pendingUnnamePlace !== null}
        title={`Remove the name "${pendingUnnamePlace?.name ?? ''}"?`}
        onClose={() => setPendingUnnamePlace(null)}
        onConfirm={handleUnnamePlace}
        comfortable={isTouch}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>The place stays — only her name for it is lifted.</p>
          <div className="flex gap-2">
            <button
              type="button"
              className={
                'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                (isTouch ? 'min-h-[44px] px-3 py-2' : '')
              }
              onClick={handleUnnamePlace}
            >
              Remove name
            </button>
            <button
              type="button"
              className={
                'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                (isTouch ? 'min-h-[44px] px-3 py-2' : '')
              }
              onClick={() => setPendingUnnamePlace(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      </Popup>
      {/* THE CRAWL-BACK BEAT (the feral build): the
        down's staging — a full black cover (input
        waits), the line held in the dark, then the
        cover lifts over the encampment at dawn. The
        executor works inside the black; this element
        only presents the phases it is handed. */}
      {crawlBeat !== null ? (
        <div
          role="presentation"
          aria-label="She crawls back"
          className={
            'fixed inset-0 z-[80] flex items-center justify-center bg-black transition-opacity duration-700 ' +
            (crawlBeat.phase === 'wake'
              ? 'pointer-events-none opacity-0'
              : 'pointer-events-auto opacity-100')
          }
        >
          {crawlBeat.phase !== 'fall' ? (
            <p className="max-w-md px-6 text-center text-base leading-relaxed text-stone-200">
              {crawlBeat.line}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* The teaching beat (First-Fragment
        Presentation): a NON-confirm Popup — a mark's
        first transcription is a lesson, not a choice,
        so the dialog only dismisses (Keep looking,
        the shell's Close, Esc, backdrop). Copy DRAFT. */}
      <Popup theme={lookThemes.dialog}
        open={fragmentBeat !== null}
        title={fragmentBeat?.title ?? 'A mark'}
        onClose={() => setFragmentBeat(null)}
        comfortable={isTouch}
      >
        {fragmentBeat !== null ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>{fragmentBeat.body}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={() => setFragmentBeat(null)}
              >
                Keep looking
              </button>
            </div>
          </div>
        ) : null}
      </Popup>

      {/* The familiar's rite confirm (Build 2, Piece 1):
        Popup, the one confirm shell — the guard the
        rite's verbs carry. It names the animal;
        supersede names the displacement too. Enter
        confirms (the shell's onConfirm), Esc / backdrop
        / Cancel perform nothing. Copy DRAFT. */}
      <Popup theme={lookThemes.dialog}
        open={pendingRite !== null}
        title={
          pendingRite === null || pendingRiteRecord === undefined
            ? 'The rite'
            : pendingRite.act === 'elevate'
              ? `Raise the ${companionKindLabel(pendingRiteRecord.kind)}?`
              : pendingRite.act === 'relinquish'
                ? `Let the ${companionKindLabel(pendingRiteRecord.kind)} step down?`
                : `Raise the ${companionKindLabel(pendingRiteRecord.kind)} in the ${standingFamiliarRecord ? companionKindLabel(standingFamiliarRecord.kind) : 'familiar'}'s place?`
        }
        onClose={() => setPendingRite(null)}
        onConfirm={confirmRite}
        comfortable={isTouch}
      >
        {pendingRite !== null && pendingRiteRecord !== undefined ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              {pendingRite.act === 'elevate'
                ? `The rite binds the ${companionKindLabel(pendingRiteRecord.kind)} as your familiar — the one who stands closest. What the altar makes, only the altar can unmake.`
                : pendingRite.act === 'relinquish'
                  ? `The ${companionKindLabel(pendingRiteRecord.kind)} stays your companion and your friend — only the familiar's place empties, and the glow dies.`
                  : `The ${standingFamiliarRecord ? companionKindLabel(standingFamiliarRecord.kind) : 'familiar'} steps down to companion, and the ${companionKindLabel(pendingRiteRecord.kind)} rises as your familiar — one act, both or neither.`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={confirmRite}
              >
                {pendingRite.act === 'elevate'
                  ? 'Raise as familiar'
                  : pendingRite.act === 'relinquish'
                    ? 'Step down'
                    : 'Raise in their place'}
              </button>
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={() => setPendingRite(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Popup>

      {/* Leave confirm (back-button trap, 2026-10-29):
        shown by the popstate handler when a back press
        arrives with nothing open. Stay dismisses (the
        trap entry is already re-pushed); Leave arms the
        one-shot pass and steps back for real. Folded
        into Popup with the remove confirm (dialog audit
        2026-10-31); the App Esc listener yields while
        it is open, and the shell maps Esc to Stay and
        Enter to Leave. */}
      <Popup theme={lookThemes.world}
        open={leaveConfirmOpen}
        title="Leave the game?"
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={handleLeaveGame}
        comfortable={isTouch}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>Your progress is saved.</p>
          <div className="flex gap-2">
            <button
              type="button"
              className={
                'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                (isTouch ? 'min-h-[44px] px-3 py-2' : '')
              }
              onClick={() => setLeaveConfirmOpen(false)}
            >
              Stay
            </button>
            <button
              type="button"
              className={
                'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                (isTouch ? 'min-h-[44px] px-3 py-2' : '')
              }
              onClick={handleLeaveGame}
            >
              Leave
            </button>
          </div>
        </div>
      </Popup>

      {/* First-run dialog: no save at boot — name + seed,
        both optional, Begin-only (no Cancel, no X, no
        backdrop dismiss; Begin-with-blanks is the exit).
        Renders before the intro modal; Begin opens the
        intro (firstRunDone gate + explicit setIntroOpen). */}
      {firstRunDialogOpen ? (
        <FirstRunDialog theme={lookThemes.world}
          onBegin={handleFirstRunBegin}
          onCloudSaves={() => {
            setOptionsTabRequest('cloud');
            setOptionsOpen(true);
          }}
          comfortable={isTouch}
        />
      ) : null}

      {/* New-game dialog (folded confirm, dialog audit
        claim 3, 2026-10-31): the cloud New Game door opens
        the first-run dialog's new-game mode over the live
        session — the park warning (the press-time
        snapshot's world, named) sits directly above
        Begin, the commitment point, and Back returns to
        the cloud panel parking nothing (Esc is Back too,
        per the effect beside beginFoldedNewGame). Begin
        stashes the entered name/seed, parks the current
        save, and reloads; the fresh boot consumes the
        stash instead of showing this dialog a second
        time. The two dialogs never co-open: this seat
        needs a live save, the first-run seat needs none. */}
      {cloudPendingNewGame !== null ? (
        <FirstRunDialog theme={lookThemes.world}
          onBegin={beginFoldedNewGame}
          onCloudSaves={() => {
            setOptionsTabRequest('cloud');
            setOptionsOpen(true);
          }}
          onBack={() => setCloudPendingNewGame(null)}
          warning={
            <>
              <p>
                Start a fresh world? Your current world “
                {cloudPendingNewGame.local.worldName ?? 'Main save'}”
                will be parked, not deleted — the Restore parked
                save door brings it back. Nothing carries over to
                the new world.
              </p>
              {cloudPendingNewGame.parked !== null ? (
                <p className="text-xs opacity-80">
                  Your existing parked save will be replaced.
                </p>
              ) : null}
            </>
          }
          comfortable={isTouch}
        />
      ) : null}

      {/* Intro modal: first run (no save at boot) + re-openable
        from Options. On first run the dialog precedes it
        (firstRunDone gate). Same z-50 shell as OptionsModal; the two
        never stack (opening the intro closes Options). */}
      {introOpen ? (
        <IntroModal theme={lookThemes.world}
          onClose={() => setIntroOpen(false)}
          comfortable={isTouch}
        />
      ) : null}

      {/* Cloud bring-down confirm: names the incoming
        cloud save and the displaced local (press-time
        snapshot) + the park warning when a parked save
        will be replaced. Confirm parks the current local
        and installs the cloud save (write + reload);
        Cancel (or Esc) changes nothing. */}
      <Popup theme={lookThemes.dialog}
        open={cloudPendingBring !== null}
        title="Bring this world here?"
        onClose={() => setCloudPendingBring(null)}
        comfortable={isTouch}
      >
        {cloudPendingBring !== null ? (
          <div className="flex flex-col gap-3 p-3 text-sm">
            <p>
              Bringing “
              {cloudPendingBring.name ??
                cloudSaves.find(
                  (row) => row.slot === cloudPendingBring.slot,
                )?.name ??
                (cloudPendingBring.slot === 'main'
                  ? 'Main save'
                  : cloudPendingBring.slot)}
              ” here will replace your current world “
              {cloudPendingBring.local.worldName ?? 'Main save'}”.
            </p>
            <p className="text-xs opacity-80">
              Your current world will be parked, not deleted — the
              Restore parked save door brings it back.
              {cloudPendingBring.parked !== null
                ? ' Your existing parked save will be replaced.'
                : ''}
            </p>
            {cloudPendingBring.words !== null &&
            (cloudWords === null ||
              cloudPendingBring.words.join(' ') !==
                cloudWords.join(' ')) ? (
              <p className="text-xs opacity-80">
                This world lives under the words “
                {cloudPendingBring.words.join(' ')}” — bringing
                it here makes those this device&rsquo;s cloud
                words, and “Show my words” will read them.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={confirmCloudBring}
              >
                Bring here
              </button>
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={() => setCloudPendingBring(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Popup>

      {/* Cloud remove confirm: explicit-only (approved).
        Removing the cloud copy does NOT turn off
        mirroring — the next save copies this world to
        the cloud again (disclosure, required). */}
      <Popup theme={lookThemes.dialog}
        open={cloudPendingRemove !== null}
        title="Remove from cloud?"
        onClose={() => setCloudPendingRemove(null)}
        comfortable={isTouch}
      >
        {cloudPendingRemove !== null ? (
          <div className="flex flex-col gap-3 p-3 text-sm">
            <p>
              Remove “{cloudPendingRemove.row.name ?? 'Main save'}”
              from the cloud?
            </p>
            <p className="text-xs opacity-80">
              This does not turn off mirroring — the next save
              copies this world to the cloud again. Turn cloud off
              to stop mirroring.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={() => {
                  void confirmCloudRemove();
                }}
              >
                Remove
              </button>
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={() => setCloudPendingRemove(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Popup>

      {/* THE WRITE-GUARD DIALOG (the conflict pass,
        2026-11-01): opened once per episode by
        announceCloudConflict. Both times are spoken;
        the doors are the panel block's own handlers.
        Enter confirms KEEP and dismissal IS Keep —
        focus and no-action default to the safe door.
        Copy DRAFT. */}
      <Popup theme={lookThemes.dialog}
        open={cloudConflictPrompt !== null}
        title="A newer copy stands on the shelf"
        onClose={handleCloudConflictKeep}
        onConfirm={handleCloudConflictKeep}
        comfortable={isTouch}
      >
        {cloudConflictPrompt !== null ? (
          <div className="flex flex-col gap-3 p-3 text-sm">
            <p>
              The shelf holds a copy of this world saved{' '}
              {new Date(
                cloudConflictPrompt.shelfUpdatedAt,
              ).toLocaleString()}
              . This device's own save is from{' '}
              {new Date(
                cloudConflictPrompt.localSavedAt,
              ).toLocaleString()}
              .
            </p>
            <p className="text-xs opacity-80">
              {cloudConflictPrompt.basisUpdatedAt !== null
                ? `This device last knew the shelf at ${new Date(cloudConflictPrompt.basisUpdatedAt).toLocaleString()}, so the newer copy was made somewhere else — another device, or this one before its memory was cleared.`
                : 'This device had never copied from this shelf before, so the newer copy was made somewhere else.'}{' '}
              Copying this device's save up now would
              replace it. Keeping it means this device
              holds its saves back until you load the
              shelf copy or overwrite on purpose.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={handleCloudConflictKeep}
              >
                Keep the newer copy
              </button>
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={() => {
                  void handleCloudConflictOverwrite();
                }}
              >
                Overwrite it with this device's save
              </button>
            </div>
          </div>
        ) : null}
      </Popup>

      {/* THE WAKE OFFER (the rework's third pass,
        2026-11-01): at open, a shelf holding a
        fresher save OFFERS its load — an ask, never
        an auto-load. Load rides the standing bring
        door (the current world parks first, as
        every bring does). Not now changes nothing.
        Copy DRAFT. */}
      <Popup theme={lookThemes.dialog}
        open={cloudWakeOffer !== null}
        title="A newer save stands on your shelf"
        onClose={() => setCloudWakeOffer(null)}
        comfortable={isTouch}
      >
        {cloudWakeOffer !== null ? (
          <div className="flex flex-col gap-3 p-3 text-sm">
            <p>
              The shelf holds{' '}
              {cloudWakeOffer.shelfName ?? 'a copy of this world'}{' '}
              saved{' '}
              {new Date(
                cloudWakeOffer.shelfUpdatedAt,
              ).toLocaleString()}
              .
            </p>
            <p className="text-xs opacity-80">
              {cloudWakeOffer.localSavedAt !== null
                ? `This device's own save is from ${new Date(cloudWakeOffer.localSavedAt).toLocaleString()}. `
                : 'This device has no save of its own yet. '}
              Loading the shelf copy parks this device's
              world first — nothing here is lost by
              looking.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={() => {
                  const offer = cloudWakeOffer;
                  setCloudWakeOffer(null);
                  if (offer !== null) {
                    void runCloudBring('main', getWords());
                  }
                }}
              >
                Load the shelf copy
              </button>
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={() => setCloudWakeOffer(null)}
              >
                Not now
              </button>
            </div>
          </div>
        ) : null}
      </Popup>

      {/* ITEM INFO CARD: opened from any row of the
        unified surface. Every fact is composed here,
        shell-side — name and catalogue id never gate;
        the description is the row note's own rule
        (itemNoteFor); the known-facts sections read
        Systems' register and show the hole plainly
        where nothing is known yet. Copy DRAFT. */}
      <Popup theme={lookThemes.dialog}
        open={itemInfoId !== null}
        title={
          itemInfoId !== null
            ? displayNameFor(normalizeItemId(itemInfoId))
            : ''
        }
        onClose={() => setItemInfoId(null)}
        comfortable={isTouch}
      >
        {itemInfoId !== null ? (
          <div className="flex flex-col gap-3 p-3 text-sm">
            <p className="text-xs opacity-80">
              Catalogue: {normalizeItemId(itemInfoId)}
            </p>
            {itemNoteFor(itemInfoId, charmStateRef.current) ? (
              <p>{itemNoteFor(itemInfoId, charmStateRef.current)}</p>
            ) : null}
            <p>
              Weight: {formatLb(weightOf(normalizeItemId(itemInfoId)))}{' '}
              lb each
              {inventory.count(itemInfoId as ItemId) > 0
                ? ` — you carry ${inventory.count(itemInfoId as ItemId)}, ${formatLb(weightOf(normalizeItemId(itemInfoId)) * inventory.count(itemInfoId as ItemId))} lb in all.`
                : '.'}
            </p>
            {(() => {
              const facts = itemFactsFor(normalizeItemId(itemInfoId));
              // The harvest-source seam (Background's
              // SOURCE_YIELD_INDEX in game/objects.ts,
              // 2026-11-03): the harvest lines join the
              // card here, where both layers are visible
              // — under the SAME met gate itemFactsFor
              // applies internally, so an unmet item
              // shows no sources at all. The shell also
              // TRANSLATES (DEV's ratification of the
              // drive finding, 2026-11-03): the index is
              // keyed in the defs' spelling space
              // (UPPER_SNAKE legacy yields, kebab
              // flowers) while the card's ids are
              // canonical, and the two spaces meet only
              // in Systems' ITEM_ID_ALIASES — so the
              // lines are read under the canonical id
              // AND under its alias key, whichever the
              // defs used. An item's lines live under
              // exactly one spelling, so the order
              // within the section is the index's own.
              if (isItemMet(normalizeItemId(itemInfoId))) {
                const infoId = normalizeItemId(itemInfoId);
                facts.sources.push(...harvestSourceLinesFor(infoId));
                const aliasKey = Object.keys(ITEM_ID_ALIASES).find(
                  (key) => ITEM_ID_ALIASES[key] === infoId,
                );
                if (aliasKey !== undefined && aliasKey !== infoId) {
                  facts.sources.push(...harvestSourceLinesFor(aliasKey));
                }
              }
              return (
                <>
                  <div>
                    <p className="font-medium">Where it comes from</p>
                    {facts.sources.length > 0 ? (
                      <ul className="list-disc pl-5">
                        {facts.sources.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="opacity-80">Not yet known.</p>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">What it's for</p>
                    {facts.uses.length > 0 ? (
                      <ul className="list-disc pl-5">
                        {facts.uses.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="opacity-80">Not yet known.</p>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}
      </Popup>

      {/* Parked restore confirm: the swap — the current
        world parks in turn, so restore never deletes. */}
      <Popup theme={lookThemes.dialog}
        open={cloudPendingRestore !== null}
        title="Restore parked save?"
        onClose={() => setCloudPendingRestore(null)}
        comfortable={isTouch}
      >
        {cloudPendingRestore !== null ? (
          <div className="flex flex-col gap-3 p-3 text-sm">
            <p>
              Restore “{cloudPendingRestore.worldName ?? 'Main save'}”
              as your current world?
            </p>
            <p className="text-xs opacity-80">
              Your current world will be parked in its place —
              nothing is deleted.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={confirmCloudRestore}
              >
                Restore
              </button>
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={() => setCloudPendingRestore(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Popup>

      {/* Trap-craft confirm: Adam's words, verbatim, asked FIRST
        on trap Craft — Yes runs the existing execution, No or
        Close aborts with nothing consumed and no trap. The
        Popup shell is the staged dialog (z-50 modal); the
        buttons match the placement banner's touch sizing. */}
      {pendingTrapRecipe ? (
        <Popup theme={lookThemes.dialog}
          open={true}
          title="PLACE TRAP HERE?"
          onClose={handleTrapConfirmNo}
          comfortable={isTouch}
        >
          <p className="text-sm text-stone-200">
            Place {pendingTrapRecipe.name} here?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleTrapConfirmYes}
              className={
                isTouch
                  ? 'min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss'
                  : 'rounded bg-moss-deep px-2 py-0.5 text-xs hover:bg-moss'
              }
            >
              Yes
            </button>
            <button
              type="button"
              onClick={handleTrapConfirmNo}
              className={
                isTouch
                  ? 'min-h-[44px] rounded bg-[#44403c] px-3 py-2 text-sm hover:bg-[#57534e]'
                  : 'rounded bg-[#44403c] px-2 py-0.5 text-xs hover:bg-[#57534e]'
              }
            >
              No
            </button>
          </div>
        </Popup>
      ) : null}

      {/* The carryable trap's post-craft confirm (the trap
        chunk, 2026-11-01): the craft already executed —
        the trap is IN her pack — and the pinned table's
        question is place-or-pack. Yes composes the
        placement at the aim; No or Close keeps it packed.
        Same Popup shell, same button sizing as the
        site-built confirm above; the semantics differ
        (nothing here can un-craft). Copy DRAFT. */}
      {pendingCarriedTrapRecipe ? (
        <Popup theme={lookThemes.dialog}
          open={true}
          title="PLACE TRAP HERE?"
          onClose={handleCarriedTrapKeep}
          comfortable={isTouch}
        >
          <p className="text-sm text-stone-200">
            Place the {pendingCarriedTrapRecipe.name} here, or keep
            it in your pack?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCarriedTrapPlaceYes}
              className={
                isTouch
                  ? 'min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss'
                  : 'rounded bg-moss-deep px-2 py-0.5 text-xs hover:bg-moss'
              }
            >
              Place it
            </button>
            <button
              type="button"
              onClick={handleCarriedTrapKeep}
              className={
                isTouch
                  ? 'min-h-[44px] rounded bg-[#44403c] px-3 py-2 text-sm hover:bg-[#57534e]'
                  : 'rounded bg-[#44403c] px-2 py-0.5 text-xs hover:bg-[#57534e]'
              }
            >
              Keep in pack
            </button>
          </div>
        </Popup>
      ) : null}

      {/* Scry button: appears at still water (DEV split —
        visibility on movement, reveal on press). Bottom-
        centre, the PausedIndicator's seat — the two never
        show together (Scry hides while paused), so the seat
        is shared, not stacked. Hidden with any panel/modal
        open, like the readout chip, so it never sits on a
        bottom sheet. Label "Scry"
        (Adam's verb); the button IS the magic signal — no
        tutorial popup. Press shows the renderer arrows
        (Background's API, wired in CAMP ARROWS WIRING);
        arrival-dismiss and regenerate hide them again.
        While a placement is armed, the touch placement bar
        (next block) takes the bottom-center family and Scry
        hides — one actor in the seat at a time. */}
      {(scryVisible || fillOffer || furnitureFacedNow !== null) &&
      placement === null &&
      !dumpArmed &&
      !applyArmed &&
      !inventoryOpen &&
      !craftingOpen &&
      !charmsOpen &&
      !companionsOpen &&
      !optionsOpen &&
      !introOpen &&
      !pendingTrapRecipe &&
      !paused ? (
        <div className="pointer-events-none absolute bottom-12 left-1/2 z-40 flex -translate-x-1/2 gap-2">
          {scryVisible ? (
            <ScryButton onPress={handleScry} showKeyHint={!isTouch} />
          ) : null}
          {fillOffer ? (
            <FillJarButton onPress={runFillJar} showKeyHint={!isTouch} />
          ) : null}
          {furnitureFacedNow ? (
            <PickupButton
              pieceName={furnitureFacedNow.pieceName}
              onPress={handlePickupFurniture}
            />
          ) : null}
        </div>
      ) : null}

      {/* TOUCH PLACEMENT BAR (Adam's phone defect, 2026-11-01):
          the placement confirm card lives in the HudShell
          stack, which on touch starts COLLAPSED (hudCollapsed
          defaults to isTouch) and is unmounted while collapsed
          — so an armed placement on the phone showed the ghost
          but no reachable Place here, only a 'Show HUD' hunt.
          This bar is the confirm's touch door: same handlers,
          seated in the bottom-center actor family above the
          ghost's seat — Scry yields the family while a
          placement is armed (its guard above). Shown only in
          the collapsed state; expanded, the stack card is on
          screen and is the door. Hidden with any panel/modal
          open, like the rest of the seat family, so it never
          paints over a bottom sheet.
          SECOND DEFECT, same day (Adam's phone, 'Blah'): the
          bar was missing in the very state it was built for.
          The seat conditions, not the seat, were wrong: the
          bar keyed on isTouch and stood down while PAUSED —
          but the auto-pause latch (blur / tab hidden, Adam's
          2026-10-26 ruling; resume is tap-only) fires on a
          phone for a screenshot, a notification shade, an
          app switch, so an armed placement routinely sits
          PAUSED with its ghost and label up and — the card
          unmounted, the bar stood down — no confirm and no
          cancel anywhere. And a desktop HUD collapsed by
          hand hit the isTouch gate the same way. The law
          now: the bar stands in EVERY armed + collapsed
          state — touch or not, paused or not (placing and
          cancelling are save-side writes the pause never
          gated anywhere else; the stack card carries no
          pause guard either). Panels/modals still hide it:
          those are deliberate states with their own doors.
          The bar also outranks the pause VEIL (z-50 over
          its z-40 full-screen tap layer): the veil keeps
          tap-to-resume everywhere else, but the bar's own
          buttons take their taps — Adam's ruling on this
          defect was that the buttons and the bar win,
          visually and for taps. */}
      {hudCollapsed &&
      placement !== null &&
      !inventoryOpen &&
      !craftingOpen &&
      !charmsOpen &&
      !companionsOpen &&
      !journalOpen &&
      !optionsOpen &&
      !introOpen &&
      !pendingTrapRecipe &&
      pendingRemoveTarget === null ? (
        <div className="pointer-events-auto absolute bottom-24 left-1/2 z-50 -translate-x-1/2 rounded bg-black/60 px-3 py-2 text-center">
          <p className="text-sm text-stone-100">
            Placing {placement.label} where you aim.
          </p>
          <div className="mt-1 flex justify-center gap-2">
            <button
              type="button"
              onClick={handlePlaceConfirm}
              className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
            >
              Place there
            </button>
            <button
              type="button"
              onClick={handlePlaceCancel}
              className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
            >
              Cancel
            </button>
          </div>
          {placementNote ? (
            <p className="mt-1 text-xs text-red-300">{placementNote}</p>
          ) : null}
        </div>
      ) : null}

      {/* TOUCH DUMP BAR: the placement bar's sibling —
          the dump card's touch door under the same law
          (every armed + collapsed state, panels hide it). */}
      {hudCollapsed &&
      dumpArmed &&
      !inventoryOpen &&
      !craftingOpen &&
      !charmsOpen &&
      !companionsOpen &&
      !journalOpen &&
      !optionsOpen &&
      !introOpen &&
      !pendingTrapRecipe &&
      pendingRemoveTarget === null ? (
        <div className="pointer-events-auto absolute bottom-24 left-1/2 z-50 -translate-x-1/2 rounded bg-black/60 px-3 py-2 text-center">
          <p className="text-sm text-stone-100">
            {dumpAim === null
              ? 'Pour the water jar where you aim.'
              : dumpAim.cert === 'dry'
                ? 'Dry ground — the pour makes mud.'
                : dumpAim.cert === 'mud'
                  ? 'Mud — the pour raises water.'
                  : 'Water — the pour adds nothing.'}
          </p>
          <div className="mt-1 flex justify-center gap-2">
            <button
              type="button"
              onClick={confirmDump}
              className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
            >
              Pour there
            </button>
            <button
              type="button"
              onClick={cancelDump}
              className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* TOUCH APPLY BAR: the dump bar's twin — the
          apply card's touch door under the same law. */}
      {hudCollapsed &&
      applyArmed &&
      !inventoryOpen &&
      !craftingOpen &&
      !charmsOpen &&
      !companionsOpen &&
      !journalOpen &&
      !optionsOpen &&
      !introOpen &&
      !pendingTrapRecipe &&
      pendingRemoveTarget === null ? (
        <div className="pointer-events-auto absolute bottom-24 left-1/2 z-50 -translate-x-1/2 rounded bg-black/60 px-3 py-2 text-center">
          <p className="text-sm text-stone-100">
            {applyAim === null
              ? 'Paint the glow where you aim.'
              : applyAim.cert === 'not-underground'
                ? 'Open air — the paint holds only in a cave.'
                : applyAim.cert === 'nothing-faced'
                  ? 'Face a cave wall or floor, close.'
                  : applyAim.cert === 'already-painted'
                    ? 'That spot already glows.'
                    : applyAim.surface === 'wall'
                      ? 'Bare wall — the paint will hold its light here.'
                      : 'Bare floor — the paint will hold its light here.'}
          </p>
          <div className="mt-1 flex justify-center gap-2">
            <button
              type="button"
              onClick={confirmApply}
              className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
            >
              Paint there
            </button>
            <button
              type="button"
              onClick={cancelApply}
              className="min-h-[44px] rounded bg-moss-deep px-3 py-2 text-sm hover:bg-moss"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Frog water hint: bottom-centre above the
        LocationChip, the scry / pause seat family. Hidden
        with any panel/modal open or paused (the scry hide
        set minus the water/camp conditions — the fact
        itself is the gate). When the scry button is also
        showing, the hint lifts above it (aboveScry) so
        the two never stack on one seat. */}
      {frogHint !== null &&
      !inventoryOpen &&
      !craftingOpen &&
      !charmsOpen &&
      !companionsOpen &&
      !optionsOpen &&
      !introOpen &&
      !pendingTrapRecipe &&
      !paused ? (
        <FrogHint theme={lookThemes.world}
          dx={frogHint.dx}
          dz={frogHint.dz}
          distanceMeters={frogHint.distance}
          aboveScry={scryVisible}
        />
      ) : null}

      {/* Crow pile arrows (glow landing, 2026-10-28): same
        panel/modal/paused hiding as the frog hint seat, plus
        the remove-confirm dialog (a modal the frog guard
        predates — frog's own guard is untouched here, its
        gap flagged not fixed). Seat stacks above the frog
        hint when it shows (lifted), else above the scry
        button or the LocationChip like the frog seat. */}
      {crowArrows.length > 0 &&
      !inventoryOpen &&
      !craftingOpen &&
      !charmsOpen &&
      !companionsOpen &&
      !optionsOpen &&
      !introOpen &&
      !pendingTrapRecipe &&
      pendingRemoveTarget === null &&
      !paused ? (
        <CrowArrows theme={lookThemes.world}
          arrows={crowArrows}
          lifted={frogHint !== null || scryVisible}
        />
      ) : null}

      {/* Nearest-target tag (Adam, 2026-10-28): the nearest
        scatter target's bus name, world-anchored ON the thing
        via WorldAnchor (FrogHint pill styling, visual only —
        non-interactive, pointer-events-none, so parity holds:
        no input to differ). Same hiding as the CrowArrows
        rows (any panel/modal open or paused);
        world-anchored contextual panels (ritual/pile/
        placement) are NOT in the set, consistent with
        CrowArrows. */}
      {nearestScatter !== undefined &&
      tagAnchor !== null &&
      !inventoryOpen &&
      !craftingOpen &&
      !charmsOpen &&
      !companionsOpen &&
      !optionsOpen &&
      !introOpen &&
      !pendingTrapRecipe &&
      pendingRemoveTarget === null &&
      !paused ? (
        <WorldAnchor x={tagAnchor.x} y={tagAnchor.y}>
          <p
            className={
              'whitespace-nowrap rounded px-2 py-1 text-xs text-stone-100 ' +
              UI_THEMES[lookThemes.world].overlay
            }
          >
            {nearestScatter.name}
          </p>
        </WorldAnchor>
      ) : null}

      {/* Creature identifier tag (Adam, 2026-10-28): the
        nearest world animal, display only — same hiding
        set as the scatter tag above (any panel/modal open
        or paused hides it; ritual/pile/placement menus do
        not). The component polls Background's live feed
        itself (animals move independently, so per-render
        derivation would go stale); App only gates it and
        hands it the feed, the live player position, and
        the 'scatter' projector. */}
      {/* Structure identifier tag (2026-10-31): the
        nearest faced singular's name — the creature
        tag's seat and hiding set (plus the journal and
        the teaching beat, the newer surfaces), with the
        tag itself derived per render above (structures
        are static, so no poll). Display only. Its dialog
        terms now read the one anyDialogOpen flag (the
        takeover's set — which also closes this tag's old
        gaps: the pile modal and the site windows used to
        leave it standing behind them). */}
      {!anyDialogOpen &&
      fragmentBeat === null &&
      !paused ? (
        <>
          <StructureTag theme={lookThemes.world} tag={structureTag} />
          <StructureTag theme={lookThemes.world} tag={groundTag} />
          <StructureTag theme={lookThemes.world} tag={trapTag} />
        </>
      ) : null}

      {!inventoryOpen &&
      !craftingOpen &&
      !charmsOpen &&
      !companionsOpen &&
      !optionsOpen &&
      !introOpen &&
      !pendingTrapRecipe &&
      pendingRemoveTarget === null &&
      !paused ? (
        <AnimalTag theme={lookThemes.world}
          getAnimals={() => {
            const animals = (
              rendererRef.current?.getVisibleAnimals() ?? []
            ).map((animal) =>
              // THE FERAL DRESS (Adam, 2026-11-01: "If the
              // fox is feral, put that in the tag."): a
              // feral creature's plate carries its nature
              // as a named entry, composed here where
              // Systems' isFeral may be read (a pure fact
              // of the stable spawn id). The dress is a
              // WILD-road fact: her companions are not
              // dressed (the module frames feral as the
              // wild road's category), and the cat is
              // exempt entirely — the module's own law:
              // the feral distinction does not reach her.
              animal.cat || animal.companion || !isFeral(animal.id)
                ? animal
                : {
                    ...animal,
                    name: `Feral ${animal.kind.charAt(0).toUpperCase()}${animal.kind.slice(1)}`,
                  },
            );
            // THE GUIDE RAVEN (tag claim; the raven's
            // name, 2026-11-03): Background's seat
            // snapshot joins the feed as a SINGULAR
            // entry — the tag reads 'Raven' (Adam's
            // word; the engine kind stays 'crow') on
            // its own pill, never competing for the
            // ambient nearest slot, projected at the
            // seat's live height (the bird's instance.y,
            // carried on the seat since Background's
            // rework). Visibility (perched / flying /
            // departing; surface only) is composed in
            // their layer; the shell only names it.
            const seat = guideTagSeat();
            return seat
              ? [
                  ...animals,
                  {
                    kind: 'crow' as const,
                    name: 'Raven',
                    x: seat.x,
                    z: seat.z,
                    y: seat.y,
                    singular: true as const,
                  },
                ]
              : animals;
          }}
          getPlayerPos={() => {
            const player = playerRef.current;
            return player ? { x: player.x, z: player.z } : { x: 0, z: 0 };
          }}
          project={(x, z, worldY) =>
            projectAnchor(x, z, 'scatter', worldY)
          }
        />
      ) : null}
      {/* NAMED-PLACE TAGS (the naming build, 2026-11-05):
        her named places tag in the world, under the
        creature tag's gate and hiding set — Background's
        feed (getNamedPlaceTags) owns the range and the
        dimension law; the component polls it and stands
        a pill per place, the name verbatim. */}
      {!inventoryOpen &&
      !craftingOpen &&
      !charmsOpen &&
      !companionsOpen &&
      !optionsOpen &&
      !introOpen &&
      !pendingTrapRecipe &&
      pendingRemoveTarget === null &&
      !paused ? (
        <PlaceTag theme={lookThemes.world}
          getPlaces={() =>
            rendererRef.current?.getNamedPlaceTags() ?? []
          }
          project={(x, z, worldY) =>
            projectAnchor(x, z, 'scatter', worldY)
          }
        />
      ) : null}



      {/* THE LOST-GRAPHICS NOTE (see the state above):
        a plain standing line while the context is
        lost — over the white canvas, under the
        dialogs, never a surface (pointer-events
        none): the world is still running beneath it. */}
      {contextLost ? (
        <div className="pointer-events-none fixed inset-x-0 top-14 z-[55] flex justify-center px-4">
          <p
            role="status"
            className="max-w-md rounded-xl bg-black/70 px-4 py-3 text-center text-sm leading-relaxed text-stone-200"
          >
            Graphics lost — the world is still running and your
            progress is safe. It usually comes back on its own;
            if it doesn’t, reloading the page is safe.
          </p>
        </div>
      ) : null}

      {/* Paused control: only while the engine flag is set. It
        renders regardless of panels (a global state control,
        not a panel). The whole veil is the resume surface
        (click anywhere resumes, Adam 2026-10-29 — the
        tap-to-resume pin, widened from the button to the
        veil); the component owns the surface. */}
      {paused ? (
        <PausedIndicator
          onResume={() => {
            // Unpause FIRST, then re-lock in the same click
            // (Adam, live on #24: the veil click unpaused
            // but left the cursor free — 'a second canvas
            // click should be unnecessary'). The seam
            // decides by mode (first-person + no lock held
            // only; every other state no-ops) and swallows
            // refusal silently, so the call is
            // unconditional here.
            pauseState.setPaused(false);
            playerRef.current?.requestResumeLock();
          }}
          showKeyHint={!isTouch}
        />
      ) : null}

      {/* Wake notice: transient, screen-level, after a
        completed sleep (see the consumer beside
        handleSleep). Renders nothing when no note. */}
      <WakeNotice text={wakeNote} />

      {/* Camera transition overlay (vignette at rest, fade on switch). */}
      <CameraTransition switching={switching} />
    </div>
  );
}
