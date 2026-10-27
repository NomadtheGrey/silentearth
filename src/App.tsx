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
 * - Inventory capacity mode: PINNED by Adam 2026-10-26 — a large
 *   basket REPLACES a small basket (full kit: pockets 10 + apron
 *   10 + large 50 = 70). The shell constructs PersonalInventory
 *   directly with largeBasketMode 'replace' — the ruled mode, not
 *   Systems' temporary wiring placeholder, which this shell no
 *   longer references (Systems deletes the placeholder function
 *   separately). The modes coincide right after the upgrade in
 *   normal play (the upgrade consumes the small basket); they
 *   diverge only if she later holds both baskets at once.
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
 *   eat() — one item, nutrition from its table (berries 10 /
 *   15, cooked acorns 20, lane-decided), stage refreshes at
 *   once. Raw acorns never reach eat(): their press shows
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
 *   it would duplicate the item). Every placed fire gets an
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
 *   slow method consumes 1 snap-wood kindling, but engine
 *   friction charges nothing — the mirror charges kindling
 *   only when snap-wood is carried (named in the friction
 *   menu hint), engine lighting proceeds regardless, and a
 *   kindling-less friction fire cooks once kindling is
 *   carried and Cook is pressed (the press retries and
 *   says so when it still can't). Cooking stays open-fire
 *   (stick or fire-buried, never pot cooking). CANDLE NOTE:
 *   the avatar / portrait candle is untouched, and nothing
 *   here assumes the candle lights fires — that relation
 *   is flagged open for Adam's call.
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
 *   player position, and FPS — rendered outside the
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
 *   also closes both panels, so one tap fully reclaims the
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
 *   signal): grant what fits, take exactly that much
 *   (partial, remainder stays), then refresh + save +
 *   feedback; missing pile grants nothing, full pack takes
 *   nothing + note. LIMITS: touch USE only
 *   (desktop has no USE affordance — desktop pile pickup
 *   needs a button or a key, follow-up); if piles should
 *   outrank ground outright, that is a one-line priority
 *   change for Adam's call.
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
 *   keep the old template. FOLLOW-UP, NOT CHANGED: the menu
 *   header line still reads "Nearby stations: workstation,
 *   loom" — it lists station contexts, not kinds, so it
 *   stays truthful but still does not name the stump.
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
 * - INVENTORY DROP V1, LIVE (Adam, 2026-10-26 — "for next
 *   pass"): every personal inventory row gains a Drop button
 *   (storage rows never get one). One item per press, dropped
 *   at her feet as a ground pile in the same pile system as
 *   overflow — merges by item at the same spot, pick-up-able
 *   later via the pile USE trigger. Shell wiring: Systems'
 *   dropFromInventory(item, 1) validates + removes, then the
 *   shell hands the record to pileState.drop() (no
 *   pileState.spawn exists; drop() is the spawn equivalent
 *   and emits pile:dropped for tracker + renderer). A failed
 *   drop leaves the inventory exact (Systems builds the
 *   record before removing; remove() throws before mutating).
 *   Dropped piles ride the pending pile save wiring; no
 *   separate save handling invented. Worn garments drop
 *   without unwearing (mirroring deposit: bonus self-cancels
 *   at count 0, returns on pickup). Quantity choice: one per
 *   press, per the brief and Systems' V1 note — unless Adam
 *   corrects it.
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
 *   (new PausedIndicator, bottom-centre above the LocationChip,
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
 *   merge #5 on hold until everything is built): piles are no
 *   longer session-only. saveNow passes pileState.snapshot()
 *   (mapped to item/quantity/x/z, the id dropped) as
 *   draft.piles, so serializeSave writes them normalized,
 *   order preserved, never merged; boot restore, inside the
 *   saveRestoredRef guard after the renderer exists, drops
 *   each saved pile back through pileState.drop() (merge-safe,
 *   emits pile:dropped for tracker + renderer visuals; the
 *   100 ms moved tick then surfaces in-range piles). The
 *   guard also protects against a double restore doubling
 *   quantities (drop merges by id). Regenerate clears piles
 *   via setWorldGen and the next save snapshots the empty
 *   set — a new world is a new pile set, by design. Old
 *   saves load piles: []. App.tsx only; no format change
 *   (SaveData.piles already existed).
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
  stationPresence,
} from './game/harvest';
import { BIOME_BY_ID } from './game/biomes';
import {
  fireState,
  type PlacedFire,
  type FireResult,
} from './game/fireState';
import { loomState } from './game/loomState';
import { pileState, type PileTarget } from './game/pileState';
import { trapState } from './game/trapState';
import type { TrapType } from './game/traps';
import { SOURCE_BY_ID, type ToolTier } from './game/objects';
import type { FireType } from './game/fire';
import {
  shelterState,
  shelterAt,
  HOUSE_DEFS,
  type HouseType,
} from './game/shelter';
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
import { Wardrobe, GARMENTS } from './systems/clothes';
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
import type { ContextAction } from './ui/types';
import { TouchControls } from './ui/TouchControls';
import { LocationChip } from './ui/LocationChip';
import { PausedIndicator } from './ui/PausedIndicator';
import { Popup } from './ui/Popup';
import {
  OptionsModal,
  fontClassFor,
  loadFontChoice,
  saveFontChoice,
  type FontId,
} from './ui/OptionsModal';
import { InventoryPanel } from './ui/InventoryPanel';
import { CraftingMenu } from './ui/CraftingMenu';
import { ProximityHarvestButtons } from './ui/ProximityHarvestButtons';
import { InteractionProgress } from './ui/InteractionProgress';
import { ObjectFeedback } from './ui/ObjectFeedback';
import { WorldAnchor } from './ui/WorldAnchor';
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
} from './systems/inventory';
import {
  dropFromInventory,
  handlePilePickupRequest,
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
  loadSave,
  saveGame,
  serializeSave,
  type SaveData,
} from './systems/save';
import { clothingRemaining } from './game/weather';
import {
  ownedTier,
  ownedToolItem,
  type OwnedToolItem,
} from './systems/owned-tool';
import { canCraft } from './systems/crafting';
import { ITEMS, RECIPES, type CraftingStation } from './systems/recipes';

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

/** Item ids the inventory panel offers a Place button for. */
const PLACEABLE_IDS: ReadonlySet<string> = new Set([
  ...Object.keys(FIRE_ITEM_TO_TYPE),
  ...Object.keys(HOUSE_ITEM_TO_TYPE),
  ITEMS.loom,
]);

const FIRE_NAME: Record<FireType, string> = {
  campfire: 'Campfire',
  hearth: 'Hearth',
  kiln: 'Kiln',
  bloomery: 'Bloomery',
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

/** Engine house type → Systems house item (for HomeStorage). */
const HOUSE_TYPE_TO_ITEM: Record<HouseType, string> = {
  leanTo: ITEMS.primitiveLeanTo,
  thatchHut: ITEMS.thatchHut,
  wovenCottage: ITEMS.wovenCottage,
  smallWoodenHut: ITEMS.smallWoodenHut,
};

/** One inventory stack as a panel row, with the umbrella icon attached. */
function toInventoryItem(stack: {
  item: string;
  quantity: number;
}): InventoryItem {
  return {
    id: stack.item,
    // Display spelling, never the raw code id (Adam, 2026-10-26:
    // code spelling lives in code, display spelling lives in
    // the systems table). The id stays the key for actions.
    name: displayNameFor(stack.item),
    quantityText: String(stack.quantity),
    icon: stack.item === UMBRELLA_ITEM_ID ? <UmbrellaIcon /> : undefined,
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
  const [dropNote, setDropNote] = useState<string | null>(null);
  const [storageNote, setStorageNote] = useState<string | null>(null);

  const [seedInput, setSeedInput] = useState(bootSave?.seed ?? DEFAULT_SEED);
  const [seed, setSeed] = useState(bootSave?.seed ?? DEFAULT_SEED);
  const [cameraMode, setCameraMode] = useState<CameraMode>(
    bootSave?.cameraMode ?? 'third',
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
  // In-range dropped piles (harvest overflow), nearest first per
  // the tracker. Drives the touch USE fallback and the desktop
  // pickup button (see handleTouchInteract + the desktop pile
  // computation before return); piles get no screen of their own.
  const [piles, setPiles] = useState<PileTarget[]>([]);
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
  const [placement, setPlacement] = useState<PlacementMode | null>(null);
  const [placementAnchor, setPlacementAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [placementNote, setPlacementNote] = useState<string | null>(null);
  const placementRef = useRef<PlacementMode | null>(null);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() =>
    inventory.stacksSnapshot().map(toInventoryItem),
  );
  const [capacityText, setCapacityText] = useState(
    () => `Carrying ${inventory.used()} / ${inventory.capacity()}`,
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
    setInventoryItems(inventory.stacksSnapshot().map(toInventoryItem));
    setCapacityText(
      `Carrying ${inventory.used()} / ${inventory.capacity()}`,
    );
    // UMBRELLA DRIVING: every inventory change flows through
    // here (harvest, craft, eat, cook, place, wear, deposit,
    // drop, pile pickup), so the carried-umbrella graphic
    // tracks the live inventory — no equip step, duplicates
    // do not stack, one boolean to the renderer. Guarded:
    // refreshInventory is never called before boot, but the
    // ?. keeps an early call from crashing.
    rendererRef.current?.setCarriesUmbrella(carriesUmbrella(inventory));
  };

  // Save meta mirror: seed / camera / position as of the latest
  // render, so saveNow() stays correct even when called from a
  // first-render closure (the boot effect's listeners, pagehide).
  // Live instances (inventory, hunger, wardrobe) and the engine
  // singletons are read directly, never mirrored.
  const saveMetaRef = useRef({
    seed: DEFAULT_SEED,
    cameraMode: 'third' as CameraMode,
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
      saveGame(
        serializeSave({
          seed: meta.seed,
          cameraMode: meta.cameraMode,
          position: player
            ? { x: player.x, z: player.z }
            : meta.position,
          inventory: inventory.stacksSnapshot(),
          hunger: hunger.value(),
          worn: wardrobe.wornItemIds(),
          fires: fireState.snapshot().map((fire) => ({
            type: fire.type,
            x: fire.x,
            z: fire.z,
            lit: fire.lit,
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
          // PILE SAVE WIRING: the live pile set rides every
          // save (id dropped — serializeSave rebuilds nothing
          // from it; it writes item/quantity/x/z normalized,
          // order preserved, never merged).
          piles: pileState.snapshot().map((pile) => ({
            item: pile.item,
            quantity: pile.quantity,
            x: pile.x,
            z: pile.z,
          })),
        }),
      );
    } catch {
      // Saving must never break play.
    }
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
    const fires: { fire: PlacedFire; x: number; y: number }[] = [];
    for (const fire of fireState.snapshot()) {
      const anchor = projectAnchor(fire.x, fire.z, 'scatter');
      if (!anchor) continue;
      fires.push({ fire, x: anchor.x, y: anchor.y });
    }
    setFireAnchors(fires);
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
  // singleton placements (fires / houses / looms) are re-placed
  // from the save, the player is moved to the saved point, and
  // the HUD re-reads from the restored singletons below. House
  // contents ride by order (placeHouse regenerates ids — see
  // save.ts). Restored fires come back UNLIT (no game-layer API
  // marks a fire lit; she re-lights them) and their Systems
  // vessels are created lazily, unlit, on first use — consistent.
  const saveRestoredRef = useRef(false);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const gen = genRef.current;
    const player = new PlayerController(gen.findSpawn());
    const renderer = new WorldRenderer(container, gen, player);
    player.attach(renderer.domElement);
    rendererRef.current = renderer;
    playerRef.current = player;
    if (!saveRestoredRef.current) {
      saveRestoredRef.current = true;
      const saved = bootSaveRef.current;
      if (saved) {
        for (const fire of saved.fires) {
          try {
            // Cast: deserializeSave already allowlisted the type.
            fireState.placeFire(fire.type as FireType, fire.x, fire.z);
          } catch {
            // A placement that cannot restore is skipped, not fatal.
          }
        }
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
        // PILE SAVE WIRING: re-place each saved pile through
        // pileState.drop() — merge-safe by id, and it emits
        // pile:dropped, so the tracker and the renderer pile
        // group pick the restored piles up (the tracker's
        // 100 ms moved tick surfaces the in-range set once
        // the loop runs at the restored position). Saved
        // piles are deserialize-validated (normalized ids,
        // positive quantities, finite coords); drop() returns
        // null for anything invalid instead of throwing, so
        // no skip rule is needed here. Inside the
        // saveRestoredRef guard, so a second boot-effect run
        // cannot double-drop (drop merges, which would double
        // quantities). Runs after the renderer exists, so
        // setWorldGen's pile clear cannot wipe the restore.
        for (const pile of saved.piles) {
          pileState.drop(pile.item, pile.quantity, pile.x, pile.z);
        }
        player.x = saved.position.x;
        player.z = saved.position.z;
      }
    }
    // UMBRELLA DRIVING: initial visibility from the boot
    // inventory — a restored umbrella shows, no umbrella
    // leaves the renderer's default hidden standing. Later
    // inventory changes drive it via refreshInventory above.
    renderer.setCarriesUmbrella(carriesUmbrella(inventory));
    // Hunger wiring (see the header): the engine reads the stage
    // through this query — movement slowdown + harvest lockout.
    player.setHungerStageQuery(() => hunger.stage());
    setPosition({ x: player.x, z: player.z });
    setBiomeText(formatWeights(gen.weightsAt(player.x, player.z)));
    bus.emit('world:seedSet', { seed: gen.seed });
    // HUD re-read after a restore (the placedFires initial state
    // was snapshotted before this effect re-placed anything).
    setPlacedFires(fireState.snapshot());
    applyShelterHouse(
      shelterAt(player.x, player.z, shelterState.snapshot()).houseId,
    );
    recomputeAnchors();

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
    });
    const offLooked = bus.on('player:looked', () => {
      recomputeAnchors();
    });
    const offInRange = bus.on('harvest:inRange', ({ targets }) => {
      busTargetsRef.current = targets;
      recomputeAnchors();
    });
    const offPiles = bus.on('piles:inRange', ({ piles: inRange }) => {
      setPiles(inRange);
    });
    // Systems' 'pile:pickup-requested' listener (see the header
    // + systems/piles.ts): the SOLE granter on the event since
    // the shell bridge came out (b23a042). Behavior mirrors
    // the bridge exactly — missing pile: silent nothing; full
    // pack: Pack-full note, no take, no refresh/save; grant:
    // refresh + save + Picked-up feedback, anchored at the pile.
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
              `Pack full — no room for ${displayNameFor(outcome.item)}.`,
              'blocked',
              anchor.x,
              anchor.y,
            );
          }
          return;
        }
        refreshInventory();
        saveNow();
        if (anchor) {
          showFeedback(
            `Picked up ${outcome.granted} ${displayNameFor(outcome.item)}.`,
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
    // HUD stage, and advance friction lighting waits (display:
    // 'waiting' → 'ready' once the wait passes). setHungerStage
    // with an unchanged stage bails out in React, so
    // steady-state ticks cost no re-render.
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
      fireState.advanceLighting(Date.now());
      // Drive every tracked Systems fire's lighting clock
      // alongside the engine's (the bridge's tick half).
      for (const systemsFire of systemsFiresRef.current.values()) {
        systemsFire.tick(1);
      }
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
    const offFireLit = bus.on('fire:lit', refreshFires);
    const offShelterPlaced = bus.on('shelter:placed', () => {
      const p = playerRef.current;
      if (!p) return;
      const s = shelterAt(p.x, p.z, shelterState.snapshot());
      applyShelterHouse(s.houseId);
    });
    const offShelterChanged = bus.on('shelter:changed', ({ houseId }) => {
      applyShelterHouse(houseId);
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
      offFireLit();
      offShelterPlaced();
      offShelterChanged();
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

  const regenerate = () => {
    const nextSeed = seedInput.trim() || DEFAULT_SEED;
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
    setBiomeText(formatWeights(gen.weightsAt(spawn.x, spawn.z)));
    bus.emit('world:seedSet', { seed: nextSeed });
    recomputeAnchors();
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
  const availableStations: CraftingStation[] = [];
  if (stationPresenceValue.workstation) {
    availableStations.push('workstation');
  }
  if (stationPresenceValue.loom) {
    availableStations.push('loom');
  }
  const stationNote =
    availableStations.length === 0
      ? 'No station nearby'
      : `Nearby station${availableStations.length > 1 ? 's' : ''}: ${availableStations.join(', ')}`;

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
      canCraft: check.ok,
      availabilityNote,
      icon:
        recipe.output.item === UMBRELLA_ITEM_ID ? (
          <UmbrellaIcon />
        ) : undefined,
    };
  });

  // CRAFTING GROUPS: sections in DEV's group order, each filtered
  // from the recipe-ordered menu rows above (never re-sorted);
  // empty groups dropped here, and the menu drops them again
  // defensively. Unmapped recipes (none today — all 38 map)
  // trail under "Other" instead of vanishing.
  const ungroupedRecipes = craftingRecipes.filter(
    (recipe) => CRAFTING_GROUP_BY_RECIPE_ID[recipe.id] === undefined,
  );
  const craftingSections = [
    ...CRAFTING_GROUP_ORDER.map((title) => ({
      title,
      recipes: craftingRecipes.filter(
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

  const executeCraftNow = (recipeId: string) => {
    const recipe = RECIPES.find((candidate) => candidate.id === recipeId);
    if (!recipe) return;
    const ownedBefore = ownedToolItem(inventory);
    try {
      // Trap crafts place at her feet (Systems' place path):
      // the shell passes position + a placer on every craft
      // (harmless for ordinary grants — executeCraft ignores it
      // unless the recipe places a trap). For traps this runs
      // only on the confirm's Yes — the Popup above gates first,
      // No/Close never reaches execution. SEAM (Background's
      // placed-trap landing 8e5da78): the placer is trapState.
      // placeTrap — it STORES the trap and emits 'trap:placed',
      // and the renderer reads trapState. NEVER a raw bus.emit
      // here: an event without the trapState record would leave
      // renderer and state diverged. Exactly one placer per
      // craft: this callback, via executeCraft — never both.
      // RESTORED 2026-10-26: UI's forage-hints push (d500416)
      // clobbered this wiring (whole-file push from a
      // pre-placement App) — without it trap crafts throw for
      // missing placement context and nothing places.
      const result = executeCraft(
        recipe,
        inventory,
        availableStations.length > 0 ? availableStations : null,
        hunger,
        {
          x: position.x,
          z: position.z,
          emitTrapPlaced: (payload) =>
            trapState.placeTrap(
              payload.type as TrapType,
              payload.x,
              payload.z,
            ),
        },
      );
      setOwnedItem(result.owned);
      setCraftNote(
        result.placedTrap
          ? `Placed ${displayNameFor(result.output.item)} here.`
          : `Crafted ${result.output.item} × ${result.output.quantity}.` +
              (result.owned !== ownedBefore
                ? ` Owned tool is now ${result.owned}.`
                : ''),
      );
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

  const handlePlaceItem = (itemId: string) => {
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
    try {
      const result = eat(hunger, inventory, itemId);
      setHungerStage(result.stage);
      setEatNote(`Ate ${result.item} (+${result.nutrition} hunger).`);
    } catch (error) {
      setEatNote(
        error instanceof Error ? error.message : 'Could not eat that.',
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

  // INVENTORY DROP V1 (Adam, 2026-10-26 — "for next pass"):
  // one item per press, dropped at her feet as a ground pile
  // in the same pile system as overflow (merges by item at
  // the same spot, pick-up-able later via the pile USE
  // trigger). Systems validates + removes first — the pile
  // record is built before the removal and remove() throws
  // before mutating on insufficiency, so a failed drop leaves
  // the inventory exactly as it was — then the shell hands
  // the record to pileState.drop(), the spawn equivalent
  // (no pileState.spawn exists; drop() creates/merges and
  // emits pile:dropped for the tracker + renderer). Dropped
  // piles ride the pending pile save wiring like overflow
  // piles; no separate save handling is invented here.
  // Worn garments drop like anything else (no unwear —
  // mirroring deposit: the worn bonus already self-cancels
  // when the carried count hits 0 via the setWorn re-sync,
  // and returns if the garment is picked back up).
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
   * ('sticks') consumes 1 snap-wood as kindling, but the
   * engine friction path charges nothing — so the mirror
   * charges kindling only when snap-wood is carried, and
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
      // friction start without snap-wood kindling simply
      // leaves the vessel unlit until Cook retries it.
    }
  };

  /** Lighting + cooking menu actions for one placed fire. */
  const fireMenuActions = (fire: PlacedFire): ContextAction[] => {
    if (fire.lit) {
      const hasAcorns = inventory.count(FOOD_ACORNS) > 0;
      return [
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
        hint: 'Rub, wait, rub · 1 snap-wood kindling readies it for cooking',
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
    capacityBonus > 0 ? `Carrying bonus +${capacityBonus}` : undefined;
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
              : `Stored ${openHomeStore.used()} / ${openHomeStore.capacity()}`,
          note: storageNote,
          onWithdrawItem: handleWithdrawItem,
        }
      : undefined;

  // The fire whose lighting menu is open, with its anchor.
  const selectedFire =
    selectedFireId === null
      ? undefined
      : placedFires.find((f) => f.id === selectedFireId);
  const selectedFireAnchor =
    selectedFire === undefined
      ? null
      : (fireAnchors.find((a) => a.fire.id === selectedFire.id) ?? null);

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
  const [optionsOpen, setOptionsOpen] = useState(false);
  const handleFontChange = (next: FontId): void => {
    setFont(next);
    saveFontChoice(next);
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

  // USE / still-tap interact: the nearest in-range object,
  // pressed through the engine's pressUse (which fires the
  // existing harvest:requested event; the outcome listener
  // re-validates range + permit, so a stale press fails
  // safely). The tracker emits the ground target FIRST when
  // eligible, so scatter is preferred and ground is the
  // fallback — USE never harvests dirt while a bush is in
  // range. With no target at all, pressUse is not called
  // (menus and HUD buttons stay direct taps).
  //
  // PILE FALLBACK (Adam, 2026-10-26): no new buttons, no new
  // screen — a pile in range is picked up by this same USE
  // press when no harvest target is nearer. The tracker sorts
  // piles nearest first, so piles[0] is the nearest pile; the
  // harvest candidate's distance comes from the raw bus target
  // (the UI target shape carries no distance field), falling
  // back to a shell-computed distance if the bus entry is gone.
  // The pile wins on a tie (no harvest target is NEARER then)
  // — which matters because ground sits at distance 0: a pile
  // she stands on ties ground and wins, while a pile farther
  // than her feet loses to ground. Consequence, stated
  // plainly: in third/behind with no scatter, ground is
  // eligible at distance 0, so only a pile at her feet is
  // reachable by USE; in first-person looking level, any
  // in-range pile nearer than the scatter target wins. If piles
  // should outrank ground outright, that is a one-line priority
  // change for Adam's call, not this landing's.
  // NOTE: this is the touch USE path only. Desktop has no USE
  // affordance (harvest is by button click), so desktop pile
  // pickup is a visible button instead — see DESKTOP PILE
  // PICKUP in the header and the computation before return.
  // Touch keeps USE; the button is desktop-only.
  const handleTouchInteract = (): void => {
    const player = playerRef.current;
    const target =
      harvestTargets.find((candidate) => candidate.kind === 'scatter') ??
      harvestTargets[0];
    if (!player) return;
    const pile = piles[0];
    if (pile) {
      const candidateDistance = target
        ? (busTargetsRef.current.find((t) => t.id === target.id)?.distance ??
          Math.hypot(target.worldX - player.x, target.worldZ - player.z))
        : Number.POSITIVE_INFINITY;
      if (pile.distance <= candidateDistance) {
        bus.emit('pile:pickup-requested', { pileId: pile.id });
        return;
      }
    }
    if (!target) return;
    player.pressUse({
      targetId: target.id,
      sourceId: target.sourceId,
      kind: target.kind,
      x: target.worldX,
      z: target.worldZ,
    });
  };

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

  // DESKTOP PILE PICKUP (see the header): the nearest pile,
  // but only when it would win under the touch USE rules —
  // otherwise the button would contradict what USE would do.
  // The tracker already limits piles to 2.5 m and sorts
  // nearest first, so piles[0] is the candidate; its
  // distance is the tracker's, and the harvest candidate is
  // the same scatter-first pick handleTouchInteract uses
  // (bus distance, shell-computed fallback from position
  // state, which re-renders on the 10 Hz moved tick — so the
  // button appears and disappears as she moves). Null on
  // touch (USE already exists there) and null when a nearer
  // harvest target wins: harvest that first, then the pile
  // button appears. Pressing emits pile:pickup-requested;
  // Systems' listener grants, the existing subscriber
  // refreshes, saves, and feeds back.
  const desktopPileTarget =
    harvestTargets.find((candidate) => candidate.kind === 'scatter') ??
    harvestTargets[0];
  const desktopPileCandidateDistance = desktopPileTarget
    ? (busTargetsRef.current.find((t) => t.id === desktopPileTarget.id)
        ?.distance ??
      Math.hypot(
        desktopPileTarget.worldX - position.x,
        desktopPileTarget.worldZ - position.z,
      ))
    : Number.POSITIVE_INFINITY;
  const desktopPilePickup =
    !isTouch &&
    piles.length > 0 &&
    piles[0].distance <= desktopPileCandidateDistance
      ? piles[0]
      : null;

  return (
    <div
      className={
        'relative w-full h-screen bg-[#121612] overflow-hidden text-[#f0ead6] ' +
        fontClassFor(font)
      }
    >
      {/* 3D viewport */}
      <div ref={containerRef} className="absolute inset-0" />

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
                  onSelect={() => {
                    if (fire.lit) {
                      showFeedback(`${FIRE_NAME[fire.type]} lit.`, 'info', x, y);
                    } else {
                      setSelectedFireId(fire.id);
                    }
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
            <ContextMenu
              objectName={FIRE_NAME[selectedFire.type]}
              actions={fireMenuActions(selectedFire)}
              onSelect={(id) => handleFireAction(selectedFire.id, id)}
              onClose={() => setSelectedFireId(null)}
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
        {feedbacks.map((feedback) => (
          <Fragment key={feedback.id}>
            <WorldAnchor x={feedback.x} y={feedback.y}>
              <ObjectFeedback text={feedback.text} tone={feedback.tone} />
            </WorldAnchor>
          </Fragment>
        ))}
        {progressItems.map((item) => (
          <Fragment key={item.targetId}>
            <WorldAnchor x={item.x} y={item.y}>
              <InteractionProgress
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
        The column itself positions just above screen middle;
        see ProximityHarvestButtons. */}
      <div className="pointer-events-none absolute inset-0 z-40">
        <ProximityHarvestButtons
          targets={harvestTargets}
          onHarvest={handleHarvest}
          onRemove={handleRemove}
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
            Pick up {displayNameFor(desktopPilePickup.item)} ×{' '}
            {desktopPilePickup.quantity}
          </button>
        ) : null}
      </div>

      {/* HUD shell: needs row (awaiting survival systems) + HUD block. */}
      <HudShell hideNeeds={isTouch && hudCollapsed}>
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
              onClick={() => setInventoryOpen((open) => !open)}
              aria-pressed={inventoryOpen}
              className={
                isTouch
                  ? 'rounded bg-[#3a4436] px-3 py-2 text-sm min-h-[44px] hover:bg-[#4a5546]'
                  : 'rounded bg-[#3a4436] px-3 py-1 text-xs hover:bg-[#4a5546]'
              }
            >
              Inventory
            </button>
            <button
              type="button"
              onClick={() => setCraftingOpen((open) => !open)}
              aria-pressed={craftingOpen}
              className={
                isTouch
                  ? 'rounded bg-[#3a4436] px-3 py-2 text-sm min-h-[44px] hover:bg-[#4a5546]'
                  : 'rounded bg-[#3a4436] px-3 py-1 text-xs hover:bg-[#4a5546]'
              }
            >
              Crafting
            </button>
            <button
              type="button"
              onClick={() => setOptionsOpen(true)}
              className={
                isTouch
                  ? 'rounded bg-[#3a4436] px-3 py-2 text-sm min-h-[44px] hover:bg-[#4a5546]'
                  : 'rounded bg-[#3a4436] px-3 py-1 text-xs hover:bg-[#4a5546]'
              }
            >
              Options
            </button>
          </div>
          <div className="mt-3">
            <WitchHealth />
          </div>
          <div className="mt-2">
            <HungerIndicator stage={hungerStage} />
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
              <StationPanel
                stationKind="stump"
                actions={[
                  {
                    id: 'craft',
                    label: 'Craft',
                    onSelect: () => setCraftingOpen(true),
                  },
                ]}
                comfortable={isTouch}
              />
            </div>
          ) : null}
          {placement ? (
            <div className="mt-2 rounded bg-black/50 px-2 py-1 text-sm">
              <p>Placing {placement.label} at your feet.</p>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={handlePlaceConfirm}
                  className={
                    isTouch
                      ? 'rounded bg-[#3a4436] px-3 py-2 text-sm min-h-[44px] hover:bg-[#4a5546]'
                      : 'rounded bg-[#3a4436] px-2 py-0.5 text-xs hover:bg-[#4a5546]'
                  }
                >
                  Place here
                </button>
                <button
                  type="button"
                  onClick={handlePlaceCancel}
                  className={
                    isTouch
                      ? 'rounded bg-[#3a4436] px-3 py-2 text-sm min-h-[44px] hover:bg-[#4a5546]'
                      : 'rounded bg-[#3a4436] px-2 py-0.5 text-xs hover:bg-[#4a5546]'
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
              className="min-h-[44px] rounded bg-[#3a4436] px-3 py-2 text-sm hover:bg-[#4a5546]"
            >
              Show HUD
            </button>
            <button
              type="button"
              onClick={() => setInventoryOpen((open) => !open)}
              aria-pressed={inventoryOpen}
              className="min-h-[44px] rounded bg-[#3a4436] px-3 py-2 text-sm hover:bg-[#4a5546]"
            >
              Inventory
            </button>
            <button
              type="button"
              onClick={() => setCraftingOpen((open) => !open)}
              aria-pressed={craftingOpen}
              className="min-h-[44px] rounded bg-[#3a4436] px-3 py-2 text-sm hover:bg-[#4a5546]"
            >
              Crafting
            </button>
            <button
              type="button"
              onClick={() => setOptionsOpen(true)}
              className="min-h-[44px] rounded bg-[#3a4436] px-3 py-2 text-sm hover:bg-[#4a5546]"
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
            // so Hide also closes both panels. Panel state is
            // view-only — inventory, crafting, and wardrobe
            // state live on, reopening restores the same rows.
            onClick={() => {
              setHudCollapsed(true);
              setInventoryOpen(false);
              setCraftingOpen(false);
            }}
            aria-label="Hide HUD panels to reveal the game"
            className="pointer-events-auto absolute right-2 top-2 z-40 min-h-[44px] rounded bg-black/50 px-3 py-2 text-sm"
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
        {inventoryOpen ? (
          <InventoryPanel
            items={inventoryItems}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            placeableIds={PLACEABLE_IDS}
            onPlaceItem={handlePlaceItem}
            foodIds={FOOD_IDS}
            onEatItem={handleEatItem}
            storage={storageSection}
            onDepositItem={handleDepositItem}
            onDropItem={handleDropItem}
            capacityText={capacityText}
            onClose={() => setInventoryOpen(false)}
            comfortable={isTouch}
          />
        ) : null}
        {craftingOpen ? (
          <CraftingMenu
            recipes={craftingRecipes}
            sections={craftingSections}
            stationNote={stationNote}
            comfortable={isTouch}
            selectedRecipeId={selectedRecipeId}
            onSelectRecipe={setSelectedRecipeId}
            onCraft={handleCraft}
            onClose={() => setCraftingOpen(false)}
          />
        ) : null}
        {craftNote ? (
          <p className="rounded bg-black/50 px-2 py-1 text-xs text-stone-200">
            {craftNote}
          </p>
        ) : null}
        {eatNote ? (
          <p className="rounded bg-black/50 px-2 py-1 text-xs text-stone-200">
            {eatNote}
          </p>
        ) : null}
        {dropNote ? (
          <p className="rounded bg-black/50 px-2 py-1 text-xs text-stone-200">
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
          className="bg-[#1e241c] border border-[#3a4436] px-2 py-1 text-xs w-48 outline-none"
        />
        <button
          onClick={regenerate}
          className="bg-[#3a4436] hover:bg-[#4a5546] px-3 py-1 text-xs"
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
          onInteract={handleTouchInteract}
        />
      ) : null}

      {/* Options modal (tabbed; Settings first: font + perspective). */}
      {optionsOpen ? (
        <OptionsModal
          font={font}
          onFontChange={handleFontChange}
          perspective={cameraMode}
          onPerspectiveChange={(picked) => cycleToCamera(picked)}
          onClose={() => setOptionsOpen(false)}
          comfortable={isTouch}
        />
      ) : null}

      {/* Trap-craft confirm: Adam's words, verbatim, asked FIRST
        on trap Craft — Yes runs the existing execution, No or
        Close aborts with nothing consumed and no trap. The
        Popup shell is the staged dialog (z-50 modal); the
        buttons match the placement banner's touch sizing. */}
      {pendingTrapRecipe ? (
        <Popup
          open={true}
          title="PLACE TRAP HERE?"
          onClose={handleTrapConfirmNo}
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
                  ? 'min-h-[44px] rounded bg-[#3a4436] px-3 py-2 text-sm hover:bg-[#4a5546]'
                  : 'rounded bg-[#3a4436] px-2 py-0.5 text-xs hover:bg-[#4a5546]'
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

      {/* Location chip: always visible, including with the HUD
        collapsed on touch (it lives outside the collapsible
        stack). It hides only while a panel or the modal is
        open, where it would sit on top of the bottom sheet. */}
      {!inventoryOpen && !craftingOpen && !optionsOpen ? (
        <LocationChip
          x={position.x}
          z={position.z}
          biomeName={dominantBiome.name}
          biomePercent={dominantBiome.percent}
          fps={fps}
        />
      ) : null}

      {/* Paused control: only while the engine flag is set. It
        renders regardless of panels (a global state control,
        not a panel). The wrapper is pointer-events-none, but
        the button itself takes its own tap — that tap is the
        resume (tap-to-resume, pinned). */}
      {paused ? (
        <PausedIndicator onResume={() => pauseState.setPaused(false)} />
      ) : null}

      {/* Camera transition overlay (vignette at rest, fade on switch). */}
      <CameraTransition switching={switching} />
    </div>
  );
}
