/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — in-place context menu (UI lane, presentation only).
 *
 * The small menu that opens ON an object, not in a separate screen:
 * render it inside a WorldAnchor (with interactive anchoring) and it
 * sits beside the stump or bush it belongs to. Actions are entirely
 * caller-supplied — this menu never invents what an object offers,
 * never checks whether an action is possible (that is the caller's
 * `disabled` flag), and never performs anything itself; a choice is
 * reported through `onSelect`.
 *
 * Selection is a prop, not internal state, like every other panel
 * in this directory.
 */

import type { ReactNode } from 'react';
import type { ContextAction } from './types';
import { UI_THEMES, type UiThemeName } from './themes';

export interface ContextMenuProps {
  /** The object the menu belongs to, in the caller's words. */
  objectName: string;
  /** Actions the caller offers for this object. */
  actions: ContextAction[];
  /**
   * Optional node rendered above the actions (e.g. a progress
   * bar for the object's ongoing process). Menus that pass
   * nothing render exactly as before.
   */
  header?: ReactNode;
  /** Id of the highlighted action, if any. Undefined = none. */
  selectedActionId?: string;
  /** Called when the player picks an action. Optional. */
  onSelect?: (id: string) => void;
  /** Called when the menu is closed. Optional. */
  onClose?: () => void;
  /** Look for the menu. Default "mire" (the world outside). */
  theme?: UiThemeName;
}

export function ContextMenu({
  objectName,
  actions,
  header,
  selectedActionId,
  onSelect,
  onClose,
  theme = 'mire',
}: ContextMenuProps) {
  const t = UI_THEMES[theme];
  return (
    <section aria-label={`${objectName} actions`} className={'w-56 max-h-[70vh] overflow-y-auto rounded p-2 ' + t.panel}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className={'text-sm font-semibold ' + t.heading}>{objectName}</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className={'rounded px-1.5 py-0.5 text-xs ' + t.button}
          >
            Close
          </button>
        ) : null}
      </div>
      {header ? <div className="mb-2">{header}</div> : null}
      {actions.length === 0 ? (
        <p className={'text-sm italic ' + t.muted}>
          No actions yet — actions arrive with the interaction system.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {actions.map((action) => {
            const selected = action.id === selectedActionId;
            return (
              <li key={action.id}>
                <button
                  type="button"
                  disabled={action.disabled}
                  onClick={() => onSelect?.(action.id)}
                  aria-pressed={selected}
                  className={
                    'w-full rounded px-2 py-1 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ' +
                    (selected ? t.selected : 'hover:bg-stone-800')
                  }
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span>{action.label}</span>
                    {action.hint ? (
                      <span className={t.muted}>{action.hint}</span>
                    ) : null}
                  </span>
                  {action.disabledNote ? (
                    <span className={'mt-0.5 block text-xs ' + t.muted}>
                      {action.disabledNote}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
