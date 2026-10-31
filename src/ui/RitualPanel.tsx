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
 *   CARRIED bone kind not yet awakened, each hinted with
 *   its sky condition. Kinds she doesn't carry simply
 *   don't appear (Adam, 2026-10-31 — supersedes the
 *   2026-10-29 disabled-but-visible honesty rows); digit
 *   badges number the listed rows, which are exactly the
 *   carried ones. When nothing unawakened is carried,
 *   one plain line says so. (Shrew skull never appears:
 *   the first charm is given outright, no ritual.)
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
 * - SITE ACTS (altar transformation, 2026-10-30): an
 *   optional acts row set above the staging content —
 *   the stump's three makings + the journal Linking at
 *   altar-grade sites, composed by the shell (each act
 *   present until done). Act buttons are always live;
 *   a refusal is spoken through the note, the wish-pill
 *   pattern. Acts take the panel's first digit badges
 *   (render order), ahead of the kind/offer rows — the
 *   shell's digit dispatch reads the same order.
 * - THE FAMILIAR'S RITE (Build 2, 2026-10-31): an
 *   optional acts section BELOW the staging content —
 *   one guarded act per bonded animal (raise / step
 *   down / raise-in-place), composed by the shell from
 *   the companion records and passed only at
 *   altar-grade sites. A press does not perform the
 *   rite: the shell guards it with its confirm first
 *   (the animal is named there). Rite buttons take no
 *   digit badges in v1 — the dispatch order above is
 *   unchanged.
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
   * (shell-counted). The list shows CARRIED kinds only
   * (Adam, 2026-10-31): a zero count means the row does
   * not render at all — the field still decides, and the
   * shell's digit dispatch filters by the same count, so
   * badges and digits number the rendered rows 1..n.
   */
  carried: number;
}

/** One site act the shell offers at this site. */
export interface RitualSiteAct {
  id: string;
  label: string;
}

/**
 * One rite act the shell offers at an altar-grade site
 * (Build 2): id is '<act>:<creatureId>' with act in
 * elevate | relinquish | supersede; the label names
 * the animal. The press is a REQUEST — the shell
 * guards it with a confirm before anything is done.
 */
export interface RitualRiteAct {
  id: string;
  label: string;
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
  /** Transformation acts for this site (shell-composed;
   *  empty/absent = no acts section). */
  siteActs?: RitualSiteAct[];
  onSiteAct?: (id: string) => void;
  /** The familiar's rite acts (shell-composed from the
   *  companion records; passed only at altar-grade
   *  sites; empty/absent = no rite section). */
  riteActs?: RitualRiteAct[];
  onRiteAct?: (id: string) => void;
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
  siteActs,
  onSiteAct,
  riteActs,
  onRiteAct,
  onStageBone,
  onGiveOffering,
  onSpeakName,
  onClose,
  showKeyHints = false,
  theme = 'mire',
}: RitualPanelProps) {
  const t = UI_THEMES[theme];
  // CARRIED-ONLY LIST (Adam, 2026-10-31): the staging
  // list shows only bones actually in her pack — kinds
  // with a zero count don't render. The shell's digit
  // dispatch filters its options by the same count, so
  // badges and digits stay in lockstep on the rows that
  // remain.
  const carriedKindOptions = kindOptions.filter(
    (option) => option.carried > 0,
  );
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
      {siteActs && siteActs.length > 0 && onSiteAct ? (
        <div className="mt-2 flex flex-col gap-1">
          {siteActs.map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => onSiteAct(act.id)}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              className={'min-h-[44px] rounded px-3 py-2 text-left text-sm ' + t.button}
            >
              {act.label}
              {hintBadge(nextHint())}
            </button>
          ))}
        </div>
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
          ) : carriedKindOptions.length === 0 ? (
            // Unawakened kinds exist but none are in her
            // pack (Adam, 2026-10-31): one plain line
            // instead of an empty list (copy DRAFT).
            <p className="mt-2 text-xs text-stone-300">
              No bones in your pack.
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-1">
              {carriedKindOptions.map((option) => (
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
              ))}
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
      {riteActs && riteActs.length > 0 && onRiteAct ? (
        <div className="mt-3 border-t border-moss-deep pt-2">
          <p className={'text-xs font-semibold uppercase tracking-wide ' + t.muted}>
            The familiar's rite
          </p>
          <div className="mt-1 flex flex-col gap-1">
            {riteActs.map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => onRiteAct(act.id)}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                className={'min-h-[44px] rounded px-3 py-2 text-left text-sm ' + t.button}
              >
                {act.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
