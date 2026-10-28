/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SLEEP UNTIL SUNRISE (Adam, 2026-10-27) — game-side listener.
 * Listener pattern like harvest:requested: UI emits, the engine
 * acts. The shell creates ONE listener (App owns it, like the
 * harvest outcome listener) with the sky rig injected — the game
 * layer never imports the renderer (that would drag three + DOM
 * into a headless-safe module and invert the renderer's
 * ownership of the rig).
 *
 * ADAM'S RULES, AS BRIEFED (broadened 2026-10-28):
 * (a) LOCATION — ANYWHERE (Adam 2026-10-28: sleep anyplace
 *     regardless of weather, home, etc.). The 2026-10-27
 *     house-gated reading is SUPERSEDED — no shelter gate
 *     remains. The lean-to-ONLY flag from that reading is
 *     MOOT (no place gate exists to narrow). shelterAt still
 *     runs so the completed payload names the house when she
 *     sleeps within SHELTER_RADIUS (6 m, shelter.ts) of one —
 *     otherwise houseId is null.
 * (b) TIME-ONLY, interim — sleep moves time only. NO hunger or
 *     health restore rides this landing; restore stays with
 *     the future regen mechanic. This module touches neither
 *     meter (it imports no hunger/health module at all).
 * (c) NIGHT-GATE, lane-decided, flagged — sleep works only at
 *     night (cycleT in the night portion per cycleSplit). "Until
 *     sunrise" means the COMING dawn, not skipping a whole day;
 *     a daytime press fails 'not-night' (UI shows nothing or a
 *     plain note — UI's call, no message invented here).
 * (d) No player move, no hunger drain for the jump itself —
 *     instant, not simulated hours. Next save persists the new
 *     cycleT via the existing sky field (snapshotSky reads the
 *     live rig), so no save change rides this landing either.
 *
 * MECHANISM — no new sky machinery: success calls the injected
 * restoreDawn(), which the shell maps to
 * renderer.restoreSky({ cycleT: 0 }) (dawn = cycleT 0, sky.ts:
 * construction and setSeed both start at dawn). Before that jump,
 * success calls trapState.sleepJump(cycleT) so the skipped night
 * hours roll at dawn, one 'trap:hour' per skipped hour (Adam
 * 2026-10-28) — the burst precedes the rig jump, so the next
 * worldTick's checkHour(0) is a no-op. Next update()
 * continues the cycle from dawn. Month stays an input (default
 * SEASON_START_MONTH, the month the renderer feeds the rig);
 * the shell may pass another month if it ever tracks one.
 *
 * CHECK ORDER (documented, UI feedback depends on it): sky,
 * then night — no shelter step (anywhere sleep, Adam
 * 2026-10-28). A daytime press fails 'not-night' even
 * unsheltered — "until sunrise" presupposes night. A null or
 * non-finite cycleT (no live rig, e.g. disposed renderer) fails
 * 'no-sky' rather than mislabeling as 'not-night'.
 *
 * SHELL WIRING (UI's App half, not this file):
 *   createSleepListener({
 *     getCycleT: () => renderer.snapshotSky()?.cycleT ?? null,
 *     restoreDawn: () => renderer.restoreSky({ cycleT: 0 }),
 *   })
 * UI emits 'sleep:requested' { x, z } (her position) from the
 * sleep button; this listener emits 'sleep:completed' or
 * 'sleep:failed' back. One listener per shell — a second
 * createSleepListener would double-jump (harmless here: dawn
 * twice is still dawn, but the completed event would double).
 */

import { bus } from './events';
import { shelterAt, shelterState } from './shelter';
import { cycleSplit } from './sky';
import { trapState } from './trapState';
import { SEASON_START_MONTH } from './weather';

/** Why a sleep press granted nothing. Fail-loud, one reason. */
export type SleepFailedReason = 'not-night' | 'no-sky';

export interface SleepListenerDeps {
  /**
   * Current cycle position, or null when no live rig exists.
   * Shell maps this to renderer.snapshotSky()?.cycleT ?? null.
   */
  getCycleT: () => number | null;
  /**
   * Jump the live sky to dawn. Shell maps this to
   * renderer.restoreSky({ cycleT: 0 }).
   */
  restoreDawn: () => void;
  /** Month for the day/night split. Defaults to SEASON_START_MONTH. */
  month?: number;
}

/**
 * Subscribe the sleep outcome listener. Returns unsubscribe.
 * Emits 'sleep:completed' { x, z, cycleT: 0, houseId } on success
 * (houseId is the nearby house, or null when she sleeps away
 * from any house — anywhere sleep, Adam 2026-10-28)
 * or 'sleep:failed' { x, z, reason } on any gate failure. The
 * listener itself moves nothing else: no position change, no
 * meter change, no state other than the rig's cycleT (via the
 * injected restoreDawn).
 */
export function createSleepListener(deps: SleepListenerDeps): () => void {
  const month = deps.month ?? SEASON_START_MONTH;
  return bus.on('sleep:requested', ({ x, z }) => {
    const cycleT = deps.getCycleT();
    if (cycleT === null || !Number.isFinite(cycleT)) {
      bus.emit('sleep:failed', { x, z, reason: 'no-sky' });
      return;
    }
    if (cycleSplit(cycleT, month).isDay) {
      bus.emit('sleep:failed', { x, z, reason: 'not-night' });
      return;
    }
    // Anywhere sleep (Adam 2026-10-28): no shelter gate. The
    // house lookup still runs so the payload names the house
    // when she sleeps near one, else null.
    const shelter = shelterAt(x, z, shelterState.snapshot());
    // Overnight trap rolls (Adam 2026-10-28): the skipped night
    // hours roll at dawn, one 'trap:hour' per skipped hour —
    // burst BEFORE the rig jumps, so the next worldTick's
    // checkHour(0) finds the index already at 0 (no double dawn).
    trapState.sleepJump(cycleT);
    deps.restoreDawn();
    bus.emit('sleep:completed', { x, z, cycleT: 0, houseId: shelter.houseId });
  });
}
