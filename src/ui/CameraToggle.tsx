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
 * Perspectives are the redesign's pinned player choice: first-person
 * or third-person overhead. Labels are plain words, not engine terms.
 */

import type { CameraPerspective } from './types';

export interface CameraToggleProps {
  /** Current perspective, owned by the caller. */
  perspective: CameraPerspective;
  /** Called when the player picks a perspective. */
  onChange?: (perspective: CameraPerspective) => void;
}

const OPTIONS: Array<{ value: CameraPerspective; label: string }> = [
  { value: 'first', label: 'First-person' },
  { value: 'third', label: 'Third-person overhead' },
];

export function CameraToggle({ perspective, onChange }: CameraToggleProps) {
  return (
    <div
      role="group"
      aria-label="Camera perspective"
      className="flex gap-1 rounded bg-black/50 p-1"
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
              'rounded px-3 py-1 text-sm text-stone-100 ' +
              (active ? 'bg-amber-700' : 'bg-stone-700 hover:bg-stone-600')
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
