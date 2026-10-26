/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — hunger indicator (UI lane, presentation only).
 *
 * A light hunger element for the HUD, in the established light
 * style (same pill shape as WitchHealth, one line, no panel). It
 * shows ONLY the hunger stage it is passed — fed, hungry, or
 * too-hungry — as a plain word with a coloured dot. It carries no
 * numbers: no meter value, no bar, no drain rate, because the
 * stage is the whole contract this element was given. It computes
 * nothing about hunger itself and imports no game or systems
 * code; the wiring caller passes the stage from Systems' meter
 * when that shape lands (see below).
 *
 * With no stage it says plainly that it awaits the hunger system,
 * instead of inventing a stage — the same honesty as WitchHealth's
 * awaiting note. Hunger is NOT health: this element sits beside
 * WitchHealth, it does not merge into it, and nothing here touches
 * WitchHealth's value.
 *
 * TOO-HUNGRY HINT: when the stage is too-hungry, one line of
 * plain words names the ways back — traps, campfire cooking, or
 * nuts and berries. Those are the recovery paths from the task,
 * rendered as words only: this element does not check whether
 * any of them is available, and it opens no panel.
 *
 * STAGE SOURCE — READ THIS: at the time this file was written,
 * no hunger meter or stage shape exists in the repo (grep for
 * hunger across src/ returns nothing at the tip this landing
 * was built on). Systems owns the meter and will document its
 * stage query/event; until that shape lands, App mounts this
 * element with no stage, and the awaiting note is what the
 * player sees. The moment the documented shape exists, App
 * passes the stage through — no second channel is invented
 * here, and no stage is guessed in the meantime.
 */

/** Hunger stages, exactly as the task names them. */
export type HungerStage = 'fed' | 'hungry' | 'too-hungry';

export interface HungerIndicatorProps {
  /**
   * Current hunger stage, caller-supplied from Systems' meter.
   * Undefined = awaiting hunger system (renders the awaiting note).
   */
  stage?: HungerStage;
  /** Label for the element. Default "Hunger". */
  label?: string;
  className?: string;
}

const STAGE_WORD: Record<HungerStage, string> = {
  fed: 'Fed',
  hungry: 'Hungry',
  'too-hungry': 'Too hungry',
};

/** Small dot: green fed, amber hungry, blood-red too-hungry. */
const STAGE_DOT: Record<HungerStage, string> = {
  fed: '#5c823d',
  hungry: '#d4b768',
  'too-hungry': '#a82424',
};

export function HungerIndicator({
  stage,
  label = 'Hunger',
  className,
}: HungerIndicatorProps) {
  return (
    <div
      aria-label={label}
      className={
        'flex flex-col gap-0.5 rounded bg-black/50 px-2 py-1 text-sm text-stone-100 ' +
        (className ?? '')
      }
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{
            backgroundColor:
              stage === undefined ? '#78716c' : STAGE_DOT[stage],
          }}
        />
        {stage === undefined ? (
          <span className="italic text-stone-400">
            {label} — awaiting hunger system
          </span>
        ) : (
          <span>
            {label}: {STAGE_WORD[stage]}
          </span>
        )}
      </div>
      {stage === 'too-hungry' ? (
        <span className="text-xs text-stone-400">
          Traps, campfire cooking, or nuts and berries can bring her back.
        </span>
      ) : null}
    </div>
  );
}
