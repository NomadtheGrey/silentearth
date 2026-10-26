/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — camera perspective card (UI lane, presentation only).
 *
 * A small card that says, in plain words, what a perspective is: how
 * it feels, how it frames, and where the witch is in it. The content
 * comes from CAMERA_FRAMING in cameraPresentation.ts — this component
 * only renders it, so the wording stays in one place. Use it wherever
 * the player is told about the camera (a help popup, a settings note),
 * not as a control: switching itself stays with CameraToggle and the
 * engine's V / C keys.
 */

import type { CameraPerspective } from './types';
import { CAMERA_FRAMING } from './cameraPresentation';
import { UI_THEMES, type UiThemeName } from './themes';

export interface CameraPerspectiveCardProps {
  /** Which perspective to describe. Caller-owned. */
  mode: CameraPerspective;
  /** Look for the card. Default "mire". */
  theme?: UiThemeName;
}

export function CameraPerspectiveCard({
  mode,
  theme = 'mire',
}: CameraPerspectiveCardProps) {
  const framing = CAMERA_FRAMING[mode];
  const t = UI_THEMES[theme];
  return (
    <section aria-label={`${framing.title} camera`} className={'rounded p-3 ' + t.panel}>
      <h2 className={'text-base font-semibold ' + t.heading}>{framing.title}</h2>
      <p className="mt-1 text-sm text-stone-200">{framing.feel}</p>
      <ul className="mt-2 flex flex-col gap-0.5 text-sm text-stone-300">
        {framing.facts.map((fact, index) => (
          <li key={index}>· {fact}</li>
        ))}
      </ul>
      <p className={'mt-2 text-sm italic ' + t.muted}>{framing.witchInView}</p>
    </section>
  );
}
