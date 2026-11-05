/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * THE FURNITURE PICK-UP PILL (the furniture-moves
 * wiring, 2026-11-05 — Adam: "Haven't met the woman
 * yet who doesn't like to rearrange furniture"): the
 * faced placed bench's / writing desk's verb, in the
 * bottom-centre actor family beside ScryButton /
 * FillJarButton (same seat, same dress). The shell
 * derives the faced piece (nearest faced within
 * reach, off the entity snapshots) and passes the
 * piece's display name; one press runs the pickup —
 * the Systems grant decides, the shell removes the
 * placed record only on its success.
 *
 * Presentation only: no game imports, no state. No
 * key hint — no key is bound to the act (the press
 * is the door, touch + desktop alike).
 */

export interface PickupButtonProps {
  /** The piece's display name, e.g. 'Crafted
   *  Workstation' / 'Writing Desk' — the label reads
   *  'Pick up <pieceName>' verbatim. */
  pieceName: string;
  onPress: () => void;
}

export function PickupButton({ pieceName, onPress }: PickupButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      onTouchStart={(e) => e.stopPropagation()}
      className="pointer-events-auto min-h-[44px] whitespace-nowrap rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-[#f0ead6]"
    >
      {`Pick up ${pieceName}`}
    </button>
  );
}
