/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — fire state chip (UI lane, presentation only).
 *
 * The small chip that sits ON a fire object and says what it is
 * doing: unlit, lit, or cooking. It is light presentation only —
 * a flame glyph when lit, plain words otherwise — and it owns no
 * fire logic: no lighting, no fuel, no cooking, no timers. The
 * caller passes the fire's kind and state; the caller (a future
 * fire system) owns what those mean and when they change.
 *
 * Kinds are the fire ladder as crafted: campfire, hearth, kiln,
 * bloomery. Cooking here is open-fire work (stick or fire-buried),
 * never pot cooking — the chip says "Cooking" and nothing about
 * vessels, because cooking does not use them.
 *
 * CANDLE NOTE — READ THIS: the witch's avatar/portrait candle
 * stays as it is, and NOTHING here assumes the candle lights
 * fires. Whether the candle relates to fire-lighting at all is
 * flagged open for Adam's call; lighting arrives through the
 * fire interactions (see below), not through the candle.
 *
 * ACTIONS RIDE ELSEWHERE: placing, lighting, and cooking actions
 * are caller-supplied ContextMenu actions on the fire object
 * (ContextMenu already exists for exactly this: in-place menus
 * with caller-owned actions). This chip only reports state; it
 * never offers an action itself.
 *
 * MOUNTING — READ THIS: at the time this file was written, no
 * fire placement, fire state, or cooking execution exists in the
 * repo (fires are craftable inventory items via CraftingMenu,
 * not placed world objects, and the fire system is explicitly
 * not yet built). So this chip is currently UNMOUNTED in App —
 * it is staged, verified, and ready for the moment fire objects
 * and their state land. Mounting it against invented fire state
 * would be showing a fire that is not there.
 */

/** Fire-ladder kinds, as crafted. */
export type FireKind = 'campfire' | 'hearth' | 'kiln' | 'bloomery';

/** What a fire object is doing, caller-supplied. */
export type FireStateValue = 'unlit' | 'lit' | 'cooking';

export interface FireStateProps {
  /** Which fire this is. */
  kind: FireKind;
  /** What it is doing. */
  state: FireStateValue;
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

export function FireState({ kind, state, className }: FireStateProps) {
  const word =
    state === 'cooking' ? 'Cooking' : state === 'lit' ? 'Lit' : 'Unlit';
  return (
    <div
      aria-label={`${KIND_WORD[kind]}: ${word}`}
      className={
        'flex items-center gap-2 rounded bg-black/50 px-2 py-1 text-sm text-stone-100 ' +
        (className ?? '')
      }
    >
      {state === 'unlit' ? null : <FlameGlyph />}
      <span>{KIND_WORD[kind]}</span>
      <span className={state === 'unlit' ? 'italic text-stone-400' : ''}>
        {word}
      </span>
    </div>
  );
}
