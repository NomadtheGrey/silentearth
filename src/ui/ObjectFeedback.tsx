/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — object feedback (UI lane, presentation only).
 *
 * The small word that appears on an object when something happens to
 * it — what was gathered, what was refused, what changed. Render it
 * inside a WorldAnchor so the feedback sits on the object it belongs
 * to, then let the caller show and hide it: this component owns no
 * timing, no animation, and no queue. Text and tone are caller-supplied.
 */

import type { FeedbackTone } from './types';

export interface ObjectFeedbackProps {
  /** The feedback text, in the caller's words. */
  text: string;
  /** Tone colours the chip. Default "info". */
  tone?: FeedbackTone;
  /** Whether the feedback renders. Default true. */
  visible?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<FeedbackTone, string> = {
  gain: 'text-lime-200',
  info: 'text-stone-100',
  blocked: 'text-red-300',
};

export function ObjectFeedback({
  text,
  tone = 'info',
  visible = true,
  className,
}: ObjectFeedbackProps) {
  if (!visible) {
    return null;
  }
  return (
    <div
      aria-live="polite"
      className={
        'whitespace-nowrap rounded bg-black/60 px-2 py-0.5 text-sm ' +
        TONE_CLASSES[tone] +
        ' ' +
        (className ?? '')
      }
    >
      {text}
    </div>
  );
}
