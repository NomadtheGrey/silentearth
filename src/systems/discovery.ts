/**
 * Discovery — the persisted facts of places found
 * (Adam's Raven Guide, 2026-10-31; Systems half).
 *
 * The guide bird exists only while the Grove is
 * undiscovered: Background's guideRuntime reads this
 * fact through the probe seam it shipped dormant
 * (installGuideProbes({ groveDiscovered })) and
 * retires the moment the fact flips — including when
 * she finds the Grove alone, with no bird involved.
 * This module is that fact and its persistence, and
 * nothing more: entry detection is the shell's (the
 * site's own groveContains), the guide's voicing is
 * UI's, and the bird is Background's.
 *
 * The record holds the DAY, not just the flag — the
 * journal keeps a when for a finding, in the same
 * spirit as the fragment pursuit's seekingSinceDay.
 * Deliberately not a general discoveries framework:
 * the caves' clue, when it unparks, gets its own fact
 * on this pattern if Adam wants it.
 */

/** The persisted discovery record. */
export interface SavedDiscovery {
  /** The day she first entered the Grove; null while undiscovered. */
  groveDiscoveredDay: number | null;
}

export class DiscoveryState {
  private groveDay: number | null;

  constructor(saved?: SavedDiscovery) {
    this.groveDay = saved?.groveDiscoveredDay ?? null;
  }

  /** The fact the guide's probe gates on. */
  groveDiscovered(): boolean {
    return this.groveDay !== null;
  }

  /** The day the Grove was found (null while undiscovered). */
  groveDiscoveredDay(): number | null {
    return this.groveDay;
  }

  /**
   * Record the finding (the shell calls this on
   * grove entry). Idempotent: returns true ONLY on
   * the flip, so a one-time beat has a clean trigger
   * and every later entry is silent.
   */
  markGroveDiscovered(day: number): boolean {
    if (this.groveDay !== null) {
      return false;
    }
    this.groveDay = day;
    return true;
  }

  /** The record (the save snapshot reads this). */
  snapshot(): SavedDiscovery {
    return { groveDiscoveredDay: this.groveDay };
  }
}
