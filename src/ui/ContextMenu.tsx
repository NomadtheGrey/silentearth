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
import { KEY_BADGE_CLASS, UI_THEMES, type UiThemeName } from './themes';

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
  /**
   * Show PC digit badges (button-keys map, Adam
   * 2026-10-29): every dispatchable button numbered in
   * the shell's digit-dispatch flatten order (actions
   * in order; an arrows row contributes its arrows in
   * order), capped at 9. Caller passes !isTouch. Hint
   * only — the header Close button is never numbered
   * (Esc closes). Default false = no badges.
   */
  showKeyHints?: boolean;
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
  showKeyHints = false,
  onSelect,
  onClose,
  theme = 'mire',
}: ContextMenuProps) {
  const t = UI_THEMES[theme];
  // Digit-badge counter, consumed in render order by
  // the action rows below (see the prop doc): a plain
  // action takes one number, an arrows row takes one
  // per arrow. Beyond 9 there is no digit, so no badge.
  let hintCount = 0;
  const nextHint = (): number | null => {
    hintCount += 1;
    return showKeyHints && hintCount <= 9 ? hintCount : null;
  };
  const hintClass = 'ml-1 ' + KEY_BADGE_CLASS;
  return (
    <section aria-label={`${objectName} actions`} className={'w-56 max-h-[70vh] overflow-y-auto rounded-2xl p-2 ' + t.panel}>
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
            if (action.arrows) {
              return (
                <li key={action.id}>
                  <div>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm">{action.label}</span>
                      {action.countsText ? (
                        <span className={'text-xs ' + t.muted}>
                          {action.countsText}
                        </span>
                      ) : action.counts ? (
                        <span className={'text-xs ' + t.muted}>
                          pile ×{action.counts.pile} · carried ×
                          {action.counts.carried}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 flex gap-1">
                      {action.arrows.map((arrow) => {
                        const hint = nextHint();
                        return (
                          <button
                            key={arrow.id}
                            type="button"
                            disabled={arrow.disabled}
                            onClick={() => onSelect?.(arrow.id)}
                            aria-label={arrow.ariaLabel}
                            className="min-h-[44px] min-w-[44px] flex-1 rounded text-base disabled:cursor-not-allowed disabled:opacity-40 hover:bg-stone-800"
                          >
                            <span aria-hidden="true">{arrow.glyph}</span>
                            {hint !== null ? (
                              <span aria-hidden="true" className={hintClass}>
                                {hint}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </span>
                    {action.disabledNote ? (
                      <span className={'mt-0.5 block text-xs ' + t.muted}>
                        {action.disabledNote}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            }
            const hint = nextHint();
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
                    <span>
                      {action.label}
                      {hint !== null ? (
                        <span aria-hidden="true" className={hintClass}>
                          {hint}
                        </span>
                      ) : null}
                    </span>
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
