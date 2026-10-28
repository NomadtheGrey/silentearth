/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — placed-altar chip (UI lane, presentation only).
 *
 * The world-anchored label for a placed ritual altar (Adam,
 * 2026-10-27: placeable + visible ONLY). This chip is
 * LABEL-ONLY by design: it names the altar and does nothing
 * else. There is no menu behind it — rituals are not in
 * this order (no ritual actions exist to offer), and no
 * Pick-up action is invented (removal mechanics are not in
 * this order either). When rituals land, this chip gains
 * whatever menu that order defines; until then it is a
 * marker, not a control.
 *
 * Look: the world-chip family (the torch chip's classes) —
 * dark pill, readable text. It is NOT a button: the caller
 * seats it in a non-interactive WorldAnchor, so it never
 * eats taps and never opens anything. Touch + desktop
 * share this label exactly (parity).
 */

export function AltarChip() {
  return (
    <p className="flex min-h-[44px] items-center gap-2 rounded bg-black/50 px-2 py-1 text-sm text-stone-100">
      Altar
    </p>
  );
}
