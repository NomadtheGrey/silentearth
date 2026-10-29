/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — ritual staging panel (UI lane, presentation only).
 *
 * The placed-bone display + staging interactions for one
 * tier-1 Waking ritual at one ritual site (Adam,
 * 2026-10-27: tier-1 Waking only). Props-driven: the shell
 * maps Systems' ritual data to these display props, and
 * this panel owns no game logic, no state, and no imports
 * from game/engine/systems code.
 *
 * SHAPE (brief's pieces, as rendered here):
 * - Unstaged site: a kind list to stage — one button per
 *   bone kind not yet awakened, each hinted with its sky
 *   condition. Kinds she doesn't carry render DISABLED
 *   but visible (the collection shows what remains to
 *   find); digit badges number the carried rows only.
 *   (Shrew skull never appears: the first
 *   charm is given outright, no ritual.)
 * - Staged site: the required recipe as rows — bone,
 *   offering, spoken name — each showing done or missing,
 *   in the crafting-row pattern (required + have/missing).
 *   The TIME line renders ONLY when the ritual requires
 *   one (sky 'none' → no line, per Adam's placed-bone
 *   rule). Extras render nothing when the recipe has
 *   none (none are pinned yet).
 * - Completion needs no button: a staged ritual completes
 *   when its sky window arrives (the shell checks after
 *   every step and as the sky changes), so the panel
 *   never offers a complete-press.
 * - No Pick-up, no removal action: moving/removing a
 *   placed altar or bone is Adam's word later, not here.
 *
 * Touch + desktop share this panel exactly (parity); all
 * action buttons are 44 px tall, the touch minimum.
 */

/** One bone kind the player may stage at this site. */
export interface RitualKindOption {
  kind: string;
  display: string;
  skyLabel: string;
  /**
   * How many of this kind's bone item she carries
   * (shell-counted). Zero renders the row DISABLED but
   * visible (Adam, 2026-10-29 — the list is the Waking
   * collection; greyed rows show what remains to find,
   * instead of a live button that answers 'No such bone
   * carried.'). Disabled rows take no click/touch and
   * consume no digit badge — digits number the carried
   * rows only, matching the shell's digit dispatch.
   */
  carried: number;
}

/** One carried food kind the player may offer. */
export interface RitualFoodOption {
  item: string;
  display: string;
  count: number;
}

/** The staged ritual's display state (null = nothing staged). */
export interface RitualStagedDisplay {
  boneDisplay: string;
  bonePlaced: boolean;
  offeringGiven: boolean;
  nameSpoken: boolean;
  looks: number;
  minLooks: number;
  /** Sky condition key: 'day' | 'night' | 'dawn' | 'dusk' | 'full-moon' | 'none'. */
  sky: string;
  /** Player-facing sky label ('' when sky is 'none' — no line). */
  skyLabel: string;
  windowOpen: boolean;
  completed: boolean;
}

import type { ReactNode } from 'react';
import { KEY_BADGE_CLASS, UI_THEMES, type UiThemeName } from './themes';

export interface RitualPanelProps {
  siteLabel: string;
  staged: RitualStagedDisplay | null;
  kindOptions: RitualKindOption[];
  foodOptions: RitualFoodOption[];
  note: string | null;
  onStageBone: (kind: string) => void;
  onGiveOffering: (item: string) => void;
  onSpeakName: () => void;
  onClose: () => void;
  /**
   * Show PC digit badges (beautification rider, 2026-10-29):
   * the dispatchable buttons numbered in the shell's
   * digit-dispatch order (kind list when unstaged;
   * offering foods then Speak when staged), capped at 9
   * — the ContextMenu rule. Caller passes !isTouch. Hint
   * only. Default false = no badges.
   */
  showKeyHints?: boolean;
  /** Look for the panel. Default "mire". */
  theme?: UiThemeName;
}

export function RitualPanel({
  siteLabel,
  staged,
  kindOptions,
  foodOptions,
  note,
  onStageBone,
  onGiveOffering,
  onSpeakName,
  onClose,
  showKeyHints = false,
  theme = 'mire',
}: RitualPanelProps) {
  const t = UI_THEMES[theme];
  // Digit-badge counter, consumed in render order (see
  // the prop doc). Beyond 9 there is no digit, so no
  // badge.
  let hintCount = 0;
  const nextHint = (): number | null => {
    hintCount += 1;
    return showKeyHints && hintCount <= 9 ? hintCount : null;
  };
  const hintBadge = (hint: number | null): ReactNode =>
    hint !== null ? (
      <span aria-hidden="true" className={'ml-1 ' + KEY_BADGE_CLASS}>
        {hint}
      </span>
    ) : null;
  return (
    <section
      aria-label={`${siteLabel} ritual`}
      className={'w-72 max-h-[70vh] overflow-y-auto rounded-2xl p-2 ' + t.panel}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{siteLabel} ritual</h3>
        <button
          type="button"
          onClick={onClose}
          onTouchStart={(e) => {
            e.stopPropagation();
          }}
          aria-label="Close dialog"
          className="min-h-[44px] px-3 py-2 text-sm text-stone-300"
        >
          X
        </button>
      </div>
      {note ? (
        <p className="mt-1 rounded bg-black/45 px-2 py-1 text-xs text-stone-200">
          {note}
        </p>
      ) : null}
      {staged === null ? (
        <>
          <p className="mt-2 text-xs text-stone-300">
            Stage a bone here to begin its Waking.
          </p>
          {kindOptions.length === 0 ? (
            <p className="mt-2 text-xs text-stone-300">
              All known bones are awakened.
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {kindOptions.map((option) =>
                option.carried > 0 ? (
                  <button
                    key={option.kind}
                    type="button"
                    onClick={() => onStageBone(option.kind)}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    className={'min-h-[44px] rounded px-3 py-2 text-left text-sm ' + t.button}
                  >
                    {option.display}
                    {hintBadge(nextHint())}
                    <span className={'block text-xs ' + t.muted}>
                      {option.skyLabel}
                    </span>
                  </button>
                ) : (
                  // Not carried: visible but inert — no
                  // handler, no badge (nextHint is never
                  // called, so carried rows number from 1
                  // in display order, the shell's dispatch
                  // rule too).
                  <button
                    key={option.kind}
                    type="button"
                    disabled
                    aria-disabled="true"
                    className={
                      'min-h-[44px] cursor-not-allowed rounded px-3 py-2 text-left text-sm opacity-50 ' +
                      t.button
                    }
                  >
                    {option.display}
                    <span className={'block text-xs ' + t.muted}>
                      {option.skyLabel}
                    </span>
                  </button>
                ),
              )}
            </div>
          )}
        </>
      ) : staged.completed ? (
        <p className="mt-2 text-sm text-stone-100">
          {staged.boneDisplay} awakens.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-2 text-sm">
          <p>
            Bone: {staged.boneDisplay} —{' '}
            {staged.bonePlaced ? 'placed ✓' : 'missing'}
          </p>
          {staged.offeringGiven ? (
            <p>Offering: given ✓</p>
          ) : foodOptions.length === 0 ? (
            <p>Offering: no food carried.</p>
          ) : (
            <div className="flex flex-col gap-1">
              <p>Offering: give food —</p>
              {foodOptions.map((food) => (
                <button
                  key={food.item}
                  type="button"
                  onClick={() => onGiveOffering(food.item)}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  className={'min-h-[44px] rounded px-3 py-2 text-left text-sm ' + t.button}
                >
                  Offer {food.display} ×{food.count}
                  {hintBadge(nextHint())}
                </button>
              ))}
            </div>
          )}
          {staged.nameSpoken ? (
            <p>Name: spoken ✓</p>
          ) : staged.looks >= staged.minLooks ? (
            <button
              type="button"
              onClick={onSpeakName}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              className={'min-h-[44px] rounded px-3 py-2 text-left text-sm ' + t.button}
            >
              Speak its name
              {hintBadge(nextHint())}
            </button>
          ) : (
            <p>
              Name: she does not know it yet ({staged.looks}/
              {staged.minLooks} looks).
            </p>
          )}
          {staged.skyLabel !== '' ? (
            <p>
              Needs: {staged.skyLabel} —{' '}
              {staged.windowOpen
                ? 'window open now.'
                : `window closed — waits for the next ${staged.skyLabel.toLowerCase()}.`}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
