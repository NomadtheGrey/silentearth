/**
 * Crow-beak pile-glow (Adam 2026-10-28 tiers, superseding the
 * old +50% range draft). Tiers are crow-charm tiers — Systems
 * supplies the tier fact in parallel; this module reads it, it
 * does not invent tier logic. UI owns the arrow display; this
 * module owns the range gate the display applies.
 *
 * TIERS: tier-1 = piles glow BRIGHTLY (brighter than the base
 * slight memory-glow); tier-2 = bright glow + arrows for a
 * couple of zones (~2 zones draft — zones are chunks at 32 m,
 * so ~2 zones ≈ 64 m radius, draft, pin pass confirms);
 * tier-3 = arrows from ANY distance + range (range display
 * format is UI's: whole meters rounded, display-only, +
 * 8-point compass per the frog hint pattern — pin pass
 * confirms meters vs zones; this helper returns the raw
 * distance in metres and invents no format).
 *
 * GLOW: base slight memory-glow (tier 0, no crow) vs bright
 * (tier ≥ 1, persisting at tiers 2/3). The glow is carried by
 * the pile marker's flag (renderer.ts) — heap/pole unchanged.
 * Values are DRAFT for Adam's pin pass. Night reads as a true
 * glow (unlit emissive); day adds slightly — that is the
 * point of a memory-glow, not a bug.
 *
 * Pure facts (no THREE, no DOM) so the probe can drive them
 * headlessly. The renderer owns materials + the setter.
 */

export type CrowTier = 0 | 1 | 2 | 3;

/** Flag glow color — the flag's own warm yellow. */
export const CROW_GLOW_EMISSIVE = 0xd8b040;
/** Base slight memory-glow intensity (tier 0, no crow). DRAFT. */
export const CROW_GLOW_BASE_INTENSITY = 0.25;
/** Bright glow intensity (tier ≥ 1, persisting at tiers 2/3). DRAFT. */
export const CROW_GLOW_BRIGHT_INTENSITY = 1.0;
/** Tier-2 arrow range in metres (~2 zones × 32 m). DRAFT. */
export const CROW_ARROW_RANGE_M = 64;

/** Glow intensity for a tier: bright at tier ≥ 1, slight at tier 0. */
export function crowGlowIntensity(tier: CrowTier): number {
  return tier >= 1 ? CROW_GLOW_BRIGHT_INTENSITY : CROW_GLOW_BASE_INTENSITY;
}

export interface CrowPileArrow {
  visible: boolean;
  /** Flat XZ distance in metres (flat world, no Y). */
  distanceM: number;
}

/**
 * Arrow visibility for one pile (UI applies this per pile):
 * tier 0/1 → never (glow only, no arrows); tier 2 → within
 * CROW_ARROW_RANGE_M (inclusive); tier 3 → any distance.
 */
export function crowPileArrow(
  tier: CrowTier,
  pileX: number,
  pileZ: number,
  playerX: number,
  playerZ: number,
): CrowPileArrow {
  const distanceM = Math.hypot(pileX - playerX, pileZ - playerZ);
  if (tier >= 3) return { visible: true, distanceM };
  if (tier === 2) return { visible: distanceM <= CROW_ARROW_RANGE_M, distanceM };
  return { visible: false, distanceM };
}
