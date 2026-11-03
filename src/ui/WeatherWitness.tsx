/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — the cold/wet witness (UI lane,
 * presentation only; W3 of the weather build, Adam:
 * 'let's get the weather going', 2026-11-02).
 *
 * Adam's display principle governs: her cold and wet
 * SHOW outright — two light pills in the HungerIndicator
 * idiom (stage word + coloured dot + bar + rounded
 * number), seated in the vitals group beside hunger.
 * Systems owns the gauges (ColdWetState); this element
 * renders the stage KEYS it is passed through a display
 * table and computes nothing — no thresholds, no rates,
 * no second value lives here. With no facts passed, it
 * renders nothing at all: the witness stands only when
 * the gauges do (the build order seats it behind W2).
 *
 * STAGE KEYS are Systems' (cold-wet.ts): cold —
 * comfortable / chilly / cold / freezing; wet — dry /
 * damp / wet / soaked. The DISPLAY WORDS below are UI's
 * presentation draft over those keys (Warm / Cool /
 * Chilled for cold's first three rungs) — a copy table,
 * settled with Adam at the W4 pin pass; the keys, and
 * therefore the logic, never change with the words.
 *
 * THE INJURY WITNESS (the feral build, 2026-11-03):
 * Systems' injury ladder (injury.ts: sound / hurt /
 * wounded / critical) joins the same witness as a stage
 * pill — the shell passes it only when she is not
 * sound, and it carries no bar and no number: the
 * ladder is stages, not a gauge, and this element
 * invents no value the state does not hold.
 */

import { UI_THEMES, type UiThemeName } from './themes';

/** Cold stage keys, exactly as Systems' ColdWetState names them. */
export type ColdStageKey = 'comfortable' | 'chilly' | 'cold' | 'freezing';
/** Wet stage keys, exactly as Systems' ColdWetState names them. */
export type WetStageKey = 'dry' | 'damp' | 'wet' | 'soaked';
/** Injury stage keys, exactly as Systems' InjuryState names them. */
export type InjuryStageKey = 'sound' | 'hurt' | 'wounded' | 'critical';

export interface WeatherWitnessProps {
  /** Cold gauge: value 0–100 + stage key, from the one meter. */
  cold?: { value: number; stage: ColdStageKey };
  /** Wet gauge: value 0–100 + stage key, from the one meter. */
  wet?: { value: number; stage: WetStageKey };
  /**
   * Injury stage, from the one ladder (Systems' injury.ts).
   * The shell passes it only when she is not sound — the
   * witness stands when there is something to witness.
   * The ladder carries no gauge value, so the pill is a
   * stage pill (word + dot), never a bar with an invented
   * number.
   */
  injury?: { stage: InjuryStageKey };
  /** Look for the pills. Default "mire" (the world outside). */
  theme?: UiThemeName;
  className?: string;
}

/** Display words over Systems' injury keys (DRAFT — pin pass). */
export const INJURY_WORD: Record<InjuryStageKey, string> = {
  sound: 'Sound',
  hurt: 'Hurt',
  wounded: 'Wounded',
  critical: 'Critical',
};

/** Dot colours up the injury rungs: amber, rust, deep red. */
const INJURY_DOT: Record<InjuryStageKey, string> = {
  sound: '#5c823d',
  hurt: '#d4b768',
  wounded: '#c47b3a',
  critical: '#b03a2e',
};

/** Display words over Systems' keys (DRAFT — W4 pin pass). */
export const COLD_WORD: Record<ColdStageKey, string> = {
  comfortable: 'Warm',
  chilly: 'Cool',
  cold: 'Chilled',
  freezing: 'Freezing',
};

/** Dot colours up the cold rungs: green, pale ice, blue, deep frost. */
const COLD_DOT: Record<ColdStageKey, string> = {
  comfortable: '#5c823d',
  chilly: '#9fc6d8',
  cold: '#5b8fc4',
  freezing: '#dfeefc',
};

/** Display words over Systems' keys (DRAFT — W4 pin pass). */
export const WET_WORD: Record<WetStageKey, string> = {
  dry: 'Dry',
  damp: 'Damp',
  wet: 'Wet',
  soaked: 'Soaked',
};

/** Dot colours up the wet rungs: green, amber, blue, deep water. */
const WET_DOT: Record<WetStageKey, string> = {
  dry: '#5c823d',
  damp: '#d4b768',
  wet: '#5b8fc4',
  soaked: '#2b4d8f',
};

function GaugePill({
  label,
  word,
  dot,
  value,
  theme,
}: {
  label: string;
  word: string;
  dot: string;
  value: number;
  theme: UiThemeName;
}) {
  const t = UI_THEMES[theme];
  const clamped = Math.min(100, Math.max(0, value));
  const shown = Math.round(clamped);
  return (
    <div
      className={'rounded px-3 py-2 text-sm text-stone-200 ' + t.overlay}
      aria-label={`${label}: ${word}, ${shown} of 100`}
    >
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
          style={{ backgroundColor: dot }}
        />
        <span>{label}</span>
        <span className="text-stone-400">{word}</span>
        <span className="ml-auto text-stone-300">{shown}</span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded bg-stone-700/60"
        aria-hidden="true"
      >
        <div
          className="h-full rounded bg-stone-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function StagePill({
  label,
  word,
  dot,
  theme,
}: {
  label: string;
  word: string;
  dot: string;
  theme: UiThemeName;
}) {
  const t = UI_THEMES[theme];
  return (
    <div
      className={'rounded px-3 py-2 text-sm text-stone-200 ' + t.overlay}
      aria-label={`${label}: ${word}`}
    >
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 shrink-0 translate-y-[-1px] rounded-full"
          style={{ backgroundColor: dot }}
        />
        <span>{label}</span>
        <span className="text-stone-400">{word}</span>
      </div>
    </div>
  );
}

export function WeatherWitness({
  cold,
  wet,
  injury,
  theme = 'mire',
  className,
}: WeatherWitnessProps) {
  if (!cold && !wet && !injury) return null;
  return (
    <div className={'flex flex-col gap-2 ' + (className ?? '')}>
      {cold ? (
        <GaugePill
          label="Cold"
          word={COLD_WORD[cold.stage]}
          dot={COLD_DOT[cold.stage]}
          value={cold.value}
          theme={theme}
        />
      ) : null}
      {wet ? (
        <GaugePill
          label="Wet"
          word={WET_WORD[wet.stage]}
          dot={WET_DOT[wet.stage]}
          value={wet.value}
          theme={theme}
        />
      ) : null}
      {injury ? (
        <StagePill
          label="Injury"
          word={INJURY_WORD[injury.stage]}
          dot={INJURY_DOT[injury.stage]}
          theme={theme}
        />
      ) : null}
    </div>
  );
}
