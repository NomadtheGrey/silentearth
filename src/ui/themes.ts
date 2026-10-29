/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — UI themes (UI lane, presentation only).
 *
 * Adam's artistic direction, 2026-10-25: attractive AND light, with
 * "a couple different CSS styles going on". This lane's reading of
 * that, kept deliberately small — a couple of looks, not a theme
 * system:
 *
 * - "mire": the world outside. Wet bog, moss and mud, bone-parchment
 *   text. The gathering / inventory look.
 * - "hearth": firelit making. Charcoal and ember amber. The crafting /
 *   dialog look.
 *
 * Phase 2 (Adam, 2026-10-29) added two whole-UI variant looks,
 * switchable live from Options (LOOK_THEMES below): "parchment"
 * (grimoire paper + ink) and "ember" (hearth extended UI-wide).
 * They are extra class-string sets in the same shape, chosen by
 * the shell's look setting — still not a theme engine.
 *
 * A theme is just class strings. Components pick one through an
 * optional `theme` prop (each has a sensible default), and a caller
 * can override it per screen. No state, no logic, no game code.
 * Colours in the artwork itself live in WitchyArt / CharacterAvatar,
 * copied from the prototype palette, not imported.
 */

export type UiThemeName = 'mire' | 'hearth' | 'parchment' | 'ember';

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
    button:
      'bg-stone-700 hover:bg-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70',
    primary:
      'bg-lime-800 hover:bg-lime-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70',
    active: 'bg-lime-800',
    overlay: 'bg-lime-950/60',
  },
  hearth: {
    panel: 'border border-amber-900/70 bg-stone-900/90 text-stone-100 shadow-lg',
    heading: 'text-amber-100',
    muted: 'text-stone-400',
    selected: 'bg-amber-800/60 outline outline-1 outline-amber-500',
    button:
      'bg-stone-700 hover:bg-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70',
    primary:
      'bg-amber-700 hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70',
    active: 'bg-amber-700',
    overlay: 'bg-amber-950/60',
  },
  // Parchment & Ink (beautification phase 2, 2026-10-29):
  // the grimoire-page look — bone-paper panels, ink text,
  // ruled borders. Its world overlay stays a dark ink
  // wash: the paper lives in the panels, the world layer
  // keeps its shadow so floating labels stay readable.
  parchment: {
    panel: 'border border-stone-500/70 bg-[#f3ecd9]/95 text-stone-800 shadow-lg',
    heading: 'text-stone-900',
    muted: 'text-stone-500',
    selected: 'bg-[#e3d5ae] outline outline-1 outline-stone-600',
    button:
      'bg-[#e7dcbf] hover:bg-[#dccd9f] text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-600/70',
    primary:
      'bg-stone-700 hover:bg-stone-600 text-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-600/70',
    active: 'bg-stone-700 text-stone-50',
    overlay: 'bg-stone-900/55',
  },
  // Ember Night (beautification phase 2, 2026-10-29):
  // hearth extended UI-wide — deep charcoal, ember
  // amber, bone text; the moodiest read.
  ember: {
    panel: 'border border-amber-800/70 bg-[#171310]/95 text-stone-100 shadow-lg',
    heading: 'text-amber-200',
    muted: 'text-stone-400',
    selected: 'bg-amber-900/60 outline outline-1 outline-amber-500',
    button:
      'bg-stone-800 hover:bg-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70',
    primary:
      'bg-amber-800 hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70',
    active: 'bg-amber-800',
    overlay: 'bg-[#171310]/70',
  },
};

/**
 * A selectable UI look (beautification phase 2, Adam
 * 2026-10-29: variants judged live from a drop-down in
 * Options, the current look kept for comparison). Each
 * look names the theme for the two slots the codebase
 * already uses: world (the mire-default surfaces) and
 * dialog (the hearth-default surfaces: crafting, popups,
 * interaction progress). 'mire-hearth' is exactly the
 * pre-variants behaviour.
 */
export type UiLookId = 'mire-hearth' | 'parchment' | 'ember';

export const LOOK_THEMES: Record<
  UiLookId,
  { world: UiThemeName; dialog: UiThemeName }
> = {
  'mire-hearth': { world: 'mire', dialog: 'hearth' },
  parchment: { world: 'parchment', dialog: 'parchment' },
  ember: { world: 'ember', dialog: 'ember' },
};

/**
 * The ONE key-badge class (beautification pass, 2026-10-29):
 * every PC key hint in the UI — menu digit badges, row key
 * badges, the scry badge — renders with exactly this.
 * Margins stay at the call site (they are layout, not look).
 */
export const KEY_BADGE_CLASS =
  'rounded border border-stone-500/60 bg-black/30 px-1 font-mono text-[10px]';
