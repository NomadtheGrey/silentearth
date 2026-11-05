/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — named-place identifier tag
 * (UI lane, presentation only).
 *
 * The tag on every named place in range (the naming
 * build, 2026-11-05; Adam: wherever she names it, the
 * name stands over the spot). This is the component
 * half of the creature-tags split: Background's feed
 * (renderer.getNamedPlaceTags) owns the range (100 m,
 * their TAG_RANGE_M), the dimension law (a cave name
 * never surfaces topside), and the anchor height (the
 * place's planted y, else the ground plane); this
 * component polls the feed like AnimalTag (250 ms),
 * projects each entry through the shell's 'scatter'
 * projector at its carried height, and stands a pill
 * with her name VERBATIM — no derivation, no table.
 * Every in-range place tags (no nearest-wins: places
 * are hers, plural, and standing still — unlike the
 * creature tag's one ambient slot). Display only: no
 * press, no menu. App gates it with the creature
 * tag's hiding set, so hidden = no polling.
 */

import { Fragment, useEffect, useRef, useState } from 'react';
import { WorldAnchor } from './WorldAnchor';
import { UI_THEMES, type UiThemeName } from './themes';

/** One feed entry, as Background's feed serves it. */
export interface PlaceTagEntry {
  /** The place's id (the register's key). */
  id: string;
  /** Her name for the spot, verbatim. */
  name: string;
  x: number;
  /** Anchor height: planted y, else the ground plane. */
  y: number;
  z: number;
}

export interface PlaceTagProps {
  /** Live feed of her named places in range (Background's getter). */
  getPlaces: () => PlaceTagEntry[];
  /**
   * Screen projection (App's projectAnchor, 'scatter'
   * kind); the entry's carried height rides along as
   * the world-Y override.
   */
  project: (
    x: number,
    z: number,
    worldY?: number,
  ) => { x: number; y: number } | null;
  /** Look for the tag's overlay. Default "mire". */
  theme?: UiThemeName;
}

/** Poll cadence (the creature tag's, DRAFT for pin pass). */
const TAG_POLL_MS = 250;

/** One standing pill, projected. */
interface PlacePill {
  key: string;
  name: string;
  x: number;
  y: number;
}

export function PlaceTag({ getPlaces, project, theme = 'mire' }: PlaceTagProps) {
  const [tags, setTags] = useState<readonly PlacePill[]>([]);
  // Latest-callback refs (the creature tag's idiom):
  // the interval runs once (stable) but reads fresh
  // props every poll.
  const getPlacesRef = useRef(getPlaces);
  getPlacesRef.current = getPlaces;
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    const tick = () => {
      const pills: PlacePill[] = [];
      for (const place of getPlacesRef.current()) {
        if (!Number.isFinite(place.x) || !Number.isFinite(place.z)) {
          continue;
        }
        if (!place.name) continue;
        const anchor = projectRef.current(place.x, place.z, place.y);
        if (!anchor) continue;
        pills.push({
          key: place.id,
          name: place.name,
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
