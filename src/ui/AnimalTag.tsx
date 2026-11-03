/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — creature identifier tag (UI lane,
 * presentation only).
 *
 * The tag on the nearest world animal (Adam, 2026-10-28):
 * display name only, v1. Animals move independently of the
 * player (wander/flee), so a per-render derivation — the
 * scatter tag's shape — would sit stale on a moving animal.
 * This component therefore polls the shell-supplied live
 * feed on an interval and projects fresh per poll; App
 * gates it with the scatter hiding set (renders it only
 * when visible, so hidden = no polling). Nearest = smallest
 * distance, ties → first in feed order (strict <, trap
 * precedent). Range cap 32 m (approved, draft for Adam's
 * pin pass — NOT harvest parity: flee radii are 4–8 m, so
 * a 2.5 m cap would almost never show for skittish/wary
 * kinds, and the loaded span is 3 chunks / ~96 m, so
 * unbounded would label distant specks). Name = capitalized
 * kind id (ANIMAL_DEFS carries no name field, so no table
 * is invented; 'Mouse' vs 'Mice' stay distinct). Display
 * only: no press, no menu, no USE wiring. No active-phase
 * filter — nearest loaded instance, day or night.
 * The pill mirrors the scatter tag exactly (FrogHint
 * styling, non-interactive, pointer-events-none).
 *
 * NAMED ENTRIES (tag claim, 2026-11-01): a feed item
 * may carry its own display name, which wins over the
 * capitalized kind — the guide raven rides this (the
 * shell composes Background's guideTagSeat into the
 * feed as { kind: 'crow', name: 'Raven' }; the bird is
 * a singular special, deliberately not in the engine's
 * visible-animals list, and 'Raven' is Adam's word for
 * it while the engine kind stays 'crow').
 *
 * SINGULARS (the raven's name, 2026-11-03): an entry
 * flagged `singular` does NOT compete for the ambient
 * nearest slot — it stands its own tag, at its own
 * carried height (`y`, the seat's live world height),
 * within the same 32 m range. The flag, not the name,
 * is the discriminator: feral-dress entries also carry
 * a name (stamped by the shell) and keep competing for
 * the ambient slot exactly as before. Before this, the
 * guide lost the single slot to almost any ambient
 * animal staged nearer, and even when it won, its pill
 * projected at the scatter height (1 m — the tree's
 * trunk, metres below the perched bird).
 */

import { Fragment, useEffect, useRef, useState } from 'react';
import { WorldAnchor } from './WorldAnchor';
import { UI_THEMES, type UiThemeName } from './themes';

/** One feed entry, as the shell composes it. */
export interface AnimalTagEntry {
  kind: string;
  /** Own display name, when the entry carries one (named entries win). */
  name?: string;
  x: number;
  z: number;
  /** Real world height to project at, when the entry carries one. */
  y?: number;
  /**
   * A named singular (the guide): stands its own tag and
   * never competes for the ambient nearest slot.
   */
  singular?: boolean;
}

export interface AnimalTagProps {
  /** Live feed of loaded-chunk animals (Background's getter). */
  getAnimals: () => AnimalTagEntry[];
  /** Live player position (for distance). */
  getPlayerPos: () => { x: number; z: number };
  /**
   * Screen projection (App's projectAnchor, 'scatter'
   * kind); an entry's carried height rides along when
   * it has one, else the scatter default stands.
   */
  project: (
    x: number,
    z: number,
    worldY?: number,
  ) => { x: number; y: number } | null;
  /** Look for the tag's overlay. Default "mire". */
  theme?: UiThemeName;
}

/** Poll cadence (approved, draft for pin pass). */
const TAG_POLL_MS = 250;
/** Range cap in meters (approved, draft for pin pass). */
const TAG_RANGE_M = 32;

/** One standing pill, projected. */
interface TagPill {
  key: string;
  name: string;
  x: number;
  y: number;
}

export function AnimalTag({ getAnimals, getPlayerPos, project, theme = 'mire' }: AnimalTagProps) {
  const [tags, setTags] = useState<readonly TagPill[]>([]);
  // Latest-callback refs: the interval runs once (stable),
  // but reads fresh props every poll — App re-renders hand
  // new function identities, which must never reset the
  // interval or stale the player position.
  const getAnimalsRef = useRef(getAnimals);
  getAnimalsRef.current = getAnimals;
  const getPlayerPosRef = useRef(getPlayerPos);
  getPlayerPosRef.current = getPlayerPos;
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    const tick = () => {
      const player = getPlayerPosRef.current();
      let ambient: AnimalTagEntry | null = null;
      let ambientDistance = Infinity;
      const singulars: AnimalTagEntry[] = [];
      for (const animal of getAnimalsRef.current()) {
        if (!Number.isFinite(animal.x) || !Number.isFinite(animal.z)) continue;
        if (!animal.kind) continue;
        const distance = Math.hypot(
          animal.x - player.x,
          animal.z - player.z,
        );
        if (distance > TAG_RANGE_M) continue;
        if (animal.singular) {
          singulars.push(animal);
        } else if (distance < ambientDistance) {
          ambient = animal;
          ambientDistance = distance;
        }
      }
      const standing: (AnimalTagEntry & { key: string })[] = [
        ...(ambient ? [{ ...ambient, key: 'ambient' }] : []),
        ...singulars.map((entry, index) => ({
          ...entry,
          key: `singular:${entry.name ?? entry.kind}:${index}`,
        })),
      ];
      const pills: TagPill[] = [];
      for (const entry of standing) {
        const anchor = projectRef.current(entry.x, entry.z, entry.y);
        if (!anchor) continue;
        pills.push({
          key: entry.key,
          name:
            entry.name ??
            (entry.kind.charAt(0).toUpperCase() + entry.kind.slice(1)),
          x: anchor.x,
          y: anchor.y,
        });
      }
      setTags((prev) =>
        prev.length === pills.length &&
        prev.every(
          (pill, index) =>
            pill.key === pills[index].key &&
            pill.name === pills[index].name &&
            pill.x === pills[index].x &&
            pill.y === pills[index].y,
        )
          ? prev
          : pills,
      );
    };
    tick();
    const id = window.setInterval(tick, TAG_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  if (tags.length === 0) return null;
  return (
    <>
      {tags.map((tag) => (
        <Fragment key={tag.key}>
          <WorldAnchor x={tag.x} y={tag.y}>
            <p
              className={
                'whitespace-nowrap rounded px-2 py-1 text-xs text-stone-100 ' +
                UI_THEMES[theme].overlay
              }
            >
              {tag.name}
            </p>
          </WorldAnchor>
        </Fragment>
      ))}
    </>
  );
}
