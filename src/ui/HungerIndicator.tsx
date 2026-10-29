/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — hunger indicator (UI lane, presentation only).
 *
 * A light hunger element for the HUD, in the established light
 * style (same pill shape as WitchHealth, one line, no panel). It
 * shows the hunger stage it is passed — fed, hungry, or
 * too-hungry — as a plain word with a coloured dot, and, when
 * the caller also passes the meter value, a bar filled to that
 * value plus the number beside it. It computes nothing about
 * hunger itself and imports no game or systems code; stage and
 * value both come from the one Systems meter, never a second
 * value kept anywhere.
 *
 * BAR + NUMBER (Adam, 2026-10-26): the bar fill is the value
 * clamped to 0–100; the number is Math.round of that value —
 * a rounded integer, never the raw float (a drain float like
 * 0.6666666666666945 is exactly what a player should never
 * see). With no value passed, the bar and number are omitted
 * and the element renders exactly as before.
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
 * STAGE SOURCE — READ THIS: Systems owns the meter; App passes
 * its stage() and value() through, and no stage or value is
 * guessed in the meantime. With no stage passed, the awaiting
 * note is what the player sees, as before.
 *
 * SHREW WARNING LINE (2026-10-28, Systems 5e0af26 latch):
 * when warningActive, one line under the bar reads 'The
 * shrew bone stirs.' — the latch's steady state. When
 * warningFlash rides with it, the line pulses
 * (animate-pulse) for the shell's flash window — the
 * latch's entry edge — then stands steady. The shell
 * owns the flash timing; this element holds no timers
 * and computes nothing about hunger itself.
 */

/** Hunger stages, exactly as the task names them. */
export type HungerStage = 'fed' | 'hungry' | 'too-hungry';

export interface HungerIndicatorProps {
  /**
   * Current hunger stage, caller-supplied from Systems' meter.
   * Undefined = awaiting hunger system (renders the awaiting note).
   */
  stage?: HungerStage;
  /**
   * Current meter value, 0–100, caller-supplied from the SAME
   * meter as stage (hunger.value()). Undefined = no bar and no
   * number (renders as before). The bar fills to the clamped
   * value; the number beside it is the rounded integer.
   */
  value?: number;
  /** Label for the element. Default "Hunger". */
  label?: string;
  className?: string;
  /**
   * Shrew warning, steady state (Systems' HungerWarning
   * latch, active): when true, the stir line shows under
   * the bar. False/absent = no line (no charm, or hunger
   * above the warn threshold).
   */
  warningActive?: boolean;
  /**
   * Shrew warning, entry edge (the latch's fired): when
   * true WITH warningActive, the stir line pulses
   * (Tailwind animate-pulse) for the shell's flash
   * window, then the shell clears it and the line
   * stands steady. The component holds no timers —
   * the shell owns the flash window.
   */
  warningFlash?: boolean;
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
  value,
  label = 'Hunger',
  className,
  warningActive = false,
  warningFlash = false,
}: HungerIndicatorProps) {
  // Bar fill uses the clamped raw value; the number beside it
  // is the rounded integer — never the raw float. A non-finite
  // value renders as no value at all, not NaN on screen.
  const barPct =
    value !== undefined && Number.isFinite(value)
      ? Math.min(100, Math.max(0, value))
      : undefined;
  const shownValue = barPct !== undefined ? Math.round(barPct) : undefined;
  return (
    <div
      aria-label={label}
      className={
        'flex flex-col gap-0.5 rounded bg-black/45 px-2 py-1 text-sm text-stone-100 ' +
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
      {shownValue !== undefined ? (
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 rounded bg-stone-700">
            <div
              className="h-2 rounded"
              style={{
                width: `${barPct}%`,
                backgroundColor:
                  stage === undefined ? '#78716c' : STAGE_DOT[stage],
              }}
            />
          </div>
          <span>{shownValue}</span>
        </div>
      ) : null}
      {stage === 'too-hungry' ? (
        <span className="text-xs text-stone-400">
          Traps, campfire cooking, or nuts and berries can bring her back.
        </span>
      ) : null}
      {warningActive ? (
        <span
          className={
            'text-xs text-amber-200 ' + (warningFlash ? 'animate-pulse' : '')
          }
        >
          The shrew bone stirs.
        </span>
      ) : null}
    </div>
  );
}
