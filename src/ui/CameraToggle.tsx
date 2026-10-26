/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — camera-perspective toggle (UI lane).
 *
 * Presentation only: the current perspective is a prop, and a change is
 * reported through `onChange`. This control never switches a camera,
 * never reads engine state, and owns no mode of its own.
 *
 * Perspectives are the redesign's pinned player choice: first-person,
 * third-person overhead, or behind-the-witch follow. Labels are
 * plain words, not engine terms.
 */

import type { CameraPerspective } from './types';
import { UI_THEMES, type UiThemeName } from './themes';

export interface CameraToggleProps {
  /** Current perspective, owned by the caller. */
  perspective: CameraPerspective;
  /** Called when the player picks a perspective. */
  onChange?: (perspective: CameraPerspective) => void;
  /** Thumb-sized option buttons (44 px targets) on touch. Default false. */
  comfortable?: boolean;
  /** Accent look for the active button. Default "mire". */
  theme?: UiThemeName;
}

const OPTIONS: Array<{ value: CameraPerspective; label: string }> = [
  { value: 'first', label: 'First-person' },
  { value: 'third', label: 'Third-person overhead' },
  { value: 'behind', label: 'Behind' },
];

export function CameraToggle({
  perspective,
  onChange,
  comfortable = false,
  theme = 'mire',
}: CameraToggleProps) {
  const t = UI_THEMES[theme];
  return (
    <div
      role="group"
      aria-label="Camera perspective"
      className={'flex flex-wrap gap-1 rounded p-1 ' + t.overlay}
    >
      {OPTIONS.map((option) => {
        const active = option.value === perspective;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(option.value)}
            className={
              (comfortable
                ? 'rounded px-3 py-2 text-sm min-h-[44px] text-stone-100 '
                : 'rounded px-3 py-1 text-sm text-stone-100 ') +
              (active ? t.active : 'bg-stone-700 hover:bg-stone-600')
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
