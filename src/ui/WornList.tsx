/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — worn-list display (UI lane, presentation only).
 *
 * The wardrobe line in the HUD: which of the five garments she
 * is wearing, plus one protection note at most. It is light on
 * purpose — a list of names and a single note line, never a
 * heavy panel. It owns no wardrobe logic: the caller passes the
 * worn set, and the caller passes the protection note text.
 * This component holds NO protection table and computes NO
 * percentages, so it cannot drift from the engine's numbers —
 * the caller (App, which may import game code) computes the
 * note from the engine's own garment table.
 *
 * GARMENT IDS mirror the engine's GarmentId in game/weather.ts
 * by name ('cloak' | 'shawl' | 'pointyHat' | 'mossyMittens' |
 * 'bogBoots'); display names are the plain words for them
 * (hooded cloak, shawl, Pointy Hat, Mossy Mittens, bog boots).
 * This file defines its own id type rather than importing game
 * code, keeping the src/ui/ boundary this directory holds.
 *
 * BONUS DIVERGENCE — READ THIS, DO NOT SMOOTH OVER: the round
 * brief lists worn bonuses as hat +1, shawl +3, cloak +6, but
 * those numbers match NO table in the repo or docs, and the
 * brief lists no bonus for mittens or boots. The engine's only
 * garment numbers are the weather module's per-element
 * percentages (lane-decided, flagged for Adam's pin pass):
 * cloak rain 40% / wind 30%, shawl cold 30%, Pointy Hat rain
 * 15%, Mossy Mittens cold 15%, bog boots wet 40% (plus the
 * boots' separate bog-travel mitigation). Until Adam reconciles
 * the two scales, this component shows whatever protection note
 * the caller supplies from the ENGINE's table — the numbers the
 * player actually experiences — and the +1/+3/+6 scale is
 * flagged in the round report for his call, not rendered as if
 * it were the engine.
 *
 * WIRING — READ THIS: at the time this file was written, no
 * wardrobe system exists in the repo (no garment items, no
 * garment recipes — the loom itself is craftable, its products
 * are TBD — and no worn set is tracked anywhere). So App
 * passes an empty worn set today. That is factual, not a
 * placeholder guess: with no garments in the world, she wears
 * nothing, and the protection note reads none. The moment a
 * wardrobe system tracks a worn set, App passes it through
 * and this list fills in.
 */

/**
 * Garment ids, mirroring game/weather.ts GarmentId by name.
 * Display names are the plain words in WORN_WORD below.
 */
export type WornGarment =
  | 'cloak'
  | 'shawl'
  | 'pointyHat'
  | 'mossyMittens'
  | 'bogBoots';

export interface WornListProps {
  /** Garments currently worn, caller-supplied. Empty = wearing none. */
  worn: readonly WornGarment[];
  /**
   * One-line protection note, caller-supplied from the engine's
   * garment table (e.g. "Protection: rain 49% · wind 30%").
   * Omitted = no note line.
   */
  protectionNote?: string;
  className?: string;
}

const WORN_WORD: Record<WornGarment, string> = {
  cloak: 'Hooded cloak',
  shawl: 'Shawl',
  pointyHat: 'Pointy Hat',
  mossyMittens: 'Mossy Mittens',
  bogBoots: 'Bog boots',
};

export function WornList({
  worn,
  protectionNote,
  className,
}: WornListProps) {
  return (
    <div
      aria-label="Worn garments"
      className={'text-sm text-stone-100 ' + (className ?? '')}
    >
      <p>
        Wearing:{' '}
        {worn.length === 0 ? (
          <span className="italic text-stone-400">none</span>
        ) : (
          worn.map((garment) => WORN_WORD[garment]).join(', ')
        )}
      </p>
      {protectionNote ? (
        <p className="text-xs text-stone-400">{protectionNote}</p>
      ) : null}
    </div>
  );
}
