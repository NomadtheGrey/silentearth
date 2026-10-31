/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — walk-away close policy for the
 * anchored world windows (UI lane).
 *
 * Adam's ruling (2026-10-31, from his screenshot — the
 * Campfire window stayed open after he'd walked off):
 * "Campfire activities window should close on its own if
 * we walk away." DEV's call: the WHOLE anchored family
 * under one mechanism, not a campfire special case.
 *
 * This module is the pure decision only: given the open
 * window's anchor (null when it no longer resolves — a
 * pile emptied out of the world), her position, and the
 * window's leash, should the window close? The shell owns
 * the anchors, the leashes, and the closing itself (each
 * window closes with its own close semantics).
 *
 * The leash shape (DRAFT, Adam's sighting tunes it): the
 * range that opened the window + 2 m.
 */

export interface WalkAwayPoint {
  x: number;
  z: number;
}

/**
 * True when the window should close: its anchor is gone,
 * or she stands farther than the leash from it.
 */
export function walkAwayShouldClose(
  anchor: WalkAwayPoint | null,
  player: WalkAwayPoint,
  leash: number,
): boolean {
  if (anchor === null) return true;
  return Math.hypot(player.x - anchor.x, player.z - anchor.z) > leash;
}
