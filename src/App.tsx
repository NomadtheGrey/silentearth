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
 *   'harvest:progress' fractions as carried. Nothing here
 *   invents a yield, a reason, or a progress value.
 * - Station presence: crafting checks the real presence query
 *   (stationPresence on the current generator at her position,
 *   carrying BOTH booleans: stump in range = workstation,
 *   placed loom in range = loom). Craftability ORs over
 *   every present station and execution takes the whole
 *   array, so a stump beside a loom serves both ladders at
 *   once; the menu names the nearby stations. No placeholder
 *   stations are invented, and other stations (wheel, kiln,
 *   hearth) correctly stay unavailable until they exist. The
 *   raw generator is used because stumps are never depleted,
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
 *   marks the plant removed permanently. The button renders on
 *   every scatter target (removability is outcome-time: plant-
 *   like sources only, so a remove press on a log, stone, bone,
 *   salt, silt, or anchor returns an honest 'not-removable'
 *   failure through the existing feedback path); ground targets
 *   never get one. The "Remove" label is the lane's pick,
 *   flagged, not pinned. Feedback for a remove completion shows
 *   the yields exactly as carried, like any harvest.
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
 *   fire item (campfire / hearth / kiln / bloomery, crafted
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
 *   hearth/kiln/bloomery keep the flow above. Every placed
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
 *   FireState per placed fire; engine lit is the gate —
 *   the shell mirrors engine lighting into the vessel
 *   (light() at lighting start, tick(1) on the game clock)
 *   and completes it when the engine reports lit or Cook
 *   is pressed, so cook() never runs against a vessel the
 *   engine hasn't lit. COST ASYMMETRY, FLAGGED: Systems'
 *   slow method consumes 1 dry-kindling, but engine
 *   friction charges nothing — the mirror charges kindling
 *   only when dry-kindling is carried (named in the friction
 *   menu hint), engine lighting proceeds regardless, and a
 *   kindling-less friction fire cooks once kindling is
 *   carried and Cook is pressed (the press retries and
 *   says so when it still can't). Cooking stays open-fire
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
 *   gains one umbrella rain note line (WornList umbrellaNote,
 *   under the protection + capacity notes), shown only while
 *   an umbrella is carried, with its number from Systems'
 *   single constant (60% precipitation, a starting value
 *   for Adam's pin pass, not pinned — revised from 35%
 *   rain-only) — the UI holds no rain table of its own.
 *   No separate umbrella panel is built, per the brief;
 *   the icon and the note ride existing surfaces.
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
 *   second, never per frame; hidden-tab samples dropped),
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
 *   the header follows the kind per StationPanel's map.
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
 *   sections keep everything visible). 38 recipes, 6 groups
 *   in this order — Tools, Homes, Fire & Workshop, Clothes,
 *   Materials & Carrying, Traps — order within a group is the
 *   current recipe order, empty groups never render.
 *   CraftingMenu gains an optional `sections` prop (flat list
 *   unchanged when absent; one shared row renderer, so
 *   grouping changes layout only); App owns the UI-side
 *   id→group map — no Systems file touch, no recipe field,
 *   canCraft/execution untouched. Unmapped recipes would
 *   trail under "Other" rather than vanish (none today).
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
 *   time-only, no restore. Outcomes 'sleep:completed' /
 *   'sleep:failed' need no UI action (the dawn jump hides
 *   the button via the night gate; failures show nothing
 *   per the brief's no-invented-text rule). REPAIR NOTE:
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
 *   pattern, heavy for a torch); the panel stays open,
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
 *   INSTANTLY AT HER FEET — torch precedent, not the
 *   house/fire preview flow. Grant FIRST (Systems
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
 *   wired, display live).
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
import { pileState, type PileTarget } from './game/pileState';
import { HARVEST_RANGE } from './game/proximity';
import { trapState, type PlacedTrap } from './game/trapState';
import { stumpState, type StumpAddition } from './game/stumpState';
import { TRAP_DEFS } from './game/traps';
import { biomePresentKinds } from './game/animals';
import {
  collectTrapCatch,
  catchItemFor,
  eligibleKindsFor,
  resolveTrapHour,
} from './systems/trap-catch';
import type { TrapType } from './game/traps';
import { placeTent, pickupTent } from './systems/camping';
import { harvestHoney } from './systems/honey';
import { harvestState } from './game/harvestState';
import { SOURCE_BY_ID, type ToolTier } from './game/objects';
import type { FireType } from './game/fire';
import { FLINT_CLICKS, FRICTION_WAIT_MS } from './game/fire';
import {
  shelterState,
  shelterAt,
  HOUSE_DEFS,
  HOUSE_LADDER,
  SHELTER_RADIUS,
  type HouseType,
} from './game/shelter';
import {
  evaluateCampReveal,
  isNearStillWater,
  nearestStillWater,
  findCamps,
  CampDivination,
} from './systems/divination';
import { stillWatersNear } from './game/waterProximity';
import { NameSight } from './systems/name-sight';
import { portionsForKind, lookKeyForTarget } from './ui/lookPortions';
import { cycleSplit, cyclePhase, currentMoonPhase } from './game/sky';
import { createSleepListener } from './game/sleep';
import {
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
  UMBRELLA_PRECIPITATION_PROTECTION,
} from './systems/umbrella';
import { HudShell } from './ui/HudShell';
import { WitchHealth } from './ui/WitchHealth';
import { HungerIndicator } from './ui/HungerIndicator';
import { ForageHint } from './ui/ForageHint';
import { ShelteredIndicator } from './ui/ShelteredIndicator';
import { StationPanel } from './ui/StationPanel';
import { WornList, type WornGarment } from './ui/WornList';
import { UmbrellaIcon } from './ui/UmbrellaIcon';
import { FireState, type FireChipStatus } from './ui/FireState';
import { PlacementPreview } from './ui/PlacementPreview';
import { ContextMenu } from './ui/ContextMenu';
import { PileInventoryModal } from './ui/PileInventoryModal';
import { PileChip } from './ui/PileChip';
import { TorchChip } from './ui/TorchChip';
import { TentChip } from './ui/TentChip';
import { FirstRunDialog } from './ui/FirstRunDialog';
import { AnimalTag } from './ui/AnimalTag';
import { AltarChip } from './ui/AltarChip';
import type { ContextAction } from './ui/types';
import { TouchControls } from './ui/TouchControls';
import { LocationChip } from './ui/LocationChip';
import { ScryButton } from './ui/ScryButton';
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
import { RemoveConfirm } from './ui/RemoveConfirm';
import { InventoryPanel } from './ui/InventoryPanel';
import { CraftingMenu } from './ui/CraftingMenu';
import { ProximityHarvestButtons } from './ui/ProximityHarvestButtons';
import { InteractionProgress } from './ui/InteractionProgress';
import { ObjectFeedback } from './ui/ObjectFeedback';
import { WorldAnchor } from './ui/WorldAnchor';
import { KEY_BADGE_CLASS, LOOK_THEMES, UI_THEMES } from './ui/themes';
import { CameraTransition } from './ui/CameraTransition';
import { CAMERA_TRANSITION } from './ui/cameraPresentation';
import { projectWorldToScreen } from './ui/worldProjection';
import type { HarvestTarget, HarvestRequest } from './ui/proximityHarvest';
import { removeRequestFor } from './ui/proximityHarvest';
import type {
  InventoryItem,
  CraftingRecipe,
  FeedbackTone,
} from './ui/types';
import {
  PersonalInventory,
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
import { executeCraft } from './systems/crafting-execution';
import {
  HungerState,
  eat,
  needsCooking,
  FOOD_ACORNS,
  FOOD_ITEMS,
  COOK_REQUIRED_ITEMS,
  type HungerStage,
} from './systems/hunger';
import { FireState as SystemsFireState, cook } from './systems/fire';
import { HomeStorage } from './systems/shelter';
import {
  clearSave,
  loadSave,
  saveGame,
  serializeSave,
  type SaveData,
} from './systems/save';
import {
  CLOUD_BASE_URL,
  bringHere,
  deleteCloudSave,
  enterWords,
  generateWords,
  getCloudSave,
  getWords,
  isCloudEnabled,
  listCloudSaves,
  mirrorSave,
  parkLocal,
  readParked,
  syncState,
  turnOff,
  turnOn,
} from './systems/cloudSaves';
import {
  type CloudParkedSave,
  type CloudSaveRow,
} from './ui/CloudSavePanel';
import {
  clothingRemaining,
  stormApproaching,
  SEASON_START_MONTH,
} from './game/weather';
import {
  ownedStage,
  ownedTier,
  ownedToolItem,
  type OwnedToolItem,
} from './systems/owned-tool';
import {
  evaluateQuests,
  emptyQuestFlags,
  type QuestFlags,
} from './systems/quests';
import { canCraft, CRAFT_OWNERSHIP_LABELS } from './systems/crafting';
import {
  ITEMS,
  RECIPES,
  type CraftingStation,
  type ItemId,
} from './systems/recipes';
import { torchState, type PlacedTorch as PlacedTorchEntity } from './game/torchState';
import { lightTorches, placeTorch as grantPlaceTorch, pickupTorch as grantPickupTorch } from './systems/torch';
import { altarState, type PlacedAltar as PlacedAltarEntity } from './game/altarState';
import { placeAltar as grantPlaceAltar } from './systems/altar';
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
  CharmState,
  GroundhogRest,
  WeatherWarning,
  bearCapacityBonusLb,
  grantFirstCharm,
  groundhogWakeBonus,
  listCharms,
  mouseStorageBonus,
  snakeDrainFactor,
  boneNote,
  boneKindFor,
  isBoneItem,
  recordBonePickupLook,
  HungerWarning,
  crowGlowTier,
  FIRST_CHARM_KIND,
  FIRST_CHARM_EFFECT,
} from './systems/charms';
import { crowPileArrow, type CrowTier } from './game/crow';
import { CrowArrows } from './ui/CrowArrows';
import { RitualPanel } from './ui/RitualPanel';
import { CharmsPanel } from './ui/CharmsPanel';
import { StormWarning } from './ui/StormWarning';

type BusHarvestTarget = EventMap['harvest:inRange']['targets'][number];

/** One feedback chip, positioned by the same projection as buttons. */
interface FeedbackItem {
  id: string;
  text: string;
  tone: FeedbackTone;
  x: number;
  y: number;
}

/** One in-progress multi-step harvest, anchored at its object. */
interface ProgressItem {
  targetId: string;
  fraction: number;
  label: string;
  x: number;
  y: number;
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
  [ITEMS.kiln]: 'kiln',
  [ITEMS.bloomery]: 'bloomery',
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
 * Lit torches, altars, and campfires ride this set for the
 * BUTTON only — their handlers branch to instant-at-feet
 * (see handlePlaceItem), never the preview-ghost flow the
 * other ids (hearth/kiln/bloomery/houses/looms) use. */
const PLACEABLE_IDS: ReadonlySet<string> = new Set([
  ...Object.keys(FIRE_ITEM_TO_TYPE),
  ...Object.keys(HOUSE_ITEM_TO_TYPE),
  ITEMS.loom,
  ITEMS.litTorch,
  ITEMS.altar,
  ITEMS.tent,
]);

const FIRE_NAME: Record<FireType, string> = {
  campfire: 'Campfire',
  hearth: 'Hearth',
  kiln: 'Kiln',
  bloomery: 'Bloomery',
};

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
};

/**
 * CRAFTING GROUPS (Adam, 2026-10-26 — "group the crafted items
 * on the crafting screen"): SECTIONS in one scroll, NOT tabs —
 * the phone sheet already scrolls, sections keep everything
 * visible, tabs would hide recipes behind extra taps. UI-side
 * id→group map (no Systems file touch, no recipe field added;
 * a recipe field later is trivial if Adam wants it). Keys are
 * recipe.id strings, verified against RECIPES at build time.
 * Order within a group is the current recipe order (the shell
 * filters, never re-sorts); a group with no recipes never
 * renders. A recipe with no mapping falls into a trailing
 * "Other" section rather than vanishing.
 */
const CRAFTING_GROUP_ORDER = [
  'Tools',
  'Homes',
  'Fire & Workshop',
  'Clothes',
  'Materials & Carrying',
  'Traps',
];
const CRAFTING_GROUP_BY_RECIPE_ID: Record<string, string> = {
  'garden-trowel': 'Tools',
  'sharp-trowel': 'Tools',
  spade: 'Tools',
  'axe-trowel': 'Tools',
  'spade-axe': 'Tools',
  'trundle-tool': 'Tools',
  'primitive-lean-to': 'Homes',
  'thatch-hut': 'Homes',
  'wattle-and-daub-hut': 'Homes',
  'woven-cottage-prototype': 'Homes',
  'woven-cottage': 'Homes',
  'small-wooden-hut': 'Homes',
  'moss-cradle': 'Homes',
  campfire: 'Fire & Workshop',
  hearth: 'Fire & Workshop',
  kiln: 'Fire & Workshop',
  bloomery: 'Fire & Workshop',
  'stumpy-workstation': 'Fire & Workshop',
  'crafted-workstation': 'Fire & Workshop',
  'potters-wheel': 'Fire & Workshop',
  loom: 'Fire & Workshop',
  'hooded-cloak': 'Clothes',
  shawl: 'Clothes',
  'pointy-hat': 'Clothes',
  'mossy-mittens': 'Clothes',
  'bog-boots': 'Clothes',
  apron: 'Clothes',
  umbrella: 'Clothes',
  'twined-cordage': 'Materials & Carrying',
  'clay-pot': 'Materials & Carrying',
  'clay-brick': 'Materials & Carrying',
  'small-basket': 'Materials & Carrying',
  'large-basket': 'Materials & Carrying',
  snare: 'Traps',
  'fish-weir-trap': 'Traps',
  'pot-trap': 'Traps',
  pitfall: 'Traps',
  deadfall: 'Traps',
};

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

/** Engine house type → Systems house item (for HomeStorage). */
const HOUSE_TYPE_TO_ITEM: Record<HouseType, string> = {
  leanTo: ITEMS.primitiveLeanTo,
  thatchHut: ITEMS.thatchHut,
  wovenCottage: ITEMS.wovenCottage,
  smallWoodenHut: ITEMS.smallWoodenHut,
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
 * One inventory row's weight line (weight display, Adam
 * 2026-10-27). Excluded rows never show a counting number, or
 * the row would contradict the header total (which already
 * excludes them): carrying gear and worn garments exclude the
 * whole stack, and the owned tool excludes exactly one unit —
 * Systems' usedLb rule, mirrored here for display only
 * (Systems owns the math; this never recomputes the total).
 * Normal rows show per-item weight, plus the stack total when
 * the count is above one ("0.5 lb each · 1.5 lb").
 */
function weightTextFor(
  item: string,
  quantity: number,
  inventory: PersonalInventory,
): string {
  const id = item as ItemId;
  if (isCarryingGear(id) || inventory.wornItems().includes(id)) {
    return 'carried free';
  }
  const owned = ownedToolItem(inventory);
  if (id === owned) {
    if (quantity <= 1) return 'carried free';
    return `${formatLb((quantity - 1) * weightOf(id))} lb · 1 carried free`;
  }
  const each = weightOf(id);
  if (quantity <= 1) return `${formatLb(each)} lb`;
  return `${formatLb(each)} lb each · ${formatLb(quantity * each)} lb`;
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
    quantityText: String(stack.quantity),
    weightText: weightTextFor(stack.item, stack.quantity, inventory),
    icon: stack.item === UMBRELLA_ITEM_ID ? <UmbrellaIcon /> : undefined,
    // Bone rows (individual-bone build, 2026-10-28):
    // every carried primal bone reads its note from
    // Systems' boneNote — raw: 'Needs a ritual site';
    // awakened: 'Tier <n> · <effect phrase>' (tier from
    // the awakening record, so tier-ups flow through;
    // phrase fallback 'Awakened' for a kind without a
    // drafted phrase). This SUPERSEDES the tier-1
    // Waking build's first-charm note (which computed
    // 'Stirs at hunger 45; drains 10% slower' from the
    // DRAFT constants): Systems' boneNote is now the
    // canonical note, and shrew's phrase ('Stirs when
    // hunger falls, warning before the slowdown; small
    // hunger bonus while carried') is Systems' adopted
    // draft shape — the numbers no longer render.
    // Phrases are DRAFT (bone-charms doc, not pins),
    // flagged for Adam's pin pass. Non-bone stacks
    // keep no note.
    //
    // BAG ROW (tent shell, 2026-10-28): the sleeping
    // bag's row carries its category as its note —
    // 'Bedding' (PROPOSED copy). The bag is carried
    // passive bedding (umbrella precedent: no equip,
    // no use-action), and this note is its V1 marker —
    // the fiction that she carries bedding, visible
    // wherever the inventory shows. No number attaches
    // (no cold/exposure-during-sleep model exists yet).
    note: (() => {
      if (stack.item === ITEMS.sleepingBag) return 'Bedding';
      const kind = boneKindFor(normalizeItemId(stack.item));
      return kind === null ? undefined : boneNote(kind, charms);
    })(),
  };
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
  // outcomes 'sleep:completed'/'sleep:failed' need no UI
  // action — the dawn jump disables the row via the night
  // gate, and failures show nothing per the brief's
  // no-invented-text rule. Daytime shows the row disabled
  // with a "Night only" note; the menu stays open after
  // a Rest press.
  const handleSleep = (): void => {
    const player = playerRef.current;
    if (!player) return;
    bus.emit('sleep:requested', { x: player.x, z: player.z });
  };

  // Gap-closing state (see the header): one Systems FireState
  // per placed fire (the cooking vessel), the engine lighting
  // path per fire (for the bridge's method mapping), and one
  // HomeStorage per placed house, with the item ids it has ever
  // held (HomeStorage exposes counts, not a snapshot, so the
  // shell tracks the id universe; counts stay Systems').
  const systemsFiresRef = useRef(new Map<string, SystemsFireState>());
  const engineFirePathRef = useRef(
    new Map<string, 'flint' | 'friction'>(),
  );
  const homeStoresRef = useRef(new Map<string, HomeStorage>());
  const homeStoreItemsRef = useRef(new Map<string, Set<string>>());
  const [eatNote, setEatNote] = useState<string | null>(null);
  const [torchNote, setTorchNote] = useState<string | null>(null);
  const [tentNote, setTentNote] = useState<string | null>(null);
  const [altarNote, setAltarNote] = useState<string | null>(null);
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
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [charmsOpen, setCharmsOpen] = useState(false);
  const [selectedCharmKind, setSelectedCharmKind] = useState<string | null>(
    null,
  );
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
  // computations before return + pileMenuActions /
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
  // Harvest outcome feedback + multi-step progress, rendered
  // through WorldAnchor + ObjectFeedback / InteractionProgress.
  // Populated only by the outcome events (see the header) — never
  // by invented yields or progress.
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);

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
  // Campfire tap (Adam, 2026-10-28): the pending pointerdown
  // for tap-near-fire (touch-only, container handlers below).
  // A ref, not state — a tap must not re-render on press.
  const fireTapRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  // Placed torches (Background singleton, read fresh on every
  // event), their projected anchors, and the torch whose menu
  // is open — the fire-chip pattern, one torch per chip. The
  // menu is LIVE like the fire menu: selectedTorchId names
  // the torch, and the menu renders from the live torch in
  // placedTorches; a picked-up torch closes it (the find
  // returns undefined, and the handler closes explicitly).
  const [placedTorches, setPlacedTorches] = useState<PlacedTorchEntity[]>(
    () => torchState.snapshot(),
  );
  const [torchAnchors, setTorchAnchors] = useState<
    { torch: PlacedTorchEntity; x: number; y: number }[]
  >([]);
  const [selectedTorchId, setSelectedTorchId] = useState<string | null>(null);
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
  // The ritual site whose panel is open, by SITE ID
  // ('altar:<n>' or 'stump:x,z' — one selection for
  // both site kinds since the bone build; the panel +
  // derivation are site-kind-agnostic, only the label
  // and anchor source differ). Renamed from
  // selectedAltarId when stump sites gained panels.
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
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
    // This is the switch the shrew build staged: the
    // interim main-inventory count is gone (the shrew
    // item no longer sits in main inventory — the
    // save migration drops it on load, and the grant
    // records no item). Deliberately NOT
    // shrewEffectActive(inventory, charms): the landed
    // helper reads the main inventory directly, which
    // goes wrong once the list lands (list charms are
    // not inventory stacks) — DEV blessed leaving it
    // unused, and Systems noted it UNUSED pending a
    // signature change to a shell-supplied boolean.
    const shrewCarried = charmStateRef.current.isAwakened(FIRST_CHARM_KIND);
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
        groundhogRestRef.current.restedDrainFactor(),
    );
  };
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
      charmStateRef.current.isAwakened('deer-antler-tip'),
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
  // the ONLY list-change paths — boot (after restore +
  // grant) and ritual completion (after awaken) — no
  // timer: hook booleans change only on awakening.
  // Pigeon always-on: the renderer ORs scry + pigeon
  // (arrowsVisible), so the arrival-dismiss path clears
  // only the scry flag — pigeon arrows stay while the
  // charm is listed, by design (effects are always on).
  // Fox reaches the player controller (nullable ref);
  // mole is a module-level setter; the three vision
  // hooks reach the renderer (nullable ref).
  const syncCharmHooks = () => {
    const charms = charmStateRef.current;
    rendererRef.current?.setPigeonWayHome(
      charms.isAwakened('pigeon-wing-bone'),
    );
    rendererRef.current?.setOwlNightSight(charms.isAwakened('owl-talon'));
    rendererRef.current?.setBatNightWayfinding(
      charms.isAwakened('bat-wing-bone'),
    );
    playerRef.current?.setSwiftStep(charms.isAwakened('fox-femur'));
    setMoleEarthSense(charms.isAwakened('mole-paw'));
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
  const [scryVisible, setScryVisible] = useState(false);
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
  const selectedPileIdRef = useRef<string | null>(null);
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

  const busTargetsRef = useRef<BusHarvestTarget[]>([]);
  const transitionTimerRef = useRef<number | undefined>(undefined);
  const feedbackCounterRef = useRef(0);
  const feedbackTimersRef = useRef<Map<string, number>>(new Map());

  // PAUSE (Adam, 2026-10-26 — core 54e525c): the engine pause
  // flag, mirrored for the shell. The ref is what the timers
  // read (intervals/rAF loops close over it, never over state);
  // the state drives the Paused indicator. The flag is SET by
  // the trigger effect below (blur / hidden) and CLEARED only
  // by the indicator's tap (tap-to-resume, pinned) — nothing
  // here auto-resumes on focus return.
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  const refreshInventory = () => {
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
  const saveNow = () => {
    try {
      const meta = saveMetaRef.current;
      const player = playerRef.current;
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
          })),
          // PILE SAVE WIRING (multi-kind, 2026-10-27): the
          // live pile set rides every save as stacks +
          // position (no id in the document — boot restore
          // derives it from coords; serializeSave writes
          // stacks normalized, order preserved, never
          // merged). The legacy first-kind-only map is
          // gone: it lost non-first kinds across a save.
          piles: pileState.snapshot().map((pile) => ({
            stacks: pile.stacks.map((stack) => ({
              item: stack.item,
              quantity: stack.quantity,
            })),
            x: pile.x,
            z: pile.z,
          })),
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
          // STUMP SAVE WIRING (stumpy shell, 2026-10-28):
          // the live stump-addition set rides every save
          // (snapshot as-is — site ids + coords + additions
          // verbatim; serializeSave writes them verbatim
          // and stumpState.restore() validates on load).
          // Without this, upgrades vanish on reload.
          stumps: stumpState.snapshot(),
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
          // RITUAL SAVE WIRING: stagings + awakenings ride
          // every save as-is (StagingBook / CharmState
          // snapshots; serialize writes them verbatim,
          // restore validates on load and drops bad
          // entries). Staged rituals + awakenings survive
          // refresh.
          stagings: stagingBookRef.current.snapshot(),
          awakenings: charmStateRef.current.snapshot(),
          // QUEST SAVE WIRING: the live quest flags ride every
          // save (all-false serializes as all-false; absent on
          // old saves reads as all-false on load). Flags are
          // set by the wiring follow-up; the tab only reads.
          quests: { ...questFlagsRef.current },
          // LOOK SAVE WIRING: the live look counts ride
          // every save (snapshot as-is, first-look order;
          // serialize writes them verbatim, restore
          // validates on load). Knowledge survives refresh.
          nameSight: nameSightRef.current.snapshot(),
          // WORLD-STATE SAVE WIRING: harvest state, sky
          // cycle, and facing ride every save (all three
          // draft fields optional — serialize defaults
          // missing ones; the sky reads the live renderer,
          // null when the rig is gone).
          harvestState: harvestState.snapshot(),
          sky: rendererRef.current?.snapshotSky() ?? undefined,
          facing: player ? player.snapshotFacing() : undefined,
        });
      saveGame(data);
      // CLOUD MIRROR (Adam, 2026-10-29): after the local
      // write succeeds, mirror to the cloud. Fire-and-
      // forget: mirrorSave never throws and no-ops when
      // cloud is off, so a failed mirror never breaks
      // play (the sync note records it for the panel).
      void mirrorSave(CLOUD_BASE_URL, data);
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
  } | null>(null);
  const [cloudPendingRemove, setCloudPendingRemove] = useState<{
    slot: string;
    row: CloudSaveRow;
  } | null>(null);
  const [cloudPendingRestore, setCloudPendingRestore] =
    useState<SaveData | null>(null);
  const [cloudPendingNewGame, setCloudPendingNewGame] = useState<{
    local: SaveData;
    parked: SaveData | null;
  } | null>(null);

  const refreshCloudState = () => {
    setCloudSync(syncState());
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

  const refreshCloudList = async () => {
    const words = getWords();
    if (!isCloudEnabled() || words === null) {
      setCloudSaves([]);
      return;
    }
    setCloudBusy(true);
    try {
      const listed = await listCloudSaves(CLOUD_BASE_URL, words);
      if (listed.ok === false) {
        setCloudNote(listed.reason);
        setCloudSaves([]);
        return;
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
      setCloudSaves(rows);
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
    // Reveal only: no module call until words are chosen
    // (opt-in completes via turnOn/enterWords).
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

  const runCloudBring = async (slot: string) => {
    const words = getWords();
    if (words === null) {
      setCloudNote('No cloud words on this device.');
      return;
    }
    setCloudBusy(true);
    try {
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
      // brought save.
      window.location.reload();
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudBringHere = (slot: string) => {
    // Nothing displaced, nothing to confirm or park.
    const current = loadSave();
    if (current === null) {
      void runCloudBring(slot);
      return;
    }
    setCloudPendingBring({
      slot,
      local: current,
      parked: readParked(),
    });
  };

  const confirmCloudBring = () => {
    const pending = cloudPendingBring;
    setCloudPendingBring(null);
    if (pending !== null) void runCloudBring(pending.slot);
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
    // Same install shape as bring-down: write + fresh boot.
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

  const confirmNewGame = () => {
    setCloudPendingNewGame(null);
    // runNewGame re-reads loadSave() at run time (the
    // bring/restore freshness pattern), so what parks is
    // the last saved state, not the press-time snapshot.
    runNewGame();
  };

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
    onRemove: (slot: string) => {
      const row = cloudSaves.find((candidate) => candidate.slot === slot);
      if (row !== undefined) setCloudPendingRemove({ slot, row });
    },
    onRestoreParked: () => {
      const parked = readParked();
      if (parked !== null) setCloudPendingRestore(parked);
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
  ): { x: number; y: number } | null => {
    const player = playerRef.current;
    const container = containerRef.current;
    if (!player || !container) return null;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return null;
    const point = projectWorldToScreen({
      worldX: x,
      worldY: kind === 'ground' ? 0 : 1,
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
    const altars: { altar: PlacedAltarEntity; x: number; y: number }[] = [];
    for (const altar of altarState.snapshot()) {
      const anchor = projectAnchor(altar.x, altar.z, 'scatter');
      if (!anchor) continue;
      altars.push({ altar, x: anchor.x, y: anchor.y });
    }
    setAltarAnchors(altars);
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
    const mode = placementRef.current;
    if (mode) {
      const player = playerRef.current;
      setPlacementAnchor(
        player ? projectAnchor(player.x, player.z, 'ground') : null,
      );
    } else {
      setPlacementAnchor(null);
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
  const showFeedback = (text: string, tone: FeedbackTone, x: number, y: number) => {
    const id = `fb-${feedbackCounterRef.current++}`;
    setFeedbacks((current) => [...current, { id, text, tone, x, y }]);
    const timer = window.setTimeout(() => {
      setFeedbacks((current) => current.filter((item) => item.id !== id));
      feedbackTimersRef.current.delete(id);
    }, 4000);
    feedbackTimersRef.current.set(id, timer);
  };

  // Anchor for an outcome event: the target's last known position
  // when it is still in range, else her own position (e.g. a failed
  // press on a target that already left range).
  const anchorForOutcome = (
    targetId: string,
    kind: 'scatter' | 'ground',
  ): { x: number; y: number } | null => {
    const target = busTargetsRef.current.find((t) => t.id === targetId);
    if (target) {
      return projectAnchor(target.x, target.z, target.kind);
    }
    const player = playerRef.current;
    if (!player) return null;
    return projectAnchor(player.x, player.z, kind);
  };

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
            })),
        );
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
        // follow-up; the tab only reads.
        const questFlagsInit = {
          ...emptyQuestFlags(),
          ...bootSaved.quests,
        };
        questFlagsRef.current = questFlagsInit;
        setQuestFlags(questFlagsInit);
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
        // LOOK SAVE WIRING (same pre-construction pattern):
        // nameSight.restore() is silent and replaces; the
        // shell's NameSight starts empty, so a second
        // boot-effect run cannot re-restore over gameplay
        // looks (guarded by the same check as traps).
        nameSightRef.current.restore(bootSaved.nameSight ?? []);
      }
    }
    const renderer = new WorldRenderer(container, gen, player);
    player.attach(renderer.domElement);
    rendererRef.current = renderer;
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
        for (const house of saved.houses) {
          try {
            const placed = shelterState.placeHouse(
              house.type as HouseType,
              house.x,
              house.z,
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
            loomState.placeLoom(loom.x, loom.z);
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
    // FIRST-CHARM BOOT GRANT (outright, tier 1,
    // GRANT-TO-LIST since Systems 9e9a9dd): runs
    // AFTER the CharmState restore above, so a loaded
    // awakening is never double-granted. Idempotent — a
    // fresh save gains the shrew charm IN THE LIST; a
    // loaded save with the awakening gains nothing.
    // NO item is granted (no full-pack failure mode —
    // the old addPartial gate is gone with the item),
    // so a grant refreshes nothing in main inventory:
    // it saves at once (the awakening is save data)
    // and the panel reads the list live on open. The
    // inventory param is LEGACY, IGNORED by Systems
    // (void inventory) — still passed because the
    // signature keeps it; its removal rides a Systems
    // change, flagged to DEV (UI does not edit
    // Systems files unclaimed).
    const firstCharmGrant = grantFirstCharm(
      inventory,
      charmStateRef.current,
    );
    if (firstCharmGrant.granted > 0) {
      saveNow();
    }
    // Shrew effect boot sync (follow-up call path):
    // runs whether or not the grant fired — a loaded
    // save with the shrew in its list needs its 0.9
    // multiplier from boot (multiplier is session
    // state, never saved), and a boot hunger below 45
    // while listed fires the latch fresh (she IS in
    // the warning zone). No refreshInventory runs on
    // the grant path anymore (grant-to-list grants no
    // item) — this call is the sync, not a duplicate.
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
      setScryVisible(
        !div.isRevealed &&
          houses.length > 0 &&
          isNearStillWater(x, z, waters),
      );
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
      const key = selectedPileIdRef.current;
      if (key && !inRange.some((pile) => pile.id === key)) {
        selectedPileIdRef.current = null;
        setSelectedPileId(null);
      }
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
        const anchor = projectAnchor(outcome.x, outcome.z, 'scatter');
        if (outcome.granted <= 0) {
          if (anchor) {
            showFeedback(
              `Pack full — no room.`,
              'blocked',
              anchor.x,
              anchor.y,
            );
          }
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
        if (anchor) {
          showFeedback(
            `Picked up ${outcome.taken
              .map((t) => `${t.granted} ${displayNameFor(t.item)}`)
              .join(', ')}.`,
            'gain',
            anchor.x,
            anchor.y,
          );
        }
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
      // Hunger changed: latch update + drain multiplier
      // re-sync (the drain rate for the NEXT tick
      // follows the current carried/awakened state).
      syncShrewEffect();
      syncDeerWarning();
      fireState.advanceLighting(Date.now());
      // Drive every tracked Systems fire's lighting clock
      // alongside the engine's (the bridge's tick half).
      for (const systemsFire of systemsFiresRef.current.values()) {
        systemsFire.tick(1);
      }
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
    const offTrapCatch = bus.on('trap:catch', () => {
      refreshTrapsFromState();
      saveNow();
    });
    const offTrapPlaced = bus.on('trap:placed', () => {
      refreshTrapsFromState();
    });
    const offTrapHour = bus.on('trap:hour', () => {
      const gen = genRef.current;
      if (!gen) return;
      for (const trap of trapState.snapshot()) {
        if (trap.catch !== null) continue;
        const eligible = eligibleKindsFor(
          trap.type,
          biomePresentKinds((x, z) => gen.weightsAt(x, z), trap.x, trap.z),
        );
        const outcome = resolveTrapHour(eligible, trap.baited);
        if (outcome.caught) {
          trapState.setCatch(trap.id, outcome.kind);
        }
      }
    });
    const offFireLit = bus.on('fire:lit', refreshFires);
    const offTorchPlaced = bus.on('torch:placed', refreshTorches);
    const offTorchRemoved = bus.on('torch:removed', refreshTorches);
    const offAltarPlaced = bus.on('altar:placed', refreshAltars);
    const offAltarRemoved = bus.on('altar:removed', refreshAltars);
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
      setProgressItems((current) =>
        current.filter((item) => item.targetId !== p.targetId),
      );
      const anchor = anchorForOutcome(p.targetId, p.kind);
      if (anchor) {
        showFeedback(
          p.yields.map((y) => `${y.item} × ${y.quantity}`).join(', '),
          'gain',
          anchor.x,
          anchor.y,
        );
      }
    });
    const offFailed = bus.on('harvest:failed', (p) => {
      setProgressItems((current) =>
        current.filter((item) => item.targetId !== p.targetId),
      );
      const anchor = anchorForOutcome(p.targetId, p.kind);
      if (!anchor) return;
      const text =
        p.reason === 'inventory-full' && p.yields.length > 0
          ? `Pack full — ${p.yields.map((y) => `${y.item} × ${y.quantity}`).join(', ')} didn't fit.`
          : p.reason === 'below-permit'
            ? belowPermitText(p.sourceId)
            : `Harvest failed: ${p.reason}.`;
      showFeedback(text, 'blocked', anchor.x, anchor.y);
    });
    const offProgress = bus.on('harvest:progress', (p) => {
      const target = busTargetsRef.current.find(
        (t) => t.id === p.targetId,
      );
      const anchor = target
        ? projectAnchor(target.x, target.z, target.kind)
        : null;
      if (!anchor) return;
      setProgressItems((current) => {
        const rest = current.filter(
          (item) => item.targetId !== p.targetId,
        );
        return [
          ...rest,
          {
            targetId: p.targetId,
            fraction: p.progress,
            label: target.name,
            x: anchor.x,
            y: anchor.y,
          },
        ];
      });
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
      for (const timeout of feedbackTimersRef.current.values()) {
        window.clearTimeout(timeout);
      }
      feedbackTimersRef.current.clear();
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
      offTrapCatch();
      offTrapPlaced();
      offTrapHour();
      offFireLit();
      offTorchPlaced();
      offTorchRemoved();
      offAltarPlaced();
      offAltarRemoved();
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

  // Station presence from the real query at her position
  // (see the header): stump in range = workstation, placed
  // loom in range = loom — BOTH booleans, not one context.
  // The old single-context mapping read 'loom' whenever a
  // loom was near, so workstation recipes mismatched at a
  // dual site until she stepped out of loom range (the
  // flagged wart). Craftability now ORs over every present
  // station (below), and execution takes the whole array
  // (executeCraft's StationInput is already set-based) —
  // so a stump beside a loom serves both ladders at once.
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
  const questDisplay = inventory
    ? evaluateQuests({
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
      }).map((quest) => ({
        ...quest,
        hint: QUEST_HINTS[quest.id] ?? '',
      }))
    : undefined;
  const availableStations: CraftingStation[] = [];
  if (stationPresenceValue.workstation) {
    availableStations.push('workstation');
  }
  if (stationPresenceValue.loom) {
    availableStations.push('loom');
  }
  // Header display names (stump-header fix, Adam-approved
  // 2026-10-28): ONLY the displayed string maps — the
  // 'workstation' context keeps its id in availableStations
  // for the canCraft checks below. Workstation presence
  // comes solely from stumps today, so "tree stump" is
  // truthful now; when presence learns kinds later, this
  // mapping follows the kind per StationPanel's map.
  const stationNote =
    availableStations.length === 0
      ? 'No station nearby'
      : `Nearby station${availableStations.length > 1 ? 's' : ''}: ${availableStations
          .map((station) =>
            station === 'workstation' ? 'tree stump' : station,
          )
          .join(', ')}`;

  const craftingRecipes: CraftingRecipe[] = RECIPES.map((recipe) => {
    // OR over every present station: a recipe is craftable
    // when ANY present station satisfies it. When none does,
    // prefer the check for a present station (ingredient /
    // requirement detail) over a mismatch note, so a dual
    // site never reports a present station as missing.
    const checks =
      availableStations.length > 0
        ? availableStations.map((s) => canCraft(recipe, inventory, s))
        : [canCraft(recipe, inventory, null)];
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
          : `Needs a ${check.requiredStation} station.`;
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
    // (disabledLabel set → note not rendered). No stump
    // in range → the station gate above already failed;
    // the override needs a target, so it does not fire.
    // Systems' canCraft is UNCHANGED — this is a shell
    // mapping override only.
    const stumpAlreadyWorkbench =
      recipe.upgradesStump === true &&
      nearestStump !== null &&
      stumpState.isWorkbench(nearestStump.x, nearestStump.z);
    return {
      id: recipe.id,
      name: recipe.name,
      description: `Makes ${recipe.output.quantity} × ${recipe.output.item}.`,
      ingredients: [
        ...recipe.ingredients.map((ingredient) => ({
          name: ingredient.item,
          amountText: `${inventory.count(ingredient.item)} / ${ingredient.quantity}`,
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
      availabilityNote,
      icon:
        recipe.output.item === UMBRELLA_ITEM_ID ? (
          <UmbrellaIcon />
        ) : undefined,
    };
  });

  // NO-RECRAFT ORDER (Adam, 2026-10-28): one stable
  // partition of the full list — available recipes first
  // in current order, owned/superseded last in current
  // order. The section filters below preserve relative
  // order, so this IS the per-section stable partition
  // (within-section only, no re-sort); section order +
  // accordion unchanged, and disabled rows stay visible
  // when their section is expanded (never hidden). The
  // flat menu prop rides the same order. Header counts
  // read canCraft, so an all-disabled section renders
  // "0 of N craftable" with its rows visible on expand.
  const orderedCraftingRecipes = [
    ...craftingRecipes.filter((recipe) => recipe.canCraft),
    ...craftingRecipes.filter((recipe) => !recipe.canCraft),
  ];

  // CRAFTING GROUPS: sections in DEV's group order, each filtered
  // from the recipe-ordered menu rows above (never re-sorted);
  // empty groups dropped here, and the menu drops them again
  // defensively. Unmapped recipes (none today — all 38 map)
  // trail under "Other" instead of vanishing.
  const ungroupedRecipes = orderedCraftingRecipes.filter(
    (recipe) => CRAFTING_GROUP_BY_RECIPE_ID[recipe.id] === undefined,
  );
  const craftingSections = [
    ...CRAFTING_GROUP_ORDER.map((title) => ({
      title,
      recipes: orderedCraftingRecipes.filter(
        (recipe) => CRAFTING_GROUP_BY_RECIPE_ID[recipe.id] === title,
      ),
    })).filter((section) => section.recipes.length > 0),
    ...(ungroupedRecipes.length > 0
      ? [{ title: 'Other', recipes: ungroupedRecipes }]
      : []),
  ];

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
  // PC-keys remove target (2026-10-28): the scatter target
  // Shift+E armed for the confirm dialog; null = no dialog.
  // The dialog owns its Enter/Esc; the App Esc listener
  // yields while it is open (single Esc path).
  const [pendingRemoveTarget, setPendingRemoveTarget] =
    useState<HarvestTarget | null>(null);

  const executeCraftNow = (recipeId: string) => {
    const recipe = RECIPES.find((candidate) => candidate.id === recipeId);
    if (!recipe) return;
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
    if (CRAFTING_GROUP_BY_RECIPE_ID[recipeId] === 'Traps') {
      setPendingTrapRecipeId(recipeId);
      return;
    }
    executeCraftNow(recipeId);
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
      sayAt(
        trap?.x ?? playerRef.current?.x ?? 0,
        trap?.z ?? playerRef.current?.z ?? 0,
        'Nothing caught yet.',
        'info',
      );
      return;
    }
    const kind = trap.catch;
    const outcome = collectTrapCatch(inventory, kind);
    if (outcome.collected === false) {
      const carcass = catchItemFor(kind);
      sayAt(
        trap.x,
        trap.z,
        outcome.reason === 'Pack full.'
          ? `Pack full — no room for ${carcass ? displayNameFor(carcass) : kind}.`
          : outcome.reason,
        'blocked',
      );
      return;
    }
    trapState.setCatch(trapId, null);
    refreshTrapsFromState();
    refreshInventory();
    sayAt(trap.x, trap.z, `Caught ${kind}!`, 'gain');
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
      sayAt(x, z, 'Harvest failed: too-hungry.', 'blocked');
      return;
    }
    const outcome = harvestHoney(inventory, placedTorchNearHive(x, z));
    if (outcome.granted === 1) {
      refreshInventory();
      saveNow();
      sayAt(x, z, 'Harvested honey!', 'gain');
      return;
    }
    sayAt(
      x,
      z,
      outcome.reason === 'Pack full.'
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

  /**
   * Inventory Place press on a lit-torch row: INSTANT AT
   * HER FEET (settled design — the preview ghost is the
   * house/fire pattern, heavy for a torch). Grant FIRST
   * (Systems placeTorch consumes one carried lit-torch;
   * failure touches nothing), then the entity place
   * (Background primitive, emits torch:placed →
   * refreshTorches). Panel action, not a world action:
   * the panel stays open, the count drops, the note
   * carries the result — the Light button's shape, not
   * the preview flow's.
   */
  const handlePlaceLitTorch = () => {
    const player = playerRef.current;
    if (!player) return;
    const outcome = grantPlaceTorch(inventory, player.x, player.z);
    // Equality check, not truthiness: non-strict tsc does
    // not narrow this union's boolean discriminant on
    // truthiness (see the torch Light button handler).
    if (outcome.placed === false) {
      setTorchNote(outcome.reason);
      return;
    }
    torchState.placeTorch(outcome.torch.x, outcome.torch.z);
    refreshInventory();
    saveNow();
    setTorchNote('Placed a lit torch.');
  };

  // PLACED TENT (tent shell, 2026-10-28 — torch
  // mirror: one press places one tent at her feet,
  // no placement mode, no ghost). Grant FIRST
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
    const outcome = placeTent(inventory, player.x, player.z);
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
    const outcome = grantPlaceAltar(inventory, player.x, player.z);
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

  // Charm-list rows for the examination panel (charm-list
  // build, Systems 9e9a9dd): listCharms is the examination
  // contract — kind + tier + note in awakening order;
  // App maps kind to its display name. Derived live each
  // render, so the panel always opens on the current list.
  const charmEntries = listCharms(charmStateRef.current).map((charm) => ({
    ...charm,
    display: boneDisplayFor(charm.kind),
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
    setInventoryOpen(true);
    setCraftingOpen(false);
    setCharmsOpen(false);
  };
  const openCraftingPanel = () => {
    setCraftingOpen(true);
    setInventoryOpen(false);
    setCharmsOpen(false);
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

  // Open the charms panel with a valid selection: keep
  // the current one if it is still listed (awakenings
  // never drop), else fall to the first charm. Radio
  // family: opening closes the other two.
  const openCharmsPanel = () => {
    setCharmsOpen(true);
    setInventoryOpen(false);
    setCraftingOpen(false);
    setSelectedCharmKind((current) =>
      charmEntries.some((charm) => charm.kind === current)
        ? current
        : (charmEntries[0]?.kind ?? null),
    );
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
  ): { kind: 'altar' | 'stump'; x: number; z: number } | null => {
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
      // Anchor BEFORE unstaging: the staged site record
      // carries the site's true position for BOTH kinds
      // (altar + stump) — the old altarState-only lookup
      // stranded stump completions at her feet.
      const staged = ritualSiteState.getStaged(entry.siteKey);
      ritualSiteState.unstageBone(entry.siteKey);
      const anchor = staged
        ? projectAnchor(staged.site.x, staged.site.z, 'scatter')
        : null;
      const player = playerRef.current;
      const fallback = player
        ? projectAnchor(player.x, player.z, 'ground')
        : null;
      const at = anchor ?? fallback;
      if (at) {
        showFeedback(
          `The ${boneDisplayFor(result.kind)} awakens.`,
          'gain',
          at.x,
          at.y,
        );
      }
      changed = true;
    }
    if (changed) {
      saveNow();
      refreshRitual();
    }
  };

  // RITUAL STAGING, ALTAR + STUMP SITES (bone build):
  // made altars carry ids + chips + positions; stumps
  // carry chips from Background's stumpPositions
  // surface. Boulders do not exist yet.
  const handleStageBone = (siteId: string, kind: string) => {
    const site = sitePositionFor(siteId);
    if (!site) {
      setRitualNote('No site there.');
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
    // branch above places instantly at her feet.
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
    // Placed tents never enter the preview flow either —
    // the torch mirror: one press places one tent at her
    // feet (camping.ts: "one press places one tent").
    // No placement mode (the preview ghost is the
    // house/fire pattern, heavy for a site placed where
    // she stands).
    if (itemId === ITEMS.tent) {
      handlePlaceTent();
      return;
    }
    // Single-tap campfire (Adam, 2026-10-28): Place places at
    // her feet immediately — no placement mode, no ghost, no
    // "Place here" panel. Hearth/kiln/bloomery keep the
    // two-step flow below; this branch is campfire only.
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
      try {
        fireState.placeFire('campfire', player.x, player.z);
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
    try {
      if (mode.fireType) {
        fireState.placeFire(mode.fireType, player.x, player.z);
      } else if (mode.houseType) {
        shelterState.placeHouse(mode.houseType, player.x, player.z);
      } else if (mode.loom) {
        loomState.placeLoom(player.x, player.z);
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

  // HOUSE-UPGRADE PRESS (Adam, 2026-10-28): mirrors
  // handlePlaceConfirm (cost gate → act → consume →
  // clear mode → refresh + save; catch → note, mode
  // stays) with shelterState.upgradeHouse in place
  // of placeHouse. setHouse ONLY if a store already
  // exists (homeStoresRef.current.get — deliberately
  // NOT getHomeStore, which lazy-creates: a
  // never-deposited house needs no update, and a
  // future first deposit creates its store from the
  // new type — DEV-accepted refinement over the
  // primitive doc's getHomeStore wording). Contents
  // ride the preserved id (stores keyed by id;
  // save/restore by id/order — nothing moves or
  // drops). House visuals ride the primitive + the
  // existing house render path (no new subscription
  // — press-driven refresh covers it; the primitive
  // emits 'shelter:upgraded', camp arrows are NOT
  // subscribed). False from upgradeHouse (shouldn't
  // happen — the pill shows only for upgradeable)
  // → failure: note + mode stays.
  const handleUpgradePress = (target: NonNullable<typeof upgradePill>) => {
    const mode = placementRef.current;
    if (!mode) return;
    const player = playerRef.current;
    if (!player) return;
    if (inventory.count(mode.itemId) < 1) {
      setPlacementNote(
        'Nothing to place — that item is no longer carried.',
      );
      placementRef.current = null;
      setPlacement(null);
      setPlacementAnchor(null);
      return;
    }
    try {
      const upgraded = shelterState.upgradeHouse(
        target.houseId,
        target.carriedType,
      );
      if (!upgraded) {
        setPlacementNote('That house cannot be upgraded.');
        return;
      }
      homeStoresRef.current
        .get(target.houseId)
        ?.setHouse(HOUSE_TYPE_TO_ITEM[target.carriedType]);
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
    if (shelterHouseId === target.houseId) {
      applyShelterHouse(target.houseId);
    }
    refreshInventory();
    saveNow();
  };

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
   * Inventory Light press (unlit torch rows only): the FLINT
   * route of Systems' batch lighting — flint + river-stone
   * carried, both kept, every carried unlit torch lit in
   * one press. litFirePresent is false here on purpose:
   * the fire route arrives with UI's lit-fire 'light
   * torches' pill (selected fire = present by definition),
   * and inventing a "nearby fire" range for this button
   * would be a new mechanic. Same refresh + save shape
   * as eating (panel action, not world action).
   */
  const handleLightTorchItem = (_itemId: string) => {
    const outcome = lightTorches(inventory, { litFirePresent: false });
    // Equality check, not truthiness: this repo runs tsc
    // without strict mode, and truthiness narrowing on
    // this union's boolean discriminant does not narrow
    // (verified: `if (outcome.lit)` else-branch keeps the
    // lit member, TS2339 on .reason; `=== false` narrows).
    if (outcome.lit === false) {
      setTorchNote(outcome.reason);
    } else {
      setTorchNote(
        `Lit ${outcome.count} torch${outcome.count === 1 ? '' : 'es'} with flint and stone.`,
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

  const handleDepositItem = (itemId: string) => {
    if (!shelterHouseId) return;
    const store = getHomeStore(shelterHouseId);
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
      homeStoreItemsRef.current.get(shelterHouseId)?.add(itemId);
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
    if (!shelterHouseId) return;
    const store = getHomeStore(shelterHouseId);
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
        homeStoreItemsRef.current.get(shelterHouseId)?.delete(itemId);
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
   * lazily here. Engine lit is the gate: the shell mirrors
   * the player's engine lighting into the Systems vessel
   * (light() at lighting start, tick(1) on the game clock),
   * and completes it the moment the engine reports lit or
   * the player presses Cook — so cook() never runs against
   * a vessel the engine hasn't lit, and never against a
   * stale one. COST ASYMMETRY, FLAGGED: Systems' slow method
   * ('sticks') consumes 1 dry-kindling, but the
   * engine friction path charges nothing — so the mirror
   * charges kindling only when dry-kindling is carried, and
   * engine lighting proceeds regardless. A friction-lit fire
   * with no kindling cooks once kindling is carried and Cook
   * is pressed (the press retries the completion and says
   * so when it still can't).
   */
  const getSystemsFire = (fireId: string): SystemsFireState => {
    const existing = systemsFiresRef.current.get(fireId);
    if (existing) return existing;
    const created = new SystemsFireState();
    systemsFiresRef.current.set(fireId, created);
    return created;
  };

  /** Bring a Systems vessel to lit for an engine-lit fire. */
  const ensureSystemsLit = (
    fireId: string,
    systemsFire: SystemsFireState,
  ) => {
    if (systemsFire.lit) return;
    if (systemsFire.fireStatus() === 'lighting') {
      systemsFire.tick(systemsFire.lightingRemaining());
      return;
    }
    const path = engineFirePathRef.current.get(fireId);
    const method =
      path === 'flint'
        ? 'flint'
        : path === 'friction'
          ? 'sticks'
          : inventory.count(ITEMS.flint) > 0
            ? 'flint'
            : 'sticks';
    systemsFire.light(method, inventory);
    systemsFire.tick(systemsFire.lightingRemaining());
  };

  /** Mirror an engine lighting start into the Systems vessel. */
  const mirrorLightingStart = (
    fireId: string,
    method: 'flint' | 'friction',
  ) => {
    engineFirePathRef.current.set(fireId, method);
    try {
      getSystemsFire(fireId).light(
        method === 'flint' ? 'flint' : 'sticks',
        inventory,
      );
    } catch {
      // Engine lighting is the authority and proceeds: a
      // friction start without dry-kindling simply
      // leaves the vessel unlit until Cook retries it.
    }
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
    return bar(
      lighting.clicks / FLINT_CLICKS,
      `Clicks ${lighting.clicks} of ${FLINT_CLICKS}`,
    );
  };
  const fireMenuActions = (fire: PlacedFire): ContextAction[] => {
    if (fire.lit) {
      const hasAcorns = inventory.count(FOOD_ACORNS) > 0;
      const unlitTorches = inventory.count(ITEMS.torch);
      return [
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
        { id: 'close', label: 'Close' },
      ];
    }
    if (fire.lighting?.method === 'flint') {
      return [
        {
          id: 'click-flint',
          label: `Click flint (${fire.lighting.clicks} of 3)`,
        },
        { id: 'close', label: 'Close' },
      ];
    }
    if (fire.lighting?.method === 'friction') {
      return [
        {
          id: 'rub',
          label:
            fire.lighting.phase === 'ready' ? 'Rub — light it' : 'Rub',
          hint:
            fire.lighting.phase === 'ready'
              ? undefined
              : 'Wait for the wait to end, then rub',
        },
        { id: 'close', label: 'Close' },
      ];
    }
    const hasFlint = inventory.count(ITEMS.flint) > 0;
    return [
      {
        id: 'light-flint',
        label: 'Light with flint',
        disabled: !hasFlint,
        disabledNote: hasFlint ? undefined : 'Needs a carried flint',
      },
      {
        id: 'light-friction',
        label: 'Light with friction (slow)',
        hint: 'Rub, wait, rub · 1 dry-kindling readies it for cooking',
      },
      { id: 'close', label: 'Close' },
    ];
  };

  const handleFireAction = (fireId: string, actionId: string) => {
    const fire = fireState.get(fireId);
    if (!fire) return;
    const anchor = fireAnchors.find((a) => a.fire.id === fireId) ?? null;
    const say = (text: string, tone: FeedbackTone) => {
      if (anchor) showFeedback(text, tone, anchor.x, anchor.y);
    };
    if (actionId === 'close') {
      setSelectedFireId(null);
      return;
    }
    if (actionId === 'light-flint') {
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
      // Fire route: this menu only opens on a lit fire's
      // chip, so litFirePresent is true — nothing
      // consumed, fire wins when both routes are
      // available. Batch: ALL carried unlit torches in
      // one press. The menu stays open; the pill itself
      // is gone on re-render (count is 0), leaving cook.
      // Equality check, not truthiness: non-strict tsc
      // does not narrow this union's boolean discriminant
      // on truthiness (see the torch Light button handler).
      const outcome = lightTorches(inventory, { litFirePresent: true });
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

  // Placed-torch menu actions (chip menu, Adam's placed-
  // torch order): one torch, one action — Pick up returns
  // it lit. Close only closes; the menu stays open after
  // a failed pickup (the torch is still there).
  const torchMenuActions = (): ContextAction[] => [
    { id: 'pick-up', label: 'Pick up' },
    { id: 'close', label: 'Close' },
  ];

  const handleTorchAction = (torchId: string, actionId: string) => {
    const torch = torchState.get(torchId);
    if (!torch) return;
    const anchor = torchAnchors.find((a) => a.torch.id === torchId) ?? null;
    const say = (text: string, tone: FeedbackTone) => {
      if (anchor) showFeedback(text, tone, anchor.x, anchor.y);
    };
    if (actionId === 'close') {
      setSelectedTorchId(null);
      return;
    }
    if (actionId === 'pick-up') {
      // Grant FIRST, then the entity removal — the
      // pile-pickup rule (take granted only): a full pack
      // grants 0, the torch stays placed, the menu stays
      // open; a grant of 1 removes the entity (emits
      // torch:removed → refreshTorches) and the menu
      // closes explicitly. Pickup returns 'lit-torch',
      // lit not unlit; no hunger gate (a move, like
      // drop/pickup, not a build).
      const grant = grantPickupTorch(inventory);
      if (grant.granted === 0) {
        say('Pack full — no room.', 'blocked');
        return;
      }
      torchState.removeTorch(torchId);
      setSelectedTorchId(null);
      say('Picked up a lit torch.', 'gain');
      refreshInventory();
      saveNow();
    }
    setPlacedTorches(torchState.snapshot());
    recomputeAnchors();
  };

  // TENT MENU ACTIONS (tent shell): Take down + Close —
  // the torch menu's shape, over the shell store.
  const tentMenuActions = (): ContextAction[] => [
    { id: 'take-down', label: 'Take down' },
    { id: 'close', label: 'Close' },
  ];

  const handleTentAction = (tentId: string, actionId: string) => {
    const tent = placedTentsRef.current.find((t) => t.id === tentId);
    if (!tent) return;
    const anchor = tentAnchors.find((a) => a.tent.id === tentId) ?? null;
    const say = (text: string, tone: FeedbackTone) => {
      if (anchor) showFeedback(text, tone, anchor.x, anchor.y);
    };
    if (actionId === 'close') {
      setSelectedTentId(null);
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
  // order via wornItemIds), carried storage gear (apron,
  // small basket, large basket), and the owned tool only
  // (ownedToolItem; 'none' when no tool). Carried-but-unworn
  // garments stay normal rows (loose until worn); the
  // umbrella is not gear (counts 1 lb) and stays a normal
  // row. Bonuses are the systems numbers: garments from
  // WORN_CAPACITY_BONUS (mittens/boots 0 → worn mark only);
  // apron +10, large basket +50, small basket +25 — except
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
    const storage: string[] = [];
    const largeCarried = inventory.count(ITEMS.largeBasket) >= 1;
    if (inventory.count(ITEMS.apron) >= 1) {
      ids.push(ITEMS.apron);
      storage.push(`${displayNameFor(ITEMS.apron)} — +10 lb`);
    }
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
    if (storage.length > 0) {
      sections.push({ title: 'Storage', entries: storage });
    }
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

  const pileMenuActions = (pile: PileTarget): ContextAction[] => {
    const actions: ContextAction[] = [];
    const pileKinds = new Set(
      pile.stacks.map((stack) => normalizeItemId(stack.item as ItemId)),
    );
    for (const stack of pile.stacks) {
      const name = displayNameFor(stack.item);
      const carried = inventory.count(stack.item as ItemId);
      const noCarried = carried <= 0;
      // Worn gear is never droppable: deposit arrows are
      // GONE for worn-gear kinds (not disabled), while Take
      // arrows stay as the recovery path.
      const isWornGear = wornGear.ids.has(
        normalizeItemId(stack.item as ItemId),
      );
      actions.push({
        id: `kind:${stack.item}`,
        label: name,
        counts: { pile: stack.quantity, carried },
        disabledNote: noCarried ? `Needs carried ${name}` : undefined,
        arrows: [
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
        ],
      });
    }
    for (const stack of inventory.stacksSnapshot()) {
      if (pileKinds.has(stack.item)) continue;
      // Worn-gear kinds carried but not in this pile get no
      // entry at all (no deposit path, nothing to take).
      if (wornGear.ids.has(normalizeItemId(stack.item as ItemId))) continue;
      const name = displayNameFor(stack.item);
      actions.push({
        id: `kind:${stack.item}`,
        label: name,
        counts: { pile: 0, carried: stack.quantity },
        arrows: [
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
        ],
      });
    }
    actions.push({ id: 'close', label: 'Close' });
    return actions;
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
  const sayAt = (x: number, z: number, text: string, tone: FeedbackTone) => {
    const player = playerRef.current;
    const anchor =
      projectAnchor(x, z, 'scatter') ??
      (player ? projectAnchor(player.x, player.z, 'ground') : null);
    if (anchor) showFeedback(text, tone, anchor.x, anchor.y);
  };

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
        sayAt(
          outcome.x,
          outcome.z,
          `Pack full — no room for ${displayNameFor(outcome.item)}.`,
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
      sayAt(
        outcome.x,
        outcome.z,
        outcome.granted === outcome.requested
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
        sayAt(
          record.x,
          record.z,
          `Deposited ${record.quantity} ${displayNameFor(record.item)}.`,
          'gain',
        );
      } catch (error) {
        sayAt(
          pile.x,
          pile.z,
          error instanceof Error ? error.message : 'Could not deposit that.',
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
  // place. Notes go through sayAt at the house (the
  // panel's storageNote is the panel's surface, not the
  // menu's). Single transfers mirror the panel's
  // add-first atomicity per unit; all-transfers loop
  // singles until the source is exhausted or the
  // destination throws, and partial results stand. One
  // refresh + one save at the end of each press, never
  // per loop unit.
  const handleHomeMenuAction = (actionId: string) => {
    if (actionId === 'close') {
      setHomeMenuOpen(false);
      return;
    }
    if (actionId === 'rest') {
      handleSleep();
      refreshInventory();
      saveNow();
      return;
    }
    if (!shelterHouseId) return;
    const store = getHomeStore(shelterHouseId);
    const house = shelterState.snapshot().find((h) => h.id === shelterHouseId);
    const player = playerRef.current;
    const sayHouse = (text: string) =>
      sayAt(
        house?.x ?? player?.x ?? 0,
        house?.z ?? player?.z ?? 0,
        text,
        'blocked',
      );
    if (!store) {
      sayHouse('No home storage here.');
      refreshInventory();
      saveNow();
      return;
    }
    const sep = actionId.indexOf(':');
    if (sep < 0) return;
    const verb = actionId.slice(0, sep);
    const kind = actionId.slice(sep + 1);
    const name = displayNameFor(kind);
    const syncWorn = () => {
      inventory.setWorn(wardrobe.wornItemIds());
      setWornGarments(wardrobe.wornGarments());
    };
    const storeOne = (): boolean => {
      try {
        store.add(kind as ItemId, 1);
        inventory.remove(kind as ItemId, 1);
        homeStoreItemsRef.current.get(shelterHouseId)?.add(kind);
        syncWorn();
        return true;
      } catch {
        return false;
      }
    };
    const takeOne = (): boolean => {
      try {
        inventory.add(kind as ItemId, 1);
        store.remove(kind as ItemId, 1);
        if (store.count(kind as ItemId) === 0) {
          homeStoreItemsRef.current.get(shelterHouseId)?.delete(kind);
        }
        syncWorn();
        return true;
      } catch {
        return false;
      }
    };
    if (verb === 'store-one') {
      if (!storeOne()) {
        sayHouse(`Home storage full — no room for ${name}.`);
      }
    } else if (verb === 'store-all') {
      const carried = inventory.count(kind as ItemId);
      let stored = 0;
      while (inventory.count(kind as ItemId) > 0) {
        if (!storeOne()) break;
        stored += 1;
      }
      if (stored < carried) {
        sayHouse(
          `Stored ${stored} of ${carried} ${name} — home storage full.`,
        );
      }
    } else if (verb === 'take-one') {
      if (!takeOne()) {
        sayHouse(`Pack full — no room for ${name}.`);
      }
    } else if (verb === 'take-all') {
      while (store.count(kind as ItemId) > 0) {
        if (!takeOne()) {
          sayHouse(`Pack full — no room for ${name}.`);
          break;
        }
      }
    } else {
      return;
    }
    refreshInventory();
    saveNow();
  };

  const handleRemove = (target: HarvestTarget) => {
    // Same shape as a harvest press, action 'remove' (Background's
    // documented shape, 2003619): the outcome listener resolves
    // it into the bigger one-time yield or an honest failure
    // ('not-removable' for logs, stones, and the like). Nothing
    // here pre-judges removability or previews a yield.
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
  const protectionNote =
    wornGarments.length === 0
      ? 'Protection: none'
      : `Protection: rain ${Math.round((1 - wornRemaining.rain) * 100)}% · wind ${Math.round((1 - wornRemaining.wind) * 100)}% · cold ${Math.round((1 - wornRemaining.cold) * 100)}% · wet ${Math.round((1 - wornRemaining.wet) * 100)}%`;
  const capacityBonus = wardrobe.wornCapacityBonus();
  const capacityNote =
    capacityBonus > 0 ? `Carrying bonus +${capacityBonus} lb` : undefined;
  // Umbrella precipitation note (see the coordination above):
  // shown only while an umbrella is carried, and its number
  // comes from Systems' single constant — never a UI-side
  // table.
  const umbrellaNote = carriesUmbrella(inventory)
    ? `Umbrella: precipitation −${Math.round(UMBRELLA_PRECIPITATION_PROTECTION * 100)}%`
    : undefined;

  // Home-storage section for the sheltering house, when
  // sheltered: rows come from the HomeStorage counts (the
  // shell tracks only the id universe, since HomeStorage
  // exposes counts, not a snapshot). Unsheltered = no
  // section, no Deposit buttons — storage is reached at
  // home, not from afar. Transfers refresh the personal list
  // above, which re-renders this derivation.
  const openHomeStore =
    shelterHouseId !== null
      ? (homeStoresRef.current.get(shelterHouseId) ?? null)
      : null;
  const openHomeIds =
    shelterHouseId !== null
      ? (homeStoreItemsRef.current.get(shelterHouseId) ?? new Set<string>())
      : new Set<string>();
  const storageSection =
    sheltered && shelterHouseId !== null
      ? {
          label: shelterHouseName ?? shelterHouseId,
          items:
            openHomeStore === null
              ? []
              : [...openHomeIds]
                  .filter((id) => openHomeStore.count(id) > 0)
                  .map((id) => ({
                    id,
                    // Same display rule as panel rows above:
                    // storage rows are panel rows too.
                    name: displayNameFor(id),
                    quantityText: String(openHomeStore.count(id)),
                  })),
          capacityText:
            openHomeStore === null
              ? 'Home storage — empty until first deposit'
              : // POUNDS (Adam, 2026-10-28 — "pounds here
                // and going forward"): used()/capacity()
                // return pounds since Systems' rework, so
                // the header names the unit. Null-store
                // text unchanged; per-kind counts below
                // are item quantities, not pounds.
                `Stored ${openHomeStore.used()} lb / ${openHomeStore.capacity()} lb`,
          note: storageNote,
          onWithdrawItem: handleWithdrawItem,
        }
      : undefined;

  // Home menu actions (Adam, 2026-10-28): Rest + Store +
  // Take kind-entries for the sheltering house. Entries
  // derive per render from live inventory + store, so the
  // menu re-renders in place after every press (pile
  // precedent) and never auto-closes — not even when the
  // store empties. Store entries skip worn-gear kinds
  // (never droppable; the worn-gear landing's set); Take
  // entries do not skip (recovery).
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
    for (const stack of inventory.stacksSnapshot()) {
      if (wornGear.ids.has(normalizeItemId(stack.item as ItemId))) continue;
      const name = displayNameFor(stack.item);
      const stored = store?.count(stack.item as ItemId) ?? 0;
      actions.push({
        id: `store-kind:${stack.item}`,
        label: name,
        countsText: `carried ×${stack.quantity} · stored ×${stored}`,
        arrows: [
          {
            id: `store-one:${stack.item}`,
            glyph: '↓',
            ariaLabel: `Store one ${name}`,
          },
          {
            id: `store-all:${stack.item}`,
            glyph: '↓↓',
            ariaLabel: `Store all ${name}`,
          },
        ],
      });
    }
    for (const id of openHomeIds) {
      const held = store?.count(id as ItemId) ?? 0;
      if (held <= 0) continue;
      const name = displayNameFor(id);
      const carried = inventory.count(id as ItemId);
      actions.push({
        id: `take-kind:${id}`,
        label: name,
        countsText: `stored ×${held} · carried ×${carried}`,
        arrows: [
          {
            id: `take-one:${id}`,
            glyph: '↑',
            ariaLabel: `Take one ${name}`,
          },
          {
            id: `take-all:${id}`,
            glyph: '↑↑',
            ariaLabel: `Take all ${name}`,
          },
        ],
      });
    }
    actions.push({ id: 'close', label: 'Close' });
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
  const homeChipVisible =
    sheltered && homeChipAnchor !== null && !paused;

  // HOUSE-UPGRADE PILL (Adam, 2026-10-28): while
  // placing a house item, the faced upgradeable house
  // gets an "Upgrade to {carried}" chip at the house
  // (home-chip pattern, inline in the overlay).
  // Candidates = placed houses with tier BELOW the
  // carried tier (ANY-higher — woven over lean-to
  // skips thatch; next-tier-only is a one-line
  // narrowing, NOT built). RANGE = center distance
  // ≤ SHELTER_RADIUS 6 m (footprints to 6.5 m wide,
  // so HARVEST_RANGE 2.5 m would miss big houses).
  // CONE = angle < 45° via dot product (forward =
  // (sin facing, cos facing); dot > cos45° =
  // Math.SQRT1_2); d = 0 counts as faced. NO
  // hysteresis v1. Tie-break: nearest distance,
  // exact tie → first in snapshot order. Same-or-
  // higher → no pill, feet "Place here" stands. NO
  // paused guard (buttons, not canvas taps —
  // placement buttons work while paused today).
  // Capacity: the pill shows NO capacity number —
  // engine HOUSE_DEFS (woven 200 / smallWooden 400)
  // vs Systems' table (175 / 250) diverges; pin
  // pass reconciles the tables. Per-render derivation
  // (home-chip precedent) — no new subscription.
  const upgradePill = (() => {
    const mode = placement;
    const player = playerRef.current;
    if (!mode?.houseType || !player) return null;
    const carriedTier = HOUSE_LADDER.indexOf(mode.houseType);
    if (carriedTier === -1) return null;
    const facingX = Math.sin(player.facing);
    const facingZ = Math.cos(player.facing);
    let best: {
      houseId: string;
      carriedType: HouseType;
      placedName: string;
      carriedName: string;
      x: number;
      z: number;
    } | null = null;
    let bestDistance = Infinity;
    for (const house of shelterState.snapshot()) {
      const placedTier = HOUSE_LADDER.indexOf(house.type);
      if (placedTier === -1 || placedTier >= carriedTier) continue;
      const dx = house.x - player.x;
      const dz = house.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > SHELTER_RADIUS) continue;
      if (d > 0) {
        const dot = (facingX * dx + facingZ * dz) / d;
        if (dot <= Math.SQRT1_2) continue;
      }
      if (d < bestDistance) {
        bestDistance = d;
        best = {
          houseId: house.id,
          carriedType: mode.houseType,
          placedName: HOUSE_DEFS[house.type].name,
          carriedName: HOUSE_DEFS[mode.houseType].name,
          x: house.x,
          z: house.z,
        };
      }
    }
    return best;
  })();
  const upgradePillAnchor = upgradePill
    ? projectAnchor(upgradePill.x, upgradePill.z, 'scatter')
    : null;

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
  const nearbyPile =
    nearestPile === undefined
      ? undefined
      : {
          kinds: nearestPile.stacks.map((stack) => ({
            id: stack.item,
            name: displayNameFor(stack.item),
            pileQuantity: stack.quantity,
            carriedQuantity: inventory.count(stack.item as ItemId),
          })),
        };

  // The fire whose lighting menu is open, with its anchor.
  const selectedFire =
    selectedFireId === null
      ? undefined
      : placedFires.find((f) => f.id === selectedFireId);
  const selectedFireAnchor =
    selectedFire === undefined
      ? null
      : (fireAnchors.find((a) => a.fire.id === selectedFire.id) ?? null);

  // The torch whose menu is open, with its anchor — the
  // fire pattern, live: the menu renders from placedTorches,
  // so a picked-up torch leaves the menu with nothing.
  const selectedTorch =
    selectedTorchId === null
      ? undefined
      : placedTorches.find((t) => t.id === selectedTorchId);
  const selectedTorchAnchor =
    selectedTorch === undefined
      ? null
      : (torchAnchors.find((a) => a.torch.id === selectedTorch.id) ?? null);
  // The selected tent + its anchor — the torch pattern,
  // over the shell store (no entity yet).
  const selectedTent =
    selectedTentId === null
      ? undefined
      : placedTents.find((t) => t.id === selectedTentId);
  const selectedTentAnchor =
    selectedTent === undefined
      ? null
      : (tentAnchors.find((a) => a.tent.id === selectedTent.id) ?? null);

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
  const selectedSiteLabel =
    selectedSiteId === null
      ? null
      : selectedSiteId.startsWith('stump:')
        ? 'Stump'
        : 'Altar';
  const selectedSiteAnchor =
    selectedSiteId === null
      ? null
      : selectedSiteId.startsWith('stump:')
        ? (stumpAnchors.find((a) => a.siteId === selectedSiteId) ?? null)
        : (altarAnchors.find((a) => a.altar.id === selectedSiteId) ?? null);
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

  // Ritual panel option lists, hoisted from the panel's
  // JSX so the PC-key digit dispatch (below) reads the
  // SAME lists the panel renders — one source, no
  // divergence. Computed only while a site is selected
  // (the panel's own condition); [] otherwise.
  const selectedSiteKindOptions =
    selectedSiteId === null
      ? []
      : RITUAL_RECIPES.filter(
          (recipe) => charmStateRef.current.tierOf(recipe.boneKind) === 0,
        ).map((recipe) => ({
          kind: recipe.boneKind,
          display: boneDisplayFor(recipe.boneKind),
          skyLabel:
            recipe.sky === 'none' ? 'Any sky' : skyLabelFor(recipe.sky),
        }));
  const selectedSiteFoodOptions =
    selectedSiteId === null
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

  // The pile whose menu is open, with its anchor.
  // Live menu pile: the menu renders from piles state, not a
  // tap-time snapshot (see the state comment above).
  const selectedPile =
    selectedPileId === null
      ? null
      : (piles.find((pile) => pile.id === selectedPileId) ?? null);

  const [optionsOpen, setOptionsOpen] = useState(false);

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
  }, [optionsOpen]);
  // FIRST-RUN DIALOG (Adam, 2026-10-28): on a no-save
  // boot the dialog comes FIRST and the intro second.
  // firstRunDone starts true when a save exists (the
  // dialog never shows) and flips true on dialog Begin;
  // introOpen's init reads it, so the intro cannot open
  // under the dialog. Declared BEFORE introOpen — an
  // initializer reading a later-declared const is a TDZ
  // crash (the #17 lesson), and the dialog predicate
  // below reads both.
  const [firstRunDone, setFirstRunDone] = useState(bootSave !== null);

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
      placement !== null ||
      selectedSiteId !== null ||
      optionsOpen ||
      introOpen ||
      pendingTrapRecipe ||
      pendingRemoveTarget !== null ||
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
    };
  })();

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
      placement !== null ||
      selectedSiteId !== null ||
      optionsOpen ||
      introOpen ||
      pendingTrapRecipe ||
      pendingRemoveTarget !== null ||
      paused
    ) {
      return null;
    }
    let nearest: { x: number; z: number } | null = null;
    let nearestDistance = Infinity;
    for (const hive of hivePositions(genRef.current, player.x, player.z)) {
      const distance = Math.hypot(hive.x - player.x, hive.z - player.z);
      if (distance <= HARVEST_RANGE && distance < nearestDistance) {
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
      if (e.key !== 'Escape') return;
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
        pendingRemoveTarget !== null
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
      if (selectedTorchId !== null) {
        setSelectedTorchId(null);
        return;
      }
      if (selectedTentId !== null) {
        setSelectedTentId(null);
        return;
      }
      if (selectedFireId !== null) {
        setSelectedFireId(null);
        return;
      }
      if (selectedSiteId !== null) {
        setSelectedSiteId(null);
        setRitualNote(null);
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
      setOptionsOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    optionsOpen,
    introOpen,
    pendingTrapRecipe,
    pendingRemoveTarget,
    placement,
    homeMenuOpen,
    selectedPileId,
    selectedTorchId,
    selectedTentId,
    selectedFireId,
    selectedSiteId,
    charmsOpen,
    craftingOpen,
    inventoryOpen,
    firstRunDone,
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
  // definition, the upgrade pill's (46a617d): forward =
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
  // ONE shared computeUseWinner() feeds the press, the
  // R press, the touch USE label, and the desktop pile
  // button, so the tell can never disagree with the act.
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
    | { kind: 'fire' | 'tent' | 'torch'; id: string; distance: number }
    | { kind: 'home'; distance: number }
    | { kind: 'scry'; distance: number };

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
    const scatter = harvestTargets.find(
      (candidate) => candidate.kind === 'scatter',
    );
    const scatterFacing = scatter
      ? facingOf(scatter.worldX, scatter.worldZ)
      : null;
    const scatterDistance = scatter
      ? (busTargetsRef.current.find((t) => t.id === scatter.id)?.distance ??
        scatterFacing!.distance)
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
    // The rest of the field, in tie order (the pair winner
    // keeps ties — challengers must be strictly nearer).
    const challengers: UseWinner[] = [];
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
    let siteBest: UseWinner | null = null;
    const considerSite = (siteId: string, x: number, z: number): void => {
      const f = facingOf(x, z);
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
      kind: 'fire' | 'tent' | 'torch',
      id: string,
      x: number,
      z: number,
    ): void => {
      const f = facingOf(x, z);
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
    for (const torch of placedTorches) {
      considerPlaced('torch', torch.id, torch.x, torch.z);
    }
    if (homeHouse !== undefined) {
      const f = facingOf(homeHouse.x, homeHouse.z);
      if (f.isFaced) {
        challengers.push({ kind: 'home', distance: f.distance });
      }
    }
    let winner = pairWinner;
    for (const challenger of challengers) {
      if (winner === null || challenger.distance < winner.distance) {
        winner = challenger;
      }
    }
    if (winner !== null) return winner;
    // Fallbacks: scry (visible; it has no world position,
    // so it never outranks a positioned target), then
    // ground, then nothing.
    if (scryVisible) return { kind: 'scry', distance: Infinity };
    const ground = harvestTargets.find(
      (candidate) => candidate.kind === 'ground',
    );
    if (ground) return { kind: 'ground', target: ground, distance: 0 };
    return null;
  };

  // The USE press itself: fire the winner's common
  // action through the SAME handler its button, row, or
  // chip tap calls. Harvest presses go through the
  // engine's pressUse (the outcome listener re-validates
  // range + permit, so a stale press fails safely). The
  // zero-arg player.pressUse() path is NOT used (its
  // shell query has no callers).
  const handleUseInteract = (): void => {
    const player = playerRef.current;
    if (!player) return;
    const winner = computeUseWinner();
    if (winner === null) return;
    switch (winner.kind) {
      case 'scatter':
      case 'ground':
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
        setSelectedSiteId(winner.siteId);
        break;
      case 'fire':
        setSelectedFireId(winner.id);
        break;
      case 'tent':
        setSelectedTentId(winner.id);
        break;
      case 'torch':
        setSelectedTorchId(winner.id);
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
  // today): scatter → Remove (the SAME confirm Shift+E
  // arms — R sits ALONGSIDE Shift+E, which stays as
  // pinned; the difference is scope: Shift+E reaches
  // the nearest scatter whatever the winner is, R acts
  // on the winner); pile → pick up the WHOLE pile on
  // the existing pickup path (Adam pinned: "R can pick
  // up the whole pile if possible" — the grant's own
  // capacity behavior, no second rule); torch → Pick
  // up; tent → Take down; home → Rest (night-gated
  // exactly as its menu disables it). Trap, hive, fire,
  // site, scry, and ground have no second action today:
  // R is a no-op there (hive Relocate is an unbuilt
  // seed, named not built).
  const handleSecondInteract = (): void => {
    const winner = computeUseWinner();
    if (winner === null) return;
    switch (winner.kind) {
      case 'scatter':
        setPendingRemoveTarget(winner.target);
        break;
      case 'pile':
        bus.emit('pile:pickup-requested', { pileId: winner.pile.id });
        break;
      case 'torch':
        handleTorchAction(winner.id, 'pick-up');
        break;
      case 'tent':
        handleTentAction(winner.id, 'take-down');
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
      const target = flattenMenuTargets(pileMenuActions(selectedPile))[
        digit - 1
      ];
      if (target && !target.disabled) {
        handlePileAction(selectedPile, target.id);
      }
      return;
    }
    if (selectedTorch !== undefined) {
      const target = flattenMenuTargets(torchMenuActions())[digit - 1];
      if (target && !target.disabled) {
        handleTorchAction(selectedTorch.id, target.id);
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
    if (selectedFire !== undefined) {
      const target = flattenMenuTargets(fireMenuActions(selectedFire))[
        digit - 1
      ];
      if (target && !target.disabled) {
        handleFireAction(selectedFire.id, target.id);
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
      if (selectedSiteStaged === null) {
        const option = selectedSiteKindOptions[digit - 1];
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
        const step = steps[digit - 1];
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
  // (RemoveConfirm, trap-recipe, the four cloud
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
      optionsOpen ||
      introOpen ||
      firstRunDialogOpen ||
      homeMenuOpen ||
      selectedPileId !== null ||
      selectedTorchId !== null ||
      selectedTentId !== null ||
      selectedFireId !== null ||
      selectedSiteId !== null ||
      pendingRemoveTarget !== null ||
      pendingTrapRecipe !== null ||
      cloudPendingBring !== null ||
      cloudPendingRemove !== null ||
      cloudPendingRestore !== null ||
      cloudPendingNewGame !== null ||
      paused;
    if (anyScreenOpen && document.pointerLockElement !== null) {
      document.exitPointerLock();
    }
  }, [
    inventoryOpen,
    craftingOpen,
    charmsOpen,
    optionsOpen,
    introOpen,
    firstRunDialogOpen,
    homeMenuOpen,
    selectedPileId,
    selectedTorchId,
    selectedTentId,
    selectedFireId,
    selectedSiteId,
    pendingRemoveTarget,
    pendingTrapRecipe,
    cloudPendingBring,
    cloudPendingRemove,
    cloudPendingRestore,
    cloudPendingNewGame,
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
        pendingRemoveTarget !== null ||
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
      // A world menu/panel is open: digits fire its
      // actions in render order, every other key waits
      // (Esc closes, in the Esc listener above). Above
      // the panel toggles, mirroring the Esc chain —
      // menus close before panels.
      if (
        homeMenuOpen ||
        selectedPileId !== null ||
        selectedTorchId !== null ||
        selectedTentId !== null ||
        selectedFireId !== null ||
        selectedSiteId !== null
      ) {
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
      if (inventoryOpen || craftingOpen || charmsOpen) {
        if (key === 'i') toggleInventoryPanel();
        else if (key === 'k') toggleCraftingPanel();
        else if (key === 'l') toggleCharmsPanel();
        return;
      }
      if (key === 'e' && !e.shiftKey) {
        handleUseInteract();
      } else if (key === 'e' && e.shiftKey) {
        const scatter = harvestTargets.find(
          (candidate) => candidate.kind === 'scatter',
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
    pendingRemoveTarget,
    inventoryOpen,
    craftingOpen,
    charmsOpen,
    handleUseInteract,
    handleSecondInteract,
    openCharmsPanel,
    toggleInventoryPanel,
    toggleCraftingPanel,
    toggleCharmsPanel,
    firstRunDone,
    placement,
    handlePlaceConfirm,
    homeMenuOpen,
    selectedPileId,
    selectedTorchId,
    selectedTentId,
    selectedFireId,
    selectedSiteId,
    dispatchWorldMenuDigit,
  ]);
  // PC-KEYS CLICK (Adam, 2026-10-28): click-to-harvest while
  // pointer-locked — the same shared USE path as E. Gated on
  // a captured pointer (the locking click itself fires while
  // pointerLockElement is still null, so it never harvests),
  // left button only, not paused, no modal/panel open (locked
  // clicks can't reach HUD buttons, but a keyboard-opened
  // Options while locked must still block harvest). No
  // conflict with player.onCanvasClick (unlocked →
  // requestPointerLock, locked → no-op there). Phone
  // unchanged (no pointer lock).
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      if (document.pointerLockElement === null) return;
      if (pausedRef.current) return;
      if (
        optionsOpen ||
        introOpen ||
        pendingTrapRecipe ||
        pendingRemoveTarget !== null ||
        inventoryOpen ||
        craftingOpen ||
        charmsOpen
      ) {
        return;
      }
      handleUseInteract();
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [
    optionsOpen,
    introOpen,
    pendingTrapRecipe,
    pendingRemoveTarget,
    inventoryOpen,
    craftingOpen,
    charmsOpen,
    handleUseInteract,
  ]);

  // LOCATION CHIP (see the header): dominant biome from the
  // same ground weights the scaffold readout formats — the
  // engine already computes the dominant id on the weights
  // object, so the shell reads it (and its weight) rather
  // than re-deriving a maximum. It follows position state,
  // so it moves with player:moved (~10 Hz) and with
  // regenerate (seed in the deps).
  const dominantBiome = useMemo(() => {
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
  // beyond range, or already at/in water).
  const frogHint = charmStateRef.current.isAwakened('frog-pelvis')
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
  // frame, so the chip does not churn the HUD. A sample
  // spanning hidden-tab time (rAF pauses when hidden) is
  // dropped instead of showing a bogus low number.
  const [fps, setFps] = useState<number | null>(null);
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let start = performance.now();
    const tick = (now: number): void => {
      // PAUSE GATE: discard paused frames instead of sampling
      // them, so the chip never reports a pause-inflated number
      // and resume starts a fresh sample window.
      if (pausedRef.current) {
        frames = 0;
        start = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      frames += 1;
      const elapsed = now - start;
      if (elapsed >= 1000) {
        if (elapsed < 2000) {
          setFps(Math.round((frames * 1000) / elapsed));
        }
        frames = 0;
        start = now;
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
  // and turns.
  const useWinner = computeUseWinner();

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
  // USE is the harvest read she already knows.
  const useWinnerLabel =
    useWinner === null
      ? undefined
      : useWinner.kind === 'pile'
        ? 'OPEN'
        : useWinner.kind === 'trap'
          ? 'COLLECT'
          : useWinner.kind === 'hive'
            ? 'HARVEST'
            : useWinner.kind === 'site' ||
                useWinner.kind === 'fire' ||
                useWinner.kind === 'tent' ||
                useWinner.kind === 'torch' ||
                useWinner.kind === 'home'
              ? 'OPEN'
              : useWinner.kind === 'scry'
                ? 'SCRY'
                : undefined;



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
                : undefined;
          return (
            <Fragment key={fire.id}>
              <WorldAnchor x={x} y={y} interactive>
                <FireState
                  kind={fire.type}
                  status={status}
                  lightingDetail={detail}
                  onSelect={() => setSelectedFireId(fire.id)}
                />
              </WorldAnchor>
            </Fragment>
          );
        })}
        {torchAnchors.map(({ torch, x, y }) => (
          <Fragment key={torch.id}>
            <WorldAnchor x={x} y={y} interactive>
              <TorchChip onSelect={() => setSelectedTorchId(torch.id)} />
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
        {altarAnchors.map(({ altar, x, y }) => (
          <Fragment key={altar.id}>
            <WorldAnchor x={x} y={y} interactive>
              <AltarChip onSelect={() => setSelectedSiteId(altar.id)} />
            </WorldAnchor>
          </Fragment>
        ))}
        {stumpAnchors.map(({ siteId, x, y }) => (
          <Fragment key={siteId}>
            <WorldAnchor x={x} y={y} interactive>
              <AltarChip
                label="Stump"
                onSelect={() => setSelectedSiteId(siteId)}
              />
            </WorldAnchor>
          </Fragment>
        ))}
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
        {selectedTorch && selectedTorchAnchor ? (
          <WorldAnchor
            x={selectedTorchAnchor.x}
            y={selectedTorchAnchor.y}
            interactive
          >
            <ContextMenu theme={lookThemes.world}
              objectName="Lit Torch"
              actions={torchMenuActions()}
              showKeyHints={!isTouch}
              onSelect={(id) => handleTorchAction(selectedTorch.id, id)}
              onClose={() => setSelectedTorchId(null)}
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
        {homeChipVisible && homeChipAnchor ? (
          <WorldAnchor x={homeChipAnchor.x} y={homeChipAnchor.y} interactive>
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
        {upgradePill && upgradePillAnchor ? (
          <WorldAnchor
            x={upgradePillAnchor.x}
            y={upgradePillAnchor.y}
            interactive
          >
            <button
              type="button"
              onClick={() => handleUpgradePress(upgradePill)}
              aria-label={`Upgrade ${upgradePill.placedName} to ${upgradePill.carriedName}`}
              className="flex min-h-[44px] items-center rounded-full bg-black/60 px-2 py-1 text-sm text-stone-100"
            >
              Upgrade to {upgradePill.carriedName}
            </button>
          </WorldAnchor>
        ) : null}
        {homeMenuOpen && homeHouse !== undefined && homeChipAnchor ? (
          <WorldAnchor x={homeChipAnchor.x} y={homeChipAnchor.y} interactive>
            <ContextMenu theme={lookThemes.world}
              objectName={shelterHouseName ?? 'Home'}
              header={
                <>
                  <p className="text-sm text-stone-300">
                    {openHomeStore === null
                      ? 'Home storage — empty until first deposit'
                      : // POUNDS (Adam, 2026-10-28): same
                        // unit as the panel header above.
                        `Stored ${openHomeStore.used()} lb / ${openHomeStore.capacity()} lb`}
                  </p>
                  <p className="text-xs text-stone-400">
                    ↑ Take one · ↑↑ Take all · ↓ Store one · ↓↓ Store all
                  </p>
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
            valid
          />
        ) : null}
        {progressItems.map((item) => (
          <Fragment key={item.targetId}>
            <WorldAnchor x={item.x} y={item.y}>
              <InteractionProgress theme={lookThemes.dialog}
                fraction={item.fraction}
                label={item.label}
              />
            </WorldAnchor>
          </Fragment>
        ))}
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
          onHarvest={handleHarvest}
          onRemove={handleRemove}
          stationAnchor={stationAnchor}
          trap={presentedTrap}
          onCollectTrap={handleCollectTrap}
          hive={presentedHive}
          onHarvestHive={handleHarvestHive}
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
        {/* PILL FIX: pickup feedback lives HERE, last in the
          z-40 overlay (after the buttons + pile button), so
          it paints ABOVE the menu instead of under it (it
          used to sit in the z-30 overlay, where the z-40
          column painted over it near screen-middle).
          Still below z-50 modals. WorldAnchor positions
          by % in any absolute inset-0 parent, so the move
          changes layering only, not placement. */}
        {feedbacks.map((feedback) => (
          <Fragment key={feedback.id}>
            <WorldAnchor x={feedback.x} y={feedback.y}>
              <ObjectFeedback text={feedback.text} tone={feedback.tone} />
            </WorldAnchor>
          </Fragment>
        ))}
      </div>

      {/* HUD shell: needs row (awaiting survival systems) + HUD block. */}
      {/* Location chip: top row of the HUD (in-flow
        below the Needs row, via HudShell's topReadout
        slot — NOT the old absolute bottom-centre seat).
        Always visible, including with the HUD collapsed
        on touch (the slot is not gated by collapse).
        It hides only while a panel or the modal is open
        (rule unchanged by the move). */}
      <HudShell theme={lookThemes.world}
        hideNeeds={isTouch && hudCollapsed}
        topReadout={
          !inventoryOpen &&
          !craftingOpen &&
          !charmsOpen &&
          !optionsOpen &&
          !introOpen ? (
            <LocationChip theme={lookThemes.world}
              x={position.x}
              z={position.z}
              biomeName={dominantBiome.name}
              biomePercent={dominantBiome.percent}
              fps={fps}
              zoneX={zoneX}
              zoneZ={zoneZ}
            />
          ) : null
        }
      >
        {(!isTouch || !hudCollapsed) ? (
        <div
          className={
            isTouch
              // Reserve 18rem: needs row (~52 px) + thumbstick
              // clearance (bottom-24 offset + 128 px ring =
              // 224 px), so the expanded stack never slides
              // under the stick on portrait — 13rem did.
              // TURNING FIX: max-w-[46vw], not max-w-sm — the
              // look field is the right half (w-1/2) at z-20
              // and the stack sits above it (z-30), so a
              // full-width stack on portrait swallowed the
              // look field and first-person drags could not
              // turn. 46vw keeps the stack left of half width
              // on any viewport, so the right half stays open
              // world; the stack still scrolls (overflow-y)
              // and its buttons keep 44 px targets.
              ? 'pointer-events-auto m-2 max-w-[46vw] max-h-[calc(100vh-18rem)] overflow-y-auto pr-1 ' +
                touchScrollbar
              : 'pointer-events-auto m-2 max-w-sm'
          }
        >
          <h1 className="text-lg tracking-widest">SILENT EARTH</h1>
          <div className="mt-2 text-xs space-y-1">
            <p>
              Camera:{' '}
              {cameraMode === 'first'
                ? 'First-person'
                : cameraMode === 'behind'
                  ? 'Behind (over-shoulder)'
                  : 'Third-person overhead'}{' '}
              <span className="opacity-60">(press V or C)</span>
            </p>
            <p>
              Position: {position.x.toFixed(1)}, {position.z.toFixed(1)}
            </p>
            <p>Ground here: {biomeText}</p>
            <p>Chunks loaded: {chunkCount}</p>
            <p>Seed: {seed}</p>
            <p>Owned tool: {ownedItem}</p>
          </div>
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
          <div className="mt-3">
            <WitchHealth />
          </div>
          <div className="mt-2">
            <HungerIndicator
              stage={hungerStage}
              value={hungerValue}
              warningActive={hungerWarningActive}
              warningFlash={hungerWarningFlash}
            />
          </div>
          <div className="mt-2">
            <StormWarning
              active={deerWarningActive}
              flash={deerWarningFlash}
            />
          </div>
          <ForageHint stage={hungerStage} />
          <div className="mt-2">
            <WornList
              worn={wornGarments}
              carried={carriedGarments}
              onWear={handleWear}
              onRemove={handleRemoveGarment}
              comfortable={isTouch}
              protectionNote={protectionNote}
              capacityNote={capacityNote}
              umbrellaNote={umbrellaNote}
              note={wardrobeNote}
            />
          </div>
          <div className="mt-2">
            <ShelteredIndicator
              sheltered={sheltered}
              houseName={shelterHouseName}
            />
          </div>
          {stationPresenceValue.workstation ? (
            <div className="mt-2">
              {/* STATION TITLE FOLLOWS THE UPGRADE
                  (stumpy shell, 2026-10-28): the panel
                  names the station she stands at — a
                  stump that already carries the
                  workstation addition reads 'Workbench'
                  (the panel's own 'workstation' kind),
                  a plain stump reads 'Tree stump'. */}
              <StationPanel theme={lookThemes.world}
                stationKind={
                  nearestStump !== null &&
                  stumpState.isWorkbench(nearestStump.x, nearestStump.z)
                    ? 'workstation'
                    : 'stump'
                }
                actions={[
                  {
                    id: 'craft',
                    label: 'Craft',
                    onSelect: () => openCraftingPanel(),
                  },
                ]}
                comfortable={isTouch}
              />
            </div>
          ) : null}
          {placement ? (
            <div className="mt-2 rounded bg-black/45 px-2 py-1 text-sm">
              <p>Placing {placement.label} at your feet.</p>
              <div className="mt-1 flex gap-2">
                {/* UPGRADE PILL: one confirm at a time —
                    while the pill shows, feet placement
                    hides (the pill IS the confirm). */}
                {upgradePill ? null : (
                  <button
                    type="button"
                    onClick={handlePlaceConfirm}
                    className={
                      isTouch
                        ? 'rounded bg-moss-deep px-3 py-2 text-sm min-h-[44px] hover:bg-moss'
                        : 'rounded bg-moss-deep px-2 py-0.5 text-xs hover:bg-moss'
                    }
                  >
                    Place here
                    {!isTouch ? (
                      <span
                        aria-hidden="true"
                        className={'ml-1 ' + KEY_BADGE_CLASS}
                      >
                        Enter
                      </span>
                    ) : null}
                  </button>
                )}
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
          ) : null}
        </div>
        ) : null}
      </HudShell>

      {/* Touch HUD bar: collapsed = slim bar (Show HUD + the
        buttons that must stay tappable); expanded = a single
        Hide HUD button, since the stack carries the rest.
        Desktop renders neither. */}
      {isTouch ? (
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
            }}
            aria-label="Hide HUD panels to reveal the game"
            className="pointer-events-auto absolute right-2 top-2 z-40 min-h-[44px] rounded bg-black/60 px-3 py-2 text-sm"
          >
            Hide HUD
          </button>
        )
      ) : null}

      {/* Panels column (right side; bottom sheet on touch). */}
      <div
        className={
          isTouch
            ? 'pointer-events-auto absolute left-2 right-2 bottom-2 z-30 flex max-h-[60vh] flex-col gap-2 overflow-y-auto ' +
              touchScrollbar
            : 'pointer-events-auto absolute right-2 top-20 z-30 flex max-h-[calc(100vh-6rem)] w-80 max-w-[calc(100vw-1rem)] flex-col gap-2 overflow-y-auto'
        }
      >
        {selectedPile ? (
          <PileInventoryModal theme={lookThemes.world}
            title={
              selectedPile.stacks.length === 1
                ? `${displayNameFor(selectedPile.stacks[0].item)} × ${selectedPile.stacks[0].quantity}`
                : `Pile × ${selectedPile.stacks.reduce((sum, stack) => sum + stack.quantity, 0)} (${selectedPile.stacks.length} kinds)`
            }
            actions={pileMenuActions(selectedPile)}
            showKeyHints={!isTouch}
            onSelect={(id) => handlePileAction(selectedPile, id)}
            onClose={() => {
              selectedPileIdRef.current = null;
              setSelectedPileId(null);
            }}
          />
        ) : null}
        {inventoryOpen ? (
          <InventoryPanel theme={lookThemes.world}
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
            storage={storageSection}
            onDepositItem={handleDepositItem}
            onDropItem={handleDropItem}
            onDropAllItem={handleDropAllItem}
            nearbyPile={nearbyPile}
            onTakeItem={(kind, quantity) =>
              nearestPile !== undefined
                ? handlePileAction(
                    nearestPile,
                    quantity === 1 ? `take-one:${kind}` : `take-all:${kind}`,
                  )
                : undefined
            }
            capacityText={capacityText}
            onClose={() => setInventoryOpen(false)}
            comfortable={isTouch}
          />
        ) : null}
        {craftingOpen ? (
          <CraftingMenu theme={lookThemes.dialog}
            recipes={orderedCraftingRecipes}
            sections={craftingSections}
            stationNote={stationNote}
            comfortable={isTouch}
            selectedRecipeId={selectedRecipeId}
            onSelectRecipe={setSelectedRecipeId}
            onCraft={handleCraft}
            onClose={() => setCraftingOpen(false)}
          />
        ) : null}
        {charmsOpen ? (
          <CharmsPanel theme={lookThemes.world}
            charms={charmEntries}
            selectedKind={selectedCharmKind}
            onSelectKind={setSelectedCharmKind}
            onClose={() => setCharmsOpen(false)}
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
        {altarNote ? (
          <p className="rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
            {altarNote}
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

      {/* Seed controls */}
      <div className="absolute bottom-0 left-0 z-30 flex items-center gap-2 p-4">
        <label htmlFor="seed-input" className="text-xs opacity-70">
          World seed:
        </label>
        <input
          id="seed-input"
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') regenerate();
          }}
          className="bg-[#1e241c] border border-moss-deep px-2 py-1 text-xs w-48 outline-none"
        />
        <button
          onClick={() => regenerate()}
          className="bg-moss-deep hover:bg-moss px-3 py-1 text-xs"
        >
          Regenerate
        </button>
        <span className="text-xs opacity-60">Current: {seed}</span>
      </div>

      {/* Controls help (desktop only — touch devices get the TouchControls cues). */}
      {isTouch ? null : (
      <div className="absolute bottom-0 right-0 z-30 p-4 text-right text-xs opacity-70 pointer-events-none">
        <p>WASD to walk</p>
        <p>V / C to switch camera</p>
        <p>E — Interact</p>
        <p>R — 2nd Interact</p>
        <p>Esc — Options</p>
        {cameraMode === 'first' && <p>Click the world to capture the mouse</p>}
      </div>
      )}

      {/* Touch controls (coarse-pointer devices only). Rendered
        below the z-30 HUD/panels/world buttons, so taps on
        those still land on them; the look field only catches
        touches on open world. */}
      {isTouch ? (
        <TouchControls
          onMove={applyTouchMove}
          onTurn={applyTurn}
          onLook={applyTouchLook}
          onInteract={handleUseInteract}
          interactLabel={useWinnerLabel}
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
          onClose={() => setOptionsOpen(false)}
          comfortable={isTouch}
        />
      ) : null}

      {/* Remove confirm (PC keys, 2026-10-28): Shift+E arms
        a scatter target; Enter/Remove confirms (same
        handleRemove call as the button), Esc/backdrop/
        Cancel aborts with nothing consumed. Standalone
        dialog (not Popup) so its Enter/Esc is the single
        path — the App Esc listener yields while it is open. */}
      <RemoveConfirm theme={lookThemes.world}
        open={pendingRemoveTarget !== null}
        targetName={pendingRemoveTarget?.name ?? ''}
        onConfirm={() => {
          const target = pendingRemoveTarget;
          setPendingRemoveTarget(null);
          if (target) handleRemove(target);
        }}
        onCancel={() => setPendingRemoveTarget(null)}
      />

      {/* First-run dialog: no save at boot — name + seed,
        both optional, Begin-only (no Cancel, no X, no
        backdrop dismiss; Begin-with-blanks is the exit).
        Renders before the intro modal; Begin opens the
        intro (firstRunDone gate + explicit setIntroOpen). */}
      {firstRunDialogOpen ? (
        <FirstRunDialog theme={lookThemes.world}
          onBegin={handleFirstRunBegin}
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
              {cloudSaves.find(
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

      {/* New Game confirm: names the current save
        (press-time snapshot) + the park warning when a
        parked save will be replaced. Confirm parks the
        current save, clears the save key, and reloads
        into the first-run dialog; Cancel (or Esc)
        changes nothing. */}
      <Popup theme={lookThemes.dialog}
        open={cloudPendingNewGame !== null}
        title="Start a new game?"
        onClose={() => setCloudPendingNewGame(null)}
        comfortable={isTouch}
      >
        {cloudPendingNewGame !== null ? (
          <div className="flex flex-col gap-3 p-3 text-sm">
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={confirmNewGame}
              >
                New Game
              </button>
              <button
                type="button"
                className={
                  'rounded bg-moss-deep hover:bg-moss px-3 py-1 text-sm text-stone-100 ' +
                  (isTouch ? 'min-h-[44px] px-3 py-2' : '')
                }
                onClick={() => setCloudPendingNewGame(null)}
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
        arrival-dismiss and regenerate hide them again. */}
      {scryVisible &&
      !inventoryOpen &&
      !craftingOpen &&
      !charmsOpen &&
      !optionsOpen &&
      !introOpen &&
      !pendingTrapRecipe &&
      !paused ? (
        <div className="pointer-events-none absolute bottom-12 left-1/2 z-40 -translate-x-1/2">
          <ScryButton onPress={handleScry} showKeyHint={!isTouch} />
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
      {!inventoryOpen &&
      !craftingOpen &&
      !charmsOpen &&
      !optionsOpen &&
      !introOpen &&
      !pendingTrapRecipe &&
      pendingRemoveTarget === null &&
      !paused ? (
        <AnimalTag theme={lookThemes.world}
          getAnimals={() => rendererRef.current?.getVisibleAnimals() ?? []}
          getPlayerPos={() => {
            const player = playerRef.current;
            return player ? { x: player.x, z: player.z } : { x: 0, z: 0 };
          }}
          project={(x, z) => projectAnchor(x, z, 'scatter')}
        />
      ) : null}



      {/* Paused control: only while the engine flag is set. It
        renders regardless of panels (a global state control,
        not a panel). The wrapper is pointer-events-none, but
        the button itself takes its own tap — that tap is the
        resume (tap-to-resume, pinned). */}
      {paused ? (
        <PausedIndicator
          onResume={() => pauseState.setPaused(false)}
          showKeyHint={!isTouch}
        />
      ) : null}

      {/* Camera transition overlay (vignette at rest, fade on switch). */}
      <CameraTransition switching={switching} />
    </div>
  );
}
