// PARTIAL TRUE NAMES (Adam, DEV chat 2026-10-27,
// solid-points round): the LOOK + partial-name STATE.
//
// A first LOOK at a thing yields only a PORTION of its true
// name; the name completes as she looks deeper / gets
// better (practice progression — curve below, draft /
// flagged for Adam's pin pass). This file is the STATE +
// query only: the LOOK action itself (button / verb) is
// UI's surface, and the true-name CONTENT (what a thing's
// portions actually are) comes from content / DEV —
// Systems invents no names here. No name content is
// hardcoded in this file: callers supply the portions,
// this file decides how many are known.
//
// WHAT A NAME IS: an ordered list of portions, family
// first (e.g. family "Primal Bone" before shape, shape
// before power — Adam's example shape). Display joins the
// known prefix with ' - ', matching the pinned bone
// display ("Primal Bone - squirrel skull"). When nothing
// is known, display is null and the caller shows the
// thing's plain (mundane) name instead.
//
// WHAT A "THING" IS: keys are caller-defined strings, and
// Systems is deliberately key-agnostic. Recommended:
// item ids for inventory things, kinds for world objects
// — knowledge generalizes across instances of a kind
// (looking at one squirrel skull teaches squirrel skulls;
// a fox femur is a different thing). The caller decides
// the granularity; this file only counts looks per key.
//
// PROGRESSION (lane-decided curve, draft / flagged):
// - Per-thing depth: base portions from looks at THIS
//   thing, at triangular thresholds (1, 3, 6, 10, 15 —
//   deeper looks cost more). Look 1 -> 1 portion (the
//   family, per Adam's example); look 3 -> 2; look 6 -> 3.
// - Practice: total looks across ALL things raise her
//   seeing level (thresholds 10, 25, 50 -> levels 1, 2,
//   3). Each level adds +1 known portion to every thing
//   (a practiced seer reads more at a glance).
// - Charm of Seeing HOOK: +1 known portion while the owl
//   charm is owned. HOOK ONLY — the owl charm itself is a
//   LATER charm (fashioned / enchanted, NOT built here),
//   so ownership arrives as a boolean INPUT (setOwlOwned),
//   never an item id (the charm's id is not decided — do
//   not invent it). Default: not owned. The hook toggles
//   display only; looks counts are untouched by it.
// - known = min(portions, base + level + owlBonus).
// Enchanting is NOT modelled here (DEV's link "looking
// gives a portion, enchanting completes it" is NOT pinned,
// and enchanting is not built) — looking is the only
// path this file knows.
//
// SAVE (trap-save pattern: format now, App wiring later):
// snapshot() / restore() carry per-thing looks (first-
// look order); total looks + level derive from the sum,
// so they are never stored. Owl ownership is NOT saved
// (it derives from charm ownership at runtime). Restore
// is BOOT-only (like trap / torch restore): it clears
// and rebuilds — never call it mid-game over live looks.
// SaveData.nameSight (save.ts) carries the snapshot.
//

/** One thing's saved look count. */
export interface SavedNameLook {
  key: string;
  looks: number;
}

/**
 * Looks at THIS thing needed for each deeper portion.
 * Triangular: deeper looks cost more. Draft, flagged.
 */
export const LOOK_THRESHOLDS: readonly number[] = [1, 3, 6, 10, 15];

/**
 * Total looks (all things) needed for each seeing level.
 * Level = thresholds met (0..3). Draft, flagged.
 */
export const PRACTICE_THRESHOLDS: readonly number[] = [10, 25, 50];

/** Extra known portion while the owl charm is owned (hook). */
export const OWL_BONUS = 1;

/** What a LOOK (or a pure query) reveals about a thing. */
export interface LookResult {
  thingKey: string;
  /** Looks at this thing, after recording (look) or as-is (known). */
  looks: number;
  /** Portions known (0..portions.length). */
  knownCount: number;
  /** The known prefix, as copies (never aliases). */
  known: string[];
  /**
   * The known prefix joined with ' - ', or null when
   * nothing is known (caller shows the plain name).
   */
  display: string | null;
}

function countThresholdsMet(thresholds: readonly number[], value: number): number {
  let count = 0;
  for (const threshold of thresholds) {
    if (value >= threshold) count++;
  }
  return count;
}

/**
 * Partial-true-name knowledge: looks per thing, practice
 * level, and the owl hook. Pure except for the recorded
 * looks themselves (look() is the only mutating query).
 */
export class NameSight {
  private looksByKey = new Map<string, number>();
  private owlOwned = false;

  /** Charm-of-Seeing hook: shell wires charm ownership here when it lands. */
  setOwlOwned(owned: boolean): void {
    this.owlOwned = owned;
  }

  /** Looks recorded at this thing (0 when never looked at). */
  looksAt(thingKey: string): number {
    return this.looksByKey.get(thingKey) ?? 0;
  }

  /** Total looks across all things (practice). */
  totalLooks(): number {
    let total = 0;
    for (const looks of this.looksByKey.values()) total += looks;
    return total;
  }

  /** Seeing level from practice (0..3). */
  seeingLevel(): number {
    return countThresholdsMet(PRACTICE_THRESHOLDS, this.totalLooks());
  }

  /** Portions known for a thing with this many portions. */
  knownCount(thingKey: string, portionCount: number): number {
    if (portionCount <= 0) return 0;
    const base = countThresholdsMet(LOOK_THRESHOLDS, this.looksAt(thingKey));
    const bonus = this.seeingLevel() + (this.owlOwned ? OWL_BONUS : 0);
    return Math.min(portionCount, base + bonus);
  }

  /** Pure query: what is known about this thing, without recording a look. */
  known(thingKey: string, portions: readonly string[]): LookResult {
    const count = this.knownCount(thingKey, portions.length);
    const known = portions.slice(0, count);
    return {
      thingKey,
      looks: this.looksAt(thingKey),
      knownCount: count,
      known,
      display: known.length > 0 ? known.join(' - ') : null,
    };
  }

  /** Record a LOOK at this thing and return what is now known. */
  look(thingKey: string, portions: readonly string[]): LookResult {
    this.looksByKey.set(thingKey, this.looksAt(thingKey) + 1);
    return this.known(thingKey, portions);
  }

  /** Snapshot for save (first-look order, copies). */
  snapshot(): SavedNameLook[] {
    return [...this.looksByKey.entries()].map(([key, looks]) => ({ key, looks }));
  }

  /**
   * Boot restore only: clears and rebuilds from valid
   * entries (non-empty string key + positive-integer
   * looks; bad entries dropped). Never call mid-game.
   */
  restore(entries: readonly SavedNameLook[]): void {
    this.looksByKey.clear();
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.key !== 'string' || entry.key === '') continue;
      if (!Number.isInteger(entry.looks) || entry.looks <= 0) continue;
      this.looksByKey.set(entry.key, entry.looks);
    }
  }
}
