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
 *   condition. (Shrew skull never appears: the first
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
}: RitualPanelProps) {
  return (
    <section
      aria-label={`${siteLabel} ritual`}
      className="w-72 max-h-[70vh] overflow-y-auto rounded bg-black/60 p-2 text-stone-100"
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
        <p className="mt-1 rounded bg-black/50 px-2 py-1 text-xs text-stone-200">
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
              {kindOptions.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => onStageBone(option.kind)}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  className="min-h-[44px] rounded bg-stone-800 px-3 py-2 text-left text-sm text-stone-100"
                >
                  {option.display}
                  <span className="block text-xs text-stone-400">
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
                  className="min-h-[44px] rounded bg-stone-800 px-3 py-2 text-left text-sm text-stone-100"
                >
                  Offer {food.display} ×{food.count}
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
              className="min-h-[44px] rounded bg-stone-800 px-3 py-2 text-left text-sm text-stone-100"
            >
              Speak its name
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
