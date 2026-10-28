// FIND CAMP divination (Adam, DEV chat 2026-10-27).
//
// FIRST starting-divination feature: scrying in still water
// reveals her camps as big obnoxious arrows pointing down
// from above, one per camp, on screen (Adam's words, pinned
// shape — the arrows themselves are Background's renderer
// work, not this file).
//
// AMENDMENT BUILT, TRIGGER BRIEF SUPERSEDED: Adam's later
// word ("Maybe we'll let her discover that naturally, as
// she approaches water") supersedes the original pressed-
// Scry-action brief (DEV resolution, 2026-10-27). There is
// NO Scry button, NO menu entry, NO pressed action, NO
// tutorial popup in this design. The scry IS the approach:
// as she approaches still water, the arrows appear
// (Noticing spirit — the arrows are the reveal). This file
// therefore provides a PROXIMITY EVALUATION + arrow state,
// not a pressed action. If DEV redirects back to a trigger,
// the evaluation below still serves (call it on press).
//
// VEHICLE (Adam): WATER — she scries in still water.
// Ponds + river both count as still water for this purpose
// (Adam's parenthetical). NO other cost is specified — do
// not invent an offering cost. No hunger gate either:
// the evaluation is passive (no action is pressed), and
// divination is not a build.
//
// CAMPS (DEV reading, stated plainly — Adam can redirect):
// placed HOUSES (lean-to, hut, cottage, wooden hut — where
// she camps), ALL of them. NOT campfires (fires already
// have chips; if Adam wants fires included, he will say
// so). No house-type filtering: every placed house is a
// camp. House positions arrive as INPUT (shelterState
// snapshot — Background owns placed-house state; systems
// never imports game modules, so this file takes the list
// structurally and maps it to positions only).
//
// WATER INPUT (lane boundary): Background adapts its water
// bodies into StillWaterBody circles — ponds as their
// circle, the river as centerline samples (RIVER_STEP apart,
// radius RIVER_WIDTH / 2) — and the shell passes that list
// in. Systems owns the RULE (SCRY_WATER_RANGE below), not
// the water data: the game layer decides what counts as
// water, this file decides how close counts as "at" it.
// If Background prefers to compute proximity itself, it
// must match this rule (edge distance <= SCRY_WATER_RANGE).
//
// PROXIMITY RULE (lane-decided, flagged for pin pass):
// SCRY_WATER_RANGE = 2.5 m from the water's EDGE (edge
// distance = center distance minus radius, clamped at 0 —
// standing in the water is distance 0). 2.5 mirrors
// HARVEST_RANGE (the game's interaction feel). BANK-SIDE
// gate, deliberately: water bodies are VISIBLE only (no
// swimming/wading mechanics in their order), so requiring
// her to stand IN the water mesh would gate the feature
// behind movement that does not exist — the bank counts
// as "at the water" for scrying.
//
// ARROW STATE (lane-decided, flagged for pin pass):
// REVEAL PERSISTS UNTIL ARRIVAL OR DISMISS — no timer, no
// toggle button. Rationale: a timer would strand her
// mid-route (the arrows exist to guide her HOME — they
// must survive the journey away from the water), and the
// amendment forbids a trigger button, so arrival is the
// buttonless off-switch: revealed arrows hide when she
// arrives at any revealed camp, and re-approaching water
// re-reveals (refreshing the set — new houses built since
// count). dismiss() also exists for any future shell
// wiring (e.g. a Hide option), but nothing requires it.
// Arrival = within CAMP_ARRIVAL_RADIUS of a revealed camp
// (mirrors SHELTER_RADIUS by literal: entering a camp's
// shelter zone means she found camp).
//
// SHELL FLOW (proposal for App wiring — DEV disposes):
// on 'player:moved', the shell calls evaluateCampReveal
// with her position + Background's water list + the house
// snapshot. If shown and not already revealed (or the set
// changed), CampDivination.reveal(camps) + renderer shows
// the arrows. If already revealed and arrivedAt(position),
// CampDivination.dismiss() + renderer hides them. The
// renderer call itself (e.g. setCampArrows) is Background's
// API, not this file's. Off-screen-camp edge indication is
// Background's arrow-rendering decision, not Systems'.
//

/** A still-water body, normalized for the proximity rule. */
export interface StillWaterBody {
  x: number;
  z: number;
  /** Circle radius in meters (pond radius, or river half-width). */
  radius: number;
}

/**
 * How close to still water counts as "at" it, in meters
 * from the water's edge. Mirrors HARVEST_RANGE (2.5).
 * Lane-decided, flagged for Adam's pin pass.
 */
export const SCRY_WATER_RANGE = 2.5;

/**
 * Shortest distance from (px, pz) to any still water's
 * edge, in meters. 0 when standing in (or on) the water.
 * Infinity when no water bodies are supplied.
 */
export function distanceToStillWater(
  px: number,
  pz: number,
  waters: ReadonlyArray<StillWaterBody>,
): number {
  let best = Infinity;
  for (const water of waters) {
    if (!Number.isFinite(water.x) || !Number.isFinite(water.z)) continue;
    if (!Number.isFinite(water.radius) || water.radius < 0) continue;
    const centerDistance = Math.hypot(px - water.x, pz - water.z);
    const edgeDistance = Math.max(0, centerDistance - water.radius);
    if (edgeDistance < best) best = edgeDistance;
  }
  return best;
}

/** True when (px, pz) is at still water per SCRY_WATER_RANGE. */
export function isNearStillWater(
  px: number,
  pz: number,
  waters: ReadonlyArray<StillWaterBody>,
): boolean {
  return distanceToStillWater(px, pz, waters) <= SCRY_WATER_RANGE;
}

/**
 * How far away still water counts as "findable" for
 * the frog tier-1 effect, in meters from the water's
 * edge. DRAFT, flagged for Adam's pin pass. Matches
 * the stillWatersNear adapter range (50).
 */
export const FROG_WATER_RANGE = 50;

/** Nearest still water's direction + edge distance, or null. */
export interface NearestStillWater {
  /** Unit vector toward the nearest water body's edge point. */
  dx: number;
  /** Unit vector toward the nearest water body's edge point. */
  dz: number;
  /** Edge distance in meters (0 excluded — see below). */
  distance: number;
}

/**
 * Frog tier-1 fact (Track B 2026-10-28): nearest still
 * water within `range` (default FROG_WATER_RANGE) of
 * (px, pz), as a unit vector + edge distance — the
 * direction she should walk to reach water. Edge math
 * + validation mirror distanceToStillWater. Returns
 * null when no waters are supplied, when the nearest
 * edge lies beyond range, or when already at/in water
 * (edge distance 0 — no hint needed). Systems side is
 * the fact/API only; UI's hint display follows.
 */
export function nearestStillWater(
  px: number,
  pz: number,
  waters: ReadonlyArray<StillWaterBody>,
  range: number = FROG_WATER_RANGE,
): NearestStillWater | null {
  let best = Infinity;
  let bestDx = 0;
  let bestDz = 0;
  for (const water of waters) {
    if (!Number.isFinite(water.x) || !Number.isFinite(water.z)) continue;
    if (!Number.isFinite(water.radius) || water.radius < 0) continue;
    const dx = water.x - px;
    const dz = water.z - pz;
    const centerDistance = Math.hypot(dx, dz);
    const edgeDistance = Math.max(0, centerDistance - water.radius);
    if (edgeDistance < best) {
      best = edgeDistance;
      if (centerDistance > 0) {
        bestDx = dx / centerDistance;
        bestDz = dz / centerDistance;
      } else {
        bestDx = 0;
        bestDz = 0;
      }
    }
  }
  if (!Number.isFinite(best) || best === 0 || best > range) return null;
  return { dx: bestDx, dz: bestDz, distance: best };
}

/** A camp, as revealed: position only (arrows point, not label). */
export interface CampPosition {
  x: number;
  z: number;
}

/**
 * Every placed house is a camp: map the house list to camp
 * positions, in snapshot order, as copies (never aliases —
 * the caller may hold the result while houses change).
 * House type is deliberately ignored — all four house
 * types are camps.
 */
export function findCamps(
  houses: ReadonlyArray<{ x: number; z: number }>,
): CampPosition[] {
  return houses.map((house) => ({ x: house.x, z: house.z }));
}

/** The proximity evaluation's result. Silent by design: no reasons, no popups. */
export interface CampReveal {
  /** True only when near still water AND at least one camp exists. */
  shown: boolean;
  /** The camps to point at when shown; [] when hidden. */
  camps: CampPosition[];
}

/**
 * The FIND CAMP evaluation: approach still water with at
 * least one camp placed, and the camps are revealed. Far
 * from water, or with no camp placed, nothing is revealed
 * (hidden, silently — natural discovery shows nothing
 * when there is nothing to show).
 */
export function evaluateCampReveal(
  position: { x: number; z: number },
  waters: ReadonlyArray<StillWaterBody>,
  houses: ReadonlyArray<{ x: number; z: number }>,
): CampReveal {
  if (!isNearStillWater(position.x, position.z, waters)) {
    return { shown: false, camps: [] };
  }
  const camps = findCamps(houses);
  if (camps.length === 0) {
    return { shown: false, camps: [] };
  }
  return { shown: true, camps };
}

/**
 * Arriving at a revealed camp hides its arrows: within
 * this radius of a revealed camp, she found camp. Mirrors
 * game SHELTER_RADIUS (6) by literal — systems does not
 * import game modules. Lane-decided, flagged for pin pass.
 */
export const CAMP_ARRIVAL_RADIUS = 6;

/**
 * The revealed-arrow state: what the renderer is currently
 * pointing at (null = nothing revealed). reveal() refreshes
 * the set (re-approach re-reveals, new houses count);
 * dismiss() hides; arrivedAt() reports arrival at any
 * revealed camp (the buttonless off-switch).
 */
export class CampDivination {
  private revealed: CampPosition[] | null = null;

  /** Reveal (or refresh) the arrow set. Copies, never aliases. */
  reveal(camps: ReadonlyArray<CampPosition>): void {
    this.revealed = camps.map((camp) => ({ x: camp.x, z: camp.z }));
  }

  /** Hide the arrows (arrival, or any future shell wiring). */
  dismiss(): void {
    this.revealed = null;
  }

  /** True when arrows are currently revealed. */
  get isRevealed(): boolean {
    return this.revealed !== null;
  }

  /** The revealed camps as copies, or null when hidden. */
  get revealedCamps(): CampPosition[] | null {
    return this.revealed === null
      ? null
      : this.revealed.map((camp) => ({ x: camp.x, z: camp.z }));
  }

  /** True when (px, pz) is at any revealed camp (arrival). */
  arrivedAt(px: number, pz: number): boolean {
    if (this.revealed === null) return false;
    for (const camp of this.revealed) {
      if (Math.hypot(px - camp.x, pz - camp.z) <= CAMP_ARRIVAL_RADIUS) {
        return true;
      }
    }
    return false;
  }
}
