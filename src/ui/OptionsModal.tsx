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
import { UI_THEMES, type UiThemeName } from './themes';

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
const OPTION_TABS = [{ id: 'settings', label: 'Settings' }] as const;

type OptionsTabId = (typeof OPTION_TABS)[number]['id'];

export interface OptionsModalProps {
  /** Current font choice, owned by the caller. */
  font: FontId;
  /** Called when the player picks a font. */
  onFontChange?: (font: FontId) => void;
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
          'absolute flex flex-col overflow-hidden rounded ' +
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
          {OPTION_TABS.map((tab) => {
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
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
