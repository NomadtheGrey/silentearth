/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — interaction prompt (UI lane, presentation only).
 *
 * The smallest world-anchored piece: what the player can do with the
 * object they are facing, in one line. Render it inside a WorldAnchor
 * so it floats on the object itself — a bush says what it offers
 * where the bush is, not in a separate screen.
 *
 * All text is caller-supplied. This component invents no actions, no
 * keys, and no objects: `actionLabel` (e.g. what doing the thing is
 * called) and `objectName` arrive as props, as does `keyHint` when
 * there is a key to show.
 */

export interface InteractionPromptProps {
  /** What the player can do, in the caller's words. */
  actionLabel: string;
  /** The object the action belongs to, in the caller's words. */
  objectName: string;
  /** Key or button hint to show, if any (e.g. "E"). Optional. */
  keyHint?: string;
  className?: string;
}

export function InteractionPrompt({
  actionLabel,
  objectName,
  keyHint,
  className,
}: InteractionPromptProps) {
  return (
    <div
      className={
        'flex items-center gap-2 whitespace-nowrap rounded bg-black/60 px-2 py-1 text-sm text-stone-100 ' +
        (className ?? '')
      }
    >
      {keyHint ? (
        <kbd className="rounded border border-amber-500/60 bg-stone-900 px-1.5 py-0.5 text-xs font-semibold text-amber-200">
          {keyHint}
        </kbd>
      ) : null}
      <span className="font-medium">{actionLabel}</span>
      <span className="text-stone-400">· {objectName}</span>
    </div>
  );
}
