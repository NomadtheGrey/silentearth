/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NAMING — THE REGISTER (Adam's commission, 2026-11-05:
 * "Build out the Naming"). The state of every place she
 * has given a name: her name for the spot, where it
 * stands, which dimension it stands in, and the
 * world-day she named it. Systems built it first; UI
 * (the naming act's door, the journal's Places list,
 * the in-world tags) and Background consume the API
 * below.
 *
 * LEAF LAW: this module imports NOTHING — register and
 * acts in one leaf, so no import edge can close a cycle
 * through it (the boot-smoke lesson). The save seat
 * (systems/save.ts, SavedNamedPlace) mirrors the
 * snapshot shape field-for-field; snapshot = stored =
 * restore, zero conversion at any boundary (the moss
 * paint settle).
 *
 * THE ACTS (v1, Adam's spec + DEV's calls):
 * - NAME the spot she stands at: the position is hers
 *   at the act. A name is VERBATIM free text, capped
 *   at NAME_MAX_CHARS. A blank name is no act.
 * - RENAME: naming again while standing at (within
 *   RENAME_RADIUS_M of) an already-named spot in the
 *   same dimension REPLACES that place's name — the
 *   spot keeps its id and its planted position; the
 *   name and the day move. Doors may also rename by
 *   id directly (rename()).
 * - UN-NAME: remove by id (unname()).
 * - DUPLICATED names at different spots are ALLOWED —
 *   they are hers; the interface disambiguates by
 *   distance (nearest() / the distance helpers below).
 * - UNGATED in v1: no fragment or mark requirement.
 *   The learning gate seats with the marks build
 *   later, exactly as today's Scry stands ungated
 *   ahead of its Returning gate (Adam's sequencing).
 *
 * DIMENSIONS: a place belongs to exactly one
 * dimension, keyed opaquely ('surface', 'cave:<id>',
 * 'attic:<site>' — the bucket keys' vocabulary).
 * Lists and filters respect the dimension: a cave
 * name does not surface topside.
 */

/** The surface dimension's key. Other keys are opaque. */
export const SURFACE_DIMENSION_KEY = 'surface';

/** Name length cap, characters (DRAFT, DEV 2026-11-05). */
export const NAME_MAX_CHARS = 40;

/**
 * How close a fresh naming must stand to an existing
 * same-dimension place to count as RE-naming that
 * spot rather than naming a new one (DRAFT metres).
 */
export const RENAME_RADIUS_M = 2;

/**
 * One named place, runtime and saved shape in one
 * (save.ts mirrors it as SavedNamedPlace). `y` is the
 * height where it is relevant (a cave ledge) and null
 * where it is not — most namings are ground spots.
 * `day` is the world-day of the (re)naming, supplied
 * by the shell — this register keeps no calendar.
 */
export interface NamedPlace {
  id: string;
  name: string;
  x: number;
  y: number | null;
  z: number;
  dimensionKey: string;
  day: number;
}

/** The naming act's input: her name + where she stands. */
export interface NameHereInput {
  name: string;
  x: number;
  y?: number | null;
  z: number;
  dimensionKey: string;
  day: number;
}

/**
 * The id a spot gets: position-keyed within its
 * dimension (the moss-paint idiom, 2-dp), so identity
 * is the spot itself and a rename never mints a
 * second entry for one place.
 */
export function namedPlaceId(
  dimensionKey: string,
  x: number,
  z: number,
): string {
  return `named:${dimensionKey}:${x.toFixed(2)},${z.toFixed(2)}`;
}

/** Ground distance between two (x, z) points, metres. */
export function distanceM(
  a: { x: number; z: number },
  b: { x: number; z: number },
): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Compass bearing from a point TO a place, degrees:
 * 0 = north (−z), 90 = east (+x), clockwise (the
 * world's compass law). For doors that point her —
 * the journal list, a Returning arrow.
 */
export function bearingDegrees(
  fromX: number,
  fromZ: number,
  to: { x: number; z: number },
): number {
  const deg = (Math.atan2(to.x - fromX, -(to.z - fromZ)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Cap + blank-check a candidate name; null = no act. */
function cleanName(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  if (raw.trim() === '') return null;
  return raw.length > NAME_MAX_CHARS ? raw.slice(0, NAME_MAX_CHARS) : raw;
}

function validSpot(
  x: number,
  y: number | null | undefined,
  z: number,
  dimensionKey: string,
  day: number,
): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    (y === undefined || y === null || Number.isFinite(y)) &&
    typeof dimensionKey === 'string' &&
    dimensionKey !== '' &&
    Number.isFinite(day)
  );
}

/**
 * The register. One instance lives in the shell;
 * snapshot() feeds the save draft, restore() takes a
 * saved list back. All reads return copies — the
 * register's entries are never handed out live.
 */
/**
 * The journal sink (the trap-steal pattern's sibling,
 * 2026-11-06): this leaf imports NOTHING (the law
 * above), so it cannot reach the journal's change
 * leaf in src/systems/ — instead it DECLARES a sink
 * the shell wires once at boot to the journal
 * (an adapter stamping kind: 'place' onto the fact).
 * The naming acts declare through it when a write
 * STANDS; restore never declares. Unwired (null),
 * declarations go nowhere and cost nothing.
 */
export interface NamedPlaceJournalFact {
  label: string;
  deepen?: boolean;
}

type NamedPlacesJournalSink = (fact: NamedPlaceJournalFact) => void;

let namedPlacesJournalSink: NamedPlacesJournalSink | null = null;

/** Wire (or unwire, with null) the journal sink. The shell's boot seat. */
export function setNamedPlacesJournalSink(
  sink: NamedPlacesJournalSink | null,
): void {
  namedPlacesJournalSink = sink;
}

function declareNamedPlace(label: string, deepen: boolean): void {
  if (!namedPlacesJournalSink) return;
  namedPlacesJournalSink(
    deepen ? { label, deepen: true } : { label },
  );
}

export class NamedPlacesState {
  private places: NamedPlace[] = [];

  /**
   * Name the spot she stands at. Standing within
   * RENAME_RADIUS_M of an existing place IN THE SAME
   * DIMENSION re-names that spot (name + day move;
   * id + planted position stay). Otherwise a new
   * place is planted here. Returns the place, or
   * null when the act is no act (blank name, bad
   * position/dimension/day — inputs refused whole,
   * nothing mutates).
   */
  nameHere(input: NameHereInput): NamedPlace | null {
    const name = cleanName(input.name);
    if (name === null) return null;
    if (!validSpot(input.x, input.y, input.z, input.dimensionKey, input.day)) {
      return null;
    }
    const near = this.places.find(
      (p) =>
        p.dimensionKey === input.dimensionKey &&
        distanceM(p, input) <= RENAME_RADIUS_M,
    );
    if (near) {
      near.name = name;
      near.day = input.day;
      // A re-naming: the entry stands, its name moved —
      // declared as a deepening of the existing entry.
      declareNamedPlace(name, true);
      return { ...near };
    }
    const place: NamedPlace = {
      id: namedPlaceId(input.dimensionKey, input.x, input.z),
      name,
      x: input.x,
      y: input.y ?? null,
      z: input.z,
      dimensionKey: input.dimensionKey,
      day: input.day,
    };
    this.places.push(place);
    // A new place stands in the journal: declared.
    declareNamedPlace(name, false);
    return { ...place };
  }

  /** Re-name one place by id. False when no such id or the name is blank. */
  rename(id: string, name: string, day: number): boolean {
    const clean = cleanName(name);
    if (clean === null || !Number.isFinite(day)) return false;
    const place = this.places.find((p) => p.id === id);
    if (!place) return false;
    place.name = clean;
    place.day = day;
    declareNamedPlace(clean, true);
    return true;
  }

  /** Un-name one place by id. False when no such id. */
  unname(id: string): boolean {
    const at = this.places.findIndex((p) => p.id === id);
    if (at < 0) return false;
    this.places.splice(at, 1);
    return true;
  }

  /** One place by id (a copy), or undefined. */
  get(id: string): NamedPlace | undefined {
    const place = this.places.find((p) => p.id === id);
    return place ? { ...place } : undefined;
  }

  /** Every named place, in the order they were named (copies). */
  list(): NamedPlace[] {
    return this.places.map((p) => ({ ...p }));
  }

  /** The named places of one dimension only (copies). */
  inDimension(dimensionKey: string): NamedPlace[] {
    return this.places
      .filter((p) => p.dimensionKey === dimensionKey)
      .map((p) => ({ ...p }));
  }

  /**
   * The nearest named place to a point — within one
   * dimension when a key is given, across all of them
   * when not. The disambiguator for duplicated names:
   * doors pair it with distanceM / bearingDegrees.
   */
  nearest(
    x: number,
    z: number,
    dimensionKey?: string,
  ): { place: NamedPlace; distanceM: number } | null {
    let best: NamedPlace | null = null;
    let bestDistance = Infinity;
    for (const place of this.places) {
      if (dimensionKey !== undefined && place.dimensionKey !== dimensionKey) {
        continue;
      }
      const d = distanceM(place, { x, z });
      if (d < bestDistance) {
        best = place;
        bestDistance = d;
      }
    }
    return best ? { place: { ...best }, distanceM: bestDistance } : null;
  }

  /** How many places stand named. */
  get size(): number {
    return this.places.length;
  }

  /** Drop every name (a fresh world). */
  clear(): void {
    this.places = [];
  }

  /** The save shape, verbatim (deep copies). */
  snapshot(): NamedPlace[] {
    return this.places.map((p) => ({ ...p }));
  }

  /**
   * Take a saved list back. Lenient per entry (the
   * SavedPatch idiom): an entry with a bad id, name,
   * position, dimension, or day drops alone; a
   * duplicated id keeps its first standing; a bad y
   * (the optional axis) reads as null rather than
   * dropping the place.
   */
  restore(saved: readonly NamedPlace[]): void {
    const next: NamedPlace[] = [];
    const seen = new Set<string>();
    if (Array.isArray(saved)) {
      for (const entry of saved) {
        if (!entry || typeof entry !== 'object') continue;
        if (typeof entry.id !== 'string' || entry.id === '') continue;
        if (typeof entry.name !== 'string') continue;
        if (!Number.isFinite(entry.x) || !Number.isFinite(entry.z)) continue;
        if (typeof entry.dimensionKey !== 'string' || entry.dimensionKey === '') {
          continue;
        }
        if (!Number.isFinite(entry.day)) continue;
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        next.push({
          id: entry.id,
          name: entry.name,
          x: entry.x,
          y: Number.isFinite(entry.y) ? (entry.y as number) : null,
          z: entry.z,
          dimensionKey: entry.dimensionKey,
          day: entry.day,
        });
      }
    }
    this.places = next;
  }
}
