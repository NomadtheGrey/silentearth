/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Silent Earth redesign — camera transition overlay (UI lane, presentation only).
 *
 * The engine switches perspectives instantly (V / C). This overlay
 * makes that instant read as a deliberate cut: while `switching` is
 * true the screen fades toward black and the vignette deepens; when
 * it clears, the new view fades back in. It moves no camera and
 * owns no mode — the caller owns the mode, the timing, and when the
 * switch is over. Durations and vignette strengths come from
 * CAMERA_TRANSITION in cameraPresentation.ts.
 *
 * Pointer-events are always none: a transition never blocks input.
 */

import { CAMERA_TRANSITION } from './cameraPresentation';

export interface CameraTransitionProps {
  /** Whether a perspective switch is in progress. Caller-owned. */
  switching: boolean;
  className?: string;
}

export function CameraTransition({ switching, className }: CameraTransitionProps) {
  const fadeMs = CAMERA_TRANSITION.fadeMs;
  return (
    <div
      aria-hidden="true"
      className={'pointer-events-none fixed inset-0 z-50 ' + (className ?? '')}
    >
      {/* Vignette: always present, deeper while switching. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.9) 100%)',
          opacity: switching
            ? CAMERA_TRANSITION.vignetteSwitching
            : CAMERA_TRANSITION.vignetteRest,
          transition: `opacity ${fadeMs}ms ease`,
        }}
      />
      {/* Fade: black while switching, clear otherwise. */}
      <div
        className="absolute inset-0 bg-black"
        style={{
          opacity: switching ? 1 : 0,
          transition: `opacity ${fadeMs}ms ease`,
        }}
      />
    </div>
  );
}
