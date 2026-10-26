/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PAUSE CORE (Adam, 2026-10-26: "pause the game when it's not
 * in focus"). This is the FLAG + GATE only — the trigger and
 * the resume choice are NOT baked in here. Two design questions
 * are with Adam now (auto-resume vs tap-to-resume;
 * visibilitychange-only vs also window blur); the trigger, once
 * he picks it, plugs into pauseState.setPaused + the
 * 'game:pause-changed' event and nothing else changes.
 *
 * WHAT THE FLAG FREEZES (engine side): the renderer loop
 * checks pauseState.isPaused() and, while paused, simulates
 * nothing — no player update, no sky advance, no world tick
 * (regrows, log spawns, fire lighting waits), no render. The
 * canvas keeps its last frame, so the view reads frozen. The
 * loop keeps scheduling rAF (and still consumes getDelta) so
 * resume needs no restart and sees no time spike.
 *
 * WHAT IT DOES NOT FREEZE (shell side, UI's half AFTER this
 * core lands): the shell's timers — hunger 1s interval,
 * turn-stick rAF, FPS sampler, feedback timers — gate on the
 * 'game:pause-changed' event. Until UI gates them, they keep
 * running while paused; this module alone is not a full freeze,
 * and must not be described as one.
 *
 * WHY A FLAG, NOT JUST rAF: a hidden tab already throttles rAF
 * to a stop (rendering/movement freeze by themselves), but the
 * hunger interval only throttles and fire lighting advances on
 * wall-clock — so a real pause must freeze the GAME CLOCK, and
 * the flag is what the loop + the shell both read. This is a
 * DIFFERENT shape from BioForge's pause-on-return (pause AFTER
 * coming back): Adam's Silent Earth order is pause WHILE not in
 * focus. Nothing of BioForge's return-pause is carried over.
 *
 * DELIBERATELY ABSENT: no visibilitychange / hidden / blur /
 * window / document reference anywhere in this file — the
 * trigger is a caller decision, not a module behavior. setPaused
 * is idempotent: a redundant set emits nothing, so a trigger
 * that fires repeatedly (or two triggers at once) cannot spam
 * the shell.
 */

import { bus } from './events';

export class PauseState {
  private paused = false;

  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Set the pause flag. Emits 'game:pause-changed' { paused }
   * ONLY when the value actually changes; returns the new state.
   */
  setPaused(paused: boolean): boolean {
    if (paused === this.paused) return this.paused;
    this.paused = paused;
    bus.emit('game:pause-changed', { paused });
    return this.paused;
  }
}

/** Shared pause flag (same singleton pattern as harvestState/fireState/pileState). */
export const pauseState = new PauseState();
