// HEARTHHOME — THE MARK OF HEARTHHOME, SYSTEMS HALF
// (Adam's design, cranked 2026-11-05; sequence:
// Returning, then Hedge, then HearthHome. The mark
// REPLACES the retired Mark of Refusal — one mark
// does the refusing, home or station; the EFFECT
// 'Refusing' keeps its name on the verbs list.)
//
// THE SHAPE OF IT: the seal is laid on ONE BOUNDED
// PLACE — a home, a station — and binds that place's
// footprint. ONE seal per place. It may be utilized
// ON the Hedge Mark (Adam): the layers stack at one
// place — a seal record and a hedge record sharing
// one place id is the whole composition; there is no
// special case.
//
// THIS MODULE OWNS: the seal state (which places are
// sealed, where, how wide, since when), the LAYING
// ACT, and the RULE READS the other systems consult
// (admittance, the shelter composition, the hearth-
// warmth composition, the recovery rate). The field
// enforcement (turning a hostile at the boundary),
// the interior instance, the door, and the rendering
// belong to Background / UI, reading this state.
//
// THE FOOTPRINT IS A FACT OF THE PLACE, NOT THE
// TIER: the record stores the radius the caller
// names at laying (the house's footprint, the
// ring's reach — the shell knows its place). The
// TIER derives from her fragment knowledge at read
// time, like every mark's facts.
//
// THE LADDER (Adam, 2026-11-05):
// - T1: NO admittance AND shelter — sealed outright
//   against hostiles; her own admittance inherent;
//   shelter reads one grade better across the
//   footprint; her hearth's drying covers the whole
//   footprint.
// - T2: PERFECT shelter AND better sleep/recovery
//   for the witch and ALL companions/familiars/
//   allies inside.
// - T3: THE INTERIOR GROWS — its own instance; THIS
//   BUILD STOPS AT THE SEAM (see the T3 note below).
//
// WHO THE SEAL BINDS (Adam): 'monsters/hostiles/
// ferals/bad, bad people'. Companions/familiars/
// allies pass as hers at every tier. THE NEUTRAL
// WILDLIFE MIDDLE STANDS UNRULED: sealAdmits prices
// it as TODAY'S behavior (it passes — nothing
// excludes it today) and this note flags it for
// Adam's word; do not read the default as a ruling.
//
// A place is identified by an OPAQUE caller-named id
// (the buckets law — keys verbatim, systems never
// mints them).

import type { FragmentState } from './fragments';

/** The canonical mark string (fragments.ts registry). */
export const HEARTHHOME_MARK = 'hearthhome';

/** T2 recovery rate inside a sealed place (DRAFT). */
export const HEARTHHOME_RECOVERY_MULTIPLIER = 1.5;

/**
 * The shelter ladder, mirrored BY LITERAL from
 * game/shelter.ts HOUSE_DEFS (the fraction of
 * harshness remaining, best last) — the T1 'one
 * grade better' step walks it. Game code owns the
 * canonical values; if they move there, they move
 * here in the same landing.
 */
export const SHELTER_GRADES: readonly number[] = [1, 0.7, 0.5, 0.35, 0.2];

/**
 * T3 INTERIOR SCALE BY HOUSE TYPE (Adam's draft:
 * thatch ~2x, woven ~3x, wooden hut ~4x). A lean-to
 * is absent — the house must be bigger than a
 * lean-to. THE SEAM ONLY: the instance itself is
 * Background's dimension work, and LAYING T3's
 * interior requires materials whose list is Adam's
 * and still open — NOTHING in this module promises
 * what that gate cannot yet answer. This table is
 * the read the instance builder will consult.
 */
export const HEARTHHOME_INTERIOR_SCALE: Readonly<Record<string, number>> = {
  thatchHut: 2,
  wovenCottage: 3,
  smallWoodenHut: 4,
};

/** The tier she knows HearthHome at (0 = not learned). */
export function hearthhomeTier(fragments: FragmentState): number {
  return fragments.knownTier(HEARTHHOME_MARK);
}

/** T3's interior scale for a house type; 0 = no interior (lean-to / unknown). */
export function hearthhomeInteriorScale(houseType: string): number {
  return HEARTHHOME_INTERIOR_SCALE[houseType] ?? 0;
}

// ---------------------------------------------------------------------------
// The state — one seal per bounded place
// ---------------------------------------------------------------------------

/** One laid seal, as the state keeps it (the save mirrors this shape). */
export interface SealRecord {
  /** The place's id, opaque + verbatim (caller-named). */
  placeId: string;
  /** The footprint's centre (the place's anchor). */
  x: number;
  z: number;
  /** The footprint's radius in metres (a fact of the place). */
  radiusM: number;
  /** The world day the seal was laid. */
  laidDay: number;
}

export class HearthHomeState {
  private readonly seals = new Map<string, SealRecord>();

  /**
   * Restore is lenient per entry (the register law):
   * a blank id, a non-finite centre, a non-positive
   * or non-finite radius, or a non-finite day drops
   * the entry alone; the first record per place
   * wins. Old saves carry no seals.
   */
  constructor(saved?: readonly SealRecord[]) {
    if (saved) {
      for (const entry of saved) {
        if (!entry || typeof entry.placeId !== 'string' || entry.placeId.length === 0) {
          continue;
        }
        if (this.seals.has(entry.placeId)) continue;
        if (!Number.isFinite(entry.x) || !Number.isFinite(entry.z)) continue;
        if (!Number.isFinite(entry.radiusM) || entry.radiusM <= 0) continue;
        if (!Number.isFinite(entry.laidDay)) continue;
        this.seals.set(entry.placeId, { ...entry });
      }
    }
  }

  /** Every seal (the save snapshot reads this). Copies. */
  snapshot(): SealRecord[] {
    return [...this.seals.values()].map((seal) => ({ ...seal }));
  }

  /** Every seal, in laying order. Copies. */
  list(): SealRecord[] {
    return this.snapshot();
  }

  /** One place's seal, if it stands. A copy. */
  sealFor(placeId: string): SealRecord | undefined {
    const seal = this.seals.get(placeId);
    return seal ? { ...seal } : undefined;
  }

  /** True when this place already wears its seal. */
  hasSeal(placeId: string): boolean {
    return this.seals.has(placeId);
  }

  /** How many places she has sealed. */
  get size(): number {
    return this.seals.size;
  }

  /**
   * The seal whose footprint holds (x, z) — nearest
   * centre when footprints overlap. A copy; undefined
   * in unsealed ground.
   */
  sealAt(x: number, z: number): SealRecord | undefined {
    let best: SealRecord | undefined;
    let bestDist = Infinity;
    for (const seal of this.seals.values()) {
      const d = Math.hypot(seal.x - x, seal.z - z);
      if (d <= seal.radiusM && d < bestDist) {
        best = seal;
        bestDist = d;
      }
    }
    return best ? { ...best } : undefined;
  }

  // -------------------------------------------------------------------------
  // The laying act
  // -------------------------------------------------------------------------

  /**
   * Lay the seal on a bounded place. Validates
   * everything before recording anything: a real
   * place (id, finite centre, a positive radius), a
   * finite day, the mark learned (tier >= 1), and
   * the place unsealed (one seal per place). NO
   * COST: no materials are named for the laying
   * itself at any tier she knows — the materials
   * gate Adam still owes belongs to T3's INTERIOR,
   * not to this act (flagged for his pin pass).
   */
  laySeal(
    fragments: FragmentState,
    place: { placeId: string; x: number; z: number; radiusM: number },
    day: number,
  ): LaySealOutcome {
    if (
      typeof place.placeId !== 'string' ||
      place.placeId.length === 0 ||
      !Number.isFinite(place.x) ||
      !Number.isFinite(place.z) ||
      !Number.isFinite(place.radiusM) ||
      place.radiusM <= 0 ||
      !Number.isFinite(day)
    ) {
      return { ok: false, code: 'bad-place' };
    }
    if (hearthhomeTier(fragments) < 1) {
      return { ok: false, code: 'tier' };
    }
    if (this.seals.has(place.placeId)) {
      return { ok: false, code: 'already-sealed' };
    }
    const seal: SealRecord = {
      placeId: place.placeId,
      x: place.x,
      z: place.z,
      radiusM: place.radiusM,
      laidDay: day,
    };
    this.seals.set(seal.placeId, seal);
    return { ok: true, seal: { ...seal } };
  }
}

/** Laying outcome: the recorded seal, or a typed refusal. */
export type LaySealOutcome =
  | { ok: true; seal: SealRecord }
  | { ok: false; code: 'bad-place' | 'tier' | 'already-sealed' };

// ---------------------------------------------------------------------------
// The rule reads — what the seal DOES, consulted by its consumers
// ---------------------------------------------------------------------------

/** Who asks at the boundary. 'hers' = the witch and all she calls hers. */
export type SealWho = 'hers' | 'hostile' | 'neutral';

/**
 * ADMITTANCE at a point (T1's NO admittance): unsealed
 * ground admits everyone, as today. Inside a seal at
 * tier >= 1: hers passes at every tier; a hostile is
 * REFUSED; a neutral passes — THE UNRULED MIDDLE,
 * priced as today's behavior (see the header), not a
 * ruling. A seal under an unlearned mark (tier 0 —
 * unreachable through laySeal, kept honest for
 * restored states) binds nothing.
 */
export function sealAdmits(
  state: HearthHomeState,
  fragments: FragmentState,
  x: number,
  z: number,
  who: SealWho,
): boolean {
  if (who === 'hers') return true;
  const seal = state.sealAt(x, z);
  if (!seal || hearthhomeTier(fragments) < 1) return true;
  return who !== 'hostile';
}

/** The hostile-exclusion read the feral / hedge field consumes. */
export function sealExcludesHostiles(
  state: HearthHomeState,
  fragments: FragmentState,
  x: number,
  z: number,
): boolean {
  return !sealAdmits(state, fragments, x, z, 'hostile');
}

/**
 * THE SHELTER COMPOSITION for cold-wet's facts: at a
 * point inside a seal, T1 reads the base multiplier
 * ONE GRADE BETTER on the ladder (the best grade
 * stays the best grade); T2 reads PERFECT — 0, no
 * harshness reaches her (the reading of Adam's word
 * 'PERFECT shelter', flagged DRAFT for his pin pass).
 * Outside a seal, or under an unlearned mark, the
 * base passes through untouched.
 */
export function hearthhomeShelterMultiplier(
  state: HearthHomeState,
  fragments: FragmentState,
  x: number,
  z: number,
  baseMultiplier: number,
): number {
  const tier = hearthhomeTier(fragments);
  if (tier < 1 || !state.sealAt(x, z)) return baseMultiplier;
  if (tier >= 2) return 0;
  const bestGrade = SHELTER_GRADES[SHELTER_GRADES.length - 1];
  if (baseMultiplier <= bestGrade) return baseMultiplier;
  const index = SHELTER_GRADES.findIndex(
    (grade) => grade <= baseMultiplier + 1e-9,
  );
  const step = Math.min(
    (index < 0 ? 0 : index) + 1,
    SHELTER_GRADES.length - 1,
  );
  return SHELTER_GRADES[step];
}

/**
 * THE HEARTH-WARMTH COMPOSITION for cold-wet's
 * facts (T1: her hearth's drying covers the whole
 * footprint): at a point inside a seal whose place's
 * hearth is LIT (the shell's fact — a lit fire of
 * that place), the warmth reads FULL (1) wherever
 * she stands in the footprint. Otherwise the base
 * passes through untouched.
 */
export function hearthhomeFireWarmth(
  state: HearthHomeState,
  fragments: FragmentState,
  x: number,
  z: number,
  hearthLit: boolean,
  baseWarmth: number,
): number {
  if (!hearthLit || hearthhomeTier(fragments) < 1) return baseWarmth;
  return state.sealAt(x, z) ? 1 : baseWarmth;
}

/**
 * THE RECOVERY RATE (T2): inside a seal, recovery
 * runs at HEARTHHOME_RECOVERY_MULTIPLIER (DRAFT);
 * anywhere else, 1. SEATED + UNCONSUMED, flagged
 * (DEV's consumer question, 2026-11-06): no rate
 * seat exists today to multiply — the witch's
 * recovery is injury.ts's DISCRETE ease() (a stage
 * per full sleep, not a rate), and companion
 * mending lives creature-side. This read is the
 * priced fact in the SALVE_MEND_MULTIPLIER shape:
 * it stands ready for the creature-side healing
 * work to consult; nothing consumes it yet, and no
 * copy anywhere should claim otherwise.
 */
export function hearthhomeRecoveryMultiplier(
  state: HearthHomeState,
  fragments: FragmentState,
  x: number,
  z: number,
): number {
  if (hearthhomeTier(fragments) < 2) return 1;
  return state.sealAt(x, z) ? HEARTHHOME_RECOVERY_MULTIPLIER : 1;
}
