/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — fire state chip (UI lane, presentation only).
 *
 * The small chip that sits ON a placed fire object and says
 * what it is doing: unlit, lighting, or lit. It is light
 * presentation only — a flame glyph when lit or lighting,
 * plain words otherwise — and it owns no fire logic: no
 * lighting, no fuel, no cooking, no timers. The caller passes
 * the fire's kind and status from the engine's placed-fire
 * state; the caller (the engine lighting machine) owns what
 * those mean and when they change.
 *
 * TOUCH TARGET (Adam, 2026-10-27 — campfire tap break): the
 * button is at least 44 px tall, the touch rule. A smaller
 * chip is easily missed by a thumb, and a missed tap on the
 * right half lands on the look field, which harvests ground
 * and at too-hungry reports a harvest failure instead of
 * opening this menu. The button also stops touchstart
 * propagation so a chip tap can never double as a
 * look-field tap, whatever the future DOM order (no
 * preventDefault — that would swallow the click itself).
 *
 * Kinds are the fire ladder as placed: campfire, hearth, kiln,
 * bloomery. The chip is a button when the caller passes
 * onSelect (tap a fire to open its lighting menu); otherwise
 * it is a plain chip.
 *
 * NAME OVERLAP — READ THIS: this chip is named FireState,
 * and Systems ALSO has a class named FireState
 * (src/systems/fire.ts, the cooking state: seconds-based
 * lighting + cook()). They are different things in different
 * modules: this chip renders the ENGINE's placed-fire state
 * (src/game/fireState.ts: click/wait lighting machine, lit
 * flag, events). The chip never imports the Systems class.
 *
 * COOKING — NOT SHOWN, FLAGGED: Systems' cook() takes a
 * Systems FireState, and engine lit is a separate flag on a
 * placed fire — the two models do not share a lit state yet,
 * so no cook action is wired through this chip. Cooking UI
 * waits on the lanes agreeing which state owns lit (or on a
 * bridge from engine lit to the cooking gate). Until then the
 * chip reports lighting only, and offers no cook button that
 * would cook against the wrong fire.
 *
 * CANDLE NOTE — READ THIS: the witch's avatar/portrait candle
 * stays as it is, and NOTHING here assumes the candle lights
 * fires. Lighting methods are flint and friction only; the
 * candle relation stays flagged open for Adam's call.
 */

/** Fire-ladder kinds, as placed. */
export type FireKind = 'campfire' | 'hearth' | 'kiln' | 'bloomery';

/** Engine placed-fire status, as the chip shows it. */
export type FireChipStatus = 'unlit' | 'lighting' | 'lit';

export interface FireStateProps {
  /** Which fire this is. */
  kind: FireKind;
  /** What it is doing, from the engine's placed-fire state. */
  status: FireChipStatus;
  /** Lighting detail, caller-supplied (e.g. "Clicks 1 of 3"). */
  lightingDetail?: string;
  /** Called when the player taps the chip. Optional. */
  onSelect?: () => void;
  className?: string;
}

const KIND_WORD: Record<FireKind, string> = {
  campfire: 'Campfire',
  hearth: 'Hearth',
  kiln: 'Kiln',
  bloomery: 'Bloomery',
};

function FlameGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M 7,13 C 3,10 3,7 5,4 C 6,6 7,6 7,4 C 8,6 11,7 10,10 C 9,12 8,13 7,13 Z"
        fill="#d4b768"
      />
      <path
        d="M 7,12 C 5,10 5,8 7,6 C 9,8 9,10 7,12 Z"
        fill="#a82424"
      />
    </svg>
  );
}

export function FireState({
  kind,
  status,
  lightingDetail,
  onSelect,
  className,
}: FireStateProps) {
  const word =
    status === 'lit' ? 'Lit' : status === 'lighting' ? 'Lighting…' : 'Unlit';
  // Unlit + no process (the caller passes no lightingDetail then —
  // unlit ⟺ no process, proven by the shell's chip mapping):
  // the chip reads "{Kind} — click to light" (Adam's words),
  // an invitation at full brightness, not a dimmed status.
  // All other statuses render exactly as before, so the chip
  // never contradicts the menu (same lighting facts).
  const ariaLabel =
    status === 'unlit'
      ? `${KIND_WORD[kind]}: click to light`
      : `${KIND_WORD[kind]}: ${word}`;
  const inner =
    status === 'unlit' ? (
      <>
        <span>{KIND_WORD[kind]}</span>
        <span>— click to light</span>
      </>
    ) : (
      <>
        <FlameGlyph />
        <span>{KIND_WORD[kind]}</span>
        <span>{word}</span>
        {lightingDetail ? (
          <span className="text-xs text-stone-400">{lightingDetail}</span>
        ) : null}
      </>
    );
  const style =
    'flex items-center gap-2 rounded bg-black/45 px-2 py-1 text-sm text-stone-100 ' +
    (className ?? '');
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        onTouchStart={(e) => {
          e.stopPropagation();
        }}
        aria-label={ariaLabel}
        className={'pointer-events-auto min-h-[44px] ' + style}
      >
        {inner}
      </button>
    );
  }
  return (
    <div aria-label={ariaLabel} className={style}>
      {inner}
    </div>
  );
}
