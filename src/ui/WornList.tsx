/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — wardrobe display + wear/remove
 * (UI lane, presentation only).
 *
 * The wardrobe section in the HUD: the five garments, one row
 * each, with what she is doing about it — worn, carried (with
 * a Wear button), or not owned — plus two note lines at most:
 * a protection note and a carrying-bonus note. It is light on
 * purpose: five short rows and two lines, never a heavy panel.
 * It owns no wardrobe logic: the caller passes the worn set,
 * the carried set, and both note texts, and reports wear /
 * remove presses through callbacks. The caller (App, which may
 * import game/systems code) owns the Wardrobe, the capacity
 * arithmetic, and the weather table.
 *
 * GARMENT IDS mirror the engine's GarmentId in game/weather.ts
 * by name ('cloak' | 'shawl' | 'pointyHat' | 'mossyMittens' |
 * 'bogBoots'); display names are the plain words for them
 * (hooded cloak, shawl, Pointy Hat, Mossy Mittens, bog boots).
 * This file defines its own id type rather than importing game
 * code, keeping the src/ui/ boundary this directory holds.
 *
 * TWO BONUS AXES — DO NOT CONFUSE THEM (both real, both
 * separate):
 * - Carrying bonus (PINNED, Adam 2026-10-26, via Systems'
 *   Wardrobe.wornCapacityBonus): cloak +6, shawl +3, Pointy
 *   Hat +1, mittens +0, bog boots +0 — extra carrying room
 *   while the garment is worn AND carried. Wearing does not
 *   consume the garment, and a worn garment is not counted
 *   against personal capacity.
 * - Weather protection (engine table, game/weather.ts,
 *   lane-decided percentages flagged for Adam's pin pass):
 *   cloak rain 40% / wind 30%, shawl cold 30%, Pointy Hat
 *   rain 15%, Mossy Mittens cold 15%, bog boots wet 40%
 *   (plus the boots' separate bog-travel mitigation).
 * The caller supplies each note from its own source; this
 * component holds NO table and computes NO number, so it
 * cannot drift from either source.
 *
 * LOOM GAP — FLAGGED: garment recipes carry station 'loom',
 * and no loom station presence exists yet (a crafted loom is
 * an inventory item, not a placed station the crafting shell
 * can detect), so garments cannot be crafted in play today.
 * The wardrobe below is wired to the real Wardrobe and will
 * fill in the moment garments can be obtained; until then
 * most rows honestly read "not owned".
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
  /** Garments currently worn, caller-supplied. */
  worn: readonly WornGarment[];
  /** Garments currently carried, caller-supplied. */
  carried: readonly WornGarment[];
  /** Called when the player presses Wear on a carried garment. */
  onWear?: (garment: WornGarment) => void;
  /** Called when the player presses Remove on a worn garment. */
  onRemove?: (garment: WornGarment) => void;
  /**
   * One-line protection note, caller-supplied from the engine's
   * garment table (e.g. "Protection: rain 49% · wind 30%").
   * Omitted = no note line.
   */
  protectionNote?: string;
  /**
   * One-line carrying-bonus note, caller-supplied from the
   * Wardrobe (e.g. "Carrying bonus +9"). Omitted = no line.
   */
  capacityNote?: string;
  /**
   * One-line umbrella rain-protection note, caller-supplied
   * (e.g. "Umbrella: rain −40%" once a mechanic supplies the
   * number, or a plain qualitative line until then). Omitted
   * = no line. This component holds no umbrella mechanic and
   * computes no rain number.
   */
  umbrellaNote?: string;
  /** Caller-supplied note line (e.g. a wear/remove error). */
  note?: string | null;
  /** Thumb-sized Wear/Remove buttons (44 px targets) on touch. Default false. */
  comfortable?: boolean;
  className?: string;
}

const WORN_ORDER: WornGarment[] = [
  'cloak',
  'shawl',
  'pointyHat',
  'mossyMittens',
  'bogBoots',
];

const WORN_WORD: Record<WornGarment, string> = {
  cloak: 'Hooded cloak',
  shawl: 'Shawl',
  pointyHat: 'Pointy Hat',
  mossyMittens: 'Mossy Mittens',
  bogBoots: 'Bog boots',
};

export function WornList({
  worn,
  carried,
  onWear,
  onRemove,
  protectionNote,
  capacityNote,
  umbrellaNote,
  note,
  comfortable = false,
  className,
}: WornListProps) {
  const actionBtn = comfortable
    ? 'pointer-events-auto rounded bg-[#3a4436] px-3 py-2 text-sm min-h-[44px] hover:bg-[#4a5546]'
    : 'pointer-events-auto rounded bg-[#3a4436] px-2 py-0.5 text-xs hover:bg-[#4a5546]';
  return (
    <div
      aria-label="Wardrobe"
      className={'text-sm text-stone-100 ' + (className ?? '')}
    >
      <p className="text-xs text-stone-400">Wardrobe</p>
      <ul className="mt-1 flex flex-col gap-1">
        {WORN_ORDER.map((garment) => {
          const isWorn = worn.includes(garment);
          const isCarried = carried.includes(garment);
          return (
            <li
              key={garment}
              className="flex items-center justify-between gap-2"
            >
              <span>
                {WORN_WORD[garment]}{' '}
                <span className="text-xs text-stone-400">
                  {isWorn ? '— worn' : isCarried ? '— carried' : '— not owned'}
                </span>
              </span>
              {isWorn ? (
                <button
                  type="button"
                  onClick={() => onRemove?.(garment)}
                  className={actionBtn}
                >
                  Remove
                </button>
              ) : isCarried ? (
                <button
                  type="button"
                  onClick={() => onWear?.(garment)}
                  className={actionBtn}
                >
                  Wear
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {protectionNote ? (
        <p className="mt-1 text-xs text-stone-400">{protectionNote}</p>
      ) : null}
      {capacityNote ? (
        <p className="text-xs text-stone-400">{capacityNote}</p>
      ) : null}
      {umbrellaNote ? (
        <p className="text-xs text-stone-400">{umbrellaNote}</p>
      ) : null}
      {note ? <p className="text-xs text-red-300">{note}</p> : null}
    </div>
  );
}
