/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — UI themes (UI lane, presentation only).
 *
 * Adam's artistic direction, 2026-10-25: attractive AND light, with
 * "a couple different CSS styles going on". This lane's reading of
 * that, kept deliberately small — two looks, not a theme system:
 *
 * - "mire": the world outside. Wet bog, moss and mud, bone-parchment
 *   text. The gathering / inventory look.
 * - "hearth": firelit making. Charcoal and ember amber. The crafting /
 *   dialog look.
 *
 * A theme is just class strings. Components pick one through an
 * optional `theme` prop (each has a sensible default), and a caller
 * can override it per screen. No state, no logic, no game code.
 * Colours in the artwork itself live in WitchyArt / CharacterAvatar,
 * copied from the prototype palette, not imported.
 */

export type UiThemeName = 'mire' | 'hearth';

export interface UiTheme {
  /** Panel background + border + base text. */
  panel: string;
  /** Heading text colour. */
  heading: string;
  /** Secondary / muted text colour. */
  muted: string;
  /** Selected-row treatment. */
  selected: string;
  /** Quiet button (e.g. Close). */
  button: string;
  /** Primary action button (e.g. Craft). */
  primary: string;
  /** Active toggle button. */
  active: string;
  /** Translucent overlay pill (HUD needs row, camera toggle shell). */
  overlay: string;
}

export const UI_THEMES: Record<UiThemeName, UiTheme> = {
  mire: {
    panel: 'border border-lime-900/70 bg-lime-950/90 text-stone-100 shadow-lg',
    heading: 'text-lime-100',
    muted: 'text-stone-400',
    selected: 'bg-lime-900/60 outline outline-1 outline-lime-600',
    button: 'bg-stone-700 hover:bg-stone-600',
    primary: 'bg-lime-800 hover:bg-lime-700',
    active: 'bg-lime-800',
    overlay: 'bg-lime-950/60',
  },
  hearth: {
    panel: 'border border-amber-900/70 bg-stone-900/90 text-stone-100 shadow-lg',
    heading: 'text-amber-100',
    muted: 'text-stone-400',
    selected: 'bg-amber-800/60 outline outline-1 outline-amber-500',
    button: 'bg-stone-700 hover:bg-stone-600',
    primary: 'bg-amber-700 hover:bg-amber-600',
    active: 'bg-amber-700',
    overlay: 'bg-amber-950/60',
  },
};
