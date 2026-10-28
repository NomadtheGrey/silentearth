/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — creature identifier tag (UI lane,
 * presentation only).
 *
 * The one tag on the nearest world animal (Adam, 2026-10-28):
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
 */

import { useEffect, useRef, useState } from 'react';
import { WorldAnchor } from './WorldAnchor';
import { UI_THEMES } from './themes';

export interface AnimalTagProps {
  /** Live feed of loaded-chunk animals (Background's getter). */
  getAnimals: () => { kind: string; x: number; z: number }[];
  /** Live player position (for distance). */
  getPlayerPos: () => { x: number; z: number };
  /** Screen projection (App's projectAnchor, 'scatter' kind). */
  project: (x: number, z: number) => { x: number; y: number } | null;
}

/** Poll cadence (approved, draft for pin pass). */
const TAG_POLL_MS = 250;
/** Range cap in meters (approved, draft for pin pass). */
const TAG_RANGE_M = 32;

export function AnimalTag({ getAnimals, getPlayerPos, project }: AnimalTagProps) {
  const [tag, setTag] = useState<{ name: string; x: number; y: number } | null>(
    null,
  );
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
      let nearest: { kind: string; x: number; z: number } | null = null;
      let nearestDistance = Infinity;
      for (const animal of getAnimalsRef.current()) {
        if (!Number.isFinite(animal.x) || !Number.isFinite(animal.z)) continue;
        if (!animal.kind) continue;
        const distance = Math.hypot(
          animal.x - player.x,
          animal.z - player.z,
        );
        if (distance <= TAG_RANGE_M && distance < nearestDistance) {
          nearest = animal;
          nearestDistance = distance;
        }
      }
      if (!nearest) {
        setTag(null);
        return;
      }
      const anchor = projectRef.current(nearest.x, nearest.z);
      if (!anchor) {
        setTag(null);
        return;
      }
      const name =
        nearest.kind.charAt(0).toUpperCase() + nearest.kind.slice(1);
      setTag((prev) =>
        prev !== null &&
        prev.name === name &&
        prev.x === anchor.x &&
        prev.y === anchor.y
          ? prev
          : { name, x: anchor.x, y: anchor.y },
      );
    };
    tick();
    const id = window.setInterval(tick, TAG_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!tag) return null;
  return (
    <WorldAnchor x={tag.x} y={tag.y}>
      <p
        className={
          'whitespace-nowrap rounded px-2 py-1 text-xs text-stone-100 ' +
          UI_THEMES['mire'].overlay
        }
      >
        {tag.name}
      </p>
    </WorldAnchor>
  );
}
