/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * THE ARC DEAL (Adam's mint ruling, 2026-11-07) — a
 * leaf (imports nothing): every fragment carrier in
 * the world deals its arc through this one function,
 * off its own carrier stream. A fragment is an ARC of
 * its mark's whole sign: arcStart, a random start hour
 * (0–11), and arcHours, a random integer length
 * (4–6) — ONE dealing range for every carrier family,
 * Home, Circle and Travel alike (the old completeness
 * bands are retired as deal inputs). completeness
 * rides as the arc's derived share, arcHours / 12, so
 * standing consumers read the number the arc implies
 * until Systems' filled-clock accumulation re-keys
 * them. Two draws: the start first, then the length.
 */
export function dealFragmentArc(rand: () => number): {
  arcStart: number;
  arcHours: number;
  completeness: number;
} {
  const arcStart = Math.floor(rand() * 12);
  const arcHours = 4 + Math.floor(rand() * 3);
  return { arcStart, arcHours, completeness: arcHours / 12 };
}
