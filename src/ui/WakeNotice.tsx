/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — wake notice (UI lane, presentation only).
 *
 * WAKE MESSAGE (Adam, 2026-10-29: "We need a message
 * indicating that we have done so, and it's dawning"):
 * after a completed sleep, a transient screen-level
 * notice — one line, shown for a few seconds, then gone.
 * Screen-level, not world-anchored: she wakes facing
 * anywhere, and the message is about her, not the house.
 * It takes no input (pointer-events-none) and renders
 * identically on phone and desktop. The shell owns the
 * timing and the text (it subscribes to
 * 'sleep:completed'; failures never reach it, so a
 * failed request shows nothing). Null text renders
 * nothing — the hidden state is the absence, not a
 * placeholder.
 */

export function WakeNotice({ text }: { text: string | null }) {
  if (text === null) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[18%] z-40 flex justify-center px-4">
      <p className="rounded-full bg-black/60 px-5 py-2.5 text-center text-base font-medium text-[#f0ead6] shadow-lg">
        {text}
      </p>
    </div>
  );
}
