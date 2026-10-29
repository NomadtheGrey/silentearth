/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — options modal (UI lane, presentation
 * + caller-owned setting state only).
 *
 * Tabbed modal whose FIRST tab is Settings. The tab bar is a
 * scaffold: OPTIONS_TABS lists the tabs, and adding a later
 * tab means adding one entry plus its panel branch — no other
 * tab and no other setting is invented here. The Settings tab
 * holds exactly one setting for now: the UI font dropdown.
 * The SECOND tab is Build history (Adam, 2026-10-26): the
 * recent build records from buildHistory.ts, newest first,
 * capped at 20, each with what changed, why, the date, and
 * the merge reference. The THIRD tab is the Quest Log
 * (2026-10-28): the Systems quest list in priority order,
 * all visible, first incomplete highlighted as current —
 * rendered by QuestLog from the caller's mapped props.
 *
 * PERSPECTIVE (Adam, 2026-10-26): the camera-perspective
 * buttons live HERE, in the Settings tab beside the font —
 * a display preference beside another display preference —
 * because the toggle group in the HUD bars obscured the
 * harvest buttons on the phone. The bars carry no camera
 * control anymore; Options is the one door to it.
 *
 * FONT SETTING (Adam, 2026-10-26): three families, in this
 * order — IM Fell English (the default when nothing is
 * stored), Alegreya, EB Garamond. The choice persists in
 * localStorage under its own settings key, separate from the
 * Systems save file — never piggybacked on the save format.
 * The chosen family replaces font-mono on the App root, so
 * it restyles the whole 2D UI (title, panels, HUD text) with
 * a serif fallback stack if a webfont fails to load. It never
 * touches the 3D canvas. Browsers only download the family
 * actually used, so listing three costs little on a phone.
 *
 * PHONE RULES (from the phone-HUD landings): the panel is a
 * bottom sheet on touch (bounded height, scroll inside) and
 * a centred card on desktop; action controls are thumb-sized
 * when comfortable. Closes via the X button, a backdrop tap,
 * or Escape.
 */

import { useEffect, useState } from 'react';
import { QuestLog, type QuestDisplay } from './QuestLog';
import {
  CloudSavePanel,
  type CloudSavePanelProps,
} from './CloudSavePanel';
import { UI_THEMES, type UiThemeName } from './themes';
import { BUILD_HISTORY } from './buildHistory';
import { CameraToggle } from './CameraToggle';
import type { CameraPerspective } from './types';

export type FontId = 'im-fell' | 'alegreya' | 'eb-garamond';

export const FONT_OPTIONS: Array<{ id: FontId; label: string }> = [
  { id: 'im-fell', label: 'IM Fell English' },
  { id: 'alegreya', label: 'Alegreya' },
  { id: 'eb-garamond', label: 'EB Garamond' },
];

/** No stored choice reads as IM Fell English. */
export const DEFAULT_FONT_ID: FontId = 'im-fell';

/** Own settings key — separate from the Systems save file. */
const SETTINGS_KEY = 'silent-earth-settings';

const FONT_IDS = new Set<string>(FONT_OPTIONS.map((option) => option.id));

/** Read the stored font choice; anything unreadable is the default. */
export function loadFontChoice(): FontId {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_FONT_ID;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'font' in parsed &&
      typeof (parsed as { font: unknown }).font === 'string' &&
      FONT_IDS.has((parsed as { font: string }).font)
    ) {
      return (parsed as { font: FontId }).font;
    }
  } catch {
    // Corrupt or unavailable storage reads as the default.
  }
  return DEFAULT_FONT_ID;
}

/** Persist the font choice in its own settings key. */
export function saveFontChoice(font: FontId): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ font }));
  } catch {
    // Private mode or blocked storage: the choice still applies
    // for this session; it simply will not survive a refresh.
  }
}

/** Root font class for a choice (defined in src/index.css). */
export function fontClassFor(font: FontId): string {
  switch (font) {
    case 'alegreya':
      return 'font-alegreya';
    case 'eb-garamond':
      return 'font-eb-garamond';
    case 'im-fell':
    default:
      return 'font-im-fell';
  }
}

/** Tab scaffold: one entry per tab, in display order. */
const OPTION_TABS = [
  { id: 'settings', label: 'Settings' },
  { id: 'history', label: 'Build history' },
  { id: 'quests', label: 'Quest Log' },
  { id: 'cloud', label: 'Cloud Saves' },
] as const;

type OptionsTabId = (typeof OPTION_TABS)[number]['id'];

export interface OptionsModalProps {
  /** Current font choice, owned by the caller. */
  font: FontId;
  /** Called when the player picks a font. */
  onFontChange?: (font: FontId) => void;
  /**
   * Current camera perspective, owned by the caller.
   * Omitted = no Perspective section (the modal stays usable
   * without camera state); passed = the section renders.
   */
  perspective?: CameraPerspective;
  /** Called when the player picks a perspective. */
  onPerspectiveChange?: (perspective: CameraPerspective) => void;
  /**
   * Called when the player asks to re-read the introduction.
   * Omitted = no Introduction section (mirrors the
   * Perspective section's optional pattern).
   */
  onShowIntro?: () => void;
  /**
   * Quests in priority order, mapped by the caller from
   * Systems results. Omitted = the tab shows the empty line
   * (mirrors the Perspective section's optional pattern).
   */
  quests?: QuestDisplay[];
  /**
   * Cloud saves panel props, owned by the caller (App
   * wiring). Omitted = no Cloud Saves tab (mirrors the
   * optional Perspective/quests pattern).
   */
  cloud?: CloudSavePanelProps;
  /** Called when the modal is closed. */
  onClose?: () => void;
  /** Bottom-sheet layout + thumb-sized controls on touch. Default false. */
  comfortable?: boolean;
  /** Look for the panel. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function OptionsModal({
  font,
  onFontChange,
  perspective,
  onPerspectiveChange,
  onShowIntro,
  quests,
  cloud,
  onClose,
  comfortable = false,
  theme = 'mire',
}: OptionsModalProps) {
  const t = UI_THEMES[theme];
  const [activeTab, setActiveTab] = useState<OptionsTabId>('settings');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const selectedLabel =
    FONT_OPTIONS.find((option) => option.id === font)?.label ?? 'IM Fell English';

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Options">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => onClose?.()}
      />
      <section
        aria-label="Options"
        className={
          'absolute flex flex-col overflow-hidden rounded-2xl ' +
          t.panel +
          (comfortable
            ? ' left-2 right-2 bottom-2 max-h-[70vh]'
            : ' left-1/2 top-1/2 w-[min(32rem,calc(100vw-2rem))] max-h-[80vh] -translate-x-1/2 -translate-y-1/2')
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 p-3">
          <h2 className={'text-base font-semibold ' + t.heading}>Options</h2>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close options"
            className={
              comfortable
                ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
                : 'rounded px-2 py-1 text-sm ' + t.button
            }
          >
            X
          </button>
        </div>

        <div role="tablist" aria-label="Options sections" className="flex gap-1 px-3">
          {OPTION_TABS.filter(
            (tab) => tab.id !== 'cloud' || cloud !== undefined,
          ).map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={
                  'rounded px-3 text-sm ' +
                  (comfortable ? 'py-2 min-h-[44px] ' : 'py-1 ') +
                  (active ? t.active : 'bg-stone-700 hover:bg-stone-600')
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-y-auto p-3">
          {activeTab === 'settings' ? (
            <div>
              <label
                htmlFor="options-font"
                className={'mb-1 block text-sm font-medium ' + t.heading}
              >
                Font
              </label>
              <select
                id="options-font"
                value={font}
                onChange={(e) => onFontChange?.(e.target.value as FontId)}
                className={
                  'w-full rounded bg-[#121612] px-3 text-stone-100 ' +
                  (comfortable ? 'py-2 text-base min-h-[44px]' : 'py-1 text-sm')
                }
              >
                {FONT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className={'mt-2 text-sm ' + t.muted}>
                Saved on this device — a refresh keeps your font.
              </p>
              <p className={'mt-3 text-lg ' + fontClassFor(font)}>
                {selectedLabel}
              </p>
              {perspective !== undefined ? (
                <div className="mt-4">
                  <p
                    className={'mb-1 block text-sm font-medium ' + t.heading}
                  >
                    Perspective
                  </p>
                  <CameraToggle
                    perspective={perspective}
                    comfortable={comfortable}
                    onChange={onPerspectiveChange}
                  />
                </div>
              ) : null}
              {onShowIntro !== undefined ? (
                <div className="mt-4">
                  <p
                    className={'mb-1 block text-sm font-medium ' + t.heading}
                  >
                    Introduction
                  </p>
                  <button
                    type="button"
                    onClick={() => onShowIntro?.()}
                    className={
                      comfortable
                        ? 'rounded px-3 py-2 text-sm min-h-[44px] ' + t.button
                        : 'rounded px-2 py-1 text-sm ' + t.button
                    }
                  >
                    Show introduction
                  </button>
                  <p className={'mt-2 text-sm ' + t.muted}>
                    The first-run introduction, for later reference.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          {activeTab === 'history' ? (
            <div>
              {BUILD_HISTORY.length === 0 ? (
                <p className={'italic ' + t.muted}>No build records yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {BUILD_HISTORY.map((record) => (
                    <li key={record.sha}>
                      <p
                        className={'text-sm font-medium ' + t.heading}
                      >
                        {record.what}
                      </p>
                      <p className={'mt-0.5 text-xs ' + t.muted}>
                        {record.date} · {record.merge} · PR #{record.pr} ·{' '}
                        {record.sha}
                      </p>
                      <p className={'mt-1 text-sm ' + t.muted}>
                        {record.why}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          {activeTab === 'quests' ? (
            <QuestLog quests={quests ?? []} theme={theme} />
          ) : null}
          {activeTab === 'cloud' && cloud !== undefined ? (
            <CloudSavePanel
              {...cloud}
              theme={theme}
              comfortable={comfortable}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
