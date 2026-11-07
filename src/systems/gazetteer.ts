/**
 * THE GAZETTEER — the register of found places
 * (Systems, 2026-11-07; Adam's journal phase: the
 * journal's Places page reads a register of what she
 * has FOUND — caves, groves, villages, homesteads,
 * farmhouses, the authored singles: anything that
 * might carry a fragment).
 *
 * THE DISCOVERY LAW: a place is recorded ON
 * DISCOVERY, never before. This module is only the
 * register — the discovery SEATS live where sighting
 * honestly happens (cave entry, the grove's entry
 * flip, the shell's site-presence crossing; discovery
 * is sighting-priced under Adam's forgiveness rule,
 * and the sighting composition is the shell's). A
 * seat DECLARES a finding here; the first declaration
 * wins and its day never moves (the Grove pattern:
 * discovery.ts's flip, generalized — that module
 * keeps its own single fact for the guide; this
 * register is its sibling, not its replacement).
 *
 * CARRIER-SEEN: carrierSeen sets when the place's
 * fragment carrier is SEEN — declared from the faced
 * read (the shell's carrier wrapper returning the
 * place's carrier in range) with Transcribe as the
 * floor (a banked copy means the carrier stood in
 * her hands). A carrier cannot be seen at a place
 * she has not found: markCarrierSeen against an
 * unknown key is refused.
 *
 * placeKey is the family's own key (a cave's
 * dimension key, a site's instance key) — the same
 * string the carrier seats and the wrapper speak, so
 * a record and its carrier join without translation.
 * family + name are stored verbatim from the
 * declaring seat (it owns its vocabulary; the known
 * families today: 'cave', 'grove', 'village',
 * 'homestead', 'farmhouse', and the authored singles
 * by their kind).
 */

/** One found place, as the register keeps it (== its saved shape). */
export interface GazetteerRecord {
  placeKey: string;
  family: string;
  name: string;
  x: number;
  z: number;
  dimensionKey: string;
  /** The world-day she found it. The first finding wins; never moves. */
  dayFound: number;
  /** Her carrier at this place has stood in her faced read (or her hands). */
  carrierSeen: boolean;
}

/** The finding a discovery seat declares (the register stamps the rest). */
export interface GazetteerFinding {
  family: string;
  name: string;
  x: number;
  z: number;
  dimensionKey: string;
}

function validFinding(placeKey: string, finding: GazetteerFinding, day: number): boolean {
  return (
    typeof placeKey === 'string' && placeKey !== '' &&
    typeof finding.family === 'string' && finding.family !== '' &&
    typeof finding.name === 'string' && finding.name !== '' &&
    Number.isFinite(finding.x) && Number.isFinite(finding.z) &&
    typeof finding.dimensionKey === 'string' && finding.dimensionKey !== '' &&
    Number.isFinite(day)
  );
}

export class GazetteerState {
  private readonly records = new Map<string, GazetteerRecord>();

  constructor(saved?: readonly GazetteerRecord[]) {
    if (saved) {
      for (const record of saved) {
        if (!record || typeof record !== 'object') continue;
        if (!validFinding(record.placeKey, record, record.dayFound)) continue;
        if (this.records.has(record.placeKey)) continue;
        this.records.set(record.placeKey, {
          ...record,
          carrierSeen: record.carrierSeen === true,
        });
      }
    }
  }

  /**
   * Declare a finding. Returns true ONLY on the first
   * recording (the flip — a one-time beat's clean
   * trigger); a repeat, or an invalid declaration,
   * records nothing and returns false. The first
   * finding's day and facts never move.
   */
  recordFound(placeKey: string, finding: GazetteerFinding, day: number): boolean {
    if (this.records.has(placeKey)) return false;
    if (!validFinding(placeKey, finding, day)) return false;
    this.records.set(placeKey, {
      placeKey,
      family: finding.family,
      name: finding.name,
      x: finding.x,
      z: finding.z,
      dimensionKey: finding.dimensionKey,
      dayFound: day,
      carrierSeen: false,
    });
    return true;
  }

  /**
   * Declare the place's carrier seen. Returns true
   * only on the flip; false for an unknown key (a
   * carrier cannot be seen at an unfound place) and
   * for a repeat.
   */
  markCarrierSeen(placeKey: string): boolean {
    const record = this.records.get(placeKey);
    if (!record || record.carrierSeen) return false;
    record.carrierSeen = true;
    return true;
  }

  /** One found place (a copy), or undefined while unfound. */
  recordFor(placeKey: string): GazetteerRecord | undefined {
    const record = this.records.get(placeKey);
    return record ? { ...record } : undefined;
  }

  /** Has she found this place? */
  isFound(placeKey: string): boolean {
    return this.records.has(placeKey);
  }

  /** Has the place's carrier been seen? (False while unfound.) */
  carrierSeenFor(placeKey: string): boolean {
    return this.records.get(placeKey)?.carrierSeen === true;
  }

  /** Every found place, in found order (copies). */
  listFound(): GazetteerRecord[] {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  /** The save snapshot (copies; snapshot = stored = restore). */
  snapshot(): GazetteerRecord[] {
    return this.listFound();
  }
}
