/**
 * Silent Earth redesign — structure identifier tag (UI lane,
 * presentation only).
 *
 * The faced name of a singular site structure (Adam's
 * photographing-sites ask, 2026-10-31): the grove-tree
 * precedent ('Grove Tree' — a name shown when faced,
 * without a pill verb) extended to the singulars of
 * sites.ts. The pill mirrors the creature tag exactly
 * (AnimalTag — FrogHint styling, non-interactive,
 * pointer-events-none): display only, no press, no
 * menu, no USE wiring — a name is not a door.
 *
 * Where structures differ from animals, the rules
 * differ (the claim's pricing): animals move between
 * renders, so AnimalTag polls; structures are static
 * and her position state refreshes on the movement
 * tick, so the shell derives the tag per render (the
 * scatter tag's shape) and this component only paints
 * what it is handed — the nearest FACED structure
 * within the range cap (facing judged by the shell
 * with the winner's own cone rule).
 *
 * THE NAMING TABLE lives here (DEV's ruling on the
 * claim: a name she reads is a surface). The FACTS —
 * centers, plots, states — stay Background's in
 * sites.ts; the shell only reads them. All names are
 * DRAFT for Adam's pin pass.
 */

import { WorldAnchor } from './WorldAnchor';
import { UI_THEMES, type UiThemeName } from './themes';

/** Range cap in meters (DRAFT — structures read at distance). */
export const STRUCTURE_TAG_RANGE_M = 48;

/**
 * The v1 names, keyed by the site key the shell derives.
 * Eleven of the thirteen singulars: the Grove is absent
 * (already named by its trees + the discovery beat) and
 * the cave mouths are absent (ENTER presentation, plural
 * instances). The village's houses share one fate and
 * one generic name.
 */
export const STRUCTURE_TAG_NAMES: Readonly<Record<string, string>> = {
  schoolhouse: 'The Schoolhouse',
  farmhouse: 'The Farmhouse',
  chapel: 'The Chapel',
  'general-store': 'The General Store',
  'drowned-mill': 'The Drowned Mill',
  'sunken-road': 'The Sunken Road',
  'rail-siding': 'The Rail Siding',
  barn: 'The Barn',
  silo: 'The Silo',
  'water-tower': 'The Water Tower',
  'village-house': 'Burnt House',
};

export interface StructureTagProps {
  /** The tag to paint (name + projected anchor), or null. */
  tag: { name: string; x: number; y: number } | null;
  /** Look for the tag's overlay. Default "mire". */
  theme?: UiThemeName;
}

export function StructureTag({ tag, theme = 'mire' }: StructureTagProps) {
  if (!tag) return null;
  return (
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
  );
}
